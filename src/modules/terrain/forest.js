// terrain/forest — the south beech forest. Near band (the slope behind the car park, |x| < 165, first ~40 m of the
// slope): instanced beech trees in two shapes + edge shrubs, fading 120-180 m. Everything beyond is a canopy shell:
// a lumpy heightfield ~12 m over the ground with crown-scale shading, so the forest is a continuous dark mass to the
// ridge at ~5k tris instead of thousands of trees. The real trees stand in front of / poke through the shell.
//   createForest(G, { T, fn, mats }) → { group, far, tris, calls, materials }
import { Group, Mesh, MeshStandardMaterial, MeshLambertMaterial, DoubleSide, Color, Vector3, BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three';
import { scatter, poissonDisk, foliagePatch, bushGeo } from '../../cookbook/geo/scatter.js';
import { rngFrom, fbm2, vnoise2, clamp, sstep } from '../../cookbook/geo/noise.js';
import { makeMaterial } from '../../cookbook/materials/library.js';
import { patch, after } from '../../cookbook/engine/patch.js';
import { beechGeo, beechLeafTexture } from './beech.js';
import { axisZ, forestMask, BENCH, EXT } from './height.js';
import { LAYOUT as L, SEED } from '../../contracts.js';

const NEAR_X = 165, NEAR_V = 42;                 // real-tree zone: |x| < NEAR_X and v (m past the south bench edge) < NEAR_V
const vOf = (x, z) => z - axisZ(x) - BENCH.half;
const _n = new Vector3();

export function createForest(G, { T }) {
  const group = new Group(); group.name = 'terrain-forest';
  const far = new Group(); far.name = 'terrain-canopy';
  const low = G.quality.tier === 'low';
  let tris = 0, calls = 0;

  // materials: sooty-black beech bark (baked rock texture, fine scale) + moss in vertex colour; small-leaf sprays
  const bark = makeMaterial('rock', { tint: 0x8c857c, scale: 1.2, rough: 1.1, weather: { preset: 'prop', snow: 0.2, wet: 0.6 } });
  bark.vertexColors = true; bark.name = 'beechBark';
  const leafTex = beechLeafTexture({ size: 256, seed: 7 });
  const leaves = new MeshStandardMaterial({ map: leafTex, alphaTest: 0.5, side: DoubleSide, vertexColors: true, roughness: 0.8, color: new Color(0.6, 0.66, 0.58) });
  leaves.name = 'beechLeaves'; leaves.userData.weather = { preset: 'prop', snow: 0.22, wet: 0.5, beads: 0 };
  foliagePatch(leaves, { trans: 0.18 });

  // two tree shapes (tall two-leader canopy tree, shorter three-leader) — per-instance scale/tint/rotation does the rest
  const A = beechGeo({ seed: 3, height: 15, trunkR: 0.34, leaders: 2, cards: low ? 240 : 380, leafSize: 1.5 });
  const B = beechGeo({ seed: 8, height: 11, trunkR: 0.26, leaders: 3, cards: low ? 180 : 290, leafSize: 1.4 });
  const rng = rngFrom(SEED + 101);
  const dens = L.dens;
  const pts = poissonDisk({ x0: -NEAR_X, z0: BENCH.z1 + 1.5, w: NEAR_X * 2, h: NEAR_V + 30, r: 3.9, rng, accept: (x, z) => {
    const v = vOf(x, z);
    if (v < 2.2 || v > NEAR_V || rng() < sstep(8, 30, v) * 0.45) return false;
    for (const d of dens) if (Math.hypot(x - d[0], z - d[1]) < 3.2) return false;   // possum dens stay clear
    return forestMask(x, z) > 0.35 + 0.4 * vnoise2(x * 0.08, z * 0.08, SEED + 7);
  } });
  const pa = [], pb = [];
  for (let i = 0; i < pts.length; i += 2) ((i * 0.618034) % 1 < 0.58 ? pa : pb).push(pts[i], pts[i + 1]);
  const common = { heightAt: T.heightAt, normalAt: T.normalAt, sink: 0.35, align: 0.06, fade: [120, 180], cell: 90,
    tint: { color: 0xffffff, h: 0.025, s: 0.08, l: 0.09 }, sway: { amp: 0.03, freq: 1.1, power: 1.6, height: 14 } };
  const sA = scatter(G, { ...common, parts: [{ geo: A.trunk, material: bark }, { geo: A.leaves, material: leaves }], points: new Float32Array(pa), scale: [0.8, 1.2], scaleY: [0.9, 1.15], seed: SEED + 2 });
  const sB = scatter(G, { ...common, parts: [{ geo: B.trunk, material: bark }, { geo: B.leaves, material: leaves }], points: new Float32Array(pb), scale: [0.75, 1.25], scaleY: [0.85, 1.2], seed: SEED + 3 });
  const triA = A.trunk.index.count / 3 + A.leaves.index.count / 3, triB = B.trunk.index.count / 3 + B.leaves.index.count / 3;
  tris += sA.count * triA + sB.count * triB; calls += (sA.cells.length + sB.cells.length) * 2;
  group.add(sA.group, sB.group);

  // edge shrubs: young beech + coprosma along the forest margin and in gaps (light-hungry edge growth)
  const shrubMat = new MeshStandardMaterial({ map: leafTex, alphaTest: 0.5, side: DoubleSide, vertexColors: true, roughness: 0.8, color: new Color(0.95, 0.98, 0.85) });
  shrubMat.name = 'edgeShrub'; shrubMat.userData.weather = { preset: 'prop', snow: 0.25, wet: 0.5, beads: 0 };
  foliagePatch(shrubMat, { trans: 0.3 });
  const shrubGeo = bushGeo({ seed: 4, radius: 1.5, height: 2.4, cards: 72, leafSize: 0.95 });
  const sp = poissonDisk({ x0: -NEAR_X, z0: BENCH.z1, w: NEAR_X * 2, h: 42, r: 2.6, rng, accept: (x, z) => {
    const v = vOf(x, z); if (v < 0.8 || v > 26) return false;
    for (const d of dens) if (Math.hypot(x - d[0], z - d[1]) < 2.2) return false;
    return rng() < (1 - sstep(2, 14, v)) * 0.8 + 0.3;
  } });
  const sS = scatter(G, { parts: [{ geo: shrubGeo, material: shrubMat }], points: sp, heightAt: T.heightAt, normalAt: T.normalAt,
    scale: [0.55, 1.3], align: 0.2, sink: 0.12, fade: [70, 110], cell: 90, shadow: false, seed: SEED + 6,
    tint: { color: 0xffffff, h: 0.03, s: 0.1, l: 0.1 }, sway: { amp: 0.05, freq: 1.6, power: 1.5, height: 1.6, flutter: 0.01 } });
  tris += sS.count * shrubGeo.index.count / 3; calls += sS.cells.length;
  group.add(sS.group);

  // canopy shell
  const shell = canopyShell(T);
  far.add(shell.group);
  tris += shell.tris; calls += shell.group.children.length;
  return { group, far, tris, calls, parts: { treeA: [sA.count, triA], treeB: [sB.count, triB], shrub: [sS.count, shrubGeo.index.count / 3], shell: [1, shell.tris] }, trees: sA.count + sB.count, materials: [bark, leaves, shrubMat, shell.material] };
}

// lumpy crown surface: h = ground + (crown height + 2) * mask - 2 (2 m under the ground where there is no forest,
// so open ground never z-fights). Ramps up behind the near-tree zone so real trees overlap its front edge.
function canopyShell(T) {
  // Lambert: a canopy has no Fresnel sheen; a Standard shell went pale grey at grazing angles into the low sun
  const res = 4, x0 = -EXT, x1 = EXT, mat = new MeshLambertMaterial({ vertexColors: true, color: new Color(1, 1, 1) });
  mat.name = 'canopyShell';
  patch(mat, 'canopy', (s) => { // crown-scale dark gaps + leafy speckle (world space), so the shell never reads as felt
    s.vertexShader = after(s.vertexShader, '#include <common>', 'varying vec3 vCnW;');
    s.vertexShader = after(s.vertexShader, '#include <worldpos_vertex>', 'vCnW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = after(s.fragmentShader, '#include <common>', /*glsl*/`
varying vec3 vCnW;
float cnH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float cnCell(vec2 p, out float id) { vec2 i = floor(p), f = fract(p); float d = 8.0; id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = vec2(cnH(i + g), cnH(i + g + 17.3));
    float e = length(g + o - f); if (e < d) { d = e; id = cnH(i + g + 5.1); } }
  return d; }`);
    s.fragmentShader = after(s.fragmentShader, '#include <color_fragment>', /*glsl*/`
{
  float cid;
  float cc = cnCell(vCnW.xz * 0.12, cid);
  vec3 hue = mix(vec3(0.9, 1.0, 1.05), vec3(1.25, 1.1, 0.75), smoothstep(0.7, 1.0, cid));
  diffuseColor.rgb *= hue * mix(1.0, 0.45, smoothstep(0.45, 0.95, cc)) * (0.85 + 0.25 * cid);
}`);
  });
  const nx = Math.round((x1 - x0) / res), group = new Group();
  // chunk along x (4 meshes) so the frustum culls the parts behind the camera
  const chunks = 4, per = Math.ceil(nx / chunks);
  let tris = 0;
  const zoneRamp = (x, v) => { const inX = 1 - sstep(NEAR_X - 30, NEAR_X - 5, Math.abs(x)); const inV = 1 - sstep(NEAR_V - 36, NEAR_V - 18, v); return 1 - inX * inV; };
  const lump = (x, z) => 10 + 5 * fbm2(x * 0.045, z * 0.045, 3, SEED + 80) + 3 * vnoise2(x * 0.018, z * 0.018, SEED + 81);
  for (let c = 0; c < chunks; c++) {
    const i0 = c * per, i1 = Math.min(nx, i0 + per), P = [], N = [], C = [], I = [], idx = new Map();
    const vtx = (i, z) => {
      const key = i * 4096 + z; if (idx.has(key)) return idx.get(key);
      const X = x0 + i * res, Z = z * res;
      const m = forestMask(X, Z) * zoneRamp(X, vOf(X, Z)), g = T.heightAt(X, Z);
      const er = sstep(1.0, 38, vOf(X, Z)), hc = lump(X, Z) * er, y = g + (hc + 2.6) * sstep(0.02, 0.6, m) - 2;   // edge trees lower, no wall at the edge
      const e = 2, dx = (lump(X + e, Z) - lump(X - e, Z)) / (2 * e), dz = (lump(X, Z + e) - lump(X, Z - e)) / (2 * e);
      const ng = T.normalAt(X, Z, _n), w = sstep(0.05, 0.5, m);
      let nX = ng.x - dx * w * 0.8, nY = ng.y, nZ = ng.z - dz * w * 0.8; const l = Math.hypot(nX, nY, nZ);
      const k = clamp(0.6 + 0.7 * (fbm2(X * 0.045, Z * 0.045, 3, SEED + 80) - 0.4), 0.4, 1.05);
      const hue = vnoise2(X * 0.02, Z * 0.02, SEED + 82);
      P.push(X, y, Z); N.push(nX / l, nY / l, nZ / l); C.push(0.05 * k * (0.85 + 0.35 * hue), 0.072 * k, 0.04 * k * (1.1 - 0.3 * hue));
      idx.set(key, P.length / 3 - 1); return P.length / 3 - 1;
    };
    const zB = Math.floor(EXT / res);
    for (let i = i0; i < i1; i++) for (let z = Math.floor((axisZ(x0 + i * res) + BENCH.half) / res); z < zB; z++) {
      const X = x0 + i * res, Z = z * res;
      // skip quads with no forest at any corner
      let any = 0;
      for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const xx = X + a * res, zz = Z + b * res; any = Math.max(any, forestMask(xx, zz) * zoneRamp(xx, vOf(xx, zz))); }
      if (any < 0.05) continue;
      const p = vtx(i, z), q = vtx(i + 1, z), d = vtx(i, z + 1), e = vtx(i + 1, z + 1);
      I.push(p, d, q, q, d, e);
    }
    if (!I.length) continue;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(P, 3)); g.setAttribute('normal', new Float32BufferAttribute(N, 3));
    g.setAttribute('color', new Float32BufferAttribute(C, 3));
    g.setIndex(new Uint32BufferAttribute(I, 1)); g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new Mesh(g, mat); m.matrixAutoUpdate = false; m.receiveShadow = false; m.castShadow = false; m.name = 'canopy';
    group.add(m); tris += I.length / 3;
  }
  return { group, tris, material: mat };
}
