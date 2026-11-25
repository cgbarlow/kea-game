// vans — the three stranded rental campervans (the things you protect) and their tourists.
//   create(G, { mats, colliders }) → { list: Van[], update, reset(), dispose }
//   Van = { id, name, group, pos: Vector3, yaw, integrity 0..1, perches: Vector3[] (roof, mirrors, wipers),
//           doorPos: Vector3 (possum target), damage(amount, kind) , light }
//   Integrity drops through damage(); the game module reads it for win/lose. Allocation-free update.
//   showcase(G) → { cam, target }
import { Group, Vector3, Box3, MeshStandardMaterial, Color } from 'three';
import { Kit } from '../../cookbook/geo/kit.js';
import { LAYOUT as L } from '../../contracts.js';

function buildVan(k, V, color) {
  const { len, w, h } = V;
  // chassis (nose to -Z): box body on a cab-over front, 0.45 m ground clearance
  k.box(w, h - 0.75, len - 1.1, 'body', { at: [0, 0.45 + (h - 0.75) / 2 + 0.3, 0.55], r: 0.08, color });
  k.box(w, 1.45, 1.6, 'body', { at: [0, 0.45 + 0.72, -len / 2 + 0.8], r: 0.12, color });
  k.box(w - 0.06, 0.55, 1.2, 'body', { at: [0, 0.45 + 1.7, -len / 2 + 1.35], r: 0.15, color });           // luton over the cab
  k.box(w + 0.02, 0.7, 0.04, 'glass', { at: [0, 1.65, -len / 2 + 0.02], rot: [-0.18, 0, 0], r: 0.01 });    // windscreen
  for (const s of [-1, 1]) {
    k.box(0.04, 0.55, 0.9, 'glass', { at: [s * (w / 2 + 0.005), 1.6, -len / 2 + 0.85], r: 0.01 });       // cab side windows
    k.box(0.04, 0.6, 1.1, 'glass', { at: [s * (w / 2 + 0.005), 1.85, 0.8], r: 0.02 });                   // habitation windows
    k.box(0.05, 0.18, 0.12, 'dark', { at: [s * (w / 2 + 0.12), 1.75, -len / 2 + 0.4], r: 0.01 });       // mirrors
    for (const zz of [-len / 2 + 1.1, len / 2 - 1.2]) k.cyl(0.36, 0.24, 'tyre', { at: [s * (w / 2 - 0.15), 0.36, zz], rot: [0, 0, Math.PI / 2] });
  }
  k.box(w - 0.1, 0.3, 0.12, 'dark', { at: [0, 0.6, -len / 2 - 0.02], r: 0.03 });                          // bumper
  k.box(w - 0.1, 0.3, 0.12, 'dark', { at: [0, 0.6, len / 2 + 0.02], r: 0.03 });
  k.box(0.7, 0.12, 0.7, 'dark', { at: [0, h + 0.06, 1.4], r: 0.02 });                                     // roof vent
  k.box(0.04, 0.9, 0.04, 'dark', { at: [w * 0.25, 0.9, len / 2 + 0.02] });
  for (const s of [-1, 1]) k.box(0.18, 0.12, 0.02, 'tail', { at: [s * (w / 2 - 0.2), 1.0, len / 2 + 0.085], r: 0.01 });
}

export function create(G, { mats, colliders = [] }) {
  const root = new Group(); root.name = 'vans';
  const V = L.van;
  const glass = new MeshStandardMaterial({ color: new Color(0.02, 0.025, 0.03), roughness: 0.05, metalness: 0.0, envMapIntensity: 1.4 });
  const tail = new MeshStandardMaterial({ color: new Color(0.3, 0.02, 0.01), roughness: 0.3, emissive: new Color(0.6, 0.04, 0.02), emissiveIntensity: 0.5 });
  const list = [];
  for (const d of L.vans) {
    const k = new Kit();
    buildVan(k, V, d.color);
    // tourist in the driver's seat (head + torso, seen through the windscreen)
    k.box(0.45, 0.55, 0.3, 'cloth', { at: [0.45, 1.25, -V.len / 2 + 1.0], r: 0.08, color: 0x6a3a2a });
    k.box(0.2, 0.24, 0.22, 'skin', { at: [0.45, 1.68, -V.len / 2 + 1.0], r: 0.09 });
    k.bakeAO({ ground: 0 }); k.grime({ base: 0 });
    const g = k.build({ body: mats.vanPaint, glass, dark: mats.rubber, tyre: mats.rubber, tail, cloth: mats.cloth, skin: mats.skin, default: mats.vanPaint });
    g.position.set(d.x, 0, d.z); g.rotation.y = d.yaw;
    root.add(g);
    const pos = new Vector3(d.x, 0, d.z);
    const c = Math.cos(d.yaw), s = Math.sin(d.yaw);
    const local = (x, y, z, out = new Vector3()) => out.set(d.x + x * c + z * s, y, d.z - x * s + z * c);
    const hw = V.w / 2 + 0.05, hl = V.len / 2 + 0.1;
    colliders.push(new Box3(new Vector3(d.x - hw, 0, d.z - hl), new Vector3(d.x + hw, V.h, d.z + hl)));
    const van = {
      id: d.id, name: d.name, group: g, pos, yaw: d.yaw, integrity: 1, lastHit: -99, lastKind: '',
      perches: [local(V.w / 2 + 0.12, 1.88, -V.len / 2 + 0.4), local(0.3, 1.33, -V.len / 2 - 0.05), local(-0.5, V.h + 0.05, 1.2), local(0.5, V.h + 0.05, -0.3), local(0.0, V.h + 0.05, 2.4)],
      doorPos: local(V.w / 2 + 0.4, 0, 0.6),
      damage(amount, kind) { van.integrity = Math.max(0, van.integrity - amount); van.lastHit = G.t; van.lastKind = kind; G.emit('van:damage', van, amount, kind); },
    };
    list.push(van);
  }
  G.scene.add(root);
  const reset = () => { for (const v of list) { v.integrity = 1; v.lastHit = -99; } };
  return { list, root, reset, update() {}, dispose() { G.scene.remove(root); } };
}

export function showcase() { return { cam: [6, 1.7, -6], target: [0, 1.5, 4] }; }
