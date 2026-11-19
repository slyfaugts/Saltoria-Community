/*
 * Saltoria 3D Studio — katalog font untuk Teks 3D.
 * - Font Google (lisensi terbuka) dimuat saat dipilih saja, bukan semuanya sekaligus.
 * - Font milik sendiri (mis. dari dafont.com) ditaruh di folder fonts/ dan didaftarkan di fonts/fonts.json
 *   (jalankan `node tools/make-fonts-manifest.js`). Lisensi tiap font tanggung jawab pemilik berkas.
 */
(function (root) {
  'use strict';
  // Folder aset studio relatif terhadap halaman (diset halaman tool; kosong saat mandiri atau di Node).
  const BASE = (typeof window !== 'undefined' && window.SALTORIA_STUDIO_BASE) || '';

  // [nama, kategori, bobot]
  const G = [
    ['Audiowide', 'Gim & futuristik', 400], ['Orbitron', 'Gim & futuristik', 800], ['Russo One', 'Gim & futuristik', 400],
    ['Chakra Petch', 'Gim & futuristik', 700], ['Exo 2', 'Gim & futuristik', 800], ['Rajdhani', 'Gim & futuristik', 700],
    ['Oxanium', 'Gim & futuristik', 800], ['Michroma', 'Gim & futuristik', 400], ['Syncopate', 'Gim & futuristik', 700],
    ['Quantico', 'Gim & futuristik', 700], ['Saira Stencil One', 'Gim & futuristik', 400], ['Stardos Stencil', 'Gim & futuristik', 700],
    ['Black Ops One', 'Gim & futuristik', 400], ['Bungee', 'Gim & futuristik', 400], ['Bungee Shade', 'Gim & futuristik', 400],
    ['Faster One', 'Gim & futuristik', 400], ['Monoton', 'Gim & futuristik', 400], ['Teko', 'Gim & futuristik', 700],
    ['Press Start 2P', 'Piksel & mono', 400], ['Silkscreen', 'Piksel & mono', 400], ['VT323', 'Piksel & mono', 400],
    ['Share Tech Mono', 'Piksel & mono', 400], ['Major Mono Display', 'Piksel & mono', 400], ['Special Elite', 'Piksel & mono', 400],
    ['Poppins', 'Sans tebal', 800], ['Montserrat', 'Sans tebal', 800], ['Inter', 'Sans tebal', 800], ['Rubik', 'Sans tebal', 800],
    ['Anton', 'Sans tebal', 400], ['Oswald', 'Sans tebal', 700], ['Archivo Black', 'Sans tebal', 400], ['Barlow Condensed', 'Sans tebal', 700],
    ['Kanit', 'Sans tebal', 800], ['Sora', 'Sans tebal', 700], ['Bebas Neue', 'Sans tebal', 400], ['Passion One', 'Sans tebal', 700],
    ['Righteous', 'Sans tebal', 400], ['Rubik Mono One', 'Sans tebal', 400],
    ['Lilita One', 'Ceria & kartun', 400], ['Luckiest Guy', 'Ceria & kartun', 400], ['Bangers', 'Ceria & kartun', 400],
    ['Chewy', 'Ceria & kartun', 400], ['Fredoka', 'Ceria & kartun', 700], ['Titan One', 'Ceria & kartun', 400],
    ['Paytone One', 'Ceria & kartun', 400], ['Fascinate', 'Ceria & kartun', 400], ['Frijole', 'Ceria & kartun', 400],
    ['Fontdiner Swanky', 'Ceria & kartun', 400],
    ['Playfair Display', 'Serif', 800], ['Cinzel', 'Serif', 700], ['Abril Fatface', 'Serif', 400], ['DM Serif Display', 'Serif', 400],
    ['Bevan', 'Serif', 400], ['Alfa Slab One', 'Serif', 400], ['Cormorant Garamond', 'Serif', 700], ['Marcellus', 'Serif', 400],
    ['Squada One', 'Serif', 400],
    ['Pacifico', 'Tulisan tangan', 400], ['Lobster', 'Tulisan tangan', 400], ['Dancing Script', 'Tulisan tangan', 700],
    ['Permanent Marker', 'Tulisan tangan', 400], ['Caveat', 'Tulisan tangan', 700], ['Satisfy', 'Tulisan tangan', 400],
    ['Great Vibes', 'Tulisan tangan', 400], ['Kaushan Script', 'Tulisan tangan', 400], ['Sacramento', 'Tulisan tangan', 400],
    ['Shadows Into Light', 'Tulisan tangan', 400], ['Amatic SC', 'Tulisan tangan', 700],
    ['Creepster', 'Fantasi & horor', 400], ['Metal Mania', 'Fantasi & horor', 400], ['Nosifer', 'Fantasi & horor', 400],
    ['Eater', 'Fantasi & horor', 400], ['Cinzel Decorative', 'Fantasi & horor', 700], ['MedievalSharp', 'Fantasi & horor', 400],
    ['UnifrakturCook', 'Fantasi & horor', 700], ['Pirata One', 'Fantasi & horor', 400], ['New Rocker', 'Fantasi & horor', 400],
    ['Uncial Antiqua', 'Fantasi & horor', 400], ['Almendra', 'Fantasi & horor', 700], ['Jolly Lodger', 'Fantasi & horor', 400],
    ['Rye', 'Fantasi & horor', 400],
  ];

  const list = G.map(([family, cat, weight]) => ({ label: family, family, weight, cat, src: 'google' }));
  const cats = [];
  const loaded = new Map();

  function refreshCats() {
    cats.length = 0;
    for (const f of list) if (cats.indexOf(f.cat) < 0) cats.push(f.cat);
  }
  refreshCats();

  // Muat font (Google atau lokal). Selalu aman dipanggil berulang; gagal = pakai font cadangan.
  function load(def) {
    if (!def) return Promise.resolve();
    if (def.src === 'upload') return Promise.resolve();
    const key = def.family + '@' + def.weight;
    if (loaded.has(key)) return loaded.get(key);
    let p;
    if (def.src === 'local') {
      const face = new FontFace(def.family, `url("${encodeURI(def.file)}")`, { weight: String(def.weight || 400) });
      p = face.load().then((f) => { document.fonts.add(f); }).catch(() => { /* berkas hilang: font cadangan */ });
    } else {
      const url = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(def.family).replace(/%20/g, '+') + ':wght@' + def.weight + '&display=swap';
      p = new Promise((resolve) => {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = url;
        l.onload = () => resolve(); l.onerror = () => resolve();
        document.head.appendChild(l);
        setTimeout(resolve, 4000);
      });
    }
    p = p.then(() => (document.fonts ? document.fonts.load(`${def.weight || 400} 100px "${def.family}"`, 'AaBb') : null)).catch(() => {});
    loaded.set(key, p);
    return p;
  }

  // Baca fonts/fonts.json: [{ "label": "Nama", "file": "fonts/Nama.ttf", "weight": 400, "cat": "Opsional" }]
  async function loadManifest(url) {
    try {
      const res = await fetch(url || BASE + 'fonts/fonts.json', { cache: 'no-cache' });
      if (!res.ok) return 0;
      const data = await res.json();
      if (!Array.isArray(data)) return 0;
      let n = 0;
      for (const it of data) {
        if (!it || typeof it.file !== 'string' || typeof it.label !== 'string') continue;
        if (!/\.(ttf|otf|woff2?)$/i.test(it.file)) continue;
        list.push({ label: it.label.slice(0, 60), family: 'Fontmu ' + it.label.slice(0, 60), weight: +it.weight || 400, cat: String(it.cat || 'Fontmu (folder fonts/)').slice(0, 40), src: 'local', file: BASE + (it.file.indexOf('/') < 0 ? 'fonts/' + it.file : it.file) });
        n++;
      }
      refreshCats();
      return n;
    } catch (e) { return 0; }
  }

  root.S3DFonts = { list, cats, load, loadManifest, find: (family) => list.find((f) => f.family === family) };
})(typeof self !== 'undefined' ? self : this);
