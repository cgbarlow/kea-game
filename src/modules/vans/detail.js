// vans/detail — cab interior + the tourists (one per character, driver's head turns), roof kit per van (hatch,
// vents, solar / air-con), and the comedy props each party has set up beside its van (deck chairs + thermos,
// washing line, LPG bottle + camera tripod). Van-local metres, nose to -Z. Prop colliders returned in local space.
import { Vector3 } from 'three';
import { extrudeBevel, lathe } from '../../cookbook/geo/kit.js';
import { roundPoly } from './shape.js';
import { DIM as D } from './body.js';

const SIDE_ROT = [0, Math.PI / 2, 0];
const headGeo = () => lathe([[0, -0.115], [0.055, -0.105], [0.08, -0.06], [0.088, 0], [0.084, 0.05], [0.062, 0.1], [0.03, 0.122], [0, 0.126]], { seg: 18, crease: 60 });

// a seated person, torso visible above the dash line; x across, f forward; o: {skin, top, hair, hat, driver, pose}
function person(k, T, x, f, o) {
  const z = -f, part = o.driver ? 2 : 0, y0 = 1.22, hy = 1.84;
  k.box(0.4, 0.46, 0.24, 'cab', { at: [x, y0 + 0.23, z], r: 0.1, color: o.top });
  k.box(0.44, 0.12, 0.22, 'cab', { at: [x, y0 + 0.4, z], r: 0.06, color: o.top });
  if (o.collar) k.box(0.2, 0.05, 0.2, 'cab', { at: [x, y0 + 0.47, z - 0.01], r: 0.02, color: o.collar });
  k.cyl(0.048, 0.1, 'cab', { at: [x, 1.74, z], seg: 10, color: o.skin });
  const H = (g, key = 'cab', opt = {}) => T(k.add(g, key, opt), 0, part);
  H(headGeo(), 'cab', { at: [x, hy, z], color: o.skin });
  H(lathe([[0.01, -0.012], [0.02, 0], [0.012, 0.02], [0, 0.024]], { seg: 6 }), 'cab', { at: [x, hy - 0.005, z - 0.088], rot: [-Math.PI / 2, 0, 0], color: o.skin }); // nose
  if (o.hair) {
    H(lathe([[0.091, -0.08], [0.094, 0], [0.088, 0.055], [0.066, 0.106], [0.032, 0.13], [0, 0.134]], { seg: 16, phi0: -Math.PI * 0.62, phiLen: Math.PI * 1.24 }), 'cab', { at: [x, hy, z], color: o.hair });
    H(lathe([[0.075, 0.07], [0.068, 0.1], [0.034, 0.128], [0, 0.133]], { seg: 16 }), 'cab', { at: [x, hy, z], color: o.hair });
    if (o.long) { T(k.box(0.17, 0.2, 0.05, 'cab', { at: [x, hy - 0.13, z + 0.07], r: 0.02, color: o.hair }), 0, part); H(lathe([[0.08, -0.2], [0.09, -0.08], [0.09, 0]], { seg: 12, phi0: -Math.PI / 2, phiLen: Math.PI }), 'cab', { at: [x, hy, z + 0.01], color: o.hair }); }
  }
  if (o.hat === 'beanie') { H(lathe([[0.095, 0.02], [0.098, 0.06], [0.08, 0.11], [0.045, 0.14], [0, 0.148]], { seg: 16 }), 'cab', { at: [x, hy, z], color: o.hatC }); H(lathe([[0.03, 0], [0.025, 0.03], [0, 0.04]], { seg: 8 }), 'cab', { at: [x, hy + 0.145, z], color: o.hatC2 ?? o.hatC }); }
  if (o.hat === 'bucket') { H(lathe([[0.16, 0.035], [0.15, 0.045], [0.094, 0.06], [0.092, 0.12], [0.07, 0.15], [0, 0.155]], { seg: 18 }), 'cab', { at: [x, hy, z], color: o.hatC }); }
  if (o.hat === 'wrap') { H(lathe([[0.096, 0.0], [0.105, 0.07], [0.1, 0.14], [0.06, 0.19], [0, 0.2]], { seg: 16 }), 'cab', { at: [x, hy, z + 0.01], color: o.hatC }); }
  if (o.glasses) T(k.box(0.15, 0.03, 0.02, 'cab', { at: [x, hy + 0.012, z - 0.083], r: 0.008, color: 0x141414 }), 0, part);
  // arms: driver to the wheel, others to a pose prop
  const sh = [x - 0.19, x + 0.19];
  if (o.pose === 'wheel') for (const [i, sx] of sh.entries()) k.tube([new Vector3(sx, 1.6, z), new Vector3(sx + (i ? -0.02 : 0.02), 1.42, z - 0.25), new Vector3(x + (i ? 0.16 : -0.16), 1.5, -(f + 0.5))], 0.045, 'cab', { radial: 8, curve: true, samples: 8, color: o.top });
  if (o.pose === 'map') {
    for (const [i, sx] of sh.entries()) k.tube([new Vector3(sx, 1.6, z), new Vector3(sx, 1.45, z - 0.2), new Vector3(x + (i ? 0.2 : -0.2), 1.6, z - 0.36)], 0.045, 'cab', { radial: 8, curve: true, samples: 8, color: o.top });
    k.box(0.27, 0.34, 0.006, 'cab', { at: [x - 0.12, 1.66, z - 0.4], rot: [-0.3, 0.25, 0], r: 0.002, color: 0xd8d0b4 });
    k.box(0.27, 0.34, 0.006, 'cab', { at: [x + 0.12, 1.66, z - 0.4], rot: [-0.3, -0.25, 0], r: 0.002, color: 0xccc4a6 });
  }
  if (o.pose === 'phone') {
    k.tube([new Vector3(sh[1], 1.6, z), new Vector3(sh[1] + 0.06, 1.5, z - 0.1), new Vector3(x + 0.09, 1.82, z - 0.02)], 0.042, 'cab', { radial: 8, curve: true, samples: 8, color: o.top });
    k.box(0.02, 0.14, 0.07, 'cab', { at: [x + 0.1, 1.85, z - 0.02], r: 0.006, color: 0x1a1a1c });
  }
  if (o.pose === 'camera') { // camera held to the eye, turns with the head
    for (const [i, sx] of sh.entries()) k.tube([new Vector3(sx, 1.6, z), new Vector3(sx, 1.5, z - 0.18), new Vector3(x + (i ? 0.07 : -0.07), 1.83, z - 0.15)], 0.042, 'cab', { radial: 8, curve: true, samples: 8, color: o.top });
    T(k.box(0.14, 0.09, 0.07, 'cab', { at: [x, hy, z - 0.14], r: 0.012, color: 0x1c1c1e }), 0, part);
    H(lathe([[0.034, 0], [0.034, 0.1], [0.03, 0.11], [0, 0.11]], { seg: 14 }), 'cab', { at: [x, hy, z - 0.17], rot: [-Math.PI / 2, 0, 0], color: 0x222224 });
  }
}

export function buildCab(k, T, cfg) {
  const cw = D.cabW / 2, f = 1.55;
  k.box(D.cabW - 0.1, 0.012, 1.35, 'cab', { at: [0, 1.316, -1.8], r: 0.004, color: 0x2a2a2c, step: 0.3 });
  k.add(extrudeBevel(roundPoly([[1.98, 1.3, 0], [2.5, 1.3, 0], [2.43, 1.43, 0.03], [2.15, 1.475, 0.05], [2.0, 1.42, 0.03]], 4), { depth: D.cabW - 0.12, bevel: 0.008 }), 'cab', { rot: SIDE_ROT, color: 0x2e2f31 });
  k.box(0.4, 0.08, 0.2, 'cab', { at: [0.45, 1.5, -2.2], r: 0.03, color: 0x232426 });                           // gauge hood
  const ring = []; for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; ring.push(new Vector3(Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0)); }
  k.push(0.45, 1.53, -2.02, 0, -0.95, 0); k.tube(ring, 0.017, 'cab', { radial: 8, closed: true, color: 0x1e1e20 }); k.box(0.36, 0.03, 0.02, 'cab', { r: 0.01, color: 0x1e1e20 }); k.pop();
  k.bar([0.45, 1.53, -2.02], [0.45, 1.42, -2.3], 0.06, 0.06, 'cab', { r: 0.02, color: 0x1e1e20 });
  for (const s of [-1, 1]) {
    k.box(0.5, 0.64, 0.14, 'cab', { at: [s * 0.46, 1.6, -(f - 0.16)], rot: [0.16, 0, 0], r: 0.06, color: cfg.seat });
    k.box(0.27, 0.2, 0.1, 'cab', { at: [s * 0.46, 1.99, -(f - 0.24)], rot: [0.16, 0, 0], r: 0.045, color: cfg.seat });
    k.box(0.06, 0.14, 0.1, 'cab', { at: [s * (cw - 0.07), 2.0, -2.0], r: 0.02, color: 0x8a8a84 });               // sun visor hinge block
  }
  for (let i = 0; i < 7; i++) k.box(0.28, 0.74, 0.03, 'cab', { at: [-0.84 + i * 0.28, 1.68, -(D.cabBack + 0.2) + (i % 2) * 0.025], r: 0.012, color: cfg.curtain }); // curtain folds
  k.box(0.18, 0.012, 0.11, 'cab', { at: [-0.25, 1.48, -2.3], rot: [0.2, 0.3, 0], color: 0xe0d8c0 });          // rental agreement on the dash
  for (const p of cfg.people) person(k, T, p.x, f, p);
  // cab light: warm dome lamp lens in the header (the real light sits under it, see index.js)
  T(k.box(0.22, 0.02, 0.1, 'lens', { at: [0, 2.03, -1.85], r: 0.008, color: 0xffd8a0 }), 0, 0, 1, 0);
}

export function buildRoof(k, T, cfg) {
  const top = D.top, dark = 0x2a2b2c;
  // main hatch (frosted dome lid on a black frame); kea pry it: lid off, a torn one propped open
  k.box(0.8, 0.06, 0.6, 'dark', { at: [0, top + 0.03, 0.6], r: 0.02, color: dark });
  T(k.box(0.7, 0.1, 0.5, 'paint', { at: [0, top + 0.09, 0.6], r: 0.045, color: 0xbfc0bc }), 0.4);
  T(k.box(0.7, 0.04, 0.5, 'paint', { at: [0, top + 0.27, 0.83], rot: [-0.95, 0.12, 0], r: 0.02, color: 0xbfc0bc }), -0.4);
  T(k.box(0.68, 0.012, 0.48, 'dark', { at: [0, top + 0.062, 0.6], color: 0x0c0c0c }), -0.4);
  k.box(0.42, 0.1, 0.42, 'dark', { at: [0.45, top + 0.05, -0.9], r: 0.03, color: dark });                    // vent
  k.box(0.46, 0.03, 0.46, 'dark', { at: [0.45, top + 0.11, -0.9], r: 0.01, color: 0x202020 });
  k.cyl(0.05, 0.12, 'dark', { at: [-0.7, top + 0.06, 2.2], seg: 14, color: dark });                         // fridge flue
  // roof rails on short feet (every van), and per-van roof gear for silhouette
  for (const s of [-1, 1]) {
    k.tube([new Vector3(s * 0.88, top + 0.1, -1.5), new Vector3(s * 0.88, top + 0.1, 3.0)], 0.016, 'metal', { radial: 8, color: 0xb0b2b4 });
    for (const z of [-1.5, 0.3, 2.0, 3.0]) k.box(0.05, 0.1, 0.07, 'dark', { at: [s * 0.88, top + 0.05, z], r: 0.015, color: dark });
  }
  for (const z of [-1.2, -0.3, 1.2]) k.box(1.82, 0.03, 0.05, 'metal', { at: [0, top + 0.125, z], r: 0.01, color: 0x3a3c3e }); // cross bars
  if (cfg.gear === 'pod') {                                                                                       // cargo pod, strapped
    k.box(0.9, 0.36, 1.5, 'paint', { at: [-0.25, top + 0.33, -0.75], r: 0.16, color: 0x2a2c2e, seg: 3 });
    for (const z of [-1.2, -0.3]) k.box(0.94, 0.012, 0.04, 'dark', { at: [-0.25, top + 0.515, z], r: 0.004, color: 0xd8571c });
  } else if (cfg.gear === 'kayak') {                                                                              // a kayak, optimistic
    k.add(lathe([[0, -1.6], [0.12, -1.2], [0.2, -0.4], [0.21, 0.3], [0.16, 1.1], [0.0, 1.6]], { seg: 14 }), 'paint', { at: [0.25, top + 0.36, 0.4], rot: [Math.PI / 2, 0, 0], color: 0xd8571c });
    for (const z of [-0.4, 1.2]) k.box(0.36, 0.012, 0.04, 'dark', { at: [0.25, top + 0.575, z], r: 0.004, color: 0x141414 });
  } else if (cfg.gear === 'bags') {                                                                               // duffels in a net
    k.box(0.5, 0.26, 0.8, 'cab', { at: [-0.3, top + 0.28, -0.4], r: 0.11, color: 0x3a5a3a, seg: 3 });
    k.box(0.44, 0.22, 0.6, 'cab', { at: [0.3, top + 0.26, -0.25], r: 0.1, color: 0x7a2f2a, seg: 3 });
  }
  if (cfg.roof === 'solar') {
    k.box(1.5, 0.035, 0.72, 'metal', { at: [0, top + 0.06, 2.3], r: 0.01, color: 0x9a9c9e });
    k.box(1.46, 0.02, 0.68, 'glass', { at: [0, top + 0.08, 2.3], r: 0.004, color: 0x40506a });
    for (let i = 0; i < 6; i++) k.box(0.006, 0.026, 0.68, 'metal', { at: [-0.62 + i * 0.25, top + 0.08, 2.3], color: 0xc8cacc });
    for (const [x, z] of [[-0.7, 2.0], [0.7, 2.0], [-0.7, 2.6], [0.7, 2.6]]) k.box(0.08, 0.05, 0.08, 'dark', { at: [x, top + 0.025, z], r: 0.01, color: dark });
  } else if (cfg.roof === 'aircon') {
    k.box(0.78, 0.26, 1.0, 'paint', { at: [0, top + 0.13, 2.2], r: 0.08, color: 0xd0d0cc });
    for (let i = 0; i < 5; i++) k.box(0.6, 0.012, 0.05, 'dark', { at: [0, top + 0.262, 1.85 + i * 0.07], r: 0.004, color: 0x333333 });
    k.cyl(0.012, 0.45, 'metal', { at: [-0.8, top + 0.22, -1.6], seg: 8 });                                  // TV aerial
    k.box(0.3, 0.02, 0.06, 'metal', { at: [-0.8, top + 0.45, -1.6], r: 0.005 });
  } else {
    k.box(0.42, 0.1, 0.42, 'dark', { at: [-0.4, top + 0.05, 2.3], r: 0.03, color: dark });
    k.box(0.46, 0.03, 0.46, 'dark', { at: [-0.4, top + 0.11, 2.3], r: 0.01, color: 0x202020 });
    k.box(0.9, 0.035, 0.55, 'metal', { at: [0.45, top + 0.06, 1.7], r: 0.01, color: 0x9a9c9e });
    k.box(0.86, 0.02, 0.51, 'glass', { at: [0.45, top + 0.08, 1.7], r: 0.004, color: 0x40506a });
  }
}

// comedy props: returns local colliders [cx, cz, w, d, h]
export function buildProps(k, T, cfg) {
  const out = [], hw = D.bodyW / 2;
  const chair = (x, z, yaw, col) => {
    k.push(x, 0, z, yaw);
    for (const s of [-1, 1]) {
      k.tube([new Vector3(s * 0.27, 0.0, 0.32), new Vector3(s * 0.27, 0.42, -0.02), new Vector3(s * 0.27, 0.84, -0.32)], 0.012, 'metal', { radial: 6, color: 0xb8babc });
      k.tube([new Vector3(s * 0.27, 0.0, -0.3), new Vector3(s * 0.27, 0.36, 0.08)], 0.012, 'metal', { radial: 6, color: 0xb8babc });
      k.box(0.05, 0.03, 0.34, 'cab', { at: [s * 0.27, 0.6, 0.08], r: 0.012, color: 0x5a4632 });              // arm rest
    }
    k.tube([new Vector3(-0.27, 0.36, 0.08), new Vector3(0.27, 0.36, 0.08)], 0.011, 'metal', { radial: 6, color: 0xb8babc });
    k.tube([new Vector3(-0.27, 0.84, -0.32), new Vector3(0.27, 0.84, -0.32)], 0.011, 'metal', { radial: 6, color: 0xb8babc });
    const sl = [[0, 0.84, -0.31], [0, 0.55, -0.13], [0, 0.34, 0.03], [0, 0.37, 0.2]];
    for (let i = 0; i < 3; i++) k.bar(sl[i], sl[i + 1], 0.52, 0.01, 'cab', { r: 0.004, color: col, occ: false });
    k.pop();
  };
  if (cfg.props === 'chairs') {
    const bx = hw + 1.3;
    chair(bx, -0.6, 0.35, 0x2f6a8a); chair(bx + 0.9, -0.2, -0.25, 0xb04030);
    k.push(bx + 0.5, 0, -1.25, 0.2);                                                                              // folding table + thermos + mugs
    k.box(0.6, 0.025, 0.45, 'paint', { at: [0, 0.66, 0], r: 0.008, color: 0x8a8e88 });
    for (const [a, b] of [[-0.26, -0.18], [0.26, -0.18], [-0.26, 0.18], [0.26, 0.18]]) k.tube([new Vector3(a, 0.65, b), new Vector3(a * 1.1, 0, b * 1.15)], 0.01, 'metal', { radial: 6 });
    k.cyl(0.045, 0.3, 'metal', { at: [-0.12, 0.823, 0], seg: 16, color: 0x3a6a4a });
    k.cyl(0.04, 0.04, 'dark', { at: [-0.12, 0.99, 0], seg: 16, color: 0x222222 });
    for (const [mx, c] of [[0.1, 0xd8d4c8], [0.2, 0x9a3a2a]]) k.cyl(0.04, 0.09, 'paint', { at: [mx, 0.718, 0.06], seg: 14, color: c });
    k.pop();
    out.push([bx + 0.45, -0.6, 1.9, 1.9, 0.9]);
  } else if (cfg.props === 'washing') {                                                                           // line from the awning bracket to a pole
    const px = -(hw + 2.6), pz = 2.3, a = new Vector3(-(hw + 0.05), 2.62, 1.1), b = new Vector3(px, 1.95, pz);
    k.cyl(0.02, 1.98, 'metal', { at: [px, 0.99, pz], seg: 8, color: 0x8a8c8e });
    for (const s of [-1, 1]) k.tube([new Vector3(px, 0.7, pz), new Vector3(px + s * 0.35, 0, pz + 0.2)], 0.01, 'metal', { radial: 5 });
    k.tube([new Vector3(px, 0.7, pz), new Vector3(px, 0, pz - 0.38)], 0.01, 'metal', { radial: 5 });
    const sag = (t) => new Vector3().lerpVectors(a, b, t).add(new Vector3(0, -Math.sin(t * Math.PI) * 0.22, 0));
    const line = []; for (let i = 0; i <= 12; i++) line.push(sag(i / 12));
    k.tube(line, 0.004, 'dark', { radial: 4, color: 0xd8d8d0 });
    const cloth = [[0.14, 0.55, 0.42, 0xd8571c], [0.3, 0.3, 0.2, 0xe8e4da], [0.42, 0.62, 0.5, 0x2f5d7c], [0.56, 0.18, 0.16, 0x3a3a3a], [0.62, 0.18, 0.16, 0x3a3a3a], [0.76, 0.45, 0.36, 0x9c8548]];
    for (const [t, cw, chh, c] of cloth) {
      const p = sag(t), d = new Vector3().subVectors(b, a), yaw = Math.atan2(-d.z, d.x);
      k.push(p.x, p.y, p.z, yaw);
      const w2 = cw / 2, sl = cw * 0.28, shp = cw > 0.35 && chh > 0.5 ? [[-w2 + sl, 0], [-w2, -0.03], [-w2 - 0.04, -0.2], [-w2 + sl * 0.7, -0.24], [-w2 + sl * 0.8, -chh], [w2 - sl * 0.8, -chh], [w2 - sl * 0.7, -0.24], [w2 + 0.04, -0.2], [w2, -0.03], [w2 - sl, 0], [0, -0.06]]
        : cw < 0.2 ? [[-w2, 0], [w2, 0], [w2, -chh + 0.05], [w2 + 0.06, -chh], [-w2, -chh + 0.01]] : [[-w2, 0], [w2, 0], [w2 * 0.96, -chh], [-w2 * 0.97, -chh + 0.01]];
      k.add(extrudeBevel(shp, { depth: 0.01, bevel: 0.003, bevelSeg: 1 }), 'cab', { at: [0, 0.01, 0], rot: [0.06, 0, (t - 0.5) * 0.1], color: c, occ: false });
      for (const s of [-1, 1]) k.box(0.012, 0.05, 0.016, 'metal', { at: [s * cw * 0.4, 0.0, 0], color: 0xd2b048 });
      k.pop();
    }
    k.cyl(0.18, 0.35, 'paint', { at: [-(hw + 1.2), 0.175, 2.9], seg: 18, color: 0xc8c4b8 });                      // laundry basket (empty: optimism)
    out.push([px, pz, 0.6, 0.6, 2.0]);
  } else if (cfg.props === 'gas') {
    k.push(hw + 0.6, 0, -0.65);                                                                                   // 9 kg LPG bottle, chained to nothing
    k.add(lathe([[0, 0], [0.13, 0.0], [0.155, 0.04], [0.155, 0.43], [0.12, 0.51], [0.05, 0.54], [0, 0.545]], { seg: 22 }), 'paint', { color: 0xb0b4b8 });
    k.add(lathe([[0.08, 0.5], [0.095, 0.53], [0.095, 0.63], [0.085, 0.64], [0.075, 0.55]], { seg: 16, crease: 40 }), 'metal', { color: 0xa0a2a4, occ: false });
    k.cyl(0.02, 0.07, 'metal', { at: [0, 0.58, 0], seg: 10, color: 0xb89a40 });
    k.pop();
    const tx = hw + 1.4, tz = -3.9;                                                                               // tripod: camera pointed at the slip
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.3; k.tube([new Vector3(tx, 1.3, tz), new Vector3(tx + Math.cos(a) * 0.45, 0, tz + Math.sin(a) * 0.45)], 0.012, 'metal', { radial: 6, color: 0x1e1e20 }); }
    k.cyl(0.03, 0.12, 'dark', { at: [tx, 1.32, tz], seg: 10, color: 0x1e1e20 });
    k.box(0.14, 0.1, 0.08, 'dark', { at: [tx, 1.43, tz], r: 0.012, color: 0x222224 });
    k.cyl(0.035, 0.12, 'dark', { at: [tx, 1.43, tz - 0.09], rot: [Math.PI / 2, 0, 0], seg: 14, color: 0x18181a });
    k.box(0.5, 0.34, 0.36, 'paint', { at: [hw + 0.55, 0.17, 0.3], r: 0.03, color: 0x2f6a8a });                    // chilly bin, bungee'd shut
    k.box(0.52, 0.06, 0.38, 'paint', { at: [hw + 0.55, 0.36, 0.3], r: 0.02, color: 0xe8e4da });
    k.tube([new Vector3(hw + 0.3, 0.05, 0.3), new Vector3(hw + 0.29, 0.4, 0.3), new Vector3(hw + 0.81, 0.4, 0.3), new Vector3(hw + 0.8, 0.05, 0.3)], 0.008, 'dark', { radial: 5, color: 0xc03a1a });
    out.push([hw + 0.6, -0.65, 0.4, 0.4, 0.65], [tx, tz, 0.8, 0.8, 1.4], [hw + 0.55, 0.3, 0.55, 0.4, 0.4]);
  }
  return out;
}
