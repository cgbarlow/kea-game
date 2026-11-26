// the frozen capture tableau (?shot / ?show=kea): on the middle van, one kea working the driver-side mirror, one
// tugging the wiper with a wing flicked open (orange underwing), and one mid-tumble in the airflow with loose feathers.
import { Vector3 } from 'three';

const _v = new Vector3();
export function dressTableau(G, API, vans, feathers) {
  const v = vans[1] || vans[0];
  if (!v || !v.perches || v.perches.length < 2) return false;
  const [k0, k1, k2] = API.list;
  const face = (k, p, extra = 0) => { _v.subVectors(v.pos, p); k.yaw = Math.atan2(-_v.x, -_v.z) + extra; };
  // 0: mirror — mid-peck, leaning in
  Object.assign(k0, { state: 'perched', van: v, perch: v.perches[0], perchIdx: 0, target: 'mirror', visible: true, act: 'peck',
    fold: 1, roll: 0, bend: 0, hp: -0.95, hy: 0.2, tp: -0.25, bp: 0.14, tuck: 0, fan: 0.05, ruffle: 0, crest: 0, sweep: 0, pitch: 0, bank: 0 });
  k0.pos.copy(k0.perch); k0.pos.y -= API.tuning.perchDrop[0]; face(k0, k0.perch, 0.35);
  // 1: wiper — braced back, tugging, left wing flicked open
  Object.assign(k1, { state: 'perched', van: v, perch: v.perches[1], perchIdx: 1, target: 'wiper', visible: true, act: 'tug',
    fold: 0.72, roll: 0.45, bend: 0.1, hp: -0.8, hy: -0.3, tp: -0.4, bp: 0.5, tuck: 0, fan: 0.3, ruffle: 1, crest: 1, sweep: 0, pitch: 0, bank: 0, offended: 1 });
  k1.pos.copy(k1.perch); face(k1, k1.perch, -0.25);
  // 2: mid-tumble, 0.9 m off the cab front, wings splayed, tail fanned, upside-down-ish
  Object.assign(k2, { state: 'blown', van: v, perch: null, visible: true,
    fold: 0.1, roll: 0.55, bend: -0.5, hp: 0.55, hy: 0.7, tp: -0.6, bp: 0.25, tuck: 0.3, fan: 1, ruffle: 0.7, crest: 0.8, sweep: 0.3, pitch: -0.55, bank: 1.15 });
  const fwdX = -Math.sin(v.yaw), fwdZ = -Math.cos(v.yaw);
  k2.pos.set(v.pos.x + fwdX * 4.3 - 1.25, 2.25, v.pos.z + fwdZ * 4.3);
  k2.yaw = v.yaw + 2.2; k2.tq.identity();
  // loose feathers trailing the tumbler, two settled on the bonnet / asphalt
  const F = [[0.25, 0.12, -0.18, 1.1, 0.4, 2.1], [-0.3, 0.3, 0.1, 0.2, 2.5, 0.9], [0.45, -0.25, 0.25, 2.2, 1.1, 0.3], [-0.15, -0.45, -0.3, 0.8, 0.2, 1.7],
    [0.6, 0.35, -0.05, 1.6, 2.9, 2.4], [0.1, 0.55, 0.3, 0.3, 1.2, 0.6]];
  for (const f of F) { _v.set(k2.pos.x + f[0], k2.pos.y + 0.12 + f[1], k2.pos.z + f[2]); feathers.place(_v, f[3], f[4], f[5], 0.9); }
  _v.set(v.pos.x + fwdX * 3.6 + 0.4, 0.004, v.pos.z + fwdZ * 3.6); feathers.place(_v, 0, 0.7, 0, 1.0);
  _v.set(v.pos.x + fwdX * 4.6 - 1.2, 0.004, v.pos.z + fwdZ * 4.6); feathers.place(_v, 0, 2.3, 0, 0.8);
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
