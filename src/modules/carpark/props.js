// carpark/props — long drop, picnic tables (aftershock cover), DOC 200 trap boxes with mesh mouths and trap-line
// markers, kea-proof bins, lamp-pole plinths, the ROAD CLOSED swing gate with water-filled barriers, concrete
// blocks, rail fence and two amber flasher heads. All real-scale, bevelled, into the exterior Kit `k`.
import { LAYOUT as L } from '../../contracts.js';
import { extrudeBevel, lathe } from '../../cookbook/geo/kit.js';
import { signCanvas, stencilCanvas } from '../../cookbook/decals/canvas-text.js';
import { bbWall, corrugatedRoof, tint } from './timber.js';

export function buildProps(G, { k, dec, solid, rng }) {
  toilet(k, dec, solid, rng);
  tables(k, dec, solid, rng);
  traps(k, dec, solid, rng);
  bins(k, dec, solid, rng);
  for (const [x, z] of L.lamps) { // the pole itself is lights.js; footing + collider here
    k.cyl(0.26, 0.32, 'concrete', { at: [x + 0.3, 0.12, z - 0.45], color: 0xa4a097, seg: 20 });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; k.cyl(0.012, 0.06, 'steel', { at: [x + 0.3 + Math.cos(a) * 0.15, 0.3, z - 0.45 + Math.sin(a) * 0.15], seg: 6 }); }
    solid(x + 0.3, 0, z - 0.45, 0.3, 8, 0.3);
  }
  return gate(k, dec, solid, rng);
}

// ---------------------------------------------------------------- long drop (2.4 m, door to +X)
function toilet(k, dec, solid, rng) {
  const T = L.toilet, hw = T.w / 2, hd = T.d / 2, xW = T.x - hw, xE = T.x + hw, zN = T.z - hd, zS = T.z + hd;
  const hB = T.h - 0.3, hF = T.h, C = 0xb8bc98;
  k.box(T.w + 0.5, 0.1, T.d + 0.5, 'concrete', { at: [T.x + 0.1, 0.05, T.z], r: 0.02, color: 0xa8a49a });
  k.box(0.7, 0.06, 1.1, 'concrete', { at: [xE + 0.6, 0.03, T.z], rot: [0, 0, -0.08], r: 0.02, color: 0xa29e94 });  // ramp
  const wall = (x, z, ry, len, h0, h1, gaps) => { k.push(x, 0.1, z, ry); bbWall({ len, h0: h0 - 0.1, h1: h1 - 0.1, rng, out: k, colour: C, gaps }); k.pop(); };
  wall(xE, zN, Math.PI, T.w, hF, hB);
  wall(xW, zS, 0, T.w, hB, hF);
  wall(xW, zN, -Math.PI / 2, T.d, hB, hB);
  wall(xE, zS, Math.PI / 2, T.d, hF, hF, [[0.78, 1.62]]);           // east (front) wall with the door opening
  // door: ledged boards, frame, handle, OCCUPIED/VACANT slider, LONG DROP sign
  const dz = T.z;
  for (let i = 0; i < 5; i++) k.box(0.016 + 0.02, 1.98, 0.165, 'wood', { at: [xE + 0.03, 1.1, dz - 0.34 + i * 0.17], r: 0.003, color: tint(rng, 0x6a7258, 0.06) });
  for (const y of [0.35, 1.85]) k.box(0.025, 0.12, 0.8, 'wood', { at: [xE + 0.055, 0.1 + y, dz], r: 0.004, color: 0x606a50 });
  for (const z of [dz - 0.44, dz + 0.44]) k.box(0.05, 2.1, 0.07, 'wood', { at: [xE + 0.02, 1.15, z], r: 0.005, color: 0x4e5642 });
  k.box(0.05, 0.07, 0.95, 'wood', { at: [xE + 0.02, 2.17, dz], r: 0.005, color: 0x4e5642 });
  k.box(0.03, 0.14, 0.04, 'steel', { at: [xE + 0.075, 1.1, dz + 0.3], r: 0.008 });
  for (const y of [0.55, 1.65]) k.box(0.012, 0.05, 0.22, 'steel', { at: [xE + 0.07, 0.1 + y, dz - 0.3], r: 0.004 });
  k.box(0.02, 0.06, 0.16, 'paint', { at: [xE + 0.07, 1.32, dz + 0.3], r: 0.004, color: 0x2a6a38 });
  // corner boards
  for (const [x, z] of [[xW, zN], [xW, zS], [xE, zN], [xE, zS]]) k.box(0.07, hB - 0.1, 0.07, 'wood', { at: [x + (x < T.x ? -0.025 : 0.025), 0.1 + (hB - 0.1) / 2, z + (z < T.z ? -0.025 : 0.025)], r: 0.006, color: 0x4e5642 });
  // roof (falls to the back) + vent pipe with cowl
  corrugatedRoof(k, { x0: xW - 0.3, x1: xE + 0.35, z0: zN - 0.3, z1: zS + 0.3, yA: hB + 0.05, yB: hF + 0.12, key: 'paint', color: 0x35503f });
  const vx = xW - 0.14, vz = zN + 0.45, vh = hF + 0.9;
  k.cyl(0.075, vh, 'paint', { at: [vx, vh / 2, vz], color: 0x26282a, seg: 18 });
  k.cyl(0.13, 0.18, 'paint', { at: [vx, vh + 0.1, vz], color: 0x26282a, seg: 18 });
  k.cyl(0.15, 0.025, 'paint', { at: [vx, vh + 0.2, vz], color: 0x26282a, seg: 18 });
  for (const y of [0.8, 1.9]) k.box(0.06, 0.04, 0.2, 'steel', { at: [vx + 0.08, y, vz], r: 0.006 });
  solid(T.x, 0, T.z, T.w, hF, T.d);
  dec.add('longdrop', signCanvas({ w: 0.42, h: 0.42, ppm: 400, bg: '#1f4a37', fg: '#efe8d4', border: '#efe8d4', wear: 0.35, lines: [
    { text: 'LONG DROP', size: 0.2 }, { text: 'Close the lid.', size: 0.11 }, { text: 'Close the door.', size: 0.11 }, { text: 'Kea can open both.', size: 0.11 }] }));
  dec.place('longdrop', 0.42, 0.42, [xE + 0.072, 1.6, dz - 0.02], [0, Math.PI / 2, 0], 'sign');
  dec.add('vacant', signCanvas({ w: 0.15, h: 0.05, ppm: 700, bg: '#2a6a38', fg: '#efe8d4', border: null, rivets: false, wear: 0.2, lines: [{ text: 'VACANT', size: 0.7 }] }));
  dec.place('vacant', 0.15, 0.05, [xE + 0.081, 1.32, dz + 0.3], [0, Math.PI / 2, 0], 'sign');
}

// ---------------------------------------------------------------- picnic tables: 5 top planks, A-frame legs
function tables(k, dec, solid, rng) {
  dec.add('tablePlaque', signCanvas({ w: 0.36, h: 0.12, ppm: 600, bg: '#b8a070', fg: '#2a2218', border: '#2a2218', rivets: true, wear: 0.4, lines: [
    { text: 'RATED FOR AFTERSHOCKS UP TO M6.', size: 0.3 }, { text: 'Above M6 it is a table.', size: 0.26 }] }));
  L.tables.forEach(([x, z], ti) => {
    const ry = [0.12, -0.2, 0.35][ti % 3], base = [0x8a7656, 0x7e6c52, 0x947e5c][ti % 3];
    k.push(x, 0, z, ry);
    for (let i = 0; i < 5; i++) k.box(1.8, 0.04, 0.14, 'wood', { at: [0, 0.74, -0.31 + i * 0.155], r: 0.007, color: tint(rng, base, 0.1) });
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) k.box(1.8, 0.04, 0.14, 'wood', { at: [0, 0.45, s * (0.52 + i * 0.155)], r: 0.007, color: tint(rng, base, 0.1) });
    for (const sx of [-0.62, 0.62]) {
      k.box(0.05, 0.09, 0.72, 'wood', { at: [sx, 0.675, 0], r: 0.005, color: tint(rng, base, 0.06) });                 // top cleat
      k.box(0.05, 0.09, 1.66, 'wood', { at: [sx, 0.385, 0], r: 0.005, color: tint(rng, base, 0.06) });                 // seat bearer
      for (const s of [-1, 1]) k.bar([sx, 0.72, s * 0.24], [sx, 0.0, s * 0.62], 0.05, 0.09, 'wood', { color: tint(rng, base, 0.06), r: 0.005 }); // legs
      for (const s of [-1, 1]) k.box(0.012, 0.012, 0.03, 'steel', { at: [sx + 0.03, 0.385, s * 0.33], r: 0.004 });     // bolt heads
    }
    k.bar([-0.6, 0.64, 0], [0, 0.42, 0], 0.045, 0.07, 'wood', { color: tint(rng, base, 0.06) });
    k.bar([0.6, 0.64, 0], [0, 0.42, 0], 0.045, 0.07, 'wood', { color: tint(rng, base, 0.06) });
    k.box(0.36, 0.12, 0.008, 'steel', { at: [0, 0.655, -0.39], r: 0.003, color: 0x9a8a60 });
    k.pop();
    const c = Math.cos(ry), s = Math.sin(ry), lz = -0.395;
    dec.place('tablePlaque', 0.34, 0.11, [x + lz * s, 0.655, z + lz * c], [0, ry + Math.PI, 0], 'sign');
    solid(x, 0, z, 1.9, 0.78, 1.6);
  });
}

// ---------------------------------------------------------------- DOC 200 trap boxes, mouth facing -Z
function traps(k, dec, solid, rng) {
  const ids = ['T-014', 'T-015', 'T-016', 'T-017'];
  L.traps.forEach(([x, z], i) => {
    const ry = (rng() - 0.5) * 0.12, base = tint(rng, 0x7c6a50, 0.1);
    k.push(x, 0, z, ry);
    const Lb = 0.8, W = 0.32, H = 0.32, t = 0.019;
    k.box(W, t, Lb, 'wood', { at: [0, t / 2 + 0.01, 0], r: 0.004, color: base });
    for (const s of [-1, 1]) k.box(t, H - 0.03, Lb, 'wood', { at: [s * (W / 2 - t / 2), 0.01 + (H - 0.03) / 2 + t * 0.5, 0], r: 0.004, color: tint(rng, base, 0.05) });
    k.box(W - 2 * t, H - 0.03, t, 'wood', { at: [0, 0.01 + (H - 0.03) / 2 + t * 0.5, Lb / 2 - t / 2], r: 0.004, color: base });
    k.box(W + 0.04, 0.022, Lb + 0.04, 'wood', { at: [0, H + 0.02, 0], rot: [0, 0, 0.0], r: 0.005, color: tint(rng, base, 0.08) });  // lid
    for (const zz of [-0.22, 0.22]) k.box(0.012, 0.05, 0.08, 'steel', { at: [W / 2 + 0.012, H, zz], r: 0.003 });                // hinges
    k.box(0.05, 0.03, 0.012, 'steel', { at: [-W / 2 - 0.006, H - 0.005, -Lb / 2 + 0.08], r: 0.003 });                             // hasp
    // mesh mouth: galvanised frame + 25 mm wire grid with a 110 mm entry hole low in the middle
    const fz = -Lb / 2 + 0.006, fw = W - 0.01, fh = H - 0.01, cy = 0.01 + fh / 2;
    for (const s of [-1, 1]) {
      k.box(0.012, fh, 0.012, 'steel', { at: [s * (fw / 2 - 0.006), cy, fz], r: 0.003, step: 1 });
      k.box(fw, 0.012, 0.012, 'steel', { at: [0, cy + s * (fh / 2 - 0.006), fz], r: 0.003, step: 1 });
    }
    const hole = (px, py) => Math.abs(px) < 0.07 && py < 0.2;
    for (let gx = -fw / 2 + 0.025; gx < fw / 2 - 0.01; gx += 0.025) { // verticals, split around the hole
      if (Math.abs(gx) < 0.07) { k.box(0.003, fh - 0.2, 0.003, 'steel', { at: [gx, 0.2 + (fh - 0.19) / 2, fz], r: 0, step: 1, occ: false }); continue; }
      k.box(0.003, fh, 0.003, 'steel', { at: [gx, cy, fz], r: 0, step: 1, occ: false });
    }
    for (let gy = 0.035; gy < fh; gy += 0.025) {
      if (hole(0, gy)) { for (const s of [-1, 1]) k.box(fw / 2 - 0.07, 0.003, 0.003, 'steel', { at: [s * (0.07 + (fw / 2 - 0.07) / 2), gy, fz], r: 0, step: 1, occ: false }); continue; }
      k.box(fw, 0.003, 0.003, 'steel', { at: [0, gy, fz], r: 0, step: 1, occ: false });
    }
    k.box(0.15, 0.012, 0.01, 'steel', { at: [0, 0.2, fz], r: 0.002 });
    for (const s of [-1, 1]) k.box(0.012, 0.19, 0.01, 'steel', { at: [s * 0.075, 0.105, fz], r: 0.002 });
    for (const s of [-1, 1]) k.box(0.012, 0.3, 0.012, 'steel', { at: [s * (W / 2 + 0.02), 0.08, 0.25], rot: [0, 0, s * 0.15], r: 0.003 }); // pegs
    // trap-line marker: stake + orange triangle + pink flagging tape
    k.box(0.045, 1.05, 0.045, 'wood', { at: [W / 2 + 0.22, 0.525, 0.15], r: 0.005, color: 0x8a7a5c });
    k.box(0.006, 0.11, 0.11, 'paint', { at: [W / 2 + 0.22, 0.98, 0.15 - 0.03], rot: [Math.PI / 4, 0, 0], r: 0.002, color: 0xd0601c });
    k.box(0.024, 0.34, 0.003, 'paint', { at: [W / 2 + 0.25, 0.82, 0.12], rot: [0.12, 0.3, 0.08], r: 0.001, color: 0xd8508a });
    k.box(0.024, 0.28, 0.003, 'paint', { at: [W / 2 + 0.23, 0.84, 0.18], rot: [-0.1, -0.4, -0.12], r: 0.001, color: 0xd8508a });
    k.pop();
    solid(x, 0, z, 0.4, 0.36, 0.84);
    const nm = 'trapId' + i;
    dec.add(nm, stencilCanvas({ text: 'DOC200 ' + ids[i], h: 0.05, ppm: 900, color: 'rgba(226,222,206,1)', wear: 0.2 }));
    const c = Math.cos(ry), s = Math.sin(ry);
    dec.place(nm, 0.5, null, [x + 0.162 * c, 0.2, z - 0.162 * s], [0, ry + Math.PI / 2, 0], 'sign');
    dec.add(nm + 'L', stencilCanvas({ text: ids[i], h: 0.09, ppm: 600, color: 'rgba(226,222,206,1)', wear: 0.22 }));
    dec.place(nm + 'L', 0.36, null, [x, 0.354, z], [-Math.PI / 2, ry + Math.PI / 2, 0], 'sign');
  });
}

// ---------------------------------------------------------------- kea-proof bins
function bins(k, dec, solid, rng) {
  dec.add('bin', signCanvas({ w: 0.46, h: 0.3, ppm: 500, bg: '#efe8d4', fg: '#16181a', border: '#1f4a37', wear: 0.35, lines: [
    { text: 'KEA-PROOF LID', size: 0.24, color: '#1f4a37' }, { text: 'Kea have been informed.', size: 0.13 }, { text: 'Lift. Pull. Swear. Lift.', size: 0.13 }] }));
  dec.add('binR', stencilCanvas({ text: 'RUBBISH', h: 0.07, ppm: 700, color: 'rgba(226,222,206,1)', wear: 0.22 }));
  for (const [x, z, ry] of [[-19.2, -11.2, 0.1], [4.4, -12.3, -0.05], [24.2, 13.6, Math.PI + 0.1]]) {
    k.push(x, 0, z, ry);
    k.box(0.84, 0.05, 0.82, 'concrete', { at: [0, 0.025, 0], r: 0.015, color: 0x9e9a91 });                         // pad, flush
    k.box(0.62, 0.92, 0.6, 'paint', { at: [0, 0.05 + 0.46, 0], r: 0.03, color: 0x2f4a3a });                         // body
    k.box(0.64, 0.06, 0.62, 'paint', { at: [0, 0.04, 0], r: 0.02, color: 0x24382c });                                // plinth band
    k.box(0.66, 0.045, 0.66, 'paint', { at: [0, 0.995, -0.01], r: 0.012, color: 0x2a4434 });                         // lid (shut, flush)
    k.box(0.6, 0.06, 0.02, 'paint', { at: [0, 0.96, -0.335], r: 0.006, color: 0x2a4434 });                           // lid front lip
    for (const s of [-0.22, 0, 0.22]) k.cyl(0.018, 0.12, 'steel', { at: [s, 0.99, 0.32], rot: [0, 0, Math.PI / 2], seg: 10 }); // hinge knuckles
    k.cyl(0.008, 0.6, 'steel', { at: [0, 0.99, 0.32], rot: [0, 0, Math.PI / 2], seg: 6 });                          // hinge pin
    k.bar([-0.18, 0.94, -0.37], [0.18, 0.94, -0.37], 0.025, 0.025, 'steel', { r: 0.008 });                           // pull handle
    for (const s of [-1, 1]) k.box(0.02, 0.05, 0.05, 'steel', { at: [s * 0.18, 0.95, -0.35], r: 0.005 });
    k.box(0.06, 0.12, 0.03, 'steel', { at: [0.24, 0.88, -0.31], r: 0.006 });                                         // spring latch
    k.box(0.5, 0.06, 0.02, 'steel', { at: [0, 0.15, -0.305], r: 0.006 });                                            // kick plate
    for (const s of [-1, 1]) for (const zz of [-1, 1]) k.cyl(0.012, 0.03, 'steel', { at: [s * 0.27, 0.06, zz * 0.26], seg: 6 });
    k.pop();
    const c = Math.cos(ry), s = Math.sin(ry), fx = -0.303; // front face (local -Z)
    dec.place('bin', 0.44, 0.29, [x + fx * s, 0.64, z + fx * c], [0, ry + Math.PI, 0], 'sign');
    dec.place('binR', 0.42, null, [x + fx * s, 0.4, z + fx * c], [0, ry + Math.PI, 0], 'sign');
    solid(x, 0, z, 0.7, 1.1, 0.7);
  }
}

// ---------------------------------------------------------------- ROAD CLOSED gate, barriers, flashers
function gate(k, dec, solid, rng) {
  const gt = L.gate, hz = gt.z - 4.35, lz = gt.z + 4.35, span = lz - hz, gx = gt.x;
  for (const z of [hz, lz]) {
    k.cyl(0.07, 1.35, 'steel', { at: [gx, 0.675, z], seg: 18 });
    k.cyl(0.085, 0.03, 'steel', { at: [gx, 1.36, z], seg: 18 });
    k.cyl(0.22, 0.06, 'concrete', { at: [gx, 0.03, z], color: 0x9e9a90, seg: 18 });
    solid(gx, 0, z, 0.2, 1.4, 0.2);
  }
  // gate leaf: top + bottom rails, stiles, verticals, diagonal brace; red bands on the top rail
  const z0 = hz + 0.12, z1 = lz - 0.1, len = z1 - z0, zc = (z0 + z1) / 2;
  const bands = 14;
  for (let i = 0; i < bands; i++) {
    const a = z0 + (i * len) / bands, b = z0 + ((i + 1) * len) / bands;
    k.cyl(0.03, b - a - 0.002, 'paint', { at: [gx, 1.1, (a + b) / 2], rot: [Math.PI / 2, 0, 0], color: i % 2 ? 0xa01c14 : 0xcfcac0, seg: 14 });
  }
  k.cyl(0.024, len, 'paint', { at: [gx, 0.38, zc], rot: [Math.PI / 2, 0, 0], color: 0xcfcac0, seg: 12 });
  for (let i = 0; i <= 6; i++) k.cyl(0.016, 0.72, 'paint', { at: [gx, 0.74, z0 + (i * len) / 6], color: 0xcfcac0, seg: 10 });
  k.bar([gx, 0.4, z0 + 0.05], [gx, 1.08, z0 + len * 0.5], 0.03, 0.03, 'paint', { color: 0xcfcac0, r: 0.01 });
  for (const z of [hz, lz]) for (const y of [0.4, 1.1]) k.box(0.1, 0.06, 0.08, 'steel', { at: [gx, y, z + (z === hz ? 0.08 : -0.07)], r: 0.008 });
  solid(gx, 0, gt.z, 0.12, 1.2, span);
  dec.add('roadClosed', signCanvas({ w: 1.5, h: 0.5, ppm: 340, bg: '#e8e2d2', fg: '#9a1e14', border: '#9a1e14', borderW: 0.03, wear: 0.4, lines: [
    { text: 'ROAD CLOSED', size: 0.5 }, { text: 'NO EXCEPTIONS (INCLUDING YOU)', size: 0.17, color: '#16181a' }] }));
  k.box(0.025, 0.54, 1.54, 'steel', { at: [gx - 0.05, 0.74, gt.z - 1.6], r: 0.006 });
  dec.place('roadClosed', 1.5, 0.5, [gx - 0.064, 0.74, gt.z - 1.6], [0, -Math.PI / 2, 0], 'sign');

  // flasher heads on the post tops: black housing, amber dome lens facing west (the light/bulb is lights.js)
  const flashers = [];
  [hz, lz].forEach((z, i) => {
    const fy = 1.56, fx = gx - 0.04;
    k.box(0.12, 0.26, 0.24, 'rubber', { at: [gx + 0.04, fy, z], r: 0.02 });
    k.box(0.06, 0.1, 0.06, 'steel', { at: [gx, 1.42, z], r: 0.006 });
    k.cyl(0.11, 0.02, 'rubber', { at: [fx + 0.0, fy, z], rot: [0, 0, Math.PI / 2], seg: 24 });
    k.box(0.08, 0.03, 0.26, 'rubber', { at: [fx - 0.03, fy + 0.12, z], r: 0.008 });                       // visor
    k.add(lensGeo(), i ? 'lensB' : 'lensA', { at: [fx - 0.01, fy, z], rot: [0, 0, Math.PI / 2], occ: false });
    flashers.push([gx - 0.05, fy, z]);
  });

  // water-filled barriers across the road behind the gate (orange/white alternating) + concrete blocks + rail fence
  const prof = [[-0.24, 0], [0.24, 0], [0.24, 0.1], [0.12, 0.24], [0.085, 0.76], [0.05, 0.8], [-0.05, 0.8], [-0.085, 0.76], [-0.12, 0.24], [-0.24, 0.1]];
  for (let i = 0; i < 4; i++) {
    const z = gt.z - 3.1 + i * 2.07, x = gx - 2.3 - (i % 2) * 0.35, ry = (rng() - 0.5) * 0.06;
    k.push(x, 0, z, ry);
    k.add(extrudeBevel(prof, { depth: 2.0, bevel: 0.025, bevelSeg: 2 }), 'plastic', { color: i % 2 ? 0xc6c2b8 : 0xc8541c });
    k.cyl(0.05, 0.03, 'plastic', { at: [0, 0.815, -0.5], color: 0x2a2a2a, seg: 12 });
    k.cyl(0.05, 0.03, 'plastic', { at: [0, 0.815, 0.5], color: 0x2a2a2a, seg: 12 });
    for (const s of [-1, 1]) k.box(0.1, 0.5, 0.06, 'plastic', { at: [0, 0.4, s * 1.02], r: 0.02, color: i % 2 ? 0xbab6ac : 0xb84c1a });
    k.pop();
    solid(x, 0, z, 0.5, 0.82, 2.05);
  }
  for (const [x, z, r] of [[gx + 0.9, gt.z - 5.6, 0.15], [gx + 0.8, gt.z + 5.5, -0.1], [gx + 2.2, gt.z + 6.1, 0.5]]) {
    k.push(x, 0, z, r);
    k.box(1.2, 0.6, 0.6, 'concrete', { at: [0, 0.3, 0], r: 0.03, color: tint(rng, 0xb0aca2, 0.06) });
    for (const s of [-0.3, 0.3]) k.cyl(0.1, 0.06, 'concrete', { at: [s, 0.63, 0], color: tint(rng, 0xa8a49a, 0.05) });
    k.pop();
    solid(x, 0, z, 1.3, 0.6, 1.3);
  }
  return { flashers };
}

// Amber dome lens (lathe around Y, dome toward +Y; rotated to face -X by the caller).
function lensGeo() {
  const p = [[0, 0.075]]; for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; p.push([Math.sin(a) * 0.1, Math.cos(a) * 0.075]); }
  p.push([0.1, 0]); p.push([0, 0]);
  return lathe(p.reverse(), { seg: 28, crease: 50 });
}
