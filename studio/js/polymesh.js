/*
 * Saltoria 3D Studio — mesin poligon untuk Edit Mode (tanpa dependensi, bisa dites di Node).
 *
 * PolyMesh = { V: [[x,y,z],…], F: [{ v:[i,j,k,…], c:indeksWarna }], pal: [hex]|null }
 * Muka berlawanan arah jarum jam (CCW) dilihat dari luar. Muka boleh segitiga, segi empat, atau n-gon.
 * Setiap operasi mengubah mesh di tempat dan mengembalikan seleksi baru: { v:[…], f:[…] } (indeks sesudah operasi).
 */
(function (root) {
  'use strict';

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a); return l > 1e-15 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const SH = 4294967296;
  const ek = (a, b) => (a < b ? a * SH + b : b * SH + a);
  const ekA = (k) => Math.floor(k / SH), ekB = (k) => k % SH;

  function create(V, F, pal) { return { V: V || [], F: F || [], pal: pal || null }; }
  function clone(pm) { return { V: pm.V.map((v) => v.slice()), F: pm.F.map((f) => ({ v: f.v.slice(), c: f.c })), pal: pm.pal ? pm.pal.slice() : null }; }

  // normal muka (metode Newell), tidak dinormalkan = berbobot luas
  function faceNormalRaw(pm, f) {
    const v = f.v; let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < v.length; i++) {
      const a = pm.V[v[i]], b = pm.V[v[(i + 1) % v.length]];
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return [nx, ny, nz];
  }
  const faceNormal = (pm, f) => norm(faceNormalRaw(pm, f));
  function faceCenter(pm, f) { let c = [0, 0, 0]; for (const i of f.v) c = add(c, pm.V[i]); return mul(c, 1 / f.v.length); }
  function faceArea(pm, f) { return len(faceNormalRaw(pm, f)) / 2; }

  /* ----------------------------- topologi ----------------------------- */
  function topology(pm) {
    const edges = new Map(), vf = pm.V.map(() => []);
    pm.F.forEach((f, fi) => {
      const n = f.v.length;
      for (let i = 0; i < n; i++) {
        const a = f.v[i], b = f.v[(i + 1) % n], k = ek(a, b);
        let e = edges.get(k); if (!e) { e = { a: Math.min(a, b), b: Math.max(a, b), faces: [] }; edges.set(k, e); }
        e.faces.push(fi);
        vf[a].push(fi);
      }
    });
    return { edges, vf };
  }
  const hasEdge = (f, a, b) => { const n = f.v.length; for (let i = 0; i < n; i++) if (f.v[i] === a && f.v[(i + 1) % n] === b) return true; return false; };
  function rotateTo(arr, x) { const i = arr.indexOf(x); return arr.slice(i).concat(arr.slice(0, i)); }

  // buang titik tak terpakai; kembalikan peta lama→baru
  function compact(pm) {
    const used = new Uint8Array(pm.V.length);
    for (const f of pm.F) for (const i of f.v) used[i] = 1;
    const map = new Int32Array(pm.V.length).fill(-1), V = [];
    for (let i = 0; i < pm.V.length; i++) if (used[i]) { map[i] = V.length; V.push(pm.V[i]); }
    pm.V = V;
    for (const f of pm.F) f.v = f.v.map((i) => map[i]);
    return map;
  }
  // buang titik kembar berurutan, muka < 3 titik, dan muka ganda
  function tidyFaces(pm) {
    const seen = new Set(), out = [], remap = new Int32Array(pm.F.length).fill(-1);
    pm.F.forEach((f, fi) => {
      let v = f.v.slice(), ch = true;
      while (ch) { ch = false; for (let i = 0; i < v.length; i++) { if (v[i] === v[(i + 1) % v.length]) { v.splice(i, 1); ch = true; break; } } }
      // titik yang sama dua kali (spike)
      for (let i = 0; i < v.length && v.length >= 3; i++) { if (v[(i + 2) % v.length] === v[i] && v.length > 2) { v.splice((i + 1) % v.length, 2); i = -1; } }
      if (v.length < 3) return;
      const key = v.slice().sort((a, b) => a - b).join('_');
      if (seen.has(key)) return;
      seen.add(key); remap[fi] = out.length; out.push({ v, c: f.c });
    });
    pm.F = out;
    return remap;
  }

  /* ----------------------------- konversi ----------------------------- */
  // Segitiga → poligon: pasangan segitiga sebidang (dan sewarna) digabung menjadi segi empat.
  function fromTriMesh(m, opt) {
    const V = []; for (let i = 0; i < m.P.length; i += 3) V.push([m.P[i], m.P[i + 1], m.P[i + 2]]);
    const nT = m.T.length / 3, tris = [];
    for (let t = 0; t < nT; t++) tris.push({ v: [m.T[t * 3], m.T[t * 3 + 1], m.T[t * 3 + 2]], c: m.C ? m.C[t] : 0 });
    const pm = create(V, tris, m.pal ? m.pal.slice() : null);
    if (opt && opt.quads === false) return pm;
    const edgeTris = new Map();
    tris.forEach((f, i) => { for (let k = 0; k < 3; k++) { const key = ek(f.v[k], f.v[(k + 1) % 3]); const l = edgeTris.get(key); if (l) l.push(i); else edgeTris.set(key, [i]); } });
    const nrm = tris.map((f) => faceNormal(pm, f)), used = new Uint8Array(nT), out = [];
    const cosT = Math.cos(((opt && opt.angle) || 1) * Math.PI / 180);
    for (let i = 0; i < nT; i++) {
      if (used[i]) continue;
      const f = tris[i]; let best = null, bestScore = -1;
      for (let k = 0; k < 3; k++) {
        const a = f.v[k], b = f.v[(k + 1) % 3], cI = f.v[(k + 2) % 3], l = edgeTris.get(ek(a, b));
        if (!l || l.length !== 2) continue;
        const j = l[0] === i ? l[1] : l[0];
        if (used[j] || tris[j].c !== f.c || dot(nrm[i], nrm[j]) < cosT) continue;
        const g = tris[j], d = g.v.find((x) => x !== a && x !== b);
        // quad: a? tri i = (a,b,c) CCW dengan sisi a→b; tri j memuat b→a dan titik d → quad (a, d, b, c)
        const quad = [a, d, b, cI];
        // cembung?
        let ok = true; const N = nrm[i];
        for (let q = 0; q < 4 && ok; q++) { const p0 = V[quad[q]], p1 = V[quad[(q + 1) % 4]], p2 = V[quad[(q + 2) % 4]]; if (dot(cross(sub(p1, p0), sub(p2, p1)), N) <= 1e-12) ok = false; }
        if (!ok) continue;
        // pilih pasangan yang paling "persegi" (sisi diagonal terpendek relatif)
        const d1 = len(sub(V[quad[0]], V[quad[2]])), d2 = len(sub(V[quad[1]], V[quad[3]])), score = Math.min(d1, d2) / Math.max(d1, d2);
        if (score > bestScore) { bestScore = score; best = { j, quad }; }
      }
      if (best) { used[i] = used[best.j] = 1; out.push({ v: best.quad, c: f.c }); }
      else { used[i] = 1; out.push({ v: f.v.slice(), c: f.c }); }
    }
    pm.F = out;
    return pm;
  }

  function triangulateFace(pm, f) {
    const v = f.v, n = v.length;
    if (n === 3) return [[v[0], v[1], v[2]]];
    if (n === 4) {
      const P = v.map((i) => pm.V[i]);
      const d1 = len(sub(P[0], P[2])), d2 = len(sub(P[1], P[3]));
      // diagonal pendek, dan pastikan kedua segitiga searah normal muka
      const N = faceNormalRaw(pm, f);
      const okTri = (a, b, c) => dot(cross(sub(P[b], P[a]), sub(P[c], P[a])), N) > 0;
      if (d1 <= d2 && okTri(0, 1, 2) && okTri(0, 2, 3)) return [[v[0], v[1], v[2]], [v[0], v[2], v[3]]];
      if (okTri(1, 2, 3) && okTri(1, 3, 0)) return [[v[1], v[2], v[3]], [v[1], v[3], v[0]]];
      return [[v[0], v[1], v[2]], [v[0], v[2], v[3]]];
    }
    // telinga (ear clipping) pada bidang yang diproyeksikan menurut sumbu dominan normal
    const N = faceNormalRaw(pm, f), ax = Math.abs(N[0]) >= Math.abs(N[1]) && Math.abs(N[0]) >= Math.abs(N[2]) ? 0 : Math.abs(N[1]) >= Math.abs(N[2]) ? 1 : 2;
    const ua = (ax + 1) % 3, va = (ax + 2) % 3, sgn = N[ax] >= 0 ? 1 : -1;
    const pt = (i) => [pm.V[i][ua] * sgn, pm.V[i][va]];
    // orientasi 2D: jika sgn<0 proyeksi terbalik; tukar sehingga CCW di bidang
    const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const idx = v.slice(), out = [];
    let guard = 0;
    while (idx.length > 3 && guard++ < 10000) {
      let cut = false;
      for (let i = 0; i < idx.length; i++) {
        const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
        const A = pt(a), B = pt(b), C = pt(c);
        if (cr(A, B, C) <= 1e-14) continue;
        let inside = false;
        for (const p of idx) { if (p === a || p === b || p === c) continue; const P2 = pt(p); if (cr(A, B, P2) >= 0 && cr(B, C, P2) >= 0 && cr(C, A, P2) >= 0) { inside = true; break; } }
        if (inside) continue;
        out.push([a, b, c]); idx.splice(i, 1); cut = true; break;
      }
      if (!cut) { // bentuk merosot: kipas
        for (let i = 1; i + 1 < idx.length; i++) out.push([idx[0], idx[i], idx[i + 1]]);
        return out;
      }
    }
    if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
    return out;
  }

  // PolyMesh → { P, T, C, pal } (segitiga berindeks, titik dipakai bersama)
  function toTriMesh(pm) {
    const P = [], T = [], C = [], map = new Int32Array(pm.V.length).fill(-1);
    const use = (i) => { if (map[i] < 0) { map[i] = P.length / 3; P.push(pm.V[i][0], pm.V[i][1], pm.V[i][2]); } return map[i]; };
    for (const f of pm.F) for (const t of triangulateFace(pm, f)) { T.push(use(t[0]), use(t[1]), use(t[2])); C.push(f.c || 0); }
    const out = { P: Float64Array.from(P), T: Uint32Array.from(T) };
    if (pm.pal) { out.C = Uint16Array.from(C); out.pal = pm.pal.slice(); }
    return out;
  }

  /* ----------------------------- seleksi ----------------------------- */
  const edgesOfFaces = (pm, faces) => { const s = new Set(); for (const fi of faces) { const f = pm.F[fi]; for (let i = 0; i < f.v.length; i++) s.add(ek(f.v[i], f.v[(i + 1) % f.v.length])); } return s; };
  const vertsOfFaces = (pm, faces) => { const s = new Set(); for (const fi of faces) for (const i of pm.F[fi].v) s.add(i); return s; };
  const facesFromVerts = (pm, vs) => { const r = []; pm.F.forEach((f, i) => { if (f.v.every((x) => vs.has(x))) r.push(i); }); return r; };
  const edgesFromVerts = (pm, vs, topo) => { const t = topo || topology(pm), r = []; for (const [k, e] of t.edges) if (vs.has(e.a) && vs.has(e.b)) r.push(k); return r; };
  function facesFromEdges(pm, edgeSet) { const r = []; pm.F.forEach((f, i) => { let all = true; for (let k = 0; k < f.v.length; k++) if (!edgeSet.has(ek(f.v[k], f.v[(k + 1) % f.v.length]))) { all = false; break; } if (all) r.push(i); }); return r; }

  function growFaces(pm, faces) { const vs = vertsOfFaces(pm, faces), out = new Set(faces); pm.F.forEach((f, i) => { if (f.v.some((x) => vs.has(x))) out.add(i); }); return Array.from(out); }
  function shrinkFaces(pm, faces) {
    const set = new Set(faces), t = topology(pm), keep = [];
    for (const fi of faces) {
      let ok = true; const f = pm.F[fi];
      for (const v of f.v) { for (const g of t.vf[v]) if (!set.has(g)) { ok = false; break; } if (!ok) break; }
      if (ok) keep.push(fi);
    }
    return keep;
  }
  // loop tepi: lewati titik valensi 4 lurus ke depan
  function edgeLoop(pm, key, topo) {
    const t = topo || topology(pm), start = t.edges.get(key); if (!start) return [];
    const nbrs = (v) => { const s = new Set(); for (const fi of t.vf[v]) { const f = pm.F[fi], i = f.v.indexOf(v); s.add(f.v[(i + 1) % f.v.length]); s.add(f.v[(i + f.v.length - 1) % f.v.length]); } return Array.from(s); };
    const out = new Set([key]);
    const walk = (from, to) => {
      let a = from, b = to, guard = 0;
      while (guard++ < 100000) {
        const nb = nbrs(b);
        if (nb.length !== 4) return;
        const inE = t.edges.get(ek(a, b));
        const inFaces = new Set(inE.faces);
        // tepi lurus = yang tidak berbagi muka dengan tepi masuk
        const next = nb.find((x) => { if (x === a) return false; const e = t.edges.get(ek(b, x)); return e && !e.faces.some((f) => inFaces.has(f)); });
        if (next == null) return;
        const k2 = ek(b, next);
        if (out.has(k2)) return;
        out.add(k2); a = b; b = next;
      }
    };
    walk(start.a, start.b); walk(start.b, start.a);
    return Array.from(out);
  }
  // cincin tepi: tepi sejajar menembus deretan segi empat
  function edgeRing(pm, key, topo) {
    const t = topo || topology(pm), start = t.edges.get(key); if (!start) return { edges: [], faces: [], closed: false };
    const edges = new Set([key]), faces = [], faceSet = new Set();
    const go = (k0, f0) => {
      let k = k0, fi = f0, guard = 0;
      while (fi != null && guard++ < 100000) {
        const f = pm.F[fi]; if (f.v.length !== 4 || faceSet.has(fi)) return;
        faceSet.add(fi); faces.push(fi);
        const e = t.edges.get(k), n = f.v.length;
        let idx = -1; for (let i = 0; i < n; i++) if (ek(f.v[i], f.v[(i + 1) % n]) === k) idx = i;
        const opp = ek(f.v[(idx + 2) % 4], f.v[(idx + 3) % 4]);
        if (edges.has(opp)) return;
        edges.add(opp);
        const oe = t.edges.get(opp); const nf = oe.faces.find((x) => x !== fi);
        k = opp; fi = nf; void e;
      }
    };
    const e0 = t.edges.get(key);
    for (const f of e0.faces) go(key, f);
    return { edges: Array.from(edges), faces };
  }
  function linkedFaces(pm, startFace) {
    const t = topology(pm), seen = new Set([startFace]), q = [startFace];
    while (q.length) { const fi = q.pop(); const f = pm.F[fi]; for (const v of f.v) for (const g of t.vf[v]) if (!seen.has(g)) { seen.add(g); q.push(g); } }
    return Array.from(seen);
  }

  /* ----------------------------- hapus / lebur ----------------------------- */
  function deleteFaces(pm, faces) {
    const kill = new Set(faces); pm.F = pm.F.filter((_, i) => !kill.has(i)); compact(pm); return { v: [], f: [] };
  }
  function deleteVerts(pm, verts) {
    const kill = new Set(verts); pm.F = pm.F.filter((f) => !f.v.some((x) => kill.has(x))); compact(pm); return { v: [], f: [] };
  }
  function deleteEdges(pm, edgeKeys) {
    const kill = new Set(edgeKeys); pm.F = pm.F.filter((f) => { for (let k = 0; k < f.v.length; k++) if (kill.has(ek(f.v[k], f.v[(k + 1) % f.v.length]))) return false; return true; }); compact(pm); return { v: [], f: [] };
  }
  // melebur tepi: dua muka di kedua sisinya digabung
  function dissolveEdges(pm, edgeKeys) {
    let merged = 0;
    for (const key of edgeKeys) {
      const a = ekA(key), b = ekB(key);
      const i1 = pm.F.findIndex((f) => hasEdge(f, a, b)), i2 = pm.F.findIndex((f) => hasEdge(f, b, a));
      if (i1 < 0 || i2 < 0 || i1 === i2) continue;
      const f1 = rotateTo(pm.F[i1].v, b), f2 = rotateTo(pm.F[i2].v, a); // f1: b … a ; f2: a … b
      const merged1 = f1.concat(f2.slice(1, -1));
      pm.F[i1] = { v: merged1, c: pm.F[i1].c }; pm.F.splice(i2, 1); merged++;
    }
    tidyFaces(pm);
    // buang titik valensi-2 yang tersisa di tepi lurus
    removeValence2(pm);
    compact(pm);
    return { v: [], f: [], merged };
  }
  function removeValence2(pm) {
    const t = topology(pm), kill = new Set();
    for (let v = 0; v < pm.V.length; v++) {
      if (t.vf[v].length !== 2) continue;
      const ed = new Set(); for (const fi of t.vf[v]) { const f = pm.F[fi], i = f.v.indexOf(v), n = f.v.length; ed.add(f.v[(i + 1) % n]); ed.add(f.v[(i + n - 1) % n]); }
      if (ed.size !== 2) continue;
      const [p, q] = Array.from(ed), d1 = norm(sub(pm.V[v], pm.V[p])), d2 = norm(sub(pm.V[q], pm.V[v]));
      if (dot(d1, d2) > 0.9999) kill.add(v);
    }
    if (!kill.size) return;
    for (const f of pm.F) if (f.v.length > 3) f.v = f.v.filter((x) => !kill.has(x));
  }
  // melebur titik: semua muka di sekitar titik digabung menjadi satu (titik di cincin tertutup)
  function dissolveVerts(pm, verts) {
    let n = 0;
    for (const v of verts) {
      const ids = []; pm.F.forEach((f, i) => { if (f.v.includes(v)) ids.push(i); });
      if (ids.length < 2) continue;
      // rangkai jalur tiap muka (tanpa v) berurutan
      const path = new Map(); // p (sebelum v) → jalur n … p
      const byP = new Map();
      for (const i of ids) { const f = pm.F[i], r = rotateTo(f.v, v); path.set(i, r.slice(1)); byP.set(r[r.length - 1], i); }
      let cur = ids[0], poly = [], guard = 0; const seen = new Set();
      while (!seen.has(cur) && guard++ < 1000) {
        seen.add(cur); const pth = path.get(cur);
        poly = poly.concat(poly.length && poly[poly.length - 1] === pth[0] ? pth.slice(1) : pth);
        // muka berikutnya = yang jalurnya diawali titik p muka ini (n_y = p_x)
        const p = pth[pth.length - 1];
        const nxt = ids.find((j) => path.get(j)[0] === p && !seen.has(j));
        if (nxt == null) break; cur = nxt;
      }
      if (seen.size !== ids.length) continue; // cincin tidak tertutup: lewati
      if (poly.length > 1 && poly[0] === poly[poly.length - 1]) poly.pop();
      const color = pm.F[ids[0]].c; const kill = new Set(ids);
      pm.F = pm.F.filter((_, i) => !kill.has(i)); pm.F.push({ v: poly, c: color }); n++;
    }
    tidyFaces(pm); compact(pm);
    return { v: [], f: [], merged: n };
  }

  /* ----------------------------- gabung titik ----------------------------- */
  function applyMap(pm, map) { for (const f of pm.F) f.v = f.v.map((i) => map[i]); tidyFaces(pm); }
  function mergeVerts(pm, verts, mode) {
    const list = Array.from(new Set(verts)); if (list.length < 2) return { v: list, f: [] };
    let target;
    if (mode === 'first') target = pm.V[list[0]].slice();
    else if (mode === 'last') target = pm.V[list[list.length - 1]].slice();
    else { target = [0, 0, 0]; for (const i of list) target = add(target, pm.V[i]); target = mul(target, 1 / list.length); }
    const keep = list[0], map = Array.from({ length: pm.V.length }, (_, i) => i);
    for (const i of list) map[i] = keep;
    pm.V[keep] = target; applyMap(pm, map);
    const m2 = compact(pm);
    return { v: m2[keep] >= 0 ? [m2[keep]] : [], f: [] };
  }
  function weldByDistance(pm, dist, verts) {
    const cand = verts ? Array.from(new Set(verts)) : pm.V.map((_, i) => i), cell = Math.max(dist, 1e-9), grid = new Map();
    const key = (p) => Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell) + ',' + Math.floor(p[2] / cell);
    const map = Array.from({ length: pm.V.length }, (_, i) => i); let merged = 0;
    for (const i of cand) {
      const p = pm.V[i], cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell); let hit = -1;
      for (let dx = -1; dx <= 1 && hit < 0; dx++) for (let dy = -1; dy <= 1 && hit < 0; dy++) for (let dz = -1; dz <= 1 && hit < 0; dz++) {
        const l = grid.get((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz)); if (!l) continue;
        for (const j of l) if (len(sub(pm.V[j], p)) <= dist) { hit = j; break; }
      }
      if (hit >= 0) { map[i] = hit; merged++; } else { const k = key(p); const l = grid.get(k); if (l) l.push(i); else grid.set(k, [i]); }
    }
    applyMap(pm, map); compact(pm);
    return { v: [], f: [], merged };
  }

  /* ----------------------------- extrude ----------------------------- */
  function vertexNormals(pm, faces) {
    const acc = new Map();
    for (const fi of faces) { const f = pm.F[fi], n = faceNormal(pm, f); for (const v of f.v) acc.set(v, add(acc.get(v) || [0, 0, 0], n)); }
    const out = new Map(); for (const [v, n] of acc) out.set(v, norm(n)); return out;
  }
  // komponen muka yang terhubung lewat tepi (bukan hanya titik) — dipakai agar wilayah yang hanya bersentuhan di titik diperlakukan terpisah
  function edgeComponents(pm, faces) {
    const set = new Set(faces), by = new Map(), seen = new Set(), comps = [];
    for (const fi of faces) { const f = pm.F[fi]; for (let i = 0; i < f.v.length; i++) { const k = ek(f.v[i], f.v[(i + 1) % f.v.length]); const l = by.get(k); if (l) l.push(fi); else by.set(k, [fi]); } }
    for (const s0 of faces) {
      if (seen.has(s0)) continue; const comp = [], st = [s0]; seen.add(s0);
      while (st.length) { const fi = st.pop(); comp.push(fi); const f = pm.F[fi]; for (let i = 0; i < f.v.length; i++) for (const g of by.get(ek(f.v[i], f.v[(i + 1) % f.v.length])) || []) if (!seen.has(g) && set.has(g)) { seen.add(g); st.push(g); } }
      comps.push(comp);
    }
    return comps;
  }
  function extrudeFaces(pm, faces, dist) {
    const comps = edgeComponents(pm, faces);
    if (comps.length > 1) { const out = { v: [], f: [] }; for (const c of comps) { const r = extrudeRegion(pm, c, dist); out.v.push(...r.v); out.f.push(...r.f); } return out; }
    return extrudeRegion(pm, faces, dist);
  }
  function extrudeRegion(pm, faces, dist) {
    const set = new Set(faces); if (!set.size) return { v: [], f: [] };
    const cnt = new Map();
    for (const fi of faces) { const f = pm.F[fi]; for (let i = 0; i < f.v.length; i++) { const k = ek(f.v[i], f.v[(i + 1) % f.v.length]); cnt.set(k, (cnt.get(k) || 0) + 1); } }
    const nrm = vertexNormals(pm, faces), map = new Map(), newV = [];
    for (const fi of faces) for (const v of pm.F[fi].v) if (!map.has(v)) { const nv = pm.V.length; pm.V.push(add(pm.V[v], mul(nrm.get(v) || [0, 0, 0], dist || 0))); map.set(v, nv); newV.push(nv); }
    const sides = [];
    for (const fi of faces) {
      const f = pm.F[fi], n = f.v.length;
      for (let i = 0; i < n; i++) {
        const a = f.v[i], b = f.v[(i + 1) % n];
        if (cnt.get(ek(a, b)) === 1) sides.push({ v: [a, b, map.get(b), map.get(a)], c: f.c });
      }
    }
    for (const fi of faces) pm.F[fi].v = pm.F[fi].v.map((v) => map.get(v));
    const first = pm.F.length; for (const s of sides) pm.F.push(s);
    return { v: newV, f: faces.slice() };
  }
  function extrudeEdges(pm, edgeKeys, dist) {
    const t = topology(pm), map = new Map(), newV = [], keys = [];
    const normals = new Map();
    for (const k of edgeKeys) { const e = t.edges.get(k); if (!e) continue; for (const fi of e.faces) { const n = faceNormal(pm, pm.F[fi]); for (const v of [e.a, e.b]) normals.set(v, add(normals.get(v) || [0, 0, 0], n)); } }
    for (const k of edgeKeys) {
      const e = t.edges.get(k); if (!e) continue;
      for (const v of [e.a, e.b]) if (!map.has(v)) { const nv = pm.V.length; pm.V.push(add(pm.V[v], mul(norm(normals.get(v) || [0, 0, 0]), dist || 0))); map.set(v, nv); newV.push(nv); }
    }
    const newFaces = [];
    for (const k of edgeKeys) {
      const e = t.edges.get(k); if (!e) continue;
      let a = e.a, b = e.b, c = 0;
      if (e.faces.length) { const f = pm.F[e.faces[0]]; c = f.c; if (hasEdge(f, a, b)) { /* muka memakai a→b; sisi baru harus memakai b→a di tepi lama… */ const tmp = a; a = b; b = tmp; } }
      pm.F.push({ v: [a, b, map.get(b), map.get(a)], c }); newFaces.push(pm.F.length - 1);
    }
    return { v: newV, f: [], edges: edgeKeys.map((k) => { const e = t.edges.get(k); return e ? ek(map.get(e.a), map.get(e.b)) : null; }).filter((x) => x != null) };
  }

  /* ----------------------------- inset ----------------------------- */
  const insetOffset = (pm, f, i, amount) => {
    const n = f.v.length, N = faceNormal(pm, f);
    const p = pm.V[f.v[(i + n - 1) % n]], v = pm.V[f.v[i]], q = pm.V[f.v[(i + 1) % n]];
    const in1 = norm(cross(N, sub(v, p))), in2 = norm(cross(N, sub(q, v)));
    const den = Math.max(0.25, 1 + dot(in1, in2));
    return mul(add(in1, in2), amount / den);
  };
  function insetFaces(pm, faces, amount, individual) {
    const out = { v: [], f: [] };
    if (!faces.length) return out;
    if (individual || faces.length === 1) {
      for (const fi of faces) {
        const f = pm.F[fi], n = f.v.length, nv = [];
        for (let i = 0; i < n; i++) { const idx = pm.V.length; pm.V.push(add(pm.V[f.v[i]], insetOffset(pm, f, i, amount))); nv.push(idx); out.v.push(idx); }
        const old = f.v.slice(); f.v = nv; out.f.push(fi);
        for (let i = 0; i < n; i++) pm.F.push({ v: [old[i], old[(i + 1) % n], nv[(i + 1) % n], nv[i]], c: f.c });
      }
      return out;
    }
    const comps = edgeComponents(pm, faces);
    if (comps.length > 1) { for (const c of comps) { const r = insetFaces(pm, c, amount, false); out.v.push(...r.v); out.f.push(...r.f); } return out; }
    // wilayah: hanya titik di batas wilayah yang bergeser ke dalam
    const set = new Set(faces), cnt = new Map();
    for (const fi of faces) { const f = pm.F[fi]; for (let i = 0; i < f.v.length; i++) { const k = ek(f.v[i], f.v[(i + 1) % f.v.length]); cnt.set(k, (cnt.get(k) || 0) + 1); } }
    const inOf = new Map(); // titik batas → daftar vektor "ke dalam" dari tepi batas yang menyentuhnya
    const bEdges = [];
    for (const fi of faces) {
      const f = pm.F[fi], n = f.v.length, N = faceNormal(pm, f);
      for (let i = 0; i < n; i++) {
        const a = f.v[i], b = f.v[(i + 1) % n];
        if (cnt.get(ek(a, b)) !== 1) continue;
        const inn = norm(cross(N, sub(pm.V[b], pm.V[a]))); bEdges.push({ a, b, c: f.c });
        for (const v of [a, b]) { const l = inOf.get(v) || []; l.push(inn); inOf.set(v, l); }
      }
    }
    const map = new Map();
    for (const [v, l] of inOf) {
      let off;
      if (l.length === 2) off = mul(add(l[0], l[1]), amount / Math.max(0.25, 1 + dot(l[0], l[1])));
      else { let s = [0, 0, 0]; for (const x of l) s = add(s, x); off = mul(norm(s), amount); }
      const idx = pm.V.length; pm.V.push(add(pm.V[v], off)); map.set(v, idx); out.v.push(idx);
    }
    for (const fi of faces) pm.F[fi].v = pm.F[fi].v.map((v) => (map.has(v) ? map.get(v) : v));
    for (const e of bEdges) pm.F.push({ v: [e.a, e.b, map.get(e.b), map.get(e.a)], c: e.c });
    out.f = faces.slice(); return out;
  }

  /* ----------------------------- bevel ----------------------------- */
  function bevelEdges(pm, edgeKeys, width) {
    const t = topology(pm), res = { v: [], f: [], skipped: 0 };
    const selE = new Set(edgeKeys.filter((k) => { const e = t.edges.get(k); return e && e.faces.length === 2 && e.faces[0] !== e.faces[1]; }));
    res.skipped = edgeKeys.length - selE.size;
    if (!selE.size) return res;
    // lebar dibatasi supaya tidak menembus tepi terpendek
    let minLen = Infinity; for (const k of selE) { const e = t.edges.get(k); minLen = Math.min(minLen, len(sub(pm.V[e.a], pm.V[e.b]))); }
    const w = Math.min(width, minLen * 0.45);
    const atV = new Map(); for (const k of selE) { const e = t.edges.get(k); for (const v of [e.a, e.b]) { const l = atV.get(v) || []; l.push(k); atV.set(v, l); } }
    const replace = new Map(), ins = new Map(); // `${face}:${v}` → titik baru / daftar sisipan
    const corner = new Map(); // `${v}:${face}` → titik baru yang dipakai muka itu
    const cornerPolys = [], extraTris = [];
    for (const [v, ks] of atV) {
      // cincin muka mengelilingi v
      const ids = t.vf[v], info = new Map();
      for (const fi of ids) { const f = pm.F[fi], i = f.v.indexOf(v), n = f.v.length; info.set(fi, { p: f.v[(i + n - 1) % n], n: f.v[(i + 1) % n] }); }
      const ring = [ids[0]]; let ok = true;
      for (let g = 0; g < ids.length; g++) {
        const cur = ring[ring.length - 1], nxt = ids.find((j) => info.get(j).p === info.get(cur).n);
        if (nxt == null) { ok = false; break; }
        if (nxt === ring[0]) break; ring.push(nxt);
      }
      if (!ok || ring.length !== ids.length) { res.skipped++; continue; } // titik di tepi terbuka / non-manifold
      const K = ring.length, selIdx = [];
      for (let i = 0; i < K; i++) if (selE.has(ek(v, info.get(ring[i]).n))) selIdx.push(i);
      const m = selIdx.length;
      const ref = norm(ring.reduce((s, fi) => add(s, faceNormal(pm, pm.F[fi])), [0, 0, 0]));
      const uDir = (x) => norm(sub(pm.V[x], pm.V[v]));
      // arah di dalam muka, tegak lurus tepi `u`, menuju isi muka
      const inwDir = (fi, u) => { const f = pm.F[fi]; let d = norm(cross(faceNormal(pm, f), u)); if (dot(d, sub(faceCenter(pm, f), pm.V[v])) < 0) d = mul(d, -1); return d; };
      if (m === 1) {
        const s = selIdx[0], fA = ring[s], fB = ring[(s + 1) % K];
        const uSel = uDir(info.get(fA).n);
        const pA = pm.V.length; pm.V.push(add(pm.V[v], mul(inwDir(fA, uSel), w)));
        const pB = pm.V.length; pm.V.push(add(pm.V[v], mul(inwDir(fB, uSel), w)));
        corner.set(v + ':' + fA, pA); corner.set(v + ':' + fB, pB);
        replace.set(fA + ':' + v, [pA]); replace.set(fB + ':' + v, [pB]);
        const fan = K - 2;
        if (fan === 1) { replace.set(ring[(s + 2) % K] + ':' + v, [pB, pA]); }
        else if (fan >= 2) {
          ins.set(ring[(s + 2) % K] + ':' + v, [pB, v]);   // …n_B → pB → v
          ins.set(ring[(s + K - 1) % K] + ':' + v, [v, pA]); // v → pA → p_A…
          extraTris.push({ v: [pA, v, pB], c: pm.F[fA].c });
        }
        res.v.push(pA, pB);
      } else {
        const sv = [];
        for (let j = 0; j < m; j++) {
          const sL = selIdx[j], sR = selIdx[(j + 1) % m];
          const uL = uDir(info.get(ring[sL]).n), uR = uDir(info.get(ring[sR]).n);
          const faces = []; for (let q = (sL + 1) % K, g = 0; g < K; g = g + 1) { faces.push(ring[q]); if (q === sR) break; q = (q + 1) % K; }
          let p;
          // titik berjarak w dari tepi kiri (di muka pertama sektor) dan dari tepi kanan (di muka terakhir)
          const iL = inwDir(faces[0], uL), iR = inwDir(faces[faces.length - 1], uR), dn = 1 + dot(iL, iR);
          if (dn > 0.15) p = add(pm.V[v], mul(add(iL, iR), w / dn));
          else p = add(pm.V[v], mul(norm(add(iL, iR)).every((x) => x === 0) ? iL : norm(add(iL, iR)), w));
          const idx = pm.V.length; pm.V.push(p); sv.push(idx);
          for (const fi of faces) { replace.set(fi + ':' + v, [idx]); corner.set(v + ':' + fi, idx); }
        }
        if (m >= 3) cornerPolys.push({ vtx: v, c: pm.F[ring[0]].c });
        res.v.push(...sv);
      }
    }
    const before = pm.F.map((f) => ({ v: f.v.slice(), c: f.c }));
    // terapkan penggantian titik pada muka
    pm.F.forEach((f, fi) => {
      let touched = false; const out = [];
      for (const v of f.v) {
        const key = fi + ':' + v;
        if (replace.has(key)) { out.push(...replace.get(key)); touched = true; }
        else if (ins.has(key)) { out.push(...ins.get(key)); touched = true; }
        else out.push(v);
      }
      if (touched) f.v = out;
    });
    // jika `ins` berisi [pB, v] untuk muka g1 maka urutan harus n_B → pB → v: titik n_B sudah ada sebelum v di muka; sisipan di posisi v
    // orientasi ditentukan secara topologis: tepi bersama selalu dilalui berlawanan arah oleh dua muka bertetangga
    const newF = [], endPair = new Map(); // `${key}:${v}` → [x,y] arah tepi ujung yang dipakai poligon sudut
    for (const k of selE) {
      const e = t.edges.get(k), a = e.a, b = e.b;
      const Fp = e.faces.find((fi) => hasEdge(before[fi], a, b)), Fq = e.faces.find((fi) => fi !== Fp);
      const cA = (f) => corner.get(a + ':' + f), cB = (f) => corner.get(b + ':' + f);
      if (Fp == null || [cA(Fp), cB(Fp), cA(Fq), cB(Fq)].some((x) => x == null)) { res.skipped++; continue; }
      pm.F.push({ v: [cB(Fp), cA(Fp), cA(Fq), cB(Fq)], c: before[Fp].c }); newF.push(pm.F.length - 1);
      endPair.set(k + ':' + a, [cA(Fq), cA(Fp)]); endPair.set(k + ':' + b, [cB(Fp), cB(Fq)]);
    }
    for (const cp of cornerPolys) {
      const pairs = []; for (const k of atV.get(cp.vtx)) { const p = endPair.get(k + ':' + cp.vtx); if (p) pairs.push(p); }
      if (pairs.length < 3) continue;
      const poly = [pairs[0][0], pairs[0][1]]; let guard = 0;
      while (poly.length <= pairs.length && guard++ < 100) { const nx = pairs.find((p) => p[0] === poly[poly.length - 1]); if (!nx || nx[1] === poly[0]) break; poly.push(nx[1]); }
      if (poly.length === pairs.length) { pm.F.push({ v: poly, c: cp.c }); newF.push(pm.F.length - 1); }
    }
    for (const tr of extraTris) { pm.F.push({ v: tr.v, c: tr.c }); newF.push(pm.F.length - 1); }
    tidyFaces(pm);
    res.f = []; // indeks muka berubah setelah tidy; seleksi diatur UI dari titik baru
    return res;
  }

  /* ----------------------------- subdivide & loop cut ----------------------------- */
  // sisipkan `cuts` titik pada tiap tepi; kembalikan Map(kunciTepi → [titik dari a(min) ke b(max)])
  function splitEdges(pm, edgeKeys, cuts) {
    const mp = new Map();
    for (const k of edgeKeys) {
      const a = ekA(k), b = ekB(k), l = [];
      for (let i = 1; i <= cuts; i++) { l.push(pm.V.length); pm.V.push(lerp(pm.V[a], pm.V[b], i / (cuts + 1))); }
      mp.set(k, l);
    }
    for (const f of pm.F) {
      const out = [], n = f.v.length; let touched = false;
      for (let i = 0; i < n; i++) {
        const a = f.v[i], b = f.v[(i + 1) % n], k = ek(a, b); out.push(a);
        const l = mp.get(k);
        if (l) { touched = true; if (a < b) out.push(...l); else out.push(...l.slice().reverse()); }
      }
      if (touched) f.v = out;
    }
    return mp;
  }
  function subdivideEdges(pm, edgeKeys, cuts) {
    const mp = splitEdges(pm, edgeKeys, Math.max(1, cuts || 1)), vs = []; for (const l of mp.values()) vs.push(...l);
    return { v: vs, f: [] };
  }
  function subdivideFaces(pm, faces, cuts) {
    cuts = Math.max(1, Math.min(6, cuts || 1));
    const sel = new Set(faces), edges = edgesOfFaces(pm, faces);
    const orig = faces.map((fi) => pm.F[fi].v.slice());
    const mp = splitEdges(pm, Array.from(edges), cuts);
    const newF = [], keep = new Set(faces), outFaces = [];
    const colors = faces.map((fi) => pm.F[fi].c);
    faces.forEach((fi, idx) => {
      const o = orig[idx], n = o.length, c = colors[idx];
      const edgePts = (i) => { const a = o[i], b = o[(i + 1) % n], l = mp.get(ek(a, b)); return a < b ? l : l.slice().reverse(); }; // dari o[i] ke o[i+1]
      if (n === 4) {
        // kisi (cuts+1)×(cuts+1) bilinear; sisi i: o[i]→o[i+1]
        const e0 = [o[0], ...edgePts(0), o[1]], e1 = [o[1], ...edgePts(1), o[2]], e2 = [o[2], ...edgePts(2), o[3]], e3 = [o[3], ...edgePts(3), o[0]];
        const N = cuts + 2, grid = [];
        for (let j = 0; j < N; j++) {
          grid.push([]);
          for (let i = 0; i < N; i++) {
            if (j === 0) { grid[j].push(e0[i]); continue; }
            if (j === N - 1) { grid[j].push(e2[N - 1 - i]); continue; }
            if (i === 0) { grid[j].push(e3[N - 1 - j]); continue; }
            if (i === N - 1) { grid[j].push(e1[j]); continue; }
            const u = i / (N - 1), v = j / (N - 1);
            const P = add(add(mul(pm.V[o[0]], (1 - u) * (1 - v)), mul(pm.V[o[1]], u * (1 - v))), add(mul(pm.V[o[2]], u * v), mul(pm.V[o[3]], (1 - u) * v)));
            grid[j].push(pm.V.length); pm.V.push(P);
          }
        }
        let first = true;
        for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
          const q = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
          if (first) { pm.F[fi] = { v: q, c }; first = false; outFaces.push(fi); } else { pm.F.push({ v: q, c }); outFaces.push(pm.F.length - 1); }
        }
      } else {
        // n-gon / segitiga: titik tengah + n segi empat (hanya satu tingkat)
        const mids = o.map((_, i) => edgePts(i)[0]);
        const ctr = pm.V.length; pm.V.push(faceCenter(pm, { v: o }));
        let first = true;
        for (let i = 0; i < n; i++) {
          const q = [mids[(i + n - 1) % n], o[i], mids[i], ctr];
          if (first) { pm.F[fi] = { v: q, c }; first = false; outFaces.push(fi); } else { pm.F.push({ v: q, c }); outFaces.push(pm.F.length - 1); }
        }
      }
    });
    void sel; void keep; void newF;
    return { v: [], f: outFaces };
  }
  // Catmull-Clark untuk seluruh mesh
  function catmullClark(pm, levels) {
    for (let L = 0; L < Math.max(1, levels || 1); L++) {
      const t = topology(pm), nF = pm.F.length;
      const FP = pm.F.map((f) => faceCenter(pm, f));
      const EP = new Map(), EI = new Map();
      for (const [k, e] of t.edges) {
        const mid = lerp(pm.V[e.a], pm.V[e.b], 0.5);
        EP.set(k, e.faces.length === 2 ? mul(add(add(pm.V[e.a], pm.V[e.b]), add(FP[e.faces[0]], FP[e.faces[1]])), 0.25) : mid);
      }
      const NV = [];
      for (let v = 0; v < pm.V.length; v++) {
        const P = pm.V[v], fs = t.vf[v]; if (!fs.length) { NV.push(P); continue; }
        const nb = new Map(); // tetangga → tepi
        for (const fi of fs) { const f = pm.F[fi], i = f.v.indexOf(v), n = f.v.length; for (const x of [f.v[(i + 1) % n], f.v[(i + n - 1) % n]]) nb.set(x, ek(v, x)); }
        const bnd = []; for (const [x, k] of nb) if (t.edges.get(k).faces.length === 1) bnd.push(x);
        if (bnd.length >= 2) NV.push(add(mul(P, 0.75), mul(add(pm.V[bnd[0]], pm.V[bnd[1]]), 0.125)));
        else {
          const n = fs.length; let Fa = [0, 0, 0], R = [0, 0, 0];
          for (const fi of fs) Fa = add(Fa, FP[fi]); Fa = mul(Fa, 1 / n);
          for (const x of nb.keys()) R = add(R, lerp(P, pm.V[x], 0.5)); R = mul(R, 1 / nb.size);
          NV.push(mul(add(add(Fa, mul(R, 2)), mul(P, n - 3)), 1 / n));
        }
      }
      const V = NV.slice(), eIdx = new Map(), fIdx = [];
      for (const [k, p] of EP) { eIdx.set(k, V.length); V.push(p); }
      for (let i = 0; i < nF; i++) { fIdx.push(V.length); V.push(FP[i]); }
      const F = [];
      pm.F.forEach((f, fi) => {
        const n = f.v.length;
        for (let i = 0; i < n; i++) {
          const prev = f.v[(i + n - 1) % n], cur = f.v[i], nxt = f.v[(i + 1) % n];
          F.push({ v: [cur, eIdx.get(ek(cur, nxt)), fIdx[fi], eIdx.get(ek(prev, cur))], c: f.c });
        }
      });
      pm.V = V; pm.F = F;
    }
    return { v: [], f: [] };
  }
  // Loop cut: potong sepanjang cincin tepi pada deretan segi empat
  function loopCut(pm, edgeKey, cuts, slide) {
    cuts = Math.max(1, Math.min(32, Math.round(cuts || 1)));
    const t = topology(pm), ring = edgeRing(pm, edgeKey, t);
    if (!ring.edges.length) return { v: [], f: [], ok: false };
    const ringE = new Set(ring.edges), ringF = new Set(ring.faces);
    // arah acuan: tiap tepi cincin punya titik "a→b" sejajar dengan tepi awal
    const dirOf = new Map(); // key → [dari, ke]
    const start = t.edges.get(edgeKey); dirOf.set(edgeKey, [start.a, start.b]);
    // propagasi arah lewat muka segi empat: tepi berlawanan berarah searah sisi-sisi sejajar
    const queue = [edgeKey];
    while (queue.length) {
      const k = queue.pop(), e = t.edges.get(k), [from, to] = dirOf.get(k);
      for (const fi of e.faces) {
        if (!ringF.has(fi)) continue;
        const f = pm.F[fi], n = 4; let idx = -1; for (let i = 0; i < n; i++) if (ek(f.v[i], f.v[(i + 1) % n]) === k) idx = i;
        const a = f.v[idx], b = f.v[(idx + 1) % n], c = f.v[(idx + 2) % n], d = f.v[(idx + 3) % n];
        // tepi berlawanan: c–d. titik d bersisian dengan a, c dengan b
        const ok = ek(c, d), pair = from === a ? [d, c] : [c, d];
        if (!dirOf.has(ok) && ringE.has(ok)) { dirOf.set(ok, pair); queue.push(ok); }
      }
    }
    const frac = (i) => { const base = i / (cuts + 1); return Math.max(0.02, Math.min(0.98, base + (slide || 0) * (1 / (cuts + 1)))); };
    const pts = new Map(); // key → titik berurutan dari dirOf.from ke dirOf.to
    for (const k of ring.edges) {
      const [from, to] = dirOf.get(k) || [ekA(k), ekB(k)], l = [];
      for (let i = 1; i <= cuts; i++) { l.push(pm.V.length); pm.V.push(lerp(pm.V[from], pm.V[to], frac(i))); }
      pts.set(k, { from, to, l });
    }
    const along = (k, a, b) => { const p = pts.get(k); return p.from === a ? p.l.slice() : p.l.slice().reverse(); }; // titik dari a ke b
    return loopCutProper(pm, edgeKey, cuts, slide, ring, dirOf, pts, along, t);
  }
  function loopCutProper(pm0, edgeKey, cuts, slide, ring, dirOf, pts, along) {
    // pm0 belum diubah oleh blok di atas (outF tidak ditulis balik); bangun ulang muka
    const pm = pm0, ringF = new Set(ring.faces), ringE = new Set(ring.edges), out = [], outIdx = [];
    pm.F.forEach((f, fi) => {
      if (ringF.has(fi)) {
        const n = 4, rk = []; for (let i = 0; i < n; i++) { const k = ek(f.v[i], f.v[(i + 1) % n]); if (ringE.has(k)) rk.push(i); }
        const i0 = rk.find((i) => rk.includes((i + 2) % 4));
        const a = f.v[i0], b = f.v[(i0 + 1) % 4], c = f.v[(i0 + 2) % 4], d = f.v[(i0 + 3) % 4];
        // tepi cincin: a–b (titik s1) dan c–d (titik s2). Sisi lain: b–c dan d–a tidak dipotong.
        const s1 = along(ek(a, b), a, b), s2 = along(ek(c, d), d, c); // s1: a→b ; s2: d→c (sejajar)
        const T = [a, ...s1, b], B = [d, ...s2, c];
        // potongan antara tepi (a,d) → ... → (b,c): segi empat [T[i], T[i+1], B[i+1], B[i]] — T dan B sejajar searah a→b
        for (let i = 0; i < T.length - 1; i++) { out.push({ v: [T[i], T[i + 1], B[i + 1], B[i]], c: f.c }); }
      } else {
        // muka luar yang memuat tepi cincin (cincin berhenti di n-gon / segitiga): sisipkan titik pada tepi itu
        const nn = f.v.length, o = []; let touched = false;
        for (let i = 0; i < nn; i++) {
          const a = f.v[i], b = f.v[(i + 1) % nn], k = ek(a, b); o.push(a);
          if (ringE.has(k)) { touched = true; o.push(...along(k, a, b)); }
        }
        out.push(touched ? { v: o, c: f.c } : f);
      }
    });
    void outIdx;
    pm.F = out;
    return { v: Array.from(pts.values()).flatMap((p) => p.l), f: [], ok: true };
  }

  /* ----------------------------- isi / cermin / normal ----------------------------- */
  // Isi muka dari titik terpilih (urutan mengikuti lintasan tepi bila ada, jika tidak diurutkan sudut)
  function fillVerts(pm, verts, edgeKeys) {
    let list = Array.from(new Set(verts)); if (list.length < 3) return { v: list, f: [], ok: false };
    const vs = new Set(list);
    let order = null;
    if (edgeKeys && edgeKeys.length) {
      const adj = new Map(); for (const k of edgeKeys) { const a = ekA(k), b = ekB(k); if (!vs.has(a) || !vs.has(b)) continue; (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
      if (adj.size === list.length && Array.from(adj.values()).every((l) => l.length === 2)) {
        const o = [list[0]]; let prev = -1, cur = list[0];
        for (let g = 0; g < list.length; g++) { const nx = adj.get(cur).find((x) => x !== prev && (o.length < 2 || x !== o[o.length - 2])) ; if (nx == null || nx === o[0]) break; o.push(nx); prev = cur; cur = nx; }
        if (o.length === list.length) order = o;
      }
    }
    let c = [0, 0, 0]; for (const i of list) c = add(c, pm.V[i]); c = mul(c, 1 / list.length);
    if (!order) {
      // bidang terbaik: normal dari titik-titik
      let N = [0, 0, 0]; for (let i = 0; i < list.length; i++) { const a = sub(pm.V[list[i]], c), b = sub(pm.V[list[(i + 1) % list.length]], c); N = add(N, cross(a, b)); }
      if (len(N) < 1e-12) { const a = sub(pm.V[list[0]], c), b = sub(pm.V[list[1]], c); N = cross(a, b); }
      N = norm(N); const ux = norm(sub(pm.V[list[0]], c)), uy = cross(N, ux);
      order = list.slice().sort((p, q) => Math.atan2(dot(sub(pm.V[p], c), uy), dot(sub(pm.V[p], c), ux)) - Math.atan2(dot(sub(pm.V[q], c), uy), dot(sub(pm.V[q], c), ux)));
    }
    // arah: berlawanan dengan muka tetangga bila ada, jika tidak menjauhi pusat mesh
    const t = topology(pm); let flip = null;
    for (let i = 0; i < order.length && flip == null; i++) {
      const a = order[i], b = order[(i + 1) % order.length], e = t.edges.get(ek(a, b));
      if (e && e.faces.length === 1) flip = hasEdge(pm.F[e.faces[0]], a, b); // muka sudah memakai a→b → kita pakai b→a
    }
    let poly = order.slice();
    const N2 = faceNormalRaw({ V: pm.V }, { v: poly });
    if (flip == null) { let mc = [0, 0, 0]; for (const p of pm.V) mc = add(mc, p); mc = mul(mc, 1 / Math.max(1, pm.V.length)); flip = dot(N2, sub(c, mc)) < 0; }
    if (flip) poly.reverse();
    const col = (() => { for (const k of (edgeKeys || [])) { const e = t.edges.get(k); if (e && e.faces.length) return pm.F[e.faces[0]].c; } return 0; })();
    pm.F.push({ v: poly, c: col });
    return { v: list, f: [pm.F.length - 1], ok: true };
  }
  function flipFaces(pm, faces) { for (const fi of faces) pm.F[fi].v.reverse(); return { v: [], f: faces.slice() }; }
  // Orientasi konsisten (aliran dari muka pertama), lalu keluar bila volume negatif
  function recalcNormals(pm) {
    const t = topology(pm), seen = new Uint8Array(pm.F.length);
    for (let s = 0; s < pm.F.length; s++) {
      if (seen[s]) continue; seen[s] = 1; const stack = [s], comp = [s];
      while (stack.length) {
        const fi = stack.pop(), f = pm.F[fi], n = f.v.length;
        for (let i = 0; i < n; i++) {
          const a = f.v[i], b = f.v[(i + 1) % n], e = t.edges.get(ek(a, b));
          for (const gj of e.faces) {
            if (gj === fi || seen[gj]) continue;
            const g = pm.F[gj]; if (!hasEdge(g, b, a)) g.v.reverse(); // tetangga harus memakai b→a
            seen[gj] = 1; stack.push(gj); comp.push(gj);
          }
        }
      }
      let vol = 0; for (const fi of comp) for (const tr of triangulateFace(pm, pm.F[fi])) { const A = pm.V[tr[0]], B = pm.V[tr[1]], C = pm.V[tr[2]]; vol += dot(A, cross(B, C)) / 6; }
      if (vol < 0) for (const fi of comp) pm.F[fi].v.reverse();
    }
    return { v: [], f: [] };
  }
  function volume(pm) { let vol = 0; for (const f of pm.F) for (const tr of triangulateFace(pm, f)) { const A = pm.V[tr[0]], B = pm.V[tr[1]], C = pm.V[tr[2]]; vol += dot(A, cross(B, C)) / 6; } return vol; }

  // Bisect: potong muka yang melintasi bidang axis=0 (sisi positif/negatif); muka dengan >2 titik potong dipilih menurut pusat
  function bisect(pm, axis) {
    const side = (i) => pm.V[i][axis], cache = new Map();
    const cut = (a, b) => { const k = ek(a, b); if (cache.has(k)) return cache.get(k); const A = pm.V[a], B = pm.V[b], t = (0 - A[axis]) / (B[axis] - A[axis]); const p = lerp(A, B, t); p[axis] = 0; const i = pm.V.length; pm.V.push(p); cache.set(k, i); return i; };
    const out = [], eps = 1e-9;
    for (const f of pm.F) {
      const n = f.v.length, s = f.v.map(side);
      const pos = s.some((x) => x > eps), neg = s.some((x) => x < -eps);
      if (!(pos && neg)) { out.push(f); continue; }
      const A = [], B = []; let crossings = 0;
      for (let i = 0; i < n; i++) {
        const a = f.v[i], b = f.v[(i + 1) % n], sa = s[i], sb = s[(i + 1) % n];
        const ina = sa >= -eps ? 1 : 0, inb = sb >= -eps ? 1 : 0;
        if (sa > eps) A.push(a); else if (sa < -eps) B.push(a); else { A.push(a); B.push(a); }
        if ((sa > eps && sb < -eps) || (sa < -eps && sb > eps)) { const m = cut(a, b); A.push(m); B.push(m); crossings++; }
        void ina; void inb;
      }
      if (crossings > 2) { // bentuk rumit: tetap utuh, pilih menurut pusat
        out.push(f); continue;
      }
      if (A.length >= 3) out.push({ v: A, c: f.c });
      if (B.length >= 3) out.push({ v: B, c: f.c });
    }
    pm.F = out;
  }
  // Cermin: simpan sisi `keep` (+1/-1) sumbu `axis`, lalu duplikat tercermin dan satukan titik di bidang
  function mirror(pm, axis, keep, eps) {
    eps = eps == null ? 1e-5 : eps; keep = keep >= 0 ? 1 : -1;
    bisect(pm, axis);
    const cen = (f) => { let s = 0; for (const i of f.v) s += pm.V[i][axis]; return s / f.v.length; };
    pm.F = pm.F.filter((f) => cen(f) * keep > 0);
    compact(pm);
    for (const p of pm.V) if (Math.abs(p[axis]) < eps) p[axis] = 0;
    const n0 = pm.V.length, n1 = pm.F.length;
    const map = []; for (let i = 0; i < n0; i++) { const p = pm.V[i].slice(); p[axis] = -p[axis]; map.push(p[axis] === 0 && pm.V[i][axis] === 0 ? i : pm.V.length); if (map[i] !== i) pm.V.push(p); }
    for (let fi = 0; fi < n1; fi++) { const f = pm.F[fi]; pm.F.push({ v: f.v.map((i) => map[i]).reverse(), c: f.c }); }
    compact(pm);
    return { v: [], f: [] };
  }

  /* ----------------------------- transformasi seleksi ----------------------------- */
  function transformVerts(pm, verts, fn) { for (const i of verts) pm.V[i] = fn(pm.V[i]); }
  function centroid(pm, verts) { let c = [0, 0, 0], n = 0; for (const i of verts) { c = add(c, pm.V[i]); n++; } return n ? mul(c, 1 / n) : [0, 0, 0]; }

  // pemeriksa topologi: tepi terbuka / non-manifold / jumlah komponen
  function stats(pm) {
    const t = topology(pm); let open = 0, nonman = 0; for (const e of t.edges.values()) { if (e.faces.length === 1) open++; else if (e.faces.length > 2) nonman++; }
    return { V: pm.V.length, E: t.edges.size, F: pm.F.length, open, nonmanifold: nonman, euler: pm.V.length - t.edges.size + pm.F.length };
  }

  const api = {
    create, clone, topology, compact, tidyFaces, ek, ekA, ekB, faceNormal, faceCenter, faceArea, faceNormalRaw,
    fromTriMesh, toTriMesh, triangulateFace,
    edgesOfFaces, vertsOfFaces, facesFromVerts, edgesFromVerts, facesFromEdges, growFaces, shrinkFaces, edgeLoop, edgeRing, linkedFaces,
    deleteFaces, deleteVerts, deleteEdges, dissolveEdges, dissolveVerts, mergeVerts, weldByDistance,
    extrudeFaces, extrudeEdges, insetFaces, bevelEdges, subdivideEdges, subdivideFaces, catmullClark, loopCut,
    fillVerts, flipFaces, recalcNormals, volume, mirror, bisect, transformVerts, centroid, stats,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.S3DPoly = api;
})(typeof self !== 'undefined' ? self : this);
