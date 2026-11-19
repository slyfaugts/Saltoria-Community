/*
 * Saltoria 3D Studio — Lathe (putar profil) dan Sweep (sapu profil sepanjang jalur). Menghasilkan mesh {P,T} tertutup rapat.
 */
(function (root) {
  'use strict';
  // profil: [[r,y],...] dengan r ≥ 0, dari bawah ke atas. cap: tutup ujung bila r>0
  function lathe(profile, seg, angleDeg, cap) {
    seg = Math.max(3, Math.min(128, Math.round(seg || 32))); angleDeg = Math.max(10, Math.min(360, angleDeg || 360));
    const full = angleDeg >= 359.999, steps = full ? seg : seg + 1, n = profile.length, P = [], T = [];
    const ang = (i) => ((i / seg) * angleDeg * Math.PI) / 180;
    for (let i = 0; i < steps; i++) for (let j = 0; j < n; j++) { const r = profile[j][0], a = ang(i); P.push(r * Math.cos(a), profile[j][1], r * Math.sin(a)); }
    const id = (i, j) => ((full ? i % seg : i) * n) + j;
    for (let i = 0; i < seg; i++) for (let j = 0; j < n - 1; j++) {
      const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
      T.push(a, c, b, a, d, c);
    }
    const addCenter = (j, up) => {
      const r = profile[j][0]; if (r < 1e-9 || cap === false) return; const ci = P.length / 3; P.push(0, profile[j][1], 0);
      for (let i = 0; i < seg; i++) { const a = id(i, j), b = id(i + 1, j); if (up) T.push(ci, b, a); else T.push(ci, a, b); }
    };
    // arah normal: profil naik (y bertambah) dengan r positif → permukaan menghadap keluar bila urutan (a,c,b) berlawanan jarum jam dari luar
    addCenter(0, false); addCenter(n - 1, true);
    return orient({ P: Float64Array.from(P), T: Uint32Array.from(T) });
  }

  // profil2D: poligon tertutup [[x,y],...]; jalur: [[x,y,z],...]; closed: jalur melingkar
  function sweep(profile, path, closed, scale) {
    const n = profile.length, m = path.length, P = [], T = [];
    if (n < 3 || m < 2) throw new Error('Butuh profil ≥3 titik dan jalur ≥2 titik.');
    const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const tan = path.map((p, i) => { const a = path[closed ? (i + m - 1) % m : Math.max(0, i - 1)], b = path[closed ? (i + 1) % m : Math.min(m - 1, i + 1)]; return norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]); });
    // kerangka paralel (rotation-minimizing)
    let up = Math.abs(tan[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; let nrm = norm(cross(tan[0], cross(up, tan[0]))); const frames = [];
    for (let i = 0; i < m; i++) {
      if (i > 0) { const proj = nrm[0] * tan[i][0] + nrm[1] * tan[i][1] + nrm[2] * tan[i][2]; nrm = norm([nrm[0] - tan[i][0] * proj, nrm[1] - tan[i][1] * proj, nrm[2] - tan[i][2] * proj]); }
      frames.push({ n: nrm, b: cross(tan[i], nrm) });
    }
    for (let i = 0; i < m; i++) {
      const s = scale ? scale(i / (m - 1)) : 1;
      for (let j = 0; j < n; j++) { const [x, y] = profile[j]; P.push(path[i][0] + (frames[i].n[0] * x + frames[i].b[0] * y) * s, path[i][1] + (frames[i].n[1] * x + frames[i].b[1] * y) * s, path[i][2] + (frames[i].n[2] * x + frames[i].b[2] * y) * s); }
    }
    const rings = closed ? m : m - 1;
    for (let i = 0; i < rings; i++) for (let j = 0; j < n; j++) {
      const a = i * n + j, b = i * n + (j + 1) % n, c = ((i + 1) % m) * n + (j + 1) % n, d = ((i + 1) % m) * n + j;
      T.push(a, b, c, a, c, d);
    }
    if (!closed) { // tutup kedua ujung dengan kipas dari titik pusat
      for (const end of [0, m - 1]) { const ci = P.length / 3; let cx = 0, cy = 0, cz = 0; for (let j = 0; j < n; j++) { cx += P[(end * n + j) * 3]; cy += P[(end * n + j) * 3 + 1]; cz += P[(end * n + j) * 3 + 2]; } P.push(cx / n, cy / n, cz / n); for (let j = 0; j < n; j++) { const a = end * n + j, b = end * n + (j + 1) % n; if (end === 0) T.push(ci, b, a); else T.push(ci, a, b); } }
    }
    return orient({ P: Float64Array.from(P), T: Uint32Array.from(T) });
  }

  // pastikan volume positif (normal keluar); balik bila negatif
  function orient(m) {
    let v = 0; const P = m.P, T = m.T;
    for (let t = 0; t < T.length; t += 3) { const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3; v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]); }
    if (v < 0) for (let t = 0; t < T.length; t += 3) { const x = T[t + 1]; T[t + 1] = T[t + 2]; T[t + 2] = x; }
    return m;
  }

  const PRESETS = {
    vas: [[0.01, 0], [0.45, 0], [0.55, 0.15], [0.7, 0.55], [0.5, 1.0], [0.28, 1.25], [0.34, 1.5], [0.45, 1.6]],
    botol: [[0.01, 0], [0.5, 0], [0.55, 0.1], [0.55, 1.1], [0.4, 1.4], [0.18, 1.55], [0.18, 1.9], [0.22, 1.95], [0.22, 2.05]],
    gelas: [[0.01, 0], [0.35, 0], [0.38, 0.06], [0.55, 0.9], [0.52, 0.9], [0.33, 0.1]],
    gasing: [[0.01, 0], [0.12, 0.1], [0.55, 0.55], [0.5, 0.75], [0.2, 0.95], [0.08, 1.3]],
    pion: [[0.01, 0], [0.5, 0], [0.5, 0.1], [0.3, 0.2], [0.18, 0.6], [0.32, 0.7], [0.32, 0.8], [0.22, 0.85], [0.3, 1.0], [0.22, 1.2], [0.01, 1.25]],
  };
  root.S3DLathe = { lathe, sweep, orient, PRESETS };
})(typeof self !== 'undefined' ? self : this);
