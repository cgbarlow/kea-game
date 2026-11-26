// game — rules + the player body. One shift at the car park until SH73 reopens.
//   create(G, { input, colliders, vans, kea, possums, blower, cover }) → {
//     player,                       // first-person controller (./player.js): position/velocity/shake/crouched
//     state: 'shift'|'won'|'lost', timeLeft (s), shiftLength, strikes (0..3), phase: 'calm'|'alert'|'shake',
//     alertT (s into alert/shake), compliant (bool, live during shake), coverOk (near cover), magnitude (this shock),
//     nextShock (s until the next alert, Infinity if none), stats{...}, reason (end text key), restart(), update
//   }
//   Events emitted: 'game:start', 'game:alert' (kind 'alert'|'shake'|'clear', ok|magnitude, cover),
//                   'game:strike' (n), 'game:end' (won, reason, stats), 'game:toast' (text), 'game:flock' (n).
//   Listens: 'restart', 'ready', kea/possum/van events (stats + departmental commentary).
// Win: survive the shift (timeLeft 0) with every van above 0 integrity.
// Lose: any campervan integrity 0 ("review:<id>"), or 3 aftershock strikes ("stood-down").
// URL: ?shift=<s> shortens the shift (bots, 20..3600); aftershocks compress to fit. ?shot freezes the rules.
// Allocation-free update: every string is built only on rare events, loops are indexed.
import { create as createPlayer } from './player.js';
import { createDirector } from './director.js';
import { PLAYER } from '../../contracts.js';

export const RULES = {
  shift: 420,                                       // 7 minutes
  shocks: [62, 150, 236, 318, 392],                 // aftershock alert times on a full shift (s)
  magnitudes: [0.75, 0.9, 1.0, 1.2, 1.45],          // relative shake strength, the season gets worse
  alert: 3.0, shake: 6.0, grace: 1.6,               // alert lead, shake length, allowed non-compliant seconds
  stillSpeed: 0.6,                                  // m/s: "still"
  exemplaryCover: 0.6,                              // fraction of the shake held under cover = exemplary
  coverBonus: 10,                                   // s off the reopening estimate per exemplary hold
  strikesOut: 3,
};

const MINUTE_LINES = [
  [300, 'NZTA: Reopening estimate unchanged. Please stop asking the ranger.'],
  [180, 'NZTA: Geotechnical engineer has looked at the slip. Engineer has made a face.'],
  [60, 'NZTA: One minute. A digger has been sighted. Do not wave at the digger.'],
  [20, 'NZTA: Final checks. Tourists are reminded the road was always going to reopen.'],
];
const START_LINES = ['Shift commenced. SH73 is closed. You are not.', 'Protect the campervans. Do not feed the kea. Do not become the kea.'];
const RAID_LINES = ['A possum has entered a campervan. It has been described as "making itself at home".',
  'Possum inside a campervan. Tourists advised this is a pest and not a koala.', 'Possum incursion. The van door was, technically, open.'];
const TRAP_LINES = ['Possum relocated to trap box. Paperwork pending.', 'Trap box occupied. Form PC-4 to follow in triplicate.',
  'Possum contained. It is not happy about it. Noted.'];
const RETURN_LINES = ['A kea has returned. It is offended.', 'Kea back on site. It has not let it go.', 'Returning kea. Grievance escalated to a formal complaint.'];

export function create(G, { input, colliders, vans, kea, possums, blower, cover = [] }) {
  const R = RULES;
  const qs = parseFloat(G.params.get('shift'));
  const SHIFT = qs > 0 ? Math.max(20, Math.min(3600, qs)) : R.shift;
  // compress the aftershock schedule so the last one ends with a second to spare
  const k = Math.min(1, (SHIFT - R.alert - R.shake - 1) / R.shocks[R.shocks.length - 1]);
  const shockAt = R.shocks.map((t) => t * k);
  const player = createPlayer(G, { input, colliders });
  const director = createDirector(G, { kea, possums, scale: SHIFT / R.shift });
  const stats = { keaBlown: 0, possumsTrapped: 0, aftershocks: 0, held: 0, exemplary: 0, strikes: 0, raids: 0,
    offendedReturns: 0, worstGrievance: 0, bonus: 0, worstVan: 1, flocks: 0 };
  const S = { player, director, state: 'shift', timeLeft: SHIFT, shiftLength: SHIFT, strikes: 0, phase: 'calm', alertT: 0,
    compliant: true, coverOk: false, magnitude: 0, nextShock: shockAt[0], reason: '', stats, rules: R, shockAt };
  const shot = !!G.params.get('shot');
  let ready = false, started = false, shockIdx = 0, bad = 0, coverT = 0, minuteIdx = 0, ln = 0;
  const vanWarn = [0, 0, 0, 0, 0, 0];               // per van: 0 none, 1 warned at 50 %, 2 warned at 25 %
  const line = (a) => a[(ln++) % a.length];

  G.on('ready', () => { ready = true; });
  G.on('kea:blown', () => { if (S.state === 'shift') stats.keaBlown++; });
  G.on('kea:return', (kk) => {
    if (S.state !== 'shift') return;
    stats.offendedReturns++; if (kk && kk.offended > stats.worstGrievance) stats.worstGrievance = kk.offended;
    G.emit('game:toast', line(RETURN_LINES));
  });
  G.on('possum:trapped', () => { if (S.state !== 'shift') return; stats.possumsTrapped++; G.emit('game:toast', line(TRAP_LINES)); });
  G.on('possum:raid', () => { if (S.state !== 'shift') return; stats.raids++; G.emit('game:toast', line(RAID_LINES)); });
  G.on('van:damage', (v) => {
    if (S.state !== 'shift' || !vans) return;
    const i = vans.list.indexOf(v); if (i < 0) return;
    if (v.integrity < stats.worstVan) stats.worstVan = v.integrity;
    if (v.integrity < 0.25 && vanWarn[i] < 2) { vanWarn[i] = 2; G.emit('game:toast', `Van ${v.id} at 25 %. ${v.name} have opened a review app. They are choosing a star rating.`); }
    else if (v.integrity < 0.5 && vanWarn[i] < 1) { vanWarn[i] = 1; G.emit('game:toast', `Van ${v.id} at 50 %. ${v.name} have been heard using the word "unacceptable".`); }
  });

  function end(won, reason) {
    if (S.state !== 'shift') return;
    S.state = won ? 'won' : 'lost'; S.reason = reason; S.phase = 'calm'; S.alertT = 0; player.shake = 0; player.stumble = 0;
    stats.strikes = S.strikes; stats.flocks = director.stats.flocks;
    if (blower) { blower.enabled = false; blower.forceFire = false; }
    G.emit('game:end', won, reason, stats);
  }
  function begin() {
    started = true;
    G.emit('game:start', SHIFT);
    G.emit('game:toast', START_LINES[0]);
  }

  S.restart = () => {
    S.state = 'shift'; S.timeLeft = SHIFT; S.strikes = 0; S.phase = 'calm'; S.alertT = 0; S.compliant = true; S.coverOk = false;
    S.magnitude = 0; S.reason = ''; S.nextShock = shockAt[0];
    shockIdx = 0; bad = 0; coverT = 0; minuteIdx = 0; started = false;
    for (const key in stats) stats[key] = 0; stats.worstVan = 1;
    for (let i = 0; i < vanWarn.length; i++) vanWarn[i] = 0;
    director.reset();
    vans?.reset?.(); kea?.reset?.(); possums?.reset?.();
    player.teleport(PLAYER.spawn, PLAYER.spawnYaw); player.shake = 0; player.stumble = 0;
    input?.clear?.();
    if (blower) { blower.enabled = true; blower.heat = 0; blower.overheated = false; }
  };
  G.on('restart', S.restart);

  function nearCover() {
    const p = player.position;
    for (let i = 0; i < cover.length; i++) {
      const c = cover[i], dx = p.x - c.pos[0], dz = p.z - c.pos[2];
      if (dx * dx + dz * dz < c.r * c.r) return true;
    }
    return false;
  }

  S.update = (dt) => {
    player.update(dt);
    if (!ready || G.paused || S.state !== 'shift' || shot) return;
    if (!started) begin();
    S.timeLeft = Math.max(0, S.timeLeft - dt);
    const el = SHIFT - S.timeLeft, r = el / SHIFT;
    director.update(dt, r, S.phase === 'calm');
    S.nextShock = shockIdx < shockAt.length ? Math.max(0, shockAt[shockIdx] - el) : Infinity;

    // departmental time checks (only on a full-length shift; a bot shift is too short to be patronised)
    while (minuteIdx < MINUTE_LINES.length && S.timeLeft <= MINUTE_LINES[minuteIdx][0]) {
      if (SHIFT >= R.shift && S.timeLeft > MINUTE_LINES[minuteIdx][0] - 2) G.emit('game:toast', MINUTE_LINES[minuteIdx][1]);
      minuteIdx++;
    }

    // aftershocks: alert (3 s, a P-wave tremor) → shake (6 s) → clear
    const crouched = input.down('crouch');
    S.coverOk = nearCover();
    if (S.phase === 'calm' && shockIdx < shockAt.length && el >= shockAt[shockIdx]) {
      S.magnitude = R.magnitudes[shockIdx % R.magnitudes.length];
      S.phase = 'alert'; S.alertT = 0; shockIdx++; bad = 0; coverT = 0;
      G.emit('game:alert', 'alert', S.magnitude);
    } else if (S.phase === 'alert') {
      S.alertT += dt;
      player.shake = 0.06 + 0.06 * (S.alertT / R.alert);
      if (S.alertT >= R.alert) { S.phase = 'shake'; S.alertT = 0; stats.aftershocks++; G.emit('game:alert', 'shake', S.magnitude); }
    } else if (S.phase === 'shake') {
      S.alertT += dt;
      const v = player.velocity, sp = Math.sqrt(v.x * v.x + v.z * v.z);
      S.compliant = crouched && sp < R.stillSpeed && !(blower && blower.firing);
      if (!S.compliant) bad += dt; else if (S.coverOk) coverT += dt;
      const u = Math.min(1, S.alertT / R.shake);
      // fast onset, long rolling tail
      const env = Math.min(1, u * 6) * (1 - u) * (1 - u) * 1.35 + 0.12 * (1 - u);
      player.shake = S.magnitude * env * 1.25;
      player.stumble = crouched ? 0 : player.shake;
      if (S.alertT >= R.shake) {
        S.phase = 'calm'; S.alertT = 0; player.shake = 0; player.stumble = 0;
        const ok = bad <= R.grace, exemplary = ok && coverT >= R.shake * R.exemplaryCover;
        if (!ok) {
          S.strikes++; stats.strikes = S.strikes; G.emit('game:strike', S.strikes);
          G.emit('game:alert', 'clear', false, false);
          if (S.strikes >= R.strikesOut) end(false, 'stood-down');
        } else {
          stats.held++;
          G.emit('game:alert', 'clear', true, exemplary);
          if (exemplary) {
            stats.exemplary++;
            const b = Math.min(R.coverBonus * Math.min(1, SHIFT / R.shift), Math.max(0, S.timeLeft - 1)); S.timeLeft -= b; stats.bonus += b;
            G.emit('game:toast', `Exemplary drop, cover and hold. NZTA has revised the reopening estimate by ${Math.round(b)} s. Do not let it go to your head.`);
          }
        }
      }
    } else { player.shake = 0; player.stumble = 0; }
    // the blower comes down while you hold (it is not a drop-cover-hold accessory)
    if (blower) blower.enabled = !(S.phase === 'shake' && crouched);

    if (vans) for (let i = 0; i < vans.list.length; i++) if (vans.list[i].integrity <= 0) { end(false, 'review:' + vans.list[i].id); break; }
    if (S.state === 'shift' && S.timeLeft <= 0) end(true, 'reopened');
  };
  return S;
}

// The rules have no geometry of their own: frame the spawn view (pose 2) the shift starts from.
export function showcase() { return { cam: [2, 1.68, -9], target: [-1, 1.5, 4] }; }
