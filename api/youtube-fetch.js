// Saltoria Tools :: Audio Fetch Proxy
// Forwards requests to yt-dlp Railway service.
// Supports YouTube, SoundCloud, TikTok, Instagram, Twitter, and 1000+ platforms.

export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' },
    responseLimit: '80mb',
  },
};

// Ganti dengan URL Railway service yt-dlp kamu setelah deploy
const YTDLP_API = process.env.YTDLP_API_URL || 'https://YOUR-RAILWAY-SERVICE.up.railway.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
