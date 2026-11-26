// game/player — first-person ranger (owned by the game module): input (engine/input.js) → yaw/pitch, accelerated walk/sprint/crouch, jump, gravity,
// circle-vs-AABB collision against world colliders, spring-driven head bob + landing dip (engine/springs.js).
//   create(G, { input, colliders }) → { update, position, yaw, pitch, teleport(pos, yaw), velocity, grounded, crouched,
//     shake (0..~2, set by the rules: aftershock camera shake), stumble (0..~2: ground motion shoves a standing player) }
// Respects G.camLocked (captures/bench own the camera) and G.paused. Allocation-free update.
// Aftershock shake = sums of incommensurate sines (deterministic, seam-free): a slow ground roll (0.7-1.3 Hz, cm-scale
// sway + a degree of roll), a mid body sway and a fine high-frequency judder, all scaled by S.shake.
import { Vector3, Euler } from 'three';
import { Spring, damp } from '../../cookbook/engine/springs.js';
import { PLAYER as P, WORLD } from '../../contracts.js';

export function create(G, { input, colliders = [] }) {
  const pos = new Vector3().fromArray(P.spawn), vel = new Vector3(), wish = new Vector3();
  const e = new Euler(0, 0, 0, 'YXZ');
  const S = { position: pos, velocity: vel, yaw: P.spawnYaw, pitch: 0, grounded: true, crouched: false, eye: P.eye, enabled: true, shake: 0, stumble: 0 };
  const bob = new Spring(140, 13), land = new Spring(140, 13);
  let phase = 0, wasGrounded = true;

  function collide() {
    const r = P.radius;
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (pos.y + P.height < b.min.y || pos.y > b.max.y - 0.35) {
        // standing on top (step-up 35 cm)
        if (pos.y <= b.max.y && pos.y > b.max.y - 0.35 && pos.x > b.min.x - r * 0.5 && pos.x < b.max.x + r * 0.5 && pos.z > b.min.z - r * 0.5 && pos.z < b.max.z + r * 0.5 && vel.y <= 0) {
          pos.y = b.max.y; vel.y = 0; S.grounded = true;
        }
        continue;
      }
      const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x)), cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), push = (r - d) / d; pos.x += dx * push; pos.z += dz * push; }
      else { // centre inside the box: push out along the shallowest axis
        const ox = Math.min(pos.x - b.min.x, b.max.x - pos.x), oz = Math.min(pos.z - b.min.z, b.max.z - pos.z);
        if (ox < oz) pos.x = pos.x - b.min.x < b.max.x - pos.x ? b.min.x - r : b.max.x + r; else pos.z = pos.z - b.min.z < b.max.z - pos.z ? b.min.z - r : b.max.z + r;
      }
    }
  }

  S.update = (dt) => {
    if (!S.enabled || G.paused) return;
    S.yaw -= input.lookX; S.pitch = Math.max(-1.5, Math.min(1.5, S.pitch - input.lookY));
    const crouch = input.down('crouch'); S.crouched = crouch;
    const sprint = input.down('sprint') && !crouch && input.move.y > 0.2;
    const speed = crouch ? P.crouch : sprint ? P.sprint : P.walk;
    const sy = Math.sin(S.yaw), cy = Math.cos(S.yaw);
    wish.set(input.move.x * cy - input.move.y * sy, 0, -input.move.x * sy - input.move.y * cy).multiplyScalar(speed);
    const a = S.grounded ? P.accel : P.airAccel;
    vel.x = damp(vel.x, wish.x, a / Math.max(1, speed), dt); vel.z = damp(vel.z, wish.z, a / Math.max(1, speed), dt);
    if (S.stumble > 0 && S.grounded) {             // the car park moves under a standing ranger
      const t = G.t, st = S.stumble * 2.4;
      vel.x += st * (Math.sin(t * 5.3) + 0.6 * Math.sin(t * 8.9 + 1.3)) * dt * 1.5;
      vel.z += st * (Math.sin(t * 4.7 + 2.1) + 0.6 * Math.sin(t * 9.7)) * dt * 1.5;
    }
    if (S.grounded && !crouch && input.pressed('jump')) { vel.y = P.jump; S.grounded = false; }
    vel.y -= P.gravity * dt;
    pos.addScaledVector(vel, dt);
    S.grounded = false;
    collide();
    pos.x = Math.max(WORLD.min[0], Math.min(WORLD.max[0], pos.x)); pos.z = Math.max(WORLD.min[2], Math.min(WORLD.max[2], pos.z));
    // ground = the terrain surface (forest edge / scree rise off the apron), never below the car park slab
    const hAt = G.mods && G.mods.terrain && G.mods.terrain.heightAt;
    const gy = hAt ? Math.max(WORLD.groundY, hAt(pos.x, pos.z)) : WORLD.groundY;
    // snap down slopes while walking (30 cm), land when falling through the surface
    if (!S.grounded && (pos.y < gy || (wasGrounded && vel.y <= 0 && pos.y < gy + 0.3))) { pos.y = gy; vel.y = 0; S.grounded = true; }
    if (S.grounded && !wasGrounded) land.impulse(-2.2);
    wasGrounded = S.grounded;
    // head bob (phase rate grows with speed) + landing dip, both springs → no pops
    const hs = Math.hypot(vel.x, vel.z);
    phase += dt * (5.2 + 1.55 * hs) * (S.grounded && hs > 0.5 ? 1 : 0);
    bob.target = S.grounded ? Math.sin(phase * 2) * 0.035 * Math.min(1, hs / P.walk) : 0;
    bob.update(dt); land.update(dt);
    S.eye = damp(S.eye, crouch ? P.crouchEye : P.eye, 12, dt);
    if (G.camLocked) return;
    const sh = S.shake, t = G.t;
    let jx = 0, jy = 0, jz = 0, rp = 0, ry = 0, rr = 0;
    if (sh > 0) {
      const roll = Math.sin(t * 4.4) + 0.7 * Math.sin(t * 6.9 + 1.7) + 0.4 * Math.sin(t * 8.3 + 0.4);      // ground roll
      const sway = Math.sin(t * 11.3 + 0.9) + 0.6 * Math.sin(t * 15.1 + 2.2);                             // body sway
      const jud = Math.sin(t * 37.0) + 0.7 * Math.sin(t * 53.0 + 1.1) + 0.5 * Math.sin(t * 71.0 + 2.9);   // judder
      jx = sh * (roll * 0.022 + sway * 0.008 + jud * 0.0016);
      jz = sh * (Math.sin(t * 5.1 + 0.6) * 0.018 + Math.sin(t * 12.7) * 0.006);
      jy = sh * (Math.sin(t * 9.4 + 0.3) * 0.010 + jud * 0.0022);
      rp = sh * (sway * 0.0035 + jud * 0.0009);
      ry = sh * (Math.sin(t * 3.7 + 1.0) * 0.004);
      rr = sh * (roll * 0.0075 + jud * 0.0008);
    }
    // blower micro-shake: the two-stroke in your hands, felt through the view (well under a tenth of a degree)
    const bs = G.mods && G.mods.blower ? G.mods.blower.shake || 0 : 0;
    if (bs > 0) {
      rp += bs * 0.0007 * (Math.sin(t * 41.0) + 0.6 * Math.sin(t * 67.0 + 1.9));
      ry += bs * 0.0005 * (Math.sin(t * 53.0 + 0.7) + 0.5 * Math.sin(t * 29.0 + 2.3));
      jy += bs * 0.0006 * Math.sin(t * 47.0 + 1.1);
    }
    G.camera.position.set(pos.x + jx, pos.y + S.eye + bob.x + land.x * 0.1 + jy, pos.z + jz);
    e.set(S.pitch + rp, S.yaw + ry, Math.sin(phase) * 0.004 * Math.min(1, hs / P.walk) + rr);
    G.camera.quaternion.setFromEuler(e);
  };
  S.teleport = (p, yaw = S.yaw) => { pos.fromArray(p); vel.set(0, 0, 0); S.yaw = yaw; S.pitch = 0; S.eye = P.eye; bob.set(0); land.set(0); };
  return S;
}
