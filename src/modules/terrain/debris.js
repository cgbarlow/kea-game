// terrain/debris — dressing of the quake slip across SH73: boulders sorted by size toward the toe, big broken slabs,
// gravel, fractured asphalt plates shoved up at the snout, a bent guardrail, a flattened warning sign and a snapped
// culvert pipe sunk in the rubble, and a contact skirt (dust, grit, contact darkening, fissures) where it meets the road.
//   createDebris(G, { T, add, group, far, rockMat }) → { tris, calls, materials }
import { Mesh, BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, MeshStandardMaterial, Color } from 'three';
import { scatter, poissonDisk, rockGeo } from '../../cookbook/geo/scatter.js';
import { Kit, extrudeBevel, lathe } from '../../cookbook/geo/kit.js';
import { rngFrom, sstep } from '../../cookbook/geo/noise.js';
import { makeMaterial } from '../../cookbook/materials/library.js';
import { patch, after } from '../../cookbook/engine/patch.js';
import { slipShape, slipMask } from './height.js';
import { LAYOUT as L, SEED } from '../../contracts.js';

const S = L.slip;
const tOf = (x, z) => slipShape(x, z).t;

export function createDebris(G, { T, add, group, far, rockMat }) {
  const rng = rngFrom(SEED + 401), low = G.quality.tier === 'low';
  let tris = 0, calls = 0;
  const slipRock = rockMat('slipRock', 0xe2e5e8, { thick: 0.06 }), slipSlab = rockMat('slipSlab', 0xd4d7da, { thick: 0.05 }), slipGravel = rockMat('slipGravel', 0xdcdfe2, { thick: 0.008, amount: 0.7 });   // fresh grey schist

  // boulders: fractured blocks, small near the head, the coarse front (1.5-3.5 m) piled at the toe
  const bA = rockGeo({ seed: 5, radius: 1, detail: 2, cuts: 8, squash: 0.72, noise: 0.22 });
  const bB = rockGeo({ seed: 12, radius: 1, detail: 2, cuts: 9, squash: 0.58, noise: 0.28 });
  const bpts = poissonDisk({ x0: S.x - 26, z0: S.z - 22, w: 54, h: 44, r: 2.9, rng, accept: (x, z) => slipMask(x, z) > 0.5 && slipShape(x, z).s > 0.05 && rng() < 0.8 });
  const bins = [[], [], []];
  for (let i = 0; i < bpts.length; i += 2) { const t = tOf(bpts[i], bpts[i + 1]); bins[t < 0.45 ? 0 : t < 0.75 ? 1 : 2].push(bpts[i], bpts[i + 1]); }
  const sizes = [[0.35, 0.8], [0.55, 1.2], [0.8, 1.75]];
  bins.forEach((pts, b) => {
    const half = (k) => new Float32Array(pts.filter((_, i) => ((i >> 1) % 2) === k));
    [[bA, 0], [bB, 1]].forEach(([geo, k]) => add(scatter(G, { parts: [{ geo, material: slipRock }], points: half(k), heightAt: T.heightAt, normalAt: T.normalAt,
      scale: sizes[b], scaleY: [0.65, 1.05], align: 0.5, sink: 0.32, cell: 80, tilt: 0.7, tint: { color: 0xffffff, l: 0.2, h: 0.03, s: 0.06 },
      fade: [220, 300], seed: SEED + 60 + b * 2 + k }), [geo], group, 'boulder' + b + k));
  });
  // big broken slabs (bedding planes off the scar): flat, steeply tilted, half buried, mid-body
  const sA = rockGeo({ seed: 77, radius: 1, detail: 2, cuts: 7, squash: 0.26, noise: 0.16, base: 0.12 });
  const spts = poissonDisk({ x0: S.x - 22, z0: S.z - 18, w: 46, h: 36, r: 5.5, rng, accept: (x, z) => { const s = slipShape(x, z); return s.s > 0.2 && s.t > 0.2 && s.t < 0.85 && rng() < 0.7; } });
  add(scatter(G, { parts: [{ geo: sA, material: slipSlab }], points: spts, heightAt: T.heightAt, normalAt: T.normalAt, scale: [1.2, 2.6], scaleY: [0.8, 1.3],
    align: 0.6, sink: 0.12, cell: 80, tilt: 1.1, tint: { color: 0xffffff, l: 0.12, h: 0.02, s: 0.04 }, fade: [220, 300], seed: SEED + 70 }), [sA], group, 'slab');
  // gravel and cobbles: everywhere on the lobe, densest in the toe band and spilling 3 m out onto the road
  const gA = rockGeo({ seed: 21, radius: 1, detail: 1, cuts: 5, squash: 0.6, noise: 0.3 });
  const gpts = poissonDisk({ x0: S.x - 28, z0: S.z - 24, w: 58, h: 52, r: low ? 1.2 : 0.8, rng, accept: (x, z) => {
    const s = slipShape(x, z);
    if (s.s > 0) return rng() < 0.55 + 0.4 * sstep(0.6, 0.95, s.t);
    return rng() < 0.75 * (1 - sstep(0, 3.2, skirtDist(x, z)));
  } });
  add(scatter(G, { parts: [{ geo: gA, material: slipGravel }], points: gpts, heightAt: (x, z) => Math.max(T.heightAt(x, z), 0), normalAt: T.normalAt,
    scale: [0.08, 0.42], scaleY: [0.5, 1], align: 0.6, sink: 0.2, cell: 80, shadow: false, tilt: 0.6, tint: { color: 0xffffff, l: 0.2, h: 0.03, s: 0.06 },
    fade: [70, 110], seed: SEED + 13 }), [gA], far, 'gravel');

  // fractured asphalt, a guardrail, a sign and a culvert caught up in the snout
  const k = new Kit(), kr = rngFrom(SEED + 411);
  const plate = (x, z, r, tiltMax, sinkM) => {
    const n = 6 + Math.floor(kr() * 3), pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n + (kr() - 0.5) * 0.12) * Math.PI * 2, rr = r * (0.6 + kr() * 0.45); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    const g = extrudeBevel(pts, { depth: 0.13, bevel: 0.012, bevelSeg: 1 });
    g.rotateX(-Math.PI / 2);
    const y = Math.max(T.heightAt(x, z), 0) - sinkM;
    k.push(x, y, z, kr() * 6.28, (kr() - 0.5) * tiltMax, (kr() - 0.5) * tiltMax);
    k.add(g, 'asph', { color: kr() < 0.3 ? 0xd8d6d2 : 0xffffff });
    k.pop();
  };
  let placed = 0;
  for (let i = 0; i < 400 && placed < 22; i++) {
    const x = S.x + (kr() - 0.5) * 50, z = S.z + 4 + kr() * 20, s = slipShape(x, z);
    const out = s.s <= 0 ? skirtDist(x, z) : -1;
    if (s.s > 0 && s.t > 0.72) { plate(x, z, 0.4 + kr() * 0.45, 0.8, 0.03); placed++; }          // shoved up and tilted in the snout
    else if (out >= 0 && out < 2.5 && kr() < 0.5) { plate(x, z, 0.35 + kr() * 0.5, 0.25, 0.02); placed++; }   // lifted at the toe line
  }
  // guardrail: a 9 m W-beam run torn off its posts, bent around the lobe and half buried
  {
    const gx0 = S.x - 12, gz0 = S.z + 13, seg = 10, pts = [];
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, x = gx0 + u * 9.5, z = gz0 + Math.sin(u * 2.6) * 1.6 + u * 1.2;
      pts.push([x, Math.max(T.heightAt(x, z), 0) + 0.12 + 0.35 * Math.sin(u * Math.PI) * (u > 0.5 ? 1.4 : 0.6), z]);
    }
    for (let i = 0; i < seg; i++) {
      const a = pts[i], b = pts[i + 1];
      for (const [dy, w, h] of [[0.1, 0.06, 0.1], [0, 0.035, 0.1], [-0.1, 0.06, 0.1]]) k.bar([a[0], a[1] + dy, a[2]], [b[0], b[1] + dy, b[2]], w, h, 'rail', { r: 0.008 });
    }
    // one post still bolted on, lying across the rubble
    const p = pts[7];
    k.bar([p[0], p[1] - 0.05, p[2] + 0.1], [p[0] + 0.4, p[1] - 0.2, p[2] + 1.6], 0.15, 0.075, 'rail', { r: 0.006 });
  }
  // a flattened curve-warning sign on its galvanised post
  {
    const x = S.x + 9, z = S.z + 15, y = Math.max(T.heightAt(x, z), 0);
    k.push(x, y + 0.25, z, 0.7, 0.35, 1.25);
    k.cyl(0.03, 2.6, 'rail', { at: [0, 1.3, 0], seg: 10 });
    k.push(0, 2.3, 0.05, 0, 0, Math.PI / 4);
    k.box(0.62, 0.62, 0.012, 'sign', { color: 0xf2c200, r: 0.004 });
    k.box(0.64, 0.035, 0.016, 'sign', { color: 0x141414, at: [0, 0.3, 0], r: 0.003 }); k.box(0.64, 0.035, 0.016, 'sign', { color: 0x141414, at: [0, -0.3, 0], r: 0.003 });
    k.box(0.035, 0.64, 0.016, 'sign', { color: 0x141414, at: [0.3, 0, 0], r: 0.003 }); k.box(0.035, 0.64, 0.016, 'sign', { color: 0x141414, at: [-0.3, 0, 0], r: 0.003 });
    k.box(0.1, 0.32, 0.02, 'sign', { color: 0x141414, at: [0.04, 0, 0], rot: [0, 0, -0.5], r: 0.003 });
    k.pop(); k.pop();
  }
  // a snapped concrete culvert pipe sticking out of the west flank
  {
    const x = S.x - 15, z = S.z + 4, y = T.heightAt(x, z);
    k.push(x, y - 0.1, z, 0.9, 0, 1.25);
    k.add(lathe([[0.3, -1.1], [0.38, -1.1], [0.38, 1.1], [0.36, 1.12], [0.3, 1.1], [0.3, -1.1]], { seg: 20, crease: 40 }), 'pipe', { color: 0xc8c2b6 });
    k.pop();
  }
  k.grime({ base: 0 });
  const asph = makeMaterial('asphalt', { tint: 0xc8c6c2, weather: 'prop' }); asph.vertexColors = true; asph.name = 'slipAsphalt';
  const rail = makeMaterial('galvanised', { tint: 0x8a8e92, weather: 'prop' }); rail.vertexColors = true; rail.name = 'slipRail';
  const sign = makeMaterial('painted_metal', { tint: 0xffffff, weather: 'prop' }); sign.vertexColors = true; sign.name = 'slipSign';
  const pipe = makeMaterial('concrete', { tint: 0xb8b2a8, weather: 'prop' }); pipe.vertexColors = true; pipe.name = 'slipPipe';
  const kit = k.build({ asph, rail, sign, pipe, default: asph });
  kit.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; tris += m.geometry.index ? m.geometry.index.count / 3 : m.geometry.attributes.position.count / 3; calls++; } });
  group.add(kit);

  const sk = createSkirt(T);
  far.add(sk.mesh); tris += sk.tris; calls++;
  return { tris, calls, materials: [slipRock, slipSlab, slipGravel, asph, rail, sign, pipe, sk.mesh.material] };
}

// signed-ish distance (m) from a point outside the lobe to the lobe outline, from a coarse grid (built once)
let DG = null;
const DGX0 = S.x - 34, DGZ0 = S.z - 26, DGR = 0.5, DGW = 140, DGH = 112;
function distGrid() {
  if (DG) return DG;
  const n = DGW * DGH, d = new Float32Array(n), BIG = 1e4;
  for (let j = 0; j < DGH; j++) for (let i = 0; i < DGW; i++) d[i + j * DGW] = slipShape(DGX0 + i * DGR, DGZ0 + j * DGR).s > 0.012 ? 0 : BIG;
  const D1 = DGR, D2 = DGR * Math.SQRT2;
  for (let j = 0; j < DGH; j++) for (let i = 0; i < DGW; i++) {
    const p = i + j * DGW; let v = d[p];
    if (i > 0) v = Math.min(v, d[p - 1] + D1);
    if (j > 0) { v = Math.min(v, d[p - DGW] + D1); if (i > 0) v = Math.min(v, d[p - DGW - 1] + D2); if (i < DGW - 1) v = Math.min(v, d[p - DGW + 1] + D2); }
    d[p] = v;
  }
  for (let j = DGH - 1; j >= 0; j--) for (let i = DGW - 1; i >= 0; i--) {
    const p = i + j * DGW; let v = d[p];
    if (i < DGW - 1) v = Math.min(v, d[p + 1] + D1);
    if (j < DGH - 1) { v = Math.min(v, d[p + DGW] + D1); if (i < DGW - 1) v = Math.min(v, d[p + DGW + 1] + D2); if (i > 0) v = Math.min(v, d[p + DGW - 1] + D2); }
    d[p] = v;
  }
  DG = d; return d;
}
function skirtDist(x, z) {
  const d = distGrid(), fi = (x - DGX0) / DGR, fj = (z - DGZ0) / DGR;
  if (fi < 0 || fj < 0 || fi >= DGW - 1 || fj >= DGH - 1) return 1e4;
  const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, p = i + j * DGW;
  return (d[p] * (1 - a) + d[p + 1] * a) * (1 - b) + (d[p + DGW] * (1 - a) + d[p + DGW + 1] * a) * b;
}

// contact skirt: a draped decal from 1.5 m up the debris base to ~6 m out over the road. aSk = (outside distance m,
// thickness of the debris under it). Shader: contact darkening at the line, grit + dust fan outside, fissures across.
function createSkirt(T) {
  const P = [], A = [], I = [], idx = new Int32Array(DGW * DGH).fill(-1);
  for (let j = 0; j < DGH; j++) for (let i = 0; i < DGW; i++) {
    const x = DGX0 + i * DGR, z = DGZ0 + j * DGR, s = slipShape(x, z).s, d = skirtDist(x, z);
    if (d > 7.5 || s * S.h > 1.0) continue;
    idx[i + j * DGW] = P.length / 3;
    P.push(x, Math.max(T.heightAt(x, z), 0) + 0.018, z); A.push(d, s * S.h);
  }
  for (let j = 0; j < DGH - 1; j++) for (let i = 0; i < DGW - 1; i++) {
    const p = i + j * DGW, a = idx[p], b = idx[p + 1], c = idx[p + DGW], e = idx[p + DGW + 1];
    if (a < 0 || b < 0 || c < 0 || e < 0) continue;
    I.push(a, c, b, b, c, e);
  }
  const g = new BufferGeometry();
  const N = new Float32Array(P.length); for (let i = 1; i < N.length; i += 3) N[i] = 1;
  g.setAttribute('position', new Float32BufferAttribute(P, 3)); g.setAttribute('normal', new Float32BufferAttribute(N, 3));
  g.setAttribute('aSk', new Float32BufferAttribute(A, 2)); g.setIndex(new Uint32BufferAttribute(I, 1));
  g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new MeshStandardMaterial({ color: new Color(1, 1, 1), roughness: 0.95, metalness: 0, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  m.name = 'slipSkirt'; m.userData.noWeather = true;
  patch(m, 'slipSkirt', (s) => {
    s.vertexShader = after(s.vertexShader, '#include <common>', 'attribute vec2 aSk;\nvarying vec2 vSk;\nvarying vec2 vSkW;');
    s.vertexShader = after(s.vertexShader, '#include <worldpos_vertex>', 'vSk = aSk; vSkW = (modelMatrix * vec4(transformed, 1.0)).xz;');
    s.fragmentShader = after(s.fragmentShader, '#include <common>', /*glsl*/`
varying vec2 vSk;
varying vec2 vSkW;
float skH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float skN(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(skH(i), skH(i + vec2(1.0, 0.0)), f.x), mix(skH(i + vec2(0.0, 1.0)), skH(i + 1.0), f.x), f.y); }`);
    s.fragmentShader = after(s.fragmentShader, '#include <color_fragment>', /*glsl*/`
{
  vec2 w = vSkW;
  float d = vSk.x, th = vSk.y;
  float n1 = skN(w * 0.45), n2 = skN(w * 2.3 + 4.1), n3 = skN(w * 9.0 + 1.7);
  float px = length(fwidth(w));
  float hiA = 1.0 - smoothstep(0.04, 0.2, px);               // fine grit only where it resolves (no far sparkle)
  float dj = d + (n1 - 0.5) * 2.2 + (n2 - 0.5) * 0.6;          // ragged dust edge
  float dust = (1.0 - smoothstep(0.4, 5.5, dj)) * (0.55 + 0.45 * n1);
  float contact = (1.0 - smoothstep(0.0, 0.9, d + (n2 - 0.5) * 0.4)) * (1.0 - smoothstep(0.15, 1.4, th));
  float grit = smoothstep(0.7, 0.85, n3 + (n2 - 0.5) * 0.2) * (1.0 - smoothstep(0.3, 2.5, dj)) * hiA * step(0.0, d);
  // fissures: warped noise ridge lines running out from the toe across the road
  vec2 fw = w + vec2(skN(w * 0.21 + 9.0), skN(w * 0.21 + 3.0)) * 5.0;
  float fl = abs(skN(vec2(fw.x * 0.16, fw.y * 0.05)) - 0.5);
  float fwid = 0.012 + 0.6 * fwidth(fl);
  float fis = (1.0 - smoothstep(fwid * 0.4, fwid, fl)) * (1.0 - smoothstep(4.0, 7.0, d)) * step(0.05, d) * smoothstep(0.35, 0.6, n1);
  vec3 c = mix(vec3(0.16, 0.152, 0.14), vec3(0.24, 0.23, 0.21), n2);
  c = mix(c, vec3(0.34, 0.33, 0.30), grit * 0.7);
  c = mix(c, vec3(0.06, 0.055, 0.05), contact * 0.85);
  c = mix(c, vec3(0.02, 0.02, 0.02), fis);
  float a = clamp(max(dust * 0.6, contact * 0.75) + grit * 0.3 + fis * 0.9, 0.0, 1.0);
  a *= 1.0 - smoothstep(0.25, 0.9, th);                          // fades out up the debris base
  diffuseColor = vec4(c, a);
}`);
  });
  const mesh = new Mesh(g, m); mesh.name = 'slip-skirt'; mesh.receiveShadow = true; mesh.castShadow = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 1;
  return { mesh, tris: I.length / 3 };
}
