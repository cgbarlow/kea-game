// hud/ui — menu state machine over the DOM in template.html:
//   boot → title (live PATH flyover + mode selector) → playing ⇄ paused, settings, ended.
//   create(G, { input, player, quality, path }) → { state, settings, modes, setState(s), set(bind, v), start(modeId), update }
// Mode selector is data-driven (MODES): v1 ships RANGER; KEA is listed, disabled and tagged "coming soon" until v2
// enables the entry. start() only ever accepts an enabled mode and sets G.mode.
// Keyboard: arrows move focus between the visible screen's [data-nav] controls (left/right across mode cards),
// Enter/Space activates. ?shot=1 / ?autostart=1 skip the title by starting RANGER (captures, playtest bot).
// Settings persist in localStorage (try/catch; never read under ?shot so captures stay deterministic).
// Sets G.paused while not playing (player/actors idle on it).
import { CatmullRomCurve3, Vector3 } from 'three';

export const MODES = [
  { id: 'ranger', label: 'Ranger', enabled: true, tag: 'Rostered',
    note: 'Seven-minute shift. Protect three campervans from kea and possums with the ranger-issue leaf blower.' },
  { id: 'kea', label: 'Kea', enabled: false, tag: 'Coming soon',
    note: 'Pending risk assessment. The kea have requested representation.' },
];

// Render resolution (settings menu), data-driven like MODES. 'auto' = dynamic resolution (engine/quality.js); a number
// pins the render scale relative to the tier's pixel budget and switches dynres off. ?dynres= / ?scale= override it.
export const RESOLUTIONS = [
  { id: 'auto', label: 'Auto (dynamic)', note: 'Resolution managed by IT. It will move. Do not report it.' },
  { id: '1', label: '100%', note: 'Full resolution. Your hardware has been told to cope.' },
  { id: '0.85', label: '85%', note: 'Marginally fewer pixels. Nobody will notice; someone will.' },
  { id: '0.7', label: '70%', note: 'Lower resolution approved for underpowered hardware.' },
  { id: '0.5', label: '50%', note: 'Emergency resolution. Approved under protest by the Department.' },
];

const KEY = 'dnftk.settings.v1';
const SCREENS = ['title', 'pause', 'settings', 'end'];

export function create(G, { input, player, quality, path }) {
  const $ = (s) => document.querySelector(s);
  const el = { ui: $('#ui'), hud: $('#hud') };
  for (const s of SCREENS) el[s] = $('#' + s);
  const binds = {}; document.querySelectorAll('[data-bind]').forEach((n) => { binds[n.dataset.bind] = n; });
  const shot = !!G.params.get('shot');
  const settings = { quality: 'auto', res: 'auto', sens: 1, fov: G.camera.fov, volume: 0.8, invertY: false };
  if (!shot) { try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked storage */ } }
  const U = { state: 'boot', settings, modes: MODES };
  let back = 'title';

  // ---- settings ----
  const form = el.settings?.querySelector('form');
  const outs = {}; el.settings?.querySelectorAll('[data-out]').forEach((n) => { outs[n.dataset.out] = n; });
  const resSel = form?.elements?.res;
  if (resSel && !resSel.options.length) for (const r of RESOLUTIONS) resSel.add(new Option(r.label, r.id));
  if (!RESOLUTIONS.some((r) => r.id === String(settings.res))) settings.res = 'auto';
  const resNote = el.settings?.querySelector('[data-res-note]');
  const fmt = { sens: (v) => (+v).toFixed(2) + '×', fov: (v) => Math.round(v) + '°', volume: (v) => Math.round(v * 100) + '%' };
  function apply(persist) {
    input.sens = 0.0022 * settings.sens; input.invertY = !!settings.invertY;
    if (!shot) { G.camera.fov = +settings.fov; G.camera.updateProjectionMatrix(); }
    if (settings.quality !== 'auto' && quality && settings.quality !== G.quality.tier) { G.quality.pinned = true; quality.setTier(settings.quality, 'settings'); }
    if (settings.quality === 'auto' && G.quality.pinned && !G.params.get('q')) G.quality.pinned = false;
    G.mods?.audio?.setVolume?.(+settings.volume);
    const r = RESOLUTIONS.find((x) => x.id === String(settings.res)) || RESOLUTIONS[0];
    const taken = quality?.setManualScale ? quality.setManualScale(r.id === 'auto' ? null : +r.id) : false;
    if (resNote) resNote.textContent = taken ? r.note : 'Resolution set by a launch parameter. Take it up with whoever typed it.';
    for (const k in outs) outs[k].textContent = fmt[k] ? fmt[k](settings[k]) : String(settings[k]);
    if (persist) { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }
  }
  if (form) {
    for (const k in settings) { const f = form.elements[k]; if (!f) continue; if (f.type === 'checkbox') f.checked = !!settings[k]; else f.value = settings[k]; }
    form.addEventListener('input', () => {
      for (const k in settings) { const f = form.elements[k]; if (!f) continue; settings[k] = f.type === 'checkbox' ? f.checked : f.type === 'range' ? +f.value : f.value; }
      apply(true);
    });
  }
  if (!shot && quality) apply(false); else for (const k in outs) outs[k].textContent = fmt[k] ? fmt[k](settings[k]) : String(settings[k]);

  // ---- mode selector (data-driven) ----
  const modesEl = el.title?.querySelector('[data-modes]');
  const cards = [];
  if (modesEl) for (const m of MODES) {
    const b = document.createElement('button');
    b.className = 'mode' + (m.enabled ? '' : ' is-disabled'); b.type = 'button';
    b.dataset.mode = m.id; b.dataset.nav = ''; b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', m.id === 'ranger' ? 'true' : 'false');
    if (!m.enabled) b.setAttribute('aria-disabled', 'true');
    b.innerHTML = `<span class="m-tag"></span><span class="m-label"></span><span class="m-note"></span>${m.enabled ? '<span class="m-go">Begin shift ▸</span>' : ''}`;
    b.querySelector('.m-tag').textContent = m.tag; b.querySelector('.m-label').textContent = m.label; b.querySelector('.m-note').textContent = m.note;
    modesEl.appendChild(b); cards.push(b);
  }
  U.start = (id) => {
    const m = MODES.find((x) => x.id === id);
    if (!m || !m.enabled) {
      const c = cards.find((x) => x.dataset.mode === id);
      if (c) { c.classList.remove('denied'); void c.offsetWidth; c.classList.add('denied'); }
      G.emit('ui:denied', id);
      return false;
    }
    G.mode = m.id; U.setState('playing'); return true;
  };

  // ---- state machine ----
  const focusFirst = (s) => {
    const root = el[s === 'paused' ? 'pause' : s === 'ended' ? 'end' : s];
    if (!root) return;
    const f = root.querySelector(s === 'title' ? '[data-mode="ranger"]' : '.btn-primary') || root.querySelector('[data-nav]');
    if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  };
  U.setState = (s) => {
    if (s === U.state) return;
    const prev = U.state; U.state = s; el.ui.dataset.state = s;
    el.title.hidden = s !== 'title'; el.pause.hidden = s !== 'paused'; el.settings.hidden = s !== 'settings';
    el.end.hidden = s !== 'ended'; el.hud.hidden = s !== 'playing';
    G.paused = s !== 'playing';
    input.enabled = s === 'playing';
    if (player) player.enabled = s === 'playing';
    if (s === 'playing' && prev !== 'playing' && !shot && !U.noLock && input.mode === 'lock') input.requestLock();
    if (s === 'playing' && prev === 'title' && player && !U.noLock) G.camLocked = false;
    if (s !== 'playing' && document.pointerLockElement) document.exitPointerLock();
    if (s !== 'playing') focusFirst(s);
    G.emit('ui:state', s, prev);
  };
  U.set = (k, v) => {
    const n = binds[k]; if (!n) return;
    if (k === 'damage') n.style.opacity = String(v);
    else if (n.textContent !== (v ?? '')) n.textContent = v ?? '';
  };

  const act = (a) => {
    if (a === 'resume') U.setState('playing');
    else if (a === 'settings') { back = U.state; U.setState('settings'); }
    else if (a === 'back') U.setState(back);
    else if (a === 'restart') { G.emit('restart'); U.setState('playing'); }
    else if (a === 'title') { G.emit('restart'); U.setState('title'); }
  };
  el.ui.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]'); if (m) { U.start(m.dataset.mode); return; }
    const a = e.target.closest('[data-act]')?.dataset.act; if (a) act(a);
  });
  // keyboard navigation for menus (arrows / Enter); in-shift keys belong to engine/input.js
  window.addEventListener('keydown', (e) => {
    if (U.state === 'playing' || U.state === 'boot') return;
    const root = el[U.state === 'paused' ? 'pause' : U.state === 'ended' ? 'end' : U.state];
    if (!root) return;
    const nav = root.querySelectorAll('[data-nav]');
    if (!nav.length) return;
    let i = Array.prototype.indexOf.call(nav, document.activeElement);
    const k = e.code;
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowLeft') {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;
      i = i < 0 ? 0 : (i + (k === 'ArrowDown' || k === 'ArrowRight' ? 1 : nav.length - 1)) % nav.length;
      nav[i].focus({ preventScroll: true }); e.preventDefault();
    } else if (k === 'Enter' || k === 'NumpadEnter') {
      const f = i >= 0 ? nav[i] : null;
      if (f?.dataset.mode) U.start(f.dataset.mode);
      else if (f?.dataset.act) act(f.dataset.act);
      else if (U.state === 'title') U.start('ranger');
      e.preventDefault();
    }
  });
  G.on('input:unlock', () => { if (U.state === 'playing' && input.mode === 'lock') U.setState('paused'); });

  // ---- title flyover along PATH (slow, looping); bench/captures that lock the camera win ----
  const P = path && path.length > 1 ? path : null;
  const cp = P && new CatmullRomCurve3(P.map((k) => new Vector3(k[0], k[1], k[2])), true, 'centripetal');
  const ct = P && new CatmullRomCurve3(P.map((k) => new Vector3(k[3], k[4], k[5])), true, 'centripetal');
  const a = new Vector3(), b = new Vector3();
  let flyT = 0;
  U.update = (dt) => {
    if (input.pressed('pause')) {
      if (U.state === 'playing') U.setState('paused');
      else if (U.state === 'paused') U.setState('playing');
      else if (U.state === 'settings') U.setState(back);
    }
    if (U.state === 'title' && cp && !G.camLocked) {
      flyT = (flyT + dt / 60) % 1;
      cp.getPointAt(flyT, a); ct.getPointAt(flyT, b);
      G.camera.position.copy(a); G.camera.lookAt(b);
    }
  };
  const auto = shot || G.params.get('autostart');
  G.on('ready', () => { if (U.state !== 'boot') return; if (auto) U.start('ranger'); else U.setState('title'); });
  return U;
}
