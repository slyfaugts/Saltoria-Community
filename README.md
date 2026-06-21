# Saltoria Community — Website

Struktur folder siap deploy ke **Vercel** (butuh serverless functions, jadi platform static-only seperti GitHub Pages/Netlify drop tidak akan menjalankan folder `api/`).

```
saltoria-deploy/
├── index.html               ← Landing page utama
├── vercel.json               ← Config serverless functions
├── api/
│   ├── youtube-fetch.js      ← Proxy fetch audio YouTube (cobalt.tools)
│   └── upload-asset.js       ← Proxy upload asset ke Roblox Open Cloud
└── tools/
    ├── audio-optimizer.html  ← Roblox Audio Optimizer
    ├── skybox-converter.html ← Skybox Converter
    └── anim-converter.html   ← Animation Link Converter
```

## Kenapa Ada Folder `api/`?

Roblox Open Cloud API dan cobalt.tools tidak mengizinkan request langsung dari browser (CORS block). Jadi 2 file di `api/` ini jadi "jembatan": browser → server Vercel kamu → Roblox/cobalt.tools → balik lagi ke browser. Tanpa ini, fitur **Fetch YouTube** dan **Upload ke Roblox** di Audio Optimizer tidak akan jalan.

Skybox Converter dan Animation Link Converter **tidak butuh** folder `api/` — 100% jalan di browser.

## Cara Deploy (HARUS lewat GitHub → Vercel, bukan drag & drop)

### 1. Push ke GitHub
1. Buat repo baru di [github.com/new](https://github.com/new) — JANGAN centang "Add README"
2. Di halaman repo kosong, klik **"uploading an existing file"**
3. Drag & drop SEMUA isi folder `saltoria-deploy` (index.html, vercel.json, folder `api/`, folder `tools/`, README.md)
4. Commit changes

### 2. Deploy ke Vercel
1. Login ke [vercel.com](https://vercel.com) pakai akun GitHub
2. **Add New → Project** → pilih repo yang baru dibuat
3. Framework Preset: **Other**
4. Build Command & Output Directory: **kosongkan**
5. Klik **Deploy**

Vercel otomatis mendeteksi folder `api/` dan men-deploy-nya sebagai serverless functions. Tidak perlu setting tambahan.

## Testing Setelah Deploy

- Buka `https://your-project.vercel.app/tools/skybox-converter.html` → upload gambar → harus langsung convert (tidak butuh API).
- Buka `https://your-project.vercel.app/tools/audio-optimizer.html`:
  - Tab **Upload File** → harus langsung bisa process & download (tidak butuh API).
  - Tab **YouTube** → paste link → cek apakah berhasil fetch (tergantung uptime cobalt.tools).
  - **Upload ke Roblox** → isi API Key dari [Roblox Creator Hub](https://create.roblox.com/settings/credentials) dengan permission `Asset:Write` → cek apakah dapat Asset ID.

## Catatan Keamanan

- API Key Roblox disimpan di `localStorage` browser user masing-masing.
- Saat upload, key dikirim ke proxy `api/upload-asset.js` di server kamu sendiri (Vercel), lalu diteruskan ke Roblox — **tidak disimpan/dicatat** di proxy, hanya diteruskan (pass-through).
- Tetap sarankan user generate API Key dengan scope **Asset:Write** saja, jangan full access.

## Tools yang Belum Dibuat (placeholder "SOON" di landing page)
- Robux Tax Calculator
- Roblox Info Lookup
- DS Key Gen (DataStore Key Generator)
- Server Status Checker

Tinggal tambahkan file HTML baru di folder `tools/` dan update link card di `index.html` (section `id="tools"`) kalau mau lanjut develop.
