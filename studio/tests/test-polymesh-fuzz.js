const P = require('../js/polymesh.js');
function sphere(nu, nv) {
  const V = [[0, 1, 0]], F = [];
  for (let j = 1; j < nv; j++) for (let i = 0; i < nu; i++) { const th = Math.PI * j / nv, ph = 2 * Math.PI * i / nu; V.push([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]); }
  V.push([0, -1, 0]); const id = (j, i) => 1 + (j - 1) * nu + (i % nu), bot = V.length - 1;
  for (let i = 0; i < nu; i++) F.push({ v: [0, id(1, i + 1), id(1, i)], c: 0 });
  for (let j = 1; j < nv - 1; j++) for (let i = 0; i < nu; i++) F.push({ v: [id(j, i), id(j, i + 1), id(j + 1, i + 1), id(j + 1, i)], c: 0 });
  for (let i = 0; i < nu; i++) F.push({ v: [bot, id(nv - 1, i), id(nv - 1, i + 1)], c: 0 });
  return P.create(V, F);
}
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
let bad = 0, runs = 0;
for (let trial = 0; trial < 250; trial++) {
  const pm = sphere(12, 8), log = [];
  for (let step = 0; step < 6; step++) {
    const t = P.topology(pm), edges = Array.from(t.edges.keys()), n = pm.F.length, op = Math.floor(rnd() * 6);
    const pickF = () => { const k = 1 + Math.floor(rnd() * 3), s = new Set(); while (s.size < Math.min(k, n)) s.add(Math.floor(rnd() * n)); return Array.from(s); };
    try {
      if (op === 0) { const f = pickF(); P.extrudeFaces(pm, f, 0.1); log.push('extrude'); }
      else if (op === 1) { const f = pickF(); P.insetFaces(pm, f, 0.05, rnd() < 0.5); log.push('inset'); }
      else if (op === 2) { const es = []; for (let i = 0; i < 2 + Math.floor(rnd() * 3); i++) es.push(edges[Math.floor(rnd() * edges.length)]); P.bevelEdges(pm, es, 0.05); log.push('bevel'); }
      else if (op === 3) { P.loopCut(pm, edges[Math.floor(rnd() * edges.length)], 1 + Math.floor(rnd() * 2), 0); log.push('loopcut'); }
      else if (op === 4) { P.subdivideFaces(pm, pickF(), 1); log.push('subdiv'); }
      else { P.recalcNormals(pm); log.push('recalc'); }
    } catch (e) { bad++; console.log('GAGAL pengecualian', log.join('>'), e.message); break; }
    const s = P.stats(pm); runs++;
    if (s.open || s.nonmanifold) { bad++; console.log('GAGAL topologi', log.join('>'), JSON.stringify(s)); break; }
    { const tp = P.topology(pm); let inc = false; for (const [k, e] of tp.edges) { if (e.faces.length !== 2) continue; const a = P.ekA(k), b = P.ekB(k); const d = (f) => { for (let i = 0; i < f.length; i++) { if (f[i] === a && f[(i + 1) % f.length] === b) return 1; if (f[i] === b && f[(i + 1) % f.length] === a) return -1; } return 0; }; if (d(pm.F[e.faces[0]].v) * d(pm.F[e.faces[1]].v) !== -1) inc = true; } if (inc) { bad++; console.log('GAGAL orientasi', log.join('>')); break; } }
    if (pm.V.some((v) => v.some((x) => !isFinite(x)))) { bad++; console.log('GAGAL NaN', log.join('>')); break; }
  }
}
console.log((bad ? 'GAGAL' : 'OK   ') + ' fuzz ' + runs + ' operasi, ' + bad + ' gagal');
process.exit(bad ? 1 : 0);
