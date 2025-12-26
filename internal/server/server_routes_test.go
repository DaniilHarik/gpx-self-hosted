package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"gpx-self-host/internal/config"
)

func TestServerRegistersStaticAndDataRoutes(t *testing.T) {
	staticDir := t.TempDir()
	dataDir := t.TempDir()
	cacheDir := t.TempDir()

	indexContent := []byte("<html>ok</html>")
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), indexContent, 0644); err != nil {
		t.Fatalf("failed to seed static file: %v", err)
	}

	gpxContent := []byte("gpx data")
	activitiesDir := filepath.Join(dataDir, "Activities")
	if err := os.MkdirAll(activitiesDir, 0755); err != nil {
		t.Fatalf("failed to seed Activities dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(activitiesDir, "track.gpx"), gpxContent, 0644); err != nil {
		t.Fatalf("failed to seed data file: %v", err)
	}

	cfg := &config.Config{
		StaticDir: staticDir,
		DataDir:   dataDir,
		CacheDir:  cacheDir,
	}
	srv := New(cfg)
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)

	t.Run("static files served", func(t *testing.T) {
		resp, err := ts.Client().Get(ts.URL + "/index.html")
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatalf("failed to read response body: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 for static file, got %d", resp.StatusCode)
		}
		if string(body) != string(indexContent) {
			t.Fatalf("unexpected static body: %q", string(body))
		}
	})

	t.Run("data files served", func(t *testing.T) {
		resp, err := ts.Client().Get(ts.URL + "/data/Activities/track.gpx")
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatalf("failed to read response body: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 for data file, got %d", resp.StatusCode)
		}
		if string(body) != string(gpxContent) {
			t.Fatalf("unexpected data body: %q", string(body))
		}
	})
}
