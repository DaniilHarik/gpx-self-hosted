# Specification: Environment and JSON Configuration Support

## Overview
Currently, the application only supports configuration via command-line flags. This track will implement support for loading configuration from a JSON file and environment variables, providing more flexibility for self-hosted deployments (e.g., Docker).

## Functional Requirements
- **Configuration Sources & Precedence**: The application MUST support the following sources, in order of decreasing priority:
    1.  Command-line flags (CLI)
    2.  JSON configuration file
    3.  Environment variables
    4.  Hardcoded defaults
- **JSON Configuration**:
    -   The application will look for a file named `config.json` in the current working directory.
    -   If the file exists, it MUST be parsed and used to populate configuration values.
    -   The JSON structure SHOULD match the `Config` struct (e.g., `{"Port": ":8080", "DataDir": "./my-gpx-files"}`).
    -   The `Providers` field MUST allow for a full override if defined in the JSON file.
- **Environment Variables**:
    -   All configuration values MUST be settable via environment variables.
    -   Environment variables MUST be prefixed with `GPX_SELF_HOST_` (e.g., `GPX_SELF_HOST_PORT`).
    -   Variable names SHOULD be the uppercase version of the field names (e.g., `GPX_SELF_HOST_DATA_DIR`).
- **Validation**:
    -   The application SHOULD report errors for invalid JSON syntax or incorrect data types in the configuration file.
    -   CLI flags MUST still work as they do currently, but with higher precedence than other sources.

## Non-Functional Requirements
- **Maintainability**: Use standard library features where possible for parsing (e.g., `encoding/json`, `os.Getenv`).
- **Robustness**: The application SHOULD NOT crash if the `config.json` file is missing; it should simply fall back to environment variables or defaults.

## Acceptance Criteria
- [ ] Application starts correctly with a `config.json` file present.
- [ ] Application starts correctly using environment variables when no CLI flags or JSON file are provided.
- [ ] CLI flags override values set in `config.json`.
- [ ] Values in `config.json` override values set in environment variables.
- [ ] Tile providers can be fully customized via the `config.json` file.
- [ ] Unit tests verify the precedence logic (CLI > JSON > ENV > Default).

## Out of Scope
- Support for other file formats like YAML or TOML.
- Automatic reloading of configuration when the file changes (requires restart).
- Encrypted configuration or secret management.
