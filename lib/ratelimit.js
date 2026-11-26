// Saltoria :: rate limit sederhana (in-memory).
// CATATAN: state hanya hidup selama instance serverless itu "hangat" dan tidak dibagi antar instance,
// jadi ini pagar anti-spam ringan, bukan jaminan keras. Untuk batas ketat pakai Vercel KV / Upstash.

const buckets = new Map();

export function clientIp(req) {
  const xr = req.headers['x-real-ip'];
  if (xr) return String(xr).trim();
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

/** @returns {{ok:boolean, retryAfter:number}} */
export function rateLimit(req, { name, limit, windowMs }) {
  const now = Date.now();
  const key = name + ':' + clientIp(req);
  let hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 2000) { // buang entri kedaluwarsa agar memori tidak membengkak
    for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}
