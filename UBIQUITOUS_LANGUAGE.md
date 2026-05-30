# Ubiquitous Language

## GPX library

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **GPX Archive** | The local collection of GPX files managed by the app. | Library, collection, dataset |
| **GPX File** | A source `.gpx` file stored under the configured data directory. | Track file, route file, data file |
| **Track** | A route or recorded path rendered on the map from a GPX file. | GPX, file, route |
| **Activity Track** | A completed or recorded track stored under the Activities area. | Activity, ride, hike |
| **Plan** | A planned route stored under the Plans area. | Route, planned activity, future track |
| **Activity** | The top-level category assigned to an activity track from the first folder under Activities. | Sport, folder, tag |
| **Folder Label** | The nested folder context shown for a track after its activity or plan root. | Subfolder, path label, directory |
| **Track Title** | The human-readable title derived from the GPX filename. | Name, filename, label |

## Browsing and selection

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Activities View** | The list view that shows activity tracks and exposes activity filtering. | Activity mode, tracks view |
| **Plans View** | The list view that shows plans separately from activity tracks. | Planned routes view, route mode |
| **Activity Filter** | A selectable chip that narrows activity tracks by activity. | Activity chip, category filter |
| **Search Filter** | The text filter that narrows visible tracks by title or relative path. | Search box, filename search |
| **Track Selection** | The set of tracks currently chosen from the list. | Loaded files, checked tracks |
| **Focused Track** | The selected track whose bounds and stats drive the primary map focus. | Active track, current track |
| **Multi-Track Mode** | The selection mode that allows more than one track to be loaded at once. | Multi-select, compare mode |

## Map and tiles

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Map Viewport** | The visible geographic area of the map at the current center and zoom. | View, screen, window |
| **Viewport Bounds** | The west, south, east, and north edges of the current map viewport. | BBox, bounding box |
| **Coordinate Readout** | The bottom map control that displays and copies a latitude/longitude pair. | Coordinate copy, coords, lat/lng display |
| **Target Coordinate** | A deliberate point selected by clicking the map for coordinate copying. | Clicked point, selected location |
| **Base Layer** | The visible background map layer, such as OpenStreetMap, OpenTopoMap, or Maa-amet. | Map layer, provider layer |
| **Tile Provider** | A configured upstream source for map tiles. | Provider, tile source |
| **Map Tile** | One image tile requested for a provider, zoom, x coordinate, and y coordinate. | Tile image, map image |
| **Tile Cache** | The local on-disk store of previously fetched map tiles. | Cache, tile store |
| **Offline Mode** | The mode that serves only cached tiles and never contacts tile providers. | Cache-only mode, offline cache |
| **Warmed Cache** | A tile cache that already contains the areas and zoom levels needed offline. | Preloaded cache, seeded cache |

## Track display and measurements

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Track Stats** | The measurements shown for a focused track, including distance, duration, speed, date, and elevation change. | Stats, metadata, summary |
| **Start Marker** | The marker that identifies where a loaded track begins. | Start pin, first marker |
| **End Marker** | The marker that identifies where a loaded track ends. | Finish pin, last marker |
| **Waypoint** | A named GPX point rendered independently from a track polyline. | Marker, point, pin |
| **Marker Visibility** | The setting that shows or hides start and end markers across loaded tracks. | Marker toggle, start/end toggle |

## Drawing and export

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Drawing** | A user-created polyline or marker on the map. | Sketch, overlay, edit |
| **Drawn Route** | A user-created polyline intended to be exported as a GPX track segment. | Route, drawing, line |
| **Drawn Waypoint** | A user-created marker intended to be exported as a GPX waypoint. | Marker, pin, point |
| **GPX Export** | A downloaded GPX document generated from current drawings. | Route export, track export |
| **Map Image Export** | A high-resolution PNG snapshot of the current map viewport and visible overlays. | Screenshot, image download, PNG export |

## Relationships

- A **GPX Archive** contains zero or more **GPX Files**.
- A **GPX File** is either an **Activity Track** or a **Plan** when it is stored under the supported data roots.
- An **Activity Track** has exactly one **Activity**, derived from the first folder under Activities.
- A **Plan** appears in the **Plans View** and is not represented by an **Activity Filter**.
- A **Track Selection** contains one **Focused Track** in single-track browsing and one or more tracks in **Multi-Track Mode**.
- A **Focused Track** has one set of **Track Stats** and may have a **Start Marker**, an **End Marker**, and zero or more **Waypoints**.
- A **Tile Provider** serves **Map Tiles**, and the **Tile Cache** stores those tiles for later use.
- **Offline Mode** depends on a **Warmed Cache** for successful tile display.
- A **Drawing** is either a **Drawn Route** or a **Drawn Waypoint**.
- A **GPX Export** contains the current drawings; a **Map Image Export** contains the current **Map Viewport** as pixels.

## Example Dialogue

> **Dev:** "When the user switches to **Plans View**, should we still show **Activity Filters**?"
> **Domain expert:** "No. A **Plan** is separate from an **Activity Track**, so **Plans View** lists plans by path and does not expose activity filtering."
> **Dev:** "If the user turns on **Multi-Track Mode**, do all selected tracks become **Focused Tracks**?"
> **Domain expert:** "No. The **Track Selection** may include several tracks, but the **Focused Track** is the one driving the primary bounds and **Track Stats**."
> **Dev:** "For offline use, is **Offline Mode** enough by itself?"
> **Domain expert:** "Only if the **Tile Cache** is already a **Warmed Cache** for the needed **Map Viewport** and zoom levels."
> **Dev:** "When exporting, do **Waypoints** from loaded tracks become part of the **GPX Export**?"
> **Domain expert:** "No. **GPX Export** is for current **Drawings**: **Drawn Routes** become track segments and **Drawn Waypoints** become waypoint entries."

## Flagged Ambiguities

- "Activity" can mean a completed outing, an activity folder, or a visible filter chip; use **Activity Track** for a GPX file under Activities, **Activity** for the derived category, and **Activity Filter** for the UI chip.
- "Track" and "GPX file" are related but not interchangeable; use **GPX File** for the stored source file and **Track** for the map-rendered path.
- "Plan" and "route" can blur together; use **Plan** for a GPX file under Plans and **Drawn Route** for a user-created polyline.
- "Marker" is overloaded between loaded track start/end markers, GPX waypoints, and drawn markers; use **Start Marker**, **End Marker**, **Waypoint**, or **Drawn Waypoint** depending on origin.
- "BBox" is a control label, not the domain term; use **Viewport Bounds** in docs and requirements, with BBox only as the compact UI label.
- "Cache" without a qualifier is vague; use **Tile Cache** for persisted map tiles and **Warmed Cache** when describing cache readiness for **Offline Mode**.
