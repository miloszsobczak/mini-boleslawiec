# Makieta camera (mouse) on the test plate, behind a common camera-mode interface

- Date: 2026-11-21
- Category: feature
- Priority signal: high — phase 1 (vertical slice) needs the makieta camera, and nothing in the viewer can be inspected without one
- Risk signal: medium — the controls maths is well known, but picking and terrain clamping have to keep working once real 3D Tiles replace the plate
- Routing: Next: om-auto-write-spec "Makieta camera (mouse) on the test plate behind a common camera-mode interface — brief: .ai/specs/briefs/2026-11-21-makieta-camera.md"

## Problem

`app/src/main.ts` draws a static 1 km² placeholder plate. The camera is fixed, and the scene only re-renders on resize. PRD 6 and 7.3 call for a tabletop ("makieta") camera: drag pans, the right button (or Alt) rotates and pitches, the wheel zooms to the point under the cursor, motion has inertia, and the camera never goes under the terrain. That camera has to sit behind a common camera-mode interface (input → position and orientation), so walking and drone modes can be added later without rebuilding the world. Phase 1 (PRD 10) needs this, and every later visual check (LOD popping, style, budgets) depends on it.

## Agreed direction

Build the mouse half of the makieta mode on the existing test plate. The pieces are:

- A minimal `CameraMode` interface: the mode receives input and a scene-query context, and each frame `update(dt)` returns a pose (position + orientation).
- A rig that owns the `THREE.PerspectiveCamera` and applies that pose.
- One implementation, `MakietaMode`.

Mode transitions are not built. The interface only has to allow them: the rig takes poses, so it can blend between them later.

The scene-query context provides the two things PRD 7.3 requires from the start:

- `pick(screenPoint) → point | null`, a raycast against the ground layer.
- `heightAt(x, z) → number | null`, a vertical raycast.

Today both are backed by the plate. Outside the plate they return null, and the mode falls back to the y = 0 plane. Later they will be backed by tiles.

**Implementation choice: decide with a timeboxed spike, which is the first step of the plan.** 3DTilesRendererJS is already the planned viewer stack (AGENTS.md). Its `EnvironmentControls` provides grab-pan, rotate, zoom to cursor, damping and surface-distance adjustment by raycasting the scene.

- **Preferred:** wrap `EnvironmentControls` inside `MakietaMode`. The mode drives the controls against a private camera and returns that camera's pose. The rig stays the only owner of the real camera.
- **Fallback:** an own implementation with orbit state (target, yaw, pitch, distance, velocities). Use it if the spike shows the wrapper can't meet the acceptance criteria below. Examples of failure: the controls insist on owning the real camera or the DOM in a way that breaks the pose contract, there is no right-button/Alt mapping, or damping is unacceptable.

Record the spike's outcome and reason in the spec or PR. Do not prototype both in full.

Keep the layering thin. Pointer and wheel handling lives inside the mode, or the controls it wraps. There is no separate input-intent layer until touch arrives.

**Rendering:** render on demand. The loop runs while there is input or inertia, and stops when motion settles. Resize still triggers a render.

**Rejected:**
- *Build nothing:* phase 1 explicitly needs this camera, and no other viewer work can be checked visually without it.
- *Plain three.js `MapControls` / `OrbitControls`:* they don't do grab-pan "point stays under the cursor", they have no terrain clamp, and they own the camera. If they had to be wrapped anyway, `EnvironmentControls` is the better-fitting thing to wrap.
- *Splitting zoom-to-cursor or inertia into later tasks:* these are the named behaviours of this task, and they are one capability. The cut is made elsewhere: touch, fly-to and WASD are deferred.

## Resolved unknowns

| Question | Answer |
|----------|--------|
| Which inputs are in this slice? | Mouse and wheel only: left-drag = pan; right-drag or Alt+left-drag = yaw and pitch around the point under the cursor or the orbit target; wheel = zoom. |
| Grab-pan semantics | The ground point grabbed at drag start stays under the cursor. Movement is in the horizontal plane at the grab point's height. |
| Grab-pan at grazing angles | When the cursor ray is near-parallel to the pan plane, or misses it, clamp the per-event pan distance to a multiple of the current camera distance. Never extrapolate to the horizon. |
| Zoom behaviour | Exponential (multiplicative) zoom toward the picked point. Normalize `deltaMode` (pixels vs lines) so a trackpad and a wheel feel alike. If nothing is picked (sky), zoom along the view direction toward the orbit target. |
| Inertia | Pan, rotate and zoom keep velocity after release and decay exponentially in real time (dt-based, independent of frame rate). |
| "Never under terrain" | After every update, camera y ≥ heightAt(camera x, z) + a clearance margin (a few metres). Zoom never passes through the picked surface: there is a minimum distance to it. |
| Pitch limits | Tunable constants. Start at about 5° above the horizon to about 89° (near top-down). The camera never looks up from below the ground. |
| Distance limits | Tunable constants: a minimum of a few metres, and a maximum of about 60 km. The county is about 1300 km², so about 40 km across, and L0 starts at more than 10 km. |
| Is this "real data only"? | The rule applies to pipeline samples and tests. The camera can be tested on the plate. A tiny procedural heightfield mesh is allowed as a unit-test fixture to check the clamp over relief. It must never be shipped in the app scene. |
| Which tests? | Only two kinds: (1) across a seeded sequence of pan/rotate/zoom inputs over a relief fixture, the camera never goes below heightAt + margin; (2) zoom-to-cursor keeps the picked world point at the same screen position, within a tolerance. No tests that restate the clamp constants. |
| Done means | In `npm run dev`: dragging moves the plate with the grabbed point under the cursor; right-drag and Alt-drag rotate and pitch; the wheel zooms toward the point under the cursor; motion coasts and stops; the camera can't be forced below the plate or past the pitch limits. `npm run verify` passes. The attribution "GUGiK, © autorzy OpenStreetMap" remains visible, or is added if missing. |

## Non-goals

- Touch gestures, double-click or double-tap fly-to, WASD. These are follow-up tasks. The pose contract must allow them, but no code is written for them now.
- Smooth transitions between modes, and walking or drone modes.
- Installing or streaming real 3D Tiles terrain. `3d-tiles-renderer` may be added as a dependency only if the spike picks the `EnvironmentControls` wrapper.
- World bounds or pan limits beyond the distance and pitch clamps.
- Labels, object picking or an inspector.

## Affected areas (if known)

- `app/src/main.ts`: today it renders once on resize with a fixed camera. The render loop and the camera wiring change here.
- New camera module(s) under `app/src/` for the mode interface, the rig, `MakietaMode` and the scene query.
