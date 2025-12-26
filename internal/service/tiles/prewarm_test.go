package tiles

import (
	"context"
	"testing"

	"gpx-self-host/internal/config"
	"gpx-self-host/internal/model"
)

func TestClampInt(t *testing.T) {
	tests := []struct {
		val, min, max, expected int
	}{
		{5, 0, 10, 5},
		{-1, 0, 10, 0},
		{11, 0, 10, 10},
	}
	for _, tc := range tests {
		got := clampInt(tc.val, tc.min, tc.max)
		if got != tc.expected {
			t.Errorf("clampInt(%d, %d, %d) = %d; want %d", tc.val, tc.min, tc.max, got, tc.expected)
		}
	}
}

func TestNormalizeLon(t *testing.T) {
	tests := []struct {
		lon, expected float64
	}{
		{180, -180},
		{-180, -180},
		{0, 0},
		{190, -170},
		{-190, 170},
		{360, 0},
		{-360, 0},
	}
	for _, tc := range tests {
		got := normalizeLon(tc.lon)
		if got != tc.expected {
			t.Errorf("normalizeLon(%f) = %f; want %f", tc.lon, got, tc.expected)
		}
	}
}

func TestLonToTileX(t *testing.T) {
	// Zoom 0: 1 tile for the whole world
	if got := lonToTileX(0, 0); got != 0 {
		t.Errorf("lonToTileX(0, 0) = %d; want 0", got)
	}
	// Zoom 1: 2x2 tiles
	if got := lonToTileX(-180, 1); got != 0 {
		t.Errorf("lonToTileX(-180, 1) = %d; want 0", got)
	}
	if got := lonToTileX(0, 1); got != 1 {
		t.Errorf("lonToTileX(0, 1) = %d; want 1", got)
	}
}

func TestLatToTileY(t *testing.T) {
	// Zoom 0: 1 tile for the whole world
	if got := latToTileY(0, 0); got != 0 {
		t.Errorf("latToTileY(0, 0) = %d; want 0", got)
	}
	// Zoom 1: 2x2 tiles
	if got := latToTileY(85, 1); got != 0 {
		t.Errorf("latToTileY(85, 1) = %d; want 0", got)
	}
	if got := latToTileY(-85, 1); got != 1 {
		t.Errorf("latToTileY(-85, 1) = %d; want 1", got)
	}
}

func TestXSegmentsForBounds(t *testing.T) {
	// Normal case
	segs := xSegmentsForBounds(0, 10, 10)
	if len(segs) != 1 || segs[0].min > segs[0].max {
		t.Errorf("unexpected segments for normal range: %+v", segs)
	}

	// Dateline crossing
	segs = xSegmentsForBounds(170, -170, 10)
	if len(segs) != 2 {
		t.Errorf("expected 2 segments for dateline crossing, got %d", len(segs))
	}

	// Full world
	segs = xSegmentsForBounds(-180, 180, 10)
	if len(segs) != 1 || segs[0].min != 0 || segs[0].max != (1<<10)-1 {
		t.Errorf("unexpected segments for full world: %+v", segs)
	}
}

func TestPrewarmView_Errors(t *testing.T) {
	cfg := &config.Config{
		Providers: map[string]config.TileProviderConfig{
			"test": {ZoomRange: [2]int{0, 10}},
		},
		Offline: false,
	}
	service := NewService(cfg)
	ctx := context.Background()

	// Unknown provider
	_, err := service.PrewarmView(ctx, model.PrewarmViewRequest{ProviderKey: "unknown"})
	if err == nil {
		t.Error("expected error for unknown provider")
	}

	// Offline mode
	service.cfg.Offline = true
	_, err = service.PrewarmView(ctx, model.PrewarmViewRequest{ProviderKey: "test"})
	if err == nil {
		t.Error("expected error in offline mode")
	}
	service.cfg.Offline = false

	// Too many tiles
	_, err = service.PrewarmView(ctx, model.PrewarmViewRequest{
		ProviderKey: "test",
		Bounds:      model.BoundsDTO{North: 85, South: -85, East: 180, West: -180},
		CenterZoom:  10,
		ZoomRadius:  5,
	})
	if err == nil || err.Error() != "too many tiles" {
		t.Errorf("expected 'too many tiles' error, got %v", err)
	}
}
