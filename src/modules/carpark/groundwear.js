// carpark/groundwear — use and quake damage on the sealed surface: oil stains under the bays, tyre marks swinging
// into the bays and along the lanes, darker glossy wet patches (their own low-roughness decal group 'wet'), and the
// gravel/scree that the shakes spilled off the north slope onto the road edge (fan decals + loose stones).
import { rockGeo } from '../../cookbook/geo/scatter.js';
import { oilCanvas, tyreCanvas, wetCanvas, screeCanvas } from './canvases-ground.js';
import { tint } from './timber.js';

export function buildGroundWear(G, { k, gdec, solid, rng }) {
  // ---- canvases (a few variants each, reused with random yaw/size)
  for (let i = 0; i < 4; i++) gdec.add('oil' + i, oilCanvas(1.3, 0.9, { seed: 61 + i * 11 }));
  for (let i = 0; i < 3; i++) gdec.add('tyre' + i, tyreCanvas(9, 2.8, { seed: 7 + i * 5, bend: [0.9, -0.6, 0.2][i], alpha: 0.3 + i * 0.05 }));
  for (let i = 0; i < 4; i++) gdec.add('wet' + i, wetCanvas(3.2, 2.2, { seed: 19 + i * 3, alpha: 0.42 }));
  for (let i = 0; i < 3; i++) gdec.add('scree' + i, screeCanvas(7, 4.6, { seed: 23 + i * 9 }));

  // ---- tyre marks first (paint and oil sit over them in the merged mesh order)
  const tyres = [[-21.5, -0.5, -1.15, 9], [-20, -3.2, 0.35, 9], [-8.5, -4.2, -0.3, 9], [4, -3.4, 0.5, 8], [15.5, -4.6, -0.2, 9],
    [-17, -9.2, 0.08, 9], [7.5, -10.2, 0.04, 9], [-24.5, -10.5, 1.3, 7], [-31, -18.6, 0, 9], [11, -21.6, 0, 9], [-52, -21.4, 0, 9], [-4, -18.8, 3.1, 9]];
  tyres.forEach(([x, z, yaw, L], i) => gdec.flat('tyre' + (i % 3), L, 2.8, x, 0.0026, z, yaw));

  // ---- oil: one under the engine of most bays (vans park nose to -Z), a few drips in the aisle and on the road
  for (let i = 0; i < 9; i++) {
    if (i === 3) continue;
    const x = -16 + i * 4 + (rng() - 0.5) * 0.8, z = 1.2 + rng() * 1.4, s = 0.8 + rng() * 0.5;
    gdec.flat('oil' + (i % 4), 1.3 * s, 0.9 * s, x, 0.0032, z, rng() * 6.3);
  }
  for (const [x, z, s] of [[-20.6, -1.8, 0.7], [-6, -8.5, 0.5], [9.5, -6.2, 0.6], [-14, -17.6, 0.8], [18, -19.4, 0.6], [-23.4, 1.2, 0.45]]) {
    gdec.flat('oil' + Math.floor(rng() * 4), 1.3 * s, 0.9 * s, x, 0.0032, z, rng() * 6.3);
  }

  // ---- wet patches (glossy group): low spots on the apron and the road, a couple in the reverse-pose foreground
  const wet = [[-21.4, -0.8, 1.2], [-17.6, -4.4, 0.9], [-11, -7.4, 1.1], [3, -5.6, 0.8], [10.5, -1.2, 1.0], [22, -8.5, 1.2], [-4, 12, 0.9],
    [15, 11.4, 1.0], [-25.2, 10.2, 0.7], [-20, -19.2, 1.4], [5, -18.6, 1.1], [24, -22.2, 1.0], [-38, -21.6, 1.2], [-23.6, -2.6, 0.6]];
  wet.forEach(([x, z, s], i) => gdec.flat('wet' + (i % 4), 3.2 * s, 2.2 * s, x, 0.0022, z, rng() * 6.3, 'wet'));

  // ---- scree fans off the north slope onto the road's north edge (canvas top = slope side = -Z)
  const fans = [[-36, 0.9], [-21, 1.15], [-7, 0.8], [8, 1.0], [19, 1.25]];
  fans.forEach(([x, s], i) => {
    const d = 4.6 * s, zc = -26 + d / 2 - 0.15;
    gdec.flat('scree' + (i % 3), 7 * s, d, x, 0.0034, zc, (rng() - 0.5) * 0.25);
    // loose stones on the fan: denser near the slope, a few rolled out further
    const n = Math.round(26 * s);
    for (let j = 0; j < n; j++) {
      const t = Math.pow(rng(), 1.7), px = x + (rng() - 0.5) * 6 * s * (1 - t * 0.6), pz = -25.8 + t * d * 0.95;
      const r = 0.03 + rng() * rng() * 0.11;
      if (r > 0.09) k.add(rockGeo({ seed: 400 + i * 50 + j, radius: r, detail: 1, squash: 0.6 }), 'rock', { at: [px, r * 0.2, pz], rot: [0, rng() * 6.3, 0], color: tint(rng, 0x9a968c, 0.12), occ: false });
      else k.box(r * 1.5, r * 0.8, r * 1.2, 'rock', { at: [px, r * 0.35, pz], rot: [rng() * 0.6, rng() * 3, rng() * 0.6], r: r * 0.3, seg: 1, color: tint(rng, 0x8e8a82, 0.14), occ: false });
    }
    // one proper boulder per larger fan (a kerb-height obstacle the player can stand behind)
    if (s > 1) {
      const r = 0.38 * s, bx = x + (rng() - 0.5) * 2;
      k.add(rockGeo({ seed: 520 + i, radius: r, detail: 2, squash: 0.62 }), 'rock', { at: [bx, r * 0.05, -24.9], rot: [0, rng() * 6.3, 0], color: tint(rng, 0x9a968e, 0.08) });
      solid(bx, 0, -24.9, r * 1.6, r * 1.1, r * 1.6);
    }
  });
}
