// Uji Node untuk fitur v3: gabung mesh, STL, relief, library objek.
const fs = require('fs');
const C = require('../js/core.js'), Sh = require('../js/shapes.js'), Lib = require('../js/library.js');
let fail = 0;
const ok = (n, c, x) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + n + (x ? '  ' + x : '')); if (!c) fail++; };

// library
let clamp = 0, empty = 0, tri = 0;
for (const it of Lib.items) {
  if (!it.parts.length) empty++;
  for (const p of it.parts) {
    const sp = Sh.sanitize(p.t, Object.assign(Sh.defaults(p.t), p.p));
    for (const k in p.p) if (Math.abs(sp[k] - p.p[k]) > 1e-9) clamp++;
    tri += Sh.build(p.t, p.p).triangles;
  }
}
ok('library: 200+ objek, 14 kategori', Lib.items.length >= 200 && Lib.cats.length === 14);
ok('library: tidak ada parameter terpotong / objek kosong', clamp === 0 && empty === 0);
ok('library: id unik', new Set(Lib.items.map((i) => i.id)).size === Lib.items.length);

// core v3 (butuh logo mentah; lewati jika tidak ada)
const f = process.argv[2] || '/tmp/s3d/logo1024.rgba';
if (fs.existsSync(f)) {
  const w = +(process.argv[3] || 1024), h = +(process.argv[4] || 683);
  const data = new Uint8ClampedArray(fs.readFileSync(f));
  const sh = C.extractShapes({ data, width: w, height: h }, { sensitivity: 50, maxTriangles: 8000, smooth: 1 });
  const base = C.buildMesh(sh, { width: 10, thickness: 0.3 });
  for (const mode of ['bright', 'dark', 'dome']) {
    const rm = C.reliefMasks(data, w, h, sh.field, sh.level, { mode, levels: 4 });
    ok('relief ' + mode + ': 3 lapisan, minimal satu terisi', rm.layers.length === 3 && rm.layers.some((l) => l.any));
  }
  const rm = C.reliefMasks(data, w, h, sh.field, sh.level, { mode: 'bright', levels: 3 });
  const l = rm.layers[0];
  const s2 = C.extractShapes({ data: l.rgba, width: w, height: h }, { sensitivity: 50, source: 'alpha', maxTriangles: 3000 });
  const m2 = C.buildMesh(s2, { width: 10, thickness: 0.2, frame: sh.bounds });
  C.translateMesh(m2, 0, 0, 0.3);
  ok('frame menjaga posisi: lapisan berada di dalam batas dasar', m2.min[0] >= base.min[0] - 0.05 && m2.max[0] <= base.max[0] + 0.05 && m2.min[1] >= base.min[1] - 0.05 && m2.max[1] <= base.max[1] + 0.05);
  const mm = C.mergeMeshes([base, m2]);
  ok('mergeMeshes: jumlah segitiga & indeks valid', mm.triangles === base.triangles + m2.triangles && Math.max(...mm.indices) < mm.positions.length / 3);
  const stl = C.buildSTL(mm);
  ok('STL: ukuran = 84 + 50 x segitiga', stl.length === 84 + mm.triangles * 50);
  const fl = C.flipMesh(C.mergeMeshes([base]));
  ok('flipMesh: z dibalik', Math.abs(fl.min[2] + base.max[2]) < 1e-6);
} else console.log('LEWAT  uji core v3 (berkas logo mentah tidak ada)');
console.log(fail ? fail + ' GAGAL' : 'semua lulus');
process.exitCode = fail ? 1 : 0;
