// Bangun sitemap.xml otomatis dari isi folder tools/ + halaman utama.
// Jalankan: node scripts/gen-sitemap.mjs   (dari root proyek) — lalu commit sitemap.xml.
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://saltoria.site';
const today = new Date().toISOString().slice(0, 10);

const pages = [
  { path: '/', freq: 'weekly', pri: '1.0' },
  { path: '/free-assets', freq: 'weekly', pri: '0.7' },
  ...readdirSync(join(root, 'tools'))
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => ({ path: '/tools/' + f.replace(/\.html$/, ''), freq: 'monthly', pri: '0.8' })),
];

const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  pages.map((p) => `  <url>\n    <loc>${base}${p.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.freq}</changefreq>\n    <priority>${p.pri}</priority>\n  </url>`).join('\n') +
  '\n</urlset>\n';

writeFileSync(join(root, 'sitemap.xml'), xml);
console.log(`sitemap.xml: ${pages.length} URL`);
