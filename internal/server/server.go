package server

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"gpx-self-host/internal/config"
	"gpx-self-host/internal/handler"
	"gpx-self-host/internal/service/gpx"
	"gpx-self-host/internal/service/tiles"
)

type Server struct {
	cfg        *config.Config
	httpServer *http.Server
}

func New(cfg *config.Config) *Server {
	// Initialize Services
	gpxService := gpx.NewService(cfg.DataDir)
	tileService := tiles.NewService(cfg)

	// Initialize Handlers
	h := handler.New(cfg, gpxService, tileService)

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir(cfg.StaticDir)))
	mux.Handle("/data/", http.StripPrefix("/data/", http.FileServer(http.Dir(cfg.DataDir))))
	mux.HandleFunc("/api/gpx", h.ListGPXFiles)
	mux.HandleFunc("/api/tile-config", h.TileConfig)
	mux.HandleFunc("/api/status", h.Status)
	mux.HandleFunc("/api/prewarm-view", h.PrewarmView)
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
	slog.Info("Starting server", "address", "http://localhost"+s.cfg.Port)
	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (s *Server) Handler() http.Handler {
	return s.httpServer.Handler
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}
