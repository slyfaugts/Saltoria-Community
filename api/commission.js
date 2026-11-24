// Saltoria :: Commission form → Discord webhook
// Endpoint: POST /api/commission  (JSON)
// Env wajib: DISCORD_COMMISSION_WEBHOOK  (URL webhook channel tujuan; JANGAN taruh di kode / frontend)
//
// Pengaman: allowlist origin, honeypot, jeda minimal pengisian, rate limit per IP,
// batas panjang tiap field, pembersihan karakter kontrol, dan allowed_mentions kosong
// supaya isi form tidak bisa memicu @everyone / @role di Discord.

import { applyCors } from '../lib/cors.js';
import { rateLimit } from '../lib/ratelimit.js';

export const config = { api: { bodyParser: { sizeLimit: '20kb' } } };

const SERVICES = [
  'Roblox Map Building',
  'Lua Scripting & System Development',
  'UI/UX Design',
  '3D Modeling',
  'Optimization & Bug Fixing',
  'Custom Roblox System',
  'Full Game Development Package',
  'Lainnya',
];
const WEBHOOK_RE = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

const clean = (v, max) =>
  String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
// sisipkan zero-width space agar mention tidak aktif (lapis kedua selain allowed_mentions)
const defang = (s) => s.replace(/@(everyone|here)/gi, '@\u200b$1').replace(/<@/g, '<\u200b@');
const fail = (res, code, error) => res.status(code).json({ ok: false, error });

export default async function handler(req, res) {
  const allowed = applyCors(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type' });
  if (req.method === 'OPTIONS') return res.status(allowed ? 204 : 403).end();
  if (!allowed) return fail(res, 403, 'Origin tidak diizinkan.');
  if (req.method !== 'POST') return fail(res, 405, 'Gunakan POST.');

  const hook = process.env.DISCORD_COMMISSION_WEBHOOK;
  if (!hook || !WEBHOOK_RE.test(hook)) {
    console.error('[commission] DISCORD_COMMISSION_WEBHOOK belum di-set atau formatnya salah');
    return fail(res, 503, 'Form belum aktif. Silakan hubungi kami lewat Discord.');
  }

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  if (!b || typeof b !== 'object') return fail(res, 400, 'Data tidak valid.');

  // honeypot (field tersembunyi, manusia tidak mengisinya) + jeda minimal sejak form dibuka
  const tooFast = Number(b.ts) && Date.now() - Number(b.ts) < 3000;
  if (clean(b.website, 200) || tooFast) return res.status(200).json({ ok: true, ref: 'SLT-OK' });

  const name = clean(b.name, 60);
  const contact = clean(b.contact, 80);
  const service = clean(b.service, 60);
  const budget = clean(b.budget, 60) || '-';
  const deadline = clean(b.deadline, 60) || '-';
  const reference = clean(b.reference, 300);
  const description = clean(b.description, 1500);

  if (name.length < 2) return fail(res, 400, 'Isi nama / panggilan kamu.');
  if (contact.length < 3) return fail(res, 400, 'Isi kontak Discord atau WhatsApp supaya kami bisa membalas.');
  if (!SERVICES.includes(service)) return fail(res, 400, 'Pilih jenis layanan.');
  if (description.length < 20) return fail(res, 400, 'Jelaskan kebutuhanmu minimal 20 karakter.');
  if (reference) {
    try { if (!/^https?:$/.test(new URL(reference).protocol)) throw 0; }
    catch { return fail(res, 400, 'Link referensi harus berupa URL http/https yang valid.'); }
  }

  // rate limit dihitung SETELAH validasi: salah ketik tidak menghabiskan jatah kirim
  const rl = rateLimit(req, { name: 'commission', limit: 3, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return fail(res, 429, `Terlalu sering mengirim. Coba lagi dalam ${Math.ceil(rl.retryAfter / 60)} menit.`);
  }

  const ref = 'SLT-' + Date.now().toString(36).slice(-5).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const payload = {
    username: 'Saltoria Commission',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '📨 Commission baru',
      description: defang(description),
      color: 0x7c5cfc,
      fields: [
        { name: 'Nama', value: defang(name), inline: true },
        { name: 'Kontak', value: defang(contact), inline: true },
        { name: 'Layanan', value: service, inline: false },
        { name: 'Budget', value: defang(budget), inline: true },
        { name: 'Deadline', value: defang(deadline), inline: true },
        ...(reference ? [{ name: 'Referensi', value: reference.slice(0, 300), inline: false }] : []),
      ],
      footer: { text: 'Ref ' + ref },
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    const r = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 429) return fail(res, 503, 'Server sedang ramai, coba lagi sebentar lagi.');
    if (!r.ok) {
      console.error('[commission] webhook gagal', r.status);
      return fail(res, 502, 'Gagal meneruskan ke tim. Silakan hubungi kami lewat Discord.');
    }
    return res.status(200).json({ ok: true, ref });
  } catch (e) {
    console.error('[commission] error', e && e.name);
    return fail(res, 502, 'Gagal menghubungi Discord. Coba lagi atau hubungi kami langsung.');
  }
}
