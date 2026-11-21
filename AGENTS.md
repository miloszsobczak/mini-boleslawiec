# Mini Bolesławiec — rules for agents

Mini Bolesławiec is a browser-based, stylized 3D model of Bolesławiec and its county, generated
automatically from open geodetic data. The full product spec is [PRD.md](PRD.md) (Polish);
read the relevant section before designing anything. This file is the short list of rules
that every change must respect.

## Layout

- `app/` — the viewer: TypeScript, Vite, three.js, 3DTilesRendererJS.
- `pipeline/` — offline data pipeline: Python, GDAL/PDAL. Not created yet.
- The two share only the tile format (OGC 3D Tiles + index). Neither imports from the other.
- Source data and generated tiles never enter the repository (`data/`, `tiles/` are ignored).

## Commands

Run from the repository root:

- `npm run verify` — typecheck, lint, tests and build; must pass before you call work done.
- `npm run dev` — local dev server for the app.

## Hard rules

- **Everything is generated.** No hand modelling and no hand-edited geometry. Corrections go
  through `overrides/` (parameters, generator rules, or per-object procedural code), so a
  rebuild from scratch reproduces them.
- **Deterministic pipeline.** The same inputs and seed give byte-identical output. No
  wall-clock time, unseeded randomness or iteration over unordered collections in generated
  output.
- **Incremental pipeline.** A change to one object rebuilds only the tiles it touches. Every
  stage can be run on its own, for an area given as a bounding box in EPSG:2180.
- **Stable identifiers.** Every world object has an id like `bud-0201-004217` that never
  changes between rebuilds and survives on every LOD, including merged tiles. Never
  renumber, reuse or derive ids from array order.
- **Style.** Stylized low-poly: flat shading, visible facets, colours only from the limited
  palette. No photographic textures and no photorealism. "Not too low": a building up close
  has hundreds to a few thousand triangles, not a box.
- **Scale and coordinates.** Terrain is true 1:1 with no vertical exaggeration. Sources are
  PL-1992 (EPSG:2180). The scene is in metres, origin at the Rynek, Y up, vertices stored
  relative to the tile centre.
- **LOD.** Tiles carry a geometric error in metres and refine on screen-space error. No
  visible popping and no gaps between tiles of different levels.
- **Performance budgets** (PRD 8): desktop about 1.5 M triangles and 300 draw calls at
  60 fps on integrated graphics; phone about 400 k triangles and 150 draw calls at 30 fps.
  Both use the same tiles.
- **Data provenance.** No pixels or geometry from Google Street View or Google Earth, ever.
  Allowed sources are listed in PRD 4 and 5. Keep the attribution "GUGiK, © autorzy
  OpenStreetMap" visible in the app.
- **Real data only.** Samples and tests of the pipeline use real GUGiK data, never synthetic
  stand-ins.

## Out of scope for the MVP

NPCs, vehicles, quests, multiplayer, building interiors, adjustable time of day, object
cards, search, photo mode, public hosting, and the walking camera. Do not build these or add
abstractions for them, with one exception: the camera goes behind a common mode interface,
and terrain-height queries plus L3 collision meshes stay available for a later walking mode.

## Order of work

Phases are in PRD 10. Do not widen the area until the vertical slice (phase 1) meets its
criteria. When a task conflicts with the PRD, stop and say so instead of picking a side.

## Tests

Write a test when it protects a rule above or a real behaviour (id parsing, determinism,
tile-boundary maths). Do not add tests that restate the implementation, and do not add
comments that restate the code.
