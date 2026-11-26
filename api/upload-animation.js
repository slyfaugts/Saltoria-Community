// Vercel Serverless Function: /api/upload-animation
// Proxy ke Roblox Open Cloud Assets API untuk upload Animation (.rbxmx KeyframeSequence).
// Browser tidak bisa memanggil Roblox langsung karena CORS. API key milik user dikirim per-request
// dan TIDAK disimpan / di-log.
//
//   POST { action:'upload', apiKey, creatorType:'User'|'Group', creatorId, name, description, rbxmx }
//   POST { action:'status', apiKey, operationId }

import { applyCors } from '../lib/cors.js';
import { rateLimit } from '../lib/ratelimit.js';

export const config = { api: { bodyParser: { sizeLimit: '3500kb' } } };

const ASSETS_URL = 'https://apis.roblox.com/assets/v1/assets';
const OPS_URL = 'https://apis.roblox.com/assets/v1/operations/';
const MAX_BYTES = 3 * 1024 * 1024;

function pickOperation(data) {
  const op = {
    operationId: data && data.path ? String(data.path).replace(/^operations\//, '') : null,
    done: !!(data && data.done),
  };
  if (data && data.response && data.response.assetId) op.assetId = String(data.response.assetId);
  if (data && data.response && data.response.moderationResult && data.response.moderationResult.moderationState) op.moderation = String(data.response.moderationResult.moderationState);
  if (data && data.error) op.error = data.error.message || JSON.stringify(data.error);
  return op;
}

// Teruskan status Roblox yang bermakna ke klien (401/403/404/429 apa adanya, 400 → 400), sisanya 502.
async function relay(res, r) {
  const text = await r.text();
  let data = {};
  try { data = JSON.parse(text); } catch (e) { /* bukan JSON */ }
  if (!r.ok) {
    const raw = data.message || data.error || ('Roblox membalas HTTP ' + r.status);
    const msg = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const pass = [400, 401, 403, 404, 429].includes(r.status) ? r.status : 502;
    if (r.status === 429) { const ra = r.headers && r.headers.get && r.headers.get('retry-after'); if (ra) res.setHeader('Retry-After', ra); }
    return res.status(pass).json({ error: msg });
  }
  return res.status(200).json(pickOperation(data));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const allowed = applyCors(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type', expose: 'retry-after' });
  if (req.method === 'OPTIONS') return res.status(allowed ? 204 : 403).end();
  if (!allowed) return res.status(403).json({ error: 'Origin tidak diizinkan.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') return res.status(400).json({ error: 'Data tidak valid.' });

  const apiKey = String(b.apiKey || '').trim();
  if (!apiKey || apiKey.length > 500) return res.status(400).json({ error: 'API key wajib diisi.' });
  const headers = { 'x-api-key': apiKey };

  if (b.action !== 'upload' && b.action !== 'status') return res.status(400).json({ error: 'action tidak dikenal.' });
  // status: dibatasi longgar di sini. upload: dibatasi SETELAH validasi (salah ketik tidak menghabiskan jatah).
  if (b.action === 'status') {
    const rl = rateLimit(req, { name: 'anim-status', limit: 150, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) { res.setHeader('Retry-After', String(rl.retryAfter)); return res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi dalam ' + Math.ceil(rl.retryAfter / 60) + ' menit.' }); }
  }

  try {
    if (b.action === 'status') {
      const id = String(b.operationId || '').replace(/[^A-Za-z0-9\-_]/g, '').slice(0, 128);
      if (!id) return res.status(400).json({ error: 'operationId tidak valid.' });
      return await relay(res, await fetch(OPS_URL + id, { headers, signal: AbortSignal.timeout(15000) }));
    }

    // action: upload
    const creatorId = String(b.creatorId || '');
    if (!/^\d{1,20}$/.test(creatorId)) return res.status(400).json({ error: 'Creator ID harus angka.' });
    const rbxmx = typeof b.rbxmx === 'string' ? b.rbxmx : '';
    if (!rbxmx.trimStart().startsWith('<roblox') || !rbxmx.includes('class="KeyframeSequence"') || !rbxmx.includes('class="Keyframe"')) {
      return res.status(400).json({ error: 'File animasi tidak valid.' });
    }
    if (/<!DOCTYPE|<!ENTITY/i.test(rbxmx)) return res.status(400).json({ error: 'File animasi tidak valid (DOCTYPE/ENTITY tidak diizinkan).' });
    if (Buffer.byteLength(rbxmx) > MAX_BYTES) return res.status(413).json({ error: 'File terlalu besar.' });

    const rl = rateLimit(req, { name: 'anim-upload', limit: 8, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) { res.setHeader('Retry-After', String(rl.retryAfter)); return res.status(429).json({ error: 'Terlalu banyak upload. Coba lagi dalam ' + Math.ceil(rl.retryAfter / 60) + ' menit.' }); }

    const name = String(b.name || 'Animation').replace(/[^\w \-.]/g, '').trim().slice(0, 50) || 'Animation';
    const request = {
      assetType: 'Animation',
      displayName: name,
      description: String(b.description || '').slice(0, 1000),
      creationContext: {
        creator: b.creatorType === 'Group' ? { groupId: creatorId } : { userId: creatorId },
      },
    };

    const form = new FormData();
    form.append('request', JSON.stringify(request));
    form.append('fileContent', new Blob([rbxmx], { type: 'model/x-rbxm' }), name.replace(/\s+/g, '_') + '.rbxmx');

    return await relay(res, await fetch(ASSETS_URL, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(25000) }));
  } catch (e) {
    const timeout = e && e.name === 'TimeoutError';
    return res.status(timeout ? 504 : 500).json({ error: timeout ? 'Roblox tidak merespons (timeout).' : 'Server error.' });
  }
}
