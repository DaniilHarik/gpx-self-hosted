# Contributing

Use GitHub Issues for bug reports and feature requests. Keep pull requests
focused on one change.

## Development

1. Follow the setup in [README.md](README.md).
2. Create a branch from `main`.
3. Add or update tests for behavior changes.
4. Run `go test ./...` and `npm test`.
5. Update `SPEC.md` for UI or behavioral changes, `README.md` for user-facing
   setup or configuration changes, and `SECURITY.md` when the risk model changes.

Go code should use the standard library where practical and be formatted with
`gofmt`. Frontend code should remain framework-free unless a broader
architecture change is agreed first.
