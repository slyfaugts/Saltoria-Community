// Saltoria Tools :: YouTube Fetch Proxy
// Proxies requests to self-hosted Cobalt instance on Railway.
// Uses streaming (pipe) instead of buffering to avoid timeout on large audio files.

export const config = {
  api: {
    bodyParser: { sizeLimit: '5mb' },
    responseLimit: false, // disable response size limit — we stream directly
  },
};

const COBALT_URL = 'https://cobalt-production-4ec8.up.railway.app';
const VALID_BITRATES = ['320', '256', '128', '96', '64', '8'];
const VALID_FORMATS  = ['best', 'mp3', 'ogg', 'wav', 'opus'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse body — Vercel bodyParser puts it in req.body
  const body = req.body || {};
  const { url, audioFormat, audioBitrate } = body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "url"' });
  }

  const isYoutube = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i.test(url);
  if (!isYoutube) {
    return res.status(400).json({ error: 'Only YouTube URLs are supported' });
  }

  const safeBitrate = VALID_BITRATES.includes(String(audioBitrate)) ? String(audioBitrate) : '128';
  const safeFormat  = VALID_FORMATS.includes(String(audioFormat))   ? String(audioFormat)  : 'mp3';

  try {
    // ── Step 1: Get tunnel URL from Cobalt ───────────────────────
    const cobaltRes = await fetch(`${COBALT_URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        url,
        downloadMode: 'audio',
        audioFormat: safeFormat,
        audioBitrate: safeBitrate,
      }),
    });

    if (!cobaltRes.ok) {
      let detail;
      try { detail = await cobaltRes.json(); } catch (_) { detail = await cobaltRes.text(); }
      return res.status(502).json({
        error: `Cobalt returned HTTP ${cobaltRes.status}`,
        detail,
      });
    }

    const cobaltData = await cobaltRes.json();

    // Handle error status from cobalt
    if (cobaltData.status === 'error') {
      return res.status(502).json({
        error: 'Cobalt error',
        detail: cobaltData.error?.code || 'unknown',
      });
    }

    // Extract tunnel/redirect URL
    let tunnelUrl = null;
    if (cobaltData.status === 'tunnel' || cobaltData.status === 'redirect') {
      tunnelUrl = cobaltData.url;
    } else if (cobaltData.status === 'picker' && cobaltData.picker?.[0]?.url) {
      tunnelUrl = cobaltData.picker[0].url;
    } else if (cobaltData.url) {
      tunnelUrl = cobaltData.url;
    }

    if (!tunnelUrl) {
      return res.status(502).json({ error: 'No stream URL returned', detail: cobaltData });
    }

    // ── Step 2: Stream audio directly to client ───────────────────
    // Use Node.js streaming (pipe) instead of buffering the whole file.
    // This avoids timeout and memory issues with large audio files.
    const audioRes = await fetch(tunnelUrl);

    if (!audioRes.ok) {
      return res.status(502).json({
        error: `Audio stream fetch failed: HTTP ${audioRes.status}`,
      });
    }

    // Set response headers
    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
    const contentLength = audioRes.headers.get('content-length');
    const estLength = audioRes.headers.get('estimated-content-length');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    else if (estLength) res.setHeader('X-Estimated-Length', estLength);

    // Pipe the stream directly
    const { Readable } = await import('node:stream');
    const nodeStream = Readable.fromWeb(audioRes.body);
    nodeStream.pipe(res);

    // Handle stream errors
    nodeStream.on('error', (err) => {
      console.error('[youtube-fetch] Stream error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Stream error', detail: String(err) });
      else res.end();
    });

  } catch (err) {
    console.error('[youtube-fetch] Error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal proxy error', detail: String(err) });
    }
  }
}
