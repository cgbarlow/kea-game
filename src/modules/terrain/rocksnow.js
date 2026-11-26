// terrain/rocksnow — snow lying on rock tops (slip boulders, slabs, talus, erratics, outcrops). Replaces the generic
// weathering snow on these materials (its 0.1-wide cut-out edge read as white paint): cover is driven by the WORLD
// normal (up-facing tops), broken by world noise, with a wide soft edge where thin snow lets the rock show through,
// a slight thickness (vertices on the tops are pushed out along the normal), soft lumps in the shading normal, a
// blue cast on faces turned from the sun and a damp dark melt rim just below the edge.
// Amount follows the shared weathering uSnow (ART.surface.snow, weather/snow.js ramps), times `amount`.
//   patchRockSnow(material, { amount = 1, thick = 0.05 })  — call after makeMaterial; disables the material's wth snow
import { patch, after } from '../../cookbook/engine/patch.js';
import { W } from '../../cookbook/materials/weathering.js';

export function patchRockSnow(material, { amount = 1, thick = 0.05 } = {}) {
  if (material.userData.wth) material.userData.wth.a.z = 0;      // the generic layer stays off: this one owns rock snow
  const U = { uRsA: { value: [amount, thick] } };
  return patch(material, 'rockSnow', (s) => {
    s.uniforms.uRsA = U.uRsA; s.uniforms.uSnow = W.snow;
    s.vertexShader = after(s.vertexShader, '#include <common>', 'uniform vec2 uRsA;\nvarying vec3 vRsW;\nvarying vec3 vRsN;');
    // thickness: displace up-facing vertices along their normal before projection (instancing aware)
    s.vertexShader = after(s.vertexShader, '#include <begin_vertex>', /*glsl*/`
{
  mat3 rsM = mat3(modelMatrix);
#ifdef USE_INSTANCING
  rsM = rsM * mat3(instanceMatrix);
#endif
  vec3 rsN0 = normalize(rsM * objectNormal);
  float rsK = clamp(uSnow * 1.6 * uRsA.x, 0.0, 1.0);
  transformed += objectNormal * uRsA.y * rsK * smoothstep(0.8, 0.97, rsN0.y);
}`);
    s.vertexShader = after(s.vertexShader, '#include <worldpos_vertex>', /*glsl*/`
{
  vec4 rsP = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  rsP = instanceMatrix * rsP;
#endif
  vRsW = (modelMatrix * rsP).xyz;
  vRsN = inverseTransformDirection(transformedNormal, viewMatrix);
}`);
    s.fragmentShader = after(s.fragmentShader, '#include <common>', /*glsl*/`
uniform vec2 uRsA;
varying vec3 vRsW;
varying vec3 vRsN;
float rsH(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float rsN3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rsH(i), rsH(i + vec3(1, 0, 0)), f.x), mix(rsH(i + vec3(0, 1, 0)), rsH(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(rsH(i + vec3(0, 0, 1)), rsH(i + vec3(1, 0, 1)), f.x), mix(rsH(i + vec3(0, 1, 1)), rsH(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`);
    // after the normal is final (before emissive/lights): albedo, roughness and the shading normal
    s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', /*glsl*/`
{
  vec3 wN = normalize(vRsN);
#ifdef DOUBLE_SIDED
  wN *= faceDirection;
#endif
  float k = clamp(uSnow * 1.6 * uRsA.x, 0.0, 1.0);
  float n1 = rsN3(vRsW * 1.6), n2 = rsN3(vRsW * 5.3 + 7.0);
  float cov = wN.y + (n1 - 0.5) * 0.3 + (n2 - 0.5) * 0.1;
  float lo = 1.0 - 0.3 * k;
  float sA = smoothstep(lo, lo + 0.2, cov) * step(0.001, k);         // soft edge: thin snow, rock showing through
  float depth = smoothstep(lo + 0.1, lo + 0.3, cov);                // settled thickness on the flattest tops
  float rim = smoothstep(lo - 0.15, lo, cov) * (1.0 - sA) * step(0.001, k);
  diffuseColor.rgb *= 1.0 - 0.22 * rim;                             // damp melt rim under the snow edge
  vec3 sunD = normalize(vec3(-0.91, 0.24, -0.33));
  float sunF = clamp(dot(wN, sunD) * 2.5 + 0.4, 0.0, 1.0);
  vec3 snowC = mix(vec3(0.52, 0.60, 0.72), vec3(0.80, 0.82, 0.86), depth) * (0.93 + 0.08 * n2);
  snowC *= mix(vec3(0.85, 0.9, 1.0), vec3(1.0), sunF);
  diffuseColor.rgb = mix(diffuseColor.rgb, snowC, sA);
  roughnessFactor = mix(roughnessFactor, 0.7, sA);
  metalnessFactor *= 1.0 - sA;
  // soft lumps: a world-space noise gradient tilts the (smoothed) normal, so the layer has form, not a flat decal
  vec3 sp = vRsW * 4.0;
  float g0 = rsN3(sp);
  vec3 g = vec3(rsN3(sp + vec3(0.2, 0.0, 0.0)), rsN3(sp + vec3(0.0, 0.2, 0.0)), rsN3(sp + vec3(0.0, 0.0, 0.2))) - g0;
  vec3 gv = (viewMatrix * vec4(g - wN * dot(g, wN), 0.0)).xyz;
  vec3 nGeo = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
  normal = normalize(mix(normal, normalize(nGeo - gv * 2.2), sA * 0.8));
}
#include <emissivemap_fragment>`);
  });
}
