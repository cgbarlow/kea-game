// carpark/timber — board-and-batten wall and corrugated mono-pitch roof builders shared by the shelter and the
// long drop. Local frame of a wall: runs along +X from 0..len, exterior face toward +Z at z = 0 (battens proud of it),
// boards occupy z in [-t, 0]. hAt(x) gives the wall top (mono-pitch slope).
import { Matrix4, Vector3 } from 'three';
import { panelWall } from '../../cookbook/geo/kit.js';

export const tint = (rng, base, a = 0.08) => {
  const f = 1 + (rng() - 0.5) * 2 * a, g = 1 + (rng() - 0.5) * a;
  const r = Math.min(255, ((base >> 16) & 255) * f), gg = Math.min(255, ((base >> 8) & 255) * f * g), b = Math.min(255, (base & 255) * f);
  return ((r << 16) | (gg << 8) | b) >>> 0;
};

// Exterior board-and-batten skin (+ optional interior: back face of the boards, studs, plates, dwangs).
//  o: { len, h0, h1, t, pitch, colour, rng, out: Kit, outKey, inn: Kit, innKey, gaps: [[x0,x1]] (openings, e.g. a door) }
export function bbWall(o) {
  const { len, h0, h1 = h0, t = 0.022, pitch = 0.2, colour = 0x7a6e5c, rng, out, outKey = 'wood', inn = null, innKey = 'wood', gaps = [], y0 = 0 } = o;
  const hAt = (x) => h0 + (h1 - h0) * (x / len);
  const inGap = (x) => gaps.some(([a, b]) => x > a && x < b);
  const n = Math.round(len / pitch), P = len / n;
  for (let i = 0; i < n; i++) {
    const cx = (i + 0.5) * P; if (inGap(cx)) continue;
    const bh = hAt(cx) - y0, c = tint(rng, colour, 0.09);
    out.box(bh, P - 0.003, t, outKey, { at: [cx, y0 + bh / 2, -t / 2], rot: [0, 0, Math.PI / 2], r: 0.003, color: c, step: 0.9 });
    if (inn) inn.box(bh, P - 0.002, 0.01, innKey, { at: [cx, y0 + bh / 2, -t - 0.005], rot: [0, 0, Math.PI / 2], r: 0.002, color: tint(rng, 0xe2d2b0, 0.08), step: 0.9 });
  }
  for (let i = 1; i < n; i++) { // battens over every joint
    const x = i * P; if (inGap(x - 0.03) || inGap(x + 0.03)) continue;
    const bh = hAt(x) - y0 - 0.02;
    out.box(bh, 0.05, 0.019, outKey, { at: [x, y0 + bh / 2 + 0.01, 0.0095], rot: [0, 0, Math.PI / 2], r: 0.004, color: tint(rng, colour, 0.06), step: 0.9 });
  }
  if (inn) { // framing: studs at 600 centres, bottom plate, sloped top plate, dwangs staggered at mid height
    const zf = -t - 0.01 - 0.045;
    const ns = Math.max(1, Math.round(len / 0.6));
    for (let i = 0; i <= ns; i++) {
      const x = Math.min(len - 0.03, Math.max(0.03, (i * len) / ns)); if (inGap(x)) continue;
      const h = hAt(x) - y0 - 0.09;
      inn.box(0.045, h, 0.09, innKey, { at: [x, y0 + 0.045 + h / 2, zf], r: 0.003, color: tint(rng, 0xead4a8, 0.07) });
      if (i < ns && !inGap(x + len / ns / 2)) {
        const dy = 1.15 + (i % 2) * 0.09, w = len / ns - 0.045;
        inn.box(w, 0.09, 0.045, innKey, { at: [x + len / ns / 2, y0 + dy, zf + 0.0225], r: 0.003, color: tint(rng, 0xe0c8a0, 0.07) });
      }
    }
    inn.box(len, 0.045, 0.09, innKey, { at: [len / 2, y0 + 0.0225, zf], r: 0.003, color: 0xc8b490 });
    inn.bar([0, hAt(0) - 0.0225, zf], [len, hAt(len) - 0.0225, zf], 0.09, 0.045, innKey, { color: 0xd8c49c });
  }
  return hAt;
}

// Corrugated roof sheet over a mono-pitch: x0..x1 world (rises toward x1), z0..z1, y(x) = yA + (yB - yA)·(x - x0)/(x1 - x0).
// Corrugations run downslope (along X). Written into kit `k` under its current matrix.
export function corrugatedRoof(k, { x0, x1, z0, z1, yA, yB, key = 'paint', color = 0x2f4a3c, pitch = 0.076, depth = 0.017 }) {
  const run = x1 - x0, rise = yB - yA, L = Math.hypot(run, rise), ca = run / L, sa = rise / L;
  const geo = panelWall(z1 - z0, L, { kind: 'sine', pitch, depth, ystep: 0.6 });
  const m = new Matrix4().makeBasis(new Vector3(0, 0, 1), new Vector3(ca, sa, 0), new Vector3(-sa, ca, 0)).setPosition(x0, yA, z0);
  k.pushMatrix(m); k.add(geo, key, { color, occ: false }); k.pop();
  // ridge/barge flashings along the high and the side edges
  k.bar([x1 - 0.02, yB + 0.02, z0 - 0.02], [x1 - 0.02, yB + 0.02, z1 + 0.02], 0.09, 0.03, key, { color, r: 0.006 });
  for (const z of [z0 - 0.012, z1 + 0.012]) k.bar([x0, yA + 0.02, z], [x1, yB + 0.02, z], 0.025, 0.07, key, { color, r: 0.006 });
}
