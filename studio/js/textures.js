/*
 * Saltoria 3D Studio — tekstur prosedural (digambar ke kanvas, tanpa berkas luar).
 * S3DTextures.list = [{id,label}], S3DTextures.draw(id, canvas, colorA, colorB, scale)
 */
(function (root) {
  'use strict';
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  // hash & value-noise deterministik
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const smooth = (t) => t * t * (3 - 2 * t);
  const vnoise = (x, y, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
  const fbm = (x, y, o, s) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { v += a * vnoise(x * f, y * f, s + i); f *= 2; a *= 0.5; } return v; };
  const mix = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];

  // setiap pola: (u,v in 0..1, k = skala) → t 0..1 (campuran warna A→B)
  const PATTERNS = {
    marble: { label: 'Marmer', f: (u, v, k) => { const n = fbm(u * 3 * k, v * 3 * k, 5, 1); return 0.5 + 0.5 * Math.sin((u * 4 * k + n * 6) * Math.PI); } },
    wood: { label: 'Kayu', f: (u, v, k) => { const n = fbm(u * 2 * k, v * 8 * k, 4, 2); const r = (v * 6 * k + n * 2.2); return 0.5 + 0.5 * Math.sin(r * Math.PI * 2) * 0.6 + (n - 0.5) * 0.4; } },
    clouds: { label: 'Awan / asap', f: (u, v, k) => fbm(u * 4 * k, v * 4 * k, 5, 3) },
    stripes: { label: 'Garis miring', f: (u, v, k) => (((u + v) * 8 * k) % 1 < 0.5 ? 0 : 1) },
    checker: { label: 'Kotak-kotak', f: (u, v, k) => ((Math.floor(u * 8 * k) + Math.floor(v * 8 * k)) & 1) },
    grid: { label: 'Kisi teknologi', f: (u, v, k) => { const g = 8 * k, a = Math.abs(((u * g) % 1) - 0.5), b = Math.abs(((v * g) % 1) - 0.5); return Math.min(a, b) > 0.46 ? 1 : 0; } },
    carbon: { label: 'Serat karbon', f: (u, v, k) => { const g = 14 * k, x = Math.floor(u * g), y = Math.floor(v * g), fx = (u * g) % 1, fy = (v * g) % 1; const dir = (x + y) & 1; return dir ? 0.25 + 0.5 * fx : 0.25 + 0.5 * fy; } },
    hex: { label: 'Sarang lebah', f: (u, v, k) => { const s = 9 * k, x = u * s * 1.1547, y = v * s; const row = Math.floor(y), off = (row & 1) * 0.5; const fx = ((x / 1.1547 + off) % 1), fy = y % 1; const d = Math.min(Math.abs(fx - 0.5), 0.5) * 2; return Math.max(d * 0.8, Math.abs(fy - 0.5) * 2) > 0.88 ? 1 : 0.15; } },
    dots: { label: 'Titik-titik', f: (u, v, k) => { const g = 10 * k, fx = (u * g) % 1 - 0.5, fy = (v * g) % 1 - 0.5; return Math.hypot(fx, fy) < 0.3 ? 1 : 0; } },
    noise: { label: 'Bintik kasar (batu)', f: (u, v, k) => fbm(u * 18 * k, v * 18 * k, 3, 7) },
    stars: { label: 'Langit bintang', f: (u, v, k) => { const g = 40 * k, x = Math.floor(u * g), y = Math.floor(v * g); const r = hash(x, y, 9); const d = Math.hypot((u * g) % 1 - 0.5, (v * g) % 1 - 0.5); const neb = fbm(u * 3 * k, v * 3 * k, 4, 5) * 0.55; return Math.min(1, neb + (r > 0.93 && d < 0.18 ? 1 : 0)); } },
  };
  const list = Object.keys(PATTERNS).map((id) => ({ id, label: PATTERNS[id].label }));

  function draw(id, canvas, colA, colB, scale) {
    const P = PATTERNS[id] || PATTERNS.marble, A = hex(colA), B = hex(colB), k = scale || 1;
    const w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = Math.max(0, Math.min(1, P.f(x / w, y / h, k)));
      const c = mix(A, B, t), o = (y * w + x) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  root.S3DTextures = { list, draw };
})(typeof self !== 'undefined' ? self : this);
