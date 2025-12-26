package main

import (
	"context"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gpx-self-host/internal/config"
	"gpx-self-host/internal/server"
)

func main() {
	cfg := config.Load()
	srv := server.New(cfg)

	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- srv.ListenAndServe()
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	select {
	case err := <-serverErrors:
		if err != nil {
			log.Fatal(err)
		}
	case <-ctx.Done():
		slog.Info("Shutdown requested")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Fatalf("server shutdown failed: %v", err)
		}

		if err := <-serverErrors; err != nil {
			log.Fatal(err)
		}
	}
}
