package server

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"gpx-self-hosted/internal/config"
	"gpx-self-hosted/internal/model"
)

func TestGPXIndexPathsRoundTripReservedFilenames(t *testing.T) {
	roots := map[string]string{"Activities": t.TempDir(), "Plans": t.TempDir()}
	names := []string{"route #2.gpx", "literal%2F.gpx", "café +50%.gpx", "route?.gpx"}
	want := make(map[string]string)
	for kind, root := range roots {
		for _, name := range names {
			if runtime.GOOS == "windows" && strings.Contains(name, "?") {
				continue // '?' is not a valid Windows filename.
			}
			rel := filepath.Join("trips #1 & 50%", name)
			filename := filepath.Join(root, rel)
			if err := os.MkdirAll(filepath.Dir(filename), 0755); err != nil {
				t.Fatal(err)
			}
			body := `<gpx><metadata><name>` + name + `</name></metadata></gpx>`
			if err := os.WriteFile(filename, []byte(body), 0644); err != nil {
				t.Fatal(err)
			}
			want[kind+"/"+filepath.ToSlash(rel)] = body
		}
	}

	srv := httptest.NewServer(New(&config.Config{
		StaticDir: t.TempDir(), ActivitiesDir: roots["Activities"],
		PlansDir: roots["Plans"], CacheDir: t.TempDir(),
	}).Handler())
	t.Cleanup(srv.Close)
	resp, err := srv.Client().Get(srv.URL + "/api/gpx")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("index status: %d", resp.StatusCode)
	}
	var files []model.GPXFile
	if err := json.NewDecoder(resp.Body).Decode(&files); err != nil {
		t.Fatal(err)
	}
	if len(files) != len(want) {
		t.Fatalf("got %d files, want %d", len(files), len(want))
	}
	for _, file := range files {
		t.Run(file.RelativePath, func(t *testing.T) {
			expected, ok := want[file.RelativePath]
			if !ok || file.Name != filepath.Base(file.RelativePath) {
				t.Fatalf("display name or relative path changed: %+v", file)
			}
			resp, err := srv.Client().Get(srv.URL + file.Path)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			body, err := io.ReadAll(resp.Body)
			if err != nil {
				t.Fatal(err)
			}
			if resp.StatusCode != http.StatusOK || string(body) != expected {
				t.Fatalf("index URL %q returned status %d, body %q", file.Path, resp.StatusCode, body)
			}
		})
	}
}

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
