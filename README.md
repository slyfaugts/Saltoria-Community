# Saltoria Community — Website & Tools

Website resmi **Saltoria Community**, komunitas Roblox developer asal Indonesia. Isinya: landing page komunitas (About, Projects, Store, Maps, Commission, Team, Partners), halaman **Free Assets**, dan **14 tools gratis** buat Roblox developer.

Situsnya **static + serverless**: HTML/CSS/JS murni, tanpa framework dan tanpa database. Satu-satunya bagian server adalah 5 fungsi di `api/` (Vercel).

---

## 1. Penjelasan

### 1.1 Struktur folder

```
saltoria-website/
├── index.html               ← landing page (About, Projects, Tools, Store, Maps, Jasa Map, Commission, Team, Partners, Changelog)
├── free-assets.html         ← katalog aset gratis (data statis, edit array ASSETS di dalam file)
├── shared.css               ← token tema + komponen bersama (termasuk kit "tk-*" untuk tool baru)
├── shared.js                ← navbar tool, tema terang/gelap, command palette (Ctrl+K), daftar TOOLS
├── vercel.json              ← redirect, header, dan konfigurasi function
├── sitemap.xml / robots.txt
├── scripts/gen-sitemap.mjs  ← bangun sitemap.xml otomatis dari folder tools/
├── lib/                     ← helper server bersama (di LUAR api/ supaya tidak jadi endpoint)
│   ├── cors.js              ← allowlist origin + header CORS untuk semua function
│   └── ratelimit.js         ← rate limit ringan in-memory
├── api/                     ← Vercel serverless functions
│   ├── upload-asset.js      ← proxy upload asset ke Roblox Open Cloud (+ polling status)
│   ├── youtube-fetch.js     ← proxy audio ke service yt-dlp (Railway)
│   ├── asset-permission-proxy.js
│   ├── datastore-proxy.js
│   └── commission.js        ← form Commission → Discord webhook
├── tools/                   ← 14 halaman tool (kebanyakan 1 file self-contained)
├── studio/                  ← kode 3D Studio (js/, css/, fonts/, assets/, tests/)
└── assets/                  ← logo, favicon, og-image, foto project/store/map, staff, partner, audio latar
```

### 1.2 Daftar tool (14)

| Tool | Kategori | Catatan |
|---|---|---|
| Audio Optimizer | Converter | butuh `api/youtube-fetch.js` + `api/upload-asset.js` |
| Skybox Converter | Converter | client-side |
| **Sprite Sheet** | Converter | video / GIF / urutan gambar → sprite sheet + kode Luau; client-side |
| Loot Table Calc | Calculator | client-side |
| Script Header Gen | Generator | client-side |
| Gradient Generator | Generator | client-side |
| **Shirt Generator** | Generator | Classic Shirt & Pants 585×559; client-side |
| **Material Generator** | Generator | peta Color/Normal/Roughness/Metalness tileable, ekspor ZIP; client-side |
| **Discord & Text Tools** | Generator | font Unicode, format Markdown Discord, timestamp, simbol/emoji, template; client-side |
| Asset Permission | Manager | `api/asset-permission-proxy.js` |
| DataStore Manager | Manager | `api/datastore-proxy.js` |
| **Batch Uploader** | Manager | upload banyak asset, pakai `api/upload-asset.js` |
| Lua Obfuscator | Security | client-side |
| 3D Studio | 3D | kode di `studio/` |

Yang **dicetak tebal** adalah tool baru di v1.7.0.

### 1.3 Tech stack
- **Frontend:** HTML + CSS + vanilla JS. Font: Space Grotesk, Inter, JetBrains Mono.
- **Hosting:** Vercel (static + Node serverless; format `export default function handler(req, res)`).
- **Layanan luar:** Railway (`yt-dlp`), Roblox Open Cloud (pakai API key milik user), Discord webhook (Commission).
- **State:** semua state tool disimpan di `localStorage`/IndexedDB browser. Tidak ada database.

### 1.4 `shared.js` dan `shared.css`
- Navbar tool dirakit dari `<nav id="main-nav" data-tool="NAMA TOOL">`. Link navbar ada di array `NAV_LINKS` (entri ber-flag `true` = halaman sendiri, mis. Free Assets).
- Array `TOOLS` = sumber data command palette (`Ctrl+K`) dan "Baru dipakai".
- `shared.css` memuat token warna/radius/font **dan** kit komponen `tk-*` (kartu, field, tombol, dropzone, tabel, toast). Tool baru cukup memakainya, tidak perlu CSS dasar sendiri.

---

## 2. Jalanin lokal

```bash
# static saja (tanpa API)
python3 -m http.server 3000

# dengan serverless function aktif (Commission, upload, audio, dll.)
npm i -g vercel
vercel dev
```

Form Commission dan semua tool berbasis `api/` hanya jalan penuh di `vercel dev` atau production.

### 2.1 Nambah tool baru (checklist)
1. Buat `tools/nama-tool.html`. Paling gampang: salin salah satu tool baru (mis. `discord-text-tools.html`) dan ganti isinya. Wajib ada: meta tags lengkap (description, og:*, canonical, favicon), `<nav id="main-nav" data-tool="...">`, dan `<script src="../shared.js" defer>`.
2. Daftarkan di `shared.js` → array `TOOLS`.
3. Tambah kartu `<a class="tool-card" data-category="...">` di `index.html` (section `#tools`).
4. Jalankan `node scripts/gen-sitemap.mjs` lalu commit `sitemap.xml`.
5. Kategori yang ada: `Generator`, `Converter`, `Calculator`, `Manager`, `Security`, `3D`. Kategori baru butuh chip filter baru di `index.html`.

---

## 3. Deploy

### 3.1 Push & connect
```bash
git add . && git commit -m "v1.7.0" && git push
```
Di Vercel: **Add New Project** → pilih repo → Framework **Other** → Build Command & Output Directory dikosongkan → Deploy. Setiap push ke `main` otomatis re-deploy.

### 3.2 Environment Variables

| Key | Wajib? | Keterangan |
|---|---|---|
| `DISCORD_COMMISSION_WEBHOOK` | Ya, untuk form Commission | URL webhook channel Discord tujuan (lihat §5). Tanpa ini form menampilkan "belum aktif". |
| `YTDLP_API_URL` | Disarankan | URL service yt-dlp di Railway. Kalau kosong, `youtube-fetch.js` memakai URL default di kodenya. |
| `ALLOWED_ORIGINS` | Opsional | Origin tambahan yang boleh memanggil API, pisah koma, mis. `https://staging.saltoria.site`. |

Setelah mengubah env var, **redeploy manual** (env tidak otomatis berlaku di deployment yang sudah jalan).

### 3.3 CORS (satu tempat untuk semua API)
Semua function memakai `lib/cors.js`:
- Origin yang lolos: `saltoria.site`, `www.saltoria.site`, `localhost:3000`, plus isi `ALLOWED_ORIGINS`.
- Deployment yang memanggil API **miliknya sendiri** (termasuk URL preview `*.vercel.app`) otomatis lolos, jadi tes di preview tidak butuh env tambahan.
- Request tanpa header `Origin` (curl, server-to-server) tidak ditolak oleh CORS. Setiap endpoint tetap punya validasinya sendiri, jadi CORS **bukan** pengganti autentikasi.
- Kalau pakai custom domain baru, cukup tambahkan ke `ALLOWED_ORIGINS`. Tidak perlu edit kode.

### 3.4 Batas & rate limit
- `youtube-fetch`: maks 12 permintaan / 10 menit per IP. `commission`: maks 3 pengiriman valid / 10 menit per IP.
- Rate limit disimpan **di memori instance** serverless: cukup sebagai pagar anti-spam, tapi tidak dibagi antar instance. Untuk batas ketat, ganti ke Vercel KV / Upstash.
- Durasi function diatur **hanya di `vercel.json`** (`youtube-fetch` 60 dtk; timeout fetch di kodenya 55 dtk supaya user dapat pesan error rapi). Plan Hobby maksimal 60 dtk.

---

## 4. Upload asset (Open Cloud)

`api/upload-asset.js` meneruskan multipart ke `https://apis.roblox.com/assets/v1/assets`. Dipakai Audio Optimizer dan Batch Uploader.

**Buat API key:** Creator Dashboard → Credentials → API Keys → izin **Assets**: `asset:read` + `asset:write`. API key dikirim lewat header `x-api-key` dan **tidak disimpan** di server.

**Request:** `POST /api/upload-asset`, multipart dengan dua field:
- `request` — JSON: `{"assetType":"Audio|Decal|Model","displayName":"…","description":"…","creationContext":{"creator":{"userId":"123"}}}` (atau `groupId`)
- `fileContent` — file binernya

**Polling status:** upload Roblox itu async. Respons awal berisi `path: "operations/{id}"`. Poll dengan `GET /api/upload-asset?path=operations/{id}`; hasil akhir: `{ done: true, response: { assetId } }`.
> Perbaikan v1.7.0: dulu proxy memanggil `/operations/{id}` (salah). Sekarang selalu ke `/assets/v1/operations/{id}`. Bentuk `operations/x`, `assets/operations/x`, dan `assets/v1/operations/x` semuanya diterima; path lain ditolak.

**Batas:**
- Vercel membatasi body function ±**4,5 MB**. Batch Uploader menandai file > ±4,3 MB dan melewatinya. Untuk file lebih besar perlu upload langsung atau host lain.
- Open Cloud Assets API hanya mendukung **Audio, Decal, Model**. Animasi **tidak** didukung.
- Kena `429` dari Roblox → Batch Uploader otomatis menunggu lalu mencoba ulang (maks 4 kali).

| Error | Penyebab umum |
|---|---|
| `401 Missing x-api-key` | header tidak terkirim |
| `Non-JSON response from Roblox API` | API key salah/expired atau izin kurang |
| `403 Origin tidak diizinkan` | domain belum ada di `ALLOWED_ORIGINS` |
| `400 … operations/{id}` | parameter `path` bukan bentuk operasi yang valid |

---

## 5. Commission → Discord

Form di `index.html#commission` mengirim JSON ke `POST /api/commission`, yang meneruskannya sebagai embed ke Discord.

**Setup (sekali):**
1. Discord → Server Settings → Integrations → Webhooks → **New Webhook** → pilih channel privat tim → **Copy Webhook URL**.
2. Vercel → Settings → Environment Variables → `DISCORD_COMMISSION_WEBHOOK` = URL tadi → redeploy.

**Pengaman:** allowlist origin, honeypot, jeda minimal 3 dtk, rate limit per IP, batas panjang tiap field, `allowed_mentions` kosong (isi form tidak bisa memicu `@everyone`/role), URL referensi harus http/https, dan URL webhook disimpan hanya di env (tidak pernah ke browser).

Jenis layanan di dropdown harus sama persis dengan daftar `SERVICES` di `api/commission.js`; ubah di dua tempat kalau menambah opsi.

---

## 6. Mengedit konten

- **About (visi, misi, filosofi):** section `#about` di `index.html`. Teksnya disusun dari dokumen *Detail Website Saltoria*; sunting sesuai kebutuhan.
- **Free Assets:** edit array `ASSETS` di `free-assets.html` (contoh format ada di komentar). Aset kosong menampilkan halaman "belum ada aset". Link hanya http/https yang ditampilkan.
- **Changelog:** tambahkan blok `cl-item` di paling atas `#changelog`.
- **Sitemap:** `node scripts/gen-sitemap.mjs`.

---

## 7. Aset yang masih perlu kamu siapkan

Yang sudah dibuat/diperbaiki di v1.7.0: `favicon.png`, `og-image.png` (1200×630), foto map/project/store `.png` → `.jpg` terkompresi (sesuai yang dipanggil HTML), `logo.png` diperkecil, `backsound.mp3` dikompres (3 MB → 2,2 MB), `partners/saltoria-roblox.png` (**stand-in**: monogram "S", ganti dengan logo asli).

Yang **belum ada** (halaman tetap jalan; sebagian punya fallback ikon):

| File | Jenis | Catatan |
|---|---|---|
| `assets/partners/inston.png`, `lumira.png` | **PNG transparan** | logo partner, rasio kotak, ±256 px |
| `assets/videos/hero.mp4`, `hero.webm` | video | latar hero; tanpa ini hero memakai warna latar |
| `assets/ordermaps/` — `bbq-obstacle`, `cyberion-club`, `inston-obstacle`, `moonveil-obstacle`, `mount-eunola`, `mount-infinity`, `mount-skyward`, `rexmountain`, `rubby-obstacle`, `zihan-obstacle` (`.jpg`) | JPG | slide galeri Jasa Map, ±1280×720 |
| `assets/maps/` — `comming-soon`, `rumah-pati`, `v-club` (`.jpg`) | JPG | thumbnail kartu map |
| `assets/projects/roblox-dev-tools.jpg` | JPG | thumbnail project |
| `assets/store/jasa-developer.jpg`, `ojek-npc.jpg` | JPG | thumbnail produk |
| `assets/staff/admin2.jpg`, `admin3.jpg`, `admin4.jpg` | JPG | foto tim, rasio kotak |

Tips: JPG ≤ 1200 px sisi terpanjang, kualitas ±80 (target ≤ 300 KB). Logo/ikon pakai PNG transparan atau WebP.

---

## 8. Tool baru (v1.7.0) — catatan teknis

- **Shirt Generator:** peta panel Classic Shirt/Pants 585×559 (torso 128×128 + sisi 64×128, lengan/kaki 64×128). Pants memakai layout yang sama (torso = pinggang, lengan = kaki). Ekspor PNG transparan tanpa panduan.
- **Sprite Sheet:** video via `<video>` + seek per frame; GIF via `ImageDecoder` (Chrome/Edge/Safari terbaru); atau banyak gambar berurutan. Opsi batas 1024×1024 dan chroma key. Menghasilkan PNG, JSON metadata, dan kode Luau `ImageRectOffset`.
- **Material Generator:** semua pola **tileable** (noise di-wrap). Normal map dihitung dari height field (Sobel), default gaya OpenGL; centang "balik kanal hijau" bila relief terbalik di Studio. ZIP dibuat di browser (tanpa library).
- **Discord & Text Tools:** font Unicode dengan pemetaan Mathematical Alphanumeric. Beberapa glyph bisa tampil sebagai kotak di dalam Roblox; di Discord aman.
- **Batch Uploader:** antrean berurutan, retry saat rate limit, ekspor Luau/CSV/JSON (CSV melindungi dari formula injection).

---

**Dibuat & di-maintain oleh Slyfaugts / Saltoria Community.**

---

## Catatan tool lama

### Asset Permission
`tools/asset-permission.html` memberi izin pakai (`Use`) banyak aset Roblox sekaligus ke akun, grup, atau experience. Proxy `api/asset-permission-proxy.js` hanya meneruskan endpoint Roblox yang diizinkan; API key tidak disimpan. Izin API key: `asset-permissions` → Write (opsional `asset:read`). Izin yang sudah diberikan tidak bisa dicabut lewat API. Audio Optimizer menulis Asset ID hasil upload ke `localStorage` (`saltoria-uploaded-assets`) dan Asset Permission membacanya. Deteksi aset otomatis bersifat eksperimental.

### DataStore Manager (Beta)
`tools/datastore-manager.html` mengelola DataStore & OrderedDataStore lewat Open Cloud (explorer, editor, riwayat versi, backup/restore, migrasi). Proxy `api/datastore-proxy.js` memakai allowlist rute; API key hanya di memori tab. Mode demo: ketik `demo` sebagai API key. Belum diuji terhadap Roblox sungguhan, jadi coba di universe percobaan dulu.

### 3D Studio
`tools/3d-studio.html` (kode di `studio/`). Halaman mengatur `window.SALTORIA_STUDIO_BASE='../studio/'`. `Ctrl+K` di halaman ini = palet perintah studio; pencarian tool lewat tombol "Cari tool". Tes: `studio/tests/` (Node) dan `studio/tests-browser/` (Playwright). `test-core.js` melaporkan 1 GAGAL lama (bevel: tepi ganjil=6) yang sudah ada sebelum penggabungan.
