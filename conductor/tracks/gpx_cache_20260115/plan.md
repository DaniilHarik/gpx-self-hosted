# Implementation Plan: GPX Metadata Caching System

This plan follows the project's TDD-focused workflow.

## Phase 1: Cache Storage & Model Definition [checkpoint: 147a946]
- [x] Task: Define the Metadata Cache structure and storage logic.
    - [x] Write unit tests for cache serialization and deserialization.
    - [x] Implement the `Cache` struct and methods in a new package `internal/service/gpx/cache`.
- [x] Task: Implement GPX parser for metadata extraction.
    - [x] Write unit tests for GPX metadata extraction.
    - [x] Implement the parser using `encoding/xml`.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Cache Storage' (Protocol in workflow.md) 147a946

## Phase 2: Integration with GPX Service [checkpoint: 9d81518]
- [x] Task: Implement cache-aware file scanning.
    - [x] Write tests to verify that `ScanFiles` uses cached metadata when the file hasn't changed.
    - [x] Update `internal/service/gpx/service.go` to integrate the new caching logic.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Service Integration' (Protocol in workflow.md) 9d81518

## Phase 3: Performance Verification & Cleanup
- [x] Task: Verify performance gains and handle edge cases. 1ff3e75
    - [x] Add benchmarks for the `/api/gpx` endpoint with and without cache.
    - [x] Ensure the cache directory is correctly initialized if it doesn't exist.
    - Result: Warm cache is ~6x faster (0.21ms vs 1.3ms for 50 files).
- [x] Task: Conductor - User Manual Verification 'Phase 3: Performance & Cleanup' (Protocol in workflow.md) c6d27ef
