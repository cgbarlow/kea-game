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
      n -= 5.5 * Math.exp(-sx * sx * 1.6) * sstep(1.12, 0.98, su + (vnoise2(x * 0.08, 7.7, SEED + 53) - 0.5) * 0.12) * sstep(-0.9, 0.3, su);   // crown scarp: the fresh head wall
      n -= 1.1 * oldScar(x, z) * sstep(1, 6, u);                               // the older slip chute: a shallow raw trough
      h += Math.max(n, 0.12 * u) * sstep(0, 2, u);
    }
    if (v > 0) { // south wall: beech forest slope, lumpy spurs
      let n = 150 * (1 - Math.exp(-v / 240)) + 0.25 * v * Math.exp(-v / 30);
      n += macro(x + 700, z) * (6 + 35 * sstep(20, 250, v)) * sstep(0, 15, v) + (fbm2(x * 0.06, z * 0.06, 3, SEED + 40) - 0.5) * 2.4 * sstep(0, 8, v);
      h += Math.max(n, 0.1 * v) * sstep(0, 2, v);
    }
    // the slip: an asymmetric spill out of the scar, thick at the head, a lobate fan-shaped toe across SH73
    const sl = slipShape(x, z);
    if (sl.s > 0) {
      const lump = (fbm2(x * 0.35, z * 0.35, 3, SEED + 50) - 0.5) * 1.4 + (fbm2(x * 0.9, z * 0.9, 2, SEED + 51) - 0.5) * 0.45;
      h = Math.max(h, BENCH.y) + sl.s * S.h + lump * sstep(0.0, 0.2, sl.s) * 0.9;
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
// the debris body: t runs 0 at the head (in the scar mouth, north) to 1 at the toe (south, across the road); the
// fan widens and drifts east toward the toe, the toe is lobate, the flanks carry low levees, pressure ridges near the toe.
//   → { s: thickness / S.h (0..~1.15), t, q: -1..1 across, e: 0 inside .. 1 at the outline }
const _sl = { s: 0, t: 0, q: 0, e: 1 };
export function slipShape(x, z) {
  const t = (z - (S.z - 19.5)) / 39;
  _sl.s = 0; _sl.t = t; _sl.q = 2; _sl.e = 1;
  if (t < -0.05 || t > 1.1) return _sl;
  const tc = clamp(t, 0, 1);
  const cx = S.x - 1 + 4 * tc * tc, w = 14 + 8 * sstep(0.15, 1, tc) + (vnoise2(z * 0.09, 4.1, SEED + 54) - 0.5) * 3;
  const q = (x - cx) / w;
  _sl.q = q;
  const tEnd = 0.93 + 0.08 * vnoise2(x * 0.11, 1.3, SEED + 55) - 0.05 * q * q;   // lobate snout, flanks run out sooner
  if (Math.abs(q) >= 1 || t >= tEnd) return _sl;
  const lat = Math.pow(1 - q * q, 0.95) + 0.18 * Math.exp(-Math.pow((Math.abs(q) - 0.78) / 0.1, 2)) * tc;   // levees
  const toe = Math.pow(sstep(tEnd, tEnd - 0.14, t), 0.8);
  const head = sstep(-0.05, 0.18, t);
  const ridges = Math.sin(t * 46 + vnoise2(x * 0.06, z * 0.03, SEED + 56) * 7) * 0.05 * sstep(0.45, 0.85, t);
  _sl.s = Math.max(0, (1.1 - 0.58 * tc) * lat * toe * head + ridges * lat * toe);
  _sl.e = Math.max(Math.abs(q), clamp((t - (tEnd - 0.13)) / 0.13, 0, 1));
  return _sl;
}
export function slipMask(x, z) {
  const sl = slipShape(x, z);
  const lobe = sl.q > 1.5 ? 0 : sstep(0.0, 0.08, sl.s);
  const u = -(z - axisZ(x)) - BENCH.half, sx = (x - S.x) / 19, su = (u - 45) / 45;
  const scar = Math.exp(-(sx * sx + su * su)) * sstep(-4, 8, u);
  return clamp(Math.max(lobe, sstep(0.15, 0.45, scar)), 0, 1);
}

// an older, smaller slip on the north face opposite the car park (seen from spawn looking north): a raw grey chute of
// scree from a head scarp ~50 m up, narrowing down the face and fanning out onto the talus apron at the toe. 0..1.
export function oldScar(x, z) {
  const u = -(z - axisZ(x)) - BENCH.half;
  if (u < -1 || u > 60 || x < -40 || x > 5) return 0;
  const xc = -18 + 3 * Math.sin(u * 0.07) + (vnoise2(u * 0.09, 2.2, SEED + 57) - 0.5) * 4;
  const w = 5 + 4 * sstep(28, 48, u) + 5 * (1 - sstep(0, 8, u));
  const d = Math.abs(x - xc) + (vnoise2(x * 0.4, z * 0.4, SEED + 58) - 0.5) * 1.6;
  return (1 - sstep(w * 0.55, w, d)) * sstep(-1, 1.5, u) * (1 - sstep(50, 56, u + (vnoise2(x * 0.2, 5.5, SEED + 59) - 0.5) * 4));
}
