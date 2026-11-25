// possums — the ground antagonist. Brushtail possums waddle out of the beech forest toward a campervan's door and
// get in (van.damage 'possum'). The blower pushes them along the ground (low friction while airborne-ish); blown
// into a trap box mouth they are TRAPPED (removed, counted). Non-lethal on screen, as far as the HUD is concerned.
//   create(G, { vans, blower, traps, colliders }) → { list, spawn(n), active(), trapped, reset(), update, materials }
//   Possum = { state: 'idle'|'walk'|'raid'|'blown'|'trapped', pos, vel, van, mesh, t }
//   Events: 'possum:raid' (p, van), 'possum:blown' (p), 'possum:trapped' (p, trapIndex)
//   showcase(G) → { cam, target }
import { Group, Vector3, MeshStandardMaterial } from 'three';
import { Kit, tube } from '../../cookbook/geo/kit.js';
import { LAYOUT as L } from '../../contracts.js';

const MAX = 8, WALK = 1.6, TRAP_R = 0.75;
const _a = new Vector3(), _f = new Vector3();

function possumMesh(mat) {
  const k = new Kit();
  k.box(0.26, 0.24, 0.48, 'b', { at: [0, 0.2, 0], r: 0.1, color: 0x5a524a });            // body (grey-brown)
  k.box(0.16, 0.14, 0.16, 'b', { at: [0, 0.27, -0.29], r: 0.06, color: 0x6a625a });       // head
  for (const s of [-1, 1]) k.box(0.04, 0.06, 0.02, 'b', { at: [s * 0.05, 0.37, -0.27], r: 0.01, color: 0x3a3430 }); // ears
  k.add(tubeTail(), 'b', { color: 0x1e1a18 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, 0.1, 0.06, 'b', { at: [sx * 0.09, 0.05, sz * 0.15], r: 0.015, color: 0x2a2624 });
  for (const s of [-1, 1]) k.box(0.025, 0.025, 0.01, 'eye', { at: [s * 0.045, 0.3, -0.37], r: 0.008 });
  return k.build({ b: mat, eye: EYE }, { castShadow: true, receiveShadow: true });
}
function tubeTail() { return tube([new Vector3(0, 0.2, 0.22), new Vector3(0, 0.12, 0.42), new Vector3(0.05, 0.06, 0.6)], 0.03, { radial: 8, curve: true, samples: 10 }); }
const EYE = new MeshStandardMaterial({ color: 0x050505, roughness: 0.1 });

export function create(G, { vans, blower, traps = [] } = {}) {
  const root = new Group(); root.name = 'possums';
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const list = [];
  for (let i = 0; i < MAX; i++) {
    const mesh = possumMesh(mat); mesh.visible = false; root.add(mesh);
    list.push({ i, state: 'idle', pos: new Vector3(), vel: new Vector3(), van: null, mesh, t: 0 });
  }
  G.scene.add(root);
  const vanList = () => (vans && vans.list) || [];
  const API = { list, trapped: 0, materials: [mat, EYE], frozen: false };

  API.spawn = (n = 1) => {
    let c = 0;
    for (const p of list) {
      if (c >= n) break; if (p.state !== 'idle') continue;
      const D = L.dens[(p.i + c) % L.dens.length];
      p.pos.set(D[0] + (Math.random() - 0.5) * 3, 0, Math.min(D[1], 19.5));
      const vs = vanList(); if (!vs.length) return c;
      p.van = vs[Math.floor(Math.random() * vs.length)];
      p.state = 'walk'; p.vel.set(0, 0, 0); p.mesh.visible = true; p.t = 0; c++;
    }
    return c;
  };
  API.active = () => { let c = 0; for (const p of list) if (p.state === 'walk' || p.state === 'raid' || p.state === 'blown') c++; return c; };
  API.reset = () => { for (const p of list) { p.state = 'idle'; p.mesh.visible = false; } API.trapped = 0; };

  API.update = (dt) => {
    if (G.paused || API.frozen) return;
    for (const p of list) {
      if (p.state === 'idle' || p.state === 'trapped') continue;
      if (p.state === 'walk') {
        _a.subVectors(p.van.doorPos, p.pos); _a.y = 0; const d = _a.length();
        p.vel.lerp(_a.multiplyScalar(WALK / Math.max(d, 1e-3)), Math.min(1, dt * 4));
        if (d < 0.4) { p.state = 'raid'; p.t = 0; p.vel.set(0, 0, 0); G.emit('possum:raid', p, p.van); }
      } else if (p.state === 'raid') {
        p.van.damage(dt * 0.012, 'possum');
      } else if (p.state === 'blown') {
        p.vel.multiplyScalar(1 - Math.min(1, dt * 1.6)); p.t += dt;
        if (p.vel.lengthSq() < 0.2 && p.t > 0.6) { p.state = 'walk'; }
      }
      if (blower && p.state !== 'trapped') {
        const s = blower.strengthAt(p.pos);
        if (s > 0.08) {
          blower.forceAt(p.pos, _f); _f.y = 0;
          p.vel.addScaledVector(_f, dt * 0.6);
          if (p.state !== 'blown') { p.state = 'blown'; G.emit('possum:blown', p); }
          p.t = 0;
        }
      }
      p.pos.addScaledVector(p.vel, dt); p.pos.y = 0;
      // trap boxes swallow possums blown into their mouths
      for (let ti = 0; ti < traps.length; ti++) {
        const m = traps[ti].mouth;
        const dx = p.pos.x - m[0], dz = p.pos.z - m[2];
        if (dx * dx + dz * dz < TRAP_R * TRAP_R && p.state === 'blown') { p.state = 'trapped'; p.mesh.visible = false; API.trapped++; G.emit('possum:trapped', p, ti); break; }
      }
      p.mesh.position.copy(p.pos);
      if (p.vel.lengthSq() > 0.01) p.mesh.rotation.y = Math.atan2(-p.vel.x, -p.vel.z);
      p.mesh.rotation.z = p.state === 'blown' ? Math.sin(G.t * 12) * 0.3 : 0;
    }
  };

  if (G.params.get('shot') || G.params.get('show') === 'possums') {
    const v = vanList()[1];
    if (v) { const p = list[0]; p.van = v; p.state = 'walk'; p.mesh.visible = true; p.pos.set(v.doorPos.x + 0.8, 0, v.doorPos.z - 2.2); p.mesh.position.copy(p.pos); p.mesh.rotation.y = 2.4; }
    API.frozen = true;
  }
  return API;
}

export function showcase() { return { cam: [3.6, 1.2, 0.2], target: [2.3, 0.2, 2.4] }; }
