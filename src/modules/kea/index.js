// kea — the flying, non-lethal antagonist. Alpine parrots glide in off the range, land on campervans and strip
// rubber seals/wipers (van.damage). Blown off, they tumble away, retreat to the range, then return OFFENDED
// (faster, peck harder, and the HUD says so). Never killed.
//   create(G, { vans, blower }) → { list: Kea[], spawn(n), active(), reset(), update, materials }
//   Kea = { state: 'idle'|'approach'|'perched'|'blown'|'retreat', pos, vel, van, perch, offended (count), mesh }
//   Events: 'kea:land' (kea, van), 'kea:blown' (kea), 'kea:return' (kea)  — HUD/audio/game listen.
//   showcase(G) → { cam, target }
// Allocation-free update (scratch vectors at module scope).
import { Group, Vector3, MeshStandardMaterial, Color } from 'three';
import { Kit } from '../../cookbook/geo/kit.js';
import { LAYOUT as L } from '../../contracts.js';

const MAX = 10;
const _a = new Vector3(), _f = new Vector3();

function keaMesh(mat) {
  const k = new Kit();
  k.box(0.14, 0.13, 0.34, 'b', { at: [0, 0.16, 0], r: 0.05, color: 0x56663a });           // body (olive)
  k.box(0.1, 0.1, 0.1, 'b', { at: [0, 0.27, -0.17], r: 0.045, color: 0x5d6a40 });          // head
  k.box(0.03, 0.05, 0.06, 'b', { at: [0, 0.25, -0.24], rot: [0.5, 0, 0], r: 0.012, color: 0x2a2a28 }); // beak
  k.box(0.1, 0.03, 0.22, 'b', { at: [0, 0.14, 0.24], r: 0.012, color: 0x45532e });         // tail
  for (const s of [-1, 1]) {
    k.box(0.36, 0.015, 0.16, 'b', { at: [s * 0.24, 0.2, 0.02], r: 0.006, color: 0xc0501e }); // wings (orange underside)
    k.box(0.015, 0.1, 0.015, 'b', { at: [s * 0.04, 0.05, 0], r: 0.004, color: 0x3a3632 });  // legs
  }
  return k.build({ b: mat }, { castShadow: true, receiveShadow: true });
}

export function create(G, { vans, blower } = {}) {
  const root = new Group(); root.name = 'kea';
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const list = [];
  for (let i = 0; i < MAX; i++) {
    const mesh = keaMesh(mat); mesh.visible = false; root.add(mesh);
    list.push({ i, state: 'idle', pos: new Vector3(), vel: new Vector3(), van: null, perch: null, offended: 0, t: 0, wait: 0, mesh, spin: 0 });
  }
  G.scene.add(root);
  const vanList = () => (vans && vans.list) || [];

  function launch(k) {
    const R = L.keaRoost[k.i % L.keaRoost.length];
    k.pos.set(R[0] + (Math.random() - 0.5) * 10, R[1], R[2]);
    const vs = vanList(); if (!vs.length) return;
    k.van = vs[Math.floor(Math.random() * vs.length)];
    k.perch = k.van.perches[Math.floor(Math.random() * k.van.perches.length)];
    k.state = 'approach'; k.mesh.visible = true; k.vel.set(0, 0, 0);
  }
  const API = { list, materials: [mat] };
  API.spawn = (n = 1) => { let c = 0; for (const k of list) { if (c >= n) break; if (k.state === 'idle') { launch(k); c++; } } return c; };
  API.active = () => { let c = 0; for (const k of list) if (k.state !== 'idle') c++; return c; };
  API.reset = () => { for (const k of list) { k.state = 'idle'; k.mesh.visible = false; k.offended = 0; } };

  API.frozen = false;                                  // captures freeze the dressed tableau
  API.update = (dt) => {
    if (G.paused || API.frozen) return;
    for (const k of list) {
      if (k.state === 'idle') continue;
      const speed = 7 + k.offended * 1.5;
      if (k.state === 'approach') {
        _a.subVectors(k.perch, k.pos); const d = _a.length();
        _a.multiplyScalar(1 / Math.max(d, 1e-3));
        k.vel.lerp(_f.copy(_a).multiplyScalar(Math.min(speed, d * 2.5 + 0.5)), Math.min(1, dt * 2.5));
        if (d < 0.25) { k.state = 'perched'; k.pos.copy(k.perch); k.vel.set(0, 0, 0); k.t = 0; G.emit('kea:land', k, k.van); }
      } else if (k.state === 'perched') {
        k.t += dt;
        k.van.damage(dt * (0.006 + 0.003 * k.offended), 'kea');
      } else if (k.state === 'blown') {
        k.vel.y += -3 * dt; k.vel.multiplyScalar(1 - Math.min(1, dt * 0.6)); k.spin += dt * 9;
        k.t += dt; if (k.t > 1.4) { k.state = 'retreat'; k.t = 0; }
      } else if (k.state === 'retreat') {
        const R = L.keaRoost[k.i % L.keaRoost.length];
        _a.set(R[0], R[1] + 6, R[2]).sub(k.pos); const d = _a.length();
        k.vel.lerp(_a.multiplyScalar(speed / Math.max(d, 1e-3)), Math.min(1, dt * 1.5));
        if (d < 3) { k.state = 'idle'; k.mesh.visible = false; k.offended++; k.wait = 5 + Math.random() * 6; k.t = 0; }
      }
      // the blower
      if (blower && (k.state === 'perched' || k.state === 'approach')) {
        const s = blower.strengthAt(k.pos);
        if (s > 0.25) { blower.forceAt(k.pos, _f); k.vel.copy(_f).multiplyScalar(0.35).add(_a.set(0, 2.5, 0)); k.state = 'blown'; k.t = 0; G.emit('kea:blown', k); }
      }
      k.pos.addScaledVector(k.vel, dt);
      if (k.pos.y < 0.05) { k.pos.y = 0.05; k.vel.y = Math.abs(k.vel.y) * 0.3; }
      k.mesh.position.copy(k.pos);
      if (k.vel.lengthSq() > 0.01) k.mesh.rotation.y = Math.atan2(-k.vel.x, -k.vel.z);
      k.mesh.rotation.z = k.state === 'blown' ? k.spin : k.state === 'perched' ? Math.sin(k.t * 7) * 0.08 : 0;
    }
    // offended kea come back on their own
    for (const k of list) if (k.state === 'idle' && k.offended > 0) { k.t += dt; if (k.t > k.wait) { launch(k); G.emit('kea:return', k); } }
  };

  // capture / showcase dressing: two kea on the middle van roof, one mid-tumble above it
  if (G.params.get('shot') || G.params.get('show') === 'kea') {
    const vs = vanList();
    const v = vs[1] || vs[0];
    if (v) for (let i = 0; i < 3; i++) {
      const k = list[i]; k.van = v; k.perch = v.perches[i]; k.mesh.visible = true;
      if (i < 2) { k.state = 'perched'; k.pos.copy(k.perch); } else { k.state = 'blown'; k.pos.copy(v.perches[1]).add(_a.set(-0.9, 0.9, -0.6)); k.vel.set(0.5, 0.2, 1.5); k.t = -1e9; k.spin = 1.1; }
      k.mesh.position.copy(k.pos); k.mesh.rotation.set(0, i * 1.7, k.spin);
    }
    API.frozen = true;
  }
  return API;
}

export function showcase() { return { cam: [-2.0, 1.9, -1.2], target: [0.6, 1.7, 1.2] }; }
