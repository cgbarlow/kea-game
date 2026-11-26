// blower/hand — the ranger's right hand in a work glove on the blower's loop handle, plus the jacket sleeve.
// buildHand(k) writes into the blower Kit under key 'glove' (one fabric material, colours in vertex colour).
// Overhand grip: palm over the top of the bar, fingers wrapping down the -X side (the side the player sees) and under,
// thumb round the +X side, wrist out to the right, forearm running back to the bottom-right corner of the frame.
import { Vector3, Matrix4, Quaternion } from 'three';
import { lathe, tube } from '../../cookbook/geo/kit.js';
import { ringLoft, alongAxis, arcPath } from './geo.js';

const GLOVE = 0x2e302b, GLOVE_B = 0x23241f, TAN = 0x7c6042, TAN_D = 0x5e4730, SLEEVE = 0x3a473c, SLEEVE_D = 0x2b352d, HIVIS = 0x9a5a22;
const BAR = [0, 0.0135], BAR_R = 0.0178;

export function buildHand(k) {
  // fingers: [z, finger radius, start angle, end angle, orbit extra]. Each finger is three phalanges as straight
  // segments meeting at joints on a polygon circumscribed round the bar (so the chords never cut into it): the joints
  // stand proud like real knuckles, with fabric creases on the inside of each bend and a stitched seam on top.
  const F = [[-0.039, 0.0094, 1.85, 4.55, 0.003], [-0.0175, 0.0101, 1.8, 5.0, 0], [0.0035, 0.0097, 1.8, 4.95, 0], [0.0235, 0.0084, 1.85, 4.75, 0]];
  F.forEach(([z, fr, a0, a1, ex], i) => {
    const rr = BAR_R + fr + 0.0008 + ex, span = a1 - a0;
    const J = [0, 0.42, 0.74, 1].map((t) => a0 + span * t);          // MCP, PIP, DIP, tip angles
    const dz = i === 0 ? -0.004 : 0.002 * (i - 1.5);
    const path = [new Vector3(0.006, 0.05, z + 0.001)];
    for (let j = 0; j < J.length; j++) {
      const half = j === 0 ? 0 : (J[j] - J[j - 1]) / 2, out = j === 0 || j === 3 ? 1 : 1 / Math.cos(half) ** 0.6;
      const a = J[j], t = j / 3;
      path.push(new Vector3(BAR[0] + rr * out * Math.cos(a), BAR[1] + rr * out * Math.sin(a), z + dz * t));
    }
    // densify the straight phalanges so the radius profile (knuckle swell, waist) has vertices
    const pts = [path[0]];
    for (let j = 1; j < path.length; j++) for (let q = 1; q <= 6; q++) pts.push(path[j - 1].clone().lerp(path[j], q / 6));
    const n = pts.length - 1;
    const jt = [6, 12, 18].map((v) => v / n);                         // joint parameters along the tube
    const rad = (t) => {
      let sw = 0; for (const c of jt) sw += Math.exp(-((t - c) ** 2) / 0.0012);
      return fr * (1.04 - 0.16 * t + 0.1 * sw);
    };
    k.add(tube(pts, rad, { radial: 20, caps: false }), 'glove', { color: GLOVE, occ: false });
    // fingertip: leather-reinforced cap along the last tangent
    const e = pts[n], p = pts[n - 1], d = e.clone().sub(p).normalize(), r = rad(1);
    const tip = lathe([[r, 0], [r * 0.97, r * 0.35], [r * 0.82, r * 0.7], [r * 0.5, r * 0.95], [0, r * 1.05]], { seg: 18 });
    k.add(alongAxis(tip, [e.x - d.x * 0.0005, e.y - d.y * 0.0005, e.z - d.z * 0.0005], [e.x + d.x, e.y + d.y, e.z + d.z]), 'glove', { color: TAN, occ: false });
    // leather palm-side patch over the last phalanx + crease rings at the joints (thin dark grooves in the fabric)
    for (let j = 2; j <= 3; j++) {
      const a = path[j], b = path[j + 1], dm = b.clone().sub(a).normalize(), m = a.clone().lerp(b, 0.25);
      const rr2 = rad((6 * j) / n + 0.02);
      k.add(alongAxis(lathe([[rr2 * 1.02, 0], [rr2 * 1.07, 0.0015], [rr2 * 1.07, 0.0085], [rr2 * 1.02, 0.01]], { seg: 18 }), [m.x, m.y, m.z], [m.x + dm.x, m.y + dm.y, m.z + dm.z]), 'glove', { color: TAN_D, occ: false });
    }
    for (const c of [6, 12, 18]) {
      const a = pts[c], b = pts[c + 1], dm = b.clone().sub(a).normalize(), rc = rad(c / n);
      k.add(alongAxis(lathe([[rc * 1.0, 0], [rc * 1.045, 0.0007], [rc * 1.045, 0.0013], [rc * 1.0, 0.002]], { seg: 18 }), [a.x, a.y, a.z], [a.x + dm.x, a.y + dm.y, a.z + dm.z]), 'glove', { color: 0x151612, occ: false });
    }
    // stitched seam along the back of the finger (outer side, away from the bar)
    const st = [];
    for (let q = 1; q <= n - 2; q++) { const c = pts[q], ox = c.x - BAR[0], oy = c.y - BAR[1], l = Math.hypot(ox, oy) || 1, rq = rad(q / n) * 0.99; st.push(new Vector3(c.x + (ox / l) * rq, c.y + (oy / l) * rq, c.z)); }
    k.add(tube(st, 0.0007, { radial: 5, caps: false }), 'glove', { color: 0x6a6656, occ: false });
  });

  // palm / back of hand: a superellipse loft lying over the top of the grip, knuckles left, wrist right
  const palm = [];
  const P = [[-0.016, 0.043, 0.006, 0.04, 0.013, GLOVE], [-0.006, 0.048, 0.0, 0.046, 0.0165, GLOVE], [0.02, 0.05, -0.004, 0.047, 0.0175, GLOVE_B],
    [0.045, 0.049, -0.006, 0.045, 0.017, GLOVE_B], [0.07, 0.046, -0.006, 0.038, 0.0155, GLOVE], [0.088, 0.044, -0.005, 0.033, 0.0145, GLOVE]];
  for (const [x, y, z, a, b, c] of P) palm.push({ x: z, y, z: -x, a, b, p: 2.6, color: c });
  const pg = ringLoft(palm, 40, { capStart: true });
  pg.applyMatrix4(new Matrix4().makeRotationY(-Math.PI / 2));
  k.add(pg, 'glove', { occ: false });
  // knuckle guard (TPR pads) + back-of-hand panel, facing up at the player
  for (let i = 0; i < 4; i++) {
    const zz = -0.036 + i * 0.021, rk = 0.0078 - (i === 3 ? 0.0012 : 0);
    const dome = lathe([[rk, 0], [rk * 0.92, rk * 0.3], [rk * 0.7, rk * 0.55], [rk * 0.35, rk * 0.7], [0, rk * 0.74]], { seg: 20 });
    dome.scale(1, 1, 1.15);
    k.add(dome, 'glove', { at: [-0.003, 0.0605, zz], rot: [0, 0, 0.32], color: 0x1a1b19, occ: false });
  }
  // back-of-hand panel: a padded superellipse loft that follows the curve of the hand, a stitched border and a
  // reflective tab (grey, retroreflective) instead of a flat plate
  const back = [];
  for (let j = 0; j <= 6; j++) { const x = 0.012 + j * 0.0075, sw = Math.sin((j / 6) * Math.PI); back.push({ x: 0, y: 0, z: -x, a: 0.024 * (0.55 + 0.45 * sw), b: 0.0045 * (0.4 + 0.6 * sw), p: 2.4, color: 0x1d1e1b }); }
  const bg = ringLoft(back, 32, { capStart: true });
  bg.applyMatrix4(new Matrix4().makeRotationY(-Math.PI / 2)); bg.translate(0, 0.0645, -0.006);
  k.add(bg, 'glove', { occ: false });
  k.box(0.026, 0.0022, 0.012, 'glove', { at: [0.04, 0.0688, -0.006], r: 0.001, color: 0x8a8c88, occ: false });

  // thumb: from the front of the palm down the +X side of the grip, tip under the bar
  const thumb = [new Vector3(0.05, 0.042, -0.04), new Vector3(0.044, 0.028, -0.052), new Vector3(0.034, 0.008, -0.056), new Vector3(0.022, -0.008, -0.054), new Vector3(0.008, -0.016, -0.05)];
  k.add(tube(thumb, (t) => 0.0118 * (1.05 - 0.15 * t + 0.06 * Math.exp(-((t - 0.5) ** 2) / 0.004)), { radial: 18, curve: true, samples: 22, caps: false }), 'glove', { color: TAN_D, occ: false });
  {
    const e = thumb[4], d = e.clone().sub(thumb[3]).normalize(), r = 0.0106;
    k.add(alongAxis(lathe([[r, 0], [r * 0.95, r * 0.4], [r * 0.7, r * 0.8], [0, r * 1.05]], { seg: 18 }), [e.x, e.y, e.z], [e.x + d.x, e.y + d.y, e.z + d.z]), 'glove', { color: TAN, occ: false });
  }

  // wrist cuff + jacket sleeve: loft along the forearm direction with fabric folds (seeded)
  const W = new Vector3(0.084, 0.043, -0.005), D = new Vector3(0.55, -0.42, 0.72).normalize();
  const M = new Matrix4().compose(W, new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), D), new Vector3(1, 1, 1));
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const sleeve = [];
  const ring = (d, a, b, c, ox = 0, oy = 0, p = 2.2) => sleeve.push({ x: ox, y: oy, z: -d, a, b, p, color: c });
  ring(-0.012, 0.016, 0.03, GLOVE_B); ring(-0.004, 0.022, 0.034, GLOVE_B);
  ring(0.0, 0.026, 0.037, GLOVE);
  for (let i = 1; i <= 7; i++) { const d = i * 0.0042, g = i % 2 ? 0.0016 : -0.0006; ring(d, 0.0268 + g, 0.0362 + g * 1.3, i % 2 ? GLOVE : GLOVE_B, (rnd() - 0.5) * 0.0015, (rnd() - 0.5) * 0.0015, 2.0 + rnd() * 0.4); } // gathered elastic
  ring(0.0315, 0.0275, 0.0355, GLOVE_B); ring(0.033, 0.0305, 0.0385, HIVIS); ring(0.045, 0.0305, 0.0385, HIVIS); ring(0.0465, 0.0285, 0.0365, GLOVE);
  ring(0.06, 0.029, 0.036, GLOVE); ring(0.062, 0.025, 0.031, 0x111111);                         // cuff opening (sleeve over it)
  ring(0.05, 0.03, 0.038, SLEEVE_D); ring(0.052, 0.04, 0.046, SLEEVE_D); ring(0.058, 0.043, 0.048, SLEEVE);
  for (let i = 1; i <= 16; i++) {
    const d = 0.058 + i * 0.018, f = 0.003 * Math.sin(i * 2.1) + (rnd() - 0.5) * 0.004;
    ring(d, 0.043 + i * 0.0011 + f, 0.048 + i * 0.0012 - f * 0.6, i % 5 === 0 ? SLEEVE_D : SLEEVE, (rnd() - 0.5) * 0.003, (rnd() - 0.5) * 0.003, 2.0 + rnd() * 0.5);
  }
  const sg = ringLoft(sleeve, 48);
  sg.applyMatrix4(M);
  k.add(sg, 'glove', { occ: false });
  // Velcro tab on the glove cuff
  const tab = new Vector3(0, 0, -0.016).applyMatrix4(M);
  k.box(0.004, 0.03, 0.026, 'glove', { at: [tab.x + 0.028, tab.y - 0.004, tab.z], rot: [0, 0, 0.35], r: 0.002, color: 0x1a1a18, occ: false });
}
