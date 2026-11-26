// blower/hand — the ranger's right hand in a work glove on the blower's loop handle, plus the jacket sleeve.
// buildHand(k) writes into the blower Kit under key 'glove' (one fabric material, colours in vertex colour).
// Overhand grip: palm over the top of the bar, fingers wrapping down the -X side (the side the player sees) and under,
// thumb round the +X side, wrist out to the right, forearm running back to the bottom-right corner of the frame.
import { Vector3, Matrix4, Quaternion } from 'three';
import { lathe, tube } from '../../cookbook/geo/kit.js';
import { ringLoft, alongAxis, arcPath } from './geo.js';

const GLOVE = 0x2e302b, GLOVE_B = 0x23241f, TAN = 0x7c6042, TAN_D = 0x5e4730, SLEEVE = 0x3a473c, SLEEVE_D = 0x2b352d, HIVIS = 0xb8661c;
const BAR = [0, 0.0135], BAR_R = 0.0178;

export function buildHand(k) {
  // fingers: [z, finger radius, start angle, end angle, orbit extra]
  const F = [[-0.039, 0.0098, 1.85, 4.55, 0.004], [-0.0175, 0.0103, 1.8, 5.0, 0], [0.0035, 0.0099, 1.8, 4.95, 0], [0.0235, 0.0087, 1.85, 4.75, 0]];
  F.forEach(([z, fr, a0, a1, ex], i) => {
    const rr = BAR_R + fr + 0.0006 + ex;
    const path = arcPath(BAR[0], BAR[1], z, rr, a0, a1, 18, i === 0 ? -0.004 : 0.002 * (i - 1.5));
    // proximal starts inside the palm: prepend a point toward the palm
    path.unshift(new Vector3(0.006, 0.05, z + 0.001));
    const rad = (t) => {
      const j1 = Math.exp(-((t - 0.36) ** 2) / 0.003), j2 = Math.exp(-((t - 0.68) ** 2) / 0.002);
      return fr * (1.02 - 0.12 * t + 0.07 * j1 + 0.05 * j2) / 1;
    };
    k.add(tube(path, (t) => rad(t), { radial: 18, caps: false }), 'glove', { color: GLOVE, occ: false });
    // fingertip: leather-reinforced cap along the last tangent
    const e = path[path.length - 1], p = path[path.length - 2], d = e.clone().sub(p).normalize(), r = rad(1);
    const tip = lathe([[r, 0], [r * 0.97, r * 0.35], [r * 0.82, r * 0.7], [r * 0.5, r * 0.95], [0, r * 1.05]], { seg: 18 });
    k.add(alongAxis(tip, [e.x - d.x * 0.0005, e.y - d.y * 0.0005, e.z - d.z * 0.0005], [e.x + d.x, e.y + d.y, e.z + d.z]), 'glove', { color: TAN, occ: false });
    // leather band over the middle phalanx (seam detail that reads at 0.5 m)
    const m = path[Math.round(path.length * 0.62)], m2 = path[Math.round(path.length * 0.62) + 1], dm = m2.clone().sub(m).normalize();
    k.add(alongAxis(lathe([[fr * 1.05, 0], [fr * 1.1, 0.002], [fr * 1.1, 0.008], [fr * 1.05, 0.01]], { seg: 18 }), [m.x, m.y, m.z], [m.x + dm.x, m.y + dm.y, m.z + dm.z]), 'glove', { color: TAN_D, occ: false });
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
  for (let i = 0; i < 4; i++) k.box(0.016, 0.009, 0.017, 'glove', { at: [-0.004, 0.064, -0.036 + i * 0.021], rot: [0, 0, 0.25], r: 0.004, color: 0x1a1b19, occ: false });
  k.box(0.045, 0.007, 0.058, 'glove', { at: [0.035, 0.066, -0.006], r: 0.005, color: 0x1d1e1b, occ: false });
  k.box(0.03, 0.004, 0.022, 'glove', { at: [0.04, 0.0705, -0.006], r: 0.002, color: HIVIS, occ: false });

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
  ring(0.0, 0.026, 0.037, GLOVE); ring(0.03, 0.027, 0.035, GLOVE); ring(0.034, 0.029, 0.037, HIVIS); ring(0.044, 0.029, 0.037, HIVIS); ring(0.048, 0.028, 0.036, GLOVE);
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
