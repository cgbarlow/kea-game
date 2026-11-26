// keaplayer — v2 kea mode: you are the kea. First-person controller + the kea's own view model (beak + wings).
//   create(G, { input, colliders, terrain, vans }) → S = {
//     overlay: { scene, camera },             // the kea view model; hand to the post pipeline in kea mode
//     position (feet), velocity, yaw, pitch, eye: Vector3 (world eye point), eyeHeight,
//     mode: 'ground'|'hop'|'fly'|'tumble', grounded, perched (standing on a box top, not the ground), flying, flapping,
//     stamina 0..1 ("Wing capacity"), exhausted, offended 0..3, carrying: { kind, van, mesh } | null,
//     pulling 0..1, pullActive, pullTarget: { van, index, kind, position, dist } | null, tumble (s left),
//     squawkCooldown (s left), shake (aftershock, set by the rules), enabled, hero (showcase: view model always shown),
//     teleport(p, yaw), knock(force), dropCarry() → kind|null, reset(), isTaken(van, i), update(dt) }
//   Events (G.emit): 'kea:pull:start' (S, van, kind)  'kea:pull:stop' (S, van, kind, progress)  'kea:pull:done' (S, van, kind)
//     'kea:squawk' (position, S)  'kea:land' (S, van|null)  'kea:takeoff' (S)  'kea:flap' (S)
//     'kea:tumble' (S, wasPulling, droppedKind|null)  'kea:drop' (S, kind, van, position)  'kea:offended' (S, level)
//   (S carries .i = 63 and .pos so v1 listeners — audio's kea:land flap — work with the player too.)
// Controls (engine/input.js bindings): WASD / left stick walk (hop gait) or steer; mouse / right stick look;
//   Space / pad A: tap = hop, hold = flap (climb, drains Wing capacity), release = glide; Shift or C / L3 / pad B = dive;
//   S in flight = flare (slow down to land); LMB / RT hold = pull; RMB / LT = squawk.
// enabled = false (Ranger mode, the default): no input, no camera writes, the view model hidden. Respects G.camLocked
// (captures/bench own the camera) and G.paused. Allocation-free update.
import { Vector3, Euler } from 'three';
import { Spring, damp } from '../../cookbook/engine/springs.js';
import { KEA_PLAYER as K, LAYOUT as L } from '../../contracts.js';
import { createBody } from './body.js';
import { createView } from './view.js';

const KINDS = ['mirror', 'wiper', 'seal', 'strap', 'seal'];      // van.perches order: 0 mirror, 1 wiper, 2-4 roof
const H = 0.3, STEP = 0.2, GRAV = 14, TUMBLE_G = 11;
const PULL_DPS = 0.009, PULL_CHUNK = 0.42, DETACH = 0.06;         // van damage: ≈ v1 kea tugging, + the part coming off
const BLOW_K = 0.3, BLOW_TUMBLE = 2.4;                            // force → accel factor; accumulated m/s to knock over
const TAU = Math.PI * 2;
const _v = new Vector3(), _w = new Vector3(), _f = new Vector3(), _fwd = new Vector3(), _up = new Vector3(), _beak = new Vector3(), _cone = new Vector3();
const _e = new Euler(0, 0, 0, 'YXZ');

export function create(G, { input, colliders = [], terrain = null, vans = null } = {}) {
  const pos = new Vector3().fromArray(L.keaSpawn), vel = new Vector3(), eye = new Vector3();
  const body = createBody(G, { colliders, vans, terrain });
  pos.y = body.support(pos.x, pos.z, pos.y + 1);
  const kea = G.mods && G.mods.kea, km = kea && kea.mesh && kea.mesh.material;
  const view = createView(G, { atlas: km ? { map: km.map, roughnessMap: km.roughnessMap, normalMap: km.normalMap } : null });
  const contact = { top: null, wall: false, ceil: false };
  const target = { van: null, index: -1, kind: '', position: new Vector3(), dist: 0 };
  const carry = { kind: '', van: null, mesh: view.part };
  const taken = new Map();
  const rollS = new Spring(120, 14), dipS = new Spring(160, 12), tugS = new Spring(300, 16);
  const shot = !!G.params.get('shot');

  const S = {
    i: 63, pos, position: pos, velocity: vel, yaw: L.keaSpawnYaw, pitch: 0, eye, eyeHeight: K.eye, overlay: view.overlay, view,
    mode: 'ground', grounded: true, perched: false, flying: false, flapping: false, stamina: 1, exhausted: false, offended: 0,
    carrying: null, pulling: 0, pullActive: false, pullTarget: null, tumble: 0, squawkCooldown: 0, squawkOpen: 0, shake: 0,
    enabled: G.params.get('mode') === 'kea' || G.params.get('show') === 'keaplayer', hero: false,
    hopPhase: 0, flapPhase: 0, flapped: false, hspeed: 0, fspeed: 0, strafe: 0, surface: null, materials: view.materials,
    tuning: { dropOnTumble: true, pullDps: PULL_DPS, detach: DETACH, blowK: BLOW_K, blowTumble: BLOW_TUMBLE },
  };
  let wasEnabled = false, prevFov = 0, hopHold = 0, airTop = 0, blowAcc = 0, chunkT = 0, chunkAcc = 0, lastYaw = S.yaw;
  let tR = 0, tP = 0, tRv = 0, tPv = 0, recover = false, landT = 0;

  const vanList = () => (vans && vans.list) || [];
  const takenOf = (v) => { let a = taken.get(v); if (!a) { a = new Uint8Array(8); taken.set(v, a); } return a; };
  S.isTaken = (v, i) => !!(taken.get(v) || [])[i];
  const spd = () => 1 + 0.15 * Math.min(S.offended, K.offendedMax);
  const cone = () => S.carrying && carry.kind === 'cone';

  // ---------------------------------------------------------------- pull targeting
  function findTarget() {
    const r2 = K.pullReach * K.pullReach;
    let best = r2, bv = null, bi = -1, bk = '';
    const vs = vanList();
    for (let j = 0; j < vs.length; j++) {
      const v = vs[j]; if (v.lockedBy) continue;
      const ps = v.perches, tk = taken.get(v);
      for (let i = 0; i < ps.length && i < KINDS.length; i++) {
        if (tk && tk[i]) continue;
        const d2 = _beak.distanceToSquared(ps[i]); if (d2 >= best) continue;
        _v.subVectors(ps[i], eye); const d = _v.length();
        if (d > 0.45 && _v.dot(_fwd) / d < 0.5) continue;           // in view (60° off the crosshair), or right under the beak
        best = d2; bv = v; bi = i; bk = KINDS[i];
      }
    }
    // the Department's cone (by the gate until a kea takes it; keagame may move it: conePos)
    const kg = G.mods && G.mods.keagame;
    if (kg && (kg.cone === 'gate' || kg.cone === 'dropped')) {
      const cp = kg.coneAt || kg.conePos || L.cone;
      if (cp.isVector3) _cone.copy(cp); else _cone.set(cp[0], cp[1], cp[2]);
      const base = cp.isVector3 || cp[1] > 0.01 ? _cone.y : body.ground(_cone.x, _cone.z);
      _cone.y = Math.max(base, Math.min(base + 0.6, _beak.y));           // nearest point on the cone's axis
      const d2 = _beak.distanceToSquared(_cone);
      if (d2 < best) { _v.subVectors(_cone, eye); const d = _v.length(); if (d <= 0.45 || _v.dot(_fwd) / d >= 0.5) { best = d2; bv = null; bi = -2; bk = 'cone'; } }
    }
    if (bi === -1) return null;
    target.van = bv; target.index = bi; target.kind = bk; target.dist = Math.sqrt(best);
    if (bi >= 0) target.position.copy(bv.perches[bi]); else target.position.copy(_cone);
    return target;
  }
  let pv = null, pi = -1, pk = '';
  function stopPull(emit = true) {
    if (S.pullActive && emit) G.emit('kea:pull:stop', S, pv, pk, S.pulling);
    S.pullActive = false; chunkAcc = 0;
  }
  function doPull(dt, want) {
    const tg = S.grounded && !S.carrying && S.mode !== 'tumble' ? findTarget() : null;
    S.pullTarget = tg;
    if (S.pullActive && (!want || !tg || tg.van !== pv || tg.index !== pi)) stopPull();
    if (!S.pullActive) { S.pulling = Math.max(0, S.pulling - dt * 1.5); if (S.pulling <= 0) pi = -1; }
    if (!want || !tg) return;
    if (!S.pullActive) {
      if (tg.van !== pv || tg.index !== pi) S.pulling = 0;
      pv = tg.van; pi = tg.index; pk = tg.kind; S.pullActive = true; chunkT = 0; chunkAcc = 0;
      G.emit('kea:pull:start', S, pv, pk);
    }
    const off = Math.min(S.offended, K.offendedMax);
    S.pulling = Math.min(1, S.pulling + dt * (1 + 0.25 * off) / K.pullTime);
    if (pv) {   // the van takes v1-kea-like damage in tugs while the part is worried loose
      chunkAcc += S.tuning.pullDps * (1 + 0.55 * off) * dt; chunkT += dt * (1 + 0.25 * off);
      if (chunkT >= PULL_CHUNK) { chunkT -= PULL_CHUNK; pv.damage(chunkAcc, 'kea'); chunkAcc = 0; tugS.impulse(-1.2); }
    }
    if (S.pulling >= 1) {
      if (pv) { if (chunkAcc > 0) pv.damage(chunkAcc, 'kea'); pv.damage(S.tuning.detach, 'kea'); takenOf(pv)[pi] = 1; }
      carry.kind = pk; carry.van = pv; S.carrying = carry; view.setPart(pk);
      S.pullActive = false; S.pulling = 0; S.pullTarget = null; chunkAcc = 0;
      const v = pv; pi = -1;
      G.emit('kea:pull:done', S, v, pk);
    }
  }
  S.dropCarry = () => {
    if (!S.carrying) return null;
    const k = carry.kind; S.carrying = null; carry.kind = ''; carry.van = null; view.setPart(null);
    return k;
  };

  // ---------------------------------------------------------------- tumble (blown / knocked)
  function startTumble(f) {
    const wasPulling = S.pullActive;
    stopPull();
    S.pulling = 0;
    let dropped = null;
    if (S.carrying && S.tuning.dropOnTumble) {
      const van = carry.van; dropped = S.dropCarry();
      G.emit('kea:drop', S, dropped, van, pos);
    }
    if (f) vel.multiplyScalar(0.3).addScaledVector(f, 0.12);
    vel.y = Math.max(vel.y, 0) + 2.6;
    S.mode = 'tumble'; S.tumble = K.tumble; S.grounded = false; S.perched = false; S.flying = false; S.flapping = false;
    const sgn = (f ? f.x * Math.cos(S.yaw) - f.z * Math.sin(S.yaw) : 1) >= 0 ? -1 : 1;
    tRv = sgn * (9 + Math.random() * 4); tPv = (Math.random() - 0.5) * 6; recover = false;
    blowAcc = 0;
    G.emit('kea:tumble', S, wasPulling, dropped);
  }
  S.knock = (force) => {
    if (!force) return;
    vel.add(force);
    if (S.mode !== 'tumble' && force.length() > 5) startTumble(force);
  };

  // ---------------------------------------------------------------- landing
  function land(fromAir) {
    const was = S.mode;
    S.mode = 'ground'; S.grounded = true; S.flying = false; S.flapping = false; vel.y = 0;
    const b = body.supportBox; S.perched = !!b; S.surface = b;
    if (fromAir && (was === 'fly' || airTop - pos.y > 0.4)) { dipS.impulse(-1.4); G.emit('kea:land', S, b ? b.van : null); }
    landT = 0.25;
  }

  // ---------------------------------------------------------------- simulation step
  function step(dt) {
    const mv = input.move, mx = mv.x, my = mv.y;
    S.yaw -= input.lookX; S.pitch = Math.max(-1.45, Math.min(1.45, S.pitch - input.lookY));
    const sy = Math.sin(S.yaw), cy = Math.cos(S.yaw);
    const fx = -sy, fz = -cy, rx = cy, rz = -sy;                     // forward / right on the ground plane
    const jumpDown = input.down('jump'), jumpPressed = input.pressed('jump');
    const dive = input.down('sprint') || input.down('crouch');
    S.flapped = false;
    S.squawkCooldown = Math.max(0, S.squawkCooldown - dt);
    S.squawkOpen = Math.max(0, S.squawkOpen - dt * 2.2);
    landT = Math.max(0, landT - dt);
    const tm = spd(), off = Math.min(S.offended, K.offendedMax);

    // the ranger's blower (duck-typed; absent / disabled → nothing)
    const rg = G.mods && G.mods.ranger;
    if (rg && rg.enabled !== false && rg.forceAt && S.mode !== 'tumble') {
      _v.copy(pos); _v.y += 0.15;
      rg.forceAt(_v, _f);
      const fm = _f.length();
      if (fm > 1e-3) {
        vel.addScaledVector(_f, S.tuning.blowK * dt * (S.grounded ? 0.6 : 1));
        blowAcc += fm * dt;
      }
      blowAcc *= Math.exp(-dt * 2.5);
      if (blowAcc * S.tuning.blowK > S.tuning.blowTumble) { _w.copy(_f); startTumble(_w); }
    }

    // squawk
    if (input.pressed('aim') && S.squawkCooldown <= 0 && S.mode !== 'tumble') {
      S.squawkCooldown = K.squawkCooldown; S.squawkOpen = 1;
      _v.copy(pos); _v.y += 0.2;
      G.emit('kea:squawk', _v, S);
    }

    if (S.mode === 'tumble') {
      S.tumble -= dt;
      vel.y -= TUMBLE_G * dt; vel.x = damp(vel.x, 0, 1.2, dt); vel.z = damp(vel.z, 0, 1.2, dt);
      tR += tRv * dt; tP += tPv * dt; tRv *= Math.exp(-dt * 1.6); tPv *= Math.exp(-dt * 2.5);
      tP = Math.max(-0.9, Math.min(0.9, tP));
      pos.addScaledVector(vel, dt);
      body.collide(pos, vel, K.radius, H, STEP, contact);
      const gy = body.support(pos.x, pos.z, pos.y + STEP, K.radius);
      if (pos.y <= gy) { pos.y = gy; if (vel.y < 0) vel.y = -vel.y * 0.25 < 0.4 ? 0 : -vel.y * 0.25; vel.x = damp(vel.x, 0, 6, dt); vel.z = damp(vel.z, 0, 6, dt); }
      if (S.tumble <= 0) {
        S.tumble = 0; recover = true;
        S.offended = Math.min(K.offendedMax, S.offended + 1);
        const g2 = body.support(pos.x, pos.z, pos.y + STEP, K.radius);
        if (pos.y - g2 < 0.05) land(false); else { S.mode = 'fly'; S.flying = true; }
        G.emit('kea:offended', S, S.offended);
      }
    } else if (S.mode === 'ground') {
      // hop-walk; standing still while worrying a part loose
      const sp = S.pullActive ? 0 : K.walk * tm * (cone() ? 0.8 : 1);
      vel.x = damp(vel.x, (mx * rx + my * fx) * sp, 12, dt); vel.z = damp(vel.z, (mx * rz + my * fz) * sp, 12, dt);
      vel.y = 0;
      const hs = Math.hypot(vel.x, vel.z);
      S.hopPhase += dt * (hs > 0.15 ? 11 + hs * 3 : 0);
      S.stamina = Math.min(1, S.stamina + K.stamRecover * dt);
      if (S.exhausted && S.stamina > 0.25) S.exhausted = false;
      if (jumpPressed && !S.pullActive) {
        stopPull(); S.mode = 'hop'; S.grounded = false; S.perched = false; hopHold = 0; airTop = pos.y;
        vel.y = K.hop * (cone() ? 0.8 : 1);
        G.emit('kea:takeoff', S);
      } else {
        pos.addScaledVector(vel, dt);
        body.collide(pos, vel, K.radius, H, STEP, contact);
        const gy = body.support(pos.x, pos.z, pos.y + STEP, K.radius);
        const drop = pos.y - gy;
        if (drop > 0.12) {          // walked off an edge: a short drop is a hop, a long one opens the wings
          S.grounded = false; S.perched = false; airTop = pos.y;
          if (drop > 0.6) { S.mode = 'fly'; S.flying = true; vel.x += fx * 2.5; vel.z += fz * 2.5; } else S.mode = 'hop';
        } else { pos.y = gy; S.perched = !!body.supportBox; S.surface = body.supportBox; }
      }
    } else {
      // ---- airborne: hop (ballistic) or fly (arcade glide / flap / dive)
      if (S.mode === 'hop') {
        hopHold = jumpDown ? hopHold + dt : -1;
        const sp = K.walk * tm * 1.3;
        vel.x = damp(vel.x, (mx * rx + my * fx) * sp, 4, dt); vel.z = damp(vel.z, (mx * rz + my * fz) * sp, 4, dt);
        vel.y -= GRAV * dt;
        const gy0 = body.support(pos.x, pos.z, pos.y, K.radius);
        if ((hopHold > 0.14 || (jumpPressed && hopHold < 0)) && !S.exhausted && S.stamina > 0.02) { S.mode = 'fly'; S.flying = true; }
        else if (vel.y < -2 && pos.y - gy0 > 1.0) { S.mode = 'fly'; S.flying = true; }
      }
      if (S.mode === 'fly') {
        S.flying = true;
        if (S.stamina <= 0) S.exhausted = true; else if (S.exhausted && S.stamina > 0.25) S.exhausted = false;
        const flap = jumpDown && !S.exhausted && S.stamina > 0;
        S.flapping = flap;
        const pitch = S.pitch;
        let speedT, vyT, rate = 2.2;
        if (dive && !flap) {
          speedT = K.diveSpeed + Math.max(0, -pitch) * 3; vyT = -K.diveSpeed * 0.5 - Math.max(0, -pitch) * 4; rate = 1.6;
        } else if (flap) {
          speedT = 4.8 + my * 1.2; vyT = K.flapClimb * (cone() ? 0.5 : 1) * (0.85 + 0.3 * Math.max(0, pitch)); rate = 2.6;
          S.stamina = Math.max(0, S.stamina - K.stamDrain * (cone() ? 2 : 1) * dt);
        } else {
          speedT = K.glideSpeed + my * 1.5 + Math.max(0, -pitch) * 4 - Math.max(0, pitch) * 2.5;
          vyT = -K.glideSink - Math.max(0, -pitch) * 3.5 + Math.max(0, pitch) * 0.7;
          if (my < -0.2) { speedT = 1.6; vyT = -K.glideSink * 1.25; rate = 2.0; }      // flare: brake to land
          speedT = Math.max(2, speedT); vyT = Math.min(-0.35, vyT);
        }
        speedT *= tm;
        const tx = fx * speedT + rx * mx * 2.2, tz = fz * speedT + rz * mx * 2.2;
        vel.x = damp(vel.x, tx, rate, dt); vel.z = damp(vel.z, tz, rate, dt);
        vel.y = damp(vel.y, vyT, flap ? 4 : 3, dt);
        if (flap) {
          S.flapPhase += dt * (cone() ? 3.0 : 3.6);
          if (S.flapPhase >= 1) { S.flapPhase -= 1; S.flapped = true; G.emit('kea:flap', S); }
        } else if (S.flapPhase > 0) {          // finish the stroke, then hold the wings out
          S.flapPhase = Math.min(1, S.flapPhase + dt * 3.6); if (S.flapPhase >= 1) S.flapPhase = 0;
        }
      }
      pos.addScaledVector(vel, dt);
      if (pos.y > K.ceiling) { pos.y = K.ceiling; if (vel.y > 0) vel.y = 0; }
      if (pos.y > airTop) airTop = pos.y;
      body.collide(pos, vel, K.radius, H, S.mode === 'hop' ? STEP : 0.05, contact);
      const gy = body.support(pos.x, pos.z, pos.y + 0.02, K.radius);
      const hs = Math.hypot(vel.x, vel.z);
      if (pos.y <= gy + 1e-3 && vel.y <= 0.01) {
        pos.y = gy;
        if (S.mode === 'hop' || hs < K.landSpeed * 1.4) land(true);
        else { vel.y = 0; vel.x = damp(vel.x, 0, 4, dt); vel.z = damp(vel.z, 0, 4, dt); }   // belly skid, then settle
      } else if (S.mode === 'fly' && !S.flapping && hs < K.landSpeed && pos.y - gy < K.landHeight && vel.y <= 0.3) {
        vel.y = Math.min(vel.y, -1.6);   // auto-land: settle onto the top surface below
      }
    }
    // bounds (widened north to the stash)
    const bmin = K.bounds.min, bmax = K.bounds.max;
    if (pos.x < bmin[0]) { pos.x = bmin[0]; vel.x = Math.max(0, vel.x); } else if (pos.x > bmax[0]) { pos.x = bmax[0]; vel.x = Math.min(0, vel.x); }
    if (pos.z < bmin[2]) { pos.z = bmin[2]; vel.z = Math.max(0, vel.z); } else if (pos.z > bmax[2]) { pos.z = bmax[2]; vel.z = Math.min(0, vel.z); }
    if (S.mode !== 'tumble' && !S.grounded) { const gy = body.ground(pos.x, pos.z); if (pos.y < gy) { pos.y = gy; land(true); } }

    S.hspeed = Math.hypot(vel.x, vel.z); S.fspeed = vel.x * fx + vel.z * fz; S.strafe = vel.x * rx + vel.z * rz;
    S.flying = S.mode === 'fly'; S.grounded = S.mode === 'ground';
    if (!S.flying) S.flapping = false;

    // pull (the eye and the beak point are needed first)
    writeEye();
    doPull(dt, input.down('fire'));

    // camera springs: bank with the turn (auto-levels), dip on landing, tug on each pull
    let dy = S.yaw - lastYaw; lastYaw = S.yaw;
    rollS.target = S.flying ? Math.max(-0.5, Math.min(0.5, -dy / Math.max(dt, 1e-3) * 0.09 - mx * 0.12)) : 0;
    rollS.update(dt); dipS.update(dt); tugS.update(dt);
    if (recover) {   // right yourself: unwind the tumble roll to the nearest whole turn
      const tgt = Math.round(tR / TAU) * TAU;
      tR = damp(tR, tgt, 7, dt); tP = damp(tP, 0, 7, dt);
      if (Math.abs(tR - tgt) < 0.01 && Math.abs(tP) < 0.01) { tR = 0; tP = 0; recover = false; }
    }
  }

  function writeEye() {
    _e.set(S.pitch, S.yaw, 0); _fwd.set(0, 0, -1).applyEuler(_e); _up.set(0, 1, 0).applyEuler(_e);
    eye.set(pos.x, pos.y + K.eye, pos.z);
    _beak.copy(eye).addScaledVector(_fwd, 0.1).addScaledVector(_up, -0.07);
  }

  function writeCamera() {
    const cam = G.camera, t = G.t;
    const hs = S.hspeed;
    const hopY = S.grounded ? Math.abs(Math.sin(S.hopPhase)) * 0.028 * Math.min(1, hs / K.walk) : 0;
    const flapY = S.flying ? Math.sin(S.flapPhase * TAU) * 0.03 * (S.flapping ? 1 : 0) : 0;
    let jx = 0, jy = 0, jz = 0, rp = 0, rr = 0;
    const sh = S.shake;
    if (sh > 0) {
      const roll = Math.sin(t * 4.4) + 0.7 * Math.sin(t * 6.9 + 1.7), jud = Math.sin(t * 37.0) + 0.7 * Math.sin(t * 53.0 + 1.1);
      jx = sh * (roll * 0.012 + jud * 0.001); jz = sh * Math.sin(t * 5.1 + 0.6) * 0.01; jy = sh * jud * 0.0015;
      rp = sh * jud * 0.0012; rr = sh * roll * 0.009;
    }
    const pullDip = S.pullActive ? -0.06 + tugS.x * 0.02 + Math.sin(t * 13.7) * 0.004 : 0;
    cam.position.set(pos.x + jx, pos.y + K.eye + hopY + flapY + dipS.x * 0.03 + jy, pos.z + jz);
    _e.set(S.pitch + tP + rp + pullDip + dipS.x * 0.02, S.yaw, rollS.x + tR + rr);
    cam.quaternion.setFromEuler(_e);
    if (cam.fov !== K.fov) { cam.fov = K.fov; cam.updateProjectionMatrix(); }
  }

  S.update = (dt) => {
    if (S.enabled && !wasEnabled) { prevFov = G.camera.fov; lastYaw = S.yaw; }
    if (!S.enabled && wasEnabled) { stopPull(false); if (prevFov && !G.camLocked) { G.camera.fov = prevFov; G.camera.updateProjectionMatrix(); } }
    wasEnabled = S.enabled;
    if (S.enabled && !G.paused && input) step(dt);
    else writeEye();
    if (S.enabled && !G.camLocked) writeCamera();
    const ui = G.mods && G.mods.hud && G.mods.hud.ui;
    const live = S.hero || (S.enabled && !(ui && ui.state === 'title'));
    view.overlay.scene.visible = live;
    view.update(G.paused && !S.hero ? 0 : dt, S, live);
  };
  S.teleport = (p, yaw = S.yaw) => {
    if (p.isVector3) pos.copy(p); else pos.fromArray(p);
    vel.set(0, 0, 0); S.yaw = yaw; lastYaw = yaw; S.pitch = 0;
    pos.y = Math.max(pos.y, body.support(pos.x, pos.z, pos.y + 0.3, K.radius));
    const gy = body.support(pos.x, pos.z, pos.y + 0.05, K.radius);
    if (pos.y - gy < 0.6) { pos.y = gy; S.mode = 'ground'; S.grounded = true; S.perched = !!body.supportBox; } else { S.mode = 'fly'; S.grounded = false; S.perched = false; }
    S.flying = S.mode === 'fly'; S.tumble = 0; tR = tP = 0; recover = false; blowAcc = 0;
    stopPull(false); S.pulling = 0; rollS.set(0); dipS.set(0);
    writeEye();
  };
  S.reset = () => {
    taken.clear(); S.dropCarry(); S.offended = 0; S.stamina = 1; S.exhausted = false; S.squawkCooldown = 0; S.shake = 0;
    S.teleport(L.keaSpawn, L.keaSpawnYaw);
  };
  // dev/capture hook: frame one of the showcase stills (showcase(G, name)) and lock the camera there
  S.addSurface = body.addSurface;   // keagame: register the stash ledge / props the kea can stand on
  S.showPose = (name) => { const sc = showcase(G, name); if (window.__setCam) window.__setCam(sc.cam, sc.target); return sc; };
  writeEye();
  return S;
}

// ---------------------------------------------------------------- showcase
// ?show=keaplayer[&kpose=flap|pull|squawk|carry|glide]: enables the kea and swaps the post pipeline's overlay to the
// kea view model (showcase only; in the game the lead's mode switch does this), then frames a hero still.
const POSES = {
  // [feet x,y,z], yaw, pitch, view pose
  flap:   { at: [20.0, 6.0, -4.0], look: [-20, 4.0, -8.0], pose: { phase: 0.27, flap: 1, fold: 0 } },
  glide:  { at: [20.0, 6.0, -4.0], look: [-20, 2.0, -8.0], pose: { phase: 0, flap: 0, fold: 0 }, part: 'wiper' },
  pull:   { at: [11.85, 1.21, 0.95], look: [11.83, 1.32, 1.6], pose: { phase: 0, flap: 0, fold: 1, pull: 1, jaw: 0.12 } },
  squawk: { at: [30.2, 1.2, -19.6], look: [29.0, 0.4, -17.5], pose: { phase: 0, flap: 0, fold: 1, squawk: 1 } },
  carry:  { at: [6.0, 6.6, 6.0], look: [-6.0, 2.0, 2.0], pose: { phase: 0.6, flap: 1, fold: 0 }, part: 'cone' },
};
export function showcase(G, pose) {
  const name = pose || (G && G.params && G.params.get('kpose')) || 'flap', P = POSES[name] || POSES.flap;
  const eyeY = P.at[1] + K.eye, cam = [P.at[0], eyeY, P.at[2]];
  const S = G && G.mods && G.mods.keaplayer;
  if (S && S.view) {
    S.enabled = true; S.hero = true;
    const dx = P.look[0] - cam[0], dy = P.look[1] - cam[1], dz = P.look[2] - cam[2];
    S.teleport(P.at, Math.atan2(-dx, -dz));
    S.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    S.view.pose = P.pose;
    S.view.setPart(P.part || null);
    const b = G.mods.blower;
    if (b && b.overlay) { b.enabled = false; b.forceFire = false; b.hero = true; b.overlay.scene = S.overlay.scene; b.overlay.camera = S.overlay.camera; }
    if (G.camera.fov !== K.fov) { G.camera.fov = K.fov; G.camera.updateProjectionMatrix(); }
  }
  return { cam, target: P.look };
}
