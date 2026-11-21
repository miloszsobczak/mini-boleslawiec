# Pre-implement review: makieta camera (mouse) on the test plate

- Spec: `.ai/specs/2026-11-21-makieta-camera.md` (commit 6b64f54)
- Brief: `.ai/specs/briefs/2026-11-21-makieta-camera.md`
- Date: 2026-11-21
- **Verdict: conditional.** No Critical findings. Implementation can start once the items under "During implementation" are added to the plan.

## Blockers and next action

- There are no blockers.
- Next: `om-auto-implement-spec`. Fold the items under "During implementation" into Steps 1, 3 and 4.
- One decision belongs to the spec owner: A1 (does phase 1 stay open until touch, fly-to and WASD ship?). It does not change what this spec builds.

## Rules loaded

- `AGENTS.md`, `PRD.md` §6, §7.3, §8, §9 and §10.
- ⚠ The repo has no `BACKWARD_COMPATIBILITY.md`. I used the fallback surface list. `om-setup-agent-pipeline` can generate the file.
- The repo also has no `CODE_REVIEW.md`, spec template or `.ai/agentic.config.json`. I checked section completeness against the skill's default spec shape.

## Codebase grounding

I checked these against the code:

- `app/src/main.ts`: the fixed camera at (600, 700, 900), render only on `resize`, no input handling, and the `ground` 1000×1000 plate at y = 0 all match the spec.
- `app/index.html`: the attribution `Dane: GUGiK · © autorzy OpenStreetMap` is a `position: fixed` div. The canvas is not positioned, so the div paints on top. The spec's claim holds.
- `app/package.json`: `three ^0.187.0`. `3d-tiles-renderer` is not installed yet.
- I read the source of `3d-tiles-renderer@0.5.4` (latest on npm, from a tarball in a temp dir; nothing was installed into the repo):
  - The peer dependency is `three >=0.167.0`, so it is compatible with 0.187.
  - All the option names the spec marks as unverified exist. These are `enableDamping` (default false), `dampingFactor`, `minDistance`, `maxDistance`, `adjustHeight`, `cameraRadius`, `useFallbackPlane`/`fallbackPlane`, `setCamera`, `setScene`, `attach`, `detach`, `update(deltaTime)` and `getPivotPoint`. Pitch limits exist as `minAltitude`/`maxAltitude`.
  - The controls emit `start`, `change` and `end` events, so spike check (d) is likely met.
  - Damping is dt-based: `factor = 2^(−dt/dampingFactor)`. Spike check (c) is likely met.
  - **The default rotate mapping is right-click or Shift+left, not Alt+left.** Check (b) fails out of the box.
  - **`enableDoubleTapZoom` defaults to true**, which is a fly-to-like gesture. The controls also handle touch pinch and rotate by themselves.
  - Raycasting goes through an overridable `_raycast(raycaster)`, which does `intersectObject(scene)` plus the fallback plane. So check (e) can be backed by `SceneQuery` through a subclass, but `_raycast` is a private API.
  - The controls take input only from DOM pointer and wheel events, through their internal `PointerTracker`.

The spec does not mis-describe the codebase.

## Readiness gate

| Item | Result |
|------|--------|
| Declared status / open questions | Q1 and Q3 are resolved. Q2 carries `⚠ NEEDS HUMAN CONFIRMATION`. It is a phase-accounting question, not a build input (see A1). |
| Requirement → AC → step → test oracle | Met for 7 of 8 ACs. **Inertia "within 1 cm at 30 vs 144 fps" has only a manual oracle, and a person can't measure 1 cm by eye** (G2). |
| Contracts defined | `CameraMode`, `CameraPose`, `SceneQuery` and `CameraRig` are specified. The `handle(input)` seam's input type is not defined (G1). |
| Phases have exit gates | Yes. Every step has a *Verify* line. |
| Section completeness | TLDR, problem, solution, delta, architecture, edge cases, risks, phasing, plan and verification are all present. |

## Backward compatibility (fallback surface list)

| Surface | Touched? | Finding |
|---------|----------|---------|
| Exported TS API (`app/src/ids.ts`) | No | — |
| Tile format / index (shared with `pipeline/`) | No | — |
| Stable ids `bud-…` | No | — |
| Attribution (PRD 8, AGENTS.md) | Preserved | The spec adds a manual check. OK. |
| Routes, events, schema, CLI, config, persisted state | None exist | — |
| `npm run verify` / `npm run dev` commands | Unchanged | — |

There are no BC violations. This is greenfield client code and nothing is persisted, so the spec doesn't need a migration section.

## Repo-rule compliance

| Rule | Status |
|------|--------|
| Camera behind a common mode interface (AGENTS.md, PRD 7.3) | ✅ `CameraMode` + rig |
| Terrain-height query available from the start (PRD 7.3) | ✅ `SceneQuery.heightAt` |
| Smooth transitions between modes (PRD 7.3) | Deferred. The rig takes poses, so blending can be added later. Building transitions with a single mode would break AGENTS.md "no abstractions for out-of-scope modes". OK. |
| No walking camera or other modes | ✅ |
| Real data only (AGENTS.md: pipeline samples and tests; PRD 10: "Próbki zawsze na realnych danych GUGiK") | The procedural heightfield is a test-only fixture for camera maths, not a sample or a pipeline test. The brief records this explicitly. See A2. |
| Determinism | The fixture and the input sequence are seeded. There is no PRNG in the repo yet, so the step needs a small seeded one, not `Math.random` (G5). |
| Tests protect rules or real behaviour; no tests that restate constants | ✅ Two invariant tests |
| Performance budgets (PRD 8) | Raycasting on every pointermove against tiles is noted as a later concern. OK for the plate. |
| Do not widen the area before phase 1 | N/A |

## Gaps

| # | Severity | Gap | Fix |
|---|----------|-----|-----|
| G1 | Important | **The `handle(input)` test seam doesn't fit the wrapper path.** `EnvironmentControls` reads only DOM pointer and wheel events through `PointerTracker`, and it raycasts its own `scene`, not our `SceneQuery`. On the wrapper path, `handle()` would have to synthesize DOM events on a fake element, so the tests *do* depend on the spike outcome. That needs `happy-dom` plus pointer events, `getBoundingClientRect` and `setPointerCapture` stubs. | Define the `MakietaInput` type in Step 2: `{kind: 'pan'|'rotate'|'zoom', ndc, delta, phase}`. Add spike check (f): "the wrapper can be driven headlessly from `MakietaInput` in Vitest". If (f) fails, the wrapper loses. |
| G2 | Important | **Frame-rate independence has no usable oracle.** "Same rest pose within 1 cm at 30 vs 144 fps" is checked only manually. On the fallback path, `v *= exp(−k·dt)` with explicit `x += v·dt` is *not* exactly frame-rate independent. The integration error depends on dt, and over a fast pan of hundreds of metres it exceeds 1 cm. | Either integrate analytically (`x += v·(1−e^(−k·dt))/k`, then `v *= e^(−k·dt)`), or loosen the criterion. Strongly recommended: add the 30-vs-144-fps rest-pose comparison as a third assertion inside test 1's harness. It protects a real behaviour, and the brief's "only two tests" limit can stay if it is a case inside the existing test file. That is an owner call (A3). |
| G3 | Important | **On the wrapper path, the Alt+left rotate mapping needs a workaround.** The library maps rotate to Shift+left. | In the wrapper, rewrite the `pointerdown` `shiftKey` from `altKey` in a capture-phase listener, or subclass. Record which in Spike outcome. Note that Shift+left would also rotate unless it is suppressed. Q3 says Shift is "ignored", so suppress it. |
| G4 | Important | **On the wrapper path, out-of-scope gestures ship silently.** `enableDoubleTapZoom` defaults to true (fly-to-like), and touch pinch and rotate are active. The spec's non-goals say no code for touch or fly-to. | Set `enableDoubleTapZoom = false`. Either disable touch explicitly, or record that "touch works incidentally, untested, not claimed". Owner call (A4). |
| G5 | Nice-to-have | No seeded PRNG exists. | Add a tiny seeded PRNG (e.g. mulberry32) in the test fixture file. |
| G6 | Nice-to-have | Safari desktop trackpad pinch fires non-standard `gesturestart`/`gesturechange` events, not `wheel` + `ctrlKey`. The edge-case row "trackpad pinch = wheel + ctrlKey" holds in Chrome and Firefox only. In Safari the pinch may zoom the page. | `preventDefault` on `gesturestart`/`gesturechange` on the canvas (Safari only), or accept and note it. The manual check list includes Safari. |
| G7 | Nice-to-have | `PITCH_MIN ≈ 5°` vs the library's `minAltitude` default of 0. `DIST_MIN ≈ 5 m` vs the library's `minDistance` of 10 and `cameraRadius` of 5. | Set them explicitly from `MAKIETA_LIMITS` on the wrapper path. |
| G8 | Nice-to-have | Depth precision. The camera has `near = 1` and `far = 100 000`, and zoom goes out to 60 km. That is fine for a flat plate, but z-fighting will show up on tiles. | Out of scope. Note it for the tile-streaming spec (logarithmic depth buffer or a dynamic `near`). |

## Risks

| Risk | Level | Mitigation |
|------|-------|-----------|
| The wrapper depends on the private `_raycast` override to route through `SceneQuery`, so a library update can break it silently. | Medium | Pin the exact version (`0.5.4` or the current one at spike time). Keep our own post-update clearance clamp as the authority. Test 1 runs against the real wrapper, so a regression fails `verify`. |
| The spike runs past its half-day timebox, given G1/G3/G4. | Medium | Treat check (f), headless drivability, as a hard gate. If any of (a), (b) via workaround, or (f) fails within the timebox, take the fallback path. |
| Euler integration breaks frame-rate independence (fallback path). | Medium | Use analytic integration (G2). |
| Raycast cost on real tiles. | Low (now) | Already recorded in the spec. |
| Feel constants need retuning. | Low | The tests assert invariants only. |

## Assumptions needing human confirmation

| # | Assumption | Risk | Why |
|---|-----------|------|-----|
| A1 | PRD 10 phase 1 lists "kamera makiety (mysz i dotyk)", and PRD 6 lists double-click fly-to and WASD. This spec delivers the mouse half only. **Phase 1 stays open until touch, fly-to and WASD ship as follow-ups on the same `CameraMode`.** (spec Q2) | **Medium** | AGENTS.md says "when a task conflicts with the PRD, stop and say so". The spec has said so. It is a scoping slice, not a contradiction, as long as nobody marks phase 1 done on this spec. |
| A2 | A seeded procedural heightfield is acceptable as a **unit-test fixture for camera maths**, despite PRD 10's "Próbki zawsze na realnych danych GUGiK". | **Medium** | AGENTS.md scopes the rule to "samples and tests of the pipeline", and the brief records the exception. The PRD wording is broader. The fixture must never be imported by `main.ts`. |
| A3 | Frame-rate independence of inertia can be checked manually only. Or should it become an assertion in the existing test file? (see G2) | **Medium** | Without it, the 1 cm criterion can't be verified, and a regression goes unnoticed. |
| A4 | If the wrapper is chosen, do touch gestures the library provides for free stay on (untested, not claimed) or get disabled? Is double-tap zoom disabled? | Low | It affects the non-goal wording and what the PR claims. It doesn't change the design. |
| A5 | Q3: Shift and Ctrl are ignored, and any rotate trigger means rotate. On the wrapper path, Shift+left must be actively suppressed. | Low | This is a small surface either way. |
| A6 | Initial pose "looking at the origin from about 1.3 km" (today: √(600²+700²+900²) ≈ 1.29 km). PRD 6.1 says the start shows the whole county. | Low | There is no county data yet, so keeping today's view is right for the plate. The start pose becomes a tile-era decision. |
| A7 | Limits: pitch 5°–89°, distance 5 m – 60 km, clearance about 2 m, dt clamp 100 ms. | Low | These are tuning values, not contract. The tests don't restate them. |

## During implementation (conditions for "conditional")

1. Step 1 spike: add check (f), headless drivability from `MakietaInput` (G1). Map Alt+left to rotate and suppress Shift+left (G3). Disable double-tap zoom and decide about touch (G4). Set the limits explicitly (G7). Pin the exact version.
2. Step 2: define the `MakietaInput` type for the `handle(input)` seam.
3. Step 4, fallback path: integrate inertia analytically (G2).
4. Step 3: add a seeded PRNG (G5). Optionally add the 30-vs-144-fps rest-pose case if the owner agrees (A3).
5. Optional: suppress Safari `gesture*` events on the canvas (G6).
