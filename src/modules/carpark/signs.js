// carpark/signs — dry official signage (the humour lives here and in the HUD). Canvas-2D plates
// (decals/canvas-text.js) on real supports: DOC-style signs on 100 × 100 timber posts with a thick timber
// backing board, road signs on galvanised round posts with U-bolt clamps. buildSigns → [{ name, pos, rotY, w }]
import { signCanvas } from '../../cookbook/decals/canvas-text.js';
import { keaDiamondCanvas } from './canvases.js';

const GREEN = '#1f4a37', CREAM = '#efe8d4', DOCY = '#f2c21b', YELLOW = '#d9a81c', BLACK = '#16181a', RED = '#9a1e14', BLUE = '#24467a';

// [name, canvas opts, plate centre, rotY (plate faces +Z rotated), width m, support kind]
// One headline + one short punchline each, in big type (blind critic r1: signs were small and too dense).
// Plates are drawn at the base size and scaled ×SCALE at placement (canvas ppm drops so the atlas does not grow).
const SCALE = 1.6, ROAD_SCALE = 1.3;   // road plates on posts stay closer to real sizes (their backs face the poses)
const SIGNS = [
  ['kea', { w: 2.2, h: 1.4, bg: GREEN, fg: DOCY, border: DOCY, rivets: false, lines: [
    { text: 'DO NOT FEED THE KEA', size: 0.27 }, { text: 'They are curious. This is worse.', size: 0.16, color: CREAM }] },
    [-6, 1.9, -11.5], 0.25, 2.2, 'doc'],
  ['closed', { w: 2.4, h: 1.2, bg: CREAM, fg: BLACK, border: RED, borderW: 0.03, stripes: true, lines: [
    { text: 'SH73 CLOSED', size: 0.32, color: RED }, { text: 'Reopening: when it reopens.', size: 0.16 }] },
    [28.5, 2.0, -14.6], -1.2, 2.4, 'road2'],
  ['quake', { w: 2.0, h: 1.36, bg: YELLOW, fg: BLACK, border: BLACK, lines: [
    { text: 'AFTERSHOCK SEASON', size: 0.22 }, { text: 'IS NOW OPEN', size: 0.2 }, { text: 'Drop. Cover. Hold. In that order.', size: 0.14 }] },
    [14, 1.9, -11.5], -0.2, 2.0, 'doc'],
  ['possum', { w: 1.9, h: 1.2, bg: GREEN, fg: CREAM, border: DOCY, rivets: false, lines: [
    { text: 'POSSUM CONTROL', size: 0.27, color: DOCY }, { text: 'Please do not assist the possums.', size: 0.16 }] },
    [0, 1.6, 17.0], Math.PI, 1.9, 'doc'],
  ['parking', { w: 1.2, h: 0.9, bg: BLUE, fg: CREAM, border: CREAM, lines: [
    { text: 'P', size: 0.5 }, { text: 'Max stay: until further notice', size: 0.17 }] },
    [-20, 2.2, 0.5], Math.PI / 2, 1.2, 'road2'],
  ['keepLeft', { w: 1.3, h: 0.95, bg: CREAM, fg: BLACK, border: RED, borderW: 0.03, lines: [
    { text: 'KEEP LEFT', size: 0.32, color: RED }, { text: '(When the road reopens.)', size: 0.17 }] },
    [9.6, 1.9, -15.2], 0.0, 1.3, 'road2'],
  ['noCamp', { w: 1.5, h: 1.1, bg: GREEN, fg: CREAM, border: DOCY, rivets: false, lines: [
    { text: 'NO CAMPING', size: 0.3, color: DOCY }, { text: 'Unless stranded. Then: camping.', size: 0.16 }] },
    [26.5, 1.6, 16.7], Math.PI, 1.5, 'doc'],
  ['stay', { w: 2.4, h: 1.5, bg: GREEN, fg: CREAM, border: DOCY, rivets: false, lines: [
    { text: 'PASS CAR PARK', size: 0.25, color: DOCY }, { text: 'Stranded visitors: please remain stranded.', size: 0.14 }] },
    [-28.9, 2.0, 1.75], Math.PI / 2, 2.4, 'doc'],
];

export function buildSigns(G, { k, dec, solid, rng }) {
  const out = [];
  dec.add('signBack', signCanvas({ w: 1.0, h: 0.32, ppm: 260, bg: '#767874', fg: '#2a2c2a', border: null, rivets: false, wear: 0.15, dirt: 0.4, lines: [
    { text: 'THIS SIDE INTENTIONALLY LEFT BLANK', size: 0.3 }, { text: 'NZTA asset 73-0412  ·  inspected: yes', size: 0.16 }] }));
  for (const [name, o, pos0, rotY, w0, kind] of SIGNS) {
    const w = w0 * (kind === 'road2' ? ROAD_SCALE : SCALE), h = o.h * (w / o.w), pos = [pos0[0], Math.max(pos0[1], h / 2 + 0.62), pos0[2]];
    dec.add(name, signCanvas({ ppm: 200, wear: 0.2 + rng() * 0.1, dirt: 0.25 + rng() * 0.15, ...o }));
    k.push(pos[0], 0, pos[2], rotY);
    if (kind === 'doc') { // thick timber backing, two posts behind, concrete collars
      k.box(w + 0.1, h + 0.1, 0.045, 'wood', { at: [0, pos[1], -0.026], r: 0.008, color: 0x6a5a46 });
      const top = pos[1] + h / 2 + 0.12;
      for (const s of [-1, 1]) {
        k.box(0.1, top, 0.1, 'wood', { at: [s * (w / 2 - 0.18), top / 2, -0.1], r: 0.01, color: 0x6e5e4a });
        k.box(0.12, 0.02, 0.12, 'wood', { at: [s * (w / 2 - 0.18), top + 0.01, -0.1], r: 0.008, color: 0x5e5040 });
        k.cyl(0.13, 0.04, 'concrete', { at: [s * (w / 2 - 0.18), 0.02, -0.1], color: 0x9e9a90, seg: 14 });
      }
      solid(pos[0], 0, pos[2], Math.max(0.3, w * 0.9), pos[1] + h / 2, 0.3);
    } else if (kind === 'road2') { // 3 mm plate, two galvanised posts with U-bolt clamps
      // plate back: painted grey (not raw galvanising, which read as a rock slab), two Z-section stiffeners
      k.box(w + 0.02, h + 0.02, 0.006, 'paint', { at: [0, pos[1], -0.004], r: 0.003, color: 0x6a6c68 });
      for (const dy of [-h * 0.3, h * 0.3]) k.box(w - 0.06, 0.05, 0.02, 'steel', { at: [0, pos[1] + dy, -0.017], r: 0.005 });
      const top = pos[1] + h / 2 - 0.04;
      for (const s of [-1, 1]) {
        const px = s * w * 0.3;
        k.cyl(0.03, top, 'steel', { at: [px, top / 2, -0.04], seg: 14 });
        k.cyl(0.033, 0.012, 'steel', { at: [px, top + 0.006, -0.04], seg: 14 });
        for (const dy of [-h * 0.3, h * 0.3]) k.box(0.08, 0.03, 0.05, 'steel', { at: [px, pos[1] + dy, -0.025], r: 0.006 });
        k.cyl(0.09, 0.04, 'concrete', { at: [px, 0.02, -0.04], color: 0x9e9a90, seg: 14 });
      }
      solid(pos[0], 0, pos[2], Math.max(0.3, w * 0.7), pos[1] + h / 2, 0.25);
    }
    k.pop();
    dec.place(name, w, h, [pos[0] + Math.sin(rotY) * 0.004, pos[1], pos[2] + Math.cos(rotY) * 0.004], [0, rotY, 0], 'sign');
    if (kind === 'road2') { // the back faces somebody too
      const bw = Math.min(1.0, w * 0.5), bz = -0.0085;
      dec.place('signBack', bw, bw * 0.32, [pos[0] + Math.sin(rotY) * bz, pos[1] - h * 0.12, pos[2] + Math.cos(rotY) * bz], [0, rotY + Math.PI, 0], 'sign');
    }
    out.push({ name, pos, rotY, w });
  }
  // KEA warning diamond + its supplementary plate on one galvanised post (the plate above is 'keaPlate')
  const kx = -17, kz = -15.25, kr = 0.45, dw = 0.9, dy = 2.2;
  dec.add('keaDiamond', keaDiamondCanvas({ w: dw }));
  dec.add('keaPlate', signCanvas({ w: 0.8, h: 0.36, ppm: 300, bg: YELLOW, fg: BLACK, border: BLACK, wear: 0.2, lines: [
    { text: 'NEXT 400 m', size: 0.36 }, { text: '(They know.)', size: 0.24 }] }));
  k.push(kx, 0, kz, kr);
  k.box(dw / Math.SQRT2, dw / Math.SQRT2, 0.006, 'steel', { at: [0, dy, -0.004], rot: [0, 0, Math.PI / 4], r: 0.02 });
  k.cyl(0.035, dy + 0.1, 'steel', { at: [0, (dy + 0.1) / 2, -0.045], seg: 14 });
  k.cyl(0.038, 0.012, 'steel', { at: [0, dy + 0.106, -0.045], seg: 14 });
  for (const y of [dy - 0.2, dy + 0.2, 1.45, 1.65]) k.box(0.09, 0.03, 0.05, 'steel', { at: [0, y, -0.028], r: 0.006 });
  k.cyl(0.1, 0.04, 'concrete', { at: [0, 0.02, -0.045], color: 0x9e9a90, seg: 14 });
  k.box(0.82, 0.38, 0.006, 'paint', { at: [0, 1.55, -0.004], r: 0.003, color: 0x8e908c });
  k.pop();
  dec.place('keaPlate', 0.8, 0.36, [kx + Math.sin(kr) * 0.004, 1.55, kz + Math.cos(kr) * 0.004], [0, kr, 0], 'sign');
  dec.place('keaDiamond', dw, dw, [kx + Math.sin(kr) * 0.004, dy, kz + Math.cos(kr) * 0.004], [0, kr, 0], 'sign');
  solid(kx, 0, kz, 0.2, dy, 0.2);
  out.push({ name: 'keaCrossing', pos: [kx, dy, kz], rotY: kr, w: dw });
  return out;
}
