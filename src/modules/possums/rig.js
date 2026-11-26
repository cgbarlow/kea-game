// possums/rig — one skinned possum instance (Group → root bone + base SkinnedMesh + shell SkinnedMesh sharing one
// Skeleton) and the procedural pose solver. Allocation-free: pose() only writes bone transforms.
//   const r = makeRig(geo, mats); r.group.position…; pose(r, P) with P = {
//     ph (gait phase, rad), gait 0..1 (stride amplitude), slide 0..1 (splayed belly-slide), rear 0..1 (up on the
//     hind legs at a door), crouch 0..1 (squeeze into a trap), shake 0..1 (post-slide shake-off), spin (rad/s, tail
//     streams), headYaw, headPitch (rad), t (s) }
import { Group, Bone, Skeleton, SkinnedMesh } from 'three';
import { BONES, B } from './geo.js';

const TAIL_REST = [0.3, 0.24, -0.12, -0.42];

export function makeRig(geo, mats) {
  const group = new Group();
  const bones = BONES.map(([name]) => { const b = new Bone(); b.name = 'possum_' + name; return b; });
  const rest = [];
  BONES.forEach(([, parent, pos], i) => {
    const pp = parent >= 0 ? BONES[parent][2] : [0, 0, 0];
    bones[i].position.set(pos[0] - pp[0], pos[1] - pp[1], pos[2] - pp[2]);
    rest.push(bones[i].position.clone());
    if (parent >= 0) bones[parent].add(bones[i]);
  });
  group.add(bones[0]);
  const base = new SkinnedMesh(geo.base, [mats.fur, mats.wet]);
  const shell = new SkinnedMesh(geo.shell, mats.shell);
  base.name = 'possum'; shell.name = 'possumShell';
  base.castShadow = true; base.receiveShadow = true;
  shell.castShadow = false; shell.receiveShadow = true;
  base.frustumCulled = false; shell.frustumCulled = false; // pose changes a lot; 3 k tris each — never wrongly culled
  group.add(base, shell);
  group.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones);
  base.bind(skeleton); shell.bind(skeleton);
  return { group, bones, rest, base, shell, skeleton };
}

export function pose(r, P) {
  const b = r.bones, R = r.rest;
  for (let i = 0; i < b.length; i++) { b[i].rotation.set(0, 0, 0); b[i].position.copy(R[i]); }
  const s = Math.sin(P.ph), c = Math.cos(P.ph), A = P.gait, sl = P.slide, re = P.rear, cr = P.crouch, t = P.t;

  // ---- gait (diagonal trot with a waddle: the rump rolls over each hind leg)
  const sw = 0.5 * A;
  const legA = [sw * s, -sw * s, -sw * s * 1.1, sw * s * 1.1]; // FL FR RL RR
  const lift = [Math.max(0, c), Math.max(0, -c), Math.max(0, -c), Math.max(0, c)];
  const L4 = [B.FL, B.FR, B.RL, B.RR];
  for (let k = 0; k < 4; k++) {
    const bn = b[L4[k]];
    bn.rotation.x = legA[k];
    bn.position.y += 0.012 * A * lift[k];
  }
  b[B.pelvis].rotation.z = 0.11 * A * s;
  b[B.pelvis].rotation.y = 0.07 * A * s;
  b[B.chest].rotation.z = -0.07 * A * s;
  b[B.chest].rotation.y = -0.05 * A * s;
  b[B.root].position.y += 0.005 * A * (1 - Math.cos(2 * P.ph)) * 0.5;

  // ---- head: look + gait stabilisation
  b[B.head].rotation.y = P.headYaw * 0.6 + 0.05 * A * s;
  b[B.chest].rotation.y += P.headYaw * 0.4;
  b[B.head].rotation.x = P.headPitch + 0.035 * A * Math.sin(2 * P.ph + 0.6);

  // ---- tail: resting droop + travelling sway wave
  for (let k = 0; k < 4; k++) {
    const tb = b[B.tail0 + k];
    tb.rotation.x = TAIL_REST[k] * (1 - 0.7 * sl);
    tb.rotation.y = (0.16 + 0.05 * k) * A * Math.sin(P.ph - 0.9 - k * 0.6) + P.spin * 0.08 * (k + 1) * sl;
  }

  // ---- belly slide (blown across the wet asphalt): legs splayed, body flat on the ground, head up
  if (sl > 0) {
    b[B.root].position.y -= 0.05 * sl;
    for (let k = 0; k < 4; k++) {
      const bn = b[L4[k]], left = k === 0 || k === 2, front = k < 2;
      bn.rotation.x = bn.rotation.x * (1 - sl) + (front ? 0.85 : -1.0) * sl;
      bn.rotation.z = (left ? -1 : 1) * 0.75 * sl + 0.1 * sl * Math.sin(t * 13 + k * 1.7);
    }
    b[B.head].rotation.x += 0.35 * sl;
    b[B.pelvis].rotation.z += 0.08 * sl * Math.sin(t * 9);
    b[B.tail0].rotation.x -= 0.25 * sl;
  }

  // ---- rear up at the van door: hips stay over the hind feet, front paws scratch at the door seal
  if (re > 0) {
    const a = 0.95 * re;
    b[B.pelvis].rotation.x += a;
    b[B.pelvis].position.y += 0.025 * re;
    b[B.RL].rotation.x = b[B.RL].rotation.x * (1 - re) - a;
    b[B.RR].rotation.x = b[B.RR].rotation.x * (1 - re) - a;
    b[B.FL].rotation.x = b[B.FL].rotation.x * (1 - re) + re * (0.9 + 0.45 * Math.sin(t * 11));
    b[B.FR].rotation.x = b[B.FR].rotation.x * (1 - re) + re * (0.9 + 0.45 * Math.sin(t * 11 + 2.2));
    b[B.FL].rotation.z = -0.15 * re; b[B.FR].rotation.z = 0.15 * re;
    b[B.head].rotation.x -= 0.55 * re;
    b[B.head].rotation.z = 0.12 * re * Math.sin(t * 1.7);
    b[B.tail0].rotation.x -= a * 0.85;
  }

  // ---- crouch (squeezing through the trap-box mouth)
  if (cr > 0) {
    b[B.root].position.y -= 0.03 * cr;
    b[B.head].rotation.x -= 0.2 * cr;
    for (let k = 0; k < 4; k++) b[L4[k]].rotation.z = (k === 0 || k === 2 ? -1 : 1) * 0.3 * cr;
  }

  // ---- shake-off after a slide (wet dog, but deadpan)
  if (P.shake > 0) {
    const w = Math.sin(t * 34) * P.shake;
    b[B.chest].rotation.z += 0.32 * w;
    b[B.pelvis].rotation.z -= 0.22 * w;
    b[B.head].rotation.z = 0.25 * w;
  }
}
