// blower — the hero object + the one weapon verb. View model in its own scene/camera (post overlay, depthRange),
// spring sway/bob/kick, spool-up, airflow FX into the world, and the gameplay query every actor uses.
//   create(G, { input }) → {
//     overlay: { scene, camera },          // pass to createPost(G, { overlay })
//     firing, power (0..1 spooled), heat (0..1, overheats at 1 → forced cool-down), turbo (aim held),
//     origin: Vector3, dir: Vector3,       // world-space nozzle + blow direction (valid every frame)
//     range (m), strengthAt(p) → 0..1,     // cone falloff × power; 0 outside
//     forceAt(p, out) → out                // push vector (m/s² at strength 1 = 38) along the airflow
//     update(dt), forceFire (bool, captures/bots), enabled
//   }
// Allocation-free update. Reads G.mods.fx lazily (fx stage boots after actors).
import { Scene, PerspectiveCamera, Vector3, Quaternion, HemisphereLight, DirectionalLight, Color } from 'three';
import { Spring } from '../../cookbook/engine/springs.js';
import { PLAYER } from '../../contracts.js';
import { buildBlower } from './model.js';

const RANGE = 9, COS_CONE = Math.cos(0.26), PUSH = 38;
const _v = new Vector3(), _q = new Quaternion(), _fwd = new Vector3(), _right = new Vector3(), _up = new Vector3();
const DUST = [0.42, 0.38, 0.32];

export function create(G, { input } = {}) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(PLAYER.viewFov, G.width / G.height, 0.01, 10);
  const model = buildBlower();
  const rest = new Vector3(0.24, -0.3, -0.56);
  model.position.copy(rest); model.rotation.set(0.04, 0.1, 0);
  scene.add(model);
  const hemi = new HemisphereLight(new Color(0.55, 0.62, 0.75), new Color(0.18, 0.17, 0.15), 1.2);
  const key = new DirectionalLight(new Color().copy(G.sun.color), G.sun.intensity * 0.6);
  scene.add(hemi, key, key.target);
  const swayX = new Spring(90, 11), swayY = new Spring(90, 11), kick = new Spring(220, 14), buzz = new Spring(600, 20);
  let lastYaw = 0, lastPitch = 0, fxAcc = 0;
  const B = {
    overlay: { scene, camera }, model, firing: false, power: 0, heat: 0, overheated: false, turbo: false,
    origin: new Vector3(), dir: new Vector3(0, 0, -1), range: RANGE, forceFire: !!G.params.get('shot'), enabled: true,
  };

  B.strengthAt = (p) => {
    if (B.power < 0.02) return 0;
    _v.subVectors(p, B.origin);
    const d = _v.length(); if (d > B.range || d < 1e-3) return 0;
    const c = _v.dot(B.dir) / d; if (c < COS_CONE - (B.turbo ? 0 : 0.03)) return 0;
    const cone = (c - COS_CONE) / (1 - COS_CONE);
    return B.power * Math.min(1, cone * 3 + 0.2) * (1 - d / B.range) ** 0.7 * (B.turbo ? 1.4 : 1);
  };
  B.forceAt = (p, out) => { const s = B.strengthAt(p); return out.copy(B.dir).multiplyScalar(s * PUSH).addScaledVector(_up.set(0, 1, 0), s * PUSH * 0.12); };

  B.update = (dt) => {
    if (!scene.environment && G.env) scene.environment = G.env;
    key.position.copy(G.sun.dir).multiplyScalar(5);
    const wantFire = B.enabled && !G.paused && !B.overheated && (B.forceFire || !!(input && input.down('fire')));
    B.turbo = wantFire && !!(input && input.down('aim'));
    B.firing = wantFire;
    B.power += ((wantFire ? 1 : 0) - B.power) * Math.min(1, dt * (wantFire ? 5 : 3));
    B.heat = Math.max(0, Math.min(1, B.heat + dt * (wantFire ? (B.turbo ? 0.16 : 0.07) : -0.12)));
    if (B.heat >= 1) B.overheated = true; else if (B.overheated && B.heat < 0.35) B.overheated = false;
    if (B.forceFire) B.heat = 0.3;
    // world-space nozzle + direction from the world camera
    G.camera.getWorldQuaternion(_q);
    _fwd.set(0, 0, -1).applyQuaternion(_q); _right.set(1, 0, 0).applyQuaternion(_q); _up.set(0, 1, 0).applyQuaternion(_q);
    B.dir.copy(_fwd);
    B.origin.copy(G.camera.position).addScaledVector(_fwd, 0.9).addScaledVector(_right, 0.2).addScaledVector(_up, -0.3);
    // view-model springs: sway against look, two-stroke buzz while running, kick on spool-up
    const yaw = Math.atan2(_fwd.x, _fwd.z), pitch = Math.asin(Math.max(-1, Math.min(1, _fwd.y)));
    let dy = yaw - lastYaw; if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI;
    swayX.target = Math.max(-0.05, Math.min(0.05, dy * 0.6)); swayY.target = Math.max(-0.04, Math.min(0.04, (pitch - lastPitch) * 0.6));
    lastYaw = yaw; lastPitch = pitch;
    kick.target = B.power * 0.03; buzz.target = B.power * Math.sin(G.t * 190) * 0.0015;
    swayX.update(dt); swayY.update(dt); kick.update(dt); buzz.update(dt);
    model.position.set(rest.x + swayX.x, rest.y - swayY.x + buzz.x, rest.z + kick.x);
    model.rotation.set(0.04 + B.power * 0.02, 0.1 + swayX.x * 0.8, buzz.x * 4);
    // airflow FX: low dust/leaf puffs along the cone where it meets the ground
    const fx = G.mods && G.mods.fx;
    if (fx && fx.smoke && B.power > 0.2) {
      fxAcc += dt * 24 * B.power;
      while (fxAcc >= 1) {
        fxAcc -= 1;
        const t = 0.25 + Math.random() * 0.75;
        _v.copy(B.origin).addScaledVector(B.dir, t * B.range * 0.8);
        if (_v.y < 0.1) _v.y = 0.1;
        SMOKE.vel.copy(B.dir).multiplyScalar(4 * B.power);
        fx.smoke(_v, SMOKE);
      }
    }
  };
  return B;
}
const SMOKE = { count: 1, size: 0.18, grow: 3, life: 0.9, color: DUST, opacity: 0.16, spread: 0.6, vel: new Vector3(), rise: 0.1 };

export function showcase() { return { cam: [-4, 1.68, -6], target: [-40, 4, -16] }; }
