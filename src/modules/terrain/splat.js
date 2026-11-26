// terrain/splat — world-space recolour of the terrain material (runs after <color_fragment>, before weathering, so the
// global snow/wet layers still sit on top). Per-vertex masks come in the `aTer` attribute from the mesh builder:
//   x forest floor, y fresh slip debris, z hollow (snow trap), w road continuation (asphalt beyond the slab).
// Slope/height/noise decide tussock vs scree vs rock; snow lies in hollows on the scree and above ~100 m.
// The baked rock texture's luminance is kept as detail (albedo = target * lum / ref). Colours: linear albedos.
import { Vector4 } from 'three';
import { patch, after } from '../../cookbook/engine/patch.js';

export function patchSplat(material, { ref = 0.2, snowLine = 115 } = {}) {
  const U = { uTerP: { value: new Vector4(ref, snowLine, 0, 0) } };
  material.userData.splat = U;
  return patch(material, 'terrainSplat', (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = after(s.vertexShader, '#include <common>', 'attribute vec4 aTer;\nvarying vec4 vTer;\nvarying vec3 vTerW;\nvarying vec3 vTerN;');
    s.vertexShader = after(s.vertexShader, '#include <worldpos_vertex>', /*glsl*/`
  vTer = aTer;
  vTerW = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vTerN = normalize(mat3(modelMatrix) * objectNormal);`);
    s.fragmentShader = after(s.fragmentShader, '#include <common>', /*glsl*/`
varying vec4 vTer;
varying vec3 vTerW;
varying vec3 vTerN;
uniform vec4 uTerP;
float terHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float terNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(terHash(i), terHash(i + vec2(1.0, 0.0)), f.x), mix(terHash(i + vec2(0.0, 1.0)), terHash(i + 1.0), f.x), f.y); }
float terFbm(vec2 p) { return 0.5 * terNoise(p) + 0.3 * terNoise(p * 2.13 + 7.1) + 0.2 * terNoise(p * 4.37 + 3.3); }`);
    s.fragmentShader = after(s.fragmentShader, '#include <color_fragment>', /*glsl*/`
{
  vec3 tn = normalize(vTerN);
  vec2 w = vTerW.xz;
  float sl = 1.0 - tn.y;
  float m1 = terFbm(w * 0.021);
  float m2 = terFbm(w * 0.13 + 3.7);
  float m3 = terNoise(w * 1.3);
  float m4 = terNoise(w * 5.1);
  float hy = vTerW.y;
  // tussock grassland: gold, olive, dead straw; denser darker patches
  vec3 tuss = mix(vec3(0.15, 0.12, 0.05), vec3(0.32, 0.23, 0.08), smoothstep(0.32, 0.68, m1));
  tuss = mix(tuss, vec3(0.36, 0.28, 0.12), smoothstep(0.62, 0.85, m2) * 0.7);
  tuss *= 0.85 + 0.3 * m4;
  // scree: cool grey clasts, rusty weathered patches, lighter fresh fans
  vec3 scree = mix(vec3(0.15, 0.15, 0.155), vec3(0.25, 0.245, 0.24), smoothstep(0.3, 0.8, m2 * 0.6 + m3 * 0.4));
  scree = mix(scree, vec3(0.22, 0.17, 0.12), smoothstep(0.6, 0.85, m1) * 0.45);
  vec3 rockc = mix(vec3(0.10, 0.10, 0.11), vec3(0.19, 0.185, 0.18), m2);
  float grassy = smoothstep(0.30, 0.12, sl + (m2 - 0.5) * 0.22) * (1.0 - smoothstep(30.0, 85.0, hy + (m1 - 0.5) * 50.0));
  grassy = max(grassy, smoothstep(0.38, 0.2, sl) * (1.0 - smoothstep(4.0, 14.0, hy)));
  vec3 c = mix(scree, tuss, grassy);
  c = mix(c, rockc, smoothstep(0.5, 0.75, sl + (m3 - 0.5) * 0.15));
  // forest floor: dark beech litter, moss cushions, roots
  vec3 litter = mix(vec3(0.062, 0.045, 0.03), vec3(0.11, 0.075, 0.042), m3);
  litter = mix(litter, vec3(0.06, 0.085, 0.03), smoothstep(0.5, 0.75, m2) * 0.8);
  c = mix(c, litter, vTer.x);
  // fresh slip debris: grey-brown wet clay and broken rock, pale clasts
  vec3 debris = mix(vec3(0.15, 0.135, 0.115), vec3(0.27, 0.255, 0.23), smoothstep(0.35, 0.8, m3 * 0.5 + m4 * 0.5));
  c = mix(c, debris, vTer.y);
  // road continuation beyond the slab
  c = mix(c, vec3(0.05, 0.05, 0.055) * (0.85 + 0.3 * m4), vTer.w);
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  c *= clamp(lum / uTerP.x, 0.4, 1.9);
  // lying snow: in hollows on the scree / slip scar, and above the snow line (thin on steep rock)
  float snowH = smoothstep(uTerP.y - 30.0, uTerP.y + 50.0, hy + (m1 - 0.5) * 70.0 + (m3 - 0.5) * 8.0) * smoothstep(0.7, 0.32, sl + (m2 - 0.5) * 0.3);
  snowH *= smoothstep(0.3, 0.55, m2 + 0.35 * m3 - 0.1 * vTer.z);       // rock ribs and scree break through the snowfield
  float snowC = vTer.z * smoothstep(0.42, 0.62, m2 + 0.25 * m3) * (1.0 - vTer.x) * (1.0 - vTer.w);
  float sn = clamp(max(snowH, snowC), 0.0, 1.0);
  vec3 snowc = mix(vec3(0.50, 0.56, 0.66), vec3(0.64, 0.67, 0.72), smoothstep(0.2, 0.8, sn)) * (0.92 + 0.08 * m4);
  c = mix(c, snowc, smoothstep(0.15, 0.6, sn));
  diffuseColor.rgb = c;
}`);
    s.fragmentShader = after(s.fragmentShader, '#include <roughnessmap_fragment>', /*glsl*/`
  roughnessFactor = mix(roughnessFactor, 0.55, vTer.w * 0.6);`);
  });
}
