// audio/recipes — every bespoke sound of the car park, as synth.js recipes (cookbook/audio/synth.js format).
// RECIPES: name -> { variants, make(rnd, v) → recipe }. Loudness lives in peakDb (all <= -2 dBFS; meter gate is -1).
//   blower_idle / blower_rev / blower_turbo   two-stroke loops ('wrap', whole firing cycles → seamless at any rate)
//   airflow                                    the air column leaving the nozzle (noise bed, crossfade loop)
//   kea_arrive / kea_offended / kea_alarm / kea_chatter / kea_peck / kea_flap
//   possum_hiss / possum_chatter / possum_skid / trap_thunk
//   phone_alert / quake_onset / quake_rumble / all_clear / strike_stamp / blower_cough / alpine_wind
import { render } from '../../cookbook/audio/synth.js';

const TAU = Math.PI * 2;
const j = (rnd, a, b) => a + (b - a) * rnd();

// ---------- two-stroke single cylinder: one exhaust pulse per revolution ----------
// Each pulse = expansion-chamber ring (two resonances) + a short noise burst (port blow-down). At idle the engine
// "four-strokes" (irregular weak cycles = the ring-ding-ding); at full throttle the pulses are even and hard.
function twoStroke(rnd, o) {
  const { ff, cycles } = o, dur = cycles / ff;
  return {
    dur, loop: 'wrap', tail: 0.06, peakDb: o.peakDb ?? -5,
    layers: [
      { type: 'custom', gen: function* (out, i0, n, sr, r) {
        const per = sr / ff, len = Math.floor(per * 1.15);
        const kd = o.decay, kn = o.decay * 2.6, w1 = TAU * o.ring / sr, w2 = TAU * o.ring2 / sr, w3 = TAU * o.ring * 2.71 / sr;
        for (let c = 0; c < cycles; c++) {
          let a = 1 - o.jitter * r();
          if (r() < o.misfire) a *= 0.28 + 0.2 * r();               // four-stroking / lean miss
          const s0 = Math.round(c * per + (r() - 0.5) * o.timing * per);
          const ph = r() * 0.6;
          for (let i = 0; i < len; i++) {
            const k = s0 + i; if (k < 0 || k >= out.L.length) continue;
            const t = i / sr, e = Math.exp(-t * kd), en = Math.exp(-t * kn);
            const v = a * (e * (Math.sin(w1 * i + ph) + 0.55 * Math.sin(w2 * i + 1.1) + 0.25 * Math.sin(w3 * i)) + en * (r() * 2 - 1) * o.blow);
            out.L[k] += v; out.R[k] += v * 0.96;
          }
          if (c % 12 === 11) yield;
        }
      } },
      // impeller blade-pass whine (12 blades) + its 2nd harmonic: whole cycles in dur
      { type: 'osc', wave: 'sine', freq: ff * 12, env: { a: 0.001, s: 1, r: 0.001 }, amp: o.whine, am: { f: ff / 2, depth: 0.25 } },
      { type: 'osc', wave: 'tri', freq: ff * 24, env: { a: 0.001, s: 1, r: 0.001 }, amp: o.whine * 0.35, pan: 0.2 },
      // intake hiss
      { type: 'noise', color: 'pink', stereo: true, env: { a: 0.001, s: 1, r: 0.001 }, filters: [{ type: 'bp', f: o.hissF, q: 0.7 }], amp: o.hiss, am: { f: ff, depth: 0.5 } },
    ],
    fx: [{ type: 'hp', f: 45 }, { type: 'peak', f: ff * 2, q: 2.5, gain: 5 }, { type: 'peak', f: o.ring * 1.6, q: 1.4, gain: 4 }, { type: 'drive', k: o.drive },
      { type: 'lp', f: o.lp, q: 0.8 }, { type: 'width', amt: 0.15 }],
  };
}

// ---------- kea: a nasal, raspy two-part "keee-aa" (syrinx = two slightly detuned voices) ----------
function keaCall(rnd, f, env, dur, o = {}) {
  const s = j(rnd, 0.93, 1.07);
  const fq = (t) => f(t) * s * (1 + 0.012 * Math.sin(t * TAU * (o.vib ?? 23)));
  return {
    dur, peakDb: o.peakDb ?? -4,
    layers: [
      { type: 'osc', wave: 'saw', freq: fq, env, amp: 0.7, am: { f: o.rough ?? 74, depth: o.roughD ?? 0.32 },
        filters: [{ type: 'hp', f: 900 }, { type: 'peak', f: o.formant || 3100 * s, q: 1.6, gain: 9 }, { type: 'peak', f: 5200, q: 2, gain: 4 }, { type: 'lp', f: 8500 }], drive: o.drive ?? 1.8 },
      { type: 'osc', wave: 'tri', freq: (t) => fq(t) * 1.034, env, amp: 0.35, pan: 0.1, filters: [{ type: 'hp', f: 1200 }] },
      { type: 'noise', color: 'white', env, filters: [{ type: 'bp', f: 3400, q: 1.2 }], amp: o.breath ?? 0.12 },
    ],
    fx: [{ type: 'hp', f: 750, q: 0.7 }, { type: 'echo', time: j(rnd, 0.21, 0.27), fb: 0.18, mix: 0.12, lp: 3500 }], // hp: drive intermod (AM sidebands) left a 70 Hz hum under the call
  };
}

function grunts(rnd, n, t0, gap, o) { // possum chatter: guttural rasping coughs
  const L = [];
  let t = t0;
  for (let i = 0; i < n; i++) {
    const d = j(rnd, 0.035, 0.07), f0 = j(rnd, o.f0 * 0.8, o.f0 * 1.25);
    L.push({ type: 'osc', wave: 'saw', voices: 2, detune: 30, start: t, dur: d * 1.6, freq: { from: f0 * 1.2, to: f0 * 0.8, time: d }, env: { a: 0.003, d: d }, amp: j(rnd, 0.6, 1),
      filters: [{ type: 'peak', f: j(rnd, 650, 900), q: 3, gain: 12 }, { type: 'peak', f: 1700, q: 3, gain: 6 }, { type: 'lp', f: 3200 }], drive: 3 });
    L.push({ type: 'noise', color: 'pink', start: t, dur: d * 1.4, env: { a: 0.002, d: d * 0.9 }, filters: [{ type: 'bp', f: j(rnd, 1200, 2400), q: 1.5 }], amp: 0.5 });
    t += d + gap * j(rnd, 0.5, 1.6);
  }
  return L;
}

export const RECIPES = {
  blower_idle: { variants: 1, make: (r) => twoStroke(r, { ff: 52, cycles: 104, ring: 640, ring2: 1480, decay: 85, misfire: 0.27, jitter: 0.2, timing: 0.05, blow: 0.35,
    whine: 0.03, hiss: 0.05, hissF: 1800, drive: 1.8, lp: 3200, peakDb: -7 }) },
  blower_rev: { variants: 1, make: (r) => twoStroke(r, { ff: 110, cycles: 110, ring: 900, ring2: 2150, decay: 140, misfire: 0.04, jitter: 0.12, timing: 0.025, blow: 0.6,
    whine: 0.09, hiss: 0.22, hissF: 2600, drive: 3, lp: 6500, peakDb: -4 }) },
  blower_turbo: { variants: 1, make: (r) => twoStroke(r, { ff: 124, cycles: 124, ring: 1010, ring2: 2400, decay: 165, misfire: 0.015, jitter: 0.08, timing: 0.02, blow: 0.8,
    whine: 0.16, hiss: 0.3, hissF: 3200, drive: 4.2, lp: 8000, peakDb: -3.5 }) },
  airflow: { variants: 1, make: () => ({
    dur: 4, loop: 1, peakDb: -6,
    layers: [
      { type: 'noise', color: 'pink', stereo: true, env: { a: 0.01, s: 1, r: 0.01 }, filters: [{ type: 'bp', f: (t) => 1100 + 180 * Math.sin(t * TAU * 1.25), q: 0.55 }], amp: 1, am: { f: 7, depth: 0.12 } },
      { type: 'noise', color: 'white', stereo: true, env: { a: 0.01, s: 1, r: 0.01 }, filters: [{ type: 'hp', f: 3500 }, { type: 'lp', f: 9000 }], amp: 0.22 },
      { type: 'noise', color: 'brown', stereo: true, env: { a: 0.01, s: 1, r: 0.01 }, filters: [{ type: 'lp', f: 220 }], amp: 0.5, am: { f: 3.5, depth: 0.3 } }, // tube buffet
    ],
    fx: [{ type: 'width', amt: 0.35 }],
  }) },
  blower_cough: { variants: 1, make: (r) => ({ // overheat: the engine sputters, bogs, then the cooling fins tick
    dur: 2.2, peakDb: -5,
    layers: [
      ...[0, 0.13, 0.22, 0.41, 0.52, 0.78].map((t, i) => ({ type: 'noise', color: 'pink', start: t + j(r, 0, 0.03), dur: 0.12, env: { a: 0.001, d: 0.07 },
        filters: [{ type: 'bp', f: j(r, 380, 700), q: 1.3 }], amp: 1.2 - i * 0.14, drive: 3 })),
      ...[0.05, 0.3, 0.62].map((t) => ({ type: 'osc', wave: 'saw', start: t, dur: 0.18, freq: { from: 70, to: 38, time: 0.16 }, env: { a: 0.002, d: 0.12 }, amp: 0.5, filters: [{ type: 'lp', f: 600 }], drive: 2 })),
      ...[1.0, 1.31, 1.55, 1.9].map((t) => ({ type: 'partials', start: t, dur: 0.25, freq: j(r, 3600, 4400), modes: [[1, 1, 0.12], [2.3, 0.4, 0.06]], env: { a: 0.0003, d: 0.1 }, amp: 0.22 })),
    ],
    fx: [{ type: 'hp', f: 40 }, { type: 'width', amt: 0.2 }],
  }) },

  // --- kea ---
  // "keee" (steady, nasal, ~2.6 kHz) → a fast 80 ms break → "aa" (lower, rougher, darker formant)
  kea_arrive: { variants: 3, make: (r) => keaCall(r, (t) => (t < 0.06 ? 1900 + t * 11000 : t < 0.32 ? 2560 + 500 * (t - 0.06) : t < 0.4 ? 2690 - (t - 0.32) * 12000 : 1730 - (t - 0.4) * 600),
    [[0, 0], [0.03, 0.85], [0.3, 1], [0.35, 0.35], [0.42, 1], [0.72, 0.6], [0.86, 0]], 0.95, { formant: (t) => (t < 0.34 ? 3300 : 2100) }) },
  kea_offended: { variants: 3, make: (r) => keaCall(r, (t) => { const u = t % 0.2; return t < 0.4 ? 2700 + u * 2500 - (u > 0.12 ? (u - 0.12) * 9000 : 0) : 2850 - (t - 0.4) * 1700; },
    [[0, 0], [0.02, 0.9], [0.13, 0.9], [0.17, 0.15], [0.22, 1], [0.33, 0.9], [0.37, 0.15], [0.42, 1], [0.85, 0.6], [1.05, 0]], 1.15, { drive: 2.8, rough: 92, roughD: 0.5, peakDb: -3.5, breath: 0.2 }) },
  kea_alarm: { variants: 3, make: (r) => { const w = j(r, 30, 44); return keaCall(r, (t) => (3000 - t * 1400) * (1 + 0.16 * Math.sin(t * TAU * w * 0.25)), [[0, 0], [0.015, 1], [0.45, 0.8], [0.7, 0]], 0.75,
    { drive: 3.2, rough: 110, roughD: 0.55, vib: 31, peakDb: -3.2, breath: 0.3 }); } },
  kea_chatter: { variants: 3, make: (r) => {
    const L = [];
    let t = 0;
    for (let i = 0; i < 4; i++) {
      const d = j(r, 0.07, 0.13), f0 = j(r, 1700, 2600), up = r() < 0.5;
      L.push({ type: 'osc', wave: 'saw', start: t, dur: d, freq: { from: up ? f0 * 0.8 : f0 * 1.15, to: up ? f0 * 1.15 : f0 * 0.8, time: d, curve: 'lin' }, env: { a: 0.008, h: d * 0.4, d: d * 0.5 }, amp: j(r, 0.5, 1),
        filters: [{ type: 'hp', f: 1000 }, { type: 'peak', f: 3000, q: 2, gain: 7 }, { type: 'lp', f: 7000 }], am: { f: 60, depth: 0.25 } });
      t += d + j(r, 0.03, 0.11);
    }
    return { dur: t + 0.15, peakDb: -11, layers: L };
  } },
  kea_peck: { variants: 3, make: (r) => ({ // beak on rubber seal / wiper / glass: two dry ticks
    dur: 0.22, peakDb: -12,
    layers: [0, j(r, 0.07, 0.1)].flatMap((t, i) => [
      { type: 'noise', color: 'white', start: t, dur: 0.012, env: { a: 0.0002, d: 0.006 }, filters: [{ type: 'bp', f: j(r, 2800, 4200), q: 2.5 }], amp: 1 - i * 0.3 },
      { type: 'partials', start: t, dur: 0.08, freq: j(r, 1500, 2300), modes: [[1, 1, 0.04], [2.6, 0.5, 0.025], [4.1, 0.25, 0.015]], env: { a: 0.0002, d: 0.04 }, amp: 0.4 },
    ]),
  }) },
  kea_flap: { variants: 2, make: (r) => ({
    dur: 0.7, peakDb: -10,
    layers: Array.from({ length: 5 }, (_, i) => ({ type: 'noise', color: 'pink', start: i * j(r, 0.1, 0.13), dur: 0.11, env: { a: 0.02, d: 0.06 },
      filters: [{ type: 'bp', f: j(r, 500, 900), q: 1.1 }], amp: 1 - i * 0.15, stereo: true })),
    fx: [{ type: 'width', amt: 0.3 }],
  }) },

  // --- possums ---
  possum_hiss: { variants: 2, make: (r) => ({
    dur: 1.2, peakDb: -6,
    layers: [
      { type: 'noise', color: 'white', env: { a: 0.04, h: 0.35, d: 0.6 }, filters: [{ type: 'bp', f: j(r, 3600, 4600), q: 0.9 }, { type: 'lowshelf', f: 1500, gain: -6 }], amp: 1, am: { f: j(r, 14, 19), depth: 0.45 } },
      { type: 'noise', color: 'pink', env: { a: 0.03, h: 0.3, d: 0.5 }, filters: [{ type: 'bp', f: 1300, q: 1.2 }], amp: 0.5 },
      { type: 'osc', wave: 'saw', voices: 3, detune: 40, freq: (t) => j(r, 85, 105) + 15 * Math.sin(t * 29), env: { a: 0.08, h: 0.3, d: 0.5 }, amp: 0.35,
        filters: [{ type: 'peak', f: 520, q: 3, gain: 12 }, { type: 'lp', f: 1600 }], drive: 3.5, am: { f: 23, depth: 0.6 } }, // throat growl
    ],
  }) },
  possum_chatter: { variants: 3, make: (r) => ({ dur: 1.0, peakDb: -7, layers: grunts(r, 7 + ((r() * 4) | 0), 0, 0.05, { f0: 170 }) }) },
  possum_skid: { variants: 2, make: (r) => ({ // claws scrabbling on wet asphalt, then the slide and spray
    dur: 1.0, peakDb: -8,
    layers: [
      { type: 'crackle', dur: 0.45, rate: { from: 120, to: 40, time: 0.4 }, grain: 0.003, env: { a: 0.005, d: 0.4 }, filters: [{ type: 'bp', f: j(r, 2200, 3200), q: 1.1 }], amp: 0.9 },
      { type: 'noise', color: 'pink', stereo: true, start: 0.1, dur: 0.85, env: { a: 0.05, h: 0.2, d: 0.5 }, filters: [{ type: 'hp', f: 900 }, { type: 'bp', f: { from: 2400, to: 1300, time: 0.8 }, q: 0.6 }], amp: 0.8 },
      { type: 'crackle', start: 0.12, dur: 0.8, rate: 700, grain: 0.0012, env: { a: 0.05, d: 0.6 }, filters: [{ type: 'hp', f: 3000 }], amp: 0.35 }, // spray droplets
    ],
    fx: [{ type: 'width', amt: 0.3 }],
  }) },
  trap_thunk: { variants: 2, make: (r) => ({ // DOC 200 box: lid thump on timber + mesh rattle + the latch
    dur: 0.9, peakDb: -3,
    layers: [
      { type: 'noise', color: 'pink', dur: 0.12, env: { a: 0.0008, d: 0.07 }, filters: [{ type: 'lp', f: 380 }], amp: 1.6, drive: 2 },
      { type: 'osc', wave: 'sine', freq: { from: 120, to: 62, time: 0.08 }, dur: 0.2, env: { a: 0.001, d: 0.13 }, amp: 1.1 },
      { type: 'partials', freq: j(r, 190, 240), modes: [[1, 1, 0.14], [2.32, 0.6, 0.09], [3.9, 0.35, 0.06], [5.45, 0.2, 0.04]], inharm: 0.05, env: { a: 0.0004, d: 0.12 }, amp: 0.7 },
      { type: 'crackle', start: 0.01, dur: 0.25, rate: { from: 900, to: 60, time: 0.22 }, grain: 0.001, env: { a: 0.002, d: 0.2 }, filters: [{ type: 'bp', f: 4600, q: 1.2 }], amp: 0.35 },
      { type: 'partials', start: 0.004, dur: 0.3, freq: j(r, 2900, 3400), modes: [[1, 1, 0.18], [1.47, 0.6, 0.12], [2.09, 0.4, 0.08]], env: { a: 0.0003, d: 0.15 }, amp: 0.12 },
      { type: 'noise', color: 'white', start: 0.16, dur: 0.02, env: { a: 0.0002, d: 0.01 }, filters: [{ type: 'bp', f: 3000, q: 4 }], amp: 0.5 }, // latch
    ],
  }) },

  // --- aftershock ---
  phone_alert: { variants: 1, make: () => {
    // Emergency Mobile Alert style: two-tone 853 + 960 Hz through a phone speaker, cadence on 1.0 / 0.5 / 0.5, plus vibrate
    const on = [[0, 1.0], [1.2, 1.7], [1.85, 2.35]];
    const gate = (t) => { for (const [a, b] of on) if (t >= a && t < b) return Math.min(1, (t - a) / 0.006, (b - t) / 0.006); return 0; };
    const buzz = (t) => ((t > 0.05 && t < 0.55) || (t > 1.25 && t < 1.75) ? 1 : 0);
    return { dur: 2.9, peakDb: -3,
      layers: [
        { type: 'osc', wave: 'tri', freq: 853, env: gate, amp: 0.6 }, { type: 'osc', wave: 'tri', freq: 960, env: gate, amp: 0.6 },
        { type: 'osc', wave: 'square', freq: 168, env: buzz, amp: 0.12, filters: [{ type: 'lp', f: 420 }], am: { f: 21, depth: 0.4 } },
      ],
      fx: [{ type: 'hp', f: 420 }, { type: 'peak', f: 2400, q: 1.5, gain: 4 }, { type: 'drive', k: 1.4 }, { type: 'lp', f: 5200 }] };
  } },
  quake_onset: { variants: 2, make: (r) => ({
    dur: 3.2, peakDb: -2, sr: 22050,
    layers: [
      { type: 'osc', wave: 'sine', freq: { from: 46, to: 24, time: 1.2 }, dur: 2.6, env: { a: 0.06, d: 2.2 }, amp: 1.2, drive: 1.4 },
      { type: 'noise', color: 'brown', stereo: true, env: { a: 0.35, h: 0.4, d: 2.4 }, filters: [{ type: 'lp', f: { from: 260, to: 90, time: 2.5 } }, { type: 'hp', f: 18 }], amp: 2.2, drive: 1.6 },
      { type: 'crackle', start: 0.3, dur: 2.4, rate: { from: 30, to: 140, time: 1 }, grain: 0.004, env: { a: 0.3, d: 2 }, filters: [{ type: 'bp', f: j(r, 1400, 2000), q: 0.8 }], amp: 0.35 }, // signage + bin lids
      { type: 'osc', wave: 'saw', start: 0.5, dur: 2.2, freq: (t) => 58 + 6 * Math.sin(t * 5), env: { a: 0.4, d: 1.6 }, amp: 0.2, filters: [{ type: 'bp', f: 240, q: 4 }] },  // shelter creak
    ],
    fx: [{ type: 'width', amt: 0.6 }],
  }) },
  quake_rumble: { variants: 1, make: () => ({
    dur: 6, loop: 1.5, peakDb: -4, sr: 22050,
    layers: [
      { type: 'noise', color: 'brown', stereo: true, env: { a: 0.01, s: 1, r: 0.01 }, filters: [{ type: 'lp', f: 110 }, { type: 'hp', f: 18 }], amp: 2, am: { f: 2.5, depth: 0.35 } },
      { type: 'osc', wave: 'sine', freq: 31, env: { a: 0.01, s: 1, r: 0.01 }, amp: 0.4, am: { f: 1.5, depth: 0.5 } },
      { type: 'crackle', env: { a: 0.01, s: 1, r: 0.01 }, rate: (t) => 90 + 60 * Math.sin(t * TAU / 3), grain: 0.003, filters: [{ type: 'bp', f: 2100, q: 0.9 }], amp: 0.3, pan: -0.3 },
      { type: 'crackle', env: { a: 0.01, s: 1, r: 0.01 }, rate: (t) => 60 + 50 * Math.sin(t * TAU / 2 + 1), grain: 0.006, filters: [{ type: 'bp', f: 900, q: 1.2 }], amp: 0.3, pan: 0.4 },
    ],
    fx: [{ type: 'width', amt: 0.5 }],
  }) },
  all_clear: { variants: 1, make: () => ({ // the PA "bing-bong" of an institution that has done its job
    dur: 1.6, peakDb: -9,
    layers: [[784, 0], [622.3, 0.32]].map(([f, t]) => ({ type: 'osc', wave: 'sine', freq: f, start: t, dur: 1.25, fm: { ratio: 2, index: { from: 1.2, to: 0.05, time: 0.5 } }, env: { a: 0.004, d: 1.1 }, amp: 0.8 })),
    fx: [{ type: 'echo', time: 0.17, fb: 0.2, mix: 0.12, lp: 3000 }],
  }) },
  strike_stamp: { variants: 1, make: () => ({ // a strike is logged: rubber stamp on a clipboard
    dur: 0.55, peakDb: -5,
    layers: [
      { type: 'noise', color: 'pink', dur: 0.08, env: { a: 0.0006, d: 0.05 }, filters: [{ type: 'lp', f: 520 }], amp: 1.5, drive: 1.6 },
      { type: 'noise', color: 'white', dur: 0.03, env: { a: 0.0003, d: 0.018 }, filters: [{ type: 'bp', f: 2300, q: 1 }], amp: 0.6 },
      { type: 'partials', freq: 175, modes: [[1, 1, 0.1], [2.6, 0.4, 0.06], [4.4, 0.2, 0.04]], env: { a: 0.0005, d: 0.08 }, amp: 0.6 },
      { type: 'noise', color: 'white', start: 0.12, dur: 0.12, env: { a: 0.02, d: 0.07 }, filters: [{ type: 'bp', f: 3800, q: 0.8 }], amp: 0.15 }, // stamp lifts, paper
    ],
  }) },

  // --- ambience ---
  alpine_wind: { variants: 1, make: () => {
    const P = 12, gust = (t) => 0.5 + 0.3 * Math.sin(TAU * t / P) + 0.14 * Math.sin(TAU * 3 * t / P + 1.3) + 0.08 * Math.sin(TAU * 7 * t / P + 0.4);
    return { dur: P, loop: 3, peakDb: -9, sr: 22050,
      layers: [
        { type: 'noise', color: 'pink', stereo: true, env: (t) => 0.4 + 0.6 * gust(t), filters: [{ type: 'bp', f: (t) => 380 + 520 * gust(t), q: 0.7 }], amp: 1 },
        { type: 'noise', color: 'brown', stereo: true, env: (t) => 0.5 + 0.5 * gust(t), filters: [{ type: 'lp', f: 240 }], amp: 0.9 },
        { type: 'noise', color: 'white', env: (t) => Math.pow(Math.max(0, gust(t) - 0.45), 1.5) * 2.2, filters: [{ type: 'bp', f: (t) => 1150 + 380 * gust(t), q: 16 }], amp: 0.5, pan: -0.35 }, // whistle in the sign posts
        { type: 'noise', color: 'white', env: (t) => Math.pow(Math.max(0, gust(t + 5) - 0.5), 1.5) * 2.2, filters: [{ type: 'bp', f: (t) => 1720 + 260 * gust(t + 5), q: 20 }], amp: 0.3, pan: 0.45 },
        { type: 'crackle', env: (t) => 0.3 + gust(t), rate: 120, grain: 0.0015, filters: [{ type: 'hp', f: 2500 }, { type: 'lp', f: 7000 }], amp: 0.12, pan: 0.2 }, // tussock rustle
      ],
      fx: [{ type: 'width', amt: 0.6 }] };
  } },
};

const rnd = (s) => { let x = s >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };
// Expand into render jobs: [{ name, variant, gen }]
export function recipeJobs({ sr = 32000, seed = 3 } = {}) {
  const out = [];
  for (const name in RECIPES) {
    const p = RECIPES[name];
    for (let v = 0; v < p.variants; v++) {
      const s = seed * 977 + v * 6151 + name.length * 37 + name.charCodeAt(4);
      out.push({ name, variant: v, gen: render(p.make(rnd(s), v), { sr, seed: s, name: `${name}#${v}` }) });
    }
  }
  return out;
}
