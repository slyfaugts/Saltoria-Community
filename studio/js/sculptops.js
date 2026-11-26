/*
 * Operasi mesh untuk Sculpt: adjacency, normal, tambah detail (refine), haluskan (relax),
 * pindahkan warna vertex, kuantisasi warna vertex, dan penjalan di Web Worker (dengan cadangan sinkron).
 * Murni data (tanpa DOM) sehingga bisa dipakai di Worker dan di uji Node.
 */
(function (root) {
  'use strict';
  const MO = root.S3DMeshOps;
  let scriptSrc = null;
  try { if (typeof document !== 'undefined' && document.currentScript) scriptSrc = document.currentScript.src; } catch (e) { /* abaikan */ }

  // CSR: tetangga titik (tanpa duplikat) dan daftar segitiga per titik
  function buildAdj(nV, T) {
    const nT = T.length / 3;
    const tCount = new Int32Array(nV + 1);
    for (let i = 0; i < T.length; i++) tCount[T[i] + 1]++;
    for (let i = 0; i < nV; i++) tCount[i + 1] += tCount[i];
    const tList = new Int32Array(T.length), fill = tCount.slice(0, nV);
    for (let t = 0; t < nT; t++) for (let c = 0; c < 3; c++) tList[fill[T[t * 3 + c]]++] = t;
    const vStart = new Int32Array(nV + 1), nb = [];
    const mark = new Int32Array(nV).fill(-1);
    for (let v = 0; v < nV; v++) {
      vStart[v] = nb.length;
      for (let k = tCount[v]; k < tCount[v + 1]; k++) {
        const t = tList[k];
        for (let c = 0; c < 3; c++) { const u = T[t * 3 + c]; if (u !== v && mark[u] !== v) { mark[u] = v; nb.push(u); } }
      }
    }
    vStart[nV] = nb.length;
    return { vStart, vNbr: Int32Array.from(nb), tStart: tCount, tList };
  }

  // normal vertex berbobot luas; bila `only` diberikan, hanya titik itu yang dihitung ulang
  function vertexNormals(P, T, adj, N, only) {
    const nV = P.length / 3;
    N = N || new Float32Array(nV * 3);
    const one = (v) => {
      let x = 0, y = 0, z = 0;
      for (let k = adj.tStart[v]; k < adj.tStart[v + 1]; k++) {
        const t = adj.tList[k], a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
        const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
        x += uy * vz - uz * vy; y += uz * vx - ux * vz; z += ux * vy - uy * vx;
      }
      const l = Math.hypot(x, y, z) || 1; N[v * 3] = x / l; N[v * 3 + 1] = y / l; N[v * 3 + 2] = z / l;
    };
    if (only) for (const v of only) one(v); else for (let v = 0; v < nV; v++) one(v);
    return N;
  }

  // Bagi tepi yang lebih panjang dari maxEdge sampai semua tepi cukup pendek (atau batas segitiga tercapai).
  function refine(m, maxEdge, maxTris) {
    maxTris = maxTris || 400000;
    let P = Array.from(m.P), T = Array.from(m.T), C = m.C ? Array.from(m.C) : null, VC = m.VC ? Array.from(m.VC) : null;
    const lim2 = maxEdge * maxEdge;
    for (let pass = 0; pass < 8; pass++) {
      const nT = T.length / 3, mid = new Map();
      const d2 = (a, b) => { const x = P[a * 3] - P[b * 3], y = P[a * 3 + 1] - P[b * 3 + 1], z = P[a * 3 + 2] - P[b * 3 + 2]; return x * x + y * y + z * z; };
      const key = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);
      let est = 0;
      for (let t = 0; t < nT; t++) for (let e = 0; e < 3; e++) {
        const a = T[t * 3 + e], b = T[t * 3 + (e + 1) % 3];
        if (d2(a, b) > lim2) { const k = key(a, b); if (!mid.has(k)) mid.set(k, -1); est++; }
      }
      if (!mid.size) break;
      if (nT + est > maxTris) break;
      const getMid = (a, b) => {
        const k = key(a, b); let id = mid.get(k);
        if (id === -1) {
          id = P.length / 3; mid.set(k, id);
          P.push((P[a * 3] + P[b * 3]) / 2, (P[a * 3 + 1] + P[b * 3 + 1]) / 2, (P[a * 3 + 2] + P[b * 3 + 2]) / 2);
          if (VC) VC.push((VC[a * 3] + VC[b * 3]) / 2, (VC[a * 3 + 1] + VC[b * 3 + 1]) / 2, (VC[a * 3 + 2] + VC[b * 3 + 2]) / 2);
        }
        return id;
      };
      const NT = [], NC = [];
      const emit = (t, a, b, c) => { NT.push(a, b, c); if (C) NC.push(C[t]); };
      for (let t = 0; t < nT; t++) {
        const v = [T[t * 3], T[t * 3 + 1], T[t * 3 + 2]];
        const s = [0, 1, 2].map((e) => mid.has(key(v[e], v[(e + 1) % 3])));
        const cnt = s[0] + s[1] + s[2];
        if (cnt === 0) { emit(t, v[0], v[1], v[2]); continue; }
        const mm = [0, 1, 2].map((e) => (s[e] ? getMid(v[e], v[(e + 1) % 3]) : -1));
        if (cnt === 1) {
          const i = s.indexOf(true), a = v[i], b = v[(i + 1) % 3], c = v[(i + 2) % 3], m0 = mm[i];
          emit(t, a, m0, c); emit(t, m0, b, c);
        } else if (cnt === 2) {
          const k = s.indexOf(false), a = v[k], b = v[(k + 1) % 3], c = v[(k + 2) % 3], m1 = mm[(k + 1) % 3], m2 = mm[(k + 2) % 3];
          emit(t, m1, c, m2); emit(t, a, b, m1); emit(t, a, m1, m2);
        } else {
          emit(t, v[0], mm[0], mm[2]); emit(t, mm[0], v[1], mm[1]); emit(t, mm[2], mm[1], v[2]); emit(t, mm[0], mm[1], mm[2]);
        }
      }
      T = NT; if (C) C = NC;
    }
    return { P: Float64Array.from(P), T: Uint32Array.from(T), C: C ? Uint16Array.from(C) : undefined, pal: m.pal, VC: VC ? Float32Array.from(VC) : undefined };
  }

  // haluskan teratur: geser titik ke rata-rata tetangga tanpa komponen normal (menjaga bentuk)
  function relax(m, iters, lambda, adj) {
    const nV = m.P.length / 3;
    adj = adj || buildAdj(nV, m.T);
    let P = Float64Array.from(m.P), Q = new Float64Array(P.length);
    const N = new Float32Array(nV * 3);
    for (let it = 0; it < iters; it++) {
      vertexNormals(P, m.T, adj, N);
      for (let v = 0; v < nV; v++) {
        const s = adj.vStart[v], e = adj.vStart[v + 1];
        if (e === s) { Q[v * 3] = P[v * 3]; Q[v * 3 + 1] = P[v * 3 + 1]; Q[v * 3 + 2] = P[v * 3 + 2]; continue; }
        let x = 0, y = 0, z = 0;
        for (let k = s; k < e; k++) { const u = adj.vNbr[k] * 3; x += P[u]; y += P[u + 1]; z += P[u + 2]; }
        x = x / (e - s) - P[v * 3]; y = y / (e - s) - P[v * 3 + 1]; z = z / (e - s) - P[v * 3 + 2];
        const d = x * N[v * 3] + y * N[v * 3 + 1] + z * N[v * 3 + 2];
        Q[v * 3] = P[v * 3] + (x - d * N[v * 3]) * lambda; Q[v * 3 + 1] = P[v * 3 + 1] + (y - d * N[v * 3 + 1]) * lambda; Q[v * 3 + 2] = P[v * 3 + 2] + (z - d * N[v * 3 + 2]) * lambda;
      }
      const tmp = P; P = Q; Q = tmp;
    }
    return { P, T: m.T, C: m.C, pal: m.pal, VC: m.VC };
  }

  // warna titik terdekat dari mesh lama (grid spasial)
  function transferColors(oldP, oldVC, newP) {
    const n = oldP.length / 3;
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { const v = oldP[i * 3 + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
    const size = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2], 1e-9);
    const g = Math.max(4, Math.min(64, Math.round(Math.cbrt(n) * 1.5))), cell = size / g;
    const cellOf = (x, a) => Math.max(0, Math.min(g - 1, Math.floor((x - mn[a]) / cell)));
    const grid = new Map();
    for (let i = 0; i < n; i++) { const k = (cellOf(oldP[i * 3], 0) * g + cellOf(oldP[i * 3 + 1], 1)) * g + cellOf(oldP[i * 3 + 2], 2); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(i); }
    const out = new Float32Array((newP.length / 3) * 3);
    for (let v = 0; v < newP.length / 3; v++) {
      const cx = cellOf(newP[v * 3], 0), cy = cellOf(newP[v * 3 + 1], 1), cz = cellOf(newP[v * 3 + 2], 2);
      let best = -1, bd = Infinity;
      for (let r = 0; r < g && best < 0; r++) {
        for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) for (let z = cz - r; z <= cz + r; z++) {
          if (x < 0 || y < 0 || z < 0 || x >= g || y >= g || z >= g) continue;
          if (Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz)) !== r) continue;
          const l = grid.get((x * g + y) * g + z); if (!l) continue;
          for (const i of l) { const dx = oldP[i * 3] - newP[v * 3], dy = oldP[i * 3 + 1] - newP[v * 3 + 1], dz = oldP[i * 3 + 2] - newP[v * 3 + 2]; const d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = i; } }
        }
      }
      if (best < 0) best = 0;
      out[v * 3] = oldVC[best * 3]; out[v * 3 + 1] = oldVC[best * 3 + 1]; out[v * 3 + 2] = oldVC[best * 3 + 2];
    }
    return out;
  }

  // warna titik (0..1) → warna per segitiga berpalet (maks maxColors)
  function quantizeVC(T, VC, maxColors) {
    const nT = T.length / 3, RGB = new Uint8Array(nT * 3);
    for (let t = 0; t < nT; t++) for (let c = 0; c < 3; c++) {
      const s = (VC[T[t * 3] * 3 + c] + VC[T[t * 3 + 1] * 3 + c] + VC[T[t * 3 + 2] * 3 + c]) / 3;
      RGB[t * 3 + c] = Math.max(0, Math.min(255, Math.round(s * 255)));
    }
    const q = MO.quantize({ P: new Float64Array(0), T, RGB }, maxColors || 24);
    return { C: q.C, pal: q.pal };
  }

  const hexRGB = (h) => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

  // warna titik dari palet per segitiga (titik memakai warna segitiga pertamanya)
  function vcFromPalette(nV, T, C, pal, adj, fallbackHex) {
    const fb = hexRGB(fallbackHex || '#c8d2e6'), VC = new Float32Array(nV * 3);
    const rgb = pal ? pal.map(hexRGB) : null;
    for (let v = 0; v < nV; v++) {
      let col = fb;
      if (C && rgb && adj.tStart[v + 1] > adj.tStart[v]) col = rgb[C[adj.tList[adj.tStart[v]]]] || fb;
      VC[v * 3] = col[0]; VC[v * 3 + 1] = col[1]; VC[v * 3 + 2] = col[2];
    }
    return VC;
  }

  // ---- penjalan tugas (Worker atau sinkron) ----
  const OPS = {
    refine: (a) => refine(a.mesh, a.maxEdge, a.maxTris),
    relax: (a) => relax(a.mesh, a.iters, a.lambda),
    decimate: (a) => { const r = MO.decimate(a.mesh, a.target); const o = { P: r.P, T: r.T, C: r.C, pal: r.pal }; if (a.mesh.VC) o.VC = transferColors(a.mesh.P, a.mesh.VC, r.P); return o; },
  };
  function runSync(op, args) { if (!OPS[op]) throw new Error('operasi tidak dikenal: ' + op); return OPS[op](args); }
  const transferables = (r) => { const l = []; for (const k of ['P', 'T', 'C', 'VC']) if (r[k] && r[k].buffer) l.push(r[k].buffer); return l; };

  let worker = null, wbad = false, seq = 0; const pending = new Map();
  function getWorker() {
    if (wbad || typeof Worker === 'undefined' || !scriptSrc) return null;
    if (worker) return worker;
    try {
      worker = new Worker(scriptSrc.replace(/sculptops\.js(\?.*)?$/, 'worker.js'));
      worker.onmessage = (e) => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.ok ? p.res(e.data.r) : p.rej(new Error(e.data.err)); };
      worker.onerror = () => { wbad = true; worker = null; for (const [, p] of pending) p.fallback(); pending.clear(); };
    } catch (e) { wbad = true; worker = null; }
    return worker;
  }
  // mengembalikan Promise; bila Worker tidak tersedia/gagal, dijalankan di thread utama
  function run(op, args) {
    return new Promise((res, rej) => {
      const w = getWorker();
      const local = () => { try { res(runSync(op, args)); } catch (e) { rej(e); } };
      if (!w) { setTimeout(local, 0); return; }
      const id = ++seq; pending.set(id, { res, rej, fallback: local });
      try { w.postMessage({ id, op, args }); } catch (e) { pending.delete(id); local(); }
    });
  }

  root.S3DSculptOps = { buildAdj, vertexNormals, refine, relax, transferColors, quantizeVC, vcFromPalette, hexRGB, run, runSync, transferables, OPS };
})(typeof self !== 'undefined' ? self : this);
