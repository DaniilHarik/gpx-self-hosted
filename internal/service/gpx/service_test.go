package gpx

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestListFiles_ContextCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	svc := NewService(t.TempDir(), t.TempDir())
	_, err := svc.ListFiles(ctx)
	if err == nil || !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestListFiles_ReturnsActivitiesAndPlans(t *testing.T) {
	dataDir := t.TempDir()

	activitiesDir := filepath.Join(dataDir, "Activities")
	plansDir := filepath.Join(dataDir, "Plans")
	if err := os.MkdirAll(filepath.Join(activitiesDir, "sub"), 0755); err != nil {
		t.Fatalf("failed to create activities dir: %v", err)
	}
	if err := os.MkdirAll(plansDir, 0755); err != nil {
		t.Fatalf("failed to create plans dir: %v", err)
	}

	files := []string{
		filepath.Join(activitiesDir, "track1.gpx"),
		filepath.Join(activitiesDir, "track2.GPX"),
		filepath.Join(activitiesDir, "ignore.txt"),
		filepath.Join(activitiesDir, "sub", "nested.gpx"),
		filepath.Join(plansDir, "plan1.gpx"),
	}
	for _, path := range files {
		if err := os.WriteFile(path, []byte("data"), 0644); err != nil {
			t.Fatalf("failed to write %s: %v", path, err)
		}
	}

	svc := NewService(activitiesDir, plansDir)
	list, err := svc.ListFiles(context.Background())
	if err != nil {
		t.Fatalf("ListFiles error: %v", err)
	}

	if len(list) != 4 {
		t.Fatalf("expected 4 gpx files, got %d", len(list))
	}

	expectRel := map[string]string{
		"Activities/track1.gpx":     "/data/Activities/track1.gpx",
		"Activities/track2.GPX":     "/data/Activities/track2.GPX",
		"Activities/sub/nested.gpx": "/data/Activities/sub/nested.gpx",
		"Plans/plan1.gpx":           "/data/Plans/plan1.gpx",
	}
	for _, f := range list {
		wantPath, ok := expectRel[f.RelativePath]
		if !ok {
			t.Fatalf("unexpected relative path %q", f.RelativePath)
		}
		if f.Path != wantPath {
			t.Fatalf("unexpected path for %q: got %q want %q", f.RelativePath, f.Path, wantPath)
		}
		delete(expectRel, f.RelativePath)
	}
	if len(expectRel) != 0 {
		t.Fatalf("missing expected entries: %d", len(expectRel))
	}
}

func TestListFiles_MissingRootsOk(t *testing.T) {
	dataDir := t.TempDir()
	svc := NewService(
		filepath.Join(dataDir, "Activities"),
		filepath.Join(dataDir, "Plans"),
	)

	list, err := svc.ListFiles(context.Background())
	if err != nil {
		t.Fatalf("ListFiles error: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("expected no files, got %d", len(list))
	}
}

func TestListFiles_UsesSeparateRoots(t *testing.T) {
	activitiesDir := t.TempDir()
	plansDir := t.TempDir()

	activityPath := filepath.Join(activitiesDir, "Hiking", "activity.gpx")
	planPath := filepath.Join(plansDir, "Estonia", "plan.gpx")
	for _, path := range []string{activityPath, planPath} {
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatalf("failed to create content dir: %v", err)
		}
		if err := os.WriteFile(path, []byte("data"), 0644); err != nil {
			t.Fatalf("failed to write %s: %v", path, err)
		}
	}

	svc := NewService(activitiesDir, plansDir)
	list, err := svc.ListFiles(context.Background())
	if err != nil {
		t.Fatalf("ListFiles error: %v", err)
	}

	got := make(map[string]string, len(list))
	for _, file := range list {
		got[file.RelativePath] = file.Path
	}
	want := map[string]string{
		"Activities/Hiking/activity.gpx": "/data/Activities/Hiking/activity.gpx",
		"Plans/Estonia/plan.gpx":         "/data/Plans/Estonia/plan.gpx",
	}
	if len(got) != len(want) {
		t.Fatalf("got %d files, want %d", len(got), len(want))
	}
	for relativePath, path := range want {
		if got[relativePath] != path {
			t.Errorf("got path %q for %q, want %q", got[relativePath], relativePath, path)
		}
	}
}
