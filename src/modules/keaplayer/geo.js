// keaplayer/geo — view-model geometry, built once in HEAD SPACE (the eye/camera at the origin, -Z forward, +Y up,
// metres at ~1.6x life size so the beak reads at the bottom of the frame).
//   buildBeak()     → { upper, lower, hinge, jaw, tip }   upper mandible + cere (origin at the culmen hinge), lower
//                     mandible + tongue (origin at the jaw hinge); tip = the hook point in upper-mandible space
//   buildFeathers() → one geometry: face mound (aSide 0) + right wing (aSide +1) + left wing (aSide -1), v1 kea atlas UVs;
//                     aUnder = 1 on the underwing (orange flash); wings in shoulder space (span +x / -x, chord +z)
//   buildParts()    → { wiper, seal, mirror, strap, cone } hanging from the beak grip (origin) along -Y, vertex colours
import { BufferGeometry, Float32BufferAttribute, Vector3, Color } from 'three';
import { R, ruv } from '../kea/tex.js';
import { BR, buv } from './tex.js';
import { clamp, sstep, mix } from '../../cookbook/geo/noise.js';

const TAU = Math.PI * 2;

class Acc {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.side = []; this.under = []; this.idx = []; this.v = 0; this.S = 0; this.U = 0; }
  // parametric grid: fn(u,v,out) → position, uvf(u,v) → [s,t], col(u,v,p) → number (AO) or [r,g,b] (linear)
  grid(nu, nv, fn, uvf, col, { flip = false, wrapU = false } = {}) {
    const base = this.v, P = new Vector3(), A = new Vector3(), B = new Vector3(), e = 1e-3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv;
      fn(u, v, P);
      const du = u + e <= 1 || wrapU ? e : -e, dv = v + e <= 1 ? e : -e;
      fn(u + du, v, A); A.sub(P).multiplyScalar(Math.sign(du) * 1e3);
      fn(u, v + dv, B); B.sub(P).multiplyScalar(Math.sign(dv) * 1e3);
      const N = A.cross(B); if (flip) N.negate(); if (N.lengthSq() < 1e-14) N.set(0, 1, 0); N.normalize();
      this.p.push(P.x, P.y, P.z); this.n.push(N.x, N.y, N.z);
      const t = uvf ? uvf(u, v) : [0, 0]; this.uv.push(t[0], t[1]);
      const a = col(u, v, P); if (typeof a === 'number') this.c.push(a, a, a); else this.c.push(a[0], a[1], a[2]);
      this.side.push(this.S); this.under.push(this.U);
      this.v++;
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (flip) this.idx.push(a, c, b, b, c, d); else this.idx.push(a, b, c, b, d, c);
    }
  }
  // flat-shaded box (parts), colour linear rgb
  box(cx, cy, cz, sx, sy, sz, col) {
    const h = [sx / 2, sy / 2, sz / 2];
    const F = [[0, 1, 2, 1], [0, 1, 2, -1], [1, 2, 0, 1], [1, 2, 0, -1], [2, 0, 1, 1], [2, 0, 1, -1]];
    for (const [a, b, n, s] of F) {
      const base = this.v;
      for (const [ua, ub] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const q = [0, 0, 0]; q[n] = s * h[n]; q[a] = ua * h[a]; q[b] = ub * h[b];
        this.p.push(cx + q[0], cy + q[1], cz + q[2]);
        const nn = [0, 0, 0]; nn[n] = s; this.n.push(nn[0], nn[1], nn[2]);
        this.uv.push(0, 0); this.c.push(col[0], col[1], col[2]); this.side.push(this.S); this.under.push(this.U); this.v++;
      }
      // winding: (a,b) basis cross = +n axis (cyclic) → CCW for s>0
      if (s > 0) this.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      else this.idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  // tube along a polyline pts [[x,y,z]...], radius r(t) (t 0..1), elliptic section (sx, sy scale), colour fn(t, th)
  tube(pts, r, col, { n = 10, sx = 1, sy = 1, cap = true } = {}) {
    const m = pts.length - 1, T = new Vector3(), X = new Vector3(), Y = new Vector3(), up = new Vector3(0, 0, 1);
    const at = (v, o) => { const f = v * m, i = Math.min(m - 1, Math.floor(f)), k = f - i, a = pts[i], b = pts[i + 1]; return o.set(mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)); };
    const tmp = new Vector3();
    this.grid(n, m * 3, (u, v, o) => {
      at(v, o); at(Math.min(1, v + 0.01), T); at(Math.max(0, v - 0.01), tmp); T.sub(tmp).normalize();
      X.crossVectors(T, Math.abs(T.z) > 0.9 ? Y.set(1, 0, 0) : up).normalize(); Y.crossVectors(X, T);
      const th = u * TAU, rr = r(v) * (cap && (v <= 0 || v >= 1) ? 0.05 : 1);
      o.addScaledVector(X, Math.cos(th) * rr * sx).addScaledVector(Y, Math.sin(th) * rr * sy);
    }, null, (u, v) => col(v, u), { wrapU: true });
  }
  mirrorFrom(from, ifrom, side) {
    const nv = this.v, map = this.v - from;
    for (let k = from; k < nv; k++) {
      this.p.push(-this.p[k * 3], this.p[k * 3 + 1], this.p[k * 3 + 2]);
      this.n.push(-this.n[k * 3], this.n[k * 3 + 1], this.n[k * 3 + 2]);
      this.uv.push(this.uv[k * 2], this.uv[k * 2 + 1]); this.c.push(this.c[k * 3], this.c[k * 3 + 1], this.c[k * 3 + 2]);
      this.side.push(side); this.under.push(this.under[k]); this.v++;
    }
    const ni = this.idx.length;
    for (let k = ifrom; k < ni; k += 3) this.idx.push(this.idx[k] + map, this.idx[k + 2] + map, this.idx[k + 1] + map);
  }
  build(extra = false) {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.c, 3));
    if (extra) { g.setAttribute('aSide', new Float32BufferAttribute(this.side, 1)); g.setAttribute('aUnder', new Float32BufferAttribute(this.under, 1)); }
    g.setIndex(this.idx);
    g.computeBoundingSphere(); g.boundingSphere.radius = Math.max(g.boundingSphere.radius, 1);
    return g;
  }
}

// ------------------------------------------------------------------------------------------- beak
// curved centreline in the (y,z) plane from the origin: angle a (0 = straight ahead -Z, + = up), returns samples
function centreline(L, a0, a1, pw, n) {
  const pts = []; let y = 0, z = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + (a1 - a0) * Math.pow(t, pw);
    pts.push([y, z, a]);
    y += Math.sin(a) * L / n; z += -Math.cos(a) * L / n;
  }
  return pts;
}
function sample(pts, v) {
  const n = pts.length - 1, f = Math.min(n, v * n), i = Math.min(n - 1, Math.floor(f)), k = f - i, a = pts[i], b = pts[i + 1];
  return [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
}
export const BEAK = {
  hinge: [-0.032, -0.032, -0.056],   // culmen base in head space (upper mandible pivot), lower left of the frame
  L: 0.072, a0: 0.32, a1: -2.85, pw: 2.5, w0: 0.0062, h0: 0.027,
};
// upper-mandible section at (t, theta): x half-width, d depth below the culmen
function upperSection(t, th) {
  const w = BEAK.w0 * Math.pow(1 - t, 0.5) * (1 + 0.12 * (1 - sstep(0, 0.2, t))) + 0.0005, h = BEAK.h0 * Math.pow(1 - t, 0.75) + 0.0009;
  const cs = Math.cos(th), sn = Math.sin(th);
  const x = w * Math.sign(sn) * Math.pow(Math.abs(sn), 0.75) * (1 - 0.3 * Math.max(0, -cs));
  // a crisp culmen ridge (slight keel on top), sides flat, the cutting edge a thin blade
  const d = h * (1 - cs) / 2 - 0.0009 * Math.max(0, cs) ** 6 * (1 - t);
  return [x, d];
}
export function buildBeak() {
  const B = BEAK, up = new Acc(), lo = new Acc();
  const C = centreline(B.L, B.a0, B.a1, B.pw, 48);
  // upper mandible (origin = hinge)
  up.grid(30, 48, (u, v, o) => {
    const [y, z, a] = sample(C, v), th = u * TAU, [x, d] = upperSection(v, th);
    // section hangs below the culmen along -U, U = (cos a, sin a) in (y,z)
    o.set(x, y - Math.cos(a) * d, z - Math.sin(a) * d);
  }, (u, v) => buv(BR.upper, u, v), (u, v) => {
    const cs = Math.cos(u * TAU);
    return (0.62 + 0.38 * sstep(-0.6, 0.7, cs)) * (0.82 + 0.18 * sstep(0, 0.15, v));
  }, { wrapU: true });
  // cere: a fleshy grey saddle over the base, merging into the keratin at its front edge
  up.grid(30, 8, (u, v, o) => {
    const th = u * TAU, cs = Math.cos(th), sn = Math.sin(th);
    const along = mix(-0.016, 0.008, v);                       // metres along the initial direction (− = behind)
    const swell = 1.06 - 0.06 * sstep(0.55, 1, v);
    const w = B.w0 * 1.06 * swell, h = B.h0 * 1.01;
    const x = w * Math.sign(sn) * Math.pow(Math.abs(sn), 0.7) * (1 - 0.25 * Math.max(0, -cs));
    const d = h * (1 - cs) / 2 - 0.0016 * swell * Math.max(0, cs) - 0.001 * (swell - 1) * 6;
    const a = B.a0;
    o.set(x, Math.sin(a) * along - Math.cos(a) * d, -Math.cos(a) * along - Math.sin(a) * d);
  }, (u, v) => buv(BR.cere, u, v), (u, v) => 0.7 + 0.3 * sstep(-0.4, 0.8, Math.cos(u * TAU)), { wrapU: true });
  const tipS = C[C.length - 1];
  const tip = new Vector3(0, tipS[0], tipS[1]);
  const upper = up.build();

  // lower mandible (origin = jaw hinge, under the upper's cutting edge): a deep trough, cutting edge on top
  const Lc = centreline(0.05, 0.2, -0.75, 1.6, 20), lw = 0.0068, lh = 0.013;
  lo.grid(24, 20, (u, v, o) => {
    const [y, z, a] = sample(Lc, v), th = u * TAU, cs = Math.cos(th), sn = Math.sin(th);
    const w = lw * Math.pow(1 - v, 0.45) + 0.0006, h = lh * Math.pow(1 - v, 0.6) + 0.0008;
    const x = w * Math.sign(sn) * Math.pow(Math.abs(sn), 0.8);
    const d = h * (1 - cs) / 2;                                 // cs = 1: cutting edge (top), hangs below
    o.set(x, y - Math.cos(a) * d, z - Math.sin(a) * d);
  }, (u, v) => buv(BR.lower, u, v), (u, v) => 0.6 + 0.4 * sstep(-0.5, 0.8, Math.cos(u * TAU)), { wrapU: true });
  // tongue: dark, blunt, set back in the trough
  lo.grid(16, 10, (u, v, o) => {
    const th = u * TAU, ph = v * Math.PI;
    o.set(0.0052 * Math.sin(ph) * Math.sin(th), -0.0015 + 0.0034 * Math.sin(ph) * Math.cos(th), -0.012 - 0.0085 * Math.cos(ph));
  }, (u, v) => buv(BR.mouth, u, v), () => 0.9, { wrapU: true, flip: true });
  const lower = lo.build();
  return { upper, lower, tip, hinge: new Vector3().fromArray(B.hinge), jaw: new Vector3(0, -B.h0 * 0.92, 0.006) };
}

// ------------------------------------------------------------------------------------------- feathers
// v1 wing planform (modules/kea/geo.js) scaled up for the view model
const WSC = 1.3, WL = 0.31, WRIST = 0.17;
function chordAt(x) {
  const r = x / WL;
  const le = -0.03 - 0.02 * sstep(0, 0.42, r) + 0.03 * Math.pow(sstep(0.6, 1, r), 1.5);
  let ch = x < WRIST ? mix(0.15, 0.14, x / WRIST) : 0.14 * (1 - 0.3 * sstep(WRIST, WL, x));
  if (x > 0.22) ch *= Math.sqrt(Math.max(0.12, 1 - ((x - 0.22) / (WL - 0.22 + 0.005)) ** 2));
  const f = (x / 0.021) % 1; ch -= 0.008 * (1 - Math.sin(Math.PI * f)) * (1 - sstep(0.19, 0.24, x));
  return [le, Math.max(0.02, ch)];
}
function wing(acc) {
  for (const top of [true, false]) {
    acc.U = top ? 0 : 1;
    acc.grid(44, 8, (u, v, o) => {
      const x = u * WL, [le, ch] = chordAt(x), c = v;
      const r = x / WL;
      // thick rounded leading edge (the marginal coverts the eye sees sweep past), thin trailing edge
      const thick = (0.016 * Math.pow(1 - r, 1.2) + 0.0018) * Math.pow(Math.sin(Math.PI * Math.min(1, c * 0.5 + 0.5 * Math.sqrt(c))), 1) * (1 - c * 0.85) * 1.6;
      const camber = 0.011 * Math.sin(Math.PI * c) * (1 - r * 0.7) - 0.008 * r * r;
      o.set(x * WSC, (camber + (top ? thick : -thick * 0.5)) * WSC, (le + c * ch) * WSC);
    }, (u, v) => ruv(top ? R.wingTop : R.wingUnder, u * 0.82, v), (u, v) => top ? 0.88 + 0.12 * u : 0.75 + 0.25 * sstep(0, 0.35, u), { flip: top });
  }
  const NP = 7;
  for (let i = 0; i < NP; i++) {
    const xr = 0.29 - i * 0.018, [le, ch] = chordAt(xr), zr = le + ch * (0.3 + i * 0.04);
    const a = 0.04 + i * 0.15, Lp = 0.155 - i * 0.011, W = 0.0155 + i * 0.0008, ca = Math.cos(a), sa = Math.sin(a);
    const yb = -0.0016 * i - 0.004 * (xr / WL) * (xr / WL);
    for (const top of [true, false]) {
      acc.U = top ? 0 : 1;
      acc.grid(3, 10, (u, v, o) => {
        const emarg = i < 3 ? 1 - 0.38 * sstep(0.42, 0.6, v) : 1;
        const tipc = v > 0.86 ? Math.sqrt(Math.max(0.04, 1 - ((v - 0.86) / 0.145) ** 2)) : 1;
        const w = W * emarg * tipc * (0.75 + 0.25 * sstep(0, 0.15, v)), x = (u * 2 - 1) * w, along = v * Lp;
        const th = 0.0018 * (1 - v * 0.6) * (1 - (u * 2 - 1) ** 2);
        const droop = -0.012 * v * v - 0.003 * (u * 2 - 1) * v, curl = 0.012 * v * v;
        o.set((xr + ca * along - sa * (x + curl)) * WSC, (yb + droop + (top ? th : -th)) * WSC, (zr + sa * along + ca * (x + curl)) * WSC);
      }, (u, v) => ruv(top ? R.wingTop : R.wingUnder, (15 + u) / 18, 0.36 + v * 0.62), (u, v) => top ? 0.8 + 0.2 * v : 0.7 + 0.3 * v, { flip: !top });
    }
  }
}
export const FACE = { c: [-0.042, -0.046, -0.046], r: [0.03, 0.022, 0.026] };
function face(acc) {
  // the forehead / lores mound the beak grows out of, seen from just above and behind: scalloped olive head plumage,
  // darkest at the beak base (the atlas head region's dark face at t ≈ 0)
  const C = FACE.c, Rr = FACE.r, bz = BEAK.hinge;
  acc.S = 0; acc.U = 0;
  acc.grid(40, 18, (u, v, o) => {
    const ph = mix(-1.45, 1.45, u), ps = mix(-0.35, 1.45, v);
    const cp = Math.cos(ps);
    o.set(C[0] + Rr[0] * Math.sin(ph) * cp, C[1] + Rr[1] * Math.sin(ps), C[2] - Rr[2] * Math.cos(ph) * cp);
    // feathers ruffle out a touch toward the cheeks; a soft ridge (brow) above each side
    const brow = 0.003 * Math.exp(-((Math.abs(ph) - 0.75) ** 2) * 10) * sstep(0.2, 0.9, ps);
    o.y += brow;
  }, (u, v) => {
    const ph = mix(-1.45, 1.45, u), ps = mix(-0.35, 1.45, v);
    const d = Math.hypot(ph * 0.9, (ps - 0.55) * 1.2);             // angular distance from the beak base
    return ruv(R.head, 0.5 + ph * 0.3, clamp(0.02 + d * 0.55, 0, 1));
  }, (u, v, P) => {
    const ph = mix(-1.45, 1.45, u), ps = mix(-0.35, 1.45, v);
    const dB = Math.hypot(P.x - bz[0], (P.y - bz[1]) * 1.3, P.z - bz[2]);
    return (0.55 + 0.45 * sstep(0.008, 0.03, dB)) * (0.7 + 0.3 * sstep(-0.3, 0.6, ps)) * (0.85 + 0.15 * Math.cos(ph));
  }, { flip: true });
}
export function buildFeathers() {
  const acc = new Acc();
  face(acc);
  const v0 = acc.v, i0 = acc.idx.length;
  acc.S = 1; wing(acc);
  acc.mirrorFrom(v0, i0, -1);
  return acc.build(true);
}

// ------------------------------------------------------------------------------------------- carried parts
const lin = (hex) => { const c = new Color(hex); return [c.r, c.g, c.b]; };   // Color(hex) converts sRGB → linear
export function buildParts() {
  const out = {};
  const RUB = lin(0x101112), MET = lin(0x2a2c2e), STEEL = lin(0x8a8e92), ORANGE = lin(0xf05a0c), WHITE = lin(0xe8e6e0);
  { // wiper blade: rubber blade under a dark sprung frame, gripped at the arm clip
    const a = new Acc(), L = 0.17;
    a.box(0, -L / 2 - 0.004, 0, 0.0035, L, 0.0055, RUB);
    a.box(0.0002, -L / 2 - 0.004, 0.0045, 0.0028, L * 0.96, 0.0038, MET);
    for (const f of [0.15, 0.5, 0.85]) a.box(0, -0.004 - L * f, 0.0075, 0.0034, 0.012, 0.004, MET);
    a.box(0, -0.003, 0.004, 0.005, 0.009, 0.007, lin(0x3c3e40));      // the clip that came off the arm
    out.wiper = a.build();
  }
  { // windscreen seal strip: a floppy rubber D-section, torn at both ends
    const a = new Acc(), pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([0.025 * Math.sin(t * 3.4) + 0.01 * t, -t * 0.15, 0.018 * Math.sin(t * 2.2 + 0.4)]); }
    a.tube(pts, () => 0.0032, (t) => { const k = 0.8 + 0.2 * Math.sin(t * 40); return [RUB[0] * k + 0.004, RUB[1] * k + 0.004, RUB[2] * k + 0.004]; }, { n: 8, sx: 1, sy: 0.6, cap: false });
    out.seal = a.build();
  }
  { // kerb-side mirror head (the glass is mostly gone), arm stub in the beak
    const a = new Acc();
    a.tube([[0, 0, 0], [0, -0.012, 0.002], [0.002, -0.02, 0.002]], () => 0.0035, () => RUB, { n: 8 });
    a.box(0, -0.055, 0, 0.034, 0.066, 0.014, lin(0x1c1d1e));
    a.box(0, -0.055, 0.0075, 0.028, 0.058, 0.0015, lin(0x9fb2c0));
    a.box(0.006, -0.04, 0.0086, 0.012, 0.022, 0.0008, lin(0x1c1d1e));   // missing shard
    out.mirror = a.build();
  }
  { // roof-pod ratchet strap: yellow webbing, steel ratchet buckle swinging at the far end
    const a = new Acc(), pts = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push([0.012 * Math.sin(t * 5), -t * 0.16, 0.008 * Math.sin(t * 3 + 1)]); }
    a.tube(pts, () => 0.0062, (t) => { const s = 0.85 + 0.15 * Math.sin(t * 90); const y = lin(0xe8a414); return [y[0] * s, y[1] * s, y[2] * s]; }, { n: 6, sx: 1, sy: 0.18, cap: false });
    a.box(0.002, -0.168, 0.0, 0.016, 0.026, 0.008, STEEL);
    a.box(0.002, -0.172, 0.005, 0.012, 0.012, 0.004, lin(0x3a3c3e));
    out.strap = a.build();
  }
  { // the Department's road cone, held by its tip: orange PVC, two retro-reflective white collars, black square base
    const a = new Acc(), H = 0.21, R0 = 0.006, R1 = 0.062;
    a.grid(28, 24, (u, v, o) => {
      const th = u * TAU, y = -v * H, r = mix(R0, R1, v) * (v > 0.995 ? 1.01 : 1);
      o.set(Math.cos(th) * r, y, Math.sin(th) * r);
    }, null, (u, v) => {
      const band = (v > 0.36 && v < 0.47) || (v > 0.6 && v < 0.7);
      const c = band ? WHITE : ORANGE, ao = 0.75 + 0.25 * Math.cos(u * TAU - 1.2) * 0.5 + 0.125;
      return [c[0] * ao, c[1] * ao, c[2] * ao];
    }, { wrapU: true, flip: false });
    a.box(0, -H - 0.004, 0, 0.13, 0.008, 0.13, lin(0x161616));
    out.cone = a.build();
  }
  return out;
}
