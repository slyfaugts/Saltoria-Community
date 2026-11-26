# v5 tahap 3 — teks, relief, impor, tekstur

## Sudah
- **Teks 3D**: lengkung teks (−100..100, per baris), efek alas dengan garis tepi, bayangan 3D, garis tepi ganda (warna & tebal sendiri, satu tekstur).
- **Relief halus (heightmap)**: tiga gaya (terang/gelap menonjol, menggembung), slider kehalusan kisi dan pelunakan; tepi relief menyatu dengan dasar; anggaran segitiga mengikuti target.
- **Impor model** (.glb / .obj) di Modeler: otomatis di-weld, diturunkan ke maks 30.000 segitiga, ukuran dinormalkan; menu Edit > Turunkan detail ke 50/25/10% (edge collapse dengan quadric error). Ikut tersimpan di proyek .json.
- **Tekstur**: 11 motif prosedural (marmer, kayu, awan, garis, kotak, kisi, karbon, sarang lebah, titik, batu, bintang), tekstur dari gambar sendiri (potong persegi, bisa diulang), dan unduh **Peta PBR (.zip)**: albedo, normal, roughness, metalness.
- Tes baru: tests/test-meshops.js, tests/test-v5-relief.js.

## Penyempurnaan tahap 3 (v5b)
- **Impor membawa warna**: GLB (warna material, tekstur warna disampel per segitiga, warna titik) dan OBJ + MTL (pilih kedua berkas sekaligus) dikuantisasi ke maksimal 24 warna dan tetap ada setelah turunkan detail serta tersimpan di proyek.
- **Putar Z-atas ke Y-atas** (Edit) untuk model dari Blender yang berdiri miring.
- **Tekstur motif di Modeler** untuk objek mana pun (bentuk, library, model impor): 11 motif, dua warna, kerapatan. UV otomatis lewat proyeksi kotak, tanpa unwrap manual; ikut tersimpan dan ikut ekspor GLB/OBJ (satu atlas tekstur).

## Masih terbatas
- Warna model impor adalah perkiraan 24 warna per segitiga, bukan tekstur piksel asli (detail halus seperti tulisan kecil di tekstur hilang).
- UV proyeksi kotak memberi sambungan terlihat di sudut model yang bulat; ini bukan unwrap seperti Blender.
- Tekstur gambar sendiri (bukan motif) belum tersedia di Modeler; baru di tab Logo dan Teks.
- Normal map dihitung dari kecerahan tekstur, bukan bake dari geometri.

## Tidak bisa / perlu dicoba sendiri
- GLB hanya membawa tekstur warna. Peta PBR dipasang manual lewat SurfaceAppearance di Roblox; hasilnya belum diverifikasi.
- Font Google butuh internet saat dipilih.

# Catatan Update v4.1: library lebih halus dan realistis

- **Sudut membulat otomatis** pada semua bagian berbentuk kotak di library (radius mengikuti sisi terpendek; panel tipis tetap rata). Rumah, sofa, mobil, dan perabot tidak lagi terlihat bersudut tajam.
- **Lengkungan lebih halus**: jumlah segmen bola, tabung, kerucut, dan lainnya dinaikkan, dan menyesuaikan ukuran bagian (bagian kecil tetap ringan, bagian besar halus).
- **Variasi nada halus antar bagian** supaya permukaan sewarna tetap terbaca bentuknya, dan **palet lebih natural** (kayu, daun, batu).
- **Dirombak lebih realistis**: Rumah (pondasi, cerobong, bingkai pintu dan jendela, ambang, tangga kecil), Pohon (akar melebar, cabang, kumpulan daun bervariasi), Pohon cemara, Semak (dengan buah), Batu (lumut dan kerikil), Gunung (tidak bersegi lagi), Bunga (kelopak melingkar), Jamur, Awan, Kursi, Meja, Sofa (bantal dan kaki), Mobil (kaca, lampu, bumper, velg), Kastil (gerigi dan menara), Lampu, Kucing.
- Jumlah segitiga library: median 636 dan rata-rata 906 per objek (paling berat sekitar 4.000, yaitu Pohon). Lebih berat dari sebelumnya, tapi aman untuk batas 20.000 Roblox. Pemeriksa mesh dan "Kurangi segitiga otomatis" dapat menurunkannya (slider detail ikut mengurangi segmen sudut).

Catatan jujur: tingkat "realistis" dibatasi oleh tekstur warna tunggal per bagian dan ekspor GLB ke Roblox yang hanya membawa tekstur warna. Bentuk lebih natural, tapi bukan model fotorealistik. Pencahayaan, bayangan, dan material akhir ditentukan Roblox.

---

# Catatan Update v4, tahap 2 dari 5: Modeler seperti editor 3D

## Tahap 2 yang sudah jadi

**Menu dan toolbar di pratinjau (dari referensi UI ala Blender)**
- Menu bar **File / Edit / Tambah**, label Object Mode, dan tombol **Selesai & Unduh**.
- File: proyek baru, simpan dan buka proyek (.json, kini termasuk grup), unduh .glb / .obj / .stl / .png, **ekspor per objek (zip banyak .glb)**, pemeriksa mesh.
- Edit: batalkan / ulangi, **riwayat bernama** (klik langkah untuk kembali), pilih semua, duplikat, hapus, sembunyikan / tampilkan, kunci / buka kunci, grup, cermin, taruh di lantai, fokus.
- Tambah: semua bentuk dasar per kategori dan pintasan ke library.
- **Toolbar melayang** di kiri pratinjau: Pilih, Pindah, Putar, Skala, tombol **Dunia/Lokal**, dan **Snap** (0,5 / 1 / 0,25 / mati).

**Seleksi dan penyusunan**
- **Multi-seleksi**: Ctrl/⌘ + klik, atau Ctrl/⌘ + A. Gizmo menggeser, memutar, dan menskala semua objek terpilih dari pusat seleksi.
- **Grup**: Ctrl+G buat grup, Ctrl+Shift+G lepas. Klik anggota memilih seluruh grup. Objek library yang dipecah otomatis menjadi grup.
- **Outliner** berpohon: grup bisa dilipat, ganti nama dengan klik dua kali, tombol tampil/sembunyi, kunci, hapus per baris.
- **Kunci objek**: tidak bisa digeser atau diubah sampai dibuka.
- **Gizmo Lokal/Global**: gizmo bisa mengikuti rotasi objek.
- **Garis seleksi mengikuti bentuk** (siluet + tepi tajam), bisa dikembalikan ke kotak pembatas lewat pilihan "Garis seleksi".
- **Cermin** di sumbu X/Y/Z (terhadap pusat seleksi) dengan atau tanpa salinan. **Ratakan** min/tengah/maks per sumbu dan **bagi jarak** sama rata (min. 3 objek).
- Pintasan: Shift+D duplikat, X atau Delete hapus, H sembunyi, Alt+H tampilkan semua, Q/W/E/R alat.

**Library 205 objek di 14 kategori** (sebelumnya 66): tambahan Taman, Olahraga & mainan, Luar angkasa, Laut, dan Obby (checkpoint, platform, lava, koin, trampolin, dan sebagainya), serta puluhan objek baru di kategori lama. Semua dirakit dari bentuk dasar.

**Pemeriksa mesh** (tombol "Periksa mesh" di dock, semua tab)
- Mengecek jumlah segitiga terhadap target, ukuran maksimal Roblox 2048 studs, segitiga tanpa luas, muka terbalik, tepi terbuka, tepi bersinggungan, dan UV di luar 0 sampai 1.
- Opsi **perbaiki otomatis saat unduh**: membuang segitiga gepeng dan membalik muka bila volume negatif.
- **Kurangi segitiga otomatis ke target**: di Modeler menurunkan jumlah segmen bentuk lengkung (bentuk bersudut tetap); di Logo / Teks / Desain menurunkan kebulatan tepi dan menyederhanakan outline. Ada tombol kembalikan detail penuh.

## Catatan jujur tahap 2

- Skala lewat gizmo pada **banyak objek yang sudah diputar** akurat hanya pada sumbu dunia; hasil bisa terasa miring bila objeknya diputar bebas.
- Kurangi segitiga memakai penurunan detail bentuk, **bukan** penyederhanaan mesh umum (edge collapse). Hasilnya aman, tapi tidak bisa menyusutkan mesh hasil impor. Penyederhanaan mesh umum menyusul bersama Edit Mode dan impor GLB.
- Mesh yang terbuka (tidak tertutup rapat) tidak diperbaiki otomatis; itu hanya dilaporkan.
- Zip per objek mempertahankan posisi scene tiap objek, jadi bila diimpor ke Roblox Studio semuanya jatuh di tempat yang benar bila titik asalnya sama.
- Tombol "Object Mode" masih label; Edit Mode menyusul di tahap 4.
- Belum dicoba di Roblox Studio sungguhan.

## Cek yang sudah dijalankan

- Uji Node: test-shapes, test-core, test-v3, test-v4 (pemeriksa mesh) semuanya lulus.
- Uji browser (Chromium): menu bar dan toolbar, Ctrl+A / Ctrl+G, seret gizmo menggeser seluruh grup, undo, Lokal/Global, cermin + salin, ratakan, siluet bola, menu Tambah, pemeriksa mesh, kurangi segitiga (logo 17.424 jadi 6.640; Modeler 2.120 jadi 1.014), zip per objek (jumlah .glb sama dengan jumlah objek), tanpa error konsol.

## Tahap berikutnya

3) efek teks 3D, relief halus, impor GLB/OBJ, tekstur prosedural dan dari gambar. 4) Edit Mode penuh. 5) Sculpting, cat tekstur, PBR, panduan interaktif.

---

# Catatan Update v4 (tahap 1 dari 5): Saltoria 3D Studio

## Tahap 1 yang sudah jadi

- **Tambah bentuk bergambar**: setiap bentuk di Modeler punya kartu bergambar (thumbnail 3D), dengan pencarian.
- **Teks 3D: 81 font**. 73 font Google (Gim & futuristik, Piksel & mono, Sans tebal, Ceria & kartun, Serif, Tulisan tangan, Fantasi & horor), dimuat hanya saat dipilih. Ada kolom cari dan filter kategori.
- **Font dafont milikmu**: taruh berkas `.ttf/.otf/.woff` di folder `fonts/`, jalankan `node tools/make-fonts-manifest.js`, lalu commit. Font muncul di kategori "Fontmu". Baca `fonts/README.md`. Saya tidak bisa mengunduh dari dafont di sini dan tidak memeriksa lisensinya; banyak font dafont hanya gratis untuk pemakaian pribadi.
- **Tepi membulat di semua tool** (Logo/gambar, Teks 3D, Desain sendiri): slider "Kebulatan tepi" 1 sampai 6 segmen di samping slider bevel. Tepi ekstrusi foto jadi bundar dan halus (normal mulus dengan sudut lipat 50 derajat).
- **Radius sudut pada kubus dan balok** di Modeler, plus pilihan permukaan (halus / tajam) per objek.
- **Target segitiga**: Roblox (20.000, batas merah), Umum (100.000), Tanpa batas (400.000). Di luar Roblox, batas hanya peringatan.

## Catatan jujur tahap 1

- Font Google dimuat dari internet; tanpa koneksi, tool memakai font cadangan.
- Subdivision (Catmull-Clark) dikerjakan bersama Edit Mode di tahap 4.
- Ketebalan dan bulatan tepi menambah segitiga: bevel 4 segmen pada logo Saltoria menaikkan dari sekitar 9 ribu ke 17 ribu.

## Tahap berikutnya

2) siluet seleksi, gizmo Lokal/Global, multi-seleksi dan grup, library 200 objek, pengecek siap-Roblox, kurangi segitiga otomatis. 3) efek teks, relief halus, impor GLB/OBJ, tekstur. 4) Edit Mode. 5) Sculpting, cat tekstur, PBR, panduan.

Di bawah ini catatan v3 (tetap berlaku sampai tahap terkait selesai).

---

# Catatan Update v3: Saltoria 3D Studio

Tema Saltoria (Aurora Crystal, sudut terpotong, logo) tetap jadi identitas. Sekarang ada 3 tema warna: **Aurora** (bawaan), **Kristal Es**, **Senja Ungu**.

## Sudah di-update

**Tab dan sumber bentuk**
- 4 tab: Logo / gambar, Teks 3D, **Desain sendiri** (baru), **Modeler 3D** (Bentuk 3D yang diperluas).
- PNG, JPG, WebP, dan SVG bisa dipakai di Logo / gambar. SVG dirasterisasi dulu oleh browser, lalu diekstrusi.
- **Desain sendiri**: kanvas dengan kuas, penghapus, garis, kotak, elips, segitiga, bintang, hati, segi enam, panah, tanda tambah, pilihan warna, isi/garis tepi, undo. Gambar langsung jadi 3D dengan mesin yang sama.

**Relief (permukaan timbul)**
- Gaya: Rata, Bertingkat terang menonjol, Bertingkat gelap menonjol, Menggembung ke tengah.
- 2 sampai 6 tingkat, tinggi relief 0,1 sampai 3 studs. Berlaku untuk Logo / gambar dan Desain sendiri.
- Batas segitiga dibagi otomatis antara dasar dan lapisan relief.

**Modeler 3D**
- Alat Pilih / Pindah / Putar / Skala (Q W E R) dengan gizmo di pratinjau: panah, cincin, kotak, berwarna per sumbu (X merah, Y hijau, Z biru).
- **Library 66 objek** siap pakai di 9 kategori (Bangunan, Alam, Furnitur, Kendaraan, Hewan, Karakter, Makanan, Teknologi, Fantasi), dengan pencarian dan thumbnail. Tiap objek dirakit dari bentuk dasar, jadi ringan dan warnanya per bagian.
- **Pecah jadi bagian**: objek library bisa dipecah jadi bentuk dasar yang bisa diedit satu per satu.
- **Gandakan (array)**: berderet lurus atau melingkar, sampai 60 salinan.
- Garis kotak seleksi di sekitar objek terpilih; hover pada gizmo.
- Semua daftar bangun ruang dari permintaan awal tetap ada (lengkung, prisma, limas, platonik, Archimedean, dan lainnya).

**Pratinjau dan tampilan**
- Perspektif / Ortho, tampak Depan / Kanan / Atas / Iso, mode Material / Solid / Solid + kerangka.
- Penunjuk sumbu di pojok (klik sumbu untuk pindah arah pandang).
- Layar penuh, palet perintah (**Ctrl/⌘ + K**), pilihan tema.

**Material dan ekspor**
- Preset: Saltoria Kristal, Chrome, Emas, Emas mawar, Neon, Plastik, Matte (untuk semua tab).
- Ekspor: **GLB**, **OBJ + texture**, **STL** (baru), **PNG transparan** (baru), **rekam putar WebM** 4 detik (baru), salin teks OBJ.

## Belum dikerjakan

- **Library 259 objek** seperti referensi: baru 66 (tidak ada jaminan sebanyak itu tanpa membuatnya satu per satu).
- **Garis siluet seleksi mengikuti bentuk**: sekarang berupa kotak pembatas, bukan outline bentuk.
- **Gizmo mengikuti rotasi objek**: gizmo selalu sejajar sumbu dunia. Skala lewat gizmo pada objek yang sudah diputar bisa terasa tidak sejajar.
- **Multi-seleksi dan grup** (selain objek library): belum ada.
- **Relief halus ala heightmap**: relief sekarang berupa lapisan bertumpuk, jadi hasilnya berundak, bukan permukaan mulus.
- **Impor SVG sebagai kurva vektor asli**: SVG tetap dirasterisasi, jadi sudut sangat tajam bergantung pada resolusi "Detail bentuk".

## Tidak bisa / tidak dipaksakan

- **Edit Mode** (titik, sisi, muka, extrude, inset, loop cut): ini inti Blender dan butuh struktur mesh editable (half-edge) serta UI baru. Tidak dipaksakan di versi ini.
- **Boolean (gabung / kurang / irisan bentuk)**: butuh mesin CSG yang andal; hasil asal-asalan akan merusak mesh, jadi tidak dibuat.
- **Animasi keyframe dan GLB beranimasi**: Roblox tidak mengimpor animasi dari GLB, jadi tidak berguna untuk tujuan utama. Sebagai gantinya ada rekam putar WebM.
- **AI** (teks jadi 3D, estimasi kedalaman dari foto): butuh model besar atau API berbayar dengan kunci rahasia dan fungsi server di Vercel. Itu melanggar prinsip "tanpa server, tanpa login", jadi tidak dibuat. Relief bertingkat dari kecerahan adalah pengganti yang berjalan di browser.
- **Normal map / PBR / cahaya neon di Roblox**: GLB yang diimpor Roblox membawa tekstur warna; efek neon di pratinjau tidak ikut. Untuk neon sungguhan, set Material = Neon pada MeshPart. (Pembawaan PBR belum diverifikasi di Studio.)
- **STL**: satuan 1 stud = 1 satuan; atur skala di slicer jika dicetak.

## Cek yang sudah dijalankan

- Uji Node: `tests/test-shapes.js` (semua lulus), `tests/test-core.js` (17), `tests/test-v3.js` (10).
- Uji browser (Chromium): relief 3 gaya + 6 tingkat, unduhan GLB / OBJ / STL / PNG / WebM, tampak atas + ortho, 3 tema, palet perintah, tab Desain sendiri (gambar, relief, hapus), preset, Modeler (library, array, pecah, seret gizmo dengan mouse), tampilan mobile tanpa scroll horizontal, tanpa error konsol.
- **Belum dicoba di Roblox Studio sungguhan**: coba import GLB hasil relief dan dari Modeler, lalu laporkan bila ada yang aneh.

## v5c — Tahap 4: Edit Mode ala Blender

**Sudah**
- Tab (atau tombol "Object Mode / Edit Mode" di bilah menu) masuk/keluar Edit Mode untuk satu objek terpilih.
- Mode Titik / Tepi / Muka; klik, Shift+klik, seleksi kotak, pilih semua / balik / perluas, mode tembus pandang.
- Operasi: extrude, inset (juga per muka), bevel (dengan segmen), loop cut + slide, subdivide, subdivisi halus Catmull-Clark, gabung titik (tengah/dst), gabung berdasarkan jarak, hapus, lebur (dissolve), isi (fill), balik arah, hitung ulang normal, cermin (sumbu X/Y/Z), segitigakan, pusatkan.
- Gizmo pindah/putar/skala pada seleksi, snap mengikuti pengaturan Maker.
- Undo/redo khusus sesi edit (40 langkah). Ctrl+Z di Edit Mode tidak menyentuh riwayat objek.
- Keluar → objek menjadi mesh, tersimpan di proyek, ikut ekspor, bisa di-undo ke bentuk parametrik.
- Uji: unit poligon, fuzz 1500 operasi (0 gagal), uji browser (masuk, extrude, undo, keluar, muat ulang, edit ulang).

**Masih terbatas**
- Batas 150.000 segitiga di Edit Mode.
- Shading halus per-muka (smooth/flat per muka) belum; shading mengikuti pengaturan objek.
- Warna per muka dipertahankan, tapi tidak ada alat cat warna di Edit Mode (rencana tahap 5).

**Tidak bisa**
- Parameter bentuk (mis. jumlah sisi bola) tidak bisa diubah lagi setelah keluar dari Edit Mode, karena objek sudah menjadi mesh.
- Boolean antar objek, rigging, dan AI tetap tidak ada.

## v6a — Tahap 5 (bagian 1): Sculpt Mode + Web Worker

**Sudah**
- Sculpt Mode: Shift+Tab atau tombol "Sculpt" di bilah menu (objek terpilih, tidak terkunci).
- Kuas: Tarik, Haluskan, Gembung, Ratakan, Cubit, Geser, Cat warna. Ctrl+seret membalik arah. Simetri sumbu X. Ukuran dan kekuatan kuas.
- Tambah detail (membagi tepi panjang), Turunkan detail (QEM, warna ikut), Haluskan semua. Berjalan di Web Worker; bila Worker tidak tersedia otomatis jalan di thread utama.
- Cat warna per titik langsung di model; undo/redo per goresan dan per operasi remesh.
- Keluar → objek menjadi mesh, ikut ekspor, tersimpan, bisa di-undo ke bentuk semula.
- Uji: tes operasi mesh (Node) dan tes browser (kuas, cat, remesh, worker, commit, muat ulang).

**Masih terbatas**
- Saat Sculpt, hanya objek yang dipahat yang tampil (objek lain kembali saat keluar).
- Warna cat dibulatkan ke maksimal 24 warna per objek saat keluar. Gradasi halus butuh cat tekstur (v6b).
- Tidak ada dynamic topology saat menyapu kuas; tambahkan detail lewat tombol "Tambah detail".
- Batas 400.000 segitiga di Sculpt.

## v6b — Tahap 5 (bagian 2): Cat tekstur di model + Editor UV

**Sudah**
- Shift+P atau tombol "Cat": unwrap otomatis (chart berdasar sudut, bisa diatur), lalu cat langsung di permukaan model ke kanvas tekstur 256–2048 px.
- Alat: Kuas (ukuran, kekuatan, kekerasan tepi), Hapus (kembali ke warna dasar), Pipet (Alt+klik), Isi seluruh tekstur. Warna per-segitiga yang sudah ada ikut dibake ke tekstur.
- Editor UV: pratinjau tata letak, pilih chart, geser (seret), putar 90°, cermin, perbesar/perkecil, susun ulang, unwrap ulang (sudut/ukuran). Isi cat ikut berpindah saat UV diubah.
- Papan catur uji untuk melihat distorsi UV. Undo/redo.
- Hasil masuk atlas sehingga ikut ekspor GLB/OBJ+tekstur, tersimpan di proyek (PNG di dalam berkas proyek) dan pulih saat dimuat ulang.
- Uji: tes UV (Node: tumpang tindih, balik arah, remap) dan tes browser end-to-end.

**Masih terbatas**
- Mengedit/memahat mesh berUV membuang cat tekstur (UV hilang); lakukan cat sebagai langkah terakhir.
- Tidak ada simetri saat cat, dan tidak ada proyeksi gambar ke model.
- Maksimal 4 objek bercat sekaligus di atlas; tekstur diperkecil otomatis agar atlas ≤ 4096 px.
- Simpan otomatis di browser bisa gagal bila tekstur besar (batas penyimpanan browser); simpan proyek ke berkas untuk aman.
- Peta PBR dari cat tekstur belum ada.

## v6c — Tahap 5 (bagian 3): Modifier, Boolean, Lathe & Sweep

**Sudah**
- Modifier non-destruktif per objek (Inspector → "Modifier"): Cermin (sumbu lokal), Gandakan/Array (jumlah + jarak), Solidify (ketebalan), Subdivisi halus (Catmull-Clark 1–3). Bisa ditumpuk (maks 6), diaktif/nonaktif, diurutkan, dihapus, dan diubah kapan saja; ikut undo dan tersimpan di proyek.
- Edit → "Terapkan modifier (jadi mesh)" untuk menjadikannya mesh permanen (bisa diedit/dipahat).
- Boolean (Edit menu, pilih 2 objek): Gabung, Kurangi (pertama − kedua), Irisan. Warna objek terbawa. Hasil berupa satu mesh baru.
- Lab Bentuk (Edit → "Lathe & Sweep…"): Lathe dari profil gambaran sendiri (vas, botol, gelas, gasing, pion sebagai contoh) dan Sweep penampang sepanjang jalur (lurus, busur, cincin, spiral, simpul, atau gambar sendiri; opsi mengecil ke ujung).
- Uji: Node (CSG volume union/kurangi/irisan, lathe/sweep tertutup rapat, modifier) dan tes browser (inspector, undo, muat ulang, boolean, lab).

**Masih terbatas**
- Boolean membutuhkan mesh tertutup dan maksimal 24.000 segitiga gabungan; mesh bocor atau yang saling memotong dirinya sendiri bisa menghasilkan lubang. Hasilnya permanen (bukan modifier yang bisa diubah lagi).
- Hasil Lathe/Sweep adalah mesh biasa, bukan bentuk parametrik yang bisa diubah lagi.
- Modifier tidak tersedia untuk mesh yang sudah dicat tekstur (UV).
- Solidify tidak menutup tepi pada permukaan terbuka (hanya cangkang dalam).

## v6d — Tahap 5 selesai (versi final)

**Sudah ada**
- Pintasan modal gaya Blender: **G** geser, **R** putar, **S** skala. Tekan X/Y/Z untuk kunci sumbu (tekan lagi = sumbu lokal), ketik angka untuk nilai pasti, klik atau Enter untuk terima, Esc atau klik kanan untuk batal. Snap grid mengikuti pengaturan Snap; **Ctrl** saat geser menempel ke titik objek lain (±16 px). Satu langkah undo per transformasi.
- Alat skala pindah ke **T** (sebelumnya R). Q pilih, W geser, E putar, T skala.
- **Ukur jarak** (tombol M atau menu Tampilan): klik 2 titik di permukaan; tampil jarak total dan ΔX/ΔY/ΔZ dalam satuan scene.
- Menu **Tampilan**: 6 preset cahaya (Studio, Siang, Senja, Neon, Kontras, Datar; hanya pratinjau, tidak ikut ekspor) dan **render PNG** 1×/2×/4× dengan latar transparan.
- **Panduan singkat** 7 langkah, muncul sekali untuk pengguna baru, bisa dibuka lagi dari menu Tampilan.
- Tes: tests/ (Node) dan tests-browser/ (Playwright) lulus semua.

**Terbatas**
- Snap titik hanya ke titik objek lain, bukan ke tepi atau tengah muka.
- Render 4× memakai resolusi layar × 4; layar kecil + GPU lemah bisa gagal pada ukuran sangat besar.
- Preset cahaya tidak tersimpan di proyek.

**Tidak bisa (tanpa server/AI)**
- Rigging dan animasi tulang, simulasi fisika, ray-tracing, generator AI.
- Kepastian tampilan PBR GLB di Roblox belum diverifikasi.
- Font Google butuh internet.
