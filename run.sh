#!/usr/bin/env bash
set -euo pipefail

# Run from repo root so relative paths work regardless of invocation location.
cd "$(dirname "$0")"

go run ./cmd/gpx-self-host "$@"
