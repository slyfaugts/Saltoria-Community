/*
 * Saltoria 3D Studio — Sculpt Mode.
 * Kuas: Tarik, Haluskan, Gembung, Ratakan, Cubit, Geser, Cat warna. Simetri X, tambah/turunkan detail (Worker), undo per goresan.
 * Tampilan sementara memakai objek yang sedang dipahat saja (isolasi); objek lain kembali saat keluar.
 */
(function (root) {
  'use strict';
  const SO = root.S3DSculptOps, MO = root.S3DMeshOps, Ed = root.S3DEditMode;
  const MAX_TRI = 400000;
  const BRUSHES = [['draw', 'Tarik (D)'], ['smooth', 'Haluskan (S)'], ['inflate', 'Gembung (I)'], ['flatten', 'Ratakan (F)'], ['pinch', 'Cubit (P)'], ['grab', 'Geser (G)'], ['paint', 'Cat warna (C)']];
  const KEYS = { d: 'draw', s: 'smooth', i: 'inflate', f: 'flatten', p: 'pinch', g: 'grab', c: 'paint' };

  function create(ctx) {
    const el = ctx.el;
    let sc = null, raf = 0, hoverRaf = 0, hoverEv = null;
    const lastP = { brush: 'draw', radius: 0.18, strength: 0.5, sym: false, color: '#e8433c', maxEdge: 4, target: 50, relaxIters: 2 };

    /* ----------------------------- sesi ----------------------------- */
    function frame(o) {
      const t = ctx.toWorld(o, [0, 0, 0]), ex = ctx.toWorld(o, [1, 0, 0]), ey = ctx.toWorld(o, [0, 1, 0]), ez = ctx.toWorld(o, [0, 0, 1]);
      const M = [ex[0] - t[0], ey[0] - t[0], ez[0] - t[0], ex[1] - t[1], ey[1] - t[1], ez[1] - t[1], ex[2] - t[2], ey[2] - t[2], ez[2] - t[2]];
      const [a, b, c, d, e, f, g, h, i] = M;
      const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C || 1e-12;
      const inv = [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
      return { M, inv, t, sc: (Math.hypot(a, d, g) + Math.hypot(b, e, h) + Math.hypot(c, f, i)) / 3 };
    }
    const mulM = (m, x, y, z) => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];

    function bounds() {
      const P = sc.P; let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { const v = P[i + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
      sc.bbR = Math.max(1e-6, Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2);
    }
    function prepare() { // setelah P/T berubah total
      const nV = sc.P.length / 3;
      sc.adj = SO.buildAdj(nV, sc.T);
      sc.N = SO.vertexNormals(sc.P, sc.T, sc.adj);
      sc.seen = new Uint8Array(nV); sc.stamp = new Uint32Array(nV); sc.stampN = 0;
      bounds();
      sc.wpos = new Float32Array(nV * 3); sc.wnor = new Float32Array(nV * 3);
      for (let v = 0; v < nV; v++) place(v);
    }
    function place(v) {
      const F = sc.F, P = sc.P, N = sc.N, M = F.M, i = v * 3, x = P[i], y = P[i + 1], z = P[i + 2];
      sc.wpos[i] = M[0] * x + M[1] * y + M[2] * z + F.t[0]; sc.wpos[i + 1] = M[3] * x + M[4] * y + M[5] * z + F.t[1]; sc.wpos[i + 2] = M[6] * x + M[7] * y + M[8] * z + F.t[2];
      const nx = N[i], ny = N[i + 1], nz = N[i + 2], q = F.inv; // (M^-1)^T n
      let ox = q[0] * nx + q[3] * ny + q[6] * nz, oy = q[1] * nx + q[4] * ny + q[7] * nz, oz = q[2] * nx + q[5] * ny + q[8] * nz;
      const l = Math.hypot(ox, oy, oz) || 1; sc.wnor[i] = ox / l; sc.wnor[i + 1] = oy / l; sc.wnor[i + 2] = oz / l;
    }
    function sendMesh(keep) {
      const v = ctx.viewer(); if (!v) return;
      const nV = sc.P.length / 3;
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < nV; i++) for (let a = 0; a < 3; a++) { const q = sc.wpos[i * 3 + a]; if (q < mn[a]) mn[a] = q; if (q > mx[a]) mx[a] = q; }
      v.setMesh({ positions: sc.wpos, normals: sc.wnor, uvs: new Float32Array(nV * 2), indices: sc.T, min: mn, max: mx }, undefined, undefined, true);
      v.setVertexColors(sc.VC);
    }
    function flush() {
      raf = 0; const v = ctx.viewer(); if (!sc || !v) return;
      if (sc.dirtyGeo) { v.updateVerts(sc.wpos, sc.wnor); sc.dirtyGeo = false; }
      if (sc.dirtyCol) { v.setVertexColors(sc.VC, true); sc.dirtyCol = false; }
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(flush); }
    function touchNormals(list) {
      // normal titik & tetangganya berubah bila posisi berubah
      const n = ++sc.stampN, set = [];
      for (const v of list) { if (sc.stamp[v] !== n) { sc.stamp[v] = n; set.push(v); } for (let k = sc.adj.vStart[v]; k < sc.adj.vStart[v + 1]; k++) { const u = sc.adj.vNbr[k]; if (sc.stamp[u] !== n) { sc.stamp[u] = n; set.push(u); } } }
      SO.vertexNormals(sc.P, sc.T, sc.adj, sc.N, set);
      for (const v of set) place(v);
      sc.dirtyGeo = true; schedule();
    }

    function enter(o) {
      if (sc) return false;
      let tri;
      try { tri = o.type === 'mesh' ? ctx.meshOf(o) : Ed.soupToTri(ctx.localGeo(o)); } catch (e) { ctx.toast('Tidak bisa membuka Sculpt: ' + e.message); return false; }
      const nT = tri.T.length / 3;
      if (!nT) { ctx.toast('Objek ini tidak punya permukaan untuk dipahat.'); return false; }
      if (nT > MAX_TRI) { ctx.toast('Mesh terlalu besar untuk Sculpt (' + nT.toLocaleString('id-ID') + ' segitiga). Turunkan detail dulu.'); return false; }
      sc = { oid: o.id, o, P: Float32Array.from(tri.P), T: Uint32Array.from(tri.T), C: tri.C ? Uint16Array.from(tri.C) : undefined, pal: tri.pal ? tri.pal.slice() : undefined, F: frame(o), undo: [], redo: [], touched: false, painted: false, converted: o.type !== 'mesh', busy: false, p: lastP, stroke: null, ring: null };
      prepare();
      sc.VC = SO.vcFromPalette(sc.P.length / 3, sc.T, o.tint ? null : sc.C, o.tint ? null : sc.pal, sc.adj, o.tint || o.color);
      sendMesh();
      ctx.toast('Sculpt: hanya objek ini yang tampil. Seret di badan model untuk memahat, seret di luar model untuk memutar kamera.');
      return true;
    }
    function exit(commit) {
      if (!sc) return;
      const s = sc; sc = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      const v = ctx.viewer(); if (v) { v.setOverlays([]); v.setVertexColors(null); }
      if (commit && s.touched) {
        let C = s.C, pal = s.pal;
        if (s.painted) { const q = SO.quantizeVC(s.T, s.VC, 24); C = q.C; pal = q.pal; }
        const out = { P: Float64Array.from(s.P), T: s.T, C, pal };
        ctx.commitMesh(s.o, out, s.converted, { painted: s.painted });
      }
      ctx.onExit();
    }

    /* ----------------------------- undo ----------------------------- */
    function swapEntry(en) {
      if (en.full) { const cur = takeFull(); putFull(en.full); en.full = cur; return; }
      const P = sc.P, VC = sc.VC;
      for (let k = 0; k < en.idx.length; k++) {
        const v = en.idx[k];
        for (let a = 0; a < 3; a++) { let t = P[v * 3 + a]; P[v * 3 + a] = en.P[k * 3 + a]; en.P[k * 3 + a] = t; t = VC[v * 3 + a]; VC[v * 3 + a] = en.VC[k * 3 + a]; en.VC[k * 3 + a] = t; }
      }
      touchNormals(en.idx); sc.dirtyCol = true; schedule();
    }
    function takeFull() { return { P: sc.P, T: sc.T, C: sc.C, pal: sc.pal, VC: sc.VC, painted: sc.painted }; }
    function putFull(f) { sc.P = f.P; sc.T = f.T; sc.C = f.C; sc.pal = f.pal; sc.VC = f.VC; sc.painted = f.painted; prepare(); sendMesh(); }
    function undo() { if (!sc || sc.busy) return; const en = sc.undo.pop(); if (!en) { ctx.toast('Tidak ada yang bisa dibatalkan di Sculpt.'); return; } swapEntry(en); sc.redo.push(en); ctx.requestPanel(); }
    function redo() { if (!sc || sc.busy) return; const en = sc.redo.pop(); if (!en) return; swapEntry(en); sc.undo.push(en); ctx.requestPanel(); }
    function pushUndo(en) { sc.undo.push(en); if (sc.undo.length > 30) sc.undo.shift(); sc.redo = []; sc.touched = true; }

    /* ----------------------------- sinar & kuas ----------------------------- */
    function localRay(ray) {
      const o = ctx.toLocal(sc.o, ray.o), q = ctx.toLocal(sc.o, [ray.o[0] + ray.d[0], ray.o[1] + ray.d[1], ray.o[2] + ray.d[2]]);
      let dx = q[0] - o[0], dy = q[1] - o[1], dz = q[2] - o[2]; const l = Math.hypot(dx, dy, dz) || 1;
      return { o, d: [dx / l, dy / l, dz / l] };
    }
    function pick(ray) {
      const r = localRay(ray), P = sc.P, T = sc.T, nT = T.length / 3;
      const ox = r.o[0], oy = r.o[1], oz = r.o[2], dx = r.d[0], dy = r.d[1], dz = r.d[2];
      let best = Infinity, bt = -1;
      for (let t = 0; t < nT; t++) {
        const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
        const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-14 && det < 1e-14) continue;
        const inv = 1 / det, tx = ox - P[a], ty = oy - P[a + 1], tz = oz - P[a + 2], u = (tx * px + ty * py + tz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (tt > 1e-9 && tt < best) { best = tt; bt = t; }
      }
      if (bt < 0) return null;
      const a = T[bt * 3] * 3, b = T[bt * 3 + 1] * 3, c = T[bt * 3 + 2] * 3;
      const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
      return { t: best, tri: bt, p: [ox + dx * best, oy + dy * best, oz + dz * best], n };
    }
    const radius = () => sc.p.radius * sc.bbR;

    function touch(v) {
      const s = sc.stroke; if (s.seen[v]) return; s.seen[v] = 1; s.idx.push(v);
      const i = v * 3; s.oP.push(sc.P[i], sc.P[i + 1], sc.P[i + 2]); s.oC.push(sc.VC[i], sc.VC[i + 1], sc.VC[i + 2]);
    }
    function collect(c, R) {
      const P = sc.P, R2 = R * R, ids = [], ws = [], cx = c[0], cy = c[1], cz = c[2];
      for (let v = 0, n = P.length / 3; v < n; v++) {
        const dx = P[v * 3] - cx; if (dx > R || dx < -R) continue;
        const dy = P[v * 3 + 1] - cy; if (dy > R || dy < -R) continue;
        const dz = P[v * 3 + 2] - cz; const d2 = dx * dx + dy * dy + dz * dz; if (d2 >= R2) continue;
        const t = 1 - Math.sqrt(d2) / R; ids.push(v); ws.push(t * t * (3 - 2 * t));
      }
      return { ids, ws };
    }
    function dab(c, nHit, inv) {
      const R = radius(), { ids, ws } = collect(c, R); if (!ids.length) return;
      const P = sc.P, N = sc.N, VC = sc.VC, kind = sc.stroke.kind, st = sc.p.strength, sgn = inv ? -1 : 1;
      if (kind === 'paint') {
        const col = SO.hexRGB(sc.p.color), k = Math.min(1, st * 0.6);
        for (let j = 0; j < ids.length; j++) { const v = ids[j], w = ws[j] * k; touch(v); for (let a = 0; a < 3; a++) VC[v * 3 + a] += (col[a] - VC[v * 3 + a]) * w; }
        sc.dirtyCol = true; sc.painted = true; schedule(); return;
      }
      // normal & titik rata-rata di dekat pusat
      let ax = 0, ay = 0, az = 0, px = 0, py = 0, pz = 0, sw = 0;
      for (let j = 0; j < ids.length; j++) { const v = ids[j], w = ws[j] * ws[j]; ax += N[v * 3] * w; ay += N[v * 3 + 1] * w; az += N[v * 3 + 2] * w; px += P[v * 3] * w; py += P[v * 3 + 1] * w; pz += P[v * 3 + 2] * w; sw += w; }
      let al = Math.hypot(ax, ay, az); if (al < 1e-9) { ax = nHit[0]; ay = nHit[1]; az = nHit[2]; al = 1; } ax /= al; ay /= al; az /= al; px /= sw; py /= sw; pz /= sw;
      const amt = st * R * 0.1 * sgn;
      for (let j = 0; j < ids.length; j++) {
        const v = ids[j], w = ws[j], i = v * 3; touch(v);
        if (kind === 'draw') { P[i] += ax * amt * w; P[i + 1] += ay * amt * w; P[i + 2] += az * amt * w; }
        else if (kind === 'inflate') { P[i] += N[i] * amt * w; P[i + 1] += N[i + 1] * amt * w; P[i + 2] += N[i + 2] * amt * w; }
        else if (kind === 'smooth') {
          const s = sc.adj.vStart[v], e = sc.adj.vStart[v + 1]; if (e === s) continue; let x = 0, y = 0, z = 0;
          for (let k = s; k < e; k++) { const u = sc.adj.vNbr[k] * 3; x += P[u]; y += P[u + 1]; z += P[u + 2]; }
          const f = Math.min(1, st * 0.6) * w; P[i] += (x / (e - s) - P[i]) * f; P[i + 1] += (y / (e - s) - P[i + 1]) * f; P[i + 2] += (z / (e - s) - P[i + 2]) * f;
        } else if (kind === 'flatten') {
          const d = (P[i] - px) * ax + (P[i + 1] - py) * ay + (P[i + 2] - pz) * az, f = Math.min(1, st * 0.6) * w * (inv ? -0.5 : 1);
          P[i] -= ax * d * f; P[i + 1] -= ay * d * f; P[i + 2] -= az * d * f;
        } else if (kind === 'pinch') {
          let dx = c[0] - P[i], dy = c[1] - P[i + 1], dz = c[2] - P[i + 2]; const d = dx * ax + dy * ay + dz * az; dx -= ax * d; dy -= ay * d; dz -= az * d;
          const f = Math.min(1, st * 0.35) * w * sgn; P[i] += dx * f; P[i + 1] += dy * f; P[i + 2] += dz * f;
        }
      }
      touchNormals(ids);
    }
    function mirrorDab(c, n, inv) { if (sc.p.sym && Math.abs(c[0]) > radius() * 0.2) dab([-c[0], c[1], c[2]], [-n[0], n[1], n[2]], inv); }

    /* ----------------------------- goresan ----------------------------- */
    function begin(hit, ray, e) {
      const kind = sc.p.brush;
      sc.stroke = { kind, seen: new Uint8Array(sc.P.length / 3), idx: [], oP: [], oC: [], last: hit.p, inv: !!(e.ctrlKey || e.metaKey), grab: null };
      if (kind === 'grab') {
        const R = radius(), sets = [];
        const mk = (c, sign) => { const { ids, ws } = collect(c, R); const base = new Float32Array(ids.length * 3); ids.forEach((v, j) => { touch(v); base[j * 3] = sc.P[v * 3]; base[j * 3 + 1] = sc.P[v * 3 + 1]; base[j * 3 + 2] = sc.P[v * 3 + 2]; }); sets.push({ ids, ws, base, sign }); };
        mk(hit.p, 1); if (sc.p.sym && Math.abs(hit.p[0]) > R * 0.2) mk([-hit.p[0], hit.p[1], hit.p[2]], -1);
        const w0 = ctx.toWorld(sc.o, hit.p), F = ctx.viewer().getCamera().F;
        sc.stroke.grab = { sets, w0, F, d0: ray.d };
      } else { dab(hit.p, hit.n, sc.stroke.inv); mirrorDab(hit.p, hit.n, sc.stroke.inv); }
      showRing(hit);
    }
    function move(ray) {
      const s = sc.stroke; if (!s) return;
      if (s.grab) {
        const g = s.grab, den = ray.d[0] * g.F[0] + ray.d[1] * g.F[1] + ray.d[2] * g.F[2]; if (Math.abs(den) < 1e-9) return;
        const t = ((g.w0[0] - ray.o[0]) * g.F[0] + (g.w0[1] - ray.o[1]) * g.F[1] + (g.w0[2] - ray.o[2]) * g.F[2]) / den;
        const dw = [ray.o[0] + ray.d[0] * t - g.w0[0], ray.o[1] + ray.d[1] * t - g.w0[1], ray.o[2] + ray.d[2] * t - g.w0[2]], dl = mulM(sc.F.inv, dw[0], dw[1], dw[2]);
        const all = [];
        for (const set of g.sets) for (let j = 0; j < set.ids.length; j++) { const v = set.ids[j], w = set.ws[j]; sc.P[v * 3] = set.base[j * 3] + dl[0] * set.sign * w; sc.P[v * 3 + 1] = set.base[j * 3 + 1] + dl[1] * w; sc.P[v * 3 + 2] = set.base[j * 3 + 2] + dl[2] * w; all.push(v); }
        touchNormals(all); return;
      }
      const hit = pick(ray); if (!hit) return;
      const R = radius(), a = s.last, b = hit.p, dist = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), step = R * 0.22;
      if (dist < step) return;
      const n = Math.min(12, Math.floor(dist / step));
      for (let k = 1; k <= n; k++) { const f = k / n, c = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; dab(c, hit.n, s.inv); mirrorDab(c, hit.n, s.inv); }
      s.last = b; showRing(hit);
    }
    function end() {
      const s = sc && sc.stroke; if (!s) return; sc.stroke = null;
      if (s.idx.length) pushUndo({ idx: Int32Array.from(s.idx), P: Float32Array.from(s.oP), VC: Float32Array.from(s.oC) });
      ctx.requestPanel();
    }

    const handler = {
      start(ray, e) {
        if (!sc || sc.busy) return false;
        const hit = pick(ray); if (!hit) return false;
        begin(hit, ray, e); return true;
      },
      move(ray) { if (sc) move(ray); },
      end() { end(); },
      tap() { /* ditangani start/end */ },
    };

    /* ----------------------------- tampilan kuas ----------------------------- */
    function showRing(hit) {
      const v = ctx.viewer(); if (!v || !sc) return;
      if (!hit) { v.setOverlays([]); return; }
      const F = sc.F, cw = ctx.toWorld(sc.o, hit.p);
      const q = F.inv; let nw = [q[0] * hit.n[0] + q[3] * hit.n[1] + q[6] * hit.n[2], q[1] * hit.n[0] + q[4] * hit.n[1] + q[7] * hit.n[2], q[2] * hit.n[0] + q[5] * hit.n[1] + q[8] * hit.n[2]];
      const nl = Math.hypot(nw[0], nw[1], nw[2]) || 1; nw = [nw[0] / nl, nw[1] / nl, nw[2] / nl];
      const ax = Math.abs(nw[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
      let u = [nw[1] * ax[2] - nw[2] * ax[1], nw[2] * ax[0] - nw[0] * ax[2], nw[0] * ax[1] - nw[1] * ax[0]]; const ul = Math.hypot(u[0], u[1], u[2]) || 1; u = [u[0] / ul, u[1] / ul, u[2] / ul];
      const w = [nw[1] * u[2] - nw[2] * u[1], nw[2] * u[0] - nw[0] * u[2], nw[0] * u[1] - nw[1] * u[0]];
      const Rw = radius() * F.sc, lines = [], seg = 48, lift = Rw * 0.02;
      const pt = (th) => [cw[0] + (u[0] * Math.cos(th) + w[0] * Math.sin(th)) * Rw + nw[0] * lift, cw[1] + (u[1] * Math.cos(th) + w[1] * Math.sin(th)) * Rw + nw[1] * lift, cw[2] + (u[2] * Math.cos(th) + w[2] * Math.sin(th)) * Rw + nw[2] * lift];
      for (let i = 0; i < seg; i++) { const a = pt((i / seg) * Math.PI * 2), b = pt(((i + 1) / seg) * Math.PI * 2); lines.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
      const list = [{ lines, color: [1, 0.85, 0.4, 1] }];
      if (sc.p.sym) { const m = [-hit.p[0], hit.p[1], hit.p[2]], mw = ctx.toWorld(sc.o, m), l2 = []; for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2, b = ((i + 1) / seg) * Math.PI * 2; const f = (th) => [mw[0] + (u[0] * Math.cos(th) + w[0] * Math.sin(th)) * Rw, mw[1] + (u[1] * Math.cos(th) + w[1] * Math.sin(th)) * Rw, mw[2] + (u[2] * Math.cos(th) + w[2] * Math.sin(th)) * Rw]; const p1 = f(a), p2 = f(b); l2.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]); } list.push({ lines: l2, color: [0.6, 0.8, 1, 0.8] }); }
      v.setOverlays(list);
    }
    function hover(e) {
      if (!sc || sc.stroke) return;
      hoverEv = e; if (hoverRaf) return;
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0; if (!sc || !hoverEv || sc.stroke) return;
        const v = ctx.viewer(); const hit = pick(v.rayFromClient(hoverEv.clientX, hoverEv.clientY)); showRing(hit || null);
      });
    }
    function refreshView() { /* tidak ada overlay objek saat Sculpt */ }
    const geoFor = () => null;

    /* ----------------------------- remesh ----------------------------- */
    async function job(label, op, args, post) {
      if (!sc || sc.busy) return;
      const s = sc; s.busy = true; ctx.toast(label + '...'); ctx.requestPanel();
      try {
        const res = await SO.run(op, args);
        if (sc !== s) return;
        const before = takeFull();
        s.P = Float32Array.from(res.P); s.T = res.T; s.C = res.C; s.pal = res.pal || s.pal; s.VC = res.VC || s.VC;
        if (s.T.length / 3 > MAX_TRI) { putFull(before); ctx.toast('Hasil terlalu besar. Dibatalkan.'); return; }
        prepare(); sendMesh(); s.undo.push({ full: before }); if (s.undo.length > 30) s.undo.shift(); s.redo = []; s.touched = true;
        if (post) post(res);
        ctx.toast(label + ' selesai: ' + (s.T.length / 3).toLocaleString('id-ID') + ' segitiga.');
      } catch (err) { ctx.toast('Gagal: ' + err.message); }
      finally { if (sc === s) { s.busy = false; ctx.requestPanel(); } }
    }
    const curMesh = () => ({ P: sc.P, T: sc.T, C: sc.C, pal: sc.pal, VC: sc.VC });
    const ops = {
      refine() { job('Tambah detail', 'refine', { mesh: curMesh(), maxEdge: (sc.p.maxEdge / 100) * sc.bbR * 2, maxTris: MAX_TRI }, null).then(() => { if (sc && !sc.busy) relaxAll(1, true); }); },
      decimate() { const n = Math.max(12, Math.round((sc.T.length / 3) * (sc.p.target / 100))); job('Turunkan detail', 'decimate', { mesh: curMesh(), target: n }); },
      smoothAll() { relaxAll(sc.p.relaxIters); },
      fill() { if (!sc || sc.busy) return; const col = SO.hexRGB(sc.p.color), VC = sc.VC; const idx = [], oC = [], oP = []; for (let v = 0; v < VC.length / 3; v++) { idx.push(v); oC.push(VC[v * 3], VC[v * 3 + 1], VC[v * 3 + 2]); oP.push(sc.P[v * 3], sc.P[v * 3 + 1], sc.P[v * 3 + 2]); VC[v * 3] = col[0]; VC[v * 3 + 1] = col[1]; VC[v * 3 + 2] = col[2]; } pushUndo({ idx: Int32Array.from(idx), P: Float32Array.from(oP), VC: Float32Array.from(oC) }); sc.painted = true; sc.dirtyCol = true; schedule(); },
    };
    function relaxAll(iters, quiet) {
      if (!sc || sc.busy) return;
      const s = sc, before = takeFull(); s.busy = true;
      SO.run('relax', { mesh: { P: s.P, T: s.T, C: s.C, pal: s.pal, VC: s.VC }, iters, lambda: 0.5 }).then((res) => {
        if (sc !== s) return;
        s.P = Float32Array.from(res.P); prepare(); sendMesh(); s.undo.push({ full: { P: before.P, T: before.T, C: before.C, pal: before.pal, VC: before.VC, painted: before.painted } }); s.redo = []; s.touched = true;
        if (!quiet) ctx.toast('Mesh dihaluskan.');
      }).catch((err) => ctx.toast('Gagal: ' + err.message)).finally(() => { if (sc === s) { s.busy = false; ctx.requestPanel(); } });
    }

    /* ----------------------------- panel ----------------------------- */
    function renderPanel(box) {
      if (!sc) return;
      const p = sc.p;
      const btn = (text, fn, title, cls) => { const b = el('button', { type: 'button', class: 'chip ' + (cls || ''), text, title: title || '', onclick: fn }); if (sc.busy) b.disabled = true; return b; };
      const rng = (label, key, min, max, step, fmt) => { const out = el('span', { class: 'rv', text: fmt(p[key]) }); const inp = el('input', { type: 'range', min, max, step, value: p[key], 'aria-label': label }); inp.addEventListener('input', () => { p[key] = parseFloat(inp.value); out.textContent = fmt(p[key]); }); return el('label', { class: 'nf' }, [el('span', { text: label }), inp, out]); };
      const num = (label, key, min, max, step) => { const inp = el('input', { type: 'number', min, max, step, value: p[key], inputMode: 'decimal', 'aria-label': label }); inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (isFinite(v)) p[key] = Math.max(min, Math.min(max, v)); }); return el('label', { class: 'nf' }, [el('span', { text: label }), inp]); };
      box.appendChild(el('h3', { text: 'Sculpt Mode' }));
      box.appendChild(el('p', { class: 'hint', text: 'Objek: ' + sc.o.name + '. Seret di badan model untuk memahat; Ctrl + seret membalik arah kuas. Seret di luar model untuk memutar kamera.' }));
      box.appendChild(el('div', { class: 'seg', role: 'group', 'aria-label': 'Kuas' }, BRUSHES.map(([k, t]) => el('button', { type: 'button', class: 'chip', text: t, 'aria-pressed': String(p.brush === k), onclick: () => { p.brush = k; ctx.requestPanel(); } }))));
      box.appendChild(rng('Ukuran kuas', 'radius', 0.02, 0.6, 0.01, (v) => Math.round(v * 100) + '%'));
      box.appendChild(rng('Kekuatan', 'strength', 0.05, 1, 0.05, (v) => Math.round(v * 100) + '%'));
      const sym = el('input', { type: 'checkbox' }); sym.checked = !!p.sym; sym.addEventListener('change', () => { p.sym = sym.checked; });
      box.appendChild(el('label', { class: 'nf chk' }, [sym, el('span', { text: 'Simetri sumbu X (X)' })]));
      box.appendChild(el('h3', { text: 'Warna' }));
      const col = el('input', { type: 'color', value: p.color, 'aria-label': 'Warna kuas' }); col.addEventListener('input', () => { p.color = col.value; });
      box.appendChild(el('label', { class: 'nf' }, [el('span', { text: 'Warna kuas (pakai kuas Cat warna)' }), col]));
      box.appendChild(el('div', { class: 'chiprow' }, [btn('Isi semua dengan warna ini', ops.fill)]));
      box.appendChild(el('p', { class: 'hint', text: 'Saat selesai, warna dibulatkan ke maksimal 24 warna per objek. Untuk gradasi halus, cat tekstur di model (editor UV).' }));
      box.appendChild(el('h3', { text: 'Detail mesh' }));
      box.appendChild(el('p', { class: 'hint', text: 'Segitiga: ' + (sc.T.length / 3).toLocaleString('id-ID') + ', titik: ' + (sc.P.length / 3).toLocaleString('id-ID') + (sc.busy ? '. Sedang memproses...' : '') }));
      box.appendChild(num('Tepi terpanjang (% ukuran model)', 'maxEdge', 0.3, 30, 0.5)); box.appendChild(btn('Tambah detail', ops.refine, 'Membagi tepi panjang agar kuas bisa membuat detail halus'));
      box.appendChild(num('Sisakan segitiga (%)', 'target', 2, 95, 1)); box.appendChild(btn('Turunkan detail', ops.decimate, 'Mengurangi segitiga dengan menjaga bentuk'));
      box.appendChild(num('Haluskan semua: ulangan', 'relaxIters', 1, 10, 1)); box.appendChild(btn('Haluskan semua', ops.smoothAll, 'Meratakan permukaan seluruh mesh'));
      box.appendChild(el('div', { class: 'chiprow' }, [btn('Batal (Ctrl+Z)', undo), btn('Ulang', redo), btn('Selesai (Tab)', () => exit(true), 'Simpan hasil pahat', 'primary'), btn('Buang perubahan', () => { if (sc.undo.length && !confirm('Buang semua perubahan pahat?')) return; exit(false); })]));
      box.appendChild(el('p', { class: 'hint', text: 'Pintasan: D tarik, S haluskan, I gembung, F ratakan, P cubit, G geser, C cat, X simetri, [ ] ukuran kuas, Shift+[ ] kekuatan, Tab selesai.' }));
    }

    /* ----------------------------- papan ketik ----------------------------- */
    function onKey(e) {
      if (!sc) return false;
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      if (k === 'tab') { exit(true); return true; }
      if (mod && k === 'z') { if (e.shiftKey) redo(); else undo(); return true; }
      if (mod && k === 'y') { redo(); return true; }
      if (mod) return false;
      if (KEYS[k]) { sc.p.brush = KEYS[k]; ctx.requestPanel(); return true; }
      if (k === 'x') { sc.p.sym = !sc.p.sym; ctx.requestPanel(); return true; }
      if (e.key === '[' || e.key === '{') { if (e.shiftKey) sc.p.strength = Math.max(0.05, sc.p.strength - 0.05); else sc.p.radius = Math.max(0.02, sc.p.radius * 0.9); ctx.requestPanel(); return true; }
      if (e.key === ']' || e.key === '}') { if (e.shiftKey) sc.p.strength = Math.min(1, sc.p.strength + 0.05); else sc.p.radius = Math.min(0.6, sc.p.radius / 0.9); ctx.requestPanel(); return true; }
      return false;
    }

    return {
      enter, exit, handler, hover, renderPanel, onKey, geoFor, refreshView, undo, redo,
      isolated: true, label: 'Sculpt Mode',
      get active() { return !!sc; }, get oid() { return sc ? sc.oid : null; },
      _state: () => sc, _ops: ops, _dab: (c, n, brush, inv) => { sc.stroke = { kind: brush || sc.p.brush, seen: new Uint8Array(sc.P.length / 3), idx: [], oP: [], oC: [], inv: !!inv }; dab(c, n, !!inv); end(); }, _pick: pick,
    };
  }

  root.S3DSculpt = { create, BRUSHES };
})(typeof self !== 'undefined' ? self : this);
