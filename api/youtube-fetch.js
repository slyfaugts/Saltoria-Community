// Saltoria Tools :: Audio Fetch Proxy
// Forwards requests to yt-dlp Railway service.
// Supports YouTube, SoundCloud, TikTok, Instagram, Twitter, and 1000+ platforms.

export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' },
    responseLimit: '80mb',
  },
  maxDuration: 100, // detik — samakan/lebih besar dari AbortSignal.timeout di bawah
};

// Ganti dengan URL Railway service yt-dlp kamu setelah deploy
const YTDLP_API = process.env.YTDLP_API_URL || 'https://saltoria-ytdlp-production.up.railway.app';

// Restrict to known frontends instead of '*' — this endpoint proxies to a
// paid Railway service, and an open CORS policy lets any site embed/hotlink it.
const ALLOWED_ORIGINS = [
  'https://saltoria.vercel.app',
  'http://localhost:3000',
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
      signal: AbortSignal.timeout(100_000), // 100s timeout
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
