package config

import (
	"encoding/json"
	"flag"
	"log"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port          string
	StaticDir     string
	DataDir       string
	CacheDir      string
	Providers     map[string]TileProviderConfig
	ClientTimeout time.Duration
	MaxRetries    int
	Offline       bool
}

type TileProviderConfig struct {
	Name        string
	URLTemplate string
	IsTMS       bool
	Attribution string
	ZoomRange   [2]int
}

// Load parses CLI flags using the default flag.CommandLine and exits the
// program on failure. This mirrors the previous behaviour but keeps parsing
// logic inside the config package.
func Load() *Config {
	cfg, err := Parse(flag.CommandLine, os.Args[1:])
	if err != nil {
		log.Fatalf("failed to parse config flags: %v", err)
	}
	return cfg
}

// Parse allows configuration via CLI flags; defaults mirror the previous
// hardcoded values.
func Parse(fs *flag.FlagSet, args []string) (*Config, error) {
	defaultConfig := Config{
		Port:          ":8080",
		StaticDir:     "./static",
		DataDir:       "./data",
		CacheDir:      "./cache",
		ClientTimeout: 10 * time.Second,
		MaxRetries:    3,
		Offline:       false,
		Providers:     defaultProviders(),
	}

	// Override defaults with Environment Variables if present
	if v := os.Getenv("GPX_SELF_HOST_PORT"); v != "" {
		defaultConfig.Port = v
	}
	if v := os.Getenv("GPX_SELF_HOST_STATIC_DIR"); v != "" {
		defaultConfig.StaticDir = v
	}
	if v := os.Getenv("GPX_SELF_HOST_DATA_DIR"); v != "" {
		defaultConfig.DataDir = v
	}
	if v := os.Getenv("GPX_SELF_HOST_CACHE_DIR"); v != "" {
		defaultConfig.CacheDir = v
	}
	if v := os.Getenv("GPX_SELF_HOST_CLIENT_TIMEOUT"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			defaultConfig.ClientTimeout = d
		}
	}
	if v := os.Getenv("GPX_SELF_HOST_MAX_RETRIES"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			defaultConfig.MaxRetries = i
		}
	}
	if v := os.Getenv("GPX_SELF_HOST_OFFLINE"); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			defaultConfig.Offline = b
		}
	}

	// Override with JSON if config.json exists
	if data, err := os.ReadFile("config.json"); err == nil {
		var jsonConfig Config
		if err := json.Unmarshal(data, &jsonConfig); err == nil {
			if jsonConfig.Port != "" {
				defaultConfig.Port = jsonConfig.Port
			}
			if jsonConfig.StaticDir != "" {
				defaultConfig.StaticDir = jsonConfig.StaticDir
			}
			if jsonConfig.DataDir != "" {
				defaultConfig.DataDir = jsonConfig.DataDir
			}
			if jsonConfig.CacheDir != "" {
				defaultConfig.CacheDir = jsonConfig.CacheDir
			}
			if jsonConfig.ClientTimeout != 0 {
				defaultConfig.ClientTimeout = jsonConfig.ClientTimeout
			}
			if jsonConfig.MaxRetries != 0 {
				defaultConfig.MaxRetries = jsonConfig.MaxRetries
			}
			if jsonConfig.Offline {
				defaultConfig.Offline = jsonConfig.Offline
			}
			if len(jsonConfig.Providers) > 0 {
				defaultConfig.Providers = jsonConfig.Providers
			}
		}
	}

	port := fs.String("port", defaultConfig.Port, "Port to listen on (e.g. :8080)")
	staticDir := fs.String("static-dir", defaultConfig.StaticDir, "Directory to serve static assets from")
	dataDir := fs.String("data-dir", defaultConfig.DataDir, "Directory containing GPX files")
	cacheDir := fs.String("cache-dir", defaultConfig.CacheDir, "Directory to store cached map tiles")
	clientTimeout := fs.Duration("client-timeout", defaultConfig.ClientTimeout, "HTTP client timeout for tile downloads")
	maxRetries := fs.Int("max-retries", defaultConfig.MaxRetries, "Maximum retry attempts when downloading tiles")
	offline := fs.Bool("offline", defaultConfig.Offline, "Serve tiles from cache only; do not download new tiles")

	if err := fs.Parse(args); err != nil {
		return nil, err
	}

	return &Config{
		Port:          *port,
		StaticDir:     *staticDir,
		DataDir:       *dataDir,
		CacheDir:      *cacheDir,
		ClientTimeout: *clientTimeout,
		MaxRetries:    *maxRetries,
		Providers:     defaultConfig.Providers,
		Offline:       *offline,
	}, nil
}

func defaultProviders() map[string]TileProviderConfig {
	return map[string]TileProviderConfig{
		"openstreetmap": {
			Name:        "OpenStreetMap",
			URLTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
			IsTMS:       false,
			Attribution: "© OpenStreetMap contributors",
			ZoomRange:   [2]int{0, 19},
		},
		"opentopomap": {
			Name:        "OpenTopoMap",
			URLTemplate: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
			IsTMS:       false,
			Attribution: "Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)",
			ZoomRange:   [2]int{0, 15},
		},
		"maaamet-foto": {
			Name:        "Maa-amet Foto",
			URLTemplate: "https://tiles.maaamet.ee/tm/tms/1.0.0/foto@GMC/{z}/{x}/{y}.jpg&ASUTUS=MAAAMET&KESKKOND=LIVE&IS=TMSNAIDE",
			IsTMS:       true,
			Attribution: "Maa-amet",
			ZoomRange:   [2]int{0, 19},
		},
		"maaamet-kaart": {
			Name:        "Maa-amet Kaart",
			URLTemplate: "https://tiles.maaamet.ee/tm/tms/1.0.0/kaart@GMC/{z}/{x}/{y}.png&ASUTUS=MAAAMET&KESKKOND=LIVE&IS=TMSNAIDE",
			IsTMS:       true,
			Attribution: "Maa-amet",
			ZoomRange:   [2]int{0, 19},
		},
	}
}
