// vans/laundry — the Okonkwos' washing line: awning-bracket arm → sagging red nylon line → tripod pole, with real
// garment silhouettes (T-shirt, fringed towel, board shorts, socks, a hi-vis vest) as subdivided cloth that sags
// between its pegs, waves and folds (vertex z offset), with fold darkening baked into vertex colour. Pegs and a peg
// bag sit on the line. Cloth goes to the 'cloth' kit key (double-sided woven fabric, see index.js).
// Van-local metres, nose to -Z. Returns a local collider [cx, cz, w, d, h].
import { Vector3, Vector2, Shape, ShapeGeometry, Float32BufferAttribute, Color } from 'three';
import { tessellate } from './shape.js';
import { DIM as D } from './body.js';

const TAU = Math.PI * 2, _c = new Color();
const rnd = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// cloth offset field for a garment of width w / drop h hung at y = 0 (y negative downward), local frame
function makeField(w, h, seed, slope) {
  const ph1 = rnd(seed) * TAU, ph2 = rnd(seed + 1) * TAU, lam = 0.26 + rnd(seed + 2) * 0.12, bil = 0.02 + rnd(seed + 3) * 0.015;
  const hw = w / 2;
  return (x, y) => {
    const dep = Math.max(0, -y), top = Math.min(1, dep / 0.07), u = Math.max(-1, Math.min(1, x / hw));
    const wave = 0.022 * Math.sin((x / lam) * TAU + ph1) * top;                    // big soft wave along the line
    const fold = 0.011 * Math.sin((x / 0.1) * TAU + ph2) * top * (0.4 + 0.6 * Math.min(1, dep / (h * 0.6))); // peg-drawn vertical folds
    const billow = bil * Math.pow(Math.min(1, dep / h), 1.4) * Math.sin(x * 4.0 + ph1 * 0.5 + 1.2); // hem lifts in the draught
    const z = wave + fold + billow;
    const droop = 0.028 * (1 - u * u) * Math.exp(-dep / 0.12);                   // sag between the pegs
    const ao = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin((x / 0.1) * TAU + ph2)) * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin((x / lam) * TAU + ph1)));
    return [z, slope * x - droop, ao];
  };
}

// shape → subdivided, displaced cloth geometry with metric uvs and per-vertex colour (base × fold AO × bands)
function clothGeo(pts, field, color, bands = [], tess = 0.03, dz = 0) {
  const sh = new Shape(pts.map(([x, y]) => new Vector2(x, y)));
  let g = new ShapeGeometry(sh, 4);
  const n0 = g.attributes.position.count;
  g.setAttribute('color', new Float32BufferAttribute(new Float32Array(n0 * 3).fill(1), 3));
  g = tessellate(g, tess, 8);
  const P = g.attributes.position.array, C = g.attributes.color.array, base = new Color(color);
  for (let i = 0; i < P.length / 3; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], [z, dy, ao] = field(x, y);
    _c.copy(base);
    for (const b of bands) if (y <= b[0] && y >= b[1]) _c.set(b[2]);
    const n = 0.95 + 0.1 * rnd(i * 0.37 + x * 13 + y * 7), top = 0.9 + 0.1 * Math.min(1, -y / 0.05);
    const k = ao * n * top;
    P[i * 3 + 1] = y + dy; P[i * 3 + 2] = z + dz;
    C[i * 3] = _c.r * k; C[i * 3 + 1] = _c.g * k; C[i * 3 + 2] = _c.b * k;
  }
  g.computeVertexNormals();
  return g;
}

// garment outlines, y = 0 on the line, negative downward
const T_SHIRT = [[-0.09, 0], [-0.2, -0.012], [-0.32, -0.1], [-0.28, -0.21], [-0.19, -0.165], [-0.2, -0.64], [-0.1, -0.655], [0.1, -0.655], [0.2, -0.64],
  [0.19, -0.165], [0.28, -0.21], [0.32, -0.1], [0.2, -0.012], [0.09, 0], [0.05, -0.04], [0, -0.05], [-0.05, -0.04]];
const SHORTS = [[-0.21, 0], [0.21, 0], [0.235, -0.46], [0.03, -0.47], [0.0, -0.21], [-0.03, -0.47], [-0.235, -0.46]];
const VEST = [[-0.15, 0], [-0.065, 0], [0, -0.23], [0.065, 0], [0.15, 0], [0.165, -0.07], [0.17, -0.2], [0.25, -0.26], [0.255, -0.6],
  [0.1, -0.61], [-0.1, -0.61], [-0.255, -0.6], [-0.25, -0.26], [-0.17, -0.2], [-0.165, -0.07]];
const SOCK = [[-0.042, 0], [0.042, 0], [0.044, -0.22], [0.07, -0.25], [0.125, -0.27], [0.14, -0.3], [0.125, -0.33], [0.05, -0.33], [0.0, -0.31], [-0.04, -0.27]];
function towel(w, h) { // body + fringe teeth along the hem
  const p = [[-w / 2, 0], [w / 2, 0], [w / 2 - 0.004, -h]], n = 22;
  for (let i = 0; i < n; i++) {
    const x0 = w / 2 - 0.004 - (i / n) * (w - 0.008), x1 = x0 - (w - 0.008) / n * 0.55;
    p.push([x0, -h - 0.045 - (i % 3) * 0.004], [x1, -h - 0.045 - ((i + 1) % 3) * 0.004], [x1, -h], [x1 - (w - 0.008) / n * 0.45, -h]);
  }
  p.push([-w / 2 + 0.004, -h]);
  return p.filter((q, i, a) => i === 0 || Math.abs(q[0] - a[i - 1][0]) + Math.abs(q[1] - a[i - 1][1]) > 1e-4);
}

const PEG_COLS = [0xd8402a, 0x2f7ad0, 0x3aa050, 0xe8c030, 0xe8e4da];

function peg(k, x, y, seed) {
  const c = PEG_COLS[Math.floor(rnd(seed) * PEG_COLS.length)];
  for (const s of [-1, 1]) k.box(0.012, 0.072, 0.007, 'cab', { at: [x, y - 0.022, s * 0.0062], rot: [s * 0.06, 0, 0], r: 0.0025, color: c, occ: false });
  k.cyl(0.0045, 0.016, 'metal', { at: [x, y - 0.012, 0], rot: [0, 0, Math.PI / 2], seg: 8, color: 0xb8babc, occ: false }); // spring
}

export function buildWashing(k) {
  const hw = D.bodyW / 2, metal = 0x34373a;
  // bracket: strap off the awning cassette's middle bracket, arm out to an eye
  const ex = -(hw + 0.24), ey = 2.56, ez = 1.1;
  k.box(0.035, 0.18, 0.05, 'dark', { at: [-(hw + 0.035), 2.64, ez], r: 0.008, color: metal });
  k.bar([-(hw + 0.04), 2.58, ez], [ex + 0.02, ey, ez], 0.03, 0.025, 'dark', { r: 0.007, color: metal });
  k.bar([-(hw + 0.04), 2.66, ez], [-(hw + 0.16), 2.575, ez], 0.02, 0.02, 'dark', { r: 0.005, color: metal });   // gusset
  const eye = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; eye.push(new Vector3(ex + Math.cos(a) * 0.022, ey - 0.03 + Math.sin(a) * 0.022, ez)); }
  k.tube(eye, 0.005, 'dark', { radial: 6, closed: true, color: metal });
  // pole: two telescoping sections, clamp collar, cap + hook, tripod legs with rubber feet
  const px = -(hw + 2.6), pz = 2.3, top = 1.98;
  k.cyl(0.022, 1.2, 'dark', { at: [px, 0.6, pz], seg: 12, color: metal });
  k.cyl(0.017, top - 1.15, 'dark', { at: [px, 1.15 + (top - 1.15) / 2, pz], seg: 12, color: 0x4a4d50 });
  k.cyl(0.03, 0.06, 'dark', { at: [px, 1.2, pz], seg: 12, color: 0x1c1d1e });
  k.box(0.05, 0.02, 0.03, 'dark', { at: [px + 0.035, 1.2, pz], r: 0.006, color: 0xc03a1a });                 // clamp lever
  k.cyl(0.024, 0.03, 'dark', { at: [px, top + 0.015, pz], seg: 12, color: 0x1c1d1e });
  const hook = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * (i / 8); hook.push(new Vector3(px + Math.cos(a) * 0.03 - 0.0, top - 0.04 + Math.sin(a) * 0.03, pz)); }
  k.tube(hook.map((v) => v.clone().setY(v.y + 0.06)), 0.005, 'dark', { radial: 6, color: metal });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5, fx = px + Math.cos(a) * 0.42, fz = pz + Math.sin(a) * 0.42;
    k.tube([new Vector3(px, 0.62, pz), new Vector3(fx, 0.02, fz)], 0.011, 'dark', { radial: 6, color: metal });
    k.cyl(0.02, 0.03, 'dark', { at: [fx, 0.015, fz], seg: 10, color: 0x141414 });
  }
  // the line: catenary-ish sag under load, plastic-coated red nylon
  const a = new Vector3(ex, ey - 0.03, ez), b = new Vector3(px - 0.0, top + 0.05, pz), sagD = 0.26;
  const sag = (t, out = new Vector3()) => out.lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sagD * 4 * t * (1 - t));
  const line = []; for (let i = 0; i <= 28; i++) line.push(sag(i / 28));
  k.tube(line, 0.008, 'cab', { radial: 6, color: 0xc8341e });
  const d = new Vector3().subVectors(b, a), run = Math.hypot(d.x, d.z), yaw = Math.atan2(-d.z, d.x);
  const slopeAt = (t) => (sag(t + 0.01).y - sag(t - 0.01).y) / (0.02 * run);
  // garments: [t, outline, colour, bands [yTop, yBot, colour], seed, pegs x]
  const items = [
    [0.13, T_SHIRT, 0xd8571c, [[-0.03, -0.042, 0xa8401a]], 1, [-0.17, 0.17]],
    [0.3, towel(0.46, 0.7), 0xe8e4d8, [[-0.08, -0.13, 0x2f5d7c], [-0.57, -0.62, 0x2f5d7c], [-0.64, -0.76, 0xe0dccc]], 2, [-0.2, 0.2]],
    [0.47, SHORTS, 0x2f5d7c, [[0, -0.05, 0x1e3e58]], 3, [-0.18, 0.18]],
    [0.6, SOCK, 0xe4e0d4, [[0, -0.035, 0x2f5d7c], [-0.29, -0.34, 0x2f5d7c]], 4, [0]],
    [0.66, SOCK, 0xb83a28, [[0, -0.035, 0xe4e0d4], [-0.29, -0.34, 0xe4e0d4]], 5, [0]],
    [0.8, VEST, 0xcfe02a, [[0, -0.006, 0x2a2c2e]], 6, [-0.11, 0.11]],
  ];
  const p = new Vector3();
  for (const [t, pts, col, bands, seed, pegs] of items) {
    sag(t, p);
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]), w = Math.max(...xs) - Math.min(...xs), h = -Math.min(...ys);
    const slope = slopeAt(t), field = makeField(w, h, seed * 7.3, slope);
    k.push(p.x, p.y - 0.006, p.z, yaw + (rnd(seed + 9) - 0.5) * 0.18, (rnd(seed + 11) - 0.5) * 0.1);
    k.add(clothGeo(pts, field, col, bands), 'cloth', { occ: false, color: 0xffffff });
    if (pts === VEST) { // silver retro-reflective bands both sides (same cloth field, lifted off the fabric)
      for (const yb of [-0.4, -0.5]) for (const s of [-1, 1]) {
        const strip = [[-0.252, yb], [0.252, yb], [0.252, yb - 0.05], [-0.252, yb - 0.05]];
        k.add(clothGeo(strip, field, 0xd4d8dc, [], 0.03, s * 0.003), 'cloth', { occ: false, color: 0xffffff });
      }
      for (const s of [-1, 1]) for (const sx of [-1, 1]) { // brace strips over the shoulders
        const st = [[sx * 0.075, -0.02], [sx * 0.125, -0.02], [sx * 0.125, -0.4], [sx * 0.075, -0.4]];
        k.add(clothGeo(st, field, 0xd4d8dc, [], 0.03, s * 0.0028), 'cloth', { occ: false, color: 0xffffff });
      }
    }
    for (const x of pegs) peg(k, x, slope * x + 0.006, seed * 3 + x * 10);
    k.pop();
  }
  // spare pegs + a peg bag hooked on the line near the pole
  for (const t of [0.9, 0.93]) { sag(t, p); k.push(p.x, p.y, p.z, yaw); peg(k, 0, 0.008, t * 50); k.pop(); }
  sag(0.97, p);
  k.push(p.x, p.y, p.z, yaw);
  const hk = []; for (let i = 0; i <= 8; i++) { const ang = Math.PI * (i / 8); hk.push(new Vector3(0, -0.035 + Math.sin(ang) * 0.035 + 0.035, Math.cos(ang) * 0.012)); }
  k.tube(hk, 0.003, 'metal', { radial: 5, color: 0xb8babc });
  k.box(0.2, 0.15, 0.09, 'cloth', { at: [0, -0.1, 0], r: 0.03, color: 0x56663a, occ: false });
  k.box(0.12, 0.012, 0.004, 'cab', { at: [0, -0.06, 0.046], r: 0.002, color: 0x2a2c2e });
  k.pop();
  k.cyl(0.18, 0.35, 'paint', { at: [-(hw + 1.2), 0.175, 2.9], seg: 18, color: 0xc8c4b8 });                      // laundry basket (empty: optimism)
  return [px, pz, 0.6, 0.6, 2.0];
}
