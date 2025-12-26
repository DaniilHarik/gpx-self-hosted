package tiles

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"gpx-self-host/internal/config"
	"gpx-self-host/internal/model"
)

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
func (s *Service) GetTile(ctx context.Context, providerName, z, x, yPng string) (string, error) {
	provider, ok := s.cfg.Providers[providerName]
	if !ok {
		atomic.AddUint64(&s.cacheErrors, 1)
		return "", fmt.Errorf("unknown provider")
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
		return "", fmt.Errorf("offline mode")
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
		req, reqErr := http.NewRequestWithContext(ctx, "GET", url, nil)
		if reqErr != nil {
			err = reqErr
			break
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

		status := "nil"
		if resp != nil {
			status = resp.Status
		}
		slog.Warn("Download attempt failed", "attempt", i+1, "error", err, "status", status)
		time.Sleep(1 * time.Second)
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
		return "", fmt.Errorf("upstream status %d", resp.StatusCode)
	}

	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		atomic.AddUint64(&s.cacheErrors, 1)
		return "", fmt.Errorf("failed to create cache directory: %w", err)
	}

	out, err := os.Create(cachePath)
	if err != nil {
		atomic.AddUint64(&s.cacheErrors, 1)
		return "", fmt.Errorf("failed to save tile: %w", err)
	}
	defer out.Close()

	if _, err := io.Copy(out, resp.Body); err != nil {
		slog.Error("Error writing to cache file", "error", err)
	}

	return cachePath, nil
}
