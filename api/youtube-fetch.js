// Saltoria Tools :: YouTube Fetch Proxy
// Buffers full audio before sending — required for Vercel serverless
// to prevent stream truncation on binary responses.

export const config = {
  api: {
    bodyParser: { sizeLimit: '5mb' },
    responseLimit: '50mb', // allow large audio responses
  },
};

const COBALT_URL = 'https://cobalt-production-4ec8.up.railway.app';
const VALID_BITRATES = ['320', '256', '128', '96', '64', '8'];
const VALID_FORMATS  = ['best', 'mp3', 'ogg', 'wav', 'opus'];
const MAX_BYTES = 50 * 1024 * 1024; // 50MB hard cap

async function getCobaltStreamUrl(url, audioFormat, audioBitrate) {
  const res = await fetch(`${COBALT_URL}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ url, downloadMode: 'audio', audioFormat, audioBitrate }),
  });

  if (!res.ok) {
    let detail;
    try { detail = await res.json(); } catch (_) { detail = await res.text(); }
    throw Object.assign(new Error(`Cobalt HTTP ${res.status}`), { detail, httpStatus: 502 });
  }

  const data = await res.json();
  console.log('[yt-fetch] cobalt:', JSON.stringify(data));

  if (data.status === 'error') {
    throw Object.assign(
      new Error(`Cobalt error: ${data.error?.code || 'unknown'}`),
      { httpStatus: 502 }
    );
  }

  const streamUrl =
    (data.status === 'tunnel' || data.status === 'redirect') ? data.url :
    (data.status === 'picker' && data.picker?.[0]?.url) ? data.picker[0].url :
    data.url || null;

  if (!streamUrl) {
    throw Object.assign(new Error('No stream URL from Cobalt'), { detail: data, httpStatus: 502 });
  }

  return streamUrl;
}

// Manually read a fetch ReadableStream into a Buffer, with a size cap.
async function readStreamToBuffer(body, maxBytes) {
  const chunks = [];
  let total = 0;
  const reader = body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel();
      throw new Error(`Audio too large (> ${maxBytes / 1024 / 1024}MB)`);
    }
    chunks.push(value);
  }
  // Concat all Uint8Arrays into one Buffer
  const result = Buffer.allocUnsafe(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

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
  if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i.test(url)) {
    return res.status(400).json({ error: 'Only YouTube URLs are supported' });
  }

  const safeBitrate = VALID_BITRATES.includes(String(audioBitrate)) ? String(audioBitrate) : '128';
  const safeFormat  = VALID_FORMATS.includes(String(audioFormat))   ? String(audioFormat)  : 'mp3';

  try {
    // ── Step 1: Get tunnel URL ────────────────────────────────────
    let streamUrl;
    try {
      streamUrl = await getCobaltStreamUrl(url, safeFormat, safeBitrate);
    } catch (e) {
      return res.status(e.httpStatus || 502).json({
        error: e.message,
        detail: e.detail,
        hint: 'Cobalt instance mungkin sedang down. Cek Railway dashboard.',
      });
    }

    console.log('[yt-fetch] streamUrl:', streamUrl);

    // ── Step 2: Fetch + buffer full audio ────────────────────────
    let audioRes;
    for (let attempt = 1; attempt <= 2; attempt++) {
      audioRes = await fetch(streamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'audio/*, */*',
        },
      });
      console.log(`[yt-fetch] attempt ${attempt} → HTTP ${audioRes.status}`);
      if (audioRes.ok) break;

      if (attempt < 2) {
        // Try getting a fresh URL from Cobalt
        try { streamUrl = await getCobaltStreamUrl(url, safeFormat, safeBitrate); } catch (_) {}
      }
    }

    if (!audioRes.ok) {
      return res.status(502).json({
        error: `Tunnel fetch failed: HTTP ${audioRes.status}`,
        hint: 'Cobalt Railway tunnel down. Coba restart service di Railway.',
      });
    }

    // Buffer the full response — avoids Vercel stream truncation
    let audioBuffer;
    try {
      audioBuffer = await readStreamToBuffer(audioRes.body, MAX_BYTES);
    } catch (e) {
      return res.status(502).json({ error: e.message });
    }

    console.log('[yt-fetch] buffered bytes:', audioBuffer.byteLength);

    if (audioBuffer.byteLength === 0) {
      return res.status(502).json({
        error: 'Cobalt tunnel returned empty body',
        hint: 'Railway service mungkin crash saat streaming. Restart Railway lalu coba lagi.',
      });
    }

    // ── Step 3: Send buffered audio ──────────────────────────────
    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', audioBuffer.byteLength);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(audioBuffer);

  } catch (err) {
    console.error('[yt-fetch] unhandled:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal proxy error', detail: String(err) });
    }
  }
}
