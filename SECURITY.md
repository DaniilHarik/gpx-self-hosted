# Security Notes - gpx-self-host

Updated: 2026-03-14

## Introduction

- **Local use**: This tool is designed for a local machine or trusted home network. It does not include authentication.
- **Privacy**: Your GPX data stays on your machine. The only outgoing calls are tile requests to the configured providers.
- **Tile provider visibility**: When standard OpenStreetMap tiles are proxied online, that provider will see an app-specific `User-Agent` from the backend and may also receive the browser `Referer` (for example `http://localhost:8080/`) when the browser sends one.

## Summary of Risks

- **Tile request validation**: `/tiles/{provider}/{z}/{x}/{y}.(png|jpg)` rejects malformed provider names, non-numeric coordinates, and unsupported extensions before proxying.
- **Tile provider compliance**: Requests to the built-in `openstreetmap` provider carry a stable application `User-Agent`, and proxied browser requests forward a valid `Referer` when available so standard OpenStreetMap tiles can distinguish legitimate web traffic.
- **Tile proxy/cache**: Concurrent requests for the same tile can lead to race conditions or file corruption.
- **Resource limits**: No global controls for tile download concurrency or disk usage.
- **Data directory exposure**: `/data/` is served via `http.FileServer`, which can expose directory listings and follow symlinks out of the data directory.
- **Third-party assets**: Frontend scripts/styles use SRI, but are still fetched from CDNs at runtime.

## Reporting a Vulnerability

If you discover a security issue, please open a private report via GitHub Security Advisories.
If private reporting is not available, open a standard issue with minimal reproduction details and mark it as security-sensitive.

## Known Issues

- **[High] Concurrency control for tile downloads**: Multiple requests for the same tile can trigger redundant fetches and potential race conditions. 
- **[Medium] Cache Quota**: Adding a maximum cache size and eviction policy (LRU) to prevent disk exhaustion.
- **[Medium] Data directory hardening**: Ensuring the `/data/` handler only serves `.gpx` files, avoids directory listings, and does not follow symlinks out of the directory.
