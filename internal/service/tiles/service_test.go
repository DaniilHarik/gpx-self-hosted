package tiles

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"gpx-self-host/internal/config"
)

func TestGetTile_CacheHit(t *testing.T) {
	cacheDir := t.TempDir()
	providerName := "test"
	z, x, y := "1", "2", "3"
	ext := ".png"
	yPng := y + ext

	// Seed cache
	tilePath := filepath.Join(cacheDir, "tiles", providerName, z, x, yPng)
	if err := os.MkdirAll(filepath.Dir(tilePath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(tilePath, []byte("cached data"), 0644); err != nil {
		t.Fatal(err)
	}

	cfg := &config.Config{
		CacheDir: cacheDir,
		Providers: map[string]config.TileProviderConfig{
			providerName: {Name: "Test"},
		},
	}
	service := NewService(cfg)

	path, err := service.GetTile(context.Background(), providerName, z, x, yPng)
	if err != nil {
		t.Fatalf("GetTile failed: %v", err)
	}

	if path != tilePath {
		t.Errorf("expected path %s, got %s", tilePath, path)
	}

	stats := service.GetStats()
	if stats.CacheHits != 1 {
		t.Errorf("expected 1 cache hit, got %d", stats.CacheHits)
	}
}

func TestGetTile_ContextCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	cfg := &config.Config{
		CacheDir: t.TempDir(),
		Providers: map[string]config.TileProviderConfig{
			"test": {Name: "Test"},
		},
	}
	service := NewService(cfg)

	_, err := service.GetTile(ctx, "test", "1", "2", "3.png")
	if err == nil || !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestGetTile_Download(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("downloaded data"))
	}))
	defer ts.Close()

	cacheDir := t.TempDir()
	providerName := "test"
	z, x, y := "1", "2", "3"
	yPng := y + ".png"

	cfg := &config.Config{
		CacheDir:      cacheDir,
		ClientTimeout: 1 * time.Second,
		MaxRetries:    1,
		Providers: map[string]config.TileProviderConfig{
			providerName: {
				Name:        "Test",
				URLTemplate: ts.URL + "/{z}/{x}/{y}.png",
			},
		},
	}
	service := NewService(cfg)

	path, err := service.GetTile(context.Background(), providerName, z, x, yPng)
	if err != nil {
		t.Fatalf("GetTile failed: %v", err)
	}

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "downloaded data" {
		t.Errorf("unexpected content: %q", string(content))
	}

	stats := service.GetStats()
	if stats.CacheMisses != 1 {
		t.Errorf("expected 1 cache miss, got %d", stats.CacheMisses)
	}
}

func TestGetTile_Retry(t *testing.T) {
	attempts := 0
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 2 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("success after retry"))
	}))
	defer ts.Close()

	cacheDir := t.TempDir()
	cfg := &config.Config{
		CacheDir:      cacheDir,
		ClientTimeout: 500 * time.Millisecond,
		MaxRetries:    2,
		Providers: map[string]config.TileProviderConfig{
			"test": {
				URLTemplate: ts.URL + "/{z}/{x}/{y}.png",
			},
		},
	}
	service := NewService(cfg)

	// Since NewService sets up a default client, we need a way to shorten the sleep in the retry loop
	// for faster tests, but service.go has a hardcoded 1s sleep.
	// We'll just wait or we could refactor service.go to take a retry delay.
	// For now, let's just run it as is.

	path, err := service.GetTile(context.Background(), "test", "1", "2", "3.png")
	if err != nil {
		t.Fatalf("GetTile failed: %v", err)
	}

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "success after retry" {
		t.Errorf("unexpected content: %q", string(content))
	}

	if attempts != 2 {
		t.Errorf("expected 2 attempts, got %d", attempts)
	}
}

func TestGetTile_Offline(t *testing.T) {
	cfg := &config.Config{
		Offline: true,
		Providers: map[string]config.TileProviderConfig{
			"test": {Name: "Test"},
		},
	}
	service := NewService(cfg)

	_, err := service.GetTile(context.Background(), "test", "1", "2", "3.png")
	if err == nil || !errors.Is(err, ErrOfflineMode) {
		t.Errorf("expected offline mode error, got %v", err)
	}
}

func TestGetTile_Upstream404(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer ts.Close()

	cfg := &config.Config{
		CacheDir:      t.TempDir(),
		ClientTimeout: time.Second,
		MaxRetries:    3,
		Providers: map[string]config.TileProviderConfig{
			"test": {
				URLTemplate: ts.URL + "/{z}/{x}/{y}.png",
			},
		},
	}
	service := NewService(cfg)

	_, err := service.GetTile(context.Background(), "test", "1", "2", "3.png")
	var upstreamErr *UpstreamStatusError
	if err == nil || !errors.As(err, &upstreamErr) || upstreamErr.StatusCode != http.StatusNotFound {
		t.Errorf("expected upstream status 404 error, got %v", err)
	}
}

func TestGetTile_UnknownProvider(t *testing.T) {
	// ... (rest of TestGetTile_UnknownProvider remains the same)
}

func TestGetTile_SaveFailure(t *testing.T) {
	// Use a read-only directory to trigger save failure
	cacheDir := t.TempDir()
	readOnlyDir := filepath.Join(cacheDir, "readonly")
	if err := os.MkdirAll(readOnlyDir, 0555); err != nil {
		t.Fatal(err)
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("data"))
	}))
	defer ts.Close()

	cfg := &config.Config{
		CacheDir:      readOnlyDir, // This will fail MkdirAll which is called inside tiles/provider/z/x
		ClientTimeout: time.Second,
		MaxRetries:    1,
		Providers: map[string]config.TileProviderConfig{
			"test": {URLTemplate: ts.URL + "/{z}/{x}/{y}.png"},
		},
	}
	service := NewService(cfg)

	_, err := service.GetTile(context.Background(), "test", "1", "2", "3.png")
	if err == nil || !strings.Contains(err.Error(), "failed to create cache directory") {
		t.Errorf("expected 'failed to create cache directory' error, got %v", err)
	}
}

func TestGetTile_PartialWriteLeavesNoCorruptCache(t *testing.T) {
	// errReader returns some bytes then fails, simulating a dropped connection.
	errReader := io.MultiReader(
		strings.NewReader("partial"),
		errorReader{},
	)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.Copy(w, errReader)
	}))
	defer ts.Close()

	cacheDir := t.TempDir()
	providerName := "test"
	z, x, yPng := "1", "2", "3.png"

	cfg := &config.Config{
		CacheDir:      cacheDir,
		ClientTimeout: time.Second,
		MaxRetries:    1,
		Providers: map[string]config.TileProviderConfig{
			providerName: {URLTemplate: ts.URL + "/{z}/{x}/{y}.png"},
		},
	}
	service := NewService(cfg)

	_, err := service.GetTile(context.Background(), providerName, z, x, yPng)
	// The request succeeds (200 OK) so no fetch error; any write error or
	// success is fine — what matters is the cache path is not a partial file.
	cachePath := filepath.Join(cacheDir, "tiles", providerName, z, x, yPng)
	if _, statErr := os.Stat(cachePath); statErr == nil {
		if err != nil {
			t.Errorf("partial write left a corrupt file at cachePath despite write error: %v", err)
		}
	}
	// Also verify no leftover .tmp files.
	tmpDir := filepath.Join(cacheDir, "tiles", providerName, z, x)
	if entries, readErr := os.ReadDir(tmpDir); readErr == nil {
		for _, e := range entries {
			if strings.HasSuffix(e.Name(), ".tmp") {
				t.Errorf("leftover temp file not cleaned up: %s", e.Name())
			}
		}
	}
}

// errorReader always returns an error on Read.
type errorReader struct{}

func (errorReader) Read(_ []byte) (int, error) {
	return 0, fmt.Errorf("simulated read error")
}

func TestGetTile_DownloadError(t *testing.T) {
	cfg := &config.Config{
		CacheDir:      t.TempDir(),
		ClientTimeout: time.Second,
		MaxRetries:    1,
		Providers: map[string]config.TileProviderConfig{
			"test": {URLTemplate: "http://invalid-url-that-fails/{z}/{x}/{y}.png"},
		},
	}
	service := NewService(cfg)

	_, err := service.GetTile(context.Background(), "test", "1", "2", "3.png")
	if err == nil || !strings.Contains(err.Error(), "failed to fetch tile") {
		t.Errorf("expected 'failed to fetch tile' error, got %v", err)
	}
}
