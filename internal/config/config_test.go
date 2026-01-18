package config

import (
	"flag"
	"testing"
	"time"
)

func TestParse_Defaults(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	cfg, err := Parse(fs, []string{})
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	if cfg.Port != ":8080" {
		t.Errorf("expected port :8080, got %s", cfg.Port)
	}
	if cfg.ClientTimeout != 10*time.Second {
		t.Errorf("expected timeout 10s, got %v", cfg.ClientTimeout)
	}
	if cfg.MaxRetries != 3 {
		t.Errorf("expected max retries 3, got %d", cfg.MaxRetries)
	}
	if cfg.Offline != false {
		t.Error("expected offline false")
	}
	if len(cfg.Providers) == 0 {
		t.Error("expected default providers to be loaded")
	}
}

func TestParse_CustomFlags(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	args := []string{
		"-port", ":9090",
		"-static-dir", "/tmp/static",
		"-data-dir", "/tmp/data",
		"-cache-dir", "/tmp/cache",
		"-client-timeout", "5s",
		"-max-retries", "5",
		"-offline",
	}

	cfg, err := Parse(fs, args)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	if cfg.Port != ":9090" {
		t.Errorf("expected port :9090, got %s", cfg.Port)
	}
	if cfg.StaticDir != "/tmp/static" {
		t.Errorf("expected static-dir /tmp/static, got %s", cfg.StaticDir)
	}
	if cfg.DataDir != "/tmp/data" {
		t.Errorf("expected data-dir /tmp/data, got %s", cfg.DataDir)
	}
	if cfg.CacheDir != "/tmp/cache" {
		t.Errorf("expected cache-dir /tmp/cache, got %s", cfg.CacheDir)
	}
	if cfg.ClientTimeout != 5*time.Second {
		t.Errorf("expected timeout 5s, got %v", cfg.ClientTimeout)
	}
	if cfg.MaxRetries != 5 {
		t.Errorf("expected max retries 5, got %d", cfg.MaxRetries)
	}
	if cfg.Offline != true {
		t.Error("expected offline true")
	}
}

func TestParse_Error(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	_, err := Parse(fs, []string{"-unknown-flag"})
	if err == nil {
		t.Error("expected error for unknown flag")
	}
}

func TestParse_EnvironmentVariables(t *testing.T) {
	// Set environment variables
	t.Setenv("GPX_SELF_HOST_PORT", ":7070")
	t.Setenv("GPX_SELF_HOST_STATIC_DIR", "/env/static")
	t.Setenv("GPX_SELF_HOST_DATA_DIR", "/env/data")
	t.Setenv("GPX_SELF_HOST_CACHE_DIR", "/env/cache")
	t.Setenv("GPX_SELF_HOST_CLIENT_TIMEOUT", "15s")
	t.Setenv("GPX_SELF_HOST_MAX_RETRIES", "10")
	t.Setenv("GPX_SELF_HOST_OFFLINE", "true")

	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	// Parse with empty args, should fall back to ENV
	cfg, err := Parse(fs, []string{})
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	if cfg.Port != ":7070" {
		t.Errorf("expected port :7070 from env, got %s", cfg.Port)
	}
	if cfg.StaticDir != "/env/static" {
		t.Errorf("expected static dir /env/static from env, got %s", cfg.StaticDir)
	}
	if cfg.DataDir != "/env/data" {
		t.Errorf("expected data dir /env/data from env, got %s", cfg.DataDir)
	}
	if cfg.CacheDir != "/env/cache" {
		t.Errorf("expected cache dir /env/cache from env, got %s", cfg.CacheDir)
	}
	if cfg.ClientTimeout != 15*time.Second {
		t.Errorf("expected timeout 15s from env, got %v", cfg.ClientTimeout)
	}
	if cfg.MaxRetries != 10 {
		t.Errorf("expected max retries 10 from env, got %d", cfg.MaxRetries)
	}
	if cfg.Offline != true {
		t.Error("expected offline true from env")
	}
}

func TestLoad(t *testing.T) {
	// Load uses flag.CommandLine and os.Args.
	// We can't easily change os.Args safely in tests without affecting others,
	// but we can at least call it to ensure it doesn't panic with default args.
	// Since we are running in go test, os.Args will contain test flags.
	// To avoid log.Fatalf, we just verify it returns a non-nil config.
	cfg := Load()
	if cfg == nil {
		t.Error("expected non-nil config from Load")
	}
}
