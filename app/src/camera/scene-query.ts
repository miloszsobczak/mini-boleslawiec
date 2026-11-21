import { Raycaster, Vector3, type Camera, type Object3D, type Vector2 } from 'three';
import type { SceneQuery } from './mode';

const ABOVE_EVERYTHING = 1e6;
const DOWN = new Vector3(0, -1, 0);

/** Ground queries by raycasting `meshes` (the plate now, ground-layer tile meshes later). */
export function createMeshSceneQuery(meshes: Object3D[]): SceneQuery {
  const raycaster = new Raycaster();
  const origin = new Vector3();

  return {
    pick(ndc: Vector2, camera: Camera): Vector3 | null {
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(meshes, true)[0];
      return hit ? hit.point.clone() : null;
    },
    heightAt(x: number, z: number): number | null {
      raycaster.set(origin.set(x, ABOVE_EVERYTHING, z), DOWN);
      const hit = raycaster.intersectObjects(meshes, true)[0];
      return hit ? hit.point.y : null;
    },
  };
}
