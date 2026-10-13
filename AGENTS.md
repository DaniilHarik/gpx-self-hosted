# Agent guide

## Start here

- Read `SPEC.md` for product intent and scope before changing behavior or UI.
- Read `README.md` for setup, configuration, and contributor commands.
- Read `SECURITY.md` for security and reliability work.
- Review `tasks/lessons.md` for relevant project-specific corrections.
- Read relevant `docs/adr/` records before revisiting an architectural choice.
- Inspect the worktree before editing and preserve unrelated changes.

## Change requirements

- Update or add tests whenever behavior changes.
- Update `SPEC.md` when a UI or behavior change affects intent, guarantees, or
  scope. Keep exact implementation behavior in code and tests.
- Update `README.md` for user-facing features, setup, or configuration changes.
- Update `SECURITY.md` when security or reliability risks change.
- After a user correction, retain recurring preferences in `tasks/lessons.md`;
  put technical gotchas beside the affected code or regression test.
- Add a short ADR for a consequential, costly-to-reverse trade-off whose reason
  is surprising without context. Record actual alternatives and evidence. Mark
  retrospective records and unknown rationale; never infer them from code.
- When a decision changes, supersede its ADR and link the replacement; retain
  the original record.
- Do not update product docs for a behavior-preserving internal cleanup unless
  the existing docs are inaccurate.

## Conventions and safety

- Prefer the Go standard library and avoid heavyweight frontend frameworks.
- Use `log/slog` for structured server logs.
- Keep checked-in configuration portable; override machine-specific paths at
  runtime. See the independent-source-directories ADR.
- Validate external input and handle errors explicitly.
- For filesystem access, prove the resolved path remains under its configured
  root; `filepath.Clean` alone is not a containment check.
- Validate tile provider and numeric path components before building cache paths.
- Keep tile writes atomic and account for concurrent requests for the same tile.
- Do not commit generated `data/`, `cache/`, `node_modules/`, `.gocache/`, or
  coverage contents. Only the two example GPX files under `data/` are tracked.

## Verification

- Run and test commands are in `README.md`.
- Run the tests relevant to the changed surface.
- For non-trivial changes, run both `go test ./...` and `npm test`.
- For visual changes, verify the rendered app. Check `http://localhost:8080/`
  first and reuse a reachable server; start one only when needed.
- Review the final diff and run `git diff --check`.
