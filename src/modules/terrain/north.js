// terrain/north — dressing of the north face opposite the car park (the view from spawn looking north, YAW 1): a few
// greywacke outcrops and bluffs breaking the talus, blocks spilled down the old slip chute (height.oldScar), a
// high-country fence line (timber posts, a few leaning or snapped, three sagging wires) along the toe, and an old
// concrete crib retaining wall at the road verge with one panel toppled and rubble at its foot.
//   createNorth(G, { T, rockMat, add, group, far }) → { tris, calls, materials }
import { scatter, poissonDisk, rockGeo } from '../../cookbook/geo/scatter.js';
import { Kit } from '../../cookbook/geo/kit.js';
import { rngFrom } from '../../cookbook/geo/noise.js';
import { makeMaterial } from '../../cookbook/materials/library.js';
import { axisZ, oldScar, BENCH } from './height.js';
import { SEED } from '../../contracts.js';

const zOf = (x, u) => axisZ(x) - BENCH.half - u;      // world z of a point u metres up the north face

export function createNorth(G, { T, rockMat, add, group, far }) {
  const rng = rngFrom(SEED + 501), low = G.quality.tier === 'low';
  let tris = 0, calls = 0;
  const outMat = rockMat('outcrop', 0x9c9c9a, { thick: 0.08 });
  const blockMat = rockMat('chuteBlock', 0xd2d5d8, { thick: 0.04 });

  // outcrops: big fractured bodies mostly buried in the slope, so only a bluff face + ledges stand proud.
  // [x, u (m up the face), width, height, depth, yaw]
  const k = new Kit();
  const OUT = [[-36, 17, 9, 5.5, 6, 0.3], [-4, 27, 7, 4.2, 5, -0.2], [13, 11, 6, 3.4, 4.5, 0.6], [27, 21, 10, 6, 6.5, -0.4], [-56, 8, 5, 2.8, 4, 0.9]];   // clear of the slip lobe + scar (x 30..70)
  OUT.forEach(([x, u, w, h, d, ry], i) => {
    const z = zOf(x, u), y = T.heightAt(x, z);
    // a jointed bluff: many fracture planes (flat faces, sharp arrises), the back half buried in the slope
    const g = rockGeo({ seed: 140 + i * 3, radius: 1, detail: low ? 2 : 3, cuts: 14, squash: 0.95, noise: 0.16, base: 0.8 });
    g.scale(w * 0.5, h, d * 0.5);
    k.push(x, y - h * 0.55, z + d * 0.15, ry, 0.18, (rng() - 0.5) * 0.2); k.add(g, 'rock', { occ: false }); k.pop();
    // a second, lower tier behind and above: the bedrock stepping up the face
    const g2 = rockGeo({ seed: 141 + i * 3, radius: 1, detail: 2, cuts: 12, squash: 0.9, noise: 0.18, base: 0.8 });
    g2.scale(w * 0.38, h * 0.7, d * 0.4);
    const x2 = x + (rng() - 0.5) * w * 0.6, z2 = zOf(x2, u + d * 0.55);
    k.push(x2, T.heightAt(x2, z2) - h * 0.4, z2, ry + 0.4, 0.2, 0); k.add(g2, 'rock', { occ: false }); k.pop();
    // a shoulder block + two fallen blocks below each bluff
    for (let b = 0; b < 3; b++) {
      const bx = x + (rng() - 0.5) * w * 0.9, bu = Math.max(0.6, u - d * 0.4 - (b ? 1.5 + rng() * 4 : 0)), bz = zOf(bx, bu), s = b ? 0.5 + rng() * 0.6 : 1.2 + rng() * 0.6;
      const bg = rockGeo({ seed: 170 + i * 5 + b, radius: s, detail: 2, cuts: 6, squash: 0.7, noise: 0.25 });
      k.push(bx, T.heightAt(bx, bz) - s * 0.25, bz, rng() * 6.28, (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5); k.add(bg, 'rock', { occ: false }); k.pop();
    }
  });
  k.grime({ base: -1e3, down: 0.6, streak: 0.5 });
  const rocks = k.build({ rock: outMat, default: outMat });
  rocks.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; tris += m.geometry.index.count / 3; calls++; } });
  group.add(rocks);

  // the old slip chute: raw blocks and cobbles down the channel, coarsest on the toe fan
  const cg = rockGeo({ seed: 23, radius: 1, detail: 1, cuts: 6, squash: 0.62, noise: 0.28 });
  const cpts = poissonDisk({ x0: -40, z0: -90, w: 46, h: 66, r: low ? 1.4 : 1.0, rng, accept: (x, z) => oldScar(x, z) > 0.35 && rng() < 0.75 });
  add(scatter(G, { parts: [{ geo: cg, material: blockMat }], points: cpts, heightAt: T.heightAt, normalAt: T.normalAt, scale: [0.15, 0.7], scaleY: [0.55, 1],
    align: 0.7, sink: 0.22, cell: 60, shadow: false, tilt: 0.5, tint: { color: 0xffffff, l: 0.14 }, fade: [90, 140], seed: SEED + 17 }), [cg], far, 'chute');

  // fence line along the toe (u ~ 5): 3.5 m bays, posts leaning downslope, the run broken where the chute crossed it
  const f = new Kit(), fr = rngFrom(SEED + 511);
  const posts = [];
  for (let x = -62; x <= 27; x += 3.4 + fr() * 0.4) {                 // stops short of the slip (and the gate at x 31)
    const sc = oldScar(x, zOf(x, 5));
    if (sc > 0.15) { posts.push(null); continue; }                     // carried away by the old slip
    const u = 5 + Math.sin(x * 0.05) * 1.2, z = zOf(x, u), y = T.heightAt(x, z);
    const lean = (fr() < 0.22 ? 0.18 + fr() * 0.25 : 0.03 * (fr() - 0.5)) , ry = (fr() - 0.5) * 0.3;
    const snapped = fr() < 0.08, h = snapped ? 0.55 + fr() * 0.2 : 1.25;
    f.push(x, y - 0.3, z, ry, lean, (fr() - 0.5) * 0.08);
    f.box(0.11, h + 0.3, 0.11, 'post', { at: [0, (h + 0.3) / 2, 0], r: 0.012, step: 2, color: 0xd8d0c4 });
    f.pop();
    // the top of the post in world space (lean tips it downslope, toward +z)
    posts.push(snapped ? null : [x + Math.sin(ry) * Math.sin(lean) * h, y - 0.3 + Math.cos(lean) * (h + 0.3), z + Math.cos(ry) * Math.sin(lean) * (h + 0.3)]);
  }
  // wires (galvanised, 3 strands) sag between standing posts; a broken bay leaves the wire draped on the ground
  for (let i = 0; i + 1 < posts.length; i++) {
    const a = posts[i], b = posts[i + 1]; if (!a || !b) continue;
    for (const dh of [0.0, -0.38, -0.76]) {
      const n = 4, pts = [];
      for (let s = 0; s <= n; s++) { const t = s / n; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + dh + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 0.06, a[2] + (b[2] - a[2]) * t]); }
      f.tube(pts, 0.006, 'wire', { radial: 4, caps: false });
    }
  }

  // old crib retaining wall at the verge toe, x -9..15: precast panels on a footing, one toppled, rubble at its foot
  const wr = rngFrom(SEED + 521);
  for (let x = -9, i = 0; x < 15; x += 3.05, i++) {
    const u = 0.5, z = zOf(x + 1.5, u), hb = T.heightAt(x + 1.5, z - 1.4), H = Math.min(1.5, Math.max(0.9, hb + 0.2 + 0.06));
    const fallen = i === 4;
    if (fallen) {   // toppled forward onto the verge, cracked in two
      f.push(x + 1.5, -0.06 + 0.16, z + 1.0, (wr() - 0.5) * 0.15, 1.45, 0.06);
      f.box(1.45, H * 0.55, 0.28, 'conc', { at: [-0.76, H * 0.27, 0], r: 0.02, color: 0xc8c4bc });
      f.box(1.45, H * 0.45, 0.28, 'conc', { at: [0.76, H * 0.25, 0.03], rot: [0.06, 0.04, 0.02], r: 0.02, color: 0xbab6ae });
      f.pop();
      for (let r = 0; r < 7; r++) {   // spilled fill behind the gap
        const rx = x + 0.3 + wr() * 2.4, rz = z + 0.2 + wr() * 1.6, rs = 0.15 + wr() * 0.3;
        f.push(rx, -0.06 + rs * 0.35, rz, wr() * 6.28, wr(), wr()); f.add(rockGeo({ seed: 300 + r, radius: rs, detail: 1, cuts: 5, squash: 0.7 }), 'fill', { occ: false, color: 0xc4c0b8 }); f.pop();
      }
      continue;
    }
    f.push(x + 1.5, -0.06, z, 0, -0.06 + (wr() - 0.5) * 0.04, (wr() - 0.5) * 0.03);   // leaning back into the slope, slightly racked
    f.box(2.98, H, 0.26, 'conc', { at: [0, H / 2 - 0.1, 0], r: 0.025, step: 1.2, color: i % 2 ? 0xd2cec6 : 0xc6c2ba });
    f.box(2.98, 0.08, 0.32, 'conc', { at: [0, H - 0.08, -0.02], r: 0.02, color: 0xbab6ae });                    // capping strip
    f.box(0.08, 0.08, 0.12, 'pipe', { at: [0.6, 0.35, 0.16], r: 0.02, color: 0x505050 });                         // weep hole spout
    f.pop();
  }
  f.grime({ base: -0.06, foot: 0.5, down: 0.8, streak: 0.8 });
  const conc = makeMaterial('concrete', { tint: 0xc4c0b6, weather: 'prop' }); conc.vertexColors = true; conc.name = 'retainWall';
  const post = makeMaterial('weathered_wood', { tint: 0x8c8274, weather: 'prop' }); post.vertexColors = true; post.name = 'fencePost';
  const wire = makeMaterial('galvanised', { tint: 0x8a8e92, weather: 'prop' }); wire.vertexColors = true; wire.name = 'fenceWire';
  const fill = blockMat;
  const kit = f.build({ conc, post, wire, fill, pipe: wire, default: conc });
  kit.traverse((m) => { if (m.isMesh) { m.castShadow = m.name !== 'kit:wire'; m.receiveShadow = true; tris += m.geometry.index ? m.geometry.index.count / 3 : m.geometry.attributes.position.count / 3; calls++; } });
  far.add(kit);                                                       // thin stuff: kept out of the puddle reflection pass
  return { tris, calls, materials: [outMat, blockMat, conc, post, wire] };
}
