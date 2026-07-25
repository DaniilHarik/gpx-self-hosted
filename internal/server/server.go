package server

import (
	"context"
	"log/slog"
	"net/http"
	"path/filepath"
	"time"

	"gpx-self-hosted/internal/config"
	"gpx-self-hosted/internal/handler"
	"gpx-self-hosted/internal/service/gpx"
	"gpx-self-hosted/internal/service/gpx/cache"
	"gpx-self-hosted/internal/service/tiles"
)

type Server struct {
	cfg        *config.Config
	httpServer *http.Server
}

func New(cfg *config.Config) *Server {
	// Initialize Services
	gpxCache := cache.NewCache(filepath.Join(cfg.CacheDir, "gpx_metadata.json"))
	if err := gpxCache.Load(); err != nil {
		slog.Error("failed to load gpx metadata cache", "error", err)
	}

	activitiesDir := cfg.ActivitiesDir
	plansDir := cfg.PlansDir
	gpxService := gpx.NewService(activitiesDir, plansDir)
	gpxService.Cache = gpxCache
	tileService := tiles.NewService(cfg)

	// Initialize Handlers
	h := handler.New(cfg, gpxService, tileService)

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir(cfg.StaticDir)))
	mux.Handle("/data/", http.NotFoundHandler())
	mux.Handle("/data/Activities/", http.StripPrefix("/data/Activities/", http.FileServer(http.Dir(activitiesDir))))
	mux.Handle("/data/Plans/", http.StripPrefix("/data/Plans/", http.FileServer(http.Dir(plansDir))))
	mux.HandleFunc("/api/gpx", h.ListGPXFiles)
	mux.HandleFunc("/api/tile-config", h.TileConfig)
	mux.HandleFunc("/api/status", h.Status)
	mux.HandleFunc("/tiles/", h.TileProxy)

	s := &Server{
		cfg: cfg,
		httpServer: &http.Server{
			Addr:              cfg.Port,
			Handler:           mux,
			ReadHeaderTimeout: 5 * time.Second,
			ReadTimeout:       30 * time.Second,
			WriteTimeout:      30 * time.Second,
			IdleTimeout:       120 * time.Second,
		},
	}
	return s
}

func (s *Server) ListenAndServe() error {
	size, err := getDirSize(s.cfg.CacheDir)
	if err != nil {
		size = 0
	}
	slog.Info("Current cache size", "size_readable", formatBytes(size))
	logGPXSources(slog.Default(), s.cfg)
	slog.Info("Starting server", "address", "http://localhost"+s.cfg.Port)
	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func logGPXSources(logger *slog.Logger, cfg *config.Config) {
	logger.Info(
		"GPX source directories",
		"activities_dir", cfg.ActivitiesDir,
		"plans_dir", cfg.PlansDir,
	)
}

func (s *Server) Handler() http.Handler {
	return s.httpServer.Handler
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}
