/*
 * Saltoria 3D Studio — generator bangun ruang.
 * Semua bentuk dibuat sebagai mesh tertutup (posisi, normal, indeks) berpusat di titik asal.
 * Bentuk berpermukaan datar dibuat lewat convex hull dari daftar titik sudut, jadi sisi
 * yang sebidang otomatis digabung menjadi satu bidang rapi. Bentuk lengkung memakai normal analitik.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.S3DShapes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const PHI = (1 + Math.sqrt(5)) / 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------------------------------------------------------------- */
  /* Pembangun mesh                                                    */
  /* ---------------------------------------------------------------- */

  function Builder() { this.p = []; this.n = []; this.i = []; }
  Builder.prototype.v = function (x, y, z, nx, ny, nz) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz);
    return this.p.length / 3 - 1;
  };
  Builder.prototype.tri = function (a, b, c) { this.i.push(a, b, c); };

  // Arahkan segitiga mulai dari indeks `from` agar searah normal titik; buang yang luasnya nol.
  Builder.prototype.fix = function (from) {
    const P = this.p, N = this.n, keep = [];
    for (let t = from; t < this.i.length; t += 3) {
      const a = this.i[t], b = this.i[t + 1], c = this.i[t + 2];
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * nx + ny * ny + nz * nz < 1e-14) continue;
      const hx = N[a * 3] + N[b * 3] + N[c * 3], hy = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], hz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
      if (nx * hx + ny * hy + nz * hz < 0) keep.push(a, c, b); else keep.push(a, b, c);
    }
    this.i.length = from;
    for (let k = 0; k < keep.length; k++) this.i.push(keep[k]);
  };

  // Kisi (rows+1) x (cols+1); fn(i,j) -> [x,y,z,nx,ny,nz]
  Builder.prototype.grid = function (rows, cols, fn) {
    const from = this.i.length, base = this.p.length / 3, W = cols + 1;
    for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) { const q = fn(i, j); this.v(q[0], q[1], q[2], q[3], q[4], q[5]); }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const a = base + i * W + j, b = a + 1, c = a + W, d = c + 1;
      this.tri(a, b, c); this.tri(c, b, d);
    }
    this.fix(from);
  };

  Builder.prototype.disc = function (y, r, seg, ny) {
    const from = this.i.length;
    const c = this.v(0, y, 0, 0, ny, 0);
    const ring = [];
    for (let k = 0; k <= seg; k++) { const a = (TAU * k) / seg; ring.push(this.v(r * Math.cos(a), y, r * Math.sin(a), 0, ny, 0)); }
    for (let k = 0; k < seg; k++) this.tri(c, ring[k], ring[k + 1]);
    this.fix(from);
  };

  /* ---------------------------------------------------------------- */
  /* Bentuk lengkung                                                   */
  /* ---------------------------------------------------------------- */

  function ellipsoid(rx, ry, rz, seg) {
    seg = Math.max(6, seg | 0);
    const rings = Math.max(3, Math.round(seg / 2));
    const b = new Builder();
    b.grid(rings, seg, (i, j) => {
      const th = (Math.PI * i) / rings, ph = (TAU * j) / seg;
      const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      const nx = x / rx, ny = y / ry, nz = z / rz, l = Math.hypot(nx, ny, nz) || 1;
      return [rx * x, ry * y, rz * z, nx / l, ny / l, nz / l];
    });
    return b;
  }

  function hemisphere(r, seg) {
    seg = Math.max(6, seg | 0);
    const rings = Math.max(2, Math.round(seg / 4));
    const b = new Builder();
    b.grid(rings, seg, (i, j) => {
      const th = ((Math.PI / 2) * i) / rings, ph = (TAU * j) / seg;
      const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      return [r * x, r * y, r * z, x, y, z];
    });
    b.disc(0, r, seg, -1);
    return b;
  }

  function coneLike(rb, rt, h, seg) {
    seg = Math.max(3, seg | 0);
    const b = new Builder(), hh = h / 2, slope = rb - rt;
    b.grid(1, seg, (i, j) => {
      const a = (TAU * j) / seg, c = Math.cos(a), s = Math.sin(a);
      const r = i === 0 ? rt : rb, y = i === 0 ? hh : -hh;
      const nx = c * h, ny = slope, nz = s * h, l = Math.hypot(nx, ny, nz) || 1;
      return [r * c, y, r * s, nx / l, ny / l, nz / l];
    });
    if (rb > 1e-9) b.disc(-hh, rb, seg, -1);
    if (rt > 1e-9) b.disc(hh, rt, seg, 1);
    return b;
  }

  function torus(R, r, segR, segr) {
    segR = Math.max(3, segR | 0); segr = Math.max(3, segr | 0);
    const b = new Builder();
    b.grid(segr, segR, (i, j) => {
      const v = (TAU * i) / segr, u = (TAU * j) / segR;
      const cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
      return [(R + r * cv) * cu, r * sv, (R + r * cv) * su, cv * cu, sv, cv * su];
    });
    return b;
  }

  /* ---------------------------------------------------------------- */
  /* Bentuk bersisi datar (convex hull)                                */
  /* ---------------------------------------------------------------- */

  function uniq(points) {
    const seen = new Set(), out = [];
    for (const p of points) {
      const k = p.map((v) => Math.round(v * 1e6) / 1e6 + 0).join(',');
      if (!seen.has(k)) { seen.add(k); out.push(p); }
    }
    return out;
  }

  function hullFaces(points) {
    const n = points.length;
    let scale = 0;
    for (const p of points) scale = Math.max(scale, Math.hypot(p[0], p[1], p[2]));
    scale = scale || 1;
    const eps = 1e-6 * scale;
    const faces = new Map();
    for (let i = 0; i < n - 2; i++) for (let j = i + 1; j < n - 1; j++) for (let k = j + 1; k < n; k++) {
      const a = points[i], b = points[j], c = points[k];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-9 * scale * scale) continue;
      nx /= len; ny /= len; nz /= len;
      let d = nx * a[0] + ny * a[1] + nz * a[2];
      let pos = 0, neg = 0;
      for (let m = 0; m < n; m++) {
        const s = nx * points[m][0] + ny * points[m][1] + nz * points[m][2] - d;
        if (s > eps) pos++; else if (s < -eps) neg++;
        if (pos && neg) break;
      }
      if (pos && neg) continue;
      if (pos) { nx = -nx; ny = -ny; nz = -nz; d = -d; }
      const key = [nx, ny, nz, d / scale].map((v) => (Math.round(v * 1e4) || 0)).join(',');
      if (faces.has(key)) continue;
      const verts = [];
      for (let m = 0; m < n; m++) {
        const s = nx * points[m][0] + ny * points[m][1] + nz * points[m][2] - d;
        if (Math.abs(s) <= eps) verts.push(m);
      }
      faces.set(key, { n: [nx, ny, nz], verts });
    }
    return Array.from(faces.values());
  }

  function polyhedron(rawPoints) {
    const points = uniq(rawPoints);
    const faces = hullFaces(points);
    const b = new Builder();
    for (const f of faces) {
      const vs = f.verts.map((k) => points[k]);
      let cx = 0, cy = 0, cz = 0;
      for (const p of vs) { cx += p[0]; cy += p[1]; cz += p[2]; }
      cx /= vs.length; cy /= vs.length; cz /= vs.length;
      const n = f.n;
      let ux = vs[0][0] - cx, uy = vs[0][1] - cy, uz = vs[0][2] - cz;
      let ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      const wx = n[1] * uz - n[2] * uy, wy = n[2] * ux - n[0] * uz, wz = n[0] * uy - n[1] * ux; // n x u
      const order = vs.map((p) => ({ p, a: Math.atan2((p[0] - cx) * wx + (p[1] - cy) * wy + (p[2] - cz) * wz, (p[0] - cx) * ux + (p[1] - cy) * uy + (p[2] - cz) * uz) }));
      order.sort((x, y) => x.a - y.a);
      const idx = order.map((o) => b.v(o.p[0], o.p[1], o.p[2], n[0], n[1], n[2]));
      for (let t = 1; t < idx.length - 1; t++) b.tri(idx[0], idx[t], idx[t + 1]);
    }
    return b;
  }

  // helper koordinat
  function signs(p) {
    const out = [];
    for (let s = 0; s < 8; s++) out.push([p[0] * (s & 1 ? -1 : 1), p[1] * (s & 2 ? -1 : 1), p[2] * (s & 4 ? -1 : 1)]);
    return out;
  }
  function perms(p) { return [[p[0], p[1], p[2]], [p[0], p[2], p[1]], [p[1], p[0], p[2]], [p[1], p[2], p[0]], [p[2], p[0], p[1]], [p[2], p[1], p[0]]]; }
  function cyc(p) { return [[p[0], p[1], p[2]], [p[1], p[2], p[0]], [p[2], p[0], p[1]]]; }
  const allSP = (p) => perms(p).flatMap(signs);
  const cycS = (p) => cyc(p).flatMap(signs);

  function scaleToEdge(points, edge) {
    const pts = uniq(points);
    let min = Infinity;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]);
      if (d > 1e-9 && d < min) min = d;
    }
    const k = edge / min;
    return pts.map((p) => [p[0] * k, p[1] * k, p[2] * k]);
  }

  const SQ2 = Math.SQRT2;
  const COORDS = {
    tetra: () => [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
    hexa: () => signs([1, 1, 1]),
    octa: () => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
    dodeca: () => signs([1, 1, 1]).concat(cycS([0, 1 / PHI, PHI])),
    icosa: () => cycS([0, 1, PHI]),
    truncTetra: () => perms([3, 1, 1]).flatMap(signs).filter((p) => p.filter((v) => v < 0).length % 2 === 0),
    cuboct: () => allSP([1, 1, 0]),
    truncCube: () => allSP([SQ2 - 1, 1, 1]),
    truncOcta: () => allSP([0, 1, 2]),
    rhombicuboct: () => allSP([1, 1, 1 + SQ2]),
    truncCuboct: () => allSP([1, 1 + SQ2, 1 + 2 * SQ2]),
    icosidodeca: () => cycS([0, 0, PHI]).concat(cycS([0.5, PHI / 2, (PHI * PHI) / 2])),
    truncIcosa: () => cycS([0, 1, 3 * PHI]).concat(cycS([1, 2 + PHI, 2 * PHI]), cycS([PHI, 2, 2 * PHI + 1])),
    truncDodeca: () => cycS([0, 1 / PHI, 2 + PHI]).concat(cycS([1 / PHI, PHI, 2 * PHI]), cycS([PHI, 2, PHI + 1])),
  };

  function ngon(n, r, y, offset) {
    const out = [];
    for (let k = 0; k < n; k++) { const a = (TAU * k) / n + offset; out.push([r * Math.cos(a), y, r * Math.sin(a)]); }
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* Daftar bentuk                                                     */
  /* ---------------------------------------------------------------- */

  // Kotak dengan sudut dan rusuk membulat (radius r, rs segmen per seperempat lingkaran).
  function roundedBox(w, h, d, r, rs) {
    const hx = w / 2, hy = h / 2, hz = d / 2;
    r = Math.min(r, Math.min(hx, hy, hz) * 0.999);
    const ix = hx - r, iy = hy - r, iz = hz - r;
    const samples = (hi) => {
      const a = [];
      for (let k = 0; k <= rs; k++) a.push(-hi - r * Math.cos((k / rs) * Math.PI / 2));
      for (let k = 0; k <= rs; k++) a.push(hi + r * Math.sin((k / rs) * Math.PI / 2));
      return a;
    };
    const sx = samples(ix), sy = samples(iy), sz = samples(iz);
    const b = new Builder();
    const pt = (x, y, z) => {
      const cx = clamp(x, -ix, ix), cy = clamp(y, -iy, iy), cz = clamp(z, -iz, iz);
      let nx = x - cx, ny = y - cy, nz = z - cz;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      return [cx + nx * r, cy + ny * r, cz + nz * r, nx, ny, nz];
    };
    const faces = [
      [sy, sz, (i, j) => pt(hx, sy[i], sz[j])], [sy, sz, (i, j) => pt(-hx, sy[i], sz[j])],
      [sx, sz, (i, j) => pt(sx[i], hy, sz[j])], [sx, sz, (i, j) => pt(sx[i], -hy, sz[j])],
      [sx, sy, (i, j) => pt(sx[i], sy[j], hz)], [sx, sy, (i, j) => pt(sx[i], sy[j], -hz)],
    ];
    for (const [A, B, fn] of faces) b.grid(A.length - 1, B.length - 1, fn);
    return b;
  }

  const PR = (k, label, v, min, max, step, int) => ({ k, label, v, min, max, step: step || 0.1, int: !!int });
  const SEG = (v) => PR('seg', 'Segmen', v, 6, 64, 1, true);
  const EDGE = (v) => PR('e', 'Panjang rusuk', v, 0.1, 100, 0.1);

  const DEFS = {
    sphere: { label: 'Bola', en: 'Sphere', params: [PR('r', 'Jari-jari', 2, 0.02, 100), SEG(24)], build: (p) => ellipsoid(p.r, p.r, p.r, p.seg) },
    hemisphere: { label: 'Setengah bola', en: 'Hemisphere', params: [PR('r', 'Jari-jari', 2, 0.02, 100), SEG(24)], build: (p) => hemisphere(p.r, p.seg) },
    cylinder: { label: 'Tabung', en: 'Cylinder', params: [PR('r', 'Jari-jari', 1.5, 0.02, 100), PR('h', 'Tinggi', 4, 0.02, 200), SEG(24)], build: (p) => coneLike(p.r, p.r, p.h, p.seg) },
    cone: { label: 'Kerucut', en: 'Cone', params: [PR('r', 'Jari-jari alas', 1.5, 0.02, 100), PR('h', 'Tinggi', 4, 0.02, 200), SEG(24)], build: (p) => coneLike(p.r, 0, p.h, p.seg) },
    frustum: { label: 'Kerucut terpancung', en: 'Frustum of a cone', params: [PR('rb', 'Jari-jari bawah', 2, 0.02, 100), PR('rt', 'Jari-jari atas', 1, 0, 100), PR('h', 'Tinggi', 3, 0.02, 200), SEG(24)], build: (p) => coneLike(p.rb, p.rt, p.h, p.seg) },
    torus: { label: 'Torus', en: 'Torus', params: [PR('R', 'Jari-jari cincin', 2.5, 0.2, 100), PR('r', 'Jari-jari tabung', 0.8, 0.05, 50), PR('segR', 'Segmen cincin', 32, 6, 96, 1, true), PR('segr', 'Segmen tabung', 16, 4, 48, 1, true)], build: (p) => torus(p.R, p.r, p.segR, p.segr) },
    ellipsoid: { label: 'Elipsoid', en: 'Ellipsoid', params: [PR('rx', 'Jari-jari X', 2.5, 0.02, 100), PR('ry', 'Jari-jari Y', 1.5, 0.02, 100), PR('rz', 'Jari-jari Z', 2, 0.02, 100), SEG(24)], build: (p) => ellipsoid(p.rx, p.ry, p.rz, p.seg) },

    cube: { label: 'Kubus', en: 'Cube', params: [PR('s', 'Sisi', 3, 0.02, 200), PR('r', 'Radius sudut', 0, 0, 100, 0.05), PR('rs', 'Segmen sudut', 4, 1, 10, 1, true)], build: (p) => (p.r > 0 ? roundedBox(p.s, p.s, p.s, p.r, p.rs) : polyhedron(signs([p.s / 2, p.s / 2, p.s / 2]))) },
    cuboid: { label: 'Balok', en: 'Cuboid', params: [PR('w', 'Panjang (X)', 4, 0.02, 200), PR('h', 'Tinggi (Y)', 2, 0.02, 200), PR('d', 'Lebar (Z)', 3, 0.02, 200), PR('r', 'Radius sudut', 0, 0, 100, 0.05), PR('rs', 'Segmen sudut', 4, 1, 10, 1, true)], build: (p) => (p.r > 0 ? roundedBox(p.w, p.h, p.d, p.r, p.rs) : polyhedron(signs([p.w / 2, p.h / 2, p.d / 2]))) },
    prism: { label: 'Prisma segi-n', en: 'Polygonal prism', params: [PR('n', 'Jumlah sisi alas', 6, 3, 64, 1, true), PR('r', 'Jari-jari alas', 1.5, 0.02, 100), PR('h', 'Tinggi', 3, 0.02, 200)], build: (p) => polyhedron(ngon(p.n, p.r, -p.h / 2, Math.PI / p.n).concat(ngon(p.n, p.r, p.h / 2, Math.PI / p.n))) },

    pyramid: { label: 'Limas segi-n', en: 'Polygonal pyramid', params: [PR('n', 'Jumlah sisi alas', 5, 3, 64, 1, true), PR('r', 'Jari-jari alas', 2, 0.02, 100), PR('h', 'Tinggi', 3, 0.02, 200)], build: (p) => polyhedron(ngon(p.n, p.r, -p.h / 2, Math.PI / p.n).concat([[0, p.h / 2, 0]])) },
    rectPyramid: { label: 'Limas segi empat', en: 'Rectangular pyramid', params: [PR('w', 'Panjang alas (X)', 3, 0.02, 200), PR('d', 'Lebar alas (Z)', 3, 0.02, 200), PR('h', 'Tinggi', 3, 0.02, 200)], build: (p) => polyhedron(signs([p.w / 2, 0, p.d / 2]).filter((q) => q[1] === 0).map((q) => [q[0], -p.h / 2, q[2]]).concat([[0, p.h / 2, 0]])) },
    pyramidFrustum: { label: 'Limas terpancung', en: 'Frustum of a pyramid', params: [PR('n', 'Jumlah sisi alas', 4, 3, 64, 1, true), PR('rb', 'Jari-jari bawah', 2, 0.02, 100), PR('rt', 'Jari-jari atas', 1, 0.05, 100), PR('h', 'Tinggi', 2.5, 0.02, 200)], build: (p) => polyhedron(ngon(p.n, p.rb, -p.h / 2, Math.PI / p.n).concat(ngon(p.n, p.rt, p.h / 2, Math.PI / p.n))) },

    tetra: { label: 'Tetrahedron', en: 'Tetrahedron', params: [EDGE(3)], build: (p) => polyhedron(scaleToEdge(COORDS.tetra(), p.e)) },
    hexa: { label: 'Heksahedron', en: 'Hexahedron (cube)', params: [EDGE(3)], build: (p) => polyhedron(scaleToEdge(COORDS.hexa(), p.e)) },
    octa: { label: 'Oktahedron', en: 'Octahedron', params: [EDGE(3)], build: (p) => polyhedron(scaleToEdge(COORDS.octa(), p.e)) },
    dodeca: { label: 'Dodekahedron', en: 'Dodecahedron', params: [EDGE(2)], build: (p) => polyhedron(scaleToEdge(COORDS.dodeca(), p.e)) },
    icosa: { label: 'Ikosahedron', en: 'Icosahedron', params: [EDGE(2)], build: (p) => polyhedron(scaleToEdge(COORDS.icosa(), p.e)) },

    bipyramid: { label: 'Bipiramida', en: 'Bipyramid', params: [PR('n', 'Jumlah sisi tengah', 5, 3, 64, 1, true), PR('r', 'Jari-jari tengah', 1.5, 0.02, 100), PR('h', 'Tinggi total', 4, 0.2, 200)], build: (p) => polyhedron(ngon(p.n, p.r, 0, 0).concat([[0, p.h / 2, 0], [0, -p.h / 2, 0]])) },
    antiprism: { label: 'Antiprisma', en: 'Antiprism', params: [PR('n', 'Jumlah sisi alas', 6, 3, 64, 1, true), PR('r', 'Jari-jari alas', 1.5, 0.02, 100), PR('h', 'Tinggi', 2, 0.02, 200)], build: (p) => polyhedron(ngon(p.n, p.r, -p.h / 2, 0).concat(ngon(p.n, p.r, p.h / 2, Math.PI / p.n))) },
    wedge: { label: 'Baji', en: 'Wedge', params: [PR('w', 'Panjang (X)', 4, 0.02, 200), PR('h', 'Tinggi (Y)', 2, 0.02, 200), PR('d', 'Lebar (Z)', 3, 0.02, 200)], build: (p) => polyhedron([[-p.w / 2, -p.h / 2, -p.d / 2], [p.w / 2, -p.h / 2, -p.d / 2], [-p.w / 2, p.h / 2, -p.d / 2], [-p.w / 2, -p.h / 2, p.d / 2], [p.w / 2, -p.h / 2, p.d / 2], [-p.w / 2, p.h / 2, p.d / 2]]) },
    parallelepiped: { label: 'Paralelepipedum', en: 'Parallelepiped', params: [PR('w', 'Panjang alas (X)', 3, 0.02, 200), PR('h', 'Tinggi (Y)', 2.5, 0.02, 200), PR('d', 'Lebar alas (Z)', 3, 0.02, 200), PR('sx', 'Miring ke X', 1.2, -100, 100), PR('sz', 'Miring ke Z', 0.6, -100, 100)], build: (p) => polyhedron(signs([p.w / 2, 0, p.d / 2]).filter((q) => q[1] === 0).flatMap((q) => [[q[0], -p.h / 2, q[2]], [q[0] + p.sx, p.h / 2, q[2] + p.sz]])) },

    truncTetra: { label: 'Tetrahedron terpancung', en: 'Truncated tetrahedron', params: [EDGE(2)], build: (p) => polyhedron(scaleToEdge(COORDS.truncTetra(), p.e)) },
    cuboct: { label: 'Kuboktahedron', en: 'Cuboctahedron', params: [EDGE(2)], build: (p) => polyhedron(scaleToEdge(COORDS.cuboct(), p.e)) },
    truncCube: { label: 'Kubus terpancung', en: 'Truncated cube', params: [EDGE(1.5)], build: (p) => polyhedron(scaleToEdge(COORDS.truncCube(), p.e)) },
    truncOcta: { label: 'Oktahedron terpancung', en: 'Truncated octahedron', params: [EDGE(1.5)], build: (p) => polyhedron(scaleToEdge(COORDS.truncOcta(), p.e)) },
    rhombicuboct: { label: 'Rombikuboktahedron', en: 'Rhombicuboctahedron', params: [EDGE(1.5)], build: (p) => polyhedron(scaleToEdge(COORDS.rhombicuboct(), p.e)) },
    truncCuboct: { label: 'Kuboktahedron terpancung', en: 'Truncated cuboctahedron', params: [EDGE(1)], build: (p) => polyhedron(scaleToEdge(COORDS.truncCuboct(), p.e)) },
    icosidodeca: { label: 'Ikosidodekahedron', en: 'Icosidodecahedron', params: [EDGE(1.5)], build: (p) => polyhedron(scaleToEdge(COORDS.icosidodeca(), p.e)) },
    truncIcosa: { label: 'Ikosahedron terpancung (bola sepak)', en: 'Truncated icosahedron', params: [EDGE(1)], build: (p) => polyhedron(scaleToEdge(COORDS.truncIcosa(), p.e)) },
    truncDodeca: { label: 'Dodekahedron terpancung', en: 'Truncated dodecahedron', params: [EDGE(1)], build: (p) => polyhedron(scaleToEdge(COORDS.truncDodeca(), p.e)) },
  };

  const it = (type, label, params) => ({ type, label: label || DEFS[type].label, params: params || null });
  const CATALOG = [
    { id: 'curve', label: 'Bangun ruang sisi lengkung', items: [it('sphere'), it('hemisphere'), it('cylinder'), it('cone'), it('frustum'), it('torus'), it('ellipsoid')] },
    { id: 'prism', label: 'Prisma', items: [it('cube'), it('cuboid'), it('prism', 'Prisma segitiga', { n: 3 }), it('prism', 'Prisma segi lima', { n: 5 }), it('prism', 'Prisma segi enam', { n: 6 }), it('prism', 'Prisma segi tujuh', { n: 7 }), it('prism', 'Prisma segi delapan', { n: 8 }), it('prism', 'Prisma segi-n', { n: 10 })] },
    { id: 'pyramid', label: 'Limas (piramida)', items: [it('pyramid', 'Limas segitiga', { n: 3 }), it('rectPyramid'), it('pyramid', 'Limas segi lima', { n: 5 }), it('pyramid', 'Limas segi enam', { n: 6 }), it('pyramid', 'Limas segi delapan', { n: 8 }), it('pyramidFrustum')] },
    { id: 'platonic', label: 'Bangun platonik', items: [it('tetra'), it('hexa'), it('octa'), it('dodeca'), it('icosa')] },
    { id: 'special', label: 'Bangun ruang khusus', items: [it('bipyramid'), it('antiprism'), it('wedge'), it('parallelepiped')] },
    { id: 'archimedean', label: 'Bangun Archimedean', items: [it('truncTetra'), it('cuboct'), it('truncCube'), it('truncOcta'), it('rhombicuboct'), it('truncCuboct'), it('icosidodeca'), it('truncIcosa'), it('truncDodeca')] },
  ];

  /* ---------------------------------------------------------------- */
  /* API                                                               */
  /* ---------------------------------------------------------------- */

  function defaults(type) {
    const d = {};
    for (const s of DEFS[type].params) d[s.k] = s.v;
    return d;
  }

  function sanitize(type, params) {
    const out = defaults(type);
    for (const s of DEFS[type].params) {
      let v = params && Number(params[s.k]);
      if (!isFinite(v)) v = s.v;
      v = clamp(v, s.min, s.max);
      if (s.int) v = Math.round(v);
      out[s.k] = v;
    }
    return out;
  }

  function build(type, params) {
    if (!DEFS[type]) throw new Error('Bentuk tidak dikenal: ' + type);
    const p = sanitize(type, params);
    const b = DEFS[type].build(p);
    const P = new Float32Array(b.p);
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < min[k]) min[k] = P[i + k]; if (P[i + k] > max[k]) max[k] = P[i + k]; }
    const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    for (let i = 0; i < P.length; i += 3) { P[i] -= c[0]; P[i + 1] -= c[1]; P[i + 2] -= c[2]; }
    return {
      positions: P, normals: new Float32Array(b.n), indices: Uint32Array.from(b.i),
      min: [min[0] - c[0], min[1] - c[1], min[2] - c[2]], max: [max[0] - c[0], max[1] - c[1], max[2] - c[2]],
      triangles: b.i.length / 3, params: p,
    };
  }

  // Haluskan normal: tiap sudut segitiga merata-ratakan normal muka bertetangga yang sudutnya
  // tidak lebih dari `angleDeg` dari mukanya sendiri (angleDeg >= 180 = halus penuh).
  function smoothNormals(g, angleDeg) {
    const P = g.positions, I = g.indices, nT = I.length / 3;
    const fn = new Float32Array(nT * 3);
    const key = (i) => Math.round(P[i * 3] * 1e4) + ',' + Math.round(P[i * 3 + 1] * 1e4) + ',' + Math.round(P[i * 3 + 2] * 1e4);
    const groups = new Map();
    for (let t = 0; t < nT; t++) {
      const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      fn[t * 3] = uy * vz - uz * vy; fn[t * 3 + 1] = uz * vx - ux * vz; fn[t * 3 + 2] = ux * vy - uy * vx; // tak dinormalkan = berbobot luas
      for (const v of [a, b, c]) { const k = key(v); let l = groups.get(k); if (!l) groups.set(k, (l = [])); l.push(t); }
    }
    const unit = (t) => { const x = fn[t * 3], y = fn[t * 3 + 1], z = fn[t * 3 + 2], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
    const cosT = Math.cos((clamp(angleDeg, 0, 180) * Math.PI) / 180);
    const N = new Float32Array(g.normals.length);
    for (let t = 0; t < nT; t++) {
      const own = unit(t);
      for (let c = 0; c < 3; c++) {
        const v = I[t * 3 + c];
        let sx = 0, sy = 0, sz = 0;
        for (const u of groups.get(key(v))) {
          const nu = unit(u);
          if (nu[0] * own[0] + nu[1] * own[1] + nu[2] * own[2] >= cosT - 1e-6) { sx += fn[u * 3]; sy += fn[u * 3 + 1]; sz += fn[u * 3 + 2]; }
        }
        const l = Math.hypot(sx, sy, sz) || 1;
        N[v * 3] = sx / l; N[v * 3 + 1] = sy / l; N[v * 3 + 2] = sz / l;
      }
    }
    return Object.assign({}, g, { normals: N });
  }

  return { DEFS, CATALOG, defaults, sanitize, build, smoothNormals, PHI };
});
