package cache

import (
	"path/filepath"
	"testing"
	"time"

	"gpx-self-hosted/internal/model"
)

func TestCache_SaveLoad(t *testing.T) {
	tmpDir := t.TempDir()
	cachePath := filepath.Join(tmpDir, "cache.json")

	c := NewCache(cachePath)

	now := time.Now().Truncate(time.Second) // XML/JSON might lose sub-second precision depending on how it's handled, but time.Time in JSON is RFC3339
	meta := model.GPXMetadata{
		Distance: 1000,
		Activity: "hiking",
		StartTime: &now,
	}

	c.Set("test.gpx", meta, 12345, 67890)

	if err := c.Save(); err != nil {
		t.Fatalf("failed to save cache: %v", err)
	}

	// Load into a new cache instance
	c2 := NewCache(cachePath)
	if err := c2.Load(); err != nil {
		t.Fatalf("failed to load cache: %v", err)
	}

	meta2, ok := c2.Get("test.gpx", 12345, 67890)
	if !ok {
		t.Fatal("expected to find test.gpx in cache")
	}

	if meta2.Distance != meta.Distance || meta2.Activity != meta.Activity {
		t.Errorf("expected activity %s and distance %f, got %s and %f", meta.Activity, meta.Distance, meta2.Activity, meta2.Distance)
	}
	
	if meta2.StartTime == nil || !meta2.StartTime.Equal(*meta.StartTime) {
		t.Errorf("expected startTime %v, got %v", meta.StartTime, meta2.StartTime)
	}
}

func TestCache_Invalidation(t *testing.T) {
	tmpDir := t.TempDir()
	cachePath := filepath.Join(tmpDir, "cache.json")
	c := NewCache(cachePath)

	meta := model.GPXMetadata{Distance: 1000}
	c.Set("test.gpx", meta, 12345, 67890)

	// Same size/modtime
	if _, ok := c.Get("test.gpx", 12345, 67890); !ok {
		t.Error("expected valid cache")
	}

	// Different modtime
	if _, ok := c.Get("test.gpx", 12345, 99999); ok {
		t.Error("expected invalid cache due to modtime")
	}

	// Different size
	if _, ok := c.Get("test.gpx", 99999, 67890); ok {
		t.Error("expected invalid cache due to size")
	}
}

func TestCache_LoadNonExistent(t *testing.T) {
	c := NewCache("non-existent.json")
	if err := c.Load(); err != nil {
		t.Fatalf("expected no error for non-existent file, got %v", err)
	}
}
