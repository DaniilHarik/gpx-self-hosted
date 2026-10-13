# ADR 0002: Configure activity and plan sources independently

## Status

Accepted. Implemented on 2026-07-25; recorded retrospectively on 2026-10-13.

## Context

Recorded activities may already live in an external or cloud-synced archive,
while plans remain in the repository. A shared data root required both
collections to fit one directory layout, or users to copy files or add symlinks.

## Decision

Replace the shared data root with independent activity and plan directories.
Use existing storage locations directly. Keep checked-in configuration portable
and supply machine-specific paths through runtime overrides.

## Alternatives considered

- Keep one shared data root. This was the previous design, replaced to let
  activities and plans use separate existing storage locations.
- Keep the shared-root option solely for backward compatibility. This was
  explicitly rejected in the recorded user correction.
- Configure the two directories independently. This is the chosen approach.

## Consequences

- There are two source settings instead of one.
- Setups using the old data-root option must migrate their configuration.
- Activities and plans can stay in different locations without copying files
  or adding symlinks.
- The collections retain their separate roles regardless of storage location.
- External archives remain subject to the same deployment exposure risks.

## Evidence

Commit `1eaf06d` changed the configuration, scanning, serving, tests, and README.
It also recorded the shared-root compatibility and configuration-portability
corrections in `tasks/lessons.md`.

See [configuration](../../README.md#configuration) for current settings and
[deployment boundaries](../../SECURITY.md) before exposing an external archive.
