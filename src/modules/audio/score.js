// audio/score — the sparse shift music: a slow suspended pad + a little bass from cookbook/audio/music.js stems,
// plus a lonely plucked-string line of our own (Karplus-Strong) that leaves most bars empty, and two end stings.
//   scoreJobs({sr}) → [{ name, gen }]   (stems: pad, bass, pluck; stings: sting_win, sting_lose)
//   SONG, LOOP (seconds)
import { render, midiToHz } from '../../cookbook/audio/synth.js';
import { stemJobs, parseChord } from '../../cookbook/audio/music.js';

export const SONG = { bpm: 66, beatsPerChord: 8, chords: ['Dsus2', 'Bbmaj7', 'Fadd9', 'Csus2'] };
const SPB = 60 / SONG.bpm, CD = SONG.beatsPerChord * SPB;
export const LOOP = SONG.chords.length * CD;
export const MUSIC_STEMS = ['pad', 'bass'];

// one plucked string (Karplus-Strong with a one-pole damped loop) mixed into out at t0
function* pluck(out, sr, t0, f, dur, amp, pan, rng, bright = 0.5) {
  const N = Math.max(2, Math.round(sr / f)), buf = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) { lp += (rng() * 2 - 1 - lp) * bright; buf[i] = lp; }
  const gl = Math.cos((pan + 1) * Math.PI / 4) * amp, gr = Math.sin((pan + 1) * Math.PI / 4) * amp;
  const i0 = Math.round(t0 * sr), n = Math.round(dur * sr), len = out.L.length;
  let k = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const cur = buf[k], nx = 0.5 * (cur + buf[(k + 1) % N]) * 0.9965;
    buf[k] = nx; k = (k + 1) % N;
    const fade = i > n - 400 ? (n - i) / 400 : 1, v = (cur - prev * 0.2) * fade; prev = cur;
    const o = (i0 + i) % len;                           // wrap into the head: the stem loops seamlessly
    out.L[o] += v * gl; out.R[o] += v * gr;
    if ((i & 4095) === 4095) yield;
  }
}

// melody: beat index within a chord (0..7) → scale degree offset into the chord tones; most beats rest
const LINE = [[0, 2, 0], [3, 1, 1], [6, 0, 0], [2, 3, 1], [5, 2, 0], [0, 1, 2], [4, 0, 1]];
function pluckStem() {
  return { dur: LOOP, peakDb: -10,
    layers: [{ type: 'custom', gen: function* (out, i0, n, sr, r) {
      for (let c = 0; c < SONG.chords.length; c++) {
        const ch = parseChord(SONG.chords[c]);
        for (let b = 0; b < 4; b++) {
          if ((b + c) % 3 === 1) continue;                  // leave holes: sparse, never a pattern you can hum
          const [beat, deg, oct] = LINE[(b + c * 2) % LINE.length];
          const iv = ch.iv[deg % ch.iv.length], m = 62 + ((ch.root + iv) % 12) + 12 * (oct > 1 ? 1 : 0);
          const t = c * CD + beat * SPB + b * 0.002;
          yield* pluck(out, sr, t, midiToHz(m), 3.2, 0.55 + 0.1 * r(), (r() - 0.5) * 0.6, r, 0.45 + 0.2 * r());
        }
      }
    } }],
    fx: [{ type: 'lp', f: 3800 }, { type: 'echo', time: SPB * 1.5, fb: 0.28, mix: 0.22, lp: 2200 }, { type: 'width', amt: 0.3 }] };
}

function sting(win) {
  return { dur: 4.5, peakDb: -6,
    layers: [{ type: 'custom', gen: function* (out, i0, n, sr, r) {
      const notes = win ? [[0, 62], [0.24, 66], [0.48, 69], [0.72, 74], [0.74, 76]] : [[0, 57], [0.55, 56], [1.1, 50]];
      for (const [t, m] of notes) yield* pluck(out, sr, t, midiToHz(m), 3.5, 0.7, (r() - 0.5) * 0.4, r, win ? 0.55 : 0.35);
    } },
    { type: 'osc', wave: 'saw', voices: 3, detune: 12, freq: midiToHz(win ? 50 : 38), env: { a: 0.6, h: 0.8, d: 2.4 }, amp: 0.25, filters: [{ type: 'lp', f: 700 }] }],
    fx: [{ type: 'echo', time: 0.36, fb: 0.25, mix: 0.2, lp: 2000 }, { type: 'width', amt: 0.4 }] };
}

export function scoreJobs({ sr = 22050 } = {}) {
  const stems = stemJobs(SONG, { sr }).filter((jb) => MUSIC_STEMS.includes(jb.name));
  return [
    ...stems.map((jb) => ({ name: jb.name, gen: jb.gen, stem: true })),
    { name: 'pluck', stem: true, gen: render(pluckStem(), { sr, seed: 11, name: 'music_pluck' }) },
    { name: 'sting_win', gen: render(sting(true), { sr, seed: 12, name: 'sting_win' }) },
    { name: 'sting_lose', gen: render(sting(false), { sr, seed: 13, name: 'sting_lose' }) },
  ];
}
