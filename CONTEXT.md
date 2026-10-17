# GPX archive viewer

A personal archive of recorded activities and planned routes, with map comparison
and route sketching.

## Language

### Archive and planning

**Activity**:
A record of movement that has taken place, kept in the activities collection.
_Avoid_: Activity type or category when referring to an individual recording.

**Activity category**:
A folder-based grouping of recorded activities, such as hiking or sailing,
named by the first folder below the activity source directory.
_Avoid_: Activity when referring to the grouping, GPX track type.

**Plan**:
A proposed route kept in the plans collection, separate from recorded activities.
_Avoid_: Activity category, drawing when referring to an archived plan.

**GPX file**:
A document containing geographic data such as tracks and waypoints. A single
file can contain several tracks or only waypoints.
_Avoid_: Track when the distinction between the document and its contents matters.

**Track**:
A sequence of geographic points describing recorded or planned movement.
_Avoid_: Activity when the path may also belong to a plan.

**Drawn route**:
A path sketched on the map for GPX export. It becomes an archived plan when the
user saves the exported file in the plans collection.
_Avoid_: Recorded activity, saved plan before the export has been archived.

**Waypoint**:
A standalone geographic location, supplied by a GPX file or placed while drawing.
_Avoid_: Track point, start/end marker.

### Map comparison

**Selected track**:
An activity or plan chosen for display on the map. Selection identifies the
whole GPX file, which may contain several tracks or only waypoints.
_Avoid_: Focused track when referring to every selected file.

**Focused track**:
The selected track whose statistics are shown when it has loaded successfully.
_Avoid_: All selected tracks, combined statistics.

### Background maps

**Base layer**:
The background map or aerial imagery beneath tracks and drawings.
_Avoid_: Track overlay, tile provider when referring to the displayed map.

**Tile provider**:
A source of map or imagery tiles used for a base layer.
_Avoid_: Base layer when referring to the source of its tiles.

**Offline tile mode**:
Map serving limited to previously cached tiles, without requests to tile
providers. This mode does not guarantee a fully disconnected page load.
_Avoid_: Fully offline app, downloaded region.
