global.self = global;
const MO = require('../js/meshops.js'); global.S3DMeshOps = MO;
require('../js/csg.js'); const CSG = global.S3DCSG;
let bad = 0; const ok = (n, c, x) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + n + (x ? '  ' + x : '')); if (!c) bad++; };
const box = (cx, cy, cz, h, c) => { const V = []; for (const z of [-1, 1]) for (const y of [-1, 1]) for (const x of [-1, 1]) V.push([cx + x * h, cy + y * h, cz + z * h]); const F = [[0,2,3,0,3,1],[4,5,7,4,7,6],[0,1,5,0,5,4],[2,6,7,2,7,3],[0,4,6,0,6,2],[1,3,7,1,7,5]]; const t = []; for (const f of F) for (let i = 0; i < 6; i += 3) t.push({ p: [V[f[i]], V[f[i+1]], V[f[i+2]]], c }); return t; };
const vol = (tris) => { let v = 0; for (const t of tris) { const [a, b, c] = t.p; v += (a[0]*(b[1]*c[2]-b[2]*c[1]) - a[1]*(b[0]*c[2]-b[2]*c[0]) + a[2]*(b[0]*c[1]-b[1]*c[0])) / 6; } return v; };
const A = box(0, 0, 0, 1, 0), B = box(1, 1, 1, 1, 1);
ok('volume kotak 8', Math.abs(vol(A) - 8) < 1e-9 || Math.abs(Math.abs(vol(A)) - 8) < 1e-9, vol(A).toFixed(3));
const sgn = Math.sign(vol(A)); const fix = (t) => t.map((x) => sgn < 0 ? { p: [x.p[0], x.p[2], x.p[1]], c: x.c } : x);
const a = fix(A), b = fix(B);
const u = CSG.run('union', a, b), d = CSG.run('difference', a, b), i = CSG.run('intersect', a, b);
ok('union = 8+8-1', Math.abs(vol(u) - 15) < 1e-6, vol(u).toFixed(4));
ok('difference = 8-1', Math.abs(vol(d) - 7) < 1e-6, vol(d).toFixed(4));
ok('intersect = 1', Math.abs(vol(i) - 1) < 1e-6, vol(i).toFixed(4));
ok('warna terbawa', new Set(u.map((t) => t.c)).size === 2 && new Set(d.map((t) => t.c)).has(1));
const welded = MO.weld(CSG.toMesh(u, ['#f00', '#00f']), 1e-7);
const e = new Map(); for (let t = 0; t < welded.T.length / 3; t++) for (let k = 0; k < 3; k++) { const p = welded.T[t*3+k], q = welded.T[t*3+(k+1)%3]; const key = p < q ? p+'_'+q : q+'_'+p; e.set(key, (e.get(key) || 0) + 1); }
let open = 0; for (const v of e.values()) if (v % 2) open++;
console.log('   tepi ganjil (T-junction wajar pada CSG):', open);
// bola - bola performa
const sph = (cx, r, n) => { const t = []; const P = (a, b) => [cx + r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)]; for (let j = 0; j < n; j++) for (let k = 0; k < 2 * n; k++) { const a0 = (k / (2*n)) * 2 * Math.PI, a1 = ((k+1) / (2*n)) * 2 * Math.PI, b0 = (j / n) * Math.PI, b1 = ((j+1) / n) * Math.PI; const p00 = P(a0,b0), p10 = P(a1,b0), p01 = P(a0,b1), p11 = P(a1,b1); if (j > 0) t.push({ p: [p00, p10, p11].reverse(), c: 0 }); if (j < n - 1) t.push({ p: [p00, p11, p01].reverse(), c: 0 }); } return t; };
let s1 = sph(0, 1, 16), s2 = sph(0.8, 1, 16); if (vol(s1) < 0) { s1 = s1.map((x) => ({ p: [x.p[0], x.p[2], x.p[1]], c: 0 })); s2 = s2.map((x) => ({ p: [x.p[0], x.p[2], x.p[1]], c: 0 })); }
const t0 = Date.now(); const sd = CSG.run('difference', s1, s2); console.log('   bola-bola', s1.length, 'seg:', Date.now() - t0, 'ms ->', sd.length);
ok('bola-bola: volume berkurang masuk akal', vol(sd) > 0 && vol(sd) < vol(s1) - 0.3 * 4.18, vol(sd).toFixed(3) + ' dari ' + vol(s1).toFixed(3));
console.log(bad ? 'ADA YANG GAGAL' : 'semua lulus'); process.exit(bad ? 1 : 0);
