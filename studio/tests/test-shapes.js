// Uji generator bangun ruang. Jalankan: node tests/test-shapes.js
const Sh = require('../js/shapes.js');

let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'OK   ' : 'GAGAL') + ' ' + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };

const q = (P, i) => Math.round(P[i * 3] * 1e4) + ',' + Math.round(P[i * 3 + 1] * 1e4) + ',' + Math.round(P[i * 3 + 2] * 1e4);

function analyze(g) {
  const P = g.positions, N = g.normals, I = g.indices;
  const edges = new Map();
  let vol = 0, badNormal = 0, area = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const keys = [q(P, a), q(P, b), q(P, c)];
    for (let e = 0; e < 3; e++) {
      const x = keys[e], y = keys[(e + 1) % 3];
      const dir = x < y ? 1 : -1, k = x < y ? x + '|' + y : y + '|' + x;
      const rec = edges.get(k) || { n: 0, d: 0 };
      rec.n++; rec.d += dir; edges.set(k, rec);
    }
    const A = [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], B = [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]], C = [P[c * 3], P[c * 3 + 1], P[c * 3 + 2]];
    vol += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    area += Math.hypot(n[0], n[1], n[2]) / 2;
    const h = [N[a * 3] + N[b * 3] + N[c * 3], N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2]];
    if (n[0] * h[0] + n[1] * h[1] + n[2] * h[2] <= 0) badNormal++;
  }
  let open = 0, nonManifold = 0, inconsistent = 0;
  for (const r of edges.values()) {
    if (r.n !== 2) { if (r.n % 2) open++; else nonManifold++; }
    else if (r.d !== 0) inconsistent++; // dua sisi harus berlawanan arah
  }
  return { vol, area, open, nonManifold, inconsistent, badNormal, edges: edges.size };
}

// jumlah segitiga yang diharapkan untuk bangun beraturan (bidang n-sisi => n-2 segitiga)
const EXPECT_TRI = {
  tetra: 4, hexa: 12, octa: 8, dodeca: 36, icosa: 20,
  truncTetra: 4 * 4 + 4, cuboct: 8 + 12, truncCube: 8 + 6 * 6, truncOcta: 12 + 8 * 4,
  rhombicuboct: 8 + 18 * 2, truncCuboct: 12 * 2 + 8 * 4 + 6 * 6, icosidodeca: 20 + 12 * 3,
  truncIcosa: 12 * 3 + 20 * 4, truncDodeca: 20 + 12 * 8,
  cube: 12, cuboid: 12, wedge: 8, parallelepiped: 12, rectPyramid: 6,
};

const t0 = Date.now();
for (const type of Object.keys(Sh.DEFS)) {
  const g = Sh.build(type);
  const a = analyze(g);
  const tag = type.padEnd(15);
  ok(tag + 'tertutup (tiap rusuk dipakai 2 segitiga)', a.open === 0 && a.nonManifold === 0, `terbuka=${a.open} lebih=${a.nonManifold} segitiga=${g.triangles}`);
  ok(tag + 'arah muka konsisten & volume positif', a.inconsistent === 0 && a.vol > 0, `vol=${a.vol.toFixed(3)} salahArah=${a.inconsistent}`);
  ok(tag + 'arah muka sejalan dengan normal', a.badNormal === 0, a.badNormal ? 'salah=' + a.badNormal : '');
  if (EXPECT_TRI[type] != null) ok(tag + 'jumlah segitiga sesuai teori', g.triangles === EXPECT_TRI[type], `dapat=${g.triangles} harap=${EXPECT_TRI[type]}`);
  const c = [(g.min[0] + g.max[0]) / 2, (g.min[1] + g.max[1]) / 2, (g.min[2] + g.max[2]) / 2];
  ok(tag + 'berpusat di titik asal', Math.hypot(c[0], c[1], c[2]) < 1e-4);
}

// volume diketahui
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.abs(b);
{
  const g = Sh.build('cube', { s: 3 }), a = analyze(g);
  ok('kubus 3: volume 27', near(a.vol, 27, 1e-4), a.vol.toFixed(4));
}
{
  const g = Sh.build('cuboid', { w: 4, h: 2, d: 3 }), a = analyze(g);
  ok('balok 4x2x3: volume 24', near(a.vol, 24, 1e-4), a.vol.toFixed(4));
}
{
  const r = 2, g = Sh.build('sphere', { r, seg: 64 }), a = analyze(g);
  ok('bola r=2 seg 64: volume ~ 4/3 pi r^3 (<1%)', near(a.vol, (4 / 3) * Math.PI * r ** 3, 0.01), a.vol.toFixed(3) + ' vs ' + ((4 / 3) * Math.PI * r ** 3).toFixed(3));
}
{
  const g = Sh.build('cylinder', { r: 1.5, h: 4, seg: 64 }), a = analyze(g);
  ok('tabung: volume ~ pi r^2 h (<0.5%)', near(a.vol, Math.PI * 1.5 ** 2 * 4, 0.005), a.vol.toFixed(3));
}
{
  const g = Sh.build('cone', { r: 1.5, h: 4, seg: 64 }), a = analyze(g);
  ok('kerucut: volume ~ 1/3 pi r^2 h (<0.5%)', near(a.vol, (Math.PI * 1.5 ** 2 * 4) / 3, 0.005), a.vol.toFixed(3));
}
{
  const g = Sh.build('torus', { R: 2.5, r: 0.8, segR: 64, segr: 32 }), a = analyze(g);
  const exact = 2 * Math.PI ** 2 * 2.5 * 0.8 ** 2;
  ok('torus: volume ~ 2 pi^2 R r^2 (<1%)', near(a.vol, exact, 0.01), a.vol.toFixed(3) + ' vs ' + exact.toFixed(3));
}
{
  const g = Sh.build('hemisphere', { r: 2, seg: 64 }), a = analyze(g);
  ok('setengah bola: volume ~ 2/3 pi r^3 (<1%)', near(a.vol, (2 / 3) * Math.PI * 8, 0.01), a.vol.toFixed(3));
}
{
  const g = Sh.build('ellipsoid', { rx: 2.5, ry: 1.5, rz: 2, seg: 64 }), a = analyze(g);
  const exact = (4 / 3) * Math.PI * 2.5 * 1.5 * 2;
  ok('elipsoid: volume ~ 4/3 pi abc (<1%)', near(a.vol, exact, 0.01), a.vol.toFixed(3));
}
{
  const g = Sh.build('tetra', { e: 3 }), a = analyze(g);
  ok('tetrahedron rusuk 3: volume a^3/(6 sqrt2)', near(a.vol, 27 / (6 * Math.SQRT2), 1e-4), a.vol.toFixed(4));
}
{
  const g = Sh.build('icosa', { e: 2 }), a = analyze(g);
  const exact = (5 * (3 + Math.sqrt(5)) / 12) * 8;
  ok('ikosahedron rusuk 2: volume 5(3+sqrt5)/12 a^3', near(a.vol, exact, 1e-4), a.vol.toFixed(4));
}
{
  const g = Sh.build('prism', { n: 6, r: 1.5, h: 3 }), a = analyze(g);
  ok('prisma segi enam: volume 3sqrt3/2 r^2 h', near(a.vol, (3 * Math.sqrt(3) / 2) * 1.5 ** 2 * 3, 1e-4), a.vol.toFixed(4));
}
{
  const g = Sh.build('pyramid', { n: 4, r: 2, h: 3 }), a = analyze(g);
  ok('limas segi empat (r=2): volume 1/3 luas alas t', near(a.vol, (1 / 3) * 2 * 2 ** 2 * 3, 1e-4), a.vol.toFixed(4));
}
{
  const g = Sh.build('truncIcosa', { e: 1 }), a = analyze(g);
  const exact = (125 + 43 * Math.sqrt(5)) / 4;
  ok('ikosahedron terpancung rusuk 1: volume (125+43 sqrt5)/4', near(a.vol, exact, 1e-4), a.vol.toFixed(4) + ' vs ' + exact.toFixed(4));
}
{
  const g = Sh.build('cuboct', { e: 1 }), a = analyze(g);
  ok('kuboktahedron rusuk 1: volume 5 sqrt2 /3', near(a.vol, (5 * Math.SQRT2) / 3, 1e-4), a.vol.toFixed(4));
}

// rusuk terpendek = panjang rusuk yang diminta
for (const type of ['dodeca', 'octa', 'truncCube', 'truncOcta', 'rhombicuboct', 'truncCuboct', 'icosidodeca', 'truncDodeca']) {
  const e = 2, g = Sh.build(type, { e });
  const P = g.positions; let min = Infinity;
  const seen = new Map();
  for (let i = 0; i < P.length / 3; i++) seen.set(q(P, i), [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
  const pts = [...seen.values()];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]); if (d > 1e-6 && d < min) min = d; }
  ok(type.padEnd(15) + 'rusuk terpendek = 2', Math.abs(min - e) < 1e-3, 'min=' + min.toFixed(4));
}

// semua jumlah sisi & parameter ekstrem tetap valid
for (const [type, params] of [['prism', { n: 3 }], ['prism', { n: 64 }], ['pyramid', { n: 3 }], ['pyramid', { n: 64 }], ['antiprism', { n: 3 }], ['bipyramid', { n: 3 }], ['frustum', { rt: 0, rb: 2 }], ['sphere', { seg: 6 }], ['torus', { segR: 6, segr: 4 }], ['pyramidFrustum', { n: 3 }]]) {
  const g = Sh.build(type, params), a = analyze(g);
  ok(`${type} ${JSON.stringify(params)} valid`, a.open === 0 && a.nonManifold === 0 && a.inconsistent === 0 && a.vol > 0, `tri=${g.triangles}`);
}

// sanitize
{
  const p = Sh.sanitize('sphere', { r: -5, seg: 'abc' });
  ok('sanitize membatasi nilai tak valid', p.r === 0.02 && p.seg === 24, JSON.stringify(p));
}

console.log('waktu', Date.now() - t0, 'ms');
console.log(fails ? `\n${fails} GAGAL` : '\nsemua lulus');
process.exit(fails ? 1 : 0);
