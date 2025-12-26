package tiles

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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

func TestClampLat(t *testing.T) {
	tests := []struct {
		lat, expected float64
	}{
		{90, mercatorMaxLat},
		{-90, -mercatorMaxLat},
		{0, 0},
		{45, 45},
	}
	for _, tc := range tests {
		got := clampLat(tc.lat)
		if got != tc.expected {
			t.Errorf("clampLat(%f) = %f; want %f", tc.lat, got, tc.expected)
		}
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

func TestPrewarmView_Success(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("tile data"))
	}))
	defer ts.Close()

	cfg := &config.Config{
		CacheDir:      t.TempDir(),
		ClientTimeout: time.Second,
		MaxRetries:    1,
		Providers: map[string]config.TileProviderConfig{
			"test": {
				ZoomRange:   [2]int{0, 2},
				URLTemplate: ts.URL + "/{z}/{x}/{y}.png",
			},
		},
	}
	service := NewService(cfg)
	ctx := context.Background()

	resp, err := service.PrewarmView(ctx, model.PrewarmViewRequest{
		ProviderKey: "test",
		Bounds:      model.BoundsDTO{North: 10, South: 0, West: 0, East: 10},
		CenterZoom:  1,
		ZoomRadius:  0,
	})
	if err != nil {
		t.Fatalf("PrewarmView failed: %v", err)
	}
	if resp.Total == 0 {
		t.Error("expected positive total tiles")
	}
	if resp.Ok != resp.Total {
		t.Errorf("expected %d ok tiles, got %d", resp.Total, resp.Ok)
	}
}

func TestPrewarmView_ZeroTiles(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	cfg := &config.Config{
		CacheDir: t.TempDir(),
		Providers: map[string]config.TileProviderConfig{
			"test": {
				ZoomRange:   [2]int{10, 12},
				URLTemplate: ts.URL + "/{z}/{x}/{y}.png",
			},
		},
	}
	service := NewService(cfg)
	ctx := context.Background()

	resp, err := service.PrewarmView(ctx, model.PrewarmViewRequest{
		ProviderKey: "test",
		Bounds:      model.BoundsDTO{North: 0, South: 0, West: 0, East: 0},
		CenterZoom:  10,
		ZoomRadius:  0,
	})
	if err != nil {
		t.Fatalf("PrewarmView failed: %v", err)
	}
	// Even with 0x0 bounds, we get at least 1 tile due to floor/rounding logic.
	if resp.Total == 0 {
		t.Errorf("expected at least 1 tile, got %d", resp.Total)
	}
}
