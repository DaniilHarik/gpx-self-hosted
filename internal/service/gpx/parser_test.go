package gpx

import (
	"strings"
	"testing"
)

func TestParseGPX(t *testing.T) {
	gpxData := `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test">
  <trk>
    <name>Test Track</name>
    <type>Hiking</type>
    <trkseg>
      <trkpt lat="59.437" lon="24.7535">
        <ele>10.0</ele>
        <time>2023-01-01T10:00:00Z</time>
      </trkpt>
      <trkpt lat="59.438" lon="24.7545">
        <ele>15.0</ele>
        <time>2023-01-01T10:10:00Z</time>
      </trkpt>
      <trkpt lat="59.437" lon="24.7555">
        <ele>12.0</ele>
        <time>2023-01-01T10:20:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`

	meta, err := ParseGPX(strings.NewReader(gpxData))
	if err != nil {
		t.Fatalf("ParseGPX error: %v", err)
	}

	if meta.Activity != "Hiking" {
		t.Errorf("expected activity Hiking, got %q", meta.Activity)
	}

	if meta.Distance <= 0 {
		t.Errorf("expected positive distance, got %f", meta.Distance)
	}

	if meta.ElevationGain != 5.0 {
		t.Errorf("expected elevation gain 5.0, got %f", meta.ElevationGain)
	}

	if meta.ElevationLoss != 3.0 {
		t.Errorf("expected elevation loss 3.0, got %f", meta.ElevationLoss)
	}

	if meta.Duration != 1200 { // 20 minutes
		t.Errorf("expected duration 1200s, got %f", meta.Duration)
	}

	if meta.StartTime == nil || meta.StartTime.Format("2006-01-02T15:04:05Z") != "2023-01-01T10:00:00Z" {
		t.Errorf("unexpected start time: %v", meta.StartTime)
	}

	if meta.Bounds.North != 59.438 || meta.Bounds.South != 59.437 {
		t.Errorf("unexpected bounds: %+v", meta.Bounds)
	}
}

func TestParseGPX_Empty(t *testing.T) {
	gpxData := `<gpx></gpx>`
	meta, err := ParseGPX(strings.NewReader(gpxData))
	if err != nil {
		t.Fatalf("ParseGPX error: %v", err)
	}
	if meta.Distance != 0 {
		t.Errorf("expected 0 distance, got %f", meta.Distance)
	}
}
