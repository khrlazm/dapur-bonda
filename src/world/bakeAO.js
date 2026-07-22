import * as THREE from 'three/webgpu';

// Runtime ambient-occlusion bake. For each vertex of the given (static) meshes
// we cast a small hemisphere of rays against the same meshes' triangles and
// darken the vertex by how many are blocked nearby. The result is written to a
// per-vertex 'color' attribute and multiplied in via material.vertexColors — so
// it needs no second UV set and, because AO is lighting-independent, it survives
// the random day/night/weather. One-time cost at load (the scene is low-poly).
export function bakeVertexAO(meshes, { rays = 12, maxDist = 1.1, strength = 0.6 } = {}) {
  if (!meshes || meshes.length === 0) return;

  // ---- gather occluder triangles in world space ----
  const tri = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const m of meshes) {
    m.updateWorldMatrix(true, false);
    const g = m.geometry, pos = g.attributes.position;
    if (!pos) continue;
    const idx = g.index, mw = m.matrixWorld;
    const count = idx ? idx.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, ia).applyMatrix4(mw);
      b.fromBufferAttribute(pos, ib).applyMatrix4(mw);
      c.fromBufferAttribute(pos, ic).applyMatrix4(mw);
      tri.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
  }
  const T = new Float32Array(tri), nTri = T.length / 9;

  // ---- cosine-weighted hemisphere directions (golden-angle spiral) ----
  const S = [];
  for (let i = 0; i < rays; i++) {
    const u = (i + 0.5) / rays, phi = i * 2.399963;
    const sinT = Math.sqrt(u), cosT = Math.sqrt(1 - u);
    S.push([Math.cos(phi) * sinT, cosT, Math.sin(phi) * sinT]);
  }

  const origin = new THREE.Vector3(), normal = new THREE.Vector3();
  const tan = new THREE.Vector3(), bit = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), sideAxis = new THREE.Vector3(1, 0, 0);

  for (const m of meshes) {
    const g = m.geometry, pos = g.attributes.position, nor = g.attributes.normal;
    if (!pos || !nor) continue;
    const mw = m.matrixWorld, nmat = new THREE.Matrix3().getNormalMatrix(mw);
    const colors = new Float32Array(pos.count * 3);

    for (let v = 0; v < pos.count; v++) {
      origin.fromBufferAttribute(pos, v).applyMatrix4(mw);
      normal.fromBufferAttribute(nor, v).applyMatrix3(nmat).normalize();
      tan.crossVectors(Math.abs(normal.y) < 0.99 ? up : sideAxis, normal).normalize();
      bit.crossVectors(normal, tan);
      const ox = origin.x + normal.x * 0.004, oy = origin.y + normal.y * 0.004, oz = origin.z + normal.z * 0.004;

      let occ = 0;
      for (let s = 0; s < rays; s++) {
        const sx = S[s][0], sy = S[s][1], sz = S[s][2];
        const dx = tan.x * sx + bit.x * sz + normal.x * sy;
        const dy = tan.y * sx + bit.y * sz + normal.y * sy;
        const dz = tan.z * sx + bit.z * sz + normal.z * sy;
        if (rayHits(T, nTri, ox, oy, oz, dx, dy, dz, maxDist)) occ++;
      }
      const ao = 1 - (occ / rays) * strength;
      colors[v * 3] = colors[v * 3 + 1] = colors[v * 3 + 2] = ao;
    }

    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // Clone the (often shared) material so enabling vertexColors here doesn't
    // force it on other meshes that have no color attribute.
    m.material = m.material.clone();
    m.material.vertexColors = true;
  }
}

// Möller–Trumbore, double-sided; true if any triangle is hit within maxDist.
function rayHits(T, nTri, ox, oy, oz, dx, dy, dz, maxDist) {
  const EPS = 1e-6;
  for (let t = 0; t < nTri; t++) {
    const o = t * 9;
    const ax = T[o], ay = T[o + 1], az = T[o + 2];
    const e1x = T[o + 3] - ax, e1y = T[o + 4] - ay, e1z = T[o + 5] - az;
    const e2x = T[o + 6] - ax, e2y = T[o + 7] - ay, e2z = T[o + 8] - az;
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -EPS && det < EPS) continue;
    const inv = 1 / det;
    const tx = ox - ax, ty = oy - ay, tz = oz - az;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const vv = (dx * qx + dy * qy + dz * qz) * inv;
    if (vv < 0 || u + vv > 1) continue;
    const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (dist > EPS && dist < maxDist) return true;
  }
  return false;
}
