package tiles

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"gpx-self-hosted/internal/config"
	"gpx-self-hosted/internal/model"
)

var (
	ErrUnknownProvider = errors.New("unknown provider")
	ErrOfflineMode     = errors.New("offline mode")
)

const tileProxyUserAgent = "GPXSelfHosted/1.0 (+https://github.com/daniilharik/gpx-self-hosted)"

type UpstreamStatusError struct {
	StatusCode int
}

func (e *UpstreamStatusError) Error() string {
	return fmt.Sprintf("upstream status %d", e.StatusCode)
}

type Service struct {
	cfg         *config.Config
	client      *http.Client
	cacheHits   uint64
	cacheMisses uint64
	cacheErrors uint64
}

func NewService(cfg *config.Config) *Service {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	client := &http.Client{
		Timeout:   cfg.ClientTimeout,
		Transport: transport,
	}
	return &Service{
		cfg:    cfg,
		client: client,
	}
}

func (s *Service) GetStats() model.StatusResponse {
	return model.StatusResponse{
		CacheHits:   atomic.LoadUint64(&s.cacheHits),
		CacheMisses: atomic.LoadUint64(&s.cacheMisses),
		CacheErrors: atomic.LoadUint64(&s.cacheErrors),
	}
}

// GetTile returns the path to the cached tile, downloading it if necessary.
func (s *Service) GetTile(ctx context.Context, providerName, z, x, yPng, referer string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	provider, ok := s.cfg.Providers[providerName]
	if !ok {
		atomic.AddUint64(&s.cacheErrors, 1)
		return "", fmt.Errorf("%w: %s", ErrUnknownProvider, providerName)
	}

	cacheDir := filepath.Join(s.cfg.CacheDir, "tiles", providerName, z, x)
	cachePath := filepath.Join(cacheDir, yPng)

	if _, err := os.Stat(cachePath); err == nil {
		slog.Info("Cache HIT", "path", cachePath)
		atomic.AddUint64(&s.cacheHits, 1)
		return cachePath, nil
	}
	atomic.AddUint64(&s.cacheMisses, 1)

	if s.cfg.Offline {
		slog.Warn("Offline mode enabled; skipping download", "path", cachePath)
		atomic.AddUint64(&s.cacheErrors, 1)
		return "", ErrOfflineMode
	}

	yOnly := strings.TrimSuffix(yPng, filepath.Ext(yPng))

	url := provider.URLTemplate
	url = strings.Replace(url, "{z}", z, 1)
	url = strings.Replace(url, "{x}", x, 1)
	url = strings.Replace(url, "{y}", yOnly, 1)

	slog.Info("Cache MISS", "path", cachePath, "download_url", url)

	var resp *http.Response
	var err error
	for i := 0; i < s.cfg.MaxRetries; i++ {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return "", ctxErr
		}
		req, reqErr := http.NewRequestWithContext(ctx, "GET", url, nil)
		if reqErr != nil {
			err = reqErr
			break
		}
		if providerName == "openstreetmap" {
			req.Header.Set("User-Agent", tileProxyUserAgent)
			if sanitizedReferer := sanitizeReferer(referer); sanitizedReferer != "" {
				req.Header.Set("Referer", sanitizedReferer)
			}
		}
		resp, err = s.client.Do(req)
		if err == nil && resp.StatusCode == http.StatusOK {
			break
		}

		if err == nil && resp.StatusCode == http.StatusNotFound {
			break // Don't retry 404s
		}

		if resp != nil {
			resp.Body.Close()
		}

		if ctxErr := ctx.Err(); ctxErr != nil {
			return "", ctxErr
		}

		status := "nil"
		if resp != nil {
			status = resp.Status
		}
		slog.Warn("Download attempt failed", "attempt", i+1, "error", err, "status", status)
		if i < s.cfg.MaxRetries-1 {
			if sleepErr := sleepWithContext(ctx, time.Second); sleepErr != nil {
				return "", sleepErr
			}
		}
	}

	if ctxErr := ctx.Err(); ctxErr != nil {
		return "", ctxErr
	}
	if err != nil {
		slog.Error("Failed to fetch tile after max attempts", "max_retries", s.cfg.MaxRetries, "error", err)
		atomic.AddUint64(&s.cacheErrors, 1)
		return "", fmt.Errorf("failed to fetch tile: %w", err)
	}

	if resp == nil {
		atomic.AddUint64(&s.cacheErrors, 1)
		return "", fmt.Errorf("failed to fetch tile: nil response")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		slog.Error("Upstream returned non-OK status", "status", resp.StatusCode)
		atomic.AddUint64(&s.cacheErrors, 1)
		return "", &UpstreamStatusError{StatusCode: resp.StatusCode}
	}

	if ctxErr := ctx.Err(); ctxErr != nil {
		return "", ctxErr
	}
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		atomic.AddUint64(&s.cacheErrors, 1)
		return "", fmt.Errorf("failed to create cache directory: %w", err)
	}

	// Write to a temp file first so that a partial write never leaves a
	// corrupt entry at cachePath. os.Rename within the same directory is
	// atomic on POSIX systems.
	tmp, err := os.CreateTemp(cacheDir, "tile-*.tmp")
	if err != nil {
		atomic.AddUint64(&s.cacheErrors, 1)
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpPath := tmp.Name()

	if _, err := io.Copy(tmp, resp.Body); err != nil {
		tmp.Close()
		_ = os.Remove(tmpPath)
		atomic.AddUint64(&s.cacheErrors, 1)
		if ctxErr := ctx.Err(); ctxErr != nil {
			return "", ctxErr
		}
		return "", fmt.Errorf("failed to write tile: %w", err)
	}
	tmp.Close()

	if err := os.Rename(tmpPath, cachePath); err != nil {
		_ = os.Remove(tmpPath)
		atomic.AddUint64(&s.cacheErrors, 1)
		return "", fmt.Errorf("failed to finalize tile cache: %w", err)
	}

	return cachePath, nil
}

func sleepWithContext(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func sanitizeReferer(raw string) string {
	if raw == "" {
		return ""
	}

	parsed, err := url.Parse(raw)
	if err != nil || !parsed.IsAbs() {
		return ""
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return ""
	}

	return parsed.String()
}
