// kea vertex animation — bone-free procedural rig in the vertex shader, driven per instance:
//   iA = (wing roll / flap, wing fold 0..1, wrist bend, head pitch)
//   iB = (head yaw, tail pitch, ruffle 0..1 (OFFENDED), body pitch about the hip)
//   iC = (leg tuck 0..1, tail fan, crest raise, wing sweep extra)
// The same deformation runs in the shadow depth material, so shadows flap with the bird.
import { MeshDepthMaterial, RGBADepthPacking } from 'three';
import { patch, after } from '../../cookbook/engine/patch.js';
import { PIV } from './geo.js';

const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const v3 = (a) => `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`;

export const KEA_GLSL = /*glsl*/`
attribute float aPart;
attribute vec4 iA;
attribute vec4 iB;
attribute vec4 iC;
mat3 kRx(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 kRy(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 kRz(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
void keaDeform(inout vec3 p, inout vec3 n) {
  vec3 kS = ${v3(PIV.S)};
  vec3 kN = ${v3(PIV.N)};
  vec3 kT = ${v3(PIV.T)};
  vec3 kH = ${v3(PIV.H)};
  float kW = ${f(PIV.WRIST)};
  vec3 rest = p;
  if (aPart > 1.5 && aPart < 2.5) {
    float side = p.x < 0.0 ? -1.0 : 1.0;
    vec3 q = p; q.x *= side; vec3 m = n; m.x *= side;
    q -= kS;
    float fold = iA.y;
    // hand (beyond the wrist): lags the flap and folds back further than the arm
    float w = smoothstep(kW - 0.04, kW + 0.03, q.x);
    mat3 Rh = kRz(iA.z * w) * kRy(-(fold * 0.55 + iC.w) * w);
    vec3 wq = q - vec3(kW, 0.0, 0.0);
    q = Rh * wq + vec3(kW, 0.0, 0.0); m = Rh * m;
    // fold: feathers slide over each other (span + chord shorten), the wing sweeps back and rolls onto the flank
    q.x *= mix(1.0, 0.8, fold); q.z *= mix(1.0, 0.5, fold);
    mat3 R = kRz(iA.x - fold * 1.0) * kRy(-fold * 1.42);
    q = R * q; m = R * m;
    q += vec3(-0.016, -0.02, 0.012) * fold;
    q += kS; q.x *= side; m.x *= side;
    p = q; n = m;
  } else if (aPart > 0.5 && aPart < 1.5) {
    vec3 q = p - kN;
    // crest: crown feathers lift (offended); ruffle: the head fluffs out
    float crown = smoothstep(0.02, 0.05, q.y) * smoothstep(-0.02, 0.03, -q.z - 0.0);
    q += n * (iC.z * 0.012 * crown + iB.z * 0.004 * smoothstep(-0.02, 0.02, q.z + 0.02));
    mat3 R = kRy(iB.x) * kRx(iA.w);
    p = R * q + kN; n = R * n;
  } else if (aPart > 2.5 && aPart < 3.5) {
    vec3 q = p - kT;
    q.x *= 1.0 + iC.y * smoothstep(0.0, 0.16, q.z);
    mat3 R = kRx(iB.y);
    p = R * q + kT; n = R * n;
  } else if (aPart > 3.5) {
    mat3 R = kRx(-iC.x * 1.45);
    p = R * (p - kH) + kH; n = R * n;
  }
  if (aPart < 0.5) {
    // ruffled (OFFENDED) contour feathers: a lumpy outward puff, strongest on the back and flanks
    float lump = 0.55 + 0.45 * sin(dot(rest, vec3(173.0, 231.0, 117.0))) * sin(dot(rest, vec3(-97.0, 61.0, 203.0)));
    p += n * iB.z * 0.009 * lump * (0.6 + 0.4 * n.y);
  }
  if (aPart < 3.5) {
    mat3 Rb = kRx(iB.w);
    p = Rb * (p - kH) + kH; n = Rb * n;
  }
}
`;

const declare = (vs) => vs.replace('#include <common>', '#include <common>\n' + KEA_GLSL);

export function patchKea(material) {
  return patch(material, 'kea', (shader) => {
    let vs = declare(shader.vertexShader);
    vs = after(vs, '#include <beginnormal_vertex>', 'vec3 kP = vec3(position);\nkeaDeform(kP, objectNormal);');
    vs = after(vs, '#include <begin_vertex>', 'transformed = kP;');
    shader.vertexShader = vs;
  });
}

export function keaDepthMaterial() {
  const d = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  patch(d, 'kea', (shader) => {
    let vs = declare(shader.vertexShader);
    vs = after(vs, '#include <begin_vertex>', '{ vec3 kNn = vec3(0.0, 1.0, 0.0); keaDeform(transformed, kNn); }');
    shader.vertexShader = vs;
  });
  return d;
}
