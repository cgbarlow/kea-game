// DO NOT FEED THE KEA — entry. Staged boot (engine/boot.js) in the mandatory order (references/pipeline-order.md §2):
//   core → quality → input → pcss → atmos → sky → env → materials → carpark (world, critical) → terrain (+ far field)
//   → ground (puddles + planar reflection) → lights → finalize → shadows → vans → blower → kea → possums → fx
//   → weather → probes (assign) → post (blower overlay) → audio → game (rules + player) → hud → warm-up
//   → probe capture → ready.
// Every module stage is non-critical with a stub (src/modules/_stub.js) so the game boots with any subset done.
// Module results are registered on G.mods[name] so modules can find late-booting peers lazily (e.g. blower → fx).
// Owner: lead/integrator. Module owners never edit this file; they report needed wiring changes.
import { MeshStandardMaterial, Color } from 'three';
import { createCore } from './cookbook/engine/core.js';
import { createBoot } from './cookbook/engine/boot.js';
import { createQuality } from './cookbook/engine/quality.js';
import { createInput } from './cookbook/engine/input.js';
import { installBench } from './cookbook/engine/bench.js';
import { finalizeMaterials } from './cookbook/engine/finalize.js';
import { installPCSS, fitSunShadow, createShadowScheduler, casterBounds } from './cookbook/lighting/pcss.js';
import { installAtmos } from './cookbook/lighting/atmos.js';
import { createSky } from './cookbook/lighting/sky.js';
import { createEnvFromSky } from './cookbook/lighting/env-from-sky.js';
import { createLights } from './cookbook/lighting/lights.js';
import { createProbe } from './cookbook/lighting/probes.js';
import { initMaterials, makeMaterial } from './cookbook/materials/library.js';
import { createGroundMask, patchGround } from './cookbook/ground/ground.js';
import { createPlanarReflection } from './cookbook/ground/planar-reflection.js';
import { createFX } from './cookbook/fx/index.js';
import { createSnow } from './cookbook/weather/snow.js';
import { createDust } from './cookbook/weather/dust.js';
import { createPost } from './cookbook/post/pipeline.js';
import { createFarfield } from './cookbook/backdrop/farfield.js';
import { windUniform } from './cookbook/geo/scatter.js';
import { ART } from './art.js';
import { POSES, PATH, WORLD, PLAYER, SEED, LAYOUT } from './contracts.js';
import { STUBS } from './modules/_stub.js';
import * as Carpark from './modules/carpark/index.js';
import * as Terrain from './modules/terrain/index.js';
import * as Vans from './modules/vans/index.js';
import * as Blower from './modules/blower/index.js';
import * as Kea from './modules/kea/index.js';
import * as Possums from './modules/possums/index.js';
import * as Game from './modules/game/index.js';
import * as Hud from './modules/hud/index.js';
import * as Audio from './modules/audio/index.js';

const SHOWCASES = { carpark: Carpark, terrain: Terrain, vans: Vans, blower: Blower, kea: Kea, possums: Possums };
const own = (m) => { if (m && typeof m === 'object') m.selfUpdating = true; return m; };

async function main() {
  const G = createCore({ canvas: document.getElementById('c'), ART, fov: PLAYER.fov, far: 2000 });
  Object.assign(G, { POSES, PATH, WORLD, LAYOUT, mods: {} });
  installBench(G, { path: PATH });
  G.start();
  const boot = createBoot(G, { stubs: STUBS });
  const stage = async (name, fn, o) => (G.mods[name] = await boot.stage(name, fn, o));
  const wx = ART.weather || {};
  const LK = ART.lamps || {}, ML = ART.matLook || {};

  const Q = await stage('quality', () => createQuality(G), { critical: true, msg: 'Checking the radio', at: 0.03 });
  const input = await stage('input', () => createInput(G, { root: document.getElementById('ui') }), { critical: true, msg: 'Finding the controls', at: 0.05 });
  await stage('pcss', () => { installPCSS({ G, tier: G.quality.tier }); return {}; }, { msg: 'Softening the shadows', at: 0.07 });
  await stage('atmos', () => installAtmos(G) || {}, { critical: true, msg: 'Pumping in the alpine air', at: 0.09 });
  const sky = await stage('sky', () => own(createSky(G)), { msg: 'Parting the cloud', at: 0.12 });
  await stage('env', () => own(createEnvFromSky(G, sky)), { msg: 'Catching the light', at: 0.15 });

  // materials: one per surface type (kit geometry carries colour + AO in vertex colours)
  const mats = await stage('materials', () => {
    initMaterials(G);
    const m = {
      ground: makeMaterial('asphalt', { weather: false }),
      concrete: makeMaterial('concrete'), wood: makeMaterial('weathered_wood'), paint: makeMaterial('painted_metal', { tint: 0xd2d2d2 }),
      steel: makeMaterial('galvanised'), rubber: makeMaterial('rubber'), rock: makeMaterial('rock', { triplanar: true, rough: ML.rockRough ?? 1, metal: 0, weather: { preset: 'prop', wet: ML.rockWet ?? 1 } }),
      terrain: makeMaterial('rock', { triplanar: true, rough: ML.rockRough ?? 1, metal: 0, weather: { preset: 'ground', wet: ML.rockWet ?? 1 } }), bark: makeMaterial('weathered_wood', { tint: 0x6a6058 }),
      shelterWood: makeMaterial('weathered_wood', { weather: 'sheltered' }), shelterSteel: makeMaterial('galvanised', { weather: 'sheltered' }),
      shelterConcrete: makeMaterial('concrete', { weather: 'sheltered' }), board: makeMaterial('painted_metal', { tint: 0x2a5a44, weather: 'sheltered' }),
      lamp: makeMaterial('emissive_panel', { emissive: 0xe8f0ff, emissiveIntensity: LK.tubeEmissive ?? 6 }),
      linePaint: makeMaterial('plastic', { tint: 0xe8e2d0 }), vanPaint: makeMaterial('painted_metal', { tint: 0xcccac6 }),
      cloth: makeMaterial('tarp', { tint: 0xd8d8d8, weather: 'sheltered' }), skin: makeMaterial('plastic', { tint: 0xc89a7a, weather: 'sheltered' }),
      amber: new MeshStandardMaterial({ color: new Color(0.4, 0.2, 0.02), emissive: new Color(1.0, 0.45, 0.05), emissiveIntensity: 6, roughness: 0.3 }),
    };
    for (const k in m) if (k !== 'ground') m[k].vertexColors = true;
    return m;
  }, { msg: 'Mixing paint, rust and rain', at: 0.2, stub: flatMaterials });
  G.mats = mats;

  const world = await stage('carpark', () => Carpark.create(G, { mats }), { critical: true, msg: 'Sealing the car park', at: 0.28 });
  const A = world.anchors || {};
  const terrain = await stage('terrain', () => Terrain.create(G, { mats }), { msg: 'Raising the Southern Alps', at: 0.36 });
  // far field: the look's layered snowy ridgelines replace the terrain module's generic wilderness rings
  await stage('farfield', () => {
    if (!ART.farfield) return {};
    const old = terrain.farfield;
    if (old?.group) { old.group.parent?.remove(old.group); G.off?.('update', old.update); old.dispose?.(); }
    return createFarfield(G, { layers: ART.farfield });
  }, { msg: 'Lining up the ranges', at: 0.38 });
  // ?shot=1 is the contract's fixed-time capture: freeze the foliage wind so frozen-camera stills are deterministic
  if (G.params.get('shot')) { const wu = windUniform(); wu.value.set(0, 0, 0); wu.fromArt = true; }

  const ground = await stage('ground', () => {
    const b = world.bounds, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    const mask = createGroundMask({ extent: [b.max.x - b.min.x, b.max.z - b.min.z], center: [cx, cz], size: 512, seed: SEED });
    const refl = createPlanarReflection(G, { height: WORLD.groundY, hide: [world.ground] });
    const gnd = patchGround(world.ground.material, { G, mask, refl, base: 'none', water: (ART.surface?.wet ?? 0) > 0.3 ? 0.08 : 0, wet: ML.puddleWet ?? ART.surface?.wet });
    gnd.uniforms.uGrRain.value = ML.puddleRain ?? 0;     // light meltwater drips: soft ripple normals, no mirror-glass puddles
    if (refl?.uniforms?.uReflLod) refl.uniforms.uReflLod.value = ML.reflLod ?? 0;
    return own({ mask, refl, gnd, uniforms: gnd.uniforms });
  }, { msg: 'Puddling the meltwater', at: 0.42 });
  void ground;

  await stage('lights', () => {
    const lights = createLights(G);
    // daytime: pole lamps dark (sensor off) unless ART.lamps.pole > 0
    for (const p of A.lamps || []) {
      const on = (LK.pole ?? 55) > 0;
      lights.add({ position: p, kind: 'pole', intensity: on ? LK.pole : 0.01, real: on, pool: on, halo: on, emissive: on ? undefined : (LK.poleEmissive ?? 0.15), groundY: 0, color: [0.9, 0.95, 1.0] });
    }
    if (A.shelterLamp) { // the batten is the visible fixture; the light sits 0.35 m under it so the ceiling gets no hotspot
      const sp = A.shelterLamp, it = lights.add({ position: [sp[0], sp[1] - 0.35, sp[2]], kind: 'none', halo: false, pool: false, intensity: LK.shelter ?? 18, groundY: 0, color: [0.85, 0.95, 1.0] });
      it.group.visible = true; it.group.traverse((m) => { if (m.isMesh) m.visible = false; });
    }
    for (const f of A.flashers || []) lights.add({ position: f, kind: 'fixture', real: false, haloSize: 0.5, intensity: LK.flasher ?? 8, groundY: 0, color: [1.0, 0.45, 0.05], flicker: 0.6 });
    return own(lights);
  }, { msg: 'Switching on the lamps', at: 0.48 });

  finalizeMaterials(G, G.scene);

  const vans = await stage('vans', () => Vans.create(G, { mats, colliders: world.colliders }), { msg: 'Parking the campervans', at: 0.52 });
  await stage('shadows', () => {
    fitSunShadow(G, casterBounds(world.root), G.quality.settings.shadow);
    return own(createShadowScheduler(G, { mode: 'dynamic', every: 2 }));
  }, { msg: 'Casting shadows', at: 0.56 });
  const blower = await stage('blower', () => Blower.create(G, { input }), { msg: 'Fuelling the blower (2-stroke, 50:1)', at: 0.6 });
  const kea = await stage('kea', () => Kea.create(G, { vans, blower }), { msg: 'Counting kea (inconclusive)', at: 0.63 });
  const possums = await stage('possums', () => Possums.create(G, { vans, blower, traps: A.traps || [] }), { msg: 'Setting the trap boxes', at: 0.66 });

  const fx = await stage('fx', () => { const f = createFX(G); f.setGround(WORLD.groundY, terrain.heightAt); f.prewarm(2); return own(f); }, { msg: 'Priming the pools', at: 0.7 });
  void fx;
  const weather = await stage('weather', () => {
    const w = { snow: null, dust: null };
    if (wx.particles === false) return own(w); // look r2: flakes/motes read as stars and dead pixels; snow lives on the ground
    if (wx.kind === 'snow') w.snow = createSnow(G, { amount: wx.amount ?? 0.2, count: 4000, cover: ART.surface?.snow ?? 0.35 });
    w.dust = createDust(G, { count: 900, box: [16, 7, 16] }); w.dust.amount = 0.4;
    return own(w);
  }, { msg: 'Calling the weather', at: 0.73 });

  const probe = await stage('probes', () => {
    if (!world.shelter) return {};
    const p = createProbe(G, { position: world.shelter.probeAt, box: world.shelter.box, hide: [weather.snow?.mesh, weather.dust?.mesh].filter(Boolean) });
    if (G.params.get('probe') !== '0') p.assign(world.shelter.interior || world.shelter.group, { intensity: 1.0 }); // ?probe=0: A/B; interior-only group when carpark provides it
    return own(p);
  }, { msg: 'Lighting the shelter', at: 0.76 });

  await stage('post', () => {
    const post = createPost(G, { overlay: blower.overlay });
    // look-director post knobs (ART.grade covers the grade; these are the post-only ones)
    Object.assign(post.params, ART.post || {});
    // a camera cut (harness/pose/teleport) snaps the exposure: no adaptation drift under a frozen camera
    G.on('camset', () => post.resetAdaptation());
    return post;
  }, { msg: 'Grading the film', at: 0.8 });
  await stage('audio', () => Audio.create(G, { blower }), { msg: 'Tuning the two-stroke', at: 0.84 });
  const game = await stage('game', () => Game.create(G, { input, colliders: world.colliders, vans, kea, possums, blower, cover: A.cover || [] }), { msg: 'Reading the shift brief', at: 0.88 });
  await stage('hud', () => Hud.create(G, { input, player: game.player, quality: Q, path: PATH, game, vans, blower }), { msg: 'Printing the signage', at: 0.92 });

  // ?show=<module>: that module's showcase camera
  const show = SHOWCASES[G.params.get('show')];
  const sc = show?.showcase?.(G);
  if (sc) G.on('ready', () => window.__setCam(sc.cam, sc.target));

  finalizeMaterials(G, G.scene);
  stabiliseCutouts(G.scene);
  G.camera.position.fromArray(POSES[0]); G.camera.lookAt(POSES[0][3], POSES[0][4], POSES[0][5]);
  const extras = [...(kea.materials || []), ...(possums.materials || [])].map((material) => ({ material, kind: 'mesh' }));
  await stage('warmup', () => Q.warmup({ extras }), { msg: 'Compiling shaders', at: 0.95 });
  await stage('probe-capture', () => { probe.capture?.(2); return {}; }, { msg: 'Lighting the shelter', at: 0.98 });
  await boot.finish({ warmup: false });
}

// alpha-tested foliage (leaf cards, grass blades): alpha-to-coverage on the MSAA target turns the hard 1-bit edge
// into a resolved coverage gradient, so canopies stop sparkling frame to frame. Needs MSAA (high/med tiers).
function stabiliseCutouts(root) {
  root.traverse((o) => {
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) if (m && m.alphaTest > 0 && !m.transparent && !m.alphaToCoverage) { m.alphaToCoverage = true; m.needsUpdate = true; }
  });
}

function flatMaterials() {
  const m = (c, r = 0.8, mt = 0) => new MeshStandardMaterial({ color: new Color(c), roughness: r, metalness: mt, vertexColors: true });
  const o = { ground: new MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.8 }) };
  for (const [k, c] of [['concrete', 0x77706a], ['wood', 0x7a6a5a], ['paint', 0xffffff], ['steel', 0x8a8f96], ['rubber', 0x111111], ['rock', 0x5a5650],
    ['terrain', 0x5a5040], ['bark', 0x4a4038], ['shelterWood', 0x7a6a5a], ['shelterSteel', 0x8a8f96], ['shelterConcrete', 0x77706a], ['board', 0x2a5a44],
    ['lamp', 0xffffff], ['linePaint', 0xe8e2d0], ['vanPaint', 0xffffff], ['cloth', 0xffffff], ['skin', 0xc89a7a], ['amber', 0xffa020]]) o[k] = m(c);
  return o;
}

main().catch((e) => {
  const msg = 'main: ' + (e && e.message || e);
  (window.__errors ||= []).push(msg); window.__fatal = window.__fatal || msg; console.error(e);
});
