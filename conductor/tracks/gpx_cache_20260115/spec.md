# Specification: GPX Metadata Caching System

## Overview
Currently, the application scans the `data/` directory and parses every GPX file on every request to `/api/gpx`. This process becomes slow as the number of tracks increases. This track introduces a caching layer to store extracted metadata (distance, duration, bounds, etc.) to significantly speed up indexing.

## Functional Requirements
- **Cache Storage**: Store metadata in a local JSON file or a lightweight key-value store (e.g., a simple file-based cache in `cache/gpx_metadata.json`).
- **Cache Invalidation**: Automatically detect when a GPX file has changed (using file modification time or hash) and re-parse only the affected files.
- **Metadata Extraction**: Ensure all necessary fields (distance, elevation, duration, activity type, start/end points) are cached.
- **API Integration**: Modify the existing GPX service to check the cache before falling back to full file parsing.

## Non-Functional Requirements
- **Performance**: Listing 100+ tracks should take less than 100ms.
- **Simplicity**: Avoid complex database dependencies; stick to filesystem-based storage.
- **Robustness**: If the cache file is corrupted or missing, the system should gracefully fall back to re-scanning and rebuild the cache.
