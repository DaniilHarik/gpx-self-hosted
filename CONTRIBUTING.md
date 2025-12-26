# Contributing to GPX Self-Hosted

## AI-Native Development

This project heavily utilizes AI coding assistants for development. 

*   **Iterative AI workflow**: The focus is on simple client/server architecture and clear constraints, allowing AI to handle the bulk of implementation and testing.
*   **Documentation**: A detailed `PRODUCT_SPEC.md` and `SECURITY.md` are provided to provide context for both human and AI collaborators.
*   **Tests**: Comprehensive Go and Jest tests are used to ensure stability across AI-driven iterations.

## How to Contribute

### Bug Reports & Feature Requests
Please use GitHub Issues to report bugs or suggest new features. 

### Development
1.  **Fork the repository** and create your branch from `main`.
2.  **Run tests**: Ensure `go test ./...` and `npm test` pass.
3.  **Update documentation**: If you're adding a feature, please update `PRODUCT_SPEC.md`.

### Pull Requests
- Keep PRs focused and modular.
- Include/update tests for any logic changes.
- If you used AI to help with your contribution, feel free to mention it!

## Development Setup

1. Install [Go](https://go.dev/dl/).
2. Run `npm install` for frontend tests.
3. Start the dev server: `./run.sh`.