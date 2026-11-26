const M = require('../js/meshops.js');
const S = require('../js/core.js');
let bad = 0; const ok = (n, c, x) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + n + (x ? '  ' + x : '')); if (!c) bad++; };
function sphere(nu, nv, r) {
  const P = [], T = [];
  P.push(0, r, 0);
  for (let j = 1; j < nv; j++) for (let i = 0; i < nu; i++) { const th = Math.PI * j / nv, ph = 2 * Math.PI * i / nu; P.push(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)); }
  P.push(0, -r, 0);
  const id = (j, i) => 1 + (j - 1) * nu + (i % nu), bot = P.length / 3 - 1;
  for (let i = 0; i < nu; i++) T.push(0, id(1, i + 1), id(1, i));
  for (let j = 1; j < nv - 1; j++) for (let i = 0; i < nu; i++) { const a = id(j, i), b = id(j, i + 1), c = id(j + 1, i), d = id(j + 1, i + 1); T.push(a, b, c, b, d, c); }
  for (let i = 0; i < nu; i++) T.push(bot, id(nv - 1, i), id(nv - 1, i + 1));
  return { P: Float64Array.from(P), T: Uint32Array.from(T) };
}
const vol = (m) => { let v = 0; for (let t = 0; t < m.T.length; t += 3) { const a = m.T[t] * 3, b = m.T[t + 1] * 3, c = m.T[t + 2] * 3; const P = m.P; v += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6; } return v; };
const sp = sphere(120, 80, 1);
const n0 = sp.T.length / 3; ok('bola sumber', n0 > 15000, String(n0));
const v0 = vol(sp);
const t0 = Date.now(); const d = M.decimate(sp, 2000); const ms = Date.now() - t0;
const n1 = d.T.length / 3;
ok('decimate mendekati target', n1 <= 2100 && n1 >= 1500, n1 + ' tri, ' + ms + ' ms');
ok('volume terjaga (±8%)', Math.abs(vol(d) / v0 - 1) < 0.08, (vol(d) / v0).toFixed(3));
ok('arah muka konsisten (volume > 0)', vol(d) > 0);
let degen = 0; for (let t = 0; t < d.T.length; t += 3) if (d.T[t] === d.T[t + 1] || d.T[t + 1] === d.T[t + 2] || d.T[t] === d.T[t + 2]) degen++;
ok('tanpa segitiga merosot', degen === 0);
const soup = M.toSoup(d, 4, 'y');
ok('toSoup ukuran 4', Math.abs(Math.max(soup.max[0] - soup.min[0], soup.max[1] - soup.min[1]) - 4) < 0.05);
const back = M.fromSoup(soup); ok('fromSoup weld kembali', back.T.length === d.T.length, back.P.length / 3 + ' titik');
// OBJ
const objTxt = 'v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1 2 3 4\n';
const o = M.parseOBJ(objTxt); ok('OBJ quad → 2 segitiga', o.T.length === 6);
// GLB lewat core.buildGLB
const g = soup; const mesh = { positions: g.positions, normals: g.normals, uvs: new Float32Array(g.positions.length / 3 * 2), indices: g.indices, triangles: g.triangles, min: g.min, max: g.max, size: [1, 1, 1] };
const png = new Uint8Array([137,80,78,71,13,10,26,10]); const glb = S.buildGLB(mesh, png, {});
if (glb) { const ab = glb.buffer ? glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) : glb; const r = M.weld(M.parseGLB(ab), 1e-6); ok('GLB bolak-balik', r.T.length > 1000, r.T.length / 3 + ' tri'); }
// ---- warna: GLB dengan 2 primitif berbeda warna (merah, biru) → 2 warna terkuantisasi, tetap ada setelah decimate
(async () => {
  const quad = (x0, col) => ({ pos: [x0, 0, 0, x0 + 1, 0, 0, x0 + 1, 1, 0, x0, 1, 0], idx: [0, 1, 2, 0, 2, 3], col });
  const prims = [quad(0, [1, 0, 0, 1]), quad(2, [0, 0, 1, 1])];
  const chunks = []; let bufLen = 0; const views = [], accs = [];
  for (const p of prims) {
    const pb = Buffer.from(new Float32Array(p.pos).buffer), ib = Buffer.from(new Uint16Array(p.idx).buffer);
    views.push({ buffer: 0, byteOffset: bufLen, byteLength: pb.length }); chunks.push(pb); bufLen += pb.length;
    views.push({ buffer: 0, byteOffset: bufLen, byteLength: ib.length }); chunks.push(ib); bufLen += ib.length + (ib.length % 4 ? 4 - (ib.length % 4) : 0); if (ib.length % 4) chunks.push(Buffer.alloc(4 - (ib.length % 4)));
    accs.push({ bufferView: views.length - 2, componentType: 5126, count: 4, type: 'VEC3' }, { bufferView: views.length - 1, componentType: 5123, count: 6, type: 'SCALAR' });
  }
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], bufferViews: views, accessors: accs,
    materials: prims.map((p) => ({ pbrMetallicRoughness: { baseColorFactor: p.col } })),
    meshes: [{ primitives: prims.map((p, i) => ({ attributes: { POSITION: i * 2 }, indices: i * 2 + 1, material: i })) }] };
  let jb = Buffer.from(JSON.stringify(json)); jb = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
  let bb = Buffer.concat(chunks); bb = Buffer.concat([bb, Buffer.alloc((4 - (bb.length % 4)) % 4)]);
  const hdr = Buffer.alloc(12); hdr.writeUInt32LE(0x46546c67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(12 + 8 + jb.length + 8 + bb.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jb.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bb.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  const all = Buffer.concat([hdr, jh, jb, bh, bb]);
  if (process.env.WRITE_GLB) require('fs').writeFileSync(process.env.WRITE_GLB, all);
  const ab = all.buffer.slice(all.byteOffset, all.byteOffset + all.length);
  const m = await M.parseAny('x.glb', ab);
  ok('GLB berwarna: 2 warna', m.pal && m.pal.length === 2, m.pal && m.pal.join(','));
  const hexes = (m.pal || []).map((h) => parseInt(h.slice(1), 16));
  ok('merah & biru terbaca', hexes.some((v) => (v >> 16) > 200) && hexes.some((v) => (v & 255) > 200));
  const norm = M.normalize(m, 4, 'y'); const soup = M.toSoup(norm, 4, 'y');
  ok('toSoup membuat rentang warna', soup.ranges && soup.ranges.length === 2 && soup.ranges[0].count + soup.ranges[1].count === 12);
  const objM = M.parseOBJ('v 0 0 0\nv 1 0 0\nv 0 1 0\nusemtl a\nf 1 2 3\n', 'newmtl a\nKd 1 0 0\n'); ok('OBJ + MTL membaca Kd', objM.RGB && objM.RGB[0] === 255 && objM.RGB[1] === 0);
  const z = M.normalize({ P: Float64Array.from([0, 0, 0, 1, 0, 0, 0, 0, 2]), T: Uint32Array.from([0, 1, 2]) }, 4, 'z'); let maxY = -1e9, minY = 1e9; for (let i = 1; i < 9; i += 3) { maxY = Math.max(maxY, z.P[i]); minY = Math.min(minY, z.P[i]); }
  ok('Z-up → Y-up (tinggi pindah ke Y)', Math.abs(maxY - minY - 4) < 1e-6, (maxY - minY).toFixed(2));
  process.exit(bad ? 1 : 0);
})();
