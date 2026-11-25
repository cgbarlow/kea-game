// carpark/signs — dry official signage (the humour lives here and in the HUD). Canvas-2D plates (decals/canvas-text.js)
// on bevelled posts. buildSigns(G, root, colliders) → [{ name, pos, rotY, w }]
import { Box3, Vector3 } from 'three';
import { DecalAtlas, signCanvas, decalMesh } from '../../cookbook/decals/canvas-text.js';
import { patchAtmos } from '../../cookbook/lighting/atmos.js';
import { Kit } from '../../cookbook/geo/kit.js';

const GREEN = '#1f4a37', CREAM = '#efe8d4', YELLOW = '#e6b422', BLACK = '#16181a', RED = '#9a1e14';

// [name, canvas opts, world pos of plate centre, rotY (plate faces +Z rotated), width m]
const SIGNS = [
  ['kea', { w: 1.5, h: 1.0, bg: GREEN, fg: CREAM, border: CREAM, lines: [
    { text: 'DO NOT FEED THE KEA', size: 0.2 }, { text: 'They are not hungry.', size: 0.11 }, { text: 'They are curious. This is worse.', size: 0.1 }] },
    [-6, 2.0, -11.5], 0.25, 1.5],
  ['closed', { w: 2.4, h: 1.2, bg: CREAM, fg: BLACK, border: RED, stripes: true, lines: [
    { text: 'SH73 CLOSED', size: 0.24, color: RED }, { text: 'Estimated reopening: when it reopens', size: 0.1 }] },
    [28.5, 2.2, -14.6], -1.2, 2.4],
  ['quake', { w: 1.6, h: 1.1, bg: YELLOW, fg: BLACK, border: BLACK, lines: [
    { text: 'AFTERSHOCK SEASON', size: 0.17 }, { text: 'IS NOW OPEN', size: 0.14 }, { text: 'Drop. Cover. Hold. In that order.', size: 0.09 }] },
    [14, 2.0, -11.5], -0.2, 1.6],
  ['possum', { w: 1.4, h: 0.9, bg: CREAM, fg: BLACK, border: GREEN, lines: [
    { text: 'POSSUM CONTROL', size: 0.18, color: GREEN }, { text: 'IN PROGRESS', size: 0.13 }, { text: 'Please do not assist the possums.', size: 0.09 }] },
    [0, 1.5, 17.0], Math.PI, 1.4],
  ['parking', { w: 1.2, h: 0.9, bg: '#2a4f8a', fg: CREAM, border: CREAM, lines: [
    { text: 'P', size: 0.36 }, { text: 'CAMPERVANS', size: 0.12 }, { text: 'Max stay: until further notice', size: 0.075 }] },
    [-20, 2.2, 0.5], Math.PI / 2, 1.2],
  ['here', { w: 2.4, h: 1.0, bg: CREAM, fg: BLACK, border: GREEN, rivets: false, lines: [
    { text: 'YOU ARE HERE', size: 0.2, color: GREEN }, { text: '(Unfortunately.)', size: 0.11 }, { text: 'Department of Pass Conservation', size: 0.08 }] },
    [-26.84, 1.6, -6], Math.PI / 2, 2.4],
];

export function buildSigns(G, root, colliders) {
  const atlas = new DecalAtlas(2048);
  for (const [name, o] of SIGNS) atlas.add(name, signCanvas({ ppm: 300, wear: 0.3, dirt: 0.3, ...o }));
  atlas.finish(G.renderer);
  const k = new Kit(), out = [];
  for (const [name, o, pos, rotY, w] of SIGNS) {
    const h = o.h * (w / o.w);
    const free = name !== 'here';                                  // 'here' hangs on the shelter wall
    k.push(pos[0], 0, pos[2], rotY);
    k.box(w + 0.06, h + 0.06, 0.03, 'steel', { at: [0, pos[1], -0.02], r: 0.006 });
    if (free) for (const s of [-1, 1]) k.box(0.07, pos[1] + h / 2, 0.07, 'steel', { at: [s * (w / 2 - 0.15), (pos[1] + h / 2) / 2, -0.06], r: 0.008 });
    k.pop();
    if (free) colliders.push(new Box3(new Vector3(pos[0] - 0.2, 0, pos[2] - 0.2), new Vector3(pos[0] + 0.2, pos[1], pos[2] + 0.2)));
    out.push({ name, pos, rotY, w });
  }
  k.bakeAO({ ground: 0 });
  root.add(k.build({ steel: G.mats?.steel, default: G.mats?.steel }));
  let mat = null;
  for (const s of out) {
    const m = decalMeshFrom(atlas, s, mat);
    root.add(m); mat = m.material;
  }
  if (mat) patchAtmos(mat);
  return out;
}

function decalMeshFrom(atlas, s, material) {
  const m = decalMesh(atlas, s.name, s.w, null, material ? { material } : {});
  m.position.set(s.pos[0] + Math.sin(s.rotY) * 0.003, s.pos[1], s.pos[2] + Math.cos(s.rotY) * 0.003);
  m.rotation.y = s.rotY;
  return m;
}
