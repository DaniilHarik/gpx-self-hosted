# Agent Guide

## Project
Self-hosted GPX viewer with a Go backend, vanilla JS frontend, and on-disk
tile caching.

## Non-negotiables
- When a feature is changed or added, always update `SPEC.md`.
- Always review and update tests when features change.

## Key files
- `SPEC.md` – Product requirements and UX scope.
- `README.md` – Architecture, setup, and flags.
- `cmd/gpx-self-host/` – CLI entrypoint.
- `internal/` – Config, handlers, models, server, and services.
- `static/` – HTML/JS/CSS frontend.
- `data/` – GPX files (activities and plans).
- `cache/tiles/` – Proxied map tiles cache.

## Workflow
- Read `SPEC.md` first for requirements before changing behavior.
- Check `README.md` for architecture, setup, and command guidance.

## Commands
- `./run.sh` or `go run ./cmd/gpx-self-host` runs the server.
- `go test ./...` runs Go tests.
- `npm test` runs frontend tests (Jest + jsdom).

## Conventions
- Prefer Go standard library; avoid heavyweight JS frameworks.
- Use `log/slog` for structured logging; avoid `fmt.Printf` and `log.Printf`
  for server logs.
- Validate all external inputs and handle errors explicitly.
- Theme initialization lives inline in `static/index.html` to prevent FOUC;
  toggle logic and persistence live in `static/js/map.js`.
- Update `README.md` for user-facing changes (flags, features).
- Update `SPEC.md` for UI or behavioral changes.
- Update `SECURITY.md` when addressing security or reliability risks.

## Repo hygiene
- Do not commit `data/`, `cache/`, `node_modules/`, or `.gocache/` contents
  (except the two example GPX files under `data/`).
- Guard against path traversal and unsafe file access when handling user input;
  use `filepath.Clean` and validate numeric path components.
- Be careful with concurrent file writes in the tile proxy.

## Feature specifics
- Multi-track mode: `isMultiTrackMode` in `static/js/app.js`.
- Plans view: `data/Plans/` is handled separately from `data/Activities/`.

## Technical details
- Tile cache keeps original extension; mismatches can cause incorrect
  `Content-Type` when serving cached JPEGs as `.png`.
- Tile downloads are not synchronized; concurrent requests can race on writes.
