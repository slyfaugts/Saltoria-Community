// Saltoria Tools :: Roblox Asset Upload Proxy
// Proxies asset upload requests to Roblox Open Cloud API to avoid browser CORS restrictions.
// Roblox's apis.roblox.com does not allow direct browser (CORS) requests from third-party
// domains, so this server-side function relays the multipart upload on behalf of the client.
//
// Endpoint: POST /api/upload-asset
// Headers: x-api-key: <user's Roblox Open Cloud API key>
// Body: multipart/form-data with fields "request" (JSON string) and "fileContent" (file)

export const config = {
  api: {
    bodyParser: false, // we need the raw multipart stream
    responseLimit: '20mb',
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ─── GET: poll an operation status (used after upload returns a pending operation) ───
  if (req.method === 'GET') {
    const { path } = req.query;
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({ error: 'Missing x-api-key header.' });
    }
    if (!path) {
      return res.status(400).json({ error: 'Missing "path" query parameter.' });
    }

    try {
      const opRes = await fetch(`https://apis.roblox.com/${path}`, {
        headers: { 'x-api-key': apiKey },
      });
      const data = await opRes.json();
      return res.status(opRes.status).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Internal proxy error', detail: String(err) });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header (Roblox Open Cloud API key).' });
  }

  try {
    // Collect the raw request body (multipart/form-data) and forward as-is.
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data content-type.' });
    }

    const robloxRes = await fetch('https://apis.roblox.com/assets/v1/assets', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': contentType,
      },
      body: rawBody,
    });

    const data = await robloxRes.json();
    return res.status(robloxRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal proxy error', detail: String(err) });
  }
}
