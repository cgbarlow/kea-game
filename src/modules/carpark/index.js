// carpark — the level: sealed apron + closed SH73 road, kerbs, bay lines, visitor shelter (interior), long-drop
// toilet, picnic tables (aftershock cover), possum trap boxes, lamp poles, ROAD CLOSED gate, dry official signage.
//   create(G, { mats }) → { root, ground, colliders: Box3[], bounds: Box3, shelter: {group, box, probeAt},
//                           anchors: { lamps, flashers, signs, cover, traps }, update, dispose }
//   showcase(G) → { cam, target }
// Every position comes from LAYOUT in contracts.js. Real metres, bevelled edges (geo/kit.js), merged by material.
import { Box3, Vector3, Group, Mesh, PlaneGeometry } from 'three';
import { Kit, fence } from '../../cookbook/geo/kit.js';
import { WORLD, LAYOUT as L } from '../../contracts.js';
import { buildSigns } from './signs.js';

export function create(G, { mats }) {
  const root = new Group(); root.name = 'carpark';
  const colliders = [];
  const solid = (x, y, z, w, h, d) => colliders.push(new Box3(new Vector3(x - w / 2, y, z - d / 2), new Vector3(x + w / 2, y + h, z + d / 2)));

  // ground: apron + road as one slab (ground/ground.js patches it: puddles, planar reflection). Metric UVs.
  const GW = 180, GD = 44, gcx = 0, gcz = -4;
  const gg = new PlaneGeometry(GW, GD, 1, 1);
  const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * GW, uv.getY(i) * GD);
  const ground = new Mesh(gg, mats.ground);
  ground.rotation.x = -Math.PI / 2; ground.position.set(gcx, 0, gcz); ground.receiveShadow = true; ground.name = 'ground';
  root.add(ground);

  const k = new Kit();
  const cp = L.carpark;
  // kerbs around the apron (150 mm, bevelled), gap to the road on the north side
  const kerb = (x, z, w, d) => { k.box(w, 0.15, d, 'concrete', { at: [x, 0.075, z], r: 0.02 }); };
  kerb((cp.x0 + cp.x1) / 2, cp.z1, cp.x1 - cp.x0, 0.3);
  kerb(cp.x0, (cp.z0 + cp.z1) / 2, 0.3, cp.z1 - cp.z0);
  kerb(cp.x1, (cp.z0 + cp.z1) / 2, 0.3, cp.z1 - cp.z0);
  // road edge kerbs (both sides of SH73) except the car park entrance
  for (const side of [-1, 1]) {
    const z = L.road.z + side * (L.road.w / 2 + 0.15);
    if (side < 0) kerb(0, z, 180, 0.3);
    else { kerb(-60, z, 60, 0.3); kerb(60, z, 60, 0.3); }
  }
  // painted bay lines (thin raised boxes; real paint lines are 100 mm wide)
  for (let i = -4; i <= 4; i++) k.box(0.1, 0.004, 5.5, 'linePaint', { at: [i * 3.0 * 2, 0.002, 4], r: 0.001 });
  // road centre line (dashed 3 m / 7 m gap) and edge lines
  for (let x = -88; x < 88; x += 10) k.box(3, 0.004, 0.1, 'linePaint', { at: [x, 0.002, L.road.z], r: 0.001 });

  // visitor shelter: three walls (open to +X), mono-pitch roof, bench, info board wall. Own materials for the probe.
  const S = L.shelter, sk = new Kit();
  const sx = S.x, sz = S.z, hw = S.w / 2, hd = S.d / 2;
  sk.box(S.w, S.h, 0.15, 'wood', { at: [sx, S.h / 2, sz - hd], r: 0.01 }); solid(sx, 0, sz - hd, S.w, S.h, 0.15);
  sk.box(S.w, S.h, 0.15, 'wood', { at: [sx, S.h / 2, sz + hd], r: 0.01 }); solid(sx, 0, sz + hd, S.w, S.h, 0.15);
  sk.box(0.15, S.h, S.d, 'wood', { at: [sx - hw, S.h / 2, sz], r: 0.01 }); solid(sx - hw, 0, sz, 0.15, S.h, S.d);
  sk.box(S.w + 0.6, 0.12, S.d + 0.6, 'steel', { at: [sx + 0.1, S.h + 0.12, sz], rot: [0, 0, -0.06], r: 0.01 });
  sk.box(S.w - 0.3, 0.1, S.d - 0.3, 'concrete', { at: [sx, 0.05, sz], r: 0.01 });
  sk.box(3.2, 0.06, 0.4, 'wood', { at: [sx - 0.8, 0.45, sz + hd - 0.35], r: 0.008 });
  for (const dx of [-2.1, 0.5]) sk.box(0.06, 0.45, 0.35, 'steel', { at: [sx + dx, 0.225, sz + hd - 0.35] });
  sk.box(0.04, 1.2, 2.6, 'board', { at: [sx - hw + 0.1, 1.5, sz], r: 0.006 });       // info board backing
  sk.box(1.22, 0.05, 0.08, 'lamp', { at: [sx - 1.0, S.h - 0.08, sz], r: 0.01 });      // fluoro batten (emissive)
  sk.bakeAO({ ground: 0 }); sk.grime({ base: 0 });
  const shelterGroup = new Group(); shelterGroup.name = 'shelter';
  shelterGroup.add(sk.build({ wood: mats.shelterWood, steel: mats.shelterSteel, concrete: mats.shelterConcrete, board: mats.board, lamp: mats.lamp, default: mats.shelterWood }));
  root.add(shelterGroup);
  const shelter = { group: shelterGroup, box: new Box3(new Vector3(sx - hw, 0, sz - hd), new Vector3(sx + hw, S.h, sz + hd)), probeAt: [sx + 0.4, 1.5, sz] };

  // long-drop toilet: box + door + vent pipe
  const T = L.toilet;
  k.box(T.w, T.h, T.d, 'paint', { at: [T.x, T.h / 2, T.z], r: 0.02, color: 0x4a5a3c }); solid(T.x, 0, T.z, T.w, T.h, T.d);
  k.box(T.w + 0.4, 0.1, T.d + 0.4, 'steel', { at: [T.x, T.h + 0.05, T.z], r: 0.01 });
  k.box(0.04, 2.0, 0.9, 'wood', { at: [T.x + T.w / 2 + 0.02, 1.0, T.z], r: 0.006 });
  k.cyl(0.08, 1.2, 'steel', { at: [T.x - 0.6, T.h + 0.6, T.z - 0.6] });

  // picnic tables (1.8 m, bench both sides) = cover for drop, cover, hold
  for (const [x, z] of L.tables) {
    k.push(x, 0, z);
    k.box(1.8, 0.05, 0.75, 'wood', { at: [0, 0.74, 0] });
    for (const s of [-1, 1]) { k.box(1.8, 0.04, 0.28, 'wood', { at: [0, 0.45, s * 0.62] }); k.box(0.06, 0.74, 1.5, 'wood', { at: [s * 0.7, 0.37, 0] }); }
    k.pop(); solid(x, 0, z, 1.9, 0.78, 1.6);
  }

  // possum trap boxes (DOC-style: 0.8 × 0.32 × 0.32 m timber box, mesh mouth facing the car park)
  for (const [x, z] of L.traps) {
    k.push(x, 0, z);
    k.box(0.32, 0.32, 0.8, 'wood', { at: [0, 0.16, 0], r: 0.006, color: 0x9a8060 });
    k.box(0.24, 0.24, 0.02, 'dark', { at: [0, 0.16, -0.405], r: 0.003 });
    k.box(0.36, 0.03, 0.84, 'wood', { at: [0, 0.335, 0], r: 0.004 });
    k.pop(); solid(x, 0, z, 0.36, 0.35, 0.84);
  }

  // lamp poles: the fixtures themselves come from lighting/lights.js (kind 'pole') at anchors.lamps; collider here
  for (const [x, z] of L.lamps) solid(x + 0.3, 0, z - 0.45, 0.25, 8, 0.25);

  // ROAD CLOSED gate: two posts + swing arm across the road, concrete blocks, flasher heads
  const gt = L.gate;
  k.box(0.18, 1.2, 0.18, 'steel', { at: [gt.x, 0.6, gt.z - 4.2] });
  k.box(0.18, 1.2, 0.18, 'steel', { at: [gt.x, 0.6, gt.z + 4.2] });
  k.box(0.1, 0.12, 8.6, 'paint', { at: [gt.x, 1.05, gt.z], color: 0xd8d0c0 });
  for (let i = -3; i <= 3; i++) k.box(1.2, 0.8, 0.6, 'concrete', { at: [gt.x + 2.5, 0.4, gt.z + i * 1.3], rot: [0, (i % 2) * 0.1, 0], r: 0.03 });
  solid(gt.x + 2.5, 0, gt.z, 1.4, 0.8, 9.2);
  const flashers = [[gt.x, 1.35, gt.z - 4.2], [gt.x, 1.35, gt.z + 4.2]];
  for (const f of flashers) k.box(0.2, 0.2, 0.2, 'amber', { at: f, r: 0.02 });
  // road barrier fence along the slip side so the play space has a readable end
  k.push(gt.x + 4.5, 0, gt.z - 4.2, Math.PI / 2); fence(k, 8.4, { kind: 'rail', h: 1.1 }); k.pop();

  k.bakeAO({ ground: 0 }); k.grime({ base: 0 });
  root.add(k.build({ concrete: mats.concrete, paint: mats.paint, steel: mats.steel, wood: mats.wood, dark: mats.rubber, linePaint: mats.linePaint, amber: mats.amber, default: mats.concrete }));

  const signs = buildSigns(G, root, colliders);

  G.scene.add(root);
  const bounds = new Box3().setFromObject(ground);
  const anchors = {
    lamps: L.lamps.map(([x, z]) => [x + 0.3, 7.9, z]),
    flashers,
    shelterLamp: [sx - 1.0, S.h - 0.2, sz],
    cover: L.tables.map(([x, z]) => ({ pos: [x, 0, z], r: 1.6 })).concat([{ pos: [sx, 0, sz], r: 2.6 }]),
    traps: L.traps.map(([x, z]) => ({ pos: [x, 0, z], mouth: [x, 0.16, z - 0.45] })),
    signs,
  };
  void WORLD;
  return { root, ground, shelter, anchors, colliders, bounds, update() {}, dispose() { G.scene.remove(root); } };
}

export function showcase() { return { cam: [-14, 2.0, -12], target: [-24, 1.4, -6] }; }
