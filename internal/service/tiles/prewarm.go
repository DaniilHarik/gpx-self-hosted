package tiles

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"gpx-self-host/internal/model"
)

const (
	mercatorMaxLat = 85.05112878
	maxZoomRadius  = 6

	defaultPrewarmConcurrency = 8
	maxTilesPerPrewarmRequest = 50000
)

type tileCoord struct {
	z int
	x int
	y int
}

func clampInt(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func clampLat(lat float64) float64 {
	if lat > mercatorMaxLat {
		return mercatorMaxLat
	}
	if lat < -mercatorMaxLat {
		return -mercatorMaxLat
	}
	return lat
}

func normalizeLon(lon float64) float64 {
	// Normalize to [-180, 180)
	for lon < -180 {
		lon += 360
	}
	for lon >= 180 {
		lon -= 360
	}
	return lon
}

func lonToTileX(lon float64, zoom int) int {
	n := float64(uint(1) << uint(zoom))
	xf := (lon + 180.0) / 360.0 * n
	x := int(math.Floor(xf))
	return clampInt(x, 0, int(n)-1)
}

func latToTileY(lat float64, zoom int) int {
	lat = clampLat(lat)
	latRad := lat * math.Pi / 180.0
	n := float64(uint(1) << uint(zoom))
	yf := (1.0 - math.Log(math.Tan(latRad)+1.0/math.Cos(latRad))/math.Pi) / 2.0 * n
	y := int(math.Floor(yf))
	return clampInt(y, 0, int(n)-1)
}

type xSegment struct {
	min int
	max int
}

func xSegmentsForBounds(west, east float64, zoom int) []xSegment {
	n := int(uint(1) << uint(zoom))

	westNorm := normalizeLon(west)
	eastNorm := normalizeLon(east)

	// If bounds span (almost) the whole world, just fetch everything.
	if math.Abs(east-west) >= 360.0-1e-9 {
		return []xSegment{{min: 0, max: n - 1}}
	}

	xW := lonToTileX(westNorm, zoom)
	xE := lonToTileX(eastNorm, zoom)

	if westNorm <= eastNorm {
		if xW > xE {
			xW, xE = xE, xW
		}
		return []xSegment{{min: xW, max: xE}}
	}

	// Dateline crossing: west is "greater" than east after normalization.
	return []xSegment{
		{min: xW, max: n - 1},
		{min: 0, max: xE},
	}
}

func yRangeForBounds(north, south float64, zoom int) (int, int) {
	northY := latToTileY(north, zoom)
	southY := latToTileY(south, zoom)
	if northY > southY {
		return southY, northY
	}
	return northY, southY
}

func (s *Service) PrewarmView(ctx context.Context, req model.PrewarmViewRequest) (model.PrewarmViewResponse, error) {
	start := time.Now()
	provider, ok := s.cfg.Providers[req.ProviderKey]
	if !ok {
		return model.PrewarmViewResponse{}, fmt.Errorf("unknown provider")
	}
	if s.cfg.Offline {
		return model.PrewarmViewResponse{}, fmt.Errorf("offline mode")
	}

	minZoom := provider.ZoomRange[0]
	maxZoom := provider.ZoomRange[1]

	zoomRadius := clampInt(req.ZoomRadius, 0, maxZoomRadius)

	centerZoom := clampInt(req.CenterZoom, minZoom, maxZoom)
	zoomMin := clampInt(centerZoom-zoomRadius, minZoom, maxZoom)
	zoomMax := clampInt(centerZoom+zoomRadius, minZoom, maxZoom)

	north := req.Bounds.North
	south := req.Bounds.South
	if south > north {
		north, south = south, north
	}

	slog.Info(
		"Prewarm started",
		"provider", req.ProviderKey,
		"zoom_min", zoomMin,
		"zoom_max", zoomMax,
		"bounds", req.Bounds,
	)

	total := 0
	for z := zoomMin; z <= zoomMax; z++ {
		xSegs := xSegmentsForBounds(req.Bounds.West, req.Bounds.East, z)
		yMin, yMax := yRangeForBounds(north, south, z)
		yCount := yMax - yMin + 1
		for _, seg := range xSegs {
			total += (seg.max - seg.min + 1) * yCount
			if total > maxTilesPerPrewarmRequest {
				slog.Warn(
					"Prewarm rejected: too many tiles",
					"provider", req.ProviderKey,
					"zoom_min", zoomMin,
					"zoom_max", zoomMax,
					"total", total,
					"max", maxTilesPerPrewarmRequest,
					"duration_ms", time.Since(start).Milliseconds(),
				)
				return model.PrewarmViewResponse{}, fmt.Errorf("too many tiles")
			}
		}
	}

	if total == 0 {
		slog.Info(
			"Prewarm completed: no tiles",
			"provider", req.ProviderKey,
			"zoom_min", zoomMin,
			"zoom_max", zoomMax,
			"duration_ms", time.Since(start).Milliseconds(),
		)
		return model.PrewarmViewResponse{
			ProviderKey: req.ProviderKey,
			ZoomMin:     zoomMin,
			ZoomMax:     zoomMax,
			Total:       0,
			Ok:          0,
			Failed:      0,
		}, nil
	}

	workerCount := defaultPrewarmConcurrency
	if workerCount > total {
		workerCount = total
	}
	if workerCount < 1 {
		workerCount = 1
	}

	tasks := make(chan tileCoord, 256)

	var okCount int64
	var failedCount int64

	var wg sync.WaitGroup
	wg.Add(workerCount)
	for i := 0; i < workerCount; i++ {
		go func() {
			defer wg.Done()
			for tc := range tasks {
				if ctx.Err() != nil {
					return
				}
				yOut := tc.y
				if provider.IsTMS {
					maxY := (1 << tc.z) - 1
					yOut = maxY - tc.y
				}
				_, err := s.GetTile(ctx, req.ProviderKey, strconv.Itoa(tc.z), strconv.Itoa(tc.x), fmt.Sprintf("%d.png", yOut))
				if err != nil {
					atomic.AddInt64(&failedCount, 1)
				} else {
					atomic.AddInt64(&okCount, 1)
				}
			}
		}()
	}

	for z := zoomMin; z <= zoomMax; z++ {
		xSegs := xSegmentsForBounds(req.Bounds.West, req.Bounds.East, z)
		yMin, yMax := yRangeForBounds(north, south, z)
		for _, seg := range xSegs {
			for x := seg.min; x <= seg.max; x++ {
				for y := yMin; y <= yMax; y++ {
					if ctx.Err() != nil {
						close(tasks)
						wg.Wait()
						slog.Info(
							"Prewarm canceled",
							"provider", req.ProviderKey,
							"zoom_min", zoomMin,
							"zoom_max", zoomMax,
							"total", total,
							"ok", atomic.LoadInt64(&okCount),
							"failed", atomic.LoadInt64(&failedCount),
							"duration_ms", time.Since(start).Milliseconds(),
						)
						return model.PrewarmViewResponse{}, ctx.Err()
					}
					tasks <- tileCoord{z: z, x: x, y: y}
				}
			}
		}
	}
	close(tasks)
	wg.Wait()

	resp := model.PrewarmViewResponse{
		ProviderKey: req.ProviderKey,
		ZoomMin:     zoomMin,
		ZoomMax:     zoomMax,
		Total:       total,
		Ok:          int(atomic.LoadInt64(&okCount)),
		Failed:      int(atomic.LoadInt64(&failedCount)),
	}

	slog.Info(
		"Prewarm completed",
		"provider", req.ProviderKey,
		"zoom_min", zoomMin,
		"zoom_max", zoomMax,
		"total", resp.Total,
		"ok", resp.Ok,
		"failed", resp.Failed,
		"duration_ms", time.Since(start).Milliseconds(),
	)

	return resp, nil
}
