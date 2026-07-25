package model

import "time"

type GPXFile struct {
	Name         string       `json:"name"`
	Path         string       `json:"path"`         // Relative path for fetching (with /data/ prefix)
	RelativePath string       `json:"relativePath"` // Logical Activities/ or Plans/ path for display
	Metadata     *GPXMetadata `json:"metadata,omitempty"`
}

type GPXMetadata struct {
	Distance      float64    `json:"distance"`      // in meters
	Duration      float64    `json:"duration"`      // in seconds
	ElevationGain float64    `json:"elevationGain"` // in meters
	ElevationLoss float64    `json:"elevationLoss"` // in meters
	Activity      string     `json:"activity"`
	StartTime     *time.Time `json:"startTime,omitempty"`
	Bounds        BoundsDTO  `json:"bounds"`
}

type ProviderDTO struct {
	Name        string `json:"name"`
	IsTMS       bool   `json:"isTMS"`
	Attribution string `json:"attribution"`
	MinZoom     int    `json:"minZoom"`
	MaxZoom     int    `json:"maxZoom"`
}

type TileConfigResponse struct {
	Providers map[string]ProviderDTO `json:"providers"`
	Initial   string                 `json:"initial"`
	Offline   bool                   `json:"offline"`
}

type StatusResponse struct {
	CacheHits   uint64 `json:"cacheHits"`
	CacheMisses uint64 `json:"cacheMisses"`
	CacheErrors uint64 `json:"cacheErrors"`
}

type BoundsDTO struct {
	North float64 `json:"north"`
	South float64 `json:"south"`
	East  float64 `json:"east"`
	West  float64 `json:"west"`
}
