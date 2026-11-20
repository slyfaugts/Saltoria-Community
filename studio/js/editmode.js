/*
 * Saltoria 3D Studio — Edit Mode (titik / tepi / muka) untuk Modeler.
 * Memakai mesin poligon S3DPoly. Modul ini hanya urusan antarmuka: seleksi, gizmo, panel, undo sesi edit.
 * Maker menyediakan jembatan lewat `ctx` (lihat maker.js: makeEditCtx).
 */
(function (root) {
  'use strict';
  const PM = root.S3DPoly, MO = root.S3DMeshOps;
  const DEG = Math.PI / 180;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const MAX_TRI = 150000;

  // geometri Modeler (titik tidak dibagi, ranges warna) → PolyMesh
  function soupToPoly(g) { return PM.fromTriMesh(soupToTri(g)); }
  function soupToTri(g) {
    const nV = g.positions.length / 3, nT = g.indices.length / 3;
    const P = new Float64Array(g.positions.length); for (let i = 0; i < P.length; i++) P[i] = g.positions[i];
    let C = null, pal = null;
    if (g.ranges && g.ranges.length) {
      pal = []; const idxOf = new Map(), rOf = new Int32Array(nV).fill(0);
      g.ranges.forEach((r, ri) => { let k = idxOf.get(r.hex); if (k == null) { k = pal.length; idxOf.set(r.hex, k); pal.push(r.hex); } for (let i = r.start; i < r.start + r.count && i < nV; i++) rOf[i] = k; });
      C = new Uint16Array(nT); for (let t = 0; t < nT; t++) C[t] = rOf[g.indices[t * 3]];
    }
    return MO.weld({ P, T: Uint32Array.from(g.indices), C: C || undefined, pal: pal || undefined }, 1e-7);
  }

  function create(ctx) {
    const el = ctx.el;
    let ed = null;
    const P0 = () => ({ extrude: 0.5, inset: 0.1, indiv: false, bevel: 0.1, cuts: 1, slide: 0, subdiv: 1, mergeMode: 'center', weld: 0.01, cc: 1, axis: 0, side: 1, xray: false });
    const lastP = P0();

    /* ----------------------------- sesi ----------------------------- */
    function snapshot() { return { pm: PM.clone(ed.pm), mode: ed.mode, v: Array.from(ed.sel.v), e: Array.from(ed.sel.e), f: Array.from(ed.sel.f) }; }
    function restore(s) { ed.pm = PM.clone(s.pm); ed.mode = s.mode; ed.sel = { v: new Set(s.v), e: new Set(s.e), f: new Set(s.f) }; changed(true); }
    function pushUndo(label) { ed.undo.push(Object.assign(snapshot(), { label })); if (ed.undo.length > 40) ed.undo.shift(); ed.redo = []; }
    function undo() { if (!ed || !ed.undo.length) { ctx.toast('Tidak ada yang bisa dibatalkan di Edit Mode.'); return; } ed.redo.push(Object.assign(snapshot(), { label: '' })); restore(ed.undo.pop()); }
    function redo() { if (!ed || !ed.redo.length) return; ed.undo.push(Object.assign(snapshot(), { label: '' })); restore(ed.redo.pop()); }

    function enter(o) {
      if (ed) return false;
      let pm;
      try {
        if (o.type === 'mesh') pm = PM.fromTriMesh(ctx.meshOf(o));
        else pm = soupToPoly(ctx.localGeo(o));
      } catch (e) { ctx.toast('Tidak bisa membuka Edit Mode: ' + e.message); return false; }
      if (!pm.F.length) { ctx.toast('Objek ini tidak punya muka untuk diedit.'); return false; }
      ed = { oid: o.id, o, pm, mode: 'f', sel: { v: new Set(), e: new Set(), f: new Set() }, undo: [], redo: [], rev: 0, p: lastP, cache: null, pending: null, hover: null, gizmoActive: null, box: null, converted: o.type !== 'mesh' };
      if (ed.converted) ctx.toast('Edit Mode: bentuk ini dikonversi menjadi mesh poligon saat Anda keluar. Parameter bentuk tidak bisa diubah lagi sesudahnya.');
      changed(true);
      return true;
    }
    function exit(commit) {
      if (!ed) return;
      const e = ed; ed = null;
      if (commit && (e.undo.length || e.touched)) {
        const tri = PM.toTriMesh(e.pm);
        if (tri.T.length >= 9) ctx.commitMesh(e.o, tri, e.converted);
        else ctx.toast('Mesh kosong; perubahan dibuang.');
      }
      ctx.onExit();
    }

    /* ----------------------------- seleksi ----------------------------- */
    function derive() {
      const s = ed.sel, pm = ed.pm;
      if (ed.mode === 'v') { const topo = PM.topology(pm); s.e = new Set(PM.edgesFromVerts(pm, s.v, topo)); s.f = new Set(PM.facesFromVerts(pm, s.v)); }
      else if (ed.mode === 'e') { s.v = new Set(); for (const k of s.e) { s.v.add(PM.ekA(k)); s.v.add(PM.ekB(k)); } s.f = new Set(PM.facesFromEdges(pm, s.e)); }
      else { s.v = PM.vertsOfFaces(pm, s.f); s.e = PM.edgesOfFaces(pm, s.f); }
    }
    function setMode(m) {
      if (!ed || ed.mode === m) return;
      const old = ed.mode, s = ed.sel;
      // konversi menurut Blender: naik (titik→tepi→muka) memilih elemen yang seluruhnya terpilih, turun memilih semua bagiannya
      if (old === 'f') { /* v,e sudah mengikuti muka */ if (m === 'v') s.e = new Set(PM.edgesFromVerts(ed.pm, s.v)); }
      ed.mode = m; derive(); changed(false);
    }
    function selectAll() { const pm = ed.pm; ed.sel.f = new Set(pm.F.map((_, i) => i)); ed.sel.v = new Set(pm.V.map((_, i) => i)); ed.sel.e = new Set(PM.topology(pm).edges.keys()); changed(false); }
    function selectNone() { ed.sel = { v: new Set(), e: new Set(), f: new Set() }; changed(false); }
    function invert() {
      const pm = ed.pm;
      if (ed.mode === 'v') { const n = new Set(); pm.V.forEach((_, i) => { if (!ed.sel.v.has(i)) n.add(i); }); ed.sel.v = n; }
      else if (ed.mode === 'e') { const n = new Set(); for (const k of PM.topology(pm).edges.keys()) if (!ed.sel.e.has(k)) n.add(k); ed.sel.e = n; }
      else { const n = new Set(); pm.F.forEach((_, i) => { if (!ed.sel.f.has(i)) n.add(i); }); ed.sel.f = n; }
      derive(); changed(false);
    }
    function grow() { if (!ed.sel.f.size && !ed.sel.v.size) return; const f = PM.growFaces(ed.pm, ed.sel.f.size ? Array.from(ed.sel.f) : PM.facesFromVerts(ed.pm, ed.sel.v)); ed.mode = ed.mode === 'v' ? 'v' : 'f'; if (ed.mode === 'v') { ed.sel.v = PM.vertsOfFaces(ed.pm, f); } else ed.sel.f = new Set(f); derive(); changed(false); }
    function shrink() { const f = PM.shrinkFaces(ed.pm, Array.from(ed.sel.f)); if (ed.mode === 'v') { const keep = new Set(); const vs = PM.vertsOfFaces(ed.pm, f); ed.sel.v = vs; } else { ed.mode = 'f'; ed.sel.f = new Set(f); } derive(); changed(false); }
    function linked() {
      let seeds = Array.from(ed.sel.f); if (!seeds.length) seeds = PM.facesFromVerts(ed.pm, ed.sel.v);
      if (!seeds.length && ed.sel.e.size) { const k = ed.sel.e.values().next().value; const topo = PM.topology(ed.pm); seeds = topo.edges.get(k).faces.slice(0, 1); }
      if (!seeds.length) { ctx.toast('Pilih sesuatu dulu, lalu "Terhubung".'); return; }
      const all = new Set(); for (const s of seeds) for (const f of PM.linkedFaces(ed.pm, s)) all.add(f);
      ed.mode = 'f'; ed.sel.f = all; derive(); changed(false);
    }
    function loopSel(ring) {
      const k = ed.sel.e.size ? ed.sel.e.values().next().value : null;
      if (k == null) { ctx.toast('Pilih satu tepi dulu (mode Tepi).'); return; }
      const topo = PM.topology(ed.pm);
      const list = ring ? PM.edgeRing(ed.pm, k, topo).edges : PM.edgeLoop(ed.pm, k, topo);
      ed.mode = 'e'; ed.sel.e = new Set(list); derive(); changed(false);
    }

    /* ----------------------------- data tampilan ----------------------------- */
    function worldVerts() { if (ed.cache && ed.cache.rev === ed.rev) return ed.cache; const wv = ed.pm.V.map((p) => ctx.toWorld(ed.o, p)); const tris = []; ed.pm.F.forEach((f, fi) => { for (const t of PM.triangulateFace(ed.pm, f)) tris.push([t[0], t[1], t[2], fi]); }); ed.cache = { rev: ed.rev, wv, tris }; return ed.cache; }
    function changed(topo) {
      if (topo) ed.rev++;
      ed.geo = null; ed.touched = true;
      if (topo) derive();
      ctx.rebuild();
      ctx.requestPanel();
    }
    function geoNow() {
      if (ed.geo && ed.geoRev === ed.rev) return ed.geo;
      const tri = PM.toTriMesh(ed.pm);
      ed.geo = MO.toSoup(tri, 1, 'y', true); ed.geoRev = ed.rev; return ed.geo;
    }
    // dipanggil maker dari worldGeo; null bila objek ini tidak sedang diedit
    function geoFor(o) { return ed && ed.oid === o.id ? { geo: geoNow(), rev: ed.rev } : null; }
    function triCount() { let n = 0; for (const f of ed.pm.F) n += Math.max(1, f.v.length - 2); return n; }

    function overlays() {
      const c = worldVerts(), pm = ed.pm, out = [];
      const topo = PM.topology(pm), s = ed.sel;
      if (topo.edges.size <= 20000) {
        const ln = []; for (const [k, e] of topo.edges) { if (s.e.has(k)) continue; const a = c.wv[e.a], b = c.wv[e.b]; ln.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
        if (ln.length) out.push({ lines: ln, color: [0.62, 0.8, 1, 0.5] });
      }
      if (s.e.size) { const ln = []; for (const k of s.e) { const a = c.wv[PM.ekA(k)], b = c.wv[PM.ekB(k)]; ln.push(a[0], a[1], a[2], b[0], b[1], b[2]); } out.push({ lines: ln, color: [1, 0.72, 0.2, 1] }); }
      if (s.f.size) { const tr = []; for (const t of c.tris) if (s.f.has(t[3])) for (let i = 0; i < 3; i++) tr.push(...c.wv[t[i]]); out.push({ tris: tr, color: [1, 0.7, 0.2, 0.32] }); }
      if (ed.mode === 'v' && pm.V.length <= 6000) { const pts = [], hot = []; pm.V.forEach((_, i) => { (s.v.has(i) ? hot : pts).push(...c.wv[i]); }); if (pts.length) out.push({ pts, size: 3.2, color: [0.85, 0.93, 1, 0.95] }); if (hot.length) out.push({ pts: hot, size: 4.6, color: [1, 0.6, 0.12, 1] }); }
      else if (s.v.size && s.v.size <= 6000) { const hot = []; for (const i of s.v) hot.push(...c.wv[i]); out.push({ pts: hot, size: 3.8, color: [1, 0.6, 0.12, 1] }); }
      return out;
    }
    function pivot() { if (!s_any()) return null; const vs = ed.sel.v; if (!vs.size) return null; const c = worldVerts(); let p = [0, 0, 0]; for (const i of vs) p = add(p, c.wv[i]); return mul(p, 1 / vs.size); }
    const s_any = () => ed && (ed.sel.v.size || ed.sel.f.size || ed.sel.e.size);
    function refreshView() {
      const v = ctx.viewer(); if (!v || !ed) return;
      v.setOverlays(overlays());
      const piv = pivot(), tool = ctx.getTool();
      v.setGizmo(piv && tool !== 'select' ? { mode: tool, pos: piv, axes: ctx.axes(ed.o), active: ed.gizmoActive, hover: ed.hover } : null);
    }

    /* ----------------------------- pemilihan dengan kursor ----------------------------- */
    const rayTri = (o, d, a, b, c) => {
      const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
      if (Math.abs(det) < 1e-12) return null; const inv = 1 / det, tt = sub(o, a), u = dot(tt, p) * inv; if (u < 0 || u > 1) return null;
      const q = cross(tt, e1), v = dot(d, q) * inv; if (v < 0 || u + v > 1) return null; const t = dot(e2, q) * inv; return t > 1e-6 ? t : null;
    };
    function firstHit(ray) { const c = worldVerts(); let best = null; for (const t of c.tris) { const h = rayTri(ray.o, ray.d, c.wv[t[0]], c.wv[t[1]], c.wv[t[2]]); if (h != null && (!best || h < best.t)) best = { t: h, f: t[3] }; } return best; }
    // titik terhalang bila ada permukaan lain di antara kamera dan titik
    function occluded(q, ignoreFaces) {
      if (ed.p.xray) return false;
      const v = ctx.viewer(), pr = v.project(q), ray = v.rayFromClient(pr.x, pr.y), dist = dot(sub(q, ray.o), ray.d), c = worldVerts();
      const eps = Math.max(1e-3, dist * 2e-3);
      for (const t of c.tris) { if (ignoreFaces && ignoreFaces.has(t[3])) continue; const h = rayTri(ray.o, ray.d, c.wv[t[0]], c.wv[t[1]], c.wv[t[2]]); if (h != null && h < dist - eps) return true; }
      return false;
    }
    function pickAt(cx, cy, ray, e) {
      const v = ctx.viewer(), c = worldVerts(), pm = ed.pm, additive = e.shiftKey, topo = PM.topology(pm);
      let hit = null;
      if (ed.mode === 'v') {
        let best = null, bd = 14;
        for (let i = 0; i < pm.V.length; i++) { const p = v.project(c.wv[i]), d = Math.hypot(p.x - cx, p.y - cy); if (d < bd) { const cand = { i, d }; if (!best || d < best.d) best = cand; } }
        if (best) {
          // beberapa kandidat terdekat: ambil yang tidak terhalang
          const list = []; for (let i = 0; i < pm.V.length; i++) { const p = v.project(c.wv[i]), d = Math.hypot(p.x - cx, p.y - cy); if (d < 14) list.push({ i, d }); }
          list.sort((a, b) => a.d - b.d);
          for (const cd of list.slice(0, 6)) { const around = new Set(topo.vf[cd.i]); if (!occluded(c.wv[cd.i], around)) { hit = cd.i; break; } }
        }
      } else if (ed.mode === 'e') {
        const list = [];
        for (const [k, edg] of topo.edges) {
          const a = v.project(c.wv[edg.a]), b = v.project(c.wv[edg.b]), dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
          const tt = clamp(((cx - a.x) * dx + (cy - a.y) * dy) / l2, 0, 1), d = Math.hypot(cx - (a.x + dx * tt), cy - (a.y + dy * tt));
          if (d < 10) list.push({ k, d, e: edg });
        }
        list.sort((a, b) => a.d - b.d);
        for (const cd of list.slice(0, 8)) { const mid = mul(add(c.wv[cd.e.a], c.wv[cd.e.b]), 0.5); if (!occluded(mid, new Set(cd.e.faces))) { hit = cd.k; break; } }
      } else { const h = firstHit(ray); if (h) hit = h.f; }
      const set = ed.mode === 'v' ? ed.sel.v : ed.mode === 'e' ? ed.sel.e : ed.sel.f;
      if (hit == null) { if (!additive) { ed.sel = { v: new Set(), e: new Set(), f: new Set() }; changed(false); } return; }
      if (e.altKey && ed.mode === 'e') {
        const list = e.ctrlKey || e.metaKey ? PM.edgeRing(pm, hit, topo).edges : PM.edgeLoop(pm, hit, topo);
        if (!additive) ed.sel.e = new Set(); for (const k of list) ed.sel.e.add(k); derive(); changed(false); return;
      }
      if (additive) { if (set.has(hit)) set.delete(hit); else set.add(hit); }
      else { set.clear(); set.add(hit); }
      derive(); changed(false);
    }
    function boxSelect(x0, y0, x1, y1, additive) {
      const v = ctx.viewer(), c = worldVerts(), pm = ed.pm, topo = PM.topology(pm);
      const lx = Math.min(x0, x1), hx = Math.max(x0, x1), ly = Math.min(y0, y1), hy = Math.max(y0, y1);
      const inside = (p) => p.x >= lx && p.x <= hx && p.y >= ly && p.y <= hy;
      const big = pm.V.length * c.tris.length > 4e7; const prev = ed.p.xray; if (big) { ed.p.xray = true; ctx.toast('Mesh besar: seleksi kotak menembus permukaan belakang.'); }
      if (!additive) ed.sel = { v: new Set(), e: new Set(), f: new Set() };
      if (ed.mode === 'v') { pm.V.forEach((_, i) => { if (inside(v.project(c.wv[i])) && !occluded(c.wv[i], new Set(topo.vf[i]))) ed.sel.v.add(i); }); }
      else if (ed.mode === 'e') { for (const [k, e] of topo.edges) { const mid = mul(add(c.wv[e.a], c.wv[e.b]), 0.5); if (inside(v.project(c.wv[e.a])) && inside(v.project(c.wv[e.b])) && !occluded(mid, new Set(e.faces))) ed.sel.e.add(k); } }
      else { pm.F.forEach((f, i) => { const cc = ctx.toWorld(ed.o, PM.faceCenter(pm, f)); if (inside(v.project(cc)) && !occluded(cc, new Set([i]))) ed.sel.f.add(i); }); }
      ed.p.xray = prev; derive(); changed(false);
    }

    /* ----------------------------- gizmo ----------------------------- */
    const axisParam = (ray, P0, A) => {
      const w = sub(ray.o, P0), b = dot(ray.d, A), d = dot(ray.d, w), e = dot(A, w), den = 1 - b * b;
      return Math.abs(den) < 1e-6 ? null : (e - b * d) / den;
    };
    const planeHit = (ray, P0, N) => { const den = dot(ray.d, N); if (Math.abs(den) < 1e-6) return null; const t = dot(sub(P0, ray.o), N) / den; return t < 0 ? null : add(ray.o, mul(ray.d, t)); };
    function startGizmo(ax, ray) {
      const piv = pivot(); if (!piv) return false;
      const AXS = ctx.axes(ed.o), i = 'xyz'.indexOf(ax), A = AXS[i], tool = ctx.getTool(), c = worldVerts();
      const start = new Map(); for (const vi of ed.sel.v) start.set(vi, c.wv[vi].slice());
      const g = { ax, i, A, AXS, C: piv, tool, start, moved: false };
      if (tool === 'rotate') { const h = planeHit(ray, piv, A), u = AXS[(i + 1) % 3], w = AXS[(i + 2) % 3]; g.u = u; g.w = w; const d = h ? sub(h, piv) : u; g.a0 = h ? Math.atan2(dot(d, w), dot(d, u)) : 0; }
      else { const t = axisParam(ray, piv, A); g.t0 = t == null ? 0 : t; g.len0 = Math.max(0.4, Math.abs(g.t0)); }
      pushUndo('Transformasi'); ed.gz = g; ed.gizmoActive = ax; return true;
    }
    function moveGizmo(ray, e) {
      const g = ed.gz, snap = ctx.snap();
      let fn;
      if (g.tool === 'move') { const t = axisParam(ray, g.C, g.A); if (t == null) return; let d = t - g.t0; if (snap > 0) d = Math.round(d / snap) * snap; const D = mul(g.A, d); fn = (p) => add(p, D); }
      else if (g.tool === 'scale') {
        const t = axisParam(ray, g.C, g.A); if (t == null) return; const f = clamp((g.len0 + (Math.abs(t) - Math.abs(g.t0))) / g.len0, 0.02, 30);
        fn = (p) => { const q = sub(p, g.C), along = dot(q, g.A); if (e && e.shiftKey) return add(g.C, mul(q, f)); return add(p, mul(g.A, along * (f - 1))); };
      } else {
        const h = planeHit(ray, g.C, g.A); if (!h) return; const d = sub(h, g.C); let ang = Math.atan2(dot(d, g.w), dot(d, g.u)) - g.a0;
        if (snap > 0) ang = Math.round(ang / (15 * DEG)) * 15 * DEG;
        const A = g.A, cs = Math.cos(ang), sn = Math.sin(ang), t1 = 1 - cs;
        fn = (p) => { const q = sub(p, g.C); const r = [(t1 * A[0] * A[0] + cs) * q[0] + (t1 * A[0] * A[1] - sn * A[2]) * q[1] + (t1 * A[0] * A[2] + sn * A[1]) * q[2], (t1 * A[0] * A[1] + sn * A[2]) * q[0] + (t1 * A[1] * A[1] + cs) * q[1] + (t1 * A[1] * A[2] - sn * A[0]) * q[2], (t1 * A[0] * A[2] - sn * A[1]) * q[0] + (t1 * A[1] * A[2] + sn * A[0]) * q[1] + (t1 * A[2] * A[2] + cs) * q[2]]; return add(g.C, r); };
      }
      for (const [vi, w0] of g.start) ed.pm.V[vi] = ctx.toLocal(ed.o, fn(w0));
      g.moved = true; ed.rev++; ed.geo = null; ed.touched = true; ctx.rebuild(); refreshView();
    }

    /* ----------------------------- penangan seret kursor ----------------------------- */
    const handler = {
      start(ray, e) {
        if (!ed) return false;
        if (ctx.getTool() !== 'select' && s_any()) { const ax = ctx.viewer().gizmoHit(e.clientX, e.clientY); if (ax) return startGizmo(ax, ray); }
        ed.ptr = { x: e.clientX, y: e.clientY, ray, e: { shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey }, dragging: false, lx: e.clientX, ly: e.clientY };
        return true;
      },
      move(ray, e) {
        if (!ed) return;
        if (ed.gz) { moveGizmo(ray, e); return; }
        const p = ed.ptr; if (!p) return; p.lx = e.clientX; p.ly = e.clientY;
        if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5) p.dragging = true;
        if (p.dragging) ctx.drawBox(p.x, p.y, e.clientX, e.clientY);
      },
      end() {
        if (!ed) return;
        if (ed.gz) { const g = ed.gz; ed.gz = null; ed.gizmoActive = null; if (!g.moved) ed.undo.pop(); else { derive(); changed(true); } refreshView(); return; }
        const p = ed.ptr; ed.ptr = null; ctx.drawBox(null);
        if (!p) return;
        if (p.dragging) boxSelect(p.x, p.y, p.lx, p.ly, p.e.shiftKey); else pickAt(p.x, p.y, p.ray, p.e);
      },
      tap() { /* seleksi ditangani di end() */ },
    };
    function hover(e) {
      if (!ed || ctx.getTool() === 'select' || !s_any()) { if (ed && ed.hover) { ed.hover = null; refreshView(); } return; }
      const h = ctx.viewer().gizmoHit(e.clientX, e.clientY); if (h !== ed.hover) { ed.hover = h; refreshView(); }
    }

    /* ----------------------------- operasi ----------------------------- */
    function finish(r, label, opt) {
      const pm = ed.pm; r = r || { v: [], f: [] };
      const map = PM.compact(pm);
      const vs = (r.v || []).map((i) => (map[i] >= 0 ? map[i] : -1)).filter((i) => i >= 0), fs = (r.f || []).slice();
      ed.sel = { v: new Set(), e: new Set(), f: new Set() };
      if (fs.length && fs.every((i) => i < pm.F.length)) { ed.mode = 'f'; ed.sel.f = new Set(fs); }
      else if (vs.length) { if (ed.mode === 'f') ed.mode = 'v'; if (ed.mode === 'v') ed.sel.v = new Set(vs); else { ed.sel.e = new Set(PM.edgesFromVerts(pm, new Set(vs))); } }
      changed(true);
      if (opt && opt.grab) { ctx.setTool('move'); ctx.toast(label + ': seret panah untuk memindahkan hasilnya.'); }
    }
    function run(label, fn, opt) {
      if (!ed) return;
      pushUndo(label);
      let r;
      try { r = fn(); } catch (err) { ed.undo.pop(); ctx.toast('Gagal ' + label + ': ' + err.message); return; }
      if (r === false) { ed.undo.pop(); return; }
      if (triCount() > MAX_TRI) { ed.undo.pop(); restore(ed.undo.length ? ed.undo[ed.undo.length - 1] : snapshot()); ctx.toast('Hasil terlalu besar (>' + MAX_TRI.toLocaleString('id-ID') + ' segitiga). Dibatalkan.'); return; }
      finish(r, label, opt);
    }
    const need = (cond, msg) => { if (!cond) { ctx.toast(msg); return false; } return true; };
    const F = () => Array.from(ed.sel.f), E = () => Array.from(ed.sel.e), V = () => Array.from(ed.sel.v);
    const ops = {
      extrude() { const p = ed.p;
        if (ed.sel.f.size) run('Extrude', () => PM.extrudeFaces(ed.pm, F(), p.extrude), { grab: true });
        else if (ed.sel.e.size) run('Extrude tepi', () => PM.extrudeEdges(ed.pm, E(), p.extrude), { grab: true });
        else ctx.toast('Pilih muka atau tepi untuk di-extrude.'); },
      inset() { if (need(ed.sel.f.size, 'Inset butuh muka terpilih (mode Muka).')) run('Inset', () => PM.insetFaces(ed.pm, F(), ed.p.inset, ed.p.indiv)); },
      bevel() { if (!need(ed.sel.e.size, 'Bevel butuh tepi terpilih (mode Tepi).')) return;
        run('Bevel', () => { const r = PM.bevelEdges(ed.pm, E(), ed.p.bevel); if (r.skipped) ctx.toast('Bevel: ' + r.skipped + ' tepi dilewati (tepi terbuka / bukan manifold).'); r.f = []; return r; }); },
      loopcut() { if (!need(ed.sel.e.size, 'Loop cut: pilih satu tepi (mode Tepi) pada deretan segi empat.')) return;
        run('Loop cut', () => { const r = PM.loopCut(ed.pm, E()[0], ed.p.cuts, ed.p.slide); if (!r.ok) { ctx.toast('Loop cut gagal pada tepi ini.'); return false; } ed.mode = 'v'; return r; }); },
      subdivide() { if (ed.sel.f.size) run('Subdivide', () => PM.subdivideFaces(ed.pm, F(), ed.p.subdiv));
        else if (ed.sel.e.size) run('Subdivide tepi', () => PM.subdivideEdges(ed.pm, E(), ed.p.subdiv));
        else ctx.toast('Pilih muka atau tepi untuk dibagi.'); },
      smooth() { run('Subdivisi halus', () => PM.catmullClark(ed.pm, ed.p.cc)); selectNoneQuiet(); },
      merge() { if (!need(ed.sel.v.size >= 2, 'Gabung butuh minimal 2 titik terpilih.')) return; run('Gabung', () => PM.mergeVerts(ed.pm, V(), ed.p.mergeMode)); },
      weld() { run('Gabung berdasarkan jarak', () => { const r = PM.weldByDistance(ed.pm, ed.p.weld, ed.sel.v.size ? V() : null); ctx.toast(r.merged + ' titik digabung.'); return r; }); },
      del() { if (!(ed.sel.v.size || ed.sel.e.size || ed.sel.f.size)) { ctx.toast('Pilih sesuatu untuk dihapus.'); return; }
        run('Hapus', () => ed.mode === 'v' ? PM.deleteVerts(ed.pm, V()) : ed.mode === 'e' ? PM.deleteEdges(ed.pm, E()) : PM.deleteFaces(ed.pm, F())); },
      dissolve() { if (!(ed.sel.v.size || ed.sel.e.size || ed.sel.f.size)) { ctx.toast('Pilih sesuatu untuk dilebur.'); return; }
        run('Lebur', () => {
          if (ed.mode === 'v') return PM.dissolveVerts(ed.pm, V());
          if (ed.mode === 'e') return PM.dissolveEdges(ed.pm, E());
          const set = ed.sel.f, topo = PM.topology(ed.pm), inner = []; for (const [k, e] of topo.edges) if (e.faces.length === 2 && set.has(e.faces[0]) && set.has(e.faces[1])) inner.push(k);
          return PM.dissolveEdges(ed.pm, inner);
        }); },
      fill() { if (need(ed.sel.v.size >= 3, 'Isi: pilih minimal 3 titik / satu lingkaran tepi.')) run('Isi', () => { const r = PM.fillVerts(ed.pm, V(), E()); return r.ok ? r : false; }); },
      flip() { if (need(ed.sel.f.size, 'Balik arah: pilih muka.')) run('Balik arah muka', () => PM.flipFaces(ed.pm, F())); },
      recalc() { run('Hitung ulang normal', () => PM.recalcNormals(ed.pm)); },
      mirror() { run('Cermin', () => PM.mirror(ed.pm, ed.p.axis, ed.p.side, 1e-4)); selectNoneQuiet(); },
      triangulate() { run('Segitigakan', () => { const out = []; for (const f of ed.pm.F) for (const t of PM.triangulateFace(ed.pm, f)) out.push({ v: t, c: f.c }); ed.pm.F = out; return { v: [], f: [] }; }); },
      quads() { run('Segitiga ke segi empat', () => { const tri = PM.toTriMesh(ed.pm); const q = PM.fromTriMesh(tri); ed.pm = q; return { v: [], f: [] }; }); },
      origin() { run('Pusatkan', () => { const c = PM.centroid(ed.pm, ed.pm.V.map((_, i) => i)); for (const p of ed.pm.V) { p[0] -= c[0]; p[1] -= c[1]; p[2] -= c[2]; } return { v: [], f: [] }; }); },
    };
    function selectNoneQuiet() { if (ed) { ed.sel = { v: new Set(), e: new Set(), f: new Set() }; } }

    /* ----------------------------- panel ----------------------------- */
    function renderPanel(box) {
      if (!ed) return;
      const p = ed.p;
      const btn = (text, fn, title, cls) => el('button', { type: 'button', class: 'chip ' + (cls || ''), text, title: title || '', onclick: fn });
      const num = (label, key, min, max, step) => { const inp = el('input', { type: 'number', min, max, step, value: p[key], inputMode: 'decimal', 'aria-label': label }); inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (isFinite(v)) p[key] = clamp(v, min, max); }); return el('label', { class: 'nf' }, [el('span', { text: label }), inp]); };
      const chk = (label, key) => { const c = el('input', { type: 'checkbox' }); c.checked = !!p[key]; c.addEventListener('change', () => { p[key] = c.checked; }); return el('label', { class: 'nf chk' }, [c, el('span', { text: label })]); };
      const sel = (label, key, opts, conv) => { const s = el('select', { 'aria-label': label }, opts.map(([v, t]) => el('option', { value: String(v), text: t }))); s.value = String(p[key]); s.addEventListener('change', () => { p[key] = conv ? conv(s.value) : s.value; }); return el('label', { class: 'nf' }, [el('span', { text: label }), s]); };
      box.appendChild(el('h3', { text: 'Edit Mode' }));
      box.appendChild(el('p', { class: 'hint', text: 'Objek: ' + ed.o.name + '. Klik elemen untuk memilih, Shift untuk menambah, seret di area kosong untuk seleksi kotak. Pindah/Putar/Skala dengan gizmo.' }));
      const modes = el('div', { class: 'seg', role: 'group', 'aria-label': 'Mode pilih' }, [['v', 'Titik (1)'], ['e', 'Tepi (2)'], ['f', 'Muka (3)']].map(([m, t]) => el('button', { type: 'button', class: 'chip', text: t, 'aria-pressed': String(ed.mode === m), onclick: () => setMode(m) })));
      box.appendChild(modes);
      const pmc = ed.pm;
      box.appendChild(el('p', { class: 'hint', text: 'Titik ' + pmc.V.length + ', muka ' + pmc.F.length + ', segitiga ' + triCount().toLocaleString('id-ID') + '. Terpilih: ' + ed.sel.v.size + ' titik, ' + ed.sel.e.size + ' tepi, ' + ed.sel.f.size + ' muka.' }));
      box.appendChild(el('div', { class: 'chiprow' }, [btn('Semua (A)', selectAll), btn('Tak satu (Alt+A)', selectNone), btn('Balik (Ctrl+I)', invert), btn('Perluas', grow), btn('Kecilkan', shrink), btn('Terhubung (L)', linked), btn('Loop tepi', () => loopSel(false), 'Pilih satu tepi dulu. Alt+klik tepi juga memilih loop'), btn('Cincin tepi', () => loopSel(true))]));
      box.appendChild(chk('Tembus pandang (pilih elemen di belakang)', 'xray'));

      box.appendChild(el('h3', { text: 'Bentuk' }));
      box.appendChild(num('Extrude: jarak', 'extrude', -20, 20, 0.1)); box.appendChild(btn('Extrude (E)', ops.extrude, 'Muka atau tepi'));
      box.appendChild(num('Inset: lebar', 'inset', 0.005, 5, 0.05)); box.appendChild(chk('Inset tiap muka sendiri-sendiri', 'indiv')); box.appendChild(btn('Inset (I)', ops.inset, 'Muka'));
      box.appendChild(num('Bevel: lebar', 'bevel', 0.005, 5, 0.05)); box.appendChild(btn('Bevel (B)', ops.bevel, 'Tepi'));
      box.appendChild(num('Loop cut: jumlah potongan', 'cuts', 1, 32, 1)); box.appendChild(num('Loop cut: geser (-1..1)', 'slide', -1, 1, 0.1)); box.appendChild(btn('Loop cut (Ctrl+R)', ops.loopcut, 'Pilih satu tepi pada deretan segi empat'));
      box.appendChild(num('Subdivide: jumlah potongan', 'subdiv', 1, 6, 1)); box.appendChild(btn('Subdivide', ops.subdivide, 'Muka atau tepi terpilih'));
      box.appendChild(sel('Subdivisi halus: tingkat', 'cc', [[1, '1'], [2, '2'], [3, '3']], (v) => +v)); box.appendChild(btn('Subdivisi halus (Catmull-Clark)', ops.smooth, 'Seluruh mesh; segitiga naik ±4× per tingkat'));

      box.appendChild(el('h3', { text: 'Gabung & hapus' }));
      box.appendChild(sel('Gabung di', 'mergeMode', [['center', 'Tengah'], ['first', 'Titik pertama'], ['last', 'Titik terakhir']])); box.appendChild(btn('Gabung titik (M)', ops.merge));
      box.appendChild(num('Gabung berdasar jarak', 'weld', 0.0001, 2, 0.01)); box.appendChild(btn('Gabung berdasar jarak', ops.weld, 'Seluruh mesh bila tidak ada titik terpilih'));
      box.appendChild(el('div', { class: 'chiprow' }, [btn('Hapus (X)', ops.del), btn('Lebur (Ctrl+X)', ops.dissolve, 'Menghapus elemen tanpa membuat lubang'), btn('Isi (F)', ops.fill, 'Buat muka dari titik / lingkaran tepi terpilih'), btn('Balik arah', ops.flip), btn('Hitung ulang normal', ops.recalc)]));

      box.appendChild(el('h3', { text: 'Cermin & utilitas' }));
      box.appendChild(sel('Sumbu cermin', 'axis', [[0, 'X'], [1, 'Y'], [2, 'Z']], (v) => +v));
      box.appendChild(sel('Pertahankan sisi', 'side', [[1, 'Positif'], [-1, 'Negatif']], (v) => +v));
      box.appendChild(btn('Cermin (potong lalu gandakan)', ops.mirror, 'Memotong mesh di bidang pusat, membuang sisi lain, lalu mencerminkan'));
      box.appendChild(el('div', { class: 'chiprow' }, [btn('Segitigakan', ops.triangulate), btn('Segitiga → segi empat', ops.quads), btn('Pusatkan mesh', ops.origin)]));
      box.appendChild(el('div', { class: 'chiprow' }, [btn('Batal (Ctrl+Z)', undo), btn('Ulang', redo), btn('Selesai (Tab)', () => exit(true), 'Simpan perubahan', 'primary'), btn('Buang perubahan', () => { if (ed.undo.length && !confirm('Buang semua perubahan Edit Mode?')) return; exit(false); })]));
      box.appendChild(el('p', { class: 'hint', text: 'Pintasan: 1/2/3 mode, A semua, Alt+A tak satu, Ctrl+I balik, E extrude, I inset, B bevel, X hapus, F isi, M gabung, L terhubung, W/T/R pindah/putar/skala, Tab keluar.' }));
    }

    /* ----------------------------- papan ketik ----------------------------- */
    function onKey(e) {
      if (!ed) return false;
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      if (k === 'tab') { exit(true); return true; }
      if (mod && k === 'z') { if (e.shiftKey) redo(); else undo(); return true; }
      if (mod && k === 'y') { redo(); return true; }
      if (mod && k === 'i') { invert(); return true; }
      if (mod && k === 'r') { ops.loopcut(); return true; }
      if (mod && k === 'x') { ops.dissolve(); return true; }
      if (mod) return false;
      if (k === '1') { setMode('v'); return true; } if (k === '2') { setMode('e'); return true; } if (k === '3') { setMode('f'); return true; }
      if (k === 'a') { if (e.altKey) selectNone(); else selectAll(); return true; }
      if (k === 'e') { ops.extrude(); return true; }
      if (k === 'i') { ops.inset(); return true; }
      if (k === 'b') { ops.bevel(); return true; }
      if (k === 'x' || k === 'delete' || k === 'backspace') { ops.del(); return true; }
      if (k === 'f') { ops.fill(); return true; }
      if (k === 'm') { ops.merge(); return true; }
      if (k === 'l') { linked(); return true; }
      if (k === 'w') { ctx.setTool('move'); return true; } if (k === 't') { ctx.setTool('rotate'); return true; } if (k === 'r') { ctx.setTool('scale'); return true; } if (k === 'q') { ctx.setTool('select'); return true; }
      if (k === 'escape') { selectNone(); return true; }
      return false;
    }

    return {
      enter, exit, handler, hover, renderPanel, onKey, geoFor, refreshView, undo, redo, setMode,
      get active() { return !!ed; }, get oid() { return ed ? ed.oid : null; }, get mode() { return ed ? ed.mode : null; },
      // untuk uji
      _state: () => ed, _ops: ops, _select: (mode, ids) => { ed.mode = mode; ed.sel = { v: new Set(), e: new Set(), f: new Set() }; ed.sel[mode].clear(); for (const i of ids) ed.sel[mode].add(i); derive(); changed(false); },
    };
  }

  root.S3DEditMode = { create, soupToPoly, soupToTri };
})(typeof self !== 'undefined' ? self : this);
