// terrain/height — the shape of the pass. Pure functions (no three.js), shared by the mesh builder, the splat
// masks and every scatter. Axes: -Z north (scree + the range), +Z south (beech forest), -X west (the saddle under
// the sun), +X east (the slip, then the valley bends north and a spur closes it).
//   heightFn() → (x, z) => y          the contract: |x| <= 95, -27 <= z <= 19 is the bench at y = -0.06
//   masks(x, z, h) → {forest, slip, road, scar}   0..1 fields for the splat shader and the scatters
import { erodedHeight } from '../../cookbook/geo/sdf-terrain.js';
import { vnoise2, fbm2, ridged2, clamp, sstep, mix } from '../../cookbook/geo/noise.js';
import { LAYOUT as L, SEED } from '../../contracts.js';

export const BENCH = { x: 95, z0: -27, z1: 19, y: -0.06, half: 23 };
export const EXT = 448;                      // terrain half-extent (m); crests sit inside it so the edge never shows
const S = L.slip;

// valley axis (bench centre z = -4) and floor: bends north-west into the saddle under the sun, north-east past the slip
export function axisZ(x) {
  if (x < -BENCH.x) return -4 - 125 * sstep(0, 330, -BENCH.x - x);
  if (x > BENCH.x) return -4 - 70 * sstep(0, 320, x - BENCH.x);
  return -4;
}
function floorY(x) {
  if (x < -BENCH.x) { const t = -BENCH.x - x; return 34 * sstep(0, 320, t) - Math.max(0, t - 325) * 0.9; }
  if (x > BENCH.x) { const t = x - BENCH.x; return -9 * sstep(0, 200, t) + 150 * sstep(170, 360, t) * (0.8 + 0.4 * vnoise2(t * 0.01, 3.3, SEED + 9)); }   // a high spur closes the valley east
  return 0;
}
// distance (m) outside the flat bench, and the road line beyond the slab ends
export function benchDist(x, z) {
  const dl = z - axisZ(x), dx = Math.max(0, Math.abs(x) - BENCH.x), dz = Math.max(0, Math.abs(dl) - BENCH.half);
  return Math.hypot(dx, dz);
}
export function roadMask(x, z) {
  if (Math.abs(x) < 88) return 0;
  const d = Math.abs(z - (axisZ(x) - 16));
  return 1 - sstep(3.4, 4.6, d);
}
// terraced profile: flat benches, steep risers (scree steps), step height varies so it never reads as stairs
function terrace(h, step, sharp) {
  const k = Math.floor(h / step), f = h / step - k;
  return (k + Math.pow(f, sharp)) * step;
}
// gully field along the north wall: long, slope-parallel channels (x varies fast, z slow) → 0..1, 1 = channel bed
function gully(x, z) {
  const w = vnoise2(x * 0.011, z * 0.006, SEED + 21) * 30;                     // meander
  const g = 1 - Math.abs(vnoise2((x + w) * 0.034, z * 0.0075, SEED + 22) * 2 - 1);
  return Math.pow(g, 4);
}

export function heightFn() {
  const macro = erodedHeight({ seed: SEED, amp: 1, freq: 0.0055, octaves: 6, ridge: 0.5, ridgeFreq: 0.008, detail: 0 });
  const f = (x, z) => {
    const ax = axisZ(x), dl = z - ax;
    const u = -dl - BENCH.half, v = dl - BENCH.half;                           // metres beyond the north / south bench edge
    const dB = benchDist(x, z);
    let h = BENCH.y + floorY(x);
    const fx = Math.abs(x) - BENCH.x;                                          // the valley ends (saddle west, spur east): massif relief
    if (fx > 120) h += (macro(x + 300, z) * 45 + ridged2(x * 0.018, z * 0.018, 4, SEED + 35) * 22) * sstep(120, 300, fx) * (x > 0 ? 1 : 0.45);
    // valley floor outside the bench in x: tussock humps, the road line kept smooth
    if (dB > 0) {
      const rd = roadMask(x, z);
      h += sstep(0, 10, dB) * (fbm2(x * 0.05, z * 0.05, 3, SEED + 5) * 1.6 + fbm2(x * 0.3, z * 0.3, 2, SEED + 6) * 0.35) * (1 - 0.85 * rd);
    }
    if (u > 0) { // north wall: talus apron → stepped scree benches → gullied range
      const s = 7.5 + 4 * vnoise2(x * 0.01, z * 0.02, SEED + 30);
      const base = 230 * (1 - Math.exp(-u / 330)) + 0.12 * u * Math.exp(-u / 40);
      const terr = terrace(base, s, 2.6 + 1.5 * vnoise2(x * 0.02, z * 0.02, SEED + 31));
      const tb = 0.62 * sstep(8, 30, u) * (0.6 + 0.4 * vnoise2(x * 0.015, 3.1, SEED + 32));
      let n = mix(base, terr, tb);
      n += macro(x, z) * (8 + 55 * sstep(20, 260, u)) * sstep(0, 15, u) + ridged2(x * 0.02, z * 0.02, 4, SEED + 33) * 10 * sstep(40, 200, u);
      const g = gully(x, z);
      n -= g * Math.min(u * 0.13, 9);                                         // gully channels cut into the benches
      n += gully(x, -30) * 3.2 * Math.exp(-u / 11) * sstep(0, 3, u);           // talus fan at each gully mouth
      n += (fbm2(x * 0.25, z * 0.25, 3, SEED + 34) - 0.5) * 1.2 * sstep(0, 6, u); // blocky scree roughness
      // the slip scar: the slope above SH73 scooped out, fresh rock, feeding the lobe
      const sx = (x - S.x) / 17, su = (u - 45) / 38;
      n -= 13 * Math.exp(-(sx * sx + su * su)) * sstep(0, 12, u);
      h += Math.max(n, 0.12 * u) * sstep(0, 2, u);
    }
    if (v > 0) { // south wall: beech forest slope, lumpy spurs
      let n = 150 * (1 - Math.exp(-v / 240)) + 0.25 * v * Math.exp(-v / 30);
      n += macro(x + 700, z) * (6 + 35 * sstep(20, 250, v)) * sstep(0, 15, v) + (fbm2(x * 0.06, z * 0.06, 3, SEED + 40) - 0.5) * 2.4 * sstep(0, 8, v);
      h += Math.max(n, 0.1 * v) * sstep(0, 2, v);
    }
    // the slip: a debris lobe across SH73 from the north, lumpy, steeper at its toe
    const lx = (x - S.x) / (x < S.x ? 18.5 : 22), lz = (z - S.z) / (S.r * 1.3);
    const lr = lx * lx + lz * lz;
    if (lr < 1) {
      const s = Math.pow(1 - lr, 1.4);                                          // compact dome: toe ends at r (east of the gate)
      const lump = (fbm2(x * 0.35, z * 0.35, 3, SEED + 50) - 0.5) * 1.6 + (fbm2(x * 0.9, z * 0.9, 2, SEED + 51) - 0.5) * 0.5;
      h = Math.max(h, BENCH.y) + s * S.h * (0.85 + 0.15 * vnoise2(x * 0.2, z * 0.2, SEED + 52)) + lump * sstep(0.0, 0.25, s) * 0.9;
    }
    return h;
  };
  return f;
}

// 0..1 masks used by the splat shader (vertex attribute) and the scatters
export function forestMask(x, z) {
  const dl = z - axisZ(x), v = dl - BENCH.half;
  if (v < 1.5) return 0;
  const edge = sstep(1.5, 5, v) * (1 - sstep(170, 230, v + vnoise2(x * 0.01, z * 0.01, SEED + 60) * 60));  // bushline
  const gaps = sstep(0.1, 0.26, fbm2(x * 0.012, z * 0.012, 3, SEED + 61));
  const east = x > 95 ? sstep(-25, 45, 250 - x + (vnoise2(z * 0.02, 1.7, SEED + 62) - 0.5) * 90) : 1;                         // valley floor east is open tussock
  return clamp(edge * gaps * east, 0, 1);
}
export function slipMask(x, z) {
  const lx = (x - S.x) / (x < S.x ? 20 : 24), lz = (z - S.z) / (S.r * 1.45);
  const lobe = Math.max(0, 1 - lx * lx - lz * lz);
  const u = -(z - axisZ(x)) - BENCH.half, sx = (x - S.x) / 19, su = (u - 45) / 45;
  const scar = Math.exp(-(sx * sx + su * su)) * sstep(-4, 8, u);
  return clamp(Math.max(sstep(0.0, 0.25, lobe), sstep(0.15, 0.45, scar)), 0, 1);
}
