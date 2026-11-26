/*
 * Saltoria 3D Studio — operasi mesh umum (tanpa dependensi):
 *  - parseOBJ / parseGLB : baca model dari berkas
 *  - weld                : gabungkan titik kembar
 *  - decimate            : turunkan jumlah segitiga (edge collapse dengan quadric error)
 *  - toSoup / fromSoup   : konversi ke format Modeler (titik tidak dibagi, normal per muka)
 * Format "mesh" di sini: { P: Float64Array(xyz), T: Uint32Array(3 per segitiga) } = berindeks dan ter-weld.
 */
(function (root) {
  'use strict';

  const MAX_IN_TRIS = 2000000;

  /* ---------------------------- membaca ---------------------------- */
  function parseMTL(text) {
    const mats = {}; let cur = null;
    for (const raw of String(text || '').split(/\r?\n/)) {
      const s = raw.trim().split(/\s+/);
      if (s[0] === 'newmtl') { cur = s.slice(1).join(' '); mats[cur] = [200, 200, 200]; }
      else if (s[0] === 'Kd' && cur) mats[cur] = [0, 1, 2].map((i) => Math.round(Math.min(1, Math.max(0, +s[i + 1] || 0)) * 255));
    }
    return mats;
  }
  function parseOBJ(text, mtlText) {
    const P = [], T = [], CT = [];
    const mats = mtlText ? parseMTL(mtlText) : null;
    let curCol = [200, 200, 200];
    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
      if (raw.charCodeAt(0) === 118 && raw.charCodeAt(1) === 32) { // "v "
        const s = raw.trim().split(/\s+/);
        P.push(+s[1] || 0, +s[2] || 0, +s[3] || 0);
      } else if (mats && raw.startsWith('usemtl ')) {
        const c = mats[raw.slice(7).trim()]; if (c) curCol = c;
      } else if (raw.charCodeAt(0) === 102 && raw.charCodeAt(1) === 32) { // "f "
        const s = raw.trim().split(/\s+/).slice(1);
        const ids = s.map((t) => { let i = parseInt(t, 10); if (i < 0) i = P.length / 3 + i + 1; return i - 1; });
        if (ids.some((i) => !(i >= 0 && i < P.length / 3))) continue;
        for (let k = 1; k + 1 < ids.length; k++) { T.push(ids[0], ids[k], ids[k + 1]); CT.push(curCol[0], curCol[1], curCol[2]); } // kipas
        if (T.length / 3 > MAX_IN_TRIS) throw new Error('Model terlalu besar (lebih dari 2 juta segitiga).');
      }
    }
    if (!T.length) throw new Error('Tidak ada segitiga di berkas OBJ.');
    return { P: Float64Array.from(P), T: Uint32Array.from(T), RGB: mats ? Uint8Array.from(CT) : null };
  }

  const COMP = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
  const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

  function parseGLB(buf, images) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Bukan berkas GLB.');
    let off = 12, json = null, bin = null;
    while (off + 8 <= buf.byteLength) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      const chunk = buf.slice(off + 8, off + 8 + len);
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
      else if (type === 0x004e4942 && !bin) bin = chunk;
      off += 8 + len + ((4 - (len % 4)) % 4) * 0;
      if (len % 4) off += 4 - (len % 4);
    }
    if (!json) throw new Error('GLB rusak: tidak ada JSON.');
    if (!bin) throw new Error('GLB ini memakai berkas luar (.bin); gunakan GLB satu berkas.');
    const readAcc = (ai) => {
      const a = json.accessors[ai], bv = json.bufferViews[a.bufferView];
      const [Ctor, size] = COMP[a.componentType], n = NCOMP[a.type];
      const stride = bv.byteStride || size * n;
      const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
      const out = new Float64Array(a.count * n);
      const view = new DataView(bin);
      const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
      for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = view[get](start + i * stride + k * size, true);
      return out;
    };
    const mulM = (A, B) => { const o = new Float64Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += A[k * 4 + r] * B[c * 4 + k]; o[c * 4 + r] = s; } return o; };
    const nodeM = (nd) => {
      if (nd.matrix) return Float64Array.from(nd.matrix);
      const t = nd.translation || [0, 0, 0], q = nd.rotation || [0, 0, 0, 1], s = nd.scale || [1, 1, 1];
      const [x, y, z, w] = q;
      const m = new Float64Array(16);
      m[0] = (1 - 2 * (y * y + z * z)) * s[0]; m[1] = 2 * (x * y + z * w) * s[0]; m[2] = 2 * (x * z - y * w) * s[0];
      m[4] = 2 * (x * y - z * w) * s[1]; m[5] = (1 - 2 * (x * x + z * z)) * s[1]; m[6] = 2 * (y * z + x * w) * s[1];
      m[8] = 2 * (x * z + y * w) * s[2]; m[9] = 2 * (y * z - x * w) * s[2]; m[10] = (1 - 2 * (x * x + y * y)) * s[2];
      m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; m[15] = 1;
      return m;
    };
    const P = [], T = [], CT = [];
    let anyColor = false;
    const lin2s = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
    const I4 = Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const addMesh = (mi, M) => {
      for (const pr of json.meshes[mi].primitives || []) {
        if (pr.mode != null && pr.mode !== 4) continue;
        if (pr.attributes.POSITION == null) continue;
        const pos = readAcc(pr.attributes.POSITION), base = P.length / 3;
        for (let i = 0; i < pos.length; i += 3) {
          const x = pos[i], y = pos[i + 1], z = pos[i + 2];
          P.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
        }
        const idx = pr.indices != null ? readAcc(pr.indices) : Float64Array.from({ length: pos.length / 3 }, (_, i) => i);
        // warna: faktor material, tekstur warna (sampel di titik tengah UV segitiga), warna titik
        const mat = pr.material != null && json.materials ? json.materials[pr.material] : null, pbr = (mat && mat.pbrMetallicRoughness) || {};
        const fac = pbr.baseColorFactor || [1, 1, 1, 1];
        const hasTexInfo = pbr.baseColorTexture && json.textures && json.textures[pbr.baseColorTexture.index];
        const img = hasTexInfo && images ? images[json.textures[pbr.baseColorTexture.index].source] : null;
        const uvs = img && pr.attributes.TEXCOORD_0 != null ? readAcc(pr.attributes.TEXCOORD_0) : null;
        const vcol = pr.attributes.COLOR_0 != null ? readAcc(pr.attributes.COLOR_0) : null;
        const vcN = vcol ? (json.accessors[pr.attributes.COLOR_0].type === 'VEC4' ? 4 : 3) : 0;
        const vcScale = vcol && json.accessors[pr.attributes.COLOR_0].normalized ? (json.accessors[pr.attributes.COLOR_0].componentType === 5123 ? 65535 : 255) : 1;
        for (let i = 0; i + 2 < idx.length; i += 3) {
          T.push(base + idx[i], base + idx[i + 1], base + idx[i + 2]);
          let r = fac[0], g = fac[1], b = fac[2];
          if (uvs) {
            const u = (uvs[idx[i] * 2] + uvs[idx[i + 1] * 2] + uvs[idx[i + 2] * 2]) / 3, v = (uvs[idx[i] * 2 + 1] + uvs[idx[i + 1] * 2 + 1] + uvs[idx[i + 2] * 2 + 1]) / 3;
            const px = Math.min(img.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * img.w))), py = Math.min(img.h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * img.h))), o = (py * img.w + px) * 4;
            const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
            r *= toLin(img.data[o]); g *= toLin(img.data[o + 1]); b *= toLin(img.data[o + 2]);
          }
          if (vcol) { for (const q of [0, 1, 2]) { /* rata-rata 3 titik */ } const f = (ch) => (vcol[idx[i] * vcN + ch] + vcol[idx[i + 1] * vcN + ch] + vcol[idx[i + 2] * vcN + ch]) / 3 / vcScale; r *= f(0); g *= f(1); b *= f(2); }
          const R = lin2s(r), G = lin2s(g), B2 = lin2s(b);
          if (!(R > 250 && G > 250 && B2 > 250)) anyColor = true;
          CT.push(R, G, B2);
        }
        if (T.length / 3 > MAX_IN_TRIS) throw new Error('Model terlalu besar (lebih dari 2 juta segitiga).');
      }
    };
    const walk = (ni, parent, depth) => {
      if (depth > 64) return;
      const nd = json.nodes[ni], M = mulM(parent, nodeM(nd));
      if (nd.mesh != null) addMesh(nd.mesh, M);
      for (const c of nd.children || []) walk(c, M, depth + 1);
    };
    const sc = json.scenes && json.scenes[json.scene || 0];
    if (json.nodes && sc) for (const n of sc.nodes || []) walk(n, I4, 0);
    else if (json.meshes) for (let i = 0; i < json.meshes.length; i++) addMesh(i, I4);
    if (!T.length) throw new Error('Tidak ada segitiga di berkas GLB.');
    return { P: Float64Array.from(P), T: Uint32Array.from(T), RGB: anyColor ? Uint8Array.from(CT) : null };
  }

  // Decode gambar tekstur GLB (hanya di peramban). Hasil: array indeks gambar → {w,h,data}
  async function loadGLBImages(buf) {
    try {
      const dv = new DataView(buf); let off = 12, json = null, bin = null;
      while (off + 8 <= buf.byteLength) { const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true); const ch = buf.slice(off + 8, off + 8 + len); if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(ch)); else if (type === 0x004e4942 && !bin) bin = ch; off += 8 + len; }
      if (!json || !bin || !json.images || typeof createImageBitmap === 'undefined') return null;
      const out = [];
      for (const im of json.images) {
        if (im.bufferView == null) { out.push(null); continue; }
        const bv = json.bufferViews[im.bufferView];
        try {
          const bmp = await createImageBitmap(new Blob([new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength)], { type: im.mimeType || 'image/png' }));
          const k = Math.min(1, 512 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
          const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0, w, h);
          out.push({ w, h, data: x.getImageData(0, 0, w, h).data });
        } catch (e) { out.push(null); }
      }
      return out;
    } catch (e) { return null; }
  }

  /* ---------------------------- weld & bersih ---------------------------- */
  // Gabungkan titik kembar (toleransi relatif ke ukuran model) dan buang segitiga merosot.
  function weld(m, relTol) {
    const P = m.P, T = m.T;
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < min[k]) min[k] = P[i + k]; if (P[i + k] > max[k]) max[k] = P[i + k]; }
    const diag = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
    const q = diag * (relTol || 1e-6);
    const map = new Map(), remap = new Uint32Array(P.length / 3), NP = [];
    for (let i = 0; i < P.length / 3; i++) {
      const key = Math.round(P[i * 3] / q) + ',' + Math.round(P[i * 3 + 1] / q) + ',' + Math.round(P[i * 3 + 2] / q);
      let j = map.get(key);
      if (j === undefined) { j = NP.length / 3; map.set(key, j); NP.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); }
      remap[i] = j;
    }
    const NT = [], seen = new Set(), NC = [];
    for (let t = 0; t < T.length; t += 3) {
      const a = remap[T[t]], b = remap[T[t + 1]], c = remap[T[t + 2]];
      if (a === b || b === c || a === c) continue;
      const k = [a, b, c].sort((x, y) => x - y).join('_');
      if (seen.has(k)) continue; // muka ganda
      seen.add(k);
      NT.push(a, b, c);
      if (m.RGB) NC.push(m.RGB[t], m.RGB[t + 1], m.RGB[t + 2]);
      else if (m.C) NC.push(m.C[t / 3]);
    }
    const res = { P: Float64Array.from(NP), T: Uint32Array.from(NT) };
    if (m.RGB) res.RGB = Uint8Array.from(NC); else if (m.C) { res.C = Uint16Array.from(NC); res.pal = m.pal; }
    return res;
  }

  /* ---------------------------- decimate (QEM) ---------------------------- */
  function decimate(m, targetTris, opts) {
    opts = opts || {};
    const nV0 = m.P.length / 3;
    let nT = m.T.length / 3;
    if (nT <= targetTris) return { P: m.P, T: m.T, C: m.C, pal: m.pal, removed: 0 };
    const P = Float64Array.from(m.P);
    const T = Uint32Array.from(m.T);
    const alive = new Uint8Array(nT).fill(1);
    const vAlive = new Uint8Array(nV0).fill(1);
    const vTris = Array.from({ length: nV0 }, () => new Set());
    for (let t = 0; t < nT; t++) for (let c = 0; c < 3; c++) vTris[T[t * 3 + c]].add(t);
    const Q = new Float64Array(nV0 * 10);
    const addPlane = (v, a, b, c, d, w) => {
      const o = v * 10;
      Q[o] += w * a * a; Q[o + 1] += w * a * b; Q[o + 2] += w * a * c; Q[o + 3] += w * a * d;
      Q[o + 4] += w * b * b; Q[o + 5] += w * b * c; Q[o + 6] += w * b * d;
      Q[o + 7] += w * c * c; Q[o + 8] += w * c * d; Q[o + 9] += w * d * d;
    };
    const faceN = (t) => {
      const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    };
    for (let t = 0; t < nT; t++) {
      const n = faceN(t), l = Math.hypot(n[0], n[1], n[2]);
      if (l < 1e-18) continue;
      const a = n[0] / l, b = n[1] / l, c = n[2] / l, p0 = T[t * 3] * 3, d = -(a * P[p0] + b * P[p0 + 1] + c * P[p0 + 2]);
      for (let k = 0; k < 3; k++) addPlane(T[t * 3 + k], a, b, c, d, l * 0.5);
    }
    // tepi terbuka: tambah bidang tegak lurus agar tepi tidak menyusut
    const edgeCount = new Map();
    const ek = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);
    for (let t = 0; t < nT; t++) for (let c = 0; c < 3; c++) { const k = ek(T[t * 3 + c], T[t * 3 + (c + 1) % 3]); edgeCount.set(k, (edgeCount.get(k) || 0) + 1); }
    const bw = opts.boundaryWeight == null ? 50 : opts.boundaryWeight;
    for (let t = 0; t < nT; t++) {
      const n = faceN(t), l = Math.hypot(n[0], n[1], n[2]) || 1;
      for (let c = 0; c < 3; c++) {
        const va = T[t * 3 + c], vb = T[t * 3 + (c + 1) % 3];
        if (edgeCount.get(ek(va, vb)) !== 1) continue;
        const ex = P[vb * 3] - P[va * 3], ey = P[vb * 3 + 1] - P[va * 3 + 1], ez = P[vb * 3 + 2] - P[va * 3 + 2];
        let px = ey * n[2] / l - ez * n[1] / l, py = ez * n[0] / l - ex * n[2] / l, pz = ex * n[1] / l - ey * n[0] / l;
        const pl = Math.hypot(px, py, pz); if (pl < 1e-18) continue;
        px /= pl; py /= pl; pz /= pl;
        const d = -(px * P[va * 3] + py * P[va * 3 + 1] + pz * P[va * 3 + 2]);
        addPlane(va, px, py, pz, d, bw * pl); addPlane(vb, px, py, pz, d, bw * pl);
      }
    }
    const err = (qa, qb, x, y, z) => {
      let s = 0;
      for (let k = 0; k < 1; k++) {
        const q = (i) => qa[i] + qb[i];
        s = q(0) * x * x + 2 * q(1) * x * y + 2 * q(2) * x * z + 2 * q(3) * x + q(4) * y * y + 2 * q(5) * y * z + 2 * q(6) * y + q(7) * z * z + 2 * q(8) * z + q(9);
      }
      return s;
    };
    const qOf = (v) => Q.subarray(v * 10, v * 10 + 10);
    // pilih posisi hasil terbaik di antara ujung A, ujung B, dan titik tengah
    const best = (a, b) => {
      const qa = qOf(a), qb = qOf(b);
      const A = [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], B = [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]];
      const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
      const cs = [A, B, M].map((p) => [err(qa, qb, p[0], p[1], p[2]), p]);
      cs.sort((x, y) => x[0] - y[0]);
      return { cost: Math.max(0, cs[0][0]), pos: cs[0][1] };
    };

    // heap sederhana (min) dengan versi untuk entri basi
    const ver = new Uint32Array(nV0);
    const heap = [];
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].c <= heap[i].c) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, s = i; if (l < heap.length && heap[l].c < heap[s].c) s = l; if (r < heap.length && heap[r].c < heap[s].c) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } }
      return top;
    };
    const neighbors = (v) => { const s = new Set(); for (const t of vTris[v]) for (let c = 0; c < 3; c++) { const u = T[t * 3 + c]; if (u !== v) s.add(u); } return s; };
    const pushEdge = (a, b) => { const r = best(a, b); push({ c: r.cost, a, b, va: ver[a], vb: ver[b], pos: r.pos }); };
    const done = new Set();
    for (let t = 0; t < nT; t++) for (let c = 0; c < 3; c++) {
      const a = T[t * 3 + c], b = T[t * 3 + (c + 1) % 3], k = ek(a, b);
      if (done.has(k)) continue; done.add(k); pushEdge(a, b);
    }

    // cek balik: setelah pindah ke `pos`, normal muka sekitar tidak boleh terbalik / merosot
    const flips = (v, other, pos) => {
      for (const t of vTris[v]) {
        if (!alive[t]) continue;
        let has = false; for (let c = 0; c < 3; c++) if (T[t * 3 + c] === other) has = true;
        if (has) continue; // muka ini akan hilang
        const ids = [T[t * 3], T[t * 3 + 1], T[t * 3 + 2]];
        const p = ids.map((i) => (i === v ? pos : [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]));
        const o = faceN(t);
        const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2], vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
        const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
        const lo = Math.hypot(o[0], o[1], o[2]), ln = Math.hypot(n[0], n[1], n[2]);
        if (ln < 1e-15) return true;
        if (lo > 1e-15 && (o[0] * n[0] + o[1] * n[1] + o[2] * n[2]) / (lo * ln) < 0.2) return true;
      }
      return false;
    };

    let guard = 0;
    while (nT > targetTris && heap.length && guard++ < 50000000) {
      const e = pop();
      const { a, b } = e;
      if (!vAlive[a] || !vAlive[b] || e.va !== ver[a] || e.vb !== ver[b]) continue;
      if (flips(a, b, e.pos) || flips(b, a, e.pos)) continue;
      // cegah lipatan: tetangga bersama harus tepat 2 (atau 1 untuk tepi terbuka)
      const na = neighbors(a), nb = neighbors(b); let common = 0; for (const u of na) if (nb.has(u)) common++;
      if (common > 2) continue;
      // lakukan: b → a di posisi baru
      P[a * 3] = e.pos[0]; P[a * 3 + 1] = e.pos[1]; P[a * 3 + 2] = e.pos[2];
      const qa = qOf(a), qb = qOf(b); for (let i = 0; i < 10; i++) qa[i] += qb[i];
      for (const t of [...vTris[b]]) {
        let has = false; for (let c = 0; c < 3; c++) if (T[t * 3 + c] === a) has = true;
        if (has) { alive[t] = 0; nT--; for (let c = 0; c < 3; c++) vTris[T[t * 3 + c]].delete(t); }
        else { for (let c = 0; c < 3; c++) if (T[t * 3 + c] === b) T[t * 3 + c] = a; vTris[b].delete(t); vTris[a].add(t); }
      }
      vAlive[b] = 0; ver[a]++;
      for (const u of neighbors(a)) { ver[u]++; }
      for (const u of neighbors(a)) pushEdge(a, u);
    }
    // kompaksi
    const remap = new Int32Array(nV0).fill(-1), NP = [], NT = [], NC = [];
    for (let t = 0; t < alive.length; t++) {
      if (!alive[t]) continue;
      const ids = [T[t * 3], T[t * 3 + 1], T[t * 3 + 2]];
      if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) continue;
      for (const i of ids) { if (remap[i] < 0) { remap[i] = NP.length / 3; NP.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); } NT.push(remap[i]); }
      if (m.C) NC.push(m.C[t]);
    }
    return { P: Float64Array.from(NP), T: Uint32Array.from(NT), C: m.C ? Uint16Array.from(NC) : undefined, pal: m.pal, removed: m.T.length / 3 - NT.length / 3 };
  }

  // Kuantisasi warna per segitiga ke maksimal `maxColors` warna (median cut pada histogram 5-bit).
  function quantize(m, maxColors) {
    if (!m.RGB) return m;
    const n = m.T.length / 3, hist = new Map();
    for (let t = 0; t < n; t++) { const k = ((m.RGB[t * 3] >> 3) << 10) | ((m.RGB[t * 3 + 1] >> 3) << 5) | (m.RGB[t * 3 + 2] >> 3); hist.set(k, (hist.get(k) || 0) + 1); }
    let boxes = [Array.from(hist.entries()).map(([k, c]) => ({ r: (k >> 10) & 31, g: (k >> 5) & 31, b: k & 31, c, k }))];
    while (boxes.length < Math.max(1, maxColors)) {
      let bi = -1, best = 0, axis = 0;
      boxes.forEach((bx, i) => { if (bx.length < 2) return; for (const [a, key] of [[0, 'r'], [1, 'g'], [2, 'b']]) { let lo = 99, hi = -1; for (const e of bx) { if (e[key] < lo) lo = e[key]; if (e[key] > hi) hi = e[key]; } const sc = (hi - lo) * bx.reduce((s, e) => s + e.c, 0); if (sc > best) { best = sc; bi = i; axis = key; } } });
      if (bi < 0) break;
      const bx = boxes[bi].sort((p, q) => p[axis] - q[axis]); const tot = bx.reduce((s, e) => s + e.c, 0); let acc = 0, cut = 1;
      for (let i = 0; i < bx.length - 1; i++) { acc += bx[i].c; if (acc >= tot / 2) { cut = i + 1; break; } cut = i + 1; }
      boxes.splice(bi, 1, bx.slice(0, cut), bx.slice(cut));
    }
    const pal = [], map = new Map();
    boxes.forEach((bx, i) => { let r = 0, g = 0, b = 0, c = 0; for (const e of bx) { r += e.r * e.c; g += e.g * e.c; b += e.b * e.c; c += e.c; map.set(e.k, i); } const to = (v) => Math.min(255, Math.round((v / c) * 8 + 4)); pal.push('#' + [to(r), to(g), to(b)].map((v) => v.toString(16).padStart(2, '0')).join('')); });
    const C = new Uint16Array(n);
    for (let t = 0; t < n; t++) C[t] = map.get(((m.RGB[t * 3] >> 3) << 10) | ((m.RGB[t * 3 + 1] >> 3) << 5) | (m.RGB[t * 3 + 2] >> 3));
    return { P: m.P, T: m.T, C, pal: pal.length > 1 ? pal : pal };
  }

  // Pindahkan ke pusat, skala ke `size`, putar Z-up → Y-up bila perlu; warna ikut.
  function normalize(m, size, upAxis) {
    const P = new Float64Array(m.P.length), R = upAxis === 'z' ? (x, y, z) => [x, z, -y] : (x, y, z) => [x, y, z];
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < m.P.length; i += 3) { const r = R(m.P[i], m.P[i + 1], m.P[i + 2]); P[i] = r[0]; P[i + 1] = r[1]; P[i + 2] = r[2]; for (let k = 0; k < 3; k++) { if (r[k] < mn[k]) mn[k] = r[k]; if (r[k] > mx[k]) mx[k] = r[k]; } }
    const ext = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1, k = (size || 4) / ext, c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    for (let i = 0; i < P.length; i += 3) { P[i] = (P[i] - c[0]) * k; P[i + 1] = (P[i + 1] - c[1]) * k; P[i + 2] = (P[i + 2] - c[2]) * k; }
    return { P, T: m.T, C: m.C, pal: m.pal };
  }

  /* ---------------------------- konversi ---------------------------- */
  // Mesh berindeks → format Modeler (titik tidak dibagi, normal per muka, pusat di origin, tinggi `size`, alas di y=0 dilakukan oleh Modeler).
  function toSoup(m, size, upAxis, raw) {
    const P = m.P, T = m.T;
    // sumbu atas: 'y' (default) atau 'z' (model dari Blender) → ubah ke y-atas
    const R = upAxis === 'z' ? (x, y, z) => [x, z, -y] : (x, y, z) => [x, y, z];
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    const Q = new Float64Array(P.length);
    for (let i = 0; i < P.length; i += 3) {
      const r = R(P[i], P[i + 1], P[i + 2]);
      Q[i] = r[0]; Q[i + 1] = r[1]; Q[i + 2] = r[2];
      for (let k = 0; k < 3; k++) { if (r[k] < min[k]) min[k] = r[k]; if (r[k] > max[k]) max[k] = r[k]; }
    }
    const ext = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
    // raw: koordinat dipertahankan apa adanya (dipakai hasil edit dan model terdaftar)
    const k = raw ? 1 : (size || 4) / ext, c = raw ? [0, 0, 0] : [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const nT = T.length / 3;
    const positions = new Float32Array(nT * 9), normals = new Float32Array(nT * 9), indices = new Uint32Array(nT * 3);
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    // urutkan segitiga per warna agar tiap warna menempati rentang titik yang berurutan
    const order = new Uint32Array(nT); for (let i = 0; i < nT; i++) order[i] = i;
    if (m.C && m.pal) order.sort((a, b) => m.C[a] - m.C[b] || a - b);
    const ranges = [];
    for (let q = 0; q < nT; q++) {
      const t = order[q];
      if (m.C && m.pal) { const ci = m.C[t], last = ranges[ranges.length - 1]; if (last && last.ci === ci) last.count += 3; else ranges.push({ ci, hex: m.pal[ci], start: q * 3, count: 3 }); }
      const v = [0, 1, 2].map((j) => { const i = T[t * 3 + j] * 3; return [(Q[i] - c[0]) * k, (Q[i + 1] - c[1]) * k, (Q[i + 2] - c[2]) * k]; });
      const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2], vx = v[2][0] - v[0][0], vy = v[2][1] - v[0][1], vz = v[2][2] - v[0][2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (let j = 0; j < 3; j++) {
        const o = q * 9 + j * 3;
        positions[o] = v[j][0]; positions[o + 1] = v[j][1]; positions[o + 2] = v[j][2];
        normals[o] = nx; normals[o + 1] = ny; normals[o + 2] = nz;
        for (let a = 0; a < 3; a++) { if (v[j][a] < mn[a]) mn[a] = v[j][a]; if (v[j][a] > mx[a]) mx[a] = v[j][a]; }
        indices[q * 3 + j] = q * 3 + j;
      }
    }
    const out = { positions, normals, indices, min: mn, max: mx, triangles: nT };
    if (ranges.length) out.ranges = ranges.map((r) => ({ hex: r.hex, start: r.start, count: r.count }));
    return out;
  }

  // Kebalikannya: geometri Modeler → mesh berindeks ter-weld (untuk decimate)
  function fromSoup(g) {
    const P = new Float64Array(g.positions.length);
    for (let i = 0; i < P.length; i++) P[i] = g.positions[i];
    return weld({ P, T: Uint32Array.from(g.indices) }, 1e-7);
  }

  // extra: { mtl: teks .mtl } untuk OBJ. Mengembalikan mesh ter-weld dengan warna terkuantisasi (C + pal) bila ada.
  async function parseAny(name, buf, extra, maxColors) {
    const lower = String(name || '').toLowerCase();
    let m;
    if (/\.glb$/.test(lower)) m = weld(parseGLB(buf, await loadGLBImages(buf)));
    else if (/\.obj$/.test(lower)) m = weld(parseOBJ(new TextDecoder().decode(buf), extra && extra.mtl));
    else throw new Error('Format belum didukung. Pakai .glb atau .obj.');
    return quantize(m, maxColors || 24);
  }

  const api = { parseOBJ, parseMTL, parseGLB, parseAny, loadGLBImages, weld, quantize, normalize, decimate, toSoup, fromSoup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.S3DMeshOps = api;
})(typeof self !== 'undefined' ? self : this);
