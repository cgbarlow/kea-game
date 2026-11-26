// keagame — the rules of Kea mode (v2). Same car park, same 7-minute shift, seen from the kea.
//   create(G, { player, ranger, vans, possums, kea, terrain }) → {
//     state: 'idle'|'shift'|'won'|'lost', enabled, timeLeft (s), shiftLength, banked (parts at the stash), quota: 9,
//     cone: 'gate'|'carried'|'banked', notices (0..3), phase: 'calm'|'alert'|'shake', alertT, magnitude, nextShock,
//     carryKind ('' | 'wiper'|'seal'|'mirror'|'strap'|'cone'), cone may also be 'dropped' (lying at conePos, re-takeable), stats{...}, reason, stash{centre, top, count},
//     ledge (Box3 of the stash ledge, for colliders), coneAt (Vector3), group, materials, restart(), update
//   }
//   enabled false → 'idle' (Ranger mode): no rules, props hidden, no van locks. 'mode:start' (id) toggles it
//   (id === 'kea' → enabled + restart()); the lead may also set enabled / call restart() directly (idempotent).
//   Events emitted: 'game:start' (shift), 'game:alert' ('alert'|'shake', magnitude) / ('clear', true, false) — the
//     same shapes as v1 so the ranger drops, covers and holds — 'game:toast' (text), 'keagame:bank' (kind, banked),
//     'keagame:notice' (n), 'game:end' (won, reason 'kea:won'|'kea:reopened'|'kea:relocated', stats).
//   Listens: 'mode:start', 'restart', 'ready', 'kea:pull:start' (player, van, kind), 'kea:pull:done' (player, van, kind),
//     'kea:tumble' (player, wasPulling, dropped), 'kea:drop' (player, kind, van, pos), 'kea:squawk', 'kea:land' (k, van).
//   Banking: player.carrying within 1.2 m of the stash → player.dropCarry() (or carrying = null), banked++ / cone
//     'banked'. Win: banked >= quota and cone banked. Lose: timer out, or 3 notices (tumbled while pulling or carrying).
//   Possum lock: each van.lockedBy = the possum raiding it (state 'raid'), else null — polled, so trapped/blown clears it.
//   Background wildlife (kea mode has no v1 director): 2 AI kea, possums every ~35 s (cap 2); paused during shakes.
// URL: ?shift=<s> (20..3600, aftershocks compress like v1). ?shot freezes the rules. Capture previews (kea mode):
//   ?stash=<0..12> parts on the pile, ?cone=gate|carried|banked.
// Allocation-free update: strings only on events, loops indexed.
import { Vector3 } from 'three';
import { RULES } from '../game/index.js';
import { LAYOUT as L } from '../../contracts.js';
import { buildProps, KINDS } from './props.js';
import { KEA_COPY as C, PART_NAME } from './copy.js';

export const KEA_RULES = {
  quota: 9, bankRadius: 1.2, bankDy: 1.6, noticesOut: 3,
  firstKea: 20, keaEvery: 25, keaCap: 2,              // background flock (non-player)
  firstPossum: 28, possumEvery: 35, possumCap: 2,
  squawkToastGap: 30, pullToastGap: 40, perchToastGap: 18,
};

export function create(G, { player, ranger, vans, possums, kea, terrain } = {}) {
  const R = RULES, K = KEA_RULES;
  const qs = parseFloat(G.params.get('shift'));
  const SHIFT = qs > 0 ? Math.max(20, Math.min(3600, qs)) : R.shift;
  const ks = Math.min(1, (SHIFT - R.alert - R.shake - 1) / R.shocks[R.shocks.length - 1]);
  const shockAt = R.shocks.map((t) => t * ks);
  const shot = !!G.params.get('shot');
  const props = buildProps(G, { terrain });
  G.scene.add(props.group);
  const stash = props.stash;
  const stashP = new Vector3(L.stash[0], stash.top, L.stash[2]);
  const coneAt = new Vector3(L.cone[0], L.cone[1], L.cone[2]);

  const stats = { parts: 0, wiper: 0, seal: 0, mirror: 0, strap: 0, cone: 0, notices: 0, offended: 0, worstOffended: 0,
    tumbles: 0, pulls: 0, squawks: 0, aftershocks: 0, possumLocks: 0, served: 0, quota: K.quota, coneStatus: 'gate' };
  const S = { state: 'idle', enabled: false, timeLeft: SHIFT, shiftLength: SHIFT, banked: 0, quota: K.quota, cone: 'gate', notices: 0,
    phase: 'calm', alertT: 0, magnitude: 0, nextShock: shockAt[0], carryKind: '', reason: '', stats, rules: K, shockAt,
    stash, ledge: props.ledge, coneAt, conePos: new Vector3(L.cone[0], L.cone[1], L.cone[2]), stashAt: stashP, group: props.group, materials: props.materials };

  let ready = false, started = false, shockIdx = 0, minuteIdx = 0, ln = 0;
  let keaT = 0, possT = 0, el = 0, lastOff = 0, coneLostT = 0;
  let prevPull = 0, prevCarry = false, lastKind = '', lastPullToast = -99, lastSquawkToast = -99;
  const lockPrev = [null, null, null, null, null, null];
  const perchAt = [-99, -99, -99, -99, -99, -99];
  const line = (a) => a[(ln++) % a.length];
  const toast = (s) => G.emit('game:toast', s);
  const live = () => S.enabled && S.state === 'shift';
  const vanList = () => (vans && vans.list) || [];
  const kindOf = (c) => {
    if (!c) return lastKind || 'seal';
    if (typeof c === 'string') return c;
    return c.kind || c.type || c.part || lastKind || 'seal';
  };

  // ---- visibility: the stash + cone exist only in Kea mode (Ranger captures stay byte-identical) ----
  const showcase = G.params.get('show') === 'keagame';
  const syncVis = () => {
    props.group.visible = S.enabled || showcase;
    props.cone.mesh.visible = S.cone === 'gate' || S.cone === 'dropped';
  };

  // ---- capture previews (?stash / ?cone) ----
  function preview() {
    const n = parseInt(G.params.get('stash'), 10), c = G.params.get('cone');
    if (n > 0) for (let i = 0; i < Math.min(n, stash.capacity); i++) { stash.add(KINDS[i % KINDS.length]); S.banked++; }
    if (c === 'banked' || c === 'carried') { S.cone = c; if (c === 'banked') stash.add('cone'); }
    stats.parts = S.banked; stats.coneStatus = S.cone;
    syncVis();
  }

  function clearLocks() { const vs = vanList(); for (let i = 0; i < vs.length; i++) { vs[i].lockedBy = null; lockPrev[i] = null; } }

  S.restart = () => {
    S.state = S.enabled ? 'shift' : 'idle'; S.timeLeft = SHIFT; S.banked = 0; S.cone = 'gate'; S.notices = 0;
    S.phase = 'calm'; S.alertT = 0; S.magnitude = 0; S.nextShock = shockAt[0]; S.carryKind = ''; S.reason = '';
    for (const key in stats) if (typeof stats[key] === 'number') stats[key] = 0;
    stats.quota = K.quota; stats.coneStatus = 'gate';
    shockIdx = 0; minuteIdx = 0; started = false; keaT = 0; possT = 0; el = 0; lastOff = 0; coneLostT = 0;
    prevPull = 0; prevCarry = false; lastKind = ''; lastPullToast = -99; lastSquawkToast = -99;
    for (let i = 0; i < perchAt.length; i++) perchAt[i] = -99;
    stash.reset(); clearLocks();
    S.conePos.copy(coneAt); placeCone(coneAt.x, coneAt.y, coneAt.z, false);
    if (S.enabled) {
      vans?.reset?.(); kea?.reset?.(); possums?.reset?.(); ranger?.reset?.();
      player?.reset?.();
      if (player) { player.carrying = null; player.teleport?.(L.keaSpawn, L.keaSpawnYaw); }
      if (shot) preview();
    }
    syncVis();
  };
  G.on('mode:start', (id) => { S.enabled = id === 'kea'; if (S.enabled) S.restart(); else { S.state = 'idle'; clearLocks(); syncVis(); } });
  G.on('restart', () => { if (S.enabled && G.mode === 'kea') S.restart(); });
  G.on('ready', () => { ready = true; });

  function end(won, reason) {
    if (S.state !== 'shift') return;
    S.state = won ? 'won' : 'lost'; S.reason = reason; S.phase = 'calm'; S.alertT = 0;
    if (player && 'shake' in player) player.shake = 0;
    stats.parts = S.banked; stats.coneStatus = S.cone; stats.notices = S.notices; stats.served = SHIFT - S.timeLeft;
    clearLocks();
    G.emit('game:end', won, reason, stats);
  }
  function bank(kind) {
    if (player) { if (typeof player.dropCarry === 'function') player.dropCarry(); else player.carrying = null; }
    S.carryKind = '';
    if (kind === 'cone') {
      if (S.cone === 'banked') return;
      S.cone = 'banked'; stats.cone = 1; stats.coneStatus = 'banked'; stash.add('cone'); syncVis();
      toast(C.coneBanked);
    } else {
      S.banked++; stats.parts = S.banked; if (stats[kind] !== undefined) stats[kind]++;
      stash.add(kind);
      if (S.banked === K.quota) toast(S.cone === 'banked' ? C.quota : C.quotaNoCone);
      else toast(line(C.banked)(S.banked, K.quota));
    }
    G.emit('keagame:bank', kind, S.banked);
    if (S.banked >= K.quota && S.cone === 'banked') end(true, 'kea:won');
  }
  function notice() {
    S.notices++; stats.notices = S.notices;
    toast(C.notice[Math.min(S.notices, C.notice.length) - 1]);
    G.emit('keagame:notice', S.notices);
    if (S.notices >= K.noticesOut) end(false, 'kea:relocated');
  }

  // ---- kea player events ----
  G.on('kea:pull:start', (p, van, kind) => {
    if (!live()) return;
    if (G.t - lastPullToast > K.pullToastGap) { lastPullToast = G.t; toast(line(C.pullStart)); }
    void p; void van; void kind;
  });
  G.on('kea:pull:done', (p, van, kind) => {
    if (!live()) return;
    const kd = kind || kindOf(player && player.carrying);
    lastKind = kd; S.carryKind = kd; stats.pulls++;
    if (kd === 'cone') { S.cone = 'carried'; stats.coneStatus = 'carried'; coneLostT = 0; syncVis(); }
    const t = C.pulled[kd]; if (t) toast(t);
    void p; void van;
  });
  G.on('kea:tumble', (p, wasPulling, dropped) => {
    if (!live()) return;
    stats.tumbles++;
    if (wasPulling || dropped || (player && (player.pulling > 0 || player.carrying)) || prevPull > 0 || prevCarry) notice();
    void p;
  });
  // a part dropped mid-tumble is gone (the van keeps the damage); the cone lies where it fell until re-taken
  G.on('kea:drop', (p, kind, van, pos) => {
    if (!live()) return;
    S.carryKind = '';
    if (kind === 'cone' && S.cone === 'carried') dropCone(pos || (player && player.position));
    void p; void van;
  });
  G.on('kea:squawk', () => {
    if (!live()) return;
    stats.squawks++;
    if (G.t - lastSquawkToast > K.squawkToastGap) { lastSquawkToast = G.t; toast(C.squawk); }
  });
  G.on('kea:land', (k, v) => {
    if (!live() || !v || k !== player) return;
    const i = vanList().indexOf(v); if (i < 0 || G.t - perchAt[i] < K.perchToastGap) return;
    perchAt[i] = G.t;
    toast(player.offended > 0 ? C.perchOffended(v.name, player.offended) : C.perch(v.name));
  });

  function groundAt(x, z) {
    const cp = L.carpark;
    if (x > cp.x0 - 1 && x < cp.x1 + 1 && z > -24 && z < cp.z1 + 1.5) return 0;
    return Math.max(0, terrain && terrain.heightAt ? terrain.heightAt(x, z) : 0);
  }
  function placeCone(x, y, z, down) {
    const m = props.cone.mesh;
    m.position.set(x, y + (down ? 0.14 : 0), z); m.rotation.set(0, down ? 1.1 : 0.3, down ? Math.PI / 2 - 0.19 : 0);
    m.updateMatrix();
  }
  function dropCone(p) {
    const x = p ? p.x : L.cone[0], z = p ? p.z : L.cone[2], y = groundAt(x, z);
    S.cone = 'dropped'; stats.coneStatus = 'dropped'; S.conePos.set(x, y, z); placeCone(x, y, z, true); syncVis();
    toast(C.coneDropped);
  }
  function begin() {
    started = true;
    G.emit('game:start', SHIFT);
  }

  S.update = (dt) => {
    if (!S.enabled) { if (S.state !== 'idle') S.state = 'idle'; return; }
    if (!ready || G.paused || S.state !== 'shift' || shot) return;
    if (!started) begin();
    S.timeLeft = Math.max(0, S.timeLeft - dt);
    el = SHIFT - S.timeLeft;
    S.nextShock = shockIdx < shockAt.length ? Math.max(0, shockAt[shockIdx] - el) : Infinity;

    // departmental time checks (full-length shifts only)
    while (minuteIdx < C.minute.length && S.timeLeft <= C.minute[minuteIdx][0]) {
      if (SHIFT >= R.shift && S.timeLeft > C.minute[minuteIdx][0] - 2) toast(C.minute[minuteIdx][1]);
      minuteIdx++;
    }

    // aftershocks: the v1 schedule and event shapes (the ranger drops, covers and holds on 'shake')
    const hasShake = player && 'shake' in player;
    if (S.phase === 'calm' && shockIdx < shockAt.length && el >= shockAt[shockIdx]) {
      S.magnitude = R.magnitudes[shockIdx % R.magnitudes.length];
      S.phase = 'alert'; S.alertT = 0; shockIdx++;
      G.emit('game:alert', 'alert', S.magnitude);
    } else if (S.phase === 'alert') {
      S.alertT += dt;
      if (hasShake) player.shake = 0.04 + 0.04 * (S.alertT / R.alert);
      if (S.alertT >= R.alert) { S.phase = 'shake'; S.alertT = 0; stats.aftershocks++; G.emit('game:alert', 'shake', S.magnitude); }
    } else if (S.phase === 'shake') {
      S.alertT += dt;
      const u = Math.min(1, S.alertT / R.shake);
      if (hasShake) player.shake = S.magnitude * (Math.min(1, u * 6) * (1 - u) * (1 - u) * 1.35 + 0.12 * (1 - u)) * (player.grounded ? 1 : 0.25);
      if (S.alertT >= R.shake) {
        S.phase = 'calm'; S.alertT = 0; if (hasShake) player.shake = 0;
        G.emit('game:alert', 'clear', true, false);
        toast(C.shakeClear);
      }
    }

    // background wildlife (nothing new arrives while the ground moves)
    if (S.phase === 'calm') {
      if (kea && kea.spawn && el > K.firstKea) { keaT += dt; if (keaT >= K.keaEvery && kea.active() < K.keaCap) { keaT = 0; kea.spawn(1); } }
      if (possums && possums.spawn && el > K.firstPossum) { possT += dt; if (possT >= K.possumEvery && possums.active() < K.possumCap) { possT = 0; possums.spawn(1); } }
    }

    // possum lock: a possum inside (raiding) a van locks its parts until it is trapped or blown off
    const vs = vanList(), pl = possums && possums.list;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i]; let lock = null;
      if (pl) for (let j = 0; j < pl.length; j++) { const p = pl[j]; if (p.state === 'raid' && p.van === v) { lock = p; break; } }
      v.lockedBy = lock;
      if (lock !== lockPrev[i]) {
        if (lock && !lockPrev[i]) { stats.possumLocks++; toast(C.possumLock(v.name)); }
        else if (!lock && lockPrev[i]) toast(C.possumGone(v.name));
        lockPrev[i] = lock;
      }
    }

    if (player) {
      // offended: count every rise (the HUD shows the level; the log keeps the grievance)
      const off = player.offended | 0;
      if (off > lastOff) {
        stats.offended++; if (off > stats.worstOffended) stats.worstOffended = off;
        toast(off >= 3 ? C.offendedMax : line(C.offended)(off));
      }
      lastOff = off;
      // carrying: track the kind; the cone falls back to the gate if dropped anywhere but the stash
      const c = player.carrying;
      if (c && !S.carryKind) S.carryKind = kindOf(c);
      if (!c) S.carryKind = '';
      if (S.cone === 'carried' && !c) {
        coneLostT += dt;
        if (coneLostT > 0.35) { coneLostT = 0; dropCone(player.position); }
      } else coneLostT = 0;
      // banking at the stash
      if (c) {
        const p = player.position, dx = p.x - stashP.x, dz = p.z - stashP.z, dy = p.y - stashP.y;
        if (dx * dx + dz * dz < K.bankRadius * K.bankRadius && dy < K.bankDy && dy > -K.bankDy) bank(kindOf(c));
      }
      prevPull = player.pulling || 0; prevCarry = !!player.carrying;
    }
    if (S.state !== 'shift') return;
    if (S.timeLeft <= 0) end(false, 'kea:reopened');
  };

  // ?mode=kea&shot: the lead starts kea mode on 'ready'; previews are applied by restart(). Showcase shows the pile.
  if (showcase) { for (let i = 0; i < 9; i++) stash.add(KINDS[i % KINDS.length]); stash.add('cone'); S.cone = 'banked'; }
  syncVis();
  return S;
}

// the stash ledge from up the scree: the pile, the notice, the car park below
export function showcase() { return { cam: [-4.6, 5.15, -32.9], target: [-3.6, 3.7, -30.0] }; }
export { PART_NAME };
