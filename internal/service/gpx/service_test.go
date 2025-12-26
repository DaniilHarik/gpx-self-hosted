package gpx

import (
	"os"
	"path/filepath"
	"testing"
)

func TestListFiles(t *testing.T) {
	dataDir := t.TempDir()

	// Create some test files
	files := []struct {
		path    string
		content string
	}{
		{"Activities/test1.gpx", "gpx content"},
		{"Activities/test2.GPX", "gpx content case insensitive"},
		{"Activities/subdir/test3.gpx", "nested gpx"},
		{"Activities/ignore.txt", "not a gpx"},
		{"Activities/.hidden.gpx", "hidden gpx"},
		{"Plans/plan.gpx", "plan gpx"},
		{"root.gpx", "ignored at root"},
	}

	for _, f := range files {
		fullPath := filepath.Join(dataDir, f.path)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			t.Fatalf("failed to create dir: %v", err)
		}
		if err := os.WriteFile(fullPath, []byte(f.content), 0644); err != nil {
			t.Fatalf("failed to write file: %v", err)
		}
	}

	service := NewService(dataDir)
	result, err := service.ListFiles()
	if err != nil {
		t.Fatalf("ListFiles failed: %v", err)
	}

	expectedCount := 5 // test1.gpx, test2.GPX, subdir/test3.gpx, .hidden.gpx, plan.gpx
	if len(result) != expectedCount {
		t.Errorf("expected %d files, got %d", expectedCount, len(result))
	}

	found := make(map[string]bool)
	for _, f := range result {
		found[f.RelativePath] = true
	}

	expectedPaths := []string{
		"Activities/test1.gpx",
		"Activities/test2.GPX",
		"Activities/subdir/test3.gpx",
		"Activities/.hidden.gpx",
		"Plans/plan.gpx",
	}
	for _, path := range expectedPaths {
		if !found[path] {
			t.Errorf("expected path %s not found in result", path)
		}
	}
}
