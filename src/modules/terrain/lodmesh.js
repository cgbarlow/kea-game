// terrain/lodmesh — fixed distance-LOD heightfield. The world is cut into square cells, each meshed at its own
// vertex spacing (1 m near the play space, 2 m mid, 4 m far, one quad on the flat bench under the slab). Edges that
// border a coarser cell are snapped onto the coarse edge line, so there are no cracks and no skirts. Cells are merged
// into a few chunk meshes (draw calls = chunks). heightAt() is exact on the rendered triangles (props never float).
//   lodTerrain({ fn, ext, cell, chunk, resOf(cx,cz,size) → metres, attrib(x,z,y,out4), material })
//     → { group, meshes, heightAt(x,z), normalAt(x,z,out), tris }
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Mesh, Group, Vector3 } from 'three';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function lodTerrain({ fn, ext = 448, cell = 16, chunk = 14, resOf, attrib, material, cavity = 0.9 }) {
  const N = Math.round((2 * ext) / cell), x0 = -ext, z0 = -ext;
  const R = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) R[i + j * N] = resOf(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell, cell);
  const resAt = (i, j) => (i < 0 || j < 0 || i >= N || j >= N ? 0 : R[i + j * N]);
  // per-cell height grids (with stitched edges)
  const grids = new Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const r = R[i + j * N], n = Math.round(cell / r), W = n + 1, H = new Float32Array(W * W);
    const cx = x0 + i * cell, cz = z0 + j * cell, PW = n + 5, Hp = new Float32Array(PW * PW); // raw field, 2-vertex pad
    for (let b = -2; b <= n + 2; b++) for (let a = -2; a <= n + 2; a++) Hp[a + 2 + (b + 2) * PW] = fn(cx + a * r, cz + b * r);
    for (let b = 0; b <= n; b++) for (let a = 0; a <= n; a++) H[a + b * W] = Hp[a + 2 + (b + 2) * PW];
    // stitch: on an edge whose neighbour is coarser, put the vertices on the neighbour's straight edge segments
    const snap = (nr, get, set) => {
      if (!(nr > r)) return;
      const k = Math.round(nr / r);
      for (let t = 0; t <= n; t++) {
        const t0 = Math.floor(t / k) * k; if (t0 === t) continue;
        const t1 = Math.min(n, t0 + k), f = (t - t0) / (t1 - t0);
        set(t, get(t0) + (get(t1) - get(t0)) * f);
      }
    };
    snap(resAt(i - 1, j), (t) => H[t * W], (t, v) => { H[t * W] = v; });
    snap(resAt(i + 1, j), (t) => H[n + t * W], (t, v) => { H[n + t * W] = v; });
    snap(resAt(i, j - 1), (t) => H[t], (t, v) => { H[t] = v; });
    snap(resAt(i, j + 1), (t) => H[t + n * W], (t, v) => { H[t + n * W] = v; });
    grids[i + j * N] = { r, n, W, H, cx, cz, Hp, PW };
  }
  // exact height on the triangles (same diagonal split as the index buffer below)
  const heightAt = (x, z) => {
    const i = clamp(Math.floor((x - x0) / cell), 0, N - 1), j = clamp(Math.floor((z - z0) / cell), 0, N - 1);
    const g = grids[i + j * N];
    const fx = clamp((x - g.cx) / g.r, 0, g.n - 1e-4), fz = clamp((z - g.cz) / g.r, 0, g.n - 1e-4);
    const a = Math.floor(fx), b = Math.floor(fz), u = fx - a, v = fz - b, W = g.W, H = g.H;
    const p = H[a + b * W], q = H[a + 1 + b * W], d = H[a + (b + 1) * W], e = H[a + 1 + (b + 1) * W];
    return u + v <= 1 ? p + (q - p) * u + (d - p) * v : e + (d - e) * (1 - u) + (q - e) * (1 - v);
  };
  const normalAt = (x, z, out = new Vector3()) => {
    const e = 0.5; return out.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
  };
  // chunk meshes
  const group = new Group(), meshes = [], A4 = [0, 0, 0, 0];
  let tris = 0;
  const CN = Math.ceil(N / chunk);
  for (let cj = 0; cj < CN; cj++) for (let ci = 0; ci < CN; ci++) {
    const P = [], Nn = [], C = [], U = [], T = [], I = [];
    for (let j = cj * chunk; j < Math.min(N, (cj + 1) * chunk); j++) for (let i = ci * chunk; i < Math.min(N, (ci + 1) * chunk); i++) {
      const g = grids[i + j * N], { r, n, W, H, cx, cz, Hp, PW } = g, o = P.length / 3;
      const raw = (a, b) => Hp[a + 2 + (b + 2) * PW];
      for (let b = 0; b <= n; b++) for (let a = 0; a <= n; a++) {
        const X = cx + a * r, Z = cz + b * r, Y = H[a + b * W];
        // normal from the raw field at this cell's spacing (stitched edges keep the shared-edge shading smooth)
        const gx = (raw(a + 1, b) - raw(a - 1, b)) / (2 * r), gz = (raw(a, b + 1) - raw(a, b - 1)) / (2 * r), l = Math.hypot(gx, 1, gz);
        P.push(X, Y, Z); Nn.push(-gx / l, 1 / l, -gz / l); U.push(X, Z);
        const k = r < 2 ? 2 : 1, s2 = k * r, Y0 = raw(a, b);
        const lap = (raw(a + k, b) + raw(a - k, b) + raw(a, b + k) + raw(a, b - k) - 4 * Y0) / (4 * s2 * s2);
        const occ = clamp(1 - lap * cavity * 4, 0.55, 1.0) * (0.9 + 0.1 * clamp(1 - Math.hypot(gx, gz), 0, 1));
        C.push(occ, occ, occ);
        attrib(X, Z, Y, A4, lap, gx, gz); T.push(A4[0], A4[1], A4[2], A4[3]);
      }
      for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
        const p = o + a + b * W, q = p + 1, d = p + W, e2 = d + 1;
        I.push(p, d, q, q, d, e2);
      }
    }
    if (!I.length) continue;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(P, 3)); g.setAttribute('normal', new Float32BufferAttribute(Nn, 3));
    g.setAttribute('color', new Float32BufferAttribute(C, 3)); g.setAttribute('uv', new Float32BufferAttribute(U, 2));
    g.setAttribute('aTer', new Float32BufferAttribute(T, 4));
    g.setIndex(new Uint32BufferAttribute(I, 1)); g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new Mesh(g, material); m.receiveShadow = true; m.castShadow = false; m.matrixAutoUpdate = false; m.name = 'terrain-chunk';
    group.add(m); meshes.push(m); tris += I.length / 3;
  }
  return { group, meshes, heightAt, normalAt, tris, resAt: (x, z) => resAt(Math.floor((x - x0) / cell), Math.floor((z - z0) / cell)) };
}
