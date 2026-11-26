// hud — menus (./ui.js state machine) + the in-shift HUD, written in the voice of a tired government department.
//   create(G, { input, player, quality, path, game, vans, blower }) → { ui, update, toast(text), set(bind, v) }
//   HUD: SH73 reopening estimate (timer + shift track), campervan register (rego plate, tourist names, integrity,
//   status), blower temp gauge (segments, turbo, overheat), DROP / COVER / HOLD banner with countdown + compliance,
//   procedure strikes, toast feed (time-stamped notices), end screen (incident report: stats, rating, restart).
// Every DOM write is guarded by a last-value cache: text/class/width only change when the value changes, and the
// update loop allocates nothing. Menus carry class .ui (html.shot hides them); the in-shift HUD is .ui.hud-play,
// which html.shot keeps visible with all animation frozen, so ?shot captures show the HUD deterministically.
// Showcase: ?show=hud[&hudscreen=hud|title|pause|settings|end] freezes a representative state at the spawn pose.
import { create as createUI } from './ui.js';
import { create as createFps } from './fps.js';
import { LIVERY } from '../vans/livery.js';
import { END_TEXT, REVIEWS, VAN_STATUS, HEAT_STATE, RATINGS, ALERT_COPY, TOASTS, TICKER } from './copy.js';
import { KEA_COPY, KEA_ALERT, KEA_TICKER, KEA_END, KEA_RATINGS, CONE_STATUS, CONE_HUD, PART_NAME } from '../keagame/copy.js';

const SEGS = 14, TOAST_N = 4, TOAST_LIFE = 7;
const SHOW_CAM = [2, 1.68, -9], SHOW_TARGET = [-1, 1.5, 4];

export function create(G, { input, player, quality, path, game, vans, blower }) {
  const ui = createUI(G, { input, player, quality, path });
  G.mods.ui = G.mods.ui || ui;
  const fps = createFps(G);   // F3 / ` toggles the frame-rate readout (hud/fps.js)
  if (player && !G.mods.player) G.mods.player = player;
  const hud = document.getElementById('hud');
  const q = (k) => hud.querySelector(`[data-h="${k}"]`);
  const mk = (cls, parent, tag = 'span') => { const n = document.createElement(tag); if (cls) n.className = cls; parent.appendChild(n); return n; };

  const N = { clock: q('clock'), track: q('track'), banner: q('banner'), bTop: q('bTop'), bCount: q('bCount'), bSub: q('bSub'),
    toasts: q('toasts'), ticker: q('ticker'), heat: q('heat'), heatState: q('heatState'), segs: q('segs'), vans: q('vans'), strikeNote: q('strikeNote') };
  const timerEl = hud.querySelector('.hud-timer'), cross = hud.querySelector('.crosshair');
  const strikeBoxes = hud.querySelectorAll('.hud-strikes.ranger-only .s-boxes i');
  const segs = []; for (let i = 0; i < SEGS; i++) { const s = mk('', N.segs, 'i'); s.className = i >= SEGS * 0.8 ? 'hot' : i >= SEGS * 0.5 ? 'warm' : ''; segs.push(s); }

  // campervan register: one plate per van (rego from the livery, tourist names from LAYOUT)
  const plates = (vans?.list || []).map((v) => {
    const p = mk('van-plate', N.vans, 'div');
    const rego = mk('v-rego', p); rego.textContent = LIVERY[v.id]?.rego || v.id;
    const body = mk('v-body', p);
    const name = mk('v-name', body); name.textContent = v.name;
    const status = mk('v-status', body);
    const pct = mk('v-pct', p);
    const bar = mk('v-bar', p); const fill = mk('', bar, 'i');
    return { v, p, status, pct, fill, last: -1, lastS: -1, hitOn: false, hitUntil: -1, warned: false, lockOn: false };
  });

  // ---- Kea mode panels (G.mode === 'kea'; #ui[data-mode] toggles .kea-only / .ranger-only in ui.css) ----
  const kg = G.mods.keagame || null;               // staged before the hud
  const kp = () => G.mods.keaplayer || null;
  const KQ = (k) => hud.querySelector(`[data-k="${k}"]`);
  const KN = { hint: KQ('hint'), banked: KQ('banked'), pips: KQ('pips'), cone: KQ('cone'), carry: KQ('carry'), notices: KQ('notices'), noticeNote: KQ('noticeNote'),
    offended: KQ('offended'), offNote: KQ('offNote'), wing: KQ('wing'), wingState: KQ('wingState'), wingSegs: KQ('wingSegs'), pull: KQ('pull') };
  const noticeBoxes = KN.notices ? KN.notices.querySelectorAll('i') : [], offPips = KN.offended ? KN.offended.querySelectorAll('i') : [];
  const kPips = []; if (KN.pips) for (let i = 0; i < 9; i++) kPips.push(mk('', KN.pips, 'i'));
  const wingSegs = []; if (KN.wingSegs) for (let i = 0; i < SEGS; i++) wingSegs.push(mk('', KN.wingSegs, 'i'));
  const PULL_P = []; for (let i = 0; i <= 20; i++) PULL_P.push(String(i / 20));
  const NOTICE_NOTE = ['3 notices = relocation', 'On file. Read it.', 'Final notice pending', 'Relocation scheduled'];
  const OFF_NOTE = ['Not yet', 'Mildly', 'Considerably', 'Maximum (provisional)'];
  const WING_STATE = [[0.25, 'Low. Land somewhere.'], [0.6, 'Adequate'], [1.01, 'Full (unauthorised)']];
  const K = { banked: -1, cone: '', carry: '#', notices: -1, off: -1, wingN: -1, wingS: -1, pull: -1, mode: '' };

  // ---- tiny guarded writers (no allocation, no churn) ----
  const cache = new Map();
  const text = (node, v) => { if (cache.get(node) !== v) { cache.set(node, v); node.textContent = v; } };
  const flag = (node, cls, on) => { if (node.classList.contains(cls) !== on) node.classList.toggle(cls, on); };
  const shotMode = !!G.params.get('shot');
  let lastSec = -1, lastTick = -1, lastTrack = -1, lastHeatN = -1, lastStrikes = -1, lastCount = -1, wasHot = false, lastPhase = '', lastSub = '';

  // showcase (?show=hud): a frozen, representative mid-shift state
  const show = G.params.get('show') === 'hud';
  const demo = show ? { timeLeft: 257, shiftLength: 420, strikes: 1, phase: 'alert', alertT: 1.2, compliant: false, coverOk: false,
    ints: [0.91, 0.42, 0.68], heat: 0.86, turbo: false, firing: false, overheated: false } : null;
  // engine idling between bursts: ?shot forces the jet on from the first frame, and its buzz springs + puffs would
  // still be settling when the (slow, dt-clamped) capture fires; switch it off before any frame runs
  if (show && blower) blower.forceFire = false;
  if (show) hud.classList.add('frozen');

  // ---- toast feed: 4 pooled slips, newest at the bottom, time-stamped in shift time ----
  const toastPool = [];
  for (let i = 0; i < TOAST_N; i++) { const n = mk('toast', N.toasts, 'div'); const ts = mk('t-time', n); const tx = mk('t-text', n); toastPool.push({ n, ts, tx, t: 0, on: false }); }
  let lastToast = '', lastToastAt = -99;
  const stamp = () => {
    const src = demo || (G.mode === 'kea' && kg ? kg : game);
    const el = src ? src.shiftLength - src.timeLeft : 0;
    const mins = 16 * 60 + 40 + Math.floor(el / 6);
    const h = Math.floor(mins / 60) % 24, m = mins % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  };
  const H = { ui, fps };
  H.set = (k, v) => ui.set(k, v);
  H.toast = (msg) => {
    if (!msg || (msg === lastToast && G.t - lastToastAt < 2.5)) return;
    lastToast = msg; lastToastAt = G.t;
    let slot = toastPool[0];
    for (const s of toastPool) if (s.t < slot.t) slot = s;
    slot.ts.textContent = stamp(); slot.tx.textContent = msg; slot.t = TOAST_LIFE;
    N.toasts.appendChild(slot.n);
    slot.n.classList.remove('on'); void slot.n.offsetWidth; slot.n.classList.add('on'); slot.on = true;
  };
  const clearToasts = () => { for (const s of toastPool) { s.t = 0; s.on = false; s.n.classList.remove('on'); } lastToast = ''; };

  // ---- events (departmental voice) ----
  const keaToastAt = new Map();
  G.on('game:toast', H.toast);
  G.on('kea:land', (k, v) => {
    if (!v || G.mode === 'kea') return;              // kea mode: keagame writes its own perch notices
    const off = k?.offended || 0;
    if (off > 0) { H.toast(TOASTS.keaOffended(v.name, off)); return; }
    if (G.t - (keaToastAt.get(v.id) ?? -99) > 14) { keaToastAt.set(v.id, G.t); H.toast(TOASTS.keaLand(v.name)); }
  });
  G.on('possum:raid', (p, v) => { if (v && G.mode !== 'kea') H.toast(TOASTS.raid(v.name)); });
  G.on('van:damage', (v) => { const pl = plates.find((x) => x.v === v); if (pl) pl.hitUntil = G.t + 0.45; });
  G.on('game:strike', (n) => H.toast(TOASTS.strike(n)));
  G.on('game:alert', (kind, ok, cover) => { if (kind === 'clear' && G.mode !== 'kea') H.toast(ok ? (cover ? TOASTS.clearCover : TOASTS.clearOk) : TOASTS.clearBad); });
  // the view model belongs to the shift, not the title flyover (and not to the kea)
  G.on('ui:state', (s) => { if (blower?.overlay?.scene) blower.overlay.scene.visible = s !== 'title' && G.mode !== 'kea'; });
  const startToasts = () => {
    clearToasts();
    if (G.mode === 'kea') { H.toast(KEA_COPY.start[0]); H.toast(KEA_COPY.start[1]); } else { H.toast(TOASTS.start); H.toast(TOASTS.sign); }
  };
  G.on('ui:state', (s, prev) => { if (s === 'playing' && (prev === 'title' || prev === 'boot')) startToasts(); });
  G.on('mode:start', (id) => { if (id === 'kea' && ui.state === 'ended') startToasts(); });   // kea restart from the end screen
  G.on('restart', () => { clearToasts(); for (const p of plates) { p.warned = false; p.hitUntil = -1; } wasHot = false; });

  // ---- end screen (incident report) ----
  const endEl = document.getElementById('end');
  const E = {}; endEl.querySelectorAll('[data-end]').forEach((n) => { E[n.dataset.end] = n; });
  const fmtClock = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; };
  const fmtTime = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; };
  function fillEnd(won, reason, stats, strikes, served, ints) {
    const key = reason && reason.startsWith('review') ? 'review' : reason;
    const T = END_TEXT[key] || { kicker: 'Incident report', heading: 'Shift over', sub: '' };
    E.kicker.textContent = T.kicker; E.heading.textContent = T.heading;
    E.sub.textContent = key === 'review' ? (REVIEWS[reason.split(':')[1]] || REVIEWS.B) : T.sub;
    endEl.dataset.won = won ? '1' : '0';
    const aft = stats.aftershocks || 0, held = stats.held || 0;
    let avg = 0; for (const x of ints) avg += x.i; avg = ints.length ? avg / ints.length : 0;
    const rows = [
      ['Shift served', fmtTime(served) + ' of ' + fmtTime(game?.shiftLength || 420)],
      ['Kea relocated (temporarily)', String(stats.keaBlown || 0)],
      ['Possums in trap boxes', String(stats.possumsTrapped || 0)],
      ['Aftershocks held', `${held} of ${aft}`],
      ['Procedure strikes', `${strikes} of 3`],
      ...ints.map((x) => [`${x.name} (${x.rego})`, x.i <= 0 ? 'Review posted' : Math.round(x.i * 100) + '% intact']),
    ];
    E.stats.textContent = '';
    for (const [k, v] of rows) { const dt = mk('', E.stats, 'dt'); dt.textContent = k; const dd = mk('', E.stats, 'dd'); dd.textContent = v; }
    const score = (won ? 0.35 : 0) + 0.45 * avg + 0.2 * (aft ? held / aft : 1) - 0.08 * strikes;
    E.rating.textContent = (RATINGS.find((r) => score > r[0]) || RATINGS[RATINGS.length - 1])[1];
  }
  function fillKeaEnd(won, reason, st) {
    const T = KEA_END[reason] || KEA_END['kea:reopened'];
    E.kicker.textContent = T.kicker; E.heading.textContent = T.heading; E.sub.textContent = T.sub;
    endEl.dataset.won = won ? '1' : '0';
    const q = st.quota || 9, parts = st.parts || 0, served = st.served || 0;
    const rows = [
      ['Shift observed', fmtTime(served) + ' of ' + fmtTime(kg?.shiftLength || 420)],
      ['Items held for research', `${parts} of ${q}`],
      ['Wiper blades · seals · mirrors · straps', `${st.wiper || 0} · ${st.seal || 0} · ${st.mirror || 0} · ${st.strap || 0}`],
      ['Road cone', CONE_STATUS[st.coneStatus] || CONE_STATUS.gate],
      ['Notices received', `${st.notices || 0} of 3`],
      ['Times offended', String(st.offended || 0)],
      ['Aftershocks observed (not held)', String(st.aftershocks || 0)],
    ];
    E.stats.textContent = '';
    for (const [k, v] of rows) { const dt = mk('', E.stats, 'dt'); dt.textContent = k; const dd = mk('', E.stats, 'dd'); dd.textContent = v; }
    const score = 0.5 * Math.min(1, parts / q) + (st.coneStatus === 'banked' ? 0.3 : 0) + (won ? 0.2 : 0) - 0.06 * (st.notices || 0);
    E.rating.textContent = (KEA_RATINGS.find((r) => score > r[0]) || KEA_RATINGS[KEA_RATINGS.length - 1])[1];
  }
  G.on('game:end', (won, reason, stats) => {
    if (G.mode === 'kea') { fillKeaEnd(won, reason, stats || {}); ui.setState('ended'); return; }
    const ints = plates.map((p) => ({ name: p.v.name, rego: LIVERY[p.v.id]?.rego || p.v.id, i: p.v.integrity }));
    fillEnd(won, reason, stats || {}, game?.strikes || 0, game ? game.shiftLength - game.timeLeft : 0, ints);
    ui.setState('ended');
  });

  // ---- showcase: a frozen, representative mid-shift state ----
  if (show) {
    G.on('ready', () => {
      ui.noLock = true;
      window.__setCam?.(SHOW_CAM, SHOW_TARGET);
      const scr = G.params.get('hudscreen') || 'hud';
      // menu showcases ARE the menu layer: html.shot hides menus, so drop it for them (the HUD itself survives .shot)
      if (scr !== 'hud') document.documentElement.classList.remove('shot');
      if (scr === 'title') { ui.setState('title'); return; }
      ui.setState('playing'); G.paused = true;
      plates[1] && (plates[1].hitUntil = 1e9);
      H.toast('Shift 0417 commenced. The highway is closed. You are not.');
      H.toast(TOASTS.keaOffended('The Okonkwos', 2));
      H.toast('Possum relocated to trap box. Paperwork pending.');
      H.toast(TOASTS.raid('Mr. Tanaka'));
      if (scr === 'pause') ui.setState('paused');
      else if (scr === 'settings') ui.setState('settings');
      else if (scr === 'end') {
        fillEnd(false, 'review:B', { keaBlown: 23, possumsTrapped: 6, aftershocks: 4, held: 3 }, 1, 318,
          plates.map((p, i) => ({ name: p.v.name, rego: LIVERY[p.v.id]?.rego || p.v.id, i: [0.64, 0, 0.31][i] ?? 0.5 })));
        ui.setState('ended');
      }
    });
  }

  // ---- per-frame (guarded writes only) ----
  H.update = (dt) => {
    fps.update();
    ui.update(dt);
    if (!demo) for (const s of toastPool) if (s.on) { s.t -= dt; if (s.t <= 0) { s.on = false; s.n.classList.remove('on'); } }
    const kMode = G.mode === 'kea' && !!kg;
    if (K.mode !== (kMode ? 'kea' : 'ranger')) {      // mode switch: re-key every cached writer
      K.mode = kMode ? 'kea' : 'ranger'; lastSec = -1; lastTick = -1; lastTrack = -1; lastPhase = ''; lastSub = ''; lastStrikes = -1;
      K.banked = -1; K.cone = ''; K.carry = '#'; K.notices = -1; K.off = -1; K.wingN = -1; K.wingS = -1; K.pull = -1;
      for (const p of plates) { p.last = -1; p.lastS = -1; p.lockOn = false; flag(p.p, 'locked', false); }
    }
    if (ui.state !== 'playing' || !(kMode || game)) return;
    const S = demo || (kMode ? kg : game);
    const TK = kMode ? KEA_TICKER : TICKER;

    // timer + shift track
    const sec = Math.ceil(S.timeLeft);
    if (sec !== lastSec) { lastSec = sec; text(N.clock, fmtClock(sec)); flag(timerEl, 'late', sec <= 60); }
    // advisory ticker: rotates every 12 s of shift time; under ?shot it is keyed to the camera spot (stable per pose)
    const tk = shotMode ? Math.abs(Math.round(G.camera.position.x * 3 + G.camera.position.z * 7)) % TK.length
      : Math.floor((S.shiftLength - S.timeLeft) / 12) % TK.length;
    if (tk !== lastTick) { lastTick = tk; text(N.ticker, TK[tk]); }
    const tr = Math.round((1 - S.timeLeft / (S.shiftLength || 1)) * 400);
    if (tr !== lastTrack) { lastTrack = tr; N.track.style.width = (tr / 4) + '%'; }

    // aftershock banner
    const ph = S.phase === 'alert' || S.phase === 'shake' ? S.phase : '';
    if (ph !== lastPhase) {
      lastPhase = ph; N.banner.dataset.phase = ph; flag(N.banner, 'on', !!ph); flag(hud, 'shaking', ph === 'shake');
      text(N.bTop, ph === 'shake' ? ALERT_COPY.shakeTop : ALERT_COPY.alertTop); lastCount = -1;
    }
    if (ph && kMode) {
      const cnt = Math.max(0, Math.ceil((ph === 'alert' ? 3 : 6) - S.alertT));
      if (cnt !== lastCount) { lastCount = cnt; text(N.bCount, String(cnt)); }
      const sub = ph === 'alert' ? KEA_ALERT.alertSub : KEA_ALERT.holdSub;
      if (sub !== lastSub) { lastSub = sub; text(N.bSub, sub); flag(N.banner, 'bad', false); flag(N.banner, 'good', false); }
    } else if (ph) {
      const cnt = Math.max(0, Math.ceil((ph === 'alert' ? 3 : 6) - S.alertT));
      if (cnt !== lastCount) { lastCount = cnt; text(N.bCount, String(cnt)); }
      const sub = ph === 'alert' ? ALERT_COPY.alertSub : S.compliant ? (S.coverOk ? ALERT_COPY.holdCover : ALERT_COPY.holdOk) : ALERT_COPY.holdBad;
      if (sub !== lastSub) { lastSub = sub; text(N.bSub, sub); flag(N.banner, 'bad', ph === 'shake' && !S.compliant); flag(N.banner, 'good', ph === 'shake' && S.compliant); }
    }

    if (kMode) { updateKea(); return; }

    // strikes
    if (S.strikes !== lastStrikes) {
      lastStrikes = S.strikes;
      for (let i = 0; i < strikeBoxes.length; i++) flag(strikeBoxes[i], 'on', i < S.strikes);
      text(N.strikeNote, S.strikes >= 2 ? 'Final warning. Then stood down.' : S.strikes === 1 ? 'Noted on your file' : '3 strikes = stood down');
      flag(N.strikeNote.parentNode, 'warn', S.strikes > 0);
    }

    // campervan register
    for (let i = 0; i < plates.length; i++) {
      const p = plates[i], it = demo ? demo.ints[i] ?? 1 : p.v.integrity, pc = Math.max(0, Math.round(it * 100));
      if (pc !== p.last) {
        p.last = pc; p.fill.style.width = pc + '%'; text(p.pct, pc + '%');
        let si = 0; while (si < VAN_STATUS.length - 1 && it <= VAN_STATUS[si][0]) si++;
        if (si !== p.lastS) { p.lastS = si; if (!p.lockOn) text(p.status, VAN_STATUS[si][1]); p.p.dataset.level = VAN_STATUS[si][2]; }
        if (!demo && it < 0.35 && !p.warned) { p.warned = true; H.toast(TOASTS.lowVan(p.v.name)); }
      }
      const hit = G.t < p.hitUntil; if (hit !== p.hitOn) { p.hitOn = hit; flag(p.p, 'hit', hit); }
    }

    // blower temp gauge
    const B = demo || blower;
    if (B) {
      const n = Math.ceil(B.heat * SEGS - 0.001);
      if (n !== lastHeatN) {
        const lo = Math.min(n, lastHeatN < 0 ? 0 : lastHeatN), hi = Math.max(n, lastHeatN < 0 ? SEGS : lastHeatN);
        for (let i = lo; i < hi; i++) flag(segs[i], 'on', i < n);
        lastHeatN = n;
        if (!B.overheated) text(N.heatState, (HEAT_STATE.find((h) => B.heat < h[0]) || HEAT_STATE[2])[1]);
      }
      if (B.overheated !== wasHot) {
        wasHot = B.overheated; flag(N.heat, 'hot', wasHot);
        text(N.heatState, wasHot ? 'Overheated. Let it rest.' : (HEAT_STATE.find((h) => B.heat < h[0]) || HEAT_STATE[2])[1]);
        if (wasHot && !demo) H.toast(TOASTS.overheat);
      }
      flag(N.heat, 'turbo', !!B.turbo && !!B.firing);
      flag(cross, 'firing', !!B.firing);
      flag(cross, 'turbo', !!B.turbo && !!B.firing);
    }
  };
  // ---- Kea mode per-frame (guarded writes only; every string is a constant or built on a value change) ----
  function updateKea() {
    const S = kg, P = kp();
    // campervan register: integrity + possum lock (keagame sets van.lockedBy)
    for (let i = 0; i < plates.length; i++) {
      const p = plates[i], it = p.v.integrity, pc = Math.max(0, Math.round(it * 100));
      if (pc !== p.last) {
        p.last = pc; p.fill.style.width = pc + '%'; text(p.pct, pc + '%');
        let si = 0; while (si < VAN_STATUS.length - 1 && it <= VAN_STATUS[si][0]) si++;
        if (si !== p.lastS) { p.lastS = si; if (!p.lockOn) text(p.status, VAN_STATUS[si][1]); p.p.dataset.level = VAN_STATUS[si][2]; }
      }
      const lk = !!p.v.lockedBy;
      if (lk !== p.lockOn) { p.lockOn = lk; flag(p.p, 'locked', lk); text(p.status, lk ? 'Occupied by a possum' : VAN_STATUS[Math.max(0, p.lastS)][1]); }
      const hit = G.t < p.hitUntil; if (hit !== p.hitOn) { p.hitOn = hit; flag(p.p, 'hit', hit); }
    }
    // items held for research
    if (S.banked !== K.banked) {
      K.banked = S.banked; text(KN.banked, String(S.banked));
      for (let i = 0; i < kPips.length; i++) flag(kPips[i], 'on', i < S.banked);
      flag(KN.banked.parentNode.parentNode, 'met', S.banked >= S.quota);
    }
    if (S.cone !== K.cone) { K.cone = S.cone; text(KN.cone, CONE_HUD[S.cone] || ''); KN.cone.dataset.cone = S.cone; }
    const ck = S.carryKind || '';
    if (ck !== K.carry) { K.carry = ck; text(KN.carry, ck ? PART_NAME[ck] || 'Something' : 'Nothing (officially)'); flag(KN.carry, 'carrying', !!ck); }
    // notices + offended
    if (S.notices !== K.notices) {
      K.notices = S.notices;
      for (let i = 0; i < noticeBoxes.length; i++) flag(noticeBoxes[i], 'on', i < S.notices);
      text(KN.noticeNote, NOTICE_NOTE[Math.min(3, S.notices)]); flag(KN.noticeNote.parentNode, 'warn', S.notices > 0);
    }
    const off = P ? Math.min(3, P.offended | 0) : 0;
    if (off !== K.off) { K.off = off; for (let i = 0; i < offPips.length; i++) flag(offPips[i], 'on', i < off); text(KN.offNote, OFF_NOTE[off]); }
    // wing capacity (stamina) meter
    const st = P ? Math.max(0, Math.min(1, P.stamina ?? 1)) : 1, n = Math.ceil(st * SEGS - 0.001);
    if (n !== K.wingN) {
      K.wingN = n; for (let i = 0; i < wingSegs.length; i++) flag(wingSegs[i], 'on', i < n);
      let wi = 0; while (wi < WING_STATE.length - 1 && st >= WING_STATE[wi][0]) wi++;
      if (wi !== K.wingS) { K.wingS = wi; text(KN.wingState, WING_STATE[wi][1]); flag(KN.wing, 'low', wi === 0); }
    }
    // pull prompt under the reticle: what the beak can reach, or why a peck found nothing
    let hint = '';
    if (P && P.enabled) {
      const tg = P.pullTarget;
      if (P.carrying) hint = '';
      else if (tg && !(P.pulling > 0)) hint = 'Hold left click: pull the ' + (PART_NAME[tg.kind] || tg.kind).toLowerCase();
      else if (P.pullMiss > 0) hint = P.flying ? 'Land first. Kea cannot pull in flight.' : 'Nothing to pull here. Land on a campervan, or try a door seal.';
    }
    text(KN.hint, hint); flag(KN.hint, 'on', hint !== '');
    // pull progress ring around the reticle
    const pq = P && P.pulling > 0 ? Math.min(20, Math.round(P.pulling * 20)) : -1;
    if (pq !== K.pull) { K.pull = pq; flag(KN.pull, 'on', pq >= 0); if (pq >= 0) KN.pull.style.setProperty('--p', PULL_P[pq]); }
  }
  return H;
}

// ?show=hud frames the HUD over the spawn view (pose 2); main may use { cam, target } like the other showcases.
export function showcase() { return { cam: SHOW_CAM.slice(), target: SHOW_TARGET.slice() }; }
