// the frozen capture tableau (?shot / ?show=kea): on the middle van, one kea working the driver-side mirror, one
// tugging the wiper with a wing flicked open (orange underwing), and one mid-tumble in the airflow with loose feathers.
import { Vector3 } from 'three';

const _v = new Vector3();
export function dressTableau(G, API, vans, feathers) {
  const v = vans[1] || vans[0];
  if (!v || !v.perches || v.perches.length < 2) return false;
  const [k0, k1, k2] = API.list;
  const face = (k, p, extra = 0) => { _v.subVectors(v.pos, p); k.yaw = Math.atan2(-_v.x, -_v.z) + extra; };
  // the hero cameras (?show=kea and shot pose 5) sit south-west of the cab; perched birds turn to give it a profile
  const CAM_X = -2.3, CAM_Z = -1.8;
  const faceCam = (k, extra = 0) => { k.yaw = Math.atan2(-(CAM_X - k.pos.x), -(CAM_Z - k.pos.z)) + extra; };
  // 0: mirror — mid-look, turned three-quarters to the ranger with one eye: the side-eye
  Object.assign(k0, { state: 'perched', van: v, perch: v.perches[0], perchIdx: 0, target: 'mirror', visible: true, act: 'look',
    fold: 1, roll: 0, bend: 0, hp: 0.12, hy: 0.55, tp: -0.2, bp: 0.42, tuck: 0, fan: 0.1, ruffle: 0.4, crest: 0.6, sweep: 0, pitch: 0, bank: 0 });
  k0.pos.copy(k0.perch); k0.pos.y -= API.tuning.perchDrop[0]; faceCam(k0, 1.15);
  // 1: wiper — side-on to the ranger, braced back, tugging the blade, near wing flicked open (orange underwing)
  Object.assign(k1, { state: 'perched', van: v, perch: v.perches[1], perchIdx: 1, target: 'wiper', visible: true, act: 'tug',
    fold: 0.72, roll: 0.45, bend: 0.1, hp: -0.7, hy: -0.2, tp: -0.4, bp: 0.5, tuck: 0, fan: 0.3, ruffle: 1, crest: 1, sweep: 0, pitch: 0, bank: 0, offended: 1 });
  k1.pos.copy(k1.perch); face(k1, k1.perch, -1.25);
  // 2: knocked back in the blower stream, ~2.4 m out from the hero camera: facing the ranger, pitched back, both wings
  //    flung up mid-beat with the wrists bent and the primaries fingered open, tail fanned, legs tucked, crest up, ruffled
  Object.assign(k2, { state: 'blown', van: v, perch: null, visible: true, scale: 1.0,
    fold: 0.0, roll: 0.62, bend: -0.55, hp: 0.35, hy: 0.35, tp: -0.45, bp: 0.12, tuck: 1, fan: 1, ruffle: 0.85, crest: 1, sweep: 0.12, pitch: 0.42, bank: -0.32 });
  const fwdX = -Math.sin(v.yaw), fwdZ = -Math.cos(v.yaw);
  k2.pos.set(v.pos.x + fwdX * 3.85 + 0.05, 2.42, v.pos.z + fwdZ * 3.85);
  k2.yaw = -0.25; k2.tq.identity();
  // a few loose contour feathers torn out and trailing downwind of it (away from the blower), two settled on the asphalt
  const dx = 0.73, dz = 0.68;   // blower stream direction at the hero pose
  const F = [[0.18, 0.06, 1.1, 0.4, 2.1, 0.7], [0.3, -0.08, 0.2, 2.5, 0.9, 0.6], [0.42, 0.14, 2.2, 1.1, 0.3, 0.65], [0.55, -0.02, 0.8, 0.2, 1.7, 0.55]];
  for (const f of F) { _v.set(k2.pos.x + dx * f[0] + (f[1] * 0.5), k2.pos.y + 0.1 + f[1], k2.pos.z + dz * f[0] - f[1] * 0.4); feathers.place(_v, f[2], f[3], f[4], f[5]); }
  _v.set(v.pos.x + fwdX * 3.6 + 0.4, 0.004, v.pos.z + fwdZ * 3.6); feathers.place(_v, 0, 0.7, 0, 1.0);
  _v.set(v.pos.x + fwdX * 4.6 - 1.2, 0.004, v.pos.z + fwdZ * 4.6); feathers.place(_v, 0, 2.3, 0, 0.8);
  // perched birds a touch larger (big males run ~50 cm) so they read at van distance
  k0.scale = 1.08; k1.scale = 1.1;
  return true;
}

// look-dev lineup (?keadev=1): six poses on the open apron west of the spawn, for close inspection
export function dressLineup(G, API) {
  const P = [
    { fold: 1, roll: 0, hp: 0.15, hy: 0.6, bp: 0.45, tp: -0.12, tuck: 0 },                           // perched, looking
    { fold: 1, roll: 0, hp: -0.95, hy: 0.15, bp: 0.14, tp: -0.25, tuck: 0 },                         // pecking
    { fold: 0.45, roll: 0.8, hp: 0.1, bp: 0.5, tp: -0.3, tuck: 0, fan: 0.3 },                        // wing flick
    { fold: 0.02, roll: 0.12, bend: 0.06, hp: -0.15, bp: 0, tp: -0.05, tuck: 1, fan: 0.25, y: 0.5 }, // glide
    { fold: 0.04, roll: 1.0, bend: -0.4, hp: -0.1, bp: 0, tp: -0.1, tuck: 1, fan: 0.3, y: 0.5 },    // upstroke
    { fold: 1, roll: 0, hp: 0.25, hy: -0.4, bp: 0.5, tp: -0.2, tuck: 0, ruffle: 1, crest: 1 },       // OFFENDED
  ];
  P.forEach((o, i) => {
    const k = API.list[i];
    Object.assign(k, { state: 'perched', visible: true, bend: 0, hy: 0, fan: 0.05, ruffle: 0, crest: 0, sweep: 0, pitch: 0, bank: 0 }, o);
    k.pos.set(-6.6 + i * 0.55, (o.y || 0), -4); k.yaw = i < 3 ? -1.2 : i === 5 ? -1.0 : -1.57;
  });
  return true;
}
