package gpx

import (
	"encoding/xml"
	"io"
	"math"
	"time"

	"gpx-self-hosted/internal/model"
)

type gpxXML struct {
	Trk []trkXML `xml:"trk"`
	Wpt []wptXML `xml:"wpt"`
}

type trkXML struct {
	Name   string      `xml:"name"`
	Type   string      `xml:"type"`
	Trkseg []trksegXML `xml:"trkseg"`
}

type trksegXML struct {
	Trkpt []trkptXML `xml:"trkpt"`
}

type trkptXML struct {
	Lat  float64   `xml:"lat,attr"`
	Lon  float64   `xml:"lon,attr"`
	Ele  float64   `xml:"ele"`
	Time time.Time `xml:"time"`
}

type wptXML struct {
	Lat float64 `xml:"lat,attr"`
	Lon float64 `xml:"lon,attr"`
}

func ParseGPX(r io.Reader) (model.GPXMetadata, error) {
	var g gpxXML
	if err := xml.NewDecoder(r).Decode(&g); err != nil {
		return model.GPXMetadata{}, err
	}

	var meta model.GPXMetadata
	meta.Bounds = model.BoundsDTO{
		North: -90, South: 90, East: -180, West: 180,
	}

	var totalDistance float64
	var totalGain float64
	var totalLoss float64
	var startTime *time.Time
	var endTime *time.Time
	var hasPoints bool

	// Process tracks
	for _, trk := range g.Trk {
		if meta.Activity == "" && trk.Type != "" {
			meta.Activity = trk.Type
		}
		for _, seg := range trk.Trkseg {
			var prevEle float64
			var prevLat float64
			var prevLon float64
			var firstPtInSeg bool = true

			for _, pt := range seg.Trkpt {
				updateBounds(&meta.Bounds, pt.Lat, pt.Lon)
				hasPoints = true

				// Time
				if !pt.Time.IsZero() {
					if startTime == nil || pt.Time.Before(*startTime) {
						startTime = &pt.Time
					}
					if endTime == nil || pt.Time.After(*endTime) {
						endTime = &pt.Time
					}
				}

				if firstPtInSeg {
					firstPtInSeg = false
				} else {
					// Distance
					dist := haversine(prevLat, prevLon, pt.Lat, pt.Lon)
					totalDistance += dist

					// Elevation
					diff := pt.Ele - prevEle
					if diff > 0 {
						totalGain += diff
					} else {
						totalLoss -= diff
					}
				}
				prevLat, prevLon, prevEle = pt.Lat, pt.Lon, pt.Ele
			}
		}
	}

	// Process waypoints for bounds if needed
	for _, wpt := range g.Wpt {
		updateBounds(&meta.Bounds, wpt.Lat, wpt.Lon)
		hasPoints = true
	}

	if !hasPoints {
		meta.Bounds = model.BoundsDTO{}
	}

	meta.Distance = totalDistance
	meta.ElevationGain = totalGain
	meta.ElevationLoss = totalLoss
	meta.StartTime = startTime
	if startTime != nil && endTime != nil {
		meta.Duration = endTime.Sub(*startTime).Seconds()
	}

	return meta, nil
}

func updateBounds(b *model.BoundsDTO, lat, lon float64) {
	if lat > b.North { b.North = lat }
	if lat < b.South { b.South = lat }
	if lon > b.East { b.East = lon }
	if lon < b.West { b.West = lon }
}

func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371000 // meters
	phi1 := lat1 * math.Pi / 180
	phi2 := lat2 * math.Pi / 180
	dphi := (lat2 - lat1) * math.Pi / 180
	dlambda := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(dphi/2)*math.Sin(dphi/2) +
		math.Cos(phi1)*math.Cos(phi2)*
			math.Sin(dlambda/2)*math.Sin(dlambda/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}
