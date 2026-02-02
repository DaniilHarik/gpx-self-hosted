package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path"
	"strings"

	"gpx-self-host/internal/config"
	"gpx-self-host/internal/model"
)

type GPXService interface {
	ListFiles(ctx context.Context) ([]model.GPXFile, error)
}

type TilesService interface {
	GetTile(ctx context.Context, providerName, z, x, yPng string) (string, error)
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
	files, err := h.gpxService.ListFiles(r.Context())
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
	providerName, z, x, yPng, err := parseTileRequest(r.URL.Path)
	if err != nil {
		http.Error(w, "Invalid tile request", http.StatusBadRequest)
		return
	}

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

func parseTileRequest(urlPath string) (string, string, string, string, error) {
	parts := strings.Split(urlPath, "/")
	if len(parts) != 6 || parts[0] != "" || parts[1] != "tiles" {
		return "", "", "", "", fmt.Errorf("invalid tile path")
	}

	providerName := parts[2]
	z := parts[3]
	x := parts[4]
	yPng := parts[5]

	if !isSafeProvider(providerName) || !isDigits(z) || !isDigits(x) || !isValidTileFilename(yPng) {
		return "", "", "", "", fmt.Errorf("invalid tile parameters")
	}

	return providerName, z, x, yPng, nil
}

func isSafeProvider(name string) bool {
	if name == "" || name == "." || name == ".." {
		return false
	}
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= 'A' && r <= 'Z':
		case r >= '0' && r <= '9':
		case r == '-' || r == '_' || r == '.':
		default:
			return false
		}
	}
	return true
}

func isDigits(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func isValidTileFilename(name string) bool {
	ext := strings.ToLower(path.Ext(name))
	if ext != ".png" && ext != ".jpg" {
		return false
	}
	base := strings.TrimSuffix(name, ext)
	return isDigits(base)
}
