// game — rules + the player body. One shift at the car park until SH73 reopens.
//   create(G, { input, colliders, vans, kea, possums, blower, cover }) → {
//     player,                       // first-person controller (./player.js), exposes position/velocity/shake
//     state: 'shift'|'won'|'lost', timeLeft (s), shiftLength, strikes (0..3), phase: 'calm'|'alert'|'shake',
//     alertT (s into alert/shake), compliant (bool, live during shake), coverOk (near cover), stats{keaBlown,
//     possumsTrapped, aftershocks, held}, reason (end text key), restart(), update
//   }
//   Events emitted: 'game:alert' (kind 'alert'|'shake'|'clear'), 'game:strike' (n), 'game:end' (won, reason, stats),
//                   'game:toast' (text) — HUD + audio listen. Listens: 'restart', kea/possum events (stats).
// Win: survive the shift (timeLeft 0) with every van above 0 integrity.
// Lose: any campervan integrity 0 ("A tourist has left a review"), or 3 aftershock strikes (stood down).
import { create as createPlayer } from './player.js';
import { LAYOUT as L, PLAYER } from '../../contracts.js';

const SHIFT = 420;                                   // 7 minutes
const SHOCKS = [62, 150, 236, 318, 392];             // aftershock alert times (s into the shift)
const ALERT = 3.0, SHAKE = 6.0, GRACE = 1.6;         // alert lead time, shake length, allowed non-compliant seconds

export function create(G, { input, colliders, vans, kea, possums, blower, cover = [] }) {
  const player = createPlayer(G, { input, colliders });
  const S = { player, state: 'shift', timeLeft: SHIFT, shiftLength: SHIFT, strikes: 0, phase: 'calm', alertT: 0,
    compliant: true, coverOk: false, reason: '', stats: { keaBlown: 0, possumsTrapped: 0, aftershocks: 0, held: 0 } };
  let shockIdx = 0, bad = 0, keaAcc = 0, possAcc = 0;
  const shot = !!G.params.get('shot');

  G.on('kea:blown', () => { S.stats.keaBlown++; });
  G.on('possum:trapped', () => { S.stats.possumsTrapped++; G.emit('game:toast', 'Possum relocated to trap box. Paperwork pending.'); });
  G.on('kea:return', () => { G.emit('game:toast', 'A kea has returned. It is offended.'); });

  function end(won, reason) {
    if (S.state !== 'shift') return;
    S.state = won ? 'won' : 'lost'; S.reason = reason; S.phase = 'calm'; player.shake = 0;
    if (blower) blower.enabled = false;
    G.emit('game:end', won, reason, S.stats);
  }
  S.restart = () => {
    S.state = 'shift'; S.timeLeft = SHIFT; S.strikes = 0; S.phase = 'calm'; S.alertT = 0; shockIdx = 0; bad = 0;
    for (const k in S.stats) S.stats[k] = 0;
    vans?.reset?.(); kea?.reset?.(); possums?.reset?.();
    player.teleport(PLAYER.spawn, PLAYER.spawnYaw); player.shake = 0;
    if (blower) { blower.enabled = true; blower.heat = 0; }
  };
  G.on('restart', S.restart);

  function nearCover() {
    const p = player.position;
    for (const c of cover) { const dx = p.x - c.pos[0], dz = p.z - c.pos[2]; if (dx * dx + dz * dz < c.r * c.r) return true; }
    return false;
  }

  S.update = (dt) => {
    player.update(dt);
    if (G.paused || S.state !== 'shift' || shot) return;
    S.timeLeft = Math.max(0, S.timeLeft - dt);
    const el = SHIFT - S.timeLeft;
    // director: pressure ramps over the shift; fewer arrivals while the ground is moving
    const ramp = 0.35 + 0.65 * (el / SHIFT);
    if (S.phase !== 'shake') {
      keaAcc += dt * ramp * 0.11; possAcc += dt * ramp * 0.07;
      if (keaAcc >= 1 && kea) { keaAcc -= 1; kea.spawn(1); }
      if (possAcc >= 1 && possums) { possAcc -= 1; possums.spawn(1); }
    }
    // aftershocks
    if (S.phase === 'calm' && shockIdx < SHOCKS.length && el >= SHOCKS[shockIdx]) {
      S.phase = 'alert'; S.alertT = 0; shockIdx++; bad = 0; G.emit('game:alert', 'alert');
    } else if (S.phase === 'alert') {
      S.alertT += dt; if (S.alertT >= ALERT) { S.phase = 'shake'; S.alertT = 0; S.stats.aftershocks++; G.emit('game:alert', 'shake'); }
    } else if (S.phase === 'shake') {
      S.alertT += dt;
      const sp = Math.hypot(player.velocity.x, player.velocity.z);
      S.coverOk = nearCover();
      S.compliant = input.down('crouch') && sp < 0.6 && !(blower && blower.firing);
      if (!S.compliant) bad += dt;
      player.shake = 0.6 * Math.sin(Math.min(1, S.alertT / SHAKE) * Math.PI) + 0.15;
      if (S.alertT >= SHAKE) {
        S.phase = 'calm'; player.shake = 0;
        if (bad > GRACE) { S.strikes++; G.emit('game:strike', S.strikes); if (S.strikes >= 3) end(false, 'stood-down'); }
        else { S.stats.held++; }
        G.emit('game:alert', 'clear', bad <= GRACE, S.coverOk);
      }
    }
    if (vans) for (const v of vans.list) if (v.integrity <= 0) { end(false, 'review:' + v.id); break; }
    if (S.timeLeft <= 0) end(true, 'reopened');
  };
  void L;
  return S;
}

export function showcase() { return null; }
