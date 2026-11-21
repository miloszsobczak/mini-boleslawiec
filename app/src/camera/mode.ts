import type { Camera, Quaternion, Vector2, Vector3 } from 'three';

/** Position and orientation of the rendered camera, in scene metres (PRD 9). */
export interface CameraPose {
  position: Vector3;
  quaternion: Quaternion;
}

export interface CameraProjection {
  fov: number;
  aspect: number;
  near: number;
  far: number;
}

/**
 * What a camera mode may ask of the world. Backed by the plate today and by tile meshes
 * later; the signature stays the same (PRD 7.3).
 */
export interface SceneQuery {
  /** First ground hit under a screen point, or null when the ray misses. */
  pick(ndc: Vector2, camera: Camera): Vector3 | null;
  /** Ground height at a horizontal position, or null outside the ground. */
  heightAt(x: number, z: number): number | null;
}

/**
 * Common camera-mode interface (PRD 7.3): input in, pose out. The rig owns the real camera
 * and applies the pose, so a mode never mutates it.
 */
export interface CameraMode {
  /** Starts listening to input on `el`; `onInput` wakes the render loop. */
  attach(el: HTMLElement, onInput: () => void): void;
  detach(): void;
  setProjection(projection: CameraProjection): void;
  update(dt: number): CameraPose;
  /** True while input is held or motion has not settled. */
  isMoving(): boolean;
}
