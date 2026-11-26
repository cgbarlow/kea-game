// ranger/decimate — boot-time vertex-clustering LOD for the v1 blower model (built at mm detail for the first-person
// view; at third-person distance a 5 mm grid keeps the silhouette and loses nothing you can see).
// decimate(geo, cell) → new indexed BufferGeometry (position/normal/uv/color). Vertices are clustered by grid cell AND a
// coarse normal bucket, so hard creases (shroud edges, nozzle lip) stay sharp. Run once at boot, never per frame.
import { BufferGeometry, BufferAttribute } from 'three';

export function decimate(geo, cell = 0.005) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, U = geo.attributes.uv.array, C = geo.attributes.color.array;
  const I = geo.index.array, nv = P.length / 3, inv = 1 / cell;
  const map = new Map(), remap = new Int32Array(nv);
  const acc = []; // per cluster: [px,py,pz,nx,ny,nz,u,v,r,g,b,count]
  for (let i = 0; i < nv; i++) {
    const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    const key = `${Math.floor(P[i * 3] * inv)},${Math.floor(P[i * 3 + 1] * inv)},${Math.floor(P[i * 3 + 2] * inv)},${Math.round(nx * 1.6)},${Math.round(ny * 1.6)},${Math.round(nz * 1.6)}`;
    let c = map.get(key);
    if (c === undefined) { c = acc.length; map.set(key, c); acc.push([0, 0, 0, 0, 0, 0, U[i * 2], U[i * 2 + 1], 0, 0, 0, 0]); }
    const a = acc[c];
    a[0] += P[i * 3]; a[1] += P[i * 3 + 1]; a[2] += P[i * 3 + 2]; a[3] += nx; a[4] += ny; a[5] += nz;
    a[8] += C[i * 3]; a[9] += C[i * 3 + 1]; a[10] += C[i * 3 + 2]; a[11]++;
    remap[i] = c;
  }
  const n = acc.length, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  for (let c = 0; c < n; c++) {
    const a = acc[c], k = 1 / a[11], l = Math.hypot(a[3], a[4], a[5]) || 1;
    pos[c * 3] = a[0] * k; pos[c * 3 + 1] = a[1] * k; pos[c * 3 + 2] = a[2] * k;
    nor[c * 3] = a[3] / l; nor[c * 3 + 1] = a[4] / l; nor[c * 3 + 2] = a[5] / l;
    uv[c * 2] = a[6]; uv[c * 2 + 1] = a[7];
    col[c * 3] = a[8] * k; col[c * 3 + 1] = a[9] * k; col[c * 3 + 2] = a[10] * k;
  }
  const out = [], seen = new Set();
  for (let t = 0; t < I.length; t += 3) {
    const a = remap[I[t]], b = remap[I[t + 1]], c = remap[I[t + 2]];
    if (a === b || b === c || a === c) continue;
    const lo = Math.min(a, b, c), hi = Math.max(a, b, c), mid = a + b + c - lo - hi, key = (lo * n + mid) * n + hi;
    if (seen.has(key)) continue; seen.add(key);
    out.push(a, b, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2)); g.setAttribute('color', new BufferAttribute(col, 3));
  g.setIndex(new BufferAttribute(n > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
