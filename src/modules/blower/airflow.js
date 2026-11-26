// blower/airflow — what the blower does to the world: wind streaks + puddle droplets (one additive ribbon mesh,
// 1 draw call, atmos-patched), and small dust / snow / leaf chips + ground spray through the shared fx pool.
// The jet itself is ONLY faint velocity-stretched streaks (alpha <= 0.08, life <= 0.35 s): no mist blobs at the
// nozzle. Nothing is emitted unless firing && power > 0.2; under ?shot no puff spawns within 1.5 m of the nozzle.
// Live play (not ?shot) runs the jet hotter so it reads in daylight: brighter/wider streaks, more chips, a faint
// dust haze riding the jet. The jet travels along B.jetDir (nozzle → crosshair point), the same line the gameplay
// cone uses, so what the player sees hitting a bird or possum is what pushes it. ?shot keeps the critic-tuned look.
// createAirflow(G, B) → { update(dt), mesh }. Allocation-free per frame.
import { BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, AdditiveBlending, DoubleSide, Vector3 } from 'three';
import { patchAtmos } from '../../cookbook/lighting/atmos.js';

const N = 96;                                         // ribbon particles (streaks + droplets)
const DUST = [0.44, 0.39, 0.33], SNOW = [0.80, 0.83, 0.88], LEAF = [0.20, 0.13, 0.06], LEAF2 = [0.30, 0.22, 0.08], SPRAY = [0.42, 0.45, 0.48];
const _a = new Vector3(), _b = new Vector3(), _s = new Vector3(), _t = new Vector3(), _u = new Vector3(), _c = new Vector3(), _g = new Vector3();
const rand = Math.random;
const NEAR2 = 1.5 * 1.5;                              // ?shot: keep fx puffs out of the first 1.5 m

export function createAirflow(G, B) {
  const P = new Float32Array(N * 3), Vv = new Float32Array(N * 3), age = new Float32Array(N).fill(1), life = new Float32Array(N).fill(1);
  const wid = new Float32Array(N), kind = new Uint8Array(N), bri = new Float32Array(N);
  const pos = new Float32Array(N * 4 * 3), col = new Float32Array(N * 4 * 3), idx = new Uint16Array(N * 6);
  for (let i = 0; i < N; i++) { const v = i * 4, o = i * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v + 2; idx[o + 4] = v + 1; idx[o + 5] = v + 3; }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3).setUsage(35048));
  geo.setAttribute('color', new BufferAttribute(col, 3).setUsage(35048));
  geo.setIndex(new BufferAttribute(idx, 1));
  // DoubleSide: the ribbon's winding depends on the streak direction vs the camera; a jet blowing AWAY from the viewer
  // (i.e. always, in first person) is back-facing, so with the default FrontSide the streaks were culled and never drawn
  const mat = new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false, side: DoubleSide });
  patchAtmos(mat, { additive: true });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 12; mesh.name = 'blower:airflow'; mesh.userData.noReflect = true;
  G.scene.add(mesh);
  let next = 0, accS = 0, accG = 0, accW = 0, accW2 = 0;
  const SHOT = !!(G.params && G.params.get('shot'));
  const LV0 = SHOT ? 0 : 1;                           // live-play visibility boost (0 under ?shot; B.airLive forces it: staged hero poses)
  let accH = 0;
  const far = (x, y, z) => { const o = B.origin, dx = x - o.x, dy = y - o.y, dz = z - o.z; return dx * dx + dy * dy + dz * dz >= NEAR2; };

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
    const fx = G.mods.fx, pw = B.power, o = B.origin, d = B.jetDir || B.dir, vd = B.visDir, tb = B.turbo ? 1.35 : 1, LV = B.airLive ? 1 : LV0;
    // ---- emit: streaks from the nozzle along the cone
    if (B.firing && pw > 0.2 && dt > 0) {
      accS += dt * (60 + 60 * LV) * pw * tb;
      while (accS >= 1) {
        accS -= 1;
        _s.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.3).addScaledVector(vd, 0.55 - 0.4 * LV).addScaledVector(d, 0.45 + 0.4 * LV).normalize();
        // faint air streaks aligned to the nozzle, starting a little way out of the mouth
        const sp = (15 + rand() * 9) * pw * tb, j = 0.03, a0 = 0.15 + rand() * 0.25;
        spawn(o.x + vd.x * a0 + (rand() - 0.5) * j, o.y + vd.y * a0 + (rand() - 0.5) * j, o.z + vd.z * a0 + (rand() - 0.5) * j, _s.x * sp, _s.y * sp, _s.z * sp,
          0.18 + rand() * 0.17 + LV * 0.1, (0.004 + rand() * 0.005) * (1 + LV * 1.2), 0, (0.05 + rand() * 0.03) * (1 + LV * 3.5));
      }
      // ---- ground contact: where the lower edge of the jet meets the ground; aimed level, the downwash still
      //      scours a patch 2-4 m ahead (weaker the higher the jet runs)
      _u.copy(d); _u.y -= 0.14; _u.normalize();
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
        accG += dt * (40 + 30 * LV) * s;
        while (accG >= 1) {
          accG -= 1;
          // along a short strip of the contact zone, pushed downwind
          const k = rand() * 2.2 - 0.6, x = _g.x + (fwdx / fl) * k + (rand() - 0.5) * 1.4, z = _g.z + (fwdz / fl) * k + (rand() - 0.5) * 1.4, y = groundAt(x, z);
          if (SHOT && !far(x, y, z)) continue;
          const sp = (3 + rand() * 4) * s, vx = (fwdx / fl) * sp + (rand() - 0.5) * 1.6, vz = (fwdz / fl) * sp + (rand() - 0.5) * 1.6;
          const r = rand();
          if (wet && r < 0.55) { // puddle: mist + droplets
            fx.puff(x, y + 0.04, z, vx * 0.6, 0.6 + rand() * 0.6, vz * 0.6, 0.08, 0.45 + rand() * 0.25, 0.35 + rand() * 0.2, SPRAY[0], SPRAY[1], SPRAY[2], 0.08, 0.15, 0, 0, 1, 2.2);
            for (let n = 0; n < 3; n++) spawn(x, y + 0.02, z, vx * (0.6 + rand() * 0.6), 1.6 + rand() * 2.6, vz * (0.6 + rand() * 0.6), 0.45 + rand() * 0.35, 0.004 + rand() * 0.004, 1, 1.6);
          } else if (r < 0.62) {        // dust: a low, thin scour skirt hugging the ground (no beige balls)
            fx.puff(x, y + 0.05, z, vx, 0.2 + rand() * 0.3, vz, 0.08, (0.4 + rand() * 0.3) * (1 + LV * 0.4), 0.45 + rand() * 0.3, DUST[0], DUST[1], DUST[2], 0.08 + LV * 0.14, 0.1, 0, 0, 1, 1.6);
          } else if (r < 0.85) {        // lying snow lifted: fine flecks
            fx.puff(x, y + 0.05, z, vx * 1.2, 0.6 + rand() * 0.8, vz * 1.2, 0.012 + LV * 0.01, 0.018 + LV * 0.014, 0.35 + rand() * 0.2, SNOW[0], SNOW[1], SNOW[2], 0.8, -0.4, 0, 0, 1, 1.8);
          } else {                      // beech leaves: small, opaque, tumbling, settle again
            const L = rand() < 0.5 ? LEAF : LEAF2;
            fx.puff(x, y + 0.05, z, vx * 1.3, 1.2 + rand() * 1.6, vz * 1.3, 0.025 + LV * 0.012, 0.03 + LV * 0.015, 0.5 + rand() * 0.3, L[0], L[1], L[2], 0.95, -0.9, 0, 0, 1, 0.9);
          }
        }
      }
      // indoors (the shelter) the jet carries no lit dust: the fx pool is sun-lit everywhere
      const sh = G.mods.carpark && G.mods.carpark.shelter, jetK = sh && sh.box && sh.box.containsPoint(o) ? 0.25 : 1;
      if (fx) {
        // ---- debris riding the jet: snow flecks + leaf bits (small, opaque, fast)
        accW2 += dt * (9 + 24 * LV) * pw * tb * jetK;
        while (accW2 >= 1) {
          accW2 -= 1;
          _s.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.3).addScaledVector(vd, 0.5 - 0.35 * LV).addScaledVector(d, 0.5 + 0.35 * LV).normalize();
          const sp = (7 + rand() * 7) * pw * tb, a = (SHOT ? 1.6 : 0.8) + rand() * 1.4, leaf = rand() < 0.45, C = leaf ? (rand() < 0.5 ? LEAF : LEAF2) : SNOW;
          // small chips riding the cone, short-lived so they fade fast instead of hanging in front of the nozzle
          fx.puff(o.x + vd.x * a + (rand() - 0.5) * 0.15, o.y + vd.y * a + (rand() - 0.5) * 0.15, o.z + vd.z * a + (rand() - 0.5) * 0.15, _s.x * sp, _s.y * sp, _s.z * sp,
            (leaf ? 0.012 : 0.008) * (1 + LV * 0.8), (leaf ? 0.014 : 0.01) * (1 + LV * 1.0), 0.25 + rand() * 0.1 + LV * 0.15, C[0], C[1], C[2], leaf ? 0.9 : 0.7, leaf ? -1.2 : -0.4, 0, 0, 1, 1.4);
        }
        // ---- live play: a faint dust haze carried down the jet (1.2-3.5 m out, so the nozzle itself stays clean)
        accH += dt * 12 * LV * pw * tb * jetK;
        while (accH >= 1) {
          accH -= 1;
          const a = 1.2 + rand() * 2.3, sp = (5 + rand() * 4) * pw * tb;
          _s.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.25).add(d).normalize();
          fx.puff(o.x + d.x * a + (rand() - 0.5) * 0.2, o.y + d.y * a + (rand() - 0.5) * 0.2, o.z + d.z * a + (rand() - 0.5) * 0.2, _s.x * sp, _s.y * sp, _s.z * sp,
            0.1, 0.55 + rand() * 0.35, 0.45 + rand() * 0.25, DUST[0] * 1.15, DUST[1] * 1.15, DUST[2] * 1.15, 0.22 + 0.15 * (tb - 1), 0.05, 0, 0, 1, 2.0);
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
