import { PerspectiveCamera } from 'three';
import type { CameraMode } from './mode';

/** Owns the single rendered camera and copies the active mode's pose onto it. */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  private mode: CameraMode | null = null;

  constructor(fov: number, near: number, far: number) {
    this.camera = new PerspectiveCamera(fov, 1, near, far);
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    mode.setProjection(this.projection());
  }

  /** Applies the mode's pose; returns whether another frame is needed. */
  update(dt: number): boolean {
    if (!this.mode) return false;
    const pose = this.mode.update(dt);
    this.camera.position.copy(pose.position);
    this.camera.quaternion.copy(pose.quaternion);
    this.camera.updateMatrixWorld();
    return this.mode.isMoving();
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.mode?.setProjection(this.projection());
  }

  private projection() {
    const { fov, aspect, near, far } = this.camera;
    return { fov, aspect, near, far };
  }
}
