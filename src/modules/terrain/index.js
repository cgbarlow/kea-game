// terrain — the alpine pass around the car park: flat bench for apron + road, scree slope rising north to the range,
// beech-forest slope south, the slip mound across SH73 in the east, a boundary berm, beech trees, tussock, slip rocks,
// and the far field (backdrop/farfield.js wilderness rings in the shared fog).
//   create(G, { mats }) → { group, heightAt(x,z), normalAt(x,z,out), farfield, update, dispose }
//   showcase(G) → { cam, target }
import { Group, MeshStandardMaterial, DoubleSide, Color } from 'three';
import { terrain, erodedHeight, patchTerrainTint } from '../../cookbook/geo/sdf-terrain.js';
import { scatter, poissonDisk, rockGeo, treeGeo, leafTexture, foliagePatch, grassTuftGeo } from '../../cookbook/geo/scatter.js';
import { rngFrom } from '../../cookbook/geo/noise.js';
import { createFarfield, FARFIELD_PRESETS } from '../../cookbook/backdrop/farfield.js';
import { LAYOUT as L, SEED } from '../../contracts.js';

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function heightFn() {
  const n = erodedHeight({ seed: SEED, amp: 9, freq: 0.012, octaves: 6, ridge: 0.4, ridgeFreq: 0.02, detail: 0.3 });
  const S = L.slip;
  return (x, z) => {
    // distance outside the flat bench (apron + road), metres
    const dz = z < -27 ? -27 - z : z > 19 ? z - 19 : 0;
    const dx = Math.max(0, Math.abs(x) - 95);
    const d = Math.hypot(dx, dz);
    const edge = sstep(0, 6, d);
    let h = -0.06 + edge * (Math.abs(n(x, z)) * 0.6 + 0.4);
    if (z < -27) { const u = -27 - z; h += u * 0.32 + Math.max(0, u - 25) * 0.5 + Math.abs(n(x * 0.6, z * 0.6)) * sstep(0, 30, u) * 1.4; } // scree benches to the range
    if (z > 19) h += (z - 19) * 0.22 + Math.max(0, z - 50) * 0.3;  // forest slope south
    // the slip: a lobe of debris across the road, falling from the north
    const sx = (x - S.x) / S.r, sz = (z - S.z) / (S.r * 1.3);
    const s = Math.exp(-(sx * sx + sz * sz) * 1.6);
    h += s * S.h * (0.85 + 0.15 * n(x * 3, z * 3) / 9);
    return h;
  };
}

export function create(G, { mats }) {
  const group = new Group(); group.name = 'terrain';
  const fn = heightFn();
  const mat = mats.terrain;
  patchTerrainTint(mat, { grass: [0.20, 0.15, 0.06], dry: [0.26, 0.21, 0.13], rock: [0.19, 0.19, 0.20], slope: [0.35, 0.6], scale: 0.05, amount: 0.8 });
  const T = terrain({ size: 420, res: G.quality.tier === 'low' ? 2 : 1, fn, cells: 6, material: mat });
  for (const m of T.meshes) { m.receiveShadow = true; m.castShadow = true; }
  group.add(T.group);

  const rng = rngFrom(SEED + 1);
  // beech forest (south slope) — trunk + leaf parts share transforms
  const leafMat = new MeshStandardMaterial({ map: leafTexture({ seed: 11, kind: 'broad' }), alphaTest: 0.45, side: DoubleSide, vertexColors: true, roughness: 0.8, color: new Color(0.55, 0.62, 0.42) });
  foliagePatch(leafMat, { trans: 0.3 });
  const trunkMat = mats.bark;
  const tg = treeGeo({ seed: 4, height: 14, trunkR: 0.35, branches: 10, leafSize: 1.4, density: 1.1 });
  const treePts = poissonDisk({ x0: -110, z0: 22, w: 220, h: 60, r: 4.2, rng });
  group.add(scatter(G, { parts: [{ geo: tg.trunk, material: trunkMat }, { geo: tg.leaves, material: leafMat }], points: treePts,
    heightAt: T.heightAt, normalAt: T.normalAt, scale: [0.7, 1.25], sink: 0.3, align: 0.1, fade: [140, 200], cell: 30, seed: SEED + 2,
    tint: { color: 0xffffff, l: 0.1, h: 0.03 }, sway: { amp: 0.04, freq: 1.2, power: 1.5, height: 14 } }).group);

  // slip debris + scree rocks
  const rockPts = poissonDisk({ x0: L.slip.x - 22, z0: L.slip.z - 26, w: 44, h: 40, r: 1.6, rng,
    accept: (x, z) => fn(x, z) > 0.6 });
  group.add(scatter(G, { parts: [{ geo: rockGeo({ seed: 5, radius: 0.8 }), material: mats.rock }], points: rockPts,
    heightAt: T.heightAt, normalAt: T.normalAt, scale: [0.3, 1.8], align: 0.5, sink: 0.25, seed: SEED + 3, fade: [160, 220] }).group);
  const screePts = poissonDisk({ x0: -120, z0: -70, w: 240, h: 40, r: 3.5, rng });
  group.add(scatter(G, { parts: [{ geo: rockGeo({ seed: 9, radius: 1.0 }), material: mats.rock }], points: screePts,
    heightAt: T.heightAt, normalAt: T.normalAt, scale: [0.4, 2.2], align: 0.6, sink: 0.3, seed: SEED + 4, fade: [160, 220] }).group);

  // tussock on the verges (not on the sealed bench)
  const tussMat = new MeshStandardMaterial({ side: DoubleSide, vertexColors: true, roughness: 0.9, color: new Color(0.42, 0.33, 0.14) });
  foliagePatch(tussMat, { trans: 0.2 });
  const tussPts = poissonDisk({ x0: -90, z0: -45, w: 180, h: 90, r: 1.3, rng,
    accept: (x, z) => (z < -25 || z > 18.5 || Math.abs(x) > 93) && fn(x, z) < 12 });
  group.add(scatter(G, { parts: [{ geo: grassTuftGeo({ seed: 2, blades: 14, h: 0.6, w: 0.03, spread: 0.22 }), material: tussMat }], points: tussPts,
    heightAt: T.heightAt, normalAt: T.normalAt, scale: [0.6, 1.4], align: 0.4, seed: SEED + 5, shadow: false, fade: [50, 80, 1.8],
    sway: { amp: 0.08, freq: 1.8, power: 2, height: 0.6, flutter: 0.3 } }).group);

  G.scene.add(group);
  const farfield = createFarfield(G, { layers: FARFIELD_PRESETS.wilderness });
  return { group, heightAt: T.heightAt, normalAt: T.normalAt, farfield, update() {}, dispose() { G.scene.remove(group); } };
}

export function showcase() { return { cam: [40, 8, 6], target: [50, 3, -19] }; }
