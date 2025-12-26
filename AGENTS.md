# Agent Guidelines (gpx-self-host)

## Project snapshot
- **Backend (Go)**:
    - `cmd/gpx-self-host/`: CLI entrypoint.
    - `internal/config/`: Configuration (flags, providers).
    - `internal/handler/`: HTTP handlers.
    - `internal/model/`: Shared DTOs and types.
    - `internal/server/`: Router setup and server initialization.
    - `internal/service/`: Core business logic (Split into `gpx` and `tiles` services).
- **Frontend (SPA)**:
    - `static/`: HTML/JS/CSS (Vanilla stack).
    - `static/js/app.js`: Main logic, Leaflet integration.
    - `static/js/theme.js`: Theme switching and persistence.
- **Data & Cache**:
    - `data/Activities/`: User GPX files (nested folders allowed).
    - `data/Plans/`: Plan GPX files (nested folders allowed).
    - `cache/tiles/`: Proxied map tiles stored as `<provider>/<z>/<x>/<y>.<ext>`.

## Local commands
- Run server: `./run.sh` or `go run ./cmd/gpx-self-host`
- Go tests: `go test ./...`
- Frontend tests: `npm test` (Uses Jest and jsdom)

## Conventions
- **Minimal Dependencies**: Prefer Go standard library; avoid heavyweight JS frameworks.
- **Logging**: Use `log/slog` for structured logging. Do not use `fmt.Printf` or `log.Printf` for server logs.
- **Validation**: Strict input validation for all API endpoints (see `SECURITY.md` for known risks).
- **Theming**: Theme initialization is handled by an inline script in `index.html` to prevent flash of unstyled content. Toggle logic and persistence are in `app.js`. Use CSS variables in `style.css`.
- **Documentation**:
    - Update `README.md` for user-facing changes (flags, features).
    - Update `PRODUCT_SPEC.md` for UI and behavioral changes.
    - Update `SECURITY.md` when addressing security or reliability risks.
    - Follow the vulnerability reporting guidance in `SECURITY.md` for security issues.

## Repo hygiene
- **Data Protection**: Never commit contents of `data/`, `cache/`, `node_modules/`, or `.gocache/` (except the two example GPX files intentionally committed under `data/`).
- **Path Safety**: Always use `filepath.Clean` and check for directory traversal when handling user-provided paths or filenames.
- **Concurrency**: Be extremely careful with concurrent file writes in the tile proxy (see `internal/service/tiles/service.go`).

## Feature Specifics
- **Multi-Track Mode**: Managed via `isMultiTrackMode` in `app.js`. Involves additive track selection with distinct colors.
- **Prewarm View**: Backend task (triggered via `/api/prewarm-view`) to download tiles for a given bbox and zoom range. Spawns workers to populate the on-disk cache.
- **Plans View**: Tracks under `data/Plans/` are handled separately from `data/Activities/`.

## Technical Details

### Tile Service (`internal/service/tiles/`)
- **Caching Strategy**: Flat file structure under `cache/tiles/`. Extension is preserved from the request.
- **Extension Mismatch**: Providers serving JPEG (e.g., `maaamet-foto`) may be cached with a `.png` extension if the request uses it. This can cause incorrect `Content-Type` headers when serving from disk.
- **Risk Area**: Concurrent downloads are NOT currently synchronized. Multiple requests for the same tile will trigger multiple upstream fetches and potentially race on the same file write.
- **Path Traversal**: Coordinate parameters (`z`, `x`, `yPng`) are currently used directly in file paths. Always validate these are numeric/safe before passing to the service.

### Prewarm Logic (`internal/service/tiles/prewarm.go`)
- **Coordinates**: Uses standard WGS84 to OSM/Mercator tile conversion formulas.
- **Concurrency**: Defaults to 8 workers per request. Not globally limited across concurrent requests.
- **Limits**: Hard limit of 50,000 tiles per request (`maxTilesPerPrewarmRequest`) to prevent catastrophic resource exhaustion.
- **Cancellation**: Respects context cancellation; will stop spawning workers and close the task channel if the client disconnects.
