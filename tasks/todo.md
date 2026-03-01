# TODO

## Plan
- [x] Add a new Leaflet draw-toolbar button for high-resolution map image export.
- [x] Implement high-resolution map export logic (tiles + vector overlays + markers) and download flow.
- [x] Add/update frontend tests for new button wiring and image export behavior.
- [x] Update `SPEC.md` and `README.md` for the new export capability.
- [x] Run automated tests (`npm test`, `go test ./...`).

## Review
- Added a new draw-toolbar button (`export-map-image-hires`) alongside existing GPX export.
- Implemented `exportMapImageHighRes()` in `static/js/draw.js` that renders the current viewport to a 2x canvas and downloads PNG.
- Export rendering includes visible tile images, SVG overlay vectors (loaded GPX tracks and drawn polylines), and marker icons/shadows.
- Fixed overlay alignment in exported images by stripping runtime Leaflet SVG transforms before serialization to avoid double-applied offsets.
- Existing GPX export behavior and disabled-state accessibility for `export-drawn-track` are unchanged.
- Extended frontend tests to cover both toolbar buttons and successful high-resolution PNG export.
- Updated docs in `SPEC.md` and `README.md` for the new user-facing behavior.
- Verification:
  - `npm test -- --runInBand` (69 passed)
  - `go test ./...` (all packages passed)
