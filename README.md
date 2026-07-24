# Self-Hosted GPX Viewer

[![Backend Coverage](https://img.shields.io/codecov/c/github/daniilharik/gpx-self-hosted?flag=backend&label=Backend)](https://codecov.io/gh/daniilharik/gpx-self-hosted)
[![Frontend Coverage](https://img.shields.io/codecov/c/github/daniilharik/gpx-self-hosted?flag=frontend&label=Frontend)](https://codecov.io/gh/daniilharik/gpx-self-hosted)

A lightweight local web app for browsing activity tracks and plans, comparing
multiple GPX files, drawing routes, and exporting GPX or map images.

![App screenshot](docs/screenshot.png)

GPX files stay on the host. Base-map tiles are fetched through the Go server and
cached on disk. The app is intended for a local machine or trusted network and
does not include authentication; see [SECURITY.md](SECURITY.md).

## Requirements

- Go 1.26 or newer.
- Node.js only when running frontend tests.

## Quick start

1. Put recorded tracks under `data/Activities/<activity>/`. Put planned routes
   under `data/Plans/`. Nested folders are supported.
2. Start the server:

   ```bash
   ./run.sh
   # or
   go run ./cmd/gpx-self-host
   ```

3. Open `http://localhost:8080`.

## Features

- Separate Activities and Plans views with search, activity filters, and year
  grouping.
- Single-track focus or multi-track comparison with distinct track colors.
- Distance, duration, date, moving speed, and elevation gain/loss.
- Persistent light/dark theme and base-layer selection.
- OpenStreetMap, OpenTopoMap, and Maa-amet base layers by default.
- Quarter-step zoom slider, adjustable zoom speed, coordinate copying, and
  viewport bounds copying.
- Optional start/end markers.
- Polyline and waypoint drawing with GPX 1.1 export.
- High-resolution PNG export of the visible map and overlays.
- On-disk GPX metadata and map-tile caches.
- Cache-only tile serving in offline mode.

Activity names come from the first folder below `data/Activities/`. Any name is
accepted. Backpacking, speed hiking, bikepacking, gravel, MTB/mountain biking,
ice skating, sailing, overlanding, and flight folders receive custom icons.

## Configuration

Configuration precedence is:

1. Command-line flags.
2. `config.json`.
3. `GPX_SELF_HOST_*` environment variables.
4. Built-in defaults.

### Command-line flags

```text
-port=:8080
-static-dir=./static
-data-dir=./data
-cache-dir=./cache
-client-timeout=10s
-max-retries=3
-offline=false
```

### JSON

The repository includes a complete `config.json`. Its fields mirror the Go
configuration structure. A custom `Providers` object replaces the default tile
provider set.

```json
{
  "Port": ":8080",
  "StaticDir": "./static",
  "DataDir": "./data",
  "CacheDir": "./cache",
  "Offline": false
}
```

`ClientTimeout` is a Go `time.Duration` value and is represented in JSON as
nanoseconds; `10000000000` is 10 seconds.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `GPX_SELF_HOST_PORT` | Listen address |
| `GPX_SELF_HOST_STATIC_DIR` | Static asset directory |
| `GPX_SELF_HOST_DATA_DIR` | GPX data directory |
| `GPX_SELF_HOST_CACHE_DIR` | Cache directory |
| `GPX_SELF_HOST_CLIENT_TIMEOUT` | Tile request timeout, such as `10s` |
| `GPX_SELF_HOST_MAX_RETRIES` | Tile download attempts |
| `GPX_SELF_HOST_OFFLINE` | Cache-only tile mode (`true` or `false`) |

## Offline mode

Run `./run.sh -offline` or set `Offline` to `true` to prevent upstream tile
requests. Browse the required areas and zoom levels while online first; a cache
miss returns `404` in offline mode.

The browser still loads Leaflet, Leaflet.draw, leaflet-gpx, Font Awesome, and
fonts from CDNs. A warmed tile cache therefore supports cache-only maps but not
a fully disconnected first page load.

When online, requests to the built-in OpenStreetMap provider use an
application-specific `User-Agent`. The browser `Referer` is forwarded when
present.

## Architecture

- `cmd/gpx-self-host/`: CLI entrypoint.
- `internal/config/`: flags, JSON, environment variables, and defaults.
- `internal/handler/`: HTTP handlers.
- `internal/server/`: routing and server lifecycle.
- `internal/service/gpx/`: GPX discovery, parsing, and metadata caching.
- `internal/service/tiles/`: tile proxying and disk caching.
- `static/`: vanilla JavaScript SPA, HTML, and CSS.

The server exposes the GPX index, client-safe tile configuration, cache status,
source GPX files, and proxied map tiles over HTTP. See `SPEC.md` for the
behavioral contract.

## Development

```bash
go build -o gpx-self-host ./cmd/gpx-self-host
go test ./...
npm install
npm test
```

Frontend assets require no build step. On Windows, run
`go run ./cmd/gpx-self-host` or build `gpx-self-host.exe`; `run.sh` is for
macOS and Linux.

Product behavior is defined in [SPEC.md](SPEC.md). Contribution guidance is in
[CONTRIBUTING.md](CONTRIBUTING.md).
