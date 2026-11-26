// Relief halus: kisi hanya di dalam bentuk, tepi menyatu dengan dasar, normal valid.
const S = require('../js/core.js');
const w = 128, h = 128, d = new Uint8ClampedArray(w * h * 4);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, inC = Math.hypot(x - 64, y - 64) < 50; d[i] = d[i + 1] = d[i + 2] = x * 2; d[i + 3] = inC ? 255 : 0; }
const sh = S.extractShapes({ data: d, width: w, height: h }, { sensitivity: 30, fillHoles: 0, removeSpecks: 4, smooth: 1, maxTriangles: 4000 });
let bad = 0; const ok = (n, c) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + n); if (!c) bad++; };
for (const m of ['bright', 'dark', 'dome']) {
  const r = S.buildHeightRelief(d, w, h, sh.field, sh.level, { mode: m, frame: sh.bounds, res: 60, height: 1, baseZ: 0.2, width: 10, blur: 2 });
  ok(m + ': mesh ada', r && r.triangles > 50);
  ok(m + ': tinggi ≤ baseZ+height', r.max[2] <= 1.2 + 1e-4 && r.min[2] >= 0.2 - 1e-4);
  ok(m + ': normal menghadap atas', (() => { for (let i = 2; i < r.normals.length; i += 3) if (r.normals[i] <= 0) return false; return true; })());
  ok(m + ': di dalam lingkaran', r.max[0] <= 5.01 && r.min[0] >= -5.01);
}
const cap = S.buildHeightRelief(d, w, h, sh.field, sh.level, { mode: 'dome', frame: sh.bounds, res: 300, height: 1, baseZ: 0.2, width: 10, maxTriangles: 800 });
ok('anggaran segitiga dihormati', cap.triangles <= 800);
process.exit(bad ? 1 : 0);
