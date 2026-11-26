// keaplayer/view — the kea's own view model (the hero object of kea mode), drawn as the post pipeline's first-person
// overlay (own Scene + PerspectiveCamera, depthRange 0..0.05, like the blower):
//   * the head and beak in three-quarter profile from the right eye: a feathered olive-bronze face mound in the lower
//     left corner, the deep grey-brown upper mandible with its down-curved hook (paler worn tip), grey cere + nostrils;
//     the short lower mandible drops (tongue, mouth) on a squawk / peck and clamps / wiggles on a pull; a carried part
//     hangs from the hook on a pendulum
//   * the wings' leading edges sweep in from the sides on every downstroke, the scarlet-orange underwing flashing
//   * springs for look sway, hop bob, landing dip, flap heave; everything snaps to target under ?shot
// Draw calls: beak upper (1) + lower (1) + feathers: face + both wings, one skinned-by-uniform mesh (1) + part (1) = 4.
//   createView(G, { atlas }) → { overlay: { scene, camera }, update(dt, S), setPart(kind|null), calls }
import { Scene, PerspectiveCamera, Mesh, Group, Object3D, MeshStandardMaterial, HemisphereLight, DirectionalLight, Color, Euler,
  Quaternion, Matrix4, Vector3 } from 'three';
import { Spring } from '../../cookbook/engine/springs.js';
import { patch, after } from '../../cookbook/engine/patch.js';
import { KEA_PLAYER as K } from '../../contracts.js';
import { buildBeak, buildFeathers, buildParts, BEAK, FACE } from './geo.js';
import { bakeBeakTextures } from './tex.js';

// rest pose of each carried part under the hook (Euler XYZ, metres in head space, scale): tipped forward and swung out
// to the right of the hook so the beak (between it and the eye) never hides it and it stays below the crosshair
const PART_POSE = {
  wiper:  { x: 0.0, y: 0.0, z: 0.0, rx: 0.9, ry: 0.3, rz: 0.55, s: 0.8 },   // held by the clip, drooping down and right
  seal:   { x: 0.0, y: 0.0, z: 0.0, rx: 1.0, ry: 0.0, rz: 0.7, s: 1.0 },
  mirror: { x: 0.0, y: 0.0, z: 0.0, rx: 1.0, ry: 0.4, rz: 0.6, s: 1.0 },
  strap:  { x: 0.0, y: 0.0, z: 0.0, rx: 1.0, ry: 0.0, rz: 0.6, s: 1.0 },
  cone:   { x: 0.0, y: 0.0, z: 0.0, rx: 1.1, ry: 0.0, rz: 0.75, s: 0.35 },
};
const SHOULDER = [0.06, -0.066, 0.05];
// the right eye's view: a kea's eyes are on the sides of its head, level with the cere, so the beak is seen in
// three-quarter profile from the left of the frame — base in the feathers at the left edge, culmen running in toward
// the centre, the hook dropping away below the crosshair. Yawed in so its right flank faces the eye (a top-down view of
// a beak reads as a horn or a thumb; the profile is what says "parrot")
const REST_B = { rx: -0.05, ry: -0.8, rz: 0.05 };

const _q = new Quaternion(), _qi = new Quaternion(), _e = new Euler(), _m = new Matrix4(), _m2 = new Matrix4(), _v = new Vector3(), _fwd = new Vector3();
const _ex = new Euler(0, 0, 0, 'YZX');
const TAU = Math.PI * 2;

export function createView(G, { atlas } = {}) {
  const SHOT = !!G.params.get('shot');
  const scene = new Scene(); scene.name = 'keaplayer.overlay';
  const camera = new PerspectiveCamera(K.viewFov, G.width / G.height, 0.004, 10);

  // ---- materials (lit like the blower's view model: hemi + sun in view space + rim + bounce)
  const bt = bakeBeakTextures(256);
  const beakMat = new MeshStandardMaterial({ map: bt.map, roughnessMap: bt.roughnessMap, normalMap: bt.normalMap, roughness: 1, metalness: 0, vertexColors: true });
  beakMat.normalScale.set(0.35, 0.35); beakMat.envMapIntensity = 0.6; beakMat.name = 'keaplayer:beak';
  const at = atlas || {};
  const featherMat = new MeshStandardMaterial({ map: at.map || null, roughnessMap: at.roughnessMap || null, normalMap: at.normalMap || null, roughness: 1, metalness: 0, vertexColors: true });
  featherMat.normalScale.set(0.55, 0.55); featherMat.name = 'keaplayer:feathers';
  const U = {
    uHeadM: { value: new Matrix4() }, uWingL: { value: new Matrix4() }, uWingR: { value: new Matrix4() },
    uFlashL: { value: 0 }, uFlashR: { value: 0 },
  };
  patch(featherMat, 'keavm', (shader) => {
    Object.assign(shader.uniforms, U);
    let vs = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSide;\nattribute float aUnder;\nuniform mat4 uHeadM;\nuniform mat4 uWingL;\nuniform mat4 uWingR;\nvarying float vUnder;\nvarying float vSide;');
    vs = after(vs, '#include <beginnormal_vertex>', 'mat4 kM = aSide > 0.5 ? uWingR : (aSide < -0.5 ? uWingL : uHeadM);\nobjectNormal = normalize(mat3(kM) * objectNormal);');
    vs = after(vs, '#include <begin_vertex>', 'transformed = (kM * vec4(transformed, 1.0)).xyz;\nvUnder = aUnder; vSide = aSide;');
    shader.vertexShader = vs;
    let fs = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uFlashL;\nuniform float uFlashR;\nvarying float vUnder;\nvarying float vSide;');
    // the underwing coverts glow when the low sun comes through them (thin, translucent feathers): an orange flash
    fs = after(fs, '#include <emissivemap_fragment>', 'totalEmissiveRadiance += diffuseColor.rgb * vUnder * (vSide > 0.0 ? uFlashR : uFlashL);');
    shader.fragmentShader = fs;
  });
  const partMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
  partMat.name = 'keaplayer:part';

  // ---- rig: head → upper mandible (hinge) → lower jaw / grip → swing → part
  const B = buildBeak(), F = buildFeathers(), P = buildParts();
  const head = new Group(); head.name = 'kea:head';
  const upper = new Mesh(B.upper, beakMat); upper.position.copy(B.hinge); upper.name = 'kea:beak';
  const jaw = new Object3D(); jaw.position.copy(B.jaw);
  const lower = new Mesh(B.lower, beakMat); lower.name = 'kea:jaw';
  jaw.add(lower); upper.add(jaw);
  // the grip point sits in the hook; the part's swing rig hangs from it in HEAD space (so parts hang down the screen)
  const gripLocal = new Vector3(B.tip.x, B.tip.y + 0.008, B.tip.z + 0.003);
  const swing = new Object3D(); head.add(swing);
  const part = new Mesh(P.wiper, partMat); part.visible = false; part.name = 'kea:part'; swing.add(part);
  head.add(upper);
  const feathers = new Mesh(F, featherMat); feathers.name = 'kea:feathers'; feathers.frustumCulled = false; feathers.matrixAutoUpdate = false;
  for (const m of [upper, lower, part]) m.frustumCulled = false;
  scene.add(head, feathers);
  const parts = P;

  const hemi = new HemisphereLight(new Color(0.62, 0.68, 0.8), new Color(0.24, 0.2, 0.16), 0.9);
  const key = new DirectionalLight(new Color().copy(G.sun.color), G.sun.intensity * 0.3);
  const fill = new DirectionalLight(new Color(0.55, 0.65, 0.85), 0.5); fill.position.set(-0.6, 0.5, 0.8);
  const rim = new DirectionalLight(new Color(1.0, 0.72, 0.46), G.sun.intensity * 0.16);
  const bounce = new DirectionalLight(new Color(0.78, 0.7, 0.6), 0.7); bounce.position.set(0.25, -0.15, 1);
  const under = new DirectionalLight(new Color(0.85, 0.62, 0.4), 0.55); under.position.set(0, -1, 0.35);   // warm ground bounce on the underwing
  scene.add(hemi, key, key.target, fill, fill.target, rim, rim.target, bounce, bounce.target, under, under.target);
  scene.environmentIntensity = (G.ART?.ambient?.envIntensity ?? 1.25) * 0.9;

  // ---- springs
  const sway = new Spring(110, 15), swayY = new Spring(110, 15), roll = new Spring(260, 20), bob = new Spring(180, 16), land = new Spring(140, 11);
  const jawS = new Spring(420, 24), raise = new Spring(300, 22), tug = new Spring(500, 18), wig = new Spring(700, 16);
  const swX = new Spring(60, 3.2), swZ = new Spring(60, 3.2), heave = new Spring(260, 14);
  const fold = new Spring(90, 16);                                   // 0 spread (flying) … 1 folded (out of view)
  const flapA = new Spring(140, 18);                                 // flap amplitude 0..1
  const SPR = [sway, swayY, roll, bob, land, jawS, raise, tug, wig, swX, swZ, heave, fold, flapA];
  let lastYaw = 0, lastPitch = 0, first = true, partKind = null, wasGrounded = true;

  const V = {
    overlay: { scene, camera }, calls: 4, head, upper, jaw, part, feathers, materials: [beakMat, featherMat, partMat],
    pose: null,     // showcase/capture override: { phase, flap, fold, jaw, pull, squawk, peck } (fixed, no time)
    rest: REST_B,
  };
  // dev hook: retune the beak / face live (window.__G.mods.keaplayer.view.rebuild({ L: .1 }, { r: [...] }, { rz: .3 }))
  V.rebuild = (bo, fo, ro) => {
    if (bo) Object.assign(BEAK, bo); if (fo) Object.assign(FACE, fo); if (ro) Object.assign(REST_B, ro);
    const nb = buildBeak(), nf = buildFeathers();
    upper.geometry.dispose(); lower.geometry.dispose(); feathers.geometry.dispose();
    upper.geometry = nb.upper; lower.geometry = nb.lower; feathers.geometry = nf;
    upper.position.copy(nb.hinge); jaw.position.copy(nb.jaw); gripLocal.set(nb.tip.x, nb.tip.y + 0.008, nb.tip.z + 0.003);
  };
  V.setPart = (kind) => {
    partKind = kind && parts[kind] ? kind : null;
    part.visible = !!partKind;
    if (!partKind) return;
    part.geometry = parts[partKind];
    const p = PART_POSE[partKind];
    part.position.set(p.x, p.y, p.z); part.rotation.set(p.rx, p.ry, p.rz); part.scale.setScalar(p.s);
    swX.impulse(2.5); swZ.impulse(-1.5);
  };

  // wing transform in head space: shoulder → sweep (about y) → flap (about the chord axis z) → twist (about the span)
  function wingMatrix(out, side, flap, sweep, twist, sh) {
    _ex.set(twist, side * sweep, side * flap);
    out.makeRotationFromEuler(_ex);
    out.setPosition(side * SHOULDER[0], SHOULDER[1] + sh, SHOULDER[2]);
    return out;
  }

  V.update = (dt, S, live) => {
    if (!scene.environment && G.env) scene.environment = G.env;
    const vis = live;
    head.visible = vis; feathers.visible = vis;
    if (!vis) return;
    // aspect follows the canvas (post resizes the overlay camera only for the overlay it was built with)
    const asp = G.width / Math.max(1, G.height);
    if (Math.abs(camera.aspect - asp) > 1e-4) { camera.aspect = asp; camera.updateProjectionMatrix(); }

    // view-space lighting follows the world camera
    G.camera.getWorldQuaternion(_q); _qi.copy(_q).invert();
    key.position.copy(G.sun.dir).applyQuaternion(_qi).multiplyScalar(5);
    rim.position.set(Math.sign(key.position.x || 1) * 0.55 + key.position.x * 0.1, 0.45, -1).normalize();
    _e.setFromQuaternion(_qi); scene.environmentRotation.copy(_e);
    hemi.position.set(0, 1, 0).applyQuaternion(_qi);
    _fwd.set(0, 0, -1).applyQuaternion(_q);
    const sunBack = Math.max(0, -_fwd.dot(G.sun.dir));                // sun behind the wing (facing away from the sun → backlit underwing seen from below)

    const t = G.t || 0, po = V.pose;
    // look sway (the head lags the turn a touch)
    const yaw = Math.atan2(_fwd.x, _fwd.z), pitch = Math.asin(Math.max(-1, Math.min(1, _fwd.y)));
    let dy = yaw - lastYaw; if (dy > Math.PI) dy -= TAU; if (dy < -Math.PI) dy += TAU;
    if (first) { dy = 0; lastPitch = pitch; first = false; }
    const inv = dt > 0 ? 1 / dt : 0;
    sway.target = Math.max(-0.02, Math.min(0.02, dy * inv * 0.004)); swayY.target = Math.max(-0.012, Math.min(0.012, (pitch - lastPitch) * inv * 0.003));
    roll.target = -sway.target * 3;
    lastYaw = yaw; lastPitch = pitch;

    // ground gait / flight heave
    const hs = S.hspeed || 0;
    bob.target = S.grounded ? -Math.abs(Math.sin(S.hopPhase || 0)) * 0.006 * Math.min(1, hs / K.walk) : 0;
    if (S.grounded && !wasGrounded) land.impulse(-0.25);
    wasGrounded = S.grounded;

    // beak: squawk opens wide and lifts the upper mandible; a pull clamps and worries the part side to side
    const pulling = (po ? po.pull : S.pulling > 0 && S.pullActive) ? 1 : 0;
    const sq = po ? po.squawk || 0 : S.squawkOpen || 0;
    const pk = po ? po.peck || 0 : S.peck || 0;                               // a click: lunge forward, beak snaps open then shut
    jawS.target = Math.max(pk * 0.7, sq * 1.0, pulling ? 0.1 + 0.08 * Math.max(0, Math.sin(t * 9)) : 0, partKind ? 0.07 : 0, S.tumble > 0 ? 0.6 : 0, po && po.jaw || 0);
    raise.target = sq * 1 + (S.tumble > 0 ? 0.4 : 0);
    tug.target = pulling ? 0.5 + 0.5 * Math.sin(t * 7.3) : 0;
    wig.target = pulling ? Math.sin(t * 13.7) * 0.6 + Math.sin(t * 5.1) * 0.4 : (S.tumble > 0 ? Math.sin(t * 23) : 0);

    // wings: fold when grounded, spread in flight, beat while flapping
    fold.target = po ? (po.fold ?? 0) : (S.flying || S.tumble > 0 ? 0 : 1);
    flapA.target = po ? (po.flap ?? 1) : (S.flapping ? 1 : S.tumble > 0 ? 0.8 : 0);
    if (S.flapped) heave.impulse(0.18);

    // part pendulum: trails the turn and the airspeed, kicks on landing and on every wingbeat
    if (partKind) {
      swX.target = Math.min(0.5, (S.fspeed || 0) * 0.035) - swayY.x * 4;
      swZ.target = -dy * inv * 0.05 + (S.strafe || 0) * 0.08;
      if (S.flapped) swX.impulse(0.6);
    }
    const SPRs = SPR;
    for (let i = 0; i < SPRs.length; i++) SPRs[i].update(dt);
    if (SHOT || po) for (let i = 0; i < SPRs.length; i++) SPRs[i].set(SPRs[i].target);

    // head rig
    const idle = SHOT ? 0 : 0.0006 * Math.sin(t * 1.7);
    // a peck: the head stays anchored on the eye (the face mound never slides off its frame edge) and only nods and
    // thrusts a little; the beak itself pivots down at the cere and stabs forward
    head.position.set(sway.x * 0.5 + idle, -swayY.x * 0.5 + bob.x + land.x * 0.02 + heave.x * -0.01, tug.x * 0.006 - pk * 0.012);
    head.rotation.set(-swayY.x * 0.6 - (pulling ? 0.06 : 0) - pk * 0.1 + raise.x * 0.08 - (partKind === 'cone' ? 0.04 : 0), sway.x * 0.8 + wig.x * 0.07, roll.x + wig.x * 0.03, 'YXZ');
    upper.rotation.set(raise.x * 0.22 - pk * 0.22 + REST_B.rx, REST_B.ry, REST_B.rz);
    upper.position.z = BEAK.hinge[2] - pk * 0.014;
    upper.updateMatrix(); swing.position.copy(gripLocal).applyMatrix4(upper.matrix);
    jaw.rotation.x = -jawS.x * 0.55;
    swing.rotation.set(swX.x, 0, swZ.x);
    head.updateMatrixWorld(true);
    U.uHeadM.value.copy(head.matrixWorld);

    // wingbeat: φ 0 = top of the stroke; the downstroke (φ 0 → .5) sweeps the leading edge forward and down through
    // the sides of the frame, the underside (orange) toward the eye while the wing is still above it
    const ph = po ? po.phase : S.flapPhase || 0, a = flapA.x, f = fold.x;
    const c = Math.cos(TAU * ph), s = Math.sin(TAU * ph);
    const glideFlap = 0.08 - 0.02 * Math.sin(t * 1.3), glideSweep = 0.28;
    let flap = glideFlap * (1 - a) + (0.4 + 0.9 * c) * a;
    let sweep = glideSweep * (1 - a) + (0.5 + 0.7 * Math.max(0, s) - 0.25 * Math.max(0, -s)) * a;
    let twist = 1.15 * Math.max(0, s) * a - 0.2 * Math.min(0, s) * a;   // pronate on the downstroke: the underside turns to the eye
    if (S.tumble > 0 && !po) { flap += Math.sin(t * 17) * 0.5; sweep += Math.sin(t * 11 + 1) * 0.3; }
    // folded: wings swing back along the flank, out of the frustum
    flap = flap * (1 - f) - 0.25 * f; sweep = sweep * (1 - f) - 1.3 * f; twist *= 1 - f;
    const sh = -heave.x * 0.02;
    wingMatrix(U.uWingR.value, 1, flap, sweep, twist, sh);
    wingMatrix(U.uWingL.value, -1, flap, sweep, twist, sh);
    // the flash: strongest on the downstroke while the wing is up and swept in, more when the sun is behind it
    const fl = Math.max(0, s) * Math.max(0, c + 0.3) * a * (1 - f);
    U.uFlashL.value = U.uFlashR.value = (0.04 + 0.22 * fl) * (0.55 + 0.45 * sunBack) * (1 - f * 0.9);
  };
  return V;
}
