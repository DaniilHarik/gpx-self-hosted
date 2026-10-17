package gpx

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestParseGPXRejectsInvalidNumbers(t *testing.T) {
	for _, point := range []string{
		`<trkpt lat="NaN" lon="25"/>`,
		`<trkpt lat="+Inf" lon="25"/>`,
		`<trkpt lat="91" lon="25"/>`,
		`<trkpt lat="58" lon="-181"/>`,
		`<trkpt lat="58" lon="NaN"/>`,
		`<trkpt lat="58" lon="25"><ele>NaN</ele></trkpt>`,
		`<trkpt lat="58" lon="25"><ele>-Inf</ele></trkpt>`,
		`<trkpt lat="58" lon="25"><ele>1e308</ele></trkpt><trkpt lat="59" lon="25"><ele>-1e308</ele></trkpt>`,
	} {
		t.Run(point, func(t *testing.T) {
			if _, err := ParseGPX(strings.NewReader(`<gpx><trk><trkseg>` + point + `</trkseg></trk></gpx>`)); err == nil {
				t.Fatal("expected invalid numeric data to be rejected")
			}
		})
	}
	for _, point := range []string{`<wpt lat="Inf" lon="25"/>`, `<wpt lat="58" lon="181"/>`} {
		if _, err := ParseGPX(strings.NewReader(`<gpx>` + point + `</gpx>`)); err == nil {
			t.Fatal("expected invalid waypoint to be rejected")
		}
	}
}

func TestParseGPXAntipodalPointsRemainJSONEncodable(t *testing.T) {
	meta, err := ParseGPX(strings.NewReader(`<gpx><trk><trkseg><trkpt lat="89" lon="0"/><trkpt lat="-89" lon="180"/></trkseg></trk></gpx>`))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := json.Marshal(meta); err != nil {
		t.Fatalf("valid coordinates produced invalid metadata: %v", err)
	}
}

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
