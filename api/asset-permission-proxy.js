/**
 * Saltoria Asset Permission — Vercel Function (proxy ke Roblox) — dipakai tools/asset-permission.html, endpoint: /api/asset-permission-proxy
 *
 * Roblox tidak mengizinkan request langsung dari browser (CORS), jadi halaman
 * mengirim request ke /api/proxy, lalu fungsi ini meneruskannya ke Roblox.
 * API key hanya diteruskan, tidak disimpan dan tidak dicatat.
 *
 * Kontrak (POST JSON):
 *   { "url": "https://apis.roblox.com/...", "method": "PATCH", "headers": {...}, "body": "<string>|null" }
 *
 * Opsional: env ALLOWED_ORIGINS (pisah koma) untuk mengizinkan origin lain,
 * mis. https://saltoria.site. Origin yang sama dengan deployment selalu diizinkan.
 */

const RULES = [
  { host: 'apis.roblox.com',       method: 'PATCH', path: /^\/asset-permissions-api\/v1\/assets\/permissions$/ },
  { host: 'apis.roblox.com',       method: 'GET',   path: /^\/universes\/v1\/places\/\d+\/universe$/ },
  { host: 'apis.roblox.com',       method: 'GET',   path: /^\/assets\/v1\/assets\/\d+$/ },
  { host: 'itemconfiguration.roblox.com', method: 'GET', path: /^\/v1\/creations\/get-assets$/ },
  { host: 'users.roblox.com',      method: 'GET',   path: /^\/v1\/users\/\d+$/ },
  { host: 'users.roblox.com',      method: 'POST',  path: /^\/v1\/usernames\/users$/ },
  { host: 'groups.roblox.com',     method: 'GET',   path: /^\/v1\/groups\/\d+$/ },
  { host: 'games.roblox.com',      method: 'GET',   path: /^\/v1\/games$/ },
  { host: 'thumbnails.roblox.com', method: 'GET',   path: /^\/v1\/(users\/avatar-headshot|groups\/icons|games\/icons)$/ },
];

const FORWARD_HEADERS = ['x-api-key', 'content-type'];

function extraOrigins() {
  return ['https://saltoria.site', 'https://www.saltoria.site', 'http://localhost:3000']
    .concat((process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
}

function originAllowed(origin, host) {
  if (!origin) return true; // bukan browser (mis. curl); endpoint tetap dibatasi allowlist
  try {
    if (new URL(origin).host === host) return true;
  } catch { return false; }
  return extraOrigins().includes(origin);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin, req.headers.host)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Expose-Headers', 'retry-after');
    res.setHeader('Vary', 'Origin');
  }
}

function fail(res, status, message) {
  res.status(status).setHeader('content-type', 'application/json');
  res.send(JSON.stringify({ error: { message } }));
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return fail(res, 405, 'Gunakan POST');
  if (!originAllowed(req.headers.origin, req.headers.host)) return fail(res, 403, 'Origin tidak diizinkan');

  let payload = req.body;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { payload = null; } }
  if (!payload || typeof payload !== 'object') return fail(res, 400, 'JSON tidak valid');

  let target;
  try { target = new URL(payload.url); } catch { return fail(res, 400, 'URL tidak valid'); }

  const method = String(payload.method || 'GET').toUpperCase();
  const allowed = target.protocol === 'https:' &&
    RULES.some(r => r.host === target.hostname && r.method === method && r.path.test(target.pathname));
  if (!allowed) return fail(res, 403, 'Endpoint tidak diizinkan oleh proxy');

  const headers = {};
  for (const [k, v] of Object.entries(payload.headers || {})) {
    if (FORWARD_HEADERS.includes(k.toLowerCase())) headers[k] = String(v);
  }

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      method,
      headers,
      body: method === 'GET' ? undefined : (payload.body == null ? undefined : String(payload.body)),
    });
  } catch {
    return fail(res, 502, 'Gagal menghubungi Roblox');
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.status(upstream.status);
  res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
  const ra = upstream.headers.get('retry-after');
  if (ra) res.setHeader('retry-after', ra);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buf);
}
