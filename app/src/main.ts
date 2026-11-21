import * as THREE from 'three';

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

const camera = new THREE.PerspectiveCamera(45, 1, 1, 100_000);
camera.position.set(600, 700, 900);
camera.lookAt(0, 0, 0);

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

window.addEventListener('resize', resize);
resize();
