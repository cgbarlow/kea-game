// carpark/decals — batches many decal placements from one DecalAtlas into ONE merged mesh per group
// (one draw call for all the signs, one for everything painted on the ground, one for the shelter interior).
import { Matrix4, Euler, Quaternion, Vector3, Mesh } from 'three';
import { DecalAtlas, decalGeo, decalMaterial } from '../../cookbook/decals/canvas-text.js';
import { mergeGeos } from '../../cookbook/geo/kit.js';
import { patchAtmos } from '../../cookbook/lighting/atmos.js';

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _p = new Vector3(), _s = new Vector3(1, 1, 1);

export class DecalBatch {
  constructor(size = 2048) { this.atlas = new DecalAtlas(size); this.names = new Set(); this.list = []; }
  has(name) { return this.names.has(name); }
  add(name, cv) { if (!this.names.has(name)) { this.atlas.add(name, cv); this.names.add(name); } return this; }
  // Plane facing +Z, w × h metres (h null = from the canvas aspect), rotated by Euler YXZ [rx, ry, rz], centred at pos.
  place(name, w, h, pos, rot = [0, 0, 0], group = 'default') { this.list.push({ name, w, h, pos, rot, group }); return this; }
  // Lying flat on a horizontal surface at y, length along the direction yaw (radians about +Y; 0 = +X).
  flat(name, w, h, x, y, z, yaw = 0, group = 'ground') { return this.place(name, w, h, [x, y, z], [-Math.PI / 2, yaw, 0], group); }
  finish(renderer) { this.atlas.finish(renderer); return this; }
  build(group, { roughness = 0.6, metalness = 0, noWeather = false, shadow = true } = {}) {
    const geos = [];
    for (const d of this.list) {
      if (d.group !== group) continue;
      const g = decalGeo(this.atlas, d.name, d.w, d.h);
      _e.set(d.rot[0], d.rot[1], d.rot[2], 'YXZ'); _q.setFromEuler(_e); _p.fromArray(d.pos);
      g.applyMatrix4(_m.compose(_p, _q, _s));
      geos.push(g);
    }
    if (!geos.length) return null;
    const mat = decalMaterial(this.atlas.texture, { roughness, metalness, key: group });
    if (noWeather) mat.userData.noWeather = true;
    patchAtmos(mat);
    const m = new Mesh(mergeGeos(geos), mat);
    m.name = 'decals:' + group; m.renderOrder = 2; m.receiveShadow = shadow; m.castShadow = false; m.matrixAutoUpdate = false;
    return m;
  }
}
