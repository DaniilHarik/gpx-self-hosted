# Code Audit Findings

Audit date: 2026-06-10. Covers the Go backend, the vanilla-JS frontend, docs, and repo hygiene. Items already acknowledged in `SECURITY.md` or `README.md` are marked as such.

## 1. Offline support (highest impact)

- [ ] **Frontend dependencies load from CDNs, contradicting the "offline-friendly" goal.** `static/index.html` pulls Leaflet, leaflet-gpx, Leaflet.draw, Font Awesome, and Google Fonts from unpkg/cloudflare/googleapis (lines 10, 14–16, 49, 145–158). Without internet the map never renders, regardless of tile cache state. Vendor these into `static/vendor/` and serve them locally; this also removes the supply-chain exposure of CDN-hosted scripts.

## 2. Backend

### Bugs

- [ ] **Malformed `config.json` is silently ignored.** `internal/config/config.go:103` — a JSON parse error falls through to defaults/ENV with no warning, so a config typo means settings quietly don't apply. Log a warning when the file exists but cannot be parsed.
- [ ] **GPX scan errors are silently swallowed.** `internal/service/gpx/service.go:74–88` — if a file fails to open or parse during the scan, it is listed with `nil` metadata and nothing is logged. Log unexpected errors to aid debugging.
- [ ] **`maaamet-foto` content-type mismatch** *(acknowledged in README)* — upstream serves JPEG but tiles are cached/served via a `.png` path, so `http.ServeFile` guesses the wrong `Content-Type`. Fix by using the correct extension per provider or setting `Content-Type` from the upstream response header.
- [ ] **Double-write on JSON encode failure.** `internal/handler/handlers.go:49–51, 74–76, 84–86` — when `json.NewEncoder(w).Encode()` fails mid-response, the subsequent `http.Error()` writes to an already-started response. Log the error instead.

### Robustness / security *(tracked in SECURITY.md)*

- [ ] **No de-duplication of concurrent tile downloads** *(SECURITY.md: High)* — N simultaneous requests for the same uncached tile trigger N upstream fetches. `golang.org/x/sync/singleflight` solves this in a few lines and is also an OSM tile-policy courtesy.
- [ ] **Unbounded tile cache growth** *(SECURITY.md: Medium)* — `cache/tiles/` has no size limit or eviction policy. Add a max-size quota or LRU eviction.
- [ ] **`/data/` served via `http.FileServer`** *(SECURITY.md: Medium)* — exposes directory listings and follows symlinks out of the data directory. Acceptable on a trusted LAN, but easy to harden with a listing-suppressing handler.
- [ ] **TOCTOU race between cache `os.Stat` and `http.ServeFile`.** `internal/service/tiles/service.go:78` — a tile could be deleted between the existence check and serving. Small window; low priority.

## 3. Frontend

### Bugs

- [ ] **Missing `response.ok` checks on fetches.** `static/js/files.js:146` and `static/js/tiles.js:10` parse JSON without checking status, so a 500 surfaces as a cryptic parse exception instead of a useful error state.
- [ ] **Focus race when loading multiple tracks.** `static/js/tracks.js:193–202` — `focusedTrackPath` is set when each track's `loaded` event fires, so clicking Track A then Track B can leave A focused if its slower load finishes last. Guard the handler with an "is this still the most recently requested track" check.
- [ ] **Event listener accumulation on map re-init.** `static/js/map.js:49–53, 296–305` — `setupZoomSlider()` and `stopMapPropagation()` register listeners with no cleanup; `resetState()` in `state.js` does not remove Leaflet listeners, so re-initialization duplicates them.

### Improvements

- [ ] **No debounce on search input.** `static/js/app.js:39–42` — `applyFilters()` runs on every keystroke; add ~300 ms debounce before the library grows.
- [ ] **No user-facing detail on fetch failures.** `static/js/files.js:170–174` — errors are console-only with a generic UI message; show a retryable error state.
- [ ] **Inefficient marker toggle.** `static/js/tracks.js:219–241` — `refreshLoadedTrackLayers()` removes and recreates all layers on a start/end marker toggle; mutating marker options directly avoids the churn.
- [ ] **Multi-select → single-select state desync.** `static/js/tracks.js:23` — `enforceSingleTrack()` does not validate that `focusedTrackPath` matches the surviving selection.

### Accessibility

- [ ] **Track list is not keyboard-operable.** `static/js/files.js:250` — list items are click-only with no `tabindex` or Enter/Space handling (WCAG 2.1 Level A gap).
- [ ] **Search input lacks an explicit `aria-label`.** `static/index.html` (search input) — placeholder text only.
- [ ] **No visible `:focus-visible` styles on activity filter chips.** `static/css/style.css` — keyboard users cannot see which filter is focused.

## 4. Testing gaps

- [ ] **No direct frontend tests for `tracks.js`, `files.js`, `draw.js`, `tiles.js`.** Coverage is concentrated in `static/js/__tests__/app.test.cjs`; the untested modules hold the most user-facing logic (track focus, filters, GPX export).
- [ ] **Backend edge-case coverage.** `internal/service/tiles` (~75%) is missing Referer-sanitization edge cases and concurrency tests; `internal/service/gpx/cache` (~81%) lacks corrupted-cache-file and concurrent load/save tests.

## 5. Repo hygiene

- [ ] **`logs/` is not in `.gitignore`.** Currently untracked, but one `git add .` away from being committed.

## Suggested order of work

1. Vendor the CDN libraries (makes the core offline promise true).
2. Fix the silent-failure bugs: `config.json` parse warning, GPX scan error logging, `response.ok` checks.
3. Tile request de-duplication + cache size cap.
4. Frontend tests for `tracks.js` and `files.js`.
5. Keyboard accessibility for the track list.
