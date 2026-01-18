# Implementation Plan: Environment and JSON Configuration Support

This plan outlines the steps to implement configuration support via environment variables and a JSON file, following the precedence: CLI > JSON > ENV > Defaults.

## Phase 1: Environment Variable Support [checkpoint: 624d545]
Goal: Allow configuration values to be set via environment variables with the `GPX_SELF_HOST_` prefix.

- [x] Task: Write tests in `internal/config/config_test.go` to verify that environment variables are correctly mapped to the `Config` struct. [1aa5da5]
- [x] Task: Implement a mechanism (e.g., a `loadEnv` function) to populate the `Config` struct from environment variables (e.g., `GPX_SELF_HOST_PORT`). [1aa5da5]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Environment Variable Support' (Protocol in workflow.md) [624d545]

## Phase 2: JSON Configuration Support [checkpoint: eaf370e]
Goal: Support loading configuration from a `config.json` file in the current directory, including full override of tile providers.

- [x] Task: Write tests for JSON configuration parsing, ensuring that fields like `Port`, `DataDir`, and `Providers` are correctly handled. [1898a1f]
- [x] Task: Implement a mechanism to load and parse `config.json` from the current working directory if it exists. [1898a1f]
- [x] Task: Ensure that if `Providers` is defined in the JSON file, it completely replaces the default providers. [1898a1f]
- [x] Task: Conductor - User Manual Verification 'Phase 2: JSON Configuration Support' (Protocol in workflow.md) [eaf370e]

## Phase 3: Integration and Precedence Verification
Goal: Integrate all configuration sources into the `Parse` function and verify the correct hierarchy.

- [x] Task: Refactor the `Parse` function in `internal/config/config.go` to apply configuration sources in the order: Defaults -> ENV -> JSON -> CLI. [eafa88b]
- [x] Task: Write comprehensive integration tests verifying the full precedence hierarchy (e.g., ensuring a CLI flag overrides a value in `config.json`). [eafa88b]
- [x] Task: Update the `Load` function to ensure errors during parsing (like invalid JSON) are handled gracefully (logging and exiting). [eafa88b]
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Full Precedence Integration' (Protocol in workflow.md)
