// carpark/shelter — the DOC-style visitor shelter (6 × 4 m, open to +X): board-and-batten cladding outside,
// exposed studs/dwangs, rafters and tongue-and-groove sarking inside, green corrugated mono-pitch roof with
// fascia, gutter and downpipe, slatted bench, YOU ARE HERE map board, notices, intentions book, lost property box,
// a fluoro batten on conduit. Exterior parts go into the shared exterior Kit `k` (sky-lit materials); interior
// parts go into `ik` (the probe-lit materials main.js assigns to shelter.interior).
import { LAYOUT as L } from '../../contracts.js';
import { bbWall, corrugatedRoof, tint } from './timber.js';
import { mapBoardCanvas, noticeCanvas } from './canvases.js';
import { signCanvas } from '../../cookbook/decals/canvas-text.js';

export function buildShelter(G, { k, ik, dec, solid, rng }) {
  const S = L.shelter, sx = S.x, sz = S.z, hw = S.w / 2, hd = S.d / 2;
  const xW = sx - hw, xE = sx + hw, zN = sz - hd, zS = sz + hd;
  const hBack = 2.6, hFront = S.h;
  const hX = (x) => hBack + (hFront - hBack) * ((x - xW) / S.w);
  const slope = Math.atan2(hFront - hBack, S.w);
  const EXT = 0xd8c2a0;   // dark stained cladding

  // ---- floor slab + front apron edge
  ik.box(S.w + 0.12, 0.07, S.d + 0.12, 'concrete', { at: [sx, 0.035, sz], r: 0.02, color: 0xb0aca2 });

  // ---- walls (exterior skin into k, interior back faces + framing into ik)
  const wall = (x, z, ry, len, h0, h1) => {
    k.push(x, 0, z, ry); ik.push(x, 0, z, ry);
    bbWall({ len, h0, h1, rng, out: k, outKey: 'wood', inn: ik, innKey: 'wood', colour: EXT });
    k.pop(); ik.pop();
  };
  wall(xE, zN, Math.PI, S.w, hFront, hBack);     // north: local 0 at the open east end
  wall(xW, zS, 0, S.w, hBack, hFront);           // south
  wall(xW, zN, -Math.PI / 2, S.d, hBack, hBack); // west (back)
  solid(sx, 0, zN + 0.06, S.w, hBack, 0.14); solid(sx, 0, zS - 0.06, S.w, hBack, 0.14); solid(xW + 0.06, 0, sz, 0.14, hBack, S.d);
  // corner boards + front posts + header beam over the open side
  for (const z of [zN - 0.03, zS + 0.03]) k.box(0.075, hBack, 0.075, 'wood', { at: [xW - 0.03, hBack / 2, z], r: 0.006, color: tint(rng, EXT) });
  for (const z of [zN + 0.04, zS - 0.04]) {
    k.box(0.12, hFront, 0.12, 'wood', { at: [xE + 0.02, hFront / 2, z], r: 0.008, color: tint(rng, 0x75654f) });
    k.cyl(0.11, 0.03, 'concrete', { at: [xE + 0.02, 0.085, z], color: 0x9c988e });
  }
  k.box(0.1, 0.24, S.d + 0.1, 'wood', { at: [xE + 0.03, hFront - 0.12, sz], r: 0.008, color: tint(rng, 0x75654f) });

  // ---- roof: rafters (inside), T&G sarking (inside), green corrugated iron + fascia/barge (outside)
  const rx0 = xW - 0.35, rx1 = xE + 0.45;
  const ry = (x) => hX(x);
  const rafterZ = [zN + 0.03, zN + 1.0, sz, zS - 1.0, zS - 0.03];
  for (const z of rafterZ) ik.bar([rx0, ry(rx0) + 0.07, z], [rx1, ry(rx1) + 0.07, z], 0.045, 0.14, 'wood', { color: tint(rng, 0xe0c89c, 0.06), r: 0.004 });
  const sl = Math.hypot(rx1 - rx0, ry(rx1) - ry(rx0)), smx = (rx0 + rx1) / 2;
  ik.box(sl, 0.02, S.d + 0.7, 'sarking', { at: [smx, ry(smx) + 0.15, sz], rot: [0, 0, slope], r: 0.004, color: 0xc4b498, step: 1.2 });
  const yA = ry(rx0) + 0.17, yB = ry(rx1) + 0.17;
  corrugatedRoof(k, { x0: rx0, x1: rx1, z0: zN - 0.35, z1: zS + 0.35, yA, yB, key: 'paint', color: 0x35503f });
  k.box(0.025, 0.2, S.d + 0.74, 'wood', { at: [rx1 + 0.013, yB - 0.08, sz], r: 0.004, color: 0x5e5242 });
  k.box(0.025, 0.2, S.d + 0.74, 'wood', { at: [rx0 - 0.013, yA - 0.08, sz], r: 0.004, color: 0x5e5242 });
  for (const z of [zN - 0.36, zS + 0.36]) k.bar([rx0, yA - 0.08, z], [rx1, yB - 0.08, z], 0.025, 0.2, 'wood', { color: 0x5e5242, r: 0.004 });
  // gutter + downpipe on the low (west) eave
  k.box(0.13, 0.1, S.d + 0.8, 'paint', { at: [rx0 - 0.09, yA - 0.17, sz], r: 0.02, color: 0x3a4a40 });
  const dpH = yA - 0.2;
  k.cyl(0.04, dpH - 0.12, 'paint', { at: [rx0 - 0.09, 0.12 + (dpH - 0.12) / 2, zN - 0.2], color: 0x3a4a40 });
  k.box(0.1, 0.06, 0.18, 'paint', { at: [rx0 - 0.09, 0.08, zN - 0.27], r: 0.02, color: 0x3a4a40 });
  k.box(0.32, 0.03, 0.4, 'concrete', { at: [rx0 - 0.09, 0.015, zN - 0.35], r: 0.01, color: 0x8c887f }); // splash block

  // ---- bench along the south wall: three slats on bracket frames, backrest rail on the studs
  const zw = zS - 0.13, bx0 = xW + 0.4, bx1 = xE - 1.2, bcx = (bx0 + bx1) / 2, bl = bx1 - bx0;
  for (let i = 0; i < 3; i++) ik.box(bl, 0.035, 0.1, 'wood', { at: [bcx, 0.46, zw - 0.07 - i * 0.115], r: 0.006, color: tint(rng, 0xb29a74, 0.06) });
  ik.box(bl, 0.11, 0.032, 'wood', { at: [bcx, 0.86, zw - 0.02], r: 0.006, color: tint(rng, 0xb29a74, 0.06) });
  for (let i = 0; i < 3; i++) {
    const x = bx0 + 0.15 + (i * (bl - 0.3)) / 2;
    ik.box(0.045, 0.43, 0.07, 'wood', { at: [x, 0.215, zw - 0.36], r: 0.004, color: 0xa08a68 });
    ik.box(0.045, 0.07, 0.42, 'wood', { at: [x, 0.41, zw - 0.2], r: 0.004, color: 0xa08a68 });
    ik.bar([x, 0.38, zw - 0.33], [x, 0.12, zw - 0.02], 0.045, 0.05, 'wood', { color: 0xa08a68 });
  }

  // ---- boards: YOU ARE HERE map on the back wall, notices on the north wall (face the room)
  const xin = xW + 0.022 + 0.01 + 0.09;            // west wall stud face
  const zin = zN + 0.022 + 0.01 + 0.09;            // north wall stud face
  const mapW = 2.2, mapH = 1.15, mapZ = sz - 0.25, mapY = 1.58;
  ik.box(0.028, mapH + 0.12, mapW + 0.12, 'board', { at: [xin + 0.014, mapY, mapZ], r: 0.008, color: 0xffffff });
  dec.add('map', mapBoardCanvas({ w: mapW, h: mapH }));
  dec.place('map', mapW, mapH, [xin + 0.031, mapY, mapZ], [0, Math.PI / 2, 0], 'interior');
  const notices = [
    ['keaGuide', { w: 0.78, h: 1.0, title: 'KEA (Nestor notabilis)', sub: 'The alpine parrot. A field guide.', body: [
      'Highly intelligent. Highly curious.', 'Will remove: wiper blades, door seals,', 'valve caps, aerials, your sense', 'of ownership.',
      { text: 'DO NOT FEED.', size: 6.2, color: '#9a1e14' }, { text: 'DO NOT ENGAGE.', size: 6.2, color: '#9a1e14' },
      'Do not make eye contact with', 'the one on the left.', 'A blown kea is not a defeated kea.', 'It is an offended kea.'],
      foot: 'Department of Pass Conservation' }, -25.75, 1.58],
    ['quakeProc', { w: 0.66, h: 0.86, title: 'AFTERSHOCK PROCEDURE', band: '#d8a81c', bandFg: '#16181a', body: [
      { text: '1.  DROP', size: 8 }, { text: '2.  COVER', size: 8 }, { text: '3.  HOLD', size: 8 }, { text: '4.  Resume blowing.', size: 5.6 },
      'Do not run outside.', 'You are already outside.', 'This shelter is not a structure', 'for the purposes of this notice.'],
      foot: 'Revised. Revised again.' }, -24.62, 1.5],
    ['intent', { w: 0.42, h: 0.3, title: 'VISITOR INTENTIONS', body: ['Record your intended route.', 'Most recent entry:', { text: '"Leave."', size: 9 }] }, -23.62, 1.33],
  ];
  for (const [name, o, x, y] of notices) {
    dec.add(name, noticeCanvas({ ...o, ppm: 440 }));
    ik.box(o.w + 0.08, o.h + 0.08, 0.022, 'board', { at: [x, y, zin + 0.011], r: 0.006, color: 0xffffff });
    dec.place(name, o.w, o.h, [x, y, zin + 0.025], [0, 0, 0], 'interior');
  }
  // intentions book box under its notice: sloped lid, pencil on a string
  ik.box(0.4, 0.26, 0.22, 'wood', { at: [-23.62, 0.97, zin + 0.11], r: 0.008, color: 0x9c8460 });
  ik.box(0.42, 0.025, 0.25, 'wood', { at: [-23.62, 1.115, zin + 0.115], rot: [0.22, 0, 0], r: 0.006, color: 0x8e7656 });
  ik.cyl(0.004, 0.17, 'plastic', { at: [-23.38, 0.98, zin + 0.23], rot: [0.2, 0, 0.3], color: 0x2a7a38 });
  // lost property: painted plywood box in the north-west corner, one jandal (left) on top
  const lpx = xin + 0.32, lpz = zin + 0.36;
  ik.box(0.56, 0.46, 0.5, 'wood', { at: [lpx, 0.23 + 0.07, lpz], r: 0.01, color: 0x8a9a7e });
  ik.box(0.58, 0.022, 0.52, 'wood', { at: [lpx, 0.545, lpz], r: 0.006, color: 0x7e8e72 });
  ik.box(0.1, 0.022, 0.27, 'plastic', { at: [lpx - 0.08, 0.567, lpz + 0.04], rot: [0, 0.35, 0], r: 0.008, color: 0x2a4f88 });
  ik.tube([[lpx - 0.11, 0.578, lpz + 0.1], [lpx - 0.06, 0.6, lpz + 0.06], [lpx - 0.03, 0.578, lpz]], 0.004, 'plastic', { color: 0x1a2a4a, radial: 6 });
  dec.add('lost', signCanvas({ w: 0.44, h: 0.2, ppm: 500, bg: '#efe8d4', fg: '#1b1d1c', border: '#1f4a37', rivets: false, wear: 0.25, lines: [
    { text: 'LOST PROPERTY', size: 0.34 }, { text: '1 jandal (left). 2 chargers. Hope.', size: 0.2 }] }));
  dec.place('lost', 0.44, 0.2, [lpx + 0.282, 0.33, lpz], [0, Math.PI / 2, 0], 'interior');

  // ---- fluoro batten under the middle rafter, conduit to a switch by the opening
  const bxC = sx - 1.0, byC = hX(bxC) - 0.03;
  ik.box(1.26, 0.055, 0.09, 'steel', { at: [bxC, byC, sz], rot: [0, 0, slope], r: 0.01, color: 0xd8d6d0 });
  ik.box(1.2, 0.03, 0.065, 'lamp', { at: [bxC, byC - 0.04, sz], rot: [0, 0, slope], r: 0.01, color: 0xffffff });
  const cxW = xin + 0.016, cyW = hX(cxW) - 0.016, swZ = zN + 0.4;
  ik.tube([[bxC - 0.61, byC + 0.012, sz], [cxW, cyW, sz], [cxW, cyW, swZ], [cxW, 1.47, swZ]], 0.011, 'plastic', { color: 0xd4d2cc, radial: 8 });
  ik.box(0.04, 0.13, 0.09, 'plastic', { at: [xin + 0.02, 1.4, swZ], r: 0.008, color: 0xe0ddd4 });
  dec.add('switch', signCanvas({ w: 0.2, h: 0.1, ppm: 600, bg: '#efe8d4', border: '#1b1d1c', rivets: false, wear: 0.2, lines: [
    { text: 'LIGHT ON SENSOR', size: 0.32 }, { text: 'The sensor is also closed.', size: 0.22 }] }));
  dec.place('switch', 0.2, 0.1, [xin + 0.004, 1.58, swZ], [0, Math.PI / 2, 0], 'interior');

  // ---- name board over the opening (outside)
  dec.add('shelterName', signCanvas({ w: 2.4, h: 0.3, ppm: 300, bg: '#1f4a37', fg: '#e6d9a8', border: '#e6d9a8', rivets: false, wear: 0.35, lines: [
    { text: 'PASS VISITOR SHELTER   ·   EST. 1987   ·   RE-EST. 2026', size: 0.5 }] }));
  k.box(0.03, 0.34, 2.46, 'paint', { at: [xE + 0.095, hFront - 0.13, sz], r: 0.006, color: 0x2a4a38 });
  dec.place('shelterName', 2.4, 0.3, [xE + 0.112, hFront - 0.13, sz], [0, Math.PI / 2, 0], 'sign');

  return {
    box: { min: [xW, 0, zN], max: [xE, hFront, zS] },
    probeAt: [sx + 0.4, 1.5, sz],
    lamp: [bxC, byC - 0.06, sz],
  };
}
