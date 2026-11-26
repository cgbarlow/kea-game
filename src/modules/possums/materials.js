// possums/materials — fur base (sheen + strand albedo), fur shells (alpha-to-coverage strands, dark roots / silver
// tips), wet eyes + nose (baked catchlight + sun/env glint), and the contact shadow blob.
// All lit materials go through finalizeMaterials (main.js) for atmos + weathering; the weathering opts below keep
// world-space macro/snow/dust off (they would swim across a moving animal) and leave a light damp film.
import { MeshPhysicalMaterial, MeshBasicMaterial, DataTexture, RGBAFormat, LinearFilter, Color, FrontSide, Vector4 } from 'three';
import { patch } from '../../cookbook/engine/patch.js';

const FUR_WEATHER = { wet: 0, dust: 0, snow: 0, edge: 0, beads: 0, macro: 0, porosity: 0.7 };

const FUR_GLSL = /*glsl*/`
attribute vec2 aFur;
varying vec2 vFur;
varying vec3 vFurP;
uniform vec4 uRuffle;   // xyz = airflow direction (possum local), w = strength 0..1
uniform float uRufPh;   // flutter phase (advanced by the sim, frozen in captures)
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
// strands run along the body (z); the lattice is rotated about z per octave so no woven grid shows
float furStrand(vec3 p) {
  vec3 a = vec3(p.x * 0.80 - p.y * 0.60, p.x * 0.60 + p.y * 0.80, p.z + p.x * 0.3);
  vec3 b = vec3(p.x * 0.28 + p.y * 0.96, -p.x * 0.96 + p.y * 0.28, p.z - p.y * 0.25);
  return furN(a * vec3(300.0, 300.0, 80.0)) * 0.6 + furN(b * vec3(690.0, 690.0, 190.0) + 3.1) * 0.4;
}
`;

// ruffle: in the airflow the guard hairs stream downwind and stand up off the skin, more at the outer shells
const RUFFLE = /*glsl*/`
  {
    vec3 rp = position * 70.0;
    float fn = 0.5 * sin(rp.x * 1.7 + rp.z * 0.9 + uRufPh) + 0.5 * sin(rp.y * 2.3 - rp.z * 1.3 + uRufPh * 1.37);
    float k = uRuffle.w * aFur.x * aFur.x * min(aFur.y, 1.0); // tail fur is longer but no floppier
    transformed += (uRuffle.xyz * (0.022 + 0.012 * fn) + objectNormal * (0.012 + 0.008 * fn)) * k;
  }`;
function furVertex(shader, mat) {
  shader.uniforms.uRuffle = mat.userData.ruffle;
  shader.uniforms.uRufPh = mat.userData.rufPh;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + FUR_GLSL)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFur = aFur;\nvFurP = position;' + (mat.userData.ruffles ? RUFFLE : ''));
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + FUR_FRAG);
}

export function createPossumMaterials() {
  // base coat: soft sheen (velvet response at grazing angles), strand-level albedo breakup
  const fur = new MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new Color(0.34, 0.34, 0.36), specularIntensity: 0.2,
    side: FrontSide,
  });
  fur.name = 'possumFur'; fur.userData.weather = FUR_WEATHER;
  fur.userData.ruffle = { value: new Vector4(0, 0, 1, 0) }; fur.userData.rufPh = { value: 0 };
  patch(fur, 'possumFur', (shader) => {
    furVertex(shader, fur);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', /*glsl*/`#include <color_fragment>
  {
    float sn = furStrand(vFurP);
    diffuseColor.rgb *= 0.66 + 0.55 * sn;
  }`);
  });

  // shells: each texel of a shell is a strand or nothing; coverage drops with the layer, tips go lighter (grizzled
  // guard hairs on the grey coat), roots darker (self-shadowing inside the coat). One material per possum so each
  // carries its own ruffle uniform (same program: identical patch keys).
  const shellFor = () => {
    const shell = new MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.92, metalness: 0, sheen: 0.5, sheenRoughness: 0.55, sheenColor: new Color(0.4, 0.4, 0.42), specularIntensity: 0.2,
      alphaTest: 0.5, alphaToCoverage: true, side: FrontSide,
    });
    shell.name = 'possumFurShell'; shell.userData.weather = FUR_WEATHER;
    shell.userData.ruffle = { value: new Vector4(0, 0, 1, 0) }; shell.userData.rufPh = { value: 0 }; shell.userData.ruffles = true;
    patch(shell, 'possumShell', (shader) => {
      furVertex(shader, shell);
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', /*glsl*/`#include <color_fragment>
  {
    float sn = furStrand(vFurP);
    float lay = vFur.x;
    float cov = smoothstep(0.26 + lay * 0.34, 0.34 + lay * 0.34, sn) * step(0.3, vFur.y);
    diffuseColor.a = cov;
    float tip = smoothstep(0.55, 0.9, sn) * lay;
    diffuseColor.rgb *= mix(0.72, 1.0, lay) * (0.86 + 0.2 * sn);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.35 + vec3(0.012), tip * 0.6);
  }`);
    });
    shells.push(shell);
    return shell;
  };
  const shells = [];

  // eyes + nose: wet, glossy but no clearcoat (its grazing Fresnel ringed the eyes white); vertex colour carries
  // the black eye + baked catchlight / pink nose
  const wet = new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, metalness: 0, clearcoat: 0, specularIntensity: 0.5, envMapIntensity: 0.25 });
  wet.name = 'possumWet'; wet.userData.weather = { wet: 0, dust: 0, snow: 0, edge: 0, beads: 0, macro: 0, porosity: 0.2 };

  // contact shadow: soft radial blob under the belly (sun is 14° high, so the shadow map alone leaves them hovering)
  const N = 64, d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + 0.5) / N * 2 - 1, v = (y + 0.5) / N * 2 - 1, r = Math.sqrt(u * u + v * v);
    const a = Math.max(0, 1 - r); const g = Math.round(255 * Math.pow(a, 1.6));
    const o = (y * N + x) * 4; d[o] = d[o + 1] = d[o + 2] = g; d[o + 3] = 255;
  }
  const tex = new DataTexture(d, N, N, RGBAFormat); tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.needsUpdate = true;
  const blob = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.72, alphaMap: tex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  blob.name = 'possumContact'; blob.userData.noWeather = true;
  // down-sun streak: same radial falloff squeezed into a tapering strip (dense at the feet, fading at the tip)
  const S = 32, sd = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S * 2 - 1, v = (y + 0.5) / S; // v 0 = feet .. 1 = tip
    const w = 1 - Math.min(1, Math.abs(u) / (1 - 0.55 * v)), g = Math.round(255 * Math.pow(Math.max(0, w), 1.4) * Math.pow(1 - v, 1.3) * Math.min(1, v * 6 + 0.25));
    const o = (y * S + x) * 4; sd[o] = sd[o + 1] = sd[o + 2] = g; sd[o + 3] = 255;
  }
  const stex = new DataTexture(sd, S, S, RGBAFormat); stex.magFilter = LinearFilter; stex.minFilter = LinearFilter; stex.needsUpdate = true;
  const streak = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, alphaMap: stex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  streak.name = 'possumSunShadow'; streak.userData.noWeather = true;

  const shell = shellFor(); // the shared default (list[0] / warmup); per-possum ones come from shellFor()
  return { fur, shell, shellFor, wet, blob, streak, list: [fur, wet, blob, streak], shells };
}
