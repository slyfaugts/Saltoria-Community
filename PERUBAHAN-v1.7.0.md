# Perubahan v1.7.0 (per file)

## Baru
| File | Isi |
|---|---|
| `tools/shirt-generator.html` | Classic Shirt & Pants 585×559, ekspor PNG transparan |
| `tools/sprite-sheet.html` | Video / GIF / urutan gambar → sprite sheet, chroma key, kode Luau |
| `tools/material-generator.html` | Peta Color/Normal/Roughness/Metalness tileable + ZIP |
| `tools/discord-text-tools.html` | Font Unicode, format Discord, timestamp, simbol/emoji, template |
| `tools/batch-uploader.html` | Upload banyak asset via Open Cloud + ekspor Asset ID |
| `free-assets.html` | Katalog aset gratis (edit array `ASSETS`) |
| `api/commission.js` | Form Commission → Discord webhook |
| `lib/cors.js`, `lib/ratelimit.js` | CORS dan rate limit bersama |
| `scripts/gen-sitemap.mjs` | Bangun `sitemap.xml` dari folder `tools/` |

## Diubah
| File | Perubahan |
|---|---|
| `api/upload-asset.js` | CORS bersama; **perbaikan polling** (`/assets/v1/operations/{id}`); parameter `path` divalidasi |
| `api/youtube-fetch.js` | CORS bersama; rate limit 12/10 menit/IP; `maxDuration` hanya di `vercel.json`; timeout 55 dtk |
| `api/asset-permission-proxy.js`, `api/datastore-proxy.js` | CORS bersama (`ALLOWED_ORIGINS` kini berlaku di semua API) |
| `index.html` | Section About & Commission, 5 kartu tool, nav + menu mobile + footer, changelog v1.7.0, angka "14 tools", tombol "Ajukan lewat form"; **perbaikan navbar tertutup announce-bar** (bug lama) |
| `shared.js` | 5 tool didaftarkan di `TOOLS`; link navbar tool (Free Assets) |
| `shared.css` | Kit komponen `tk-*`; navbar tool pindah ke menu ringkas di ≤1300px |
| `vercel.json` | Redirect digabung jadi satu aturan; header keamanan; cache `/assets`; `no-store` untuk `/api`; konfigurasi `commission` |
| `sitemap.xml` | 16 URL (menambah `lua-obfuscator`, 5 tool baru, `free-assets`) |
| `README.md` | Ditulis ulang sesuai kondisi sekarang |
| `.vercelignore` | `scripts` ikut diabaikan |

## Aset
- Baru: `favicon.png`, `og-image.png`, `partners/saltoria-roblox.png` (stand-in, ganti dengan logo asli).
- `.png` → `.jpg` terkompresi: `maps/clarius-obstacle`, `maps/vierra-peak`, `projects/premium-summit-kit`, `store/premium-summit-kit`, `store/clubkit`.
- Diperkecil: `logo.png` (2,2 MB → 123 KB, kanvas tetap 3:2), `backsound.mp3` (3,0 → 2,2 MB).
- Dihapus: `partners/D.txt`, `staff/F.txt` (placeholder kosong).
- Masih perlu kamu siapkan: lihat README §7.

## Setelah deploy
1. Vercel → Environment Variables → `DISCORD_COMMISSION_WEBHOOK` (lihat README §5), lalu redeploy.
2. Isi aset yang masih hilang (README §7).
