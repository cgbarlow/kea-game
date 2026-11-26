// blower/airflow — what the blower does to the world: wind streaks + puddle droplets (one additive ribbon mesh,
// 1 draw call, atmos-patched), and dust / snow / leaf / spray puffs through the shared fx pool (fx/index.js).
// createAirflow(G, B) → { update(dt), mesh }. Allocation-free per frame.
import { BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, AdditiveBlending, Vector3 } from 'three';
import { patchAtmos } from '../../cookbook/lighting/atmos.js';

const N = 96;                                         // ribbon particles (streaks + droplets)
const DUST = [0.44, 0.39, 0.33], SNOW = [0.80, 0.83, 0.88], LEAF = [0.20, 0.13, 0.06], LEAF2 = [0.30, 0.22, 0.08], MIST = [0.62, 0.66, 0.70], SPRAY = [0.42, 0.45, 0.48];
const _a = new Vector3(), _b = new Vector3(), _s = new Vector3(), _t = new Vector3(), _u = new Vector3(), _c = new Vector3(), _g = new Vector3();
const rand = Math.random;

export function createAirflow(G, B) {
  const P = new Float32Array(N * 3), Vv = new Float32Array(N * 3), age = new Float32Array(N).fill(1), life = new Float32Array(N).fill(1);
  const wid = new Float32Array(N), kind = new Uint8Array(N), bri = new Float32Array(N);
  const pos = new Float32Array(N * 4 * 3), col = new Float32Array(N * 4 * 3), idx = new Uint16Array(N * 6);
  for (let i = 0; i < N; i++) { const v = i * 4, o = i * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v + 2; idx[o + 4] = v + 1; idx[o + 5] = v + 3; }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3).setUsage(35048));
  geo.setAttribute('color', new BufferAttribute(col, 3).setUsage(35048));
  geo.setIndex(new BufferAttribute(idx, 1));
  const mat = new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
  patchAtmos(mat, { additive: true });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 12; mesh.name = 'blower:airflow'; mesh.userData.noReflect = true;
  G.scene.add(mesh);
  let next = 0, accS = 0, accG = 0, accN = 0, accW = 0, accW2 = 0;

  function spawn(x, y, z, vx, vy, vz, l, w, k, b) {
    const i = next; next = (next + 1) % N; const i3 = i * 3;
    P[i3] = x; P[i3 + 1] = y; P[i3 + 2] = z; Vv[i3] = vx; Vv[i3 + 1] = vy; Vv[i3 + 2] = vz;
    age[i] = 0; life[i] = l; wid[i] = w; kind[i] = k; bri[i] = b;
  }
  const groundAt = (x, z) => { const t = G.mods.terrain; return t && t.heightAt ? Math.max(G.WORLD?.groundY ?? 0, t.heightAt(x, z)) : (G.WORLD?.groundY ?? 0); };
  const wetAt = (x, z) => {
    const gm = G.mods.ground; if (!gm || !gm.mask || !gm.mask.sampleDepth) return 0;
    const w = gm.uniforms?.uGrWater?.value ?? 0.16;
    return gm.mask.sampleDepth(x, z) > 1 - w - 0.03 ? 1 : 0;
  };

  function update(dt) {
    const fx = G.mods.fx, pw = B.power, o = B.origin, d = B.dir, vd = B.visDir, tb = B.turbo ? 1.35 : 1;
    // ---- emit: streaks from the nozzle along the cone
    if (pw > 0.15 && dt > 0) {
      accS += dt * 70 * pw * tb;
      while (accS >= 1) {
        accS -= 1;
        _s.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.3).addScaledVector(vd, 0.55).addScaledVector(d, 0.45).normalize();
        const sp = (15 + rand() * 9) * pw * tb, j = 0.03;
        spawn(o.x + (rand() - 0.5) * j, o.y + (rand() - 0.5) * j, o.z + (rand() - 0.5) * j, _s.x * sp, _s.y * sp, _s.z * sp, 0.22 + rand() * 0.22, 0.007 + rand() * 0.009, 0, 1.0 + rand() * 1.2);
      }
      // ---- ground contact: where the lower edge of the jet meets the ground; aimed level, the downwash still
      //      scours a patch 2-4 m ahead (weaker the higher the jet runs)
      _u.copy(vd); _u.y -= 0.14; _u.normalize();
      const gy0 = groundAt(o.x, o.z);
      let s = 0;
      if (_u.y < -0.02 && (o.y - gy0) / -_u.y < B.range) {
        const t = (o.y - gy0) / -_u.y;
        _g.copy(o).addScaledVector(_u, t); s = pw * tb * Math.pow(1 - t / B.range, 0.6);
      } else {
        _g.copy(o).addScaledVector(vd, 3.2); const h = _g.y - groundAt(_g.x, _g.z);
        s = pw * tb * Math.max(0.2, Math.min(1, 1.4 - h / 1.6)) * 0.6;
      }
      if (fx && s > 0.02) {
        const fwdx = d.x, fwdz = d.z, fl = Math.hypot(fwdx, fwdz) || 1;
        const wet = wetAt(_g.x, _g.z);
        accG += dt * 40 * s;
        while (accG >= 1) {
          accG -= 1;
          // along a short strip of the contact zone, pushed downwind
          const k = rand() * 2.2 - 0.6, x = _g.x + (fwdx / fl) * k + (rand() - 0.5) * 1.4, z = _g.z + (fwdz / fl) * k + (rand() - 0.5) * 1.4, y = groundAt(x, z);
          const sp = (3 + rand() * 4) * s, vx = (fwdx / fl) * sp + (rand() - 0.5) * 1.6, vz = (fwdz / fl) * sp + (rand() - 0.5) * 1.6;
          const r = rand();
          if (wet && r < 0.55) { // puddle: mist + droplets
            fx.puff(x, y + 0.06, z, vx * 0.6, 0.9 + rand() * 0.8, vz * 0.6, 0.2, 1.3 + rand() * 0.6, 0.6 + rand() * 0.4, SPRAY[0], SPRAY[1], SPRAY[2], 0.2, 0.25, 0, 0, 1, 2.2);
            for (let n = 0; n < 3; n++) spawn(x, y + 0.02, z, vx * (0.6 + rand() * 0.6), 1.6 + rand() * 2.6, vz * (0.6 + rand() * 0.6), 0.45 + rand() * 0.35, 0.004 + rand() * 0.004, 1, 1.6);
          } else if (r < 0.62) {        // dust
            fx.puff(x, y + 0.1, z, vx, 0.4 + rand() * 0.6, vz, 0.2, 1.4 + rand() * 0.8, 1.1 + rand() * 0.8, DUST[0], DUST[1], DUST[2], 0.55, 0.18, 0, 0, 1, 1.6);
          } else if (r < 0.85) {        // lying snow lifted
            fx.puff(x, y + 0.08, z, vx * 1.2, 0.6 + rand() * 0.8, vz * 1.2, 0.1, 0.8 + rand() * 0.6, 0.8 + rand() * 0.6, SNOW[0], SNOW[1], SNOW[2], 0.6, 0.1, 0, 0, 1, 1.8);
          } else {                      // beech leaves: small, opaque, tumbling, settle again
            const L = rand() < 0.5 ? LEAF : LEAF2;
            fx.puff(x, y + 0.05, z, vx * 1.3, 1.2 + rand() * 1.6, vz * 1.3, 0.05, 0.07, 1.0 + rand() * 0.8, L[0], L[1], L[2], 0.95, -0.9, 0, 0, 1, 0.9);
          }
        }
      }
      // indoors (the shelter) the jet carries no lit dust: the fx pool is sun-lit everywhere
      const sh = G.mods.carpark && G.mods.carpark.shelter, jetK = sh && sh.box && sh.box.containsPoint(o) ? 0.25 : 1;
      if (fx) {
        // ---- the jet itself: fast pale puffs that bloom along the cone (they glow when backlit by the low sun)
        accN += dt * 26 * pw * tb;
        while (accN >= 1) {
          accN -= 1;
          _s.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.22).addScaledVector(vd, 0.6).addScaledVector(d, 0.4).normalize();
          const sp = (8 + rand() * 6) * pw * tb, a = 0.3 + rand() * 1.2;
          fx.puff(o.x + vd.x * a, o.y + vd.y * a, o.z + vd.z * a, _s.x * sp, _s.y * sp, _s.z * sp, 0.2, 0.9 + rand() * 0.5, 0.45 + rand() * 0.3, MIST[0], MIST[1], MIST[2], 0.055 * jetK, 0.05, 0, 0, 1, 0.8);
        }
        // ---- debris riding the jet: snow flecks + leaf bits (small, opaque, fast)
        accW2 += dt * 9 * pw * tb * jetK;
        while (accW2 >= 1) {
          accW2 -= 1;
          _s.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.3).addScaledVector(vd, 0.5).addScaledVector(d, 0.5).normalize();
          const sp = (7 + rand() * 7) * pw * tb, a = 0.4 + rand() * 1.5, leaf = rand() < 0.45, C = leaf ? (rand() < 0.5 ? LEAF : LEAF2) : SNOW;
          fx.puff(o.x + vd.x * a + (rand() - 0.5) * 0.2, o.y + vd.y * a + (rand() - 0.5) * 0.2, o.z + vd.z * a + (rand() - 0.5) * 0.2, _s.x * sp, _s.y * sp, _s.z * sp,
            leaf ? 0.02 : 0.014, leaf ? 0.024 : 0.018, 0.7 + rand() * 0.5, C[0], C[1], C[2], leaf ? 0.95 : 0.85, leaf ? -1.2 : -0.4, 0, 0, 1, 1.4);
        }
      }
    }
    // ---- overheat smoke out of the cooling slats (world point supplied by index.js)
    if (fx && B.heat > 0.72 && dt > 0) {
      accW += dt * (B.overheated ? 14 : 5 * (B.heat - 0.72) / 0.28);
      const e = B.enginePos;
      while (accW >= 1) { accW -= 1; fx.puff(e.x, e.y, e.z, (rand() - 0.5) * 0.3, 0.5 + rand() * 0.4, (rand() - 0.5) * 0.3, 0.06, 0.5 + rand() * 0.3, 1.4 + rand() * 0.8, 0.32, 0.31, 0.30, B.overheated ? 0.5 : 0.3, 0.6, 0, 0, 1, 1.2); }
    }
    // ---- simulate + write ribbons
    const cam = G.camera.position;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3, v = i * 12;
      if (age[i] >= life[i]) { for (let q = 0; q < 12; q++) col[v + q] = 0; continue; }
      age[i] += dt;
      const dr = Math.exp(-(kind[i] ? 0.4 : 3.2) * dt);
      Vv[i3] *= dr; Vv[i3 + 1] = Vv[i3 + 1] * dr - (kind[i] ? 9.81 * dt : 0); Vv[i3 + 2] *= dr;
      P[i3] += Vv[i3] * dt; P[i3 + 1] += Vv[i3 + 1] * dt; P[i3 + 2] += Vv[i3 + 2] * dt;
      if (kind[i] && P[i3 + 1] < groundAt(P[i3], P[i3 + 2])) { age[i] = life[i]; }
      _a.set(P[i3], P[i3 + 1], P[i3 + 2]);
      const tl = kind[i] ? 0.025 : 0.05;
      _b.set(P[i3] - Vv[i3] * tl, P[i3 + 1] - Vv[i3 + 1] * tl, P[i3 + 2] - Vv[i3 + 2] * tl);
      _t.subVectors(_a, _b); _c.subVectors(_a, cam);
      _s.crossVectors(_t, _c); const sl = _s.length(); if (sl < 1e-6) _s.set(0, 1, 0); else _s.multiplyScalar(wid[i] / sl);
      pos[v] = _a.x + _s.x; pos[v + 1] = _a.y + _s.y; pos[v + 2] = _a.z + _s.z;
      pos[v + 3] = _a.x - _s.x; pos[v + 4] = _a.y - _s.y; pos[v + 5] = _a.z - _s.z;
      pos[v + 6] = _b.x + _s.x; pos[v + 7] = _b.y + _s.y; pos[v + 8] = _b.z + _s.z;
      pos[v + 9] = _b.x - _s.x; pos[v + 10] = _b.y - _s.y; pos[v + 11] = _b.z - _s.z;
      const u = age[i] / life[i], fade = (kind[i] ? 1 - u : Math.sin(Math.PI * Math.min(1, u * 1.1))) * bri[i];
      const h = fade, t = h * 0.15; // head bright, tail dim
      col[v] = h * 0.85; col[v + 1] = h * 0.9; col[v + 2] = h; col[v + 3] = h * 0.85; col[v + 4] = h * 0.9; col[v + 5] = h;
      col[v + 6] = t * 0.85; col[v + 7] = t * 0.9; col[v + 8] = t; col[v + 9] = t * 0.85; col[v + 10] = t * 0.9; col[v + 11] = t;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  }
  return { update, mesh };
}
