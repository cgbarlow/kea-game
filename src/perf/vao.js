// Perf: one BufferGeometry object per InstancedMesh.
// three.js caches a vertex-array object per (geometry, program). Scatter chunks share ONE geometry across several
// InstancedMeshes, each with its own instanceMatrix buffer, so every one of those draws misses the VAO cache and
// re-runs setupVertexAttributes (~10 vertexAttribPointer calls) in the main AND the shadow pass. On Chrome/ANGLE
// Metal that was ~16 % of the frame's CPU time here (45 shared instanced meshes). A thin wrapper geometry that
// shares the same attribute/index objects (same GL buffers, no copies) gives each mesh its own cached VAO.
// Call once after the scene is built (before the warm-up). Returns the number of meshes re-wrapped.
import { BufferGeometry } from 'three';

export function uniqueInstancedGeometry(root) {
  const seen = new Set();
  let n = 0;
  root.traverse((o) => {
    if (!o.isInstancedMesh || !o.geometry) return;
    const g = o.geometry;
    if (!seen.has(g)) { seen.add(g); return; } // first user keeps the original
    const w = new BufferGeometry();
    w.name = g.name;
    w.setIndex(g.index);
    for (const k in g.attributes) w.setAttribute(k, g.attributes[k]);
    for (const k in g.morphAttributes) w.morphAttributes[k] = g.morphAttributes[k];
    w.morphTargetsRelative = g.morphTargetsRelative;
    for (const gr of g.groups) w.addGroup(gr.start, gr.count, gr.materialIndex);
    w.drawRange.start = g.drawRange.start; w.drawRange.count = g.drawRange.count;
    if (g.boundingBox) w.boundingBox = g.boundingBox.clone();
    if (g.boundingSphere) w.boundingSphere = g.boundingSphere.clone();
    w.userData = g.userData;
    o.geometry = w;
    n++;
  });
  return n;
}
