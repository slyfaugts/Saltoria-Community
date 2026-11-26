/*
 * Saltoria 3D Studio — Paint Mode: cat tekstur langsung di model + editor UV.
 * Objek dibuka-lipat (unwrap otomatis bila belum punya UV). Hanya objek ini yang tampil selama sesi.
 */
(function (root) {
  'use strict';
  const UVm = root.S3DUV, SO = root.S3DSculptOps, MO = root.S3DMeshOps;
  const SIZES = [256, 512, 1024, 2048];

  function create(ctx) {
    const el = ctx.el;
    let ps = null, raf = 0, hoverRaf = 0, hoverEv = null;
    const lastP = { tool: 'paint', color: '#e8433c', radius: 0.08, opacity: 0.8, hardness: 0.6, size: 512, angle: 55, checker: false };

    function frame(o) {
      const t = ctx.toWorld(o, [0, 0, 0]), ex = ctx.toWorld(o, [1, 0, 0]), ey = ctx.toWorld(o, [0, 1, 0]), ez = ctx.toWorld(o, [0, 0, 1]);
      const M = [ex[0] - t[0], ey[0] - t[0], ez[0] - t[0], ex[1] - t[1], ey[1] - t[1], ez[1] - t[1], ex[2] - t[2], ey[2] - t[2], ez[2] - t[2]];
      const [a, b, c, d, e, f, g, h, i] = M, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C || 1e-12;
      const inv = [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
      return { M, inv, t, sc: (Math.hypot(a, d, g) + Math.hypot(b, e, h) + Math.hypot(c, f, i)) / 3 };
    }
    const mkCanvas = (S) => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
    const fillCanvas = (cv, rgba) => { const g = cv.getContext('2d'); g.putImageData(new ImageData(rgba, cv.width, cv.height), 0, 0); };
    const readCanvas = (cv) => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);

    function bbox() {
      const P = ps.res.P; let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { const v = P[i + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
      ps.bbR = Math.max(1e-6, Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2);
    }
    function worldArrays() {
      const r = ps.res, F = ps.F, nV = r.P.length / 3; ps.wpos = new Float32Array(nV * 3); ps.wnor = new Float32Array(nV * 3);
      for (let v = 0; v < nV; v++) {
        const i = v * 3, x = r.P[i], y = r.P[i + 1], z = r.P[i + 2], M = F.M;
        ps.wpos[i] = M[0] * x + M[1] * y + M[2] * z + F.t[0]; ps.wpos[i + 1] = M[3] * x + M[4] * y + M[5] * z + F.t[1]; ps.wpos[i + 2] = M[6] * x + M[7] * y + M[8] * z + F.t[2];
        const nx = r.N[i], ny = r.N[i + 1], nz = r.N[i + 2], q = F.inv;
        const ox = q[0] * nx + q[3] * ny + q[6] * nz, oy = q[1] * nx + q[4] * ny + q[7] * nz, oz = q[2] * nx + q[5] * ny + q[8] * nz, l = Math.hypot(ox, oy, oz) || 1;
        ps.wnor[i] = ox / l; ps.wnor[i + 1] = oy / l; ps.wnor[i + 2] = oz / l;
      }
    }
    function checkerCanvas() {
      const c = mkCanvas(512), g = c.getContext('2d'); g.fillStyle = '#e8ecf5'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#3a4a78';
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2 === 0) g.fillRect(x * 32, y * 32, 32, 32);
      return c;
    }
    function sendMesh() {
      const v = ctx.viewer(); if (!v) return;
      const r = ps.res, nV = r.P.length / 3; let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < nV; i++) for (let a = 0; a < 3; a++) { const q = ps.wpos[i * 3 + a]; if (q < mn[a]) mn[a] = q; if (q > mx[a]) mx[a] = q; }
      v.setVertexColors(null);
      v.setMesh({ positions: ps.wpos, normals: ps.wnor, uvs: r.UV, indices: r.T, min: mn, max: mx }, ps.p.checker ? checkerCanvas() : ps.canvas, undefined, true);
    }
    function flush() { raf = 0; const v = ctx.viewer(); if (!ps || !v) return; if (ps.dirty) { ps.dirty = false; if (!ps.p.checker) v.setTexture(ps.canvas); } }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(flush); };

    /* ----------------------------- sesi ----------------------------- */
    function enter(o) {
      if (ps) return false;
      let res, canvas, S, src = null;
      try {
        const have = ctx.uvMeshOf(o);
        if (have) {
          const cc = UVm.chartsOf(have.T);
          res = { P: Float32Array.from(have.P), T: Uint32Array.from(have.T), UV: Float32Array.from(have.UV), N: Float32Array.from(have.N), C: have.C, pal: have.pal, chartOf: cc.chartOf, charts: cc.charts, size: have.S };
          S = have.S; canvas = mkCanvas(S); canvas.getContext('2d').drawImage(have.canvas, 0, 0);
        } else {
          src = ctx.surfaceOf(o); if (!src || !src.T.length) { ctx.toast('Objek ini tidak punya permukaan untuk dicat.'); return false; }
          if (src.T.length / 3 > 200000) { ctx.toast('Mesh terlalu besar untuk cat tekstur. Turunkan detail dulu.'); return false; }
          S = lastP.size; res = UVm.unwrap(src, { size: S, angle: lastP.angle });
          canvas = mkCanvas(S); const b = UVm.bake(res, S, o.tint || o.color); UVm.dilate(b.rgba, b.mask, S, 4); fillCanvas(canvas, b.rgba);
        }
      } catch (e) { ctx.toast('Tidak bisa membuka Paint Mode: ' + e.message); return false; }
      ps = { oid: o.id, o, res, S, canvas, src, F: frame(o), p: lastP, undo: [], redo: [], touched: false, dirty: false, stroke: null, sel: -1, mask: UVm.coverage(res, S), base: o.tint || o.color };
      lastP.size = S; lastP.checker = false;
      bbox(); worldArrays(); sendMesh();
      ctx.toast('Cat tekstur: hanya objek ini yang tampil. Seret di badan model untuk mengecat; seret di luar model untuk memutar kamera.');
      return true;
    }
    function exit(commit) {
      if (!ps) return;
      const s = ps; ps = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      const v = ctx.viewer(); if (v) v.setOverlays([]);
      if (commit && s.touched) {
        const rgba = readCanvas(s.canvas); UVm.dilate(rgba.data, s.mask, s.S, 4); s.canvas.getContext('2d').putImageData(rgba, 0, 0);
        ctx.commitPaint(s.o, { P: s.res.P, T: s.res.T, UV: s.res.UV, N: s.res.N, C: s.res.C, pal: s.res.pal, S: s.S, canvas: s.canvas });
      }
      ctx.onExit();
    }

    /* ----------------------------- undo (potret kanvas) ----------------------------- */
    const maxUndo = () => Math.max(4, Math.min(20, Math.floor(80000000 / (ps.S * ps.S * 4))));
    function snap() { return { S: ps.S, img: readCanvas(ps.canvas), UV: Float32Array.from(ps.res.UV) }; }
    function putSnap(sn) {
      ps.res.UV.set(sn.UV); ps.canvas.getContext('2d').putImageData(sn.img, 0, 0); ps.mask = UVm.coverage(ps.res, ps.S);
      ps.dirty = true; sendMesh(); schedule(); drawPreview();
    }
    function pushUndo(sn) { ps.undo.push(sn); if (ps.undo.length > maxUndo()) ps.undo.shift(); ps.redo = []; ps.touched = true; }
    function undo() { if (!ps) return; const sn = ps.undo.pop(); if (!sn) { ctx.toast('Tidak ada yang bisa dibatalkan di Cat tekstur.'); return; } if (sn.S !== ps.S) { ctx.toast('Ukuran tekstur sudah berubah; langkah ini tidak bisa dibatalkan.'); return; } ps.redo.push(snap()); putSnap(sn); }
    function redo() { if (!ps) return; const sn = ps.redo.pop(); if (!sn || sn.S !== ps.S) return; ps.undo.push(snap()); putSnap(sn); }

    /* ----------------------------- sinar ----------------------------- */
    function localRay(ray) {
      const o = ctx.toLocal(ps.o, ray.o), q = ctx.toLocal(ps.o, [ray.o[0] + ray.d[0], ray.o[1] + ray.d[1], ray.o[2] + ray.d[2]]);
      const dx = q[0] - o[0], dy = q[1] - o[1], dz = q[2] - o[2], l = Math.hypot(dx, dy, dz) || 1; return { o, d: [dx / l, dy / l, dz / l] };
    }
    function pick(ray) {
      const r = localRay(ray), P = ps.res.P, T = ps.res.T, nT = T.length / 3, ox = r.o[0], oy = r.o[1], oz = r.o[2], dx = r.d[0], dy = r.d[1], dz = r.d[2];
      let best = Infinity, bt = -1, bu = 0, bv = 0;
      for (let t = 0; t < nT; t++) {
        const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
        const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-14 && det < 1e-14) continue;
        const inv = 1 / det, tx = ox - P[a], ty = oy - P[a + 1], tz = oz - P[a + 2], u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) continue;
        const tt = (e2x * qx + e2y * qy + e2z * qz) * inv; if (tt > 1e-9 && tt < best) { best = tt; bt = t; bu = u; bv = v; }
      }
      if (bt < 0) return null;
      const T3 = [T[bt * 3], T[bt * 3 + 1], T[bt * 3 + 2]], UV = ps.res.UV, w0 = 1 - bu - bv;
      const uu = UV[T3[0] * 2] * w0 + UV[T3[1] * 2] * bu + UV[T3[2] * 2] * bv, vv = UV[T3[0] * 2 + 1] * w0 + UV[T3[1] * 2 + 1] * bu + UV[T3[2] * 2 + 1] * bv;
      // texel per satuan lokal: akar (luas UV piksel / luas 3D)
      const a = T3[0] * 3, b = T3[1] * 3, c = T3[2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const A3 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      const a2 = Math.abs((UV[T3[1] * 2] - UV[T3[0] * 2]) * (UV[T3[2] * 2 + 1] - UV[T3[0] * 2 + 1]) - (UV[T3[2] * 2] - UV[T3[0] * 2]) * (UV[T3[1] * 2 + 1] - UV[T3[0] * 2 + 1])) / 2;
      const tpu = Math.sqrt((a2 * ps.S * ps.S) / Math.max(A3, 1e-12));
      return { t: bt, tri: bt, p: [ox + dx * best, oy + dy * best, oz + dz * best], u: uu, v: vv, tpu, chart: ps.res.chartOf[bt] };
    }

    /* ----------------------------- kuas ----------------------------- */
    function stamp(h) {
      const g = ps.canvas.getContext('2d'), p = ps.p, r = Math.max(1, p.radius * ps.bbR * h.tpu), x = h.u * ps.S, y = h.v * ps.S;
      const hex = p.tool === 'erase' ? ps.base : p.color, col = SO.hexRGB(hex).map((v) => Math.round(v * 255));
      const grad = g.createRadialGradient(x, y, r * p.hardness, x, y, r);
      grad.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (p.opacity * 0.35).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      ps.dirty = true; schedule();
    }
    function pipette(h) {
      const d = ps.canvas.getContext('2d').getImageData(Math.max(0, Math.min(ps.S - 1, Math.floor(h.u * ps.S))), Math.max(0, Math.min(ps.S - 1, Math.floor(h.v * ps.S))), 1, 1).data;
      ps.p.color = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join(''); ps.p.tool = 'paint'; ctx.toast('Warna diambil: ' + ps.p.color); ctx.requestPanel();
    }
    function strokeTo(h) {
      const s = ps.stroke, last = s.last;
      if (last && last.chart === h.chart) {
        const r = Math.max(1, ps.p.radius * ps.bbR * h.tpu), dist = Math.hypot((h.u - last.u) * ps.S, (h.v - last.v) * ps.S), step = Math.max(1, r * 0.25), n = Math.min(60, Math.floor(dist / step));
        for (let k = 1; k <= n; k++) { const f = k / n; stamp({ u: last.u + (h.u - last.u) * f, v: last.v + (h.v - last.v) * f, tpu: h.tpu }); }
      } else stamp(h);
      s.last = h;
    }
    const handler = {
      start(ray, e) {
        if (!ps) return false; const h = pick(ray); if (!h) return false;
        if (ps.p.tool === 'pipet' || e.altKey) { pipette(h); return true; }
        ps.stroke = { before: snap(), last: null, moved: false }; strokeTo(h); showRing(h); return true;
      },
      move(ray) { if (!ps || !ps.stroke) return; const h = pick(ray); if (h) { strokeTo(h); showRing(h); } },
      end() { if (!ps || !ps.stroke) return; const s = ps.stroke; ps.stroke = null; pushUndo(s.before); drawPreview(); ctx.requestPanel(); },
      tap() {},
    };
    function showRing(h) {
      const v = ctx.viewer(); if (!v || !ps) return;
      if (!h) { v.setOverlays([]); return; }
      const F = ps.F, c = ctx.toWorld(ps.o, h.p), Rw = ps.p.radius * ps.bbR * F.sc, seg = 40, lines = [];
      const cam = v.getCamera(), R = cam.R, U = cam.Up;
      for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2, b = ((i + 1) / seg) * Math.PI * 2; const f = (t) => [c[0] + (R[0] * Math.cos(t) + U[0] * Math.sin(t)) * Rw, c[1] + (R[1] * Math.cos(t) + U[1] * Math.sin(t)) * Rw, c[2] + (R[2] * Math.cos(t) + U[2] * Math.sin(t)) * Rw]; const p1 = f(a), p2 = f(b); lines.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]); }
      v.setOverlays([{ lines, color: [1, 0.85, 0.4, 1] }]);
    }
    function hover(e) {
      if (!ps || ps.stroke) return; hoverEv = e; if (hoverRaf) return;
      hoverRaf = requestAnimationFrame(() => { hoverRaf = 0; if (!ps || !hoverEv || ps.stroke) return; const v = ctx.viewer(); showRing(pick(v.rayFromClient(hoverEv.clientX, hoverEv.clientY))); });
    }
    const refreshView = () => {};
    const geoFor = () => null;

    /* ----------------------------- editor UV ----------------------------- */
    function applyUV(oldUV, label) {
      // isi tekstur lama dipindahkan mengikuti UV baru (segitiga demi segitiga)
      const old = readCanvas(ps.canvas), r = UVm.remap(oldUV, ps.res.T, ps.res.UV, ps.res.T, old.data, ps.S, ps.S, SO.hexRGB(ps.base).map((v) => Math.round(v * 255)));
      ps.mask = r.mask; UVm.dilate(r.rgba, r.mask, ps.S, 4); fillCanvas(ps.canvas, r.rgba); ps.dirty = true; ps.touched = true; sendMesh(); schedule(); drawPreview();
      void label;
    }
    function uvOp(label, fn) {
      if (!ps || ps.sel < 0) { ctx.toast('Klik sebuah chart di panel UV dulu.'); return; }
      const before = snap(), old = Float32Array.from(ps.res.UV);
      const b = UVm.chartBox(ps.res, ps.sel); UVm.transformChart(ps.res, ps.sel, (u, v) => fn(u - b.cx, v - b.cy, b));
      applyUV(old, label); pushUndo(before);
    }
    const rot90 = () => uvOp('Putar', (x, y, b) => [b.cx - y, b.cy + x]);
    const flipU = () => uvOp('Cermin', (x, y, b) => [b.cx - x, b.cy + y]);
    const scaleSel = (k) => uvOp('Skala', (x, y, b) => [b.cx + x * k, b.cy + y * k]);
    function repack() {
      if (!ps) return; const before = snap(), old = Float32Array.from(ps.res.UV), S = ps.S, r = ps.res;
      const boxes = r.charts.map((c, i) => { const b = UVm.chartBox(r, i); return { id: i, b, w: (b.x1 - b.x0) * S, h: (b.y1 - b.y0) * S }; });
      const items = boxes.map((q) => ({ w: q.w, h: q.h, q }));
      const s = UVm.packCharts(items, S, 4);
      for (const it of items) { const q = it.q; UVm.transformChart(r, q.id, (u, v) => [(it.px + (u - q.b.x0) * S * s) / S, (it.py + (v - q.b.y0) * S * s) / S]); }
      applyUV(old, 'Susun'); pushUndo(before);
    }
    function reunwrap() {
      if (!ps) return;
      const S2 = ps.p.size, before = snap(), oldUV = Float32Array.from(ps.res.UV), oldT = ps.res.T, oldS = ps.S, oldPix = readCanvas(ps.canvas).data;
      let src = ps.src;
      if (!src) { const w = MO.weld({ P: Float64Array.from(ps.res.P), T: ps.res.T, C: ps.res.C, pal: ps.res.pal }, 1e-7); src = w; }
      if (src.T.length !== oldT.length) { ctx.toast('Unwrap ulang butuh urutan segitiga yang sama; coba dari objek asli.'); return; }
      const res = UVm.unwrap(src, { size: S2, angle: ps.p.angle });
      const r = UVm.remap(oldUV, oldT, res.UV, res.T, oldPix, oldS, S2, SO.hexRGB(ps.base).map((v) => Math.round(v * 255)));
      ps.res = res; ps.S = S2; ps.canvas = mkCanvas(S2); ps.mask = r.mask; UVm.dilate(r.rgba, r.mask, S2, 4); fillCanvas(ps.canvas, r.rgba); ps.sel = -1;
      bbox(); worldArrays(); sendMesh(); ps.dirty = true; schedule(); ps.touched = true; ps.undo = []; ps.redo = []; void before; drawPreview(); ctx.requestPanel();
      ctx.toast('Unwrap ulang selesai (' + res.charts.length + ' chart). Riwayat undo dikosongkan.');
    }
    function fillAll() { const before = snap(), g = ps.canvas.getContext('2d'); g.fillStyle = ps.p.color; g.fillRect(0, 0, ps.S, ps.S); ps.dirty = true; pushUndo(before); schedule(); drawPreview(); }

    let prevCv = null, drag = null;
    function drawPreview() {
      if (!prevCv || !ps) return; const g = prevCv.getContext('2d'), W = prevCv.width, r = ps.res;
      g.clearRect(0, 0, W, W); g.fillStyle = '#10182e'; g.fillRect(0, 0, W, W); g.drawImage(ps.canvas, 0, 0, W, W);
      g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.45)'; g.beginPath();
      const nT = r.T.length / 3, step = nT > 30000 ? Math.ceil(nT / 30000) : 1;
      for (let t = 0; t < nT; t += step) { const a = r.T[t * 3] * 2, b = r.T[t * 3 + 1] * 2, c = r.T[t * 3 + 2] * 2; g.moveTo(r.UV[a] * W, r.UV[a + 1] * W); g.lineTo(r.UV[b] * W, r.UV[b + 1] * W); g.lineTo(r.UV[c] * W, r.UV[c + 1] * W); g.closePath(); }
      g.stroke();
      if (ps.sel >= 0 && r.charts[ps.sel]) { g.fillStyle = 'rgba(255,200,80,0.35)'; g.strokeStyle = '#ffc850'; g.beginPath(); for (const t of r.charts[ps.sel].tris) { const a = r.T[t * 3] * 2, b = r.T[t * 3 + 1] * 2, c = r.T[t * 3 + 2] * 2; g.moveTo(r.UV[a] * W, r.UV[a + 1] * W); g.lineTo(r.UV[b] * W, r.UV[b + 1] * W); g.lineTo(r.UV[c] * W, r.UV[c + 1] * W); g.closePath(); } g.fill(); g.stroke(); }
    }
    function bindPreview(cv) {
      prevCv = cv;
      const uvOf = (e) => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };
      cv.addEventListener('pointerdown', (e) => { if (!ps) return; const [u, v] = uvOf(e); const c = UVm.chartAt(ps.res, u, v); ps.sel = c; drawPreview(); if (c >= 0) { cv.setPointerCapture(e.pointerId); drag = { u, v, before: snap(), old: Float32Array.from(ps.res.UV) }; } });
      cv.addEventListener('pointermove', (e) => { if (!drag || !ps) return; const [u, v] = uvOf(e); const du = u - drag.u, dv = v - drag.v; drag.u = u; drag.v = v; UVm.transformChart(ps.res, ps.sel, (a, b) => [a + du, b + dv]); drag.moved = true; drawPreview(); });
      const up = () => { if (!drag || !ps) return; const d = drag; drag = null; if (d.moved) { applyUV(d.old, 'Geser'); pushUndo(d.before); } };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    }

    /* ----------------------------- panel ----------------------------- */
    function renderPanel(box) {
      if (!ps) return; const p = ps.p;
      const btn = (text, fn, title, cls) => el('button', { type: 'button', class: 'chip ' + (cls || ''), text, title: title || '', onclick: fn });
      const rng = (label, key, min, max, step, fmt) => { const out = el('span', { class: 'rv', text: fmt(p[key]) }); const inp = el('input', { type: 'range', min, max, step, value: p[key], 'aria-label': label }); inp.addEventListener('input', () => { p[key] = parseFloat(inp.value); out.textContent = fmt(p[key]); }); return el('label', { class: 'nf' }, [el('span', { text: label }), inp, out]); };
      box.appendChild(el('h3', { text: 'Cat tekstur' }));
      box.appendChild(el('p', { class: 'hint', text: 'Objek: ' + ps.o.name + '. Seret di badan model untuk mengecat. Alt + klik mengambil warna (pipet).' }));
      box.appendChild(el('div', { class: 'seg', role: 'group', 'aria-label': 'Alat cat' }, [['paint', 'Kuas'], ['erase', 'Hapus (kembali ke warna dasar)'], ['pipet', 'Pipet']].map(([k, t]) => el('button', { type: 'button', class: 'chip', text: t, 'aria-pressed': String(p.tool === k), onclick: () => { p.tool = k; ctx.requestPanel(); } }))));
      const col = el('input', { type: 'color', value: p.color, 'aria-label': 'Warna kuas' }); col.addEventListener('input', () => { p.color = col.value; });
      box.appendChild(el('label', { class: 'nf' }, [el('span', { text: 'Warna' }), col]));
      box.appendChild(rng('Ukuran kuas', 'radius', 0.01, 0.4, 0.005, (v) => Math.round(v * 100) + '%'));
      box.appendChild(rng('Kekuatan', 'opacity', 0.05, 1, 0.05, (v) => Math.round(v * 100) + '%'));
      box.appendChild(rng('Kekerasan tepi', 'hardness', 0, 0.95, 0.05, (v) => Math.round(v * 100) + '%'));
      box.appendChild(el('div', { class: 'chiprow' }, [btn('Isi seluruh tekstur', fillAll, 'Mengganti semua isi tekstur dengan warna ini')]));
      box.appendChild(el('h3', { text: 'Editor UV' }));
      box.appendChild(el('p', { class: 'hint', text: 'Chart: ' + ps.res.charts.length + ', tekstur ' + ps.S + '×' + ps.S + ' px. Klik chart untuk memilih, seret untuk memindahkan; isi cat ikut pindah.' }));
      const cv = el('canvas', { class: 'uvprev', width: 280, height: 280, 'aria-label': 'Tata letak UV' }); box.appendChild(cv); bindPreview(cv); drawPreview();
      box.appendChild(el('div', { class: 'chiprow' }, [btn('Putar 90°', rot90), btn('Cermin', flipU), btn('Perbesar', () => scaleSel(1.1)), btn('Perkecil', () => scaleSel(0.9)), btn('Susun ulang', repack, 'Menata ulang semua chart agar muat')]));
      const ck = el('input', { type: 'checkbox' }); ck.checked = !!p.checker; ck.addEventListener('change', () => { p.checker = ck.checked; sendMesh(); ps.dirty = !p.checker; schedule(); });
      box.appendChild(el('label', { class: 'nf chk' }, [ck, el('span', { text: 'Papan catur uji (lihat distorsi UV)' })]));
      const sz = el('select', { 'aria-label': 'Ukuran tekstur' }, SIZES.map((s) => el('option', { value: String(s), text: s + ' px' }))); sz.value = String(p.size); sz.addEventListener('change', () => { p.size = +sz.value; });
      box.appendChild(el('label', { class: 'nf' }, [el('span', { text: 'Ukuran tekstur' }), sz]));
      const ang = el('input', { type: 'number', min: 15, max: 89, step: 5, value: p.angle, 'aria-label': 'Sudut pemisah chart' }); ang.addEventListener('input', () => { const v = parseFloat(ang.value); if (isFinite(v)) p.angle = Math.max(15, Math.min(89, v)); });
      box.appendChild(el('label', { class: 'nf' }, [el('span', { text: 'Sudut pemisah chart (°)' }), ang]));
      box.appendChild(el('div', { class: 'chiprow' }, [btn('Unwrap ulang', reunwrap, 'Memecah ulang chart; cat dipertahankan')]));
      box.appendChild(el('p', { class: 'hint', text: 'Bila mesh diedit/dipahat lagi, cat tekstur dibuang (UV hilang). Lakukan cat sebagai langkah terakhir.' }));
      box.appendChild(el('div', { class: 'chiprow' }, [btn('Batal (Ctrl+Z)', undo), btn('Ulang', redo), btn('Selesai (Shift+P)', () => exit(true), 'Simpan cat', 'primary'), btn('Buang perubahan', () => { if (ps.touched && !confirm('Buang semua perubahan cat?')) return; exit(false); })]));
    }

    function onKey(e) {
      if (!ps) return false; const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      if (k === 'tab' || (e.shiftKey && k === 'p')) { exit(true); return true; }
      if (mod && k === 'z') { if (e.shiftKey) redo(); else undo(); return true; }
      if (mod && k === 'y') { redo(); return true; }
      if (mod) return false;
      if (k === 'b') { ps.p.tool = 'paint'; ctx.requestPanel(); return true; }
      if (k === 'e') { ps.p.tool = 'erase'; ctx.requestPanel(); return true; }
      if (k === 'o') { ps.p.tool = 'pipet'; ctx.requestPanel(); return true; }
      if (e.key === '[') { ps.p.radius = Math.max(0.01, ps.p.radius * 0.9); ctx.requestPanel(); return true; }
      if (e.key === ']') { ps.p.radius = Math.min(0.4, ps.p.radius / 0.9); ctx.requestPanel(); return true; }
      return false;
    }

    return {
      enter, exit, handler, hover, renderPanel, onKey, geoFor, refreshView, undo, redo,
      isolated: true, label: 'Cat tekstur',
      get active() { return !!ps; }, get oid() { return ps ? ps.oid : null; },
      _state: () => ps, _stamp: (h) => { stamp(h); }, _pick: pick, _ops: { rot90, flipU, scaleSel, repack, reunwrap, fillAll }, _select: (i) => { ps.sel = i; },
    };
  }

  root.S3DPaintMode = { create };
})(typeof self !== 'undefined' ? self : this);
