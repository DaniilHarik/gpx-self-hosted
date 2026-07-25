# Self-Hosted GPX Viewer Product Spec

Updated: 2026-07-25

## Scope

The product is a privacy-oriented GPX archive for a local machine or trusted
network. A Go server discovers GPX files, serves a vanilla JavaScript map UI,
proxies base-map tiles, and caches GPX metadata and tiles on disk.

The primary use cases are:

- Browse recorded tracks without uploading them to a third party.
- Keep planned routes separate from completed activities.
- Compare several tracks on one map.
- Draw simple routes or waypoints and export them as GPX.

Setup and configuration documentation belong in `README.md`.

## Content model

- Activity tracks are `.gpx` files below the configured activity root, which
  defaults to `data/Activities/`.
- Plans are `.gpx` files below the configured plans root, which defaults to
  `data/Plans/`.
- Activity and plan roots can be configured independently.
- Nested folders are supported.
- An activity is derived from the first folder below the activity root.
- File matching is case-insensitive.
- The API exposes each item with `name`, `path`, `relativePath`, and optional
  cached metadata.

## Browsing

- The sidebar contains search, an `Activities | Plans` view switch, filters, the
  track list, theme control, marker control, and multi-select control.
- Search matches the filename or relative path, case-insensitively.
- Activities are sorted by a date prefix in the filename, newest first, and
  grouped by year.
- Activity filters are collapsed by default behind a compact control that
  summarizes the active selections. They support multiple selections, and
  `All` clears them.
- Plans are excluded from activity filters, sorted alphabetically by relative
  path, and are not grouped by year.
- The Plans control is disabled when no plan files exist.
- Known activity names receive custom icons; unknown names use a route icon.
- A row shows an icon, optional date, cleaned title, and optional nested folder
  label.

## Track display

- The map starts at `58.60, 25.01`, zoom `8`.
- Selecting a track loads its GPX layer, fits its bounds, and opens its stats.
- Single-track mode keeps one track loaded.
- Multi-track mode exposes row checkboxes and permits additive selection.
- Loaded tracks use distinct colors and matching list indicators.
- The focused track drives the stats panel.
- Start and end markers can be hidden across loaded tracks; GPX waypoints remain
  visible.
- Stats include distance, duration, local start date, moving speed, and smoothed
  elevation gain/loss. Duration prefers moving time.

## Map controls

- The default base layer is Maa-amet Kaart.
- The default provider set includes OpenStreetMap, OpenTopoMap, Maa-amet Kaart,
  and Maa-amet Foto.
- Base-layer choice persists in `localStorage`.
- Explicit light and dark themes are available. The saved theme overrides the
  system preference and is initialized before rendering to avoid FOUC.
- The bottom controls include `-` and `+`, a quarter-step zoom slider, the
  current zoom value, zoom speed, coordinate readout, and `bbox`.
- `Fast`, `Normal`, and `Precise` synchronize button, double-click, gesture snap,
  and wheel zoom behavior.
- The coordinate readout starts from the map center. A single map click targets
  a point; clicking the readout copies the displayed `lat, lng`.
- `bbox` copies viewport bounds as `west,south,east,north`.

## Drawing and export

- Leaflet Draw exposes polyline and marker tools.
- GPX export is disabled until a drawing exists.
- Export produces GPX 1.1 with the Topografix namespace and metadata: polylines
  become track segments and markers become waypoints.
- Map image export produces a 2x PNG of the current viewport, including visible
  tiles, tracks, drawings, and markers.

## Server behavior

- Configuration precedence is CLI, JSON, environment variables, then defaults.
- Startup logs report the configured activity and plan source directories.
- `GET /api/gpx` lists activity tracks and plans.
- `GET /api/tile-config` returns client-safe provider settings, the initial
  provider, and offline state with `Cache-Control: no-store`.
- `GET /api/status` returns process-lifetime tile cache counters with
  `Cache-Control: no-store`.
- `/data/Activities/` and `/data/Plans/` serve source GPX files from their
  independently configured roots.
- `/tiles/{provider}/{z}/{x}/{y}.(png|jpg)` validates the provider token, numeric
  coordinates, and extension before accessing the cache or upstream.
- Cached tiles retain the requested extension.
- Online cache misses are retried up to the configured limit. Upstream `404`
  responses are not cached.
- Offline mode never contacts upstream providers; a cache miss returns `404`.
- Tile cache writes use a temporary file and atomic rename.
- OpenStreetMap requests use an application `User-Agent` and forward a valid
  browser `Referer` when present.

## Quality requirements

- GPX data is not uploaded to third parties.
- The backend uses the Go standard library; the frontend remains framework-free.
- The UI supports current desktop and mobile browsers.
- Go tests cover configuration, handlers, GPX discovery/parsing/cache, server
  routing, and tile proxy/cache behavior.
- Jest and jsdom tests cover frontend behavior. Coverage is collected from
  `static/js/`.

## Known limits

- Browser dependencies are loaded from CDNs, so offline tile mode does not make
  the initial page load fully disconnected.
- File changes require a browser refresh; there is no upload or live-rescan UI.

See [SECURITY.md](SECURITY.md) for deployment constraints and known security or
reliability risks.
