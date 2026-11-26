// blower/stickers — the departmental decals on the ranger-issue blower (canvas 2D, worn, one atlas, one material).
// buildStickers(G) → { atlas, material, place(k, name, w, at, rot, wrapR) } — `place` writes a decal quad into a Kit
// under key 'decal' (optionally wrapped round a cylinder of radius wrapR whose axis is the quad's local X).
import { PlaneGeometry, Matrix4 } from 'three';
const _m = new Matrix4();
import { DecalAtlas, signCanvas, decalMaterial } from '../../cookbook/decals/canvas-text.js';

const PPM = 2600; // stickers are read at 0.4-0.9 m: print them like it

export function buildStickers(G) {
  const atlas = new DecalAtlas(2048, 6);
  const plate = (w, h, bg, fg, lines, o = {}) => signCanvas({ w, h, ppm: PPM, bg, fg, border: fg, borderW: 0.0016, radius: 0.004, rivets: false, wear: o.wear ?? 0.35, dirt: o.dirt ?? 0.45, lines, stripes: o.stripes || false, seed: o.seed });
  atlas.add('issue', plate(0.11, 0.05, '#1f4a37', '#efe8d4', [
    { text: 'DEPT. OF PASS CONSERVATION', size: 0.17, color: '#efe8d4' },
    { text: 'RANGER ISSUE', size: 0.34, color: '#f2c79a' },
    { text: 'ASSET 0417 · NOT FOR PERSONAL LAWNS', size: 0.13, color: '#d9dfe6' },
  ]));
  atlas.add('kea', plate(0.13, 0.026, '#e3b52a', '#16181a', [
    { text: 'DO NOT POINT AT KEA. POINT NEAR KEA.', size: 0.5, color: '#16181a' },
  ], { wear: 0.5 }));
  atlas.add('mix', plate(0.05, 0.022, '#16181a', '#e3b52a', [
    { text: 'FUEL 50:1', size: 0.42, color: '#e3b52a' }, { text: 'NO EXCEPTIONS', size: 0.22, color: '#d9dfe6' },
  ]));
  atlas.add('ears', plate(0.07, 0.03, '#2a5a8a', '#efe8d4', [
    { text: 'EAR PROTECTION', size: 0.32, color: '#efe8d4' }, { text: 'REQUIRED. KEA EXEMPT.', size: 0.24, color: '#efe8d4' },
  ]));
  atlas.add('serial', plate(0.06, 0.03, '#232527', '#c8c4b8', [
    { text: 'MODEL DPC-73 HANDHELD', size: 0.2, color: '#d6d2c6' }, { text: 'OUTPUT 74 M/S (NOMINAL)', size: 0.2, color: '#d6d2c6' },
    { text: 'LAST SERVICED: YES', size: 0.2, color: '#e3b52a' },
  ], { wear: 0.4 }));
  atlas.add('hot', plate(0.045, 0.02, '#c0501e', '#16181a', [{ text: 'HOT', size: 0.45, color: '#16181a' }, { text: 'ALSO, OBVIOUSLY', size: 0.22, color: '#16181a' }], { wear: 0.6 }));
  atlas.finish(G.renderer);
  const material = decalMaterial(atlas.texture, { roughness: 0.5, metalness: 0, key: 'blower' });
  material.userData.noAtmos = true;

  // a decal quad (plane facing +Z) mapped to the atlas rect; with wrapR it bends round a cylinder (axis = local X, the long side)
  function geo(name, w, wrapR = 0) {
    const r = atlas.uv(name), h = w / r.aspect;
    const g = new PlaneGeometry(w, h, 1, wrapR ? 12 : 1), uv = g.attributes.uv.array, P = g.attributes.position.array;
    for (let i = 0; i < uv.length; i += 2) { uv[i] = r.u0 + uv[i] * (r.u1 - r.u0); uv[i + 1] = r.v0 + uv[i + 1] * (r.v1 - r.v0); }
    if (wrapR) for (let i = 0; i < P.length; i += 3) { const a = P[i + 1] / wrapR; P[i + 1] = Math.sin(a) * wrapR; P[i + 2] = Math.cos(a) * wrapR - wrapR; }
    g.computeVertexNormals();
    return g;
  }
  function place(k, name, w, at, rot = [0, 0, 0], wrapR = 0) { k.add(geo(name, w, wrapR), 'decal', { at, rot, occ: false }); }
  // on a tube whose axis is local Z (current Kit frame): long side along the axis, centred at z, facing angle phi
  function onTube(k, name, w, z, phi, R) {
    const g = geo(name, w, R + 0.0008);
    g.applyMatrix4(_m.makeRotationY(Math.PI / 2)); g.applyMatrix4(_m.makeRotationZ(phi));
    g.translate(Math.cos(phi) * (R + 0.0008), Math.sin(phi) * (R + 0.0008), z);
    k.add(g, 'decal', { occ: false });
  }
  return { atlas, material, place, onTube };
}
