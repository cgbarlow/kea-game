// ranger/figure — the Department ranger: a procedural human in a fluoro hi-vis jacket with retro-reflective strips
// (two torso hoops, shoulder braces, sleeve bands), dark work trousers, leather boots, tan rigger gloves, a dark beanie
// pulled low and the jacket collar zipped up. The face is a plain, shadowed oval between beanie and collar (no
// features to go uncanny). One SkinnedMesh per material (4 draws) sharing one 15-bone skeleton, rigid skinning
// except the waist, which blends hips → spine so the jacket never splits when the ranger bends over.
//   buildFigureGeo(G) → { geos: {key: BufferGeometry}, mats: {key: Material}, tris }      (build once)
//   makeFigure(geo)   → { group, bones: {hips, spine, head, upL, foL, haL, upR, foR, haR, thL, shL, ftL, thR, shR, ftR},
//                         meshes }                                                    (cheap: shares geometry)
//   poseFigure(F, P)  → applies a pose blend (see newPose) to the bones. Allocation-free.
// Bind pose: standing, arms hanging, facing -Z (the ranger's right hand is +X), feet at y = 0.
import { Bone, Skeleton, SkinnedMesh, Group, Vector3, Sphere, MeshStandardMaterial, Color, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { Kit, lathe, mergeGeos, roundedBox } from '../../cookbook/geo/kit.js';
import { makeMaterial } from '../../cookbook/materials/library.js';

// sRGB swatches (Color converts to linear)
const HIVIS = 0xc9ee1e, HIVIS_D = 0xa9cc18, TROUSER = 0x262b33, TROUSER_D = 0x1d2128, BOOT = 0x3b2a1d, SOLE = 0x151312,
  BEANIE = 0x2c3a2e, BEANIE_C = 0x33433a, GLOVE = 0x7a5a38, GLOVE_D = 0x5c4229, SKIN = 0xa47a5e, ZIP = 0x22262b, RADIO = 0x18191b;

// bone table: name, parent index, bind offset from parent
const BONES = [
  ['hips', -1, [0, 0.96, 0]], ['spine', 0, [0, 0.06, 0]], ['head', 1, [0, 0.51, 0]],
  ['upL', 1, [-0.215, 0.42, 0]], ['foL', 3, [0, -0.29, 0]], ['haL', 4, [0, -0.26, 0]],
  ['upR', 1, [0.215, 0.42, 0]], ['foR', 6, [0, -0.29, 0]], ['haR', 7, [0, -0.26, 0]],
  ['thL', 0, [-0.095, -0.04, 0]], ['shL', 9, [0, -0.44, 0]], ['ftL', 10, [0, -0.4, 0]],
  ['thR', 0, [0.095, -0.04, 0]], ['shR', 12, [0, -0.44, 0]], ['ftR', 13, [0, -0.4, 0]],
];
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
// bind-pose world position of each joint
const JW = BONES.map(() => new Vector3());
BONES.forEach((b, i) => { JW[i].fromArray(b[2]); if (b[1] >= 0) JW[i].add(JW[b[1]]); });

// a limb segment: rounded tapered capsule hanging from y = 0 down to -len (lathe around Y)
function limb(len, r0, r1, seg = 12) {
  return lathe([[0, -len - r1 * 0.6], [r1 * 0.72, -len - r1 * 0.45], [r1, -len - r1 * 0.08], [(r0 + r1) * 0.52, -len * 0.5], [r0, -r0 * 0.1], [r0 * 0.74, r0 * 0.42], [0, r0 * 0.62]], { seg, crease: 70 });
}
// open band (strip / cuff) round a limb at y0..y1
function band(r0, r1, y0, y1, seg = 12) { return lathe([[r0 - 0.004, y0], [r0, y0 + 0.002], [r1, y1 - 0.002], [r1 - 0.004, y1]], { seg, crease: 50 }); }
const scaleZ = (g, s, sx = 1) => { g.scale(sx, 1, s); return g; };

export function buildFigureGeo(G) {
  const k = new Kit();
  const spec = new Map();           // geo → bone index | [boneLow, boneHigh, y0, y1] (blend by bind-pose y)
  const put = (geo, key, bone, o = {}) => { k.add(geo, key, o); spec.set(geo, bone); return geo; };
  const at = (i, dx = 0, dy = 0, dz = 0) => [JW[i].x + dx, JW[i].y + dy, JW[i].z + dz];
  const waist = [BI.hips, BI.spine, 0.97, 1.13];

  // ---------------------------------------------------------------- jacket body (one lathe, elliptical, waist-blended)
  // hem 0.79 (upper thigh), chest 1.3, shoulders 1.46, collar base 1.53
  const torso = lathe([[0.0, 0.79], [0.185, 0.79], [0.195, 0.81], [0.197, 0.9], [0.188, 1.0], [0.184, 1.08], [0.19, 1.2], [0.194, 1.3], [0.19, 1.39],
    [0.178, 1.44], [0.15, 1.49], [0.11, 1.52], [0.0, 1.535]], { seg: 20, crease: 60 });
  put(scaleZ(torso, 0.6), 'hivis', waist, { color: HIVIS });
  // shoulder yokes (rounded caps so the arms sit in the jacket, not on a cylinder)
  for (const s of [-1, 1]) put(scaleZ(lathe([[0, -0.07], [0.06, -0.06], [0.075, -0.02], [0.07, 0.03], [0.04, 0.065], [0, 0.072]], { seg: 12 }), 0.95), 'hivis', BI.spine, { at: [s * 0.19, 1.42, 0], color: HIVIS });
  // collar zipped up to the chin: a stand-up tube round the neck (fleece-lined: dark rim at the top)
  put(lathe([[0.098, 1.49], [0.1, 1.53], [0.098, 1.585], [0.094, 1.61], [0.084, 1.615], [0.08, 1.585], [0.078, 1.54]], { seg: 16, crease: 40 }), 'hivis', BI.spine, { color: HIVIS });
  put(band(0.081, 0.083, 1.606, 1.62, 16), 'cloth', BI.spine, { color: 0x2a2e30 });
  // zip + storm flap down the front, chest pockets, hem drawcord
  put(boxGeo(k, 0.022, 0.66, 0.012, 0.004), 'cloth', waist, { at: [0.0, 1.16, -0.115], color: ZIP });
  for (const s of [-1, 1]) {
    put(boxGeo(k, 0.12, 0.13, 0.02, 0.006), 'hivis', BI.spine, { at: [s * 0.1, 1.29, -0.104], rot: [0.12, 0, 0], color: HIVIS_D });
    put(boxGeo(k, 0.13, 0.12, 0.02, 0.006), 'hivis', BI.hips, { at: [s * 0.13, 0.9, -0.094], rot: [0.02, s * -0.4, 0], color: HIVIS_D });
  }
  // the radio on the left chest (Department issue), stubby antenna
  put(boxGeo(k, 0.055, 0.1, 0.03, 0.006), 'cloth', BI.spine, { at: [-0.12, 1.34, -0.1], color: RADIO });
  put(boxGeo(k, 0.012, 0.07, 0.012, 0.004), 'cloth', BI.spine, { at: [-0.135, 1.425, -0.1], color: RADIO });

  // ---------------------------------------------------------------- retro-reflective strips: two hoops + braces
  for (const [y, r] of [[0.95, 0.199], [1.1, 0.192]]) put(scaleZ(band(r, r, y - 0.025, y + 0.025, 20), 0.61, 1.0), 'strip', y < 1.0 ? BI.hips : BI.spine);
  for (const s of [-1, 1]) for (const z of [-1, 1]) {
    // braces: vertical strips from the upper hoop over the shoulder, front and back
    put(boxGeo(k, 0.05, 0.32, 0.006, 0.002), 'strip', BI.spine, { at: [s * 0.095, 1.28, z * 0.104] });
  }

  // ---------------------------------------------------------------- arms: hi-vis sleeves, strip bands, dark cuffs, gloves
  for (const [u, f, h, s] of [[BI.upL, BI.foL, BI.haL, -1], [BI.upR, BI.foR, BI.haR, 1]]) {
    put(limb(0.29, 0.066, 0.058), 'hivis', u, { at: at(u), color: HIVIS });
    put(band(0.068, 0.066, -0.13, -0.085), 'strip', u, { at: at(u) });
    put(limb(0.25, 0.058, 0.05), 'hivis', f, { at: at(f), color: HIVIS });
    put(band(0.058, 0.055, -0.12, -0.075), 'strip', f, { at: at(f) });
    put(band(0.052, 0.05, -0.255, -0.225), 'cloth', f, { at: at(f), color: 0x2a2e30 });
    // glove: a mitt-shaped rounded box (palm + fingers curled), thumb on the inside
    put(boxGeo(k, 0.06, 0.1, 0.085, 0.022), 'cloth', h, { at: at(h, 0, -0.055, -0.005), color: GLOVE });
    put(boxGeo(k, 0.024, 0.055, 0.03, 0.01), 'cloth', h, { at: at(h, -s * 0.03, -0.04, -0.035), rot: [0.3, 0, -s * 0.35], color: GLOVE_D });
    put(band(0.05, 0.047, -0.02, 0.02), 'cloth', h, { at: at(h), color: GLOVE_D });
  }

  // ---------------------------------------------------------------- legs: work trousers, leather boots
  put(scaleZ(lathe([[0.0, 0.74], [0.16, 0.75], [0.175, 0.8], [0.18, 0.9], [0.17, 0.97], [0.0, 0.98]], { seg: 18 }), 0.62), 'cloth', BI.hips, { color: TROUSER });
  for (const [t, sh, ft] of [[BI.thL, BI.shL, BI.ftL], [BI.thR, BI.shR, BI.ftR]]) {
    put(limb(0.44, 0.088, 0.064, 14), 'cloth', t, { at: at(t), color: TROUSER });
    put(limb(0.36, 0.064, 0.054, 12), 'cloth', sh, { at: at(sh), color: TROUSER });
    put(band(0.066, 0.07, -0.37, -0.3), 'cloth', sh, { at: at(sh), color: TROUSER_D });     // trouser hem over the boot
    // boot: ankle collar, upper, toe cap, sole + heel
    put(lathe([[0.058, -0.06], [0.06, 0.0], [0.058, 0.06], [0.052, 0.075]], { seg: 12 }), 'cloth', ft, { at: at(ft), color: BOOT });
    put(boxGeo(k, 0.11, 0.09, 0.27, 0.03), 'cloth', ft, { at: at(ft, 0, -0.03, -0.055), color: BOOT });
    put(boxGeo(k, 0.118, 0.028, 0.285, 0.008), 'cloth', ft, { at: at(ft, 0, -0.068, -0.056), color: SOLE });
  }

  // ---------------------------------------------------------------- head: plain shadowed face, beanie low, no features
  const hy = JW[BI.head].y;
  const head = scaleZ(lathe([[0, -0.0], [0.05, 0.01], [0.082, 0.05], [0.094, 0.11], [0.092, 0.16], [0.07, 0.205], [0, 0.222]], { seg: 16 }), 1.08, 0.98);
  put(head, 'skin', BI.head, { at: [0, hy + 0.02, 0.0], color: SKIN });
  // nose: a soft wedge so the head reads which way it faces at distance
  put(boxGeo(k, 0.026, 0.04, 0.03, 0.011), 'skin', BI.head, { at: [0, 1.643, -0.1], rot: [0.25, 0, 0], color: SKIN });
  // beanie: dome down to the brow (front) and lower at the back, folded cuff
  put(scaleZ(lathe([[0.101, 0.0], [0.103, 0.04], [0.098, 0.08], [0.082, 0.115], [0.05, 0.138], [0, 0.146]], { seg: 18 }), 1.08, 0.97), 'cloth', BI.head, { at: [0, 1.682, 0.0], rot: [-0.08, 0, 0], color: BEANIE });
  put(scaleZ(band(0.104, 0.105, 0.0, 0.045, 18), 1.08, 0.97), 'cloth', BI.head, { at: [0, 1.678, 0.0], rot: [-0.08, 0, 0], color: BEANIE_C });

  // ---------------------------------------------------------------- bake: contact AO + shading gradients
  k.bakeAO({ radius: 0.07, samples: 10, strength: 0.45 });
  // face sits in the beanie's shadow and the collar's: darken toward the brow and the chin
  for (const g of k.buckets.get('skin')) {
    const P = g.attributes.position.array, C = g.attributes.color.array;
    for (let i = 0; i < P.length; i += 3) { const y = P[i + 1] - hy, sh = 0.5 + 0.4 * Math.max(0, Math.min(1, 1 - Math.abs(y - 0.105) / 0.06)); C[i] *= sh; C[i + 1] *= sh; C[i + 2] *= sh; }
  }

  // ---------------------------------------------------------------- merge per material + skin attributes
  const geos = {};
  let tris = 0;
  for (const [key, list] of k.buckets) {
    const counts = list.map((g) => g.attributes.position.count), specs = list.map((g) => spec.get(g) ?? BI.spine);
    const pos = list.map((g) => g.attributes.position.array.slice());
    const geo = mergeGeos(list);
    const n = geo.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    let o = 0;
    counts.forEach((c, gi) => {
      const sp = specs[gi], P = pos[gi];
      for (let v = 0; v < c; v++, o++) {
        if (Array.isArray(sp)) {
          const y = P[v * 3 + 1], t = Math.max(0, Math.min(1, (y - sp[2]) / (sp[3] - sp[2]))), w = t * t * (3 - 2 * t);
          si[o * 4] = sp[0]; si[o * 4 + 1] = sp[1]; sw[o * 4] = 1 - w; sw[o * 4 + 1] = w;
        } else { si[o * 4] = sp; sw[o * 4] = 1; }
      }
    });
    geo.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new Float32BufferAttribute(sw, 4));
    geos[key] = geo; tris += geo.index.count / 3;
  }

  const hv = new Color(HIVIS);
  const mats = {
    hivis: makeMaterial('tarp', { tint: 0xffffff, rough: 1.25, scale: 0.22, normal: 0.7, weather: { preset: 'sheltered', dust: 0.35, edge: 0.3 } }),
    cloth: makeMaterial('tarp', { tint: 0xffffff, rough: 1.5, scale: 0.3, normal: 0.6, weather: { preset: 'sheltered', dust: 0.5 } }),
    // retro-reflective tape in daylight: a bright silver-grey with a tight sheen
    strip: new MeshStandardMaterial({ color: new Color(0.62, 0.64, 0.66), roughness: 0.34, metalness: 0.45 }),
    skin: new MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0 }),
  };
  // fluorescent pigment: a whisper of self-light so the jacket stays "fluoro" in shade (the hi-vis read at 30 m)
  mats.hivis.emissive.copy(hv).multiplyScalar(0.07); mats.hivis.emissiveIntensity = 1;
  for (const kk of ['hivis', 'cloth', 'skin']) mats[kk].vertexColors = true;
  for (const kk in mats) mats[kk].name = 'ranger:' + kk;
  return { geos, mats, tris };
}

// rounded box geometry (tagged with a bone by put())
function boxGeo(k, w, h, d, r) { return roundedBox(w, h, d, r, r >= 0.008 ? 2 : 1, 0.6); }

// instantiate a rig on shared geometry (cheap: the lineup inspection clones it)
export function makeFigure(F) {
  const group = new Group(); group.name = 'ranger:figure';
  const bones = {}, list = [];
  BONES.forEach(([name, parent, off], i) => {
    const b = new Bone(); b.name = name; b.position.fromArray(off);
    b.rotation.order = name === 'head' || name === 'spine' || name === 'hips' ? 'YXZ' : 'XYZ';
    b.userData.rest = new Vector3().fromArray(off);
    if (parent >= 0) list[parent].add(b);
    list.push(b); bones[name] = b;
  });
  group.add(list[0]);
  group.updateMatrixWorld(true);
  const skeleton = new Skeleton(list);
  const meshes = [];
  for (const key of ['hivis', 'cloth', 'strip', 'skin']) {
    const m = new SkinnedMesh(F.geos[key], F.mats[key]); m.name = 'ranger:' + key;
    m.castShadow = key === 'hivis' || key === 'cloth'; m.receiveShadow = true;
    group.add(m); m.bind(skeleton);
    m.boundingSphere = new Sphere(new Vector3(0, 0.85, 0), 1.25);   // covers walk / aim / crouch: no per-frame skinned bounds
    meshes.push(m);
  }
  return { group, bones, meshes, skeleton };
}

// pose parameters (all smoothed by the caller)
export function newPose() {
  return { ph: 0, walk: 0, aim: 0, tube: -0.5, cool: 0, crouch: 0, headYaw: 0, headPitch: 0, twist: 0, wave: 0 };
}

const lerp = (a, b, t) => a + (b - a) * t;
// standing (walk/aim/cool) blended toward drop-cover-hold by P.crouch. The right hand's pitch is solved so the
// blower tube (which hangs under the grip, tilted 0.05 rad nose-down) points at P.tube (world pitch, rad).
export function poseFigure(F, P) {
  const B = F.bones, cr = P.crouch, w = P.walk * (1 - cr), a = P.aim, k = P.cool * (1 - a);
  const s = Math.sin(P.ph), sR = Math.sin(P.ph + Math.PI);
  const kneeL = 0.06 + 0.78 * Math.max(0, Math.cos(P.ph + 0.35)), kneeR = 0.06 + 0.78 * Math.max(0, Math.cos(P.ph + Math.PI + 0.35));
  // hips + spine
  B.hips.position.y = lerp(0.96 - 0.028 * w * Math.abs(Math.cos(P.ph)), 0.47, cr);
  B.hips.position.z = lerp(0, 0.1, cr);
  B.hips.rotation.set(0, lerp(0.07 * w * s + P.twist * 0.4, 0, cr), 0);
  B.spine.rotation.set(lerp(-0.035 - 0.05 * w - 0.07 * a - 0.08 * k, -1.12, cr), lerp(-0.09 * w * s + P.twist * 0.6, 0, cr), 0);
  B.head.rotation.set(lerp(P.headPitch + 0.03 * w + 0.06 * a, -0.25, cr), lerp(P.headYaw - P.twist, 0, cr), 0);
  // legs
  const thL = 0.46 * w * s, thR = 0.46 * w * sR, knL = -w * kneeL - 0.04, knR = -w * kneeR - 0.04;
  B.thL.rotation.set(lerp(thL + 0.04 * a, 0.62, cr), 0, lerp(-0.03, -0.13, cr));
  B.thR.rotation.set(lerp(thR - 0.1 * a, 0.62, cr), 0, lerp(0.03, 0.13, cr));
  B.shL.rotation.set(lerp(knL, -2.2, cr), 0, 0);
  B.shR.rotation.set(lerp(knR, -2.2, cr), 0, 0);
  B.ftL.rotation.set(lerp(-(thL + knL) * 0.85 + 0.05, -1.5, cr), 0, 0);
  B.ftR.rotation.set(lerp(-(thR + knR) * 0.85 + 0.05, -1.5, cr), 0, 0);
  // left arm: swings when walking, hangs ready when aiming, hand on hip while the blower cools
  const uLx = -0.36 * w * s * (1 - a) + 0.14 * a + 0.12 * k, uLz = -0.07 - 0.06 * a - 0.5 * k;
  B.upL.rotation.set(lerp(uLx, 2.45, cr), 0, lerp(uLz, -0.5, cr));
  B.foL.rotation.set(lerp(0.22 + 0.2 * w + 0.3 * a + 1.2 * k, 1.95, cr), 0, lerp(0, 0.55, cr));
  B.haL.rotation.set(0, 0, 0);
  // right arm: carries the blower; elbow bends when aiming; the hand pitches the tube onto the target
  const uRx = 0.08 * w * sR + 0.06 + 0.3 * a - 0.05 * k, uRz = 0.2 + 0.04 * a, fRx = 0.3 + 0.42 * a + 0.1 * k;
  B.upR.rotation.set(lerp(uRx, 2.45, cr), 0, lerp(uRz, 0.5, cr));
  B.foR.rotation.set(lerp(fRx, 1.95, cr), 0, lerp(0, -0.55, cr));
  const sp = B.spine.rotation.x;
  B.haR.rotation.set(lerp(P.tube + 0.05 - (sp + uRx + fRx) + P.wave, 0, cr), 0, lerp(-uRz, 0, cr));
}
export { BI };
