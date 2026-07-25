package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"gpx-self-hosted/internal/config"
)

func TestServerRegistersStaticAndDataRoutes(t *testing.T) {
	staticDir := t.TempDir()
	activitiesDir := t.TempDir()
	plansDir := t.TempDir()
	cacheDir := t.TempDir()

	indexContent := []byte("<html>ok</html>")
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), indexContent, 0644); err != nil {
		t.Fatalf("failed to seed static file: %v", err)
	}

	activityContent := []byte("activity data")
	if err := os.WriteFile(filepath.Join(activitiesDir, "track.gpx"), activityContent, 0644); err != nil {
		t.Fatalf("failed to seed activity file: %v", err)
	}
	planContent := []byte("plan data")
	if err := os.WriteFile(filepath.Join(plansDir, "plan.gpx"), planContent, 0644); err != nil {
		t.Fatalf("failed to seed plan file: %v", err)
	}

	cfg := &config.Config{
		StaticDir:     staticDir,
		ActivitiesDir: activitiesDir,
		PlansDir:      plansDir,
		CacheDir:      cacheDir,
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

	t.Run("activity files served", func(t *testing.T) {
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
		if string(body) != string(activityContent) {
			t.Fatalf("unexpected activity body: %q", string(body))
		}
	})

	t.Run("plan files served", func(t *testing.T) {
		resp, err := ts.Client().Get(ts.URL + "/data/Plans/plan.gpx")
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatalf("failed to read response body: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 for plan file, got %d", resp.StatusCode)
		}
		if string(body) != string(planContent) {
			t.Fatalf("unexpected plan body: %q", string(body))
		}
	})
}
