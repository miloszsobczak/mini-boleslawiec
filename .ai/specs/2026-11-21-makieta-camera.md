# Makieta camera (mouse) on the test plate, behind a common camera-mode interface

Brief: [.ai/specs/briefs/2026-11-21-makieta-camera.md](briefs/2026-11-21-makieta-camera.md)

## 📝 TLDR

The viewer (`app/src/main.ts`) shows a 1 km² placeholder plate through a fixed camera and only
re-renders on resize, so nothing can be inspected yet. **Proposed (future behaviour):** a
tabletop ("makieta") camera driven by mouse and wheel. Drag pans with the grabbed point
staying under the cursor; right-drag or Alt+drag rotates and pitches; the wheel zooms to the
point under the cursor; motion has frame-rate-independent inertia; and the camera never goes
below the terrain. It sits behind a `CameraMode` interface (input → pose, PRD 7.3), so the
walking and drone modes can be added later as further implementations. Phase 1 (PRD 10) needs
this camera, and every later visual check depends on it.

## 📝 Resolved assumptions (autonomous defaults)

The brief's Resolved-unknowns table settles every gate question about inputs, semantics,
limits, tests and "done" (see the brief). This unattended run defaulted the three questions
the brief left open:

| # | Question | Default | Rationale |
|---|----------|---------|-----------|
| Q1 | Split into several specs? | **No, one spec.** | Pan, rotate, zoom-to-cursor, inertia and the clamp are one capability: none of them is useful as a shipped camera on its own. The brief explicitly rejects splitting them. Touch is a separate, later spec. |
| Q2 | PRD phase 1 says "kamera makiety (mysz i dotyk)", and PRD 6 lists double-click fly-to and WASD. Is deferring touch, fly-to and WASD a conflict with the PRD? | **No conflict: each one is a follow-up task inside phase 1, on the same `CameraMode`.** | The PRD lists what phase 1 must contain, not how it is sliced into tasks. This spec does not close phase 1. ⚠ NEEDS HUMAN CONFIRMATION that phase 1 stays open until touch, fly-to and WASD ship. |
| Q3 | Mapping when both right-drag and Alt+left-drag are present (e.g. Alt+right). | **Treat any rotate trigger as rotate. Ctrl and Shift are ignored for now.** | Smallest surface; no extra gestures to document or test. |

## 📝 Problem Statement

- `main.ts` today: a fixed `PerspectiveCamera` at (600, 700, 900), looking at the origin.
  `renderer.render` is called only from `resize()`. There is no input handling at all.
- PRD 6 defines the makieta controls. PRD 7.3 requires a common camera-mode interface, plus a
  terrain-height query that is available from the start, for the later walking mode.
- AGENTS.md "Out of scope": the camera goes behind a common mode interface, and terrain-height
  queries stay available. No other mode is to be built.
- Without this camera, the phase-1 criteria ("smooth zoom with no popping", "budgets met")
  cannot even be observed.

## 📝 Proposed Solution

Four pieces:

1. **`CameraMode`** is the interface. A mode is attached to a DOM element and a
   `SceneQuery`. Each frame it gets `update(dt)` and returns a `CameraPose`
   `{ position: Vector3, quaternion: Quaternion }`. It reports whether it is still moving, so
   that the render loop knows when to stop.
2. **`CameraRig`** owns the single real `THREE.PerspectiveCamera`. It copies the pose of the
   active mode onto that camera, and handles aspect changes on resize. Because it accepts
   poses rather than letting a mode mutate the camera, it can blend between two poses later.
   No blending is built now.
3. **`MakietaMode`** is the only implementation.
4. **`SceneQuery`** provides `pick(ndc: Vector2, camera) → Vector3 | null` (a raycast against
   the ground layer) and `heightAt(x, z) → number | null` (a vertical raycast from above).
   Today it is backed by the plate mesh. Later it will be backed by tile meshes, without
   changing its signature. When a query misses, the mode falls back to the y = 0 plane.
   L3 building collision meshes (AGENTS.md) are out of scope here, because no tiles exist
   yet. `SceneQuery` is the seam they will plug into.

**How `MakietaMode` is implemented is decided by a timeboxed spike (Phase 1, Step 1).**

- **Preferred: a wrapper around `EnvironmentControls` from `3d-tiles-renderer`.** It already
  provides grab-pan, rotation around a pivot, zoom to the cursor, damping and height
  adjustment against the scene. The mode drives the controls against a *private*
  `PerspectiveCamera`, and returns the pose of that camera from `update(dt)`. The rig keeps
  sole ownership of the real camera. The private camera copies the rig camera's fov and
  aspect, so that cursor rays match.
- **Fallback: an own implementation.** It keeps orbit state (`target`, `yaw`, `pitch`,
  `distance`) plus velocities for pan, yaw/pitch and log-distance. Each velocity decays as
  `v *= exp(-k·dt)`.

The spike must check the following against the acceptance criteria below:

- (a) the controls run against a camera that is not the rendered one;
- (b) right-drag and Alt+left-drag can both be mapped to rotate (the library's default
  pointer mapping may differ);
- (c) damping is dt-based and settles;
- (d) the controls expose when motion has ended (a `change`/`end` event or equivalent), for
  the render-on-demand loop;
- (e) the height clamp can be backed by our `SceneQuery`, or is at least equivalent to it on
  the plate.

The outcome is recorded with a reason under **Spike outcome** below, and in the PR. Only one
path is built in full.

The library's option and event names (`enableDamping`, `minDistance`, `adjustHeight`,
`cameraRadius`, `useFallbackPlane`, `setCamera`, `attach`/`detach`) are **unverified**. Docs
lookup was not available while this spec was written. The spike confirms them against the
installed version.

**Rendering on demand.** `main.ts` gets a `requestAnimationFrame` loop. The loop runs while
the mode reports motion, or while a pointer button is held (so a drag that is held still
keeps rendering), and stops when the mode settles. Input
events and `resize` wake it. `dt` comes from the rAF timestamp and is clamped to at most
100 ms, so that a backgrounded tab does not make the camera jump.

**Alternatives that lost** (from the brief):

- Doing nothing: phase 1 is blocked without it.
- three.js `MapControls`/`OrbitControls`: no "the point stays under the cursor" grab-pan, no
  terrain clamp, and they own the camera.
- Splitting zoom-to-cursor or inertia into later tasks: they are the named behaviours of this
  one capability.
- A separate input-intent layer: deferred until touch needs it.

### Spike outcome

**Chosen: the fallback (own implementation). `3d-tiles-renderer` is not added.**

The decision rests on the source reading of `3d-tiles-renderer@0.5.4` in the pre-implement
review (`.ai/analysis/pre-implement-2026-11-21-makieta-camera.md`):

- (a) passes: `setCamera` accepts any camera.
- (b) fails without a workaround: rotate is right-click or Shift+left. Alt+left would need a
  rewritten `shiftKey` on `pointerdown`, and Shift+left would have to be suppressed.
- (c) passes: damping is dt-based (`2^(−dt/dampingFactor)`).
- (d) passes: `start`/`change`/`end` events.
- (e) only through the private `_raycast` override.
- (f) — headless drivability from `MakietaInput` — fails, and that is the hard gate. The
  controls read only DOM pointer and wheel events through their internal `PointerTracker`,
  so the tests would have to synthesise DOM events under `happy-dom` with
  `getBoundingClientRect`/`setPointerCapture` stubs.

The own implementation keeps `target`, `yaw`, `pitch`, `distance`, with velocities that decay
as `e^(−k·dt)` and are integrated analytically (`x += v·(1−e^(−k·dt))/k`). Grab-pan, rigid
rotation around the pivot and homothetic zoom around the anchor keep the grabbed or anchored
point exactly under the cursor. Touch arrives as pointer events, so one-finger pan works
incidentally; it is untested and not claimed.

## 📝 Delta

### Capability: camera-makieta

ADDED requirements (there is no prior camera behaviour, so there is nothing MODIFIED or
REMOVED and no characterization tests are needed):

- **Grab-pan.** WHEN the user left-drags starting over the plate, THEN the world point that
  was under the cursor at drag start stays under the cursor (within 2 px) for the whole drag.
  Movement is in the horizontal plane at that point's height.
- **Grazing pan.** WHEN the cursor ray is near-parallel to the pan plane, or misses it, THEN
  the pan per event is limited to `PAN_CLAMP × distance` and the camera never extrapolates
  towards the horizon.
- **Rotate/pitch.** WHEN the user right-drags or Alt+left-drags, THEN the camera yaws around
  the vertical axis through the pivot (the picked point, or the orbit target if nothing is
  picked). It also pitches within `[PITCH_MIN ≈ 5°, PITCH_MAX ≈ 89°]` above the horizon.
- **Zoom to cursor.** WHEN the user scrolls over a picked point P, THEN the distance to P
  changes multiplicatively per normalized wheel step (`deltaMode` lines × 16 px, pages × 800
  px). P keeps its screen position within 2 px. The distance stays in
  `[DIST_MIN ≈ 5 m, DIST_MAX ≈ 60 km]`, and the camera never passes through P.
  Where `DIST_MIN` and the terrain clearance disagree (on a steep slope), the clearance wins.
- **Zoom over sky.** WHEN nothing is picked, THEN the camera zooms along the view direction
  towards the orbit target. That target is the last pivot point, initially the origin (the
  Rynek); on the wrapper path it is the controls' pivot.
- **Inertia.** WHEN the user releases a drag, or stops scrolling, THEN motion continues and
  decays exponentially in real time. The same input gives the same rest pose (within 1 cm) at
  30 fps and at 144 fps. The render loop stops once motion settles.
- **Never under terrain.** WHEN any update finishes, THEN
  `camera.y ≥ (heightAt(camera.x, camera.z) ?? 0) + CLEARANCE` (≈ 2 m).
- **Attribution.** WHEN the app is running, THEN "GUGiK, © autorzy OpenStreetMap" stays
  visible. It is already present in `app/index.html` and must not be covered by the canvas.

## 📝 Architecture

New module `app/src/camera/`. Everything in it is new; the only file it changes is `main.ts`.

| File | Role |
|------|------|
| `camera/mode.ts` | `CameraPose`, `CameraMode` and `SceneQuery` types. No three.js objects beyond `Vector3`/`Quaternion`/`Vector2`. |
| `camera/rig.ts` | `CameraRig`: owns the `PerspectiveCamera`, `setMode(mode)`, `update(dt) → moving`, `resize(w, h)`. |
| `camera/scene-query.ts` | `createMeshSceneQuery(meshes: Object3D[])`: `pick` and `heightAt` via `Raycaster`. A single shared raycaster, so there is no per-frame allocation. |
| `camera/makieta.ts` | `MakietaMode` (wrapper or own implementation, depending on the spike), and an exported `MAKIETA_LIMITS` constants object. |
| `camera/makieta.test.ts` | The two behavioural tests (see verification). |
| `camera/fixtures.ts` (test-only, imported only by tests) | A small procedural heightfield mesh (seeded) as the relief fixture. It is never imported by `main.ts`. |
| `main.ts` | Builds the `SceneQuery` from `[ground]`, creates the rig and `MakietaMode`, and runs the on-demand rAF loop. Its initial pose matches today's view (looking at the origin from about 1.3 km). |

**Input:** `MakietaMode.attach(el)` registers `pointerdown/move/up` (with pointer capture),
`wheel` (`passive: false`, `preventDefault`) and `contextmenu` (prevented). `detach()` removes
all of them. That matters for the later mode switching.

**Decoupling:** the mode knows nothing about meshes or tiles, only `SceneQuery`. When tiles
arrive, only `createMeshSceneQuery`'s input changes (tile meshes, filtered to the ground
layer). `pipeline/` is not involved.

**Dependency (only if the wrapper is chosen):** `3d-tiles-renderer`, pinned to the exact
version in `app/package.json`. It is needed for tile streaming anyway. It must be compatible
with `three@0.187`; the spike checks the peer range.

## 📝 Edge Cases & Failure Scenarios

| Case | Behaviour |
|------|-----------|
| Cursor over the sky or off the plate at drag start | `pick` misses → grab on the y = 0 plane. If that also misses (looking up), the pan is clamped per event. |
| Drag leaves the window | Pointer capture keeps the drag. `pointerup` or `lostpointercapture` ends it and starts inertia. |
| Context menu on right-drag | Suppressed on the canvas only. |
| Trackpad pinch (`wheel` + `ctrlKey`) | Treated as zoom with the same normalization. Not tuned separately. |
| Tab backgrounded mid-inertia | `dt` clamp of 100 ms. The motion resumes without a jump. |
| Zoom at `DIST_MIN` over a steep slope | The clearance clamp wins over the zoom target. The camera stops above the surface instead of passing through. |
| Huge `dt` or NaN from a degenerate ray | The pose is rejected (non-finite check) and the previous pose is kept. |
| `heightAt` returns null (off the plate) | The clamp uses y = 0. |

## 📝 Risks & Impact Review

- **Library lock-in (wrapper path).** `EnvironmentControls`' behaviour becomes ours. If its
  height adjustment raycasts the whole scene, then labels or helpers added later could be hit.
  Mitigation: restrict raycasting to the ground layer, or keep our own clamp after its update.
  Swapping it out later stays cheap, because the camera is only reached through
  `CameraMode`.
- **Pick cost on real tiles.** A raycast against hundreds of tile meshes on every pointermove
  can cost frames. That is not visible on the plate. It is acceptable for now; the BVH or
  layer filter is a tile-streaming concern and is recorded here so it is not forgotten.
- **Feel constants.** Damping, zoom speed and limits are tuning, not contract. The tests
  assert invariants, not constants, so retuning does not break them.
- **Reversibility.** This is purely client-side with no persisted state or schema. Reverting
  the PR restores the fixed camera.

## 📋 Phasing

One phase, shippable on its own. Touch, fly-to and WASD are separate follow-up specs on the
same `CameraMode` contract.

## 📋 Implementation Plan

### Phase 1: makieta camera (mouse)

1. **Spike (timebox: half a day).** Install `3d-tiles-renderer` on a throwaway branch and
   drive `EnvironmentControls` against a private camera over the plate. Check (a)–(e). Fill
   in **Spike outcome** with the decision and the reason. If the wrapper loses, do not commit
   the dependency.
   *Verify:* the outcome is written down; `npm run verify` still passes.
2. **Interface, rig and scene query.** Add `mode.ts`, `rig.ts` and `scene-query.ts`. Switch
   `main.ts` to the rig with a static mode that returns today's pose, and add the on-demand
   rAF loop.
   *Verify:* `npm run verify`; `npm run dev` shows exactly today's view; resize re-renders.
3. **Relief fixture and the two tests, written first.** Add `fixtures.ts`, and add
   `makieta.test.ts` as `it.todo` against the `handle(input)` seam, so that
   `npm run verify` stays green. Step 4 turns the tests on.
   *Verify:* `npm run verify` passes and lists the two pending tests.
4. **`MakietaMode`.** Build pan, rotate/pitch, zoom to cursor, inertia and the clamp, using
   the path chosen in Step 1. Wire it in `main.ts`.
   *Verify:* both tests pass; `npm run verify`; the manual checks below.
5. **Settle and clean up.** The loop stops when motion settles; `detach` removes all
   listeners; the attribution is still visible.
   *Verify:* the manual checks below; `npm run verify`.

## 🧪 How this will be verified

**Automated (`npm run verify`: typecheck, lint, vitest, build), in `camera/makieta.test.ts`.
These are the only two tests, as agreed in the brief:**

1. **Never under terrain.** Over a seeded procedural heightfield fixture (about 200 m of
   relief), run a seeded sequence of 500 synthetic pan, rotate and zoom inputs, each followed
   by a few `update(dt)` steps with mixed dt (8–50 ms). After every update, assert
   `pose.position.y ≥ heightAt(x, z) + CLEARANCE − 1e-6`. The sequence must include
   max-zoom-in over a slope and max-pitch-down.
2. **Zoom to cursor.** Pick a point P at an off-centre NDC, apply wheel-in and wheel-out steps
   and let the inertia settle. Then project P with the posed camera and assert that its NDC
   moved by less than the equivalent of 2 px at 1920×1080.

The tests drive the mode through a thin `handle(input)` seam on `MakietaMode`. The DOM
listeners only translate events into calls on it. The seam is decided up front, so the tests
do not depend on the spike outcome. Vitest runs in its default
Node environment unless the wrapper needs a DOM, in which case only this test file uses the
`happy-dom` environment, added as a dev dependency. No test restates a constant.
Grab-pan, and the frame-rate independence of inertia (30 vs 144 fps), are checked manually:
the brief limits the automated tests to these two. The relief fixture is a test-only stand-in
for camera maths, not a pipeline sample. AGENTS.md's "real data only" rule covers pipeline
samples and tests, and the brief records this exception explicitly.

**Manual checks in `npm run dev` (desktop Chrome and Safari, mouse and trackpad):**

- [ ] Left-drag: a plate corner grabbed under the cursor stays under it while dragging.
- [ ] Release mid-drag: the plate coasts and stops. The Performance panel shows rAF idle after
      it settles.
- [ ] Right-drag and Alt+left-drag both rotate and pitch. Pitch stops near the horizon and
      near top-down. No context menu appears.
- [ ] Wheel over a plate corner: the corner stays under the cursor while zooming in and out.
      Wheel over the sky: zooms towards the target.
- [ ] Trackpad scroll and mouse wheel zoom at similar speeds.
- [ ] Aggressive zoom-in plus pitch-down at the plate edge: the camera can't go under the
      plate. Zoom-out stops at about 60 km.
- [ ] Grazing pan near the horizon: no jump to infinity.
- [ ] "Dane: GUGiK · © autorzy OpenStreetMap" is visible bottom right.
- [ ] A screen recording of the above is attached to the PR.
