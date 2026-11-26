// possums — the ground antagonist. Common brushtail possums waddle out of the beech forest toward a campervan's side
// door and rear up to work the seal (van.damage 'possum'). The blower knocks them flat and they belly-slide across
// the wet asphalt (spray); blown into a trap-box mouth they squeeze in, the lid thumps, and they are TRAPPED
// (counted, removed). Non-lethal on screen, as far as the HUD is concerned.
//   create(G, { vans, blower, traps }) → { list, spawn(n), active(), trapped, reset(), update, materials, frozen }
//   Possum = { state: 'idle'|'walk'|'raid'|'blown'|'entering'|'trapped', pos, vel, van, mesh, t, yaw, scale }
//            'entering' = committed to a trap (no longer active, not yet counted)
//   Events: 'possum:raid' (p, van), 'possum:blown' (p), 'possum:trapped' (p, trapIndex) — emitted on the lid thump
//   showcase(G) → { cam, target }
// Allocation-free update (module-scope scratch). Visuals: possums/geo.js (mesh + skin), rig.js (pose), materials.js.
import { Group, Vector3, InstancedMesh, PlaneGeometry, Matrix4, Quaternion, Euler, Color } from 'three';
import { LAYOUT as L, WORLD } from '../../contracts.js';
import { buildPossumGeo } from './geo.js';
import { createPossumMaterials } from './materials.js';
import { makeRig, pose } from './rig.js';

const MAX = 8, TRAP_R = 0.6, BLOW_MIN = 0.05, PUSH_K = 0.5, RAID_DPS = 0.012;
// showcase: the trap line at T-015 (LAYOUT.traps[2]); a possum mid-tumble in the airflow, sliding toward the mouth
const SHOW_CAM = [5.64, 0.84, 12.96], SHOW_TARGET = [5.1, 0.1, 13.98], SHOW_TRAP = 2;
const _a = new Vector3(), _f = new Vector3(), _q = new Vector3(), _m = new Matrix4(), _qq = new Quaternion(), _e = new Euler(), _s = new Vector3();
const P = { alert: 0, ph: 0, gait: 0, slide: 0, rear: 0, crouch: 0, shake: 0, spin: 0, headYaw: 0, headPitch: 0, t: 0 };
const SPRAY = { count: 2, size: 0.07, grow: 3.2, life: 0.55, color: [0.62, 0.66, 0.70], opacity: 0.32, spread: 0.6, vel: new Vector3(), rise: 0.05 };
const DUST = { count: 2, size: 0.09, grow: 3.0, life: 0.9, color: [0.36, 0.31, 0.25], opacity: 0.3, spread: 0.4, vel: new Vector3(), rise: 0.1 };
const THUMP = { count: 5, size: 0.12, grow: 2.6, life: 1.1, color: [0.44, 0.40, 0.34], opacity: 0.35, spread: 0.5, vel: new Vector3(0, 0.25, 0), rise: 0.2 };

// eight coats: grey, brown and dark morphs (NZ has all three), each with its own mottling seed and size
const COATS = [
  [0x6c6c6f, 0x515154, 0xbfb6a4, 0x141414, 1.0], [0x7d6a58, 0x5c4a3c, 0xc4ae8c, 0x1b1612, 0.94],
  [0x6e6e70, 0x4e4e52, 0xc2b9a8, 0x111112, 1.05], [0x78756f, 0x5c5954, 0xc8bea8, 0x181716, 0.9],
  [0x725f4e, 0x543f32, 0xbca486, 0x1a1411, 0.98], [0x636365, 0x464649, 0xb8af9e, 0x101011, 1.02],
  [0x807e7c, 0x5f5c5a, 0xcbc1ac, 0x161514, 0.88], [0x776553, 0x58473a, 0xc4ad8c, 0x19140f, 1.0],
];
const lin = (h) => { const c = new Color(h); return [c.r * 1.08, c.g * 1.08, c.b * 1.08]; }; // linear albedo ~0.15-0.2: reads against the dark asphalt
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const smooth = (cur, tgt, k, dt) => cur + (tgt - cur) * Math.min(1, k * dt);

export function create(G, { vans, blower, traps = [] } = {}) {
  const root = new Group(); root.name = 'possums';
  const mats = createPossumMaterials();
  const list = [];
  for (let i = 0; i < MAX; i++) {
    const c = COATS[i];
    const geo = buildPossumGeo({ seed: 11 + i * 17, grey: lin(c[0]), back: lin(c[1]), belly: lin(c[2]), tail: lin(c[3]), furLen: 0.02 + (i % 3) * 0.0015 });
    const shellMat = mats.shellFor();
    const rig = makeRig(geo, mats, shellMat);
    const mesh = rig.group; mesh.visible = false; mesh.name = 'possum' + i; mesh.rotation.order = 'YXZ'; // yaw, then pitch/roll in body frame
    const sc = 1.15 * c[4] * (0.97 + ((i * 37) % 7) * 0.01); // ~0.55 m nose-to-rump + tail: a big NZ brushtail
    mesh.scale.setScalar(sc);
    root.add(mesh);
    list.push({ i, state: 'idle', pos: new Vector3(), vel: new Vector3(), van: null, mesh, rig, t: 0, scale: sc,
      yaw: 0, spin: 0, ph: i * 1.3, gait: 0, slide: 0, rear: 0, crouch: 0, shake: 0, headYaw: 0, headPitch: 0,
      speed: 1.15 + ((i * 53) % 9) * 0.04, wander: i * 2.1, spray: 0, trap: -1, enterT: 0, stuck: 0,
      alert: 0, roll: 0, pitch: 0, lift: 0, ruffle: 0, windX: 0, windZ: 1, ruf: shellMat.userData });
  }
  // contact shadows: one instanced draw for all eight
  const blobGeo = new PlaneGeometry(0.44, 0.8); blobGeo.rotateX(-Math.PI / 2);
  const blobs = new InstancedMesh(blobGeo, mats.blob, MAX); blobs.name = 'possumContact';
  blobs.frustumCulled = false; blobs.renderOrder = 1;
  _m.makeScale(0, 0, 0); for (let i = 0; i < MAX; i++) blobs.setMatrixAt(i, _m);
  root.add(blobs);
  // sun streaks: the 14-degree sun throws a ~0.7 m shadow that PCSS softens to nothing on a 0.18 m animal; a faint
  // elongated blob down-sun keeps them anchored (one more instanced draw)
  const streakGeo = new PlaneGeometry(0.2, 1); streakGeo.translate(0, 0.5, 0); streakGeo.rotateX(-Math.PI / 2);
  const streaks = new InstancedMesh(streakGeo, mats.streak, MAX); streaks.name = 'possumSunShadow';
  streaks.frustumCulled = false; streaks.renderOrder = 1;
  for (let i = 0; i < MAX; i++) streaks.setMatrixAt(i, _m);
  root.add(streaks);
  const sunDir = G.sun?.dir || new Vector3(-0.91, 0.24, -0.33);
  G.scene.add(root);

  const vanList = () => (vans && vans.list) || [];
  const API = { list, trapped: 0, materials: [...mats.list, ...mats.shells], frozen: false };
  const fx = () => G.mods && G.mods.fx;
  const groundY = (x, z) => {
    const cp = L.carpark;
    if (x > cp.x0 - 1 && x < cp.x1 + 1 && z > -24 && z < cp.z1 + 1.5) return 0;
    const h = G.mods && G.mods.terrain && G.mods.terrain.heightAt ? G.mods.terrain.heightAt(x, z) : 0;
    return Math.max(0, h);
  };
  const onAsphalt = (x, z) => x > L.carpark.x0 && x < L.carpark.x1 && z > -24 && z < L.carpark.z1;

  function show(p, on) {
    p.mesh.visible = on;
    if (!on) { _m.makeScale(0, 0, 0); blobs.setMatrixAt(p.i, _m); blobs.instanceMatrix.needsUpdate = true; streaks.setMatrixAt(p.i, _m); streaks.instanceMatrix.needsUpdate = true; }
  }

  API.spawn = (n = 1) => {
    let c = 0;
    const vs = vanList(); if (!vs.length) return 0;
    for (const p of list) {
      if (c >= n) break; if (p.state !== 'idle') continue;
      const D = L.dens[(p.i + c + ((G.frame | 0) % 4)) % L.dens.length];
      p.pos.set(D[0] + (Math.random() - 0.5) * 3, 0, Math.min(D[1], WORLD.max[2] - 0.4));
      p.pos.y = groundY(p.pos.x, p.pos.z);
      p.van = vs[Math.floor(Math.random() * vs.length)];
      p.state = 'walk'; p.vel.set(0, 0, 0); p.t = 0; p.yaw = 0; p.spin = 0; p.slide = 0; p.rear = 0; p.crouch = 0; p.shake = 0; p.trap = -1;
      show(p, true); c++;
    }
    return c;
  };
  API.active = () => { let c = 0; for (const p of list) if (p.state === 'walk' || p.state === 'raid' || p.state === 'blown') c++; return c; };
  API.reset = () => { for (const p of list) { p.state = 'idle'; show(p, false); } API.trapped = 0; };

  // ---------------------------------------------------------------- steering helpers
  // door-side waypoint: possums arriving from the wrong side of a van walk round its nearest end first
  function steerTarget(p, out) {
    const v = p.van, c = Math.cos(v.yaw), s = Math.sin(v.yaw);
    const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const hw = L.van.w / 2 + 0.25, hl = L.van.len / 2 + 0.3;
    if (lx < hw - 0.05 && Math.abs(lz) < hl + 1.5) {
      const ex = hw + 0.2, ez = (lz >= 0 ? 1 : -1) * (hl + 0.25);
      return out.set(v.pos.x + ex * c + ez * s, 0, v.pos.z - ex * s + ez * c);
    }
    return out.set(v.doorPos.x, 0, v.doorPos.z);
  }
  function pushOut(p) {
    const r = 0.2 * p.scale;
    for (const v of vanList()) {
      const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
      const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z;
      let lx = dx * c - dz * s, lz = dx * s + dz * c;
      const hw = L.van.w / 2 + r, hl = L.van.len / 2 + r;
      if (Math.abs(lx) < hw && Math.abs(lz) < hl) {
        const px = hw - Math.abs(lx), pz = hl - Math.abs(lz);
        if (px < pz) { lx = Math.sign(lx || 1) * hw; p.vel.x *= 0.5; } else { lz = Math.sign(lz || 1) * hl; p.vel.z *= 0.5; }
        p.pos.x = v.pos.x + lx * c + lz * s; p.pos.z = v.pos.z - lx * s + lz * c;
      }
    }
    for (let ti = 0; ti < traps.length; ti++) { // trap boxes are solid (except the mouth, handled by capture)
      const t = traps[ti].pos, dx = p.pos.x - t[0], dz = p.pos.z - t[2];
      if (Math.abs(dx) < 0.16 + r && Math.abs(dz) < 0.4 + r && p.state !== 'entering') {
        if (0.16 + r - Math.abs(dx) < 0.4 + r - Math.abs(dz)) p.pos.x = t[0] + Math.sign(dx || 1) * (0.16 + r);
        else p.pos.z = t[2] + Math.sign(dz || 1) * (0.4 + r);
      }
    }
    for (const q of list) { // possums keep a body length apart
      if (q === p || q.state === 'idle' || q.state === 'trapped') continue;
      const dx = p.pos.x - q.pos.x, dz = p.pos.z - q.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.16 && d2 > 1e-6) { const d = Math.sqrt(d2), k = (0.4 - d) * 0.5 / d; p.pos.x += dx * k; p.pos.z += dz * k; }
    }
    p.pos.x = Math.min(WORLD.max[0] - 0.5, Math.max(WORLD.min[0] + 0.5, p.pos.x));
    p.pos.z = Math.min(WORLD.max[2] - 0.2, Math.max(WORLD.min[2] + 0.5, p.pos.z));
  }

  // ---------------------------------------------------------------- render state → rig + blob
  function apply(p, dt) {
    const m = p.mesh;
    m.position.copy(p.pos); m.position.y += p.lift;
    m.rotation.set(p.pitch, p.yaw, p.roll);
    P.alert = p.alert; P.ph = p.ph; P.gait = p.gait; P.slide = p.slide; P.rear = p.rear; P.crouch = p.crouch; P.shake = p.shake;
    P.spin = p.spin; P.headYaw = p.headYaw; P.headPitch = p.headPitch; P.t = G.t + p.i * 0.37;
    if (p.slide > 0.01 && !API.frozen) m.rotation.z += Math.sin(P.t * 7) * 0.06 * p.slide; // body wobble on the slide
    // fur ruffle: airflow direction into possum-local space (rotation about Y by yaw), a little lift off the skin
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), R = p.ruf.ruffle.value;
    R.set(p.windX * cy - p.windZ * sy, 0.25, p.windX * sy + p.windZ * cy, p.ruffle);
    pose(p.rig, P);
    // blob: smaller + darker when flat on the ground, stretched when reared up
    const k = p.scale * (1 + 0.15 * p.slide - 0.25 * p.rear) * (1 - Math.min(0.5, p.lift * 3));
    _e.set(0, p.yaw, 0); _qq.setFromEuler(_e);
    // centred under the belly, not the hind-foot root (body spans local z -0.27..0.17)
    const fo = 0.06 * p.scale * (1 - p.rear);
    _q.set(p.pos.x - Math.sin(p.yaw) * fo, p.pos.y + 0.006, p.pos.z - Math.cos(p.yaw) * fo);
    _s.set(k * (1 + 0.3 * p.slide), 1, k * (1 - 0.35 * p.rear));
    _m.compose(_q, _qq, _s); blobs.setMatrixAt(p.i, _m); blobs.instanceMatrix.needsUpdate = true;
    // streak: local -Z of the plane points down-sun; length = height / tan(sun elevation), capped
    const sh = Math.max(0.08, sunDir.y), len = Math.min(1.6, (0.17 + 0.12 * p.rear - 0.07 * p.slide + p.lift) * p.scale * Math.hypot(sunDir.x, sunDir.z) / sh);
    _e.set(0, Math.atan2(sunDir.x, sunDir.z), 0); _qq.setFromEuler(_e);
    _q.set(p.pos.x, p.pos.y + 0.005, p.pos.z); _s.set(p.scale * (1 + 0.4 * p.slide), 1, len);
    _m.compose(_q, _qq, _s); streaks.setMatrixAt(p.i, _m); streaks.instanceMatrix.needsUpdate = true;
    void dt;
  }

  // ---------------------------------------------------------------- simulation
  API.update = (dt) => {
    if (G.paused || API.frozen) return;
    const camP = G.camera.position;
    for (const p of list) {
      if (p.state === 'idle' || p.state === 'trapped') continue;
      p.t += dt;
      let wantYaw = p.yaw, gaitT = 0, slideT = 0, rearT = 0, crouchT = 0, turn = 6;
      if (p.state === 'walk') {
        steerTarget(p, _a); _a.sub(p.pos); _a.y = 0;
        const d = Math.hypot(_a.x, _a.z);
        // a lazy wander while far away, straight in once the door is close
        const wob = Math.sin(G.t * 0.7 + p.wander) * 0.45 * Math.min(1, d / 6);
        const ux = _a.x / Math.max(d, 1e-3), uz = _a.z / Math.max(d, 1e-3);
        const dirx = ux - uz * wob, dirz = uz + ux * wob;
        const sp = p.speed * Math.min(1, 0.35 + d * 0.8);
        p.vel.x = smooth(p.vel.x, dirx * sp, 4, dt); p.vel.z = smooth(p.vel.z, dirz * sp, 4, dt);
        wantYaw = Math.atan2(-p.vel.x, -p.vel.z); gaitT = 1;
        const dd = Math.hypot(p.van.doorPos.x - p.pos.x, p.van.doorPos.z - p.pos.z);
        if (dd < 0.35) { p.state = 'raid'; p.t = 0; p.vel.set(0, 0, 0); G.emit('possum:raid', p, p.van); }
      } else if (p.state === 'raid') {
        p.vel.multiplyScalar(1 - Math.min(1, dt * 8));
        wantYaw = Math.atan2(Math.cos(p.van.yaw), -Math.sin(p.van.yaw)); // face the van side (−local X)
        rearT = 1; turn = 4;
        p.van.damage(dt * RAID_DPS, 'possum');
      } else if (p.state === 'blown') {
        const asp = onAsphalt(p.pos.x, p.pos.z), sp = Math.hypot(p.vel.x, p.vel.z);
        p.vel.multiplyScalar(1 - Math.min(1, dt * (asp ? 1.15 : 2.6)));
        p.spin *= 1 - Math.min(1, dt * 1.4);
        wantYaw = p.yaw + p.spin * dt; turn = 30;
        slideT = sp > 0.45 || p.t < 0.35 ? 1 : 0;
        // spray off the wet asphalt (dust on the verge) while sliding fast
        const f = fx();
        if (f && f.smoke && sp > 0.9) {
          p.spray += dt * sp * 9;
          while (p.spray >= 1) {
            p.spray -= 1;
            const o = asp ? SPRAY : DUST;
            o.vel.set(-p.vel.z * 0.35 + (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.5, p.vel.x * 0.35 + (Math.random() - 0.5) * 0.6);
            if (Math.random() < 0.5) o.vel.x = -o.vel.x, o.vel.z = -o.vel.z;
            o.vel.addScaledVector(p.vel, 0.35);
            _q.set(p.pos.x + (Math.random() - 0.5) * 0.2, p.pos.y + 0.03, p.pos.z + (Math.random() - 0.5) * 0.2);
            f.smoke(_q, o);
          }
        }
        if (sp < 0.3 && p.t > 0.6) { // stop → shake off → back to work
          p.shake = Math.max(0, 1 - (p.t - 0.6) / 0.8) * (p.t > 0.6 ? 1 : 0);
          if (p.t > 1.5) { p.state = 'walk'; p.t = 0; p.shake = 0; }
        }
        // capture: a blown possum reaching a trap mouth commits to it
        for (let ti = 0; ti < traps.length; ti++) {
          const m = traps[ti].mouth, dx = p.pos.x - m[0], dz = p.pos.z - m[2];
          if (dx * dx + dz * dz < TRAP_R * TRAP_R) { p.state = 'entering'; p.trap = ti; p.enterT = 0; p.vel.set(0, 0, 0); break; }
        }
      } else if (p.state === 'entering') {
        const tp = traps[p.trap], m = tp.mouth;
        p.enterT += dt;
        // line up on the mouth, then squeeze in along +Z (the mouth faces −Z)
        const tx = m[0], tz = p.enterT < 0.35 ? m[2] - 0.05 : tp.pos[2] + 0.25;
        p.pos.x = smooth(p.pos.x, tx, 10, dt);
        p.pos.z = p.enterT < 0.35 ? smooth(p.pos.z, tz, 8, dt) : Math.min(tz, p.pos.z + dt * 1.3);
        wantYaw = Math.PI; turn = 12; gaitT = 1.3; crouchT = 1;
        if (p.pos.z >= tz - 0.01 && p.enterT > 0.5) {
          p.state = 'trapped'; show(p, false); API.trapped++;
          const f = fx(); if (f && f.smoke) { _q.set(tp.pos[0], 0.34, tp.pos[2]); f.smoke(_q, THUMP); }
          G.emit('possum:trapped', p, p.trap);
          continue;
        }
      }

      // the blower: knocked flat and shoved along the airflow
      if (blower && blower.strengthAt && p.state !== 'entering') {
        _q.set(p.pos.x, p.pos.y + 0.15, p.pos.z);
        const s = blower.strengthAt(_q);
        if (s > BLOW_MIN) {
          blower.forceAt(_q, _f); _f.y = 0;
          p.vel.addScaledVector(_f, dt * PUSH_K);
          const fl = Math.hypot(_f.x, _f.z);
          if (fl > 1e-4) { p.windX = _f.x / fl; p.windZ = _f.z / fl; }
          p.ruffle = smooth(p.ruffle, Math.min(1, s * 1.5), 10, dt);
          // torque: airflow across the body spins it
          const hx = -Math.sin(p.yaw), hz = -Math.cos(p.yaw);
          p.spin += (hx * _f.z - hz * _f.x) * dt * 0.25;
          if (p.state !== 'blown') {
            // knocked off its feet: an immediate shove along the airflow, so even a long-range hit reads at once
            if (fl > 1e-4) { const kv = 0.9 + 2.2 * Math.min(1, s); p.vel.x += (_f.x / fl) * kv; p.vel.z += (_f.z / fl) * kv; }
            p.state = 'blown'; p.spray = 0; G.emit('possum:blown', p);
          }
          p.t = 0; p.shake = 0;
        }
      }

      if (p.state !== 'entering') { p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt; pushOut(p); }
      p.pos.y = groundY(p.pos.x, p.pos.z);

      // animation state
      const spd = Math.hypot(p.vel.x, p.vel.z);
      p.yaw += wrapA(wantYaw - p.yaw) * Math.min(1, turn * dt);
      p.yaw = wrapA(p.yaw);
      p.gait = smooth(p.gait, gaitT * Math.min(1, spd / 0.6 + (p.state === 'entering' ? 1 : 0)), 6, dt);
      p.ph += dt * (spd / 0.3 + (p.state === 'entering' ? 9 : 0)) * Math.PI * 2 * 0.5;
      p.slide = smooth(p.slide, slideT, slideT > p.slide ? 14 : 3, dt);
      p.rear = smooth(p.rear, rearT, 5, dt);
      p.crouch = smooth(p.crouch, crouchT, 8, dt);
      p.ruffle = smooth(p.ruffle, 0, 1.5, dt); p.roll = smooth(p.roll, 0, 6, dt); p.pitch = smooth(p.pitch, 0, 6, dt); p.lift = smooth(p.lift, 0, 8, dt);
      p.ruf.rufPh.value += dt * (6 + 30 * p.ruffle);
      // glance at the ranger when they are close (a possum always knows)
      const cx = camP.x - p.pos.x, cz = camP.z - p.pos.z, cd = Math.hypot(cx, cz);
      let hy = 0;
      if (cd < 7 && p.state === 'walk') hy = Math.max(-0.9, Math.min(0.9, wrapA(Math.atan2(-cx, -cz) - p.yaw)));
      p.headYaw = smooth(p.headYaw, hy, 3, dt);
      p.alert = smooth(p.alert, p.state === 'walk' ? (cd < 7 ? 1 : 0.35) : 0, 3, dt); // hunched + head up, more so near the ranger
      p.headPitch = smooth(p.headPitch, p.state === 'walk' ? -0.08 : 0, 3, dt);
      apply(p, dt);
    }
  };

  // ---------------------------------------------------------------- capture tableau
  // ?show=possums: the trap line. One possum caught in the blower's airflow mid-tumble (rolled onto a shoulder, paws
  // splayed, fur streaming downwind), glaring back at the ranger as it slides toward the mouth of trap T-015.
  // Plain ?shot (hero pose 5 looks at van B's cab from the north-west): a possum crossing the van's nose.
  if (G.params.get('shot') || G.params.get('show') === 'possums') {
    const v = vanList()[1];
    const sc = G.params.get('show') === 'possums';
    if (sc && traps[SHOW_TRAP]) {
      const p = list[6], m = traps[SHOW_TRAP].mouth; // the pale silver-grey coat: reads against the asphalt
      p.van = v || null; p.state = 'blown';
      p.pos.set(m[0] - 0.62, 0, m[2] - 1.12);
      p.yaw = 1.3; p.roll = -0.26; p.pitch = 0.06; p.lift = 0.02; p.slide = 0.6; p.spin = 0; p.gait = 0.3; p.ph = 1.9;
      const cx = SHOW_CAM[0] - p.pos.x, cz = SHOW_CAM[2] - p.pos.z;
      p.headYaw = Math.max(-0.9, Math.min(0.9, wrapA(Math.atan2(-cx, -cz) - p.yaw)));
      p.headPitch = -0.1;
      _a.set(m[0] - SHOW_CAM[0], 0, m[2] - SHOW_CAM[2]).normalize(); p.windX = _a.x; p.windZ = _a.z; p.ruffle = 1;
      p.ruf.rufPh.value = 1.3;
      show(p, true); apply(p, 0);
      if (blower) blower.forceFire = true; // the plume is the point of the shot
    } else if (v) {
      const p = list[0], cam = G.POSES?.[4] || SHOW_CAM;
      p.van = v; p.state = 'walk';
      p.pos.set(0.3, 0, 0.3); p.yaw = -Math.PI / 2 - 0.15;
      p.ph = 0.9; p.gait = 0.25; p.alert = 1; // caught mid-step: hunched, head up, ears pricked at the ranger
      const cx = cam[0] - p.pos.x, cz = cam[2] - p.pos.z;
      p.headYaw = Math.max(-0.9, Math.min(0.9, wrapA(Math.atan2(-cx, -cz) - p.yaw)));
      p.headPitch = 0.05;
      show(p, true); apply(p, 0);
    }
    // ?possums=lineup (inspection): every coat + every animation state around van B's door and trap T-015
    if (v && G.params.get('possums') === 'lineup') lineup(v);
    API.frozen = true;
  }
  function lineup(v) {
    const set = (i, x, z, yaw, o) => {
      const p = list[i]; p.van = v; p.state = o.state || 'walk'; p.pos.set(x, 0, z); p.yaw = yaw;
      p.ph = o.ph ?? 0; p.gait = o.gait ?? 0; p.slide = o.slide ?? 0; p.rear = o.rear ?? 0; p.crouch = o.crouch ?? 0;
      p.shake = o.shake ?? 0; p.alert = o.alert ?? (p.state === 'walk' ? 1 : 0); p.spin = o.spin ?? 0; p.headYaw = o.hy ?? 0; p.headPitch = o.hp ?? 0;
      show(p, true); apply(p, 0);
    };
    const d = v.doorPos;
    set(1, d.x + 0.12, d.z + 0.05, Math.atan2(Math.cos(v.yaw), -Math.sin(v.yaw)), { state: 'raid', rear: 1 });
    set(2, 3.4, 3.6, 1.2, { state: 'blown', slide: 1, spin: 3 });
    set(3, 2.9, 1.5, -0.6, { gait: 1, ph: 2.6 });
    set(4, 3.6, 2.6, 2.2, { gait: 0.2, shake: 0.8 });
    if (traps[1]) { const m = traps[1].mouth; set(5, m[0], m[2] - 0.1, Math.PI, { state: 'entering', crouch: 1, gait: 1, ph: 1.4 }); }
    set(6, 4.3, 1.4, -1.9, { gait: 0.6, ph: 4.0, hy: 0.6 });
    set(7, 1.7, 1.2, 0.3, { gait: 0, hy: -0.5, hp: 0.2 });
  }
  return API;
}

export function showcase() { return { cam: SHOW_CAM, target: SHOW_TARGET }; }
