#!/usr/bin/env bash
set -euo pipefail

# Run from repo root so relative paths work regardless of invocation location.
cd "$(dirname "$0")"

ldflags=()
if [[ "$(uname)" == "Darwin" ]]; then
  # Work around dyld aborts when Go emits a Mach-O without LC_UUID.
  ldflags=(-ldflags=-linkmode=external)
fi

go run "${ldflags[@]}" ./cmd/gpx-self-hosted "$@"
