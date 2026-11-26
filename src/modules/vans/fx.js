// vans/fx — per-van damage/animation shader patch shared by every van material, real windscreen glass, lens glow.
// One vec4 vertex attribute `aFx` per kit bucket (written after Kit.build from a geo → flags map):
//   x  integrity rule: > 0 the part exists while integrity > x (lost below); < 0 it appears once integrity <= -x
//   y  part: 1 = habitation door (swings about the hinge uHinge by uDoorA), 2 = driver's head (turns by uHeadA)
//   z  constant glow (lens: cab/interior lamp)        w  hazard-indicator blink (lens)
// Uniforms are per van (one object shared by that van's materials + its shadow-depth material).
import { MeshStandardMaterial, MeshDepthMaterial, RGBADepthPacking, Color, Vector2, Vector3, Float32BufferAttribute } from 'three';
import { patch, after } from '../../cookbook/engine/patch.js';

const VS_DECL = /*glsl*/`
attribute vec4 aFx;
varying vec4 vFx;
uniform float uVInt;
uniform float uDoorA;
uniform vec2 uHinge;
uniform float uHeadA;
uniform vec3 uHeadP;
vec3 vfxRotY(vec3 p, vec3 c, float a) { vec3 d = p - c; float s = sin(a), k = cos(a); return c + vec3(d.x * k + d.z * s, d.y, -d.x * s + d.z * k); }
float vfxVis() {
  if (aFx.x > 0.0 && uVInt <= aFx.x) return 0.0;
  if (aFx.x < 0.0 && uVInt > -aFx.x) return 0.0;
  return 1.0;
}
float vfxAngle() { return aFx.y > 0.5 && aFx.y < 1.5 ? uDoorA : (aFx.y > 1.5 ? uHeadA : 0.0); }
vec3 vfxPivot() { return aFx.y > 1.5 ? uHeadP : vec3(uHinge.x, 0.0, uHinge.y); }
`;

export function vanUniforms() {
  return { uVInt: { value: 1 }, uDoorA: { value: 0 }, uHinge: { value: new Vector2() }, uHeadA: { value: 0 }, uHeadP: { value: new Vector3() }, uBlink: { value: 0 }, uGlow: { value: 1 } };
}

// apply the vertex part of the patch (visibility + door/head rotation) to any material, incl. depth materials
export function patchVan(mat, U, { lens = false } = {}) {
  patch(mat, lens ? 'vanfxL' : 'vanfx', (s) => {
    for (const k in U) s.uniforms[k] = U[k];
    s.vertexShader = after(s.vertexShader, '#include <common>', VS_DECL);
    s.vertexShader = after(s.vertexShader, '#include <beginnormal_vertex>', 'objectNormal = vfxRotY(objectNormal, vec3(0.0), vfxAngle());');
    s.vertexShader = after(s.vertexShader, '#include <begin_vertex>', 'vFx = aFx; transformed = vfxRotY(transformed, vfxPivot(), vfxAngle()) * vfxVis();');
    if (lens) {
      s.fragmentShader = after(s.fragmentShader, '#include <common>', 'varying vec4 vFx;\nuniform float uBlink;\nuniform float uGlow;');
      s.fragmentShader = after(s.fragmentShader, '#include <emissivemap_fragment>',
        '#ifdef USE_COLOR\n totalEmissiveRadiance += vColor.rgb * (vFx.z * uGlow * 2.2 + vFx.w * uBlink * 9.0);\n#endif');
    }
  });
  mat.userData.vanFx = true;
  return mat;
}

// Glass: alpha blends only the diffuse/transmitted part; reflections (env + sun specular) stay at full strength,
// like real glass (premultiplied output: rgb = diffuse*a + specular).
export function glassMaterial(U) {
  const m = new MeshStandardMaterial({ color: new Color(0.035, 0.042, 0.05), roughness: 0.035, metalness: 0, transparent: true, opacity: 0.34, premultipliedAlpha: true, envMapIntensity: 1.6, vertexColors: true, depthWrite: false });
  m.userData.noWeather = true;
  patchVan(m, U);
  patch(m, 'vanglass', (s) => {
    s.fragmentShader = s.fragmentShader
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n gl_FragColor = vec4(totalDiffuse * diffuseColor.a + totalSpecular + totalEmissiveRadiance, diffuseColor.a);')
      .replace('#include <premultiplied_alpha_fragment>', '');
  });
  return m;
}

export function lensMaterial(U) {
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0, vertexColors: true, emissive: 0x000000, envMapIntensity: 1.3 });
  m.userData.weather = { preset: 'prop', dust: 0.4 };
  return patchVan(m, U, { lens: true });
}

export function depthMaterial(U) {
  return patchVan(new MeshDepthMaterial({ depthPacking: RGBADepthPacking }), U);
}

// After k.build(): write aFx on every bucket mesh from flags (Map geo → [x,y,z,w]) in the Kit's merge order.
export function writeFx(k, group, flags) {
  for (const mesh of group.children) {
    const key = mesh.name.slice(4), geos = k.buckets.get(key); if (!geos) continue;
    const n = mesh.geometry.attributes.position.count, a = new Float32Array(n * 4);
    let o = 0;
    for (const g of geos) {
      const c = g.attributes.position.count, f = flags.get(g);
      if (f) for (let i = 0; i < c; i++) a.set(f, (o + i) * 4);
      o += c;
    }
    mesh.geometry.setAttribute('aFx', new Float32BufferAttribute(a, 4));
  }
}
