/**
 * Saltoria DataStore Manager — Vercel Function, dipakai tools/datastore-manager.html (endpoint: /api/datastore-proxy)
 * Proxy stateless ke Roblox Open Cloud. API key hanya diteruskan, TIDAK disimpan / dicatat.
 * Hanya rute di allowlist R yang diteruskan. Opsional: env ALLOWED_ORIGINS (pisah koma).
 */
// Proxy stateless ke Roblox. API key TIDAK disimpan / dicatat. Hanya rute di allowlist.
const A = 'apis.roblox.com';
const R = [
  { h: A, re: /^\/datastores\/v1\/universes\/\d+\/standard-datastores(\/datastore\/entries(\/entry(\/versions(\/version)?)?)?)?$/ },
  { h: A, re: /^\/ordered-data-stores\/v1\/universes\/\d+\/orderedDataStores\/(?!\.)[^/]+\/scopes\/(?!\.)[^/]+\/entries(\/(?!\.)[^/]+)?$/ },
  { h: A, re: /^\/game-passes\/v1\/universes\/\d+\/game-passes\/creator$/ },
  { h: A, re: /^\/developer-products\/v2\/universes\/\d+\/developer-products\/creator$/ },
  { h: A, re: /^\/universes\/v1\/places\/\d+\/universe$/, open: 1 },
  { h: 'users.roblox.com', re: /^\/v1\/usernames\/users$/, open: 1 },
];
const KEEP = ['roblox-entry-version', 'roblox-entry-userids', 'roblox-entry-attributes', 'roblox-entry-created-time', 'roblox-entry-version-created-time', 'retry-after'];
function originOk(origin, host) {
  if (!origin) return true;
  try { if (new URL(origin).host === host) return true; } catch { return false; }
  return ['https://saltoria.site', 'https://www.saltoria.site', 'http://localhost:3000']
    .concat((process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)).includes(origin);
}
export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!originOk(req.headers.origin, req.headers.host)) return res.status(403).json({ status: 403, headers: {}, body: 'Origin tidak diizinkan' });
  const key = req.headers['x-api-key'];
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  const { method = 'GET', path, query = {}, body, headers = {} } = b || {};
  const rt = typeof path === 'string' && !/%2e|%5c/i.test(path) && R.find(x => x.re.test(path));
  const bad = !rt || !['GET', 'POST', 'PATCH', 'DELETE'].includes(method) || (!rt.open && !key) ||
    (method === 'DELETE' && !/(\/entry|\/entries\/[^/]+)$/.test(path));
  if (bad) return res.status(400).json({ status: 400, headers: {}, body: 'Permintaan ditolak oleh proxy' });
  const u = new URL('https://' + rt.h + path);
  for (const [k, v] of Object.entries(query)) if (v !== '' && v != null) u.searchParams.set(k, String(v));
  const h = {};
  if (!rt.open) h['x-api-key'] = key;
  for (const k of ['roblox-entry-userids', 'roblox-entry-attributes']) if (headers[k]) h[k] = String(headers[k]);
  if (method !== 'GET') h['content-type'] = 'application/json';
  try {
    const r = await fetch(u, { method, headers: h, body: method !== 'GET' && method !== 'DELETE' ? JSON.stringify(body) : undefined });
    const out = {};
    KEEP.forEach(k => { const v = r.headers.get(k); if (v) out[k] = v; });
    res.status(200).json({ status: r.status, headers: out, body: await r.text() });
  } catch (e) { res.status(502).json({ status: 502, headers: {}, body: 'Gagal menghubungi Roblox' }); }
}
