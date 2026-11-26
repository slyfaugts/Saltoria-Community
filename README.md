# Saltoria Community — Website & Tools

Website resmi **Saltoria Community**, komunitas Roblox developer asal Indonesia. Isinya: landing page komunitas (About, Projects, Tools, Store, Free Assets, Maps, Jasa & Commission, Team, Partners), halaman **Free Assets**, dan **15 tools gratis** buat Roblox developer.

Situsnya **static + serverless**: HTML/CSS/JS murni, tanpa framework dan tanpa database. Satu-satunya bagian server adalah 6 fungsi di `api/` (Vercel). Isi yang sering berubah (Store, Tim, Partner, Free Assets) ada di folder `data/`, jadi kamu cukup mengedit satu file data tanpa menyentuh HTML.

---

## 1. Penjelasan

### 1.1 Struktur folder

```
saltoria-website/
├── index.html               ← landing page
├── free-assets.html         ← katalog aset gratis (data di data/free-assets-data.js)
├── shared.css / shared.js   ← token tema, komponen "tk-*", navbar tool, command palette, daftar TOOLS
├── vercel.json              ← redirect, header, dan konfigurasi function
├── sitemap.xml / robots.txt
├── data/                    ← ★ FILE YANG KAMU EDIT SENDIRI
│   ├── store-data.js        ← produk, kategori, harga & promo Store
│   ├── community-data.js    ← staf dan partner
│   └── free-assets-data.js  ← daftar Free Assets
├── js/
│   ├── home-render.js       ← render Store/Team/Partner/statistik/changelog di index.html
│   └── free-assets.js       ← render Free Assets (preview, download, 3D)
├── free-assets/             ← (buat sendiri) satu folder per aset: thumb, preview, file unduhan
├── lib/                     ← helper server (di LUAR api/ supaya tidak jadi endpoint)
│   ├── cors.js              ← allowlist origin + header CORS untuk semua function
│   └── ratelimit.js         ← rate limit ringan in-memory
├── api/                     ← Vercel serverless functions
│   ├── upload-asset.js      ← proxy upload asset ke Roblox Open Cloud (+ polling status)
│   ├── upload-animation.js  ← proxy upload Animation (.rbxmx) untuk Animation Studio
│   ├── youtube-fetch.js     ← proxy audio ke service yt-dlp (Railway)
│   ├── asset-permission-proxy.js
│   ├── datastore-proxy.js
│   └── commission.js        ← form Commission → Discord webhook
├── scripts/gen-sitemap.mjs  ← bangun sitemap.xml otomatis dari folder tools/
├── tools/                   ← 15 halaman tool
├── studio/                  ← kode 3D Studio
└── assets/                  ← logo, favicon, og-image, foto, staff, partner, audio latar
```

### 1.2 Daftar tool (15)

| Tool | Kategori | Catatan |
|---|---|---|
| Audio Optimizer | Converter | butuh `api/youtube-fetch.js` + `api/upload-asset.js` |
| Skybox Converter | Converter | client-side |
| Sprite Sheet | Converter | video / GIF / urutan gambar → sprite sheet + kode Luau |
| Loot Table Calc | Calculator | client-side |
| Script Header Gen | Generator | client-side |
| Gradient Generator | Generator | client-side |
| Shirt Generator | Generator | Classic Shirt & Pants 585×559, desain terpisah, **preview 360° avatar R6** |
| Material Generator | Generator | pola prosedural **atau gambar sendiri (Seamless / Smooth)**; peta Color/Normal/Roughness/Metalness |
| Discord & Text Tools | Generator | font Unicode, format Markdown Discord, timestamp, simbol/emoji, template |
| Asset Permission | Manager | `api/asset-permission-proxy.js` |
| DataStore Manager | Manager | `api/datastore-proxy.js` |
| Batch Uploader | Manager | upload banyak asset: Decal, Audio, Model, **Animation, Video** |
| Lua Obfuscator | Security | client-side |
| 3D Studio | 3D | kode di `studio/` |
| **Animation Studio** | 3D | editor animasi R6/R15, preview 3D, ekspor .rbxmx, upload; `api/upload-animation.js` |

### 1.3 Tech stack
- **Frontend:** HTML + CSS + vanilla JS. Font: Space Grotesk, Inter, JetBrains Mono. Animation Studio memakai three.js r128 dari cdnjs.
- **Hosting:** Vercel (static + Node serverless; format `export default function handler(req, res)`).
- **Layanan luar:** Railway (`yt-dlp`), Roblox Open Cloud (API key milik user), Discord webhook (Commission).
- **State:** semua state tool di `localStorage`/IndexedDB browser. Tidak ada database.

### 1.4 `shared.js` dan `shared.css`
- Navbar tool dirakit dari `<nav id="main-nav" data-tool="NAMA TOOL">`. Link navbar ada di array `NAV_LINKS` (entri ber-flag `true` = halaman sendiri).
- Array `TOOLS` = sumber data command palette (`Ctrl+K`).
- `shared.css` memuat token warna/radius/font **dan** kit komponen `tk-*` untuk tool baru.

---

## 2. Jalanin lokal

```bash
python3 -m http.server 3000      # static saja (tanpa API)
npm i -g vercel && vercel dev    # dengan serverless function aktif
```

Form Commission dan semua tool berbasis `api/` hanya jalan penuh di `vercel dev` atau production.

### 2.1 Nambah tool baru (checklist)
1. Buat `tools/nama-tool.html` (salin tool lain sebagai kerangka). Wajib: meta tags lengkap, `<nav id="main-nav" data-tool="...">`, dan `<script src="../shared.js" defer>`.
2. Daftarkan di `shared.js` → array `TOOLS`.
3. Tambah kartu `<a class="tool-card" data-category="...">` di `index.html` (section `#tools`). Statistik "Free Tools" dan teks status dihitung otomatis; angka di meta description / CTA / ticker footer masih tertulis manual (cari `15 `).
4. `node scripts/gen-sitemap.mjs` lalu commit `sitemap.xml`.
5. Kategori: `Generator`, `Converter`, `Calculator`, `Manager`, `Security`, `3D`.

---

## 3. Deploy

```bash
git add . && git commit -m "v1.8.0" && git push
```
Di Vercel: **Add New Project** → pilih repo → Framework **Other** → Build Command & Output Directory kosong → Deploy. Setiap push ke `main` otomatis re-deploy.

### 3.1 Environment Variables

| Key | Wajib? | Keterangan |
|---|---|---|
| `DISCORD_COMMISSION_WEBHOOK` | Ya, untuk form Commission | URL webhook channel Discord tujuan (lihat §5) |
| `YTDLP_API_URL` | Disarankan | URL service yt-dlp di Railway (kosong → URL default di kode) |
| `ALLOWED_ORIGINS` | Opsional | Origin tambahan yang boleh memanggil API, pisah koma |

Setelah mengubah env var, **redeploy manual**.

### 3.2 CORS (satu tempat untuk semua API)
Semua function memakai `lib/cors.js`: origin `saltoria.site`, `www.saltoria.site`, `localhost:3000` + isi `ALLOWED_ORIGINS`. Deployment yang memanggil API miliknya sendiri (termasuk preview `*.vercel.app`) otomatis lolos. Request tanpa header `Origin` tidak ditolak oleh CORS; tiap endpoint punya validasi sendiri, jadi CORS **bukan** pengganti autentikasi.

### 3.3 Batas & rate limit
- `youtube-fetch`: 12 permintaan / 10 menit / IP. `commission`: 3 pengiriman valid / 10 menit / IP. `upload-animation`: 8 upload / 10 menit / IP.
- Rate limit disimpan **di memori instance**: pagar anti-spam, bukan batas ketat. Untuk batas ketat pakai Vercel KV / Upstash.
- Durasi function diatur **hanya di `vercel.json`**. Plan Hobby maksimal 60 dtk.

---

## 4. Upload ke Roblox (Open Cloud)

`api/upload-asset.js` (Audio Optimizer, Batch Uploader) dan `api/upload-animation.js` (Animation Studio) meneruskan upload ke `https://apis.roblox.com/assets/v1/assets`.

**API key:** Creator Dashboard → Credentials → API Keys → izin **Assets**: `asset:read` + `asset:write`. Key dikirim per-request dan **tidak disimpan** di server. Karena IP harus dibuka lebar (`0.0.0.0/0`) untuk serverless, pakai key khusus bermasa berlaku singkat dan hapus setelah selesai.

**Tipe asset yang didukung** (sesuai dokumentasi Roblox terbaru): Decal/Image, Audio, Model, **Animation** (`.rbxm`/`.rbxmx`), dan **Video** (`.mp4`/`.mov`). Catatan resmi: file `.rbxm`/`.rbxmx` yang dibuat atau diedit di luar Roblox Studio bisa ditolak atau tidak berfungsi. Animasi yang diupload hanya bisa dipakai di experience milik creator yang sama (akun atau grup).

**Polling status:** respons awal berisi `path: "operations/{id}"`. Poll dengan `GET /api/upload-asset?path=operations/{id}`; hasil akhir `{ done: true, response: { assetId } }`. (Perbaikan v1.7.0: dulu proxy memanggil `/operations/{id}`; kini selalu ke `/assets/v1/operations/{id}`.)

**Batas:** body function Vercel ±4,5 MB, jadi file > ±4,3 MB dilewati Batch Uploader (video biasanya melebihi ini). Kena `429` dari Roblox → Batch Uploader menunggu lalu mencoba ulang.

| Error | Penyebab umum |
|---|---|
| `401/403` | API key salah, kedaluwarsa, atau izin kurang |
| `403 Origin tidak diizinkan` | domain belum ada di `ALLOWED_ORIGINS` |
| `400 File animasi tidak valid` | bukan `.rbxmx` KeyframeSequence yang benar |
| Animasi ditolak Roblox | file dibuat di luar Studio; download .rbxmx → buka di Studio → publish lewat Animation Editor |

---

## 5. Commission → Discord

Form di `index.html#commission` (di dalam section Jasa Map) mengirim JSON ke `POST /api/commission`, diteruskan sebagai embed ke Discord.

**Setup:** Discord → Server Settings → Integrations → Webhooks → **New Webhook** → pilih channel privat tim → **Copy Webhook URL** → Vercel env `DISCORD_COMMISSION_WEBHOOK` → redeploy.

**Pengaman:** allowlist origin, honeypot, jeda minimal 3 dtk, rate limit per IP, batas panjang field, `allowed_mentions` kosong, URL referensi harus http/https, URL webhook hanya di env. Opsi layanan di dropdown harus sama persis dengan `SERVICES` di `api/commission.js`.

---

## 6. Mengedit konten

### 6.1 Store — `data/store-data.js`
Semua produk, kategori, dan harga ada di satu file. Petunjuk lengkap ada di komentar atas file. Ringkasnya:
- **Ubah harga:** `price` (angka Rupiah, mis. `450000`) atau `null` → tampil "Cek Discord".
- **Promo / potongan:** isi `originalPrice` (harga normal) dan `price` (harga promo). Badge "-xx%" dan harga coret muncul otomatis. Opsional `promoUntil:'2026-12-31'` → setelah lewat, otomatis kembali ke harga normal. Pastikan `originalPrice` adalah harga normal yang benar-benar berlaku supaya potongan tidak menyesatkan pembeli.
- **Tambah produk:** salin satu baris produk, ganti `id`, `cat`, `name`, harga.
- **Gambar produk:** taruh `assets/store/<id>.jpg` (rasio ±16:10, ≤300 KB); otomatis dipakai. Belum ada file → tampil ikon kategori.
- **Varian** (mis. Donation Pack): `variants:[{name, price, originalPrice}]`. **Add-on:** `addon:'teks'`.
- Tombol order menyalin pesan "Halo Saltoria, saya mau order: …" ke clipboard lalu membuka Discord.
- Kategori: `categories` (All In One, StandAlone: Mini Games / Music / NPC & Avatar / Rental / Utility, Jasa). Urutan array = urutan tampil.

### 6.2 Tim & Partner — `data/community-data.js`
Staf, partner, dan chip partner di hero diatur dari file ini. **File ini publik** (bisa dibaca lewat view source): jangan isi nama asli atau User ID. Foto staf: `assets/staff/<nama>.jpg`; logo partner: `assets/partners/<nama>.png` (PNG transparan). Tanpa file → tampil inisial. Tombol Roblox/Discord partner muncul hanya bila `roblox`/`discord` diisi.

### 6.3 Free Assets — `data/free-assets-data.js`
Tiga langkah menambah aset:
1. (Opsional) Buat `free-assets/<id>/` berisi `thumb.jpg`, foto/GIF preview, `preview.glb` (3D), dan file unduhan kecil (≤ ±20 MB).
2. Salin satu blok `{ … }` dari contoh di komentar file data, lalu isi.
3. `git push` → Vercel deploy otomatis.

**Tombol download** (`downloads:[{label,url}]`; tombol pertama jadi tombol utama di kartu):

| Jenis URL | Perilaku |
|---|---|
| path di repo (`free-assets/x/file.rbxm`) | langsung terunduh |
| Google Drive (link "bagikan") | diubah otomatis jadi link unduh langsung. File besar: Drive menampilkan halaman peringatan virus |
| MediaFire | dibuka di tab baru (MediaFire tidak mengizinkan unduh langsung dari situs lain) |
| link lain | dibuka di tab baru |

Preview: galeri foto/GIF + tab **3D** untuk `.glb` (memakai `<model-viewer>` dari jsDelivr, dimuat hanya saat dibuka). Batas GitHub: file maks 100 MB (peringatan di 50 MB); untuk file besar pakai Drive/MediaFire atau GitHub Releases.

### 6.4 Lainnya
- **About:** section `#about` di `index.html` (teks disusun dari dokumen *Detail Website Saltoria*).
- **Changelog:** tambahkan blok `cl-item` di paling atas `#changelog` (halaman otomatis meringkas ke 3 terbaru).
- **Statistik:** Free Tools, Active Maps, dan Core Projects dihitung otomatis dari isi halaman; "Members" ditulis manual.
- **Sitemap:** `node scripts/gen-sitemap.mjs`.

---

## 7. Aset yang masih perlu kamu siapkan

Halaman tetap jalan tanpa semuanya (ada fallback ikon/inisial). Browser hanya meminta gambar yang terlihat di layar.

| File | Jenis | Catatan |
|---|---|---|
| `assets/partners/uam.png`, `area-bebas.png` | **PNG transparan** | logo partner, persegi ±256 px |
| `assets/staff/dim.jpg` | JPG/PNG | foto staf, persegi ≥200 px |
| `assets/store/<id>.jpg` | JPG | gambar tiap produk (nama = `id` di `data/store-data.js`). Yang belum ada: `summit-gen-1`, `summit-gen-3`, `relapse-kit`, `hangout-kit`, `hangout-kit-pro`, `arcade-machine-15`, `monopoli`, `air-hokey`, `checkers`, `poison-drink`, `slot-machine-3`, `tebak-gambar`, `ular-tangga`, `jail-flashlight`, `polisi-maling`, `dart`, `card-casino`, `ludo`, `gobak-sodor`, `congklak`, `bowling`, `tap-tap-battle`, `blok-game-board`, `boombox-pro`, `spotify-tablet`, `dual-deck`, `rythm-game`, `npc-ojek-system`, `npc-ava-loader`, `seraph-wings`, `sewa-sepeda`, `sewa-motor`, `currency-rupiah-system`, `absen-streak-system`, `loading-screen`, `kursi-kumpul`, `donation-pack`, `jasa-developer` |
| `assets/videos/hero.mp4`, `hero.webm` | video | latar hero; tanpa ini hero memakai warna latar |
| `assets/ordermaps/` — `bbq-obstacle`, `cyberion-club`, `inston-obstacle`, `moonveil-obstacle`, `mount-eunola`, `mount-infinity`, `mount-skyward`, `rexmountain`, `rubby-obstacle`, `zihan-obstacle` (`.jpg`) | JPG | slide galeri Jasa Map, ±1280×720 |
| `assets/maps/` — `comming-soon`, `rumah-pati`, `v-club` (`.jpg`) | JPG | thumbnail kartu map |
| `assets/projects/roblox-dev-tools.jpg` | JPG | thumbnail project |

Tips: JPG ≤ 1200 px sisi terpanjang, kualitas ±80 (≤ 300 KB). Logo/ikon: PNG transparan atau WebP.

---

## 8. Catatan teknis tool

- **Shirt Generator:** peta panel Classic Shirt/Pants 585×559. Shirt dan Pants punya desain terpisah (tab). Preview 360° memakai renderer WebGL kecil tanpa library: avatar R6 (kepala, torso 2×2×1, lengan/kaki 1×2×1), Pants digambar di bawah Shirt seperti di Roblox; bisa diputar, di-zoom, dan menampilkan/menyembunyikan tiap lapisan. Tanpa WebGL → pratinjau datar sebagai cadangan.
- **Material Generator:** mode prosedural (semua pola tileable) atau **gambar sendiri**: `Seamless` (tepi disambung dengan metode offset-blend), `Smooth` (blur ber-wrap), `Keduanya`, atau `Asli`. Ada slider **Ratakan pencahayaan** (menghilangkan gradasi terang-gelap pada foto agar lebih mudah di-seamless), skor kemulusan sambungan, dan pratinjau ubin 2×2. Normal map default gaya OpenGL; centang "balik kanal hijau" bila relief terbalik di Studio.
- **Animation Studio:** kode asli dipertahankan (rig R6/R15, FK, gizmo, easing, konversi R6↔R15, ekspor `.rbxmx`, impor `.rbxmx`/JSON). Perbaikan: panah keyboard tidak lagi menggeser timeline saat slider difokuskan; impor JSON/rbxmx rusak divalidasi (tidak lagi membekukan editor); keyframe ganda di waktu yang sama digabung; ekspor menambah keyframe di detik 0 bila belum ada; upload dengan timeout, retry `429`, dan pesan error yang jelas.
- **Sprite Sheet / Discord & Text Tools / Batch Uploader:** lihat komentar di tiap file. Batch Uploader memilih tipe untuk `.rbxm/.rbxmx` (Model atau Animation).

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
