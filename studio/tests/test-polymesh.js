const P = require('../js/polymesh.js');
let bad = 0; const ok = (n, c, x) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + n + (x ? '  ' + x : '')); if (!c) bad++; };
const cube = () => P.create(
  [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
  [[0,3,2,1],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,4,7,3]].map((v) => ({ v, c: 0 })));
const closed = (pm, name) => { const s = P.stats(pm); ok(name + ': tertutup & manifold', s.open === 0 && s.nonmanifold === 0, JSON.stringify(s)); return s; };
const vol = (pm) => P.volume(pm);
const consistent = (pm, name) => { const t = P.topology(pm); let okk = true; for (const [k, e] of t.edges) { if (e.faces.length !== 2) continue; const a = P.ekA(k), b = P.ekB(k); const f1 = pm.F[e.faces[0]].v, f2 = pm.F[e.faces[1]].v; const dir = (f) => { for (let i = 0; i < f.length; i++) { if (f[i] === a && f[(i + 1) % f.length] === b) return 1; if (f[i] === b && f[(i + 1) % f.length] === a) return -1; } return 0; }; if (dir(f1) * dir(f2) !== -1) okk = false; } ok(name + ': orientasi konsisten', okk); };

let c = cube(); ok('kubus volume 8', Math.abs(vol(c) - 8) < 1e-9); closed(c, 'kubus'); consistent(c, 'kubus');

// extrude muka atas
c = cube(); let r = P.extrudeFaces(c, [1], 1); closed(c, 'extrude'); consistent(c, 'extrude'); ok('extrude: volume 8 + 4 = 12', Math.abs(vol(c) - 12) < 1e-9, vol(c).toFixed(3)); ok('extrude: 12 titik', c.V.length === 12);
// inset
c = cube(); P.insetFaces(c, [1], 0.3, true); closed(c, 'inset'); consistent(c, 'inset'); ok('inset: volume tetap 8', Math.abs(vol(c) - 8) < 1e-9);
c = cube(); P.insetFaces(c, [1, 4], 0.3, false); closed(c, 'inset wilayah'); consistent(c, 'inset wilayah');
// bevel satu tepi
c = cube(); const t0 = P.topology(c); r = P.bevelEdges(c, [P.ek(0, 1)], 0.3); closed(c, 'bevel 1 tepi'); consistent(c, 'bevel 1 tepi'); ok('bevel 1 tepi: volume < 8', vol(c) < 8 && vol(c) > 7.5, vol(c).toFixed(4));
// bevel 3 tepi bertemu di satu sudut
c = cube(); r = P.bevelEdges(c, [P.ek(0, 1), P.ek(0, 3), P.ek(0, 4)], 0.3); closed(c, 'bevel sudut 3 tepi'); consistent(c, 'bevel sudut'); ok('bevel sudut: ada segitiga sudut', c.F.some((f) => f.v.length === 3));
// bevel loop (4 tepi sekeliling muka atas)
c = cube(); r = P.bevelEdges(c, [P.ek(2,3), P.ek(3,7), P.ek(7,6), P.ek(6,2)], 0.2); closed(c, 'bevel loop'); consistent(c, 'bevel loop'); ok('bevel loop: volume < 8', vol(c) < 8);
// semua 12 tepi
c = cube(); const allE = Array.from(P.topology(c).edges.keys()); r = P.bevelEdges(c, allE, 0.2); closed(c, 'bevel 12 tepi'); consistent(c, 'bevel 12 tepi'); ok('bevel 12 tepi: 26 muka', c.F.length === 26, String(c.F.length));
// loop cut
c = cube(); r = P.loopCut(c, P.ek(0, 1), 1, 0); closed(c, 'loop cut'); consistent(c, 'loop cut'); ok('loop cut: 4 muka baru → 10 muka', c.F.length === 10, String(c.F.length)); ok('loop cut volume tetap', Math.abs(vol(c) - 8) < 1e-9);
c = cube(); P.loopCut(c, P.ek(0, 1), 3, 0); closed(c, 'loop cut x3'); ok('loop cut x3: 6 + 4*3 = 18 muka', c.F.length === 18, String(c.F.length));
// subdivide
c = cube(); P.subdivideFaces(c, [0, 1, 2, 3, 4, 5], 1); closed(c, 'subdivide semua'); consistent(c, 'subdivide'); ok('subdivide: 24 muka', c.F.length === 24);
c = cube(); P.subdivideFaces(c, [1], 2); closed(c, 'subdivide 1 muka x2'); ok('subdivide 1 muka x2 → 9 + 5', c.F.length === 14, String(c.F.length));
c = cube(); P.subdivideEdges(c, [P.ek(0, 1)], 1); closed(c, 'subdivide tepi'); ok('subdivide tepi: 9 titik', c.V.length === 9);
// Catmull-Clark
c = cube(); P.catmullClark(c, 2); closed(c, 'Catmull-Clark x2'); consistent(c, 'CC'); ok('CC x2: 96 muka', c.F.length === 96); ok('CC: euler 2', P.stats(c).euler === 2); ok('CC: kubus mengecil (volume < 8 dan > 2)', vol(c) < 8 && vol(c) > 2, vol(c).toFixed(3));
// delete / dissolve
c = cube(); P.deleteFaces(c, [1]); ok('hapus muka atas: 1 tepi terbuka lingkar 4', P.stats(c).open === 4 && c.F.length === 5);
c = cube(); P.subdivideFaces(c, [1], 1); const e = P.stats(c); P.dissolveEdges(c, [P.ek(8, 10)].filter((k) => P.topology(c).edges.has(k))); ok('dissolve tidak merusak', P.stats(c).open === 0);
c = cube(); P.dissolveVerts(c, [0]); ok('dissolve titik sudut: 7 titik, 4 muka sisa +1', c.V.length === 7 && c.F.length === 4, c.V.length + ' titik ' + c.F.length + ' muka');
// merge
c = cube(); P.extrudeFaces(c, [1], 0); P.weldByDistance(c, 1e-4); closed(c, 'weld setelah extrude 0'); 
c = cube(); P.mergeVerts(c, [0, 1], 'center'); ok('merge 2 titik: 7 titik', c.V.length === 7);
// fill
c = cube(); P.deleteFaces(c, [1]); const loop = P.stats(c); const r2 = P.fillVerts(c, [4, 5, 6, 7], Array.from(P.topology(c).edges.entries()).filter(([, e]) => e.faces.length === 1).map(([k]) => k)); closed(c, 'fill'); consistent(c, 'fill'); ok('fill: volume 8', Math.abs(vol(c) - 8) < 1e-9);
// flip + recalc
c = cube(); P.flipFaces(c, [0, 2]); P.recalcNormals(c); consistent(c, 'recalc'); ok('recalc: volume positif 8', Math.abs(vol(c) - 8) < 1e-9);
// mirror
c = cube(); P.transformVerts(c, [0,1,2,3,4,5,6,7], (p) => [p[0] + 1, p[1], p[2]]); // x dari 0..2
P.mirror(c, 0, 1, 1e-6); closed(c, 'mirror'); consistent(c, 'mirror'); ok('mirror: volume 16', Math.abs(vol(c) - 16) < 1e-6, vol(c).toFixed(3));
// seleksi
c = cube(); P.subdivideFaces(c, [0,1,2,3,4,5], 1); const tp = P.topology(c); const val = (v) => tp.vf[v].length; const ek4 = Array.from(tp.edges.entries()).find(([, e]) => val(e.a) === 4 && val(e.b) === 4)[0]; const lp = P.edgeLoop(c, ek4); ok('loop tepi memilih ≥ 4 tepi', lp.length >= 4, String(lp.length));
const rg = P.edgeRing(c, lp[0]); ok('cincin tepi ada', rg.edges.length >= 4);
ok('grow/shrink', P.growFaces(c, [0]).length > 1);
// segitiga ↔ poligon
const tri = { P: Float64Array.from(c.V.flat()), T: Uint32Array.from(c.F.flatMap((f) => P.triangulateFace(c, f).flat())) };
const back = P.fromTriMesh(tri); ok('tri → quad merge menghasilkan semua segi empat', back.F.length === c.F.length, back.F.length + ' vs ' + c.F.length);
const tm = P.toTriMesh(back); ok('toTriMesh jumlah segitiga = 2/quad', tm.T.length / 3 === back.F.length * 2);
// n-gon ear clipping
const hex = P.create([[1,0,0],[0.5,0.87,0],[-0.5,0.87,0],[-1,0,0],[-0.5,-0.87,0],[0.5,-0.87,0]], [{ v: [0,1,2,3,4,5], c: 0 }]); ok('heksagon → 4 segitiga', P.toTriMesh(hex).T.length === 12);
const L = P.create([[0,0,0],[2,0,0],[2,1,0],[1,1,0],[1,2,0],[0,2,0]], [{ v: [0,1,2,3,4,5], c: 0 }]); const lt = P.toTriMesh(L); let area = 0; for (let i = 0; i < lt.T.length; i += 3) { const a = lt.P.subarray(lt.T[i]*3, lt.T[i]*3+3), b = lt.P.subarray(lt.T[i+1]*3, lt.T[i+1]*3+3), cc = lt.P.subarray(lt.T[i+2]*3, lt.T[i+2]*3+3); area += ((b[0]-a[0])*(cc[1]-a[1]) - (b[1]-a[1])*(cc[0]-a[0])) / 2; } ok('bentuk L (cekung) luas 3', Math.abs(area - 3) < 1e-9, area.toFixed(3));
process.exit(bad ? 1 : 0);
