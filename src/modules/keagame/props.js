// keagame/props — the kea stash on the north scree and the Department's road cone by the ROAD CLOSED gate.
//   buildProps(G, { terrain }) → { group, stash:{ group, add(kind) → bool, reset(), count, top, centre }, cone:{ mesh },
//                                  ledge: Box3, materials }
// Draw calls (main pass): ledge rock 1 + pile rubber 1 + pile plastic 1 + notice decal 1 + gate cone 1 = 5.
// The pile is two preallocated merged buffers (rubber, plastic). Banking a part copies a pre-transformed variant
// (slot × kind) into the next free range and extends drawRange: no allocation, no new draw call, any order of kinds.
// Always-present geometry (the notice post + board, scree chips) sits at the start of each buffer.
import { Group, Mesh, BufferGeometry, BufferAttribute, DynamicDrawUsage, Matrix4, Vector3, Quaternion, Euler, Sphere, Box3, Color } from 'three';
import { Kit, lathe, roundedBox, tube, sweep, mergeGeos, normalizeGeo } from '../../cookbook/geo/kit.js';
import { rockGeo } from '../../cookbook/geo/scatter.js';
import { rngFrom, fbm3 } from '../../cookbook/geo/noise.js';
import { makeMaterial } from '../../cookbook/materials/library.js';
import { DecalAtlas, signCanvas, decalMesh, decalGeo } from '../../cookbook/decals/canvas-text.js';
import { LAYOUT as L, SEED } from '../../contracts.js';

export const KINDS = ['wiper', 'seal', 'mirror', 'strap'];
const SLOTS = 12;                               // 9 quota + a few over-achievers
const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _p = new Vector3(), _s = new Vector3(1, 1, 1);
const colorize = (g, hex) => { normalizeGeo(g); const c = new Color(hex), a = g.attributes.color.array; for (let i = 0; i < a.length; i += 3) { a[i] *= c.r; a[i + 1] *= c.g; a[i + 2] *= c.b; } return g; };
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); g.applyMatrix4(_m.compose(_p, _q, _s)); return g; };

// ---- part geometry, local space (lying flat, bottom at y = 0, centred) → { rubber: [geo], plastic: [geo] } ----
function partGeos(kind, rng) {
  const R = [], P = [];
  if (kind === 'wiper') {             // blade + steel frame with its yokes, slightly bent (it was pulled)
    const len = 0.58 + rng() * 0.08, bend = 0.05;
    for (let i = 0; i < 4; i++) {
      const x0 = -len / 2 + (i / 4) * len, x1 = x0 + len / 4, y = 0.006, b0 = bend * Math.sin((x0 / len + 0.5) * Math.PI), b1 = bend * Math.sin((x1 / len + 0.5) * Math.PI);
      const seg = colorize(roundedBox(len / 4 + 0.004, 0.012, 0.009, 0.003, 1), 0x141414); at(seg, (x0 + x1) / 2, y, (b0 + b1) / 2, 0, -Math.atan2(b1 - b0, x1 - x0), 0); R.push(seg);
    }
    const fr = colorize(roundedBox(len * 0.84, 0.014, 0.016, 0.004, 1), 0x3c3f44); at(fr, 0, 0.018, bend * 0.9, 0, 0, 0); R.push(fr);
    for (const x of [-0.16, 0, 0.16]) { const y = colorize(roundedBox(0.05, 0.02, 0.02, 0.004, 1), 0x2e3034); at(y, x * len * 1.6, 0.02, bend * (1 - Math.abs(x) * 2), 0, 0, 0); R.push(y); }
    const hook = colorize(roundedBox(0.07, 0.016, 0.022, 0.006, 1), 0x2a2c30); at(hook, 0.02, 0.034, bend * 0.95, 0, 0.3, 0); R.push(hook);
  } else if (kind === 'seal') {       // a door seal: a hollow black bulb strip in loose loops
    const pts = []; const n = 9, r0 = 0.12 + rng() * 0.05;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2.6, r = r0 * (0.7 + 0.3 * Math.cos(i * 1.7)); pts.push([Math.cos(a) * r + i * 0.025, 0.012 + 0.008 * Math.sin(i * 2.1) + i * 0.0035, Math.sin(a) * r * 0.8]); }
    R.push(colorize(tube(pts, 0.014, { radial: 7, curve: true, samples: 40 }), 0x101010));
    const lip = pts.map((p) => [p[0], p[1] + 0.009, p[2]]);
    R.push(colorize(tube(lip, 0.005, { radial: 5, curve: true, samples: 40 }), 0x1a1a1a));
  } else if (kind === 'mirror') {     // kerb mirror: black housing + glass, the stalk torn off, lying on its back
    const h = colorize(roundedBox(0.24, 0.07, 0.17, 0.03, 2, 0.6), 0x1b1c1e); at(h, 0, 0.035, 0); P.push(h);
    const gl = colorize(roundedBox(0.205, 0.006, 0.135, 0.004, 1), 0xc8d6e0); at(gl, 0, 0.071, 0); P.push(gl);
    const st = colorize(roundedBox(0.05, 0.035, 0.06, 0.008, 1), 0x252629); at(st, 0.13, 0.03, -0.03, 0, 0.4, 0.2); P.push(st);
    const bolt = colorize(roundedBox(0.018, 0.018, 0.018, 0.003, 1), 0x8a8f96); at(bolt, 0.158, 0.04, -0.045); P.push(bolt);
  } else {                            // roof-pod strap: yellow or blue webbing with a cam buckle, in coils
    const col = rng() < 0.55 ? 0xe0a81c : 0x2f78b4, prof = [[-0.022, -0.002], [0.022, -0.002], [0.022, 0.002], [-0.022, 0.002]];
    const pts = []; const n = 10;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 3.2, r = 0.09 + i * 0.012; pts.push([Math.cos(a) * r, 0.006 + i * 0.0022, Math.sin(a) * r * 0.75]); }
    P.push(colorize(sweep(prof, pts, { curve: true, samples: 60, smooth: true }), col));
    const tail = [[pts[n][0], pts[n][1], pts[n][2]], [pts[n][0] + 0.12, 0.004, pts[n][2] + 0.05], [pts[n][0] + 0.26, 0.003, pts[n][2] + 0.02]];
    P.push(colorize(sweep(prof, tail, { curve: true, samples: 12, smooth: true }), col));
    const bk = colorize(roundedBox(0.05, 0.016, 0.034, 0.005, 1), 0x9a9ea4); at(bk, tail[1][0], 0.01, tail[1][2], 0, 0.3, 0); R.push(bk);
  }
  return { rubber: R, plastic: P };
}

// the Department's road cone (taller than the car-park ones: it has a job), base on y = 0
function coneGeos() {
  const body = lathe([[0, 0.05], [0.142, 0.05], [0.136, 0.07], [0.034, 0.74], [0.032, 0.752], [0, 0.752]].reverse(), { seg: 22, crease: 40 });
  const collar = (y0, y1, r0, r1) => lathe([[r0 + 0.006, y0], [r0, y0 + 0.004], [r1, y1 - 0.004], [r1 + 0.006, y1]].reverse(), { seg: 22, crease: 40 });
  const base = roundedBox(0.4, 0.05, 0.4, 0.014, 2); at(base, 0, 0.025, 0);
  return [colorize(body, 0xd8521a), colorize(collar(0.42, 0.5, 0.093, 0.079), 0xeae6dc), colorize(collar(0.56, 0.62, 0.069, 0.059), 0xeae6dc), colorize(base, 0x1a1a1a)];
}

// typed-array snapshot of a merged geometry (for copying into the pile buffers)
const snap = (geos) => {
  if (!geos.length) return null;
  const g = mergeGeos(geos);
  return { p: g.attributes.position.array, n: g.attributes.normal.array, uv: g.attributes.uv.array, c: g.attributes.color.array, i: g.index.array, nv: g.attributes.position.count };
};

// a growable-in-place merged buffer: base geometry first, then variants copied in on demand
function pileBuffer(name, material, base, maxV, maxI, centre) {
  const g = new BufferGeometry();
  const mk = (n, k) => { const a = new BufferAttribute(new Float32Array(n * k), k); a.setUsage(DynamicDrawUsage); return a; };
  g.setAttribute('position', mk(maxV, 3)); g.setAttribute('normal', mk(maxV, 3)); g.setAttribute('uv', mk(maxV, 2)); g.setAttribute('color', mk(maxV, 3));
  const ix = new BufferAttribute(new Uint32Array(maxI), 1); ix.setUsage(DynamicDrawUsage); g.setIndex(ix);
  g.boundingSphere = new Sphere(centre.clone(), 2.2); g.boundingBox = new Box3().setFromCenterAndSize(centre, new Vector3(4.4, 4.4, 4.4));
  const mesh = new Mesh(g, material); mesh.name = 'keagame:' + name; mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
  const B = { mesh, v: 0, i: 0, baseV: 0, baseI: 0 };
  B.write = (s) => {
    if (!s || B.v + s.nv > maxV || B.i + s.i.length > maxI) return;
    const A = g.attributes;
    A.position.array.set(s.p, B.v * 3); A.normal.array.set(s.n, B.v * 3); A.uv.array.set(s.uv, B.v * 2); A.color.array.set(s.c, B.v * 3);
    const I = ix.array, o = B.v; for (let k = 0; k < s.i.length; k++) I[B.i + k] = s.i[k] + o;
    B.v += s.nv; B.i += s.i.length;
    A.position.needsUpdate = A.normal.needsUpdate = A.uv.needsUpdate = A.color.needsUpdate = true; ix.needsUpdate = true;
    g.setDrawRange(0, B.i);
  };
  B.reset = () => { B.v = B.baseV; B.i = B.baseI; g.setDrawRange(0, B.i); };
  if (base) B.write(base);
  B.baseV = B.v; B.baseI = B.i;
  return B;
}

export function buildProps(G, { terrain }) {
  const rng = rngFrom(SEED + 917);
  const hAt = (x, z) => (terrain && terrain.heightAt ? terrain.heightAt(x, z) : 0);
  const group = new Group(); group.name = 'keagame';
  const sx = L.stash[0], sz = L.stash[2];
  const sy = terrain && terrain.heightAt ? hAt(sx, sz) : L.stash[1];
  const top = sy + 0.1;                               // ledge top: just proud of the scree at the anchor
  const cx = sx - 0.12, cz = sz + 0.12;               // pile centre (the bluff rises to the east)
  const centre = new Vector3(cx, top, cz);

  const plastic = makeMaterial('plastic', { tint: 0xffffff }); plastic.vertexColors = true;
  const rubber = G.mats?.rubber || makeMaterial('rubber'); rubber.vertexColors = true;
  const rock = G.mats?.rock || makeMaterial('rock', { triplanar: true }); rock.vertexColors = true;

  // ---- the ledge: a flat-topped slab of greywacke jutting from the scree, and loose chips ----
  const k = new Kit();
  const slab = rockGeo({ seed: 41, radius: 1.35, detail: 3, cuts: 5, squash: 0.42, noise: 0.22, base: 0.6 });
  { // flatten the top into a bench (a few mm of relief so it still catches the sun like rock)
    const P = slab.attributes.position.array;
    let ymax = -1e9; for (let i = 1; i < P.length; i += 3) ymax = Math.max(ymax, P[i]);
    const cut = ymax * 0.78;
    for (let i = 0; i < P.length; i += 3) { P[i] *= 1.15; P[i + 2] *= 0.85; if (P[i + 1] > cut) P[i + 1] = cut + 0.012 * fbm3(P[i] * 4, 0, P[i + 2] * 4, 2, 7); }
    slab.computeVertexNormals();
    slab.computeBoundingBox();
    const yTop = cut; k.add(slab, 'rock', { at: [sx - 0.25, top - yTop, sz - 0.05], rot: [0, 0.35, 0], color: 0xc4beb4 });
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39996 + 0.4, d = 1.35 + rng() * 0.9, x = sx + Math.cos(a) * d, z = sz + Math.sin(a) * d * 0.8, r = 0.12 + rng() * 0.2;
    k.add(rockGeo({ seed: 60 + i, radius: r, detail: 2, squash: 0.6 }), 'rock', { at: [x, hAt(x, z) - r * 0.2, z], rot: [0, rng() * 6.3, 0], color: 0x958f86 });
  }
  const rockGrp = k.build({ rock });
  for (const m of rockGrp.children) { m.name = 'keagame:ledge'; m.updateMatrix(); }
  group.add(rockGrp);

  // ---- always-present plastic: the Department's notice on a post at the west end of the ledge ----
  const signYaw = 0.35;                                  // faces down the scree toward the car park (double-sided)
  const sxp = sx - 1.0, szp = sz - 0.05, postH = 0.95;
  const baseP = [];
  const post = colorize(roundedBox(0.06, postH + 0.3, 0.06, 0.008, 1), 0x9a8262); at(post, sxp, top + postH / 2 - 0.15, szp, 0, signYaw, 0); baseP.push(post);
  const board = colorize(roundedBox(0.66, 0.44, 0.025, 0.01, 2), 0x1f4a37);
  const bc = Math.cos(signYaw), bs = Math.sin(signYaw), off = 0.045;
  at(board, sxp + bs * off, top + postH - 0.08, szp + bc * off, 0, signYaw, 0); baseP.push(board);
  const pBase = snap(baseP);
  // always-present rubber: an old campervan tyre lying flat, the heap's foundation (previously held for research)
  const tyreProf = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2; tyreProf.push([0.3 + Math.cos(a) * 0.085 * 1.05, 0.085 + Math.sin(a) * 0.085]); }
  const tyre = colorize(lathe(tyreProf.reverse(), { seg: 28, crease: 70 }), 0x1c1c1c); at(tyre, cx, top - 0.004, cz, 0.04, 0, 0.03);
  const rBase = snap([tyre]);

  // ---- slot layout: a loose heap spiralling out from the centre, later items higher ----
  // tiers: an outer ring on the rock, a middle ring leaning in on it, a crown on top
  const slots = [];
  for (let i = 0; i < SLOTS; i++) {
    const tier = i < 5 ? 0 : i < 9 ? 1 : 2, j = tier === 0 ? i : tier === 1 ? i - 5 : i - 9, n = tier === 0 ? 5 : tier === 1 ? 4 : 3;
    const a = (j / n) * 6.283 + tier * 0.9 + (rng() - 0.5) * 0.4, r = [0.34, 0.12, 0.2][tier] + (rng() - 0.5) * 0.05;
    const lean = [0.12, 0.08, 0.35][tier];
    slots.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r * 0.85, y: top + [0.17, 0.05, 0.2][tier], ry: rng() * 6.283,
      rx: Math.sin(a) * lean + (rng() - 0.5) * 0.1, rz: -Math.cos(a) * lean + (rng() - 0.5) * 0.1 });
  }
  // variants: every slot × every kind, pre-transformed (boot-time only)
  const variants = slots.map((s, si) => {
    const out = {};
    for (const kind of KINDS) {
      const g = partGeos(kind, rngFrom(SEED + si * 31 + kind.length));
      for (const arr of [g.rubber, g.plastic]) for (const x of arr) { x.scale(1.25, 1.25, 1.25); at(x, s.x, s.y, s.z, s.rx, s.ry, s.rz); }
      out[kind] = { rubber: snap(g.rubber), plastic: snap(g.plastic) };
    }
    return out;
  });
  // the banked cone: upright on top of the heap, leaning a little (it has been through something)
  const coneAt = (lift) => { const g = coneGeos(); for (const x of g) at(x, cx - 0.02, top + lift, cz - 0.03, 0.08, 0.4, -0.06); return snap(g); };
  const coneLow = coneAt(0.09), coneHigh = coneAt(0.12);

  let maxRV = rBase.nv, maxRI = rBase.i.length, maxPV = pBase.nv + coneHigh.nv, maxPI = pBase.i.length + coneHigh.i.length;
  for (const v of variants) {
    let rv = 0, ri = 0, pv = 0, pi = 0;
    for (const kind of KINDS) { const a = v[kind]; if (a.rubber) { rv = Math.max(rv, a.rubber.nv); ri = Math.max(ri, a.rubber.i.length); } if (a.plastic) { pv = Math.max(pv, a.plastic.nv); pi = Math.max(pi, a.plastic.i.length); } }
    maxRV += rv; maxRI += ri; maxPV += pv; maxPI += pi;
  }
  const bufR = pileBuffer('pileRubber', rubber, rBase, maxRV, maxRI, centre);
  const bufP = pileBuffer('pilePlastic', plastic, pBase, maxPV, maxPI, centre);
  group.add(bufR.mesh, bufP.mesh);

  // ---- notice decal (the board's face) ----
  const atlas = new DecalAtlas(512, 4);
  atlas.add('keaNotice', signCanvas({ w: 0.62, h: 0.4, ppm: 640, bg: '#1f4a37', fg: '#efe8d4', border: '#efe8d4', borderW: 0.012, rivets: false, wear: 0.22, dirt: 0.3, radius: 0.012,
    lines: [{ text: 'NOTICE TO KEA', size: 0.2 }, { text: 'THIS IS NOT A STASH', size: 0.15 }, { text: 'Items left here will be held for research.', size: 0.085 },
      { text: 'Department of Pass Conservation', size: 0.075 }] }));
  atlas.finish(G.renderer);
  const notice = decalMesh(atlas, 'keaNotice', 0.62, 0.4, { roughness: 0.55, key: 'keaNotice' });
  { // both faces of the board in one geometry (one draw): the car park side and the scree side
    const f = decalGeo(atlas, 'keaNotice', 0.62, 0.4), b = decalGeo(atlas, 'keaNotice', 0.62, 0.4);
    f.translate(0, 0, 0.0135); b.rotateY(Math.PI); b.translate(0, 0, -0.0135);
    notice.geometry.dispose(); notice.geometry = mergeGeos([f, b]);
  }
  notice.position.set(sxp + bs * off, top + postH - 0.08, szp + bc * off); notice.rotation.y = signYaw;
  notice.updateMatrix(); notice.matrixAutoUpdate = false;
  group.add(notice);

  // ---- the gate cone (its own mesh: it is hidden while carried or banked) ----
  const cg = mergeGeos(coneGeos());
  const coneMesh = new Mesh(cg, plastic); coneMesh.name = 'keagame:cone'; coneMesh.castShadow = true; coneMesh.receiveShadow = true;
  coneMesh.position.set(L.cone[0], L.cone[1], L.cone[2]); coneMesh.rotation.y = 0.3; coneMesh.updateMatrix(); coneMesh.matrixAutoUpdate = false;
  group.add(coneMesh);

  const stash = { group, centre, top, count: 0, cone: false, capacity: SLOTS };
  stash.add = (kind) => {
    const coneSnap = stash.count >= 5 ? coneHigh : coneLow;
    if (kind === 'cone') { if (stash.cone) return false; stash.cone = true; bufP.write(coneSnap); return true; }
    if (stash.count >= SLOTS) return false;
    const v = variants[stash.count][KINDS.indexOf(kind) >= 0 ? kind : 'seal'];
    if (stash.cone) { // keep the cone on top: rewrite it after the new part
      bufP.reset(); stash.cone = false; for (let i = 0; i < stash.count; i++) bufP.write(variants[i][stash.kinds[i]].plastic);
      stash.kinds[stash.count] = KINDS.indexOf(kind) >= 0 ? kind : 'seal'; bufR.write(v.rubber); bufP.write(v.plastic);
      stash.count++; stash.cone = true; bufP.write(stash.count >= 5 ? coneHigh : coneLow); return true;
    }
    stash.kinds[stash.count] = KINDS.indexOf(kind) >= 0 ? kind : 'seal';
    bufR.write(v.rubber); bufP.write(v.plastic); stash.count++; return true;
  };
  stash.kinds = new Array(SLOTS).fill('seal');
  stash.reset = () => { stash.count = 0; stash.cone = false; bufR.reset(); bufP.reset(); };

  const ledge = new Box3(new Vector3(sx - 1.4, top - 0.6, sz - 0.9), new Vector3(sx + 0.9, top, sz + 0.75));
  return { group, stash, cone: { mesh: coneMesh }, ledge, materials: [plastic, rubber, rock, notice.material] };
}
