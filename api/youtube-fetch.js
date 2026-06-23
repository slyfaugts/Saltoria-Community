// Saltoria Tools :: YouTube Fetch Proxy
// Proxies requests to self-hosted Cobalt instance on Railway.

export const config = {
  api: {
    bodyParser: { sizeLimit: '5mb' },
    responseLimit: false,
  },
};

const COBALT_URL = 'https://cobalt-production-4ec8.up.railway.app';
const VALID_BITRATES = ['320', '256', '128', '96', '64', '8'];
const VALID_FORMATS  = ['best', 'mp3', 'ogg', 'wav', 'opus'];

async function getCobaltUrl(url, audioFormat, audioBitrate) {
  const res = await fetch(`${COBALT_URL}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ url, downloadMode: 'audio', audioFormat, audioBitrate }),
  });

  if (!res.ok) {
    let detail;
    try { detail = await res.json(); } catch (_) { detail = await res.text(); }
    throw Object.assign(new Error(`Cobalt HTTP ${res.status}`), { detail, status: 502 });
  }

  const data = await res.json();
  console.log('[youtube-fetch] cobalt response:', JSON.stringify(data));

  if (data.status === 'error') {
    throw Object.assign(new Error(`Cobalt error: ${data.error?.code || 'unknown'}`), { status: 502 });
  }

  let streamUrl = null;
  if (data.status === 'tunnel' || data.status === 'redirect') {
    streamUrl = data.url;
  } else if (data.status === 'picker' && data.picker?.[0]?.url) {
    streamUrl = data.picker[0].url;
  } else if (data.url) {
    streamUrl = data.url;
  }

  if (!streamUrl) {
    throw Object.assign(new Error('No stream URL from Cobalt'), { detail: data, status: 502 });
  }

  return { streamUrl, cobaltStatus: data.status };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
    // ── Step 1: Get stream URL from Cobalt ───────────────────────
    let streamUrl, cobaltStatus;
    try {
      ({ streamUrl, cobaltStatus } = await getCobaltUrl(url, safeFormat, safeBitrate));
    } catch (e) {
      return res.status(e.status || 502).json({
        error: e.message,
        detail: e.detail,
        hint: 'Cobalt instance mungkin sedang down atau video tidak tersedia. Cek Railway dashboard kamu.',
      });
    }

    console.log('[youtube-fetch] cobaltStatus:', cobaltStatus, '| streamUrl:', streamUrl);

    // ── Step 2: Fetch the audio stream ───────────────────────────
    // Cobalt tunnel sometimes returns 502 from Railway — retry up to 2x.
    let audioRes;
    let lastErr;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        audioRes = await fetch(streamUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'audio/*, */*',
          },
        });
        console.log(`[youtube-fetch] attempt ${attempt} → HTTP ${audioRes.status}`);
        if (audioRes.ok) break;
        lastErr = `HTTP ${audioRes.status}`;

        // If tunnel 502'd, try fetching Cobalt again — sometimes it gives a fresh URL
        if (attempt < 2) {
          console.log('[youtube-fetch] tunnel failed, retrying Cobalt for fresh URL...');
          try {
            ({ streamUrl } = await getCobaltUrl(url, safeFormat, safeBitrate));
          } catch (_) { /* use same URL */ }
        }
      } catch (fetchErr) {
        lastErr = String(fetchErr);
        console.error(`[youtube-fetch] fetch attempt ${attempt} threw:`, fetchErr);
      }
    }

    if (!audioRes || !audioRes.ok) {
      return res.status(502).json({
        error: `Audio fetch failed after retries: ${lastErr}`,
        streamUrl,
        hint: 'Cobalt tunnel (Railway) sedang down. Coba restart Railway service kamu, atau coba video lain.',
      });
    }

    // ── Step 3: Stream audio to client ───────────────────────────
    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
    const contentLength = audioRes.headers.get('content-length');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    const { Readable } = await import('node:stream');
    const nodeStream = Readable.fromWeb(audioRes.body);

    let byteCount = 0;
    nodeStream.on('data', chunk => { byteCount += chunk.length; });
    nodeStream.on('end', () => console.log('[youtube-fetch] done, bytes:', byteCount));
    nodeStream.on('error', err => {
      console.error('[youtube-fetch] stream error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Stream error', detail: String(err) });
      else res.end();
    });

    nodeStream.pipe(res);

  } catch (err) {
    console.error('[youtube-fetch] unhandled error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal proxy error', detail: String(err) });
    }
  }
}
