// vans/livery — canvas-2D rental livery, rego plates, stickers and damage scratches, packed into one atlas.
// Fictional rental company. Deadpan official copy only.
import { DecalAtlas, signCanvas, distress, grime, FONTS } from '../../cookbook/decals/canvas-text.js';
import { rngFrom, fnv } from '../../cookbook/geo/noise.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; };
const PPM = 200;

export const LIVERY = {
  A: { model: 'TUSSOCK 2', berth: 'SLEEPS 2. COMFORTABLY, IT SAYS HERE.', band: ['#2f5d4a', '#9c8548'], rego: 'KTL482', fleet: '014' },
  B: { model: 'TUSSOCK FAMILY 4', berth: 'SLEEPS 4. SOMETIMES.', band: ['#1d3346', '#d8571c'], rego: 'OKW719', fleet: '022' },
  C: { model: 'TUSSOCK SOLO+', berth: 'SLEEPS 1. PLUS LUGGAGE.', band: ['#5a2f2a', '#2f5d4a'], rego: 'TNK305', fleet: '031' },
};

// Long side graphic (w x h metres): a swept two-tone band low on the body + the brand + model name.
function sideCanvas(id, w, h, flip) {
  const L = LIVERY[id], W = w * PPM, H = h * PPM, cv = mk(W, H), g = cv.getContext('2d');
  if (flip) { g.translate(W, 0); g.scale(-1, 1); }
  const band = (c, y0, y1, k) => {
    g.fillStyle = c; g.beginPath(); g.moveTo(0, H * y0);
    g.bezierCurveTo(W * 0.35, H * (y0 - 0.02), W * 0.55, H * (y0 - 0.22 * k), W, H * (y0 - 0.5 * k));
    g.lineTo(W, H * (y1 - 0.5 * k)); g.bezierCurveTo(W * 0.55, H * (y1 - 0.22 * k), W * 0.35, H * (y1 - 0.02), 0, H * y1); g.closePath(); g.fill();
  };
  band(L.band[0], 0.80, 1.0, 0.6); band(L.band[1], 0.74, 0.79, 0.6);
  if (flip) { g.setTransform(1, 0, 0, 1, 0, 0); }
  g.textBaseline = 'alphabetic';
  g.font = `bold ${H * 0.07}px ${FONTS.sign}`; g.fillStyle = '#ece8dc'; g.textAlign = 'right';
  if (flip) { g.textAlign = 'left'; g.fillText(L.model + '  ·  FLEET ' + L.fleet, W * 0.03, H * 0.95); } else g.fillText(L.model + '  ·  FLEET ' + L.fleet, W * 0.97, H * 0.95);
  grime(cv, { amount: 0.3, seed: fnv(id + 'side' + flip) }); distress(cv, { amount: 0.35, seed: fnv(id + flip), edge: 0.15 });
  return cv;
}

function brandCanvas() {
  const W = 1.25 * 260, H = 0.5 * 260, cv = mk(W, H), g = cv.getContext('2d');
  g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillStyle = '#2a3d34';
  g.font = `bold ${H * 0.5}px ${FONTS.sign}`; g.fillText('TUSSOCK', W * 0.03, H * 0.52);
  const tw = g.measureText('TUSSOCK').width;
  g.fillStyle = '#9c8548'; g.beginPath(); g.moveTo(W * 0.03 + tw + 8, H * 0.52); g.lineTo(W * 0.03 + tw + 22, H * 0.1); g.lineTo(W * 0.03 + tw + 36, H * 0.52); g.closePath(); g.fill();
  g.fillStyle = '#2a3d34'; g.font = `bold ${H * 0.17}px ${FONTS.sign}`; g.fillText('CAMPERVAN HIRE', W * 0.03 + tw + 44, H * 0.5);
  g.font = `italic ${H * 0.17}px Georgia, serif`; g.fillStyle = '#3a3a36'; g.fillText('Freedom, within reason.', W * 0.04, H * 0.82);
  grime(cv, { amount: 0.25, seed: 77 }); distress(cv, { amount: 0.3, seed: 78, edge: 0.1 });
  return cv;
}

function shadowCanvas() { // soft contact shadow under the van (overcast sky occlusion)
  const W = 128, H = 256, cv = mk(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = Math.abs((x + 0.5) / W * 2 - 1), v = Math.abs((y + 0.5) / H * 2 - 1);
    const dx = Math.max(0, u - 0.62) / 0.38, dy = Math.max(0, v - 0.8) / 0.2, d = Math.min(1, Math.hypot(dx, dy));
    const a = Math.pow(1 - d, 1.6) * 0.78, i = (y * W + x) * 4;
    img.data[i] = 8; img.data[i + 1] = 8; img.data[i + 2] = 10; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

function plateCanvas(text) {
  const W = 0.37 * 600, H = 0.125 * 600, cv = mk(W, H), g = cv.getContext('2d');
  g.fillStyle = '#ecebe4'; g.beginPath(); g.roundRect(0, 0, W, H, 10); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); g.roundRect(5, 5, W - 10, H - 10, 7); g.stroke();
  g.fillStyle = '#121212'; g.font = `bold ${H * 0.68}px ${FONTS.sign}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, W / 2, H * 0.54);
  g.font = `bold ${H * 0.12}px ${FONTS.sign}`; g.fillText('NEW ZEALAND', W / 2, H * 0.9);
  grime(cv, { amount: 0.45, seed: fnv(text) }); distress(cv, { amount: 0.2, seed: fnv(text + 'p'), edge: 0.5 });
  return cv;
}

// Damage scratches: kea beak gouges (short parallel triplets) and possum claw rakes on transparent bg.
function scratchCanvas(seed, w, h, n) {
  const W = w * 300, H = h * 300, cv = mk(W, H), g = cv.getContext('2d'), r = rngFrom(seed);
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, a = (r() - 0.5) * 1.6 + (r() < 0.5 ? 0 : Math.PI), len = (0.05 + r() * 0.14) * 300, k = 2 + Math.floor(r() * 3);
    for (let j = 0; j < k; j++) {
      const ox = Math.cos(a + 1.57) * j * 6, oy = Math.sin(a + 1.57) * j * 6;
      g.strokeStyle = `rgba(${200 + r() * 30},${196 + r() * 30},${188 + r() * 30},${0.55 + r() * 0.4})`; g.lineWidth = 1.2 + r() * 2.2;
      g.beginPath(); g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + Math.cos(a) * len * 0.5 + (r() - 0.5) * 8, y + oy + Math.sin(a) * len * 0.5 + (r() - 0.5) * 8, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
      g.stroke();
      g.strokeStyle = 'rgba(40,34,28,0.5)'; g.lineWidth = 0.8; g.stroke();
    }
  }
  return cv;
}

function stickerCanvas(lines, { w = 0.5, h = 0.18, bg = '#efe8d4', fg = '#1f4a37', border = '#1f4a37' } = {}) {
  return signCanvas({ w, h, ppm: 420, bg, fg, border, borderW: 0.008, rivets: false, wear: 0.3, dirt: 0.25, lines });
}

function wofCanvas() { // round windscreen label
  const S = 120, cv = mk(S, S), g = cv.getContext('2d');
  g.fillStyle = '#1f6fb5'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.47, 0, 7); g.fill();
  g.fillStyle = '#f2f0e6'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.36, 0, 7); g.fill();
  g.fillStyle = '#1f2a33'; g.font = `bold ${S * 0.22}px ${FONTS.sign}`; g.textAlign = 'center'; g.fillText('WOF', S / 2, S * 0.5); g.font = `bold ${S * 0.14}px ${FONTS.sign}`; g.fillText('03 27', S / 2, S * 0.68);
  return cv;
}

export function buildAtlas(G, ids) {
  const at = new DecalAtlas(2048);
  for (const id of ids) {
    at.add('sideR' + id, sideCanvas(id, 4.3, 1.5, false));
    at.add('sideL' + id, sideCanvas(id, 4.3, 1.5, true));
    at.add('plate' + id, plateCanvas(LIVERY[id].rego));
    at.add('berth' + id, stickerCanvas([{ text: LIVERY[id].berth, size: 0.62 }], { w: 0.95, h: 0.11, bg: 'rgba(0,0,0,0)', fg: '#3a3a36', border: null }));
  }
  at.add('brand', brandCanvas()); at.add('shadow', shadowCanvas());
  for (let i = 0; i < 4; i++) at.add('scr' + i, scratchCanvas(91 + i * 17, 1.4, 0.7, 9 + i * 3));
  at.add('insure', stickerCanvas([{ text: 'KEA DAMAGE IS NOT COVERED', size: 0.34 }, { text: 'UNDER STANDARD INSURANCE (SEE CLAUSE 14b)', size: 0.2 }], { w: 0.62, h: 0.2 }));
  at.add('door', stickerCanvas([{ text: 'KEEP DOOR SHUT', size: 0.36 }, { text: 'POSSUMS — RANGER', size: 0.24 }], { w: 0.34, h: 0.14, bg: '#f4efd8', fg: '#7a1e14', border: '#7a1e14' }));
  at.add('lookout', stickerCanvas([{ text: 'THIS VEHICLE STOPS', size: 0.3 }, { text: 'AT EVERY LOOKOUT', size: 0.3 }], { w: 0.7, h: 0.22, bg: '#1f4a37', fg: '#efe8d4', border: '#efe8d4' }));
  at.add('call', stickerCanvas([{ text: '0800 TUSSOCK', size: 0.42 }, { text: 'PLEASE DO NOT CALL WHILE DRIVING', size: 0.22 }], { w: 0.72, h: 0.18 }));
  at.add('wof', wofCanvas());
  at.add('keep', stickerCanvas([{ text: 'KEEP LEFT', size: 0.5 }, { text: 'IT IS THE LAW HERE', size: 0.26 }], { w: 0.4, h: 0.14, bg: '#f2c51e', fg: '#141414', border: '#141414' }));
  at.add('gas', stickerCanvas([{ text: 'LPG', size: 0.6 }], { w: 0.14, h: 0.08, bg: '#d8571c', fg: '#141414', border: null }));
  at.add('roof', stickerCanvas([{ text: 'NO STEP', size: 0.5 }, { text: 'NO KEA', size: 0.3 }], { w: 0.34, h: 0.14, bg: 'rgba(0,0,0,0)', fg: '#2a2a2a', border: '#2a2a2a' }));
  at.finish(G.renderer);
  return at;
}
