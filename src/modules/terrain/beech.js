// terrain/beech — New Zealand mountain beech (Nothofagus): a short straight trunk that forks into 2-3 leaders,
// near-horizontal branches and flat, layered foliage sprays of tiny dark leaves. Sooty-mould-black bark with moss
// on the lower trunk (vertex colour). ~1.4k tris per tree (trunk + branches ~0.7k, ~330 leaf cards).
//   beechGeo({seed, height, trunkR, leaders, cards}) → { trunk, leaves }   base at y = 0
//   beechLeafTexture({size, seed}) → DataTexture (colour-dilated, alpha-boosted mips, like scatter.leafTexture)
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, DataTexture, RGBAFormat, UnsignedByteType, SRGBColorSpace, LinearMipmapLinearFilter, LinearFilter } from 'three';
import { lathe, tube, mergeGeos } from '../../cookbook/geo/kit.js';
import { rngFrom, vnoise3, clamp, sstep } from '../../cookbook/geo/noise.js';

const TAU = Math.PI * 2;

export function beechLeafTexture({ size = 256, seed = 3 } = {}) {
  const rnd = rngFrom(seed), cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d');
  // sprays: a twig from near the centre outwards, alternate tiny oval leaves along it (mountain beech leaves ~1 cm)
  const pal = [[46, 60, 34], [56, 70, 38], [64, 74, 36], [40, 52, 32], [78, 80, 40], [96, 70, 40]];
  for (let s = 0; s < 24; s++) {
    const a = rnd() * TAU, r0 = rnd() * size * 0.12, len = size * (0.25 + 0.2 * rnd());
    let x = size / 2 + Math.cos(a) * r0, y = size / 2 + Math.sin(a) * r0, d = a + (rnd() - 0.5) * 0.6;
    const steps = 14;
    for (let k = 0; k < steps; k++) {
      const nx = x + Math.cos(d) * len / steps, ny = y + Math.sin(d) * len / steps;
      g.strokeStyle = 'rgba(38,30,24,0.9)'; g.lineWidth = Math.max(1, size / 220) * (1.4 - k / steps);
      g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      for (const side of [-1, 1]) {
        if (rnd() < 0.15) continue;
        const la = d + side * (0.7 + 0.4 * rnd()), L = size * (0.04 + 0.022 * rnd()) * (1 - 0.35 * k / steps), W = L * 0.55;
        const c = pal[(rnd() * (rnd() < 0.06 ? pal.length : pal.length - 1)) | 0], lv = 0.8 + 0.4 * rnd();
        g.save(); g.translate(nx + Math.cos(la) * L * 0.55, ny + Math.sin(la) * L * 0.55); g.rotate(la + Math.PI / 2);
        g.fillStyle = `rgb(${(c[0] * lv) | 0},${(c[1] * lv) | 0},${(c[2] * lv) | 0})`;
        g.beginPath(); g.ellipse(0, 0, W * 0.5, L * 0.5, 0, 0, TAU); g.fill();
        g.restore();
      }
      x = nx; y = ny; d += (rnd() - 0.5) * 0.35;
    }
  }
  const img = g.getImageData(0, 0, size, size).data, n = size * size;
  const rgb = new Float32Array(n * 3), A = new Float32Array(n), have = new Uint8Array(n);
  for (let i = 0; i < n; i++) { A[i] = img[i * 4 + 3] / 255; if (A[i] > 0.05) { have[i] = 1; for (let c = 0; c < 3; c++) rgb[i * 3 + c] = img[i * 4 + c] / A[i]; } }
  for (let pass = 0; pass < 8; pass++) { // dilate colour into transparent texels: no dark fringes under alphaTest
    const nh = have.slice();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = x + y * size; if (have[i]) continue;
      let r = 0, gg = 0, b = 0, k = 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + ox, yy = y + oy; if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue; const j = xx + yy * size; if (have[j]) { r += rgb[j * 3]; gg += rgb[j * 3 + 1]; b += rgb[j * 3 + 2]; k++; } }
      if (k) { rgb[i * 3] = r / k; rgb[i * 3 + 1] = gg / k; rgb[i * 3 + 2] = b / k; nh[i] = 1; }
    }
    have.set(nh);
  }
  for (let i = 0; i < n; i++) if (!have[i]) { rgb[i * 3] = 48; rgb[i * 3 + 1] = 60; rgb[i * 3 + 2] = 34; }
  const mips = []; let w = size, cr = rgb, ca = A;
  for (let lvl = 0; w >= 1; lvl++) {
    const data = new Uint8Array(w * w * 4), boost = 1 + 0.35 * lvl;
    for (let i = 0; i < w * w; i++) { data[i * 4] = cr[i * 3]; data[i * 4 + 1] = cr[i * 3 + 1]; data[i * 4 + 2] = cr[i * 3 + 2]; data[i * 4 + 3] = clamp(ca[i] * boost, 0, 1) * 255; }
    mips.push({ data, width: w, height: w });
    if (w === 1) break;
    const h2 = w >> 1, nr = new Float32Array(h2 * h2 * 3), na = new Float32Array(h2 * h2);
    for (let y = 0; y < h2; y++) for (let x = 0; x < h2; x++) {
      const o = x + y * h2; let sa = 0;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const j = x * 2 + ox + (y * 2 + oy) * w; sa += ca[j]; for (let c = 0; c < 3; c++) nr[o * 3 + c] += cr[j * 3 + c] * 0.25; }
      na[o] = sa * 0.25;
    }
    cr = nr; ca = na; w = h2;
  }
  const tex = new DataTexture(mips[0].data, size, size, RGBAFormat, UnsignedByteType);
  tex.mipmaps = mips; tex.generateMipmaps = false; tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter; tex.magFilter = LinearFilter; tex.anisotropy = 4; tex.needsUpdate = true;
  return tex;
}

// flat foliage spray clump: cards mostly horizontal (layered beech look), normals blended from the crown centre
function clump(md, c, rx, ry, cards, size, crown, rnd, ao) {
  for (let i = 0; i < cards; i++) {
    const a = rnd() * TAU, rr = Math.sqrt(rnd()), cy = (rnd() - 0.35) * ry;
    const px = c[0] + Math.cos(a) * rr * rx, py = c[1] + cy * (1 - rr * 0.5), pz = c[2] + Math.sin(a) * rr * rx;
    // card plane: mostly horizontal with a droop outward
    const tilt = (0.15 + 0.45 * rnd()) * (rnd() < 0.5 ? -1 : 1), az = rnd() * TAU;
    let nx = Math.sin(tilt) * Math.cos(az), ny = Math.cos(tilt), nz = Math.sin(tilt) * Math.sin(az);
    let ux = -nz, uz = nx, uy = 0; const lu = Math.hypot(ux, uz) || 1; ux /= lu; uz /= lu; if (lu < 1e-3) { ux = 1; uz = 0; }
    const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
    const ss = size * (0.7 + 0.6 * rnd()), rot = rnd() * TAU, co = Math.cos(rot), si = Math.sin(rot);
    const o = md.p.length / 3;
    for (const [qx, qy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lx = (qx * co - qy * si) * ss * 0.5, ly = (qx * si + qy * co) * ss * 0.5;
      const x = px + ux * lx + vx * ly, y = py + uy * lx + vy * ly, z = pz + uz * lx + vz * ly;
      // shading normal: crown-outward blended with up (soft volume, top lit by the sky)
      let sx = x - crown[0], sy = (y - crown[1]) * 1.6 + 1.2, sz = z - crown[2]; const l = Math.hypot(sx, sy, sz) || 1;
      md.p.push(x, y, z); md.n.push(sx / l, sy / l, sz / l); md.u.push((qx + 1) / 2, (qy + 1) / 2);
      const k = ao(x, y, z); md.c.push(k, k * 1.02, k * 0.98);
    }
    md.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
}

export function beechGeo({ seed = 1, height = 15, trunkR = 0.32, leaders = 2, cards = 330, leafSize = 1.15 } = {}) {
  const rnd = rngFrom(seed * 97 + 13), H = height, R = trunkR, fork = H * (0.26 + 0.1 * rnd());
  const lean = [(rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5];
  // trunk: root flare, slight furrows, lean
  const prof = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6, y = t * fork * 1.08; prof.push([R * (1 - 0.3 * t) * (1 + 0.8 * Math.exp(-y * 3)), y]); }
  const trunk = lathe(prof, { seg: 9, crease: 80 });
  const P = trunk.attributes.position.array;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2], a = Math.atan2(z, x), r = Math.hypot(x, z);
    const f = 1 + 0.08 * (vnoise3(Math.cos(a) * 2, y * 0.7, Math.sin(a) * 2, seed) - 0.5) * 2;
    const roots = 1 + 0.45 * Math.exp(-y * 4) * Math.pow(Math.abs(Math.sin(a * 2.5 + seed)), 3);
    const t = y / H;
    P[i] = Math.cos(a) * r * f * roots + lean[0] * t * t * H * 0.3; P[i + 2] = Math.sin(a) * r * f * roots + lean[1] * t * t * H * 0.3;
  }
  trunk.computeVertexNormals();
  const parts = [trunk], md = { p: [], n: [], c: [], u: [], i: [] };
  const top = [lean[0] * (fork / H) ** 2 * H * 0.3, fork, lean[1] * (fork / H) ** 2 * H * 0.3];
  const crown = [top[0], H * 0.72, top[2]], crownR = H * 0.34;
  const ao = (x, y, z) => {
    const d = Math.hypot(x - crown[0], (y - crown[1]) * 1.3, z - crown[2]) / crownR;
    return clamp(0.32 + 0.72 * d, 0.32, 1.05) * (0.7 + 0.3 * sstep(crown[1] - crownR * 0.8, crown[1] + crownR * 0.6, y));
  };
  const clumps = [];
  const nL = leaders + (rnd() < 0.3 ? 1 : 0), a0 = rnd() * TAU;
  for (let l = 0; l < nL; l++) {
    const a = a0 + (l / nL) * TAU + (rnd() - 0.5) * 0.8, spread = H * (0.1 + 0.1 * rnd()), tipY = H * (0.86 + 0.12 * rnd());
    const pts = [];
    for (let k = 0; k <= 4; k++) { const s = k / 4; pts.push([top[0] + Math.cos(a) * spread * Math.sin(s * 1.4), fork + (tipY - fork) * s, top[2] + Math.sin(a) * spread * Math.sin(s * 1.4)]); }
    const lr = R * 0.62 * (nL > 2 ? 0.85 : 1);
    parts.push(tube(pts, (s) => lr * (1 - 0.75 * s), { radial: 7, curve: true, samples: 7, caps: false }));
    clumps.push([pts[4][0], pts[4][1] - 0.4, pts[4][2], 2.4 + 0.7 * rnd(), 1.3]);
    // branches: near horizontal, in tiers along the leader
    const nb = 4 + ((rnd() * 2) | 0);
    for (let b = 0; b < nb; b++) {
      const s = 0.2 + 0.7 * (b / nb) + rnd() * 0.06, p0 = pts[Math.min(4, Math.round(s * 4))];
      const ba = a + (b % 2 ? 1 : -1) * (0.6 + 0.9 * rnd()), bl = H * (0.2 + 0.12 * rnd()) * (1.1 - 0.5 * s), up = 0.12 + 0.3 * rnd();
      const p1 = [p0[0] + Math.cos(ba) * bl * 0.5, p0[1] + bl * up * 0.6, p0[2] + Math.sin(ba) * bl * 0.5];
      const p2 = [p0[0] + Math.cos(ba) * bl, p0[1] + bl * up, p0[2] + Math.sin(ba) * bl];
      parts.push(tube([p0, p1, p2], (t) => lr * 0.42 * (1 - 0.8 * t), { radial: 4, curve: true, samples: 4, caps: false }));
      clumps.push([p2[0], p2[1] + 0.15, p2[2], 1.8 + 0.8 * rnd(), 0.9]);
      if (rnd() < 0.7) clumps.push([p1[0], p1[1] + 0.25, p1[2], 1.4 + 0.6 * rnd(), 0.7]);
    }
  }
  // a few low epicormic sprays on the trunk (beech keeps lower foliage at forest edges)
  for (let k = 0; k < 3; k++) { const a = rnd() * TAU, y = fork * (0.45 + 0.5 * rnd()); clumps.push([top[0] + Math.cos(a) * 1.3, y, top[2] + Math.sin(a) * 1.3, 1.2, 0.5]); }
  const tot = clumps.reduce((s, c) => s + c[3] * c[3], 0);
  for (const c of clumps) clump(md, [c[0], c[1], c[2]], c[3], c[4], Math.max(4, Math.round((cards * c[3] * c[3]) / tot)), leafSize, crown, rnd, ao);
  const wood = mergeGeos(parts);
  // vertex colour: dark base, moss on the lower trunk (stronger on one side), lichen-pale flecks higher up
  const C = wood.attributes.color.array, WP = wood.attributes.position.array, ms = rnd() * TAU;
  for (let i = 0; i < C.length; i += 3) {
    const x = WP[i], y = WP[i + 1], z = WP[i + 2], side = 0.5 + 0.5 * Math.cos(Math.atan2(z, x) - ms);
    const moss = clamp((1 - sstep(0.4, 2.6 + 1.2 * side, y)) * (0.55 + 0.45 * side) + 0.25 * vnoise3(x * 3, y * 2, z * 3, seed + 9) - 0.12, 0, 1);
    const k = 0.55 + 0.45 * sstep(0, 1.2, y);
    C[i] = k * (1 - moss * 0.45); C[i + 1] = k * (1 + moss * 0.25); C[i + 2] = k * (1 - moss * 0.6);
  }
  return { trunk: wood, leaves: mdGeo(md) };
}

function mdGeo(md) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(md.p, 3)); g.setAttribute('normal', new Float32BufferAttribute(md.n, 3));
  g.setAttribute('color', new Float32BufferAttribute(md.c, 3)); g.setAttribute('uv', new Float32BufferAttribute(md.u, 2));
  g.setIndex(new Uint32BufferAttribute(md.i, 1)); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
}
