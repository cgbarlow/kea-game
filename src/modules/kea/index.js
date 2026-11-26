// kea — the flying, non-lethal antagonist. Alpine parrots glide in off the north range, flare and hop onto the
// campervans and strip seals / wipers / mirrors (van.damage). Blown off, they tumble (feathers everywhere), glide
// back to the range, then return OFFENDED (ruffled, crest up, faster, peck harder). Never killed.
//   create(G, { vans, blower }) → { list: Kea[], spawn(n), active(), reset(), update, materials, frozen, tuning }
//   Kea = { state: 'idle'|'approach'|'landing'|'perched'|'blown'|'retreat', pos, vel, van, perch, target, offended, mesh }
//   Events: 'kea:land' (kea, van), 'kea:blown' (kea), 'kea:return' (kea), 'kea:peck' (kea, van, target),
//           'kea:call' (kea, kind: 'arrive'|'alarm'|'offended'|'chatter')  — HUD / audio / game listen.
//   showcase(G) → { cam, target }
// Rendering: ONE InstancedMesh for all 10 birds (bone-free vertex rig, shader.js) + one for loose feathers.
// Allocation-free update (scratch at module scope).
import { InstancedMesh, InstancedBufferAttribute, MeshStandardMaterial, Vector3, Quaternion, Euler, Matrix4, Color, DynamicDrawUsage, Group } from 'three';
import { LAYOUT as L, WORLD } from '../../contracts.js';
import { buildKeaGeometry } from './geo.js';
import { bakeKeaTextures } from './tex.js';
import { patchKea, keaDepthMaterial } from './shader.js';
import { createFeathers } from './feathers.js';
import { dressTableau, dressLineup } from './tableau.js';

const MAX = 10, GROUND = WORLD.groundY;
const _a = new Vector3(), _b = new Vector3(), _f = new Vector3(), _m = new Matrix4(), _q = new Quaternion(), _q2 = new Quaternion(),
  _e = new Euler(0, 0, 0, 'YXZ'), _s = new Vector3(), _c = new Color(), _up = new Vector3(0, 1, 0);
const SMOKE = { count: 2, size: 0.22, grow: 1.8, life: 0.9, color: [0.46, 0.45, 0.36], opacity: 0.28, spread: 0.5, vel: new Vector3(), rise: 0.1 };
const TARGETS = ['mirror', 'wiper', 'seal', 'seal', 'seal'];
const damp = (cur, to, rate, dt) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function create(G, { vans, blower } = {}) {
  const rnd = G.rng ? G.rng((G.params.get('seed') | 0) + 4411) : Math.random;
  const tex = bakeKeaTextures(512);
  const mat = new MeshStandardMaterial({ map: tex.map, roughnessMap: tex.roughnessMap, normalMap: tex.normalMap, roughness: 1, metalness: 0, vertexColors: true });
  mat.normalScale.set(0.4, 0.4); mat.name = 'kea';
  // feathers are not weathered surfaces: no snow / beads on a bird, and world-space macro noise would swim on it
  mat.userData.weather = { wet: 0.15, dust: 0, snow: 0, beads: 0, macro: 0 };
  patchKea(mat);
  const geo = buildKeaGeometry();
  const iA = new InstancedBufferAttribute(new Float32Array(MAX * 4), 4), iB = new InstancedBufferAttribute(new Float32Array(MAX * 4), 4),
    iC = new InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
  for (const at of [iA, iB, iC]) at.setUsage(DynamicDrawUsage);
  geo.setAttribute('iA', iA); geo.setAttribute('iB', iB); geo.setAttribute('iC', iC);
  const mesh = new InstancedMesh(geo, mat, MAX);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.customDepthMaterial = keaDepthMaterial();
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'kea'; mesh.count = 0;
  const root = new Group(); root.name = 'kea'; root.add(mesh);
  const feathers = createFeathers(G, tex, { ground: GROUND, wind: (G.ART && G.ART.weather && G.ART.weather.wind) || [2.5, 0, 0.8] });
  root.add(feathers.mesh);
  G.scene.add(root);

  const list = [];
  for (let i = 0; i < MAX; i++) {
    // per-bird variation: size (44-49 cm), plumage tone, voice/temperament
    const tone = 0.9 + rnd() * 0.2;
    list.push({
      i, state: 'idle', pos: new Vector3(), vel: new Vector3(), van: null, perch: null, perchIdx: 0, target: '', offended: 0, mesh,
      t: 0, wait: 0, yaw: 0, pitch: 0, bank: 0, grip: 0, spin: new Vector3(), tq: new Quaternion(), landFrom: new Vector3(), way: new Vector3(),
      // anim channels
      ph: rnd() * 6.28, flap: 0, roll: 0, fold: 1, bend: 0, hp: 0, hy: 0, tp: 0, ruffle: 0, bp: 0.42, tuck: 0, fan: 0, crest: 0, sweep: 0,
      peckT: 0, peckN: 0, act: 'peck', actT: 0, hop: 0, flick: 0, scale: 0.95 + rnd() * 0.1, tone, featherT: 0, visible: false,
    });
    mesh.setColorAt(i, _c.setRGB(tone, tone * (0.97 + rnd() * 0.06), tone * 0.96));
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  const vanList = () => (vans && vans.list) || [];
  const tuning = { dps: 0.0065, offendedDps: 0.55, speed: 7.5, offendedSpeed: 0.2, grip: 0.3, returnWait: [6, 12], perchDrop: [0.05, 0, 0, 0, 0] };   // perchDrop: m to sink onto each van perch (mirror head sits under its anchor)

  function pickPerch(k) {
    const vs = vanList(); if (!vs.length) return false;
    k.van = vs[Math.floor(rnd() * vs.length)];
    const ps = k.van.perches; let best = -1, tries = 0;
    while (tries++ < 8) {
      const idx = Math.floor(rnd() * ps.length);
      let taken = false; for (const o of list) if (o !== k && o.van === k.van && o.perchIdx === idx && o.state !== 'idle' && o.state !== 'retreat' && o.state !== 'blown') taken = true;
      if (!taken) { best = idx; break; }
    }
    if (best < 0) best = 2 + Math.floor(rnd() * Math.max(1, ps.length - 2));
    k.perchIdx = Math.min(best, ps.length - 1); k.perch = ps[k.perchIdx]; k.target = TARGETS[k.perchIdx] || 'seal';
    return true;
  }
  function launch(k) {
    if (!pickPerch(k)) return false;
    const R = L.keaRoost[k.i % L.keaRoost.length];
    k.pos.set(R[0] + (rnd() - 0.5) * 14, R[1] + (rnd() - 0.5) * 4, R[2] + (rnd() - 0.5) * 6);
    // approach waypoint: 3.5 m short of the perch on the roost side, 1.6 m up (final glide + flare)
    _a.subVectors(k.pos, k.perch); _a.y = 0; _a.normalize();
    k.way.copy(k.perch).addScaledVector(_a, 3.5); k.way.y += 1.6;
    k.vel.subVectors(k.way, k.pos).normalize().multiplyScalar(5);
    k.state = 'approach'; k.t = 0; k.fold = 0; k.tuck = 1; k.bp = 0; k.visible = true; k.tq.identity(); k.grip = tuning.grip;
    G.emit('kea:call', k, k.offended ? 'offended' : 'arrive');
    if (k.offended) G.emit('kea:return', k);
    return true;
  }
  function blowOff(k, s) {
    blower.forceAt(k.pos, _f);
    k.vel.multiplyScalar(0.2).addScaledVector(_f, 0.11).add(_a.set((rnd() - 0.5) * 1.2, 2.2 + rnd(), (rnd() - 0.5) * 1.2));
    k.spin.set((rnd() - 0.5) * 16, (rnd() - 0.5) * 10, (rnd() - 0.5) * 16).multiplyScalar(0.6 + s);
    k.state = 'blown'; k.t = 0; k.featherT = 0;
    k.perch = null;
    G.emit('kea:blown', k); G.emit('kea:call', k, 'alarm');
    _b.copy(k.pos); _b.y += 0.16;
    feathers.burst(_b, k.vel, 5 + Math.floor(rnd() * 4), rnd);
    const fx = G.mods && G.mods.fx;
    if (fx && fx.smoke) { SMOKE.vel.copy(k.vel).multiplyScalar(0.25); fx.smoke(_b, SMOKE); }
  }

  const API = { list, materials: [mat, feathers.material], mesh, feathers, tuning, frozen: false };
  API.spawn = (n = 1) => { let c = 0; for (const k of list) { if (c >= n) break; if (k.state === 'idle' && launch(k)) c++; } return c; };
  API.active = () => { let c = 0; for (const k of list) if (k.state !== 'idle') c++; return c; };
  API.perched = () => { let c = 0; for (const k of list) if (k.state === 'perched') c++; return c; };
  API.reset = () => { for (const k of list) { k.state = 'idle'; k.visible = false; k.offended = 0; k.van = null; k.perch = null; } feathers.clear(); write(); };

  // ---------------------------------------------------------------- animation channels per state
  function animFlight(k, dt, flapAmt, freq) {
    k.ph += dt * freq * 6.2832;
    const s = Math.sin(k.ph), c = Math.cos(k.ph);
    k.flap = damp(k.flap, flapAmt, 4, dt);
    const glideRoll = 0.1 + Math.sin(G.t * 1.3 + k.i) * 0.03;
    k.roll = glideRoll * (1 - k.flap) + (0.25 + 0.85 * s) * k.flap;
    k.bend = (-0.45 * c) * k.flap + 0.06 * (1 - k.flap);
    k.sweep = 0.18 * Math.max(0, c) * k.flap;
    k.fold = damp(k.fold, 0.04 * k.flap, 8, dt);
    k.tuck = damp(k.tuck, 1, 6, dt); k.bp = damp(k.bp, 0, 6, dt);
    k.hp = damp(k.hp, -0.15 - k.pitch * 0.6, 5, dt); k.hy = damp(k.hy, -k.bank * 0.4, 4, dt);
    k.tp = damp(k.tp, -0.05 - k.pitch * 0.4, 5, dt); k.fan = damp(k.fan, 0.25, 4, dt);
  }
  function orientFromVel(k, dt, bankGain = 0.25) {
    const h = Math.hypot(k.vel.x, k.vel.z);
    if (h > 0.2) {
      const yaw = Math.atan2(-k.vel.x, -k.vel.z), dy = wrapPi(yaw - k.yaw);
      k.yaw += dy * (1 - Math.exp(-5 * dt));
      k.bank = damp(k.bank, Math.max(-0.9, Math.min(0.9, -dy / Math.max(dt, 1e-3) * bankGain * 0.1)), 4, dt);
    }
    k.pitch = damp(k.pitch, Math.max(-0.5, Math.min(0.5, Math.atan2(k.vel.y, Math.max(h, 0.5)) * 0.7)), 4, dt);
  }

  function step(k, dt) {
    const off = k.offended, spd = tuning.speed * (1 + tuning.offendedSpeed * Math.min(off, 3));
    k.ruffle = damp(k.ruffle, off > 0 ? 1 : 0, 2, dt); k.crest = damp(k.crest, off > 0 ? 1 : 0, 2, dt);
    if (k.state === 'approach') {
      _a.subVectors(k.way, k.pos); const d = _a.length();
      _a.multiplyScalar(1 / Math.max(d, 1e-3));
      const want = Math.min(spd, d * 1.6 + 2.2);
      k.vel.lerp(_f.copy(_a).multiplyScalar(want), Math.min(1, dt * 1.8));
      orientFromVel(k, dt);
      animFlight(k, dt, k.vel.y > -0.6 || d < 6 ? 1 : 0.15, 3.8 + off * 0.4);
      k.pos.addScaledVector(k.vel, dt);
      if (d < 0.9) { k.state = 'landing'; k.t = 0; k.landFrom.copy(k.pos); }
    } else if (k.state === 'landing') {
      // flare: body pitches up, wings beat hard and forward, legs swing down, tail fans; ease onto the perch
      k.t += dt; const D = 0.75, u = Math.min(1, k.t / D), e = u * u * (3 - 2 * u);
      k.pos.lerpVectors(k.landFrom, k.perch, e); k.pos.y += Math.sin(u * Math.PI) * 0.35 * (1 - u) - (tuning.perchDrop[k.perchIdx] || 0) * e;
      _a.subVectors(k.van.pos, k.perch); const fy = Math.atan2(-_a.x, -_a.z) + (k.perchIdx > 1 ? (k.i % 3 - 1) * 0.7 : 0);
      k.yaw += wrapPi(fy - k.yaw) * (1 - Math.exp(-6 * dt));
      k.ph += dt * 6.5 * 6.2832; const s = Math.sin(k.ph);
      k.flap = 1; k.roll = (0.5 + 0.9 * s) * (1 - e * 0.7); k.bend = -0.3 * Math.cos(k.ph);
      k.fold = e * e * 0.6; k.tuck = damp(k.tuck, 0, 9, dt); k.bp = damp(k.bp, 0.95 * (1 - e) + 0.42 * e, 8, dt);
      k.pitch = damp(k.pitch, 0, 8, dt); k.bank = damp(k.bank, 0, 8, dt); k.fan = damp(k.fan, 0.7, 8, dt); k.tp = damp(k.tp, -0.35, 8, dt);
      k.hp = damp(k.hp, 0.15, 6, dt);
      if (u >= 1) {
        k.state = 'perched'; k.pos.copy(k.perch); k.vel.set(0, 0, 0); k.t = 0; k.hop = 0.42; k.act = 'look'; k.actT = 0.4 + rnd() * 0.6;
        G.emit('kea:land', k, k.van);
      }
    } else if (k.state === 'perched') {
      k.t += dt; k.actT -= dt;
      k.fold = damp(k.fold, 1 - k.flick * 0.55, 10, dt); k.roll = damp(k.roll, k.flick * 0.9, 10, dt); k.bend = damp(k.bend, 0, 8, dt);
      k.sweep = damp(k.sweep, 0, 8, dt); k.tuck = damp(k.tuck, 0, 10, dt); k.fan = damp(k.fan, 0.05 + k.ruffle * 0.15, 4, dt);
      k.flick = Math.max(0, k.flick - dt * 1.6);
      // landing hop + occasional shuffle hops
      if (k.hop > 0) { k.hop -= dt; }
      const hopY = k.hop > 0 ? Math.sin((1 - k.hop / 0.42) * Math.PI) * 0.07 : 0;
      k.pos.copy(k.perch); k.pos.y += hopY - (tuning.perchDrop[k.perchIdx] || 0);
      if (k.act === 'peck') {
        // pecking bursts: head drives down, tugs, snaps back; damage on each strike
        k.peckT += dt * (2.6 + off * 0.9);
        const ph = k.peckT % 1, strike = ph < 0.35 ? ph / 0.35 : 1 - (ph - 0.35) / 0.65;
        k.hp = -0.35 - 0.75 * strike * strike; k.bp = damp(k.bp, 0.12, 6, dt);
        k.hy = damp(k.hy, Math.sin(k.peckT * 0.7) * 0.25, 3, dt); k.tp = damp(k.tp, -0.25, 4, dt);
        const n = Math.floor(k.peckT);
        if (n !== k.peckN) {
          k.peckN = n;
          k.van.damage((tuning.dps / (2.6 + off * 0.9)) * (1 + tuning.offendedDps * Math.min(off, 3)), 'kea');
          G.emit('kea:peck', k, k.van, k.target);
        }
      } else if (k.act === 'tug') {
        // grip a wiper blade / seal strip and lean back hard
        k.peckT += dt * (1.3 + off * 0.4);
        const w = Math.sin(k.peckT * 6.2832);
        k.hp = -0.85 + w * 0.12; k.bp = damp(k.bp, 0.55 + w * 0.12, 8, dt); k.tp = damp(k.tp, -0.4, 4, dt);
        const n = Math.floor(k.peckT);
        if (n !== k.peckN) { k.peckN = n; k.van.damage(tuning.dps / 1.3 * 1.4 * (1 + tuning.offendedDps * Math.min(off, 3)), 'kea'); G.emit('kea:peck', k, k.van, k.target); }
      } else {
        // look about: head cocks (kea look at you with one eye)
        k.hp = damp(k.hp, 0.15 + Math.sin(k.t * 1.7 + k.i) * 0.1, 5, dt);
        k.hy = damp(k.hy, Math.sin(k.t * 0.9 + k.i * 2) * 0.9, 3, dt);
        k.bp = damp(k.bp, 0.48, 4, dt); k.tp = damp(k.tp, -0.12, 4, dt);
      }
      if (k.actT <= 0) {
        const r = rnd();
        k.act = r < 0.6 ? 'peck' : r < 0.8 ? (k.target === 'seal' ? 'peck' : 'tug') : 'look';
        k.actT = k.act === 'look' ? 0.8 + rnd() * 1.2 : 1.8 + rnd() * 2.5;
        if (rnd() < 0.25 + off * 0.15) k.flick = 1;                         // wing flick: flash of orange
        if (rnd() < 0.2) { k.hop = 0.42; k.yaw += (rnd() - 0.5) * 0.8; }
        if (rnd() < 0.15) G.emit('kea:call', k, off ? 'offended' : 'chatter');
      }
    } else if (k.state === 'blown') {
      k.t += dt;
      const s = blower ? blower.strengthAt(k.pos) : 0;
      if (s > 0.02) { blower.forceAt(k.pos, _f); k.vel.addScaledVector(_f, dt * 0.55); }
      k.vel.y -= 5.5 * dt; k.vel.multiplyScalar(1 - Math.min(1, dt * 0.9));
      k.pos.addScaledVector(k.vel, dt);
      if (k.pos.y < GROUND + 0.05) { k.pos.y = GROUND + 0.05; k.vel.y = Math.abs(k.vel.y) * 0.35; k.vel.x *= 0.7; k.vel.z *= 0.7; k.spin.multiplyScalar(0.6); }
      // tumble: integrate angular velocity into the extra orientation, flailing wings
      _q2.setFromAxisAngle(_a.copy(k.spin).normalize(), k.spin.length() * dt); k.tq.premultiply(_q2);
      k.spin.multiplyScalar(1 - Math.min(1, dt * 0.8));
      k.ph += dt * 9 * 6.2832; k.roll = 0.6 * Math.sin(k.ph) + 0.4; k.bend = 0.7 * Math.sin(k.ph * 0.7 + 1); k.fold = 0.15 + 0.15 * Math.sin(k.ph * 0.31);
      k.sweep = 0.3 * Math.sin(k.ph * 0.5); k.tuck = 0.4; k.bp = 0.2; k.hp = 0.5 * Math.sin(k.ph * 0.4); k.hy = 0.6 * Math.sin(k.ph * 0.23);
      k.tp = -0.5; k.fan = 1;
      k.featherT -= dt; if (k.featherT <= 0 && k.t < 0.8) { k.featherT = 0.18; _b.copy(k.pos); _b.y += 0.15; feathers.burst(_b, k.vel, 1, rnd); }
      if (k.t > 1.1 && s < 0.05) { k.state = 'retreat'; k.t = 0; G.emit('kea:call', k, 'offended'); }
    } else if (k.state === 'retreat') {
      k.t += dt;
      // right itself, then a hard climbing flap out to the north range, then a long glide
      k.tq.slerp(_q.identity(), 1 - Math.exp(-5 * dt));
      const R = L.keaRoost[k.i % L.keaRoost.length];
      _a.set(R[0], R[1] + 6, R[2]).sub(k.pos); const d = _a.length();
      k.vel.lerp(_a.multiplyScalar(spd * 1.15 / Math.max(d, 1e-3)), Math.min(1, dt * 1.3));
      orientFromVel(k, dt);
      animFlight(k, dt, k.t < 2.5 ? 1 : 0.2, 4.4);
      k.pos.addScaledVector(k.vel, dt);
      if (d < 4 || k.t > 14) {
        k.state = 'idle'; k.visible = false; k.offended++; k.t = 0;
        k.wait = tuning.returnWait[0] + rnd() * (tuning.returnWait[1] - tuning.returnWait[0]);
      }
    }
  }

  // ---------------------------------------------------------------- GPU write (matrices + rig channels)
  function write() {
    let n = 0;
    for (const k of list) {
      if (!k.visible) continue;
      _e.set(k.pitch, k.yaw, k.bank); _q.setFromEuler(_e); _q.multiply(k.tq);
      _m.compose(k.pos, _q, _s.set(k.scale, k.scale, k.scale));
      mesh.setMatrixAt(n, _m);
      iA.setXYZW(n, k.roll, k.fold, k.bend, k.hp);
      iB.setXYZW(n, k.hy, k.tp, k.ruffle, k.bp);
      iC.setXYZW(n, k.tuck, k.fan, k.crest, k.sweep);
      _c.setRGB(k.tone, k.tone * 0.99, k.tone * 0.96); mesh.setColorAt(n, _c);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true; iA.needsUpdate = true; iB.needsUpdate = true; iC.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  API.update = (dt) => {
    if (G.paused || API.frozen) return;
    for (const k of list) {
      if (k.state === 'idle') {
        // offended kea come back on their own
        if (k.offended > 0) { k.t += dt; if (k.t > k.wait) launch(k); }
        continue;
      }
      // the blower: perched kea hang on briefly (grip), flyers are knocked about at once
      if (blower && (k.state === 'perched' || k.state === 'approach' || k.state === 'landing')) {
        _b.copy(k.pos); _b.y += 0.15;
        const s = blower.strengthAt(_b);
        // forgiving: a rough aim at ~8 m (s ≈ 0.3) dislodges a percher in ~0.4 s, turbo faster; grip comes back slowly
        if (s > 0.04) {
          k.grip -= (0.1 + s) * dt * (k.state === 'perched' ? 2.8 : 5);
          if (k.state === 'perched') { k.flick = Math.max(k.flick, 0.8); k.ruffle = Math.min(1, k.ruffle + dt * 2); k.bp = damp(k.bp, 0.05, 10, dt); }
          if (k.grip <= 0) { blowOff(k, s); continue; }
        } else k.grip = Math.min(tuning.grip, k.grip + dt * 0.25);
      }
      step(k, dt);
    }
    feathers.step(dt);
    write();
  };

  // capture / showcase dressing: kea on van B's mirror and wiper, one mid-tumble in the airflow
  if (G.params.get('keadev')) { dressLineup(G, API); write(); API.frozen = true; } else if (G.params.get('shot') || G.params.get('show') === 'kea') {
    if (dressTableau(G, API, vanList(), feathers)) { write(); feathers.write(); API.frozen = true; }
  }
  write();
  return API;
}

export function showcase() { return { cam: [-2.0, 1.9, -1.2], target: [0.6, 1.7, 1.2] }; }
