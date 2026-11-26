// carpark/signs — dry official signage (the humour lives here and in the HUD). Canvas-2D plates
// (decals/canvas-text.js) on real supports: DOC-style signs on 100 × 100 timber posts with a thick timber
// backing board, road signs on galvanised round posts with U-bolt clamps. buildSigns → [{ name, pos, rotY, w }]
import { signCanvas } from '../../cookbook/decals/canvas-text.js';
import { keaDiamondCanvas } from './canvases.js';

const GREEN = '#1f4a37', CREAM = '#efe8d4', YELLOW = '#d9a81c', BLACK = '#16181a', RED = '#9a1e14', BLUE = '#24467a';

// [name, canvas opts, plate centre, rotY (plate faces +Z rotated), width m, support kind]
const SIGNS = [
  ['kea', { w: 1.5, h: 1.0, bg: GREEN, fg: CREAM, border: CREAM, rivets: false, lines: [
    { text: 'DO NOT FEED THE KEA', size: 0.2 }, { text: 'They are not hungry.', size: 0.11 }, { text: 'They are curious. This is worse.', size: 0.1 },
    { text: 'Fine: $400 (payable by you, not the kea)', size: 0.07 }] },
    [-6, 1.75, -11.5], 0.25, 1.5, 'doc'],
  ['closed', { w: 2.4, h: 1.2, bg: CREAM, fg: BLACK, border: RED, borderW: 0.03, stripes: true, lines: [
    { text: 'SH73 CLOSED', size: 0.24, color: RED }, { text: 'Estimated reopening: when it reopens', size: 0.1 },
    { text: 'Updates will be posted here. This is the update.', size: 0.07 }] },
    [28.5, 2.0, -14.6], -1.2, 2.4, 'road2'],
  ['quake', { w: 1.6, h: 1.1, bg: YELLOW, fg: BLACK, border: BLACK, lines: [
    { text: 'AFTERSHOCK SEASON', size: 0.17 }, { text: 'IS NOW OPEN', size: 0.14 }, { text: 'Drop. Cover. Hold. In that order.', size: 0.09 },
    { text: 'Picnic tables are cover. Campervans are not.', size: 0.07 }] },
    [14, 1.75, -11.5], -0.2, 1.6, 'doc'],
  ['possum', { w: 1.4, h: 0.9, bg: CREAM, fg: BLACK, border: GREEN, rivets: false, lines: [
    { text: 'POSSUM CONTROL', size: 0.18, color: GREEN }, { text: 'IN PROGRESS', size: 0.13 }, { text: 'Please do not assist the possums.', size: 0.09 },
    { text: 'They have had enough help.', size: 0.08 }] },
    [0, 1.4, 17.0], Math.PI, 1.4, 'doc'],
  ['parking', { w: 1.2, h: 0.9, bg: BLUE, fg: CREAM, border: CREAM, lines: [
    { text: 'P', size: 0.36 }, { text: 'CAMPERVANS', size: 0.12 }, { text: 'Max stay: until further notice', size: 0.075 }] },
    [-20, 2.1, 0.5], Math.PI / 2, 1.2, 'road2'],
  ['keepLeft', { w: 1.3, h: 0.95, bg: CREAM, fg: BLACK, border: RED, borderW: 0.03, lines: [
    { text: 'KEEP LEFT', size: 0.22, color: RED }, { text: 'Drive on the left in New Zealand.', size: 0.095 },
    { text: '(When the road reopens.)', size: 0.09 }, { text: '(It has not.)', size: 0.08 }] },
    [9.6, 1.85, -15.2], 0.0, 1.3, 'road2'],
  ['noCamp', { w: 1.1, h: 0.8, bg: CREAM, fg: BLACK, border: GREEN, rivets: false, lines: [
    { text: 'NO CAMPING', size: 0.2, color: GREEN }, { text: 'Unless stranded.', size: 0.11 }, { text: 'Then: camping.', size: 0.11 }] },
    [26.5, 1.45, 16.7], Math.PI, 1.1, 'doc'],
  ['keaPlate', { w: 0.8, h: 0.36, bg: YELLOW, fg: BLACK, border: BLACK, lines: [
    { text: 'NEXT 400 m', size: 0.36 }, { text: '(They know.)', size: 0.24 }] },
    [-17, 1.55, -15.25], 0.45, 0.8, 'none'],
];

export function buildSigns(G, { k, dec, solid, rng }) {
  const out = [];
  for (const [name, o, pos, rotY, w, kind] of SIGNS) {
    const h = o.h * (w / o.w);
    dec.add(name, signCanvas({ ppm: 300, wear: 0.25 + rng() * 0.15, dirt: 0.25 + rng() * 0.15, ...o }));
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
      k.box(w + 0.02, h + 0.02, 0.006, 'steel', { at: [0, pos[1], -0.004], r: 0.003, color: 0x8c8c88 });
      const top = pos[1] + h / 2 - 0.04;
      for (const s of [-1, 1]) {
        const px = s * w * 0.3;
        k.cyl(0.03, top, 'steel', { at: [px, top / 2, -0.04], seg: 14 });
        k.cyl(0.033, 0.012, 'steel', { at: [px, top + 0.006, -0.04], seg: 14 });
        for (const dy of [-h * 0.3, h * 0.3]) k.box(0.08, 0.03, 0.05, 'steel', { at: [px, pos[1] + dy, -0.025], r: 0.006 });
        k.cyl(0.09, 0.04, 'concrete', { at: [px, 0.02, -0.04], color: 0x9e9a90, seg: 14 });
      }
      solid(pos[0], 0, pos[2], Math.max(0.3, w * 0.7), pos[1] + h / 2, 0.25);
    } else if (kind === 'none') {
      k.box(w + 0.02, h + 0.02, 0.006, 'steel', { at: [0, pos[1], -0.004], r: 0.003, color: 0x8c8c88 });
    }
    k.pop();
    dec.place(name, w, h, [pos[0] + Math.sin(rotY) * 0.004, pos[1], pos[2] + Math.cos(rotY) * 0.004], [0, rotY, 0], 'sign');
    out.push({ name, pos, rotY, w });
  }
  // KEA warning diamond + its supplementary plate on one galvanised post (the plate above is 'keaPlate')
  const kx = -17, kz = -15.25, kr = 0.45, dw = 0.9, dy = 2.2;
  dec.add('keaDiamond', keaDiamondCanvas({ w: dw }));
  k.push(kx, 0, kz, kr);
  k.box(dw / Math.SQRT2, dw / Math.SQRT2, 0.006, 'steel', { at: [0, dy, -0.004], rot: [0, 0, Math.PI / 4], r: 0.02 });
  k.cyl(0.035, dy + 0.1, 'steel', { at: [0, (dy + 0.1) / 2, -0.045], seg: 14 });
  k.cyl(0.038, 0.012, 'steel', { at: [0, dy + 0.106, -0.045], seg: 14 });
  for (const y of [dy - 0.2, dy + 0.2, 1.45, 1.65]) k.box(0.09, 0.03, 0.05, 'steel', { at: [0, y, -0.028], r: 0.006 });
  k.cyl(0.1, 0.04, 'concrete', { at: [0, 0.02, -0.045], color: 0x9e9a90, seg: 14 });
  k.pop();
  dec.place('keaDiamond', dw, dw, [kx + Math.sin(kr) * 0.004, dy, kz + Math.cos(kr) * 0.004], [0, kr, 0], 'sign');
  solid(kx, 0, kz, 0.2, dy, 0.2);
  out.push({ name: 'keaCrossing', pos: [kx, dy, kz], rotY: kr, w: dw });
  return out;
}
