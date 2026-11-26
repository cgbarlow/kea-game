// vans — the three stranded rental campervans (the things you protect), their tourists and their camp-outs.
//   create(G, { mats, colliders }) → { list: Van[], root, reset(), update, dispose }
//   Van = { id, name, group, pos, yaw, integrity 0..1, perches: Vector3[] (0 mirror, 1 wiper, 2-4 roof), doorPos,
//           damage(amount, kind), lastHit, lastKind, doorOpen, light }
//   emits 'van:damage' (van, amount, kind). kind containing 'possum' opens the habitation door (a possum got in).
//   Damage states are driven by integrity in the vertex shader (fx.js): wiper blades go (0.72 / 0.45), the windscreen
//   seal tears (0.6), the roof-hatch lid is pried off (0.4), the kerb mirror glass goes (0.3), scratches spread
//   (0.85 → 0.2); the hazard lights blink for 3 s after a hit and permanently under 0.25 (the van has given up).
//   Per van: 7 kit/decal meshes + 1 lights.js dome bulb = 8 draw calls; ~25-30 k tris. Allocation-free update.
//   showcase(G) → { cam, target }
import { Group, DoubleSide, Vector3, Box3, Mesh, Matrix4, Euler, Quaternion, Float32BufferAttribute } from 'three';
import { Kit, mergeGeos } from '../../cookbook/geo/kit.js';
import { makeMaterial } from '../../cookbook/materials/library.js';
import { decalGeo, decalMaterial } from '../../cookbook/decals/canvas-text.js';
import { patchAtmos } from '../../cookbook/lighting/atmos.js';
import { LAYOUT as L } from '../../contracts.js';
import { buildBody, DIM } from './body.js';
import { buildCab, buildRoof, buildProps } from './detail.js';
import { buildAtlas } from './livery.js';
import { vanUniforms, patchVan, glassMaterial, lensMaterial, depthMaterial, writeFx } from './fx.js';

const CFG = {
  A: { tint: 0xd4d4d0, rim: 0xb7b9bb, seat: 0x3a3c40, curtain: 0x6a5a3a, roof: 'solar', gear: 'pod', props: 'chairs', grime: 0.5, foot: 0.6,
    people: [{ x: 0.46, driver: true, pose: 'wheel', skin: 0xe0b89a, top: 0xa8382c, hair: 0xd2b878, long: true },
      { x: -0.46, pose: 'map', skin: 0xd8ae8c, top: 0x2f4a6a, hat: 'beanie', hatC: 0x56663a, hatC2: 0xd8571c, glasses: true, collar: 0xd8d0c0 }] },
  B: { tint: 0xd4d4d0, rim: 0x9a9c9e, seat: 0x2c2e32, curtain: 0x2f5d7c, roof: 'aircon', gear: 'bags', props: 'washing', grime: 0.5, foot: 0.62,
    people: [{ x: 0.46, driver: true, pose: 'wheel', skin: 0x4a3022, top: 0x3a5a3a, hair: 0x15110e, glasses: true },
      { x: -0.46, pose: 'phone', skin: 0x5a3a28, top: 0xd9a030, hat: 'wrap', hatC: 0x2f5d7c }] },
  C: { tint: 0xd4d4d0, rim: 0xc4c6c8, seat: 0x403a34, curtain: 0x7a2f2a, roof: 'vents', gear: 'kayak', props: 'gas', grime: 0.46, foot: 0.6,
    people: [{ x: 0.46, driver: true, pose: 'camera', skin: 0xd8b08a, top: 0x5a5c62, hat: 'bucket', hatC: 0x9c8548 }] },
};

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _p = new Vector3(), _s = new Vector3(1, 1, 1);

export function create(G, { mats, colliders = [] }) {
  const root = new Group(); root.name = 'vans';
  const atlas = buildAtlas(G, L.vans.map((v) => v.id));
  const lights = G.mods?.lights;
  const metal = makeMaterial('galvanised', { tint: 0xffffff, rough: 0.7 }); metal.vertexColors = true;
  const cab = makeMaterial('plastic', { tint: 0xffffff, weather: 'sheltered' }); cab.vertexColors = true;
  const cloth = makeMaterial('tarp', { tint: 0xffffff, rough: 1.6, scale: 0.35, normal: 0.6, weather: 'sheltered' }); // woven fabric, laundry
  cloth.vertexColors = true; cloth.side = DoubleSide; cloth.shadowSide = DoubleSide;
  const list = [];
  for (const d of L.vans) {
    const C = CFG[d.id] || CFG.A, U = vanUniforms(), flags = new Map();
    const T = (geo, x = 0, y = 0, z = 0, w = 0) => { flags.set(geo, [x, y, z, w]); return geo; };
    const k = new Kit(), kb = k.box.bind(k);
    k.box = (w, h, dd, key, o = {}) => kb(w, h, dd, key, o.seg == null && (Math.max(w, h, dd) < 0.8 || (o.r ?? 0.008) < 0.03) ? { ...o, seg: 1 } : o); // small/tight-radius parts: 1 bevel row
    buildBody(k, T, { paint: d.color, rim: C.rim });
    buildCab(k, T, C);
    buildRoof(k, T, C);
    const props = buildProps(k, T, C);
    k.bakeAO({ ground: 0, samples: 10, radius: 0.4, strength: 0.7 });
    k.grime({ base: 0, foot: C.foot, streak: C.grime, down: 0.3, dirt: [0.62, 0.55, 0.46], seed: d.id.charCodeAt(0) }, ['paint', 'dark', 'metal']);
    const paint = makeMaterial('painted_metal', { tint: C.tint, rough: 0.62 }); paint.vertexColors = true;
    const dark = makeMaterial('rubber', { tint: 0xffffff }); dark.vertexColors = true;
    const vm = { paint: patchVan(paint, U), dark: patchVan(dark, U), metal, cab: patchVan(cab.clone(), U), glass: glassMaterial(U), lens: lensMaterial(U), cloth, default: paint };
    const g = k.build(vm);
    writeFx(k, g, flags);
    const depth = depthMaterial(U);
    for (const m of g.children) {
      if (m.material === vm.glass) { m.castShadow = false; m.renderOrder = 3; }
      if (m.material === vm.paint || m.material === vm.dark || m.material === vm.cab) m.customDepthMaterial = depth;
    }
    const dm = buildDecals(atlas, d.id, U);
    g.add(dm);
    g.position.set(d.x, 0, d.z); g.rotation.y = d.yaw; g.name = 'van:' + d.id;
    g.updateMatrixWorld(true);
    root.add(g);
    U.uHinge.value.set(-(DIM.bodyW / 2 + 0.02), -DIM.door.f1);
    const drv = C.people.find((p) => p.driver); U.uHeadP.value.set(drv.x, 1.74, -1.55);

    const c = Math.cos(d.yaw), s = Math.sin(d.yaw);
    const local = (x, y, z, out = new Vector3()) => out.set(d.x + x * c + z * s, y, d.z - x * s + z * c);
    const box = (cx, cz, w, dd, h) => { // local axis-aligned footprint → world Box3 (yaw is small)
      const a = local(cx, 0, cz), hw = (Math.abs(w * c) + Math.abs(dd * s)) / 2, hd = (Math.abs(w * s) + Math.abs(dd * c)) / 2;
      colliders.push(new Box3(new Vector3(a.x - hw, 0, a.z - hd), new Vector3(a.x + hw, h, a.z + hd)));
    };
    box(0, -(DIM.nose + DIM.rear) / 2 + 0.03, DIM.bodyW + 0.1, DIM.nose - DIM.rear + 0.12, L.van.h);
    for (const p of props) box(...p);
    const light = lights?.add?.({ position: local(0, 1.985, -1.85).toArray(), kind: 'none', halo: false, pool: false, intensity: 2.6, range: 3.2, color: [1.0, 0.66, 0.36], groundY: 0 }) || null;
    const hw = DIM.bodyW / 2, df = (DIM.door.f0 + DIM.door.f1) / 2;
    const van = {
      id: d.id, name: d.name, group: g, pos: new Vector3(d.x, 0, d.z), yaw: d.yaw, integrity: 1, lastHit: -99, lastKind: '', doorOpen: false, light,
      perches: [local(-1.215, 1.885, -2.38), local(-0.3, 1.36, -2.6), local(-0.55, DIM.top + 0.01, -0.6), local(0.5, DIM.top + 0.01, 1.4), local(0.0, DIM.top + 0.01, -1.75)],
      doorPos: local(-(hw + 0.4), 0, -df),
      uniforms: U, headYaw: 0, look: new Vector3(),
      damage(amount, kind = '') {
        van.integrity = Math.max(0, van.integrity - amount); van.lastHit = G.t; van.lastKind = kind;
        if (String(kind).includes('possum')) van.doorOpen = true;
        G.emit('van:damage', van, amount, kind);
      },
    };
    list.push(van);
  }
  G.scene.add(root);
  // ?vandmg=0.2: preview damage states (integrity for every van, doors ajar below 0.5) for captures
  const qd = parseFloat(G.params?.get?.('vandmg'));
  if (qd >= 0 && qd <= 1) for (const v of list) { v.integrity = qd; v.doorOpen = qd < 0.5; v.uniforms.uDoorA.value = v.doorOpen ? -1.05 : 0; v.uniforms.uVInt.value = qd; }

  const cam = new Vector3();
  function update(dt, t) {
    cam.copy(G.camera.position);
    const kd = 1 - Math.exp(-dt * 4), kh = 1 - Math.exp(-dt * 2.5);
    for (let i = 0; i < list.length; i++) {
      const v = list[i], U = v.uniforms;
      U.uVInt.value = v.integrity;
      U.uDoorA.value += ((v.doorOpen ? -1.05 : 0) - U.uDoorA.value) * kd;
      const recent = t - v.lastHit < 3;
      U.uBlink.value = (recent || v.integrity < 0.25) && (t * 1.5) % 1 < 0.5 ? 1 : 0;
      // the driver watches the ranger when near, otherwise looks around at the scenery (and the kea)
      const dx = cam.x - v.pos.x, dz = cam.z - v.pos.z, cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
      const lx = dx * cy - dz * sy - U.uHeadP.value.x, lz = dx * sy + dz * cy - U.uHeadP.value.z;
      const near = dx * dx + dz * dz < 400;
      let target = near ? Math.atan2(-lx, -lz) : Math.sin(t * 0.31 + i * 2.1) * 0.7 + Math.sin(t * 0.83 + i) * 0.2;
      if (recent) target += Math.sin(t * 9) * 0.25;            // alarmed double-take
      target = Math.max(-1.25, Math.min(1.25, target));
      v.headYaw += (target - v.headYaw) * kh;
      U.uHeadA.value = v.headYaw;
    }
  }
  G.on('update', update);
  const reset = () => { for (const v of list) { v.integrity = 1; v.lastHit = -99; v.lastKind = ''; v.doorOpen = false; v.uniforms.uDoorA.value = 0; } };
  return { list, root, reset, update, selfUpdating: true, dispose() { G.off?.('update', update); G.scene.remove(root); } };
}

// rental livery, plates, stickers, contact shadow and integrity-gated scratches: one merged decal mesh per van
function buildDecals(atlas, id, U) {
  const hw = DIM.bodyW / 2, geos = [], fx = [];
  const put = (name, w, pos, rot, f = [0, 0, 0, 0], h = null) => {
    const g = decalGeo(atlas, name, w, h);
    _e.set(rot[0], rot[1], rot[2], 'YXZ'); _q.setFromEuler(_e); _p.fromArray(pos);
    g.applyMatrix4(_m.compose(_p, _q, _s)); geos.push(g); fx.push(f);
  };
  const R = [0, Math.PI / 2, 0], Lr = [0, -Math.PI / 2, 0], B = [0, Math.PI, 0], F = [0, 0, 0], UP = [-Math.PI / 2, 0, 0];
  put('shadow', DIM.bodyW + 0.7, [0, 0.008, 0.02], UP, undefined, DIM.nose - DIM.rear + 0.8);
  put('sideR' + id, 4.3, [hw + 0.004, 1.35, 0.95], R);
  put('sideL' + id, 4.3, [-(hw + 0.004), 1.35, 0.95], Lr);
  put('brand', 1.1, [hw + 0.005, 1.14, 1.45], R);
  put('brand', 1.25, [-(hw + 0.005), 1.2, 1.2], Lr);
  put('berth' + id, 0.95, [hw + 0.005, 2.2, -1.62], R);
  put('plate' + id, 0.37, [0, 0.5, -3.312], B);
  put('plate' + id, 0.37, [0, 0.8, -DIM.rear + 0.004], F);
  put('lookout', 0.7, [0.42, 1.45, -DIM.rear + 0.004], F);
  put('call', 0.62, [-0.45, 1.28, -DIM.rear + 0.004], F);
  put('keep', 0.32, [-0.4, 1.83, -DIM.rear + 0.03], F);
  put('insure', 0.6, [-(hw + 0.005), 1.3, 0.08], Lr);
  put('gas', 0.14, [hw + 0.02, 1.0, -0.65], R);
  put('roof', 0.34, [0.0, DIM.top + 0.004, 0.0], UP);
  put('door', 0.32, [-(hw + 0.04), 1.55, -(DIM.door.f0 + DIM.door.f1) / 2], Lr, [0, 1, 0, 0]);
  // WOF label inside the windscreen, kerb-side bottom corner (plane of the glass, facing out)
  const [f0, y0] = DIM.ws0, [f1, y1] = DIM.ws1, th = Math.atan2(f0 - f1, y1 - y0), ly = -0.3, lz = 0.006;
  put('wof', 0.08, [-0.72, (y0 + y1) / 2 + ly * Math.cos(th) - lz * Math.sin(th), -(f0 + f1) / 2 + ly * Math.sin(th) + lz * Math.cos(th)], [-th, Math.PI, 0]);
  // scratches: kea beak gouges up high, possum rakes low by the door
  put('scr0', 1.2, [hw + 0.006, 1.05, 1.4], R, [-0.85, 0, 0, 0]);
  put('scr1', 1.0, [-(hw + 0.006), 0.95, 0.4], Lr, [-0.65, 0, 0, 0]);
  put('scr2', 0.8, [-(DIM.cabW / 2 + 0.006), 1.05, -1.9], Lr, [-0.5, 0, 0, 0]);
  put('scr3', 1.3, [hw + 0.006, 2.45, -0.5], R, [-0.35, 0, 0, 0]);
  put('scr1', 1.2, [-(hw + 0.006), 2.3, 2.2], Lr, [-0.2, 0, 0, 0]);
  put('scr3', 0.7, [0.3, 1.158, -2.85], [-1.8, 0, 0], [-0.3, 0, 0, 0]);
  const counts = geos.map((g) => g.attributes.position.count), geo = mergeGeos(geos), a = new Float32Array(geo.attributes.position.count * 4);
  let o = 0; counts.forEach((c, i) => { for (let j = 0; j < c; j++) a.set(fx[i], (o + j) * 4); o += c; });
  geo.setAttribute('aFx', new Float32BufferAttribute(a, 4));
  const mat = decalMaterial(atlas.texture, { roughness: 0.5, key: 'van' + id });
  patchAtmos(mat); patchVan(mat, U);
  const m = new Mesh(geo, mat); m.name = 'van:decals'; m.renderOrder = 2; m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false;
  return m;
}

// hero framing: front three-quarter from the kerb, the three vans staggered in depth (C near, B mid, A far).
// The ranger's blower is holstered for this shot so it never covers the vans (showcase only, not gameplay).
export function showcase(G) {
  const b = G?.mods?.blower;
  if (b) { b.enabled = false; b.forceFire = false; if (b.model) b.model.visible = false; }
  return { cam: [-15.5, 1.7, -5.5], target: [1.5, 1.35, 5.5] };
}
