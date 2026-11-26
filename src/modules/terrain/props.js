// terrain/props — ground dressing: the slip (1-3 m boulders, broken rock, snapped beech trunks with root plates),
// scree talus on the north toe and gully fans, a few erratics up the slope, tussock on the verges and valley floor.
//   createProps(G, { T, fn, mats, bark }) → { group, far, tris, calls }
// group = near things that show in the puddle reflection; far = small scatter hidden from the reflection pass.
import { Group, MeshStandardMaterial, DoubleSide, Color } from 'three';
import { scatter, poissonDisk, rockGeo, grassTuftGeo, foliagePatch } from '../../cookbook/geo/scatter.js';
import { Kit, tube } from '../../cookbook/geo/kit.js';
import { rngFrom, vnoise2, sstep, clamp } from '../../cookbook/geo/noise.js';
import { makeMaterial } from '../../cookbook/materials/library.js';
import { slipMask, roadMask, axisZ, benchDist, BENCH } from './height.js';
import { LAYOUT as L, SEED, WORLD } from '../../contracts.js';

const uOf = (x, z) => -(z - axisZ(x)) - BENCH.half;
const vOf = (x, z) => z - axisZ(x) - BENCH.half;
const triCount = (g) => g.index.count / 3;

export function createProps(G, { T, mats, bark }) {
  const group = new Group(); group.name = 'terrain-props';
  const far = new Group(); far.name = 'terrain-scatter';
  const rng = rngFrom(SEED + 201), low = G.quality.tier === 'low', S = L.slip;
  let tris = 0, calls = 0; const parts = {};
  const add = (s, geos, into, name) => { into.add(s.group); calls += s.cells.length * geos.length; let t = 0; for (const g of geos) t += s.count * triCount(g); tris += t; parts[name] = [s.count, t, s.cells.length]; return s; };

  // fresh slip rock: lighter, cleaner than the weathered scree (its own material so it can be paler)
  // one material per scatter setting (fade uniforms live on the material); the bakes are shared, so this is cheap
  const rockMat = (name, tint) => { const m = makeMaterial('rock', { triplanar: true, tint, rough: 1.4, metal: 0, weather: { preset: 'prop', wet: 0.3 } }); m.vertexColors = true; m.name = name; return m; };
  const slipRock = rockMat('slipRock', 0xf0e8dc), slipGravel = rockMat('slipGravel', 0xe4dccf), scree = rockMat('screeTalus', 0x9a9894), erratic = rockMat('erratic', 0x8e8c88);
  void mats;

  // 1-3 m boulders on the lobe (shadow casters), a few half-buried in the road edge
  const bA = rockGeo({ seed: 5, radius: 1, detail: 3, cuts: 5, squash: 0.7 }), bB = rockGeo({ seed: 12, radius: 1, detail: 3, cuts: 6, squash: 0.55, noise: 0.4 });
  const bpts = poissonDisk({ x0: S.x - 24, z0: S.z - 26, w: 48, h: 44, r: 3.4, rng, accept: (x, z) => slipMask(x, z) > 0.55 && rng() < 0.75 });
  const half = (p, k) => { const o = []; for (let i = 0; i < p.length; i += 2) if (((i >> 1) % 2) === k) o.push(p[i], p[i + 1]); return new Float32Array(o); };
  const big = { heightAt: T.heightAt, normalAt: T.normalAt, scale: [0.5, 1.5], scaleY: [0.7, 1.05], align: 0.45, sink: 0.28, cell: 80, tilt: 0.5,
    tint: { color: 0xffffff, l: 0.18, h: 0.03, s: 0.05 }, fade: [220, 300] };
  add(scatter(G, { ...big, parts: [{ geo: bA, material: slipRock }], points: half(bpts, 0), seed: SEED + 11 }), [bA], group, 'boulderA');
  add(scatter(G, { ...big, parts: [{ geo: bB, material: slipRock }], points: half(bpts, 1), seed: SEED + 12 }), [bB], group, 'boulderB');
  // broken rock + gravel on the lobe (no shadows: they are small)
  const gA = rockGeo({ seed: 21, radius: 1, detail: 1, cuts: 4, squash: 0.6, noise: 0.35 });
  const gpts = poissonDisk({ x0: S.x - 26, z0: S.z - 30, w: 52, h: 48, r: low ? 1.3 : 0.95, rng, accept: (x, z) => { const m = slipMask(x, z); return rng() < m * 0.9 + 1.4 * m * (1 - m) - 0.03; } });   // denser at the toe: hides the slab line
  add(scatter(G, { parts: [{ geo: gA, material: slipGravel }], points: gpts, heightAt: T.heightAt, normalAt: T.normalAt, scale: [0.1, 0.55], scaleY: [0.5, 1],
    align: 0.6, sink: 0.22, cell: 80, shadow: false, tilt: 0.6, tint: { color: 0xffffff, l: 0.2, h: 0.03, s: 0.06 }, fade: [70, 110], seed: SEED + 13 }), [gA], far, 'gravel');

  // scree talus: the north toe, the gully fans and the bench edges; erratics further up
  const tA = rockGeo({ seed: 31, radius: 1, detail: 1, cuts: 5, squash: 0.55, noise: 0.3 });
  const tpts = poissonDisk({ x0: -170, z0: -100, w: 340, h: 76, r: low ? 2.6 : 1.9, rng, accept: (x, z) => {
    const u = uOf(x, z); if (u < 0.5 || u > 60 || Math.abs(x - WORLD.min[0]) < 0) return false;
    const fan = Math.pow(1 - Math.abs(vnoise2((x + vnoise2(x * 0.011, z * 0.006, SEED + 21) * 30) * 0.034, z * 0.0075, SEED + 22) * 2 - 1), 4);
    return rng() < 0.18 + 0.7 * fan * (1 - sstep(10, 60, u)) + 0.35 * (1 - sstep(0, 8, u));
  } });
  add(scatter(G, { parts: [{ geo: tA, material: scree }], points: tpts, heightAt: T.heightAt, normalAt: T.normalAt, scale: [0.18, 0.85], scaleY: [0.6, 1],
    align: 0.7, sink: 0.2, cell: 110, shadow: false, tint: { color: 0xffffff, l: 0.1 }, fade: [75, 120], seed: SEED + 14 }), [tA], far, 'talus');
  const eA = rockGeo({ seed: 44, radius: 1, detail: 2, cuts: 6, squash: 0.62 });
  const epts = poissonDisk({ x0: -220, z0: -150, w: 440, h: 125, r: 11, rng, accept: (x, z) => { const u = uOf(x, z); return u > 4 && u < 120 && rng() < 0.55; } });
  add(scatter(G, { parts: [{ geo: eA, material: erratic }], points: epts, heightAt: T.heightAt, normalAt: T.normalAt, scale: [0.6, 2.4], scaleY: [0.6, 0.95],
    align: 0.5, sink: 0.35, cell: 150, tilt: 0.4, shadow: false, tint: { color: 0xffffff, l: 0.1 }, fade: [180, 260], seed: SEED + 15 }), [eA], far, 'erratic');

  // snapped beech trunks + root plates carried down in the slip
  const k = new Kit(), tr = rngFrom(SEED + 33);
  for (let i = 0; i < 6; i++) {
    let x = 0, z = 0;
    for (let t = 0; t < 40; t++) { x = S.x + (tr() - 0.5) * 34; z = S.z + (tr() - 0.5) * 30; if (slipMask(x, z) > 0.6 && Math.hypot(x - 44, z + 12) > 7) break; }   // keep the pose-1 foreground (44,-12) clear
    const len = 5 + tr() * 7, a = tr() * Math.PI * 2, r0 = 0.22 + tr() * 0.16, dx = Math.cos(a), dz = Math.sin(a);
    const pts = [];
    for (let s = 0; s <= 6; s++) { const px = x + dx * len * s / 6, pz = z + dz * len * s / 6; pts.push([px, T.heightAt(px, pz) + r0 * 0.55 + (s === 0 || s === 6 ? 0.15 : 0), pz]); }
    k.add(tube(pts, (s) => r0 * (1 - 0.35 * s), { radial: 10, curve: true, samples: 10, caps: true }), 'bark', { occ: false });
    // splintered snap at the far end: long thin shards
    const e = pts[6];
    for (let sh = 0; sh < 3; sh++) {
      const sa = (0.15 + sh * 0.35 + tr() * 0.1) * Math.PI, ox = -dz * Math.cos(sa) * r0 * 0.45, oy = Math.sin(sa) * r0 * 0.45, oz = dx * Math.cos(sa) * r0 * 0.45, sl = 0.2 + tr() * 0.35;
      k.add(tube([[e[0] + ox, e[1] + oy, e[2] + oz], [e[0] + ox + dx * sl, e[1] + oy * 0.8, e[2] + oz + dz * sl]], (s) => r0 * 0.42 * (1 - 0.85 * s), { radial: 5, caps: false }), 'bark', { occ: false, color: 0xe0c8a4 });
    }
    // root plate on the other end (half of them): a soil-and-root disc stood on edge
    if (i % 2 === 0) {
      const b = pts[0];
      k.push(b[0] - dx * 0.15, b[1] + 0.2, b[2] - dz * 0.15, -a + Math.PI / 2, 0, 0, 0.85 + tr() * 0.4);
      const rp = rockGeo({ seed: 60 + i, radius: 1, detail: 2, cuts: 2, squash: 1, noise: 0.45 });
      rp.scale(0.45, 1.25, 1.35);
      k.add(rp, 'soil', { occ: false, color: 0x7a6a56, at: [0, 0.6, 0] });
      for (let rr = 0; rr < 9; rr++) { const ra = tr() * Math.PI * 2, rl = 0.9 + tr() * 1.1, ry = Math.sin(ra) * 1.1 + 0.6, rz = Math.cos(ra) * 1.2; k.add(tube([[0, ry * 0.6, rz * 0.6], [-0.3 - tr() * 0.5, ry + Math.sin(ra) * rl * 0.4, rz + Math.cos(ra) * rl * 0.5]], (s) => 0.07 * (1 - 0.8 * s), { radial: 5, caps: false }), 'bark', { occ: false }); }
      k.pop();
    }
    // a broken limb or two beside it
    for (let l = 0; l < 2; l++) {
      const bx = x + dx * len * (0.3 + 0.4 * tr()) + (tr() - 0.5) * 3, bz = z + dz * len * (0.3 + 0.4 * tr()) + (tr() - 0.5) * 3, la = tr() * 6.28, ll = 1.5 + tr() * 2;
      k.add(tube([[bx, T.heightAt(bx, bz) + 0.06, bz], [bx + Math.cos(la) * ll, T.heightAt(bx + Math.cos(la) * ll, bz + Math.sin(la) * ll) + 0.1, bz + Math.sin(la) * ll]], (s) => 0.08 * (1 - 0.6 * s), { radial: 6, caps: true }), 'bark', { occ: false });
    }
  }
  k.grime({ base: 0 });
  const soil = makeMaterial('forest_ground', { tint: 0x8a7a68, weather: 'prop' }); soil.vertexColors = true; soil.name = 'rootSoil';
  const trunks = k.build({ bark, soil, default: bark });
  trunks.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; tris += triCount(m.geometry); calls++; } });
  group.add(trunks);

  // tussock (Chionochloa): golden-brown clumps on verges, the scree toe and the valley floor beyond the slab
  const tuss = new MeshStandardMaterial({ side: DoubleSide, vertexColors: true, roughness: 0.92, color: new Color(0.40, 0.30, 0.12) });
  tuss.name = 'tussock'; tuss.userData.weather = { preset: 'prop', snow: 0.3, wet: 0.4, beads: 0 };
  foliagePatch(tuss, { trans: 0.22 });
  const tg = grassTuftGeo({ seed: 2, blades: 28, h: 0.85, w: 0.06, spread: 0.3, segs: 3, bend: 0.6 });
  const qpts = poissonDisk({ x0: -150, z0: -75, w: 300, h: 115, r: low ? 2.1 : 1.55, rng, accept: (x, z) => {
    if (benchDist(x, z) < 0.6 || roadMask(x, z) > 0.1 || slipMask(x, z) > 0.3) return false;
    const u = uOf(x, z), v = vOf(x, z);
    const cl = sstep(0.45, 0.72, vnoise2(x * 0.07, z * 0.07, SEED + 3));      // tussock grows in drifts, not as stubble
    if (u > 0) return u < 40 && rng() < (0.9 - 0.7 * sstep(5, 40, u)) * cl;
    if (v > 0) return v < 4.5 && rng() < 0.7;
    return rng() < 0.8 * cl;                               // valley floor beyond the slab (|x| > 95)
  } });
  add(scatter(G, { parts: [{ geo: tg, material: tuss }], points: qpts, heightAt: T.heightAt, normalAt: T.normalAt, scale: [0.85, 1.6], scaleY: [0.75, 1.15],
    align: 0.35, sink: 0.08, cell: 120, shadow: false, fade: [40, 70, 1.7], tint: { color: 0xffffff, h: 0.03, s: 0.12, l: 0.12 },
    sway: { amp: 0.07, freq: 1.7, power: 2, height: 0.72, flutter: 0.015 }, seed: SEED + 16 }), [tg], far, 'tussock');
  void clamp;
  return { group, far, tris, calls, parts, materials: [slipRock, slipGravel, scree, erratic, soil, tuss] };
}
