# Agent Guide

## Start here

- Read `SPEC.md` before changing product behavior or UI.
- Read `README.md` for setup, architecture, and configuration.
- Read `SECURITY.md` for security and reliability work.
- Review `tasks/lessons.md` for relevant project-specific corrections.
- Inspect the worktree before editing and preserve unrelated changes.

## Change requirements

- Update or add tests whenever behavior changes.
- Update `SPEC.md` for UI or behavioral changes.
- Update `README.md` for user-facing features, setup, or configuration changes.
- Update `SECURITY.md` when security or reliability risks change.
- Add a concise rule to `tasks/lessons.md` after a user correction.
- Do not update product docs for a behavior-preserving internal cleanup unless
  the existing docs are inaccurate.

## Architecture

- Go standard-library backend: `cmd/gpx-self-host/` and `internal/`.
- Vanilla JavaScript frontend: `static/`.
- Activity tracks: `data/Activities/`; plans: `data/Plans/`.
- Tile cache: `cache/tiles/`; GPX metadata cache: `cache/gpx_metadata.json`.
- Multi-track state: `isMultiTrackMode` in `static/js/state.js`.
- Theme initialization stays inline in `static/index.html` to prevent FOUC;
  theme behavior and persistence live in `static/js/map.js`.

## Commands

- Run: `./run.sh` or `go run ./cmd/gpx-self-host`.
- Backend tests: `go test ./...`.
- Frontend tests: `npm test`.
- Before visual testing, check `http://localhost:8080/` and reuse a reachable
  server. Start one only when needed.

## Conventions and safety

- Prefer the Go standard library and avoid heavyweight frontend frameworks.
- Use `log/slog` for structured server logs.
- Validate external input and handle errors explicitly.
- For filesystem access, prove the resolved path remains under its configured
  root; `filepath.Clean` alone is not a containment check.
- Validate tile provider and numeric path components before building cache paths.
- Keep tile writes atomic and account for concurrent requests for the same tile.
- Do not commit generated `data/`, `cache/`, `node_modules/`, `.gocache/`, or
  coverage contents. Only the two example GPX files under `data/` are tracked.

## Verification

- Run the tests relevant to the changed surface.
- For non-trivial changes, run both `go test ./...` and `npm test`.
- For visual changes, verify the rendered app, not only the source.
- Review the final diff and run `git diff --check`.
