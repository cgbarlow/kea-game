// audio/engine — the ranger's two-stroke blower as four always-running loops (idle / rev / turbo + the air column),
// crossfaded and re-pitched from blower.power / turbo / overheated every frame; plus the ranger's own footsteps.
// Loops start once (never per-frame voices); update() only schedules gain/rate changes when they move. Zero allocation.
//   const eng = createEngineVoice(A, blower);  eng.update(dt, on);  eng.stop();
//   const steps = createFootsteps(A);           steps.update(dt, player);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createEngineVoice(A, blower) {
  const E = { started: false, idle: null, rev: null, turbo: null, air: null, tm: 0, onT: 0, wasHot: false,
    last: new Float32Array(8).fill(-1) };
  const set = (v, k, g, r) => {
    if (!v) return;
    if (Math.abs(g - E.last[k]) > 0.004) { v.setGain(g, 0.04); E.last[k] = g; }
    if (Math.abs(r - E.last[k + 4]) > 0.003) { v.setRate(r, 0.06); E.last[k + 4] = r; }
  };
  E.start = () => {
    if (E.started || !A.ready || A.mixer.ctx.state !== 'running') return;
    const o = { loop: true, bus: 'sfx', gain: 0, pitchJitter: 0, send: 0.06 };
    E.idle = A.mixer.play('blower_idle', o); E.rev = A.mixer.play('blower_rev', o);
    E.turbo = A.mixer.play('blower_turbo', o); E.air = A.mixer.play('airflow', o);
    E.started = !!E.idle; E.last.fill(-1);
  };
  // on: the engine is running (not paused / not stood down). The ranger keeps it idling through drop, cover, hold.
  E.update = (dt, on) => {
    if (!E.started) { E.start(); if (!E.started) return; }
    const p = blower ? Math.min(1, Math.max(0, blower.power || 0)) : 0;
    const hot = !!(blower && blower.overheated);
    E.tm += ((blower && blower.turbo ? 1 : 0) - E.tm) * Math.min(1, dt * 6);
    E.onT += ((on ? 1 : 0) - E.onT) * Math.min(1, dt * (on ? 4 : 2.5));
    if (hot && !E.wasHot && on) A.play('blower_cough', { gain: 0.9 });
    E.wasHot = hot;
    const m = E.onT, bog = hot ? 0.82 : 1, tm = E.tm;
    const rise = sstep(0.04, 0.55, p), s = Math.sin(Math.min(1, p / 0.85) * Math.PI / 2);
    set(E.idle, 0, m * 0.34 * (1 - 0.8 * rise), (1 + 0.55 * p) * bog);
    set(E.rev, 1, m * 0.55 * s * (1 - tm), (0.58 + 0.48 * p) * bog);
    set(E.turbo, 2, m * 0.62 * p * tm, 0.86 + 0.16 * p);
    set(E.air, 3, m * 0.5 * Math.pow(p, 1.4) * (1 + 0.35 * tm), 0.82 + 0.28 * p + 0.08 * tm);
  };
  E.stop = () => { for (const v of [E.idle, E.rev, E.turbo, E.air]) v && v.stop(0.4); E.started = false; };
  return E;
}

// Footsteps on asphalt from the player's horizontal speed (stride ~0.8 m walking, longer when sprinting) + landing.
export function createFootsteps(A) {
  const S = { acc: 0, grounded: true, vy: 0 };
  S.update = (dt, pl) => {
    if (!pl || !pl.velocity) return;
    const v = pl.velocity, sp = Math.hypot(v.x, v.z);
    if (pl.grounded && !S.grounded && S.vy < -2.5) A.play('step_concrete', { gain: 0.55, rate: 0.85 });
    S.grounded = !!pl.grounded; S.vy = v.y;
    if (!pl.grounded || sp < 0.6) { S.acc = Math.min(S.acc, 0.6); return; }
    S.acc += dt * sp / (0.7 + sp * 0.06);
    if (S.acc >= 1) { S.acc -= 1; A.play('step_concrete', { gain: 0.16 + 0.07 * Math.min(4, sp), rate: 0.92 + Math.random() * 0.12 }); }
  };
  return S;
}
