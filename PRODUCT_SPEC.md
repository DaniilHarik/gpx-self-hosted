# Self-Hosted GPX Viewer — Product Spec

Updated: 2025-12-21

## Product Overview
- Purpose: offline-friendly GPX archive you can run locally to browse, filter, and inspect personal tracks on a map without uploading them to a third party.
- Form factor: single Go binary serving a static SPA (Leaflet) plus a tile proxy/cache for base maps.
- Success: fast startup (<1s after `go run`), instant file discovery on refresh, smooth map interaction, and exportable drawn routes.
 - Audience note: this spec is intended for contributors and maintainers; end users should refer to `README.md` for setup and usage.

## Target Users and Use Cases
- Outdoor enthusiasts who manage a personal GPX library and want a privacy-preserving viewer.
- Route planners who need to sketch quick polylines/waypoints and export as GPX.

## User Experience
- Layout: left sidebar with search + activity chips; right map canvas with floating stats panel.
- File browsing: nested folders are shown; activity is inferred from the first folder under `data/Activities/`.
- Interaction:
  - Type to filter by name or relative path; multi-select activity chips; “All activities” resets.
  - View toggle: `Activities | Plans`. Tracks under `data/Plans/` are excluded from Activities and only appear in the Plans view.
  - **Theme**: Explicit Light/Dark toggle in the sidebar header; selection persists in `localStorage` and overrides system preference.
  - Click a track to load (exclusive select); map auto-zooms to its bounds; info panel fills with stats.
  - **Multi-Track Mode**: Toggle via sidebar header button; active mode adds checkboxes to list items for additive selection; tracks are color-coded (Cycle: Blue → Red → Green → Others) with visual indicators in the list.
  - Switch base layers via the map control (OpenStreetMap, OpenTopoMap, Maa-amet kaart/foto; defaults to Maa-amet kaart). Selection persists in `localStorage`.
  - **Offline Tools**: “Download Current View” map control prompts for confirmation, then sends a single backend request to prewarm the tile cache for the current viewport at zoom `current±2` (clamped to provider min/max) with cancel + progress indicator; disabled when server `-offline` is enabled.
  - Draw polylines/markers on the map and export current drawings as a GPX download (button disabled until something is drawn).

## Functional Requirements
- Startup/Config
  - CLI flags: `-port`, `-static-dir`, `-data-dir`, `-cache-dir`, `-client-timeout`, `-max-retries`, `-offline`; sensible defaults (`:8080`, `./static`, `./data`, `./cache`, `10s`, `3`, `false`).
  - Tile providers are defined in config (name, URL template, TMS flag, attribution, zoom min/max); default set includes OpenStreetMap, OpenTopoMap, and two Maa-amet layers.
- UI Theming
  - Theme supports explicit `light`/`dark` modes; default derives from `prefers-color-scheme` if no saved preference exists.
  - Theme preference persists client-side in `localStorage` (`gpx-self-hosted-theme`).
- Data ingestion & API
  - Backend walks `data/Activities/` and `data/Plans/` (nested allowed), returns all `.gpx` files case-insensitively via `GET /api/gpx` with `{name, path, relativePath}`; `path` is fetchable under `/data/`.
  - Static assets served from `/` using `static` dir; raw GPX files exposed under `/data/`.
  - Tile config endpoint `GET /api/tile-config` mirrors providers and declares the initial provider key (`Cache-Control: no-store`).
  - Status endpoint `GET /api/status` returns cache hit/miss/error counters since process start for lightweight health checks (`Cache-Control: no-store`).
- Prewarm endpoint `POST /api/prewarm-view` downloads all tiles covering a `{bounds, providerKey, centerZoom, zoomRadius}` request into the on-disk cache (`Cache-Control: no-store`) and returns `{providerKey, zoomMin, zoomMax, total, ok, failed}`.
- Map tiles & caching
  - Frontend requests tiles through `/tiles/{provider}/{z}/{x}/{y}.(png|jpg)`; server swaps `{z,x,y}` into the provider template and proxies to upstream.
  - Tile cache stored under `cache/tiles/<provider>/<z>/<x>/<y>.<ext>` where `<ext>` matches the request (today the SPA always uses `.png`).
  - **Prewarm**: client “Download Current View” sends one `POST /api/prewarm-view`; server enumerates tiles for the requested view/zooms, honors provider TMS, downloads with limited concurrency, and stops early if the client aborts.
  - Known issue: providers that serve JPEG upstream (e.g. Maa-amet Foto) can be cached/served under a `.png` request path, which can lead to incorrect `Content-Type` headers when serving from disk.
  - Offline mode (`-offline`): cache-only serving; cache misses return 404 without calling upstream or writing to disk. Assumes cache warmed or pre-seeded.
  - Upstream 404 yields 404 without caching; repeated requests to cached tiles must not call upstream.
  - Cache hit/miss/error counters are updated on each `/tiles` request; current cache size is logged on startup.
- Track visualization & stats
  - Uses Leaflet + leaflet-gpx; GPX layer fitted to bounds on load.
  - Stats shown: distance (km), duration (prefers moving time), date (start timestamp localised), moving speed (km/h), elevation gain/loss (smoothed to ignore micro-noise).
  - Info panel hidden until a track is loaded; updates per selection.
- Filtering & list rendering
  - Files sorted by date (filename prefix) descending; list items visually grouped by year with separators.
  - Search filters by filename or relative path (case-insensitive).
- Activity chips: auto-generated from activities (derived from the first folder under `Activities/`); multi-select supported; “All” when none selected (excludes `Plans/`).
- Separate view: `data/Plans/` is treated as the Plans view (not an activity chip), and the view toggle is disabled when no plan files exist.
- Plans view: activity chips are hidden; items are sorted alphabetically by relative path; year grouping is disabled.
- Known activity icons: Backpacking (`backpacking`), Speed Hiking (`speed hiking`), Bikepacking (`bikepacking`), Gravel (`gravel`), MTB (`mtb` / `MTB` / `mountain biking`), Ice Skating (`iceskating`), Sailing (`sailing`), Overlanding (`overlanding`), Flights (`flight` / `flights`); unknown activities fall back to a generic route icon.
  - Each row shows activity icon/chip, optional date parsed from filename prefix, cleaned title (underscores→spaces, dashes kept), optional nested folder label.
- Drawing & export
  - Leaflet Draw toolbar available with polyline + marker tools; drawn items kept in a feature group.
  - Export button in the draw toolbar exports current drawings to a GPX download (trk segments for polylines, waypoints for markers); button disabled with correct aria state when empty.
- Error handling & observability
  - `/tiles` only validates a minimal path shape (segment count) and provider; bad requests for malformed paths → 400; unknown provider → 404; upstream failure after retries → 502.
  - `/api/gpx` errors return 500 with message.
  - Server logs cache hits/misses and upstream attempts.

## Non-Functional Requirements
- Privacy/offline: no third-party upload of GPX; only outbound calls are tile requests to configured providers (or none when `-offline` is set).
- Performance: tile fetch timeout configurable; cache prevents redundant upstream calls; UI stays responsive while filtering large lists.
- Footprint: Go stdlib backend; frontend relies on CDN Leaflet/Leaflet Draw/Font Awesome; runs without database.
- Compatibility: desktop and mobile map interaction; works on modern browsers.
- Testing: Go unit tests for config, GPX listing, tile proxy, caching; Jest + jsdom tests for UI logic, filters, stats formatting, GPX export.

## Constraints and Open Questions
- Upstream tile provider rate limits and legal terms must be observed; no throttling built in.
- Cache eviction/TTL not implemented—manual clearing required; should a size cap be enforced?
- Configuration only via CLI flags today; README TODOs call for env/JSON configuration support.
- No upload UI; users must place files in the `data` directory and refresh—do we need drag-and-drop or live reload?
- Authentication/ACLs are absent; intended for trusted local networks—any need for basic auth?
- Raw file serving and tile proxy paths are permissive (directory listings, symlinks, unvalidated `{z}/{x}/{y}`); tighten validation and cache write safety before exposing to untrusted networks.

## Security & Reliability (Summary)
See [SECURITY.md](SECURITY.md) for the full hardening roadmap. Key focus areas include tile proxy parameter validation, concurrency control for downloads, and atomic file writes.

## Feature Roadmap Ideas

### Suggested
- **Auto-refresh GPX index**: optional file watcher to refresh the list when files change (no full page reload), with a manual "rescan" button fallback.
- **Saved filters and views**: persist search text, activity chips, Plans/Activities toggle, and multi-track mode in `localStorage`, with a one-click reset.
- **Quick compare mode**: show combined stats (distance, elevation, duration) for multi-selected tracks plus a per-track mini legend for easier side-by-side comparisons.
- **Date range filtering**: simple start/end date inputs that constrain the list without additional dependencies.
- **Offline cache utilities**: UI for cache size, clear-by-provider, and "warm favorite area" presets (user-defined bboxes saved locally).
- **Shareable map links**: encode selected tracks, map center/zoom, and active provider into the URL hash for easy bookmarking/sharing within a trusted network.
- **Track thumbnails**: generate lightweight SVG mini-maps (client-side) for list rows to make scanning faster without extra dependencies.
- **Folder-level actions**: allow selecting an entire folder (or year group) to load as a multi-track set, with one-click clear.
- **Stats export**: download a CSV/JSON summary for selected tracks (distance, duration, elevation, date, activity).
- **Smart search operators**: basic tokens like `activity:`, `year:`, `minDistance:` to refine large libraries without new UI.
- **Custom activity mapping**: allow a small mapping file (or UI) to translate folder names into icons/colors and display names.
- **Route snapping hint**: optional toggle to visualize average direction arrows or start/end markers for clarity in dense areas.
- **Tile provider health**: surface a small status indicator showing recent upstream error rates and a quick retry.
- **Lightweight annotations**: let users add text notes to a track (stored locally in a sidecar JSON) without editing the GPX.

### Rejected
- **Interactive Elevation Profile**: Replace the static stats with an interactive chart (distance vs elevation) using a library like Chart.js or D3. Hovering over the graph should show the corresponding location on the map.
- **Track Editing Suite**:
  - **Crop/Trimming**: Simple UI to remove start/end points (e.g., for privacy or removing "forgot to stop recording" segments).
  - **Merge/Split**: Tools to combine segments or break a long track into multiple files.
- **Photo Integration**: Display georeferenced photos on the map. If a GPX file has associated photos (e.g., in the same directory or linked via waypoints), show them as clickable thumbnails.
