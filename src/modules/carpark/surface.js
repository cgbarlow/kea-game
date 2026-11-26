// carpark/surface — everything on or in the sealed surface: kerb + channel, worn 100 mm road paint, bay lines,
// ground stencils, raised pavement markers, edge marker posts, asphalt patch repairs and the quake cracks.
// Geometry goes into the exterior Kit `k`; paint/cracks/patches are decals in the ground batch (`dec`).
import { LAYOUT as L } from '../../contracts.js';
import { roadTextCanvas } from './canvases-ground.js';
import { paintLineCanvas, crackCanvas, patchCanvas } from './canvases.js';

const LINE_VARIANTS = 5, LINE_LEN = 6;

export function buildSurface(G, { k, dec, rng }) {
  const cp = L.carpark, rd = L.road;
  const jit = (base, a = 0.06) => { const f = 1 + (rng() - 0.5) * 2 * a; const c = base; return ((Math.min(255, ((c >> 16) & 255) * f) << 16) | (Math.min(255, ((c >> 8) & 255) * f) << 8) | Math.min(255, (c & 255) * f)) >>> 0; };

  // ---- canvases
  for (let i = 0; i < LINE_VARIANTS; i++) dec.add('line' + i, paintLineCanvas(LINE_LEN, 0.1, { seed: 11 + i * 7, wear: 0.42 + 0.1 * (i % 3) }));
  dec.add('lineY', paintLineCanvas(LINE_LEN, 0.1, { seed: 5, wear: 0.5, color: '#d8b02a' }));
  for (let i = 0; i < 5; i++) dec.add('crack' + i, crackCanvas(5, 0.5, { seed: 101 + i * 13, width: 0.014 + 0.006 * (i % 3) }));
  dec.add('crackS0', crackCanvas(5, 0.5, { seed: 303, sealed: true, width: 0.012 }));
  dec.add('crackS1', crackCanvas(5, 0.5, { seed: 317, sealed: true, width: 0.012 }));
  for (let i = 0; i < 3; i++) dec.add('patch' + i, patchCanvas(2 + i * 0.8, 1.2 + i * 0.5, { seed: 41 + i }));
  // road lettering: full condensed glyphs, elongated 1.6× along the reading axis, gentle erosion (never a lost stroke)
  dec.add('stCamper', roadTextCanvas({ text: 'CAMPERVANS', h: 0.6, ppm: 150, stretch: 1.6, wear: 0.2 }));
  dec.add('stKeep', roadTextCanvas({ text: 'KEEP LEFT', h: 0.9, ppm: 110, stretch: 1.8, wear: 0.22 }));
  dec.add('stNZ', roadTextCanvas({ text: 'NZ', h: 0.9, ppm: 110, stretch: 1.8, wear: 0.22 }));

  // ---- painted lines (decals, 3-6 mm above the surface, chained 6 m segments with random wear variants)
  let vi = 0;
  const line = (x0, z0, x1, z1, y = 0.004, name = null, w = 0.1) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx), n = Math.max(1, Math.ceil(len / LINE_LEN - 0.05));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, seg = len / n;
      dec.flat(name || 'line' + (vi++ % LINE_VARIANTS), seg + 0.02, w * 1.6, x0 + dx * (t0 + t1) / 2, y, z0 + dz * (t0 + t1) / 2, yaw);
    }
  };
  // SH73: dashed white centre line (3 m line / 7 m gap), continuous white edge lines; yellow no-passing near the gate
  for (let x = -88; x < 88; x += 10) {
    if (x > 18 && x < 34) continue;
    line(x, rd.z, x + 3, rd.z);
  }
  line(18, rd.z - 0.1, 34, rd.z - 0.1, 0.004, 'lineY'); line(18, rd.z + 0.1, 34, rd.z + 0.1, 0.004, 'lineY');
  for (const s of [-1, 1]) {
    const z = rd.z + s * (rd.w / 2 - 0.15);
    for (let x = -88; x < 88; x += 12) line(x, z, x + 12, z);
  }
  // car park: 9 campervan bays 4 m wide, lines 8.5 m long, a rear line and the aisle edge
  for (let i = 0; i <= 9; i++) { const x = -18 + i * 4; line(x, -0.5, x, 8.5); }
  line(-18, 8.5, 18, 8.5);
  for (let i = 0; i < 9; i++) if (i % 2 === 0) dec.flat('stCamper', 2.9, null, -16 + i * 4, 0.005, -0.15, Math.PI);
  // KEEP LEFT painted on the exit lane, for visitors from countries that drive on the other side
  dec.flat('stKeep', 3.0, null, 2, 0.005, -17.7, Math.PI, 'ground');
  dec.flat('stNZ', 0.9, null, 2, 0.005, -16.5, Math.PI, 'ground');
  // raised reflective pavement markers on the centre line, every 10 m in the gaps
  for (let x = -85; x < 88; x += 10) k.box(0.1, 0.018, 0.1, 'paint', { at: [x + 1.5 + 5, 0.009, rd.z], r: 0.006, color: 0xbdb8aa, step: 1 });

  // ---- kerb (150 mm, bevelled) + 300 mm concrete channel, precast 2.4 m lengths with a joint between each
  const kerbRun = (x0, z0, x1, z1) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), n = Math.max(1, Math.round(len / 2.4)), seg = len / n, ry = Math.atan2(-dz, dx);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + dx * t, z = z0 + dz * t;
      k.push(x, 0, z, ry);
      k.box(seg - 0.012, 0.16, 0.16, 'concrete', { at: [0, 0.08, 0], r: 0.025, color: jit(0xb4b0a8, 0.07) });
      k.box(seg - 0.006, 0.012, 0.3, 'concrete', { at: [0, 0.004, 0.23], r: 0.004, color: jit(0x9a968e, 0.06) });
      k.pop();
    }
  };
  // channel sits on the apron side: run each edge so that local +Z points into the apron
  kerbRun(cp.x1, cp.z1, cp.x0, cp.z1);           // south edge (forest side), local +Z = -Z world into apron
  kerbRun(cp.x0, cp.z1, cp.x0, cp.z0 + 0.0);      // west edge
  kerbRun(cp.x1, cp.z0, cp.x1, cp.z1);           // east edge
  kerbRun(cp.x0, cp.z0, -6, cp.z0);              // north edge, west of the entrance
  kerbRun(10, cp.z0, 16.05, cp.z0);              // north edge, east of the entrance (broken by the fault at x 17)
  kerbRun(18.35, cp.z0, cp.x1, cp.z0);
  // kerb ends at the entrance: dropped ramps
  for (const x of [-6, 10]) k.box(0.6, 0.08, 0.16, 'concrete', { at: [x + (x < 0 ? 0.3 : -0.3), 0.04, cp.z0], r: 0.02, color: 0xa8a49c });

  // ---- edge marker posts along SH73 (white, red reflector on the left side of the traffic)
  for (let x = -85; x <= 28; x += 15) {
    for (const s of [-1, 1]) {
      const z = rd.z + s * (rd.w / 2 + 0.8);
      if (s > 0 && x > cp.x0 - 2 && x < cp.x1 + 2) continue;
      const ox = x + (s > 0 ? 7 : 0);
      k.box(0.1, 1.0, 0.05, 'paint', { at: [ox, 0.5, z], r: 0.012, color: jit(0xc4c0b6, 0.04) });
      k.box(0.06, 0.12, 0.006, 'paint', { at: [ox, 0.86, z - s * 0.028], r: 0.002, color: s < 0 ? 0x9a1a12 : 0xc8b070 });
      k.box(0.08, 0.16, 0.06, 'paint', { at: [ox, 0.92, z], r: 0.01, color: 0x2a2a2a });
    }
  }

  // ---- patch repairs (darker newer seal) and the quake cracks
  const patches = [[-14, -6, 0.2], [6, -3.5, -0.1], [22, -6, 0.05], [-4, 11, 0.1], [14, 12.5, -0.2], [-25, 1.5, 0.0], [10, -20.8, 0], [-36, -19.2, 0], [26, -18.5, 0.1]];
  patches.forEach(([x, z, yaw], i) => dec.flat('patch' + (i % 3), 2 + (i % 3) * 0.8, 1.2 + (i % 3) * 0.5, x, 0.003, z, yaw));
  // main crack: an aftershock fault run diagonally across the apron and onto the road; offset branches
  const runs = [
    [[-31, 3], [-24, 1.6], [-17, 0.2], [-11, -2.4], [-5, -4.6], [1, -6.3], [7, -7.3], [13, -9.6], [18, -12.2], [22, -15.5], [26, -19], [30, -22.5]],
    [[-5, -4.6], [-3, 0.5], [-1.5, 6], [0.5, 11], [1, 15.6]],
    [[13, -9.6], [18.5, -6.5], [24, -5.2], [29.6, -3.4]],
    [[-26, -16.2], [-20, -18.5], [-14, -19.6], [-8, -21.4], [-3, -23.8]],
    [[20, 9], [24, 12], [27, 15.4]],
  ];
  let ci = 0;
  runs.forEach((pts, r) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(-(z1 - z0), x1 - x0);
      const name = (r === 3 || (r === 0 && i > 8)) ? 'crackS' + (i % 2) : 'crack' + (ci++ % 5);
      dec.flat(name, len + 0.04, 0.5, (x0 + x1) / 2, 0.0035, (z0 + z1) / 2, yaw);
    }
  });
  // a heaved slab edge where the main crack crosses the north kerb: kerb section displaced up and twisted
  k.box(2.2, 0.16, 0.16, 'concrete', { at: [17.2, 0.11, cp.z0 + 0.02], rot: [0.05, 0.06, 0.04], r: 0.025, color: 0xaca89f });
}
