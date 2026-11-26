/* ═══════════════════════════════════════════════════════════════════════
   DATA STORE — edit file ini saja untuk mengubah isi Store di index.html.
   Tampilan dirender otomatis oleh js/home-render.js.

   ── CARA UBAH HARGA ────────────────────────────────────────────────────
   price          : harga jual dalam Rupiah, angka tanpa titik. Contoh: 450000
                    Kosongkan dengan null → tampil "Cek Discord".
   originalPrice  : harga normal/coret. Isi HANYA kalau ada potongan harga.
                    Jika originalPrice > price → tampil harga coret + badge "-xx%".
   promoUntil     : (opsional) tanggal akhir promo, format 'YYYY-MM-DD'.
                    Setelah lewat, otomatis kembali tampil harga normal (originalPrice).
   Contoh promo   : price:350000, originalPrice:450000, promoUntil:'2026-12-31'
   Catatan        : originalPrice sebaiknya harga normal yang benar-benar berlaku,
                    supaya potongan harga tidak menyesatkan pembeli.

   ── CARA TAMBAH PRODUK ─────────────────────────────────────────────────
   Salin satu baris produk di bawah, ganti id (unik, huruf kecil + strip),
   cat (id kategori), name, dan harga. Gambar otomatis dicari di
   assets/store/<id>.jpg — taruh file dengan nama itu (rasio ±16:10, ≤300 KB).
   Gambar bisa juga diarahkan manual: image:'assets/store/nama-lain.jpg'

   Field opsional  : addon:'teks'   → label "+ Add On: teks"
                     variants:[...] → pilihan varian (tiap varian bisa punya harga sendiri)
                     badge:'NEW'    → pita kecil di pojok kartu
                     premium:true   → garis emas di atas kartu
                     cta:'TEKS'     → teks tombol (default "ORDER VIA DISCORD")

   ── CARA TAMBAH / UBAH KATEGORI ────────────────────────────────────────
   Edit array categories di bawah. Urutan array = urutan tampil.
   icon memakai nama ikon Material Symbols (fonts.google.com/icons).
   ═══════════════════════════════════════════════════════════════════════ */
window.STORE = {
  discord: 'https://discord.gg/VRQFamarnW',
  perCategory: 8,   // jumlah kartu yang tampil dulu per kategori (sisanya lewat tombol "Tampilkan semua")

  categories: [
    { id:"aio", group:"", title:"All In One Roblox System", short:"All In One", desc:"Paket sistem lengkap, siap pakai dalam satu kit.", icon:"deployed_code" },
    { id:"mini", group:"StandAlone Roblox System", title:"Mini Games System", short:"Mini Games", desc:"Mini game satuan yang bisa dipasang terpisah.", icon:"sports_esports" },
    { id:"music", group:"StandAlone Roblox System", title:"Music System", short:"Music", desc:"Sistem musik, DJ, dan rhythm.", icon:"headphones" },
    { id:"npc", group:"StandAlone Roblox System", title:"NPC & Avatar System", short:"NPC & Avatar", desc:"NPC, loader avatar, dan aksesoris.", icon:"smart_toy" },
    { id:"rental", group:"StandAlone Roblox System", title:"Rental & Vehicle System", short:"Rental", desc:"Sistem sewa kendaraan.", icon:"two_wheeler" },
    { id:"util", group:"StandAlone Roblox System", title:"Economy & Utility System", short:"Utility", desc:"Ekonomi, absen, loading screen, donasi, dan lainnya.", icon:"tune" },
    { id:"service", group:"", title:"Jasa Developer", short:"Jasa", desc:"Jasa custom pengembangan dan pembuatan map.", icon:"construction" },
  ],

  products: [
    { id:"summit-gen-1", cat:"aio", name:"Summit Kit Gen 1", addon:"Plugin Set Up", price:null, originalPrice:null, premium:true },
    { id:"summit-gen-2", cat:"aio", name:"Summit Kit Gen 2", addon:"Plugin Set Up", price:null, originalPrice:null, image:"assets/store/premium-summit-kit.jpg", premium:true },
    { id:"summit-gen-3", cat:"aio", name:"Summit Kit Gen 3", addon:"Plugin Set Up", price:null, originalPrice:null, premium:true },
    { id:"relapse-kit", cat:"aio", name:"Relapse Kit", price:null, originalPrice:null },
    { id:"hangout-kit", cat:"aio", name:"Hangout Kit", price:null, originalPrice:null },
    { id:"hangout-kit-pro", cat:"aio", name:"Hangout Kit Pro", price:null, originalPrice:null, premium:true },
    { id:"clubkit", cat:"aio", name:"ClubKit", price:450000, originalPrice:null, image:"assets/store/clubkit.jpg" },
    { id:"arcade-machine-15", cat:"mini", name:"Arcade Machine 15", price:null, originalPrice:null },
    { id:"monopoli", cat:"mini", name:"Monopoli", price:null, originalPrice:null },
    { id:"air-hokey", cat:"mini", name:"Air Hokey", price:null, originalPrice:null },
    { id:"checkers", cat:"mini", name:"Checkers", price:null, originalPrice:null },
    { id:"poison-drink", cat:"mini", name:"Poison Drink", price:null, originalPrice:null },
    { id:"slot-machine-3", cat:"mini", name:"Slot Machine 3", price:null, originalPrice:null },
    { id:"tebak-gambar", cat:"mini", name:"Tebak Gambar", price:null, originalPrice:null },
    { id:"ular-tangga", cat:"mini", name:"Ular Tangga", price:null, originalPrice:null },
    { id:"jail-flashlight", cat:"mini", name:"Jail Flashlight", price:null, originalPrice:null },
    { id:"polisi-maling", cat:"mini", name:"Polisi Maling", price:null, originalPrice:null },
    { id:"dart", cat:"mini", name:"Dart", price:null, originalPrice:null },
    { id:"card-casino", cat:"mini", name:"Card Casino", price:null, originalPrice:null },
    { id:"ludo", cat:"mini", name:"Ludo", price:null, originalPrice:null },
    { id:"gobak-sodor", cat:"mini", name:"Gobak Sodor", price:null, originalPrice:null },
    { id:"congklak", cat:"mini", name:"Congklak", price:null, originalPrice:null },
    { id:"bowling", cat:"mini", name:"Bowling", price:null, originalPrice:null },
    { id:"tap-tap-battle", cat:"mini", name:"Tap Tap Battle", price:null, originalPrice:null },
    { id:"blok-game-board", cat:"mini", name:"Blok Game Board", price:null, originalPrice:null },
    { id:"boombox-pro", cat:"music", name:"Boombox Pro", price:null, originalPrice:null },
    { id:"spotify-tablet", cat:"music", name:"Spotify Tablet", price:null, originalPrice:null },
    { id:"dual-deck", cat:"music", name:"Dual Deck", addon:"Connector DDJ-FLX4", price:null, originalPrice:null },
    { id:"rythm-game", cat:"music", name:"Rythm Game", price:null, originalPrice:null },
    { id:"npc-ojek-system", cat:"npc", name:"NPC Ojek System", price:150000, originalPrice:null },
    { id:"npc-ava-loader", cat:"npc", name:"NPC/Ava Loader", price:null, originalPrice:null },
    { id:"seraph-wings", cat:"npc", name:"Seraph Wings", price:null, originalPrice:null },
    { id:"sewa-sepeda", cat:"rental", name:"Sewa Sepeda", price:null, originalPrice:null },
    { id:"sewa-motor", cat:"rental", name:"Sewa Motor", price:null, originalPrice:null },
    { id:"currency-rupiah-system", cat:"util", name:"Currency Rupiah System", price:null, originalPrice:null },
    { id:"absen-streak-system", cat:"util", name:"Absen/Streak System", price:null, originalPrice:null },
    { id:"loading-screen", cat:"util", name:"Loading Screen", price:null, originalPrice:null },
    { id:"kursi-kumpul", cat:"util", name:"Kursi Kumpul", price:null, originalPrice:null },
    { id:"donation-pack", cat:"util", name:"Donation Pack", price:null, originalPrice:null, variants:[{name:"No Effect", price:null, originalPrice:null}, {name:"Effect Indoor", price:null, originalPrice:null}, {name:"Effect Outdoor", price:null, originalPrice:null}] },
    { id:"jasa-developer", cat:"service", name:"Developer & Map Builder (Pricelist)", price:null, originalPrice:null, cta:"CEK DISCORD" },
  ]
};
