/*
 * Saltoria 3D Studio — UV: unwrap otomatis (chart + proyeksi bidang), pengepakan, rasterisasi segitiga, dilasi tepi, resample tekstur.
 * Murni data (tanpa DOM) agar bisa diuji di Node. Koordinat UV: u ke kanan, v ke bawah (sama dengan piksel kanvas), 0..1.
 */
(function (root) {
  'use strict';
  const SO = root.S3DSculptOps;
  const DEG = Math.PI / 180;

  function faceData(P, T) {
    const nT = T.length / 3, n = new Float32Array(nT * 3), A = new Float32Array(nT);
    for (let t = 0; t < nT; t++) {
      const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, l = Math.hypot(x, y, z);
      A[t] = l / 2; if (l > 0) { n[t * 3] = x / l; n[t * 3 + 1] = y / l; n[t * 3 + 2] = z / l; }
    }
    return { n, A };
  }

  // tetangga segitiga lewat tepi bersama
  function triNeighbors(T) {
    const nT = T.length / 3, map = new Map(), nb = Array.from({ length: nT }, () => []);
    for (let t = 0; t < nT; t++) for (let e = 0; e < 3; e++) {
      const a = T[t * 3 + e], b = T[t * 3 + (e + 1) % 3], k = a < b ? a * 4294967296 + b : b * 4294967296 + a;
      const o = map.get(k);
      if (o == null) map.set(k, t); else if (o >= 0) { nb[t].push(o); nb[o].push(t); map.set(k, -1); }
    }
    return nb;
  }

  // rect-packer rak: kembalikan tinggi yang dipakai, atau Infinity bila ada yang tidak muat
  function shelf(rects, size, place) {
    let x = 0, y = 0, rowH = 0;
    for (const r of rects) {
      if (r.w > size || r.h > size) return Infinity;
      if (x + r.w > size) { x = 0; y += rowH; rowH = 0; }
      if (place) { r.px = x; r.py = y; }
      x += r.w; if (r.h > rowH) rowH = r.h;
    }
    return y + rowH;
  }
  function packCharts(charts, size, marginPx) {
    const order = charts.slice().sort((a, b) => b.h - a.h);
    let area = 0; for (const c of charts) area += c.w * c.h;
    let lo = 0, hi = size / Math.sqrt(Math.max(area, 1e-12)) * 1.5, best = 0;
    for (let it = 0; it < 28; it++) {
      const s = (lo + hi) / 2;
      const rects = order.map((c) => ({ w: Math.ceil(c.w * s) + 2 * marginPx, h: Math.ceil(c.h * s) + 2 * marginPx }));
      if (shelf(rects, size, false) <= size) { best = s; lo = s; } else hi = s;
    }
    const rects = order.map((c) => ({ c, w: Math.ceil(c.w * best) + 2 * marginPx, h: Math.ceil(c.h * best) + 2 * marginPx }));
    shelf(rects, size, true);
    for (const r of rects) { r.c.px = r.px + marginPx; r.c.py = r.py + marginPx; r.c.s = best; }
    return best;
  }

  /*
   * unwrap(mesh{P,T,C?,pal?}, {angle, size, margin}) →
   * { P, T, UV, N, C, pal, chartOf, charts:[{id, tris[]}], size }  (titik dipecah di batas chart)
   */
  function unwrap(mesh, opts) {
    opts = opts || {};
    const angle = (opts.angle == null ? 55 : opts.angle) * DEG, size = opts.size || 512, margin = opts.margin == null ? 4 : opts.margin, crease = (opts.crease == null ? 50 : opts.crease) * DEG;
    const P = mesh.P, T = mesh.T, nT = T.length / 3, nV = P.length / 3;
    const { n, A } = faceData(P, T), nb = triNeighbors(T), cosA = Math.cos(angle);
    const chartOf = new Int32Array(nT).fill(-1), charts = [];
    const order = Array.from({ length: nT }, (_, i) => i).sort((a, b) => A[b] - A[a]);
    for (const s of order) {
      if (chartOf[s] >= 0 || A[s] <= 0) continue;
      const id = charts.length, tris = [s], stack = [s]; chartOf[s] = id;
      const sx = n[s * 3], sy = n[s * 3 + 1], sz = n[s * 3 + 2];
      while (stack.length) {
        const t = stack.pop();
        for (const u of nb[t]) if (chartOf[u] < 0 && A[u] > 0 && n[u * 3] * sx + n[u * 3 + 1] * sy + n[u * 3 + 2] * sz >= cosA) { chartOf[u] = id; tris.push(u); stack.push(u); }
      }
      charts.push({ id, tris, N: [sx, sy, sz] });
    }
    // segitiga degenerate (luas 0): satu chart kecil sendiri
    for (let t = 0; t < nT; t++) if (chartOf[t] < 0) { chartOf[t] = charts.length; charts.push({ id: charts.length, tris: [t], N: [0, 0, 1] }); }

    // proyeksi tiap chart + putar agar kotak pembatas minimal
    const outIdx = new Map(), oP = [], oSrc = [], oChart = [], T2 = new Uint32Array(nT * 3), pos2 = [];
    for (const ch of charts) {
      const N = ch.N, h = Math.abs(N[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
      let t1 = [N[1] * h[2] - N[2] * h[1], N[2] * h[0] - N[0] * h[2], N[0] * h[1] - N[1] * h[0]]; const l1 = Math.hypot(t1[0], t1[1], t1[2]) || 1; t1 = [t1[0] / l1, t1[1] / l1, t1[2] / l1];
      const t2 = [N[1] * t1[2] - N[2] * t1[1], N[2] * t1[0] - N[0] * t1[2], N[0] * t1[1] - N[1] * t1[0]];
      const loc = new Map(), pts = [];
      for (const t of ch.tris) for (let c = 0; c < 3; c++) {
        const v = T[t * 3 + c], key = ch.id * 4294967296 + v; let id = outIdx.get(key);
        if (id == null) { id = oSrc.length; outIdx.set(key, id); oSrc.push(v); oChart.push(ch.id); const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; oP.push(p[0], p[1], p[2]); pos2.push([p[0] * t1[0] + p[1] * t1[1] + p[2] * t1[2], p[0] * t2[0] + p[1] * t2[1] + p[2] * t2[2]]); }
        T2[t * 3 + c] = id; if (!loc.has(id)) { loc.set(id, 1); pts.push(id); }
      }
      let bestA = Infinity, bestR = 0;
      for (let a = 0; a < 90; a += 5) {
        const co = Math.cos(a * DEG), si = Math.sin(a * DEG); let x0 = 1e30, x1 = -1e30, y0 = 1e30, y1 = -1e30;
        for (const id of pts) { const q = pos2[id], x = q[0] * co - q[1] * si, y = q[0] * si + q[1] * co; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const ar = (x1 - x0) * (y1 - y0); if (ar < bestA) { bestA = ar; bestR = a; }
      }
      const co = Math.cos(bestR * DEG), si = Math.sin(bestR * DEG); let x0 = 1e30, y0 = 1e30, x1 = -1e30, y1 = -1e30;
      for (const id of pts) { const q = pos2[id]; const x = q[0] * co - q[1] * si, y = q[0] * si + q[1] * co; q[0] = x; q[1] = y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      for (const id of pts) { pos2[id][0] -= x0; pos2[id][1] -= y0; }
      ch.w = Math.max(x1 - x0, 1e-9); ch.h = Math.max(y1 - y0, 1e-9); ch.pts = pts;
    }
    const s = packCharts(charts, size, margin);
    const nV2 = oSrc.length, UV = new Float32Array(nV2 * 2), chartVert = new Int32Array(nV2);
    for (const ch of charts) for (const id of ch.pts) { UV[id * 2] = (ch.px + pos2[id][0] * ch.s) / size; UV[id * 2 + 1] = (ch.py + pos2[id][1] * ch.s) / size; chartVert[id] = ch.id; }

    // normal: tiap titik terpecah memakai rata-rata muka sekitarnya yang searah (lipatan tajam tetap tajam)
    const adj = SO.buildAdj(nV, T), N2 = new Float32Array(nV2 * 3), cosC = Math.cos(crease);
    for (let i = 0; i < nV2; i++) {
      const v = oSrc[i], cid = oChart[i]; let rx = 0, ry = 0, rz = 0;
      for (let k = adj.tStart[v]; k < adj.tStart[v + 1]; k++) { const t = adj.tList[k]; if (chartOf[t] !== cid) continue; rx += n[t * 3] * A[t]; ry += n[t * 3 + 1] * A[t]; rz += n[t * 3 + 2] * A[t]; }
      let rl = Math.hypot(rx, ry, rz);
      if (rl < 1e-12) { // chart tidak memakai titik ini dengan luas berarti: pakai semua muka
        for (let k = adj.tStart[v]; k < adj.tStart[v + 1]; k++) { const t = adj.tList[k]; rx += n[t * 3]; ry += n[t * 3 + 1]; rz += n[t * 3 + 2]; } rl = Math.hypot(rx, ry, rz) || 1;
      }
      rx /= rl; ry /= rl; rz /= rl;
      let x = 0, y = 0, z = 0;
      for (let k = adj.tStart[v]; k < adj.tStart[v + 1]; k++) { const t = adj.tList[k]; if (n[t * 3] * rx + n[t * 3 + 1] * ry + n[t * 3 + 2] * rz >= cosC) { x += n[t * 3] * A[t]; y += n[t * 3 + 1] * A[t]; z += n[t * 3 + 2] * A[t]; } }
      const l = Math.hypot(x, y, z) || 1; N2[i * 3] = x / l; N2[i * 3 + 1] = y / l; N2[i * 3 + 2] = z / l;
    }
    return { P: Float32Array.from(oP), T: T2, UV, N: N2, C: mesh.C ? Uint16Array.from(mesh.C) : undefined, pal: mesh.pal, chartOf, chartVert, charts: charts.map((c) => ({ id: c.id, tris: c.tris, w: c.w, h: c.h })), size, scale: s };
  }

  // Rasterisasi segitiga UV ke buffer ukuran S×S; fn(x, y, t, b0, b1, b2) dipanggil untuk tiap piksel yang tertutup
  function rasterize(UV, T, S, fn, tris) {
    const nT = T.length / 3;
    const list = tris || null, count = list ? list.length : nT;
    for (let k = 0; k < count; k++) {
      const t = list ? list[k] : k;
      const ax = UV[T[t * 3] * 2] * S, ay = UV[T[t * 3] * 2 + 1] * S, bx = UV[T[t * 3 + 1] * 2] * S, by = UV[T[t * 3 + 1] * 2 + 1] * S, cx = UV[T[t * 3 + 2] * 2] * S, cy = UV[T[t * 3 + 2] * 2 + 1] * S;
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5)), x1 = Math.min(S - 1, Math.ceil(Math.max(ax, bx, cx) + 0.5));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5)), y1 = Math.min(S - 1, Math.ceil(Math.max(ay, by, cy) + 0.5));
      const eps = -0.5 / Math.sqrt(Math.abs(den));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, w2 = 1 - w0 - w1;
        if (w0 >= eps && w1 >= eps && w2 >= eps) fn(x, y, t, w0, w1, w2);
      }
    }
  }

  // warna per segitiga (C+pal, atau satu warna dasar) → RGBA S×S; mask 1 = tertutup chart
  function bake(res, S, baseHex) {
    const rgba = new Uint8ClampedArray(S * S * 4), mask = new Uint8Array(S * S);
    const b = SO.hexRGB(baseHex || '#ffffff').map((v) => Math.round(v * 255)), pal = res.pal ? res.pal.map((h) => SO.hexRGB(h).map((v) => Math.round(v * 255))) : null;
    for (let i = 0; i < S * S; i++) { rgba[i * 4] = b[0]; rgba[i * 4 + 1] = b[1]; rgba[i * 4 + 2] = b[2]; rgba[i * 4 + 3] = 255; }
    rasterize(res.UV, res.T, S, (x, y, t) => {
      const i = y * S + x; mask[i] = 1;
      const c = pal && res.C ? pal[res.C[t]] || b : b; rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2];
    });
    return { rgba, mask };
  }
  function coverage(res, S) { const mask = new Uint8Array(S * S); rasterize(res.UV, res.T, S, (x, y) => { mask[y * S + x] = 1; }); return mask; }

  // perluas warna dari piksel tertutup ke piksel kosong sebanyak `iters` langkah (menghindari garis celah di tepi chart)
  function dilate(rgba, mask, S, iters) {
    let cur = Uint8Array.from(mask);
    for (let it = 0; it < iters; it++) {
      const nxt = Uint8Array.from(cur), src = new Uint8ClampedArray(rgba);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = y * S + x; if (cur[i]) continue;
        let r = 0, g = 0, b = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= S || yy >= S) continue; const j = yy * S + xx; if (cur[j]) { r += src[j * 4]; g += src[j * 4 + 1]; b += src[j * 4 + 2]; c++; } }
        if (c) { rgba[i * 4] = r / c; rgba[i * 4 + 1] = g / c; rgba[i * 4 + 2] = b / c; nxt[i] = 1; }
      }
      cur = nxt;
    }
  }

  // Salin isi tekstur lama ke susunan UV baru, segitiga demi segitiga. rgbaOld: S1×S1, hasil: S2×S2.
  function remap(oldUV, oldT, newUV, newT, rgbaOld, S1, S2, fill) {
    const out = new Uint8ClampedArray(S2 * S2 * 4);
    const f = fill || [255, 255, 255];
    for (let i = 0; i < S2 * S2; i++) { out[i * 4] = f[0]; out[i * 4 + 1] = f[1]; out[i * 4 + 2] = f[2]; out[i * 4 + 3] = 255; }
    const mask = new Uint8Array(S2 * S2);
    rasterize(newUV, newT, S2, (x, y, t, w0, w1, w2) => {
      const a = oldT[t * 3] * 2, b = oldT[t * 3 + 1] * 2, c = oldT[t * 3 + 2] * 2;
      const u = (oldUV[a] * w0 + oldUV[b] * w1 + oldUV[c] * w2) * S1 - 0.5, v = (oldUV[a + 1] * w0 + oldUV[b + 1] * w1 + oldUV[c + 1] * w2) * S1 - 0.5;
      const x0 = Math.max(0, Math.min(S1 - 1, Math.floor(u))), y0 = Math.max(0, Math.min(S1 - 1, Math.floor(v))), x1 = Math.min(S1 - 1, x0 + 1), y1 = Math.min(S1 - 1, y0 + 1);
      const fx = Math.max(0, Math.min(1, u - x0)), fy = Math.max(0, Math.min(1, v - y0)), o = (y * S2 + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const p00 = rgbaOld[(y0 * S1 + x0) * 4 + ch], p10 = rgbaOld[(y0 * S1 + x1) * 4 + ch], p01 = rgbaOld[(y1 * S1 + x0) * 4 + ch], p11 = rgbaOld[(y1 * S1 + x1) * 4 + ch];
        out[o + ch] = (p00 * (1 - fx) + p10 * fx) * (1 - fy) + (p01 * (1 - fx) + p11 * fx) * fy;
      }
      mask[y * S2 + x] = 1;
    });
    return { rgba: out, mask };
  }

  // hasil unwrap → titik per chart berubah: transformasi chart (geser/putar/skala/cermin) di ruang UV
  function transformChart(res, cid, fn) {
    const seen = new Set();
    for (const t of res.charts[cid].tris) for (let c = 0; c < 3; c++) { const i = res.T[t * 3 + c]; if (seen.has(i)) continue; seen.add(i); const r = fn(res.UV[i * 2], res.UV[i * 2 + 1]); res.UV[i * 2] = r[0]; res.UV[i * 2 + 1] = r[1]; }
  }
  function chartBox(res, cid) {
    let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
    for (const t of res.charts[cid].tris) for (let c = 0; c < 3; c++) { const i = res.T[t * 3 + c], u = res.UV[i * 2], v = res.UV[i * 2 + 1]; if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v; }
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  // chart di bawah titik (u,v) atau -1
  function chartAt(res, u, v) {
    for (let t = res.T.length / 3 - 1; t >= 0; t--) {
      const a = res.T[t * 3] * 2, b = res.T[t * 3 + 1] * 2, c = res.T[t * 3 + 2] * 2;
      const ax = res.UV[a], ay = res.UV[a + 1], bx = res.UV[b], by = res.UV[b + 1], cx = res.UV[c], cy = res.UV[c + 1];
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-14) continue;
      const w0 = ((by - cy) * (u - cx) + (cx - bx) * (v - cy)) / den, w1 = ((cy - ay) * (u - cx) + (ax - cx) * (v - cy)) / den, w2 = 1 - w0 - w1;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) return res.chartOf[t];
    }
    return -1;
  }

  // chart dari mesh yang sudah terpecah: komponen terhubung lewat tepi (indeks titik) bersama
  function chartsOf(T) {
    const nT = T.length / 3, nb = triNeighbors(T), chartOf = new Int32Array(nT).fill(-1), charts = [];
    for (let s = 0; s < nT; s++) {
      if (chartOf[s] >= 0) continue;
      const id = charts.length, tris = [s], st = [s]; chartOf[s] = id;
      while (st.length) { const t = st.pop(); for (const q of nb[t]) if (chartOf[q] < 0) { chartOf[q] = id; tris.push(q); st.push(q); } }
      charts.push({ id, tris });
    }
    return { chartOf, charts };
  }

  root.S3DUV = { chartsOf, unwrap, packCharts, rasterize, bake, coverage, dilate, remap, transformChart, chartBox, chartAt, faceData, triNeighbors };
})(typeof self !== 'undefined' ? self : this);
