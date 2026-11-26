// keaplayer/tex — the view-model beak atlas (baked once): dark grey-brown keratin with growth striations, a worn
// paler culmen, cutting edge and hook tip; the bare grey cere with two nostrils; a dark tongue / mouth lining.
// The feathers (face, wings) reuse the v1 kea plumage atlas (modules/kea/tex.js) so the player matches the flock.
// Layout (u right, v up):  upper mandible [0,0 .5,1]  lower mandible [.5,0 .75,1]  cere [.75,0 1,.5]  mouth [.75,.5 1,1]
//   in every beak region: s (u) = around the section (0/1 = culmen ridge, .5 = cutting edge), t (v) = base → tip.
import { DataTexture, RGBAFormat, UnsignedByteType, SRGBColorSpace, NoColorSpace, LinearMipmapLinearFilter, LinearFilter, ClampToEdgeWrapping } from 'three';
import { vnoise2, fbm2, clamp, mix, sstep } from '../../cookbook/geo/noise.js';

export const BR = { upper: [0, 0, 0.5, 1], lower: [0.5, 0, 0.75, 1], cere: [0.75, 0, 1, 0.5], mouth: [0.75, 0.5, 1, 1] };
export function buv(r, s, t, inset = 0.02) {
  const w = r[2] - r[0], h = r[3] - r[1];
  return [r[0] + w * (inset + s * (1 - 2 * inset)), r[1] + h * (inset + t * (1 - 2 * inset))];
}

// sRGB 0..1. Kea horn: dark grey to grey-brown keratin (the olive is the feathers, not the beak), a worn paler culmen
// and tip, a fleshy grey cere, a dark grey-pink mouth
const KER = [0.12, 0.115, 0.11], KER_HI = [0.30, 0.285, 0.26], TIP = [0.47, 0.44, 0.40], CERE = [0.29, 0.27, 0.26], MOUTH = [0.25, 0.15, 0.15];

export function bakeBeakTextures(N = 256) {
  const alb = new Uint8Array(N * N * 4), rough = new Uint8Array(N * N * 4), hgt = new Float32Array(N * N);
  const c = [0, 0, 0];
  const set = (a) => { c[0] = a[0]; c[1] = a[1]; c[2] = a[2]; };
  const lerp = (a, t) => { c[0] = mix(c[0], a[0], t); c[1] = mix(c[1], a[1], t); c[2] = mix(c[2], a[2], t); };
  const inR = (r, u, v) => u >= r[0] && u < r[2] && v >= r[1] && v < r[3];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N, v = (j + 0.5) / N;
    let h = 0.5, ro = 0.45;
    const n1 = fbm2(u * 30, v * 30, 3, 5);
    if (inR(BR.upper, u, v) || inR(BR.lower, u, v)) {
      const up = inR(BR.upper, u, v), r = up ? BR.upper : BR.lower;
      const s = (u - r[0]) / (r[2] - r[0]), t = (v - r[1]) / (r[3] - r[1]);
      const ridge = Math.cos(s * Math.PI * 2);                 // 1 on the culmen, -1 on the cutting edge
      // growth striations: fine keratin lines running base → tip, wavering, denser toward the edge
      const sw = s + 0.012 * Math.sin(t * 17 + s * 9) + 0.01 * n1;
      const stri = Math.pow(Math.abs(Math.sin(sw * Math.PI * (up ? 46 : 30))), 3) * (0.6 + 0.4 * vnoise2(s * 60, t * 6, 3));
      set(KER);
      lerp(KER_HI, sstep(0.6, 0.98, ridge) * (0.45 + 0.3 * t) + sstep(-0.75, -0.97, ridge) * 0.55);   // worn culmen + tomium
      lerp(TIP, sstep(0.8, 0.99, t) * 0.75);                                                     // worn, paler hook point
      lerp([0.14, 0.13, 0.125], (1 - sstep(0.0, 0.15, t)) * 0.5);                               // darker new keratin at the base
      const lv = 0.94 + n1 * 0.12 - stri * 0.03; c[0] *= lv; c[1] *= lv; c[2] *= lv;
      // scuffs and chips from prying rubber off campervans
      const scuff = sstep(0.72, 0.86, vnoise2(s * 18, t * 26, 9)) * sstep(0.1, 0.5, t);
      lerp([0.30, 0.29, 0.27], scuff * 0.3);
      h = 0.5 - stri * 0.08 + n1 * 0.1 - scuff * 0.15;
      ro = 0.68 + stri * 0.08 - sstep(0.85, 1, t) * 0.12 + scuff * 0.15 + n1 * 0.06;
    } else if (inR(BR.cere, u, v)) {
      const r = BR.cere, s = (u - r[0]) / (r[2] - r[0]), t = (v - r[1]) / (r[3] - r[1]);
      set(CERE);
      // soft wrinkled skin, two nostrils on top either side of the ridge (s ≈ .08 / .92), toward the front (t ≈ .55)
      const wr = Math.sin(t * 40 + n1 * 6) * 0.5 + 0.5;
      const lv = 0.86 + n1 * 0.22 + wr * 0.06; c[0] *= lv; c[1] *= lv; c[2] *= lv;
      let nos = 0;
      for (const sx of [0.075, 0.925]) { const d = Math.hypot((s - sx) * 4.5, (t - 0.6) * 1.6); nos = Math.max(nos, 1 - sstep(0.05, 0.09, d)); }
      const rim = (() => { let m = 0; for (const sx of [0.075, 0.925]) { const d = Math.hypot((s - sx) * 4.5, (t - 0.6) * 1.6); m = Math.max(m, sstep(0.05, 0.09, d) * (1 - sstep(0.09, 0.16, d))); } return m; })();
      lerp([0.46, 0.45, 0.42], rim * 0.5);
      lerp([0.02, 0.02, 0.02], nos);
      h = 0.5 + wr * 0.12 + n1 * 0.2 + rim * 0.25 - nos * 0.6; ro = 0.62 + n1 * 0.1 - nos * 0.2;
    } else {
      const r = BR.mouth, s = (u - r[0]) / (r[2] - r[0]), t = (v - r[1]) / (r[3] - r[1]);
      set(MOUTH);
      const lv = 0.8 + n1 * 0.3 + 0.1 * Math.sin(s * 40); c[0] *= lv; c[1] *= lv; c[2] *= lv;
      lerp([0.12, 0.11, 0.11], sstep(0.6, 1, t) * 0.6);
      h = 0.5 + n1 * 0.3; ro = 0.3 + n1 * 0.1;
    }
    const o = (j * N + i) * 4;
    alb[o] = clamp(c[0] * 255, 0, 255); alb[o + 1] = clamp(c[1] * 255, 0, 255); alb[o + 2] = clamp(c[2] * 255, 0, 255); alb[o + 3] = 255;
    rough[o] = 255; rough[o + 1] = clamp(ro * 255, 0, 255); rough[o + 2] = 0; rough[o + 3] = 255;
    hgt[j * N + i] = h;
  }
  const nrm = new Uint8Array(N * N * 4), K = 2.0;
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
    t.wrapS = t.wrapT = ClampToEdgeWrapping; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  };
  return { map: mk(alb, true), roughnessMap: mk(rough, false), normalMap: mk(nrm, false) };
}
