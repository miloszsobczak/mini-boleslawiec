import { Euler, MathUtils, PerspectiveCamera, Plane, Quaternion, Raycaster, Vector2, Vector3 } from 'three';
import type { CameraMode, CameraPose, CameraProjection, SceneQuery } from './mode';

/** Hard limits of the tabletop camera. Tuning values, not contract (spec "Feel constants"). */
export const MAKIETA_LIMITS = {
  pitchMin: MathUtils.degToRad(5),
  pitchMax: MathUtils.degToRad(89),
  distanceMin: 5,
  distanceMax: 60_000,
  /** Minimum height of the camera above the ground under it, in metres. */
  clearance: 2,
  /** Largest pan per pointer event, as a fraction of the camera distance. */
  panClamp: 0.5,
};

const TUNING = {
  panDamping: 5,
  rotateDamping: 6,
  zoomDamping: 8,
  rotatePerNdc: Math.PI / 2,
  zoomLogPerPx: 0.0015,
  velocitySmoothing: 0.04,
  restSpeed: 1e-5,
};

const WHEEL_PX_PER_LINE = 16;
const WHEEL_PX_PER_PAGE = 800;

export type MakietaDragKind = 'pan' | 'rotate';

/** Device-independent input: the DOM listeners only translate events into these. */
export type MakietaInput =
  | { kind: MakietaDragKind; phase: 'start' | 'move' | 'end'; ndc: Vector2 }
  | { kind: 'zoom'; ndc: Vector2; deltaPx: number };

export interface MakietaStart {
  position: Vector3;
  target: Vector3;
}

interface Drag {
  kind: MakietaDragKind;
  ndc: Vector2;
  planeY: number;
}

const UP = new Vector3(0, 1, 0);

/**
 * Tabletop camera (PRD 6): orbit state `target`, `yaw`, `pitch`, `distance`, with
 * exponentially decaying velocities integrated analytically, so the rest pose does not
 * depend on the frame rate.
 */
export class MakietaMode implements CameraMode {
  private readonly target = new Vector3();
  private yaw = 0;
  private pitch = 0;
  private distance = 1;

  private readonly panVelocity = new Vector3();
  private yawVelocity = 0;
  private pitchVelocity = 0;
  private zoomVelocity = 0;

  private readonly panSinceUpdate = new Vector3();
  private yawSinceUpdate = 0;
  private pitchSinceUpdate = 0;

  private readonly pivot = new Vector3();
  private readonly zoomAnchor = new Vector3();
  private drag: Drag | null = null;

  private readonly camera = new PerspectiveCamera();
  private readonly raycaster = new Raycaster();
  private readonly plane = new Plane(UP.clone(), 0);
  private readonly pose: CameraPose = { position: new Vector3(), quaternion: new Quaternion() };
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private readonly scratch = { a: new Vector3(), b: new Vector3(), q: new Quaternion(), q2: new Quaternion() };
  private detachListeners: (() => void) | null = null;

  constructor(
    private readonly query: SceneQuery,
    start: MakietaStart,
  ) {
    const offset = start.position.clone().sub(start.target);
    this.target.copy(start.target);
    this.distance = MathUtils.clamp(offset.length(), MAKIETA_LIMITS.distanceMin, MAKIETA_LIMITS.distanceMax);
    this.yaw = Math.atan2(offset.x, offset.z);
    this.pitch = MathUtils.clamp(
      Math.asin(offset.y / offset.length()),
      MAKIETA_LIMITS.pitchMin,
      MAKIETA_LIMITS.pitchMax,
    );
    this.syncCamera();
  }

  setProjection({ fov, aspect, near, far }: CameraProjection): void {
    Object.assign(this.camera, { fov, aspect, near, far });
    this.camera.updateProjectionMatrix();
  }

  isMoving(): boolean {
    return (
      this.drag !== null ||
      this.panVelocity.lengthSq() > 0 ||
      this.yawVelocity !== 0 ||
      this.pitchVelocity !== 0 ||
      this.zoomVelocity !== 0
    );
  }

  handle(input: MakietaInput): void {
    if (input.kind === 'zoom') {
      this.zoomAnchor.copy(this.groundUnder(input.ndc) ?? this.target);
      this.zoomVelocity += TUNING.zoomDamping * input.deltaPx * TUNING.zoomLogPerPx;
      return;
    }
    if (input.phase === 'start') {
      this.stopMotion();
      const ground = this.groundUnder(input.ndc);
      if (input.kind === 'rotate') this.pivot.copy(ground ?? this.target);
      this.drag = { kind: input.kind, ndc: input.ndc.clone(), planeY: ground?.y ?? this.target.y };
      return;
    }
    const drag = this.drag;
    if (!drag || drag.kind !== input.kind) return;
    if (input.phase === 'end') {
      this.drag = null;
      return;
    }
    if (drag.kind === 'pan') this.panBetween(drag.ndc, input.ndc, drag.planeY);
    else this.rotateBy(input.ndc.x - drag.ndc.x, input.ndc.y - drag.ndc.y);
    drag.ndc.copy(input.ndc);
  }

  update(dt: number): CameraPose {
    const saved = { target: this.target.clone(), yaw: this.yaw, pitch: this.pitch, distance: this.distance };

    if (dt > 0) {
      if (this.drag) this.estimateDragVelocity(dt);
      else this.coast(dt);
      this.coastZoom(dt);
    }
    this.settle();
    this.keepAboveGround();

    const state = [this.target.x, this.target.y, this.target.z, this.yaw, this.pitch, this.distance];
    if (!state.every(Number.isFinite)) {
      this.target.copy(saved.target);
      this.yaw = saved.yaw;
      this.pitch = saved.pitch;
      this.distance = saved.distance;
      this.stopMotion();
    }

    this.syncCamera();
    this.pose.position.copy(this.camera.position);
    this.pose.quaternion.copy(this.camera.quaternion);
    return this.pose;
  }

  attach(el: HTMLElement, onInput: () => void): void {
    this.detach();
    let pointerId: number | null = null;
    const ndcOf = (e: MouseEvent): Vector2 => {
      const r = el.getBoundingClientRect();
      return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };

    const down = (e: PointerEvent) => {
      if (pointerId !== null) return;
      const kind: MakietaDragKind | null =
        e.button === 2 || (e.button === 0 && e.altKey) ? 'rotate' : e.button === 0 ? 'pan' : null;
      if (!kind) return;
      pointerId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      this.handle({ kind, phase: 'start', ndc: ndcOf(e) });
      onInput();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId || !this.drag) return;
      this.handle({ kind: this.drag.kind, phase: 'move', ndc: ndcOf(e) });
      onInput();
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (this.drag) this.handle({ kind: this.drag.kind, phase: 'end', ndc: ndcOf(e) });
      onInput();
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const scale = e.deltaMode === 1 ? WHEEL_PX_PER_LINE : e.deltaMode === 2 ? WHEEL_PX_PER_PAGE : 1;
      this.handle({ kind: 'zoom', ndc: ndcOf(e), deltaPx: e.deltaY * scale });
      onInput();
    };
    const prevent = (e: Event) => e.preventDefault();

    const listeners: [string, EventListener, AddEventListenerOptions?][] = [
      ['pointerdown', down as EventListener],
      ['pointermove', move as EventListener],
      ['pointerup', end as EventListener],
      ['pointercancel', end as EventListener],
      ['lostpointercapture', end as EventListener],
      ['wheel', wheel as EventListener, { passive: false }],
      ['contextmenu', prevent],
      // Safari reports trackpad pinch as gesture events; keep it from zooming the page.
      ['gesturestart', prevent],
      ['gesturechange', prevent],
    ];
    for (const [type, fn, options] of listeners) el.addEventListener(type, fn, options);
    this.detachListeners = () => {
      for (const [type, fn, options] of listeners) el.removeEventListener(type, fn, options);
    };
  }

  detach(): void {
    this.detachListeners?.();
    this.detachListeners = null;
    this.drag = null;
  }

  private panBetween(from: Vector2, to: Vector2, planeY: number): void {
    const { a, b } = this.scratch;
    if (!this.planeHit(from, planeY, a) || !this.planeHit(to, planeY, b)) return;
    const delta = a.sub(b).setY(0);
    const limit = MAKIETA_LIMITS.panClamp * this.distance;
    if (delta.length() > limit) delta.setLength(limit);
    this.target.add(delta);
    this.panSinceUpdate.add(delta);
  }

  private rotateBy(dx: number, dy: number): void {
    const applied = this.rotateAroundPivot(-dx * TUNING.rotatePerNdc, -dy * TUNING.rotatePerNdc);
    this.yawSinceUpdate += applied.yaw;
    this.pitchSinceUpdate += applied.pitch;
  }

  /** Rigid rotation of camera and target around the vertical through the pivot, plus pitch. */
  private rotateAroundPivot(dYaw: number, dPitch: number): { yaw: number; pitch: number; pitchLimited: boolean } {
    const wanted = this.pitch + dPitch;
    const pitch = MathUtils.clamp(wanted, MAKIETA_LIMITS.pitchMin, MAKIETA_LIMITS.pitchMax);
    const yaw = this.yaw + dYaw;
    const applied = { yaw: dYaw, pitch: pitch - this.pitch, pitchLimited: pitch !== wanted };
    const { q, q2, a } = this.scratch;
    q.copy(this.orientation(yaw, pitch, q)).multiply(this.orientation(this.yaw, this.pitch, q2).invert());
    this.target.copy(a.copy(this.target).sub(this.pivot).applyQuaternion(q).add(this.pivot));
    this.yaw = yaw;
    this.pitch = pitch;
    return applied;
  }

  /** Homothety around the zoom anchor; returns false when a distance limit stopped it. */
  private zoomBy(logStep: number): boolean {
    const wanted = Math.exp(logStep);
    const toAnchor = this.position(this.scratch.a).distanceTo(this.zoomAnchor);
    let s = wanted;
    if (s < 1) {
      const sMin = Math.max(MAKIETA_LIMITS.distanceMin / this.distance, MAKIETA_LIMITS.distanceMin / toAnchor);
      s = Math.max(s, Math.min(1, sMin));
    } else {
      s = Math.min(s, Math.max(1, MAKIETA_LIMITS.distanceMax / this.distance));
    }
    this.target.sub(this.zoomAnchor).multiplyScalar(s).add(this.zoomAnchor);
    this.distance *= s;
    return s === wanted;
  }

  private estimateDragVelocity(dt: number): void {
    const blend = 1 - Math.exp(-dt / TUNING.velocitySmoothing);
    this.panVelocity.lerp(this.panSinceUpdate.divideScalar(dt), blend);
    this.yawVelocity += (this.yawSinceUpdate / dt - this.yawVelocity) * blend;
    this.pitchVelocity += (this.pitchSinceUpdate / dt - this.pitchVelocity) * blend;
    this.panSinceUpdate.set(0, 0, 0);
    this.yawSinceUpdate = 0;
    this.pitchSinceUpdate = 0;
  }

  /** Exact integral of v·e^(−k·t) over one step, then the decay of v itself. */
  private coast(dt: number): void {
    const pan = decay(TUNING.panDamping, dt);
    this.target.addScaledVector(this.panVelocity, pan.travel);
    this.panVelocity.multiplyScalar(pan.factor);

    const rot = decay(TUNING.rotateDamping, dt);
    const applied = this.rotateAroundPivot(this.yawVelocity * rot.travel, this.pitchVelocity * rot.travel);
    this.yawVelocity *= rot.factor;
    this.pitchVelocity = applied.pitchLimited ? 0 : this.pitchVelocity * rot.factor;
  }

  private coastZoom(dt: number): void {
    if (this.zoomVelocity === 0) return;
    const zoom = decay(TUNING.zoomDamping, dt);
    const free = this.zoomBy(this.zoomVelocity * zoom.travel);
    this.zoomVelocity = free ? this.zoomVelocity * zoom.factor : 0;
  }

  private settle(): void {
    if (this.drag) return;
    if (this.panVelocity.length() < TUNING.restSpeed * this.distance) this.panVelocity.set(0, 0, 0);
    if (Math.abs(this.yawVelocity) < TUNING.restSpeed) this.yawVelocity = 0;
    if (Math.abs(this.pitchVelocity) < TUNING.restSpeed) this.pitchVelocity = 0;
    if (Math.abs(this.zoomVelocity) < TUNING.restSpeed) this.zoomVelocity = 0;
  }

  /** Lifts camera and target together, so the view direction is kept. */
  private keepAboveGround(): void {
    const camera = this.position(this.scratch.a);
    const floor = (this.query.heightAt(camera.x, camera.z) ?? 0) + MAKIETA_LIMITS.clearance;
    if (camera.y < floor) this.target.y += floor - camera.y;
  }

  private stopMotion(): void {
    this.panVelocity.set(0, 0, 0);
    this.panSinceUpdate.set(0, 0, 0);
    this.yawVelocity = this.pitchVelocity = this.zoomVelocity = 0;
    this.yawSinceUpdate = this.pitchSinceUpdate = 0;
  }

  /** Ground under a screen point: scene first, then the y = 0 plane, null over the sky. */
  private groundUnder(ndc: Vector2): Vector3 | null {
    this.syncCamera();
    const hit = this.query.pick(ndc, this.camera) ?? this.planeHit(ndc, 0, new Vector3());
    if (!hit || hit.distanceTo(this.camera.position) > MAKIETA_LIMITS.distanceMax) return null;
    return hit;
  }

  private planeHit(ndc: Vector2, y: number, out: Vector3): Vector3 | null {
    this.syncCamera();
    this.raycaster.setFromCamera(ndc, this.camera);
    this.plane.constant = -y;
    return this.raycaster.ray.intersectPlane(this.plane, out);
  }

  private orientation(yaw: number, pitch: number, out: Quaternion): Quaternion {
    return out.setFromEuler(this.euler.set(-pitch, yaw, 0));
  }

  private position(out: Vector3): Vector3 {
    const horizontal = Math.cos(this.pitch) * this.distance;
    return out
      .set(Math.sin(this.yaw) * horizontal, Math.sin(this.pitch) * this.distance, Math.cos(this.yaw) * horizontal)
      .add(this.target);
  }

  private syncCamera(): void {
    this.position(this.camera.position);
    this.orientation(this.yaw, this.pitch, this.camera.quaternion);
    this.camera.updateMatrixWorld(true);
  }
}

function decay(rate: number, dt: number): { factor: number; travel: number } {
  const factor = Math.exp(-rate * dt);
  return { factor, travel: (1 - factor) / rate };
}
