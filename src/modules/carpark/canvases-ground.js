// carpark/canvases-ground — canvas-2D art for the sealed surface and the shelter floor: road-paint lettering
// (full glyphs, gentle erosion: wear dims and chips the paint, it never removes a stroke), oil stains, tyre
// marks, wet patches, the quake scree spill, concrete floor stains and the shelter door mat. Load-time only.
import { FONTS } from '../../cookbook/decals/canvas-text.js';
import { rngFrom, fnv, fbm2, clamp } from '../../cookbook/geo/noise.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

// Per-pixel low-amplitude erosion of an existing layer: fine fbm takes 10-25 % of the alpha, a few small chips
// and pinholes. Strokes always survive (the largest chip is far smaller than a stroke at the sizes used here).
function erode(cv, { amount = 0.2, seed = 1, chipR = 2.2, chips = 1 } = {}) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, rnd = rngFrom(seed);
  const img = g.getImageData(0, 0, W, H), d = img.data, f = 0.045, ox = rnd() * 50, oy = rnd() * 50;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (x + y * W) * 4; if (d[i + 3] === 0) continue;
    const n = fbm2(x * f + ox, y * f + oy, 3, seed) * 0.7 + fbm2(x * f * 5 + oy, y * f * 5, 2, seed + 5) * 0.3;
    d[i + 3] *= 1 - amount * (0.4 + 0.8 * clamp(n, 0, 1));                  // 0.4..1.2 × amount (≈10-25 % at 0.2)
    const dirt = 1 - 0.12 * clamp(n * 1.4 - 0.3, 0, 1);                      // tyre grime pressed into the paint
    d[i] *= dirt; d[i + 1] *= dirt; d[i + 2] *= dirt * 0.97;
  }
  g.putImageData(img, 0, 0);
  g.save(); g.globalCompositeOperation = 'destination-out';
  const n = Math.round(chips * amount * W * H / 1400);
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.35 + 0.45 * rnd(); g.beginPath();
    g.arc(rnd() * W, rnd() * H, 0.6 + rnd() * rnd() * chipR, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  return cv;
}

// Road-paint lettering: condensed caps at a uniform height h (m), elongated along the reading axis by `stretch`
// (road text is drawn tall so it reads from a driver's eye height), full glyphs, then gentle erosion.
export function roadTextCanvas({ text = 'CAMPERVANS', h = 0.5, ppm = 140, stretch = 1.5, color = 'rgba(232,226,210,1)', wear = 0.2, seed = null, spacing = 0.08 } = {}) {
  const size = h * ppm / stretch, probe = mk(4, 4).getContext('2d'); probe.font = `bold ${size}px ${FONTS.sign}`;
  const adv = [...text].map((ch) => probe.measureText(ch).width + size * spacing);
  const tw = adv.reduce((a, b) => a + b, 0) - size * spacing, pad = size * 0.25;
  const W = tw + pad * 2, H = size * stretch * 1.18 + pad, cv = mk(W, H), g = cv.getContext('2d');
  g.save(); g.scale(1, stretch); g.font = probe.font; g.fillStyle = color; g.textBaseline = 'alphabetic';
  let x = pad; const base = (H / stretch) - pad / stretch - size * 0.1;
  [...text].forEach((ch, i) => { g.fillText(ch, x, base); x += adv[i]; });
  g.restore();
  return erode(cv, { amount: wear, seed: seed ?? fnv(text) });
}

// Oil stain under a parked engine: a few overlapping soft blobs, darker core, faint brown halo.
export function oilCanvas(w, h, { ppm = 110, seed = 1 } = {}) {
  const cv = mk(w * ppm, h * ppm), g = cv.getContext('2d'), W = cv.width, H = cv.height, rnd = rngFrom(seed);
  const blob = (x, y, r, a, c) => { const gr = g.createRadialGradient(x, y, r * 0.1, x, y, r); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(0.6, `rgba(${c},${a * 0.55})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  blob(W / 2, H / 2, Math.min(W, H) * 0.5, 0.22, '40,30,20');
  const n = 5 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) blob(W * (0.3 + rnd() * 0.4), H * (0.3 + rnd() * 0.4), Math.min(W, H) * (0.08 + rnd() * 0.22), 0.4 + rnd() * 0.35, '8,7,6');
  for (let i = 0; i < 14; i++) blob(W * (0.15 + rnd() * 0.7), H * (0.15 + rnd() * 0.7), Math.min(W, H) * (0.02 + rnd() * 0.04), 0.55, '6,5,4'); // drips
  return cv;
}

// Tyre marks: a pair of rubber tracks (track width tw m) along a gentle S-curve, length L m. Faint, broken.
export function tyreCanvas(L, H, { ppm = 48, seed = 1, tw = 1.75, bend = 0.6, alpha = 0.22 } = {}) {
  const cv = mk(L * ppm, H * ppm), g = cv.getContext('2d'), W = cv.width, Hp = cv.height, rnd = rngFrom(seed);
  g.lineCap = 'round';
  for (const side of [-0.5, 0.5]) {
    const steps = 60; let px = 0, py = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, x = t * W, y = Hp / 2 + side * tw * ppm + Math.sin(t * Math.PI) * bend * ppm * (1 - t * 0.6) * 0.5;
      if (i) {
        const a = alpha * clamp(fbm2(t * 6, side * 9, 3, seed) * 1.6 - 0.2, 0, 1) * Math.sin(Math.PI * clamp(t * 1.1, 0, 1));
        g.strokeStyle = `rgba(10,10,10,${a.toFixed(3)})`; g.lineWidth = 0.2 * ppm * (0.85 + rnd() * 0.3);
        g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
      }
      px = x; py = y;
    }
  }
  return cv;
}

// Wet patch: irregular soft-edged blob (fbm threshold) — darkens and, on the glossy 'wet' decal material, shines.
export function wetCanvas(w, h, { ppm = 40, seed = 1, alpha = 0.4 } = {}) {
  const cv = mk(w * ppm, h * ppm), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x / W - 0.5) * 2, v = (y / H - 0.5) * 2, r = Math.sqrt(u * u + v * v);
    const n = fbm2(x / W * 3, y / H * 3, 4, seed);
    const m = clamp((0.95 - r + (n - 0.5) * 0.9) * 4, 0, 1);
    const i = (x + y * W) * 4; d[i] = 12; d[i + 1] = 12; d[i + 2] = 13; d[i + 3] = 255 * alpha * m;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// Scree spill: a fan of grey gravel and grit spreading from the top edge (the slope side), fading out.
export function screeCanvas(w, h, { ppm = 70, seed = 1 } = {}) {
  const cv = mk(w * ppm, h * ppm), g = cv.getContext('2d'), W = cv.width, H = cv.height, rnd = rngFrom(seed);
  const img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, spread = 0.5 - Math.abs(u - 0.5);
    const n = fbm2(u * 6, v * 4, 4, seed);
    const m = clamp((spread * 2.2 - v * 1.1 + (n - 0.5) * 0.8) * 3, 0, 1);
    const i = (x + y * W) * 4, c = 92 + n * 40;
    d[i] = c; d[i + 1] = c * 0.98; d[i + 2] = c * 0.94; d[i + 3] = 230 * m;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < W * H / 60; i++) { // individual stones and grit
    const u = rnd(), v = Math.pow(rnd(), 1.6), spread = 0.5 - Math.abs(u - 0.5);
    if (v > spread * 2.2 + 0.05) continue;
    const s = 0.6 + rnd() * rnd() * 4, c = 60 + rnd() * 110;
    g.fillStyle = `rgba(${c | 0},${(c * 0.97) | 0},${(c * 0.93) | 0},${0.6 + rnd() * 0.4})`;
    g.beginPath(); g.ellipse(u * W, v * H, s, s * (0.6 + rnd() * 0.4), rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  return cv;
}

// Shelter concrete floor: boot-traffic grime from the opening (+X edge of the canvas = the open side), water
// tide marks along the walls, rubber scuffs and a couple of old drink stains. w × d metres.
export function floorCanvas(w, d, { ppm = 70, seed = 1 } = {}) {
  const cv = mk(w * ppm, d * ppm), g = cv.getContext('2d'), W = cv.width, H = cv.height, rnd = rngFrom(seed);
  const img = g.createImageData(W, H), px = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, edge = Math.min(v, 1 - v, u);
    const n = fbm2(u * 7, v * 5, 4, seed);
    const traffic = clamp(u * 1.3 - 0.25, 0, 1) * (1 - Math.abs(v - 0.5) * 1.4);   // worn path in from the opening
    const tide = clamp(1 - edge / 0.06, 0, 1);                                       // damp line along the walls
    const dust = clamp(0.12 + 0.8 * traffic * (0.3 + n) + 0.3 * clamp(n * 2 - 0.9, 0, 1), 0, 0.8);   // pale scree dust
    const damp = clamp(0.75 * tide * (0.6 + n * 0.6), 0, 0.8);                                          // dark tide line
    const i = (x + y * W) * 4, a = Math.max(dust, damp), k = damp > dust ? 0 : 1;
    px[i] = k ? 196 : 18; px[i + 1] = k ? 184 : 16; px[i + 2] = k ? 160 : 14; px[i + 3] = 255 * a;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 9; i++) { // pale scree dust tracked in on boots, heaviest at the opening
    const x = W * (0.55 + rnd() * 0.45), y = H * (0.2 + rnd() * 0.6), r = ppm * (0.25 + rnd() * 0.45);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(176,164,140,0.35)'); gr.addColorStop(1, 'rgba(176,164,140,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) { // boot-rubber scuffs, mostly toward the bench and the boards
    const x = W * (0.2 + rnd() * 0.75), y = H * (0.15 + rnd() * 0.7), a = rnd() * Math.PI, L = ppm * (0.05 + rnd() * 0.18);
    g.strokeStyle = `rgba(14,12,10,${0.25 + rnd() * 0.35})`; g.lineWidth = ppm * (0.008 + rnd() * 0.012);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.6, y + Math.sin(a) * L * 0.4 + (rnd() - 0.5) * 6, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  for (let i = 0; i < 3; i++) { // coffee / drink ring stains
    const x = W * (0.25 + rnd() * 0.5), y = H * (0.2 + rnd() * 0.6), r = ppm * (0.08 + rnd() * 0.1);
    const gr = g.createRadialGradient(x, y, r * 0.5, x, y, r); gr.addColorStop(0, 'rgba(60,40,20,0.12)'); gr.addColorStop(0.85, 'rgba(60,38,18,0.38)'); gr.addColorStop(1, 'rgba(60,38,18,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return cv;
}

// Coir door mat seen from above (w × h m): bristle noise, trodden-flat dark middle, faded department text.
export function doorMatCanvas(w, h, { ppm = 300, seed = 3 } = {}) {
  const cv = mk(w * ppm, h * ppm), g = cv.getContext('2d'), W = cv.width, H = cv.height, rnd = rngFrom(seed);
  const img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, mid = 1 - Math.hypot(u - 0.5, (v - 0.5) * 0.7) * 1.4;
    const n = fbm2(x * 0.9, y * 0.9, 2, seed) * 0.6 + rnd() * 0.4, k = (1 - 0.45 * clamp(mid, 0, 1)) * (0.6 + 0.5 * n);
    const i = (x + y * W) * 4; d[i] = 120 * k; d[i + 1] = 92 * k; d[i + 2] = 58 * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(30,24,18,0.8)'; g.lineWidth = ppm * 0.03; g.strokeRect(ppm * 0.03, ppm * 0.03, W - ppm * 0.06, H - ppm * 0.06);
  g.font = `bold ${H * 0.2}px ${FONTS.sign}`; g.fillStyle = 'rgba(28,22,16,0.55)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('PLEASE REMOVE SCREE', W / 2, H * 0.42); g.font = `bold ${H * 0.11}px ${FONTS.sign}`; g.fillText('(and kea)', W / 2, H * 0.66);
  return cv;
}
