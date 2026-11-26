// vans/shape — 2D outline helpers (filleted polygons, wheel-arch notches) and an edge-consistent tessellator
// so big extruded panels carry enough vertices for baked AO / grime (no T-junctions: shared long edges split once).
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three';

// pts: [[x, y, r?], ...] closed polygon; r = fillet radius at that corner (0 = sharp). n = arc segments per fillet.
export function roundPoly(pts, n = 6) {
  const out = [], N = pts.length;
  for (let i = 0; i < N; i++) {
    const P = pts[i], r = P[2] || 0;
    if (r <= 0) { out.push([P[0], P[1]]); continue; }
    const A = pts[(i - 1 + N) % N], B = pts[(i + 1) % N];
    let ux = A[0] - P[0], uy = A[1] - P[1], vx = B[0] - P[0], vy = B[1] - P[1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy); ux /= lu; uy /= lu; vx /= lv; vy /= lv;
    const cosA = Math.max(-0.9999, Math.min(0.9999, ux * vx + uy * vy)), th = Math.acos(cosA) / 2;
    let t = r / Math.tan(th); t = Math.min(t, lu * 0.48, lv * 0.48);
    const rr = t * Math.tan(th);
    const bx = ux + vx, by = uy + vy, bl = Math.hypot(bx, by) || 1, d = rr / Math.sin(th);
    const cx = P[0] + (bx / bl) * d, cy = P[1] + (by / bl) * d;
    const t1x = P[0] + ux * t, t1y = P[1] + uy * t, t2x = P[0] + vx * t, t2y = P[1] + vy * t;
    let a0 = Math.atan2(t1y - cy, t1x - cx), a1 = Math.atan2(t2y - cy, t2x - cx);
    let da = a1 - a0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    for (let k = 0; k <= n; k++) { const a = a0 + (da * k) / n; out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  }
  return out;
}

// Wheel-arch notch points for a bottom edge at y = yb traversed toward +x (CCW outline): arc of radius R around
// (cx, cy), from the rear intersection over the top to the front intersection.
export function archPts(cx, cy, R, yb, n = 14) {
  const dy = yb - cy, dx = Math.sqrt(Math.max(0, R * R - dy * dy)), a0 = Math.atan2(dy, -dx), a1 = Math.atan2(dy, dx);
  const out = [];
  for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; out.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R, 0]); }
  return out;
}

// Split every edge longer than L (shared edges once, so neighbours stay watertight). Interpolates all attributes.
export function tessellate(geo, L = 0.3, maxPass = 6) {
  const names = Object.keys(geo.attributes), A = names.map((n) => ({ n, s: geo.attributes[n].itemSize, a: Array.from(geo.attributes[n].array) }));
  const P = A.find((x) => x.n === 'position').a;
  let I = geo.index ? Array.from(geo.index.array) : Array.from({ length: P.length / 3 }, (_, i) => i);
  const L2 = L * L;
  for (let pass = 0; pass < maxPass; pass++) {
    const mid = new Map(); let split = false;
    const len2 = (a, b) => { const dx = P[a * 3] - P[b * 3], dy = P[a * 3 + 1] - P[b * 3 + 1], dz = P[a * 3 + 2] - P[b * 3 + 2]; return dx * dx + dy * dy + dz * dz; };
    const m = (a, b) => {
      if (len2(a, b) <= L2) return -1;
      const key = a < b ? a * 1e7 + b : b * 1e7 + a;
      if (mid.has(key)) return mid.get(key);
      const id = P.length / 3;
      for (const x of A) for (let c = 0; c < x.s; c++) x.a.push((x.a[a * x.s + c] + x.a[b * x.s + c]) / 2);
      mid.set(key, id); return id;
    };
    const out = [];
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      const ab = m(a, b), bc = m(b, c), ca = m(c, a), k = (ab >= 0) + (bc >= 0) + (ca >= 0);
      if (!k) { out.push(a, b, c); continue; }
      split = true;
      if (k === 3) out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      else if (k === 1) {
        if (ab >= 0) out.push(a, ab, c, ab, b, c); else if (bc >= 0) out.push(a, b, bc, a, bc, c); else out.push(a, b, ca, ca, b, c);
      } else {
        if (ab < 0) out.push(a, b, bc, a, bc, ca, ca, bc, c);
        else if (bc < 0) out.push(b, c, ca, b, ca, ab, ab, ca, a);
        else out.push(c, a, ab, c, ab, bc, bc, ab, b);
      }
    }
    I = out;
    if (!split) break;
  }
  const g = new BufferGeometry();
  for (const x of A) {
    if (x.n === 'normal') { const a = x.a; for (let i = 0; i < a.length; i += 3) { const l = Math.hypot(a[i], a[i + 1], a[i + 2]) || 1; a[i] /= l; a[i + 1] /= l; a[i + 2] /= l; } }
    g.setAttribute(x.n, new Float32BufferAttribute(x.a, x.s));
  }
  g.setIndex(new Uint32BufferAttribute(I, 1));
  return g;
}

// Offset a simple polygon outward by d (negative shrinks). Miter join, clamped on sharp corners.
export function offsetPoly(pts, d) {
  const n = pts.length; let A = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; }
  const s = A > 0 ? 1 : -1, out = [];
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [s * dy / l, -s * dx / l]; };
  for (let i = 0; i < n; i++) {
    const p = pts[i], n1 = nrm(pts[(i - 1 + n) % n], p), n2 = nrm(p, pts[(i + 1) % n]);
    let mx = n1[0] + n2[0], my = n1[1] + n2[1]; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
    const k = d / Math.max(0.35, mx * n1[0] + my * n1[1]);
    out.push([p[0] + mx * k, p[1] + my * k]);
  }
  return out;
}
