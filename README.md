# Self-Hosted GPX Viewer (Offline-Friendly)

[![codecov](https://codecov.io/gh/daniilharik/gpx-self-hosted/graph/badge.svg)](https://codecov.io/gh/daniilharik/gpx-self-hosted)

A lightweight, self-hosted web application for browsing and visualizing GPX tracks locally. 

![App Screenshot](docs/screenshot.png)

It scans a local directory for `.gpx` files and displays them on an interactive map. 

Map tiles are fetched via a backend proxy and cached on locally so the app can run independently once cache is warmed.

## ⚠️ Disclaimer

This is a personal project with specialized requirements.

* **AI-Native Development**: This project was built 95% using AI coding agents. It is designed to be easy to maintain and extend using AI, with comprehensive tests and a modular structure. 
* **Security**: Currently intended for **local/trusted network use**. See [SECURITY.md](SECURITY.md) for current hardening status and recommendations.
* **Targeted Use**: Initially developed with specific features for Estonia (e.g., Maa-amet and OpenTopoMap layers), but extensible to any region.

## Quick start

1. Put your `.gpx` files under `data/Activities/` (subfolders are fine). Plans go under `data/Plans/`.
2. Start the server:
    ```bash
    ./run.sh
    # or: go run ./cmd/gpx-self-host
    ```
3. Open `http://localhost:8080`.

## Architecture

The project follows a **Client-Server** architecture designed for simplicity and ease of hosting.

### 1. Backend (Go)
The backend is written in **Go** (Golang) and uses the standard library (`net/http`) to keep dependencies minimal.
*   **Static File Server**: Serves the HTML, CSS, and JavaScript files from the `static/` directory.
*   **Data Server**: Exposes the `data/` directory to allow the frontend to fetch raw `.gpx` files.
*   **API Layer**:
    *   `GET /api/gpx`: Traverses `data/Activities/` and `data/Plans/` and returns a JSON list of available files.
    *   `GET /api/tile-config`: Returns available tile providers + offline mode state.
    *   `GET /api/status`: Returns basic cache statistics (hits/misses/errors).
    *   `POST /api/prewarm-view`: Prewarms the on-disk tile cache for a viewport/zoom range.
*   **Tile Proxy + Cache**: `GET /tiles/{provider}/{z}/{x}/{y}.(png|jpg)` downloads and caches map tiles under `cache/tiles/`.
*   **Service Layer**: Business logic is decoupled into `internal/service/` for better testability and maintainability.

### 2. Frontend (HTML/JS/CSS)
The frontend is a Single Page Application (SPA) built with vanilla JavaScript.
*   **Leaflet.js**: Handles the map rendering and user interaction (pan, zoom).
*   **leaflet-gpx**: A client-side plugin that parses GPX XML data and renders it as Polyline layers on the map. It also extracts track metadata (elevation, time, distance).
*   **Navigation**: A sidebar allows users to filter and select tracks.

### Directory Structure
```
gpx-self-host/
├── cmd/gpx-self-host/  # CLI entrypoint (main package)
├── internal/         # Application packages
│   ├── config/       # Flag parsing and default config
│   ├── handler/      # HTTP handlers
│   ├── model/        # Shared DTOs and types
│   ├── server/       # Router setup and server initialization
│   └── service/      # Core business logic (gpx, tiles)
├── go.mod            # Go module definition
├── data/             # Directory for storing .gpx files (Activities/ + Plans/)
└── static/           # Frontend assets
    ├── index.html    # Main application entry point
    ├── css/
    ├── js/
    │   └── app.js    # Main logic
    └── vendor/       # Localized third-party assets (optional)
```

## Features
*   **Automatic Indexing**: Just drop files in `data/Activities/` or `data/Plans/` and refresh.
*   **Detailed Stats**: Distance, Duration, Speed, Elevation Gain/Loss.
*   **Multiple Layers**: Switch between OpenTopoMap, OpenStreetMap, and Maa-amet (Estonia).
*   **Search & Filter**: Real-time filtering by name; activity chips; year-based grouping.
*   **Multi-Track Mode**: View multiple tracks simultaneously with distinct colors.
*   **Drawing & Export**: Draw new routes on the map and download them as GPX.
*   **Responsive**: Optimized for both desktop and mobile.

## Supported activities
Activities are derived from the folder name directly under `data/Activities/`. 

Any folder name works, but the ones below get custom icons in the UI (case-insensitive).

| Activity folder name | Icon | Notes |
| --- | --- | --- |
| backpacking | mountain | |
| speed hiking | person-hiking | |
| bikepacking | person-biking | |
| gravel | bicycle | |
| mtb | bicycle | Alias of mountain biking |
| mountain biking | bicycle | |
| mountain_biking | bicycle | Alias of mountain biking |
| iceskating | skating | |
| ice skating | skating | Alias of iceskating |
| ice-skating | skating | Alias of iceskating |
| ice_skating | skating | Alias of iceskating |
| sailing | sailboat | |
| overlanding | car | |
| flight | plane | |
| flights | plane | Alias of flight |

## Configuration

### Prerequisites
* [Go](https://go.dev/dl/) installed.
* [Node.js](https://nodejs.org/) installed (for frontend tests).

### Tile providers
Providers are configured server-side in `internal/config/config.go`. Current keys:
- `openstreetmap`
- `opentopomap`
- `maaamet-kaart`
- `maaamet-foto`

#### CLI flags
```
-port=:8080              Port to listen on (e.g. :8080)
-static-dir=./static     Directory to serve static assets from
-data-dir=./data         Directory containing GPX files
-cache-dir=./cache       Directory to store cached map tiles
-client-timeout=10s      HTTP client timeout for tile downloads
-max-retries=3           Maximum retry attempts when downloading tiles
-offline=false           Serve tiles from cache only; do not download new tiles
```

#### Offline mode
Run with `-offline` to block all upstream tile downloads and serve map tiles from the local cache only.
- Warm the cache while online (browse the areas/zooms you care about, or copy a prepared `cache/tiles` tree into place).
- Start the server with `./run.sh -offline`.
- If a requested tile is missing from the cache, the server returns `404` instead of reaching out to the provider.

## Development

### Tests
- Go: `go test ./...`
- Frontend (Jest): `npm test`

<details>
<summary><b>Maa-amet tile ranges (Estonia bbox)</b></summary>

The ranges below use an Estonia bbox (lon 21.0–28.3, lat 57.45–59.85) and Maa-amet’s TMS scheme (Y flipped vs XYZ). Per-zoom x/y ranges and tile counts:

```
z  x_min–x_max    y_tms_min–y_tms_max   tiles
0  0–0            0–0                   1
1  1–1            1–1                   1
2  2–2            2–2                   1
3  4–4            5–5                   1
4  8–9            11–11                 2
5  17–18          22–22                 2
6  35–37          44–45                 6
7  71–74          89–90                 8
8  142–148        178–181               28
9  285–296        356–362               84
10 571–592        712–725               308
11 1143–1184      1425–1451             1,134
12 2286–2369      2850–2903             4,536
13 4573–4739      5701–5806             17,702
14 9147–9479      11402–11612           70,263
15 18295–18959    22804–23224           279,965
16 36590–37919    45609–46449           1,118,530
17 73181–75839    91219–92899           4,469,779
18 146363–151679  182438–185799         17,875,754
19 292727–303358  364877–371599         71,478,936
```

Total tiles (z0–z19): **95,317,041**.
</details>
