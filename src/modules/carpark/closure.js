// carpark/closure — the WEST closure of SH73 (the slip closes the east end; this end is closed too, by the same
// department, for consistency). Sits where the road vanishes in the vista pose: a chevron of water-filled
// barriers across both lanes, two flasher posts and a big SH73 CLOSED: SLIP board on a galvanised frame, facing
// the car park (+X). Geometry into the exterior Kit `k`; the board plate into the sign decal batch.
import { LAYOUT as L } from '../../contracts.js';
import { extrudeBevel, lathe } from '../../cookbook/geo/kit.js';
import { signCanvas } from '../../cookbook/decals/canvas-text.js';

export const CLOSURE_X = -40;
const PROF = [[-0.24, 0], [0.24, 0], [0.24, 0.1], [0.12, 0.24], [0.085, 0.76], [0.05, 0.8], [-0.05, 0.8], [-0.085, 0.76], [-0.12, 0.24], [-0.24, 0.1]];

export function buildClosure(G, { k, dec, solid, rng }) {
  const rd = L.road, x0 = CLOSURE_X, flashers = [];
  // barriers: five 2 m units in a shallow chevron pointing at the car park
  const barrier = extrudeBevel(PROF, { depth: 2.0, bevel: 0.025, bevelSeg: 2 });
  for (let i = 0; i < 5; i++) {
    const t = i - 2, z = rd.z + t * 1.95, x = x0 + Math.abs(t) * 0.55, ry = -Math.sign(t) * 0.26 + (rng() - 0.5) * 0.04;
    k.push(x, 0, z, ry);
    k.add(barrier.clone(), 'plastic', { color: i % 2 ? 0xc6c2b8 : 0xc8541c });
    for (const s of [-0.5, 0.5]) k.cyl(0.05, 0.03, 'plastic', { at: [0, 0.815, s], color: 0x2a2a2a, seg: 12 });
    for (const s of [-1, 1]) k.box(0.1, 0.5, 0.06, 'plastic', { at: [0, 0.4, s * 1.02], r: 0.02, color: i % 2 ? 0xbab6ac : 0xb84c1a });
    k.pop();
    solid(x, 0, z, 0.6, 0.82, 2.1);
  }
  // flasher posts at the road edges, lens facing the car park (+X), same heads as the gate
  const lens = lensGeo();
  [rd.z - rd.w / 2 - 0.4, rd.z + rd.w / 2 + 0.4].forEach((z, i) => {
    const px = x0 + 1.4, fy = 1.56;
    k.cyl(0.05, 1.45, 'steel', { at: [px, 0.725, z], seg: 14 });
    k.cyl(0.2, 0.05, 'concrete', { at: [px, 0.025, z], color: 0x9e9a90, seg: 16 });
    k.box(0.12, 0.26, 0.24, 'rubber', { at: [px - 0.04, fy, z], r: 0.02 });
    k.cyl(0.11, 0.02, 'rubber', { at: [px + 0.03, fy, z], rot: [0, 0, Math.PI / 2], seg: 24 });
    k.box(0.08, 0.03, 0.26, 'rubber', { at: [px + 0.06, fy + 0.12, z], r: 0.008 });
    k.add(lens.clone(), i ? 'lensA' : 'lensB', { at: [px + 0.04, fy, z], rot: [0, 0, -Math.PI / 2], occ: false });
    flashers.push([px + 0.06, fy, z]);
    solid(px, 0, z, 0.2, 1.6, 0.2);
  });
  // SH73 CLOSED: SLIP board — 4.2 × 2.1 m plate on a two-leg galvanised frame, bottom at 1.5 m (reads over the barriers)
  const bw = 4.2, bh = 2.1, by = 1.5 + bh / 2, bx = x0 - 1.6;
  dec.add('westClosed', signCanvas({ w: bw, h: bh, ppm: 150, bg: '#efe9d8', fg: '#16181a', border: '#9a1e14', borderW: 0.05, stripes: true,
    rivets: true, wear: 0.2, dirt: 0.3, lines: [{ text: 'SH73 CLOSED: SLIP', size: 0.28, color: '#9a1e14' }, { text: 'This end too. For balance.', size: 0.16 }] }));
  k.push(bx, 0, rd.z, Math.PI / 2);
  k.box(bw + 0.04, bh + 0.04, 0.008, 'paint', { at: [0, by, -0.005], r: 0.004, color: 0x8a8c88 });
  for (const y of [by - bh * 0.32, by + bh * 0.32]) k.box(bw - 0.1, 0.07, 0.05, 'steel', { at: [0, y, -0.04], r: 0.008 });
  for (const s of [-1, 1]) {
    const lx = s * bw * 0.34, top = by + bh / 2 - 0.05;
    k.box(0.1, top, 0.1, 'steel', { at: [lx, top / 2, -0.09], r: 0.01 });
    k.box(0.08, 0.08, 1.2, 'steel', { at: [lx, 0.75, -0.65], rot: [0.9, 0, 0], r: 0.008 });          // back strut
    k.box(0.3, 0.05, 0.3, 'concrete', { at: [lx, 0.025, -0.09], r: 0.012, color: 0x9e9a90 });
    k.box(0.5, 0.25, 0.4, 'concrete', { at: [lx, 0.125, -1.0], r: 0.02, color: 0xa29e94 });        // sandbag block
  }
  k.pop();
  dec.place('westClosed', bw, bh, [bx + 0.004, by, rd.z], [0, Math.PI / 2, 0], 'sign');
  solid(bx, 0, rd.z, 0.3, by + bh / 2, bw);
  return { flashers, sign: { name: 'westClosed', pos: [bx, by, rd.z], rotY: Math.PI / 2, w: bw } };
}

function lensGeo() {
  const p = [[0, 0.075]]; for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; p.push([Math.sin(a) * 0.1, Math.cos(a) * 0.075]); }
  p.push([0.1, 0]); p.push([0, 0]);
  return lathe(p.reverse(), { seg: 28, crease: 50 });
}
