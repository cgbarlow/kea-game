// blower/model — the ranger-issue handheld leaf blower view model at real (mm) scale, plus the gloved hand.
// buildBlower(G) → { group, nozzle: Vector3 (mouth centre, model space), tail: Vector3 (tube axis point), engine: Vector3
//                    (cooling-slat smoke source), hot: Material (exhaust glow),
//                    tris, calls }.
// Model space: metres, origin = centre of the loop-handle grip, X right, Y up, -Z forward (along the tube).
// Layout (Stihl BG-class): fan volute (axis X) under the handle, engine shroud + recoil starter on the right,
// air-filter cover at the rear, translucent fuel tank underneath, muffler guard front-right, a 3-section tapered tube
// (corrugated flex collar, two rigid sections, clamps) ending in a flat nozzle. One Mesh per material key (<= 7 draws).
import { Group, Vector3, Matrix4, Quaternion, MeshStandardMaterial, Color } from 'three';
import { Kit, lathe, tube, extrudeBevel } from '../../cookbook/geo/kit.js';
import { makeMaterial } from '../../cookbook/materials/library.js';
import { ringLoft, alongAxis, ribProfile } from './geo.js';
import { buildHand } from './hand.js';
import { buildStickers } from './stickers.js';

const ORANGE = 0xc04810, ORANGE_W = 0xa03c12, HOUSE = 0x606366, HOUSE_D = 0x3a3c3f, CREAM = 0x8c8b86, GREY = 0x3c3e40, DARK = 0x1b1c1d, TANK = 0x9c937f, FUEL = 0xa65a30;
const V = (x, y, z) => new Vector3(x, y, z);

// tube frame: outlet point + direction (slightly nose-down)
const T0 = [-0.02, -0.222, -0.07], TD = new Vector3(0, -0.05, -1).normalize();

export function buildBlower(G) {
  const k = new Kit();
  const st = buildStickers(G);

  // ---------------------------------------------------------------- fan volute (scroll housing), axis X
  const vol = lathe([[0, 0], [0.084, 0], [0.1, 0.003], [0.111, 0.01], [0.117, 0.024], [0.119, 0.065], [0.117, 0.106], [0.111, 0.12], [0.1, 0.127], [0.084, 0.13], [0, 0.13]], { seg: 64, crease: 40 });
  k.add(alongAxis(vol, [-0.085, -0.17, 0.02], [0.045, -0.17, 0.02]), 'plastic', { color: HOUSE });
  k.add(alongAxis(lathe([[0.1185, 0], [0.1205, 0.001], [0.1205, 0.004], [0.1185, 0.005]], { seg: 64 }), [-0.03, -0.17, 0.02], [-0.025, -0.17, 0.02]), 'plastic', { color: DARK, occ: false }); // parting line
  // scroll lobe sweeping into the outlet (gives the housing its snail silhouette)
  k.add(ringLoft([
    { x: -0.02, y: -0.205, z: 0.06, a: 0.06, b: 0.06 }, { x: -0.02, y: -0.222, z: 0.0, a: 0.062, b: 0.064 },
    { x: -0.02, y: -0.226, z: -0.05, a: 0.058, b: 0.058 }, { x: -0.02, y: -0.226, z: -0.075, a: 0.054, b: 0.054 },
  ].map((r) => ({ ...r, color: HOUSE })), 48), 'plastic', { occ: false });
  // intake grille on the left face: concentric slotted rings, three spokes, hub
  const grille = lathe([[0, 0.006], [0.018, 0.006], [0.02, 0.0], ...Array.from({ length: 9 }, (_, i) => { const r = 0.024 + i * 0.0065; return [[r, 0.0], [r + 0.0015, 0.004], [r + 0.0045, 0.004], [r + 0.006, 0.0]]; }).flat(), [0.085, 0.0], [0.088, -0.004]], { seg: 64, crease: 50 });
  k.add(alongAxis(grille, [-0.086, -0.17, 0.02], [-0.096, -0.17, 0.02]), 'plastic', { color: DARK, occ: false });
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094 + 0.4;
    k.box(0.006, 0.006, 0.066, 'plastic', { at: [-0.091, -0.17 + Math.sin(a) * 0.052, 0.02 + Math.cos(a) * 0.052], rot: [a, 0, 0], r: 0.002, color: HOUSE_D, occ: false });
  }
  k.cyl(0.02, 0.012, 'plastic', { at: [-0.093, -0.17, 0.02], rot: [0, 0, Math.PI / 2], seg: 32, color: ORANGE, occ: false });
  // screws round the volute flange
  for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.2; k.cyl(0.0045, 0.006, 'metal', { at: [-0.087, -0.17 + Math.sin(a) * 0.104, 0.02 + Math.cos(a) * 0.104], rot: [0, 0, Math.PI / 2], seg: 12, occ: false }); }

  // ---------------------------------------------------------------- engine shroud (right) + cooling slats
  k.box(0.08, 0.2, 0.27, 'plastic', { at: [0.082, -0.16, 0.02], r: 0.03, color: ORANGE });
  for (let i = 0; i < 9; i++) k.box(0.058, 0.005, 0.0045, 'plastic', { at: [0.07, -0.0595, 0.03 - i * 0.0095], r: 0.0015, color: ORANGE_W, occ: false });
  k.box(0.064, 0.004, 0.09, 'plastic', { at: [0.07, -0.0612, -0.008], r: 0.0015, color: 0x0e0e0e, occ: false }); // slot shadow bed
  for (let i = 0; i < 2; i++) k.cyl(0.004, 0.004, 'metal', { at: [0.082, -0.059, -0.1 + i * 0.21], seg: 12, occ: false });   // shroud screws
  // recoil starter cover (right face), ribbed disc + T-grip on its cord
  const starter = lathe([[0, 0.02], [0.03, 0.02], ...Array.from({ length: 6 }, (_, i) => { const r = 0.034 + i * 0.006; return [[r, 0.019], [r + 0.003, 0.016]]; }).flat(), [0.068, 0.012], [0.071, 0.004], [0.071, 0]], { seg: 56, crease: 40 });
  k.add(alongAxis(starter, [0.12, -0.17, 0.05], [0.14, -0.17, 0.05]), 'plastic', { color: GREY });
  k.cyl(0.012, 0.01, 'metal', { at: [0.146, -0.17, 0.05], rot: [0, 0, Math.PI / 2], seg: 16, occ: false });
  k.tube([V(0.128, -0.12, 0.085), V(0.126, -0.075, 0.08), V(0.118, -0.058, 0.075)], 0.0022, 'rubber', { radial: 8, curve: true, samples: 10 });
  k.add(alongAxis(lathe([[0, 0], [0.008, 0], [0.0105, 0.004], [0.0115, 0.035], [0.0105, 0.066], [0.008, 0.07], [0, 0.07]], { seg: 20 }), [0.113, -0.055, 0.04], [0.113, -0.055, 0.11]), 'rubber', { occ: false });

  // ---------------------------------------------------------------- air-filter cover (rear), ribbed, knurled knob
  k.box(0.17, 0.13, 0.065, 'plastic', { at: [0.02, -0.135, 0.17], r: 0.024, color: HOUSE });
  for (let i = 0; i < 11; i++) k.box(0.005, 0.095, 0.006, 'plastic', { at: [-0.045 + i * 0.012, -0.14, 0.2025], r: 0.002, color: HOUSE_D, occ: false });
  const knob = lathe([[0, 0], [0.019, 0], [0.021, 0.003], [0.021, 0.013], [0.017, 0.017], [0, 0.017]], { seg: 24 });
  k.add(alongAxis(knob, [0.02, -0.135, 0.2], [0.02, -0.135, 0.22]), 'plastic', { color: ORANGE, occ: false });
  for (let i = 0; i < 12; i++) { const a = i * 0.5236; k.box(0.003, 0.003, 0.012, 'plastic', { at: [0.02 + Math.cos(a) * 0.021, -0.135 + Math.sin(a) * 0.021, 0.209], r: 0.001, color: ORANGE_W, occ: false }); }

  // ---------------------------------------------------------------- fuel tank (underneath), window, cap + tether
  k.box(0.17, 0.075, 0.25, 'plastic', { at: [0.012, -0.292, 0.035], r: 0.026, color: TANK });
  k.box(0.004, 0.036, 0.12, 'glass', { at: [-0.0745, -0.29, 0.075], r: 0.0018, occ: false });
  k.box(0.003, 0.016, 0.116, 'plastic', { at: [-0.0712, -0.3, 0.075], r: 0.001, color: FUEL, occ: false });
  for (let i = 0; i < 5; i++) k.box(0.0015, 0.0012, i % 2 ? 0.008 : 0.014, 'plastic', { at: [-0.0772, -0.302 + i * 0.006, 0.13], r: 0.0004, color: DARK, occ: false });
  const cap = lathe([[0, 0], [0.024, 0], [0.025, 0.004], ...Array.from({ length: 16 }, (_, i) => [[0.025 + (i % 2) * 0.0015, 0.005 + i * 0.001]]).flat(), [0.022, 0.024], [0, 0.025]], { seg: 40, crease: 30 });
  k.add(alongAxis(cap, [-0.035, -0.272, 0.13], [-0.075, -0.262, 0.13]), 'plastic', { color: ORANGE, occ: false });
  k.tube([V(-0.08, -0.262, 0.13), V(-0.088, -0.28, 0.11), V(-0.084, -0.3, 0.08), V(-0.077, -0.285, 0.05)], 0.0018, 'rubber', { radial: 6, curve: true, samples: 14 });
  // primer bulb (clear dome, by the carburettor)
  k.add(alongAxis(lathe([[0.012, 0], [0.012, 0.004], [0.011, 0.009], [0.007, 0.014], [0, 0.0155]], { seg: 24 }), [0.12, -0.235, -0.03], [0.14, -0.235, -0.03]), 'glass', { occ: false });
  k.cyl(0.0145, 0.004, 'plastic', { at: [0.121, -0.235, -0.03], rot: [0, 0, Math.PI / 2], seg: 24, color: DARK, occ: false });

  // ---------------------------------------------------------------- muffler guard (front right) + exhaust
  k.box(0.065, 0.085, 0.075, 'metal', { at: [0.085, -0.245, -0.085], r: 0.01 });
  for (let i = 0; i < 6; i++) k.box(0.0025, 0.055, 0.005, 'plastic', { at: [0.118, -0.245, -0.11 + i * 0.01], r: 0.001, color: 0x0b0b0b, occ: false });
  k.box(0.024, 0.016, 0.012, 'hot', { at: [0.1, -0.272, -0.124], r: 0.003, occ: false });

  // ---------------------------------------------------------------- loop handle, rubber grip, throttle, lockout, stop switch
  const loop = [V(0.0, -0.06, 0.125), V(0.0, -0.012, 0.11), V(0.0, 0.012, 0.075), V(0.0, 0.014, 0.0), V(0.0, 0.012, -0.065), V(0.0, -0.01, -0.1), V(0.0, -0.065, -0.11)];
  k.add(tube(loop, 0.0145, { radial: 20, curve: true, samples: 40 }), 'rubber', { occ: false, color: 0x2a2b2c });
  k.add(alongAxis(lathe(ribProfile(0.0168, 0.0178, 0.115, 16, 5), { seg: 28 }), [0, 0.0135, 0.058], [0, 0.0135, -0.057]), 'rubber');
  const trig = extrudeBevel([[0.006, 0], [0.002, -0.018], [-0.006, -0.03], [-0.018, -0.034], [-0.026, -0.03], [-0.026, -0.022], [-0.016, -0.02], [-0.012, -0.008], [-0.012, 0]], { depth: 0.011, bevel: 0.0015, curveSeg: 4 });
  k.add(trig, 'plastic', { at: [0, 0.0, -0.045], rot: [0, Math.PI / 2, 0], color: CREAM, occ: false });
  const lock = extrudeBevel([[0, 0], [0.024, 0], [0.03, 0.008], [0.004, 0.012]], { depth: 0.012, bevel: 0.0012, curveSeg: 3 });
  k.add(lock, 'plastic', { at: [0, 0.026, 0.045], rot: [0, -Math.PI / 2, 0], color: CREAM, occ: false });
  k.box(0.008, 0.012, 0.022, 'plastic', { at: [-0.0165, 0.012, -0.072], r: 0.003, color: 0x9a2414, occ: false });   // stop switch
  // boss where the handle legs meet the housing
  k.box(0.04, 0.03, 0.05, 'plastic', { at: [0, -0.055, 0.12], r: 0.012, color: HOUSE });
  k.box(0.04, 0.03, 0.05, 'plastic', { at: [0, -0.06, -0.108], r: 0.012, color: HOUSE });

  // ---------------------------------------------------------------- tube: flex collar, 2 rigid tapered sections, flat nozzle
  const M = new Matrix4().compose(V(...T0), new Quaternion().setFromUnitVectors(V(0, 0, -1), TD), V(1, 1, 1));
  k.pushMatrix(M);
  const rings = [];
  const add = (z, a, b = a, color = ORANGE, p = 2) => rings.push({ x: 0, y: 0, z: -z, a, b, p, color });
  add(-0.006, 0.05, 0.05, DARK);
  for (let i = 0; i <= 54; i++) { const z = i * 0.0024, w = 0.5 - 0.5 * Math.cos((i / 6) * Math.PI * 2); add(z, 0.047 + 0.004 * w, 0.047 + 0.004 * w, DARK); }   // 9 corrugations
  add(0.132, 0.052, 0.052, ORANGE_W); add(0.134, 0.053); add(0.152, 0.053); add(0.156, 0.047);          // collar
  for (let i = 0; i <= 12; i++) { const t = i / 12; add(0.16 + t * 0.29, 0.046 - t * 0.005); }           // section 2
  add(0.452, 0.0415); add(0.455, 0.0445); add(0.47, 0.0445); add(0.474, 0.039);                        // female flare
  for (let i = 0; i <= 10; i++) { const t = i / 10; add(0.48 + t * 0.24, 0.0385 - t * 0.0055); }        // section 3
  for (let i = 1; i <= 10; i++) { const t = i / 10, s = t * t * (3 - 2 * t); add(0.72 + t * 0.1, 0.033 + s * 0.022, 0.033 - s * 0.019, ORANGE, 2 + s * 5); } // to flat
  add(0.84, 0.055, 0.0145, 0x8a3a16, 7); add(0.852, 0.0548, 0.0142, 0x3a2a20, 7);                      // scuffed lip
  add(0.856, 0.052, 0.0115, 0x2a2420, 7); add(0.85, 0.05, 0.0102, 0x0c0b0a, 7); add(0.8, 0.045, 0.012, 0x050505, 6); // mouth → interior
  k.add(ringLoft(rings, 64), 'plastic', { occ: false });
  // clamps: metal bands with a screw lug
  const band = (z, r, w) => {
    k.add(alongAxis(lathe([[r - 0.003, 0], [r, 0.002], [r, w - 0.002], [r - 0.003, w]], { seg: 48 }), [0, 0, -z], [0, 0, -z - w]), 'metal', { occ: false });
    k.box(0.012, 0.014, w * 0.9, 'metal', { at: [-r * 0.7, r * 0.7 + 0.004, -z - w / 2], rot: [0, 0, 0.78], r: 0.002, occ: false });
    k.cyl(0.0035, 0.024, 'metal', { at: [-r * 0.7 - 0.004, r * 0.7 + 0.008, -z - w / 2], rot: [0, 0, 0.78], seg: 12, occ: false });
  };
  band(0.135, 0.0545, 0.016); band(0.456, 0.0462, 0.013);
  // stickers on the tube (wrapped), the departmental warning on top-left so the player reads it
  st.onTube(k, 'kea', 0.15, -0.3, 2.2, 0.0437);
  k.pop();
  // left-face stickers + serial plate + fuel + ears + hot
  st.place(k, 'issue', 0.064, [0.08, -0.0594, 0.086], [-Math.PI / 2, 0, Math.PI / 2]);
  
  st.place(k, 'mix', 0.034, [-0.055, -0.2533, 0.07], [-Math.PI / 2, 0, 0]);
  st.place(k, 'ears', 0.048, [-0.0773, -0.29, -0.036], [0, -Math.PI / 2, 0]);
  st.place(k, 'serial', 0.05, [-0.0646, -0.093, 0.17], [0, -Math.PI / 2, 0]);
  st.place(k, 'hot', 0.04, [0.1185, -0.245, -0.085], [0, Math.PI / 2, 0]);

  // ---------------------------------------------------------------- the gloved hand on the grip + jacket sleeve
  buildHand(k);

  // ---------------------------------------------------------------- bake: contact AO + grime (dust in the ribs, fuel stains)
  k.bakeAO({ radius: 0.05, samples: 12, strength: 0.6, keys: ['plastic', 'metal', 'rubber', 'glove'] });
  k.grime({ base: -0.33, foot: 0.06, down: 0.3, streak: 0.25, dirt: [0.62, 0.55, 0.45], scale: 14, seed: 41 }, ['plastic', 'metal']);
  k.grime({ base: -0.4, foot: 0.0, down: 0.2, streak: 0.0, dirt: [0.7, 0.62, 0.5], scale: 20, seed: 7 }, ['glove']);

  const tint = 0xffffff;
  const sheltered = { preset: 'sheltered', dust: 0.4, edge: 0.3 };
  const mats = {
    plastic: makeMaterial('plastic', { tint, scale: 0.12, rough: 1.0, normal: 1.6, weather: sheltered }),
    rubber: makeMaterial('rubber', { tint: 0x5a5a5a, scale: 0.12, weather: { preset: 'sheltered', dust: 0.6 } }),
    metal: makeMaterial('galvanised', { tint: 0x8a8c8e, scale: 0.18, rough: 1.1, weather: { preset: 'sheltered', dust: 0.5 } }),
    glove: makeMaterial('tarp', { tint, scale: 0.09, rough: 1.15, normal: 0.6, weather: { preset: 'sheltered', dust: 0.3 } }),
    glass: new MeshStandardMaterial({ color: new Color(0.62, 0.6, 0.55), roughness: 0.18, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false }),
    hot: new MeshStandardMaterial({ color: new Color(0.06, 0.05, 0.045), roughness: 0.6, metalness: 0.6, emissive: new Color(1.0, 0.32, 0.06), emissiveIntensity: 0 }),
    decal: st.material,
  };
  for (const kk of ['plastic', 'rubber', 'metal', 'glove']) mats[kk].vertexColors = true;
  for (const kk in mats) mats[kk].userData.noAtmos = true;
  const group = k.build({ ...mats, default: mats.plastic }, { castShadow: false, receiveShadow: false });
  let tris = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    if (o.material === mats.decal) o.renderOrder = 2;
    if (o.material === mats.glass) o.renderOrder = 3;
    tris += o.geometry.index.count / 3;
  });
  const nozzle = V(...T0).addScaledVector(TD, 0.86);
  return { group, nozzle, tail: V(...T0).addScaledVector(TD, 0.3), engine: V(0.07, -0.045, -0.01), hot: mats.hot, tris, calls: group.children.length };
}
