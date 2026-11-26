// possums/geo — bind-pose geometry for one common brushtail possum (Trichosurus vulpecula), metres, facing -Z,
// feet on y = 0. Everything is built here as skinned BufferGeometry:
//   base  : lofted body + head (one smooth surface), bushy tail tube, four legs + paws, ears  (group 0 = fur)
//           eyes + nose                                                                     (group 1 = wet)
//   shell : 3 fur shells over body + tail (bare face + hidden belly skipped), offset along the normal, aFur.x = layer (0..1), aFur.y = fur length
// Skin: 12 bones (see BONES), 2 influences per vertex. Vertex colour = linear albedo × baked AO (belly, legs,
// between-limb contact), with per-possum colour morph + mottling from `look` (no two possums share a coat).
// Budget: ~3.6 k tris per possum (base ~1.8 k + shells ~1.8 k) → 8 possums ≈ 28.8 k.
import { BufferGeometry, BufferAttribute, Float32BufferAttribute, Uint16BufferAttribute, Color } from 'three';
import { vnoise3, clamp, mix, sstep } from '../../cookbook/geo/noise.js';

// bone name, parent index, bind world position (possum local)
export const BONES = [
  ['root', -1, [0, 0, 0.10]],       // 0 at the hind feet: rear-up pitches about here
  ['pelvis', 0, [0, 0.15, 0.10]],   // 1
  ['chest', 1, [0, 0.145, -0.06]],  // 2
  ['head', 2, [0, 0.168, -0.165]],  // 3 neck pivot
  ['tail0', 1, [0, 0.152, 0.185]],  // 4
  ['tail1', 4, [0, 0.148, 0.265]],  // 5
  ['tail2', 5, [0, 0.144, 0.345]],  // 6
  ['tail3', 6, [0, 0.140, 0.425]],  // 7
  ['legFL', 2, [-0.036, 0.105, -0.078]], // 8 (possum's left = -X when facing -Z)
  ['legFR', 2, [0.036, 0.105, -0.078]],  // 9
  ['legRL', 1, [-0.052, 0.112, 0.095]],  // 10
  ['legRR', 1, [0.052, 0.112, 0.095]],   // 11
];
export const B = { root: 0, pelvis: 1, chest: 2, head: 3, tail0: 4, tail1: 5, tail2: 6, tail3: 7, FL: 8, FR: 9, RL: 10, RR: 11 };

// body loft control table: z, centre y, half-width, half-height top, half-height bottom
const LOFT = [
  [0.200, 0.150, 0.004, 0.004, 0.004],
  [0.186, 0.152, 0.046, 0.050, 0.046],
  [0.155, 0.154, 0.072, 0.080, 0.074],
  [0.105, 0.152, 0.084, 0.090, 0.086],
  [0.045, 0.148, 0.086, 0.088, 0.088],
  [-0.015, 0.146, 0.078, 0.082, 0.082],
  [-0.075, 0.150, 0.066, 0.074, 0.070],
  [-0.122, 0.158, 0.054, 0.062, 0.056],
  [-0.155, 0.170, 0.046, 0.050, 0.046],
  [-0.185, 0.180, 0.053, 0.053, 0.046],
  [-0.215, 0.176, 0.047, 0.043, 0.038],
  [-0.240, 0.166, 0.032, 0.030, 0.028],
  [-0.262, 0.156, 0.019, 0.019, 0.018],
  [-0.279, 0.150, 0.010, 0.010, 0.010],
  [-0.288, 0.148, 0.003, 0.003, 0.003],
];
function cr(p0, p1, p2, p3, t) { // Catmull-Rom
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
export function sAtZ(z) { // loft parameter whose ring sits at z (table rows are not evenly spaced)
  const o = [0, 0, 0, 0, 0]; let best = 0, bd = 1e9;
  for (let i = 0; i <= 400; i++) { const s = i / 400; loftAt(s, o); const d = Math.abs(o[0] - z); if (d < bd) { bd = d; best = s; } }
  return best;
}
export function loftAt(s, out = [0, 0, 0, 0, 0]) { // s 0..1 along the table
  const n = LOFT.length - 1, f = clamp(s, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
  const a = LOFT[Math.max(0, i - 1)], b = LOFT[i], c = LOFT[i + 1], d = LOFT[Math.min(n, i + 2)];
  for (let k = 0; k < 5; k++) out[k] = cr(a[k], b[k], c[k], d[k], t);
  return out;
}

// ---------------------------------------------------------------- part accumulator
class Part {
  constructor() { this.p = []; this.c = []; this.si = []; this.sw = []; this.fur = []; this.idx = []; this.n = null; }
  get count() { return this.p.length / 3; }
  v(x, y, z, col, b0, b1 = 0, w = 1, furLen = 0) {
    this.p.push(x, y, z); this.c.push(col[0], col[1], col[2]);
    this.si.push(b0, b1, 0, 0); this.sw.push(w, 1 - w, 0, 0); this.fur.push(0, furLen);
    return this.count - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  normals() { // smooth area-weighted normals
    const P = this.p, N = this.n = new Float32Array(P.length);
    for (let i = 0; i < this.idx.length; i += 3) {
      const a = this.idx[i] * 3, b = this.idx[i + 1] * 3, c = this.idx[i + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const o of [a, b, c]) { N[o] += nx; N[o + 1] += ny; N[o + 2] += nz; }
    }
    for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
    return this;
  }
}

// grid of rings (closed around), ring r has `rad` verts; ends are closed by their tiny radius
function ringGrid(part, rings, rad, vert) {
  const base = part.count;
  for (let r = 0; r < rings; r++) for (let j = 0; j < rad; j++) vert(r, j);
  for (let r = 0; r < rings - 1; r++) for (let j = 0; j < rad; j++) {
    const a = base + r * rad + j, b = base + r * rad + (j + 1) % rad, c = a + rad, d = b + rad;
    part.tri(a, c, b); part.tri(b, c, d);
  }
  // pole caps
  const cap = (r, flip) => { const c = part.count; const o = base + r * rad; let x = 0, y = 0, z = 0, cl = [0, 0, 0];
    for (let j = 0; j < rad; j++) { x += part.p[(o + j) * 3]; y += part.p[(o + j) * 3 + 1]; z += part.p[(o + j) * 3 + 2]; }
    cl = [part.c[o * 3], part.c[o * 3 + 1], part.c[o * 3 + 2]];
    part.v(x / rad, y / rad, z / rad, cl, part.si[o * 4], part.si[o * 4 + 1], part.sw[o * 4], part.fur[o * 2 + 1]);
    for (let j = 0; j < rad; j++) { const a = o + j, b = o + (j + 1) % rad; if (flip) part.tri(c, b, a); else part.tri(c, a, b); }
  };
  cap(0, false); cap(rings - 1, true);
}

const C = (hex) => { const c = new Color(hex); return [c.r, c.g, c.b]; };
const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// spine weights by z (pelvis → chest → head)
function spineW(z) {
  if (z >= 0.05) return [B.pelvis, B.chest, 1];
  if (z >= -0.08) { const t = sstep(0.05, -0.08, z); return [B.pelvis, B.chest, 1 - t]; }
  if (z >= -0.15) { const t = sstep(-0.08, -0.15, z); return [B.chest, B.head, 1 - t]; }
  return [B.head, B.chest, 1];
}

// ---------------------------------------------------------------- build
// look: { seed, grey (linear rgb), back, belly, tail, morph 0 grey .. 1 brown }
export function buildPossumGeo(look) {
  const body = new Part(), wet = new Part(), tailP = new Part(), limbs = new Part();
  const sd = look.seed;
  const grey = look.grey, back = look.back, belly = look.belly, black = look.tail;
  const dark = C(0x2a2522), muzzle = mul3(lerp3(grey, dark, 0.6), 0.9), pink = C(0xc98a86), cheek = lerp3(grey, belly, 0.6);
  const RINGS = 22, RAD = 12, L = [0, 0, 0, 0, 0];
  // body + head loft
  ringGrid(body, RINGS, RAD, (r, j) => {
    const s = r / (RINGS - 1);
    loftAt(s, L);
    const [z, cy, rx, ryT, ryB] = L;
    const th = (j / RAD) * Math.PI * 2, sx = Math.sin(th), cyy = Math.cos(th);
    const ry = cyy >= 0 ? ryT : ryB;
    // belly slightly flattened, back slightly ridged over the shoulders
    const flat = cyy < 0 ? 1 - 0.12 * cyy * cyy : 1 + 0.04 * Math.pow(cyy, 6);
    const x = rx * sx * (cyy < -0.2 ? 1.02 : 1), y = cy + ry * cyy * flat;
    // colour: grey coat, darker dorsal band, cream belly + throat, dark muzzle, dark eye stripe, pale cheeks
    const up = cyy, side = Math.abs(sx);
    let col = lerp3(grey, back, sstep(0.55, 0.95, up) * 0.8);
    col = lerp3(col, belly, sstep(-0.25, -0.65, up) * (z > -0.25 ? 1 : 0.4));
    if (z < -0.13) { // face
      const eyeBand = sstep(0.25, 0.0, Math.abs(up - 0.45)) * sstep(-0.17, -0.21, z) * sstep(-0.27, -0.235, z);
      col = lerp3(col, cheek, sstep(-0.1, -0.5, up) * 0.7 * side);
      col = lerp3(col, mul3(dark, 1.2), eyeBand * 0.55);
      col = lerp3(col, muzzle, sstep(-0.245, -0.28, z) * 0.85);
      col = lerp3(col, mul3(grey, 1.1), sstep(0.7, 0.98, up) * sstep(-0.16, -0.2, z) * sstep(-0.25, -0.22, z) * 0.5); // pale brow
    }
    const mot = 0.86 + 0.28 * vnoise3(x * 38, y * 38, z * 22, sd);
    // baked AO: belly between the legs, under the chin, the groin
    const ao = mix(0.5, 1, sstep(-0.95, 0.1, up)) * (z < -0.24 ? 1 : mix(0.82, 1, sstep(-0.6, -0.1, up) + sstep(0.06, 0.16, y)));
    col = mul3(col, mot * ao);
    const [b0, b1, w] = spineW(z);
    const furLen = (z < -0.225 ? 0.2 : z < -0.15 ? 0.6 : 1) * (cyy < -0.6 ? 0.2 : cyy < -0.2 ? 0.75 : 1) * (s < 0.04 ? 0.3 : 1);
    body.v(x, y, z, col, b0, b1, w, furLen);
  });

  // ears (base fur material): flattened ellipsoids, outward + back tilt, pale pink inner face
  for (const sx of [-1, 1]) {
    const cx = sx * 0.031, cyE = 0.222, cz = -0.178, ER = 7, ERING = 6;
    const ax = 0.026, ay = 0.034, az = 0.008, tilt = sx * 0.42, back = 0.3;
    const ct = Math.cos(tilt), st = Math.sin(tilt), cb = Math.cos(back), sb = Math.sin(back);
    ringGrid(limbs, ERING, ER, (r, j) => {
      const v = (r / (ERING - 1)) * Math.PI, u = (j / ER) * Math.PI * 2;
      let lx = ax * Math.sin(v) * Math.cos(u), ly = -ay * Math.cos(v), lz = az * Math.sin(v) * Math.sin(u);
      ly += ay * 0.15 * (1 - Math.sin(v)); // pointed-ish tip
      const front = Math.sin(u) < 0; // facing -Z = forward
      let col = front ? lerp3(pink, grey, 0.45 + 0.4 * Math.abs(lx / ax)) : mul3(dark, 1.3);
      if (ly < -ay * 0.6) col = lerp3(col, grey, 0.6);
      const ry2 = ly * cb - lz * sb, rz2 = ly * sb + lz * cb;
      const x = cx + lx * ct - ry2 * st, y = cyE + 0.02 + lx * st + ry2 * ct, z = cz + rz2;
      limbs.v(x, y, z, col, B.head, B.chest, 1, 0);
    });
  }

  // tail: bushy tube, grey at the root then black; slight droop in bind pose (bones curl it)
  const TR = 9, TRINGS = 15, TLEN = 0.34;
  ringGrid(tailP, TRINGS, TR, (r, j) => {
    const t = r / (TRINGS - 1);
    const z = 0.17 + t * TLEN, cy = 0.152 - t * 0.012;
    const rad = t < 0.02 ? 0.02 : (0.031 + 0.016 * sstep(0, 0.35, t) - 0.034 * sstep(0.45, 1, t) + 0.004 * Math.sin(t * 19 + sd)) * (t > 0.97 ? 0.4 : 1);
    const th = (j / TR) * Math.PI * 2, sx = Math.sin(th), cyy = Math.cos(th);
    const x = rad * sx, y = cy + rad * cyy * 0.92;
    let col = lerp3(grey, black, sstep(0.08, 0.3, t));
    col = mul3(col, (0.82 + 0.3 * vnoise3(x * 40, y * 40, z * 30, sd + 7)) * mix(0.7, 1, sstep(-1, 0.2, cyy)));
    const f = t * 4, bi = Math.min(3, Math.floor(f)), w = 1 - sstep(0.5, 1, f - bi);
    const b1 = Math.min(3, bi + 1);
    tailP.v(x, y, z, col, B.tail0 + bi, B.tail0 + b1, bi === b1 ? 1 : w, 1.6 * (1 - 0.6 * sstep(0.8, 1, t)));
  });

  // legs: tapered capsule from the joint into the paw; paws flattened, dark, pale claw tips
  for (const bi of [B.FL, B.FR, B.RL, B.RR]) {
    const [jx, jy, jz] = BONES[bi][2], rear = bi >= B.RL, LR = 7, LRINGS = 5;
    const r0 = rear ? 0.028 : 0.022, r1 = rear ? 0.015 : 0.013;
    ringGrid(limbs, LRINGS, LR, (r, j) => {
      const t = r / (LRINGS - 1), th = (j / LR) * Math.PI * 2;
      const rad = mix(r0, r1, sstep(0, 1, t)) * (t > 0.96 ? 0.5 : 1) * (t < 0.01 ? 0.45 : 1);
      const y = mix(jy - 0.008, 0.022, t), z = jz + (rear ? 0.02 * (1 - t) - 0.01 * t : -0.006 * t);
      const x = jx * (0.8 + 0.5 * t) + rad * Math.sin(th);
      let col = lerp3(grey, mul3(dark, 1.1), sstep(0.35, 0.85, t));
      col = mul3(col, mix(0.7, 1, 0.5 + 0.5 * Math.cos(th + (jx < 0 ? -1.2 : 1.2))));
      limbs.v(x, y, z + rad * Math.cos(th) * 0.9, col, bi, bi, 1, 0);
    });
    // paw
    const px = jx * 1.3, pz = jz - (rear ? 0.02 : 0.012), PR = 7, PRING = 5;
    ringGrid(limbs, PRING, PR, (r, j) => {
      const v = (r / (PRING - 1)) * Math.PI, u = (j / PR) * Math.PI * 2;
      const lx = 0.0125 * Math.sin(v) * Math.cos(u), ly = 0.01 * Math.sin(v) * Math.sin(u), lz = -(rear ? 0.03 : 0.022) * Math.cos(v);
      const tip = sstep(0.4, 1, -lz / 0.028);
      const col = lerp3(mul3(dark, 0.8), C(0x9a8a78), tip * sstep(0.004, -0.004, ly) * 0.8);
      limbs.v(px + lx, Math.max(0.0015, 0.011 + ly), pz + lz, col, bi, bi, 1, 0);
    });
  }

  // eyes + nose (wet material): big dark protruding eyes on the face, pink moist nose
  const eyeL = [0, 0, 0, 0, 0];
  loftAt(sAtZ(-0.203), eyeL);
  const eRows = 6, eRad = 8;
  for (const sx of [-1, 1]) {
    const er = 0.0128, ex = sx * (eyeL[2] * 0.74), ey = eyeL[1] + eyeL[3] * 0.4, ez = eyeL[0];
    ringGrid(wet, eRows, eRad, (r, j) => {
      const v = (r / (eRows - 1)) * Math.PI, u = (j / eRad) * Math.PI * 2;
      const lx = er * Math.cos(v), ly = er * Math.sin(v) * Math.cos(u), lz = er * Math.sin(v) * Math.sin(u) * 1.1;
      wet.v(ex + lx * 0.8, ey + ly, ez + lz, C(0x050403), B.head, B.chest, 1, 0);
    });
  }
  { const nr = 0.0085, nx0 = 0, ny0 = 0.1505, nz0 = -0.284, NR = 8, NRING = 5;
    ringGrid(wet, NRING, NR, (r, j) => {
      const v = (r / (NRING - 1)) * Math.PI, u = (j / NR) * Math.PI * 2;
      const lx = nr * 1.15 * Math.sin(v) * Math.cos(u), ly = nr * 0.8 * Math.sin(v) * Math.sin(u), lz = -nr * Math.cos(v);
      const nost = Math.abs(Math.abs(lx) - 0.004) < 0.0025 && lz < -0.005 && ly < 0.001 ? 0.25 : 1;
      wet.v(nx0 + lx, ny0 + ly, nz0 + lz, mul3(pink, nost), B.head, B.chest, 1, 0);
    }); }

  for (const p of [body, wet, tailP, limbs]) p.normals();

  // ---------------- merge base: [body, tail, limbs] fur group, then wet
  const base = merge([body, tailP, limbs], [wet], false);
  // ---------------- shells over body + tail (fur length per vertex), 3 layers; face + belly triangles skipped
  const shell = shellGeo([body, tailP], [0.34, 0.67, 1.0], look.furLen || 0.015);
  return { base, shell };
}

function merge(furParts, wetParts, isShell) {
  const all = [...furParts, ...wetParts];
  let nv = 0, ni = 0; for (const p of all) { nv += p.count; ni += p.idx.length; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), Cc = new Float32Array(nv * 3), SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4), F = new Float32Array(nv * 2);
  const I = new Uint16Array(ni);
  let ov = 0, oi = 0, furIdx = 0;
  for (let k = 0; k < all.length; k++) {
    const p = all[k];
    P.set(p.p, ov * 3); N.set(p.n, ov * 3); Cc.set(p.c, ov * 3); SI.set(p.si, ov * 4); SW.set(p.sw, ov * 4); F.set(p.fur, ov * 2);
    for (let i = 0; i < p.idx.length; i++) I[oi + i] = p.idx[i] + ov;
    ov += p.count; oi += p.idx.length; if (k === furParts.length - 1) furIdx = oi;
  }
  const g = geoFrom(P, N, Cc, SI, SW, F, I);
  if (!isShell) { g.addGroup(0, furIdx, 0); g.addGroup(furIdx, ni - furIdx, 1); }
  return g;
}

function shellGeo(parts, layers, len) {
  let nv = 0, ni = 0; for (const p of parts) { nv += p.count; ni += p.idx.length; }
  nv *= layers.length; ni *= layers.length;
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), Cc = new Float32Array(nv * 3), SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4), F = new Float32Array(nv * 2);
  const I = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const L of layers) for (const p of parts) {
    for (let i = 0; i < p.count; i++) {
      const fl = p.fur[i * 2 + 1] * len * L;
      for (let a = 0; a < 3; a++) { P[(ov + i) * 3 + a] = p.p[i * 3 + a] + p.n[i * 3 + a] * fl; N[(ov + i) * 3 + a] = p.n[i * 3 + a]; Cc[(ov + i) * 3 + a] = p.c[i * 3 + a]; }
      for (let a = 0; a < 4; a++) { SI[(ov + i) * 4 + a] = p.si[i * 4 + a]; SW[(ov + i) * 4 + a] = p.sw[i * 4 + a]; }
      F[(ov + i) * 2] = L; F[(ov + i) * 2 + 1] = p.fur[i * 2 + 1];
    }
    for (let i = 0; i < p.idx.length; i += 3) {
      const a = p.idx[i], b = p.idx[i + 1], c = p.idx[i + 2];
      if (Math.max(p.fur[a * 2 + 1], p.fur[b * 2 + 1], p.fur[c * 2 + 1]) < 0.3) continue; // bare face / hidden belly
      I[oi++] = a + ov; I[oi++] = b + ov; I[oi++] = c + ov;
    }
    ov += p.count;
  }
  const J = I.subarray(0, oi);
  return geoFrom(P, N, Cc, SI, SW, F, nv < 65535 ? Uint16Array.from(J) : J.slice());
}

function geoFrom(P, N, Cc, SI, SW, F, I) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(P, 3));
  g.setAttribute('normal', new BufferAttribute(N, 3));
  g.setAttribute('color', new BufferAttribute(Cc, 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(SI, 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute(SW, 4));
  g.setAttribute('aFur', new BufferAttribute(F, 2));
  const uv = new Float32Array((P.length / 3) * 2);
  for (let i = 0; i < P.length / 3; i++) { uv[i * 2] = P[i * 3 + 2] * 4; uv[i * 2 + 1] = P[i * 3 + 1] * 4; }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(new BufferAttribute(I, 1));
  g.computeBoundingSphere();
  return g;
}

