# TODO

## Plan
- [x] Sync map click-zoom step with the same speed preset used by +/- buttons.
- [x] Update frontend tests to verify speed preset sync across controls.
- [x] Update `SPEC.md` and `README.md` wording for synchronized zoom speed behavior.
- [x] Run automated tests (`npm test`, `go test ./...`).

## Review
- Updated `static/js/map.js` so each zoom speed preset now sets both `wheelPxPerZoomLevel` and `map.options.zoomDelta`.
- Updated `+/-` button handlers to read from `map.options.zoomDelta`, ensuring their click speed stays synchronized with map click-zoom step.
- Extended frontend tests in `static/js/__tests__/app.test.cjs` to assert `zoomDelta` synchronization across speed presets.
- Updated user-facing behavior descriptions in `SPEC.md` and `README.md`.
- Verification:
  - `npm test -- --runInBand` (73 passed)
  - `go test ./...` (all packages passed)
