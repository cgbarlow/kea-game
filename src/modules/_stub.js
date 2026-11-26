// No-op stand-ins, one per boot stage, matching each module's public API. engine/boot.js swaps one in when a
// non-critical stage throws during create(), so the game still boots and the failure shows up as
// __stats().modules[i].stub === true (a gate failure — never ship with a stub).
// Keep every stub's shape in sync with the real module's API: callers must not need `if (mod.isStub)`.
import { Vector3, Scene, PerspectiveCamera } from 'three';
const noop = () => {};
const zero = () => 0;
export const STUBS = {
  sky:       () => ({ update: noop, mesh: null, material: null }),
  env:       () => ({ bake: noop }),
  post:      () => ({ update: noop, params: {} }),
  materials: () => ({}),
  carpark:   () => ({ update: noop, colliders: [], bounds: null, anchors: {} }),
  terrain:   () => ({ update: noop, group: null, heightAt: zero, normalAt: (x, z, o) => (o || new Vector3()).set(0, 1, 0), farfield: null }),
  ground:    () => ({ update: noop, mask: null, refl: null, uniforms: null }),
  lights:    () => ({ update: noop, add: () => null }),
  shadows:   () => ({ update: noop, invalidate: noop }),
  vans:      () => ({ update: noop, list: [], reset: noop }),
  blower:    (G) => ({ update: noop, overlay: { scene: new Scene(), camera: new PerspectiveCamera(54, G.width / G.height, 0.01, 10) },
               firing: false, power: 0, heat: 0, overheated: false, turbo: false, enabled: true, forceFire: false,
               origin: new Vector3(), dir: new Vector3(0, 0, -1), range: 0, strengthAt: zero, forceAt: (p, o) => o.set(0, 0, 0) }),
  kea:       () => ({ update: noop, list: [], spawn: zero, active: zero, reset: noop, materials: [] }),
  possums:   () => ({ update: noop, list: [], spawn: zero, active: zero, reset: noop, trapped: 0, materials: [] }),
  fx:        () => ({ update: noop, muzzle: noop, tracer: noop, impact: noop, smoke: noop, sparks: noop, emitter: () => null, setGround: noop, prewarm: noop, materials: [] }),
  weather:   () => ({ update: noop, snow: null, dust: null }),
  probes:    () => ({ update: noop, capture: noop, assign: noop }),
  audio:     () => ({ update: noop, play: () => null, setVolume: noop, unlock: noop, mixer: null }),
  game:      (G) => ({ update: noop, player: { update: noop, position: G.camera.position, velocity: new Vector3(), teleport: noop, shake: 0 },
               state: 'shift', timeLeft: 0, shiftLength: 0, strikes: 0, phase: 'calm', compliant: true, stats: {}, restart: noop }),
  ranger:    () => ({ update: noop, group: null, position: new Vector3(), yaw: 0, state: 'patrol', target: null, targetKind: null, firing: false,
               power: 0, heat: 0, overheated: false, turbo: false, origin: new Vector3(), dir: new Vector3(0, 0, -1), eye: new Vector3(),
               range: 0, strengthAt: zero, forceAt: (p, o) => o.set(0, 0, 0), enabled: false, frozen: false, reset: noop, stage: noop, materials: [] }),
  keaplayer: (G) => { const p = new Vector3(); return { update: noop, overlay: { scene: new Scene(), camera: new PerspectiveCamera(54, G.width / G.height, 0.01, 10) },
               i: 63, pos: p, position: p, velocity: new Vector3(), yaw: 0, pitch: 0, eye: new Vector3(), eyeHeight: 0.35, mode: 'ground',
               grounded: true, perched: false, flying: false, flapping: false, stamina: 1, exhausted: false, offended: 0, carrying: null,
               pulling: 0, pullActive: false, pullTarget: null, tumble: 0, squawkCooldown: 0, shake: 0, enabled: false, hero: false, materials: [],
               teleport: noop, knock: noop, dropCarry: () => null, reset: noop, isTaken: () => false, showPose: noop }; },
  keagame:   () => ({ update: noop, state: 'idle', enabled: false, timeLeft: 0, shiftLength: 0, banked: 0, quota: 9, cone: 'gate', notices: 0,
               phase: 'calm', alertT: 0, magnitude: 0, nextShock: Infinity, carryKind: '', reason: '', stats: {}, stash: null, ledge: null,
               coneAt: new Vector3(), stashAt: new Vector3(), group: null, materials: [], restart: noop }),
  hud:       () => ({ update: noop, toast: noop, set: noop, ui: { setState: noop, state: 'playing' } }),
};
