global.self = global;
const MO = require('../js/meshops.js'); global.S3DMeshOps = global.S3DMeshOps || MO;
require('../js/sculptops.js'); const SO = global.S3DSculptOps;
require('../js/uv.js'); const UV = global.S3DUV;
let bad = 0; const ok = (n, c, x) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + n + (x ? '  ' + x : '')); if (!c) bad++; };
const cube = () => ({ P: Float64Array.from([-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1]), T: Uint32Array.from([0,2,1,0,3,2, 4,5,6,4,6,7, 0,1,5,0,5,4, 2,3,7,2,7,6, 1,2,6,1,6,5, 0,4,7,0,7,3]) });
const sphere = (n) => { let m = { P: Float64Array.from([1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1]), T: Uint32Array.from([0,2,4,2,1,4,1,3,4,3,0,4,2,0,5,1,2,5,3,1,5,0,3,5]) }; m = SO.refine(m, n); for (let i = 0; i < m.P.length; i += 3) { const l = Math.hypot(m.P[i], m.P[i+1], m.P[i+2]); m.P[i] /= l; m.P[i+1] /= l; m.P[i+2] /= l; } return m; };
const check = (name, m, opt) => {
  const r = UV.unwrap(m, opt), S = r.size, nT = m.T.length / 3;
  ok(name + ': jumlah segitiga sama', r.T.length === m.T.length);
  ok(name + ': UV dalam 0..1', Array.from(r.UV).every((v) => v >= -1e-6 && v <= 1 + 1e-6));
  const cov = new Int32Array(S * S).fill(-1); let over = 0, total = 0; UV.rasterize(r.UV, r.T, S, (x, y, tt) => { const i = y * S + x, cid = r.chartOf[tt]; if (cov[i] >= 0 && cov[i] !== cid) over++; cov[i] = cid; total++; });
  ok(name + ': tumpang tindih kecil', over / total < 0.03, (100 * over / total).toFixed(2) + '%');
  let flips = 0; for (const ch of r.charts) { let pos = 0, neg = 0; for (const t of ch.tris) { const a = r.T[t*3]*2, b = r.T[t*3+1]*2, c = r.T[t*3+2]*2; const ar = (r.UV[b]-r.UV[a])*(r.UV[c+1]-r.UV[a+1]) - (r.UV[c]-r.UV[a])*(r.UV[b+1]-r.UV[a+1]); if (ar > 1e-12) pos++; else if (ar < -1e-12) neg++; } flips += Math.min(pos, neg); }
  ok(name + ': tidak ada segitiga terbalik dalam chart', flips === 0, String(flips));
  let used = 0; for (const v of cov) used += v >= 0 ? 1 : 0; ok(name + ': atlas terpakai > 25%', used / (S * S) > 0.25, (100 * used / (S*S)).toFixed(1) + '%');
  ok(name + ': normal satuan', Array.from({ length: r.N.length / 3 }, (_, i) => Math.hypot(r.N[i*3], r.N[i*3+1], r.N[i*3+2])).every((l) => Math.abs(l - 1) < 1e-3));
  return r;
};
let r = check('kubus', cube(), { size: 256 }); ok('kubus: 6 chart', r.charts.length === 6, String(r.charts.length)); ok('kubus: titik 24', r.P.length / 3 === 24, String(r.P.length/3));
let nrm = true; for (let i = 0; i < r.N.length / 3; i++) if (Math.max(Math.abs(r.N[i*3]), Math.abs(r.N[i*3+1]), Math.abs(r.N[i*3+2])) < 0.999) nrm = false; ok('kubus: normal tetap tajam (sumbu)', nrm);
r = check('bola', sphere(0.25), { size: 512, angle: 55 }); console.log('   chart bola:', r.charts.length);
r = check('bola sudut kecil', sphere(0.25), { size: 512, angle: 30 }); console.log('   chart:', r.charts.length);
// bake + dilate + remap
const m = cube(); m.C = Uint16Array.from([0,0,1,1,0,0,1,1,0,0,1,1]); m.pal = ['#ff0000', '#0000ff'];
r = UV.unwrap(m, { size: 128 }); const b = UV.bake(r, 128, '#ffffff'); let red = 0, blue = 0; for (let i = 0; i < 128*128; i++) if (b.mask[i]) { if (b.rgba[i*4] === 255 && b.rgba[i*4+2] === 0) red++; if (b.rgba[i*4+2] === 255 && b.rgba[i*4] === 0) blue++; }
ok('bake: warna palet per segitiga', red > 100 && blue > 100, red + '/' + blue);
const before = b.mask.reduce((s, v) => s + v, 0); UV.dilate(b.rgba, b.mask, 128, 2);
const r2 = UV.unwrap(m, { size: 256, margin: 6 }); const rm = UV.remap(r.UV, r.T, r2.UV, r2.T, b.rgba, 128, 256);
let red2 = 0, blue2 = 0; for (let i = 0; i < 256*256; i++) if (rm.mask[i]) { if (rm.rgba[i*4] > 240 && rm.rgba[i*4+2] < 15) red2++; if (rm.rgba[i*4+2] > 240 && rm.rgba[i*4] < 15) blue2++; }
ok('remap: warna ikut ke susunan baru', red2 > 300 && blue2 > 300, red2 + '/' + blue2);
// chart ops
const ba = UV.chartBox(r, 0); UV.transformChart(r, 0, (u, v) => [u + 0.001, v]); const bb = UV.chartBox(r, 0); ok('transformChart geser', Math.abs(bb.x0 - ba.x0 - 0.001) < 1e-6);
const hit = UV.chartAt(r, ba.cx, ba.cy); ok('chartAt menemukan chart', hit >= 0);
// kinerja
const big = sphere(0.04); const t0 = Date.now(); const rb = UV.unwrap(big, { size: 1024 }); console.log('   bola', big.T.length/3, 'segitiga: unwrap', Date.now() - t0, 'ms, chart', rb.charts.length);
console.log(bad ? 'ADA YANG GAGAL' : 'semua lulus'); process.exit(bad ? 1 : 0);
