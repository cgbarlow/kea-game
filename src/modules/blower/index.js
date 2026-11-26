// blower — the hero object + the one weapon verb. View model in its own scene/camera (post overlay, depthRange),
// spring sway/bob/kick/buzz, spool-up, turbo pose, overheat glow + smoke, airflow FX into the world, and the gameplay
// query every actor uses.
//   create(G, { input }) → {
//     overlay: { scene, camera },          // pass to createPost(G, { overlay })
//     firing, power (0..1 spooled), heat (0..1, overheats at 1 → forced cool-down), overheated, turbo (aim held),
//     origin: Vector3, dir: Vector3,       // world-space nozzle + blow direction (valid every frame)
//     range (m), strengthAt(p) → 0..1,     // cone falloff × power; 0 outside
//     forceAt(p, out) → out                // push vector (m/s² at strength 1 = 38) along the airflow
//     update(dt), forceFire (bool, captures/bots), enabled (false = lowered, e.g. drop/cover/hold)
//   }
// Allocation-free update. Reads G.mods.fx / ground / terrain / game lazily (they boot after the blower).
import { Scene, PerspectiveCamera, Vector3, Quaternion, Euler, HemisphereLight, DirectionalLight, Color } from 'three';
import { Spring } from '../../cookbook/engine/springs.js';
import { PLAYER } from '../../contracts.js';
import { buildBlower } from './model.js';
import { createAirflow } from './airflow.js';

const RANGE = 9, COS_CONE = Math.cos(0.26), PUSH = 38;
// rest pose of the model in view space (camera at origin looking -Z): grip low right, tube converging on the reticle
const REST = { x: 0.2, y: -0.1, z: -0.6, rx: 0.1, ry: 0.17, rz: -0.04 };
const _v = new Vector3(), _q = new Quaternion(), _qi = new Quaternion(), _fwd = new Vector3(), _right = new Vector3(), _up = new Vector3(), _w = new Vector3();
const _e = new Euler();

export function create(G, { input } = {}) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(PLAYER.viewFov, G.width / G.height, 0.01, 10);
  const M = buildBlower(G);
  const model = M.group;
  const rig = model; // the model group is the rig root (one transform per frame)
  rig.position.set(REST.x, REST.y, REST.z); rig.rotation.set(REST.rx, REST.ry, REST.rz, 'YXZ');
  scene.add(rig);
  // view-model lights: sky/ground fill, the sun (rotated into view space every frame) and a cool back-fill
  const hemi = new HemisphereLight(new Color(0.62, 0.68, 0.8), new Color(0.2, 0.18, 0.15), 0.9);
  const key = new DirectionalLight(new Color().copy(G.sun.color), G.sun.intensity * 0.55);
  const fill = new DirectionalLight(new Color(0.55, 0.65, 0.85), 0.55);
  fill.position.set(-0.6, 0.5, 0.8);
  scene.add(hemi, key, key.target, fill, fill.target);
  scene.environmentIntensity = (G.ART?.ambient?.envIntensity ?? 1.25) * 1.0;

  const sway = new Spring(110, 15), swayY = new Spring(110, 15), roll = new Spring(300, 20);
  const kick = new Spring(220, 13), buzz = new Spring(1600, 22), buzzR = new Spring(1600, 22), bob = new Spring(140, 13);
  const turboS = new Spring(90, 16), lower = new Spring(60, 14);
  let lastYaw = 0, lastPitch = 0, wasFiring = false, phase = 0, first = true;
  const B = {
    overlay: { scene, camera }, model, firing: false, power: 0, heat: 0, overheated: false, turbo: false,
    origin: new Vector3(), dir: new Vector3(0, 0, -1), range: RANGE, forceFire: !!G.params.get('shot'), enabled: true,
    enginePos: new Vector3(), visDir: new Vector3(0, 0, -1), tris: M.tris, calls: M.calls,
  };
  const air = createAirflow(G, B);

  B.strengthAt = (p) => {
    if (B.power < 0.02) return 0;
    _v.subVectors(p, B.origin);
    const d = _v.length(); if (d > B.range || d < 1e-3) return 0;
    const c = _v.dot(B.dir) / d; if (c < COS_CONE - (B.turbo ? 0 : 0.03)) return 0;
    const cone = (c - COS_CONE) / (1 - COS_CONE);
    return B.power * Math.min(1, cone * 3 + 0.2) * (1 - d / B.range) ** 0.7 * (B.turbo ? 1.4 : 1);
  };
  B.forceAt = (p, out) => { const s = B.strengthAt(p); return out.copy(B.dir).multiplyScalar(s * PUSH).addScaledVector(_w.set(0, 1, 0), s * PUSH * 0.12); };

  // model-space point → world, through where it appears on screen (view FOV ≠ world FOV)
  function toWorld(p, out) {
    _v.copy(p).applyMatrix4(rig.matrixWorld);
    const dist = _v.length();
    _v.project(camera);
    out.set(_v.x, _v.y, 0.5).unproject(G.camera).sub(G.camera.position).normalize().multiplyScalar(dist).add(G.camera.position);
    return out;
  }

  B.update = (dt) => {
    if (!scene.environment && G.env) scene.environment = G.env;
    const wantFire = B.enabled && !B.overheated && (B.forceFire || (!G.paused && !!(input && input.down('fire'))));
    B.turbo = wantFire && !!(input && input.down('aim'));
    B.firing = wantFire;
    B.power += ((wantFire ? (B.turbo ? 1 : 0.85) : 0) - B.power) * Math.min(1, dt * (wantFire ? 5 : 3));
    B.heat = Math.max(0, Math.min(1, B.heat + dt * (wantFire ? (B.turbo ? 0.16 : 0.07) : -0.12)));
    if (B.heat >= 1) B.overheated = true; else if (B.overheated && B.heat < 0.35) B.overheated = false;
    if (B.forceFire) B.heat = 0.3;
    if (wantFire && !wasFiring) kick.impulse(-0.35);           // spool-up shove
    wasFiring = wantFire;

    // camera basis + view-space lighting (sun + env follow the world camera)
    G.camera.getWorldQuaternion(_q);
    _qi.copy(_q).invert();
    _fwd.set(0, 0, -1).applyQuaternion(_q); _right.set(1, 0, 0).applyQuaternion(_q); _up.set(0, 1, 0).applyQuaternion(_q);
    key.position.copy(G.sun.dir).applyQuaternion(_qi).multiplyScalar(5);
    _e.setFromQuaternion(_qi); scene.environmentRotation.copy(_e);
    hemi.position.set(0, 1, 0).applyQuaternion(_qi);

    // springs: look sway (lags the turn), walk bob, kick, two-stroke buzz (stiff springs chasing noise), turbo, lowered
    const yaw = Math.atan2(_fwd.x, _fwd.z), pitch = Math.asin(Math.max(-1, Math.min(1, _fwd.y)));
    let dy = yaw - lastYaw; if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI;
    if (first) { dy = 0; lastPitch = pitch; first = false; }
    const inv = dt > 0 ? 1 / dt : 0;
    sway.target = Math.max(-0.06, Math.min(0.06, dy * inv * 0.012)); swayY.target = Math.max(-0.04, Math.min(0.04, (pitch - lastPitch) * inv * 0.01));
    roll.target = -sway.target * 1.4;
    lastYaw = yaw; lastPitch = pitch;
    const pl = G.mods.game && G.mods.game.player, vel = pl && pl.velocity;
    const spd = vel ? Math.min(1.2, Math.hypot(vel.x, vel.z) / PLAYER.walk) : 0;
    phase += dt * (6.5 + spd * 3) * (spd > 0.05 ? 1 : 0);
    bob.target = spd * 0.012 * Math.abs(Math.sin(phase));
    const idle = B.power > 0.05 ? 1 : 0.25, amp = (0.0007 + B.power * 0.0016 + (B.turbo ? 0.001 : 0)) * idle;
    buzz.target = (Math.random() - 0.5) * amp; buzzR.target = (Math.random() - 0.5) * amp * 3;
    turboS.target = B.turbo ? 1 : 0; lower.target = B.enabled ? (B.overheated ? 0.35 : 0) : 1;
    sway.update(dt); swayY.update(dt); roll.update(dt); kick.update(dt); buzz.update(dt); buzzR.update(dt); bob.update(dt); turboS.update(dt); lower.update(dt);
    const tz = turboS.x, lw = lower.x, spool = B.power;
    rig.position.set(
      REST.x + sway.x - tz * 0.012 + lw * 0.05,
      REST.y - swayY.x - bob.x + buzz.x - tz * 0.012 - lw * 0.16 - spool * 0.004,
      REST.z + kick.x * 0.06 + spool * 0.012 - tz * 0.035 + lw * 0.06);
    rig.rotation.set(REST.rx + swayY.x * 1.2 + spool * 0.012 + tz * 0.04 - lw * 0.5, REST.ry + sway.x * 1.4 - tz * 0.03 + lw * 0.3, REST.rz + roll.x + buzzR.x * 4 + kick.x * 0.04, 'YXZ');
    rig.updateMatrixWorld();
    M.hot.emissiveIntensity = Math.pow(B.heat, 2.2) * 9 * (B.overheated ? 1 + 0.25 * Math.sin(G.t * 23) : 1);

    // world-space nozzle + direction (crosshair) for gameplay and FX
    B.dir.copy(_fwd);
    toWorld(M.nozzle, B.origin);
    toWorld(M.engine, B.enginePos);
    toWorld(M.tail, _w); B.visDir.subVectors(B.origin, _w).normalize();   // where the tube visibly points (FX)
    air.update(G.paused && !B.forceFire ? 0 : dt);
  };
  return B;
}

export function showcase() { return { cam: [-4, 1.68, -6], target: [-40, 4, -16] }; }
