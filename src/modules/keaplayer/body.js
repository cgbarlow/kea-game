// keaplayer/body — the world as a kea's feet know it: oriented boxes with (optionally sloped) tops, plus the terrain.
// The car park's colliders are used as-is (tables, signs, the gate leaf, lamp poles, bins, rocks, shelter walls), except
// each van's single 2.9 m block, which is replaced by the van's real shape (box body + luton roof, cab, low bonnet, the
// two mirror heads), so a kea can stand on a bonnet, a mirror or the roof. Adds the shelter's sloping roof.
//   createBody(G, { colliders, vans, terrain }) → { boxes, collide(pos, vel, r, h, contact), support(x, z, yMax, r) → y,
//     supportBox (last support() hit or null) }
// Allocation-free queries.
import { LAYOUT as L, WORLD } from '../../contracts.js';
import { DIM } from '../vans/body.js';

export function createBody(G, { colliders = [], vans = null, terrain = null } = {}) {
  const boxes = [];
  const add = (cx, cz, yaw, hx, hz, y0, y1, slope = 0, van = null, kind = '') =>
    boxes.push({ cx, cz, c: Math.cos(yaw), s: Math.sin(yaw), hx, hz, y0, y1, slope, van, kind });
  const vl = (vans && vans.list) || [];
  for (const b of colliders) {
    const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    let isVan = false;
    for (const v of vl) if (Math.abs(cx - v.pos.x) < 0.6 && Math.abs(cz - v.pos.z) < 0.6 && Math.abs(b.max.y - L.van.h) < 0.06) isVan = true;
    if (isVan) continue;
    add(cx, cz, 0, (b.max.x - b.min.x) / 2, (b.max.z - b.min.z) / 2, b.min.y, b.max.y);
  }
  for (const v of vl) {
    const c = Math.cos(v.yaw), s = Math.sin(v.yaw), hw = DIM.bodyW / 2, cw = DIM.cabW / 2;
    // van-local x (kerb side -x) and f (forward distance = -z) ranges → world-centred oriented box
    const vb = (x0, x1, f0, f1, y0, y1, kind) => {
      const lx = (x0 + x1) / 2, lz = -(f0 + f1) / 2;
      add(v.pos.x + lx * c + lz * s, v.pos.z - lx * s + lz * c, v.yaw, (x1 - x0) / 2, (f1 - f0) / 2, y0, y1, 0, v, kind);
    };
    vb(-hw, hw, DIM.rear, DIM.bodyFront, 0, DIM.top, 'roof');
    vb(-hw, hw, DIM.bodyFront, 2.34, 2.07, DIM.top, 'roof');
    vb(-cw, cw, DIM.cabBack, 2.4, 0, 2.07, 'cab');
    vb(-cw, cw, 2.4, DIM.nose, 0, 1.21, 'bonnet');
    for (const sx of [-1, 1]) vb(sx * 1.215 - 0.05, sx * 1.215 + 0.05, 2.28, 2.48, 1.56, 1.885, 'mirror');
  }
  // shelter: corrugated roof sloping up to the open (east) front (carpark/shelter.js: 2.65 → 3.12 over x0..x1)
  { const S = L.shelter, x0 = S.x - S.w / 2 - 0.3, x1 = S.x + S.w / 2 + 0.35, z0 = S.z - S.d / 2 - 0.3, z1 = S.z + S.d / 2 + 0.3;
    const yA = 2.65, yB = 3.12, slope = (yB - yA) / (x1 - x0);
    add((x0 + x1) / 2, (z0 + z1) / 2, 0, (x1 - x0) / 2, (z1 - z0) / 2, 2.5, (yA + yB) / 2, slope, null, 'shelter'); }

  // the stash ledge (keagame owns the rock + pile; this is the kea's footing until keagame registers its own via addSurface)
  { const hx = 1.0, hz = 0.75, st = L.stash, t0 = terrain && terrain.heightAt ? terrain.heightAt(st[0], st[2]) : 0;
    add(st[0], st[2], 0, hx, hz, Math.min(t0, st[1]) - 0.6, Math.max(t0, st[1]), 0, null, 'ledge'); }
  const hAt = terrain && terrain.heightAt;
  const B = { boxes, supportBox: null };
  // extra top surfaces from other modules (e.g. keagame's stash ledge): { x, z, hx, hz, y0, y1, yaw?, slope?, kind? }
  B.addSurface = (o) => { add(o.x, o.z, o.yaw || 0, o.hx, o.hz, o.y0 ?? o.y1 - 0.5, o.y1, o.slope || 0, o.van || null, o.kind || 'extra'); return boxes[boxes.length - 1]; };
  B.ground = (x, z) => { const h = hAt ? hAt(x, z) : WORLD.groundY; return h > WORLD.groundY ? h : WORLD.groundY; };

  // highest walkable top at (x,z) that is not above yMax (feet + step); also the terrain
  B.support = (x, z, yMax, r = 0.18) => {
    let best = B.ground(x, z), bb = null;
    const m = r * 0.5;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i], dx = x - b.cx, dz = z - b.cz;
      const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      if (Math.abs(lx) > b.hx + m || Math.abs(lz) > b.hz + m) continue;
      const top = b.y1 + b.slope * Math.max(-b.hx, Math.min(b.hx, lx));
      if (top <= yMax && top > best) { best = top; bb = b; }
    }
    B.supportBox = bb;
    return best;
  };

  // push a kea body (feet at pos, radius r, height h) out of every box; tops it can step onto (≤ step) lift it.
  // contact.top = box landed on this call (or null), contact.wall = true if pushed sideways, contact.ceil if bonked.
  B.collide = (pos, vel, r, h, step, contact) => {
    contact.top = null; contact.wall = false; contact.ceil = false;
    for (let it = 0; it < 2; it++) for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i], dx = pos.x - b.cx, dz = pos.z - b.cz;
      const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      const ox = b.hx + r - Math.abs(lx), oz = b.hz + r - Math.abs(lz);
      if (ox <= 0 || oz <= 0) continue;
      const top = b.y1 + b.slope * Math.max(-b.hx, Math.min(b.hx, lx));
      if (pos.y >= top - 1e-4 || pos.y + h <= b.y0) continue;
      const up = top - pos.y, down = pos.y + h - b.y0;
      const over = Math.abs(lx) < b.hx + r * 0.5 && Math.abs(lz) < b.hz + r * 0.5;
      if (over && (up <= step || (vel.y < -0.2 && up < 0.45 && up < Math.min(ox, oz) + 0.05))) {
        pos.y = top; if (vel.y < 0) vel.y = 0; contact.top = b; continue;
      }
      if (down < ox && down < oz && down < 0.3 && vel.y > 0) { pos.y = b.y0 - h; vel.y = 0; contact.ceil = true; continue; }
      let nx, nz, d;
      if (ox < oz) { const sx = lx >= 0 ? 1 : -1; nx = sx * b.c; nz = -sx * b.s; d = ox; }
      else { const sz = lz >= 0 ? 1 : -1; nx = sz * b.s; nz = sz * b.c; d = oz; }
      pos.x += nx * d; pos.z += nz * d;
      const vn = vel.x * nx + vel.z * nz; if (vn < 0) { vel.x -= vn * nx; vel.z -= vn * nz; }
      contact.wall = true;
    }
    return contact;
  };
  return B;
}
