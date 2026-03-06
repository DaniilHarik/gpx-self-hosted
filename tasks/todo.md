# TODO

## Plan
- [x] Sync gesture zoom snap with the same speed preset used by +/- clicks and map click-zoom.
- [x] Update frontend tests to verify gesture snap sync across speed presets.
- [x] Update `SPEC.md` and `README.md` wording for synchronized gesture zoom behavior.
- [x] Run automated tests (`npm test`, `go test ./...`).

## Review
- Updated `static/js/map.js` so each zoom speed preset now also sets `map.options.zoomSnap`.
- This keeps gesture-based zoom snapping aligned with the active preset, alongside `+/-` click zoom, map click-zoom step, and wheel sensitivity.
- Extended frontend tests in `static/js/__tests__/app.test.cjs` to assert `zoomSnap` synchronization across `Fast`, `Normal`, and `Precise`.
- Updated user-facing behavior descriptions in `SPEC.md` and `README.md`.
- Verification:
  - `npm test -- --runInBand` (73 passed)
  - `go test ./...` (all packages passed)

## 2026-03-06 Document Clarity Review

### Plan
- [x] Read `SPEC.md`, `README.md`, `SECURITY.md`, and current repo guidance.
- [x] Cross-check wording against the current implementation where clarity issues looked ambiguous.
- [x] Summarize document clarity findings with exact file/line references.

### Review
- Reviewed `SPEC.md`, `README.md`, and `SECURITY.md` for clarity, structure, and cross-document consistency.
- Confirmed a few clarity issues against the current codebase to distinguish documentation drift from awkward phrasing.
- No product files were edited as part of this task.
- Verification:
  - Review-only task; no automated tests were run because no code or user-facing documents were changed.

## 2026-03-06 Document Clarity Fixes

### Plan
- [x] Update `SPEC.md` to fix list structure, normalize activity filter terminology, and remove stale security wording.
- [x] Update `README.md` so contributor guidance reflects the modular frontend structure and matches supported activity aliases.
- [x] Update `SECURITY.md` if needed so the current hardening status reads consistently with the spec.
- [x] Run automated tests (`npm test`, `go test ./...`) to satisfy repo verification requirements after doc changes.

### Review
- Updated `SPEC.md` to fix malformed bullet nesting, standardize the activity filter wording around the “All” chip, expand the supported activity aliases to match the implementation, and remove stale wording that implied tile coordinates were still unvalidated.
- Updated `README.md` so the frontend architecture section reflects the modular `static/js/` layout instead of implying all logic lives in `app.js`.
- Updated `SECURITY.md` to call out the tile request validation that already exists and to sharpen the remaining `/data/` exposure note.
- Verification:
  - `go test ./...` (all packages passed)
  - `npm test -- --runInBand` (73 passed)
