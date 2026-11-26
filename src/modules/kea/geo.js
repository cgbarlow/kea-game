// kea geometry — one merged, indexed BufferGeometry per bird (body frame: origin between the feet, -Z forward, +Y up,
// real scale: 46 cm beak-to-tail, ~0.95 m wingspan). Parts are tagged in `aPart` so the vertex shader can animate them
// bone-free: 0 body, 1 head (+ beak, eyes), 2 wing (side = sign x), 3 tail, 4 legs. Vertex colour = baked AO.
// Pivots (shared with shader.js): shoulder S, neck N, tail T, hip H.
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { R, ruv } from './tex.js';
import { clamp, sstep, mix } from '../../cookbook/geo/noise.js';

export const PIV = {
  S: [0.048, 0.178, -0.055],   // right shoulder (left mirrors x)
  N: [0, 0.168, -0.112],       // neck (head pitch / yaw)
  T: [0, 0.158, 0.098],        // tail root
  H: [0, 0.09, 0.0],           // hip (body pitch, leg tuck)
  WRIST: 0.17,                 // span distance of the wrist from the shoulder
};
const TAU = Math.PI * 2;

class Acc {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.part = []; this.idx = []; this.v = 0; }
  // parametric grid: fn(u,v,out) → position, uvf(u,v) → [s,t] atlas uv, ao(u,v,p) → 0..1. Normals by finite differences.
  grid(nu, nv, fn, uvf, ao, part, { flip = false, wrapU = false } = {}) {
    const base = this.v, P = new Vector3(), A = new Vector3(), B = new Vector3(), e = 1e-3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv;
      fn(u, v, P);
      const du = u + e <= 1 || wrapU ? e : -e, dv = v + e <= 1 ? e : -e;
      fn(u + du, v, A); A.sub(P).multiplyScalar(Math.sign(du) * 1e3);
      fn(u, v + dv, B); B.sub(P).multiplyScalar(Math.sign(dv) * 1e3);
      const N = A.cross(B); if (flip) N.negate(); if (N.lengthSq() < 1e-12) N.set(0, 1, 0); N.normalize();
      this.p.push(P.x, P.y, P.z); this.n.push(N.x, N.y, N.z);
      const t = uvf(u, v); this.uv.push(t[0], t[1]);
      const a = ao(u, v, P); this.c.push(a, a, a); this.part.push(part);
      this.v++;
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (flip) this.idx.push(a, c, b, b, c, d); else this.idx.push(a, b, c, b, d, c);
    }
  }
  // mirror everything from vertex `from` onward across x (left wing from the right one)
  mirrorFrom(from, ifrom) {
    const nv = this.v, map = this.v - from;
    for (let k = from; k < nv; k++) {
      this.p.push(-this.p[k * 3], this.p[k * 3 + 1], this.p[k * 3 + 2]);
      this.n.push(-this.n[k * 3], this.n[k * 3 + 1], this.n[k * 3 + 2]);
      this.uv.push(this.uv[k * 2], this.uv[k * 2 + 1]); this.c.push(this.c[k * 3], this.c[k * 3 + 1], this.c[k * 3 + 2]);
      this.part.push(this.part[k]); this.v++;
    }
    const ni = this.idx.length;
    for (let k = ifrom; k < ni; k += 3) this.idx.push(this.idx[k] + map, this.idx[k + 2] + map, this.idx[k + 1] + map);
  }
  build() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.c, 3));
    g.setAttribute('aPart', new Float32BufferAttribute(this.part, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere(); g.boundingSphere.radius = 0.7; // wings deform in the shader
    return g;
  }
}

// body: lofted superellipse from the neck (v=0) to the rump (v=1); u=0 is the back seam
function body(acc) {
  acc.grid(20, 18, (u, v, o) => {
    // deep keel/chest just behind the neck, tapering hard to a narrow rump (not a symmetric sausage)
    const th = u * TAU, k = Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * v)), 0.5) * (1 - 0.42 * sstep(0.3, 1, v));
    const chest = 1 + 0.16 * Math.exp(-((v - 0.28) ** 2) * 30);
    const a = 0.058 * k * chest, b = 0.064 * k * chest;
    const s = Math.sin(th), c = Math.cos(th);
    const bb = c < 0 ? b * (1.08 + 0.08 * Math.exp(-((v - 0.3) ** 2) * 20)) : b * 0.9;
    const se = (x) => Math.sign(x) * Math.pow(Math.abs(x), 0.85);
    o.set(a * se(s), 0.146 + (0.4 - v) * 0.02 + 0.03 * (1 - sstep(0, 0.28, v)) + 0.012 * sstep(0.5, 1, v) + bb * se(c), mix(-0.15, 0.128, v));
  }, (u, v) => ruv(R.body, u, v), (u, v) => {
    const c = Math.cos(u * TAU); return clamp(0.62 + 0.38 * sstep(-0.9, 0.4, c), 0, 1) * (0.85 + 0.15 * sstep(0, 0.2, v));
  }, 0, { wrapU: true, flip: true });
}

// head: an egg with its pole at the beak; t=0 is the face
function head(acc) {
  const C = [0, 0.19, -0.154];
  acc.grid(22, 14, (u, v, o) => {
    const th = u * TAU, ph = v * Math.PI;
    const rx = 0.039, ry = 0.042, rz = 0.05;
    const sp = Math.sin(ph), cp = Math.cos(ph);
    const flatTop = Math.cos(th) > 0 ? 0.93 : 1.0;
    o.set(C[0] + rx * sp * Math.sin(th), C[1] + ry * sp * Math.cos(th) * flatTop - 0.006 * sp * sp, C[2] - rz * cp + 0.006 * sp);
    // brow ridges: a hard shelf over each eye (the scowl that sells "offended"), cheek fullness below
    for (const sx of [-1, 1]) {
      const dx = o.x - sx * 0.03, dy = o.y - 0.212, dz = o.z + 0.172, d2 = dx * dx + dy * dy * 2.2 + dz * dz * 0.7;
      const bump = 0.0055 * Math.exp(-d2 / 0.00011);
      const cx = o.x - sx * 0.03, cy = o.y - 0.178, cz = o.z + 0.17, c2 = cx * cx + cy * cy + cz * cz;
      const cheek = 0.003 * Math.exp(-c2 / 0.00018);
      const nx = o.x - C[0], ny = o.y - C[1], nz = o.z - C[2], nl = Math.hypot(nx, ny, nz) || 1;
      o.x += (nx / nl) * (bump + cheek); o.y += (ny / nl) * (bump + cheek) + bump * 0.4; o.z += (nz / nl) * (bump + cheek);
    }
  }, (u, v) => ruv(R.head, u, v), (u, v) => 0.75 + 0.25 * sstep(-0.6, 0.6, Math.cos(u * TAU)), 1, { wrapU: true, flip: true });
  // eyes: glossy domes set under the brow, proud of the face so they catch a highlight
  for (const sx of [-1, 1]) {
    const E = [sx * 0.0335, 0.2, -0.171], r = 0.0085;
    acc.grid(12, 7, (u, v, o) => {
      const th = u * TAU, ph = v * Math.PI * 0.55;
      const a = Math.sin(ph) * Math.cos(th), b = Math.sin(ph) * Math.sin(th), n = Math.cos(ph);
      o.set(E[0] + sx * n * r * 0.8, E[1] + a * r, E[2] + b * r);
    }, (u, v) => { const ph = v * Math.PI * 0.55, th = u * TAU; return ruv(R.eye, 0.5 + Math.sin(ph) * Math.sin(th) * 0.9, 0.5 + Math.sin(ph) * Math.cos(th) * 0.9); },
    () => 1, 1, { flip: sx > 0, wrapU: true });
  }
}

// beak: the long curved upper mandible (culmen hooking down and back) + a short lower mandible
function beakPart(acc, base, len, a0, a1, pw, w0, h0, n = 14) {
  const pts = [], P = [base[1], base[2]]; let ang = a0;
  for (let i = 0; i <= n; i++) {
    const t = i / n; ang = a0 + (a1 - a0) * Math.pow(t, pw);
    pts.push([P[0], P[1], ang]);
    P[0] += Math.sin(ang) * len / n; P[1] += -Math.cos(ang) * len / n;
  }
  acc.grid(10, n, (u, v, o) => {
    const fi = Math.min(n, v * n), i0 = Math.floor(Math.min(n - 1, fi)), f = fi - i0, q0 = pts[i0], q1 = pts[i0 + 1];
    const y = mix(q0[0], q1[0], f), z = mix(q0[1], q1[1], f), ang2 = mix(q0[2], q1[2], f);
    // tangent (0, sin, -cos); normal toward the culmen (0, cos, sin)
    const ny = Math.cos(ang2), nz = Math.sin(ang2);
    const w = w0 * Math.pow(1 - v, 0.55) + 0.0008, h = h0 * Math.pow(1 - v, 0.7) + 0.0012;
    const th = u * TAU, sx = Math.sin(th), cy = Math.cos(th);
    const keel = cy > 0 ? 1 : 0.8;                                    // culmen ridge vs cutting edge
    const px = w * sx * (1 - 0.35 * Math.max(0, cy)), py = (cy * keel - 1) * h * 0.5;
    o.set(px, y + ny * py, z + nz * py);
  }, (u, v) => ruv(R.beak, u, v), (u, v) => 0.8 + 0.2 * Math.cos(u * TAU), 1, { wrapU: true });
}

// wing (right): span x 0..WL from the shoulder, chord from the leading edge; closed aerofoil (top t:0→1, bottom back).
// The membrane carries the coverts + secondaries; the hand's primaries are separate blades (primaries()) so the tip
// fingers open when the wing spreads.
const WL = 0.31;
function chordAt(x) {
  const r = x / WL;
  const le = -0.03 - 0.02 * sstep(0, 0.42, r) + 0.03 * Math.pow(sstep(0.6, 1, r), 1.5);
  let ch = x < PIV.WRIST ? mix(0.15, 0.14, x / PIV.WRIST) : 0.14 * (1 - 0.3 * sstep(PIV.WRIST, WL, x));
  if (x > 0.22) ch *= Math.sqrt(Math.max(0.12, 1 - ((x - 0.22) / (WL - 0.22 + 0.005)) ** 2));
  const f = (x / 0.021) % 1; ch -= 0.008 * (1 - Math.sin(Math.PI * f)) * (1 - sstep(0.19, 0.24, x));   // secondary tips
  return [le, Math.max(0.02, ch)];
}
function wing(acc) {
  const S = PIV.S, v0 = acc.v, i0 = acc.idx.length;
  for (const top of [true, false]) {
    acc.grid(30, 5, (u, v, o) => {
      const x = u * WL, [le, ch] = chordAt(x), c = v;
      const r = x / WL, thick = (0.013 * Math.pow(1 - r, 1.3) + 0.0014) * Math.sqrt(c) * (1 - c) * 2.2;
      const camber = 0.009 * Math.sin(Math.PI * c) * (1 - r * 0.7) - 0.008 * r * r;
      o.set(S[0] + x, S[1] + camber + (top ? thick : -thick * 0.45), S[2] + le + c * ch);
    }, (u, v) => ruv(top ? R.wingTop : R.wingUnder, u * 0.82, v), (u, v) => top ? 0.9 + 0.1 * u : 0.55 + 0.45 * sstep(0, 0.35, u), 2, { flip: top });
  }
  primaries(acc);
  acc.mirrorFrom(v0, i0);
}
// 7 primaries fanning from the hand: outermost points along the span, inner ones sweep back toward the secondaries.
// Outer three are emarginated (narrow distal vanes) so the tip reads as separated "fingers".
function primaries(acc) {
  const S = PIV.S, NP = 7;
  for (let i = 0; i < NP; i++) {
    const xr = 0.29 - i * 0.018, [le, ch] = chordAt(xr), zr = le + ch * (0.3 + i * 0.04);
    const a = 0.04 + i * 0.15, L = 0.155 - i * 0.011, W = 0.0155 + i * 0.0008, ca = Math.cos(a), sa = Math.sin(a);
    const yb = -0.0016 * i - 0.004 * (xr / WL) * (xr / WL);
    for (const top of [true, false]) {
      acc.grid(2, 8, (u, v, o) => {
        const emarg = i < 3 ? 1 - 0.38 * sstep(0.42, 0.6, v) : 1;
        const tip = v > 0.86 ? Math.sqrt(Math.max(0.04, 1 - ((v - 0.86) / 0.145) ** 2)) : 1;
        const w = W * emarg * tip * (0.75 + 0.25 * sstep(0, 0.15, v)), x = (u * 2 - 1) * w, along = v * L;
        const th = 0.0016 * (1 - v * 0.6) * (1 - (u * 2 - 1) ** 2);
        const droop = -0.014 * v * v - 0.003 * (u * 2 - 1) * v, curl = 0.012 * v * v;   // tips droop and curl back
        o.set(S[0] + xr + ca * along - sa * (x + curl), S[1] + yb + droop + (top ? th : -th), S[2] + zr + sa * along + ca * (x + curl));
      }, (u, v) => ruv(top ? R.wingTop : R.wingUnder, (15 + u) / 18, 0.36 + v * 0.62), (u, v) => top ? 0.8 + 0.2 * v : 0.6 + 0.3 * v, 2, { flip: !top });
    }
  }
}

// tail: a broad, slightly cupped slab with a rounded tip
function tail(acc) {
  const T = PIV.T, Lt = 0.165;
  for (const top of [true, false]) {
    acc.grid(8, 10, (u, v, o) => {
      const w = mix(0.028, 0.052, Math.pow(v, 0.8)) * (v > 0.85 ? Math.sqrt(Math.max(0.05, 1 - ((v - 0.85) / 0.155) ** 2)) : 1);
      const x = (u * 2 - 1) * w, cup = -0.006 * (1 - (u * 2 - 1) ** 2) * v;
      const th = 0.008 * (1 - v * 0.6) * (1 - (u * 2 - 1) ** 4);
      o.set(x, T[1] - 0.004 - v * 0.035 + cup + (top ? th : -th), T[2] - 0.01 + v * Lt);
    }, (u, v) => ruv(top ? R.tailTop : R.tailUnder, u, v), (u, v) => top ? 0.85 + 0.15 * v : 0.6 + 0.3 * v, 3, { flip: top });
  }
}

// legs: short grey tarsi + zygodactyl feet (two toes forward, two back), feet at y=0
function tubeSeg(acc, a, b, r0, r1, part, n = 6, m = 3) {
  const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], L = Math.hypot(ax, ay, az);
  const T = new Vector3(ax / L, ay / L, az / L), U = Math.abs(T.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const X = new Vector3().crossVectors(T, U).normalize(), Y = new Vector3().crossVectors(X, T);
  acc.grid(n, m, (u, v, o) => {
    const th = u * TAU, r = mix(r0, r1, v) * (v === 1 ? 0.2 : 1);
    o.set(a[0] + ax * v + (X.x * Math.cos(th) + Y.x * Math.sin(th)) * r, a[1] + ay * v + (X.y * Math.cos(th) + Y.y * Math.sin(th)) * r,
      a[2] + az * v + (X.z * Math.cos(th) + Y.z * Math.sin(th)) * r);
  }, (u, v) => ruv(R.leg, u, v), () => 0.7, part, { wrapU: true, flip: true });
}
function legs(acc) {
  for (const sx of [-1, 1]) {
    const hip = [sx * 0.026, 0.092, 0.004], ank = [sx * 0.03, 0.014, -0.006];
    tubeSeg(acc, hip, ank, 0.0105, 0.0068, 4, 7, 3);
    for (const [dz, dx] of [[-0.03, 0.006], [-0.028, -0.008], [0.024, 0.01], [0.022, -0.004]])
      tubeSeg(acc, [ank[0], 0.012, ank[2]], [ank[0] + dx * sx, 0.004, ank[2] + dz], 0.0042, 0.003, 4, 5, 2);
  }
}

export function buildKeaGeometry() {
  const acc = new Acc();
  body(acc); head(acc);
  beakPart(acc, [0, 0.201, -0.192], 0.062, -0.3, -2.5, 1.6, 0.0125, 0.028, 16);   // upper mandible: forward, hooking down
  beakPart(acc, [0, 0.177, -0.19], 0.024, -0.4, -0.8, 1.0, 0.0105, 0.012, 8); // lower mandible
  wing(acc); tail(acc); legs(acc);
  return acc.build();
}

// a single loose contour/covert feather for the blown puffs (~10 cm), base at origin along +Z
export function buildFeatherGeometry() {
  const acc = new Acc();
  acc.grid(3, 6, (u, v, o) => {
    const w = 0.016 * Math.sin(Math.PI * Math.min(1, v * 1.15)) + 0.002, x = (u * 2 - 1) * w;
    o.set(x, 0.006 * Math.sin(Math.PI * v) - 0.004 * (u * 2 - 1) ** 2, v * 0.085);
  }, (u, v) => ruv(R.body, 0.08 + u * 0.06, 0.2 + v * 0.12), () => 1, 0);
  return acc.build();
}
