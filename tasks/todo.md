# TODO

## Plan
- [x] Add a sidebar control to toggle start/end marker visibility.
- [x] Wire marker rendering to a new visibility state so newly loaded tracks respect the toggle.
- [x] Ensure already loaded tracks refresh when the toggle changes.
- [x] Add/update frontend tests for the new toggle behavior.
- [x] Update `SPEC.md` and `README.md` for the new behavior.
- [x] Run automated tests (`npm test`, `go test ./...`).

## Review
- Added a new sidebar header button (`toggle-start-end-markers`) that toggles start/end marker visibility and updates aria/title state.
- Added `state.showStartEndMarkers` and marker-toggle setup at app init.
- Updated GPX layer creation to derive marker options from toggle state and rebuild currently loaded layers when changed so the effect is immediate.
- Updated Jest tests to verify hidden marker configuration and track layer rebuild behavior.
- Updated docs (`SPEC.md`, `README.md`) for the new user-facing control.
- Verification:
  - `npm test` (68 passed)
  - `go test ./...` (all packages passed)
