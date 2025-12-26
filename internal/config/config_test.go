package config

import (
	"flag"
	"testing"
	"time"
)

func TestParseDefaults(t *testing.T) {
	fs := flag.NewFlagSet("config-defaults", flag.ContinueOnError)
	cfg, err := Parse(fs, []string{})
	if err != nil {
		t.Fatalf("Parse returned error: %v", err)
	}

	if cfg.Port != ":8080" || cfg.StaticDir != "./static" || cfg.DataDir != "./data" || cfg.CacheDir != "./cache" {
		t.Fatalf("defaults not applied correctly: %+v", cfg)
	}

	if cfg.ClientTimeout != 10*time.Second || cfg.MaxRetries != 3 {
		t.Fatalf("default timing not applied correctly: timeout=%s retries=%d", cfg.ClientTimeout, cfg.MaxRetries)
	}

	if len(cfg.Providers) == 0 {
		t.Fatalf("expected default providers to be populated")
	}

	osm, ok := cfg.Providers["openstreetmap"]
	if !ok {
		t.Fatalf("expected openstreetmap provider to be present in defaults")
	}
	if osm.URLTemplate != "https://tile.openstreetmap.org/{z}/{x}/{y}.png" {
		t.Fatalf("unexpected openstreetmap url template: %q", osm.URLTemplate)
	}
	if osm.ZoomRange != [2]int{0, 19} {
		t.Fatalf("unexpected openstreetmap zoom range: %+v", osm.ZoomRange)
	}
}

func TestParseOverrides(t *testing.T) {
	fs := flag.NewFlagSet("config-overrides", flag.ContinueOnError)
	args := []string{
		"-port=:9090",
		"-static-dir=./web",
		"-data-dir=./tracks",
		"-cache-dir=./tmpcache",
		"-client-timeout=5s",
		"-max-retries=5",
	}

	cfg, err := Parse(fs, args)
	if err != nil {
		t.Fatalf("Parse returned error: %v", err)
	}

	if cfg.Port != ":9090" || cfg.StaticDir != "./web" || cfg.DataDir != "./tracks" || cfg.CacheDir != "./tmpcache" {
		t.Fatalf("overrides not applied correctly: %+v", cfg)
	}

	if cfg.ClientTimeout != 5*time.Second || cfg.MaxRetries != 5 {
		t.Fatalf("overridden timing not applied correctly: timeout=%s retries=%d", cfg.ClientTimeout, cfg.MaxRetries)
	}
}
