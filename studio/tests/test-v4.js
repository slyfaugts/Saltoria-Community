// Uji v4: pemeriksa & perbaikan mesh. Jalankan: node tests/test-v4.js
const S = require('../js/core.js');
let fail = 0;
const check = (n, c, x) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + n + (x ? '  ' + x : '')); if (!c) fail = 1; };
function box() {
  const P = [], I = [];
  const v = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  for (const p of v) P.push(...p);
  const f = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[2,3,7],[2,7,6],[1,2,6],[1,6,5],[3,0,4],[3,4,7]];
  for (const t of f) I.push(...t);
  return { positions: new Float32Array(P), indices: new Uint32Array(I), uvs: new Float32Array(16).fill(0.5), size: [2,2,2] };
}
const m = box();
let r = S.checkMesh(m, { target: 'roblox' });
check('kubus tertutup: lulus', r.issues[0].level === 'ok' && r.openEdges === 0 && r.volume > 0, JSON.stringify({ v: r.volume, open: r.openEdges }));
const inv = Object.assign({}, m, { indices: new Uint32Array(Array.from(m.indices).map((v, i, a) => (i % 3 === 1 ? a[i + 1] : i % 3 === 2 ? a[i - 1] : v))) });
r = S.checkMesh(inv); check('kubus terbalik terdeteksi', r.issues.some((x) => x.code === 'inverted'));
const fx = S.repairMesh(inv); r = S.checkMesh(fx.mesh); check('perbaikan membalik arah', fx.flipped && r.volume > 0 && r.issues[0].level === 'ok');
const deg = Object.assign({}, m, { indices: new Uint32Array([...m.indices, 0, 0, 1]) });
r = S.checkMesh(deg); check('segitiga gepeng terdeteksi', r.degenerate === 1);
const fx2 = S.repairMesh(deg); check('segitiga gepeng dibuang', fx2.removed === 1 && fx2.mesh.triangles === 12);
const open = Object.assign({}, m, { indices: m.indices.slice(0, 33) }); r = S.checkMesh(open); check('tepi terbuka dilaporkan', r.openEdges > 0 && r.issues.some((x) => x.code === 'open'));
const big = Object.assign({}, m, { size: [3000, 1, 1] }); r = S.checkMesh(big, { target: 'roblox' }); check('ukuran > 2048 galat untuk Roblox', r.issues.some((x) => x.code === 'size' && x.level === 'err'));
r = S.checkMesh(big, { target: 'bebas' }); check('ukuran tidak jadi galat di mode bebas', !r.issues.some((x) => x.code === 'size'));
const uv = Object.assign({}, m, { uvs: new Float32Array(16).fill(1.5) }); r = S.checkMesh(uv); check('UV di luar 0..1 terdeteksi', r.uvOutOfRange > 0);
r = S.checkMesh(m, { limit: 5 }); check('batas segitiga: galat Roblox, peringatan lain', r.issues[0].level === 'err');
r = S.checkMesh(m, { target: 'umum', limit: 5 }); check('batas segitiga di mode umum = peringatan', r.issues[0].level === 'warn');
console.log(fail ? 'ADA YANG GAGAL' : 'semua lulus'); process.exit(fail);
