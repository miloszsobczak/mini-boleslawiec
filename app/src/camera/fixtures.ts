// Test-only: a stand-in relief for camera maths, never a pipeline sample and never imported
// by the app (spec "How this will be verified").
import { Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

/** mulberry32: small seeded PRNG, so fixtures and input sequences are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Square heightfield centred on the origin, heights in [0, relief] from seeded waves. */
export function createReliefMesh(seed: number, size = 3000, segments = 96, relief = 200): Mesh {
  const random = seededRandom(seed);
  const waves = Array.from({ length: 4 }, () => ({
    angle: random() * Math.PI * 2,
    length: 300 + random() * 900,
    phase: random() * Math.PI * 2,
    weight: 0.5 + random(),
  }));
  const geometry = new PlaneGeometry(size, size, segments, segments).rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position!;
  const raw: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    raw.push(
      waves.reduce((sum, w) => {
        const along = x * Math.cos(w.angle) + z * Math.sin(w.angle);
        return sum + w.weight * Math.sin((along / w.length) * Math.PI * 2 + w.phase);
      }, 0),
    );
  }
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  raw.forEach((h, i) => positions.setY(i, ((h - min) / (max - min)) * relief));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  return mesh;
}
