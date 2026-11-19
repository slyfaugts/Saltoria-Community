# Saltoria 3D Studio

Web tool Saltoria Community untuk membuat model 3D siap import ke **Roblox Studio** (`.glb`, `.obj` + texture, `.stl`, plus gambar PNG dan rekaman putar WebM). Ada empat mode:

- **Logo / gambar**: ubah PNG/JPG/WebP/SVG jadi model 3D (kontur subpiksel, bevel, relief bertingkat, warna asli atau gradient).
- **Teks 3D**: ketik teks, pilih font, jadikan model 3D.
- **Desain sendiri**: gambar di kanvas (kuas, bentuk, penghapus), langsung jadi 3D.
- **Modeler 3D**: editor ringan ala Blender. Gizmo pindah/putar/skala, library 66 objek, bangun ruang lengkap, array, preset material, simpan/buka proyek.

Lihat `CATATAN-UPDATE.md` untuk daftar fitur yang sudah ada, belum dikerjakan, dan yang tidak bisa dipaksakan.

Semua proses berjalan di browser pengguna. Tidak ada server, database, atau login. Gambar yang diunggah tidak dikirim ke mana pun.

## Deploy ke Vercel

1. Push folder ini ke repo GitHub.
2. Di Vercel: **Add New → Project → Import** repo tersebut.
3. Framework Preset: **Other**. Build Command dan Output Directory dikosongkan (situs statis, root = folder repo).
4. Klik **Deploy**.

Lewat CLI: `npx vercel --prod` dari folder ini.

## Jalankan lokal

```
npx serve .
```

(atau `python3 -m http.server 8000`, lalu buka http://localhost:8000)

## Struktur

| Berkas | Isi |
| --- | --- |
| `index.html` | Halaman dan kontrol |
| `css/style.css` | Tema Aurora Crystal Saltoria |
| `js/core.js` | Mesin: kontur subpiksel (marching squares), penyederhanaan, triangulasi, ekstrusi + bevel, penulis GLB/OBJ/ZIP |
| `js/viewer.js` | Pratinjau 3D WebGL (tanpa library) |
| `js/shapes.js` | Generator bangun ruang (bentuk lengkung analitik, bentuk datar lewat convex hull) |
| `js/maker.js` | Modeler: objek, gizmo, library, array, undo/redo, simpan/buka proyek, gabung jadi satu mesh |
| `js/library.js` | 66 objek siap pakai (rakitan bentuk dasar berwarna) |
| `js/draw.js` | Kanvas "Desain sendiri" |
| `js/app.js` | Antarmuka, teks 3D, warna/gradient, unduhan |
| `assets/saltoria-logo.png` | Logo bawaan |
| `tests/test-core.js` | Uji mesin logo/teks di Node |
| `tests/test-shapes.js` | Uji semua bangun ruang (tertutup, arah muka, volume, jumlah sisi) |
| `tests/test-v3.js` | Uji library, gabung mesh, STL, lapisan relief |

## Modeler 3D

- Pilih alat dengan **Q** (pilih), **W** (pindah), **E** (putar), **R** (skala), lalu seret gizmo di pratinjau. Tahan **Shift** saat menskala untuk skala seragam. Palet perintah: **Ctrl/⌘ + K**.
- Dengan alat Pilih, **seret** objek di pratinjau untuk memindahkannya (mendatar). Tahan **Alt**, atau pilih "Tegak" di panel Scene, untuk naik-turun. Ada opsi tempel ke grid.
- Klik objek untuk memilih, klik ruang kosong untuk membatalkan pilihan. Seret di ruang kosong untuk memutar kamera, **Shift+seret** atau klik kanan untuk menggeser.
- Pintasan: `Ctrl+Z` batalkan, `Ctrl+Y` atau `Ctrl+Shift+Z` ulangi, `Ctrl+D` duplikat, `Delete` hapus, `Esc` batal pilih, `F` fokus ke semua objek.
- Scene tersimpan otomatis di browser. Gunakan **Simpan proyek** untuk berkas `.json` yang bisa dibuka lagi di perangkat lain.
- Warna tiap objek digabung menjadi satu tekstur palet, jadi seluruh scene diekspor sebagai satu mesh.

## Uji

```
node tests/test-shapes.js
node tests/test-v3.js <file.rgba> <lebar> <tinggi>
node tests/test-core.js <file.rgba> <lebar> <tinggi> <folder-keluaran>
```

`file.rgba` adalah piksel RGBA mentah dari gambar uji.

## Catatan

- Font teks dimuat dari Google Fonts. Tanpa internet, pratinjau teks memakai font cadangan. Font sendiri (.ttf/.otf/.woff) tetap bisa dipakai.
- Batas Roblox: jaga model di bawah 20.000 segitiga. Penghitung di bawah pratinjau memberi peringatan, dan outline disederhanakan otomatis sesuai "Batas segitiga".


## Pembaruan v4 (tahap 2)

Modeler kini punya menu bar File/Edit/Tambah, toolbar melayang, multi-seleksi, grup, Outliner, gizmo Lokal/Global, siluet seleksi, cermin dan ratakan, 205 objek library, pemeriksa mesh, kurangi segitiga otomatis, dan ekspor per objek. Font Teks 3D: 81 (Google Fonts plus folder `fonts/`, lihat `fonts/README.md`). Detail di `CATATAN-UPDATE.md`.

Uji: `node tests/test-shapes.js`, `node tests/test-v3.js`, `node tests/test-v4.js`.
