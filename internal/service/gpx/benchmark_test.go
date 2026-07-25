package gpx

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"gpx-self-host/internal/service/gpx/cache"
)

func BenchmarkListFiles_NoCache(b *testing.B) {
	dataDir := b.TempDir()
	createFiles(b, dataDir, 50)
	svc := NewService(
		filepath.Join(dataDir, "Activities"),
		filepath.Join(dataDir, "Plans"),
	)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := svc.ListFiles(context.Background())
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkListFiles_WithCache_Cold(b *testing.B) {
	dataDir := b.TempDir()
	createFiles(b, dataDir, 50)
	cacheFile := filepath.Join(b.TempDir(), "cache.json")

	svc := NewService(
		filepath.Join(dataDir, "Activities"),
		filepath.Join(dataDir, "Plans"),
	)
	svc.Cache = cache.NewCache(cacheFile)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Reset cache for cold start simulation
		svc.Cache = cache.NewCache(cacheFile)
		_, err := svc.ListFiles(context.Background())
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkListFiles_WithCache_Warm(b *testing.B) {
	dataDir := b.TempDir()
	createFiles(b, dataDir, 50)
	cacheFile := filepath.Join(b.TempDir(), "cache.json")

	svc := NewService(
		filepath.Join(dataDir, "Activities"),
		filepath.Join(dataDir, "Plans"),
	)
	svc.Cache = cache.NewCache(cacheFile)

	// Warm up
	if _, err := svc.ListFiles(context.Background()); err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := svc.ListFiles(context.Background())
		if err != nil {
			b.Fatal(err)
		}
	}
}

func createFiles(b *testing.B, dataDir string, count int) {
	activitiesDir := filepath.Join(dataDir, "Activities")
	if err := os.MkdirAll(activitiesDir, 0755); err != nil {
		b.Fatal(err)
	}

	gpxContent := `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk><name>Test</name><trkseg>
  <trkpt lat="60.1" lon="24.1"><ele>10</ele><time>2026-01-01T10:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`

	for i := 0; i < count; i++ {
		path := filepath.Join(activitiesDir, fmt.Sprintf("file%d.gpx", i))
		if err := os.WriteFile(path, []byte(gpxContent), 0644); err != nil {
			b.Fatal(err)
		}
	}
}
