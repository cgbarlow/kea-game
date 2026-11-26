// carpark/canvases — custom canvas-2D art for decals: worn road paint, quake cracks, asphalt patch repairs,
// the YOU ARE HERE map board, the kea warning diamond. Load-time only; wear via decals/canvas-text.js.
import { distress, grime, fitText, FONTS } from '../../cookbook/decals/canvas-text.js';
import { rngFrom, fnv, fbm2 } from '../../cookbook/geo/noise.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

// Worn road paint strip: L × W metres. Ragged edges, tyre-worn gaps, dirt.
export function paintLineCanvas(L, W, { ppm = 160, color = '#ece6d6', seed = 1, wear = 0.5 } = {}) {
  const cv = mk(L * ppm, Math.max(8, W * ppm * 1.6)), g = cv.getContext('2d'), Wp = cv.width, Hp = cv.height;
  const rnd = rngFrom(seed), lh = W * ppm, y0 = (Hp - lh) / 2;
  g.fillStyle = color;
  for (let x = 0; x < Wp; x += 2) { // ragged edges: per-column jitter (paint machine overspray)
    const j0 = (rnd() - 0.5) * 1.6, j1 = (rnd() - 0.5) * 1.6;
    g.globalAlpha = 0.92 + rnd() * 0.08; g.fillRect(x, y0 + j0, 2, lh - j0 + j1);
  }
  g.globalAlpha = 1;
  grime(cv, { amount: 0.55, seed: seed + 3, color: '34,32,30' });
  distress(cv, { amount: wear, seed, edge: 0.15, chips: 0.6, scratches: 0.3, specks: 1.6, scale: 3 });
  return cv;
}

// Quake crack: a jagged run from the middle of the left edge to the middle of the right edge (so segments chain),
// dark core with a crumbled halo and short branches. sealed: a glossy bitumen overband (crack sealing).
export function crackCanvas(L, H, { ppm = 180, seed = 1, sealed = false, width = 0.018 } = {}) {
  const cv = mk(L * ppm, H * ppm), g = cv.getContext('2d'), W = cv.width, Hp = cv.height, rnd = rngFrom(seed);
  const n = Math.round(L * 7), pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, env = Math.sin(Math.PI * t);
    const y = Hp / 2 + env * (fbm2(t * 5, seed * 0.13, 3, seed) - 0.5) * Hp * 0.9 + env * (rnd() - 0.5) * Hp * 0.08;
    pts.push([t * W, y]);
  }
  const path = (arr) => { g.beginPath(); g.moveTo(arr[0][0], arr[0][1]); for (let i = 1; i < arr.length; i++) g.lineTo(arr[i][0], arr[i][1]); };
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (sealed) { // crack-seal overband: wider, soft-edged, slightly glossy black
    g.strokeStyle = 'rgba(8,8,9,0.78)'; g.lineWidth = 0.06 * ppm; path(pts); g.stroke();
    g.strokeStyle = 'rgba(8,8,9,0.35)'; g.lineWidth = 0.09 * ppm; path(pts); g.stroke();
  }
  g.strokeStyle = 'rgba(70,66,60,0.35)'; g.lineWidth = width * ppm * 3.2; path(pts); g.stroke();   // crumbled lighter halo
  for (let i = 0; i < n; i++) { // core: width varies along the run
    const w = width * ppm * (0.5 + 1.1 * Math.abs(fbm2(i * 0.4, seed, 2, seed + 1) - 0.3) + rnd() * 0.3);
    g.strokeStyle = 'rgba(10,9,8,0.95)'; g.lineWidth = Math.max(1.2, w);
    g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke();
  }
  const nb = 3 + Math.floor(rnd() * 4); // branches
  for (let b = 0; b < nb; b++) {
    const i0 = 1 + Math.floor(rnd() * (n - 2)); let [x, y] = pts[i0];
    const dir = (rnd() < 0.5 ? -1 : 1), len = 4 + Math.floor(rnd() * 6), arr = [[x, y]];
    for (let k = 0; k < len; k++) { x += (rnd() - 0.3) * ppm * 0.12; y += dir * (0.3 + rnd()) * ppm * 0.05; if (y < 2 || y > Hp - 2) break; arr.push([x, y]); }
    g.strokeStyle = 'rgba(12,11,10,0.85)'; g.lineWidth = Math.max(1, width * ppm * 0.45); path(arr); g.stroke();
  }
  return cv;
}

// Asphalt patch repair: newer, darker seal with a cut edge and a tar seam, plus aggregate speckle.
export function patchCanvas(w, h, { ppm = 90, seed = 1 } = {}) {
  const cv = mk(w * ppm, h * ppm), g = cv.getContext('2d'), W = cv.width, H = cv.height, rnd = rngFrom(seed);
  const inset = 0.05 * ppm;
  const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
  gr.addColorStop(0, 'rgba(14,14,15,0.42)'); gr.addColorStop(1, 'rgba(14,14,15,0.26)');
  g.fillStyle = gr; g.fillRect(inset, inset, W - 2 * inset, H - 2 * inset);
  for (let i = 0; i < W * H * 0.02; i++) { // aggregate: light and dark stones
    const l = rnd() < 0.5 ? 60 + rnd() * 50 : 6; g.fillStyle = `rgba(${l},${l},${l + 2},${0.25 + rnd() * 0.4})`;
    g.fillRect(inset + rnd() * (W - 2 * inset), inset + rnd() * (H - 2 * inset), 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  g.strokeStyle = 'rgba(6,6,6,0.55)'; g.lineWidth = 0.03 * ppm; g.strokeRect(inset, inset, W - 2 * inset, H - 2 * inset); // tar seam
  distress(cv, { amount: 0.45, seed, edge: 0.9, chips: 1.5, scratches: 0.2, specks: 0.8 });
  return cv;
}

// Kea silhouette (side view, perched, facing right) into ctx at centre (cx, cy), size s px (bird length).
function kea(g, cx, cy, s, color) {
  g.save(); g.translate(cx, cy); g.scale(s / 100, s / 100); g.fillStyle = color;
  g.beginPath();
  g.moveTo(34, -30); g.bezierCurveTo(44, -34, 52, -28, 52, -20);       // crown → beak base
  g.bezierCurveTo(60, -20, 64, -12, 58, -2); g.bezierCurveTo(57, -10, 53, -14, 48, -13); // long hooked upper beak
  g.bezierCurveTo(46, -10, 42, -8, 38, -6);                            // chin
  g.bezierCurveTo(36, 8, 24, 20, 8, 24);                               // breast
  g.lineTo(-4, 26); g.lineTo(-46, 40); g.lineTo(-50, 36); g.lineTo(-14, 16); // tail
  g.bezierCurveTo(-10, 0, 4, -20, 20, -26); g.bezierCurveTo(26, -29, 30, -30, 34, -30);
  g.fill();
  g.fillRect(6, 22, 3, 12); g.fillRect(16, 21, 3, 13); g.fillRect(0, 33, 26, 3); // legs + perch
  g.restore();
}

// Yellow diamond warning sign with a kea, on a transparent square (w = diagonal size m).
export function keaDiamondCanvas({ w = 0.9, ppm = 300 } = {}) {
  const S = w * ppm, cv = mk(S, S), g = cv.getContext('2d'), r = S / 2;
  g.save(); g.translate(r, r); g.rotate(Math.PI / 4);
  const a = S / Math.SQRT2 * 0.98;
  g.fillStyle = '#d9a81c'; g.beginPath(); g.roundRect(-a / 2, -a / 2, a, a, a * 0.06); g.fill();
  g.strokeStyle = '#141414'; g.lineWidth = a * 0.035; g.beginPath(); g.roundRect(-a / 2 + a * 0.05, -a / 2 + a * 0.05, a * 0.9, a * 0.9, a * 0.04); g.stroke();
  g.restore();
  kea(g, r, r * 1.02, S * 0.5, '#141414');
  grime(cv, { amount: 0.3, seed: 91 }); distress(cv, { amount: 0.3, seed: 91, edge: 0.4 });
  return cv;
}

// YOU ARE HERE (Unfortunately.) map board: a stylised site plan with the dry legend.
export function mapBoardCanvas({ w = 2.2, h = 1.15, ppm = 420 } = {}) {
  const W = w * ppm, H = h * ppm, cv = mk(W, H), g = cv.getContext('2d'), u = H / 100, rnd = rngFrom(17);
  const CREAM = '#ece4cc', GREEN = '#1f4a37', INK = '#1b1d1c';
  g.fillStyle = CREAM; g.fillRect(0, 0, W, H);
  g.fillStyle = GREEN; g.fillRect(0, 0, W, 15 * u);
  const txt = (s, x, y, size, color = INK, align = 'left', font = FONTS.sign, weight = 'bold') => {
    g.font = `${weight} ${size * u}px ${font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y);
  };
  txt('YOU ARE HERE', 3 * u, 11 * u, 10, CREAM);
  txt('(Unfortunately.)', W - 3 * u, 11 * u, 6, '#cfd8c8', 'right');
  // map panel
  const mx = 3 * u, my = 19 * u, mw = W * 0.64, mh = H - 25 * u;
  g.save(); g.beginPath(); g.rect(mx, my, mw, mh); g.clip();
  g.fillStyle = '#d6d2bf'; g.fillRect(mx, my, mw, mh);                         // scree (north, top)
  for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(90,84,70,0.35)'; g.lineWidth = 0.4 * u; g.beginPath(); // contours
    const y = my + (i / 26) * mh * 0.45; g.moveTo(mx, y); for (let x = 0; x <= mw; x += 8 * u) g.lineTo(mx + x, y + Math.sin(x * 0.01 + i) * 2.2 * u); g.stroke(); }
  g.fillStyle = '#9fb08e'; g.fillRect(mx, my + mh * 0.72, mw, mh * 0.28);      // beech forest (south)
  for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(40,70,50,0.45)'; g.beginPath(); g.arc(mx + rnd() * mw, my + mh * (0.74 + rnd() * 0.26), (0.8 + rnd()) * u, 0, 6.3); g.fill(); }
  const ry = my + mh * 0.42; g.fillStyle = '#6d6a64'; g.fillRect(mx, ry, mw, 6 * u);  // SH73
  g.strokeStyle = CREAM; g.setLineDash([3 * u, 3 * u]); g.lineWidth = 0.5 * u; g.beginPath(); g.moveTo(mx, ry + 3 * u); g.lineTo(mx + mw, ry + 3 * u); g.stroke(); g.setLineDash([]);
  const cx0 = mx + mw * 0.18, cw = mw * 0.56, cy0 = ry + 9 * u, ch = mh * 0.3;  // car park
  g.fillStyle = '#7d7a73'; g.fillRect(cx0, cy0, cw, ch);
  for (let i = 0; i <= 9; i++) { g.fillStyle = CREAM; g.fillRect(cx0 + cw * (0.2 + i * 0.06), cy0 + ch * 0.45, 0.4 * u, ch * 0.3); }
  g.fillStyle = '#8a5a34'; g.beginPath(); g.ellipse(mx + mw * 0.9, ry + 3 * u, mw * 0.08, mh * 0.2, 0.2, 0, 6.3); g.fill(); // the slip
  g.strokeStyle = '#9a1e14'; g.lineWidth = 1.2 * u; g.beginPath(); g.moveTo(mx + mw * 0.79, ry - 2 * u); g.lineTo(mx + mw * 0.79, ry + 8 * u); g.stroke(); // gate
  g.fillStyle = GREEN; g.fillRect(cx0 - mw * 0.06, cy0 + ch * 0.05, mw * 0.045, ch * 0.22); g.fillRect(cx0 - mw * 0.06, cy0 + ch * 0.7, mw * 0.03, ch * 0.18);
  for (let i = 0; i < 4; i++) { g.fillStyle = '#c0501e'; g.fillRect(cx0 + cw * (0.1 + i * 0.26), cy0 + ch + 1.5 * u, 1.6 * u, 1.6 * u); }
  for (const [kx, ky] of [[0.3, 0.2], [0.55, 0.12], [0.7, 0.28], [0.42, 0.33]]) kea(g, mx + mw * kx, my + mh * ky, 7 * u, '#4a5a32');
  const hx = cx0 - mw * 0.04, hy = cy0 + ch * 0.16; // YOU ARE HERE dot
  g.fillStyle = '#c8281c'; g.beginPath(); g.arc(hx, hy, 2.2 * u, 0, 6.3); g.fill(); g.strokeStyle = CREAM; g.lineWidth = 0.6 * u; g.stroke();
  g.restore();
  g.strokeStyle = INK; g.lineWidth = 0.5 * u; g.strokeRect(mx, my, mw, mh);
  txt('SH73 (CLOSED)', mx + 2 * u, ry - 1.2 * u, 3.4);
  txt('SLIP (NEW)', mx + mw * 0.83, ry - 6 * u, 3.4);
  txt('KEA (ALL OF THEM)', mx + mw * 0.36, my + mh * 0.07, 3.2, '#3a4a2a');
  txt('BEECH FOREST (POSSUMS)', mx + 2 * u, my + mh - 2 * u, 3.2, '#1f3a2a');
  txt('YOU', hx - 3 * u, hy - 3.6 * u, 3.4, '#9a1e14', 'right');
  // legend
  const lx = mx + mw + 4 * u; let ly = my + 4 * u;
  const leg = [['#c8281c', 'You'], ['#8a5a34', 'The reason you are here'], ['#9a1e14', 'Road closed gate'], [GREEN, 'Shelter / long drop'],
    ['#c0501e', 'Trap boxes (DOC 200)'], ['#4a5a32', 'Kea (approximate)'], ['#7d7a73', 'Campervan parking']];
  for (const [c, s] of leg) { g.fillStyle = c; g.fillRect(lx, ly - 2.6 * u, 3 * u, 3 * u); txt(s, lx + 5 * u, ly, 3.4, INK, 'left', FONTS.sign, '600'); ly += 6.4 * u; }
  ly += 2 * u;
  const notes = ['Nearest town: the other side of the slip.', 'Nearest kea: closer than you think.', 'Distances are approximate.', 'So is the reopening date.'];
  for (const s of notes) { txt(s, lx, ly, 3.0, '#3c3f3c', 'left', FONTS.sign, '500'); ly += 4.6 * u; }
  g.fillStyle = GREEN; g.fillRect(0, H - 4 * u, W, 4 * u);
  txt('DEPARTMENT OF PASS CONSERVATION', W / 2, H - 1 * u, 3, CREAM, 'center');
  grime(cv, { amount: 0.2, seed: 23 }); distress(cv, { amount: 0.07, seed: 23, edge: 0.15, chips: 0.15, scratches: 0.4, specks: 0.3 });
  return cv;
}

// Dense notice: title band + left-aligned body lines (posters inside the shelter). w/h metres.
export function noticeCanvas({ w = 0.8, h = 1.0, ppm = 420, title, sub, body = [], bg = '#ece6d2', band = '#1f4a37', bandFg = '#efe8d4', fg = '#1b1d1c', foot, seed } = {}) {
  const W = w * ppm, H = h * ppm, cv = mk(W, H), g = cv.getContext('2d'), u = W / 100;
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = band; g.fillRect(0, 0, W, 17 * u);
  let s = fitText(g, title, 10 * u, W * 0.9, FONTS.sign);
  g.font = `bold ${s}px ${FONTS.sign}`; g.fillStyle = bandFg; g.textAlign = 'center'; g.fillText(title, W / 2, 12.5 * u);
  let y = 25 * u;
  if (sub) { g.font = `italic 600 ${5 * u}px ${FONTS.sign}`; g.fillStyle = fg; g.fillText(sub, W / 2, y); y += 9 * u; }
  g.textAlign = 'left';
  for (const l of body) {
    const big = typeof l === 'object';
    const t = big ? l.text : l, sz = (big ? l.size : 6.2) * u;
    s = fitText(g, t, sz, W * 0.88, FONTS.sign);
    g.font = `${big ? 'bold' : '600'} ${s}px ${FONTS.sign}`; g.fillStyle = big && l.color ? l.color : fg; g.fillText(t, 6 * u, y); y += s * 1.45;
  }
  if (foot) { g.font = `600 ${3.4 * u}px ${FONTS.sign}`; g.fillStyle = '#4a4d4a'; g.textAlign = 'center'; g.fillText(foot, W / 2, H - 3 * u); }
  const sd = seed ?? fnv(title);
  grime(cv, { amount: 0.18, seed: sd }); distress(cv, { amount: 0.07, seed: sd, edge: 0.15, chips: 0.15, scratches: 0.3, specks: 0.3 });
  return cv;
}
