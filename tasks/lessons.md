# Lessons

- When exporting Leaflet SVG overlays to canvas, do not serialize renderer SVGs with runtime CSS transform intact. Normalize root SVG transform before drawing to avoid map/track offset in exported images.
