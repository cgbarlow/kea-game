// audio/selftest — meters every buffer this game actually plays (bespoke recipes, score stems + stings, the cookbook
// presets we borrow, the outdoor IR) with cookbook/audio/meter.js analyse(). Pass = peak <= -1 dBFS, no NaN/Inf,
// not silent (RMS > -60 dBFS), no clipped samples. Headless-safe (no AudioContext).
//   installSelfTest() → window.__audioSelfTest() → { pass, count, failed[], ms, rows[] }
import { runJobs } from '../../cookbook/audio/synth.js';
import { presetJobs } from '../../cookbook/audio/sfx.js';
import { renderIR } from '../../cookbook/audio/reverb.js';
import { analyse } from '../../cookbook/audio/meter.js';
import { recipeJobs } from './recipes.js';
import { scoreJobs } from './score.js';

export const COOKBOOK_SFX = ['whoosh', 'step_concrete', 'ui_click'];

export async function selfTest({ sr = 32000, verbose = true } = {}) {
  const t0 = performance.now();
  const jobs = [
    ...recipeJobs({ sr }).map((jb) => ({ name: `${jb.name}#${jb.variant}`, gen: jb.gen })),
    ...scoreJobs({ sr: 22050 }).map((jb) => ({ name: 'music.' + jb.name, gen: jb.gen })),
    ...presetJobs({ sr, only: COOKBOOK_SFX }).map((jb) => ({ name: `cookbook.${jb.name}#${jb.variant}`, gen: jb.gen })),
    { name: 'ir_outdoor', gen: renderIR('outdoor', { sr }), ir: true },
  ];
  const rows = [];
  for (const jb of jobs) {
    const a = performance.now();
    const [res] = await runJobs([jb.gen], { budgetMs: 50 });
    const m = analyse(res);
    const pass = m.nan === 0 && !m.silent && (jb.ir || (m.peakDb <= -1 && m.clip === 0));
    rows.push({ name: jb.name, ...m, ms: Math.round(performance.now() - a), pass });
  }
  const out = { pass: rows.every((r) => r.pass), count: rows.length, failed: rows.filter((r) => !r.pass).map((r) => r.name), ms: Math.round(performance.now() - t0), rows };
  if (verbose && typeof console !== 'undefined' && console.table) console.table(rows);
  return out;
}

export function installSelfTest() { if (typeof window !== 'undefined') window.__audioSelfTest = (o) => selfTest(o); }
