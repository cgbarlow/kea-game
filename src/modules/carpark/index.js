// carpark — the level: sealed apron + closed SH73 (kerbs, worn paint, patches, quake cracks), the DOC-style
// visitor shelter (interior), long drop, picnic tables (aftershock cover), DOC 200 trap boxes, kea-proof bins,
// lamp plinths, ROAD CLOSED gate with water barriers and amber flashers, and dry official signage.
//   create(G, { mats }) → { root, ground, colliders: Box3[], bounds: Box3, shelter: {group, interior, box, probeAt},
//                           anchors: { lamps, flashers, shelterLamp, signs, cover, traps }, update, dispose }
//   showcase(G) → { cam, target }
// Every position comes from LAYOUT in contracts.js. Real metres, bevelled edges (geo/kit.js), merged by material:
// ONE mesh per material key (exterior kit + interior kit) + three batched decal meshes (signs, ground, interior).
import { Box3, Vector3, Group, Mesh, PlaneGeometry } from 'three';
import { Kit } from '../../cookbook/geo/kit.js';
import { rngFrom } from '../../cookbook/geo/noise.js';
import { makeMaterial } from '../../cookbook/materials/library.js';
import { LAYOUT as L, SEED } from '../../contracts.js';
import { DecalBatch } from './decals.js';
import { buildSurface } from './surface.js';
import { buildShelter } from './shelter.js';
import { buildProps } from './props.js';
import { buildSigns } from './signs.js';

export function create(G, { mats }) {
  const root = new Group(); root.name = 'carpark';
  const colliders = [];
  const solid = (x, y, z, w, h, d) => colliders.push(new Box3(new Vector3(x - w / 2, y, z - d / 2), new Vector3(x + w / 2, y + h, z + d / 2)));
  const rng = rngFrom(SEED + 211);

  // ground: apron + road as one slab (ground/ground.js patches it: puddles, planar reflection). Metric UVs.
  const GW = 180, GD = 44, gcx = 0, gcz = -4;
  const gg = new PlaneGeometry(GW, GD, 1, 1);
  const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * GW, uv.getY(i) * GD);
  const ground = new Mesh(gg, mats.ground);
  ground.rotation.x = -Math.PI / 2; ground.position.set(gcx, 0, gcz); ground.receiveShadow = true; ground.name = 'ground';
  root.add(ground);

  // module-owned materials (vertex colours carry tint + baked AO; finalizeMaterials adds atmos/weathering later)
  const own = {
    plastic: makeMaterial('plastic', { tint: 0xffffff }),
    sarking: makeMaterial('wood_planks', { tint: 0xd8cbb0, weather: 'sheltered' }),
    iplastic: makeMaterial('plastic', { tint: 0xffffff, weather: 'sheltered' }),
    lensA: mats.amber.clone(), lensB: mats.amber.clone(),
  };
  for (const m of Object.values(own)) m.vertexColors = true;

  const k = new Kit(), ik = new Kit();
  const dec = new DecalBatch(2048), gdec = new DecalBatch(2048);
  buildSurface(G, { k, dec: gdec, rng });
  const sh = buildShelter(G, { k, ik, dec, solid, rng });
  const pr = buildProps(G, { k, dec, solid, rng });
  const signs = buildSigns(G, { k, dec, solid, rng });

  k.bakeAO({ ground: 0, samples: 10, strength: 0.55 }); k.grime({ base: 0, foot: 0.22, streak: 0.18, dirt: [0.76, 0.7, 0.62] });
  ik.bakeAO({ ground: 0.07, samples: 10, radius: 0.3, strength: 0.55 }); ik.grime({ base: 0.07, foot: 0.2, streak: 0.08, down: 0.15, dirt: [0.8, 0.75, 0.68] });
  const ext = k.build({
    concrete: mats.concrete, paint: mats.paint, steel: mats.steel, wood: mats.wood, rubber: mats.rubber,
    plastic: own.plastic, lensA: own.lensA, lensB: own.lensB, default: mats.concrete,
  });
  ext.name = 'carpark:exterior'; root.add(ext);

  dec.finish(G.renderer); gdec.finish(G.renderer);
  const signMesh = dec.build('sign', { roughness: 0.5 });
  const groundMesh = gdec.build('ground', { roughness: 0.62, noWeather: true, shadow: true });
  if (signMesh) root.add(signMesh);
  if (groundMesh) root.add(groundMesh);

  // shelter interior: its own materials so main.js can assign the interior probe to them alone
  const interior = ik.build({
    wood: mats.shelterWood, steel: mats.shelterSteel, concrete: mats.shelterConcrete, board: mats.board, lamp: mats.lamp,
    sarking: own.sarking, plastic: own.iplastic, default: mats.shelterWood,
  });
  interior.name = 'shelter:interior';
  const intDecals = dec.build('interior', { roughness: 0.55 });
  if (intDecals) interior.add(intDecals);
  const shelterGroup = new Group(); shelterGroup.name = 'shelter'; shelterGroup.add(interior);
  root.add(shelterGroup);
  const shelter = {
    group: shelterGroup, interior,
    box: new Box3(new Vector3(...sh.box.min), new Vector3(...sh.box.max)), probeAt: sh.probeAt,
  };

  G.scene.add(root);
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(ground);
  const anchors = {
    lamps: L.lamps.map(([x, z]) => [x + 0.3, 7.9, z]),
    flashers: pr.flashers,
    shelterLamp: sh.lamp,
    cover: L.tables.map(([x, z]) => ({ pos: [x, 0, z], r: 1.6 })).concat([{ pos: [L.shelter.x, 0, L.shelter.z], r: 2.6 }]),
    traps: L.traps.map(([x, z]) => ({ pos: [x, 0, z], mouth: [x, 0.12, z - 0.42] })),
    signs,
  };

  // amber flashers alternate (lens emissive; the light + bulb glow is lights.js at anchors.flashers)
  const baseE = mats.amber.emissiveIntensity ?? 6;
  function update(dt, t) {
    const p = (t * 0.9) % 1, q = (p + 0.5) % 1;
    own.lensA.emissiveIntensity = p < 0.42 ? baseE : baseE * 0.04;
    own.lensB.emissiveIntensity = q < 0.42 ? baseE : baseE * 0.04;
  }
  return {
    root, ground, shelter, anchors, colliders, bounds, update,
    dispose() { G.scene.remove(root); for (const m of Object.values(own)) m.dispose(); },
  };
}

export function showcase() { return { cam: [-14, 2.0, -12], target: [-24, 1.4, -6] }; }
