# Recurring user preferences

- Keep documentation focused on product intent, operating instructions,
  constraints, and evidenced decision rationale. Put exact behavior in tests
  and technical gotchas beside the affected code.
- Use a consistent, sectioned ADR format with visible status and dates, context,
  decision, alternatives, consequences, and evidence. Keep each section brief.
- Keep controls compact and visually quiet. Improve discoverability with
  controls that fit the existing layout; avoid bulky helper panels, extra copy
  buttons, and accent borders on passive readouts.
- Keep coordinate copying stable and deliberate: seed from map center,
  single-click to target, click the readout to copy, and double-click to zoom.
  Place the readout before `bbox` in the bottom controls.
- Before removing an operational reference, confirm it is not still used
  manually. Removing a related feature does not establish that it is obsolete.
