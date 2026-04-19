# Lessons

- When exporting Leaflet SVG overlays to canvas, do not serialize renderer SVGs with runtime CSS transform intact. Normalize root SVG transform before drawing to avoid map/track offset in exported images.
- When applying provider-specific network-policy fixes, scope them to the exact provider that requires them instead of changing outbound headers for every tile source.
- For map coordinate copy UX in this app, avoid live `mousemove` updates. Prefer deliberate click-based selection so the readout stays stable and copyable.
- For passive coordinate displays in this app, do not add accent borders just to indicate selection. Keep the control visually quiet unless stronger feedback is necessary.
- When a control already displays the exact coordinates to copy, do not add a second nearby copy button. Make the readout itself the copy target.
- In the bottom map utility cluster, place the coordinate readout before the `bbox` action so the primary location-copy affordance comes first.
- Seed the coordinate readout from the current map center on load instead of showing an empty placeholder.
- For discoverability fixes in this app, do not solve a subtle-control problem by adding a bulky helper panel. Prefer compact, native-feeling controls that fit the existing sidebar rhythm.
- In this app, keep coordinate targeting and zoom gestures separate: single-click updates the bottom coordinate readout, while double-click handles zoom.
