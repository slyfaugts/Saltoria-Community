// Saltoria Tools :: Audio Fetch Proxy
// Forwards requests to yt-dlp Railway service.
// Supports YouTube, SoundCloud, TikTok, Instagram, Twitter, and 1000+ platforms.

import { applyCors } from '../lib/cors.js';
import { rateLimit } from '../lib/ratelimit.js';

export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' },
    responseLimit: '80mb',
  },
  // maxDuration diatur di vercel.json (sumber tunggal). Timeout fetch di bawah sengaja
  // sedikit lebih kecil supaya user dapat pesan error rapi, bukan "function timed out".
};

// Ganti dengan URL Railway service yt-dlp kamu setelah deploy
const YTDLP_API = process.env.YTDLP_API_URL || 'https://saltoria-ytdlp-production.up.railway.app';

export default async function handler(req, res) {
  // Endpoint ini memanggil service Railway berbayar → origin dibatasi & ada rate limit per IP.
  const allowed = applyCors(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type', expose: 'x-title, x-title-b64' });
  if (req.method === 'OPTIONS') return res.status(allowed ? 204 : 403).end();
  if (!allowed) return res.status(403).json({ error: 'Origin tidak diizinkan' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = rateLimit(req, { name: 'audio-fetch', limit: 12, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(rl.retryAfter / 60)} menit.` });
  }

  const { url, audioFormat, audioBitrate } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "url"' });
  }

  // Basic URL sanity check
  try { new URL(url); } catch {
    return res.status(400).json({ error: 'URL tidak valid' });
  }

  const safeFormat  = ['mp3','ogg','wav','opus','m4a'].includes(audioFormat) ? audioFormat : 'mp3';
  const safeBitrate = ['320','256','128','96','64'].includes(String(audioBitrate)) ? String(audioBitrate) : '128';

  try {
    // Forward ke yt-dlp Railway service
    const upstream = await fetch(`${YTDLP_API}/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, format: safeFormat, bitrate: safeBitrate }),
      signal: AbortSignal.timeout(55_000), // < maxDuration 60s di vercel.json
    });

    // Kalau upstream error, teruskan pesan errornya ke client
    if (!upstream.ok) {
      let detail;
      try { detail = await upstream.json(); } catch { detail = { error: `Upstream HTTP ${upstream.status}` }; }
      return res.status(502).json({
        error: detail.error || `yt-dlp service error: HTTP ${upstream.status}`,
        hint: 'Pastikan Railway service yt-dlp kamu sedang running.',
      });
    }

    // Buffer full response (yt-dlp sudah selesai download sebelum kirim)
    const arrayBuf = await upstream.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuf);

    if (audioBuffer.byteLength === 0) {
      return res.status(502).json({ error: 'yt-dlp mengembalikan file kosong (0 bytes)' });
    }

    const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', audioBuffer.byteLength);
    res.setHeader('Cache-Control', 'no-store');

    // Forward the video title from the yt-dlp service so the client can name
    // the downloaded/uploaded file after the real title instead of falling
    // back to guessing it from the URL slug.
    const titleB64 = upstream.headers.get('x-title-b64');
    const titlePlain = upstream.headers.get('x-title');
    if (titleB64) {
      res.setHeader('x-title-b64', titleB64);
      try {
        res.setHeader('x-title', Buffer.from(titleB64, 'base64').toString('utf-8'));
      } catch { /* ignore decode failure, x-title-b64 is still forwarded */ }
    } else if (titlePlain) {
      res.setHeader('x-title', titlePlain);
    }
    // Same-origin browser requests can read these fine, but expose them
    // explicitly in case this is ever called cross-origin.
    res.setHeader('Access-Control-Expose-Headers', 'x-title, x-title-b64');

    res.status(200).end(audioBuffer);

  } catch (err) {
    console.error('[audio-fetch] error:', err);
    if (err.name === 'TimeoutError') {
      return res.status(504).json({
        error: 'Request timeout — video mungkin terlalu panjang atau koneksi ke Railway lambat.',
      });
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal proxy error', detail: String(err) });
    }
  }
}
