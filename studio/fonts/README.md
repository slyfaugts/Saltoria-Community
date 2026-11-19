# Folder fonts/

Taruh berkas font (`.ttf`, `.otf`, `.woff`, `.woff2`) di folder ini, lalu jalankan dari akar proyek:

```
node tools/make-fonts-manifest.js
```

Perintah itu menulis `fonts/fonts.json`, dan semua font di folder ini muncul di daftar font Teks 3D
(kategori "Fontmu"). Commit berkas font dan `fonts.json` ke GitHub, lalu deploy ulang di Vercel.

## Soal lisensi

Font dari dafont.com punya lisensi masing-masing. Banyak yang "gratis untuk penggunaan pribadi saja"
atau "demo". Memasukkannya ke situs publik Saltoria bisa melanggar lisensi. Pakai hanya font yang
lisensinya mengizinkan (cek halaman font di dafont, atau berkas teks lisensi di dalam zip font).
Tool ini tidak memeriksa lisensi untukmu.
