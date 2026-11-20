/*
 * Saltoria 3D Studio — Boolean (CSG) berbasis pohon BSP.
 * Masukan: daftar segitiga dunia {p:[[x,y,z]*3], c:indeksWarna}. Keluaran: segitiga baru dengan warna terbawa.
 * Batas: mesh harus tertutup (rapat) agar hasil benar; mesh bocor/berpotongan sendiri bisa menghasilkan lubang.
 */
(function (root) {
  'use strict';
  const EPS = 1e-5;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  function Poly(v, c, plane) {
    this.v = v; this.c = c;
    if (plane) this.plane = plane;
    else { const n = cross(sub(v[1], v[0]), sub(v[2], v[0])), l = Math.hypot(n[0], n[1], n[2]) || 1; const nn = [n[0] / l, n[1] / l, n[2] / l]; this.plane = { n: nn, w: dot(nn, v[0]) }; }
  }
  const flipPoly = (p) => { p.v.reverse(); p.plane = { n: [-p.plane.n[0], -p.plane.n[1], -p.plane.n[2]], w: -p.plane.w }; };

  function splitPoly(plane, poly, cf, cb, f, b) {
    let type = 0; const types = [];
    for (const p of poly.v) { const t = dot(plane.n, p) - plane.w, ty = t < -EPS ? 2 : t > EPS ? 1 : 0; type |= ty; types.push(ty); }
    if (type === 0) (dot(plane.n, poly.plane.n) > 0 ? cf : cb).push(poly);
    else if (type === 1) f.push(poly);
    else if (type === 2) b.push(poly);
    else {
      const fv = [], bv = [];
      for (let i = 0; i < poly.v.length; i++) {
        const j = (i + 1) % poly.v.length, ti = types[i], tj = types[j], vi = poly.v[i], vj = poly.v[j];
        if (ti !== 2) fv.push(vi); if (ti !== 1) bv.push(ti !== 2 ? vi.slice() : vi);
        if ((ti | tj) === 3) { const t = (plane.w - dot(plane.n, vi)) / dot(plane.n, sub(vj, vi)), v = lerp(vi, vj, t); fv.push(v); bv.push(v.slice()); }
      }
      if (fv.length >= 3) f.push(new Poly(fv, poly.c, poly.plane));
      if (bv.length >= 3) b.push(new Poly(bv, poly.c, poly.plane));
    }
  }

  function Node(polys) { this.plane = null; this.front = null; this.back = null; this.polys = []; if (polys && polys.length) this.build(polys); }
  Node.prototype.invert = function () {
    const stack = [this];
    while (stack.length) {
      const n = stack.pop();
      for (const p of n.polys) flipPoly(p);
      if (n.plane) n.plane = { n: [-n.plane.n[0], -n.plane.n[1], -n.plane.n[2]], w: -n.plane.w };
      const t = n.front; n.front = n.back; n.back = t;
      if (n.front) stack.push(n.front); if (n.back) stack.push(n.back);
    }
  };
  Node.prototype.clipPolys = function (polys) {
    if (!this.plane) return polys.slice();
    let f = [], b = [];
    for (const p of polys) splitPoly(this.plane, p, f, b, f, b);
    if (this.front) f = this.front.clipPolys(f);
    b = this.back ? this.back.clipPolys(b) : [];
    return f.concat(b);
  };
  Node.prototype.clipTo = function (bsp) { const stack = [this]; while (stack.length) { const n = stack.pop(); n.polys = bsp.clipPolys(n.polys); if (n.front) stack.push(n.front); if (n.back) stack.push(n.back); } };
  Node.prototype.all = function () { let out = []; const stack = [this]; while (stack.length) { const n = stack.pop(); out = out.concat(n.polys); if (n.front) stack.push(n.front); if (n.back) stack.push(n.back); } return out; };
  Node.prototype.build = function (polys) {
    if (!polys.length) return;
    if (!this.plane) this.plane = polys[Math.floor(polys.length / 2)].plane;
    const f = [], b = [];
    for (const p of polys) splitPoly(this.plane, p, this.polys, this.polys, f, b);
    if (f.length) { if (!this.front) this.front = new Node(); this.front.build(f); }
    if (b.length) { if (!this.back) this.back = new Node(); this.back.build(b); }
  };

  const toPolys = (tris) => tris.filter((t) => { const n = cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0])); return Math.hypot(n[0], n[1], n[2]) > 1e-14; }).map((t) => new Poly(t.p.map((q) => q.slice()), t.c));

  function run(op, A, B) {
    const a = new Node(toPolys(A)), b = new Node(toPolys(B));
    if (op === 'union') { a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert(); a.build(b.all()); }
    else if (op === 'difference') { a.invert(); a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert(); a.build(b.all()); a.invert(); }
    else if (op === 'intersect') { a.invert(); b.clipTo(a); b.invert(); a.clipTo(b); b.clipTo(a); a.build(b.all()); a.invert(); }
    else throw new Error('operasi boolean tidak dikenal: ' + op);
    const out = [];
    for (const p of a.all()) for (let i = 1; i < p.v.length - 1; i++) out.push({ p: [p.v[0], p.v[i], p.v[i + 1]], c: p.c });
    return out;
  }

  // geometri soup dunia → segitiga; colorOf(rangeIndex|-1) memberi indeks warna
  function fromGeo(g, colorIdx) {
    const tris = [], rg = g.ranges || null;
    const cOf = (vi) => { if (!rg) return colorIdx(null); for (let r = 0; r < rg.length; r++) if (vi >= rg[r].start && vi < rg[r].start + rg[r].count) return colorIdx(rg[r].hex); return colorIdx(null); };
    for (let t = 0; t < g.indices.length; t += 3) {
      const ia = g.indices[t], ib = g.indices[t + 1], ic = g.indices[t + 2], P = g.positions;
      tris.push({ p: [[P[ia * 3], P[ia * 3 + 1], P[ia * 3 + 2]], [P[ib * 3], P[ib * 3 + 1], P[ib * 3 + 2]], [P[ic * 3], P[ic * 3 + 1], P[ic * 3 + 2]]], c: cOf(ia) });
    }
    return tris;
  }
  // segitiga → mesh {P,T,C,pal} (titik dilas oleh pemanggil)
  function toMesh(tris, pal) {
    const P = new Float64Array(tris.length * 9), T = new Uint32Array(tris.length * 3), C = new Uint16Array(tris.length);
    tris.forEach((t, i) => { for (let k = 0; k < 3; k++) { P.set(t.p[k], i * 9 + k * 3); T[i * 3 + k] = i * 3 + k; } C[i] = t.c; });
    return { P, T, C, pal };
  }

  root.S3DCSG = { run, fromGeo, toMesh };
})(typeof self !== 'undefined' ? self : this);
