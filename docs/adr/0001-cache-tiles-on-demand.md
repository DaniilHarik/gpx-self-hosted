# ADR 0001: Cache tiles on demand

## Status

Accepted. Implemented on 2026-01-18; recorded retrospectively on 2026-10-13.

## Context

The app previously offered "Download Current View" to prewarm tiles across a
viewport and zoom range. The historical specification records that this feature
proved fragile, but does not describe the exact failures.

## Decision

Remove viewport prewarming and its control, API, and workers. Retain the tile
cache populated by ordinary online map browsing.

## Alternatives considered

- Retain viewport prewarming. This was the previous implementation, rejected
  because it proved fragile.
- Rely on on-demand caching. This is the chosen approach, accepting that users
  must browse the areas and zoom levels they need while online.

## Consequences

- There is no bulk tile download or assurance that an entire region is cached.
- Offline tile mode serves cached tiles and returns `404` for missing tiles.
- Runtime CDN dependencies remain a separate limitation on disconnected startup.
- Reintroducing prewarming requires a new decision addressing reliability
  concerns and provider usage terms.

## Evidence

Commit `041fc11` removed the feature and its tests. Commit `18fd53f` added the
historical rationale to `SPEC.md`.

See [offline usage](../../README.md#offline-mode) and the retained
[Maa-amet tile-range reference](../tiles.md).
