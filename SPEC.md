# Product intent

## Purpose

Provide a personal GPX archive viewer for a local machine or trusted network.
Users can browse recorded activities without uploading their tracks to a third
party, compare routes, and sketch plans for export.

Recorded activities and planned routes are separate collections. Activities
derive their category from the first folder below their configured source
directory. Plans are not activity categories. The directories can be configured
independently so existing archives can stay where their owner manages them.
See the [source-directory decision](docs/adr/0002-independent-gpx-source-directories.md)
for the storage constraints behind this choice.

## Product guarantees

- Discover nested GPX files in both source directories, including filenames
  with spaces, Unicode, and URL-reserved characters.
- Support both single-track focus and additive multi-track comparison. The
  focused track drives the statistics; tracks remain visually distinguishable.
- Show loading and retryable failure states. Retry preserves other selected
  tracks and the failed track's color. Removed or replaced requests cannot
  change map layers, statistics, or the viewport after becoming obsolete.
- Provide distance, duration, date, moving speed, and elevation gain/loss only
  after a track loads successfully.
- Export drawn routes and waypoints as GPX 1.1 with its namespace and metadata,
  and export the visible map and overlays as a PNG.
- Preserve explicit theme and base-layer choices across browser sessions.
  Initialize the theme before rendering to avoid a flash of the wrong theme.
- In offline tile mode, never contact upstream tile providers. Cached tiles
  remain available; missing tiles return `404`.
- Support map workflows in current desktop and mobile browsers.

## Scope boundaries

The app does not upload tracks, provide an upload UI, or rescan the file list
live. Users manage source files outside the app and refresh the browser after
file changes. Drawing produces downloads for users to save themselves.

Offline tile mode is cache-only map serving. It does not promise a fully
disconnected first page load because browser dependencies still come from CDNs.
There is no bulk tile-download or prewarming feature.
The [prewarming removal decision](docs/adr/0001-cache-tiles-on-demand.md) records
why the previous feature was removed.

The app has no authentication or authorization. Its local/trusted-network scope
does not make every file under a configured source directory safe to expose;
deployment constraints and known risks are recorded in [SECURITY.md](SECURITY.md).

[README.md](README.md) explains setup, configuration, and usage. Exact controls,
defaults, API shapes, and failure cases are described in code and tests.
