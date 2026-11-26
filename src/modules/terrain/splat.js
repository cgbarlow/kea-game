// terrain/splat — world-space recolour of the terrain material (runs after <color_fragment>, before weathering, so the
// global snow/wet layers still sit on top). Per-vertex masks come in the `aTer` attribute from the mesh builder:
//   x forest floor, y fresh slip debris, z curvature (-1 rib .. +1 gully), w road continuation (asphalt beyond the slab).
// Slope/height/noise decide tussock vs scree vs rock. Snow: altitude x slope hold, loaded on lee (downwind) faces and
// in gullies, scoured off ribs; its edges are streaked down the fall line and along the wind, not blotched.
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
float terSnow;
// streak noise stretched along the fall line: two fixed frames (streaks along z, streaks along x) blended by the
// downslope direction, so the coordinates never rotate per pixel (a rotating frame tears where slopes turn)
float terAniso(vec2 w, vec2 fd, vec2 f, float o) {
  float a = terNoise(vec2(w.x * f.x, w.y * f.y) + o), b = terNoise(vec2(w.y * f.x, w.x * f.y) + o + 17.0);
  float k = smoothstep(0.2, 0.8, fd.y * fd.y / (dot(fd, fd) + 1e-4));
  return mix(b, a, k);
}
float terFbm(vec2 p) { return 0.5 * terNoise(p) + 0.3 * terNoise(p * 2.13 + 7.1) + 0.2 * terNoise(p * 4.37 + 3.3); }`);
    s.fragmentShader = after(s.fragmentShader, '#include <color_fragment>', /*glsl*/`
{
  vec3 tn = normalize(vTerN);
  vec2 w = vTerW.xz;
  float sl = 1.0 - tn.y;
  float m0 = terFbm(w * 0.0045 + 11.0);
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
  float rockW = smoothstep(0.5, 0.75, sl + (m3 - 0.5) * 0.15);
  c = mix(c, rockc, rockW);
  // greywacke bedding: near-horizontal strata bands, warped and dipping, strongest on bare steep rock; fade before aliasing
  float pxS = length(fwidth(vTerW));
  float sy = hy * 0.075 + (m1 - 0.5) * 2.2 + w.x * 0.006 + terNoise(w * 0.03) * 1.1;
  float band = smoothstep(0.2, 0.8, abs(fract(sy) - 0.5) * 2.0) * 0.55 + 0.45 * terNoise(vec2(sy * 2.3, w.y * 0.015 + w.x * 0.01));
  float strata = smoothstep(0.3, 0.65, sl) * (1.0 - smoothstep(2.0, 5.0, pxS)) * smoothstep(0.3, 0.6, m2 * 0.6 + m1 * 0.4);   // patchy, not contour lines
  c *= mix(1.0, 0.84 + 0.26 * band, strata);
  // ridge / gully relief from curvature: gullies hold shade and damp, ribs catch light
  float cvA = vTer.z;
  c *= 1.0 - 0.28 * max(cvA, 0.0) * (1.0 - vTer.x) + 0.16 * max(-cvA, 0.0);
  // fall-line frame: scree channels / seep stains run downhill; flat ground falls back to an isotropic frame
  vec2 fd = tn.xz;
  float onSlope = smoothstep(0.04, 0.16, sl);
  float chan = terAniso(w, fd, vec2(0.11, 0.012), 2.3);
  float chanF = terAniso(w, fd, vec2(0.42, 0.05), 8.1);
  c *= mix(1.0, 0.72 + 0.5 * smoothstep(0.25, 0.8, chan * 0.7 + chanF * 0.3), onSlope * (1.0 - vTer.x) * 0.8);   // pale chutes, dark wet seeps
  // macro: warm/cool and dry/damp drift over hundreds of metres so no slope reads as one tile
  c *= mix(vec3(0.86, 0.9, 0.98), vec3(1.1, 1.02, 0.9), m0) * (0.85 + 0.3 * smoothstep(0.25, 0.75, m1 * 0.6 + m0 * 0.4));
  // forest floor: dark beech litter, moss cushions, roots
  vec3 litter = mix(vec3(0.062, 0.045, 0.03), vec3(0.11, 0.075, 0.042), m3);
  litter = mix(litter, vec3(0.06, 0.085, 0.03), smoothstep(0.5, 0.75, m2) * 0.8);
  c = mix(c, litter, vTer.x);
  // fresh slip debris: grey-brown wet clay and broken rock, pale clasts
  vec3 debris = mix(vec3(0.21, 0.21, 0.205), vec3(0.40, 0.395, 0.385), smoothstep(0.3, 0.8, m3 * 0.5 + m4 * 0.5));   // raw grey schist: fresh, unweathered
  c = mix(c, debris, vTer.y);
  // road continuation beyond the slab
  c = mix(c, vec3(0.05, 0.05, 0.055) * (0.85 + 0.3 * m4), vTer.w);
  // baked rock luminance as detail; faded with pixel footprint so the bake's tile never shows on distant slopes
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float pxD = length(fwidth(w));
  c *= mix(pow(clamp(lum / uTerP.x, 0.4, 1.9), 0.75), 1.0, smoothstep(0.08, 0.6, pxD));
  // lying snow. alt: snow line with a slow wander; hold: steep faces shed; lee faces (downwind, +X) load, ribs scour;
  // gullies carry snow well below the line. Edges are broken by fall-line streaks and wind-aligned sastrugi.
  float curv = vTer.z;
  vec2 wd = vec2(0.95, 0.31);
  float lee = clamp(dot(tn.xz, wd) * 3.0, -1.0, 1.0) * onSlope;
  float alt = smoothstep(uTerP.y - 70.0, uTerP.y + 25.0, hy + (m0 - 0.5) * 50.0);
  float px = length(fwidth(w));
  float hiA = 1.0 - smoothstep(0.6, 3.0, px);                                  // fine streaks only where they resolve
  vec2 wf = vec2(dot(w, vec2(-wd.y, wd.x)), dot(w, wd));
  float streak = terAniso(w, fd, vec2(0.16, 0.012), 1.7) * 0.4 + terAniso(w, fd, vec2(0.06, 0.005), 5.9) * 0.2 + chan * 0.25 * onSlope
               + terNoise(vec2(wf.x * 0.09, wf.y * 0.01)) * (0.4 - 0.25 * onSlope) + (chanF - 0.5) * 0.3 * hiA;
  // benches and cols take a blanket; steep faces only hold it in couloirs and on lee faces, ribs stay bare
  float flatHold = smoothstep(0.36, 0.14, sl) * (0.9 + 0.2 * lee);
  float couloir = smoothstep(-0.5, 0.2, curv + 0.3 * lee) * smoothstep(0.9, 0.5, sl);
  float load = alt * max(flatHold, couloir) - 0.25 * alt * max(-curv - 0.4, 0.0);
  float gul = max(curv, 0.0) * smoothstep(uTerP.y - 120.0, uTerP.y - 30.0, hy) * smoothstep(0.7, 0.3, sl) * 1.3;
  // on slopes the cover breaks into fall-line runnels (ridged streak noise), so pocket hollows never read as round blobs
  float run = 1.0 - abs(terAniso(w, fd, vec2(0.12, 0.01), 3.1) * 2.0 - 1.0);
  run = run * run * (0.6 + 0.4 * terAniso(w, fd, vec2(0.03, 0.006), 9.4));
  float L = max(load, gul);
  L = mix(L, L * (0.35 + 1.25 * run), onSlope * smoothstep(0.95, 0.4, L));
  float edgeN = (terAniso(w, fd, vec2(0.35, 0.03), 4.4) - 0.5) * 0.4 * hiA * onSlope;
  float sn = (L + edgeN + (streak - 0.45) * mix(0.55, 0.3, onSlope)) * (1.0 - vTer.x) * (1.0 - vTer.w) * smoothstep(4.0, 14.0, hy);
  // on the high massif (above the snow line proper) snow sits by slope: benches/ledges (normal.y > ~0.75) hold it
  float hiM = smoothstep(uTerP.y - 40.0, uTerP.y + 40.0, hy);
  float slopeHold = smoothstep(0.68, 0.84, tn.y + (m2 - 0.5) * 0.18 + (streak - 0.45) * 0.12);
  sn = mix(sn, max(sn * 0.6, slopeHold * 0.95 + (m1 - 0.5) * 0.2), hiM * (1.0 - vTer.x));
  float snowA = smoothstep(0.30, 0.64, sn);                                    // soft edge, no cut-out blobs
  // steep faces: what holds is striated (runnels between rock ribs), never a solid sheet
  float steep = smoothstep(0.05, 0.3, sl) * hiA;
  float rib = 1.0 - abs(terAniso(w, fd, vec2(0.5, 0.025), 6.6) * 2.0 - 1.0);
  snowA *= mix(1.0, smoothstep(0.1, 0.5, rib + 0.3 * smoothstep(0.75, 1.1, sn)), steep * 0.9);
  c *= 1.0 - 0.28 * alt * (1.0 - vTer.x);                                     // high rock is darker, wetter: snow reads crisp against it
  vec3 snowc = mix(vec3(0.42, 0.48, 0.58), vec3(0.53, 0.555, 0.60), smoothstep(0.42, 0.85, sn)) * (0.93 + 0.07 * m4);
  float sunF = clamp(dot(tn, normalize(vec3(-0.91, 0.24, -0.33))) * 2.5 + 0.3, 0.0, 1.0);
  snowc *= mix(vec3(0.85, 0.9, 1.0), vec3(1.0), sunF);                         // faces turned from the sun: blue snow
  c = mix(c, snowc, snowA);
  terSnow = snowA;
  // aerial perspective (albedo part only; atmos adds the inscatter): far slopes desaturate and flatten toward a cool grey
  float dCam = length(vTerW - cameraPosition);
  float ap = smoothstep(120.0, 650.0, dCam);
  float lc = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, mix(vec3(lc), vec3(0.20, 0.215, 0.24), 0.35) * vec3(0.95, 0.98, 1.06), ap * 0.55);
  diffuseColor.rgb = c;
}`);
    s.fragmentShader = after(s.fragmentShader, '#include <roughnessmap_fragment>', /*glsl*/`
  roughnessFactor = mix(roughnessFactor, 0.55, vTer.w * 0.6);
  roughnessFactor = mix(roughnessFactor, 0.72, terSnow);`);
  });
}
