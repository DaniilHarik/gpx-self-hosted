package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"gpx-self-host/internal/config"
	"gpx-self-host/internal/model"
)

type GPXService interface {
	ListFiles() ([]model.GPXFile, error)
}

type TilesService interface {
	GetTile(ctx context.Context, providerName, z, x, yPng string) (string, error)
	PrewarmView(ctx context.Context, req model.PrewarmViewRequest) (model.PrewarmViewResponse, error)
	GetStats() model.StatusResponse
}

type Handlers struct {
	cfg         *config.Config
	gpxService  GPXService
	tileService TilesService
}

func New(cfg *config.Config, gpxService GPXService, tileService TilesService) *Handlers {
	return &Handlers{
		cfg:         cfg,
		gpxService:  gpxService,
		tileService: tileService,
	}
}

func (h *Handlers) ListGPXFiles(w http.ResponseWriter, r *http.Request) {
	files, err := h.gpxService.ListFiles()
	if err != nil {
		http.Error(w, "Error scanning data folder: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err := json.NewEncoder(w).Encode(files); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
	}
}

func (h *Handlers) TileConfig(w http.ResponseWriter, r *http.Request) {
	providers := make(map[string]model.ProviderDTO)
	for key, p := range h.cfg.Providers {
		providers[key] = model.ProviderDTO{
			Name:        p.Name,
			IsTMS:       p.IsTMS,
			Attribution: p.Attribution,
			MinZoom:     p.ZoomRange[0],
			MaxZoom:     p.ZoomRange[1],
		}
	}

	resp := model.TileConfigResponse{
		Providers: providers,
		Initial:   "maaamet-kaart",
		Offline:   h.cfg.Offline,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
	}
}

func (h *Handlers) Status(w http.ResponseWriter, r *http.Request) {
	resp := h.tileService.GetStats()

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
	}
}

func (h *Handlers) TileProxy(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 6 {
		http.Error(w, "Invalid tile request", http.StatusBadRequest)
		return
	}

	providerName := parts[2]
	z, x, yPng := parts[3], parts[4], parts[5]

	path, err := h.tileService.GetTile(r.Context(), providerName, z, x, yPng)
	if err != nil {
		if err.Error() == "unknown provider" {
			http.Error(w, "Unknown provider", http.StatusNotFound)
		} else if err.Error() == "offline mode" {
			http.Error(w, "Tile not available offline", http.StatusNotFound)
		} else if strings.HasPrefix(err.Error(), "upstream status") {
			http.Error(w, "Tile not found on upstream", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to fetch tile", http.StatusBadGateway)
		}
		return
	}

	http.ServeFile(w, r, path)
}

func (h *Handlers) PrewarmView(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req model.PrewarmViewRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}
	if req.ProviderKey == "" {
		http.Error(w, "Missing providerKey", http.StatusBadRequest)
		return
	}

	resp, err := h.tileService.PrewarmView(r.Context(), req)
	if err != nil {
		switch {
		case err.Error() == "unknown provider":
			http.Error(w, "Unknown provider", http.StatusNotFound)
		case err.Error() == "offline mode":
			http.Error(w, "Server is in offline mode", http.StatusConflict)
		case err.Error() == "too many tiles":
			http.Error(w, "Requested area too large", http.StatusBadRequest)
		default:
			http.Error(w, "Failed to prewarm tiles", http.StatusBadGateway)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
	}
}
