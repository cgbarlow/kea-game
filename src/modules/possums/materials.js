// possums/materials — fur base (sheen + strand albedo), fur shells (alpha-to-coverage strands, dark roots / silver
// tips), wet eyes + nose (clearcoat: the eye glints come from the sun + env), and the contact shadow blob.
// All lit materials go through finalizeMaterials (main.js) for atmos + weathering; the weathering opts below keep
// world-space macro/snow/dust off (they would swim across a moving animal) and leave a light damp film.
import { MeshPhysicalMaterial, MeshBasicMaterial, DataTexture, RGBAFormat, LinearFilter, Color, FrontSide } from 'three';
import { patch } from '../../cookbook/engine/patch.js';

const FUR_WEATHER = { wet: 0, dust: 0, snow: 0, edge: 0, beads: 0, macro: 0, porosity: 0.7 };

const FUR_GLSL = /*glsl*/`
attribute vec2 aFur;
varying vec2 vFur;
varying vec3 vFurP;
`;
const FUR_FRAG = /*glsl*/`
varying vec2 vFur;
varying vec3 vFurP;
float furH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float furN(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(furH(i), furH(i + vec3(1.0, 0.0, 0.0)), f.x), mix(furH(i + vec3(0.0, 1.0, 0.0)), furH(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(furH(i + vec3(0.0, 0.0, 1.0)), furH(i + vec3(1.0, 0.0, 1.0)), f.x), mix(furH(i + vec3(0.0, 1.0, 1.0)), furH(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float furStrand(vec3 p) { return furN(p * vec3(240.0, 240.0, 70.0)) * 0.65 + furN(p * vec3(610.0, 610.0, 170.0) + 3.1) * 0.35; }
`;

function furVertex(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + FUR_GLSL)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFur = aFur;\nvFurP = position;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + FUR_FRAG);
}

export function createPossumMaterials() {
  // base coat: soft sheen (velvet response at grazing angles), strand-level albedo breakup
  const fur = new MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0, sheen: 0.3, sheenRoughness: 0.7, sheenColor: new Color(0.2, 0.205, 0.22), specularIntensity: 0.35,
    side: FrontSide,
  });
  fur.name = 'possumFur'; fur.userData.weather = FUR_WEATHER;
  patch(fur, 'possumFur', (shader) => {
    furVertex(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', /*glsl*/`#include <color_fragment>
  {
    float sn = furStrand(vFurP);
    diffuseColor.rgb *= 0.84 + 0.24 * sn;
  }`);
  });

  // shells: each texel of a shell is a strand or nothing; coverage drops with the layer, tips go lighter (grizzled
  // guard hairs on the grey coat), roots darker (self-shadowing inside the coat)
  const shell = new MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0, sheen: 0.35, sheenRoughness: 0.7, sheenColor: new Color(0.22, 0.225, 0.24), specularIntensity: 0.3,
    alphaTest: 0.5, alphaToCoverage: true, side: FrontSide,
  });
  shell.name = 'possumFurShell'; shell.userData.weather = FUR_WEATHER;
  patch(shell, 'possumShell', (shader) => {
    furVertex(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', /*glsl*/`#include <color_fragment>
  {
    float sn = furStrand(vFurP);
    float lay = vFur.x;
    float cov = smoothstep(0.28 + lay * 0.34, 0.36 + lay * 0.34, sn) * step(0.3, vFur.y);
    diffuseColor.a = cov;
    float tip = smoothstep(0.55, 0.9, sn) * lay;
    diffuseColor.rgb *= mix(0.76, 1.0, lay) * (0.86 + 0.2 * sn);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.18 + vec3(0.008), tip * 0.5);
  }`);
  });

  // eyes + nose: wet, glossy; vertex colour carries black eye / pink nose
  const wet = new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1 });
  wet.name = 'possumWet'; wet.userData.weather = { wet: 0, dust: 0, snow: 0, edge: 0, beads: 0, macro: 0, porosity: 0.2 };

  // contact shadow: soft radial blob under the belly (sun is 14° high, so the shadow map alone leaves them hovering)
  const N = 64, d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + 0.5) / N * 2 - 1, v = (y + 0.5) / N * 2 - 1, r = Math.sqrt(u * u + v * v);
    const a = Math.max(0, 1 - r); const g = Math.round(255 * Math.pow(a, 1.6));
    const o = (y * N + x) * 4; d[o] = d[o + 1] = d[o + 2] = g; d[o + 3] = 255;
  }
  const tex = new DataTexture(d, N, N, RGBAFormat); tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.needsUpdate = true;
  const blob = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, alphaMap: tex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  blob.name = 'possumContact'; blob.userData.noWeather = true;

  return { fur, shell, wet, blob, list: [fur, shell, wet, blob] };
}
