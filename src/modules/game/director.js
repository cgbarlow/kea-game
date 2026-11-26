// game/director — arrival pressure over one shift. Pure numbers, no allocation per frame.
//   createDirector(G, { kea, possums, scale }) → { update(dt, r, calmOnly), reset(), stats }
//   scale = shift length / 420 s (>= 1 stretches cadence on a long shift; a short bot shift keeps real-time cadence).
//   r = shift progress 0..1. Pressure ramps on an ease-in curve; kea arrive singly and, at three fixed points in the
//   shift, as a "flock" (a radio call, then 3 birds at once). Offended kea escalate: every return comes back faster
//   and peckier as the shift wears on (kea.tuning is scaled from its own base values, restored on reset).
//   Possums trickle in from the forest dens; the ceiling rises with the shift.
//   While the ground is moving (calmOnly = false) nothing new arrives: the wildlife is also following procedure.
export const DIRECTOR = {
  firstKea: 7, firstPossum: 16,                // s of grace before the first arrival
  keaCap: [2, 9], keaEvery: [13, 4.5],         // concurrent ceiling + seconds between arrivals, start → end of shift
  possCap: [1, 6], possEvery: [22, 8],
  flocks: [0.32, 0.58, 0.82], flockN: 3,       // shift fractions where a flock arrives
  offended: { dps: [1, 1.9], speed: [1, 2.2], wait: [1, 0.55] },   // multipliers on kea.tuning, start → end
};

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (r) => r * r * (3 - 2 * r) * 0.7 + r * 0.3;  // gentle start, steady late climb

export function createDirector(G, { kea, possums, scale = 1 }) {
  const D = DIRECTOR, ts = Math.max(1, scale);   // cadence never compresses: a short shift is a slice of the early game
  const tun = kea && kea.tuning;
  const base = tun ? { dps: tun.offendedDps, speed: tun.offendedSpeed, w0: tun.returnWait[0], w1: tun.returnWait[1] } : null;
  let keaT = 0, possT = 0, el = 0, flockIdx = 0, flockPending = 0, flockT = 0;
  const S = { stats: { flocks: 0, keaArrivals: 0, possumArrivals: 0 } };

  S.reset = () => {
    keaT = 0; possT = 0; el = 0; flockIdx = 0; flockPending = 0; flockT = 0;
    S.stats.flocks = 0; S.stats.keaArrivals = 0; S.stats.possumArrivals = 0;
    if (base) { tun.offendedDps = base.dps; tun.offendedSpeed = base.speed; tun.returnWait[0] = base.w0; tun.returnWait[1] = base.w1; }
  };

  S.update = (dt, r, calm) => {
    el += dt;
    const p = ease(Math.min(1, Math.max(0, r)));
    if (base) {   // offended escalation tracks the shift, not the bird
      const O = D.offended;
      tun.offendedDps = base.dps * lerp(O.dps[0], O.dps[1], p);
      tun.offendedSpeed = base.speed * lerp(O.speed[0], O.speed[1], p);
      const w = lerp(O.wait[0], O.wait[1], p); tun.returnWait[0] = base.w0 * w; tun.returnWait[1] = base.w1 * w;
    }
    if (!calm) return;
    // flocks: radio call first, birds 2.5 s later
    if (flockIdx < D.flocks.length && r >= D.flocks[flockIdx]) {
      flockIdx++; flockPending = D.flockN; flockT = 2.5; S.stats.flocks++;
      G.emit('game:toast', FLOCK_LINES[(flockIdx - 1) % FLOCK_LINES.length]);
      G.emit('game:flock', flockIdx);
    }
    if (flockPending > 0) {
      flockT -= dt;
      if (flockT <= 0 && kea) { const n = kea.spawn(flockPending); S.stats.keaArrivals += n; flockPending = 0; }
    }
    if (kea && el > D.firstKea * ts) {
      keaT += dt;
      const every = lerp(D.keaEvery[0], D.keaEvery[1], p) * ts, cap = Math.round(lerp(D.keaCap[0], D.keaCap[1], p));
      if (keaT >= every && kea.active() < cap) { keaT = 0; S.stats.keaArrivals += kea.spawn(1); }
    }
    if (possums && el > D.firstPossum * ts) {
      possT += dt;
      const every = lerp(D.possEvery[0], D.possEvery[1], p) * ts, cap = Math.round(lerp(D.possCap[0], D.possCap[1], p));
      if (possT >= every && possums.active() < cap) { possT = 0; S.stats.possumArrivals += possums.spawn(1); }
    }
  };
  return S;
}

const FLOCK_LINES = [
  'RADIO: Kea flock inbound off the range. Do not make eye contact. Do not negotiate.',
  'RADIO: Second flock sighted. Visitors are reminded the kea are not "being cheeky". They are organised.',
  'RADIO: Large flock. Ranger to maintain a calm, professional, airflow-forward posture.',
];
