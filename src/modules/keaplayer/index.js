// keaplayer — v2 kea mode.
//   create(G, { input, colliders, terrain, vans }) → { overlay:{scene,camera}, position, velocity, yaw, pitch, grounded, perched,
//     flying, stamina, offended, carrying, pulling, tumble, enabled, teleport(p,yaw), knock(force), update }
// PLACEHOLDER (lead): the keaplayer owner replaces this file.
import { Scene, PerspectiveCamera, Vector3 } from 'three';
import { KEA_PLAYER as K, LAYOUT as L } from '../../contracts.js';
export function create(G) {
  return { overlay: { scene: new Scene(), camera: new PerspectiveCamera(K.viewFov, G.width / G.height, 0.01, 10) },
    position: new Vector3().fromArray(L.keaSpawn), velocity: new Vector3(), yaw: L.keaSpawnYaw, pitch: 0, grounded: true, perched: false,
    flying: false, stamina: 1, offended: 0, carrying: null, pulling: 0, tumble: 0, enabled: false, teleport() {}, knock() {}, update() {} };
}
export function showcase() { const c = [-4, 4.3, -30.5, 0, 1, 2]; return { cam: c.slice(0, 3), target: c.slice(3) }; }
