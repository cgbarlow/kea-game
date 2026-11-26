// terrain — the alpine pass around the car park bench: the valley bends north-west into the saddle under the sun and
// north-east past the slip; north wall = talus apron, stepped scree benches, gullies and fans up to a snowy range;
// south wall = beech forest (near instanced trees + far canopy shell); the slip lobe across SH73 with boulders and
// snapped trunks; tussock verges; snow in hollows and above ~100 m. Crests sit inside the 896 m square, so no edge
// shows; the far field rings (backdrop/farfield.js) fill the gaps over the saddle.
//   create(G, { mats }) → { group, heightAt(x,z), normalAt(x,z,out), farfield, update, dispose, stats }
//   heightFn() → (x,z) => y     (|x| <= 95, -27 <= z <= 19 stays at y = -0.06 except under the slip lobe)
//   showcase(G) → { cam, target }
// Budget (main pass): terrain ~0.2 M tris in 16 chunk calls; forest+rocks+tussock instanced in ~40 culled cells.
import { Group } from 'three';
import { createFarfield, FARFIELD_PRESETS } from '../../cookbook/backdrop/farfield.js';
import { sstep, clamp } from '../../cookbook/geo/noise.js';
import { heightFn as makeHeight, forestMask, slipMask, roadMask, BENCH, EXT } from './height.js';
import { lodTerrain } from './lodmesh.js';
import { patchSplat } from './splat.js';
import { createForest } from './forest.js';
import { createProps } from './props.js';

export const heightFn = makeHeight;
const PLAY = { x0: -40, x1: 52, z0: -32, z1: 24 };   // where the camera lives (WORLD + the slip vista pose)

export function create(G, { mats }) {
  const t0 = performance.now();
  const group = new Group(); group.name = 'terrain';
  const far = new Group(); far.name = 'terrain-far'; far.userData.noReflect = true;   // trees + small scatter: not in the puddles
  const fn = makeHeight(), low = G.quality.tier === 'low';
  const mat = mats.terrain;
  mat.name = 'terrain'; mat.vertexColors = true;
  patchSplat(mat, { ref: 0.2, snowLine: 115 });

  const resOf = (cx, cz, size) => {
    const h = size / 2;
    if (cx - h >= -88 && cx + h <= 88 && cz - h >= -24 && cz + h <= 16) {           // under the slab: one quad if flat
      let flat = true;
      for (let j = 0; j <= 4 && flat; j++) for (let i = 0; i <= 4; i++) if (Math.abs(fn(cx - h + i * h / 2, cz - h + j * h / 2) - BENCH.y) > 1e-4) { flat = false; break; }
      if (flat) return size;
    }
    if (!low && cx + h > 28 && cx - h < 76 && cz + h > -46 && cz - h < 2) return 0.5;   // the slip lobe: half-metre mesh, clean toe
    const dx = Math.max(PLAY.x0 - cx, 0, cx - PLAY.x1), dz = Math.max(PLAY.z0 - cz, 0, cz - PLAY.z1), d = Math.hypot(dx, dz) - h * 1.41;
    if (low) return d < 50 ? 2 : 4;
    return d < 70 ? 1 : d < 170 ? 2 : 4;
  };
  const attrib = (x, z, y, out, lap) => {
    out[0] = sstep(0.15, 0.6, forestMask(x, z));
    out[1] = slipMask(x, z);
    out[2] = clamp(sstep(0.004, 0.05, lap) * sstep(4, 20, y) + 0.5 * sstep(40, 110, y) * sstep(0.0, 0.02, lap + 0.01), 0, 1);
    out[3] = roadMask(x, z);
  };
  const T = lodTerrain({ fn, ext: EXT, cell: 16, chunk: 14, resOf, attrib, material: mat });
  group.add(T.group);

  const forest = createForest(G, { T });
  // trees + small scatter stay out of the planar-reflection pass (puddles show sky, shell and terrain): ~0.5 M tris saved
  far.add(forest.group); group.add(forest.far);
  const props = createProps(G, { T, mats, bark: forest.materials[0] });
  group.add(props.group); far.add(props.far);

  G.scene.add(group); G.scene.add(far);
  const farfield = createFarfield(G, { layers: FARFIELD_PRESETS.wilderness });
  const stats = { tris: Math.round(T.tris + forest.tris + props.tris), terrainTris: T.tris, forestTris: Math.round(forest.tris), propTris: Math.round(props.tris),
    calls: T.meshes.length + forest.calls + props.calls, trees: forest.trees, parts: { ...forest.parts, ...props.parts }, ms: Math.round(performance.now() - t0) };
  console.log('terrain: ' + JSON.stringify(stats));
  G.statsHooks?.push(() => ({ terrain: stats }));
  return {
    group, far, heightAt: T.heightAt, normalAt: T.normalAt, farfield, stats, update() {},
    dispose() { G.scene.remove(group); G.scene.remove(far); },
  };
}

// slip close-up from the car park's east end: lobe, boulders, snapped trunks, scar and scree benches behind
export function showcase() { return { cam: [40, 8, 6], target: [50, 3, -19] }; }
