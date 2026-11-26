// terrain/props — ground dressing: the slip (1-3 m boulders, broken rock, snapped beech trunks with root plates),
// scree talus on the north toe and gully fans, a few erratics up the slope, tussock on the verges and valley floor.
//   createProps(G, { T, fn, mats, bark }) → { group, far, tris, calls }
// group = near things that show in the puddle reflection; far = small scatter hidden from the reflection pass.
import { Group, MeshStandardMaterial, DoubleSide, Color } from 'three';
import { scatter, poissonDisk, rockGeo, grassTuftGeo, foliagePatch } from '../../cookbook/geo/scatter.js';
import { Kit, tube } from '../../cookbook/geo/kit.js';
import { rngFrom, vnoise2, sstep, clamp } from '../../cookbook/geo/noise.js';
import { makeMaterial } from '../../cookbook/materials/library.js';
import { createDebris } from './debris.js';
import { createNorth } from './north.js';
import { patchRockSnow } from './rocksnow.js';
import { slipMask, slipShape, roadMask, oldScar, axisZ, benchDist, BENCH } from './height.js';
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
  const rockMat = (name, tint, snow = {}) => { const m = makeMaterial('rock', { triplanar: true, tint, rough: 1.4, metal: 0, weather: { preset: 'prop', wet: 0.3 } }); m.vertexColors = true; m.name = name; patchRockSnow(m, snow); return m; };
  const scree = rockMat('screeTalus', 0x9a9894), erratic = rockMat('erratic', 0x8e8c88);
  void mats;

  // the slip itself (boulders by size, slabs, gravel, asphalt plates, guardrail, sign, culvert, contact skirt)
  const deb = createDebris(G, { T, add, group, far, rockMat });
  tris += deb.tris; calls += deb.calls;

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
  add(scatter(G, { parts: [{ geo: eA, material: erratic }], points: epts, heightAt: T.heightAt, normalAt: T.normalAt, scale: [0.6, 2.0], scaleY: [0.55, 0.9],
    align: 0.55, sink: 0.55, cell: 150, tilt: 0.4, shadow: false, tint: { color: 0xffffff, l: 0.1 }, fade: [180, 260], seed: SEED + 15 }), [eA], far, 'erratic');

  // snapped beech trunks + root plates carried down in the slip
  const k = new Kit(), tr = rngFrom(SEED + 33);
  for (let i = 0; i < 6; i++) {
    let x = 0, z = 0;
    for (let t = 0; t < 40; t++) { x = S.x + (tr() - 0.5) * 34; z = S.z + (tr() - 0.5) * 30; const sh = slipShape(x, z); if (sh.s > 0.25 && sh.t > 0.3 && sh.t < 0.85 && Math.hypot(x - 44, z + 12) > 7) break; }   // keep the pose-1 foreground (44,-12) clear; none on the crest skyline
    const len = 5 + tr() * 7, a = tr() * Math.PI * 2, r0 = 0.22 + tr() * 0.16, dx = Math.cos(a), dz = Math.sin(a);
    const pts = [];
    for (let s = 0; s <= 6; s++) { const px = x + dx * len * s / 6, pz = z + dz * len * s / 6; pts.push([px, T.heightAt(px, pz) + r0 * (s === 0 ? 0.6 : s === 6 ? 0.45 : -0.05) + (s === 3 ? 0.12 : 0), pz]); }   // half buried, ends proud
    k.add(tube(pts, (s) => r0 * (1 - 0.35 * s), { radial: 10, curve: false, caps: true }), 'bark', { occ: false, color: 0xb0a490 });
    // splintered snap at the far end: long thin shards
    const e = pts[6];
    for (let sh = 0; sh < 3; sh++) {
      const sa = (0.15 + sh * 0.35 + tr() * 0.1) * Math.PI, ox = -dz * Math.cos(sa) * r0 * 0.45, oy = Math.sin(sa) * r0 * 0.45, oz = dx * Math.cos(sa) * r0 * 0.45, sl = 0.2 + tr() * 0.35;
      k.add(tube([[e[0] + ox, e[1] + oy, e[2] + oz], [e[0] + ox + dx * sl, e[1] + oy * 0.8, e[2] + oz + dz * sl]], (s) => r0 * 0.42 * (1 - 0.85 * s), { radial: 5, caps: false }), 'bark', { occ: false, color: 0xe0c8a4 });
    }
    // root plate on the other end (half of them): a soil-and-root disc stood on edge
    if (i % 2 === 0 && slipShape(x, z).t > 0.5) {                    // only low on the lobe: a root disc on the crest read as a spiky stray prop
      const b = pts[0];
      k.push(b[0] - dx * 0.15, b[1] - 0.15, b[2] - dz * 0.15, -a + Math.PI / 2, 0, 0, 0.75 + tr() * 0.3);
      const rp = rockGeo({ seed: 60 + i, radius: 1, detail: 2, cuts: 2, squash: 1, noise: 0.45 });
      rp.scale(0.55, 1.05, 1.3);
      k.add(rp, 'soil', { occ: false, color: 0xc0a888, at: [0, 0.35, 0] });
      for (let st = 0; st < 5; st++) { const sg = rockGeo({ seed: 90 + i * 7 + st, radius: 0.16 + tr() * 0.12, detail: 1, cuts: 4, squash: 0.7 }); k.add(sg, 'soil', { occ: false, color: 0xe8e2d8, at: [0.3 + tr() * 0.1, 0.1 + tr() * 1.1, (tr() - 0.5) * 1.6] }); }
      // root stubs: short, torn, drooping, inside ~1.25x the disc outline (no long spikes against the sky)
      for (let rr = 0; rr < 10; rr++) { const ra = tr() * Math.PI * 2, rl = 0.2 + tr() * 0.3, ry = Math.sin(ra) * 0.95 + 0.35, rz = Math.cos(ra) * 1.15; k.add(tube([[0, ry * 0.8, rz * 0.8], [-0.15 - tr() * 0.2, ry + Math.sin(ra) * rl * 0.3 - rl * 0.5, rz + Math.cos(ra) * rl * 0.4]], (s) => 0.06 * (1 - 0.6 * s), { radial: 5, caps: true }), 'bark', { occ: false }); }
      k.pop();
    }
    // a broken limb or two beside it
    for (let l = 0; l < 2; l++) {
      const bx = x + dx * len * (0.3 + 0.4 * tr()) + (tr() - 0.5) * 3, bz = z + dz * len * (0.3 + 0.4 * tr()) + (tr() - 0.5) * 3, la = tr() * 6.28, ll = 1.5 + tr() * 2;
      k.add(tube([[bx, T.heightAt(bx, bz) + 0.06, bz], [bx + Math.cos(la) * ll, T.heightAt(bx + Math.cos(la) * ll, bz + Math.sin(la) * ll) + 0.1, bz + Math.sin(la) * ll]], (s) => 0.08 * (1 - 0.6 * s), { radial: 6, caps: true }), 'bark', { occ: false });
    }
  }
  k.grime({ base: 0 });
  const soil = makeMaterial('forest_ground', { tint: 0xa89480, weather: 'prop' });
  const wood = makeMaterial('weathered_wood', { tint: 0x9a8c7a, weather: 'prop' }); wood.vertexColors = true; wood.name = 'slipTrunk'; soil.vertexColors = true; soil.name = 'rootSoil';
  const trunks = k.build({ bark: wood, soil, default: wood });
  void bark;
  trunks.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; tris += triCount(m.geometry); calls++; } });
  group.add(trunks);

  // the north face opposite the car park: outcrops, the old slip chute's blocks, a fence line, the old retaining wall
  const north = createNorth(G, { T, rockMat, add, group, far });
  tris += north.tris; calls += north.calls;

  // tussock (Chionochloa): golden-brown clumps on verges, the scree toe and the valley floor beyond the slab
  const tuss = new MeshStandardMaterial({ side: DoubleSide, vertexColors: true, roughness: 0.92, color: new Color(0.40, 0.30, 0.12) });
  tuss.name = 'tussock'; tuss.userData.weather = { preset: 'prop', snow: 0.3, wet: 0.4, beads: 0 };
  foliagePatch(tuss, { trans: 0.22 });
  const tg = grassTuftGeo({ seed: 2, blades: 24, h: 0.85, w: 0.085, spread: 0.3, segs: 3, bend: 0.6 });
  const qpts = poissonDisk({ x0: -150, z0: -75, w: 300, h: 115, r: low ? 1.8 : 1.3, rng, accept: (x, z) => {
    if (benchDist(x, z) < 0.6 || roadMask(x, z) > 0.1 || slipMask(x, z) > 0.3) return false;
    const u = uOf(x, z), v = vOf(x, z);
    if (oldScar(x, z) > 0.2) return false;                                    // the raw chute is bare
    // tussock grows in clumps and drifts with bare stony ground between, never as an even stubble
    const cl = sstep(0.5, 0.7, vnoise2(x * 0.11, z * 0.11, SEED + 3) * 0.7 + vnoise2(x * 0.035, z * 0.035, SEED + 4) * 0.3);
    if (u > 0) return u < 40 && rng() < (1.0 - 0.6 * sstep(5, 40, u)) * cl * cl;
    if (v > 0) return v < 4.5 && rng() < 0.7;
    return rng() < 0.8 * cl;                               // valley floor beyond the slab (|x| > 95)
  } });
  // erratics sit in the grass, not on it: a ring of tussock round each base below the bushline
  const ring = [];
  for (let i = 0; i < epts.length; i += 2) {
    const ex = epts[i], ez = epts[i + 1]; if (uOf(ex, ez) > 45) continue;
    for (let r = 0; r < 5; r++) { const a = r * 1.257 + rng() * 0.6, d = 1.3 + rng() * 1.4; ring.push(ex + Math.cos(a) * d, ez + Math.sin(a) * d); }
  }
  const qall = new Float32Array(qpts.length + ring.length); qall.set(qpts); qall.set(ring, qpts.length);
  add(scatter(G, { parts: [{ geo: tg, material: tuss }], points: qall, heightAt: T.heightAt, normalAt: T.normalAt, scale: [0.6, 1.6], scaleY: [0.75, 1.2],
    align: 0.35, sink: 0.08, cell: 120, shadow: false, fade: [30, 55, 1.7], tint: { color: 0xffffff, h: 0.03, s: 0.12, l: 0.12 },
    sway: { amp: 0.035, freq: 1.1, power: 2, height: 0.72, flutter: 0.003 }, seed: SEED + 16 }), [tg], far, 'tussock');
  void clamp;
  return { group, far, tris, calls, parts, materials: [...deb.materials, ...north.materials, scree, erratic, soil, wood, tuss] };
}
