// blower/detail — secondary forms and baked wear for the view model (load-time only).
//   addMouldDetail(k, { T0, TD, M })  seam lines, screw towers, vents, panel breaks, flared nozzle ribs (into the Kit)
//   bakeWear(k)                       vertex-colour wear on the plastic: UV-faded orange on up faces, scuffs,
//                                     grass stain + dirt on the nozzle, dust in the crevices low on the housing
// Model space as model.js: metres, origin = loop-handle grip centre, X right, Y up, -Z forward.
import { Vector3 } from 'three';
import { lathe } from '../../cookbook/geo/kit.js';
import { vnoise3, fbm3 } from '../../cookbook/geo/noise.js';
import { alongAxis } from './geo.js';

const DARK = 0x1b1c1d, HOUSE = 0x606366, HOUSE_D = 0x3a3c3f, ORANGE_W = 0xa03c12;

export function addMouldDetail(k, { M }) {
  // ---- volute drum: parting-line flange (raised lip both sides of a groove) + screw towers along it
  const flange = lathe([[0.1188, 0], [0.1222, 0.0012], [0.1222, 0.0042], [0.1196, 0.0052], [0.1196, 0.0068], [0.1222, 0.0078], [0.1222, 0.0108], [0.1188, 0.012]], { seg: 72, crease: 30 });
  k.add(alongAxis(flange, [-0.034, -0.17, 0.02], [-0.022, -0.17, 0.02]), 'plastic', { color: HOUSE_D, occ: false });
  for (let i = 0; i < 7; i++) {
    const a = 0.35 + i * 0.62, c = Math.cos(a), s = Math.sin(a);
    if (s < -0.55) continue; // the tank hides the underside
    const y = -0.17 + s * 0.127, z = 0.02 + c * 0.127;
    k.box(0.022, 0.012, 0.014, 'plastic', { at: [-0.028, y, z], rot: [-a + Math.PI / 2, 0, 0], r: 0.0045, color: HOUSE, occ: false });
    k.cyl(0.0032, 0.004, 'metal', { at: [-0.028, -0.17 + s * 0.1335, 0.02 + c * 0.1335], rot: [-a + Math.PI / 2, 0, 0], seg: 10, bevel: 0.001, occ: false });
  }
  // embossed direction-of-rotation arrow on the left face, outside the grille
  k.box(0.003, 0.004, 0.03, 'plastic', { at: [-0.0868, -0.06, 0.03], rot: [0.5, 0, 0], r: 0.0012, color: HOUSE_D, occ: false });
  k.box(0.003, 0.004, 0.012, 'plastic', { at: [-0.0868, -0.068, 0.044], rot: [1.4, 0, 0], r: 0.0012, color: HOUSE_D, occ: false });

  // ---- engine shroud: side intake louvres, screw bosses
  for (let i = 0; i < 7; i++) {
    k.box(0.006, 0.006, 0.07, 'plastic', { at: [0.1225, -0.13 - i * 0.0105, -0.07], rot: [0, 0, -0.5], r: 0.002, color: ORANGE_W, occ: false });
  }
  k.box(0.004, 0.078, 0.078, 'plastic', { at: [0.1205, -0.161, -0.07], r: 0.002, color: 0x0d0d0d, occ: false });  // louvre bed
  for (const [y, z] of [[-0.068, 0.13], [-0.068, -0.09], [-0.248, 0.13]]) {
    k.cyl(0.0065, 0.006, 'plastic', { at: [0.123, y, z], rot: [0, 0, Math.PI / 2], seg: 16, color: ORANGE_W, occ: false });
    k.cyl(0.0034, 0.003, 'metal', { at: [0.1268, y, z], rot: [0, 0, Math.PI / 2], seg: 10, bevel: 0.0008, occ: false });
  }
  // moulded maker's recess on the shroud top (a raised border round a slightly sunk panel)
  k.box(0.05, 0.0025, 0.035, 'plastic', { at: [0.083, -0.0592, -0.088], r: 0.0012, color: ORANGE_W, occ: false });
  // air-filter cover: parting seam where it meets the housing + two latch clips
  for (const x of [-0.05, 0.09]) k.box(0.016, 0.026, 0.008, 'plastic', { at: [x, -0.092, 0.2035], r: 0.003, color: DARK, occ: false });

  // ---- tube: blow-moulded parting lines down both flanks, grip ribs behind the collar, wear bumper ribs on the nozzle
  k.pushMatrix(M);
  const seam = (z0, z1, r0, r1) => {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, za = z0 + (z1 - z0) * t0, zb = z0 + (z1 - z0) * t1, ra = r0 + (r1 - r0) * t0, rb = r0 + (r1 - r0) * t1;
      for (const sx of [-1, 1]) k.bar([sx * (ra + 0.0006), 0, -za], [sx * (rb + 0.0006), 0, -zb], 0.0024, 0.0026, 'plastic', { r: 0.0009, color: ORANGE_W, occ: false });
    }
  };
  seam(0.162, 0.448, 0.0458, 0.0412); seam(0.48, 0.716, 0.0384, 0.0332);
  for (let i = 0; i < 4; i++) {
    const z = 0.175 + i * 0.011, r = 0.0458 - i * 0.0002;
    k.add(alongAxis(lathe([[r - 0.001, 0], [r + 0.0018, 0.0012], [r + 0.0018, 0.0036], [r - 0.001, 0.0048]], { seg: 48 }), [0, 0, -z], [0, 0, -z - 0.0048]), 'plastic', { color: ORANGE_W, occ: false });
  }
  // flared tip: two raised skid ribs on top and bottom of the flat nozzle + a darker scuffed bumper lip
  for (const sy of [-1, 1]) for (const x of [-0.03, 0.03]) {
    k.bar([x * 0.7, sy * 0.022, -0.765], [x, sy * 0.0142, -0.842], 0.004, 0.003, 'plastic', { r: 0.0012, color: ORANGE_W, occ: false });
  }
  k.pop();
}

// vertex-colour wear on the plastic bucket (multiplies the per-part colours)
export function bakeWear(k, { T0, TD }) {
  const geos = k.buckets.get('plastic') || [];
  const o = new Vector3(...T0), p = new Vector3();
  for (const g of geos) {
    const P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array;
    for (let v = 0; v < P.length / 3; v++) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], ny = N[v * 3 + 1];
      const r = C[v * 3], gg = C[v * 3 + 1], b = C[v * 3 + 2];
      const orange = r > gg * 1.7 && r > 0.15;                           // tinted orange parts only
      let mr = 1, mg = 1, mb = 1;
      // macro value break-up so no panel is a flat, even colour
      const blot = 0.8 + 0.3 * fbm3(x * 22, y * 22, z * 22, 3, 5);
      mr *= blot; mg *= blot; mb *= blot;
      if (orange) {
        // UV fade: up-facing orange bleaches toward a chalky salmon
        const sun = Math.max(0, ny) * (0.55 + 0.45 * vnoise3(x * 30, y * 30, z * 30, 11));
        mr *= 1 + 0.12 * sun; mg *= 1 + 0.42 * sun; mb *= 1 + 0.75 * sun;
        // scuffs: sparse light scratches where it gets set down and dragged
        const sc = vnoise3(x * 160, y * 40, z * 160, 23);
        if (sc > 0.78) { const w = (sc - 0.78) / 0.22; mr *= 1 + 0.18 * w; mg *= 1 + 0.4 * w; mb *= 1 + 0.6 * w; }
      } else {
        // grey housing: pale scuffs + warm dust film that thickens toward the bottom and in the corners
        const sc = vnoise3(x * 140, y * 50, z * 140, 29);
        if (sc > 0.74) { const w = (sc - 0.74) / 0.26; mr *= 1 + 0.35 * w; mg *= 1 + 0.33 * w; mb *= 1 + 0.28 * w; }
        const film = 0.5 + 0.5 * fbm3(x * 18, y * 18, z * 18, 3, 17);
        mr *= 1 + 0.08 * film; mg *= 1 + 0.04 * film; mb *= 1 - 0.03 * film;
      }
      // along the tube: dirt + grass stain building toward the nozzle mouth (it gets dug into the verge)
      p.set(x, y, z).sub(o); const t = p.dot(TD);
      if (t > 0.55) {
        const f = Math.min(1, (t - 0.55) / 0.3), n = vnoise3(x * 60, y * 60, z * 60, 31), lo = Math.max(0, -ny) * 0.5 + 0.5;
        const grass = f * f * Math.max(0, n - 0.25) * 1.2 * lo, dirt = f * 0.35 * lo;
        mr *= (1 - dirt * 0.35) * (1 - grass * 0.55); mg *= (1 - dirt * 0.4) * (1 - grass * 0.05); mb *= (1 - dirt * 0.5) * (1 - grass * 0.7);
      }
      // dust settles in crevices low on the housing (warm grey, under-sides and bottoms)
      if (y < -0.2 && !orange) { const d = Math.min(1, (-0.2 - y) / 0.12) * (0.5 + 0.5 * vnoise3(x * 40, y * 40, z * 40, 3)); mr = mr * (1 - d * 0.25) + d * 0.12; mg = mg * (1 - d * 0.25) + d * 0.1; mb = mb * (1 - d * 0.25) + d * 0.07; }
      C[v * 3] = r * mr; C[v * 3 + 1] = gg * mg; C[v * 3 + 2] = b * mb;
    }
    g.attributes.color.needsUpdate = true;
  }
}
