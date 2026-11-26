// vans/body — exterior of one coachbuilt rental campervan on a Transit/Sprinter-class cab chassis, van-local metres
// (nose to -Z; "f" = forward distance = -z). Cab: solid lower block + window side panels + a real windscreen set in
// rubber between the A-pillars (glass touches the pillars, cowl and header: nothing floats). Coachbuilt GRP box with a
// luton over the cab, keder trims, arch liners and flares, real-profile tyres + steel rims, lamps, mirrors, wipers,
// awning cassette, door, windows, lockers. Damage-driven parts are tagged via `T(geo, rule, part, glow, blink)`.
import { Vector3 } from 'three';
import { extrudeBevel, lathe, roundedBox } from '../../cookbook/geo/kit.js';
import { roundPoly, archPts, tessellate, offsetPoly } from './shape.js';

export const DIM = {
  fA: 2.3, fB: -1.4, tyreR: 0.36, track: 0.87, cabW: 2.0, bodyW: 2.22, rear: -3.2, nose: 3.25, bodyFront: 1.25, cabBack: 1.1, top: 2.9,
  ws0: [2.545, 1.31], ws1: [1.985, 2.07], door: { f0: 0.25, f1: 0.87, y0: 0.66, y1: 2.38 },
};
const SIDE_ROT = [0, Math.PI / 2, 0];                 // profile (f, y) extruded across X: local x → world -z
const D = DIM;

// side-profile extrusion: pts in (f, y, r) → geo across X (depth) centred at x
function profileExtrude(k, key, pts, depth, x, o = {}) {
  let g = extrudeBevel(roundPoly(pts, o.n ?? 6), { depth, bevel: o.bevel ?? 0.01, bevelSeg: o.bevelSeg ?? 2, holes: o.holes || [] });
  if (o.tess) g = tessellate(g, o.tess);
  return k.add(g, key, { at: [x, 0, 0], rot: SIDE_ROT, color: o.color });
}
// annular sector in the (f, y) plane around (cf, cy) between radii, clipped by the bottom line yb
function arcBand(cf, cy, r0, r1, yb, n = 16) {
  const o = archPts(cf, cy, r1, yb, n).map((p) => [p[0], p[1]]), i = archPts(cf, cy, r0, yb, n).map((p) => [p[0], p[1]]).reverse();
  return [...o, ...i];
}

export function buildBody(k, T, cfg) {
  const { paint, rng } = cfg, hw = D.bodyW / 2, cw = D.cabW / 2;
  const alu = 0xc4c6c4, trim = 0x3a3c3e, black = 0x1c1d1f, liner = 0x111214;

  // ---------------- coachbuilt body (GRP box + luton), tessellated for AO/grime
  const bodyPts = [[D.rear, 0.58, 0.05], ...archPts(D.fB, 0.36, 0.5, 0.58), [D.bodyFront, 0.58, 0.03], [D.bodyFront, 2.07, 0.04],
    [2.12, 2.1, 0.1], [2.34, 2.42, 0.24], [2.1, 2.9, 0.4], [D.rear, 2.9, 0.22]];
  profileExtrude(k, 'paint', bodyPts, D.bodyW, 0, { bevel: 0.05, bevelSeg: 3, tess: 0.6, color: paint });
  // keder trims: luton bottom → nose → roof edge, and the rear verticals / rear roof edge
  const rp = roundPoly(bodyPts, 6), i0 = rp.findIndex((p) => Math.abs(p[0] - D.bodyFront) < 0.08 && p[1] > 2.0);
  const kp = rp.slice(i0).filter((p) => p[1] > 2.0 && p[0] > D.rear + 0.15);
  for (const s of [-1, 1]) {
    k.tube(kp.map((p) => new Vector3(s * (hw - 0.012), p[1], -p[0])), 0.02, 'metal', { radial: 8, color: alu });
    k.tube([new Vector3(s * (hw - 0.012), 0.6, -D.rear), new Vector3(s * (hw - 0.012), 2.76, -D.rear), new Vector3(s * (hw - 0.07), 2.885, -D.rear)], 0.022, 'metal', { radial: 8, color: alu, curve: true, samples: 10 });
  }
  k.tube([new Vector3(-hw + 0.07, 2.885, -D.rear), new Vector3(hw - 0.07, 2.885, -D.rear)], 0.022, 'metal', { radial: 8, color: alu });
  // skirts + arch flares/liners
  for (const s of [-1, 1]) {
    for (const [a, b] of [[D.rear + 0.04, D.fB - 0.47], [D.fB + 0.47, D.bodyFront - 0.02]]) k.box(0.035, 0.15, b - a, 'dark', { at: [s * (hw + 0.004), 0.645, -(a + b) / 2], r: 0.012, color: trim });
    k.add(extrudeBevel(arcBand(D.fB, 0.36, 0.495, 0.56, 0.58), { depth: 0.03, bevel: 0.008, bevelSeg: 1 }), 'dark', { at: [s * (hw + 0.01), 0, 0], rot: SIDE_ROT, color: trim });
    k.add(extrudeBevel(arcBand(D.fB, 0.36, 0.47, 0.5, 0.58), { depth: 0.36, bevel: 0.004, bevelSeg: 1 }), 'dark', { at: [s * (hw - 0.18), 0, 0], rot: SIDE_ROT, color: liner, occ: false });
    k.add(extrudeBevel(arcBand(D.fA, 0.36, 0.465, 0.525, 0.5), { depth: 0.03, bevel: 0.008, bevelSeg: 1 }), 'dark', { at: [s * (cw + 0.01), 0, 0], rot: SIDE_ROT, color: trim });
    k.add(extrudeBevel(arcBand(D.fA, 0.36, 0.44, 0.47, 0.5), { depth: 0.3, bevel: 0.004, bevelSeg: 1 }), 'dark', { at: [s * (cw - 0.15), 0, 0], rot: SIDE_ROT, color: liner, occ: false });
    k.box(0.05, 1.55, 0.06, 'dark', { at: [s * (hw - 0.02), 1.34, -(D.bodyFront + 0.02)], r: 0.015, color: trim }); // cab/body seal
  }

  // ---------------- cab
  const lower = [[D.cabBack, 0.5, 0], ...archPts(D.fA, 0.36, 0.47, 0.5), [3.08, 0.5, 0.04], [3.23, 0.64, 0.05], [D.nose, 0.94, 0.12], [3.12, 1.09, 0.15],
    [2.6, 1.21, 0.05], [D.ws0[0], D.ws0[1], 0], [D.cabBack, D.ws0[1], 0]];
  profileExtrude(k, 'paint', lower, D.cabW, 0, { bevel: 0.045, bevelSeg: 3, tess: 0.45, color: paint });
  const win = roundPoly([[1.32, 1.4, 0.05], [2.37, 1.4, 0.04], [1.955, 1.96, 0.05], [1.32, 1.96, 0.05]], 4);
  const upper = [[D.cabBack, D.ws0[1] - 0.02, 0], [D.ws0[0], D.ws0[1] - 0.02, 0.01], [D.ws1[0], D.ws1[1], 0.03], [D.cabBack, D.ws1[1], 0]];
  for (const s of [-1, 1]) {
    profileExtrude(k, 'paint', upper, 0.05, s * (cw - 0.025), { holes: [win], bevel: 0.008, color: paint, tess: 0.3 });
    k.add(extrudeBevel(offsetPoly(win, 0.012), { holes: [offsetPoly(win, -0.022)], depth: 0.022, bevel: 0.004 }), 'dark', { at: [s * (cw + 0.004), 0, 0], rot: SIDE_ROT, color: black }); // window rubber
    k.add(extrudeBevel(win, { depth: 0.006, bevel: 0.002 }), 'glass', { at: [s * (cw - 0.012), 0, 0], rot: SIDE_ROT });
    // door shut lines, handle, step, side repeater
    k.box(0.006, 0.8, 0.008, 'dark', { at: [s * (cw + 0.002), 0.92, -1.2], r: 0.002, color: black });
    k.box(0.006, 0.46, 0.008, 'dark', { at: [s * (cw + 0.002), 1.08, -2.6], r: 0.002, color: black });
    k.box(0.03, 0.035, 0.17, 'dark', { at: [s * (cw + 0.012), 1.2, -1.42], r: 0.012, color: black });
    k.box(0.16, 0.05, 0.6, 'dark', { at: [s * (cw - 0.04), 0.4, -1.62], r: 0.015, color: black });
    T(k.box(0.012, 0.03, 0.07, 'lens', { at: [s * (cw + 0.004), 0.98, -2.95], r: 0.006, color: 0xd87a1a }), 0, 0, 0, 1);
  }
  k.box(D.cabW - 0.02, 0.07, 0.3, 'paint', { at: [0, 2.07, -(D.ws1[0] - 0.1)], r: 0.025, color: paint }); // header
  // windscreen frame: plane along the A-pillar line, local y up the glass, local -z outward
  const [f0, y0] = D.ws0, [f1, y1] = D.ws1, L = Math.hypot(f0 - f1, y1 - y0), th = Math.atan2(f0 - f1, y1 - y0);
  k.push(0, (y0 + y1) / 2, -(f0 + f1) / 2, 0, th, 0);
  const sw = D.cabW - 0.1, sh = L - 0.01;
  k.add(extrudeBevel(roundPoly([[-sw / 2, -sh / 2, 0.05], [sw / 2, -sh / 2, 0.05], [sw / 2, sh / 2, 0.06], [-sw / 2, sh / 2, 0.06]], 5), { depth: 0.007, bevel: 0.002 }), 'glass', {});
  T(k.box(sw + 0.04, 0.035, 0.028, 'dark', { at: [0, sh / 2, -0.004], r: 0.01, color: black }), 0.6);                 // top seal (kea target)
  T(k.tube([new Vector3(sw / 2 - 0.05, sh / 2, -0.02), new Vector3(sw / 2 - 0.02, sh / 2 - 0.25, -0.05), new Vector3(sw / 2 + 0.01, sh / 2 - 0.55, -0.03)], 0.009, 'dark', { radial: 6, curve: true, samples: 8, color: black }), -0.6);
  T(k.box(sw * 0.55, 0.035, 0.028, 'dark', { at: [-sw * 0.22, sh / 2, -0.004], r: 0.01, color: black }), -0.6);        // what is left of it
  k.box(sw + 0.04, 0.04, 0.03, 'dark', { at: [0, -sh / 2, -0.004], r: 0.01, color: black });
  for (const s of [-1, 1]) k.box(0.035, sh, 0.028, 'dark', { at: [s * (sw / 2 + 0.005), 0, -0.004], r: 0.01, color: black });
  // wipers parked along the cowl: arm + blade; blades go first, then the arms bend up
  for (const [px, rule, blade] of [[-0.62, 0.72, 0.62], [0.14, 0.45, 0.6]]) {
    k.push(px, -sh / 2 + 0.07, -0.03, 0, 0, 0.12);
    T(k.box(0.5, 0.018, 0.014, 'dark', { at: [0.25, 0, 0], r: 0.006, color: 0x222324 }), rule * 0.6);
    T(k.box(blade, 0.022, 0.02, 'dark', { at: [0.26, 0.02, -0.012], r: 0.006, color: 0x151515 }), rule);
    T(k.box(0.5, 0.018, 0.014, 'dark', { at: [0.22, 0.04, -0.13], rot: [0, 0.55, 0.12], r: 0.006, color: 0x222324 }), -rule * 0.6);
    k.cyl(0.02, 0.03, 'dark', { at: [0, 0, 0], rot: [Math.PI / 2, 0, 0], color: 0x222324 });
    k.pop();
  }
  k.pop();
  // cowl, grille, bonnet badge
  k.box(D.cabW - 0.08, 0.05, 0.12, 'dark', { at: [0, 1.255, -2.6], rot: [0.2, 0, 0], r: 0.015, color: black });
  const gr = roundPoly([[-0.5, 0.66, 0.03], [0.5, 0.66, 0.03], [0.55, 0.92, 0.05], [-0.55, 0.92, 0.05]], 4);
  k.add(extrudeBevel(gr, { depth: 0.05, bevel: 0.008 }), 'dark', { at: [0, 0, -3.245], color: black });
  for (let i = 0; i < 4; i++) k.box(1.0 - i * 0.02, 0.022, 0.03, 'dark', { at: [0, 0.7 + i * 0.06, -3.275], r: 0.008, color: 0x2a2b2d });
  k.cyl(0.05, 0.02, 'metal', { at: [0, 0.8, -3.295], rot: [Math.PI / 2, 0, 0], seg: 20, color: 0xb0b2b4 });
  // headlights, indicators, fogs
  for (const s of [-1, 1]) {
    const hl = roundPoly([[0.6, 0.71, 0.03], [0.93, 0.72, 0.05], [0.95, 0.9, 0.06], [0.6, 0.92, 0.04]].map((p) => [s * p[0], p[1], p[2]]), 4);
    k.add(extrudeBevel(s < 0 ? hl.slice().reverse() : hl, { depth: 0.05, bevel: 0.01 }), 'lens', { at: [0, 0, -3.258], color: 0xc9d1d6 });
    k.add(extrudeBevel(s < 0 ? hl.slice().reverse() : hl, { depth: 0.02, bevel: 0.004 }), 'dark', { at: [0, 0, -3.238], color: black });
    k.cyl(0.05, 0.03, 'metal', { at: [s * 0.7, 0.81, -3.275], rot: [Math.PI / 2, 0, 0], seg: 18, color: 0x9a9c9e });
    T(k.box(0.16, 0.035, 0.03, 'lens', { at: [s * 0.84, 0.665, -3.255], r: 0.01, color: 0xd87a1a }), 0, 0, 0, 1);
    k.cyl(0.045, 0.03, 'lens', { at: [s * 0.78, 0.47, -3.31], rot: [Math.PI / 2, 0, 0], seg: 16, color: 0xb8bfc4 });
  }
  // bumpers, plates go on as decals
  k.box(2.06, 0.28, 0.26, 'dark', { at: [0, 0.5, -3.18], r: 0.06, color: 0x2a2b2c });
  k.box(1.6, 0.06, 0.12, 'dark', { at: [0, 0.34, -3.2], r: 0.02, color: black });
  k.box(2.0, 0.24, 0.2, 'dark', { at: [0, 0.5, -(D.rear - 0.06)], r: 0.05, color: 0x2a2b2c });
  // mirrors (big van heads on two-bar arms)
  for (const s of [-1, 1]) {
    k.bar([s * (cw - 0.01), 1.5, -2.44], [s * 1.18, 1.6, -2.4], 0.03, 0.03, 'dark', { r: 0.01, color: black });
    k.bar([s * (cw - 0.01), 1.86, -2.12], [s * 1.18, 1.86, -2.37], 0.03, 0.03, 'dark', { r: 0.01, color: black });
    k.box(0.08, 0.32, 0.2, 'dark', { at: [s * 1.215, 1.72, -2.38], r: 0.035, color: 0x202122 });
    T(k.box(0.065, 0.29, 0.01, 'glass', { at: [s * 1.215, 1.72, -2.275], r: 0.004 }), s < 0 ? 0.3 : 0);
    if (s < 0) T(k.box(0.06, 0.12, 0.012, 'glass', { at: [-1.215, 1.62, -2.27], rot: [0.3, 0, 0.6], r: 0.003 }), -0.3); // the bit that is left
  }

  // ---------------- chassis + wheels (nothing floats: tyres touch y=0, chassis bridges cab to body)
  for (const s of [-1, 1]) k.box(0.08, 0.16, 5.6, 'dark', { at: [s * 0.48, 0.5, -0.1], r: 0.01, color: 0x18191a });
  k.box(0.6, 0.26, 0.5, 'dark', { at: [0.25, 0.42, 0.4], r: 0.03, color: 0x232425 });                   // fuel tank
  k.box(0.9, 0.3, 0.55, 'dark', { at: [-0.3, 0.44, 1.6], r: 0.04, color: 0x2c2d2e });                   // water tank
  k.tube([new Vector3(0.3, 0.32, -1.8), new Vector3(0.35, 0.3, 0.5), new Vector3(0.7, 0.3, 2.6), new Vector3(0.76, 0.3, 2.95)], 0.025, 'metal', { radial: 8, curve: true, samples: 14, color: 0x5a5048 });
  k.box(0.22, 0.12, 0.9, 'dark', { at: [0, 0.3, -2.2], r: 0.02, color: 0x18191a });                     // diff/prop shaft
  buildWheels(k, cfg);

  // ---------------- habitation windows, door, lockers, awning
  const winOn = (s, f0, f1, wy0, wy1) => {
    const p = roundPoly([[f0, wy0, 0.07], [f1, wy0, 0.07], [f1, wy1, 0.07], [f0, wy1, 0.07]], 4);
    profileExtrude(k, 'dark', p.map((q) => [q[0], q[1], 0]), 0.03, s * (hw + 0.004), { n: 0, bevel: 0.01, color: 0x262728 });
    const g = p.map((q) => [q[0] + Math.sign((f0 + f1) / 2 - q[0]) * 0.035, q[1] + Math.sign((wy0 + wy1) / 2 - q[1]) * 0.035]);
    k.add(extrudeBevel(g, { depth: 0.008, bevel: 0.003 }), 'glass', { at: [s * (hw + 0.022), 0, 0], rot: SIDE_ROT, color: 0x8a8a8a });
  };
  winOn(1, -2.95, -2.0, 1.45, 2.2); winOn(1, -0.7, 0.25, 1.55, 2.12); winOn(1, 1.38, 1.95, 2.34, 2.62);
  winOn(-1, -2.95, -2.0, 1.45, 2.2); winOn(-1, -1.25, -0.4, 1.55, 2.12); winOn(-1, 1.38, 1.95, 2.34, 2.62);
  // rear window + lamp clusters
  k.box(1.2, 0.62, 0.03, 'dark', { at: [0, 2.0, -D.rear + 0.01], r: 0.06, color: 0x262728 });
  k.box(1.13, 0.55, 0.008, 'glass', { at: [0, 2.0, -D.rear + 0.028], r: 0.05, color: 0x8a8a8a });
  for (const s of [-1, 1]) {
    k.box(0.16, 0.74, 0.04, 'dark', { at: [s * (hw - 0.12), 1.1, -D.rear + 0.012], r: 0.02, color: black });
    k.box(0.13, 0.36, 0.03, 'lens', { at: [s * (hw - 0.12), 1.27, -D.rear + 0.03], r: 0.012, color: 0x9a1810 });
    T(k.box(0.13, 0.15, 0.03, 'lens', { at: [s * (hw - 0.12), 1.0, -D.rear + 0.03], r: 0.012, color: 0xd87a1a }), 0, 0, 0, 1);
    k.box(0.13, 0.12, 0.03, 'lens', { at: [s * (hw - 0.12), 0.84, -D.rear + 0.03], r: 0.012, color: 0xd0d4d6 });
  }
  // habitation door (-X side, hinge at its front edge) + the dark doorway it covers + step
  const d = D.door, dp = roundPoly([[d.f0, d.y0, 0.06], [d.f1, d.y0, 0.06], [d.f1, d.y1, 0.1], [d.f0, d.y1, 0.1]], 4);
  profileExtrude(k, 'dark', dp.map((q) => [q[0], q[1], 0]), 0.01, -(hw + 0.003), { n: 0, bevel: 0.002, color: 0x0b0b0c });
  T(profileExtrude(k, 'paint', dp.map((q) => [q[0], q[1], 0]), 0.035, -(hw + 0.02), { n: 0, bevel: 0.01, color: paint }), 0, 1);
  const dw = roundPoly([[d.f0 + 0.12, 1.72, 0.05], [d.f1 - 0.12, 1.72, 0.05], [d.f1 - 0.12, 2.18, 0.05], [d.f0 + 0.12, 2.18, 0.05]], 3);
  T(k.add(extrudeBevel(dw, { depth: 0.01, bevel: 0.003 }), 'glass', { at: [-(hw + 0.04), 0, 0], rot: SIDE_ROT, color: 0x8a8a8a }), 0, 1);
  T(k.box(0.04, 0.05, 0.14, 'dark', { at: [-(hw + 0.05), 1.3, -(d.f0 + 0.08)], r: 0.015, color: black }), 0, 1);
  T(k.box(0.012, 1.72, 0.03, 'dark', { at: [-(hw + 0.038), (d.y0 + d.y1) / 2, -d.f0 - 0.01], r: 0.004, color: black }), 0, 1);
  k.box(0.32, 0.04, 0.58, 'metal', { at: [-(hw + 0.12), 0.42, -(d.f0 + d.f1) / 2], r: 0.012, color: 0x8e9092 });
  for (const s of [-1, 1]) k.box(0.04, 0.18, 0.04, 'dark', { at: [-(hw + 0.06), 0.5, -(d.f0 + d.f1) / 2 + s * 0.24], color: black });
  // lockers, gas locker, vents, filler caps (both sides vary)
  const hatch = (s, f0, f1, ly0, ly1, col) => {
    const p = roundPoly([[f0, ly0, 0.04], [f1, ly0, 0.04], [f1, ly1, 0.04], [f0, ly1, 0.04]], 3);
    profileExtrude(k, 'dark', p.map((q) => [q[0], q[1], 0]), 0.012, s * (hw + 0.004), { n: 0, bevel: 0.003, color: black });
    profileExtrude(k, 'paint', p.map((q, i) => [q[0] + Math.sign((f0 + f1) / 2 - q[0]) * 0.012, q[1] + Math.sign((ly0 + ly1) / 2 - q[1]) * 0.012, 0]), 0.016, s * (hw + 0.01), { n: 0, bevel: 0.004, color: col ?? paint });
    k.box(0.02, 0.03, 0.08, 'dark', { at: [s * (hw + 0.02), ly1 - 0.07, -(f0 + f1) / 2], r: 0.01, color: black });
  };
  hatch(1, -0.85, -0.05, 0.76, 1.24); hatch(1, 0.35, 0.95, 0.74, 1.12); hatch(-1, -2.6, -1.95, 0.76, 1.2);
  for (const [s, f, vy] of [[1, -1.0, 1.92], [1, 0.75, 1.75], [-1, -1.7, 1.9]]) {
    k.box(0.02, 0.36, 0.14, 'dark', { at: [s * (hw + 0.008), vy, -f], r: 0.012, color: 0x2a2b2c });
    for (let i = 0; i < 5; i++) k.box(0.012, 0.012, 0.11, 'dark', { at: [s * (hw + 0.02), vy - 0.14 + i * 0.07, -f], r: 0.004, color: 0x151515 });
  }
  k.cyl(0.05, 0.03, 'dark', { at: [-(hw + 0.012), 0.9, 1.5], rot: [0, 0, Math.PI / 2], seg: 16, color: 0x2c4f7a });  // fresh water filler
  k.cyl(0.035, 0.03, 'dark', { at: [hw + 0.012, 1.05, -1.32], rot: [0, 0, Math.PI / 2], seg: 16, color: 0x202020 });   // fuel cap
  // awning cassette on the door side, with end caps and brackets
  const aw = roundPoly([[-0.06, -0.06, 0.03], [0.05, -0.05, 0.025], [0.06, 0.07, 0.04], [-0.04, 0.07, 0.02]], 4);
  k.add(extrudeBevel(aw, { depth: 3.7, bevel: 0.006 }), 'metal', { at: [-(hw + 0.07), 2.74, 1.05], color: 0x9fa3a6 });
  for (const z of [-0.8, 2.9]) k.box(0.13, 0.15, 0.03, 'dark', { at: [-(hw + 0.07), 2.745, z], r: 0.012, color: black });
  for (const z of [-0.2, 1.1, 2.4]) k.box(0.06, 0.12, 0.05, 'dark', { at: [-(hw + 0.02), 2.75, z], r: 0.01, color: black });
}

// tyre (real profile with tread grooves) + steel rim with dish, hub and nuts; base touches y = 0
function buildWheels(k, cfg) {
  const R = D.tyreR, tw = 0.112;
  const tyreP = [[0.205, -0.1], [0.25, -tw], [0.33, -tw], [0.35, -0.098], [R, -0.075], [R, -0.045], [R - 0.008, -0.04], [R - 0.008, -0.028], [R, -0.023],
    [R, 0.023], [R - 0.008, 0.028], [R - 0.008, 0.04], [R, 0.045], [R, 0.075], [0.35, 0.098], [0.33, tw], [0.25, tw], [0.205, 0.1]];
  const rimP = [[0.2, -0.1], [0.205, 0.085], [0.195, 0.095], [0.16, 0.07], [0.12, 0.045], [0.08, 0.05], [0.065, 0.07], [0.045, 0.078], [0, 0.08]];
  const tyre = lathe(tyreP, { seg: 30, crease: 30 }), rim = lathe(rimP, { seg: 24, crease: 30 });
  for (const f of [D.fA, D.fB]) for (const s of [-1, 1]) {
    const x = s * D.track, sq = 0.01; // flattened contact patch: wheel centre sits 1 cm low
    k.push(x, R - sq, -f, 0, 0, -s * Math.PI / 2);
    k.add(tyre.clone(), 'dark', { color: 0x2a2a2a, occ: { r: R, y0: -tw, y1: tw } });
    k.add(rim.clone(), 'metal', { color: cfg.rim ?? 0xb7b9bb, occ: false });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.cyl(0.011, 0.02, 'metal', { at: [Math.cos(a) * 0.09, 0.06, Math.sin(a) * 0.09], seg: 6, color: 0x7a7c7e }); }
    k.pop();
    k.box(0.22, 0.28, 0.012, 'dark', { at: [x, 0.25, -f + 0.5], r: 0.005, color: 0x161616 });           // mud flap
  }
}

export { roundedBox };
