/*
 * Saltoria 3D Studio — Modifier non-destruktif (dihitung ulang dari bentuk dasar tiap kali berubah).
 * Berlaku pada geometri soup lokal {positions, normals, indices, min, max, ranges?}.
 */
(function (root) {
  'use strict';
  const MO = root.S3DMeshOps, PM = root.S3DPoly;
  const MAX_TRIS = 600000;

  const TYPES = {
    mirror: { label: 'Cermin', def: { axis: 'x' }, desc: 'Menggandakan bentuk sebagai bayangan cermin pada sumbu lokal.' },
    array: { label: 'Gandakan (Array)', def: { count: 3, ox: 1.2, oy: 0, oz: 0 }, desc: 'Mengulang bentuk dengan jarak tetap (satuan lokal).' },
    solidify: { label: 'Solidify (tebalkan)', def: { t: 0.1 }, desc: 'Memberi ketebalan pada permukaan (cangkang dalam).' },
    subdiv: { label: 'Subdivisi halus', def: { level: 1 }, desc: 'Menghaluskan bentuk (Catmull-Clark) tanpa mengubah aslinya.' },
  };
  const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  function sanitize(m) {
    if (!m || !TYPES[m.type]) return null;
    const d = TYPES[m.type].def, o = { type: m.type, on: m.on !== false };
    if (m.type === 'mirror') o.axis = ['x', 'y', 'z'].includes(m.axis) ? m.axis : d.axis;
    if (m.type === 'array') { o.count = Math.round(num(m.count, 2, 24, d.count)); o.ox = num(m.ox, -100, 100, d.ox); o.oy = num(m.oy, -100, 100, d.oy); o.oz = num(m.oz, -100, 100, d.oz); }
    if (m.type === 'solidify') o.t = num(m.t, -5, 5, d.t);
    if (m.type === 'subdiv') o.level = Math.round(num(m.level, 1, 3, d.level));
    return o;
  }

  function bounds(positions) {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) for (let a = 0; a < 3; a++) { const v = positions[i + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
    return { min: mn, max: mx };
  }
  // gabung beberapa bagian dengan fungsi transformasi titik/normal
  function build(g, copies) {
    const nV = g.positions.length / 3, k = copies.length;
    const positions = new Float32Array(nV * 3 * k), normals = new Float32Array(nV * 3 * k), indices = new Uint32Array(g.indices.length * k);
    const ranges = g.ranges ? [] : undefined;
    copies.forEach((c, ci) => {
      for (let v = 0; v < nV; v++) {
        const p = c.p([g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2]]), n = c.n([g.normals[v * 3], g.normals[v * 3 + 1], g.normals[v * 3 + 2]]);
        positions.set(p, (ci * nV + v) * 3); normals.set(n, (ci * nV + v) * 3);
      }
      for (let i = 0; i < g.indices.length; i += 3) {
        const a = g.indices[i] + ci * nV, b = g.indices[i + 1] + ci * nV, d = g.indices[i + 2] + ci * nV;
        indices[ci * g.indices.length + i] = a; indices[ci * g.indices.length + i + 1] = c.flip ? d : b; indices[ci * g.indices.length + i + 2] = c.flip ? b : d;
      }
      if (ranges) for (const r of g.ranges) ranges.push({ hex: r.hex, start: r.start + ci * nV, count: r.count });
    });
    const out = Object.assign({ positions, normals, indices, triangles: indices.length / 3 }, bounds(positions));
    if (ranges) out.ranges = ranges;
    return out;
  }

  function mirror(g, m) {
    const ax = { x: 0, y: 1, z: 2 }[m.axis], f = (v) => { const q = v.slice(); q[ax] = -q[ax]; return q; };
    return build(g, [{ p: (v) => v, n: (v) => v }, { p: f, n: f, flip: true }]);
  }
  function array(g, m) {
    const cs = []; for (let i = 0; i < m.count; i++) cs.push({ p: (v) => [v[0] + m.ox * i, v[1] + m.oy * i, v[2] + m.oz * i], n: (v) => v });
    return build(g, cs);
  }
  function solidify(g, m) {
    const nV = g.positions.length / 3, key = (i) => Math.round(g.positions[i * 3] * 1e4) + ',' + Math.round(g.positions[i * 3 + 1] * 1e4) + ',' + Math.round(g.positions[i * 3 + 2] * 1e4);
    const acc = new Map(); // normal rata-rata per posisi
    for (let t = 0; t < g.indices.length; t += 3) {
      const ia = g.indices[t], ib = g.indices[t + 1], ic = g.indices[t + 2], P = g.positions;
      const ux = P[ib * 3] - P[ia * 3], uy = P[ib * 3 + 1] - P[ia * 3 + 1], uz = P[ib * 3 + 2] - P[ia * 3 + 2], vx = P[ic * 3] - P[ia * 3], vy = P[ic * 3 + 1] - P[ia * 3 + 1], vz = P[ic * 3 + 2] - P[ia * 3 + 2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      for (const i of [ia, ib, ic]) { const k = key(i); const a = acc.get(k) || [0, 0, 0]; a[0] += n[0]; a[1] += n[1]; a[2] += n[2]; acc.set(k, a); }
    }
    const off = new Float32Array(nV * 3);
    for (let v = 0; v < nV; v++) { const a = acc.get(key(v)), l = Math.hypot(a[0], a[1], a[2]) || 1; off[v * 3] = a[0] / l; off[v * 3 + 1] = a[1] / l; off[v * 3 + 2] = a[2] / l; }
    const out = build(g, [{ p: (v) => v, n: (v) => v }, { p: (v) => v, n: (v) => [-v[0], -v[1], -v[2]], flip: true }]);
    for (let v = 0; v < nV; v++) for (let a = 0; a < 3; a++) out.positions[(nV + v) * 3 + a] -= off[v * 3 + a] * m.t;
    Object.assign(out, bounds(out.positions));
    return out;
  }
  function subdiv(g, m) {
    const Ed = root.S3DEditMode; if (!Ed || !PM) return g;
    let pm = PM.fromTriMesh(Ed.soupToTri(g));
    if (pm.F.length * Math.pow(4, m.level) > MAX_TRIS) throw new Error('Subdivisi terlalu besar');
    PM.catmullClark(pm, m.level);
    const tri = PM.toTriMesh(pm);
    const soup = MO.toSoup(tri, 4, 'y', true);
    return soup;
  }

  function apply(g, mods) {
    for (const raw of mods || []) {
      const m = sanitize(raw); if (!m || !m.on) continue;
      if (m.type === 'mirror') g = mirror(g, m);
      else if (m.type === 'array') g = array(g, m);
      else if (m.type === 'solidify') g = solidify(g, m);
      else if (m.type === 'subdiv') g = subdiv(g, m);
      if (g.indices.length / 3 > MAX_TRIS) throw new Error('Hasil modifier terlalu besar (' + (g.indices.length / 3) + ' segitiga).');
    }
    return g;
  }

  root.S3DMods = { TYPES, sanitize, apply, MAX_TRIS };
})(typeof self !== 'undefined' ? self : this);
