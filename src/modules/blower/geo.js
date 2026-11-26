// blower/geo — small geometry helpers for the view model (load-time only; all outputs are kit-compatible indexed
// BufferGeometry with position/normal/uv/color, metric UVs).
//   ringLoft(rings, n)  superellipse rings along any path → one smooth skin (tube sections, lips, flat nozzle)
//   alongAxis(geo, a, b) a +Y-axis geometry (lathe output, base y=0) re-oriented to run from a to b
//   fingerPath(...)     arc points around a bar (glove fingers)
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Matrix4, Quaternion, Vector3, Color } from 'three';

const _c = new Color();
const sgnPow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

// rings: [{ x, y, z, a, b, p=2, color }] — a = half width (X), b = half height (Y), p = superellipse exponent
// (2 = ellipse, 6+ = rounded rectangle). Rings lie in the local XY plane at their centre; consecutive rings are
// bridged. A ring list that turns back on itself (mouth lip → interior) gives inward-facing walls automatically.
export function ringLoft(rings, n = 48, { capStart = false } = {}) {
  const R = rings.length, pos = new Float32Array((R * n + (capStart ? 1 : 0)) * 3), uv = new Float32Array((R * n + (capStart ? 1 : 0)) * 2);
  const col = new Float32Array((R * n + (capStart ? 1 : 0)) * 3);
  let s = 0;
  for (let r = 0; r < R; r++) {
    const g = rings[r], p = g.p ?? 2, e = 2 / p;
    if (r > 0) { const h = rings[r - 1]; s += Math.hypot(g.x - h.x, g.y - h.y, g.z - h.z, (g.a - h.a)); }
    _c.set(g.color ?? 0xffffff);
    const per = Math.PI * (g.a + g.b);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2, k = (r * n + i);
      pos[k * 3] = g.x + g.a * sgnPow(Math.cos(t), e);
      pos[k * 3 + 1] = g.y + g.b * sgnPow(Math.sin(t), e);
      pos[k * 3 + 2] = g.z;
      uv[k * 2] = (i / n) * per; uv[k * 2 + 1] = s;
      col[k * 3] = _c.r; col[k * 3 + 1] = _c.g; col[k * 3 + 2] = _c.b;
    }
  }
  const idx = [];
  for (let r = 0; r < R - 1; r++) for (let i = 0; i < n; i++) {
    const a = r * n + i, b = r * n + ((i + 1) % n), c = (r + 1) * n + i, d = (r + 1) * n + ((i + 1) % n);
    idx.push(a, c, b, b, c, d);
  }
  if (capStart) {
    const k = R * n, g = rings[0]; pos[k * 3] = g.x; pos[k * 3 + 1] = g.y; pos[k * 3 + 2] = g.z + 0.002;
    _c.set(g.color ?? 0xffffff); col[k * 3] = _c.r; col[k * 3 + 1] = _c.g; col[k * 3 + 2] = _c.b;
    for (let i = 0; i < n; i++) idx.push(k, (i + 1) % n, i);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  geo.setIndex(new Uint32BufferAttribute(new Uint32Array(idx), 1));
  geo.computeVertexNormals();
  return geo;
}

// Re-orient a geometry built around +Y (base at y = 0) so it runs from point a to point b.
const _m = new Matrix4(), _q = new Quaternion(), _d = new Vector3(), _up = new Vector3(0, 1, 0), _one = new Vector3(1, 1, 1), _p = new Vector3();
export function alongAxis(geo, a, b, spin = 0) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  _q.setFromUnitVectors(_up, _d);
  if (spin) _q.multiply(new Quaternion().setFromAxisAngle(_up, spin));
  _m.compose(_p.set(a[0], a[1], a[2]), _q, _one);
  geo.applyMatrix4(_m);
  return geo;
}

// Points of an arc around a bar whose axis is Z (centre cx, cy), radius rr, from angle a0 to a1 (radians, 0 = +X,
// counter-clockwise seen from +Z), at z; returns Vector3[] for tube().
export function arcPath(cx, cy, z, rr, a0, a1, n = 10, dz = 0) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + (a1 - a0) * t; out.push(new Vector3(cx + rr * Math.cos(a), cy + rr * Math.sin(a), z + dz * t)); }
  return out;
}

// Corrugated lathe profile [[r, y]] for bellows / ribbed rubber grips: `ribs` waves between r0 and r1 over length L.
export function ribProfile(r0, r1, L, ribs, per = 6) {
  const pr = [[0, 0], [r0 * 0.9, 0], [r0, 0.002]];
  const N = ribs * per;
  for (let i = 1; i < N; i++) { const y = (i / N) * L, w = 0.5 - 0.5 * Math.cos((i / per) * Math.PI * 2); pr.push([r0 + (r1 - r0) * w, y]); }
  pr.push([r0, L - 0.002], [r0 * 0.9, L], [0, L]);
  return pr;
}
