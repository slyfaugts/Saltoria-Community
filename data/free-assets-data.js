/* ═══════════════════════════════════════════════════════════════════════
   DATA FREE ASSETS — INI SATU-SATUNYA FILE YANG PERLU KAMU EDIT.
   Halaman free-assets.html dirender otomatis oleh js/free-assets.js.

   ── CARA MENAMBAH ASET (3 langkah) ─────────────────────────────────────
   1. (Opsional) Buat folder  free-assets/<id-aset>/  lalu taruh di dalamnya:
        thumb.jpg        gambar kartu (rasio ±16:10, ≤300 KB)
        1.jpg, 2.jpg …   foto preview / GIF demo (boleh banyak)
        preview.glb      model 3D untuk preview interaktif (opsional)
        <file-aset>      file yang diunduh (kalau kecil, ≤ ±20 MB)
   2. Salin SATU blok { ... } dari contoh di bawah ke dalam array items,
      lalu ganti isinya. Jangan lupa koma di antara blok.
   3. git add . && git commit && git push  →  Vercel deploy otomatis.

   ── TOMBOL DOWNLOAD ────────────────────────────────────────────────────
   Isi downloads dengan satu atau lebih { label, url }. Tombol pertama jadi
   tombol utama di kartu. Cara kerja otomatis menurut jenis url:
     • path di repo   'free-assets/obby/obby.rbxm' → langsung terunduh
     • Google Drive   link "bagikan" biasa          → diubah jadi link unduh langsung
                      (file besar: Drive menampilkan halaman peringatan virus, klik "Download anyway")
     • MediaFire      link halaman MediaFire        → dibuka di tab baru
                      (MediaFire memang tidak mengizinkan unduh langsung dari situs lain)
     • link lain      dibuka di tab baru
   Pastikan link Drive diatur "Siapa saja yang memiliki link" dan MediaFire tidak private.

   ── DAFTAR FIELD ───────────────────────────────────────────────────────
   id           wajib, unik, huruf kecil + strip
   title        wajib
   category     bebas: 'Model', 'Script', 'UI', 'Template', 'Map', 'Audio', …
                (chip filter dibuat otomatis dari kategori yang dipakai)
   description  teks singkat
   tags         ['obby','checkpoint']
   license      mis. 'Gratis · kredit tidak wajib'
   version, size, format, date   teks info (date format 'YYYY-MM-DD', dipakai untuk urutan)
   thumb        gambar kartu; kosong → tampil ikon kategori
   gallery      ['free-assets/x/1.jpg', 'free-assets/x/demo.gif']  (di jendela detail)
   model        'free-assets/x/preview.glb'  → tab "3D" interaktif di jendela detail
   downloads    [{ label, url }, …]
   links        [{ label, url }, …]  tautan tambahan (mis. halaman Roblox)
   ═══════════════════════════════════════════════════════════════════════ */
window.FREE_ASSETS = {
  items: [
    /* ── CONTOH (hapus tanda komentar, lalu sesuaikan) ───────────────────
    {
      id: 'obby-kit-basic',
      title: 'Obby Kit Basic',
      category: 'Model',
      description: 'Checkpoint, kill brick, dan moving platform siap pakai untuk map obby.',
      tags: ['obby', 'checkpoint'],
      license: 'Gratis · kredit tidak wajib',
      version: '1.0', size: '2,4 MB', format: '.rbxm', date: '2026-11-20',
      thumb: 'free-assets/obby-kit-basic/thumb.jpg',
      gallery: ['free-assets/obby-kit-basic/1.jpg', 'free-assets/obby-kit-basic/demo.gif'],
      model: 'free-assets/obby-kit-basic/preview.glb',
      downloads: [
        { label: 'Download', url: 'free-assets/obby-kit-basic/obby-kit-basic.rbxm' },
        { label: 'Mirror MediaFire', url: 'https://www.mediafire.com/file/xxxxxxxx/obby-kit-basic.zip/file' },
        { label: 'Google Drive', url: 'https://drive.google.com/file/d/ID_FILE_KAMU/view?usp=sharing' },
      ],
      links: [{ label: 'Lihat di Roblox', url: 'https://www.roblox.com/' }],
    },
    ─────────────────────────────────────────────────────────────────── */
  ],
};
