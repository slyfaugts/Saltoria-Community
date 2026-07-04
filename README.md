# Saltoria Community — Website & Tools

Website resmi **Saltoria Community**, komunitas Roblox developer asal Indonesia. Berisi landing page komunitas + 16 tools gratis buat Roblox developer (converter, calculator, generator, lookup), dibangun sebagai static site + serverless API functions, di-deploy lewat GitHub → Vercel.

---

## 1. Penjelasan

### 1.1 Apa ini?
Saltoria Community website punya dua bagian utama:

1. **Landing page** (`index.html`) — profil komunitas: project showcase, Jasa Map Builder, tim, partner, dan grid 16 developer tools.
2. **Tools** (`tools/*.html`) — 16 halaman tool standalone (masing-masing 1 file HTML self-contained: CSS + JS di dalam file yang sama, nggak ada build step).

Semua **client-side only** kecuali 2 tool yang butuh proxy server (Audio Optimizer & upload-related tools), yang jalan lewat serverless function di `api/`.

### 1.2 Struktur folder

```
saltoria-website/
├── index.html              ← landing page utama
├── shared.js                ← command palette, recently-used tracker, aria-label patch (dipakai semua halaman)
├── vercel.json               ← config serverless function (maxDuration, memory)
├── tools/                    ← semua tool (16 file)
│   ├── audio-optimizer.html
│   ├── skybox-converter.html
│   ├── anim-converter.html
│   ├── color-converter.html
│   ├── robux-tax-calculator.html
│   ├── loot-table-calc.html
│   ├── roblox-info-lookup.html
│   ├── server-status.html
│   ├── badge-checker.html
│   ├── ds-key-gen.html
│   ├── tween-calculator.html
│   ├── thumbnail-generator.html
│   ├── script-header-gen.html
│   ├── instance-tree-gen.html
│   ├── gradient-generator.html
│   └── font-preview.html
├── api/                       ← serverless functions (Vercel Node runtime)
│   ├── youtube-fetch.js       ← proxy audio dari YouTube/SoundCloud/dll → yt-dlp Railway service
│   └── upload-asset.js        ← proxy upload asset ke Roblox Open Cloud API
└── assets/                    ← favicon, og-image, dll (belum ada di repo, lihat §3.4)
```

### 1.3 Tech stack
- **Frontend:** HTML + CSS murni (custom, no framework) + vanilla JS. Font: Inter + Space Mono + Material Symbols Rounded (Google Fonts).
- **Hosting:** Vercel (static hosting + serverless functions Node.js).
- **Backend proxy:** 2 file di `api/`, jalan sebagai Vercel Serverless Function (bukan Express, format `export default function handler(req, res)`).
- **External services:**
  - Railway (self-hosted `yt-dlp` service) — dipakai `youtube-fetch.js` buat convert audio dari link YouTube/dll.
  - Roblox Open Cloud API — dipakai `upload-asset.js` buat upload asset atas nama user (pakai API key milik user sendiri, bukan punya Saltoria).
- **Storage:** semua state tool disimpan di `localStorage` browser (nggak ada database).

### 1.4 Fitur shared.js
File ini di-include di semua halaman (`index.html` dan semua `tools/*.html`) lewat `<script src="shared.js">` (atau `../shared.js` dari dalam folder `tools/`). Fungsinya:
- **Command Palette** — tekan `Ctrl+K` (Windows/Linux) atau `Cmd+K` (Mac) di halaman manapun buat cari & lompat ke tool lain tanpa balik ke home dulu.
- **Recently Used** — otomatis nyimpen tool yang baru dibuka, ditampilin di section "Baru dipakai" di landing page.
- **Aria-label auto-patch** — nambahin label aksesibilitas ke tombol icon-only yang belum dikasih label manual.

Kalau nambah tool baru, **wajib** update array `TOOLS` di `shared.js` (lihat §2.4) biar ke-detect di command palette & recently-used.

---

## 2. Tutorial

### 2.1 Jalanin lokal (tanpa install apapun)
Karena semua file HTML self-contained, paling gampang:

```bash
# dari root folder project
python3 -m http.server 3000
# atau
npx serve .
```

Buka `http://localhost:3000`. Semua tool jalan normal kecuali:
- **Audio Optimizer** — butuh `api/youtube-fetch.js` jalan, artinya butuh `vercel dev` (lihat §2.2), bukan sekadar static server.
- **Fitur upload asset** — sama, butuh `vercel dev` karena manggil `api/upload-asset.js`.

### 2.2 Jalanin lokal dengan serverless function aktif
```bash
npm i -g vercel      # sekali aja kalau belum ada
vercel dev
```
Ini bakal jalanin static file + `api/*.js` sekaligus di `http://localhost:3000`, exact sama seperti environment production Vercel.

### 2.3 Nambah tool baru (checklist)
1. Bikin file baru di `tools/nama-tool.html`. Copy struktur nav dari tool lain yang udah ada (`<nav>` + `.nav-brand` + `.nav-back`) biar konsisten & biar `shared.js` bisa inject command palette trigger dengan benar.
2. Tambahin meta tags lengkap di `<head>` — description, og:title, og:description, og:image, og:url, canonical, favicon (lihat contoh di `tools/color-converter.html`).
3. Taruh `<script src="../shared.js" defer></script>` sebelum `</body>`.
4. Daftarin tool baru di **dua tempat**:
   - `shared.js` → array `TOOLS` (name, sub, icon, href, category).
   - `index.html` → tambah `<a class="tool-card" data-category="...">` baru di `#tools-grid`.
5. Kategori yang tersedia: `Generator`, `Converter`, `Calculator`, `Lookup`, `Utility`. Kalau butuh kategori baru, tambahin juga chip filter-nya di `index.html` (`.tools-cat-wrap`).

### 2.4 Command Palette — cara pakai
- Buka halaman manapun → tekan `Ctrl+K` / `Cmd+K`.
- Ketik nama tool atau kategori (misal ketik "converter" bakal nampilin semua tool converter).
- Navigasi pakai panah atas/bawah, `Enter` buat buka, `Esc` buat tutup.

---

## 3. Cara Deploy

### 3.1 Push ke GitHub
```bash
git init
git add .
git commit -m "update: shared.js, meta tags, category filter, cors fix"
git branch -M main
git remote add origin https://github.com/<username>/saltoria-website.git
git push -u origin main
```

### 3.2 Connect ke Vercel (sekali aja, project baru)
1. Buka [vercel.com](https://vercel.com) → **Add New Project**.
2. Pilih repo GitHub `saltoria-website`.
3. Framework Preset: pilih **Other** (bukan Next.js/dll, karena ini static + serverless function biasa).
4. Build Command: kosongin. Output Directory: kosongin/`.` (root).
5. Klik **Deploy**.

Setelah project ke-connect, **setiap `git push` ke branch `main` otomatis re-deploy** (CI/CD bawaan Vercel).

### 3.3 Environment Variables (wajib buat Audio Optimizer)
Di dashboard Vercel → project → **Settings → Environment Variables**, tambahin:

| Key | Value | Keterangan |
|---|---|---|
| `YTDLP_API_URL` | `https://saltoria-ytdlp-production.up.railway.app` | URL Railway service `yt-dlp` kamu. Kalau nggak di-set, `youtube-fetch.js` fallback ke URL default ini. |

Setelah nambah/ubah env var, **redeploy manual** dari tab Deployments (env var nggak auto-apply ke deployment yang udah jalan).

### 3.4 Assets yang perlu kamu siapin sendiri
`index.html` dan semua tool page reference file-file ini, tapi belum ada di upload kamu — pastikan ada di `assets/` sebelum deploy biar nggak broken image/404:
- `assets/favicon.png`
- `assets/og-image.png` (buat preview link di Discord/WhatsApp — ukuran ideal 1200×630px)

### 3.5 Custom domain (opsional)
Vercel → project → **Settings → Domains** → masukin domain kamu (misal `saltoria.com`) → ikutin instruksi DNS (CNAME/A record) dari Vercel.

⚠️ **Penting:** kalau pakai custom domain, update `ALLOWED_ORIGINS` di `api/upload-asset.js` dan `api/youtube-fetch.js` (saat ini isinya `https://saltoria.vercel.app` + `http://localhost:3000`) — tambahin domain barunya, kalau nggak, request dari domain baru bakal ke-block CORS.

### 3.6 Cek deployment berhasil
- Buka domain production, test command palette (`Ctrl+K`), test filter kategori di tools grid.
- Test 1 tool yang butuh API (Audio Optimizer) buat mastiin `api/youtube-fetch.js` jalan dan `YTDLP_API_URL` ke-set bener.

---

## 4. Cara Upload Asset

Fitur upload asset (dipakai Audio Optimizer & tool lain yang perlu push file ke Roblox) jalan lewat `api/upload-asset.js`, yang jadi proxy ke **Roblox Open Cloud API** (`https://apis.roblox.com/assets/v1/assets`). Ini perlu karena Roblox nggak ngizinin request langsung dari browser (CORS diblokir di sisi Roblox).

### 4.1 Dapetin API Key Roblox Open Cloud
1. Buka [Roblox Creator Dashboard](https://create.roblox.com/dashboard/credentials).
2. Klik **API Keys** → **Create API Key**.
3. Kasih nama key (misal `saltoria-upload`).
4. Di bagian **Permissions**, tambahin scope **Assets** dengan akses **Write** (Create), dan pilih Experience/Creator yang jadi owner asset-nya.
5. Set **Security** → boleh restrict ke IP tertentu, tapi kalau upload dari browser user (IP dinamis), biarin **Allow all IP addresses**.
6. Copy API key yang muncul — **key ini cuma ditampilin sekali**, simpan baik-baik. Ini yang dipakai sebagai header `x-api-key`.

⚠️ API key ini punya akses ke akun Roblox user, dan Saltoria **tidak menyimpan** key ini di server manapun — dia cuma lewat (relay) di `upload-asset.js`, langsung dari browser ke Roblox. Pastiin user paham ini pas dipakai di tool.

### 4.2 Format request ke endpoint
**Endpoint:** `POST /api/upload-asset`
**Headers:**
```
x-api-key: <API key Roblox Open Cloud milik user>
Content-Type: multipart/form-data
```
**Body (multipart/form-data), 2 field:**
- `request` — JSON string berisi metadata asset:
  ```json
  {
    "assetType": "Audio",
    "displayName": "Nama Audio",
    "description": "Diupload lewat Saltoria Audio Optimizer",
    "creationContext": {
      "creator": { "userId": "9197728639" }
    }
  }
  ```
- `fileContent` — file binary asset-nya (mp3/ogg/dll, sesuai `assetType`).

### 4.3 Contoh kode (client-side, dari browser)
```javascript
async function uploadAsset(apiKey, file, displayName, userId) {
  const formData = new FormData();
  formData.append('request', JSON.stringify({
    assetType: 'Audio',
    displayName,
    description: 'Diupload lewat Saltoria Audio Optimizer',
    creationContext: { creator: { userId: String(userId) } }
  }));
  formData.append('fileContent', file);

  const res = await fetch('/api/upload-asset', {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: formData
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload gagal');
  return data; // { path: "operations/xxx", ... } — operation yang perlu di-poll
}
```

### 4.4 Polling status upload
Upload asset Roblox itu **async** — response awal cuma ngasih `operation path`, bukan hasil final. Perlu di-poll:

```javascript
async function pollOperation(apiKey, operationPath) {
  const res = await fetch(`/api/upload-asset?path=${encodeURIComponent(operationPath)}`, {
    headers: { 'x-api-key': apiKey }
  });
  const data = await res.json();
  return data; // { done: true, response: { assetId: "..." } } kalau udah selesai
}

// Contoh pakai: polling tiap 2 detik sampai done
async function waitForAsset(apiKey, operationPath) {
  while (true) {
    const status = await pollOperation(apiKey, operationPath);
    if (status.done) return status.response.assetId;
    await new Promise(r => setTimeout(r, 2000));
  }
}
```

### 4.5 Batasan penting
- **Ukuran file:** max **20MB** per request (dibatasi manual di `upload-asset.js`, sesuaikan sama batas asset Roblox sendiri per tipe).
- **Vercel body limit:** hosting Vercel sendiri punya hard-cap ~4.5MB untuk serverless function biasa — kalau butuh file lebih besar dari itu, perlu pindah ke Edge Function atau upload langsung client → Roblox pakai signed URL (arsitektur beda, belum diimplementasi di sini).
- **Rate limit:** Roblox Open Cloud API punya rate limit sendiri per API key — kalau kena `429`, response `upload-asset.js` bakal nerusin error itu apa adanya, handle di UI (retry with backoff).
- **CORS:** endpoint ini cuma nerima request dari origin yang ada di `ALLOWED_ORIGINS` (lihat §3.5) — kalau testing dari domain lain, bakal keblok browser sebelum sempat manggil Roblox.

### 4.6 Troubleshooting umum
| Error | Kemungkinan penyebab |
|---|---|
| `401 Missing x-api-key header` | Header `x-api-key` nggak kekirim dari frontend. |
| `Non-JSON response from Roblox API` | API key salah/expired, atau scope permission-nya kurang (cek §4.1 langkah 4). |
| CORS error di console browser | Domain kamu belum ada di `ALLOWED_ORIGINS` — tambahin di `api/upload-asset.js`. |
| `413 File too large` | File lebih dari 20MB — kompres dulu atau cek §4.5. |

---

**Dibuat & di-maintain oleh Slyfaugts / Saltoria Community.**
