global.self = global;
const MO = require('../js/meshops.js'); global.S3DMeshOps = global.S3DMeshOps || MO;
const S = require('../js/sculptops.js'); const SO = global.S3DSculptOps || S;
let bad = 0; const ok = (n, c, x) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + n + (x ? '  ' + x : '')); if (!c) bad++; };
// ikosahedron-ish: oktahedron
const octa = () => ({ P: Float64Array.from([1,0,0, -1,0,0, 0,1,0, 0,-1,0, 0,0,1, 0,0,-1]), T: Uint32Array.from([0,2,4, 2,1,4, 1,3,4, 3,0,4, 2,0,5, 1,2,5, 3,1,5, 0,3,5]) });
const edgeStats = (m) => { const e = new Map(); const nT = m.T.length / 3; for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const a = m.T[t*3+k], b = m.T[t*3+(k+1)%3]; const key = a < b ? a+'_'+b : b+'_'+a; e.set(key, (e.get(key)||[]).concat(a<b?1:-1)); } let open = 0, bad2 = 0; for (const v of e.values()) { if (v.length !== 2) open++; else if (v[0] + v[1] !== 0) bad2++; } return { open, bad2, n: e.size }; };
const vol = (m) => { let v = 0; for (let t = 0; t < m.T.length/3; t++) { const a=m.T[t*3]*3,b=m.T[t*3+1]*3,c=m.T[t*3+2]*3; const P=m.P; v += (P[a]*(P[b+1]*P[c+2]-P[b+2]*P[c+1]) - P[a+1]*(P[b]*P[c+2]-P[b+2]*P[c]) + P[a+2]*(P[b]*P[c+1]-P[b+1]*P[c])) / 6; } return v; };
let m = octa(); const v0 = vol(m); ok('oktahedron volume > 0', v0 > 0, v0.toFixed(4));
let r = SO.refine(m, 0.5); const es = edgeStats(r);
ok('refine: lebih banyak segitiga', r.T.length > m.T.length, r.T.length / 3 + '');
ok('refine: tertutup & orientasi konsisten', es.open === 0 && es.bad2 === 0, JSON.stringify(es));
ok('refine: volume sama', Math.abs(vol(r) - v0) < 1e-9);
let maxE = 0; for (let t = 0; t < r.T.length/3; t++) for (let k = 0; k < 3; k++) { const a = r.T[t*3+k]*3, b = r.T[t*3+(k+1)%3]*3; maxE = Math.max(maxE, Math.hypot(r.P[a]-r.P[b], r.P[a+1]-r.P[b+1], r.P[a+2]-r.P[b+2])); }
ok('refine: tepi terpanjang ≤ batas', maxE <= 0.5 + 1e-9, maxE.toFixed(3));
r = SO.refine(Object.assign(octa(), { C: Uint16Array.from([0,1,0,1,0,1,0,1]), VC: new Float32Array(18).fill(0.5) }), 0.7);
ok('refine: warna segitiga & VC ikut', r.C.length === r.T.length / 3 && r.VC.length === r.P.length);
r = SO.refine(octa(), 0.01, 500); ok('refine: menghormati batas segitiga', r.T.length / 3 <= 500, r.T.length / 3 + '');
// relax pada bola: tidak meledak
let s = SO.refine(octa(), 0.4); for (let i = 0; i < s.P.length; i += 3) { const l = Math.hypot(s.P[i], s.P[i+1], s.P[i+2]); s.P[i] /= l; s.P[i+1] /= l; s.P[i+2] /= l; }
const vb = vol(s); const rl = SO.relax(s, 3, 0.5); ok('relax: volume tetap kurang lebih', Math.abs(vol(rl) - vb) / vb < 0.15, (vol(rl)/vb).toFixed(3));
// adj + normal
const adj = SO.buildAdj(s.P.length/3, s.T); const N = SO.vertexNormals(s.P, s.T, adj); let outward = true; for (let v = 0; v < s.P.length/3; v++) if (N[v*3]*s.P[v*3] + N[v*3+1]*s.P[v*3+1] + N[v*3+2]*s.P[v*3+2] < 0.9) outward = false; ok('normal vertex mengarah keluar', outward);
// decimate lewat OPS + transfer warna
const VC = new Float32Array(s.P.length); for (let v = 0; v < s.P.length/3; v++) { VC[v*3] = s.P[v*3] > 0 ? 1 : 0; }
const dm = SO.runSync('decimate', { mesh: { P: s.P, T: s.T, VC }, target: 100 });
ok('decimate: segitiga berkurang', dm.T.length / 3 < s.T.length / 3, s.T.length/3 + ' -> ' + dm.T.length/3);
ok('decimate: VC mengikuti jumlah titik baru', dm.VC.length === dm.P.length);
let good = true; for (let v = 0; v < dm.P.length/3; v++) if (Math.abs(dm.P[v*3]) > 0.3 && (dm.VC[v*3] > 0.5) !== (dm.P[v*3] > 0)) good = false; ok('decimate: warna sisi tetap benar', good);
// quantizeVC
const q = SO.quantizeVC(s.T, VC, 4); ok('quantizeVC: C & palet', q.C.length === s.T.length/3 && q.pal.length >= 2, q.pal.join());
// vcFromPalette
const v2 = SO.vcFromPalette(6, octa().T, Uint16Array.from([0,0,0,0,1,1,1,1]), ['#ff0000', '#00ff00'], SO.buildAdj(6, octa().T), '#ffffff'); ok('vcFromPalette', v2[0] === 1 && v2[1] === 0);
SO.run('refine', { mesh: octa(), maxEdge: 0.5 }).then((x) => { ok('run() async (cadangan sinkron)', x.T.length > 24); console.log(bad ? 'ADA YANG GAGAL' : 'semua lulus'); process.exit(bad ? 1 : 0); });
