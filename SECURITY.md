# Security and Reliability

Updated: 2026-07-24

## Deployment model

This application is designed for a local machine or trusted network. It has no
authentication or authorization and should not be exposed directly to the
public internet.

GPX files remain on the host, but the server exposes the configured data
directory under `/data/`. Online map use sends tile requests to the configured
providers. The browser also loads frontend dependencies from third-party CDNs.

## Existing controls

- Tile routes accept only a safe provider token, numeric `z/x/y` components,
  and `.png` or `.jpg`.
- Tile downloads use configured timeouts and retry limits.
- Cache writes use a temporary file and atomic rename to avoid publishing
  partial downloads.
- OpenStreetMap requests use an application-specific `User-Agent`; a valid
  browser `Referer` is forwarded when present.
- Offline mode prevents upstream tile requests.

## Known risks

- `/data/` uses `http.FileServer`, which permits directory listings and can
  follow symlinks outside the configured data directory.
- Concurrent cache misses for the same tile are not deduplicated and can race
  on the final cache write.
- The tile cache has no quota, TTL, or eviction policy.
- Maa-amet Foto can cache JPEG content under a `.png` request path, causing an
  incorrect `Content-Type` on cached responses.
- Runtime CDN dependencies add availability and supply-chain exposure and
  prevent a fully disconnected first page load.

Use a firewall or an authenticated reverse proxy if the service is reachable
beyond a trusted host. Review configured tile providers and their usage terms
before deployment.

## Reporting a vulnerability

Use GitHub Security Advisories for private reports. If private reporting is not
available, open an issue with minimal reproduction details and mark it as
security-sensitive.
