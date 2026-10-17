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
   under `data/Plans/`. Nested folders are supported. These roots can be
   configured independently when activities and plans live in different
   locations.
2. Start the server:

   ```bash
   ./start.sh
   # or
   go run ./cmd/gpx-self-hosted
   ```

3. Open `http://localhost:8080`.

## Usage

Search by filename or relative path. Activities are grouped by year and sorted
by the date prefix in their filenames; plans are sorted alphabetically.
Activity filters use the first folder below the activity root. Any folder name
is accepted, with custom icons for recognized activities. Refresh the page
after adding or changing files; there is no upload or live-rescan UI.

Select a track to focus the map and view its distance, duration, date, moving
speed, and elevation gain/loss. Enable multi-select to compare tracks in
distinct colors. Start/end markers can be hidden separately from GPX waypoints.
A failed track offers **Retry** after you fix or restore its file. Downloads
time out after 30 seconds. Filenames may include spaces, Unicode, `#`, `?`, and
`%` where the host filesystem permits them.
Tracks without elevation data still load; unavailable elevation totals show `N/A`.
Separate GPX track segments stay disconnected; gaps do not count toward distance.

Draw polylines and waypoints, then download them as GPX 1.1. Place an exported
file in the plans directory to browse it later. The image export downloads a
2x PNG of the visible map and overlays.

Theme and base-layer choices persist in the browser. Default layers include
OpenStreetMap, OpenTopoMap, Maa-amet Kaart, and Maa-amet Foto. Use the zoom slider
or speed presets to adjust navigation. Single-click the map to select
coordinates, then click the coordinate readout to copy `lat, lng`; double-click
zooms. The `bbox` control copies viewport bounds as `west,south,east,north`.

## Configuration

Configuration precedence is:

1. Command-line flags.
2. `config.json`.
3. `GPX_SELF_HOST_*` environment variables.
4. Built-in defaults.

`"Offline": false` in JSON does not override `GPX_SELF_HOST_OFFLINE=true`;
use `-offline=false` to disable it in that case.

The server starts without `config.json` if it is absent. If the file exists but
cannot be read or decoded, startup fails with an error rather than using defaults.

### Command-line flags

```text
-port=:8080
-static-dir=./static
-activities-dir=./data/Activities
-plans-dir=./data/Plans
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
  "ActivitiesDir": "./data/Activities",
  "PlansDir": "./data/Plans",
  "CacheDir": "./cache",
  "Offline": false
}
```

`ActivitiesDir` and `PlansDir` point directly at the folders to scan and serve.
This allows recorded tracks to stay in an external or cloud-synced folder while
plans remain in the repository; no copying or symlinks are required.

Keep the checked-in `config.json` portable. To use a machine-specific activity
folder without modifying it, override the path when starting the server:

```bash
./start.sh -activities-dir="/absolute/path/to/tracks"
```

Startup logs report the effective activity and plan directories.

`ClientTimeout` is a Go `time.Duration` value and is represented in JSON as
nanoseconds; `10000000000` is 10 seconds.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `GPX_SELF_HOST_PORT` | Listen address |
| `GPX_SELF_HOST_STATIC_DIR` | Static asset directory |
| `GPX_SELF_HOST_ACTIVITIES_DIR` | Activity GPX directory |
| `GPX_SELF_HOST_PLANS_DIR` | Plan GPX directory |
| `GPX_SELF_HOST_CACHE_DIR` | Cache directory |
| `GPX_SELF_HOST_CLIENT_TIMEOUT` | Tile request timeout, such as `10s` |
| `GPX_SELF_HOST_MAX_RETRIES` | Tile download attempts |
| `GPX_SELF_HOST_OFFLINE` | Cache-only tile mode (`true` or `false`) |

## Offline mode

Run `./start.sh -offline` or set `Offline` to `true` to prevent upstream tile
requests. Browse the required areas and zoom levels while online first; a cache
miss returns `404` in offline mode.

The browser still loads Leaflet, Leaflet.draw, leaflet-gpx, Font Awesome, and
fonts from CDNs. A warmed tile cache therefore supports cache-only maps but not
a fully disconnected first page load.

The [Maa-amet tile ranges](docs/tiles.md) are retained as a manual planning
reference.

## Development

```bash
go build -o gpx-self-hosted ./cmd/gpx-self-hosted
go test ./...
npm install
npm test
```

Frontend assets require no build step. On Windows, run
`go run ./cmd/gpx-self-hosted` or build `gpx-self-hosted.exe`; `start.sh` is for
macOS and Linux.

Use GitHub Issues for bug reports and feature requests. Create branches from
`main` and keep pull requests focused on one change. Format Go with `gofmt`, use
the standard library where practical, and keep the frontend framework-free
unless an architecture change is agreed first. Add or update tests whenever
behavior changes, and run both test suites before submitting a change.

## Project documentation

- [SPEC.md](SPEC.md) records product intent, guarantees, and scope boundaries.
- [SECURITY.md](SECURITY.md) records deployment assumptions and known risks.
- [AGENTS.md](AGENTS.md) records contributor workflow and safety rules.
- [Lessons](tasks/lessons.md) retain recurring user preferences.
- Architecture decisions explain context, alternatives, and consequences:
  [on-demand tile caching](docs/adr/0001-cache-tiles-on-demand.md) and
  [independent GPX source directories](docs/adr/0002-independent-gpx-source-directories.md).

Follow the [change requirements](AGENTS.md#change-requirements) when updating
documentation. Implementation details and exact behavior belong in code and
tests.
