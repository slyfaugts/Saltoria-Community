// Uji mesin inti dengan logo asli. Jalankan: node tests/test-core.js <rgba> <w> <h> <outdir>
const fs = require('fs');
const path = require('path');
const S = require('../js/core.js');

const [rgbaPath, W, H, outDir] = process.argv.slice(2);
const w = +W, h = +H;
const data = new Uint8Array(fs.readFileSync(rgbaPath));
fs.mkdirSync(outDir, { recursive: true });

function check(name, cond, extra) { console.log((cond ? 'OK   ' : 'GAGAL') + ' ' + name + (extra ? '  ' + extra : '')); if (!cond) process.exitCode = 1; }

// 1) kuadrat sederhana: orientasi kontur luar harus positif
{
  const n = 20, d = new Uint8Array(n * n * 4);
  for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) { const k = (y * n + x) * 4; d[k] = 255; d[k + 3] = 255; }
  const sh = S.extractShapes({ data: d, width: n, height: n }, { removeSpecks: 1 });
  check('kuadrat: 1 bentuk, 0 lubang', sh.polys.length === 1 && sh.polys[0].holes.length === 0);
  const a = S.loopArea(sh.polys[0].outer);
  check('kuadrat: luas ~100 px2 (kontur luar bernilai negatif)', Math.abs(Math.abs(a) - 100) < 12 && a < 0, 'luas=' + a.toFixed(2));
}

// 2) cincin: harus ada 1 lubang
{
  const n = 40, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot(x - 19.5, y - 19.5);
    if (r < 15 && r > 7) { const k = (y * n + x) * 4; d[k] = 255; d[k + 3] = 255; }
  }
  const sh = S.extractShapes({ data: d, width: n, height: n }, { removeSpecks: 1 });
  check('cincin: 1 bentuk, 1 lubang', sh.polys.length === 1 && sh.polys[0].holes.length === 1);
  const mesh = S.buildMesh(sh, { width: 10, thickness: 1 });
  check('cincin: mesh punya segitiga', mesh.triangles > 50, 'tri=' + mesh.triangles);
  // volume harus positif dan mendekati luas * tebal
  let vol = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i] * 3, b = mesh.indices[i + 1] * 3, c = mesh.indices[i + 2] * 3;
    const P = mesh.positions;
    vol += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
  }
  check('cincin: volume positif (arah muka benar)', vol > 0, 'vol=' + vol.toFixed(3));
}

// 3) logo asli
const t0 = Date.now();
const shapes = S.extractShapes({ data, width: w, height: h }, { sensitivity: 18, fillHoles: 0, removeSpecks: 20, smooth: 2, maxTriangles: 18000, bevel: false });
console.log('ekstraksi', Date.now() - t0, 'ms', JSON.stringify(shapes.stats));
check('logo: terdeteksi banyak bagian', shapes.polys.length > 20, 'bagian=' + shapes.polys.length);
check('logo: estimasi segitiga <= batas', shapes.stats.estimatedTriangles <= 18000, 'est=' + shapes.stats.estimatedTriangles);
check('logo: tidak ada bagian dibuang', shapes.stats.dropped === 0);

const t1 = Date.now();
const mesh = S.buildMesh(shapes, { width: 12, thickness: 0.3, bevel: 0 });
console.log('mesh', Date.now() - t1, 'ms tri=' + mesh.triangles, 'verts=' + mesh.positions.length / 3, 'size=' + mesh.size.map((v) => v.toFixed(3)));
check('logo: mesh <= 20000 segitiga', mesh.triangles <= 20000, 'tri=' + mesh.triangles);
check('logo: lebar = 12 studs', Math.abs(mesh.size[0] - 12) < 1e-3);

// mesh tertutup: tiap sisi (posisi terkuantisasi) dipakai genap kali, volume positif
function quant(P, i) { return Math.round(P[i * 3] * 1e4) + ',' + Math.round(P[i * 3 + 1] * 1e4) + ',' + Math.round(P[i * 3 + 2] * 1e4); }
function manifold(m) {
  const edges = new Map();
  const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  for (let i = 0; i < m.indices.length; i += 3) {
    const q = [quant(m.positions, m.indices[i]), quant(m.positions, m.indices[i + 1]), quant(m.positions, m.indices[i + 2])];
    for (let e = 0; e < 3; e++) { const k = key(q[e], q[(e + 1) % 3]); edges.set(k, (edges.get(k) || 0) + 1); }
  }
  let odd = 0; for (const c of edges.values()) if (c % 2) odd++;
  return { edges: edges.size, odd };
}
function volume(m) {
  let vol = 0; const P = m.positions;
  for (let i = 0; i < m.indices.length; i += 3) {
    const a = m.indices[i] * 3, b = m.indices[i + 1] * 3, c = m.indices[i + 2] * 3;
    vol += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
  }
  return vol;
}
const man = manifold(mesh);
check('logo: tepi bermakna (jumlah pemakaian genap)', man.odd === 0, 'tepi ganjil=' + man.odd + ' dari ' + man.edges);
check('logo: volume positif', volume(mesh) > 0, 'vol=' + volume(mesh).toFixed(4));

// luas penutup = luas poligon
let polyArea = 0;
const sc = 12 / (shapes.bounds.maxX - shapes.bounds.minX);
for (const p of shapes.polys) { polyArea += Math.abs(S.loopArea(p.outer)); for (const hl of p.holes) polyArea -= Math.abs(S.loopArea(hl)); }
polyArea *= sc * sc;
console.log('luas poligon (studs2)', polyArea.toFixed(4), ' volume/tebal', (volume(mesh) / 0.3).toFixed(4));
check('logo: volume ~ luas x tebal (<1.5%)', Math.abs(volume(mesh) / 0.3 - polyArea) / polyArea < 0.015);

// 4) dengan bevel
const shapesB = S.extractShapes({ data, width: w, height: h }, { sensitivity: 18, removeSpecks: 20, smooth: 2, maxTriangles: 18000, bevel: true });
const t2 = Date.now();
const meshB = S.buildMesh(shapesB, { width: 12, thickness: 0.3, bevel: 0.05 });
console.log('bevel mesh', Date.now() - t2, 'ms tri=' + meshB.triangles, 'fallback=' + meshB.bevelFallbacks, 'polys=' + shapesB.polys.length);
check('bevel: <= 20000 segitiga', meshB.triangles <= 20000, 'tri=' + meshB.triangles);
const manB = manifold(meshB);
check('bevel: mesh tertutup', manB.odd === 0, 'tepi ganjil=' + manB.odd);
check('bevel: volume positif & lebih kecil dari tanpa bevel', volume(meshB) > 0 && volume(meshB) < volume(mesh) * 1.001, volume(meshB).toFixed(4));

// 5) penulis berkas
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const glb = S.buildGLB(mesh, png, { metallic: 0.2, roughness: 0.6 });
check('GLB: header "glTF" v2 & panjang cocok', Buffer.from(glb.buffer, glb.byteOffset, 4).toString() === 'glTF' && new DataView(glb.buffer).getUint32(8, true) === glb.length, 'bytes=' + glb.length);
fs.writeFileSync(path.join(outDir, 'logo.glb'), glb);
const obj = S.buildOBJ(mesh);
fs.writeFileSync(path.join(outDir, 'model.obj'), obj);
fs.writeFileSync(path.join(outDir, 'model.mtl'), S.buildMTL());
const zip = S.buildZip([{ name: 'model.obj', data: new TextEncoder().encode(obj) }, { name: 'model.mtl', data: new TextEncoder().encode(S.buildMTL()) }, { name: 'logo_texture.png', data: png }]);
fs.writeFileSync(path.join(outDir, 'test.zip'), zip);

// untuk visualisasi di Python
fs.writeFileSync(path.join(outDir, 'polys.json'), JSON.stringify({ w, h, polys: shapes.polys.map((p) => ({ o: Array.from(p.outer), h: p.holes.map((x) => Array.from(x)) })) }));
fs.writeFileSync(path.join(outDir, 'meshB_stats.json'), JSON.stringify({ tri: meshB.triangles, polys: shapesB.polys.length }));
console.log('selesai');
