import * as THREE from 'three';
import { MakietaMode } from './camera/makieta';
import { CameraRig } from './camera/rig';
import { createMeshSceneQuery } from './camera/scene-query';

// Scene units are metres, origin at the Rynek, Y up (PRD 9).
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe6e9);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8d99a6, 1.2));

const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(300, 500, 200);
scene.add(sun);

// Placeholder until the first tiles exist: a 1 km² ground plate.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000).rotateX(-Math.PI / 2),
  new THREE.MeshLambertMaterial({ color: 0xa8c686, flatShading: true }),
);
scene.add(ground);
ground.updateMatrixWorld();

const MAX_FRAME_SECONDS = 0.1;

const rig = new CameraRig(45, 1, 100_000);
const mode = new MakietaMode(createMeshSceneQuery([ground]), {
  position: new THREE.Vector3(600, 700, 900),
  target: new THREE.Vector3(0, 0, 0),
});
rig.setMode(mode);

// Render on demand: the loop runs while the mode is moving and stops once it settles.
let frameRequest = 0;
let lastTime: number | null = null;

function frame(time: number): void {
  frameRequest = 0;
  const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, MAX_FRAME_SECONDS);
  lastTime = time;
  const moving = rig.update(dt);
  renderer.render(scene, rig.camera);
  if (moving) frameRequest = requestAnimationFrame(frame);
  else lastTime = null;
}

function wake(): void {
  if (frameRequest === 0) frameRequest = requestAnimationFrame(frame);
}

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.resize(window.innerWidth, window.innerHeight);
  wake();
}

mode.attach(renderer.domElement, wake);
window.addEventListener('resize', resize);
resize();
