/*
 * Library objek siap pakai. Setiap objek dirakit dari bentuk dasar (S3DShapes) dengan warna per bagian.
 * Bagian: { t: tipe, p: parameter, pos:[x,y,z], rot:[x,y,z] derajat, s:[x,y,z], c: warna }.
 * Posisi bagian dihitung dari pusat bentuk; alas objek otomatis diratakan ke y = 0 oleh editor.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.S3DLibrary = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const K = {
    wood: '#9d7449', dwood: '#64442b', leaf: '#5aa24f', dleaf: '#37793f', leaf2: '#78b85c', stone: '#9ea3a8', dstone: '#6d7379',
    red: '#e5534b', blue: '#4f8cff', sky: '#7be8ff', white: '#f2f5fb', black: '#20242e', yellow: '#ffd25a',
    orange: '#ff9a3c', pink: '#ff8fb8', violet: '#9d85ff', green: '#6bd47f', brown: '#7a5233', cream: '#f6dfb3',
    gold: '#f2c14e', metal: '#b9c4d6', dmetal: '#7b8798', glass: '#9fd8ff', skin: '#f1c9a0', grey: '#8a93a3',
  };

  const P = (t, p, x, y, z, c, rot, s) => ({ t, p, pos: [x, y, z], rot: rot || [0, 0, 0], s: s || [1, 1, 1], c });
  // Sudut balok dibulatkan otomatis (radius mengikuti sisi terpendek). Panel tipis tetap rata.
  // Jumlah segmen menyesuaikan ukuran bagian: kecil = ringan, besar = halus.
  const sg = (r, hi) => (r < 0.2 ? 12 : r < 0.4 ? 16 : r < 0.8 ? 22 : hi);
  const rb = (w, h, d) => { const m = Math.min(w, h, d); if (m < 0.16) return { r: 0, rs: 1 }; return { r: +Math.min(m * 0.2, 0.2).toFixed(3), rs: m >= 1 ? 2 : 1 }; };
  const box = (w, h, d, x, y, z, c, rot) => P('cuboid', Object.assign({ w, h, d }, rb(w, h, d)), x, y, z, c, rot);
  const cyl = (r, h, x, y, z, c, rot, seg) => P('cylinder', { r, h, seg: seg || sg(r, 28) }, x, y, z, c, rot);
  const sph = (r, x, y, z, c, s) => P('sphere', { r, seg: sg(r, 26) }, x, y, z, c, null, s);
  const cone = (r, h, x, y, z, c, rot) => P('cone', { r, h, seg: sg(r, 28) }, x, y, z, c, rot);
  const pyr = (n, r, h, x, y, z, c, rot) => P('pyramid', { n, r, h }, x, y, z, c, rot);
  const rpy = (w, d, h, x, y, z, c, rot) => P('rectPyramid', { w, d, h }, x, y, z, c, rot);
  const prm = (n, r, h, x, y, z, c, rot) => P('prism', { n, r, h }, x, y, z, c, rot);
  const tor = (R, r, x, y, z, c, rot) => P('torus', { R, r, segR: 36, segr: 16 }, x, y, z, c, rot);
  const ell = (rx, ry, rz, x, y, z, c, rot) => P('ellipsoid', { rx, ry, rz, seg: sg(Math.max(rx, ry, rz), 26) }, x, y, z, c, rot);
  const hem = (r, x, y, z, c, rot) => P('hemisphere', { r, seg: sg(r, 26) }, x, y, z, c, rot);
  const fru = (rb, rt, h, x, y, z, c, rot) => P('frustum', { rb: rb, rt, h, seg: sg(Math.max(rb, rt), 28) }, x, y, z, c, rot);
  const wed = (w, h, d, x, y, z, c, rot) => P('wedge', { w, h, d }, x, y, z, c, rot);

  const L = [];
  const add = (cat, id, name, parts) => L.push({ cat, id, name, parts });

  /* ---------------- Bangunan ---------------- */
  add('Bangunan', 'rumah', 'Rumah', [box(4, 2.6, 3.4, 0, 1.3, 0, K.cream), rpy(4.8, 4, 1.8, 0, 3.5, 0, K.red), box(0.8, 1.5, 0.12, 0, 0.75, 1.75, K.dwood), box(0.8, 0.8, 0.12, 1.3, 1.5, 1.75, K.glass), box(0.8, 0.8, 0.12, -1.3, 1.5, 1.75, K.glass), box(0.6, 1.1, 0.6, 1.3, 3.4, -0.5, K.stone)]);
  add('Bangunan', 'gedung', 'Gedung tinggi', [box(3, 9, 3, 0, 4.5, 0, K.dmetal), box(3.1, 0.25, 3.1, 0, 3, 0, K.glass), box(3.1, 0.25, 3.1, 0, 5.5, 0, K.glass), box(3.1, 0.25, 3.1, 0, 8, 0, K.glass), cyl(0.08, 1.6, 0, 9.8, 0, K.metal)]);
  add('Bangunan', 'menara', 'Menara', [fru(1.8, 1.2, 6, 0, 3, 0, K.stone), cyl(1.5, 0.5, 0, 6.2, 0, K.dstone), cone(1.5, 2, 0, 7.5, 0, K.blue)]);
  add('Bangunan', 'kastil', 'Kastil', [box(6, 3, 4, 0, 1.5, 0, K.stone), cyl(1, 5, -3, 2.5, 2, K.stone), cyl(1, 5, 3, 2.5, 2, K.stone), cyl(1, 5, -3, 2.5, -2, K.stone), cyl(1, 5, 3, 2.5, -2, K.stone), cone(1.3, 1.6, -3, 5.8, 2, K.red), cone(1.3, 1.6, 3, 5.8, 2, K.red), cone(1.3, 1.6, -3, 5.8, -2, K.red), cone(1.3, 1.6, 3, 5.8, -2, K.red), box(1.4, 2, 0.2, 0, 1, 2.05, K.dwood)]);
  add('Bangunan', 'gubuk', 'Gubuk', [box(3, 1.8, 3, 0, 0.9, 0, K.wood), pyr(4, 2.6, 1.8, 0, 2.7, 0, '#d9b45a', [0, 45, 0]), box(0.7, 1.2, 0.1, 0, 0.6, 1.52, K.dwood)]);
  add('Bangunan', 'gerbang', 'Gerbang', [box(0.9, 4, 0.9, -2.4, 2, 0, K.stone), box(0.9, 4, 0.9, 2.4, 2, 0, K.stone), box(6, 0.9, 1, 0, 4.4, 0, K.red), box(7, 0.35, 1.3, 0, 5, 0, K.dstone)]);
  add('Bangunan', 'pagar', 'Pagar', [box(0.2, 1.4, 0.2, -2, 0.7, 0, K.wood), box(0.2, 1.4, 0.2, -1, 0.7, 0, K.wood), box(0.2, 1.4, 0.2, 0, 0.7, 0, K.wood), box(0.2, 1.4, 0.2, 1, 0.7, 0, K.wood), box(0.2, 1.4, 0.2, 2, 0.7, 0, K.wood), box(4.4, 0.18, 0.12, 0, 1.0, 0.1, K.dwood), box(4.4, 0.18, 0.12, 0, 0.45, 0.1, K.dwood)]);
  add('Bangunan', 'jembatan', 'Jembatan', [box(8, 0.4, 2, 0, 1.2, 0, K.wood), box(0.4, 1.4, 0.4, -3.8, 0.7, 0.8, K.dwood), box(0.4, 1.4, 0.4, 3.8, 0.7, 0.8, K.dwood), box(0.4, 1.4, 0.4, -3.8, 0.7, -0.8, K.dwood), box(0.4, 1.4, 0.4, 3.8, 0.7, -0.8, K.dwood), box(8, 0.15, 0.15, 0, 2, 0.95, K.dwood), box(8, 0.15, 0.15, 0, 2, -0.95, K.dwood)]);
  add('Bangunan', 'tangga', 'Tangga', [box(3, 0.5, 1, 0, 0.25, 0, K.stone), box(3, 0.5, 1, 0, 0.75, -1, K.stone), box(3, 0.5, 1, 0, 1.25, -2, K.stone), box(3, 0.5, 1, 0, 1.75, -3, K.stone)]);
  add('Bangunan', 'pilar', 'Pilar', [box(2, 0.4, 2, 0, 0.2, 0, K.white), cyl(0.7, 4, 0, 2.4, 0, K.white, null, 16), box(2, 0.4, 2, 0, 4.6, 0, K.white)]);

  /* ---------------- Alam ---------------- */
  add('Alam', 'pohon', 'Pohon', [cyl(0.35, 2.2, 0, 1.1, 0, K.dwood), sph(1.5, 0, 3.2, 0, K.leaf), sph(1.0, 0.9, 2.7, 0.3, K.dleaf), sph(0.9, -0.9, 2.8, -0.3, K.dleaf)]);
  add('Alam', 'cemara', 'Pohon cemara', [cyl(0.3, 1, 0, 0.5, 0, K.dwood), cone(1.7, 1.8, 0, 1.9, 0, K.dleaf), cone(1.4, 1.6, 0, 3.0, 0, K.dleaf), cone(1.0, 1.4, 0, 4.0, 0, K.leaf)]);
  add('Alam', 'palem', 'Pohon palem', [cyl(0.22, 4, 0, 2, 0, K.brown), ell(1.6, 0.18, 0.5, 1.2, 4.1, 0, K.green, [0, 0, 20]), ell(1.6, 0.18, 0.5, -1.2, 4.1, 0, K.green, [0, 0, -20]), ell(0.5, 0.18, 1.6, 0, 4.1, 1.2, K.green, [-20, 0, 0]), ell(0.5, 0.18, 1.6, 0, 4.1, -1.2, K.green, [20, 0, 0])]);
  add('Alam', 'semak', 'Semak', [sph(0.9, 0, 0.7, 0, K.leaf), sph(0.7, 0.8, 0.5, 0.2, K.dleaf), sph(0.7, -0.8, 0.5, -0.1, K.dleaf)]);
  add('Alam', 'batu', 'Batu', [ell(1.6, 1.1, 1.3, 0, 0.9, 0, K.stone), ell(0.8, 0.6, 0.7, 1.4, 0.5, 0.4, K.dstone)]);
  add('Alam', 'gunung', 'Gunung', [pyr(5, 4.5, 5, 0, 2.5, 0, K.dstone), pyr(5, 1.55, 1.7, 0, 4.15, 0, K.white)]);
  add('Alam', 'bunga', 'Bunga', [cyl(0.07, 1.6, 0, 0.8, 0, K.green), sph(0.22, 0, 1.7, 0, K.yellow), sph(0.2, 0.32, 1.7, 0, K.pink), sph(0.2, -0.32, 1.7, 0, K.pink), sph(0.2, 0, 1.7, 0.32, K.pink), sph(0.2, 0, 1.7, -0.32, K.pink)]);
  add('Alam', 'jamur', 'Jamur', [cyl(0.4, 1, 0, 0.5, 0, K.cream), hem(1.2, 0, 1, 0, K.red), sph(0.18, 0.5, 1.9, 0.4, K.white), sph(0.16, -0.5, 1.8, 0.2, K.white), sph(0.15, 0.1, 2.15, -0.4, K.white)]);
  add('Alam', 'awan', 'Awan', [sph(1, 0, 1, 0, K.white), sph(0.85, 1.2, 0.8, 0, K.white), sph(0.8, -1.2, 0.8, 0, K.white), sph(0.7, 0.4, 1.5, 0.2, K.white)]);

  /* ---------------- Furnitur ---------------- */
  add('Furnitur', 'kursi', 'Kursi', [box(1.4, 0.2, 1.4, 0, 1.1, 0, K.wood), box(1.4, 1.5, 0.2, 0, 1.95, -0.6, K.wood), box(0.15, 1.1, 0.15, -0.6, 0.55, 0.6, K.dwood), box(0.15, 1.1, 0.15, 0.6, 0.55, 0.6, K.dwood), box(0.15, 1.1, 0.15, -0.6, 0.55, -0.6, K.dwood), box(0.15, 1.1, 0.15, 0.6, 0.55, -0.6, K.dwood)]);
  add('Furnitur', 'meja', 'Meja', [box(3, 0.2, 1.8, 0, 1.5, 0, K.wood), box(0.2, 1.4, 0.2, -1.3, 0.7, 0.7, K.dwood), box(0.2, 1.4, 0.2, 1.3, 0.7, 0.7, K.dwood), box(0.2, 1.4, 0.2, -1.3, 0.7, -0.7, K.dwood), box(0.2, 1.4, 0.2, 1.3, 0.7, -0.7, K.dwood)]);
  add('Furnitur', 'sofa', 'Sofa', [box(3.4, 0.7, 1.5, 0, 0.55, 0, K.blue), box(3.4, 1.1, 0.4, 0, 1.2, -0.55, K.blue), box(0.4, 0.9, 1.5, -1.5, 0.95, 0, K.blue), box(0.4, 0.9, 1.5, 1.5, 0.95, 0, K.blue), box(0.2, 0.2, 0.2, -1.4, 0.1, 0.6, K.black), box(0.2, 0.2, 0.2, 1.4, 0.1, 0.6, K.black)]);
  add('Furnitur', 'kasur', 'Tempat tidur', [box(2.4, 0.5, 4, 0, 0.5, 0, K.dwood), box(2.2, 0.4, 3.6, 0, 0.95, 0.1, K.white), box(2.4, 1.6, 0.2, 0, 1.2, -2, K.dwood), box(1.8, 0.3, 0.7, 0, 1.3, -1.5, K.sky), box(2.2, 0.15, 2, 0, 1.2, 0.8, K.blue)]);
  add('Furnitur', 'lemari', 'Lemari', [box(2.2, 4, 1.2, 0, 2, 0, K.wood), box(0.06, 3.6, 0.05, 0, 2, 0.62, K.dwood), box(0.1, 0.5, 0.1, -0.2, 2, 0.68, K.gold), box(0.1, 0.5, 0.1, 0.2, 2, 0.68, K.gold)]);
  add('Furnitur', 'lampu', 'Lampu', [cyl(0.5, 0.15, 0, 0.08, 0, K.dmetal), cyl(0.06, 2.6, 0, 1.4, 0, K.metal), fru(0.9, 0.5, 1, 0, 3.1, 0, K.yellow)]);
  add('Furnitur', 'rakbuku', 'Rak buku', [box(2.6, 4, 0.8, 0, 2, 0, K.dwood), box(2.3, 0.9, 0.7, 0, 0.7, 0.05, K.red), box(2.3, 0.9, 0.7, 0, 1.75, 0.05, K.blue), box(2.3, 0.9, 0.7, 0, 2.8, 0.05, K.green), box(2.3, 0.7, 0.7, 0, 3.65, 0.05, K.yellow)]);
  add('Furnitur', 'pot', 'Pot tanaman', [fru(0.7, 1, 1.2, 0, 0.6, 0, K.orange), cyl(0.9, 0.1, 0, 1.2, 0, K.brown), sph(0.9, 0, 1.9, 0, K.leaf), sph(0.5, 0.6, 2.2, 0.2, K.dleaf)]);
  add('Furnitur', 'peti', 'Peti kayu', [box(2, 2, 2, 0, 1, 0, K.wood), box(2.1, 0.2, 0.2, 0, 1.7, 1.0, K.dwood), box(2.1, 0.2, 0.2, 0, 0.3, 1.0, K.dwood), box(0.2, 2.1, 0.2, 0.9, 1, 1.0, K.dwood), box(0.2, 2.1, 0.2, -0.9, 1, 1.0, K.dwood)]);

  /* ---------------- Kendaraan ---------------- */
  add('Kendaraan', 'mobil', 'Mobil', [box(4, 0.9, 2, 0, 0.9, 0, K.red), box(2.2, 0.8, 1.8, -0.2, 1.7, 0, K.glass), cyl(0.5, 0.35, 1.3, 0.5, 1, K.black, [90, 0, 0]), cyl(0.5, 0.35, -1.3, 0.5, 1, K.black, [90, 0, 0]), cyl(0.5, 0.35, 1.3, 0.5, -1, K.black, [90, 0, 0]), cyl(0.5, 0.35, -1.3, 0.5, -1, K.black, [90, 0, 0]), box(0.1, 0.3, 0.4, 2.02, 1, 0.6, K.yellow), box(0.1, 0.3, 0.4, 2.02, 1, -0.6, K.yellow)]);
  add('Kendaraan', 'truk', 'Truk', [box(1.6, 1.8, 2.2, 2.2, 1.4, 0, K.blue), box(4.2, 2.2, 2.2, -1, 1.6, 0, K.white), box(0.1, 0.8, 1.7, 3.05, 1.9, 0, K.glass), cyl(0.55, 0.4, 2.4, 0.55, 1.1, K.black, [90, 0, 0]), cyl(0.55, 0.4, 2.4, 0.55, -1.1, K.black, [90, 0, 0]), cyl(0.55, 0.4, -1.8, 0.55, 1.1, K.black, [90, 0, 0]), cyl(0.55, 0.4, -1.8, 0.55, -1.1, K.black, [90, 0, 0])]);
  add('Kendaraan', 'perahu', 'Perahu', [wed(4, 1, 2, 0, 0.5, 0, K.wood, [0, 0, 0]), box(3, 0.9, 1.8, -0.6, 0.45, 0, K.wood), cyl(0.07, 3.2, -0.3, 2.5, 0, K.dwood), rpy(2, 0.1, 2.4, -0.3, 2.6, 0, K.white, [0, 0, 0])]);
  add('Kendaraan', 'pesawat', 'Pesawat', [cyl(0.6, 5, 0, 0, 0, K.white, [0, 0, 90]), cone(0.6, 1.2, 3.1, 0, 0, K.red, [0, 0, -90]), box(1.1, 0.12, 5, 0.3, 0, 0, K.blue), box(0.8, 1, 0.1, -2.2, 0.6, 0, K.red), box(0.8, 0.1, 1.8, -2.2, 0.1, 0, K.blue)]);
  add('Kendaraan', 'roket', 'Roket', [cyl(0.8, 3.6, 0, 2.2, 0, K.white), cone(0.8, 1.4, 0, 4.7, 0, K.red), wed(0.8, 1.4, 0.2, 0.9, 0.9, 0, K.red), wed(0.8, 1.4, 0.2, -0.9, 0.9, 0, K.red, [0, 180, 0]), sph(0.3, 0, 2.7, 0.75, K.sky), cone(0.5, 0.9, 0, -0.1, 0, K.orange, [180, 0, 0])]);
  add('Kendaraan', 'sepeda', 'Sepeda', [tor(0.8, 0.09, 1.2, 0.9, 0, K.black, [90, 0, 0]), tor(0.8, 0.09, -1.2, 0.9, 0, K.black, [90, 0, 0]), box(2.4, 0.12, 0.12, 0, 1.4, 0, K.red), box(0.12, 1.1, 0.12, -0.4, 1.7, 0, K.red), box(0.12, 0.8, 0.12, 1.0, 1.7, 0, K.red), box(0.8, 0.1, 0.5, 1.1, 2.1, 0, K.black), box(0.5, 0.1, 0.4, -0.5, 2.3, 0, K.black)]);
  add('Kendaraan', 'kereta', 'Kereta', [box(5, 1.8, 1.8, 0, 1.4, 0, K.blue), box(1.6, 1.2, 1.7, 1.6, 2.9, 0, K.blue), cyl(0.5, 0.2, -1.6, 0.5, 0.95, K.black, [90, 0, 0]), cyl(0.5, 0.2, 0, 0.5, 0.95, K.black, [90, 0, 0]), cyl(0.5, 0.2, 1.6, 0.5, 0.95, K.black, [90, 0, 0]), cyl(0.5, 0.2, -1.6, 0.5, -0.95, K.black, [90, 0, 0]), cyl(0.5, 0.2, 0, 0.5, -0.95, K.black, [90, 0, 0]), cyl(0.5, 0.2, 1.6, 0.5, -0.95, K.black, [90, 0, 0])]);
  add('Kendaraan', 'heli', 'Helikopter', [ell(1.6, 1, 1, 0, 1.3, 0, K.red), cyl(0.15, 2.6, -2.2, 1.5, 0, K.red, [0, 0, 90]), cyl(0.1, 0.6, 0, 2.5, 0, K.metal), box(5, 0.08, 0.3, 0, 2.85, 0, K.dmetal), box(0.3, 0.08, 5, 0, 2.85, 0, K.dmetal), box(2.6, 0.1, 0.1, 0, 0.1, 0.7, K.dmetal), box(2.6, 0.1, 0.1, 0, 0.1, -0.7, K.dmetal)]);

  /* ---------------- Hewan ---------------- */
  add('Hewan', 'kucing', 'Kucing', [ell(1.2, 0.7, 0.65, 0, 1.15, 0, K.orange), ell(0.5, 0.5, 0.45, 0.85, 1.05, 0, K.cream), sph(0.6, 1.25, 1.8, 0, K.orange), ell(0.26, 0.2, 0.3, 1.78, 1.68, 0, K.cream), sph(0.07, 2.03, 1.72, 0, '#ff8fb8'), sph(0.07, 1.78, 1.95, 0.27, K.black), sph(0.07, 1.78, 1.95, -0.27, K.black), cone(0.2, 0.42, 1.1, 2.5, 0.3, K.orange), cone(0.2, 0.42, 1.1, 2.5, -0.3, K.orange), cyl(0.12, 1.4, -1.45, 1.7, 0, K.orange, [0, 0, 45]), sph(0.13, -1.95, 2.2, 0, K.cream), cyl(0.15, 0.9, 0.7, 0.45, 0.32, K.orange), cyl(0.15, 0.9, 0.7, 0.45, -0.32, K.orange), cyl(0.15, 0.9, -0.7, 0.45, 0.32, K.orange), cyl(0.15, 0.9, -0.7, 0.45, -0.32, K.orange)]);
  add('Hewan', 'anjing', 'Anjing', [ell(1.3, 0.7, 0.6, 0, 1.3, 0, K.brown), sph(0.6, 1.4, 1.9, 0, K.brown), box(0.5, 0.35, 0.4, 2.0, 1.75, 0, K.cream), ell(0.15, 0.4, 0.2, 1.2, 1.8, 0.5, K.dwood), ell(0.15, 0.4, 0.2, 1.2, 1.8, -0.5, K.dwood), cyl(0.15, 1, 0.8, 0.5, 0.35, K.brown), cyl(0.15, 1, 0.8, 0.5, -0.35, K.brown), cyl(0.15, 1, -0.8, 0.5, 0.35, K.brown), cyl(0.15, 1, -0.8, 0.5, -0.35, K.brown), cyl(0.1, 0.8, -1.5, 1.6, 0, K.brown, [0, 0, 40])]);
  add('Hewan', 'burung', 'Burung', [ell(0.9, 0.8, 0.7, 0, 1.2, 0, K.blue), sph(0.45, 0.8, 1.9, 0, K.blue), cone(0.14, 0.4, 1.4, 1.9, 0, K.yellow, [0, 0, -90]), ell(0.6, 0.12, 0.5, 0, 1.2, 0.7, K.violet, [0, 0, 15]), ell(0.6, 0.12, 0.5, 0, 1.2, -0.7, K.violet, [0, 0, 15]), wed(0.9, 0.1, 0.5, -1.1, 1.0, 0, K.violet), cyl(0.05, 0.5, 0, 0.3, 0.2, K.orange), cyl(0.05, 0.5, 0, 0.3, -0.2, K.orange)]);
  add('Hewan', 'ikan', 'Ikan', [ell(1.3, 0.8, 0.45, 0, 1, 0, K.orange), cone(0.7, 1, -1.7, 1, 0, K.red, [0, 0, 90]), sph(0.12, 0.8, 1.2, 0.35, K.black), sph(0.12, 0.8, 1.2, -0.35, K.black), wed(0.7, 0.5, 0.1, 0, 1.8, 0, K.red)]);
  add('Hewan', 'kelinci', 'Kelinci', [ell(0.9, 0.9, 0.7, 0, 0.9, 0, K.white), sph(0.55, 0.7, 1.9, 0, K.white), ell(0.15, 0.7, 0.12, 0.6, 2.9, 0.2, K.white), ell(0.15, 0.7, 0.12, 0.6, 2.9, -0.2, K.white), sph(0.25, -0.9, 0.9, 0, K.pink), sph(0.08, 1.2, 2.0, 0.22, K.black), sph(0.08, 1.2, 2.0, -0.22, K.black)]);
  add('Hewan', 'babi', 'Babi', [ell(1.3, 0.9, 0.9, 0, 1.2, 0, K.pink), sph(0.65, 1.5, 1.4, 0, K.pink), cyl(0.28, 0.3, 2.1, 1.3, 0, K.pink, [0, 0, 90]), cyl(0.18, 0.7, 0.7, 0.35, 0.5, K.pink), cyl(0.18, 0.7, 0.7, 0.35, -0.5, K.pink), cyl(0.18, 0.7, -0.7, 0.35, 0.5, K.pink), cyl(0.18, 0.7, -0.7, 0.35, -0.5, K.pink)]);
  add('Hewan', 'penguin', 'Penguin', [ell(0.9, 1.3, 0.8, 0, 1.3, 0, K.black), ell(0.65, 1.0, 0.5, 0, 1.2, 0.35, K.white), sph(0.5, 0, 2.8, 0, K.black), cone(0.15, 0.4, 0, 2.7, 0.6, K.orange, [90, 0, 0]), ell(0.15, 0.6, 0.35, 1, 1.4, 0, K.black), ell(0.15, 0.6, 0.35, -1, 1.4, 0, K.black), box(0.6, 0.12, 0.6, 0.4, 0.06, 0.2, K.orange), box(0.6, 0.12, 0.6, -0.4, 0.06, 0.2, K.orange)]);

  /* ---------------- Karakter ---------------- */
  const person = (body, head, legs, arm) => [box(0.8, 1.6, 0.5, 0, 2.2, 0, body), sph(0.5, 0, 3.4, 0, head), box(0.35, 1.4, 0.4, -0.22, 0.7, 0, legs), box(0.35, 1.4, 0.4, 0.22, 0.7, 0, legs), box(0.3, 1.4, 0.3, -0.6, 2.2, 0, arm), box(0.3, 1.4, 0.3, 0.6, 2.2, 0, arm)];
  add('Karakter', 'robot', 'Robot', [box(1.8, 1.8, 1.2, 0, 2.7, 0, K.metal), box(1.3, 1.1, 1.1, 0, 4.2, 0, K.dmetal), box(0.3, 0.2, 0.15, -0.3, 4.3, 0.56, K.sky), box(0.3, 0.2, 0.15, 0.3, 4.3, 0.56, K.sky), cyl(0.05, 0.6, 0, 5.0, 0, K.metal), sph(0.12, 0, 5.4, 0, K.red), box(0.4, 1.6, 0.4, -1.2, 2.7, 0, K.dmetal), box(0.4, 1.6, 0.4, 1.2, 2.7, 0, K.dmetal), box(0.5, 1.4, 0.5, -0.5, 0.7, 0, K.dmetal), box(0.5, 1.4, 0.5, 0.5, 0.7, 0, K.dmetal)]);
  add('Karakter', 'manusia', 'Manusia balok', person(K.blue, K.skin, K.dmetal, K.skin));
  add('Karakter', 'zombie', 'Zombie', [box(0.8, 1.6, 0.5, 0, 2.2, 0, K.dleaf), sph(0.5, 0, 3.4, 0, K.green), box(0.35, 1.4, 0.4, -0.22, 0.7, 0, K.dstone), box(0.35, 1.4, 0.4, 0.22, 0.7, 0, K.dstone), box(0.3, 1.5, 0.3, -0.6, 2.7, 0.7, K.green, [-80, 0, 0]), box(0.3, 1.5, 0.3, 0.6, 2.7, 0.7, K.green, [-80, 0, 0]), box(0.12, 0.12, 0.1, -0.18, 3.5, 0.48, K.red), box(0.12, 0.12, 0.1, 0.18, 3.5, 0.48, K.red)]);
  add('Karakter', 'ksatria', 'Ksatria', [...person(K.metal, K.metal, K.dmetal, K.metal), box(0.7, 0.18, 0.5, 0, 3.55, 0.05, K.black), cone(0.1, 0.5, 0, 4.1, 0, K.red), box(0.12, 2, 0.12, 1.0, 2.4, 0.3, K.white), box(0.4, 0.1, 0.1, 1.0, 1.5, 0.3, K.gold)]);
  add('Karakter', 'penyihir', 'Penyihir', [cone(1.0, 2.6, 0, 1.3, 0, K.violet), sph(0.45, 0, 3.0, 0, K.skin), cyl(0.85, 0.1, 0, 3.4, 0, K.violet), cone(0.6, 1.5, 0, 4.2, 0, K.violet), cyl(0.05, 2.8, 1.0, 1.6, 0.2, K.dwood), sph(0.2, 1.0, 3.1, 0.2, K.sky)]);

  /* ---------------- Makanan ---------------- */
  add('Makanan', 'donat', 'Donat', [tor(1.2, 0.55, 0, 0.55, 0, K.cream, [90, 0, 0]), tor(1.2, 0.5, 0, 0.7, 0, K.pink, [90, 0, 0], ), box(0.1, 0.05, 0.1, 0.6, 1.2, 0.7, K.white), box(0.1, 0.05, 0.1, -0.6, 1.2, -0.7, K.yellow)]);
  add('Makanan', 'eskrim', 'Es krim', [cone(0.8, 2.2, 0, 1.1, 0, K.cream, [180, 0, 0]), sph(0.9, 0, 2.5, 0, K.pink), sph(0.55, 0, 3.4, 0, K.white), sph(0.14, 0, 3.95, 0, K.red)]);
  add('Makanan', 'burger', 'Burger', [hem(1.4, 0, 1.1, 0, K.orange), cyl(1.45, 0.25, 0, 0.95, 0, K.brown), cyl(1.5, 0.12, 0, 0.78, 0, K.green), cyl(1.4, 0.15, 0, 0.62, 0, K.yellow), cyl(1.35, 0.3, 0, 0.35, 0, K.orange)]);
  add('Makanan', 'pizza', 'Irisan pizza', [wed(3, 0.3, 2, 0, 0.15, 0, K.gold), sph(0.2, 0.2, 0.4, 0.2, K.red), sph(0.2, -0.5, 0.4, -0.2, K.red), sph(0.18, 0.8, 0.4, -0.4, K.red)]);
  add('Makanan', 'apel', 'Apel', [sph(1, 0, 1, 0, K.red, [1, 0.92, 1]), cyl(0.07, 0.5, 0, 2.1, 0, K.dwood), ell(0.4, 0.1, 0.2, 0.4, 2.1, 0, K.green, [0, 0, 20])]);
  add('Makanan', 'cupcake', 'Cupcake', [fru(0.7, 1, 1.2, 0, 0.6, 0, K.orange), sph(1, 0, 1.6, 0, K.pink, [1, 0.7, 1]), sph(0.15, 0, 2.4, 0, K.red)]);

  /* ---------------- Teknologi ---------------- */
  add('Teknologi', 'monitor', 'Monitor', [box(4, 2.4, 0.2, 0, 2.6, 0, K.black), box(3.7, 2.1, 0.05, 0, 2.6, 0.12, K.sky), cyl(0.12, 1, 0, 1.0, 0, K.dmetal), box(1.4, 0.12, 0.9, 0, 0.06, 0, K.dmetal)]);
  add('Teknologi', 'laptop', 'Laptop', [box(3.2, 0.15, 2.2, 0, 0.08, 0, K.metal), box(3.2, 2, 0.12, 0, 1.2, -1.05, K.metal, [-8, 0, 0]), box(2.9, 1.7, 0.04, 0, 1.2, -0.98, K.sky, [-8, 0, 0])]);
  add('Teknologi', 'ponsel', 'Ponsel', [box(1.1, 2.2, 0.12, 0, 1.1, 0, K.black), box(0.95, 1.9, 0.02, 0, 1.12, 0.07, K.blue)]);
  add('Teknologi', 'headphone', 'Headphone', [tor(1.2, 0.1, 0, 1.4, 0, K.black, [0, 0, 0]), cyl(0.5, 0.4, -1.2, 0.9, 0, K.red, [0, 0, 90]), cyl(0.5, 0.4, 1.2, 0.9, 0, K.red, [0, 0, 90])]);
  add('Teknologi', 'kamera', 'Kamera', [box(2.4, 1.4, 1, 0, 0.7, 0, K.dmetal), cyl(0.6, 0.6, 0, 0.8, 0.75, K.black, [90, 0, 0]), cyl(0.35, 0.1, 0, 0.8, 1.1, K.sky, [90, 0, 0]), box(0.6, 0.25, 0.4, -0.7, 1.5, 0, K.metal), cyl(0.12, 0.1, 0.8, 1.5, 0.2, K.red)]);
  add('Teknologi', 'konsol', 'Konsol gim', [box(3.2, 0.9, 1.8, 0, 0.45, 0, K.dmetal), cyl(0.2, 0.15, -1.0, 1, 0, K.black), box(0.5, 0.12, 0.12, 0.9, 1, 0.1, K.red), box(0.12, 0.12, 0.5, 0.9, 1, 0.1, K.blue), box(0.12, 0.12, 0.12, 0.5, 1, -0.3, K.green)]);

  /* ---------------- Fantasi ---------------- */
  add('Fantasi', 'pedang', 'Pedang', [box(0.35, 3.2, 0.08, 0, 2.4, 0, K.metal), cone(0.17, 0.5, 0, 4.25, 0, K.metal), box(1.3, 0.18, 0.2, 0, 0.75, 0, K.gold), cyl(0.09, 0.9, 0, 0.25, 0, K.brown), sph(0.14, 0, -0.25, 0, K.gold)]);
  add('Fantasi', 'perisai', 'Perisai', [fru(1.5, 1.5, 0.2, 0, 1.5, 0, K.blue, [90, 0, 0]), cyl(0.5, 0.25, 0, 1.5, 0.05, K.gold, [90, 0, 0]), box(0.25, 2.2, 0.25, 0, 1.5, 0.12, K.gold), box(2.2, 0.25, 0.25, 0, 1.5, 0.12, K.gold)]);
  add('Fantasi', 'kristal', 'Kristal', [P('bipyramid', { n: 6, r: 1, h: 2 }, 0, 2, 0, K.sky), P('bipyramid', { n: 5, r: 0.55, h: 1.2 }, 1.3, 1.3, 0.3, K.violet, [0, 0, -20]), P('bipyramid', { n: 5, r: 0.5, h: 1 }, -1.2, 1.1, -0.2, K.blue, [0, 0, 20])]);
  add('Fantasi', 'hartakarun', 'Peti harta', [box(3, 1.4, 1.8, 0, 0.7, 0, K.wood), P('cylinder', { r: 0.9, h: 3, seg: 16 }, 0, 1.4, 0, K.dwood, [0, 0, 90], [1, 1, 1]), box(0.3, 0.6, 0.15, 0, 1.4, 0.95, K.gold), box(3.1, 0.15, 1.9, 0, 0.5, 0, K.gold), sph(0.3, 0.6, 1.5, 0.4, K.yellow)]);
  add('Fantasi', 'obor', 'Obor', [cyl(0.15, 2.4, 0, 1.2, 0, K.dwood), fru(0.18, 0.4, 0.6, 0, 2.7, 0, K.dmetal), cone(0.38, 1.2, 0, 3.6, 0, K.orange), cone(0.2, 0.8, 0, 3.5, 0, K.yellow)]);
  add('Fantasi', 'tongkat', 'Tongkat sihir', [cyl(0.1, 3.6, 0, 1.8, 0, K.dwood), P('icosa', { e: 0.6 }, 0, 4, 0, K.sky), tor(0.5, 0.06, 0, 4, 0, K.gold, [90, 0, 0]), P('octa', { e: 0.3 }, 0.8, 4.6, 0, K.yellow)]);


  /* ================= Tambahan v4 ================= */
  /* ---- Bangunan ---- */
  add('Bangunan', 'jam', 'Menara jam', [box(2, 5, 2, 0, 2.5, 0, K.stone), box(2.4, 0.3, 2.4, 0, 5.1, 0, K.dstone), rpy(2.4, 2.4, 1.6, 0, 6.0, 0, K.red), cyl(0.7, 0.15, 0, 4, 1.05, K.white, [90, 0, 0]), box(0.08, 0.5, 0.06, 0, 4.2, 1.15, K.black)]);
  add('Bangunan', 'mercusuar', 'Mercusuar', [fru(1.6, 1.0, 5, 0, 2.5, 0, K.white), fru(1.45, 1.3, 1, 0, 1.6, 0, K.red), fru(1.25, 1.1, 1, 0, 3.6, 0, K.red), cyl(0.9, 0.9, 0, 5.4, 0, K.glass), hem(1.1, 0, 5.85, 0, K.red), sph(0.3, 0, 5.4, 0, K.yellow)]);
  add('Bangunan', 'tenda', 'Tenda', [pyr(4, 2.8, 2.2, 0, 1.1, 0, K.orange, [0, 45, 0]), box(0.9, 1.4, 0.05, 0, 0.7, 1.95, K.dmetal)]);
  add('Bangunan', 'rumahpohon', 'Rumah pohon', [cyl(0.5, 4, 0, 2, 0, K.dwood), sph(2.2, 0, 5.5, 0, K.leaf), box(2, 1.4, 2, 0, 4, 0, K.wood), rpy(2.5, 2.5, 1, 0, 5.1, 0, K.red), box(2.6, 0.12, 0.6, 0, 3.3, 1.3, K.dwood)]);
  add('Bangunan', 'kandang', 'Kandang', [box(4, 2.2, 3, 0, 1.1, 0, K.red), wed(4, 1.4, 3, 0, 2.9, 0, K.dmetal, [0, 0, 0]), box(1.3, 1.6, 0.1, 0, 0.8, 1.52, K.white), box(0.15, 1.7, 0.1, 0.6, 0.8, 1.6, K.red, [0, 0, 0])]);
  add('Bangunan', 'sumur', 'Sumur', [cyl(1, 1.1, 0, 0.55, 0, K.stone, null, 24), cyl(0.8, 0.12, 0, 1.12, 0, K.sky, null, 24), box(0.15, 2, 0.15, -1, 2, 0, K.dwood), box(0.15, 2, 0.15, 1, 2, 0, K.dwood), rpy(2.8, 1.6, 0.9, 0, 3.4, 0, K.red)]);
  add('Bangunan', 'gazebo', 'Gazebo', [cyl(2, 0.25, 0, 0.12, 0, K.wood, null, 8), cyl(0.12, 2.6, 1.6, 1.5, 0, K.white), cyl(0.12, 2.6, -1.6, 1.5, 0, K.white), cyl(0.12, 2.6, 0, 1.5, 1.6, K.white), cyl(0.12, 2.6, 0, 1.5, -1.6, K.white), cone(2.6, 1.4, 0, 3.7, 0, K.red)]);
  add('Bangunan', 'posjaga', 'Pos jaga', [box(2, 2.4, 2, 0, 1.2, 0, K.stone), box(2.4, 0.2, 2.4, 0, 2.5, 0, K.dstone), box(1, 0.8, 0.05, 0, 1.5, 1.02, K.glass), pyr(4, 1.9, 1, 0, 3.1, 0, K.red, [0, 45, 0])]);
  add('Bangunan', 'toko', 'Toko', [box(5, 3, 3.4, 0, 1.5, 0, K.cream), box(5.4, 0.4, 3.8, 0, 3.2, 0, K.red), box(5.2, 0.5, 1.2, 0, 2.6, 2.1, K.blue, [18, 0, 0]), box(1, 1.8, 0.1, 1.4, 0.9, 1.72, K.glass), box(1.8, 1.2, 0.1, -1.1, 1.3, 1.72, K.glass)]);
  add('Bangunan', 'jembatanlengkung', 'Jembatan lengkung', [tor(3, 0.35, 0, 0, 0, K.stone, [90, 0, 0]), box(8, 0.4, 1.6, 0, -0.1, 0, K.wood), box(8, 0.12, 0.12, 0, 0.7, 0.75, K.dwood), box(8, 0.12, 0.12, 0, 0.7, -0.75, K.dwood)]);
  add('Bangunan', 'silo', 'Silo', [cyl(1.4, 5, 0, 2.5, 0, K.metal, null, 24), hem(1.4, 0, 5, 0, K.dmetal), box(0.12, 4, 0.12, 1.45, 2.5, 0, K.dmetal)]);
  add('Bangunan', 'kincir', 'Kincir angin', [fru(1.4, 0.8, 4, 0, 2, 0, K.cream), cone(1, 1, 0, 4.5, 0, K.red), box(0.15, 3.6, 0.04, 0, 4.2, 0.9, K.wood), box(3.6, 0.15, 0.04, 0, 4.2, 0.9, K.wood), sph(0.2, 0, 4.2, 0.85, K.dwood)]);

  /* ---- Alam ---- */
  add('Alam', 'kaktus', 'Kaktus', [cyl(0.5, 3.2, 0, 1.6, 0, K.green), cyl(0.3, 1.2, 0.9, 1.9, 0, K.green), cyl(0.3, 0.8, 0.65, 1.4, 0, K.green, [0, 0, 90]), cyl(0.3, 1, -0.9, 2.3, 0, K.green), cyl(0.3, 0.8, -0.65, 1.8, 0, K.green, [0, 0, 90]), sph(0.5, 0, 3.2, 0, K.green)]);
  add('Alam', 'bambu', 'Rumpun bambu', [cyl(0.14, 4.5, 0, 2.25, 0, K.leaf), cyl(0.14, 4.0, 0.4, 2, 0.2, K.dleaf), cyl(0.14, 5, -0.35, 2.5, -0.2, K.leaf), cyl(0.17, 0.08, 0, 1.5, 0, K.dleaf), cyl(0.17, 0.08, -0.35, 2.7, -0.2, K.dleaf)]);
  add('Alam', 'tunggul', 'Tunggul kayu', [cyl(0.9, 1.1, 0, 0.55, 0, K.wood, null, 20), cyl(0.7, 0.05, 0, 1.12, 0, K.cream, null, 20), tor(0.8, 0.05, 0, 1.12, 0, K.dwood, [0, 0, 0])]);
  add('Alam', 'batang', 'Batang kayu', [cyl(0.5, 4, 0, 0.5, 0, K.wood, [0, 0, 90]), cyl(0.38, 0.05, 2.02, 0.5, 0, K.cream, [0, 0, 90]), cyl(0.38, 0.05, -2.02, 0.5, 0, K.cream, [0, 0, 90])]);
  add('Alam', 'kolam', 'Kolam', [cyl(2.4, 0.3, 0, 0.15, 0, K.stone, null, 28), cyl(2.1, 0.32, 0, 0.17, 0, K.sky, null, 28), ell(0.5, 0.08, 0.35, 0.8, 0.4, 0.3, K.green), ell(0.4, 0.08, 0.3, -0.9, 0.4, -0.5, K.green)]);
  add('Alam', 'bukit', 'Bukit', [hem(3, 0, 0, 0, K.leaf, null), P('hemisphere', { r: 1.3, seg: 18 }, 2.6, 0, 0.5, K.dleaf)]);
  add('Alam', 'pulau', 'Pulau kecil', [fru(3, 2.5, 0.8, 0, 0.4, 0, K.cream, null), fru(2.5, 2.2, 0.4, 0, 1.0, 0, K.leaf), cyl(0.2, 2.4, 0.6, 2.2, 0, K.dwood), ell(1.2, 0.15, 0.4, 1.5, 3.4, 0, K.green, [0, 0, 20]), ell(1.2, 0.15, 0.4, -0.3, 3.4, 0, K.green, [0, 0, -20])]);
  add('Alam', 'es', 'Gumpalan es', [P('bipyramid', { n: 5, r: 1.1, h: 3 }, 0, 1.5, 0, K.sky), P('bipyramid', { n: 5, r: 0.7, h: 2 }, 1.3, 1, 0.3, K.glass, [0, 0, -12]), P('bipyramid', { n: 5, r: 0.6, h: 1.6 }, -1.2, 0.8, -0.2, K.glass, [0, 0, 14])]);
  add('Alam', 'bungamatahari', 'Bunga matahari', [cyl(0.1, 2.6, 0, 1.3, 0, K.leaf), cyl(0.6, 0.2, 0, 2.7, 0.1, K.brown, [90, 0, 0]), tor(0.85, 0.28, 0, 2.7, 0.0, K.yellow, [90, 0, 0]), ell(0.5, 0.06, 0.2, 0.5, 1.1, 0, K.green, [0, 0, 25])]);
  add('Alam', 'pohonmati', 'Pohon mati', [cyl(0.35, 3, 0, 1.5, 0, K.dwood), cyl(0.15, 1.5, 0.7, 3, 0, K.dwood, [0, 0, -45]), cyl(0.15, 1.3, -0.6, 2.7, 0, K.dwood, [0, 0, 50]), cyl(0.1, 0.9, 1.3, 3.6, 0, K.dwood, [0, 0, -20])]);
  add('Alam', 'rumput', 'Rumpun rumput', [cone(0.12, 1.2, 0, 0.6, 0, K.green), cone(0.1, 1, 0.2, 0.5, 0.1, K.leaf, [0, 0, -12]), cone(0.1, 1, -0.2, 0.5, -0.05, K.dleaf, [0, 0, 12]), cone(0.1, 0.9, 0, 0.45, 0.2, K.leaf, [12, 0, 0]), cone(0.1, 0.9, 0.05, 0.45, -0.2, K.green, [-12, 0, 0])]);
  add('Alam', 'stalagmit', 'Stalagmit', [cone(0.7, 2.8, 0, 1.4, 0, K.dstone), cone(0.45, 1.8, 0.8, 0.9, 0.2, K.stone), cone(0.35, 1.2, -0.7, 0.6, -0.1, K.grey)]);
  add('Alam', 'karangbatu', 'Tumpukan batu', [P('dodeca', { e: 1 }, 0, 0.9, 0, K.stone), P('dodeca', { e: 0.7 }, 1.3, 0.6, 0.3, K.dstone), P('dodeca', { e: 0.55 }, -1, 0.5, 0.5, K.grey)]);

  /* ---- Furnitur ---- */
  add('Furnitur', 'ranjang', 'Ranjang', [box(3, 0.6, 4, 0, 0.5, 0, K.dwood), box(2.8, 0.5, 3.8, 0, 0.95, 0, K.white), box(2.8, 0.55, 1.4, 0, 1.2, -1.2, K.blue), box(3, 1.6, 0.2, 0, 1.2, -2.05, K.dwood), box(1, 0.3, 0.7, 0, 1.3, 1.3, K.cream)]);
  add('Furnitur', 'lampumeja', 'Lampu meja', [cyl(0.5, 0.12, 0, 0.06, 0, K.dmetal), cyl(0.06, 1.6, 0, 0.9, 0, K.metal), fru(0.7, 0.35, 0.8, 0, 2, 0, K.yellow)]);
  add('Furnitur', 'karpet', 'Karpet', [box(4, 0.1, 3, 0, 0.05, 0, K.red), box(3.4, 0.12, 2.4, 0, 0.06, 0, K.cream), box(2.6, 0.14, 1.6, 0, 0.07, 0, K.red)]);
  add('Furnitur', 'mejamakan', 'Meja makan', [cyl(1.6, 0.2, 0, 1.4, 0, K.wood, null, 28), cyl(0.25, 1.4, 0, 0.7, 0, K.dwood), cyl(0.8, 0.12, 0, 0.06, 0, K.dwood, null, 20), cyl(0.4, 0.08, 0.7, 1.55, 0.3, K.white), cyl(0.4, 0.08, -0.6, 1.55, -0.4, K.white)]);
  add('Furnitur', 'bangku', 'Bangku panjang', [box(3.4, 0.2, 1, 0, 1, 0, K.wood), box(0.2, 1, 0.9, 1.5, 0.5, 0, K.dwood), box(0.2, 1, 0.9, -1.5, 0.5, 0, K.dwood)]);
  add('Furnitur', 'tv', 'Televisi', [box(3.4, 2, 0.2, 0, 2, 0, K.black), box(3.1, 1.7, 0.05, 0, 2, 0.12, K.blue), box(1.2, 0.1, 0.7, 0, 0.85, 0, K.dmetal), box(0.15, 0.4, 0.15, 0, 1.05, 0, K.dmetal)]);
  add('Furnitur', 'kulkas', 'Kulkas', [box(1.8, 4.4, 1.6, 0, 2.2, 0, K.white), box(1.7, 0.05, 0.05, 0, 3.3, 0.82, K.grey), box(0.08, 1.2, 0.1, 0.7, 3.8, 0.85, K.metal), box(0.08, 1.2, 0.1, 0.7, 2.2, 0.85, K.metal)]);
  add('Furnitur', 'jamdinding', 'Jam dinding', [cyl(1.2, 0.25, 0, 1.2, 0, K.wood, [90, 0, 0], 28), cyl(1, 0.06, 0, 1.2, 0.14, K.white, [90, 0, 0], 28), box(0.07, 0.7, 0.04, 0, 1.45, 0.2, K.black), box(0.5, 0.07, 0.04, 0.2, 1.2, 0.2, K.black)]);
  add('Furnitur', 'vas', 'Vas bunga', [P('frustum', { rb: 0.5, rt: 0.8, h: 1.6, seg: 20 }, 0, 0.8, 0, K.sky), cyl(0.05, 1.2, 0, 2.2, 0, K.green), sph(0.3, 0, 2.9, 0, K.pink), cyl(0.05, 1, 0.3, 2.1, 0, K.green, [0, 0, -20]), sph(0.25, 0.55, 2.7, 0, K.yellow)]);
  add('Furnitur', 'tanamanpot', 'Tanaman pot', [fru(0.6, 0.85, 1, 0, 0.5, 0, K.orange), sph(0.7, 0, 1.6, 0, K.leaf), sph(0.5, 0.5, 1.4, 0.2, K.dleaf), sph(0.45, -0.5, 1.35, -0.1, K.leaf)]);

  /* ---- Kendaraan ---- */
  add('Kendaraan', 'bus', 'Bus', [box(6, 2.2, 2, 0, 1.6, 0, K.yellow), box(5.6, 0.8, 0.05, 0, 2.1, 1.03, K.glass), box(5.6, 0.8, 0.05, 0, 2.1, -1.03, K.glass), cyl(0.5, 0.4, -1.9, 0.5, 1, K.black, [90, 0, 0]), cyl(0.5, 0.4, -1.9, 0.5, -1, K.black, [90, 0, 0]), cyl(0.5, 0.4, 1.9, 0.5, 1, K.black, [90, 0, 0]), cyl(0.5, 0.4, 1.9, 0.5, -1, K.black, [90, 0, 0])]);
  add('Kendaraan', 'motor', 'Motor', [tor(0.7, 0.18, -1.3, 0.88, 0, K.black, [0, 90, 0]), tor(0.7, 0.18, 1.3, 0.88, 0, K.black, [0, 90, 0]), box(2.2, 0.7, 0.7, 0, 1.4, 0, K.red), box(1.2, 0.25, 0.6, -0.5, 1.9, 0, K.black), cyl(0.06, 1, 1.1, 1.9, 0, K.metal, [0, 0, -15]), box(0.1, 0.1, 1.1, 1.25, 2.4, 0, K.black)]);
  add('Kendaraan', 'layar', 'Perahu layar', [wed(5, 0.9, 1.8, 0, 0.45, 0, K.wood), cyl(0.08, 4.5, 0, 3, 0, K.dwood), wed(0.05, 3.4, 2.4, 0.0, 3.4, 0.5, K.white, [0, 0, 0]), box(0.05, 0.1, 1, 0, 5.2, 0.5, K.red)]);
  add('Kendaraan', 'gerobak', 'Gerobak', [box(3, 0.8, 1.8, 0, 1.4, 0, K.wood), box(3, 0.6, 0.12, 0, 1.9, 0.95, K.dwood), box(3, 0.6, 0.12, 0, 1.9, -0.95, K.dwood), cyl(0.8, 0.2, 0.6, 0.8, 1.05, K.dwood, [90, 0, 0]), cyl(0.8, 0.2, 0.6, 0.8, -1.05, K.dwood, [90, 0, 0]), box(2.2, 0.1, 0.1, -2.5, 1.2, 0, K.dwood, [0, 0, -10])]);
  add('Kendaraan', 'kapalselam', 'Kapal selam', [ell(3.2, 1, 1, 0, 1, 0, K.yellow), cyl(0.4, 0.8, 0.2, 2.2, 0, K.yellow), cyl(0.05, 0.6, 0.2, 2.9, 0, K.dmetal), tor(0.35, 0.1, -3.2, 1, 0, K.dmetal, [0, 90, 0]), sph(0.28, 1.6, 1.05, 0.7, K.glass), sph(0.28, 0.6, 1.05, 0.9, K.glass)]);
  add('Kendaraan', 'ufo', 'UFO', [ell(2.2, 0.5, 2.2, 0, 1, 0, K.metal), hem(0.9, 0, 1.3, 0, K.sky), sph(0.15, 1.8, 1, 0, K.yellow), sph(0.15, -1.8, 1, 0, K.yellow), sph(0.15, 0, 1, 1.8, K.yellow), sph(0.15, 0, 1, -1.8, K.yellow)]);
  add('Kendaraan', 'skateboard', 'Skateboard', [box(3, 0.15, 0.9, 0, 0.5, 0, K.violet), cyl(0.2, 0.1, -1, 0.2, 0.3, K.white, [90, 0, 0]), cyl(0.2, 0.1, -1, 0.2, -0.3, K.white, [90, 0, 0]), cyl(0.2, 0.1, 1, 0.2, 0.3, K.white, [90, 0, 0]), cyl(0.2, 0.1, 1, 0.2, -0.3, K.white, [90, 0, 0])]);
  add('Kendaraan', 'balap', 'Mobil balap', [box(4.4, 0.6, 1.8, 0, 0.7, 0, K.red), ell(1, 0.4, 0.7, -0.2, 1.1, 0, K.glass), box(0.2, 0.7, 2.4, -2.1, 1.1, 0, K.black), box(0.2, 0.15, 2, 2.2, 0.55, 0, K.black), cyl(0.45, 0.4, 1.4, 0.45, 1, K.black, [90, 0, 0]), cyl(0.45, 0.4, 1.4, 0.45, -1, K.black, [90, 0, 0]), cyl(0.45, 0.4, -1.4, 0.45, 1, K.black, [90, 0, 0]), cyl(0.45, 0.4, -1.4, 0.45, -1, K.black, [90, 0, 0])]);
  add('Kendaraan', 'traktor', 'Traktor', [box(2.2, 1.4, 1.4, 0.4, 1.6, 0, K.green), box(1, 1.2, 1.2, -0.2, 2.8, 0, K.glass), cyl(1, 0.4, -0.7, 1, 1, K.black, [90, 0, 0]), cyl(1, 0.4, -0.7, 1, -1, K.black, [90, 0, 0]), cyl(0.55, 0.4, 1.5, 0.55, 0.9, K.black, [90, 0, 0]), cyl(0.55, 0.4, 1.5, 0.55, -0.9, K.black, [90, 0, 0]), cyl(0.07, 0.8, 1.4, 2.8, 0, K.dmetal)]);

  /* ---- Hewan ---- */
  add('Hewan', 'bebek', 'Bebek', [sph(0.9, 0, 0.9, 0, K.yellow, [1.2, 0.9, 1]), sph(0.5, 0.85, 1.7, 0, K.yellow), box(0.5, 0.12, 0.35, 1.45, 1.6, 0, K.orange), sph(0.1, 1.1, 1.9, 0.3, K.black), sph(0.1, 1.1, 1.9, -0.3, K.black), cone(0.25, 0.5, -1.2, 1.1, 0, K.yellow, [0, 0, 90])]);
  add('Hewan', 'sapi', 'Sapi', [box(2.6, 1.5, 1.4, 0, 1.9, 0, K.white), box(0.8, 0.6, 0.5, -0.4, 2.1, 0.72, K.black), box(0.7, 0.8, 0.5, 0.7, 2, -0.72, K.black), sph(0.65, 1.7, 2.3, 0, K.white), box(0.5, 0.35, 0.6, 2.2, 2.1, 0, K.pink), cone(0.12, 0.4, 1.6, 3.0, 0.4, K.cream), cone(0.12, 0.4, 1.6, 3.0, -0.4, K.cream), cyl(0.22, 1.3, 1, 0.65, 0.5, K.white), cyl(0.22, 1.3, 1, 0.65, -0.5, K.white), cyl(0.22, 1.3, -1, 0.65, 0.5, K.white), cyl(0.22, 1.3, -1, 0.65, -0.5, K.white)]);
  add('Hewan', 'kura', 'Kura-kura', [hem(1.5, 0, 0.6, 0, K.green, null), sph(0.45, 1.8, 0.9, 0, K.leaf), sph(0.35, 0.9, 0.4, 1.1, K.leaf, [1, 0.6, 1]), sph(0.35, 0.9, 0.4, -1.1, K.leaf, [1, 0.6, 1]), sph(0.35, -0.9, 0.4, 1.1, K.leaf, [1, 0.6, 1]), sph(0.35, -0.9, 0.4, -1.1, K.leaf, [1, 0.6, 1])]);
  add('Hewan', 'ular', 'Ular', [tor(1.2, 0.3, 0, 0.3, 0, K.green, [90, 0, 0]), tor(0.7, 0.28, 0, 0.62, 0, K.dleaf, [90, 0, 0]), sph(0.45, 1.5, 0.6, 0.2, K.green), sph(0.08, 1.8, 0.8, 0.35, K.red), sph(0.08, 1.8, 0.8, 0.05, K.red)]);
  add('Hewan', 'laba', 'Laba-laba', [sph(0.9, 0, 1.1, 0, K.black), sph(0.5, 0.9, 1.1, 0, K.black), cyl(0.06, 1.6, 0.3, 0.9, 1.0, K.black, [50, 0, 0]), cyl(0.06, 1.6, 0.3, 0.9, -1.0, K.black, [-50, 0, 0]), cyl(0.06, 1.6, -0.3, 0.9, 1.0, K.black, [50, 0, 0]), cyl(0.06, 1.6, -0.3, 0.9, -1.0, K.black, [-50, 0, 0]), cyl(0.06, 1.6, 0.9, 0.9, 0.9, K.black, [50, 0, 0]), cyl(0.06, 1.6, 0.9, 0.9, -0.9, K.black, [-50, 0, 0]), sph(0.1, 1.2, 1.3, 0.2, K.red), sph(0.1, 1.2, 1.3, -0.2, K.red)]);
  add('Hewan', 'gajah', 'Gajah', [ell(1.8, 1.5, 1.2, 0, 2.2, 0, K.grey), sph(1, 1.9, 2.8, 0, K.grey), cyl(0.3, 2, 2.9, 1.8, 0, K.grey, [0, 0, -10]), ell(0.1, 0.8, 0.7, 1.7, 2.9, 1.0, K.dmetal), ell(0.1, 0.8, 0.7, 1.7, 2.9, -1.0, K.dmetal), cone(0.1, 0.7, 2.7, 2.3, 0.5, K.white, [0, 0, -80]), cone(0.1, 0.7, 2.7, 2.3, -0.5, K.white, [0, 0, -80]), cyl(0.4, 1.6, 1, 0.8, 0.7, K.grey), cyl(0.4, 1.6, 1, 0.8, -0.7, K.grey), cyl(0.4, 1.6, -1, 0.8, 0.7, K.grey), cyl(0.4, 1.6, -1, 0.8, -0.7, K.grey)]);
  add('Hewan', 'lebah', 'Lebah', [ell(0.9, 0.6, 0.6, 0, 1.4, 0, K.yellow), box(0.2, 0.9, 1.2, -0.1, 1.4, 0, K.black), box(0.2, 0.9, 1.2, 0.4, 1.4, 0, K.black), ell(0.5, 0.05, 0.3, 0, 2.1, 0.5, K.glass, [30, 0, 0]), ell(0.5, 0.05, 0.3, 0, 2.1, -0.5, K.glass, [-30, 0, 0]), cone(0.12, 0.35, -1, 1.4, 0, K.black, [0, 0, 90])]);

  /* ---- Karakter ---- */
  add('Karakter', 'snowman', 'Manusia salju', [sph(1.2, 0, 1.2, 0, K.white), sph(0.9, 0, 3, 0, K.white), sph(0.65, 0, 4.4, 0, K.white), cone(0.1, 0.7, 0, 4.4, 0.8, K.orange, [90, 0, 0]), sph(0.08, -0.22, 4.6, 0.55, K.black), sph(0.08, 0.22, 4.6, 0.55, K.black), cyl(0.5, 0.5, 0, 5.2, 0, K.black), cyl(0.7, 0.07, 0, 4.95, 0, K.black)]);
  add('Karakter', 'alien', 'Alien', [sph(1, 0, 3, 0, K.green, [1, 1.1, 1]), ell(0.3, 0.5, 0.15, -0.45, 3.2, 0.85, K.black, [0, 0, 20]), ell(0.3, 0.5, 0.15, 0.45, 3.2, 0.85, K.black, [0, 0, -20]), ell(0.5, 0.8, 0.4, 0, 1.4, 0, K.green), cyl(0.1, 1, -0.7, 1.4, 0, K.green, [0, 0, 15]), cyl(0.1, 1, 0.7, 1.4, 0, K.green, [0, 0, -15])]);
  add('Karakter', 'hantu', 'Hantu', [hem(1.1, 0, 1.4, 0, K.white), cyl(1.1, 1.4, 0, 0.7, 0, K.white, null, 20), sph(0.15, -0.35, 1.5, 0.95, K.black), sph(0.15, 0.35, 1.5, 0.95, K.black), ell(0.2, 0.28, 0.1, 0, 1, 1.0, K.black)]);
  add('Karakter', 'bajak', 'Bajak laut', [box(1.3, 1.6, 0.8, 0, 2.5, 0, K.red), sph(0.6, 0, 3.8, 0, K.skin), box(1.6, 0.25, 1.2, 0, 4.2, 0, K.black), cone(0.7, 0.5, 0, 4.5, 0, K.black), sph(0.12, 0.25, 3.9, 0.55, K.black), box(0.4, 1.3, 0.4, -0.9, 2.6, 0, K.red), box(0.4, 1.3, 0.4, 0.9, 2.6, 0, K.red), box(0.45, 1.5, 0.45, -0.35, 0.75, 0, K.black), cyl(0.12, 1.3, 0.35, 0.65, 0, K.dwood)]);
  add('Karakter', 'astronot', 'Astronot', [box(1.5, 1.8, 1, 0, 2.5, 0, K.white), sph(0.8, 0, 4, 0, K.white), sph(0.6, 0, 4, 0.35, K.dmetal, [1, 0.9, 0.6]), box(0.9, 1.4, 0.5, 0, 2.6, -0.7, K.metal), box(0.45, 1.4, 0.45, -1, 2.5, 0, K.white), box(0.45, 1.4, 0.45, 1, 2.5, 0, K.white), box(0.55, 1.5, 0.55, -0.4, 0.75, 0, K.white), box(0.55, 1.5, 0.55, 0.4, 0.75, 0, K.white)]);

  /* ---- Makanan ---- */
  add('Makanan', 'kue', 'Kue tart', [cyl(1.6, 0.8, 0, 0.4, 0, K.cream, null, 28), cyl(1.2, 0.7, 0, 1.15, 0, K.pink, null, 28), cyl(0.8, 0.6, 0, 1.8, 0, K.white, null, 28), cyl(0.05, 0.5, 0, 2.4, 0, K.red), cone(0.1, 0.25, 0, 2.8, 0, K.yellow)]);
  add('Makanan', 'roti', 'Roti', [ell(1.6, 0.8, 0.8, 0, 0.8, 0, K.gold), box(0.12, 0.05, 0.9, 0.5, 1.55, 0, K.cream, [0, 0, 0]), box(0.12, 0.05, 0.9, -0.2, 1.55, 0, K.cream), box(0.12, 0.05, 0.9, -0.9, 1.5, 0, K.cream)]);
  add('Makanan', 'semangka', 'Semangka', [hem(1.4, 0, 0.7, 0, K.green, [180, 0, 0]), cyl(1.3, 0.12, 0, 0.8, 0, K.red, null, 24), sph(0.08, 0.4, 0.9, 0.2, K.black), sph(0.08, -0.5, 0.9, 0.1, K.black), sph(0.08, 0.1, 0.9, -0.6, K.black)]);
  add('Makanan', 'pisang', 'Pisang', [ell(0.9, 0.28, 0.28, 0, 0.35, 0, K.yellow), ell(0.7, 0.26, 0.26, -1.0, 0.75, 0, K.yellow, [0, 0, 40]), ell(0.7, 0.26, 0.26, 1.0, 0.75, 0, K.yellow, [0, 0, -40]), cyl(0.08, 0.3, 1.6, 1.2, 0, K.dwood, [0, 0, -40]), cyl(0.08, 0.3, -1.6, 1.2, 0, K.dwood, [0, 0, 40])]);
  add('Makanan', 'wortel', 'Wortel', [cone(0.5, 2.4, 0, 1.2, 0, K.orange, [180, 0, 0]), cone(0.1, 0.8, 0, 2.7, 0, K.green), cone(0.1, 0.7, 0.2, 2.65, 0, K.leaf, [0, 0, -25]), cone(0.1, 0.7, -0.2, 2.65, 0, K.leaf, [0, 0, 25])]);
  add('Makanan', 'kopi', 'Cangkir kopi', [fru(0.6, 0.85, 1.1, 0, 0.55, 0, K.white), cyl(0.75, 0.05, 0, 1.08, 0, K.brown), tor(0.35, 0.07, 1, 0.6, 0, K.white, [0, 0, 0]), cyl(1.1, 0.08, 0, 0.04, 0, K.white)]);
  add('Makanan', 'boba', 'Minuman boba', [fru(0.7, 0.95, 2.4, 0, 1.2, 0, K.glass), cyl(0.92, 1, 0, 0.9, 0, K.cream), sph(0.1, 0.3, 0.2, 0.2, K.black), sph(0.1, -0.3, 0.2, -0.2, K.black), sph(0.1, 0.1, 0.2, -0.4, K.black), cyl(0.08, 1.6, 0.3, 3, 0, K.red, [0, 0, -12]), cyl(0.98, 0.15, 0, 2.45, 0, K.white)]);
  add('Makanan', 'telur', 'Telur goreng', [cyl(1.3, 0.1, 0, 0.05, 0, K.white, null, 24), sph(0.5, 0.2, 0.3, 0, K.yellow, [1, 0.7, 1])]);
  add('Makanan', 'sate', 'Sate', [cyl(0.05, 3, 0, 0.1, 0, K.dwood, [0, 0, 90]), cyl(0.3, 0.4, -0.9, 0.1, 0, K.brown, [0, 0, 90]), cyl(0.3, 0.4, -0.3, 0.1, 0, K.dwood, [0, 0, 90]), cyl(0.3, 0.4, 0.3, 0.1, 0, K.brown, [0, 0, 90]), cyl(0.3, 0.4, 0.9, 0.1, 0, K.dwood, [0, 0, 90])]);
  add('Makanan', 'kelapa', 'Kelapa muda', [sph(1.1, 0, 1.1, 0, K.green), cone(0.5, 0.5, 0, 2.2, 0, K.cream), cyl(0.07, 0.8, 0.2, 2.7, 0, K.red, [0, 0, -12])]);

  /* ---- Teknologi ---- */
  add('Teknologi', 'speaker', 'Speaker', [box(1.6, 2.6, 1.2, 0, 1.3, 0, K.black), cyl(0.5, 0.1, 0, 0.8, 0.62, K.dmetal, [90, 0, 0]), cyl(0.3, 0.1, 0, 1.9, 0.62, K.dmetal, [90, 0, 0]), cyl(0.15, 0.1, 0, 0.8, 0.68, K.black, [90, 0, 0])]);
  add('Teknologi', 'drone', 'Drone', [box(1.2, 0.4, 1.2, 0, 1, 0, K.black), box(3.6, 0.1, 0.15, 0, 1.1, 0, K.dmetal, [0, 45, 0]), box(3.6, 0.1, 0.15, 0, 1.1, 0, K.dmetal, [0, -45, 0]), cyl(0.5, 0.05, 1.28, 1.25, 1.28, K.glass), cyl(0.5, 0.05, -1.28, 1.25, 1.28, K.glass), cyl(0.5, 0.05, 1.28, 1.25, -1.28, K.glass), cyl(0.5, 0.05, -1.28, 1.25, -1.28, K.glass), sph(0.25, 0, 0.7, 0.5, K.sky)]);
  add('Teknologi', 'satelit', 'Satelit', [box(1.2, 1.2, 1.2, 0, 1.6, 0, K.gold), box(3, 0.08, 1, -2.4, 1.6, 0, K.blue), box(3, 0.08, 1, 2.4, 1.6, 0, K.blue), cyl(0.04, 0.9, 0, 2.5, 0, K.metal), hem(0.5, 0, 2.7, 0, K.metal)]);
  add('Teknologi', 'router', 'Router wifi', [box(2.2, 0.4, 1.4, 0, 0.3, 0, K.white), cyl(0.06, 1.6, -0.8, 1.2, -0.4, K.black, [0, 0, 8]), cyl(0.06, 1.6, 0.8, 1.2, -0.4, K.black, [0, 0, -8]), sph(0.07, -0.6, 0.52, 0.5, K.green), sph(0.07, -0.3, 0.52, 0.5, K.green)]);
  add('Teknologi', 'keyboard', 'Papan ketik', [box(4, 0.3, 1.4, 0, 0.15, 0, K.dmetal), box(3.6, 0.15, 0.3, 0, 0.38, 0.4, K.white), box(3.6, 0.15, 0.3, 0, 0.38, 0, K.white), box(3.6, 0.15, 0.3, 0, 0.38, -0.4, K.white), box(1.6, 0.15, 0.25, 0, 0.38, 0.55, K.sky)]);
  add('Teknologi', 'mouse', 'Mouse', [ell(0.6, 0.35, 0.9, 0, 0.35, 0, K.dmetal), box(0.04, 0.05, 0.5, 0, 0.7, 0.35, K.black), cyl(0.1, 0.12, 0, 0.7, 0.15, K.sky, [0, 0, 90])]);
  add('Teknologi', 'mikrofon', 'Mikrofon', [cyl(0.08, 2, 0, 1, 0, K.dmetal), sph(0.4, 0, 2.3, 0, K.metal), cyl(0.42, 0.12, 0, 2.3, 0, K.black), cyl(0.5, 0.1, 0, 0.05, 0, K.black)]);
  add('Teknologi', 'baterai', 'Baterai', [cyl(0.7, 2.4, 0, 1.2, 0, K.green), cyl(0.3, 0.3, 0, 2.55, 0, K.metal), cyl(0.72, 0.5, 0, 0.5, 0, K.black), box(0.3, 0.8, 0.05, 0, 1.4, 0.7, K.yellow)]);
  add('Teknologi', 'lampujalan', 'Lampu jalan', [cyl(0.15, 5, 0, 2.5, 0, K.dmetal), box(1.6, 0.12, 0.12, 0.7, 5, 0, K.dmetal), fru(0.5, 0.3, 0.4, 1.4, 4.8, 0, K.black), sph(0.2, 1.4, 4.65, 0, K.yellow), cyl(0.35, 0.3, 0, 0.15, 0, K.dmetal)]);
  add('Teknologi', 'antena', 'Menara antena', [P('pyramid', { n: 4, r: 1.2, h: 6 }, 0, 3, 0, K.metal, [0, 45, 0]), cyl(0.05, 1.5, 0, 6.7, 0, K.red), box(1.4, 0.06, 0.06, 0, 5, 0, K.metal), box(1, 0.06, 0.06, 0, 4.2, 0, K.metal), sph(0.12, 0, 7.5, 0, K.red)]);

  /* ---- Fantasi ---- */
  add('Fantasi', 'busur', 'Busur dan panah', [tor(1.6, 0.07, 0, 1.6, 0, K.dwood, [0, 0, 0]), box(0.04, 3.2, 0.04, 0, 1.6, 0, K.cream), cyl(0.04, 2.8, 0.2, 1.6, 0, K.dwood, [0, 0, 90]), cone(0.1, 0.3, 1.7, 1.6, 0, K.metal, [0, 0, -90])]);
  add('Fantasi', 'kapak', 'Kapak', [cyl(0.1, 3.4, 0, 1.7, 0, K.dwood), wed(1.6, 1.2, 0.2, 0.7, 3, 0, K.metal, [0, 0, 0]), box(0.5, 0.5, 0.35, 0, 3, 0, K.dmetal)]);
  add('Fantasi', 'mahkota', 'Mahkota', [cyl(1.3, 0.8, 0, 0.4, 0, K.gold, null, 12), cone(0.25, 0.8, 0.95, 1.2, 0, K.gold), cone(0.25, 0.8, -0.95, 1.2, 0, K.gold), cone(0.25, 0.8, 0, 1.2, 0.95, K.gold), cone(0.25, 0.8, 0, 1.2, -0.95, K.gold), sph(0.2, 0, 0.5, 1.3, K.red), sph(0.2, 0, 0.5, -1.3, K.blue)]);
  add('Fantasi', 'kunci', 'Kunci emas', [tor(0.6, 0.15, 0, 2.6, 0, K.gold, [90, 0, 0]), cyl(0.12, 2.4, 0, 1.2, 0, K.gold), box(0.7, 0.25, 0.15, 0.4, 0.3, 0, K.gold), box(0.5, 0.25, 0.15, 0.3, 0.8, 0, K.gold)]);
  add('Fantasi', 'topipenyihir', 'Topi penyihir', [cone(1.1, 3, 0, 2.2, 0, K.violet), cyl(1.9, 0.15, 0, 0.7, 0, K.violet, null, 24), cyl(1.1, 0.3, 0, 1.0, 0, K.gold, null, 24), sph(0.18, 0.6, 2, 0.8, K.yellow)]);
  add('Fantasi', 'ramuan', 'Botol ramuan', [sph(1, 0, 1, 0, K.glass), cyl(0.3, 0.9, 0, 2.1, 0, K.glass), cyl(0.36, 0.3, 0, 2.7, 0, K.dwood), sph(0.85, 0, 0.9, 0, K.pink, [1, 0.7, 1]), sph(0.12, 0.3, 1.3, 0.3, K.white)]);
  add('Fantasi', 'telurnaga', 'Telur naga', [ell(1, 1.4, 1, 0, 1.4, 0, K.violet), cone(0.2, 0.35, 0.4, 1.9, 0.75, K.gold, [30, 0, 0]), cone(0.2, 0.35, -0.5, 1.4, 0.8, K.gold, [30, 0, 0]), cone(0.2, 0.35, 0.1, 0.8, 0.9, K.gold, [30, 0, 0]), cone(0.2, 0.35, 0, 2.5, 0.4, K.gold)]);
  add('Fantasi', 'portal', 'Portal', [tor(2, 0.3, 0, 2.3, 0, K.violet, [90, 0, 0]), cyl(1.8, 0.1, 0, 2.3, 0, K.sky, [90, 0, 0], 32), sph(0.25, 0, 4.5, 0, K.yellow), box(3, 0.4, 1.2, 0, 0.2, 0, K.dstone)]);
  add('Fantasi', 'nisan', 'Batu nisan', [box(1.6, 2, 0.4, 0, 1, 0, K.stone), cyl(0.8, 0.4, 0, 2, 0, K.stone, [90, 0, 0]), box(0.15, 0.9, 0.05, 0, 1.5, 0.22, K.dstone), box(0.6, 0.15, 0.05, 0, 1.6, 0.22, K.dstone), box(2.2, 0.3, 1, 0, 0.15, 0.1, K.dstone)]);
  add('Fantasi', 'lentera', 'Lentera', [cyl(0.5, 0.12, 0, 0.06, 0, K.dmetal), cyl(0.4, 1.4, 0, 0.8, 0, K.yellow), cone(0.6, 0.6, 0, 1.8, 0, K.dmetal), tor(0.25, 0.05, 0, 2.3, 0, K.dmetal, [0, 0, 0]), box(0.05, 1.5, 0.05, 0.42, 0.8, 0, K.dmetal)]);
  add('Fantasi', 'pedangcahaya', 'Pedang cahaya', [cyl(0.12, 3.6, 0, 2.6, 0, K.sky), sph(0.12, 0, 4.4, 0, K.sky), cyl(0.18, 1, 0, 0.5, 0, K.dmetal), cyl(0.2, 0.1, 0, 1.05, 0, K.red)]);
  add('Fantasi', 'naga', 'Naga kecil', [ell(1.4, 0.9, 0.8, 0, 1.4, 0, K.green), sph(0.6, 1.5, 2.2, 0, K.green), cone(0.15, 0.5, 1.7, 2.8, 0.25, K.gold), cone(0.15, 0.5, 1.7, 2.8, -0.25, K.gold), cyl(0.2, 2, -1.8, 1.0, 0, K.green, [0, 0, 75]), wed(1.6, 0.1, 1.2, 0, 2.3, 1.1, K.dleaf), wed(1.6, 0.1, 1.2, 0, 2.3, -1.1, K.dleaf), cyl(0.2, 0.9, 0.6, 0.45, 0.4, K.green), cyl(0.2, 0.9, 0.6, 0.45, -0.4, K.green), cyl(0.2, 0.9, -0.6, 0.45, 0.4, K.green), cyl(0.2, 0.9, -0.6, 0.45, -0.4, K.green)]);

  /* ---- Taman & Dekorasi (baru) ---- */
  add('Taman', 'airmancur', 'Air mancur', [cyl(2, 0.5, 0, 0.25, 0, K.stone, null, 28), cyl(1.8, 0.2, 0, 0.55, 0, K.sky, null, 28), cyl(0.3, 1.8, 0, 1.4, 0, K.stone), cyl(1, 0.2, 0, 2.2, 0, K.stone, null, 24), cone(0.2, 0.9, 0, 2.9, 0, K.sky)]);
  add('Taman', 'bangkutaman', 'Bangku taman', [box(3, 0.2, 1, 0, 1, 0, K.wood), box(3, 0.9, 0.15, 0, 1.6, -0.45, K.wood, [-8, 0, 0]), box(0.15, 1, 0.9, 1.4, 0.5, 0, K.dmetal), box(0.15, 1, 0.9, -1.4, 0.5, 0, K.dmetal)]);
  add('Taman', 'ayunan', 'Ayunan', [cyl(0.1, 3.6, -2, 1.8, 0, K.dmetal, [0, 0, 8]), cyl(0.1, 3.6, 2, 1.8, 0, K.dmetal, [0, 0, -8]), cyl(0.1, 4.4, 0, 3.6, 0, K.dmetal, [0, 0, 90]), box(0.04, 2.2, 0.04, -0.5, 2.5, 0, K.black), box(0.04, 2.2, 0.04, 0.5, 2.5, 0, K.black), box(1.3, 0.12, 0.5, 0, 1.4, 0, K.red)]);
  add('Taman', 'perosotan', 'Perosotan', [box(1.4, 0.15, 3.4, 0, 1.8, 0.3, K.blue, [-35, 0, 0]), box(1.4, 0.15, 1.2, 0, 3.4, -1.6, K.yellow), cyl(0.07, 3.4, 0.65, 1.7, -2.1, K.red), cyl(0.07, 3.4, -0.65, 1.7, -2.1, K.red), box(1.4, 0.15, 0.2, 0, 1.3, -2.1, K.red)]);
  add('Taman', 'jungkat', 'Jungkat-jungkit', [box(5, 0.2, 0.7, 0, 1.3, 0, K.orange, [0, 0, 12]), P('prism', { n: 3, r: 0.8, h: 0.8 }, 0, 0.5, 0, K.dmetal, [90, 0, 0]), box(0.5, 0.1, 0.5, -2.3, 1.7, 0, K.red), box(0.5, 0.1, 0.5, 2.3, 0.9, 0, K.red)]);
  add('Taman', 'papan', 'Papan petunjuk', [cyl(0.12, 3, 0, 1.5, 0, K.dwood), box(2.4, 1, 0.12, 0.5, 2.8, 0, K.wood), wed(0.5, 0.7, 0.12, 1.9, 2.8, 0, K.wood, [0, 0, -90]), box(1.8, 0.1, 0.14, 0.4, 2.8, 0.01, K.cream)]);
  add('Taman', 'bendera', 'Tiang bendera', [cyl(0.08, 6, 0, 3, 0, K.metal), sph(0.15, 0, 6.1, 0, K.gold), box(2, 1.2, 0.05, 1.05, 5.2, 0, K.red), box(2, 0.6, 0.06, 1.05, 4.9, 0, K.white), cyl(0.35, 0.3, 0, 0.15, 0, K.dmetal)]);
  add('Taman', 'patung', 'Patung', [box(2, 0.8, 2, 0, 0.4, 0, K.dstone), box(1.4, 0.4, 1.4, 0, 1, 0, K.stone), cyl(0.55, 2.2, 0, 2.3, 0, K.white), sph(0.55, 0, 3.7, 0, K.white), cone(0.3, 0.6, 0, 4.4, 0, K.gold)]);
  add('Taman', 'tendapesta', 'Tenda pesta', [cyl(0.1, 3, 1.8, 1.5, 1.8, K.white), cyl(0.1, 3, -1.8, 1.5, 1.8, K.white), cyl(0.1, 3, 1.8, 1.5, -1.8, K.white), cyl(0.1, 3, -1.8, 1.5, -1.8, K.white), pyr(4, 3.2, 1.6, 0, 3.8, 0, K.pink, [0, 45, 0]), box(3.6, 0.12, 3.6, 0, 3.05, 0, K.white)]);
  add('Taman', 'balon', 'Balon udara', [sph(2, 0, 4.5, 0, K.red, [1, 1.1, 1]), box(0.15, 1.8, 2.2, 0, 4.5, 0, K.yellow), box(1.2, 0.8, 1.2, 0, 1.2, 0, K.wood), cyl(0.03, 1.6, 0.5, 2.1, 0.5, K.dmetal), cyl(0.03, 1.6, -0.5, 2.1, -0.5, K.dmetal), cyl(0.03, 1.6, 0.5, 2.1, -0.5, K.dmetal), cyl(0.03, 1.6, -0.5, 2.1, 0.5, K.dmetal)]);
  add('Taman', 'tong', 'Tong sampah', [fru(0.7, 0.85, 1.6, 0, 0.8, 0, K.green), cyl(0.9, 0.15, 0, 1.7, 0, K.dmetal), box(0.3, 0.12, 0.12, 0, 1.85, 0, K.dmetal)]);
  add('Taman', 'kotakpos', 'Kotak pos', [cyl(0.1, 2, 0, 1, 0, K.dwood), box(1.2, 0.8, 0.7, 0, 2.3, 0, K.blue), hem(0.35, 0, 2.7, 0, K.blue, [0, 0, 0]), box(0.5, 0.06, 0.05, 0, 2.4, 0.37, K.black)]);
  add('Taman', 'payung', 'Payung pantai', [cyl(0.06, 3.2, 0, 1.6, 0, K.cream), P('cone', { r: 2.2, h: 0.9, seg: 16 }, 0, 3.6, 0, K.red), P('cone', { r: 2.2, h: 0.9, seg: 16 }, 0, 3.58, 0, K.white, [0, 22, 0]), sph(0.12, 0, 4.15, 0, K.gold)]);

  /* ---- Olahraga & Mainan (baru) ---- */
  add('Olahraga', 'bola', 'Bola sepak', [sph(1, 0, 1, 0, K.white), sph(0.36, 0, 1.95, 0, K.black, [1, 0.35, 1]), sph(0.36, 0.9, 1.4, 0.3, K.black, [1, 0.35, 1]), sph(0.36, -0.8, 1.4, 0.5, K.black, [1, 0.35, 1]), sph(0.36, 0.3, 1.4, -0.9, K.black, [1, 0.35, 1]), sph(0.36, -0.4, 0.4, -0.8, K.black, [1, 0.35, 1]), sph(0.36, 0.6, 0.35, 0.7, K.black, [1, 0.35, 1])]);
  add('Olahraga', 'basket', 'Ring basket', [box(0.12, 3, 0.12, 0, 1.5, -1.2, K.dmetal), box(2.6, 1.8, 0.1, 0, 3.4, -1.2, K.white), tor(0.55, 0.06, 0, 2.9, -0.5, K.orange, [90, 0, 0]), fru(0.5, 0.3, 0.8, 0, 2.45, -0.5, K.cream)]);
  add('Olahraga', 'gawang', 'Gawang', [cyl(0.08, 2.6, -2, 1.3, 0, K.white), cyl(0.08, 2.6, 2, 1.3, 0, K.white), cyl(0.08, 4, 0, 2.6, 0, K.white, [0, 0, 90]), box(4, 0.04, 1.2, 0, 2.6, -0.6, K.grey), box(0.04, 2.6, 1.2, -2, 1.3, -0.6, K.grey)]);
  add('Olahraga', 'raket', 'Raket', [tor(0.9, 0.08, 0, 2.7, 0, K.red, [90, 0, 0]), cyl(0.08, 1.8, 0, 0.9, 0, K.black), cyl(0.5, 0.04, 0, 2.7, 0, K.cream, [90, 0, 0])]);
  add('Olahraga', 'dadu', 'Dadu', [P('cube', { s: 2 }, 0, 1, 0, K.white), sph(0.18, 0, 1, 1.02, K.red), sph(0.18, 0.5, 1.5, 1.02, K.black), sph(0.18, -0.5, 0.5, 1.02, K.black), sph(0.18, 1.02, 1, 0, K.black), sph(0.18, 0, 2.02, 0, K.black)]);
  add('Olahraga', 'piala', 'Piala', [box(1.6, 0.4, 1.6, 0, 0.2, 0, K.dwood), cyl(0.25, 1.4, 0, 1.1, 0, K.gold), fru(0.4, 1.1, 1.4, 0, 2.5, 0, K.gold), tor(0.6, 0.08, 1.05, 2.5, 0, K.gold, [0, 0, 0]), tor(0.6, 0.08, -1.05, 2.5, 0, K.gold, [0, 0, 0])]);
  add('Olahraga', 'medali', 'Medali', [tor(0.9, 0.12, 0, 1.5, 0, K.gold, [90, 0, 0]), cyl(0.85, 0.12, 0, 1.5, 0, K.gold, [90, 0, 0], 28), box(0.9, 0.05, 0.05, 0, 2.8, 0, K.red, [0, 0, 55]), box(0.9, 0.05, 0.05, 0, 2.8, 0, K.blue, [0, 0, -55])]);
  add('Olahraga', 'baloktoy', 'Balok mainan', [box(1.2, 1.2, 1.2, -0.7, 0.6, 0, K.red), box(1.2, 1.2, 1.2, 0.7, 0.6, 0, K.blue), box(1.2, 1.2, 1.2, 0, 1.8, 0, K.yellow), cyl(0.5, 1.2, 0, 3, 0, K.green)]);
  add('Olahraga', 'teddy', 'Boneka beruang', [sph(1, 0, 1.2, 0, K.brown), sph(0.75, 0, 2.7, 0, K.brown), sph(0.3, -0.6, 3.3, 0, K.brown), sph(0.3, 0.6, 3.3, 0, K.brown), sph(0.3, 0, 2.6, 0.65, K.cream), sph(0.1, 0, 2.8, 0.9, K.black), sph(0.6, -1.1, 1.5, 0, K.brown, [0.6, 1, 0.6]), sph(0.6, 1.1, 1.5, 0, K.brown, [0.6, 1, 0.6])]);
  add('Olahraga', 'yoyo', 'Kincir mainan', [cyl(0.06, 3, 0, 1.5, 0, K.dwood), wed(1.2, 1.2, 0.05, 0.6, 3.2, 0.1, K.red, [0, 0, 0]), wed(1.2, 1.2, 0.05, -0.6, 3.2, 0.1, K.blue, [0, 0, 180]), wed(1.2, 1.2, 0.05, 0, 3.8, 0.1, K.yellow, [0, 0, 90]), wed(1.2, 1.2, 0.05, 0, 2.6, 0.1, K.green, [0, 0, -90]), sph(0.15, 0, 3.2, 0.15, K.gold)]);
  add('Olahraga', 'bowling', 'Pin bowling', [P('ellipsoid', { rx: 0.5, ry: 0.9, rz: 0.5, seg: 18 }, 0, 0.9, 0, K.white), cyl(0.2, 0.9, 0, 1.9, 0, K.white), sph(0.3, 0, 2.5, 0, K.white), cyl(0.31, 0.1, 0, 1.5, 0, K.red)]);

  /* ---- Luar Angkasa (baru) ---- */
  add('Angkasa', 'planet', 'Planet bercincin', [sph(1.6, 0, 1.8, 0, K.orange), tor(2.5, 0.12, 0, 1.8, 0, K.cream, [20, 0, 0]), tor(2.9, 0.08, 0, 1.8, 0, K.gold, [20, 0, 0])]);
  add('Angkasa', 'bulan', 'Bulan', [sph(1.6, 0, 1.6, 0, K.grey), hem(0.4, 0.6, 2.3, 0.9, K.dstone, [60, 0, 0]), hem(0.3, -0.7, 2.0, 1.2, K.dstone, [70, 0, 0]), hem(0.25, 0.9, 1.0, 1.3, K.dstone, [70, 0, 0])]);
  add('Angkasa', 'bintang', 'Bintang', [P('bipyramid', { n: 5, r: 1.4, h: 0.8 }, 0, 1.4, 0, K.yellow, [90, 0, 0]), sph(0.6, 0, 1.4, 0, K.gold)]);
  add('Angkasa', 'roketmini', 'Roket mini', [cyl(0.7, 3, 0, 1.5, 0, K.white), cone(0.7, 1.4, 0, 3.7, 0, K.red), wed(0.8, 1.2, 0.1, 0.9, 0.8, 0, K.red), wed(0.8, 1.2, 0.1, -0.9, 0.8, 0, K.red, [0, 180, 0]), cone(0.45, 1, 0, -0.3, 0, K.orange, [180, 0, 0]), sph(0.28, 0, 2.2, 0.62, K.sky)]);
  add('Angkasa', 'stasiun', 'Stasiun luar angkasa', [cyl(0.7, 3, 0, 1.5, 0, K.metal, [0, 0, 90]), sph(0.9, 0, 1.5, 0, K.white), box(0.05, 1.8, 3.2, 1.8, 1.5, 0, K.blue), box(0.05, 1.8, 3.2, -1.8, 1.5, 0, K.blue), cyl(0.3, 1.6, 0, 2.5, 0, K.dmetal)]);
  add('Angkasa', 'komet', 'Komet', [sph(0.9, 0, 1, 0, K.sky), cone(0.8, 3.6, -2, 1.5, 0, K.glass, [0, 0, 70]), cone(0.5, 2.6, -1.6, 0.8, 0.4, K.sky, [0, 0, 80])]);
  add('Angkasa', 'meteor', 'Meteor', [P('dodeca', { e: 1.2 }, 0, 1.2, 0, K.dstone), hem(0.4, 0.7, 1.9, 0.5, K.black, [60, 0, 0]), cone(0.7, 2.2, -1.6, 1.8, 0, K.orange, [0, 0, 55])]);
  add('Angkasa', 'teleskop', 'Teleskop', [cyl(0.4, 2.8, 0.4, 2.7, 0, K.white, [0, 0, 40]), cyl(0.5, 0.5, 1.3, 3.7, 0, K.dmetal, [0, 0, 40]), cyl(0.06, 2.4, 0, 1.2, 0, K.dmetal, [0, 0, 20]), cyl(0.06, 2.4, 0.6, 1.2, 0.6, K.dmetal, [20, 0, -12]), cyl(0.06, 2.4, 0.6, 1.2, -0.6, K.dmetal, [-20, 0, -12])]);

  /* ---- Laut (baru) ---- */
  add('Laut', 'jangkar', 'Jangkar', [cyl(0.1, 3, 0, 1.8, 0, K.dmetal), tor(0.3, 0.07, 0, 3.5, 0, K.dmetal, [90, 0, 0]), cyl(0.08, 1.6, 0, 2.9, 0, K.dmetal, [0, 0, 90]), tor(0.9, 0.1, 0, 0.9, 0, K.dmetal, [90, 0, 0]), cone(0.15, 0.5, 0.9, 0.5, 0, K.dmetal, [0, 0, -30]), cone(0.15, 0.5, -0.9, 0.5, 0, K.dmetal, [0, 0, 30])]);
  add('Laut', 'kerang', 'Kerang', [hem(1.3, 0, 0.1, 0, K.pink, [90, 0, 0]), box(0.1, 1.2, 0.05, 0, 0.9, 1.0, K.white), box(0.1, 1.2, 0.05, 0.5, 0.8, 0.95, K.white, [0, 20, 0]), box(0.1, 1.2, 0.05, -0.5, 0.8, 0.95, K.white, [0, -20, 0]), sph(0.28, 0, 0.5, -0.2, K.white)]);
  add('Laut', 'karang', 'Terumbu karang', [cyl(0.2, 1.8, 0, 0.9, 0, K.pink), cyl(0.15, 1.2, 0.6, 1.0, 0, K.orange, [0, 0, -25]), cyl(0.15, 1.4, -0.6, 1.0, 0, K.red, [0, 0, 25]), sph(0.3, 0, 1.9, 0, K.pink), sph(0.25, 0.9, 1.7, 0, K.orange), sph(0.25, -0.9, 1.9, 0, K.red), hem(0.9, 0, 0, 0, K.violet)]);
  add('Laut', 'ubur', 'Ubur-ubur', [hem(1.2, 0, 2, 0, K.pink), cyl(0.04, 1.8, 0.5, 0.9, 0, K.pink), cyl(0.04, 2, 0, 0.9, 0.4, K.pink), cyl(0.04, 1.6, -0.5, 0.9, -0.3, K.pink), cyl(0.04, 1.9, 0, 0.9, -0.5, K.pink)]);
  add('Laut', 'paus', 'Paus', [ell(3, 1.4, 1.4, 0, 1.6, 0, K.blue), ell(1.8, 0.7, 1.3, 0.9, 1.0, 0, K.white), wed(1.8, 0.2, 1.8, -3.3, 2.4, 0, K.blue, [0, 0, 20]), sph(0.15, 2.2, 2, 1.1, K.black), cyl(0.05, 0.8, 1.2, 3.2, 0, K.sky)]);
  add('Laut', 'mercubuoy', 'Pelampung', [tor(1.2, 0.4, 0, 0.5, 0, K.red, [90, 0, 0]), box(0.8, 0.4, 0.45, 0, 0.5, 1.2, K.white), box(0.8, 0.4, 0.45, 0, 0.5, -1.2, K.white), box(0.45, 0.4, 0.8, 1.2, 0.5, 0, K.white), box(0.45, 0.4, 0.8, -1.2, 0.5, 0, K.white)]);
  add('Laut', 'bintanglaut', 'Bintang laut', [P('bipyramid', { n: 5, r: 1.6, h: 0.5 }, 0, 0.3, 0, K.orange, [0, 0, 0]), sph(0.4, 0, 0.5, 0, K.red, [1, 0.5, 1])]);

  /* ---- Obby & Game (baru) ---- */
  add('Obby', 'checkpoint', 'Checkpoint', [cyl(1.6, 0.3, 0, 0.15, 0, K.dmetal, null, 24), cyl(1.3, 0.1, 0, 0.35, 0, K.green, null, 24), cyl(0.1, 2.2, 0, 1.5, 0, K.metal), box(1.2, 0.7, 0.05, 0.65, 2.3, 0, K.green)]);
  add('Obby', 'platform', 'Platform melayang', [box(3, 0.5, 3, 0, 0.25, 0, K.stone), box(3.2, 0.12, 3.2, 0, 0.56, 0, K.green), cone(1.4, 1.2, 0, -0.6, 0, K.dstone, [180, 0, 0])]);
  add('Obby', 'spinner', 'Pemutar rintangan', [cyl(0.4, 1.4, 0, 0.7, 0, K.dmetal), box(6, 0.4, 0.5, 0, 1.4, 0, K.red), box(0.5, 0.4, 6, 0, 1.4, 0, K.red), sph(0.3, 0, 1.7, 0, K.yellow)]);
  add('Obby', 'lava', 'Kolam lava', [box(4, 0.4, 4, 0, 0.2, 0, K.dstone), box(3.4, 0.45, 3.4, 0, 0.23, 0, K.orange), sph(0.4, 0.6, 0.5, 0.3, K.yellow, [1, 0.6, 1]), sph(0.3, -0.8, 0.5, -0.6, K.yellow, [1, 0.6, 1])]);
  add('Obby', 'koin', 'Koin', [cyl(1, 0.25, 0, 1.2, 0, K.gold, [90, 0, 0], 28), tor(0.95, 0.1, 0, 1.2, 0, K.yellow, [90, 0, 0]), box(0.2, 0.8, 0.06, 0, 1.2, 0.14, K.yellow)]);
  add('Obby', 'trampolin', 'Trampolin', [cyl(1.8, 0.12, 0, 1.2, 0, K.black, null, 28), tor(1.8, 0.1, 0, 1.2, 0, K.red, [0, 0, 0]), cyl(0.08, 1.2, 1.4, 0.6, 0, K.dmetal), cyl(0.08, 1.2, -1.4, 0.6, 0, K.dmetal), cyl(0.08, 1.2, 0, 0.6, 1.4, K.dmetal), cyl(0.08, 1.2, 0, 0.6, -1.4, K.dmetal)]);
  add('Obby', 'pintu', 'Pintu', [box(2.2, 4.2, 0.3, 0, 2.1, 0, K.dwood), box(1.8, 3.8, 0.12, 0, 2.0, 0.14, K.wood), sph(0.12, 0.6, 2, 0.28, K.gold)]);
  add('Obby', 'tembok', 'Tembok bata', [box(6, 2.4, 0.6, 0, 1.2, 0, K.red), box(6, 0.06, 0.64, 0, 0.6, 0, K.cream), box(6, 0.06, 0.64, 0, 1.2, 0, K.cream), box(6, 0.06, 0.64, 0, 1.8, 0, K.cream), box(6.2, 0.2, 0.8, 0, 2.5, 0, K.dstone)]);
  add('Obby', 'jerat', 'Jebakan duri', [box(3, 0.3, 3, 0, 0.15, 0, K.dstone), cone(0.2, 0.9, 0.9, 0.75, 0.9, K.metal), cone(0.2, 0.9, -0.9, 0.75, 0.9, K.metal), cone(0.2, 0.9, 0.9, 0.75, -0.9, K.metal), cone(0.2, 0.9, -0.9, 0.75, -0.9, K.metal), cone(0.2, 0.9, 0, 0.75, 0, K.metal)]);
  add('Obby', 'kincirair', 'Roda air', [tor(1.8, 0.15, 0, 2, 0, K.dwood, [90, 0, 0]), box(3.6, 0.15, 0.3, 0, 2, 0, K.wood), box(0.15, 3.6, 0.3, 0, 2, 0, K.wood), box(2.5, 0.15, 0.3, 0, 2, 0, K.wood, [0, 0, 45]), box(2.5, 0.15, 0.3, 0, 2, 0, K.wood, [0, 0, -45]), cyl(0.3, 0.6, 0, 2, 0, K.dwood, [90, 0, 0])]);
  add('Obby', 'tangga2', 'Tangga spiral', [box(1.8, 0.3, 0.8, 1.2, 0.3, 0, K.wood), box(1.8, 0.3, 0.8, 0.85, 0.8, 0.85, K.wood, [0, 45, 0]), box(1.8, 0.3, 0.8, 0, 1.3, 1.2, K.wood, [0, 90, 0]), box(1.8, 0.3, 0.8, -0.85, 1.8, 0.85, K.wood, [0, 135, 0]), box(1.8, 0.3, 0.8, -1.2, 2.3, 0, K.wood, [0, 180, 0]), cyl(0.2, 2.6, 0, 1.3, 0, K.dmetal)]);
  add('Obby', 'laser', 'Gerbang laser', [box(0.4, 3, 0.4, -2, 1.5, 0, K.dmetal), box(0.4, 3, 0.4, 2, 1.5, 0, K.dmetal), cyl(0.05, 4, 0, 0.8, 0, K.red, [0, 0, 90]), cyl(0.05, 4, 0, 1.5, 0, K.red, [0, 0, 90]), cyl(0.05, 4, 0, 2.2, 0, K.red, [0, 0, 90])]);


  /* ================= Penyempurnaan: lebih halus dan realistis ================= */
  const redo = (id, parts) => { const it = L.find((x) => x.id === id); if (it) it.parts = parts; };
  const petals = (n, r, y, c, len, wid) => { const out = []; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; out.push(ell(len, 0.05, wid, Math.cos(a) * r, y, Math.sin(a) * r, c, [0, -(a * 180) / Math.PI, 12])); } return out; };

  redo('rumah', [
    box(4, 0.22, 3.6, 0, 0.11, 0, K.dstone), box(3.8, 2.5, 3.2, 0, 1.45, 0, K.cream),
    rpy(5, 4.3, 1.9, 0, 3.65, 0, K.red), box(0.7, 1.4, 0.7, 1.4, 4.0, -0.6, K.stone), box(0.9, 0.16, 0.9, 1.4, 4.75, -0.6, K.dstone),
    box(1.2, 1.8, 0.1, 0, 1.12, 1.62, K.white), box(0.95, 1.6, 0.12, 0, 1.02, 1.66, K.dwood), sph(0.06, 0.3, 1.0, 1.75, K.gold),
    box(1.5, 0.16, 0.7, 0, 0.3, 2.0, K.stone),
    box(1.1, 1.0, 0.1, -1.3, 1.65, 1.62, K.white), box(0.88, 0.78, 0.12, -1.3, 1.65, 1.66, K.glass), box(1.3, 0.1, 0.3, -1.3, 1.1, 1.72, K.stone),
    box(1.1, 1.0, 0.1, 1.3, 1.65, 1.62, K.white), box(0.88, 0.78, 0.12, 1.3, 1.65, 1.66, K.glass), box(1.3, 0.1, 0.3, 1.3, 1.1, 1.72, K.stone),
  ]);
  redo('pohon', [
    fru(0.75, 0.5, 0.6, 0, 0.3, 0, K.dwood), fru(0.5, 0.32, 2.6, 0, 1.6, 0, K.dwood),
    cyl(0.13, 1.3, 0.6, 3.1, 0, K.dwood, [0, 0, -35]), cyl(0.12, 1.1, -0.55, 3.0, 0.1, K.dwood, [0, 0, 38]),
    ell(1.55, 1.25, 1.55, 0, 3.9, 0, K.leaf), ell(1.15, 0.95, 1.15, 1.0, 3.4, 0.4, K.dleaf), ell(1.1, 0.9, 1.1, -1.0, 3.5, -0.3, K.leaf2),
    ell(1.0, 0.85, 1.0, 0.2, 4.8, 0.1, K.leaf2), ell(0.95, 0.8, 0.95, -0.3, 3.1, 1.0, K.dleaf), ell(0.9, 0.8, 0.9, 0.4, 3.2, -1.0, K.leaf),
  ]);
  redo('cemara', [
    fru(0.5, 0.3, 1.2, 0, 0.6, 0, K.dwood),
    cone(1.9, 1.7, 0, 1.9, 0, K.dleaf), cone(1.6, 1.6, 0, 2.9, 0, K.leaf), cone(1.3, 1.5, 0, 3.9, 0, K.dleaf), cone(1.0, 1.4, 0, 4.8, 0, K.leaf), cone(0.6, 1.2, 0, 5.6, 0, K.leaf2),
  ]);
  redo('semak', [ell(1.0, 0.8, 1.0, 0, 0.7, 0, K.leaf), ell(0.8, 0.65, 0.8, 0.9, 0.5, 0.2, K.dleaf), ell(0.8, 0.65, 0.8, -0.9, 0.5, -0.1, K.leaf2), ell(0.7, 0.6, 0.7, 0.1, 0.55, 0.8, K.dleaf), ell(0.6, 0.55, 0.6, -0.2, 1.1, -0.2, K.leaf2), sph(0.1, 0.5, 1.25, 0.55, K.red), sph(0.1, -0.4, 1.2, 0.6, K.red), sph(0.1, 0.1, 1.5, 0.3, K.red)]);
  redo('batu', [ell(1.7, 1.15, 1.35, 0, 0.9, 0, K.stone), ell(0.9, 0.65, 0.8, 1.5, 0.5, 0.4, K.dstone), ell(0.45, 0.32, 0.4, -1.6, 0.3, 0.9, K.stone), ell(0.3, 0.22, 0.28, 0.6, 0.2, 1.6, K.dstone), ell(1.0, 0.18, 0.8, -0.1, 1.9, 0.0, '#5f8f4a')]);
  redo('gunung', [P('frustum', { rb: 4.8, rt: 0.5, h: 5.2, seg: 14 }, 0, 2.6, 0, K.dstone), P('frustum', { rb: 3.2, rt: 0.35, h: 3.4, seg: 12 }, 1.9, 1.7, 0.8, K.stone), P('frustum', { rb: 2.5, rt: 0.3, h: 2.6, seg: 12 }, -2.0, 1.3, -0.7, K.dstone), P('frustum', { rb: 1.75, rt: 0.45, h: 1.9, seg: 14 }, 0, 4.3, 0, K.white), P('frustum', { rb: 3.6, rt: 3.0, h: 0.5, seg: 20 }, 0, 0.25, 0, '#5f8f4a')]);
  redo('bunga', [cyl(0.06, 1.7, 0, 0.85, 0, K.green), ell(0.4, 0.05, 0.16, 0.35, 0.7, 0, K.leaf, [0, 0, 25]), ell(0.4, 0.05, 0.16, -0.35, 1.0, 0, K.leaf, [0, 0, -25]), ...petals(8, 0.34, 1.75, K.pink, 0.26, 0.12), sph(0.2, 0, 1.78, 0, K.yellow, [1, 0.7, 1])]);
  redo('jamur', [fru(0.35, 0.5, 1.1, 0, 0.55, 0, K.cream), cyl(1.1, 0.08, 0, 1.1, 0, K.cream, null, 32), hem(1.25, 0, 1.725, 0, K.red, null), ell(0.22, 0.05, 0.2, 0.55, 2.14, 0.35, K.white, [0, 0, 8]), ell(0.18, 0.05, 0.16, -0.5, 2.2, 0.2, K.white, [0, 0, -8]), ell(0.16, 0.05, 0.16, 0.1, 2.27, -0.4, K.white), ell(0.15, 0.05, 0.14, -0.2, 2.29, 0.3, K.white), ell(0.17, 0.05, 0.15, -0.85, 1.95, -0.3, K.white, [0, 0, -30]), ell(0.17, 0.05, 0.15, 0.85, 1.95, -0.2, K.white, [0, 0, 30])]);
  redo('awan', [ell(1.1, 0.8, 0.9, 0, 0.9, 0, K.white), ell(0.9, 0.7, 0.8, 1.2, 0.75, 0.1, K.white), ell(0.85, 0.65, 0.75, -1.2, 0.72, -0.05, K.white), ell(0.75, 0.7, 0.7, 0.4, 1.5, 0.1, K.white), ell(0.6, 0.5, 0.6, -0.5, 1.4, 0.3, K.white), ell(0.55, 0.45, 0.55, 1.9, 0.5, 0, K.white)]);
  redo('kursi', [box(1.3, 0.2, 1.3, 0, 1.05, 0, K.wood), box(1.3, 0.12, 0.16, 0, 2.55, -0.58, K.wood), box(1.2, 0.12, 0.14, 0, 2.0, -0.58, K.wood), box(0.14, 1.5, 0.14, 0.58, 1.8, -0.58, K.dwood), box(0.14, 1.5, 0.14, -0.58, 1.8, -0.58, K.dwood), fru(0.09, 0.07, 1.0, 0.52, 0.5, 0.52, K.dwood), fru(0.09, 0.07, 1.0, -0.52, 0.5, 0.52, K.dwood), fru(0.09, 0.07, 1.0, 0.52, 0.5, -0.52, K.dwood), fru(0.09, 0.07, 1.0, -0.52, 0.5, -0.52, K.dwood)]);
  redo('meja', [box(3.2, 0.24, 1.9, 0, 1.5, 0, K.wood), box(2.7, 0.2, 1.4, 0, 1.28, 0, K.dwood), fru(0.14, 0.1, 1.4, 1.35, 0.7, 0.75, K.dwood), fru(0.14, 0.1, 1.4, -1.35, 0.7, 0.75, K.dwood), fru(0.14, 0.1, 1.4, 1.35, 0.7, -0.75, K.dwood), fru(0.14, 0.1, 1.4, -1.35, 0.7, -0.75, K.dwood)]);
  redo('sofa', [box(3.8, 0.7, 1.7, 0, 0.7, 0, K.blue), box(1.7, 0.45, 1.3, -0.9, 1.25, 0.15, K.sky), box(1.7, 0.45, 1.3, 0.9, 1.25, 0.15, K.sky), box(1.8, 1.0, 0.5, -0.95, 1.85, -0.6, K.sky), box(1.8, 1.0, 0.5, 0.95, 1.85, -0.6, K.sky), box(0.5, 1.2, 1.7, -2.0, 1.1, 0, K.blue), box(0.5, 1.2, 1.7, 2.0, 1.1, 0, K.blue), cyl(0.12, 0.3, 1.7, 0.15, 0.7, K.dwood), cyl(0.12, 0.3, -1.7, 0.15, 0.7, K.dwood), cyl(0.12, 0.3, 1.7, 0.15, -0.7, K.dwood), cyl(0.12, 0.3, -1.7, 0.15, -0.7, K.dwood)]);
  redo('mobil', [
    box(4.2, 0.8, 2, 0, 0.95, 0, K.red), box(2.3, 0.75, 1.8, -0.25, 1.75, 0, K.glass), box(2.0, 0.14, 1.7, -0.25, 2.18, 0, K.red),
    box(0.16, 0.5, 2.0, 2.15, 0.7, 0, K.dmetal), box(0.16, 0.5, 2.0, -2.15, 0.7, 0, K.dmetal),
    ell(0.08, 0.14, 0.26, 2.1, 1.1, 0.65, K.yellow), ell(0.08, 0.14, 0.26, 2.1, 1.1, -0.65, K.yellow), ell(0.06, 0.12, 0.24, -2.1, 1.1, 0.65, '#ff3030'), ell(0.06, 0.12, 0.24, -2.1, 1.1, -0.65, '#ff3030'),
    box(0.06, 0.3, 0.9, 2.12, 0.85, 0, K.black), box(0.3, 0.14, 0.14, 0.7, 1.95, 1.0, K.red), box(0.3, 0.14, 0.14, 0.7, 1.95, -1.0, K.red),
    ...[[1.3, 1.0], [-1.3, 1.0], [1.3, -1.0], [-1.3, -1.0]].flatMap(([x, z]) => [cyl(0.52, 0.36, x, 0.52, z, K.black, [90, 0, 0], 32), cyl(0.3, 0.38, x, 0.52, z, K.metal, [90, 0, 0], 20)]),
  ]);
  redo('kastil', [
    box(6, 3, 4, 0, 1.5, 0, K.stone), ...[-2, -0.8, 0.4, 1.6].map((x) => box(0.7, 0.55, 0.5, x + 0.2, 3.28, 1.8, K.stone)), ...[-2, -0.8, 0.4, 1.6].map((x) => box(0.7, 0.55, 0.5, x + 0.2, 3.28, -1.8, K.stone)),
    ...[[-3, 2], [3, 2], [-3, -2], [3, -2]].flatMap(([x, z]) => [cyl(1.05, 5.2, x, 2.6, z, K.stone, null, 28), cyl(1.2, 0.35, x, 5.3, z, K.dstone, null, 28), cone(1.35, 1.7, x, 6.3, z, K.red)]),
    box(1.5, 2.1, 0.2, 0, 1.05, 2.05, K.dwood), box(1.8, 0.3, 0.3, 0, 2.2, 2.05, K.dstone), box(0.5, 0.9, 0.1, -1.6, 2.1, 2.03, K.black), box(0.5, 0.9, 0.1, 1.6, 2.1, 2.03, K.black),
  ]);
  redo('lampu', [cyl(0.55, 0.14, 0, 0.07, 0, K.dmetal, null, 28), cyl(0.07, 1.8, 0, 1.0, 0, K.metal), fru(0.8, 0.45, 0.9, 0, 2.2, 0, K.yellow), cyl(0.1, 0.1, 0, 2.7, 0, K.dmetal)]);

  const cats = [];
  for (const it of L) if (!cats.includes(it.cat)) cats.push(it.cat);
  const byId = new Map(L.map((i) => [i.id, i]));

  return { items: L, cats, get: (id) => byId.get(id), colors: K };
});
