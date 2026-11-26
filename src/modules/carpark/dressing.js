// carpark/dressing — what the aftershocks left on the apron and what the rangers put out since: precast wheel stops
// in every bay, front-end bay ticks and bay numbers, slip rubble that bounced off the road, road cones (some knocked over), an A-frame closure barricade at the lot exit
// and timber bollards. Geometry into the exterior Kit `k` (the rock key is a module-owned material), paint
// and stencils into the ground decal batch `gdec`, plates into the sign batch `dec`.
import { lathe } from '../../cookbook/geo/kit.js';
import { rockGeo } from '../../cookbook/geo/scatter.js';
import { signCanvas, stencilCanvas } from '../../cookbook/decals/canvas-text.js';
import { tint } from './timber.js';

const BAY_X0 = -18, BAY_N = 9, BAY_W = 4, BAY_Z0 = -0.5, BAY_Z1 = 8.5;

export function buildDressing(G, { k, dec, gdec, solid, rng }) {
  // ---- bay layout: front-end ticks, bay numbers, wheel stops (concrete, yellow-painted ends, two steel pins)
  for (let i = 0; i <= BAY_N; i++) {
    const x = BAY_X0 + i * BAY_W;
    k.box(0.6, 0.003, 0.1, 'paint', { at: [x, 0.0035, BAY_Z0], r: 0.001, color: 0xd6d0c0, occ: false });
  }
  for (let i = 0; i < BAY_N; i++) {
    const x = BAY_X0 + BAY_W / 2 + i * BAY_W, id = 'bay' + i;
    gdec.add(id, stencilCanvas({ text: String(i + 1), h: 0.55, ppm: 120, color: 'rgba(232,226,210,1)', wear: 0.55 }));
    gdec.flat(id, 0.5, null, x, 0.005, 1.0, Math.PI);
    const z = BAY_Z1 - 0.75 + (rng() - 0.5) * 0.06, ry = (rng() - 0.5) * 0.05, off = i === 5 ? 0.35 : 0;   // bay 6's stop walked
    k.push(x + off, 0, z, ry + (i === 5 ? 0.22 : 0));
    k.box(1.65, 0.11, 0.17, 'concrete', { at: [0, 0.055, 0], r: 0.025, color: tint(rng, 0xaaa69c, 0.06) });
    for (const s of [-1, 1]) {
      k.box(0.3, 0.112, 0.172, 'paint', { at: [s * 0.68, 0.056, 0], r: 0.024, color: 0xc8a21e });
      k.cyl(0.016, 0.01, 'steel', { at: [s * 0.45, 0.112, 0], seg: 8 });
    }
    k.pop();
  }
  // a joke bay, painted by someone with a stencil and time
  gdec.add('stNoKea', stencilCanvas({ text: 'NO KEA PARKING', h: 0.32, ppm: 140, color: 'rgba(214,180,48,1)', wear: 0.45 }));
  gdec.flat('stNoKea', 3.0, null, -16, 0.005, 4.4, Math.PI / 2);

  // rubble that bounced across SH73 from the slip and stopped on the apron edge
  const rocks = [[22, -16.8, 0.45], [25.5, -15.4, 0.3], [27.6, -17.6, 0.6], [19.4, -18.6, 0.22], [24, -21.3, 0.35], [14.8, -15.3, 0.16],
    [29, -12.4, 0.25], [8, -18.2, 0.12], [26.7, -13.6, 0.14], [21.2, -14.6, 0.1]];
  rocks.forEach(([x, z, r], i) => {
    k.add(rockGeo({ seed: 31 + i * 7, radius: r, detail: 2, squash: 0.62 }), 'rock', { at: [x, r * 0.05, z], rot: [0, rng() * 6.3, 0], color: tint(rng, 0x9a968e, 0.1) });
    if (r > 0.3) solid(x, 0, z, r * 1.6, r * 1.1, r * 1.6);
  });
  for (let i = 0; i < 26; i++) { // gravel chips around the big ones
    const [bx, bz, br] = rocks[i % 4], a = rng() * 6.3, d = br + 0.2 + rng() * 1.4;
    const s = 0.03 + rng() * 0.05;
    k.box(s * 1.4, s, s * 1.1, 'rock', { at: [bx + Math.cos(a) * d, s * 0.4, bz + Math.sin(a) * d], rot: [rng(), rng() * 3, rng()], r: s * 0.3, color: tint(rng, 0x8e8a82, 0.12), occ: false });
  }

  // ---- road cones (700 mm, orange with a reflective white collar); a few knocked flat by the last shake
  const coneProf = [[0, 0.7], [0.03, 0.7], [0.032, 0.69], [0.13, 0.06], [0.135, 0.05], [0, 0.05]];
  const collarProf = [[0.084, 0.42], [0.078, 0.44], [0.046, 0.56], [0.04, 0.58], [0.046, 0.58], [0.082, 0.44], [0.09, 0.42]];
  const coneG = lathe(coneProf.slice().reverse(), { seg: 20, crease: 40 });
  const collarG = lathe(collarProf.slice().reverse(), { seg: 20, crease: 40 });
  // a ring of cones around the fresh fault where it crosses the aisle (the heaved kerb and the cracks are surface.js)
  const cones = [[-18.2, 1.3, 0], [-16.4, 1.1, 0], [-14.6, -0.3, 0], [-13.3, -1.7, 1], [-18.6, -1.2, 0], [-16.8, -2.2, 0], [-15, -3.1, 0],
    [-6.8, -3.0, 0], [-4.4, -3.6, 0], [-2.1, -5.4, 1],
    [12.4, -12.3, 0], [14.2, -11.6, 0], [16.2, -12.9, 1], [-3, -13.2, 0], [9, -13.4, 0]];
  cones.forEach(([x, z, down]) => {
    const ry = rng() * 6.3;
    k.push(x, 0, z, ry);
    if (down) k.push(0, 0.13, 0, 0, 0, Math.PI / 2 - 0.19);
    k.box(0.36, 0.04, 0.36, 'rubber', { at: [0, 0.02, 0], r: 0.012, color: 0x1e1e1e });
    k.add(coneG.clone(), 'plastic', { color: 0xd8521a });
    k.add(collarG.clone(), 'plastic', { color: 0xe6e2d8 });
    if (down) k.pop();
    k.pop();
  });

  // ---- A-frame closure barricades across the exit lane (x -6..10 at the north kerb line)
  dec.add('barricade', signCanvas({ w: 1.8, h: 0.3, ppm: 260, bg: '#e8e2d2', fg: '#9a1e14', border: null, stripes: true, rivets: false, wear: 0.45, lines: [] }));
  dec.add('exitPlate', signCanvas({ w: 1.6, h: 0.5, ppm: 300, bg: '#1f4a37', fg: '#f2c21b', border: '#f2c21b', rivets: false, wear: 0.3, lines: [
    { text: 'EXIT CLOSED', size: 0.38 }, { text: 'ENTRY ALSO CLOSED. YOU ARE INSIDE.', size: 0.15 }] }));
  for (const [x, z, ry] of [[-2.6, -14.6, 0.04], [5.4, -14.5, -0.05]]) {
    k.push(x, 0, z, ry);
    for (const s of [-1, 1]) {
      for (const lx of [-0.8, 0.8]) k.bar([lx, 1.2, 0], [lx, 0, s * 0.42], 0.05, 0.035, 'paint', { color: 0xd8d2c4, r: 0.008 });
      k.box(0.12, 0.03, 0.08, 'rubber', { at: [-0.8, 0.015, s * 0.42], r: 0.008 });
      k.box(0.12, 0.03, 0.08, 'rubber', { at: [0.8, 0.015, s * 0.42], r: 0.008 });
    }
    for (const sd of [-1, 1]) k.box(1.84, 0.32, 0.025, 'paint', { at: [0, 1.0, sd * 0.085], rot: [-sd * 0.34, 0, 0], r: 0.006, color: 0xe0dacc });
    k.box(1.64, 0.54, 0.02, 'steel', { at: [0, 0.5, -0.27], rot: [0.34, 0, 0], r: 0.004, color: 0x8c8c88 });
    k.pop();
    const c = Math.cos(ry), s = Math.sin(ry), at = (lz, y) => [x + lz * s, y, z + lz * c];
    // striped boards face the road (-Z) and the lot (+Z); the EXIT CLOSED plate hangs on the road-side legs
    dec.place('barricade', 1.8, 0.3, at(-0.1, 1.0), [-0.34, ry + Math.PI, 0], 'sign');
    dec.place('barricade', 1.8, 0.3, at(0.1, 1.0), [-0.34, ry, 0], 'sign');
    dec.place('exitPlate', 1.6, 0.5, at(-0.284, 0.5), [-0.34, ry + Math.PI, 0], 'sign');
    solid(x, 0, z, 1.9, 1.2, 0.9);
  }

  // ---- timber bollards along the west verge in front of the shelter and toilet (keep vans off the grass)
  for (let z = -12; z <= 13; z += 2.5) {
    if ((z > -9 && z < -3) || (z > -0.5 && z < 4)) continue;   // shelter frontage + the car park board stay clear
    const x = -28.6, h = 0.75 + rng() * 0.04;
    k.push(x, 0, z, rng() * 0.2);
    k.box(0.2, h, 0.2, 'wood', { at: [0, h / 2, 0], r: 0.02, color: tint(rng, 0x6a5a44, 0.08) });
    k.box(0.21, 0.06, 0.21, 'paint', { at: [0, h - 0.12, 0], r: 0.012, color: 0xd8d2c2 });
    k.pop();
  }
}
