/*
 * Saltoria 3D Studio — mesin inti
 * Raster (logo / teks) -> kontur subpiksel -> bentuk 2D -> mesh 3D -> GLB / OBJ / ZIP.
 * Tanpa dependensi. Jalan di browser (window.S3D) maupun Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.S3D = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ------------------------------------------------------------------ */
  /* 1. Field (peta "seberapa padat" tiap piksel, 0..1)                  */
  /* ------------------------------------------------------------------ */

  function sensitivityToLevel(s) {
    // 18 = bawaan (level 0.5). Makin tinggi = makin banyak area ikut terdeteksi.
    return clamp(0.5 - (s - 18) * 0.006, 0.05, 0.95);
  }

  function smoothstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function buildField(src, o) {
    const { data, width: w, height: h } = src;
    const n = w * h;
    const f = new Float32Array(n);

    let hasAlpha;
    if (o.source === 'alpha') hasAlpha = true;
    else if (o.source === 'color') hasAlpha = false;
    else {
      let transparent = 0;
      for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 250) transparent++;
      hasAlpha = transparent > n * 0.005;
    }

    if (hasAlpha) {
      for (let i = 0; i < n; i++) f[i] = data[i * 4 + 3] / 255;
    } else {
      // latar = rata-rata piksel tepi gambar
      let r = 0, g = 0, b = 0, c = 0;
      const add = (x, y) => {
        const k = (y * w + x) * 4;
        r += data[k]; g += data[k + 1]; b += data[k + 2]; c++;
      };
      for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
      for (let y = 1; y < h - 1; y++) { add(0, y); add(w - 1, y); }
      r /= c; g /= c; b /= c;
      for (let i = 0; i < n; i++) {
        const dr = data[i * 4] - r, dg = data[i * 4 + 1] - g, db = data[i * 4 + 2] - b;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db) / 441.67;
        f[i] = smoothstep(0.03, 0.22, dist);
      }
    }
    if (o.invert) for (let i = 0; i < n; i++) f[i] = 1 - f[i];
    return { field: f, hasAlpha };
  }

  /* ------------------------------------------------------------------ */
  /* 2. Jarak ke tepi (EDT) — dipakai untuk membatasi bevel di bagian tipis */
  /* ------------------------------------------------------------------ */

  function edt1d(f, n, v, z, d) {
    const INF = 1e20;
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s;
      for (;;) {
        const p = v[k];
        s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
        if (s <= z[k] && k > 0) k--; else break;
      }
      if (s <= z[k]) { /* k == 0 */ v[0] = q; z[0] = -INF; z[1] = INF; continue; }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const p = v[k];
      d[q] = (q - p) * (q - p) + f[p];
    }
  }

  function distanceInside(field, w, h, level) {
    const INF = 1e20;
    const g = new Float32Array(w * h);
    for (let i = 0; i < g.length; i++) g[i] = field[i] >= level ? INF : 0;
    const m = Math.max(w, h);
    const f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = g[y * w + x];
      edt1d(f, h, v, z, d);
      for (let y = 0; y < h; y++) g[y * w + x] = d[y];
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) f[x] = g[y * w + x];
      edt1d(f, w, v, z, d);
      for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]);
    }
    return g;
  }

  /* ------------------------------------------------------------------ */
  /* 3. Marching squares subpiksel                                       */
  /* ------------------------------------------------------------------ */
  // Kontur ditelusuri dengan area "dalam" di satu sisi yang konsisten.
  // Hasil (koordinat piksel, y ke bawah): kontur luar bernilai luas NEGATIF, lubang positif (hasil uji).

  function traceContours(f, w, h, L) {
    const GW = w + 2, GH = h + 2;
    const g = new Float32Array(GW * GH);
    for (let y = 0; y < h; y++) {
      const row = (y + 1) * GW + 1;
      for (let x = 0; x < w; x++) g[row + x] = f[y * w + x];
    }
    const nextOf = new Map();
    const ptOf = new Map();

    const px = (gx) => gx - 0.5; // indeks grid -> koordinat piksel (pusat piksel = +0.5)

    const cr = new Array(4);
    for (let y = 0; y < GH - 1; y++) {
      for (let x = 0; x < GW - 1; x++) {
        const va = g[y * GW + x], vb = g[y * GW + x + 1];
        const vc = g[(y + 1) * GW + x + 1], vd = g[(y + 1) * GW + x];
        const sa = va >= L, sb = vb >= L, sc = vc >= L, sd = vd >= L;
        if (sa === sb && sb === sc && sc === sd) continue;

        // urutan keliling searah jarum jam: A(x,y) -> B(x+1,y) -> C(x+1,y+1) -> D(x,y+1)
        const vals = [va, vb, vc, vd];
        const st = [sa, sb, sc, sd];
        const gx = [x, x + 1, x + 1, x];
        const gy = [y, y, y + 1, y + 1];
        const keys = [
          (y * GW + x) * 2,            // atas   (A-B)
          (y * GW + (x + 1)) * 2 + 1,  // kanan  (B-C)
          ((y + 1) * GW + x) * 2,      // bawah  (C-D)
          (y * GW + x) * 2 + 1,        // kiri   (D-A)
        ];

        let nc = 0;
        for (let k = 0; k < 4; k++) {
          const k2 = (k + 1) & 3;
          if (st[k] === st[k2]) continue;
          const t = (L - vals[k]) / (vals[k2] - vals[k]);
          const key = keys[k];
          if (!ptOf.has(key)) {
            ptOf.set(key, [
              px(gx[k] + (gx[k2] - gx[k]) * t),
              px(gy[k] + (gy[k2] - gy[k]) * t),
            ]);
          }
          cr[nc++] = { key, enter: !st[k] && st[k2] };
        }

        if (nc === 2) {
          const a = cr[0].enter ? cr[0] : cr[1];
          const b = cr[0].enter ? cr[1] : cr[0];
          nextOf.set(a.key, b.key);
        } else if (nc === 4) {
          const connected = (va + vb + vc + vd) / 4 >= L;
          for (let i = 0; i < 4; i++) {
            if (!cr[i].enter) continue;
            const other = connected ? cr[(i + 3) & 3] : cr[(i + 1) & 3];
            nextOf.set(cr[i].key, other.key);
          }
        }
      }
    }

    const loops = [];
    const visited = new Set();
    for (const start of nextOf.keys()) {
      if (visited.has(start)) continue;
      const pts = [];
      let key = start;
      let guard = 0;
      while (key !== undefined && !visited.has(key) && guard++ < 5e6) {
        visited.add(key);
        const p = ptOf.get(key);
        pts.push(p[0], p[1]);
        key = nextOf.get(key);
      }
      if (pts.length >= 6) loops.push(pts);
    }
    return loops;
  }

  /* ------------------------------------------------------------------ */
  /* 4. Alat bantu kontur (flat array [x0,y0,x1,y1,...])                  */
  /* ------------------------------------------------------------------ */

  function loopArea(p) {
    let s = 0;
    const n = p.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      s += p[j * 2] * p[i * 2 + 1] - p[i * 2] * p[j * 2 + 1];
    }
    return s / 2;
  }

  function loopBBox(p) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) {
      if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i];
      if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1];
    }
    return [x0, y0, x1, y1];
  }

  function pointInLoop(x, y, p) {
    let inside = false;
    const n = p.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = p[i * 2], yi = p[i * 2 + 1], xj = p[j * 2], yj = p[j * 2 + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // Haluskan hanya bagian yang hampir lurus; sudut tajam dipertahankan.
  function smoothLoop(p, passes, cornerDeg) {
    const n = p.length / 2;
    if (passes <= 0 || n < 8) return p;
    const cosLimit = Math.cos((cornerDeg * Math.PI) / 180);
    let cur = Float64Array.from(p);
    for (let pass = 0; pass < passes; pass++) {
      const out = Float64Array.from(cur);
      for (let i = 0; i < n; i++) {
        const a = (i + n - 1) % n, b = (i + 1) % n;
        const ax = cur[i * 2] - cur[a * 2], ay = cur[i * 2 + 1] - cur[a * 2 + 1];
        const bx = cur[b * 2] - cur[i * 2], by = cur[b * 2 + 1] - cur[i * 2 + 1];
        const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
        if (la < 1e-9 || lb < 1e-9) continue;
        const c = (ax * bx + ay * by) / (la * lb);
        if (c < cosLimit) continue; // sudut tajam
        out[i * 2] = 0.25 * cur[a * 2] + 0.5 * cur[i * 2] + 0.25 * cur[b * 2];
        out[i * 2 + 1] = 0.25 * cur[a * 2 + 1] + 0.5 * cur[i * 2 + 1] + 0.25 * cur[b * 2 + 1];
      }
      cur = out;
    }
    return cur;
  }

  function dpRange(p, i0, i1, eps, keep, n) {
    // Douglas-Peucker iteratif pada indeks i0..i1 (i1 boleh >= n, dibungkus)
    const stack = [[i0, i1]];
    while (stack.length) {
      const [s, e] = stack.pop();
      if (e - s < 2) continue;
      const ax = p[(s % n) * 2], ay = p[(s % n) * 2 + 1];
      const bx = p[(e % n) * 2], by = p[(e % n) * 2 + 1];
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let best = -1, bi = -1;
      for (let i = s + 1; i < e; i++) {
        const x = p[(i % n) * 2], y = p[(i % n) * 2 + 1];
        let d;
        if (len2 < 1e-12) d = Math.hypot(x - ax, y - ay);
        else {
          let t = ((x - ax) * dx + (y - ay) * dy) / len2;
          t = clamp(t, 0, 1);
          d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
        }
        if (d > best) { best = d; bi = i; }
      }
      if (best > eps) {
        keep[bi % n] = 1;
        stack.push([s, bi], [bi, e]);
      }
    }
  }

  function simplifyLoop(p, eps) {
    const n = p.length / 2;
    if (n <= 4 || eps <= 0) return p;
    // jangkar: titik 0 dan titik terjauh darinya
    let far = 0, fd = -1;
    for (let i = 1; i < n; i++) {
      const d = Math.hypot(p[i * 2] - p[0], p[i * 2 + 1] - p[1]);
      if (d > fd) { fd = d; far = i; }
    }
    const keep = new Uint8Array(n);
    keep[0] = 1; keep[far] = 1;
    dpRange(p, 0, far, eps, keep, n);
    dpRange(p, far, n, eps, keep, n);
    const out = [];
    for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 2], p[i * 2 + 1]);
    return out;
  }

  function estimateTriangles(polys, bevel, seg) {
    let tri = 0;
    for (const pl of polys) {
      let v = pl.outer.length / 2;
      for (const hl of pl.holes) v += hl.length / 2;
      const h = pl.holes.length;
      const cap = Math.max(0, v + 2 * h - 2);
      tri += 2 * cap + (bevel ? 2 + 4 * Math.max(1, seg || 1) : 2) * v;
    }
    return tri;
  }

  /* ------------------------------------------------------------------ */
  /* 5. Dari raster ke bentuk 2D                                          */
  /* ------------------------------------------------------------------ */

  function extractShapes(src, o) {
    o = Object.assign({
      sensitivity: 18, invert: false, fillHoles: 0, removeSpecks: 12,
      smooth: 2, maxTriangles: 18000, bevel: false, bevelSeg: 1, source: 'auto',
    }, o || {});
    const { width: w, height: h } = src;
    const { field, hasAlpha } = buildField(src, o);
    const level = sensitivityToLevel(o.sensitivity);

    const raw = traceContours(field, w, h, level);

    // klasifikasi: luas negatif = kontur luar, positif = lubang (lihat catatan traceContours)
    const outers = [], holes = [];
    for (const lp of raw) {
      const a = loopArea(lp);
      if (Math.abs(a) < 1) continue;
      (a < 0 ? outers : holes).push({ pts: lp, area: Math.abs(a), bbox: loopBBox(lp) });
    }
    const keptOuters = outers.filter((l) => l.area >= o.removeSpecks);
    outers.length = 0;

    // pasangkan lubang ke kontur luar terkecil yang memuatnya
    keptOuters.sort((a, b) => a.area - b.area);
    const groups = keptOuters.map((l) => ({ outer: l, holes: [] }));
    for (const hl of holes) {
      if (hl.area < o.fillHoles) continue;
      const hx = hl.pts[0], hy = hl.pts[1];
      for (const gp of groups) {
        const bb = gp.outer.bbox;
        if (hx < bb[0] || hx > bb[2] || hy < bb[1] || hy > bb[3]) continue;
        if (gp.outer.area <= hl.area) continue;
        if (pointInLoop(hx, hy, gp.outer.pts)) { gp.holes.push(hl); break; }
      }
    }

    // haluskan sekali, lalu sederhanakan dengan toleransi yang naik sampai muat batas segitiga
    const cornerDeg = 38;
    const smoothed = groups.map((gp) => ({
      outer: smoothLoop(gp.outer.pts, o.smooth, cornerDeg),
      holes: gp.holes.map((hl) => smoothLoop(hl.pts, o.smooth, cornerDeg)),
      area: gp.outer.area,
    }));

    const baseEps = 0.00035 * Math.max(w, h);
    const build = (eps) => {
      const polys = [];
      for (const sp of smoothed) {
        const outer = simplifyLoop(sp.outer, eps);
        if (outer.length < 6 || Math.abs(loopArea(outer)) < 0.5) continue;
        const hs = [];
        for (const hl of sp.holes) {
          const s = simplifyLoop(hl, eps);
          if (s.length >= 6 && Math.abs(loopArea(s)) >= 0.5) hs.push(s);
        }
        polys.push({ outer, holes: hs, area: sp.area });
      }
      return polys;
    };

    let eps = baseEps;
    let polys = build(eps);
    let tri = estimateTriangles(polys, o.bevel, o.bevelSeg);
    let guard = 0;
    while (tri > o.maxTriangles && eps < 14 && guard++ < 40) {
      eps *= 1.3;
      polys = build(eps);
      tri = estimateTriangles(polys, o.bevel, o.bevelSeg);
    }
    let dropped = 0;
    if (tri > o.maxTriangles) {
      // cara terakhir: buang bagian terkecil
      polys.sort((a, b) => a.area - b.area);
      while (polys.length > 1 && tri > o.maxTriangles) {
        polys.shift(); dropped++;
        tri = estimateTriangles(polys, o.bevel, o.bevelSeg);
      }
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let verts = 0, holeCount = 0;
    for (const pl of polys) {
      const bb = loopBBox(pl.outer);
      minX = Math.min(minX, bb[0]); minY = Math.min(minY, bb[1]);
      maxX = Math.max(maxX, bb[2]); maxY = Math.max(maxY, bb[3]);
      verts += pl.outer.length / 2;
      for (const hl of pl.holes) { verts += hl.length / 2; holeCount++; }
    }

    const result = {
      polys, w, h, level,
      bounds: polys.length ? { minX, minY, maxX, maxY } : null,
      edt: null,
      stats: {
        shapes: polys.length, holes: holeCount, vertices: verts,
        estimatedTriangles: tri, simplifyTolerance: eps, baseTolerance: baseEps,
        dropped, hasAlpha, level,
      },
      // untuk pratinjau area terdeteksi
      mask: null,
    };
    if (o.bevel && polys.length) result.edt = distanceInside(field, w, h, level);
    result.field = field;
    return result;
  }

  /* ------------------------------------------------------------------ */
  /* 6. Triangulasi poligon berlubang (ear clipping + jembatan lubang)    */
  /* ------------------------------------------------------------------ */
  // Port ringkas algoritma earcut (ISC, Mapbox) tanpa z-order hashing.

  function ENode(i, x, y) { this.i = i; this.x = x; this.y = y; this.prev = null; this.next = null; this.steiner = false; }

  function earcut(data, holeIndices) {
    const dim = 2;
    const hasHoles = holeIndices && holeIndices.length;
    const outerLen = hasHoles ? holeIndices[0] * dim : data.length;
    let outerNode = linkedList(data, 0, outerLen, dim, true);
    const triangles = [];
    if (!outerNode || outerNode.next === outerNode.prev) return triangles;
    if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);
    earcutLinked(outerNode, triangles, dim, 0);
    return triangles;
  }

  function linkedList(data, start, end, dim, clockwise) {
    let last;
    if (clockwise === (signedAreaE(data, start, end, dim) > 0)) {
      for (let i = start; i < end; i += dim) last = insertNode(i, data[i], data[i + 1], last);
    } else {
      for (let i = end - dim; i >= start; i -= dim) last = insertNode(i, data[i], data[i + 1], last);
    }
    if (last && equalsE(last, last.next)) { removeNode(last); last = last.next; }
    return last;
  }

  function filterPoints(start, end) {
    if (!start) return start;
    if (!end) end = start;
    let p = start, again;
    do {
      again = false;
      if (!p.steiner && (equalsE(p, p.next) || areaE(p.prev, p, p.next) === 0)) {
        removeNode(p);
        p = end = p.prev;
        if (p === p.next) break;
        again = true;
      } else p = p.next;
    } while (again || p !== end);
    return end;
  }

  function earcutLinked(ear, triangles, dim, pass) {
    if (!ear) return;
    let stop = ear, prev, next;
    while (ear.prev !== ear.next) {
      prev = ear.prev; next = ear.next;
      if (isEar(ear)) {
        triangles.push((prev.i / dim) | 0, (ear.i / dim) | 0, (next.i / dim) | 0);
        removeNode(ear);
        ear = next.next; stop = next.next;
        continue;
      }
      ear = next;
      if (ear === stop) {
        if (!pass) earcutLinked(filterPoints(ear), triangles, dim, 1);
        else if (pass === 1) {
          ear = cureLocalIntersections(filterPoints(ear), triangles, dim);
          earcutLinked(ear, triangles, dim, 2);
        } else if (pass === 2) splitEarcut(ear, triangles, dim);
        break;
      }
    }
  }

  function isEar(ear) {
    const a = ear.prev, b = ear, c = ear.next;
    if (areaE(a, b, c) >= 0) return false;
    const ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;
    const x0 = Math.min(ax, bx, cx), y0 = Math.min(ay, by, cy);
    const x1 = Math.max(ax, bx, cx), y1 = Math.max(ay, by, cy);
    let p = c.next;
    while (p !== a) {
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 &&
          pointInTri(ax, ay, bx, by, cx, cy, p.x, p.y) && areaE(p.prev, p, p.next) >= 0) return false;
      p = p.next;
    }
    return true;
  }

  function cureLocalIntersections(start, triangles, dim) {
    let p = start;
    do {
      const a = p.prev, b = p.next.next;
      if (!equalsE(a, b) && intersectsE(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {
        triangles.push((a.i / dim) | 0, (p.i / dim) | 0, (b.i / dim) | 0);
        removeNode(p); removeNode(p.next);
        p = start = b;
      }
      p = p.next;
    } while (p !== start);
    return filterPoints(p);
  }

  function splitEarcut(start, triangles, dim) {
    let a = start;
    do {
      let b = a.next.next;
      while (b !== a.prev) {
        if (a.i !== b.i && isValidDiagonal(a, b)) {
          let c = splitPolygon(a, b);
          a = filterPoints(a, a.next);
          c = filterPoints(c, c.next);
          earcutLinked(a, triangles, dim, 0);
          earcutLinked(c, triangles, dim, 0);
          return;
        }
        b = b.next;
      }
      a = a.next;
    } while (a !== start);
  }

  function eliminateHoles(data, holeIndices, outerNode, dim) {
    const queue = [];
    for (let i = 0, len = holeIndices.length; i < len; i++) {
      const start = holeIndices[i] * dim;
      const end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
      const list = linkedList(data, start, end, dim, false);
      if (list === list.next) list.steiner = true;
      queue.push(getLeftmost(list));
    }
    queue.sort((a, b) => a.x - b.x);
    for (let i = 0; i < queue.length; i++) outerNode = eliminateHole(queue[i], outerNode);
    return outerNode;
  }

  function eliminateHole(hole, outerNode) {
    const bridge = findHoleBridge(hole, outerNode);
    if (!bridge) return outerNode;
    const bridgeReverse = splitPolygon(bridge, hole);
    filterPoints(bridgeReverse, bridgeReverse.next);
    return filterPoints(bridge, bridge.next);
  }

  function findHoleBridge(hole, outerNode) {
    let p = outerNode;
    const hx = hole.x, hy = hole.y;
    let qx = -Infinity, m;
    do {
      if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
        const x = p.x + ((hy - p.y) * (p.next.x - p.x)) / (p.next.y - p.y);
        if (x <= hx && x > qx) {
          qx = x;
          m = p.x < p.next.x ? p : p.next;
          if (x === hx) return m;
        }
      }
      p = p.next;
    } while (p !== outerNode);
    if (!m) return null;

    const stop = m, mx = m.x, my = m.y;
    let tanMin = Infinity, tan;
    p = m;
    do {
      if (hx >= p.x && p.x >= mx && hx !== p.x &&
          pointInTri(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
        tan = Math.abs(hy - p.y) / (hx - p.x);
        if (locallyInside(p, hole) &&
            (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) {
          m = p; tanMin = tan;
        }
      }
      p = p.next;
    } while (p !== stop);
    return m;
  }

  function sectorContainsSector(m, p) { return areaE(m.prev, m, p.prev) < 0 && areaE(p.next, m, m.next) < 0; }

  function getLeftmost(start) {
    let p = start, leftmost = start;
    do {
      if (p.x < leftmost.x || (p.x === leftmost.x && p.y < leftmost.y)) leftmost = p;
      p = p.next;
    } while (p !== start);
    return leftmost;
  }

  function pointInTri(ax, ay, bx, by, cx, cy, px, py) {
    return (cx - px) * (ay - py) >= (ax - px) * (cy - py) &&
           (ax - px) * (by - py) >= (bx - px) * (ay - py) &&
           (bx - px) * (cy - py) >= (cx - px) * (by - py);
  }

  function isValidDiagonal(a, b) {
    return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) &&
      ((locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) &&
        (areaE(a.prev, a, b.prev) || areaE(a, b.prev, b))) ||
       (equalsE(a, b) && areaE(a.prev, a, a.next) > 0 && areaE(b.prev, b, b.next) > 0));
  }

  function areaE(p, q, r) { return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y); }
  function equalsE(p1, p2) { return p1.x === p2.x && p1.y === p2.y; }
  function signE(n) { return n > 0 ? 1 : n < 0 ? -1 : 0; }

  function intersectsE(p1, q1, p2, q2) {
    const o1 = signE(areaE(p1, q1, p2)), o2 = signE(areaE(p1, q1, q2));
    const o3 = signE(areaE(p2, q2, p1)), o4 = signE(areaE(p2, q2, q1));
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    return false;
  }

  function onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
           q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  }

  function intersectsPolygon(a, b) {
    let p = a;
    do {
      if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i && intersectsE(p, p.next, a, b)) return true;
      p = p.next;
    } while (p !== a);
    return false;
  }

  function locallyInside(a, b) {
    return areaE(a.prev, a, a.next) < 0
      ? areaE(a, b, a.next) >= 0 && areaE(a, a.prev, b) >= 0
      : areaE(a, b, a.prev) < 0 || areaE(a, a.next, b) < 0;
  }

  function middleInside(a, b) {
    let p = a, inside = false;
    const px = (a.x + b.x) / 2, py = (a.y + b.y) / 2;
    do {
      if ((p.y > py) !== (p.next.y > py) && p.next.y !== p.y &&
          px < ((p.next.x - p.x) * (py - p.y)) / (p.next.y - p.y) + p.x) inside = !inside;
      p = p.next;
    } while (p !== a);
    return inside;
  }

  function splitPolygon(a, b) {
    const a2 = new ENode(a.i, a.x, a.y), b2 = new ENode(b.i, b.x, b.y);
    const an = a.next, bp = b.prev;
    a.next = b; b.prev = a;
    a2.next = an; an.prev = a2;
    b2.next = a2; a2.prev = b2;
    bp.next = b2; b2.prev = bp;
    return b2;
  }

  function insertNode(i, x, y, last) {
    const p = new ENode(i, x, y);
    if (!last) { p.prev = p; p.next = p; }
    else { p.next = last.next; p.prev = last; last.next.prev = p; last.next = p; }
    return p;
  }

  function removeNode(p) { p.next.prev = p.prev; p.prev.next = p.next; }

  function signedAreaE(data, start, end, dim) {
    let sum = 0;
    for (let i = start, j = end - dim; i < end; i += dim) {
      sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
      j = i;
    }
    return sum;
  }

  /* ------------------------------------------------------------------ */
  /* 7. Ekstrusi: bentuk 2D -> mesh 3D                                    */
  /* ------------------------------------------------------------------ */

  function signedArea2D(p) { // y ke atas
    let s = 0;
    const n = p.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) s += p[j * 2] * p[i * 2 + 1] - p[i * 2] * p[j * 2 + 1];
    return s / 2;
  }

  function reverseLoop(p) {
    const n = p.length / 2, out = new Array(p.length);
    for (let i = 0; i < n; i++) { out[i * 2] = p[(n - 1 - i) * 2]; out[i * 2 + 1] = p[(n - 1 - i) * 2 + 1]; }
    return out;
  }

  // Geser tiap titik ke dalam materi. sign: +1 untuk kontur luar (CCW), -1 untuk lubang (CW).
  function insetOnce(p, sign, dist) {
    const n = p.length / 2;
    const out = new Array(p.length);
    const nx = new Array(n), ny = new Array(n);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = p[j * 2] - p[i * 2], dy = p[j * 2 + 1] - p[i * 2 + 1];
      const l = Math.hypot(dx, dy) || 1;
      nx[i] = (sign * -dy) / l; ny[i] = (sign * dx) / l; // normal ke dalam untuk sisi i -> i+1
    }
    for (let i = 0; i < n; i++) {
      const h = (i + n - 1) % n;
      const d = dist[i];
      let mx = nx[h] + nx[i], my = ny[h] + ny[i];
      const dot = nx[h] * nx[i] + ny[h] * ny[i];
      let ox, oy;
      if (1 + dot < 0.15) { ox = nx[i] * d; oy = ny[i] * d; }
      else {
        const k = d / (1 + dot);
        ox = mx * k; oy = my * k;
        const len = Math.hypot(ox, oy), cap = d * 2.2;
        if (len > cap) { ox *= cap / len; oy *= cap / len; }
      }
      out[i * 2] = p[i * 2] + ox; out[i * 2 + 1] = p[i * 2 + 1] + oy;
    }
    return out;
  }

  function loopSelfIntersects(p) {
    const n = p.length / 2;
    if (n > 4000) return false; // terlalu besar untuk uji O(n^2); lewati
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      const ax = p[i * 2], ay = p[i * 2 + 1], bx = p[i2 * 2], by = p[i2 * 2 + 1];
      const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
      for (let j = i + 2; j < n; j++) {
        const j2 = (j + 1) % n;
        if (j2 === i) continue; // sisi bertetangga (pembungkus)
        const cx = p[j * 2], cy = p[j * 2 + 1], dx = p[j2 * 2], dy = p[j2 * 2 + 1];
        if (Math.max(cx, dx) < x0 || Math.min(cx, dx) > x1 || Math.max(cy, dy) < y0 || Math.min(cy, dy) > y1) continue;
        const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        const d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
        const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
        const d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
      }
    }
    return false;
  }

  // Kecilkan jarak inset di titik yang membuat sisi terbalik/menyusut, sampai ring tetap sehat.
  function insetLoop(p, sign, dist0) {
    const n = p.length / 2;
    const dist = dist0.slice();
    for (let iter = 0; iter < 12; iter++) {
      const out = insetOnce(p, sign, dist);
      let bad = false;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ox = p[j * 2] - p[i * 2], oy = p[j * 2 + 1] - p[i * 2 + 1];
        const nx = out[j * 2] - out[i * 2], ny = out[j * 2 + 1] - out[i * 2 + 1];
        if (ox * nx + oy * ny <= 0.1 * (ox * ox + oy * oy)) { dist[i] *= 0.5; dist[j] *= 0.5; bad = true; }
      }
      if (!bad && loopSelfIntersects(out)) { for (let i = 0; i < n; i++) dist[i] *= 0.6; bad = true; }
      if (!bad) return out;
    }
    return null; // tidak ada inset yang sehat
  }

  function buildMesh(shapes, o) {
    o = Object.assign({ width: 10, thickness: 0.3, bevel: 0, bevelSeg: 1, crease: 50, flip: false, sideUV: null, capUV: null, uvScale: [1, 1] }, o || {});
    const SEG = clamp(Math.round(o.bevelSeg || 1), 1, 8);
    const creaseCos = Math.cos((clamp(o.crease, 5, 180)) * Math.PI / 180);
    const polys = shapes.polys;
    if (!polys.length) throw new Error('Tidak ada bentuk yang terdeteksi.');
    const B = o.frame || shapes.bounds;
    const bw = B.maxX - B.minX, bh = B.maxY - B.minY;
    const s = o.width / bw;
    const cx = (B.minX + B.maxX) / 2, cy = (B.minY + B.maxY) / 2;
    const hz = o.thickness / 2;
    const bevelReq = clamp(o.bevel || 0, 0, hz * 0.92);

    const pos = [], nor = [], uvs = [], idx = [];
    const uvOf = (X, Y) => {
      if (o.capUV) return o.capUV;
      return [(X / s / bw + 0.5) * o.uvScale[0], (-Y / s / bh + 0.5) * o.uvScale[1]];
    };

    const pushV = (X, Y, Z, nx, ny, nz, uv) => {
      pos.push(X, Y, Z); nor.push(nx, ny, nz); uvs.push(uv[0], uv[1]);
      return pos.length / 3 - 1;
    };
    const sideUV = o.sideUV;

    // satu segitiga dengan arah hadap sesuai petunjuk
    const triOriented = (ia, ib, ic, hint) => {
      const ax = pos[ia * 3], ay = pos[ia * 3 + 1], az = pos[ia * 3 + 2];
      const ux = pos[ib * 3] - ax, uy = pos[ib * 3 + 1] - ay, uz = pos[ib * 3 + 2] - az;
      const vx = pos[ic * 3] - ax, vy = pos[ic * 3 + 1] - ay, vz = pos[ic * 3 + 2] - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * hint[0] + ny * hint[1] + nz * hint[2] >= 0) idx.push(ia, ib, ic);
      else idx.push(ia, ic, ib);
    };

    const quadFace = (p0, p1, p2, p3, hint, useSideUV) => {
      // p0..p3 berurutan mengelilingi quad
      const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
      const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) return; // quad merosot
      nx /= l; ny /= l; nz /= l;
      if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const mk = (p) => pushV(p[0], p[1], p[2], nx, ny, nz, useSideUV && sideUV ? sideUV : uvOf(p[0], p[1]));
      const a = mk(p0), b = mk(p1), c = mk(p2), d = mk(p3);
      triOriented(a, b, c, [nx, ny, nz]);
      triOriented(a, c, d, [nx, ny, nz]);
    };

    const toModel = (flat) => {
      const n = flat.length / 2, out = new Array(flat.length);
      for (let i = 0; i < n; i++) {
        out[i * 2] = (flat[i * 2] - cx) * s;
        out[i * 2 + 1] = -(flat[i * 2 + 1] - cy) * s;
      }
      return out;
    };

    const insetLimits = (loopPx, loopModel, bev) => {
      // batas bevel per titik berdasarkan ketebalan lokal (dari EDT)
      const n = loopModel.length / 2;
      const dist = new Array(n).fill(bev);
      if (!shapes.edt) return dist;
      const W = shapes.w, H = shapes.h, E = shapes.edt;
      const steps = Math.min(40, Math.ceil((bev / s) * 2) + 3);
      for (let i = 0; i < n; i++) {
        const a = (i + n - 1) % n, b = (i + 1) % n;
        let tx = loopPx[b * 2] - loopPx[a * 2], ty = loopPx[b * 2 + 1] - loopPx[a * 2 + 1];
        const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        // normal ke dalam (piksel, y ke bawah): orientasi kontur luar positif => sisi kanan arah jalan
        const sg = loopPx.__sign || 1;
        const nx = sg * -ty, ny = sg * tx;
        let mx = 0;
        for (let k = 0; k <= steps; k++) {
          const x = Math.round(loopPx[i * 2] + nx * k - 0.5), y = Math.round(loopPx[i * 2 + 1] + ny * k - 0.5);
          if (x < 0 || y < 0 || x >= W || y >= H) break;
          const v = E[y * W + x];
          if (v > mx) mx = v;
        }
        dist[i] = Math.min(bev, Math.max(mx, 0.5) * 0.7 * s);
      }
      // halus-kan dengan minimum tetangga agar kemiringan tidak melompat
      for (let pass = 0; pass < 2; pass++) {
        const cp = dist.slice();
        for (let i = 0; i < n; i++) dist[i] = Math.min(cp[i], cp[(i + 1) % n], cp[(i + n - 1) % n]);
      }
      return dist;
    };

    let capTriangleFallbacks = 0;

    const buildPoly = (pl, bev) => {
      // ubah ke koordinat model (y ke atas) dan atur orientasi: luar CCW, lubang CW
      const loops = [];
      const addLoop = (flatPx, isHole) => {
        let m = toModel(flatPx);
        let px = flatPx.slice();
        const a = signedArea2D(m);
        if ((!isHole && a < 0) || (isHole && a > 0)) { m = reverseLoop(m); px = reverseLoop(px); }
        loops.push({ m, px, sign: isHole ? -1 : 1 });
      };
      addLoop(pl.outer, false);
      for (const hl of pl.holes) addLoop(hl, true);

      // lingkaran inset (bevel)
      for (const lp of loops) {
        if (bev > 0) {
          // normal ke dalam pada ruang piksel: loop piksel arahnya terbalik dibanding model (y dibalik)
          // materi selalu di sisi kiri arah jalan (model, y ke atas) untuk kontur luar maupun lubang;
          // di ruang piksel (y ke bawah) sisi itu menjadi kanan.
          lp.px.__sign = -1;
          const dist = insetLimits(lp.px, lp.m, bev);
          lp.rings = [];
          for (let k = 1; k <= SEG; k++) {
            // profil seperempat lingkaran: jarak ke dalam = bev * (1 - cos(theta))
            const f = SEG === 1 ? 1 : 1 - Math.cos((k / SEG) * Math.PI / 2);
            const ring = insetLoop(lp.m, 1, dist.map((v) => v * f));
            if (!ring) return null;
            lp.rings.push(ring);
          }
          lp.inset = lp.rings[SEG - 1];
          lp.dist = dist;
        } else lp.inset = lp.m;
      }

      // triangulasi tutup
      const coords = [], holeIdx = [];
      let count = 0;
      loops.forEach((lp, li) => {
        if (li > 0) holeIdx.push(count);
        for (let i = 0; i < lp.inset.length; i += 2) { coords.push(lp.inset[i], lp.inset[i + 1]); count++; }
      });
      const tris = earcut(coords, holeIdx.length ? holeIdx : null);

      // validasi: jumlah luas segitiga harus sama dengan luas poligon
      let expected = Math.abs(signedArea2D(loops[0].inset));
      for (let li = 1; li < loops.length; li++) expected -= Math.abs(signedArea2D(loops[li].inset));
      let got = 0;
      for (let t = 0; t < tris.length; t += 3) {
        const a = tris[t] * 2, b = tris[t + 1] * 2, c = tris[t + 2] * 2;
        got += Math.abs((coords[b] - coords[a]) * (coords[c + 1] - coords[a + 1]) - (coords[c] - coords[a]) * (coords[b + 1] - coords[a + 1])) / 2;
      }
      if (expected > 0 && Math.abs(got - expected) > expected * 0.03 + 1e-9) return null;
      if (bev > 0) {
        const used = new Uint8Array(coords.length / 2);
        for (let t = 0; t < tris.length; t++) used[tris[t]] = 1;
        for (let k = 0; k < used.length; k++) if (!used[k]) return null; // ada titik yang terbuang => sambungan tidak rapat
      }

      return { loops, coords, tris };
    };

    // Dinding + tepi membulat dengan normal halus (retak dipertahankan di sudut tajam).
    const smoothQuad = (P, N, hint) => {
      const ids = [];
      for (let k = 0; k < 4; k++) ids.push(pushV(P[k][0], P[k][1], P[k][2], N[k][0], N[k][1], N[k][2], sideUV || uvOf(P[k][0], P[k][1])));
      const ax = P[0][0], ay = P[0][1], az = P[0][2];
      // arah segitiga mengikuti normal titik (rata-rata), supaya cocok dengan shading di tepi yang kusut
      const dbl = (x, y, z) => {
        const nn = [0, 0, 0];
        for (const q of [x, y, z]) for (let k = 0; k < 3; k++) nn[k] += nor[q * 3 + k];
        triOriented(x, y, z, nn);
      };
      dbl(ids[0], ids[1], ids[2]); dbl(ids[0], ids[2], ids[3]);
    };
    const emitSmoothBand = (lp, bev, zIn) => {
      const n = lp.m.length / 2;
      const eo = new Array(n);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, dx = lp.m[j * 2] - lp.m[i * 2], dy = lp.m[j * 2 + 1] - lp.m[i * 2 + 1], l = Math.hypot(dx, dy) || 1;
        eo[i] = [dy / l, -dx / l];
      }
      const vn = (v, e) => {
        const a = eo[e], b = v === e ? eo[(e + n - 1) % n] : eo[(e + 1) % n];
        if (a[0] * b[0] + a[1] * b[1] < creaseCos) return a;
        const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1;
        return [x / l, y / l];
      };
      const ringPt = (s, v) => (s === 0 ? [lp.m[v * 2], lp.m[v * 2 + 1]] : [lp.rings[s - 1][v * 2], lp.rings[s - 1][v * 2 + 1]]);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (Math.hypot(lp.m[j * 2] - lp.m[i * 2], lp.m[j * 2 + 1] - lp.m[i * 2 + 1]) < 1e-9) continue;
        const ni = vn(i, i), nj = vn(j, i);
        // dinding lurus (normal mendatar halus)
        smoothQuad([[lp.m[i * 2], lp.m[i * 2 + 1], zIn], [lp.m[i * 2], lp.m[i * 2 + 1], -zIn], [lp.m[j * 2], lp.m[j * 2 + 1], -zIn], [lp.m[j * 2], lp.m[j * 2 + 1], zIn]],
          [[ni[0], ni[1], 0], [ni[0], ni[1], 0], [nj[0], nj[1], 0], [nj[0], nj[1], 0]], [eo[i][0], eo[i][1], 0]);
        for (let sg = 0; sg < SEG; sg++) {
          const t0 = (sg / SEG) * Math.PI / 2, t1 = ((sg + 1) / SEG) * Math.PI / 2;
          const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
          const a0 = ringPt(sg, i), b0 = ringPt(sg, j), a1 = ringPt(sg + 1, i), b1 = ringPt(sg + 1, j);
          const z0 = zIn + bev * s0, z1 = zIn + bev * s1;
          for (const side of [1, -1]) {
            smoothQuad([[a0[0], a0[1], side * z0], [b0[0], b0[1], side * z0], [b1[0], b1[1], side * z1], [a1[0], a1[1], side * z1]],
              [[ni[0] * c0, ni[1] * c0, side * s0], [nj[0] * c0, nj[1] * c0, side * s0], [nj[0] * c1, nj[1] * c1, side * s1], [ni[0] * c1, ni[1] * c1, side * s1]],
              [eo[i][0] * (c0 + c1) / 2, eo[i][1] * (c0 + c1) / 2, side * (s0 + s1) / 2]);
          }
        }
      }
    };

    const emitPoly = (built, bev) => {
      const { loops, coords, tris } = built;
      const zIn = hz - bev; // tinggi dinding lurus
      // tutup depan/belakang
      const base = [];
      let ci = 0;
      for (const lp of loops) { // simpan indeks awal vertex tutup
        base.push(ci); ci += lp.inset.length / 2;
      }
      const frontStart = pos.length / 3;
      for (let i = 0; i < coords.length; i += 2) pushV(coords[i], coords[i + 1], hz, 0, 0, 1, uvOf(coords[i], coords[i + 1]));
      const backStart = pos.length / 3;
      for (let i = 0; i < coords.length; i += 2) pushV(coords[i], coords[i + 1], -hz, 0, 0, -1, uvOf(coords[i], coords[i + 1]));
      for (let t = 0; t < tris.length; t += 3) {
        triOriented(frontStart + tris[t], frontStart + tris[t + 1], frontStart + tris[t + 2], [0, 0, 1]);
        triOriented(backStart + tris[t], backStart + tris[t + 1], backStart + tris[t + 2], [0, 0, -1]);
      }
      // dinding
      for (const lp of loops) {
        const n = lp.m.length / 2;
        if (bev > 0 && SEG > 1) { emitSmoothBand(lp, bev, zIn); continue; }
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const ax = lp.m[i * 2], ay = lp.m[i * 2 + 1], bx = lp.m[j * 2], by = lp.m[j * 2 + 1];
          const dx = bx - ax, dy = by - ay;
          const l = Math.hypot(dx, dy);
          if (l < 1e-9) continue;
          const out = [dy / l, -dx / l, 0]; // keluar dari materi
          // dinding lurus
          quadFace([ax, ay, zIn], [ax, ay, -zIn], [bx, by, -zIn], [bx, by, zIn], out, true);
          if (bev > 0) {
            const qa = [lp.inset[i * 2], lp.inset[i * 2 + 1]], qb = [lp.inset[j * 2], lp.inset[j * 2 + 1]];
            quadFace([qa[0], qa[1], hz], [qb[0], qb[1], hz], [bx, by, zIn], [ax, ay, zIn], [out[0], out[1], 1], true);
            quadFace([qa[0], qa[1], -hz], [qb[0], qb[1], -hz], [bx, by, -zIn], [ax, ay, -zIn], [out[0], out[1], -1], true);
          }
        }
      }
    };

    for (const pl of polys) {
      let built = null, usedBev = 0;
      if (bevelReq > 0) {
        for (const f of [1, 0.5, 0.25]) {
          built = buildPoly(pl, bevelReq * f);
          if (built) { usedBev = bevelReq * f; break; }
        }
        if (!built) capTriangleFallbacks++;
      }
      if (!built) { built = buildPoly(pl, 0); usedBev = 0; }
      if (!built) continue; // poligon rusak, lewati
      emitPoly(built, usedBev);
    }

    let positions = new Float32Array(pos), normals = new Float32Array(nor);
    const uvArr = new Float32Array(uvs);
    if (o.flip) {
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = -positions[i]; positions[i + 2] = -positions[i + 2];
        normals[i] = -normals[i]; normals[i + 2] = -normals[i + 2];
      }
    }
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = positions[i + k];
        if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v;
      }
    }
    return {
      positions, normals, uvs: uvArr, indices: Uint32Array.from(idx),
      triangles: idx.length / 3, min, max,
      size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
      bevelFallbacks: capTriangleFallbacks, flipped: !!o.flip,
    };
  }

  /* ------------------------------------------------------------------ */
  /* 8. Tekstur                                                           */
  /* ------------------------------------------------------------------ */

  // Isi warna piksel transparan dengan warna terdekat agar tepi tidak gelap, lalu buat opak.
  function bleedRGBA(data, w, h) {
    const n = w * h;
    const seed = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) if (data[i * 4 + 3] >= 128) seed[i] = i;
    const dist2 = (i, s) => {
      const dx = (i % w) - (s % w), dy = ((i / w) | 0) - ((s / w) | 0);
      return dx * dx + dy * dy;
    };
    const relax = (i, j) => {
      const s = seed[j];
      if (s < 0) return;
      if (seed[i] < 0 || dist2(i, s) < dist2(i, seed[i])) seed[i] = s;
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x > 0) relax(i, i - 1);
      if (y > 0) { relax(i, i - w); if (x > 0) relax(i, i - w - 1); if (x < w - 1) relax(i, i - w + 1); }
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x < w - 1) relax(i, i + 1);
      if (y < h - 1) { relax(i, i + w); if (x < w - 1) relax(i, i + w + 1); if (x > 0) relax(i, i + w - 1); }
    }
    for (let i = 0; i < n; i++) {
      const s = seed[i];
      if (s >= 0 && s !== i) { data[i * 4] = data[s * 4]; data[i * 4 + 1] = data[s * 4 + 1]; data[i * 4 + 2] = data[s * 4 + 2]; }
      data[i * 4 + 3] = 255;
    }
    return data;
  }

  /* ------------------------------------------------------------------ */
  /* 9. Penulis berkas: GLB, OBJ, ZIP                                     */
  /* ------------------------------------------------------------------ */


  /* ------------------------------------------------------------ */
  /* Pemeriksa & perbaikan mesh                                    */
  /* ------------------------------------------------------------ */
  // Memeriksa mesh {positions, indices, uvs?, size?}. opt.target: 'roblox' | 'umum' | 'bebas', opt.limit: batas segitiga.
  function checkMesh(mesh, opt) {
    opt = opt || {};
    const P = mesh.positions, I = mesh.indices, nT = Math.floor(I.length / 3), nV = P.length / 3;
    const canon = new Map(), cid = new Int32Array(nV);
    for (let v = 0; v < nV; v++) {
      const k = Math.round(P[v * 3] * 1e4) + ',' + Math.round(P[v * 3 + 1] * 1e4) + ',' + Math.round(P[v * 3 + 2] * 1e4);
      let c = canon.get(k); if (c == null) { c = v; canon.set(k, v); } cid[v] = c;
    }
    const edges = new Map();
    let degenerate = 0, vol = 0;
    for (let t = 0; t < nT; t++) {
      const ia = I[t * 3], ib = I[t * 3 + 1], ic = I[t * 3 + 2];
      const ax = P[ia * 3], ay = P[ia * 3 + 1], az = P[ia * 3 + 2], bx = P[ib * 3], by = P[ib * 3 + 1], bz = P[ib * 3 + 2], cx = P[ic * 3], cy = P[ic * 3 + 1], cz = P[ic * 3 + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      const a = cid[ia], b = cid[ib], c = cid[ic];
      if (nx * nx + ny * ny + nz * nz < 1e-16 || a === b || b === c || a === c) { degenerate++; continue; }
      const add = (p, q) => {
        const key = p < q ? p + '_' + q : q + '_' + p, r = edges.get(key);
        const d = p < q ? 1 : -1;
        if (r) { r.c++; r.d += d; } else edges.set(key, { c: 1, d });
      };
      add(a, b); add(b, c); add(c, a);
    }
    let open = 0, nonManifold = 0, inconsistent = 0;
    for (const r of edges.values()) { if (r.c === 1) open++; else if (r.c > 2) nonManifold++; else if (r.d !== 0) inconsistent++; }
    let uvBad = 0;
    if (mesh.uvs) for (let i = 0; i < mesh.uvs.length; i++) { const u = mesh.uvs[i]; if (u < -1e-4 || u > 1 + 1e-4) uvBad++; }
    const size = mesh.size || (() => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { if (P[i + a] < mn[a]) mn[a] = P[i + a]; if (P[i + a] > mx[a]) mx[a] = P[i + a]; } return [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]]; })();
    const maxSize = Math.max(size[0], size[1], size[2]);
    const limit = opt.limit || (opt.target === 'roblox' || !opt.target ? 20000 : opt.target === 'umum' ? 100000 : 400000);
    const roblox = !opt.target || opt.target === 'roblox';
    const issues = [];
    if (nT > limit) issues.push({ level: roblox ? 'err' : 'warn', code: 'tri', msg: `${nT.toLocaleString('id-ID')} segitiga, di atas target ${limit.toLocaleString('id-ID')}.`, fixable: false });
    if (roblox && maxSize > 2048) issues.push({ level: 'err', code: 'size', msg: `Sisi terpanjang ${maxSize.toFixed(0)} studs. MeshPart Roblox maksimal 2048 studs per sisi.`, fixable: false });
    if (degenerate) issues.push({ level: 'warn', code: 'degenerate', msg: `${degenerate} segitiga tanpa luas (gepeng/dobel titik).`, fixable: true });
    if (vol < 0) issues.push({ level: 'err', code: 'inverted', msg: 'Volume negatif: seluruh muka kemungkinan terbalik (tampak bolong dari luar).', fixable: true });
    if (nonManifold) issues.push({ level: 'warn', code: 'nonmanifold', msg: `${nonManifold} tepi dipakai lebih dari 2 segitiga (bagian yang saling bersinggungan). Aman untuk render, tapi bisa mengganggu pencetakan 3D.`, fixable: false });
    if (inconsistent) issues.push({ level: 'warn', code: 'orient', msg: `${inconsistent} tepi punya arah muka tidak konsisten (sebagian muka terbalik).`, fixable: false });
    if (open) issues.push({ level: 'info', code: 'open', msg: `${open} tepi terbuka (mesh tidak tertutup rapat). Tidak masalah untuk Roblox, tapi perlu ditutup untuk dicetak.`, fixable: false });
    if (uvBad) issues.push({ level: 'warn', code: 'uv', msg: 'Ada koordinat UV di luar 0 sampai 1; tekstur bisa berulang atau terpotong di sebagian engine.', fixable: false });
    if (!issues.some((x) => x.level === 'err' || x.level === 'warn')) issues.unshift({ level: 'ok', code: 'ok', msg: roblox ? 'Siap untuk Roblox: tidak ada masalah ditemukan.' : 'Tidak ada masalah ditemukan.', fixable: false });
    return { triangles: nT, vertices: nV, degenerate, openEdges: open, nonManifold, inconsistent, volume: vol, uvOutOfRange: uvBad, maxSize, issues };
  }

  // Perbaikan aman: buang segitiga tanpa luas dan balik arah bila volume negatif.
  function repairMesh(mesh) {
    const rep = checkMesh(mesh, { target: 'bebas' });
    const P = mesh.positions, I = mesh.indices, nV = P.length / 3;
    const canon = new Map(), cid = new Int32Array(nV);
    for (let v = 0; v < nV; v++) { const k = Math.round(P[v * 3] * 1e4) + ',' + Math.round(P[v * 3 + 1] * 1e4) + ',' + Math.round(P[v * 3 + 2] * 1e4); let c = canon.get(k); if (c == null) { c = v; canon.set(k, v); } cid[v] = c; }
    const keep = [];
    for (let t = 0; t < I.length; t += 3) {
      const ia = I[t], ib = I[t + 1], ic = I[t + 2];
      if (cid[ia] === cid[ib] || cid[ib] === cid[ic] || cid[ia] === cid[ic]) continue;
      const ux = P[ib * 3] - P[ia * 3], uy = P[ib * 3 + 1] - P[ia * 3 + 1], uz = P[ib * 3 + 2] - P[ia * 3 + 2], vx = P[ic * 3] - P[ia * 3], vy = P[ic * 3 + 1] - P[ia * 3 + 1], vz = P[ic * 3 + 2] - P[ia * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * nx + ny * ny + nz * nz < 1e-16) continue;
      keep.push(ia, ib, ic);
    }
    const flip = rep.volume < 0;
    const out = new Uint32Array(keep.length);
    for (let t = 0; t < keep.length; t += 3) { out[t] = keep[t]; out[t + 1] = flip ? keep[t + 2] : keep[t + 1]; out[t + 2] = flip ? keep[t + 1] : keep[t + 2]; }
    const nm = Object.assign({}, mesh, { indices: out, triangles: out.length / 3 });
    if (flip && mesh.normals) { const N = new Float32Array(mesh.normals.length); for (let i = 0; i < N.length; i++) N[i] = -mesh.normals[i]; nm.normals = N; }
    return { mesh: nm, removed: I.length / 3 - out.length / 3, flipped: flip };
  }

  function buildGLB(mesh, pngBytes, mat) {
    mat = Object.assign({ metallic: 0, roughness: 0.7, name: 'Saltoria3D' }, mat || {});
    const enc = new TextEncoder();
    const pad4 = (n) => (n + 3) & ~3;

    const views = [
      { bytes: new Uint8Array(mesh.positions.buffer, mesh.positions.byteOffset, mesh.positions.byteLength), target: 34962 },
      { bytes: new Uint8Array(mesh.normals.buffer, mesh.normals.byteOffset, mesh.normals.byteLength), target: 34962 },
      { bytes: new Uint8Array(mesh.uvs.buffer, mesh.uvs.byteOffset, mesh.uvs.byteLength), target: 34962 },
      { bytes: new Uint8Array(mesh.indices.buffer, mesh.indices.byteOffset, mesh.indices.byteLength), target: 34963 },
      { bytes: pngBytes, target: undefined },
    ];
    let off = 0;
    const bufferViews = views.map((v) => {
      const bv = { buffer: 0, byteOffset: off, byteLength: v.bytes.length };
      if (v.target) bv.target = v.target;
      off += pad4(v.bytes.length);
      return bv;
    });
    const binLength = off;

    const json = {
      asset: { version: '2.0', generator: 'Saltoria 3D Studio' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: mat.name }],
      meshes: [{ name: mat.name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0, mode: 4 }] }],
      materials: [{
        name: mat.name,
        pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: mat.metallic, roughnessFactor: mat.roughness },
      }],
      textures: [{ sampler: 0, source: 0 }],
      samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
      images: [{ bufferView: 4, mimeType: 'image/png' }],
      buffers: [{ byteLength: binLength }],
      bufferViews,
      accessors: [
        { bufferView: 0, componentType: 5126, count: mesh.positions.length / 3, type: 'VEC3', min: mesh.min, max: mesh.max },
        { bufferView: 1, componentType: 5126, count: mesh.normals.length / 3, type: 'VEC3' },
        { bufferView: 2, componentType: 5126, count: mesh.uvs.length / 2, type: 'VEC2' },
        { bufferView: 3, componentType: 5125, count: mesh.indices.length, type: 'SCALAR' },
      ],
    };
    let jsonBytes = enc.encode(JSON.stringify(json));
    const jsonPadded = pad4(jsonBytes.length);
    const total = 12 + 8 + jsonPadded + 8 + binLength;
    const out = new Uint8Array(total);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, jsonPadded, true); dv.setUint32(16, 0x4e4f534a, true);
    out.set(jsonBytes, 20);
    for (let i = jsonBytes.length; i < jsonPadded; i++) out[20 + i] = 0x20;
    const binStart = 20 + jsonPadded;
    dv.setUint32(binStart, binLength, true); dv.setUint32(binStart + 4, 0x004e4942, true);
    views.forEach((v, i) => out.set(v.bytes, binStart + 8 + bufferViews[i].byteOffset));
    return out;
  }

  function buildOBJ(mesh, o) {
    o = Object.assign({ mtl: 'model.mtl', name: 'Saltoria3D', material: 'SaltoriaMat' }, o || {});
    const L = [];
    L.push('# Saltoria 3D Studio', 'mtllib ' + o.mtl, 'o ' + o.name);
    const n = mesh.positions.length / 3;
    const f = (v) => (Math.round(v * 1e6) / 1e6).toString();
    for (let i = 0; i < n; i++) L.push('v ' + f(mesh.positions[i * 3]) + ' ' + f(mesh.positions[i * 3 + 1]) + ' ' + f(mesh.positions[i * 3 + 2]));
    for (let i = 0; i < n; i++) L.push('vt ' + f(mesh.uvs[i * 2]) + ' ' + f(1 - mesh.uvs[i * 2 + 1]));
    for (let i = 0; i < n; i++) L.push('vn ' + f(mesh.normals[i * 3]) + ' ' + f(mesh.normals[i * 3 + 1]) + ' ' + f(mesh.normals[i * 3 + 2]));
    L.push('usemtl ' + o.material, 's off');
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const a = mesh.indices[i] + 1, b = mesh.indices[i + 1] + 1, c = mesh.indices[i + 2] + 1;
      L.push('f ' + a + '/' + a + '/' + a + ' ' + b + '/' + b + '/' + b + ' ' + c + '/' + c + '/' + c);
    }
    return L.join('\n') + '\n';
  }

  function buildMTL(o) {
    o = Object.assign({ texture: 'logo_texture.png', material: 'SaltoriaMat' }, o || {});
    return ['# Saltoria 3D Studio', 'newmtl ' + o.material, 'Ka 1 1 1', 'Kd 1 1 1', 'Ks 0 0 0', 'd 1', 'illum 1', 'map_Kd ' + o.texture, ''].join('\n');
  }

  let crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function buildZip(files) {
    const enc = new TextEncoder();
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const chunks = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = f.data;
      const crc = crc32(data);
      const lh = new Uint8Array(30 + name.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true);
      dv.setUint16(8, 0, true); dv.setUint16(10, dosTime, true); dv.setUint16(12, dosDate, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true);
      dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
      lh.set(name, 30);
      chunks.push(lh, data);

      const ch = new Uint8Array(46 + name.length);
      const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true); cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
      ch.set(name, 46);
      central.push(ch);
      offset += lh.length + data.length;
    }
    let centralSize = 0;
    for (const c of central) centralSize += c.length;
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
    const parts = [...chunks, ...central, end];
    let total = 0;
    for (const p of parts) total += p.length;
    const out = new Uint8Array(total);
    let pos = 0;
    for (const p of parts) { out.set(p, pos); pos += p.length; }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* 9. Utilitas mesh (v3): gabung, geser, balik, STL, relief            */
  /* ------------------------------------------------------------------ */
  function mergeMeshes(list) {
    let nv = 0, ni = 0;
    for (const m of list) { nv += m.positions.length / 3; ni += m.indices.length; }
    const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2);
    const indices = new Uint32Array(ni);
    let vo = 0, io = 0;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const m of list) {
      positions.set(m.positions, vo * 3); normals.set(m.normals, vo * 3);
      if (m.uvs) uvs.set(m.uvs, vo * 2);
      for (let i = 0; i < m.indices.length; i++) indices[io + i] = m.indices[i] + vo;
      for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) {
        const v = m.positions[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v;
      }
      vo += m.positions.length / 3; io += m.indices.length;
    }
    return { positions, normals, uvs, indices, triangles: ni / 3, min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
  }

  function translateMesh(m, dx, dy, dz) {
    for (let i = 0; i < m.positions.length; i += 3) { m.positions[i] += dx; m.positions[i + 1] += dy; m.positions[i + 2] += dz; }
    m.min = [m.min[0] + dx, m.min[1] + dy, m.min[2] + dz];
    m.max = [m.max[0] + dx, m.max[1] + dy, m.max[2] + dz];
    return m;
  }

  // Balik sumbu Z (cermin depan-belakang) sambil membalik urutan segitiga.
  function flipMesh(m) {
    for (let i = 0; i < m.positions.length; i += 3) { m.positions[i + 2] *= -1; m.normals[i + 2] *= -1; }
    for (let i = 0; i < m.indices.length; i += 3) { const t = m.indices[i + 1]; m.indices[i + 1] = m.indices[i + 2]; m.indices[i + 2] = t; }
    const a = -m.max[2], b = -m.min[2]; m.min[2] = a; m.max[2] = b;
    return m;
  }

  // STL biner. Sumbu Y-atas diubah ke Z-atas (x, -z, y) seperti kebiasaan slicer/CAD.
  function buildSTL(m, scale) {
    scale = scale || 1;
    const n = m.indices.length / 3;
    const buf = new ArrayBuffer(84 + n * 50);
    const dv = new DataView(buf);
    const head = 'Saltoria 3D Studio';
    for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i));
    dv.setUint32(80, n, true);
    const P = m.positions;
    const get = (i) => [P[i * 3] * scale, -P[i * 3 + 2] * scale, P[i * 3 + 1] * scale];
    let o = 84;
    for (let t = 0; t < n; t++) {
      const a = get(m.indices[t * 3]), b = get(m.indices[t * 3 + 1]), c = get(m.indices[t * 3 + 2]);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true); o += 12;
      for (const p of [a, b, c]) { dv.setFloat32(o, p[0], true); dv.setFloat32(o + 4, p[1], true); dv.setFloat32(o + 8, p[2], true); o += 12; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return new Uint8Array(buf);
  }

  // Mask relief: kembalikan n-1 lapisan RGBA (alpha = area lapisan). mode:
  //  'bright' = area lebih terang dari ambang, 'dark' = area lebih gelap, 'dome' = makin ke tengah makin tinggi.
  // Nilai tinggi 0..1 per piksel + peta "di dalam" (dipakai bersama oleh relief bertingkat dan relief halus)
  function reliefValues(rgba, w, h, field, level, mode) {
    const N = w * h;
    const inside = new Float32Array(N);
    for (let i = 0; i < N; i++) inside[i] = clamp((field[i] - level) / 0.08 + 0.5, 0, 1);
    const val = new Float32Array(N);
    if (mode === 'dome') {
      const dist = distanceInside(field, w, h, level);
      let mx = 0; for (let i = 0; i < N; i++) if (dist[i] > mx) mx = dist[i];
      mx = mx || 1;
      for (let i = 0; i < N; i++) val[i] = dist[i] / mx;
    } else {
      const lum = new Float32Array(N), pool = [];
      for (let i = 0; i < N; i++) {
        lum[i] = (0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]) / 255;
        if (inside[i] > 0.5 && (i % 3 === 0)) pool.push(lum[i]);
      }
      pool.sort((a, b) => a - b);
      const lo = pool.length ? pool[Math.floor(pool.length * 0.03)] : 0;
      const hi = pool.length ? pool[Math.floor(pool.length * 0.97)] : 1;
      const span = Math.max(1e-3, hi - lo);
      for (let i = 0; i < N; i++) {
        const v = clamp((lum[i] - lo) / span, 0, 1);
        val[i] = mode === 'dark' ? 1 - v : v;
      }
    }
    return { inside, val };
  }

  // Relief halus (heightmap): permukaan kisi yang tingginya mengikuti kecerahan / jarak ke tepi.
  // Hanya sel yang seluruhnya di dalam bentuk yang dibuat, tepi relief turun ke permukaan dasar (tanpa dinding).
  // o: { mode, width, frame(bounds), baseZ, height, res (sel pada sisi terpanjang), blur (lintasan), maxTriangles, uvScale, flip }
  function buildHeightRelief(rgba, w, h, field, level, o) {
    o = Object.assign({ mode: 'bright', width: 10, baseZ: 0.15, height: 0.8, res: 80, blur: 2, maxTriangles: 20000, uvScale: [1, 1], flip: false }, o || {});
    const B = o.frame;
    const { inside, val } = reliefValues(rgba, w, h, field, level, o.mode);
    // haluskan nilai (box blur terpisah) supaya tidak bergerigi
    const tmp = new Float32Array(w * h), R = 2;
    for (let it = 0; it < clamp(Math.round(o.blur), 0, 6); it++) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let sum = 0, n = 0;
        for (let k = -R; k <= R; k++) { const xx = x + k; if (xx >= 0 && xx < w) { sum += val[y * w + xx]; n++; } }
        tmp[y * w + x] = sum / n;
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let sum = 0, n = 0;
        for (let k = -R; k <= R; k++) { const yy = y + k; if (yy >= 0 && yy < h) { sum += tmp[yy * w + x]; n++; } }
        val[y * w + x] = sum / n;
      }
    }
    const bw = B.maxX - B.minX, bh = B.maxY - B.minY;
    let cellsAcross = clamp(Math.round(o.res), 12, 400);
    const cell = Math.max(bw, bh) / cellsAcross;
    let gx = Math.max(2, Math.ceil(bw / cell)), gy = Math.max(2, Math.ceil(bh / cell));
    // batasi anggaran segitiga: maksimal 2 segitiga per sel
    while (gx * gy * 2 > o.maxTriangles && cellsAcross > 12) {
      cellsAcross = Math.floor(cellsAcross * 0.9);
      const c2 = Math.max(bw, bh) / cellsAcross; gx = Math.max(2, Math.ceil(bw / c2)); gy = Math.max(2, Math.ceil(bh / c2));
    }
    const cw = bw / gx, ch = bh / gy;
    const vx = gx + 1, vy = gy + 1;
    const samp = (arr, px, py) => {
      const x = clamp(px, 0, w - 1), y = clamp(py, 0, h - 1);
      const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
      const fx = x - x0, fy = y - y0;
      return (arr[y0 * w + x0] * (1 - fx) + arr[y0 * w + x1] * fx) * (1 - fy) + (arr[y1 * w + x0] * (1 - fx) + arr[y1 * w + x1] * fx) * fy;
    };
    const vIn = new Uint8Array(vx * vy), vH = new Float32Array(vx * vy);
    for (let j = 0; j < vy; j++) for (let i = 0; i < vx; i++) {
      const px = B.minX + i * cw, py = B.minY + j * ch;
      vIn[j * vx + i] = samp(inside, px, py) > 0.5 ? 1 : 0;
      vH[j * vx + i] = samp(val, px, py);
    }
    const cellIn = new Uint8Array(gx * gy);
    const cover = new Uint8Array(vx * vy);
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const ok = vIn[j * vx + i] && vIn[j * vx + i + 1] && vIn[(j + 1) * vx + i] && vIn[(j + 1) * vx + i + 1];
      if (ok) { cellIn[j * gx + i] = 1; cover[j * vx + i]++; cover[j * vx + i + 1]++; cover[(j + 1) * vx + i]++; cover[(j + 1) * vx + i + 1]++; }
    }
    // tinggi akhir; titik di tepi daerah relief = 0 supaya menyatu dengan dasar
    const Z = new Float32Array(vx * vy);
    for (let k = 0; k < Z.length; k++) Z[k] = cover[k] === 4 ? vH[k] * o.height : 0;
    const s = o.width / bw, cx = (B.minX + B.maxX) / 2, cy = (B.minY + B.maxY) / 2;
    const vid = new Int32Array(vx * vy).fill(-1);
    const pos = [], nor = [], uvs = [], idx = [];
    const getV = (i, j) => {
      const k = j * vx + i;
      if (vid[k] >= 0) return vid[k];
      const X = (B.minX + i * cw - cx) * s, Y = -(B.minY + j * ch - cy) * s;
      const zl = Z[j * vx + Math.max(0, i - 1)], zr = Z[j * vx + Math.min(vx - 1, i + 1)];
      const zd = Z[Math.min(vy - 1, j + 1) * vx + i], zu = Z[Math.max(0, j - 1) * vx + i];
      const dx = (Math.min(vx - 1, i + 1) - Math.max(0, i - 1)) * cw * s, dy = (Math.min(vy - 1, j + 1) - Math.max(0, j - 1)) * ch * s;
      let nx = -(zr - zl) / dx, ny = (zd - zu) / dy, nz = 1; // +Y model = atas gambar, jadi tinggi naik ke atas
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      pos.push(X, Y, o.baseZ + Z[k]); nor.push(nx, ny, nz);
      uvs.push(((B.minX + i * cw - B.minX) / bw) * o.uvScale[0], (1 - (j * ch) / bh) * o.uvScale[1]);
      vid[k] = pos.length / 3 - 1; return vid[k];
    };
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      if (!cellIn[j * gx + i]) continue;
      const z00 = Z[j * vx + i], z10 = Z[j * vx + i + 1], z01 = Z[(j + 1) * vx + i], z11 = Z[(j + 1) * vx + i + 1];
      if (z00 + z10 + z01 + z11 < 1e-5) continue; // sel rata: sudah tertutup dasar
      const a = getV(i, j), b = getV(i + 1, j), c = getV(i + 1, j + 1), d = getV(i, j + 1);
      // y gambar ke bawah → Y model ke bawah; a(kiri-atas) b(kanan-atas) c(kanan-bawah) d(kiri-bawah): CCW dilihat dari +Z
      idx.push(a, d, c, a, c, b);
    }
    let positions = new Float32Array(pos), normals = new Float32Array(nor);
    if (o.flip) for (let i = 0; i < positions.length; i += 3) { positions[i] = -positions[i]; positions[i + 2] = -positions[i + 2]; normals[i] = -normals[i]; normals[i + 2] = -normals[i + 2]; }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { const v = positions[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
    if (!idx.length) return null;
    return { positions, normals, uvs: new Float32Array(uvs), indices: Uint32Array.from(idx), triangles: idx.length / 3, min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], bevelFallbacks: 0, flipped: !!o.flip };
  }

  function reliefMasks(rgba, w, h, field, level, o) {
    o = Object.assign({ mode: 'bright', levels: 4 }, o || {});
    const n = clamp(Math.round(o.levels), 2, 8);
    const N = w * h;
    const inside = new Float32Array(N);
    for (let i = 0; i < N; i++) inside[i] = clamp((field[i] - level) / 0.08 + 0.5, 0, 1);
    const val = new Float32Array(N);
    if (o.mode === 'dome') {
      const dist = distanceInside(field, w, h, level);
      let mx = 0; for (let i = 0; i < N; i++) if (dist[i] > mx) mx = dist[i];
      mx = mx || 1;
      for (let i = 0; i < N; i++) val[i] = dist[i] / mx;
    } else {
      const lum = new Float32Array(N), pool = [];
      for (let i = 0; i < N; i++) {
        lum[i] = (0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]) / 255;
        if (inside[i] > 0.5 && (i % 3 === 0)) pool.push(lum[i]);
      }
      pool.sort((a, b) => a - b);
      const lo = pool.length ? pool[Math.floor(pool.length * 0.03)] : 0;
      const hi = pool.length ? pool[Math.floor(pool.length * 0.97)] : 1;
      const span = Math.max(1e-3, hi - lo);
      for (let i = 0; i < N; i++) {
        let v = clamp((lum[i] - lo) / span, 0, 1);
        val[i] = o.mode === 'dark' ? 1 - v : v;
      }
    }
    const layers = [];
    for (let k = 1; k < n; k++) {
      const th = k / n;
      const out = new Uint8ClampedArray(N * 4);
      let any = false;
      for (let i = 0; i < N; i++) {
        const a = inside[i] * clamp((val[i] - th) / 0.08 + 0.5, 0, 1);
        const A = Math.round(a * 255);
        out[i * 4 + 3] = A; if (A > 127) any = true;
      }
      layers.push({ k, rgba: out, any });
    }
    return { n, layers };
  }

  return {
    mergeMeshes, translateMesh, flipMesh, buildSTL, reliefMasks, reliefValues, buildHeightRelief,
    sensitivityToLevel, buildField, distanceInside, traceContours,
    loopArea, simplifyLoop, smoothLoop, estimateTriangles,
    extractShapes, earcut, buildMesh, bleedRGBA,
    buildGLB, buildOBJ, buildMTL, buildZip, crc32, checkMesh, repairMesh,
  };
});
