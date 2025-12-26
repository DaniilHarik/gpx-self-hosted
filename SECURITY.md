# Security Notes - gpx-self-host

Updated: 2025-12-26

## Introduction

- **Local use**: This tool is designed for a local machine or trusted home network. It does not include authentication.
- **Privacy**: Your GPX data stays on your machine. The only outgoing calls are tile requests to the configured providers.

## Summary of Risks

- **Tile proxy/cache**: Unvalidated path segments allow path traversal, and concurrent requests for the same tile can lead to race conditions or file corruption.
- **Resource limits**: No global controls for tile download concurrency, prewarm job scaling, or disk usage.
- **Data directory exposure**: `/data/` is served via `http.FileServer`, which can expose directory listings and follow symlinks out of the data directory.
- **Third-party assets**: Frontend scripts/styles use SRI, but are still fetched from CDNs at runtime.

## Reporting a Vulnerability

If you discover a security issue, please open a private report via GitHub Security Advisories.
If private reporting is not available, open a standard issue with minimal reproduction details and mark it as security-sensitive.

## Known Issues

- **[High] Tile proxy path traversal**: Currently, tile URL parameters (`z`, `x`, `y`) are not strictly validated, which could allow path traversal. 
- **[High] Concurrency control for tile downloads**: Multiple requests for the same tile can trigger redundant fetches and potential race conditions. 
- **[High] Disk usage & safety**: Implementing size limits for tile downloads and atomic writes (temp file + rename) will improve robustness.
- **[Medium] Cache Quota**: Adding a maximum cache size and eviction policy (LRU) to prevent disk exhaustion.
- **[Medium] Prewarm Concurrency**: Limiting the number of concurrent prewarm workers across the entire application.
- **[Medium] Data directory hardening**: Ensuring the `/data/` handler only serves `.gpx` files and does not follow symlinks out of the directory.
