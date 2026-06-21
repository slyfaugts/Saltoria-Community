// Saltoria Tools :: YouTube Fetch Proxy
// Proxies requests to a self-hosted Cobalt instance (Railway) to avoid browser CORS
// restrictions and the bot-protection on the public api.cobalt.tools instance.
// Endpoint: POST /api/youtube-fetch
// Body: { url: string, audioFormat?: string, audioBitrate?: string }

// Self-hosted Cobalt instance (Railway). Change this if you redeploy elsewhere.
const COBALT_INSTANCE_URL = 'https://cobalt-production-4ec8.up.railway.app';

export default async function handler(req, res) {
  // CORS headers (allow same-origin + safe defaults)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { url, audioFormat = 'mp3', audioBitrate = '192' } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "url" in request body.' });
  }

  // Basic safety check: only allow youtube.com / youtu.be links
  const isYoutube = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i.test(url);
  if (!isYoutube) {
    return res.status(400).json({ error: 'Only YouTube URLs are supported.' });
  }

  try {
    // Step 1: Ask our self-hosted Cobalt instance for the direct stream/tunnel URL.
    // Cobalt API v10+ uses POST / (not /api/json) with downloadMode instead of isAudioOnly.
    const cobaltRes = await fetch(`${COBALT_INSTANCE_URL}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        url,
        downloadMode: 'audio',
        audioFormat,
        audioBitrate,
      }),
    });

    if (!cobaltRes.ok) {
      let detail;
      try { detail = await cobaltRes.json(); } catch(_) { detail = await cobaltRes.text(); }
      return res.status(502).json({
        error: `Cobalt instance returned HTTP ${cobaltRes.status}`,
        detail,
        hint: cobaltRes.status === 404
          ? 'Endpoint tidak ditemukan — cek apakah instance Railway masih aktif dan URL-nya benar.'
          : cobaltRes.status >= 500
          ? 'Instance Railway mungkin crash atau masih starting up — cek Railway dashboard.'
          : undefined,
      });
    }

    const cobaltData = await cobaltRes.json();

    let streamUrl = null;
    // v10+ uses "tunnel" and "redirect" status (not "stream" from the old /api/json era)
    if (cobaltData.status === 'tunnel' || cobaltData.status === 'redirect') {
      streamUrl = cobaltData.url;
    } else if (cobaltData.status === 'picker' && Array.isArray(cobaltData.picker) && cobaltData.picker[0]) {
      streamUrl = cobaltData.picker[0].url;
    } else if (cobaltData.status === 'error') {
      const code = cobaltData.error?.code || 'unknown';
      throw new Error(`Cobalt error: ${code}`);
    } else if (cobaltData.url) {
      streamUrl = cobaltData.url;
    }

    if (!streamUrl) {
      return res.status(502).json({ error: 'Cobalt instance did not return a stream URL', detail: cobaltData });
    }

    // Step 2: Fetch the actual audio bytes server-side (no CORS issue here)
    const audioRes = await fetch(streamUrl);
    if (!audioRes.ok) {
      return res.status(502).json({ error: 'Failed to download audio stream from Cobalt instance' });
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', audioRes.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Internal proxy error', detail: String(err) });
  }
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '5mb' },
    responseLimit: '50mb',
  },
};
