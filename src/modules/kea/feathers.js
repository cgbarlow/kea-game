// loose feathers knocked out of a blown kea: one InstancedMesh, pooled, fluttering down in the wind and settling
// on the asphalt (then shrinking away). Allocation-free update.
import { InstancedMesh, Matrix4, Quaternion, Vector3, Euler, MeshStandardMaterial, DoubleSide, DynamicDrawUsage, Color } from 'three';
import { buildFeatherGeometry } from './geo.js';

const MAXF = 48;
const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _s = new Vector3(), _c = new Color();

export function createFeathers(G, tex, { ground = 0, wind = [2.5, 0, 0.8] } = {}) {
  const mat = new MeshStandardMaterial({ map: tex.map, roughnessMap: tex.roughnessMap, roughness: 1, side: DoubleSide, vertexColors: true });
  mat.name = 'keaFeather';
  mat.userData.weather = { wet: 0, dust: 0, snow: 0, beads: 0, macro: 0 };
  const mesh = new InstancedMesh(buildFeatherGeometry(), mat, MAXF);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'keaFeathers';
  for (let i = 0; i < MAXF; i++) mesh.setColorAt(i, _c.setRGB(1, 1, 1));
  const P = [];
  for (let i = 0; i < MAXF; i++) P.push({ pos: new Vector3(), vel: new Vector3(), rot: new Vector3(), spin: new Vector3(), life: 0, age: 0, s: 1, ph: 0, landed: false });
  let n = 0;
  const F = { mesh, material: mat };
  // burst of `count` feathers around p, pushed along v (m/s)
  F.burst = (p, v, count = 6, rnd = Math.random) => {
    for (let k = 0; k < count; k++) {
      if (n >= MAXF) { // recycle the oldest
        let oi = 0; for (let i = 1; i < n; i++) if (P[i].age > P[oi].age) oi = i;
        const t = P[oi]; P[oi] = P[n - 1]; P[n - 1] = t; n--;
      }
      const f = P[n++];
      f.pos.set(p.x + (rnd() - 0.5) * 0.12, p.y + (rnd() - 0.5) * 0.1, p.z + (rnd() - 0.5) * 0.12);
      f.vel.set(v.x * (0.3 + rnd() * 0.5) + (rnd() - 0.5) * 1.6, v.y * 0.4 + rnd() * 1.4, v.z * (0.3 + rnd() * 0.5) + (rnd() - 0.5) * 1.6);
      f.rot.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28); f.spin.set((rnd() - 0.5) * 9, (rnd() - 0.5) * 9, (rnd() - 0.5) * 9);
      f.life = 7 + rnd() * 5; f.age = 0; f.s = 0.6 + rnd() * 0.6; f.ph = rnd() * 6.28; f.landed = false;
      const tone = 0.8 + rnd() * 0.35; mesh.setColorAt(n - 1, _c.setRGB(tone, tone, tone * 0.95));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    F.write();
  };
  F.step = (dt) => {
    for (let i = 0; i < n; i++) {
      const f = P[i];
      f.age += dt;
      if (f.age > f.life) { const t = P[i]; P[i] = P[n - 1]; P[n - 1] = t; n--; i--; continue; }
      if (!f.landed) {
        // drag toward a fluttering terminal fall (~0.4 m/s) drifting downwind
        const k = Math.min(1, dt * 3.2);
        f.vel.x += (wind[0] * 0.35 + Math.sin(f.age * 5 + f.ph) * 0.5 - f.vel.x) * k;
        f.vel.z += (wind[2] * 0.35 + Math.cos(f.age * 4.3 + f.ph) * 0.5 - f.vel.z) * k;
        f.vel.y += (-0.42 - f.vel.y) * k;
        f.pos.addScaledVector(f.vel, dt);
        f.rot.addScaledVector(f.spin, dt * (0.4 + 0.6 * Math.abs(Math.sin(f.age * 2 + f.ph))));
        if (f.pos.y < ground + 0.004) { f.pos.y = ground + 0.004; f.landed = true; f.rot.x = 0; f.rot.z = 0; }
      }
    }
    F.write();
  };
  F.write = () => {
    for (let i = 0; i < n; i++) {
      const f = P[i];
      _q.setFromEuler(_e.set(f.rot.x, f.rot.y, f.rot.z));
      const sh = f.age > f.life - 1.5 ? Math.max(0.001, (f.life - f.age) / 1.5) : 1;
      _m.compose(f.pos, _q, _s.set(f.s * sh, f.s * sh, f.s * sh)); mesh.setMatrixAt(i, _m);
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  };
  F.clear = () => { n = 0; mesh.count = 0; };
  F.active = () => n;
  // static placement for the frozen tableau
  F.place = (p, rx, ry, rz, s) => {
    if (n >= MAXF) return; const f = P[n++];
    f.pos.copy(p); f.rot.set(rx, ry, rz); f.spin.set(0, 0, 0); f.vel.set(0, 0, 0); f.life = 1e9; f.age = 0; f.s = s; f.landed = true;
  };
  return F;
}
