# Deployment boundaries and known risks

## Deployment model

This application is designed for a local machine or trusted network. It has no
authentication or authorization and should not be exposed directly to the
public internet.

GPX files remain on the host, but the server exposes the configured activity
and plan directories under `/data/Activities/` and `/data/Plans/`. Online map
use sends tile requests to the configured providers. The browser also loads
frontend dependencies from third-party CDNs.

An unreadable or invalid `config.json` prevents startup, so a configuration
error cannot silently discard offline mode or the configured source directories.

## Known risks

- The GPX data routes use `http.FileServer`, which permits directory listings
  and can follow symlinks outside the configured activity or plan directory.
- Startup logs include the configured activity and plan filesystem paths.
  Protect logs if those paths reveal sensitive account or mount names.
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
