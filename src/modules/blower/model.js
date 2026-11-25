// blower/model — the ranger-issue backpack-less handheld leaf blower view model (graybox: kit primitives at real mm
// scale). buildBlower(mats) → Group in view-model space (camera at origin looking -Z; units metres).
// Overall ~0.95 m long: two-stroke engine housing + fuel tank, rear handle with throttle, front assist handle,
// 600 mm tapered blower tube with a flattened nozzle.
import { Group, MeshStandardMaterial, Color } from 'three';
import { Kit, tube } from '../../cookbook/geo/kit.js';
import { Vector3 } from 'three';

export function buildBlower() {
  const k = new Kit();
  const orange = 0xd8571c, grey = 0x3a3d40;
  // engine housing (rear) + recoil starter cover + fuel tank
  k.box(0.16, 0.2, 0.26, 'plastic', { at: [0, 0, 0.1], r: 0.03, color: orange });
  k.box(0.17, 0.12, 0.12, 'plastic', { at: [0, -0.13, 0.12], r: 0.025, color: 0xd8d0c0 });
  k.cyl(0.075, 0.03, 'plastic', { at: [0.095, 0.0, 0.1], rot: [0, 0, Math.PI / 2], color: grey });
  k.box(0.05, 0.05, 0.05, 'dark', { at: [0.0, -0.18, 0.12], r: 0.01 });     // fuel cap
  // rear handle loop + throttle trigger
  k.tube([new Vector3(0, 0.1, 0.22), new Vector3(0, 0.2, 0.18), new Vector3(0, 0.22, 0.02), new Vector3(0, 0.1, -0.03)], 0.016, 'dark', { radial: 12, curve: true, samples: 16 });
  k.box(0.018, 0.04, 0.03, 'plastic', { at: [0, 0.18, 0.06], r: 0.006, color: 0xd8d0c0 });
  // fan volute + tube (tapered: three sections)
  k.cyl(0.085, 0.09, 'plastic', { at: [0, 0.0, -0.06], rot: [Math.PI / 2, 0, 0], color: orange });
  k.add(tube([new Vector3(0, -0.01, -0.08), new Vector3(0, -0.03, -0.38)], 0.042, { radial: 20 }), 'plastic', { color: grey });
  k.add(tube([new Vector3(0, -0.03, -0.38), new Vector3(0, -0.05, -0.62)], 0.036, { radial: 20 }), 'plastic', { color: grey });
  k.box(0.085, 0.034, 0.08, 'plastic', { at: [0, -0.055, -0.66], r: 0.012, color: orange });   // flat nozzle
  // front assist handle
  k.tube([new Vector3(-0.05, 0.0, -0.2), new Vector3(-0.1, 0.06, -0.2), new Vector3(-0.1, 0.12, -0.2)], 0.014, 'dark', { radial: 10, curve: true, samples: 10 });
  // sticker plate (ranger issue)
  k.box(0.002, 0.06, 0.1, 'plastic', { at: [0.081, 0.03, 0.1], r: 0.001, color: 0xe8e0c8 });
  const plastic = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.0 });
  const dark = new MeshStandardMaterial({ color: new Color(0.03, 0.03, 0.03), roughness: 0.75 });
  plastic.userData.noAtmos = true; dark.userData.noAtmos = true;
  const g = new Group();
  g.add(k.build({ plastic, dark, default: plastic }, { castShadow: false, receiveShadow: false }));
  g.userData.nozzle = new Vector3(0, -0.055, -0.7);
  return g;
}
