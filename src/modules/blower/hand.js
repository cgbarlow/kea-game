// blower/hand — the ranger's right hand in a work glove on the blower's loop handle, plus the jacket sleeve.
// buildHand(k) writes into the blower Kit under key 'glove' (one fabric material, colours in vertex colour).
// Overhand grip: palm over the top of the bar, fingers wrapping down the -X side (the side the player sees) and under,
// thumb round the +X side, wrist out to the right, forearm running back to the bottom-right corner of the frame.
import { Vector3, Matrix4, Quaternion } from 'three';
import { lathe, tube } from '../../cookbook/geo/kit.js';
import { ringLoft, alongAxis } from './geo.js';

// worn tan rigger-style leather work glove (palm/fingers) with a darker oiled-leather back
const GLOVE = 0x4a3826, GLOVE_B = 0x3a2b1d, TAN = 0x6e4f31, TAN_B = 0x684a2d, TAN_W = 0x5a3f26, TAN_D = 0x4c3622, SEAM = 0x2e2218, SLEEVE = 0x3a473c, SLEEVE_D = 0x2b352d, HIVIS = 0x9a5a22;
const BAR = [0, 0.0135], BAR_R = 0.0178;

export function buildHand(k) {
  // fingers: [z, finger radius, start angle, end angle, orbit extra]. Each finger is ONE smooth swept tube on a
  // Catmull-Rom path that curls continuously round the bar (no straight phalanges, no crease rings): the orbit radius
  // swells softly over the PIP/DIP knuckles so the leather stands proud there, and the radius tapers to a padded tip.
  const F = [[-0.039, 0.0094, 1.85, 4.55, 0.003], [-0.0175, 0.0101, 1.8, 5.0, 0], [0.0035, 0.0097, 1.8, 4.95, 0], [0.0235, 0.0084, 1.85, 4.75, 0]];
  F.forEach(([z, fr, a0, a1, ex], i) => {
    const rr = BAR_R + fr + 0.0006 + ex, span = a1 - a0;
    const dz = i === 0 ? -0.004 : 0.002 * (i - 1.5);
    const bump = (t) => Math.exp(-((t - 0.42) ** 2) / 0.006) + 0.7 * Math.exp(-((t - 0.74) ** 2) / 0.005);
    const pts = [new Vector3(0.007, 0.05, z + 0.001)];
    for (let q = 0; q <= 14; q++) {
      const t = q / 14, a = a0 + span * t, o = rr * (1 + 0.07 * bump(t));
      pts.push(new Vector3(BAR[0] + o * Math.cos(a), BAR[1] + o * Math.sin(a), z + dz * t));
    }
    const rad = (t) => fr * (1.06 - 0.14 * t + 0.07 * bump(t * 0.94 + 0.03));
    k.add(tube(pts, rad, { radial: 20, curve: true, samples: 56, caps: false }), 'glove', { color: i % 2 ? TAN : TAN_B, occ: false });
    // rounded, slightly flattened fingertip cap along the last tangent (same leather, a touch darker from wear)
    const e = pts[pts.length - 1], p = pts[pts.length - 2], d = e.clone().sub(p).normalize(), r = rad(1);
    const tip = lathe([[r, 0], [r * 0.98, r * 0.3], [r * 0.88, r * 0.62], [r * 0.64, r * 0.88], [r * 0.32, r * 1.02], [0, r * 1.06]], { seg: 20 });
    k.add(alongAxis(tip, [e.x - d.x * 0.0004, e.y - d.y * 0.0004, e.z - d.z * 0.0004], [e.x + d.x, e.y + d.y, e.z + d.z]), 'glove', { color: TAN_W, occ: false });
    // single welted seam along the back of the finger (outer side, away from the bar)
    const st = [];
    for (let q = 2; q <= pts.length - 3; q++) { const c = pts[q], ox = c.x - BAR[0], oy = c.y - BAR[1], l = Math.hypot(ox, oy) || 1, rq = rad((q - 1) / 14) * 0.985; st.push(new Vector3(c.x + (ox / l) * rq, c.y + (oy / l) * rq, c.z)); }
    k.add(tube(st, 0.00055, { radial: 5, curve: true, samples: 30, caps: false }), 'glove', { color: SEAM, occ: false });
  });
  // padded palm heel: a soft leather bolster where the palm meets the -X side of the grip (between thumb and fingers)
  {
    const pad = [];
    for (let j = 0; j <= 8; j++) { const t = j / 8, sw = Math.sin(t * Math.PI); pad.push({ x: 0, y: 0, z: -(t * 0.07), a: 0.0062 * (0.35 + 0.65 * sw), b: 0.0115 * (0.35 + 0.65 * sw), p: 2.2, color: j % 4 === 0 ? TAN_D : TAN }); }
    const pg2 = ringLoft(pad, 28, { capStart: true });
    pg2.applyMatrix4(new Matrix4().makeRotationY(Math.PI)); pg2.translate(-0.0205, 0.037, -0.031);
    k.add(pg2, 'glove', { occ: false });
  }

  // palm / back of hand: a superellipse loft lying over the top of the grip, knuckles left, wrist right
  const palm = [];
  const P = [[-0.016, 0.043, 0.006, 0.04, 0.013, GLOVE], [-0.006, 0.048, 0.0, 0.046, 0.0165, GLOVE], [0.02, 0.05, -0.004, 0.047, 0.0175, GLOVE_B],
    [0.045, 0.049, -0.006, 0.045, 0.017, GLOVE_B], [0.07, 0.046, -0.006, 0.038, 0.0155, GLOVE], [0.088, 0.044, -0.005, 0.033, 0.0145, GLOVE]];
  for (const [x, y, z, a, b, c] of P) palm.push({ x: z, y, z: -x, a, b, p: 2.6, color: c });
  const pg = ringLoft(palm, 40, { capStart: true });
  pg.applyMatrix4(new Matrix4().makeRotationY(-Math.PI / 2));
  k.add(pg, 'glove', { occ: false });
  // knuckle bulges (stitched leather pads) + back-of-hand panel, facing up at the player
  for (let i = 0; i < 4; i++) {
    const zz = -0.036 + i * 0.021, rk = 0.0078 - (i === 3 ? 0.0012 : 0);
    const dome = lathe([[rk, 0], [rk * 0.92, rk * 0.3], [rk * 0.7, rk * 0.55], [rk * 0.35, rk * 0.7], [0, rk * 0.74]], { seg: 20 });
    dome.scale(1, 1, 1.15);
    k.add(dome, 'glove', { at: [-0.003, 0.0605, zz], rot: [0, 0, 0.32], color: TAN_D, occ: false });
  }
  // back-of-hand panel: a padded superellipse loft that follows the curve of the hand, a stitched border and a
  // reflective tab (grey, retroreflective) instead of a flat plate
  const back = [];
  for (let j = 0; j <= 6; j++) { const x = 0.012 + j * 0.0075, sw = Math.sin((j / 6) * Math.PI); back.push({ x: 0, y: 0, z: -x, a: 0.024 * (0.55 + 0.45 * sw), b: 0.0045 * (0.4 + 0.6 * sw), p: 2.4, color: GLOVE_B }); }
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
  k.box(0.004, 0.03, 0.026, 'glove', { at: [tab.x + 0.028, tab.y - 0.004, tab.z], rot: [0, 0, 0.35], r: 0.002, color: 0x2a2018, occ: false });
}
