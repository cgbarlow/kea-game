// ranger — v2 kea mode.
//   create(G, { vans, colliders, possums }) → { group, position, state, firing, origin, dir, range, strengthAt(p), forceAt(p,out),
//     enabled, reset(), update, materials }
// PLACEHOLDER (lead): the ranger owner replaces this file.
import { Group, Vector3 } from 'three';
export function create(G) {
  const group = new Group(); G.scene.add(group);
  return { group, position: new Vector3(), state: 'patrol', firing: false, origin: new Vector3(), dir: new Vector3(0, 0, -1), range: 0,
    strengthAt: () => 0, forceAt: (p, o) => o.set(0, 0, 0), enabled: false, reset() {}, update() {}, materials: [] };
}
export function showcase() { const c = [6, 1.7, -6, 0, 1.2, 0]; return { cam: c.slice(0, 3), target: c.slice(3) }; }
