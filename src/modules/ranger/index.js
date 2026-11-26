// ranger — v2 kea mode: the Department ranger (AI) with the v1 leaf blower, the opposition when you are the kea.
//   create(G, { vans, colliders, possums }) → {
//     group, position (feet, Vector3), yaw, state: 'patrol'|'investigate'|'blow'|'cool'|'dch',
//     target (Vector3|null: what the ranger is dealing with), targetKind: 'kea'|'possum'|null,
//     // duck-typed blower query, same field names + units as the v1 blower (modules/blower/index.js):
//     firing, power (0..1), heat (0..1), overheated, turbo, origin (nozzle), dir (blow direction), range (10 m),
//     eye (cone apex), right, up, jetDir, visDir, enginePos,
//     strengthAt(p) → 0..1 (×1.4 on turbo), forceAt(p, out) → out (m/s², 38 at strength 1, +12 % lift),
//     enabled (false = hidden, no AI, zero query: Ranger mode), frozen (staged pose, no AI),
//     reset(), stage(kind, opts) (captures / hero poses), update(dt), materials, tris, calls
//   }
//   Listens: 'kea:pull:start' (kea, van) → investigate that van; 'kea:squawk' (pos) → turn toward it for 3 s;
//            'game:alert' ('alert'|'shake' → drop, cover and hold for the whole shake, beside a picnic table if one is
//            within reach; 'clear' → stand up and carry on), 'restart' → reset().
//   Emits:   'ranger:state' (state, prev), 'ranger:spot' (kind, targetPos), 'ranger:overheat' (ranger).
// The ranger is not attackable and is never harmed: there is no damage path in here at all. Deadpan; just the job.
// Visuals: figure.js (4 skinned draws, one skeleton) + the v1 blower model (blower/model.js, 4 draws: plastic,
// rubber, metal, hot; glove / glass / decal meshes dropped at third-person scale) + the v1 airflow ribbon (1 draw).
// Allocation-free update (module-scope scratch).
import { Group, Object3D, Vector3, Ray, Box3 } from 'three';
import { LAYOUT as L, WORLD } from '../../contracts.js';
import { buildBlower } from '../blower/model.js';
import { createAirflow } from '../blower/airflow.js';
import { decimate } from './decimate.js';
import { buildFigureGeo, makeFigure, poseFigure, newPose } from './figure.js';

// v1 cone maths (blower/index.js), measured from an apex APEX m behind the nozzle along the blow direction
const RANGE = 10, CORE = Math.tan(0.30), EDGE = Math.tan(0.46), VREL = 0.6, PUSH = 38, APEX = 0.8;
const WALK = 1.35, BRISK = 2.1, HURRY = 2.8, RADIUS = 0.32, TURN = 3.2, EYE = 1.62;
const SEE_PATROL = 11, SEE_ALERT = 14, SEE_NEAR = 3.2, FOV_PATROL = Math.cos(1.2), FOV_ALERT = Math.cos(1.6);
const ENGAGE = 7.2, FIRE_MAX = RANGE - 1.2, LOST_T = 2.5, SQUAWK_T = 3, POSSUM_GIVEUP = 20;
// patrol loop: round the three vans (north aisle, between the vans, south aisle), pausing at the van noses
const PATROL = [[-6, -1.9, 1], [6, -1.9, 1], [17, -1.9, 0], [17, 9.8, 1], [6, 9.8, 0], [-6, 9.8, 1], [-17.5, 9.8, 0], [-17.5, -1.9, 1]];
const _v = new Vector3(), _w = new Vector3(), _a = new Vector3(), _b = new Vector3(), _up = new Vector3(0, 1, 0), _hit = new Vector3();
const _ray = new Ray(), _bx = new Box3();
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const damp = (c, t, k, dt) => c + (t - c) * Math.min(1, k * dt);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function create(G, { vans, colliders = [], possums } = {}) {
  const SHOT = !!G.params.get('shot');
  const group = new Group(); group.name = 'ranger'; group.visible = false;
  group.userData.noReflect = true;   // perf: no second copy of 9 draws in the puddle mirror pass
  G.scene.add(group);

  // ---------------------------------------------------------------- figure + blower
  const FG = buildFigureGeo(G);
  const fig = makeFigure(FG);
  group.add(fig.group);
  const M = buildBlower(G);
  const model = M.group;
  for (let i = model.children.length - 1; i >= 0; i--) {
    const m = model.children[i], n = m.name;
    if (n === 'kit:glove' || n === 'kit:glass' || n === 'kit:decal' || m.material === M.decal) { model.remove(m); m.geometry.dispose(); continue; }
    if (n !== 'kit:hot') { const g = decimate(m.geometry, n === 'kit:plastic' ? 0.012 : 0.009); m.geometry.dispose(); m.geometry = g; }   // third-person LOD
    delete m.material.userData.noAtmos;                // world object now: fog it like everything else
    m.frustumCulled = true; m.castShadow = n === 'kit:plastic'; m.receiveShadow = true;
  }
  let blowerTris = 0; for (const m of model.children) blowerTris += m.geometry.index.count / 3;
  // the grip sits in the right fist: hand bone (wrist) → loop-handle bar centre
  const hold = new Object3D(); hold.position.set(0.0, -0.068, -0.004); fig.bones.haR.add(hold);
  const rest = new Object3D(); rest.position.set(0.42, 0.335, -0.32); rest.rotation.set(0, 0.7, 0); fig.group.add(rest); // set down on its tank (DCH)
  hold.add(model);
  let held = true;
  const nozzleL = M.nozzle.clone(), tailL = M.tail.clone(), engineL = M.engine.clone();

  // ---------------------------------------------------------------- API
  const R = {
    group, position: new Vector3(), yaw: 0, state: 'patrol', target: null, targetKind: null,
    firing: false, power: 0, heat: 0, overheated: false, turbo: false, range: RANGE,
    origin: new Vector3(), dir: new Vector3(0, 0, -1), eye: new Vector3(), right: new Vector3(1, 0, 0), up: new Vector3(0, 1, 0),
    jetDir: new Vector3(0, 0, -1), visDir: new Vector3(0, 0, -1), enginePos: new Vector3(),
    enabled: false, frozen: false, hero: false,
    materials: [...Object.values(FG.mats), ...model.children.map((m) => m.material)],
    tris: FG.tris + blowerTris, calls: fig.meshes.length + model.children.length + 1,
  };
  const air = createAirflow(G, R);
  air.mesh.visible = false;

  R.strengthAt = (p) => {
    if (!R.enabled || R.power < 0.02) return 0;
    _v.subVectors(p, R.eye);
    const d = _v.length(); if (d > R.range || d < 1e-3) return 0;
    const along = _v.dot(R.dir); if (along < 0.2) return 0;
    const lx = _v.dot(R.right), uy = _v.dot(R.up), ly = uy * (uy < 0 ? VREL * 0.8 : VREL);
    const t = Math.sqrt(lx * lx + ly * ly) / along;
    if (t >= EDGE) return 0;
    const u = t <= CORE ? 1 : 1 - (t - CORE) / (EDGE - CORE), cone = u * u * (3 - 2 * u);
    const r = d / R.range;
    return R.power * cone * (1 - r * r) * (R.turbo ? 1.4 : 1);
  };
  R.forceAt = (p, out) => { const s = R.strengthAt(p); return out.copy(R.dir).multiplyScalar(s * PUSH).addScaledVector(_up, s * PUSH * 0.12); };

  // ---------------------------------------------------------------- AI state
  const P = newPose();
  const goal = new Vector3(), sub = new Vector3(), look = new Vector3(), lastSeen = new Vector3(), tgt = new Vector3(), cover = new Vector3();
  const vel = new Vector3();
  let wp = 0, pauseT = 0, stateT = 0, thinkT = 0, pathT = 0, hasSub = false, seenT = 0, lostT = 0, turnT = 0, holdFireT = 0;
  let invMode = 'walk', possum = null, possumT = 0, keaSeen = false, losT = 0, losOk = false, dchPhase = 0, dchT = 0, prevState = 'patrol';
  let aimW = 0, aimPitch = 0, aimCorr = 0, yawCorr = 0, speed = 0, wantFire = false, wasOver = false, headSweep = 0;
  let wantYaw = 0, faceLock = false;
  void prevState;

  function setState(s) {
    if (s === R.state) return;
    const prev = R.state; R.state = s; stateT = 0;
    if (s !== 'blow') { R.target = null; R.targetKind = null; possum = null; }
    G.emit('ranger:state', s, prev);
  }
  R.reset = () => {
    const p0 = PATROL[0];
    R.position.set(p0[0] - 4, 0, p0[1]); R.yaw = -Math.PI / 2; wp = 0; pauseT = 0;
    R.state = 'patrol'; R.target = null; R.targetKind = null; possum = null;
    R.heat = 0; R.power = 0; R.firing = false; R.overheated = false; R.turbo = false;
    vel.set(0, 0, 0); speed = 0; hasSub = false; aimW = 0; aimCorr = 0; yawCorr = 0; dchPhase = 0;
    P.crouch = 0; P.cool = 0; P.aim = 0; P.walk = 0;
    if (!held) { hold.add(model); held = true; }
    wantYaw = R.yaw;
  };
  R.reset();

  // ---------------------------------------------------------------- world queries
  function blocked(from, to) {   // line of sight: any collider between (boxes that contain the target do not count)
    _v.subVectors(to, from); const d = _v.length(); if (d < 0.05) return false;
    _ray.origin.copy(from); _ray.direction.copy(_v).multiplyScalar(1 / d);
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      _bx.copy(b).expandByScalar(0.3); if (_bx.containsPoint(to)) continue;
      if (_ray.intersectBox(b, _hit) && _hit.distanceTo(from) < d - 0.2) return true;
    }
    return false;
  }
  function pushOut(p) {
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i]; if (b.max.y < 0.25 || b.min.y > 1.6) continue;
      const cx = clamp(p.x, b.min.x, b.max.x), cz = clamp(p.z, b.min.z, b.max.z);
      let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= RADIUS * RADIUS) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (RADIUS - d) / d; p.x += dx * k; p.z += dz * k; }
      else { // inside: out along the shallowest face
        const l = p.x - b.min.x, r = b.max.x - p.x, n = p.z - b.min.z, s = b.max.z - p.z, m = Math.min(l, r, n, s);
        if (m === l) p.x = b.min.x - RADIUS; else if (m === r) p.x = b.max.x + RADIUS; else if (m === n) p.z = b.min.z - RADIUS; else p.z = b.max.z + RADIUS;
      }
    }
    p.x = clamp(p.x, WORLD.min[0] + 1, WORLD.max[0] - 1); p.z = clamp(p.z, WORLD.min[2] + 1, WORLD.max[2] - 1); p.y = 0;
  }
  // detour round the first collider on the straight line to the goal: aim for its best corner (expanded)
  function plan() {
    hasSub = false;
    _a.set(R.position.x, 0.5, R.position.z); _b.set(goal.x, 0.5, goal.z);
    _v.subVectors(_b, _a); const d = _v.length(); if (d < 0.5) return;
    _ray.origin.copy(_a); _ray.direction.copy(_v).multiplyScalar(1 / d);
    let best = null, bd = d;
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i]; if (b.max.y < 0.4 || b.min.y > 1.4) continue;
      _bx.copy(b).expandByScalar(RADIUS + 0.1); if (_bx.containsPoint(_b)) continue;
      if (_ray.intersectBox(_bx, _hit)) { const h = _hit.distanceTo(_a); if (h < bd) { bd = h; best = b; } }
    }
    if (!best) return;
    const e = RADIUS + 0.55; let bc = Infinity;
    for (let c = 0; c < 4; c++) {
      const x = c & 1 ? best.max.x + e : best.min.x - e, z = c & 2 ? best.max.z + e : best.min.z - e;
      const cost = Math.hypot(x - _a.x, z - _a.z) + Math.hypot(goal.x - x, goal.z - z);
      if (cost < bc && Math.hypot(x - _a.x, z - _a.z) > 0.4) { bc = cost; sub.set(x, 0, z); }
    }
    hasSub = bc < Infinity;
  }
  // walk toward `goal` at speed sp; returns the remaining distance
  function steer(sp, dt, stopAt = 0.3) {
    pathT -= dt; if (pathT <= 0) { pathT = 0.35; plan(); }
    const tx = hasSub ? sub.x : goal.x, tz = hasSub ? sub.z : goal.z;
    const dx = tx - R.position.x, dz = tz - R.position.z, d = Math.hypot(dx, dz);
    const rem = Math.hypot(goal.x - R.position.x, goal.z - R.position.z);
    if (hasSub && d < 0.45) { hasSub = false; pathT = 0; }
    if (rem < stopAt) { vel.multiplyScalar(Math.max(0, 1 - dt * 8)); return rem; }
    const slow = Math.min(1, rem / 0.9);
    const vx = (dx / (d || 1)) * sp * slow, vz = (dz / (d || 1)) * sp * slow;
    vel.x = damp(vel.x, vx, 5, dt); vel.z = damp(vel.z, vz, 5, dt);
    if (!faceLock) wantYaw = Math.atan2(-dx, -dz);
    return rem;
  }
  function stop(dt) { vel.x = damp(vel.x, 0, 7, dt); vel.z = damp(vel.z, 0, 7, dt); }
  function faceTo(p) { wantYaw = Math.atan2(-(p.x - R.position.x), -(p.z - R.position.z)); }

  // ---------------------------------------------------------------- perception
  const kea = () => { const k = G.mods && G.mods.keaplayer; return k && k.enabled && k.position ? k : null; };
  function canSee(p, maxD, cosFov) {
    const dx = p.x - R.position.x, dz = p.z - R.position.z, d = Math.hypot(dx, dz);
    if (d > maxD) return false;
    if (d > SEE_NEAR) { // within the view cone (body yaw + head yaw)
      const fy = R.yaw + P.headYaw, fx = -Math.sin(fy), fz = -Math.cos(fy);
      if ((dx * fx + dz * fz) / (d || 1) < cosFov) return false;
    }
    _a.set(R.position.x, EYE, R.position.z);
    return !blocked(_a, p);
  }
  function raidPossum() {
    const l = possums && possums.list; if (!l) return null;
    let best = null, bd = 1e9;
    for (let i = 0; i < l.length; i++) {
      const p = l[i]; if (p.state !== 'raid') continue;
      const d = p.pos.distanceToSquared(R.position); if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function nearestTrap(p, out) {
    const T = L.traps; let bd = 1e9;
    for (let i = 0; i < T.length; i++) { const d = (T[i][0] - p.x) ** 2 + (T[i][1] - p.z) ** 2; if (d < bd) { bd = d; out.set(T[i][0], 0, T[i][1] - 0.5); } }
    return out;
  }
  function think() {
    if (R.state === 'dch' || R.state === 'cool') return;
    // possums at a van door come first (the Department's priorities are clear)
    if (!(R.state === 'blow' && R.targetKind === 'possum')) {
      const p = raidPossum();
      if (p) { setState('blow'); possum = p; possumT = 0; R.targetKind = 'possum'; R.target = tgt; tgt.copy(p.pos); G.emit('ranger:spot', 'possum', p.pos); return; }
    }
    if (R.state === 'blow' && R.targetKind === 'possum') return;
    const k = kea(); if (!k) { keaSeen = false; return; }
    const alert = R.state !== 'patrol';
    const see = canSee(k.position, R.state === 'blow' ? SEE_ALERT + 2 : alert ? SEE_ALERT : SEE_PATROL, R.state === 'blow' ? -1 : alert ? FOV_ALERT : FOV_PATROL);
    if (see) {
      lastSeen.copy(k.position); lostT = 0;
      if (R.state !== 'blow') { setState('blow'); R.targetKind = 'kea'; R.target = tgt; G.emit('ranger:spot', 'kea', k.position); }
    }
    keaSeen = see;
  }

  // ---------------------------------------------------------------- events
  G.on('kea:pull:start', (_k, van) => {
    if (!R.enabled || R.frozen || R.state === 'dch' || R.state === 'cool' || (R.state === 'blow' && R.targetKind === 'possum')) return;
    if (R.state === 'blow' && keaSeen) return;
    const v = van && van.pos ? van : null;
    if (v) {   // the van's nose (cab parts: wipers, seal, mirror), on the ranger's side
      const fx = -Math.sin(v.yaw || 0), fz = -Math.cos(v.yaw || 0), hl = L.van.len / 2 + 1.8;
      goal.set(v.pos.x + fx * hl - 1.4, 0, v.pos.z + fz * hl); look.set(v.pos.x + fx * (hl - 2), 1.6, v.pos.z + fz * (hl - 2));
    } else if (_k && _k.position) { goal.copy(_k.position); goal.y = 0; look.copy(_k.position); } else return;
    invMode = 'walk'; setState('investigate'); pathT = 0;
  });
  G.on('kea:squawk', (pos) => {
    if (!R.enabled || R.frozen || R.state === 'dch' || !pos) return;
    look.copy(pos); turnT = SQUAWK_T;
    if (R.state === 'patrol' || R.state === 'investigate' || (R.state === 'blow' && R.targetKind === 'kea' && !keaSeen)) { invMode = 'turn'; setState('investigate'); }
  });
  G.on('game:alert', (kind) => {
    if (!R.enabled || R.frozen) return;
    if (kind === 'alert' || kind === 'shake') {
      if (R.state !== 'dch') {
        prevState = R.state === 'cool' ? 'patrol' : R.state; setState('dch'); dchPhase = 0; dchT = 0;
        // cover: beside the nearest picnic table if it is within reach, otherwise right here
        let bd = 49; cover.copy(R.position); look.set(0, 0, 0);
        for (const t of L.tables) {
          const d = (t[0] - R.position.x) ** 2 + (t[1] - R.position.z) ** 2;
          if (d < bd) { bd = d; const dx = R.position.x - t[0], dz = R.position.z - t[1], l = Math.hypot(dx, dz) || 1; cover.set(t[0] + (dx / l) * 1.25, 0, t[1] + (dz / l) * 1.25); look.set(t[0], 0.6, t[1]); }
        }
      }
      if (kind === 'shake') dchPhase = Math.max(dchPhase, 1);
    } else if (kind === 'clear' && R.state === 'dch') dchPhase = 2;
  });
  G.on('restart', () => R.reset());

  // ---------------------------------------------------------------- behaviour per state
  function act(dt) {
    const k = kea();
    faceLock = false; wantFire = false; R.turbo = false;
    let aimTarget = false;
    switch (R.state) {
      case 'patrol': {
        const p = PATROL[wp];
        if (pauseT > 0) {
          pauseT -= dt; stop(dt); headSweep += dt;
          P.headYaw = damp(P.headYaw, Math.sin(headSweep * 0.9) * 0.7, 2, dt);
          if (pauseT <= 0) wp = (wp + 1) % PATROL.length;
        } else {
          goal.set(p[0], 0, p[1]);
          P.headYaw = damp(P.headYaw, 0, 2, dt);
          if (steer(WALK, dt) < 0.5) { pauseT = p[2] ? 2.2 : 0.01; headSweep = 0; }
        }
        break;
      }
      case 'investigate': {
        if (invMode === 'turn') {
          stop(dt); faceTo(look); turnT -= dt;
          if (turnT <= 0) setState('patrol');
        } else {
          const rem = steer(BRISK, dt, 0.5);
          if (rem < 0.6) { faceTo(look); if (stateT > 1.0 && invMode === 'walk') { invMode = 'look'; turnT = 2.5; } }
          if (invMode === 'look') { turnT -= dt; P.headYaw = damp(P.headYaw, Math.sin(stateT * 1.3) * 0.6, 2, dt); if (turnT <= 0) setState('patrol'); }
          if (stateT > 14) setState('patrol');
        }
        break;
      }
      case 'blow': {
        if (R.targetKind === 'possum') {
          const p = possum; possumT += dt;
          if (!p || p.state === 'entering' || p.state === 'trapped' || p.state === 'idle' || possumT > POSSUM_GIVEUP || (p.state === 'walk' && possumT > 6)) { setState('patrol'); break; }
          tgt.set(p.pos.x, p.pos.y + 0.15, p.pos.z);
          // stand up-wind of it so the jet shoves it toward the nearest trap mouth
          nearestTrap(p.pos, _w); _v.subVectors(p.pos, _w); _v.y = 0; _v.normalize();
          goal.copy(p.pos).addScaledVector(_v, 3.4); goal.y = 0;
          faceLock = true; faceTo(tgt); steer(BRISK, dt, 0.6);
          aimTarget = true;
        } else {
          if (!k) { setState('patrol'); break; }
          if (!keaSeen) { lostT += dt; if (lostT > LOST_T) { goal.copy(lastSeen); goal.y = 0; look.copy(lastSeen); invMode = 'walk'; setState('investigate'); break; } }
          tgt.copy(keaSeen ? k.position : lastSeen);
          const d = Math.hypot(tgt.x - R.position.x, tgt.z - R.position.z);
          faceLock = true; faceTo(tgt);
          if (d > ENGAGE) { goal.set(tgt.x, 0, tgt.z); steer(BRISK, dt, ENGAGE - 1.5); } else stop(dt);
          aimTarget = true;
          if (k.tumble > 0) holdFireT = 1.2;     // it has gone; the ranger lowers the blower and waits (no pursuit)
        }
        break;
      }
      case 'cool': {
        stop(dt);
        if (R.target) faceTo(R.target);
        if (!R.overheated) { if (R.targetKind === 'kea' && keaSeen) { R.state = 'blow'; G.emit('ranger:state', 'blow', 'cool'); } else setState('patrol'); }
        break;
      }
      case 'dch': {
        dchT += dt;
        const far = Math.hypot(cover.x - R.position.x, cover.z - R.position.z);
        if (dchPhase === 0 && far > 0.4 && dchT < 3) { goal.copy(cover); steer(HURRY, dt, 0.35); }
        else { stop(dt); if (look.lengthSq() > 0) faceTo(look); }
        const down = dchPhase === 1 || (dchPhase === 0 && (far <= 0.4 || dchT >= 3));
        P.crouch = damp(P.crouch, dchPhase === 2 ? 0 : down ? 1 : 0, down ? 6 : 3, dt);
        if (dchPhase === 2 && P.crouch < 0.05) setState('patrol');
        if (dchT > 16) dchPhase = 2;           // never stuck on the ground if a 'clear' goes missing
        break;
      }
    }
    if (R.state !== 'dch') P.crouch = damp(P.crouch, 0, 3, dt);

    // aim + fire decision: the tube must actually be on the target before the trigger goes
    if (aimTarget && R.target) {
      _v.subVectors(R.target, R.origin); const d = _v.length();
      aimPitch = Math.atan2(_v.y, Math.hypot(_v.x, _v.z));
      const ang = R.visDir.angleTo(_v);
      holdFireT = Math.max(0, holdFireT - dt);
      losT -= dt; if (losT <= 0) { losT = 0.15; losOk = !blocked(R.origin, R.target); }
      wantFire = holdFireT <= 0 && aimW > 0.8 && ang < 0.3 && d < FIRE_MAX && losOk && !R.overheated;
      R.turbo = wantFire && R.targetKind === 'kea' && d > 3.5;
      aimW = damp(aimW, holdFireT > 0 ? 0.4 : 1, 5, dt);
    } else { aimW = damp(aimW, 0, 3, dt); aimPitch = damp(aimPitch, -0.5, 3, dt); }
  }

  // ---------------------------------------------------------------- per frame
  function blowerUpdate(dt) {
    R.firing = wantFire && R.enabled;
    R.power += ((R.firing ? (R.turbo ? 1 : 0.85) : 0) - R.power) * Math.min(1, dt * (R.firing ? 5 : 3));
    if (!R.frozen) {
      R.heat = Math.max(0, Math.min(1, R.heat + dt * (R.firing ? (R.turbo ? 0.16 : 0.07) : -0.12)));
      if (R.heat >= 1) R.overheated = true; else if (R.overheated && R.heat < 0.35) R.overheated = false;
    }
    if (R.overheated && !wasOver) { R.firing = false; if (R.state !== 'dch') { R.state = 'cool'; stateT = 0; G.emit('ranger:state', 'cool', 'blow'); } G.emit('ranger:overheat', R); }
    wasOver = R.overheated;
    if (SHOT || R.frozen) R.power = R.firing ? 0.85 : 0;
    M.hot.emissiveIntensity = Math.pow(R.heat, 2.2) * 9 * (R.overheated ? 1 + 0.25 * Math.sin((G.t || 0) * 23) : 1);
  }
  function animate(dt) {
    // body
    const sp = Math.hypot(vel.x, vel.z); speed = sp;
    R.yaw += wrapA(wantYaw + yawCorr * aimW - R.yaw) * Math.min(1, TURN * dt * (faceLock ? 1.6 : 1));
    R.yaw = wrapA(R.yaw);
    P.walk = damp(P.walk, Math.min(1.15, sp / 1.5), 6, dt);
    P.ph += dt * sp * (Math.PI * 2 / 1.45);
    P.aim = damp(P.aim, aimW, 6, dt);
    P.cool = damp(P.cool, R.state === 'cool' ? 1 : 0, 3, dt);
    P.wave = R.state === 'cool' ? Math.sin((G.t || 0) * 5.0) * 0.12 * P.cool : 0;   // a firm shake of the unit (it is fine)
    const want = R.state === 'cool' ? -1.1 : aimPitch + aimCorr;
    P.tube = damp(P.tube, clamp(want, -1.2, 1.05), 7, dt);
    if (R.state === 'cool') P.headPitch = damp(P.headPitch, -0.45, 3, dt);
    else if (R.target && aimW > 0.3) {
      // head follows the target a little (no face close-ups: the beanie keeps it in shadow)
      _v.subVectors(R.target, R.position); const hp = Math.atan2(_v.y - 1.6, Math.hypot(_v.x, _v.z));
      P.headPitch = damp(P.headPitch, clamp(hp * 0.5, -0.4, 0.45), 4, dt); P.headYaw = damp(P.headYaw, 0, 4, dt);
    } else P.headPitch = damp(P.headPitch, -0.06, 2, dt);
    poseFigure(fig, P);
    // the blower goes down on the ground for drop, cover and hold (it is not a drop-cover-hold accessory)
    if (held && P.crouch > 0.35) { rest.add(model); held = false; }
    else if (!held && P.crouch < 0.3) { hold.add(model); held = true; }
    group.position.copy(R.position); group.rotation.set(0, R.yaw, 0);
    group.updateMatrixWorld(true);
    // world nozzle + directions
    R.origin.copy(nozzleL).applyMatrix4(model.matrixWorld);
    R.enginePos.copy(engineL).applyMatrix4(model.matrixWorld);
    _w.copy(tailL).applyMatrix4(model.matrixWorld);
    R.visDir.subVectors(R.origin, _w).normalize();
    // gameplay direction: dead on the target when the tube is on it, otherwise where the tube points
    if (R.target && R.firing) { _v.subVectors(R.target, R.origin).normalize(); R.dir.copy(R.visDir).lerp(_v, 0.85).normalize(); }
    else R.dir.copy(R.visDir);
    R.jetDir.copy(R.dir);
    R.eye.copy(R.origin).addScaledVector(R.dir, -APEX);
    R.right.crossVectors(R.dir, _up); if (R.right.lengthSq() < 1e-6) R.right.set(1, 0, 0); R.right.normalize();
    R.up.crossVectors(R.right, R.dir).normalize();
    // closed-loop aim trim (pitch + yaw): the hand and hips correct what the open-loop pose misses
    if (R.target && aimW > 0.5 && !R.frozen) {
      _v.subVectors(R.target, R.origin);
      const ep = Math.atan2(_v.y, Math.hypot(_v.x, _v.z)) - Math.asin(clamp(R.visDir.y, -1, 1));
      aimCorr = clamp(aimCorr + ep * Math.min(1, dt * 6), -0.5, 0.5);
      const ey = wrapA(Math.atan2(-_v.x, -_v.z) - Math.atan2(-R.visDir.x, -R.visDir.z));
      yawCorr = clamp(yawCorr + ey * Math.min(1, dt * 4), -0.5, 0.5);
    } else { aimCorr = damp(aimCorr, 0, 2, dt); yawCorr = damp(yawCorr, 0, 2, dt); }
  }

  R.update = (dt) => {
    if (!R.enabled) {
      if (group.visible) { group.visible = false; air.mesh.visible = false; R.firing = false; R.power = 0; }
      return;
    }
    if (!group.visible) { group.visible = true; air.mesh.visible = true; }
    const live = !R.frozen && !G.paused;
    if (live) {
      stateT += dt;
      thinkT -= dt; if (thinkT <= 0) { thinkT = 0.2; think(); }
      act(dt);
      R.position.x += vel.x * dt; R.position.z += vel.z * dt; pushOut(R.position);
    }
    blowerUpdate(live || R.frozen ? dt : 0);
    animate(live ? dt : 0);
    air.update(G.paused && !R.frozen ? 0 : dt);
  };

  // ---------------------------------------------------------------- staging (captures, hero poses, showcase)
  //   stage('blow', { at:[x,z], aimAt:[x,y,z], live, turbo })  mid-blow, jet on (live: the live-play jet look under ?shot)
  //   stage('turn', { at:[x,z], lookAt:[x,y,z], walk })  turning toward a sound (K1: behind the kea on the cab)
  //   stage('crouch', { at:[x,z], face:[x,z] })     drop, cover and hold (K6: by a picnic table), blower set down
  //   stage('walk', { at:[x,z], yaw, ph })          mid-stride patrol
  //   stage('cool', { at:[x,z], yaw })              overheated, smoke out of the slats
  //   stage(null) → back to the live AI
  const _t = new Vector3();
  R.stage = (kind, o = {}) => {
    if (!kind) { R.frozen = false; R.target = null; wantFire = false; R.airLive = false; R.turbo = false; return; }
    R.enabled = true; R.frozen = true; vel.set(0, 0, 0); R.airLive = !!o.live; R.turbo = !!o.turbo;
    if (o.at) R.position.set(o.at[0], 0, o.at[1]);
    P.walk = 0; P.aim = 0; P.cool = 0; P.crouch = 0; P.headYaw = 0; P.headPitch = -0.05; P.twist = 0; P.ph = o.ph ?? 0.6;
    wantFire = false; R.heat = 0.25; R.overheated = false; aimW = 0; aimCorr = 0; yawCorr = 0;
    R.target = null; R.targetKind = null;
    const faceP = (x, z) => { R.yaw = Math.atan2(-(x - R.position.x), -(z - R.position.z)); wantYaw = R.yaw; };
    if (kind === 'blow') {
      const t = o.aimAt || [0, 1.4, 1.4]; R.target = _t.fromArray(t); R.targetKind = 'kea';
      faceP(t[0], t[2]); aimW = 1; P.aim = 1; wantFire = true; R.state = 'blow';
      // converge the open-loop aim + trim on the frozen target (a few solver passes, no time passes)
      for (let i = 0; i < 24; i++) {
        _v.subVectors(R.target, R.origin); aimPitch = Math.atan2(_v.y, Math.hypot(_v.x, _v.z));
        P.tube = clamp(aimPitch + aimCorr, -1.2, 1.05); R.yaw = wrapA(wantYaw + yawCorr);
        poseFigure(fig, P); group.position.copy(R.position); group.rotation.set(0, R.yaw, 0); group.updateMatrixWorld(true);
        R.origin.copy(nozzleL).applyMatrix4(model.matrixWorld); _w.copy(tailL).applyMatrix4(model.matrixWorld); R.visDir.subVectors(R.origin, _w).normalize();
        _v.subVectors(R.target, R.origin);
        aimCorr = clamp(aimCorr + (Math.atan2(_v.y, Math.hypot(_v.x, _v.z)) - Math.asin(R.visDir.y)) * 0.8, -0.5, 0.5);
        yawCorr = clamp(yawCorr + wrapA(Math.atan2(-_v.x, -_v.z) - Math.atan2(-R.visDir.x, -R.visDir.z)) * 0.8, -0.5, 0.5);
      }
    } else if (kind === 'turn') {
      const t = o.lookAt || [0, 2, 4]; faceP(t[0], t[2]); R.yaw = wrapA(R.yaw + (o.lag ?? 0.6)); wantYaw = R.yaw;
      P.headYaw = -(o.lag ?? 0.6) * 0.8; P.twist = -(o.lag ?? 0.6) * 0.3; P.walk = o.walk ?? 0.4; P.tube = -0.5; R.state = 'investigate';
    } else if (kind === 'crouch') {
      const f = o.face || [R.position.x, R.position.z - 1]; faceP(f[0], f[1]); P.crouch = 1; R.state = 'dch';
    } else if (kind === 'walk') {
      R.yaw = o.yaw ?? 0; wantYaw = R.yaw; P.walk = 1; P.tube = -0.5; R.state = 'patrol';
    } else if (kind === 'cool') {
      R.yaw = o.yaw ?? 0; wantYaw = R.yaw; P.cool = 1; P.tube = -1.1; R.heat = 1; R.overheated = true; wasOver = true; R.state = 'cool';
    }
    aimPitch = P.tube;
    if (kind !== 'blow') P.tube = clamp(P.tube, -1.2, 1.05);
    animate(0);
  };

  // lineup inspection (?show=ranger&ranger=lineup): extra posed copies sharing the geometry (no blower)
  R._lineup = () => {
    const poses = [['walk', 0.6], ['walk', 2.2], ['cool', 0], ['crouch', 0]];
    poses.forEach(([kind, ph], i) => {
      const f = makeFigure(FG), q = newPose();
      if (kind === 'walk') { q.walk = 1; q.ph = ph; }
      if (kind === 'cool') { q.cool = 1; q.tube = -1.1; q.headPitch = -0.45; }
      if (kind === 'crouch') q.crouch = 1;
      poseFigure(f, q);
      f.group.position.set(R.position.x - 1.2 * (i + 1), 0, R.position.z + 0.2 * i); f.group.rotation.y = R.yaw + (i % 2 ? 1.2 : -0.6);
      G.scene.add(f.group); f.group.updateMatrixWorld(true);
    });
  };

  G.statsHooks?.push(() => ({ ranger: { state: R.state, enabled: R.enabled, firing: R.firing, heat: +R.heat.toFixed(2), tris: R.tris, calls: R.calls } }));
  return R;
}

// ?show=ranger: the ranger enabled and staged for inspection (Ranger mode keeps it disabled). ?ranger= picks the stage:
//   blow (default): blowing a kea off van B's wiper; crouch: drop, cover and hold by the west picnic table (K6 framing);
//   turn: turning toward van B's cab (K1-ish); cool: overheated; walk; lineup: blow + walk/cool/crouch copies.
export function showcase(G) {
  const R = G && G.mods && G.mods.ranger, b = G && G.mods && G.mods.blower;
  if (b) { b.enabled = false; b.forceFire = false; if (b.model) b.model.visible = false; }   // holster the v1 first-person blower
  const kind = (G && G.params.get('ranger')) || 'blow';
  if (R && R.stage) {
    if (kind === 'crouch') { R.stage('crouch', { at: [-7.2, -6.9], face: [-8, -8] }); return { cam: [-5.2, 1.2, -4.6], target: [-7.6, 0.55, -7.4] }; }
    if (kind === 'turn') { R.stage('turn', { at: [-1.5, -1.6], lookAt: [-0.3, 1.4, 1.4] }); return { cam: [-4.8, 1.6, -5.6], target: [-1.2, 1.1, -0.8] }; }
    if (kind === 'cool') { R.stage('cool', { at: [3, -2], yaw: 2.5 }); return { cam: [-0.2, 1.5, -5.0], target: [3, 1.0, -2] }; }
    if (kind === 'walk') { R.stage('walk', { at: [3, -2], yaw: 2.2 }); return { cam: [-0.2, 1.5, -5.0], target: [3, 1.0, -2] }; }
    R.stage('blow', { at: [3.4, -2.6], aimAt: [-0.3, 1.36, 1.4] });
    if (kind === 'lineup') R._lineup();
    return { cam: [0.2, 1.5, -6.6], target: [2.6, 1.0, -2.0] };
  }
  return { cam: [-2.6, 1.55, -6.4], target: [2.2, 1.0, -1.4] };
}
