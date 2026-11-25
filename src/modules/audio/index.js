// audio — mixer graph (suspended until the first gesture), synthesized banks rendered after ready (time-sliced),
// alpine ambience, the blower's two-stroke loop tracking blower.power, and event cues.
//   create(G, { blower }) → { mixer, music, play(name, o), setVolume(v), unlock(), update }
// Event cues: kea:land/blown/return, possum:raid/blown/trapped, game:alert (alert/shake/clear), game:strike, game:end.
import { createMixer } from '../../cookbook/audio/mixer.js';
import { buildBank } from '../../cookbook/audio/sfx.js';
import { buildMusic, createMusic, SONGS } from '../../cookbook/audio/music.js';

export function create(G, { blower } = {}) {
  const mixer = createMixer({ volume: 0.8 });
  const A = { mixer, music: null, engine: null, rumble: null };
  A.play = (name, o) => (mixer.ctx.state === 'running' && mixer.has(name) ? mixer.play(name, o) : null);
  A.setVolume = (v) => { mixer.master.gain.value = v; };
  A.unlock = () => mixer.unlock();

  G.on('ready', () => (async () => {
    mixer.addBank(await buildBank(mixer.ctx, { sr: Math.min(48000, mixer.ctx.sampleRate) }));
    const stems = await buildMusic(mixer.ctx, SONGS.calm);
    await mixer.setEnv('outdoor');
    const start = () => {
      A.music = createMusic(mixer, stems, { intensity: 0.15 }); A.music.start();
      A.play('wind', { loop: true, bus: 'ambience', gain: 0.35 });
      A.engine = A.play('engine_idle', { loop: true, gain: 0.0 });
    };
    if (mixer.ctx.state === 'running') start(); else mixer.unlocked.then(start);
  })().catch((e) => G.errors.push('audio: ' + (e && e.message || e))));

  G.on('kea:blown', () => A.play('whoosh', { gain: 0.5 }));
  G.on('possum:trapped', () => A.play('ui_confirm', { gain: 0.6 }));
  G.on('game:alert', (kind) => {
    if (kind === 'alert') A.play('alarm', { gain: 0.5 });
    if (kind === 'shake') A.play('explosion_far', { gain: 0.9, rate: 0.45, send: 0.6 });
  });
  G.on('game:strike', () => A.play('dry_click', { gain: 0.8 }));

  let lastP = -1;
  A.update = () => {
    mixer.update(G.camera);
    const p = blower ? Math.round(blower.power * 20) / 20 : 0;
    if (A.engine && p !== lastP) {
      lastP = p;
      A.engine.setGain(p > 0.02 ? 0.12 + p * 0.5 : 0);
      A.engine.setRate(0.8 + p * 0.9);
    }
  };
  return A;
}

export function showcase() { return null; }
