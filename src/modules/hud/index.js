// hud — menus (./ui.js state machine) + the in-shift HUD, written in the voice of a tired government department.
//   create(G, { input, player, quality, path, game, vans, blower }) → { ui, update, toast(text), set(bind, v) }
//   HUD: reopening estimate (timer), three van integrity plates, blower heat gauge, aftershock banner
//   (DROP / COVER / HOLD), strike counter, toast feed, end screen (win/lose + stats + restart).
// Builds its extra DOM under #hud / #ui (template.html keeps the skeleton). Text changes only when values change
// (no per-frame string churn): every write is guarded by a last-value cache.
import { create as createUI } from './ui.js';

const END_TEXT = {
  reopened: ['SH73 HAS REOPENED', 'Please drive to the conditions. The conditions are: bad.'],
  'stood-down': ['YOU HAVE BEEN STOOD DOWN', 'Pending a review of your drop, cover and hold technique.'],
  review: ['A TOURIST HAS LEFT A REVIEW', '★☆☆☆☆ “Birds ate our van. Ranger was busy.”'],
};

export function create(G, { input, player, quality, path, game, vans, blower }) {
  const ui = createUI(G, { input, player, quality, path });
  const hud = document.getElementById('hud');
  const mk = (cls, parent = hud, tag = 'div') => { const n = document.createElement(tag); n.className = cls; parent.appendChild(n); return n; };
  const timer = mk('hud-timer'), vansEl = mk('hud-vans'), heat = mk('hud-heat'), banner = mk('hud-banner'), strikes = mk('hud-strikes'), toasts = mk('hud-toasts');
  const heatBar = mk('bar', heat); const heatFill = mk('', heatBar, 'i'); const heatLbl = mk('lbl', heat, 'span');
  heatLbl.textContent = 'BLOWER TEMP';
  const plates = (vans?.list || []).map((v) => {
    const p = mk('van-plate', vansEl); const n = mk('n', p, 'span'); n.textContent = v.name; const b = mk('bar', p); const f = mk('', b, 'i');
    return { v, f, last: -1 };
  });
  const end = mk('screen screen-pause screen-end', document.getElementById('ui'), 'section'); end.hidden = true;
  end.innerHTML = '<h2 class="screen-heading"></h2><p class="end-sub"></p><pre class="end-stats"></pre><nav class="menu"><button class="btn btn-primary" data-act="restart">Start another shift</button></nav>';

  const last = { t: '', b: '', s: '' };
  const setText = (node, key, v) => { if (last[key] !== v) { last[key] = v; node.textContent = v; } };
  let toastT = 0, lastHeat = -1;
  const H = { ui };
  H.set = (k, v) => ui.set(k, v);
  H.toast = (text) => { toasts.textContent = text; toasts.classList.add('on'); toastT = 4; };
  G.on('game:toast', H.toast);
  G.on('kea:land', (k, v) => { if (k.offended > 0) H.toast(`Offended kea (grievance level ${k.offended}) on ${v.name}'s van.`); });
  G.on('game:strike', (n) => H.toast(`Aftershock procedure not followed. Strike ${n} of 3 recorded.`));
  G.on('game:alert', (kind, ok, cover) => {
    if (kind === 'clear') H.toast(ok ? (cover ? 'Shaking has stopped. Exemplary cover. Noted.' : 'Shaking has stopped. Adequate. Cover was available.') : 'Shaking has stopped. You did not hold.');
  });
  G.on('game:end', (won, reason, stats) => {
    const key = reason.startsWith('review') ? 'review' : reason;
    const [h, sub] = END_TEXT[key] || ['SHIFT OVER', ''];
    end.querySelector('h2').textContent = h; end.querySelector('.end-sub').textContent = sub;
    end.querySelector('.end-stats').textContent = `Kea relocated (temporarily): ${stats.keaBlown}\nPossums in trap boxes:       ${stats.possumsTrapped}\nAftershocks held:            ${stats.held} / ${stats.aftershocks}`;
    end.hidden = false; ui.setState('ended');
  });
  G.on('restart', () => { end.hidden = true; });

  H.update = (dt) => {
    ui.update(dt);
    if (!game) return;
    const m = Math.floor(game.timeLeft / 60), s = Math.floor(game.timeLeft % 60);
    setText(timer, 't', `SH73 REOPENING ESTIMATE  ${m}:${s < 10 ? '0' : ''}${s}  (NOT GUARANTEED)`);
    const b = game.phase === 'alert' ? 'AFTERSHOCK ALERT — DROP [C]' : game.phase === 'shake' ? (game.compliant ? 'HOLD. HOLD. HOLD.' : 'DROP [C]. COVER. HOLD. STOP MOVING.') : '';
    setText(banner, 'b', b); banner.classList.toggle('on', !!b);
    setText(strikes, 's', game.strikes ? `PROCEDURE STRIKES ${game.strikes}/3` : '');
    for (const p of plates) { const q = Math.round(p.v.integrity * 100); if (q !== p.last) { p.last = q; p.f.style.width = q + '%'; } }
    const hq = blower ? Math.round(blower.heat * 50) * 2 : 0;
    if (hq !== lastHeat) { lastHeat = hq; heatFill.style.width = hq + '%'; }
    heat.classList.toggle('hot', !!blower?.overheated);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toasts.classList.remove('on'); }
  };
  return H;
}

export function showcase() { return null; }
