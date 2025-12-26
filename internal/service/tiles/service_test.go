package tiles

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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
