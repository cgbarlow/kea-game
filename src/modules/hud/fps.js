// hud/fps — a toggleable frame-rate readout (top-right corner, under the strikes panel):
//   "62 FPS · 16.1 ms · 1% 24.8 · HIGH · 85%"  = fps over the last ~1 s, average frame ms, 1% low (fps of the slowest
//   1 % of frames), quality tier and render scale from G.quality. Text refreshes at 4 Hz; the per-frame path only
//   writes one float into a ring buffer (no allocation). Off by default; F3 or ` (Backquote) toggles, ?fps=1 starts it on,
//   the choice persists in localStorage. Carries class .ui so html.shot (?shot captures) hides it. Also injects a
//   "Show FPS counter" checkbox into the settings form (self-contained: ui.js's form handler ignores unknown fields).
//   create(G) → { el, on, toggle(v?), update() }
const KEY = 'dnftk.fps.v1', N = 256, WINDOW = 1000, PERIOD = 250;

export function create(G) {
  const shot = !!G.params.get('shot');
  const el = document.createElement('div');
  el.className = 'ui fps-readout'; el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;right:20px;top:96px;z-index:60;pointer-events:none;padding:3px 8px;border-radius:3px;'
    + 'background:rgba(8,12,10,.55);color:rgba(239,232,212,.72);font:500 11px/1.4 "SF Mono",ui-monospace,Menlo,Consolas,monospace;'
    + 'letter-spacing:.02em;white-space:nowrap;font-variant-numeric:tabular-nums;display:none';
  (document.getElementById('ui') || document.body).appendChild(el);

  const ft = new Float32Array(N), at = new Float64Array(N), scratch = new Float32Array(N);
  let head = 0, count = 0, last = 0, nextText = 0;
  const F = { el, on: false };
  let box = null;

  F.toggle = (v) => {
    F.on = v === undefined ? !F.on : !!v;
    el.style.display = F.on && !shot ? 'block' : 'none';
    if (box) box.checked = F.on;
    nextText = 0;
    if (!shot) { try { localStorage.setItem(KEY, F.on ? '1' : '0'); } catch (e) { /* blocked storage */ } }
  };
  let start = G.params.get('fps') === '1';
  if (!start && !shot) { try { start = localStorage.getItem(KEY) === '1'; } catch (e) { /* blocked storage */ } }
  F.on = start; el.style.display = F.on && !shot ? 'block' : 'none';

  // F3 / backquote (neither is bound in engine/input.js DEFAULT_BINDINGS; F3 would open the browser's find bar)
  addEventListener('keydown', (e) => {
    if (e.repeat || (e.code !== 'F3' && e.code !== 'Backquote')) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' && t.type !== 'checkbox' && t.type !== 'range' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault(); F.toggle();
  });

  // settings screen checkbox, next to "Invert Y axis"
  const form = document.querySelector('#settings form');
  if (form) {
    const lab = document.createElement('label'); lab.className = 'check';
    lab.innerHTML = '<input name="fpsCounter" type="checkbox"> <span>Show FPS counter (F3)</span>';
    form.appendChild(lab); box = lab.firstChild; box.checked = F.on;
    box.addEventListener('change', () => F.toggle(box.checked));
  }

  // called once per rendered frame (wall clock: ?dt= / game dt clamps must not fake the numbers)
  F.update = () => {
    const now = performance.now();
    if (last) { ft[head] = now - last; at[head] = now; head = (head + 1) % N; if (count < N) count++; }
    last = now;
    if (!F.on || shot || now < nextText) return;
    nextText = now + PERIOD;
    let n = 0, sum = 0;
    for (let i = 1; i <= count; i++) {
      const j = (head - i + N) % N;
      if (now - at[j] > WINDOW) break;
      scratch[n++] = ft[j]; sum += ft[j];
    }
    if (!n) return;
    const avg = sum / n, sub = scratch.subarray(0, n);
    // 1% low: mean of the slowest 1 % (at least one) frames, as fps
    sub.sort();
    const k = Math.max(1, Math.round(n * 0.01));
    let slow = 0; for (let i = n - k; i < n; i++) slow += scratch[i];
    const low = 1000 / (slow / k);
    const Q = G.quality || {};
    el.textContent = Math.round(1000 / avg) + ' FPS · ' + avg.toFixed(1) + ' ms · 1% ' + low.toFixed(1)
      + (Q.tier ? ' · ' + String(Q.tier).toUpperCase() : '') + (Q.scale ? ' · ' + Math.round(Q.scale * 100) + '%' : '');
  };
  return F;
}
