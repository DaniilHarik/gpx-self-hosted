package config

import (
	"flag"
	"os"
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
	if cfg.ActivitiesDir != "./data/Activities" {
		t.Errorf("expected default activities dir, got %s", cfg.ActivitiesDir)
	}
	if cfg.PlansDir != "./data/Plans" {
		t.Errorf("expected default plans dir, got %s", cfg.PlansDir)
	}
	if cfg.Offline != false {
		t.Error("expected offline false")
	}
	if len(cfg.Providers) == 0 {
		t.Error("expected default providers to be loaded")
	}
	if provider, ok := cfg.Providers["opentopomap"]; !ok {
		t.Error("expected opentopomap provider to be loaded by default")
	} else if provider.ZoomRange != [2]int{0, 17} {
		t.Errorf("expected opentopomap zoom range [0 17], got %v", provider.ZoomRange)
	}
}

func TestParse_CustomFlags(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	args := []string{
		"-port", ":9090",
		"-static-dir", "/tmp/static",
		"-activities-dir", "/tracks",
		"-plans-dir", "/routes",
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
	if cfg.ActivitiesDir != "/tracks" {
		t.Errorf("expected activities-dir /tracks, got %s", cfg.ActivitiesDir)
	}
	if cfg.PlansDir != "/routes" {
		t.Errorf("expected plans-dir /routes, got %s", cfg.PlansDir)
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
	t.Setenv("GPX_SELF_HOST_ACTIVITIES_DIR", "/env/tracks")
	t.Setenv("GPX_SELF_HOST_PLANS_DIR", "/env/routes")
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
	if cfg.ActivitiesDir != "/env/tracks" {
		t.Errorf("expected activities dir /env/tracks from env, got %s", cfg.ActivitiesDir)
	}
	if cfg.PlansDir != "/env/routes" {
		t.Errorf("expected plans dir /env/routes from env, got %s", cfg.PlansDir)
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

func TestParse_JSONConfig(t *testing.T) {
	configContent := `{
		"Port": ":6060",
		"StaticDir": "/json/static",
		"ActivitiesDir": "/json/tracks",
		"PlansDir": "/json/routes",
		"CacheDir": "/json/cache",
		"ClientTimeout": 20000000000,
		"MaxRetries": 15,
		"Offline": true,
		"Providers": {
			"custom": {
				"Name": "Custom Provider",
				"URLTemplate": "https://example.com/{z}/{x}/{y}.png",
				"IsTMS": false,
				"Attribution": "Example",
				"ZoomRange": [0, 10]
			}
		}
	}`
	err := os.WriteFile("config.json", []byte(configContent), 0644)
	if err != nil {
		t.Fatalf("failed to create config.json: %v", err)
	}
	defer os.Remove("config.json")

	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	cfg, err := Parse(fs, []string{})
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	if cfg.Port != ":6060" {
		t.Errorf("expected port :6060 from JSON, got %s", cfg.Port)
	}
	if cfg.StaticDir != "/json/static" {
		t.Errorf("expected static dir /json/static from JSON, got %s", cfg.StaticDir)
	}
	if cfg.ActivitiesDir != "/json/tracks" {
		t.Errorf("expected activities dir /json/tracks from JSON, got %s", cfg.ActivitiesDir)
	}
	if cfg.PlansDir != "/json/routes" {
		t.Errorf("expected plans dir /json/routes from JSON, got %s", cfg.PlansDir)
	}
	if cfg.Providers["custom"].Name != "Custom Provider" {
		t.Errorf("expected custom provider, got %v", cfg.Providers["custom"].Name)
	}
	// Verify override: default providers should be gone
	if _, ok := cfg.Providers["openstreetmap"]; ok {
		t.Error("expected default providers to be overridden by JSON")
	}
}

func TestParse_FullPrecedence(t *testing.T) {
	// ENV: Port :7070, StaticDir /env/static
	t.Setenv("GPX_SELF_HOST_PORT", ":7070")
	t.Setenv("GPX_SELF_HOST_STATIC_DIR", "/env/static")
	t.Setenv("GPX_SELF_HOST_ACTIVITIES_DIR", "/env/tracks")

	// JSON: Port :6060, ActivitiesDir /json/tracks
	configContent := `{"Port": ":6060", "ActivitiesDir": "/json/tracks"}`
	err := os.WriteFile("config.json", []byte(configContent), 0644)
	if err != nil {
		t.Fatalf("failed to create config.json: %v", err)
	}
	defer os.Remove("config.json")

	// CLI: Port :5050
	args := []string{"-port", ":5050"}

	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	cfg, err := Parse(fs, args)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	// CLI overrides JSON and ENV
	if cfg.Port != ":5050" {
		t.Errorf("expected port :5050 (CLI), got %s", cfg.Port)
	}
	// JSON overrides ENV
	if cfg.ActivitiesDir != "/json/tracks" {
		t.Errorf("expected activities dir /json/tracks (JSON), got %s", cfg.ActivitiesDir)
	}
	// ENV overrides Default
	if cfg.StaticDir != "/env/static" {
		t.Errorf("expected static dir /env/static (ENV), got %s", cfg.StaticDir)
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
