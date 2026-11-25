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
  hud:       () => ({ update: noop, toast: noop, set: noop, ui: { setState: noop, state: 'playing' } }),
};
