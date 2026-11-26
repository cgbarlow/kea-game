// kea plumage atlas — baked once at load into three DataTextures (albedo sRGB, roughness, tangent-space normal).
// Layout (u right, v up, all rects in 0..1):
//   body [0,0 .5,.5]  scalloped olive-bronze contour feathers, orange-red rump band near v=1 (tail end)
//   wing top [.5,0 1,.5]  u = span (0 shoulder → 1 tip), v = chord (0 leading → 1 trailing): coverts, then remiges
//   wing under [.5,.5 1,1]  scarlet-orange underwing coverts, barred yellow-ochre flight feathers
//   head [0,.5 .25,.75]  fine olive-brown scaling, dark face; tail top/under [.25,.5 .375,1] / [.375,.5 .5,1]
//   beak [0,.75 .125,.875]  leg [.125,.75 .25,.875]  eye [0,.875 .125,1]
import { DataTexture, RGBAFormat, UnsignedByteType, SRGBColorSpace, LinearMipmapLinearFilter, LinearFilter, RepeatWrapping, NoColorSpace } from 'three';
import { vnoise2, fbm2, clamp, mix, sstep } from '../../cookbook/geo/noise.js';

export const R = {
  body: [0, 0, 0.5, 0.5], wingTop: [0.5, 0, 1, 0.5], wingUnder: [0.5, 0.5, 1, 1], head: [0, 0.5, 0.25, 0.75],
  tailTop: [0.25, 0.5, 0.375, 1], tailUnder: [0.375, 0.5, 0.5, 1], beak: [0, 0.75, 0.125, 0.875], leg: [0.125, 0.75, 0.25, 0.875],
  eye: [0, 0.875, 0.125, 1],
};
// map a local (s,t) in 0..1 into a region, inset so mips do not bleed across regions
export function ruv(r, s, t, inset = 0.012) {
  const w = r[2] - r[0], h = r[3] - r[1];
  return [r[0] + w * (inset + s * (1 - 2 * inset)), r[1] + h * (inset + t * (1 - 2 * inset))];
}

// sRGB 0..1 palette (albedo rule: stays under ~0.65 linear)
const OLIVE = [0.30, 0.35, 0.18], BRONZE = [0.37, 0.35, 0.18], EDGE = [0.12, 0.12, 0.07], HEADC = [0.34, 0.34, 0.21];
const SCARLET = [0.78, 0.30, 0.10], ORANGE = [0.82, 0.45, 0.14], OCHRE = [0.66, 0.54, 0.24], TEAL = [0.20, 0.36, 0.36];
const lerp3 = (o, a, b, t) => { o[0] = mix(a[0], b[0], t); o[1] = mix(a[1], b[1], t); o[2] = mix(a[2], b[2], t); return o; };

// one scallop cell: returns [d edge 0..1 (1 = feather fringe), h height, shaft]. Rows offset half a cell; the
// rounded tip of each feather points to +y (toward the tail / trailing edge).
const hash1 = (n) => { const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
function scallop(x, y, out) {
  const row = Math.floor(y), fy = y - row;
  // rows offset half a cell plus a per-row jitter, so the plumage never reads as a regular fish-scale tiling
  const fx = x + (row & 1) * 0.5 + (hash1(row) - 0.5) * 0.35, col = Math.floor(fx), cx = fx - col - 0.5;
  const wob = (hash1(col * 3.7 + row * 11.1) - 0.5) * 0.12;
  // feather outline: a half-ellipse tip at fy≈1, overlapping the next row
  const r = Math.sqrt(cx * cx * 2.2 + (fy - 0.25 + wob) * (fy - 0.25 + wob) * 1.3);
  const edge = sstep(0.79, 0.86, r) * sstep(0.3, 0.6, fy);
  out[0] = edge; out[1] = 0.35 + fy * 0.55 - edge * 0.3 - sstep(0.85, 1.0, r) * 0.2;
  out[2] = Math.exp(-cx * cx * 900) * (1 - fy) * 0.6;
  out[3] = col * 7.13 + row * 3.71;   // per-feather id
  return out;
}

export function bakeKeaTextures(N = 512) {
  const alb = new Uint8Array(N * N * 4), rough = new Uint8Array(N * N * 4), hgt = new Float32Array(N * N);
  const c = [0, 0, 0], tmp = [0, 0, 0], sc = [0, 0, 0, 0];
  const inR = (r, u, v) => u >= r[0] && u < r[2] && v >= r[1] && v < r[3];
  const loc = (r, u, v) => [(u - r[0]) / (r[2] - r[0]), (v - r[1]) / (r[3] - r[1])];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N, v = (j + 0.5) / N;
    let h = 0.5, ro = 0.78, s, t;
    const n1 = fbm2(u * 40, v * 40, 3, 11);
    if (inR(R.body, u, v)) {
      [s, t] = loc(R.body, u, v);
      // feathers grow from small at the neck to broad mantle/rump feathers (non-uniform rows)
      scallop(s * 20, 15 * (0.55 * t + 0.45 * t * t), sc);
      const id = vnoise2(sc[3], 1.7, 5);
      lerp3(c, OLIVE, BRONZE, clamp(id * 1.1 + n1 * 0.4 - 0.2, 0, 1)); const lv = 0.82 + id * 0.32; c[0] *= lv; c[1] *= lv; c[2] *= lv;
      // breast/belly (s near 0.5 = underside) a touch browner and plainer
      const belly = 1 - Math.abs(s - 0.5) * 4; if (belly > 0) lerp3(c, c, [0.38, 0.36, 0.22], clamp(belly, 0, 1) * 0.5);
      // rump: orange-red band on the back near the tail (s≈0 / 1 is the back seam)
      const back = Math.min(s, 1 - s) * 4; const rump = sstep(0.72, 0.9, t) * (1 - sstep(0.3, 0.9, back));
      lerp3(c, c, SCARLET, rump * 0.85);
      // layering: the exposed tip of each feather is lit and bronze-glossed, its base sits in the shade of the row above;
      // a crisp black margin rings every feather (the kea's signature scalloping)
      const lit = sstep(0.45, 0.8, sc[1]);
      lerp3(c, c, [0.42, 0.42, 0.2], lit * 0.22 * (1 - rump));
      lerp3(c, c, EDGE, sc[0] * (0.8 - rump * 0.3) + (1 - sc[1]) * 0.05);
      c[0] += sc[2] * 0.05; c[1] += sc[2] * 0.05;
      h = sc[1]; ro = 0.6 + sc[0] * 0.25 - lit * 0.08 + n1 * 0.06;
    } else if (inR(R.wingTop, u, v)) {
      [s, t] = loc(R.wingTop, u, v);
      // coverts (scallops) on the leading ~45% of the chord near the body, shrinking toward the tip
      const covEnd = mix(0.5, 0.28, s);
      if (t < covEnd) {
        scallop(s * 16, t * 9, sc);
        lerp3(c, OLIVE, BRONZE, clamp(vnoise2(sc[3], 4.1, 9) * 0.8 + n1 * 0.3, 0, 1));
        lerp3(c, c, [0.42, 0.42, 0.2], sstep(0.45, 0.8, sc[1]) * 0.2);
        lerp3(c, c, EDGE, sc[0] * 0.8 + (1 - sc[1]) * 0.14); h = sc[1]; ro = 0.62 + sc[0] * 0.2;
      } else {
        // remiges: long feathers across the chord; primaries (s > .45) darker with teal-blue outer vanes
        const nf = s < 0.45 ? 10 : 9, fx = s * 2 * nf, fi = Math.floor(fx), ff = fx - fi;
        const prim = sstep(0.4, 0.55, s);
        const vane = ff < 0.32 ? 1 : 0;                                  // outer vane strip
        lerp3(c, OLIVE, EDGE, 0.35 + prim * 0.35);
        lerp3(tmp, OLIVE, TEAL, prim);
        lerp3(c, c, tmp, vane * 0.85);
        const shaft = Math.exp(-((ff - 0.33) ** 2) * 2200);
        lerp3(c, c, [0.62, 0.58, 0.42], shaft * 0.5);
        const gap = sstep(0.9, 1.0, ff) + (1 - sstep(0, 0.06, ff));
        lerp3(c, c, EDGE, gap * 0.8 + (1 - sstep(covEnd, covEnd + 0.04, t)) * 0.6);
        // dark tips
        lerp3(c, c, EDGE, sstep(0.82, 1.0, t) * 0.55);
        h = 0.6 - gap * 0.4 + shaft * 0.2 + ff * 0.15; ro = 0.68;
      }
    } else if (inR(R.wingUnder, u, v)) {
      [s, t] = loc(R.wingUnder, u, v);
      const covEnd = mix(0.55, 0.3, s);
      if (t < covEnd) {
        // underwing coverts: deep scarlet at the body and leading edge grading to flame orange toward the hand,
        // each covert with a paler tip and a dark red margin so the flash reads as layered feathers, not a flat band
        scallop(s * 18, t * 9, sc);
        lerp3(c, [0.62, 0.17, 0.07], ORANGE, clamp(vnoise2(sc[3], 2.3, 3) * 0.2 + n1 * 0.25 + t * 0.55 + s * 0.6 - 0.25, 0, 1));
        lerp3(c, c, [0.9, 0.58, 0.22], sstep(0.5, 0.85, sc[1]) * 0.22);
        lerp3(c, c, [0.32, 0.09, 0.04], sc[0] * 0.55 + (1 - sc[1]) * 0.15); h = 0.4 + sc[1] * 0.3; ro = 0.66 + sc[0] * 0.2 + n1 * 0.08;
      } else {
        const fx = s * 18, ff = fx - Math.floor(fx);
        lerp3(c, OCHRE, [0.70, 0.42, 0.14], 1 - sstep(0.2, 0.7, s));
        // the kea underwing barring: dark bands across the remiges
        const bar = sstep(0.6, 0.9, Math.sin((t * 11 + ff * 0.5 + n1 * 0.8) * Math.PI) * 0.5 + 0.5);
        lerp3(c, c, [0.30, 0.22, 0.10], bar * 0.45 * sstep(covEnd, covEnd + 0.1, t));
        const gap = sstep(0.9, 1.0, ff) + (1 - sstep(0, 0.06, ff));
        lerp3(c, c, EDGE, gap * 0.6 + sstep(0.85, 1, t) * 0.5);
        h = 0.6 - gap * 0.4; ro = 0.76;
      }
    } else if (inR(R.head, u, v)) {
      [s, t] = loc(R.head, u, v);
      scallop(s * 30, t * 16, sc);
      lerp3(c, HEADC, [0.33, 0.34, 0.20], clamp(vnoise2(sc[3], 8.1, 2) + n1 * 0.2, 0, 1));
      lerp3(c, c, EDGE, sc[0] * 0.45);
      // dark face/lores around the beak base (t low = front)
      lerp3(c, c, [0.16, 0.15, 0.09], (1 - sstep(0.0, 0.25, t)) * 0.6);
      h = sc[1]; ro = 0.8;
    } else if (inR(R.tailTop, u, v) || inR(R.tailUnder, u, v)) {
      const top = inR(R.tailTop, u, v);
      [s, t] = loc(top ? R.tailTop : R.tailUnder, u, v);
      const fx = s * 6, ff = fx - Math.floor(fx);
      if (top) {
        lerp3(c, OLIVE, [0.30, 0.38, 0.22], t);
        lerp3(c, c, EDGE, sstep(0.72, 0.82, t) * (1 - sstep(0.92, 0.98, t)) * 0.9); // black subterminal band
        lerp3(c, c, [0.42, 0.42, 0.24], sstep(0.93, 1, t) * 0.6);
      } else {
        lerp3(c, ORANGE, OCHRE, t);
        const bar = sstep(0.6, 0.85, Math.sin(t * 22) * 0.5 + 0.5);
        lerp3(c, c, [0.24, 0.16, 0.07], bar * 0.6);
      }
      const shaft = Math.exp(-((ff - 0.5) ** 2) * 900);
      lerp3(c, c, EDGE, (sstep(0.92, 1, ff) + 1 - sstep(0, 0.08, ff)) * 0.5);
      c[0] += shaft * 0.04; c[1] += shaft * 0.04;
      h = 0.6 + shaft * 0.3 - Math.abs(ff - 0.5) * 0.3; ro = 0.72;
    } else if (inR(R.beak, u, v)) {
      [s, t] = loc(R.beak, u, v);
      const g = 0.24 + n1 * 0.06 + t * 0.06;             // dark slate grey, worn paler near the tip
      c[0] = g; c[1] = g * 1.02; c[2] = g * 1.06;
      h = 0.5 + n1 * 0.3; ro = 0.42 + n1 * 0.1;
    } else if (inR(R.leg, u, v)) {
      [s, t] = loc(R.leg, u, v);
      const sq = Math.abs(Math.sin(t * 60)) ** 0.3;          // scutes
      const g = 0.30 + n1 * 0.05; c[0] = g * 0.95; c[1] = g * 0.96; c[2] = g;
      h = 0.4 + sq * 0.3; ro = 0.6;
    } else if (inR(R.eye, u, v)) {
      [s, t] = loc(R.eye, u, v);
      const d = Math.hypot(s - 0.5, t - 0.5);
      const iris = 1 - sstep(0.3, 0.36, d), pupil = 1 - sstep(0.14, 0.18, d);
      c[0] = 0.04 + iris * 0.12; c[1] = 0.035 + iris * 0.07; c[2] = 0.03 + iris * 0.03;
      lerp3(c, c, [0.01, 0.01, 0.01], pupil);
      lerp3(c, c, [0.30, 0.30, 0.27], sstep(0.36, 0.44, d) * 0.6);  // pale bare eye-ring
      // painted catchlight (a small window highlight) so the eye reads alive even in flat shade
      const hl = 1 - sstep(0.035, 0.06, Math.hypot(s - 0.4, t - 0.62));
      lerp3(c, c, [0.85, 0.85, 0.82], hl * 0.85);
      h = 0.5; ro = 0.06 + sstep(0.36, 0.44, d) * 0.6;
    } else { c[0] = OLIVE[0]; c[1] = OLIVE[1]; c[2] = OLIVE[2]; }
    // fine barb grain everywhere
    const grain = (vnoise2(u * N * 0.7, v * N * 0.11, 21) - 0.5) * 0.05;
    const o = (j * N + i) * 4;
    alb[o] = clamp((c[0] + grain) * 255, 0, 255); alb[o + 1] = clamp((c[1] + grain) * 255, 0, 255); alb[o + 2] = clamp((c[2] + grain * 0.7) * 255, 0, 255); alb[o + 3] = 255;
    rough[o] = 255; rough[o + 1] = clamp(ro * 255, 0, 255); rough[o + 2] = 0; rough[o + 3] = 255;
    hgt[j * N + i] = h + grain * 2;
  }
  // tangent-space normals from the height field (feather overlaps, shafts)
  const nrm = new Uint8Array(N * N * 4), K = 1.0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const hx = hgt[j * N + Math.min(N - 1, i + 1)] - hgt[j * N + Math.max(0, i - 1)];
    const hy = hgt[Math.min(N - 1, j + 1) * N + i] - hgt[Math.max(0, j - 1) * N + i];
    let nx = -hx * K, ny = -hy * K, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const o = (j * N + i) * 4;
    nrm[o] = (nx * 0.5 + 0.5) * 255; nrm[o + 1] = (ny * 0.5 + 0.5) * 255; nrm[o + 2] = (nz * 0.5 + 0.5) * 255; nrm[o + 3] = 255;
  }
  const mk = (data, srgb) => {
    const t = new DataTexture(data, N, N, RGBAFormat, UnsignedByteType);
    t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter; t.generateMipmaps = true;
    t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  };
  return { map: mk(alb, true), roughnessMap: mk(rough, false), normalMap: mk(nrm, false) };
}
