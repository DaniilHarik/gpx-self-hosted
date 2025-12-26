package model

type GPXFile struct {
	Name         string `json:"name"`
	Path         string `json:"path"`         // Relative path for fetching (with /data/ prefix)
	RelativePath string `json:"relativePath"` // Path inside data dir, useful for displaying folders
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

type PrewarmViewRequest struct {
	ProviderKey string    `json:"providerKey"`
	Bounds      BoundsDTO `json:"bounds"`
	CenterZoom  int       `json:"centerZoom"`
	ZoomRadius  int       `json:"zoomRadius"`
}

type PrewarmViewResponse struct {
	ProviderKey string `json:"providerKey"`
	ZoomMin     int    `json:"zoomMin"`
	ZoomMax     int    `json:"zoomMax"`
	Total       int    `json:"total"`
	Ok          int    `json:"ok"`
	Failed      int    `json:"failed"`
}
