// audio — the car park's soundscape. Mixer graph (suspended until the first gesture); every sound is synthesised
// after G 'ready', time-sliced (5 ms slices), gameplay banks first, music second. No audio files.
//   create(G, { blower }) → { mixer, music, play(name, o), setVolume(v), unlock(), update, ready, demo() }
// Layers: two-stroke blower (idle / rev / turbo + airflow, tracking blower.power, turbo and overheat: engine.js),
// kea "keee-aa" calls / pecks / flaps, possum hiss / chatter / skid, trap-box thunk, aftershock phone alert + onset +
// rumble loop, PA all-clear chime, strike stamp, alpine wind bed + distant kea off the range, sparse music (score.js).
// Events: kea:call/land/peck/blown, possum:raid/blown/trapped, game:alert (alert|shake|clear), game:strike, game:end,
// restart, ui:state. window.__audioSelfTest() meters every buffer we play (selftest.js).
import { createMixer } from '../../cookbook/audio/mixer.js';
import { presetJobs } from '../../cookbook/audio/sfx.js';
import { createMusic } from '../../cookbook/audio/music.js';
import { runJobs, toAudioBuffer } from '../../cookbook/audio/synth.js';
import { LAYOUT } from '../../contracts.js';
import { recipeJobs } from './recipes.js';
import { scoreJobs, LOOP } from './score.js';
import { installSelfTest, COOKBOOK_SFX } from './selftest.js';
import { createEngineVoice, createFootsteps } from './engine.js';

const KEA_CALL = { arrive: ['kea_arrive', 0.85], offended: ['kea_offended', 1.0], alarm: ['kea_alarm', 0.95], chatter: ['kea_chatter', 0.55] };

export function create(G, { blower } = {}) {
  const mixer = createMixer({ volume: 0.8 });
  installSelfTest();
  const A = { mixer, music: null, ready: false, musicReady: false, demoOn: false };
  const running = () => mixer.ctx.state === 'running';
  A.play = (name, o) => (running() && mixer.has(name) ? mixer.play(name, o) : null);
  A.setVolume = (v) => mixer.setVolume('master', Math.max(0, Math.min(1.5, +v || 0)));
  A.unlock = () => mixer.unlock();
  const whenRunning = (fn) => (running() ? fn() : mixer.unlocked.then(fn));

  const engine = A.engine = createEngineVoice(A, blower);
  const steps = createFootsteps(A);
  let wind = null, rumble = null, stems = null;

  const toBank = (jobs, res) => { const b = {}; jobs.forEach((jb, i) => { (b[jb.name] ||= [])[jb.variant || 0] = toAudioBuffer(mixer.ctx, res[i]); }); return b; };
  const startMusic = () => {
    if (!stems || A.music) return;
    A.music = createMusic(mixer, { stems, loop: LOOP }, { intensity: 0.15, gain: 0.7 });
    A.music.start();
  };
  const startBeds = () => {
    if (!wind) wind = A.play('alpine_wind', { loop: true, bus: 'ambience', gain: 0.55 });
    startMusic();
  };

  G.on('ready', () => (async () => {
    // 1) gameplay banks (blower, creatures, quake, ambience) + the few cookbook presets we borrow
    const jobs = [...recipeJobs({ sr: 32000 }), ...presetJobs({ sr: 32000, only: COOKBOOK_SFX })];
    const res = await runJobs(jobs.map((jb) => jb.gen), { budgetMs: 4, perFrame: true });
    mixer.addBank(toBank(jobs, res));
    await mixer.setEnv('outdoor');
    A.ready = true;
    whenRunning(startBeds);
    // 2) the score (pad + bass stems, our pluck line, end stings)
    const sj = scoreJobs({ sr: 22050 });
    const sr = await runJobs(sj.map((jb) => jb.gen), { budgetMs: 4, perFrame: true });
    stems = {};
    sj.forEach((jb, i) => { const buf = toAudioBuffer(mixer.ctx, sr[i]); if (jb.stem) stems[jb.name] = buf; else mixer.addBank({ [jb.name]: [buf] }); });
    A.musicReady = true;
    whenRunning(startBeds);
  })().catch((e) => G.errors.push('audio: ' + (e && e.message || e))));

  // ---------- creatures (positional: follow proxies over each actor's pos vector, made once per actor) ----------
  const keaProxy = [], possProxy = [], keaT = new Float64Array(64), peckT = new Float64Array(64), possT = new Float64Array(64);
  const proxy = (arr, a) => (arr[a.i] ||= { position: a.pos });
  const now = () => mixer.ctx.currentTime;
  G.on('kea:call', (k, kind) => {
    const c = KEA_CALL[kind]; if (!c || !k) return;
    const t = now(); if (kind !== 'alarm' && t - keaT[k.i & 63] < 1.4) return;
    keaT[k.i & 63] = t;
    A.play(c[0], { follow: proxy(keaProxy, k), gain: c[1], send: 0.35, refDistance: 3 });
  });
  G.on('kea:land', (k) => A.play('kea_flap', { follow: proxy(keaProxy, k), gain: 0.55, send: 0.1 }));
  G.on('kea:peck', (k) => {
    const t = now(); if (t - peckT[k.i & 63] < 0.12) return; peckT[k.i & 63] = t;
    A.play('kea_peck', { follow: proxy(keaProxy, k), gain: 0.7, refDistance: 1.5 });
  });
  G.on('kea:blown', (k) => {
    A.play('kea_flap', { follow: proxy(keaProxy, k), gain: 0.8, rate: 1.25, send: 0.15 });
    A.play('whoosh', { follow: proxy(keaProxy, k), gain: 0.45, send: 0.2 });
  });
  G.on('possum:raid', (p) => {
    const t = now(); if (t - possT[p.i & 63] < 1.2) return; possT[p.i & 63] = t;
    A.play('possum_chatter', { follow: proxy(possProxy, p), gain: 0.8, send: 0.12 });
  });
  G.on('possum:blown', (p) => {
    A.play('possum_hiss', { follow: proxy(possProxy, p), gain: 0.85, send: 0.12 });
    A.play('possum_skid', { follow: proxy(possProxy, p), gain: 0.7 });
  });
  const trapPos = LAYOUT.traps.map(([x, z]) => [x, 0.35, z]);
  G.on('possum:trapped', (p, ti) => {
    const pos = trapPos[ti] || (p && p.pos);
    if (!pos) return;
    A.play('trap_thunk', { pos, gain: 1.0, send: 0.25, refDistance: 3 });
    A.play('possum_chatter', { pos, gain: 0.22, rate: 0.85, when: 0.45 });       // a complaint, lodged from inside
  });

  // ---------- aftershock: phone alert → onset + rumble → PA chime ----------
  G.on('game:alert', (kind, ok) => {
    if (kind === 'alert') {
      A.play('phone_alert', { bus: 'ui', gain: 1.4, duck: { bus: 'music', db: -10, hold: 2.6, release: 1 } });
      mixer.duck('ambience', -4, 0.2, 2.8, 1);
    } else if (kind === 'shake') {
      A.play('quake_onset', { gain: 1.0, send: 0.3, duck: { bus: 'music', db: -16, hold: 6, release: 2.5 } });
      if (rumble) rumble.stop(0.3);
      rumble = A.play('quake_rumble', { loop: true, gain: 0, send: 0.2 });
      if (rumble) rumble.setGain(0.95, 0.5);
    } else if (kind === 'clear') {
      if (rumble) { rumble.stop(1.8); rumble = null; }
      if (ok !== false) A.play('all_clear', { bus: 'ui', gain: 0.9, when: 0.6 });
    }
  });
  G.on('game:strike', () => A.play('strike_stamp', { bus: 'ui', gain: 1.3 }));
  G.on('game:end', (won) => {
    if (rumble) { rumble.stop(1); rumble = null; }
    if (A.music) A.music.setIntensity(0, 1.5);
    mixer.duck('music', -30, 1.2, 8, 3);
    A.play(won ? 'sting_win' : 'sting_lose', { bus: 'ui', gain: 1.0, when: 0.8 });
  });
  G.on('restart', () => { if (A.music) A.music.setIntensity(0.15, 3); });
  G.on('ui:state', (s) => {
    mixer.setVolume('sfx', s === 'paused' ? 0.35 : 1, 0.3);
    mixer.setVolume('ambience', s === 'playing' ? 0.7 : 0.5, 0.6);
  });

  // ---------- per frame (zero allocation) ----------
  let dirT = 0, ambT = 9, chatT = 6, curI = 0.15;
  A.update = (dt) => {
    mixer.update(G.camera);
    if (!A.ready || !running()) return;
    const game = G.mods.game;
    const on = !G.paused && (!game || !game.state || game.state === 'shift');
    engine.update(dt, on);
    if (!G.paused && game && game.player) steps.update(dt, game.player);
    if (A.demoOn) demoUpdate(dt);
    dirT -= dt; ambT -= dt; chatT -= dt;
    if (dirT <= 0) { // music director: a little bass as the car park fills with pests; nothing under an alert
      dirT = 1;
      const nk = G.mods.kea?.active?.() || 0, np = G.mods.possums?.active?.() || 0, ph = game?.phase;
      const want = ph === 'alert' || ph === 'shake' ? 0.04 : 0.12 + Math.min(0.28, nk * 0.05 + np * 0.04);
      if (A.music && Math.abs(want - curI) > 0.02) { curI = want; A.music.setIntensity(want, 4); }
    }
    if (ambT <= 0) { // a kea somewhere up on the range, minding its own business (for now)
      ambT = 11 + Math.random() * 14;
      const R = LAYOUT.keaRoost[(Math.random() * LAYOUT.keaRoost.length) | 0];
      A.play(Math.random() < 0.7 ? 'kea_arrive' : 'kea_chatter', { pos: R, gain: 0.5, send: 0.7, refDistance: 8, rate: 0.95 + Math.random() * 0.1 });
    }
    if (chatT <= 0) { // possums mutter while they work
      chatT = 5 + Math.random() * 7;
      const list = G.mods.possums?.list;
      if (list) for (let i = 0; i < list.length; i++) { const p = list[i]; if (p.state === 'walk' || p.state === 'raid') { A.play('possum_chatter', { follow: proxy(possProxy, p), gain: 0.45 }); break; } }
    }
  };

  // ---------- ?show=audio: a looping tour of every cue (blower spool → kea → possum → trap → aftershock) ----------
  const L = LAYOUT, cueAt = (x, y, z) => [x, y, z];
  const TOUR = [
    [0.5, 'kea_arrive', { pos: cueAt(-4, 2.4, 6), gain: 0.85, send: 0.35 }], [2.0, 'kea_peck', { pos: cueAt(0, 2.2, 1.4), gain: 0.8 }],
    [3.0, 'kea_offended', { pos: cueAt(-1, 2.6, 2), gain: 1, send: 0.35 }], [4.6, 'kea_alarm', { pos: cueAt(1, 3, 3), gain: 0.95, send: 0.3 }],
    [5.6, 'possum_chatter', { pos: cueAt(3, 0.3, 2), gain: 0.8 }], [6.8, 'possum_hiss', { pos: cueAt(3, 0.3, 2), gain: 0.85 }],
    [7.4, 'possum_skid', { pos: cueAt(4, 0.3, 4), gain: 0.7 }], [8.6, 'trap_thunk', { pos: cueAt(L.traps[2][0], 0.35, L.traps[2][1]), gain: 1, send: 0.25 }],
    [10.0, 'phone_alert', { bus: 'ui', gain: 1.4 }], [13.0, 'quake_onset', { gain: 1, send: 0.3 }], [17.0, 'all_clear', { bus: 'ui', gain: 0.9 }],
    [18.6, 'strike_stamp', { bus: 'ui', gain: 1.3 }], [19.6, 'blower_cough', { gain: 0.9 }],
  ];
  let demoT = 0, demoI = 0, demoLast = 0;
  function demoUpdate(dt) {
    demoT += dt;
    const t = demoT % 24;
    if (t < demoLast) demoI = 0;
    demoLast = t;
    if (blower) blower.forceFire = (t > 0.5 && t < 4.5) || (t > 21 && t < 23.5);
    if (demoI < TOUR.length && t >= TOUR[demoI][0]) { const c = TOUR[demoI++]; A.play(c[1], c[2]); }
  }
  A.demo = () => { A.demoOn = true; demoT = 0; demoI = 0; };
  return A;
}

// ?show=audio: the spawn view over the three vans (the soundscape plays its cue tour once unlocked)
export function showcase(G) {
  G.on('ready', () => G.mods.audio?.demo?.());
  return { cam: [2, 1.68, -9], target: [-1, 1.5, 4] };
}
