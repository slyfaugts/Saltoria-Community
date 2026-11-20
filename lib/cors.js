// Saltoria :: helper CORS bersama untuk semua fungsi di /api.
// Folder lib/ sengaja DI LUAR api/ supaya Vercel tidak menganggapnya sebagai endpoint.
//
// Aturan:
//  - Origin yang diizinkan = DEFAULT_ORIGINS + env ALLOWED_ORIGINS (pisah koma, mis. https://staging.saltoria.site).
//  - Request dari host deployment itu sendiri selalu lolos (termasuk URL preview *.vercel.app
//    yang memanggil /api miliknya sendiri), jadi tes di preview tidak perlu env tambahan.
//  - Request tanpa header Origin (curl, server-to-server, GET same-origin) tidak ditolak di sini;
//    tiap endpoint tetap punya validasi & allowlist sendiri.

const DEFAULT_ORIGINS = [
  'https://saltoria.site',
  'https://www.saltoria.site',
  'http://localhost:3000',
];

export function allowedOrigins() {
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return DEFAULT_ORIGINS.concat(extra);
}

export function isAllowedOrigin(origin, host) {
  if (!origin) return true;
  let u;
  try { u = new URL(origin); } catch { return false; }
  if (host && u.host === host) return true;
  return allowedOrigins().includes(u.origin);
}

/**
 * Pasang header CORS. Mengembalikan true bila origin diizinkan.
 * Pemanggil yang menangani preflight & penolakan, supaya format error tiap endpoint tidak berubah:
 *
 *   const ok = applyCors(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type' });
 *   if (req.method === 'OPTIONS') return res.status(ok ? 204 : 403).end();
 *   if (!ok) return res.status(403).json({ error: 'Origin tidak diizinkan' });
 */
export function applyCors(req, res, { methods = 'POST, OPTIONS', headers = 'Content-Type', expose = '' } = {}) {
  const origin = req.headers.origin;
  const ok = isAllowedOrigin(origin, req.headers.host);
  res.setHeader('Vary', 'Origin');
  if (origin && ok) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', headers);
    res.setHeader('Access-Control-Max-Age', '600');
    if (expose) res.setHeader('Access-Control-Expose-Headers', expose);
  }
  return ok;
}
