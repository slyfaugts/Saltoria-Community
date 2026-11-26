/* ═══════════════════════════════════════════════════════════════════════
   DATA TIM & PARTNER — edit file ini untuk mengubah bagian Team, Partner,
   dan strip "Partner" di hero. Dirender otomatis oleh js/home-render.js.

   PENTING: file ini publik (bisa dibaca siapa pun lewat "view source").
   Jangan isi nama asli, User ID, atau data pribadi lain di sini.

   ── STAFF ──────────────────────────────────────────────────────────────
   name      : nama tampilan        username : username Roblox/Discord (tanpa @)
   alias     : (opsional) nama lain role     : jabatan
   photo     : path foto. Taruh file di assets/staff/ (persegi, ≥200px, JPG/PNG)
               Kalau file belum ada, otomatis tampil inisial.
   initials  : 2 huruf untuk avatar cadangan   owner:true → garis emas

   ── PARTNER ────────────────────────────────────────────────────────────
   name / fullName / status : tampil di kartu
   logo    : path logo di assets/partners/ (PNG transparan, persegi ±256px)
   roblox / discord : (opsional) URL; tombol hanya muncul bila diisi
   ═══════════════════════════════════════════════════════════════════════ */
window.COMMUNITY = {
  staff: [
    { group: 'Owner / Founder', members: [
      { name: 'Ahmad', username: 'amad23augts', alias: 'slyfaugts', role: 'Owner / Founder', photo: 'assets/staff/ahmadsaltoria.jpg', initials: 'AS', owner: true },
    ]},
    { group: 'Developer Team', members: [
      { name: 'Dim', username: 'mrwidiw1', role: 'Developer', photo: 'assets/staff/dim.jpg', initials: 'DI' },
    ]},
  ],

  partners: [
    { name: 'UAM',        fullName: 'Ujung Adalah Maut', status: 'Official Partnership', logo: 'assets/partners/uam.png',        roblox: '', discord: '' },
    { name: 'AREA BEBAS', fullName: 'AREA BEBAS',        status: 'Official Partnership', logo: 'assets/partners/area-bebas.png', roblox: '', discord: '' },
  ],
};
