# Perubahan v1.8.0 — Tahap 2 (per area)

## Index & konten
| Area | Perubahan |
|---|---|
| Store | Data-driven (`data/store-data.js`): 40 produk (38 daftar Tahap 2 + ClubKit + Jasa) dalam 7 kategori, varian Donation Pack, label Add-On, harga/promo/`promoUntil`, tombol order menyalin pesan ke clipboard, 4 kartu awal di ponsel |
| Tim | `data/community-data.js`: Owner/Founder (Ahmad) + Developer Team (Dim). Nama asli & User ID **tidak** disertakan di data publik |
| Partner | Hanya UAM dan AREA BEBAS (Official Partnership); Lumira/Inston/Saltoria dihapus dari kartu, chip hero, dan footer |
| Layout | Jasa Map + Commission digabung; changelog ringkas (3 terbaru); grid Tools tanpa kotak abu-abu & 2 kolom di ponsel; musik latar tidak diunduh otomatis; gambar lazy-load; JSON-LD |
| Statistik | Free Tools / Active Maps / Core Projects dihitung otomatis |
| Bug lama | Navbar tertutup announce-bar (termasuk tombol hamburger) diperbaiki |

## Free Assets
Data dipindah ke `data/free-assets-data.js`; renderer `js/free-assets.js`. Tombol download langsung (repo), Google Drive (diubah ke link unduh langsung), MediaFire (tab baru); jendela detail dengan galeri dan preview 3D `.glb`.

## Tool
| Tool | Perubahan |
|---|---|
| Material Generator | Mode **gambar sendiri**: Seamless / Smooth / Keduanya / Asli, Ratakan pencahayaan, skor sambungan, ubin 2×2. **Bug lama diperbaiki:** resolusi dari dropdown bertipe teks merusak peta normal |
| Shirt Generator | Desain Shirt & Pants terpisah; **preview 360° avatar R6** (WebGL); unduh keduanya |
| Batch Uploader | Mendukung **Animation** dan **Video** (dokumentasi Roblox terbaru), pilihan tipe untuk .rbxm/.rbxmx |
| **Animation Studio** | Baru di situs (dari file kamu) + `api/upload-animation.js` (ESM, CORS, rate limit, status error benar). Perbaikan: konflik keyboard di slider, impor rusak membekukan editor, keyframe ganda (NaN), key di detik 0, timeout/retry upload, `localStorage` yang melempar error |

## File
Baru: `data/*.js`, `js/home-render.js`, `js/free-assets.js`, `tools/animation-studio.html`, `api/upload-animation.js`.
Diubah: `index.html`, `free-assets.html`, `shared.js`, `tools/material-generator.html`, `tools/shirt-generator.html`, `tools/batch-uploader.html`, `vercel.json`, `sitemap.xml`, `README.md`, `.vercelignore`.
Dihapus: `assets/partners/saltoria-roblox.png` (stand-in lama).
