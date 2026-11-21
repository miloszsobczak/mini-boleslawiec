import { PerspectiveCamera, Vector2, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createReliefMesh, seededRandom } from './fixtures';
import { MAKIETA_LIMITS, MakietaMode, type MakietaInput } from './makieta';
import type { CameraPose } from './mode';
import { createMeshSceneQuery } from './scene-query';

const PROJECTION = { fov: 45, aspect: 1920 / 1080, near: 1, far: 100_000 };
const START = { position: new Vector3(600, 800, 900), target: new Vector3(0, 100, 0) };

function setup() {
  const query = createMeshSceneQuery([createReliefMesh(2180)]);
  const mode = new MakietaMode(query, START);
  mode.setProjection(PROJECTION);
  return { query, mode };
}

function settle(mode: MakietaMode, dt = 1 / 60): CameraPose {
  let pose = mode.update(dt);
  for (let i = 0; i < 10_000 && mode.isMoving(); i++) pose = mode.update(dt);
  expect(mode.isMoving()).toBe(false);
  return pose;
}

describe('makieta camera', () => {
  it('never goes under the terrain', () => {
    const { query, mode } = setup();
    const random = seededRandom(7);
    let lowest = Infinity;

    const send = (input: MakietaInput) => {
      mode.handle(input);
      const updates = 1 + Math.floor(random() * 3);
      for (let i = 0; i < updates; i++) {
        const { position } = mode.update(0.008 + random() * 0.042);
        const floor = (query.heightAt(position.x, position.z) ?? 0) + MAKIETA_LIMITS.clearance;
        lowest = Math.min(lowest, position.y - floor);
      }
    };
    const drag = (kind: 'pan' | 'rotate', path: Vector2[]) => {
      path.forEach((ndc, i) => send({ kind, phase: i === 0 ? 'start' : 'move', ndc }));
      send({ kind, phase: 'end', ndc: path[path.length - 1]! });
      return path.length + 1;
    };
    const vertical = (from: number, to: number) =>
      Array.from({ length: 6 }, (_, i) => new Vector2(0, from + ((to - from) * i) / 5));
    const zoomIn = (ndc: Vector2, steps: number) => {
      for (let i = 0; i < steps; i++) send({ kind: 'zoom', ndc, deltaPx: -400 });
      return steps;
    };

    // Max pitch down, then max zoom-in onto the slope under an off-centre point.
    let events = drag('rotate', vertical(0.9, -0.9)) + drag('rotate', vertical(0.9, -0.9));
    events += zoomIn(new Vector2(0.3, -0.2), 30);
    // Grazing view, then zoom into a slope again.
    events += drag('rotate', vertical(-0.9, 0.9)) + drag('rotate', vertical(-0.9, 0.9));
    events += zoomIn(new Vector2(-0.2, -0.4), 30);

    const point = () => new Vector2(random() * 2 - 1, random() * 2 - 1);
    while (events < 500) {
      const pick = random();
      if (pick < 0.35) {
        const path = [point()];
        for (let i = 0; i < 4; i++) path.push(path[i]!.clone().add(new Vector2(random() - 0.5, random() - 0.5)));
        events += drag(pick < 0.2 ? 'pan' : 'rotate', path);
      } else {
        send({ kind: 'zoom', ndc: point(), deltaPx: (random() - 0.6) * 1200 });
        events++;
      }
    }

    expect(lowest).toBeGreaterThanOrEqual(-1e-6);
    // The sequence must actually have pressed the camera against the ground.
    expect(lowest).toBeLessThan(0.01);
  });

  it('keeps the point under the cursor in place while zooming', () => {
    const { query, mode } = setup();
    const camera = new PerspectiveCamera(PROJECTION.fov, PROJECTION.aspect, PROJECTION.near, PROJECTION.far);
    const place = (pose: CameraPose) => {
      camera.position.copy(pose.position);
      camera.quaternion.copy(pose.quaternion);
      camera.updateMatrixWorld(true);
    };

    const cursor = new Vector2(0.45, -0.35);
    place(mode.update(0));
    const target = query.pick(cursor, camera)!;
    expect(target).not.toBeNull();
    const startDistance = camera.position.distanceTo(target);

    const wheel = (deltaPx: number, times: number) => {
      for (let i = 0; i < times; i++) {
        mode.handle({ kind: 'zoom', ndc: cursor, deltaPx });
        mode.update(1 / 60);
      }
      place(settle(mode));
    };

    wheel(-120, 6);
    const zoomedDistance = camera.position.distanceTo(target);
    wheel(80, 4);
    expect(zoomedDistance).toBeLessThan(startDistance * 0.5);

    const onScreen = target.clone().project(camera);
    const offsetPx = Math.hypot(((onScreen.x - cursor.x) * 1920) / 2, ((onScreen.y - cursor.y) * 1080) / 2);
    expect(offsetPx).toBeLessThan(2);
  });
});
