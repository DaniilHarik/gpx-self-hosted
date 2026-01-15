# Implementation Plan: GPX Metadata Caching System

This plan follows the project's TDD-focused workflow.

## Phase 1: Cache Storage & Model Definition
- [ ] Task: Define the Metadata Cache structure and storage logic.
    - [ ] Write unit tests for cache serialization and deserialization.
    - [ ] Implement the `Cache` struct and methods in a new package `internal/service/gpx/cache`.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Cache Storage' (Protocol in workflow.md)

## Phase 2: Integration with GPX Service
- [ ] Task: Implement cache-aware file scanning.
    - [ ] Write tests to verify that `ScanFiles` uses cached metadata when the file hasn't changed.
    - [ ] Update `internal/service/gpx/service.go` to integrate the new caching logic.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Service Integration' (Protocol in workflow.md)

## Phase 3: Performance Verification & Cleanup
- [ ] Task: Verify performance gains and handle edge cases.
    - [ ] Add benchmarks for the `/api/gpx` endpoint with and without cache.
    - [ ] Ensure the cache directory is correctly initialized if it doesn't exist.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Performance & Cleanup' (Protocol in workflow.md)
