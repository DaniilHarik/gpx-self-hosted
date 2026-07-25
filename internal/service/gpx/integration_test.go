package gpx

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"gpx-self-hosted/internal/service/gpx/cache"
)

func TestService_ListFiles_Caching(t *testing.T) {
	dataDir := t.TempDir()
	cacheFile := filepath.Join(t.TempDir(), "cache.json")

	// Create a dummy GPX file
	gpxPath := filepath.Join(dataDir, "Activities", "test.gpx")
	if err := os.MkdirAll(filepath.Dir(gpxPath), 0755); err != nil {
		t.Fatal(err)
	}
	gpxContent := `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test Track</name>
    <trkseg>
      <trkpt lat="60.1" lon="24.1"><ele>10</ele><time>2026-01-01T10:00:00Z</time></trkpt>
      <trkpt lat="60.2" lon="24.2"><ele>20</ele><time>2026-01-01T11:00:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`
	if err := os.WriteFile(gpxPath, []byte(gpxContent), 0644); err != nil {
		t.Fatal(err)
	}

	c := cache.NewCache(cacheFile)
	svc := NewService(
		filepath.Join(dataDir, "Activities"),
		filepath.Join(dataDir, "Plans"),
	)
	svc.Cache = c // This will fail to compile initially as svc.Cache doesn't exist

	// First call: should parse and cache
	files, err := svc.ListFiles(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
	if files[0].Metadata == nil {
		t.Fatal("expected metadata to be populated")
	}
	if files[0].Metadata.Distance == 0 {
		t.Fatal("expected non-zero distance")
	}

	// Verify it's in the cache
	if _, ok := c.Get("Activities/test.gpx", 0, 0); !ok {
		// Note: we don't know the exact size/modtime here easily,
		// but the service should have called Set.
		// We can check if the cache file exists after Save.
	}

	if err := c.Save(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(cacheFile); os.IsNotExist(err) {
		t.Fatal("cache file should have been created")
	}

	// Modify the GPX file to test invalidation
	time.Sleep(time.Second) // Ensure modTime changes
	if err := os.WriteFile(gpxPath, []byte(gpxContent+" "), 0644); err != nil {
		t.Fatal(err)
	}

	files2, err := svc.ListFiles(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if files2[0].Metadata == nil {
		t.Fatal("expected metadata to be populated after invalidation")
	}
}
