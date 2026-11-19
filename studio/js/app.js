/* Saltoria 3D Studio — antarmuka. Menyambungkan core.js (mesin) dan viewer.js (pratinjau). */
(function () {
  'use strict';
  // Folder aset studio relatif terhadap halaman. Diset halaman tool (tools/3d-studio.html); kosong saat dibuka mandiri.
  const BASE = window.SALTORIA_STUDIO_BASE || '';
  const S = window.S3D;
  const $ = (id) => document.getElementById(id);
  let TRI_LIMIT = 20000, TARGET = 'roblox';
  const TARGETS = { roblox: { limit: 20000, max: 20000, step: 500, def: 18000, label: 'Roblox' }, umum: { limit: 100000, max: 100000, step: 1000, def: 60000, label: 'target umum' }, bebas: { limit: 400000, max: 400000, step: 5000, def: 200000, label: 'batas aman peramban' } };
  const triFmt = (n) => n.toLocaleString('id-ID');
  // Peringatan batas segitiga: merah hanya untuk target Roblox; target lain hanya informasi.
  function limitNote(what, n, advice) {
    if (n <= TRI_LIMIT) return null;
    if (TARGET === 'roblox') return { err: true, msg: `${what} punya ${triFmt(n)} segitiga, melewati batas ${triFmt(TRI_LIMIT)} milik Roblox. ${advice}` };
    return { msg: `${what} punya ${triFmt(n)} segitiga, di atas target ${triFmt(TRI_LIMIT)}. Ini hanya peringatan; model tetap bisa diekspor.` };
  }

  const FONTS = window.S3DFonts.list;

  const P = {
    sens: 18, fill: 0, specks: 20, detailLogo: 1024, invert: false,
    text: 'SALTORIA', font: 'Chakra Petch', align: 'center', spacing: 0, lineGap: 110, boldText: 0, detailText: 640,
    colorMode: 'original', colorA: '#9fc4ff', colorB: '#a98bff', gradAngle: 90, metal: 0, rough: 0.7,
    sideOn: false, sideColor: '#2a3566',
    width: 12, thick: 0.3, smooth: 2, bevel: 0, maxTri: 18000, flip: false,
    bevelSeg: 1, relief: 'flat', levels: 4, reliefH: 0.8, glow: 0,
    texImgId: 0, texPat: 'marble', texScale: 1, reliefQ: 140, reliefBlur: 2, curve: 0, fx: 'none', fxSize: 8, fxThick: 60, fxColor: '#f2c14e',
  };
  let tab = 'logo';
  const srcLogo = { id: 0, img: null, natW: 0, natH: 0, name: '' };
  const srcDraw = { id: 0, img: null, natW: 720, natH: 720, name: 'desain' };
  let src = srcLogo;
  let draw = null;
  const isImg = () => tab === 'logo' || tab === 'draw';
  let viewer = null;
  const cache = { raster: null, layerKey: '', layers: null, layerN: 0, shapeKey: '', shapes: null, texKey: '', tex: null, meshKey: '', mesh: null, rasterInfo: null };
  let seq = 0;
  let timer = 0;
  let current = null; // hasil terakhir yang valid
  const customFonts = [];
  let maker = null;

  /* ---------------- util ---------------- */
  const fmt = {
    sens: (v) => v, fill: (v) => v + ' px²', specks: (v) => v + ' px²', detailLogo: (v) => v + ' px',
    spacing: (v) => v, lineGap: (v) => v + '%', boldText: (v) => v, detailText: (v) => v + ' px',
    gradAngle: (v) => v + '°', glow: (v) => (+v).toFixed(2), levels: (v) => v, reliefH: (v) => (+v).toFixed(2), metal: (v) => (+v).toFixed(2), rough: (v) => (+v).toFixed(2),
    width: (v) => (+v).toFixed(1), thick: (v) => (+v).toFixed(2), smooth: (v) => v,
    bevel: (v) => Math.round(v * 100) + '%', bevelSeg: (v) => (+v === 1 ? 'miring' : v + ' segmen'), maxTri: (v) => (+v).toLocaleString('id-ID'),
  };

  function setNotice(items) {
    const box = $('notice');
    box.textContent = '';
    for (const it of items) {
      const p = document.createElement('p');
      if (it.err) p.className = 'err';
      p.textContent = it.msg;
      box.appendChild(p);
    }
  }
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const setBusy = (v) => { $('busy').hidden = !v; };
  function dockMsg(t) {
    const el = $('dock-msg');
    el.textContent = t || '';
    clearTimeout(dockMsg.t);
    if (t) dockMsg.t = setTimeout(() => { el.textContent = ''; }, 4500);
  }
  function hexToRgb(h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h);
    const n = parseInt(m ? m[1] : '9fc4ff', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const newCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  /* ---------------- sumber: logo ---------------- */
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Gambar tidak bisa dibaca. Gunakan PNG, JPG, WebP, atau SVG.'));
      img.src = url;
    });
  }

  async function setLogoFromUrl(url, name, revoke) {
    const img = await loadImage(url);
    if (revoke) URL.revokeObjectURL(url);
    srcLogo.img = img;
    srcLogo.natW = img.naturalWidth || 1024;
    srcLogo.natH = img.naturalHeight || 1024;
    srcLogo.name = name;
    srcLogo.id++;
    $('file-name').textContent = name;
  }

  async function setLogoFromFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp|svg)$/i.test(file.name || '')) {
      setNotice([{ err: true, msg: 'Berkas ini bukan gambar. Pilih PNG, JPG, WebP, atau SVG.' }]);
      return;
    }
    try {
      await setLogoFromUrl(URL.createObjectURL(file), file.name || 'Gambar dari clipboard', true);
      setTab('logo', true);
      schedule(0);
    } catch (e) { setNotice([{ err: true, msg: e.message }]); }
  }

  function rasterLogo() {
    const target = P.detailLogo;
    let k = target / Math.max(src.natW, src.natH);
    k = Math.min(k, 2 * 1); // jangan memperbesar lebih dari 2x ukuran asli
    k = Math.min(k, target / Math.max(src.natW, src.natH));
    const w = Math.max(16, Math.round(src.natW * k)), h = Math.max(16, Math.round(src.natH * k));
    const c = newCanvas(w, h);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src.img, 0, 0, w, h);
    return { w, h, data: ctx.getImageData(0, 0, w, h).data };
  }

  /* ---------------- sumber: teks ---------------- */
  function currentFontDef() {
    const custom = customFonts.find((f) => f.family === P.font);
    if (custom) return custom;
    return FONTS.find((f) => f.family === P.font) || FONTS[0];
  }

  async function ensureFont(def) {
    try {
      await Promise.race([
        window.S3DFonts.load(def).then(() => document.fonts.load(`${def.weight} 100px "${def.family}"`, P.text || 'A')),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
    } catch (e) { /* pakai font cadangan */ }
  }

  // variant: undefined = teks utama; 'plate' | 'shadow' | 'ring' = bentuk efek (kerangka kanvas sama persis dengan teks utama).
  function rasterText(variant) {
    const def = currentFontDef();
    const lines = P.text.replace(/\r/g, '').split('\n').slice(0, 8);
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length || !lines.some((l) => l.trim())) return null;

    const base = 200;
    const fam = `"${def.family}", "Chakra Petch", system-ui, sans-serif`;
    const probe = newCanvas(8, 8).getContext('2d');
    probe.font = `${def.weight} ${base}px ${fam}`;
    const track = (P.spacing / 100) * base;
    const stroke = (P.boldText / 300) * base;
    const fxOn = P.fx !== 'none';
    const fxm = fxOn ? (P.fxSize / 100) * base : 0;           // jarak efek
    const widthOf = (str) => {
      if (!track) return probe.measureText(str).width;
      let w = 0;
      for (const ch of Array.from(str)) w += probe.measureText(ch).width + track;
      return w - track;
    };
    const widths = lines.map(widthOf);
    const lh = (base * P.lineGap) / 100;
    // lengkung: sudut total per baris, jari-jari dari lebar baris
    const curve = P.curve / 100;
    const theta = Math.abs(curve) * Math.PI * 0.9;
    const arcOf = (lw) => (theta > 0.01 ? { R: lw / theta, sag: (lw / theta) * (1 - Math.cos(theta / 2)) } : null);
    const sagMax = theta > 0.01 ? Math.max(...widths.map((w) => arcOf(w).sag)) : 0;
    const arcW = theta > 0.01 ? Math.max(...widths.map((w) => { const R = arcOf(w).R; return 2 * R * Math.sin(Math.min(theta / 2, Math.PI / 2)) + base * 0.5; })) : 0;
    const pad = base * 0.25 + stroke + fxm * 1.3;
    const W = Math.max(Math.max(...widths), arcW) + pad * 2;
    const H = (lines.length - 1) * lh + base * 1.1 + pad * 2 + sagMax + (theta > 0.01 ? base * 0.25 : 0);
    const k = Math.max(0.2, Math.min(P.detailText / Math.max(W, H), 2048 / Math.max(W, H)));
    const w = Math.max(16, Math.ceil(W * k)), h = Math.max(16, Math.ceil(H * k));
    const c = newCanvas(w, h);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.scale(k, k);
    ctx.font = `${def.weight} ${base}px ${fam}`;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';

    // satu lintasan gambar: grow = tebal tambahan (dalam satuan font), dx/dy = geser, mode = 'source-over' | 'destination-out'
    const pass = (grow, dx, dy, mode) => {
      ctx.globalCompositeOperation = mode;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
      ctx.lineJoin = grow > 0 ? 'round' : 'miter'; ctx.miterLimit = 3;
      ctx.lineWidth = (stroke + grow) * 2;
      const lw2 = ctx.lineWidth;
      const put = (str, xx, yy, rot) => {
        ctx.save(); ctx.translate(xx + dx, yy + dy); if (rot) ctx.rotate(rot);
        if (lw2 > 0) ctx.strokeText(str, 0, 0); ctx.fillText(str, 0, 0); ctx.restore();
      };
      lines.forEach((line, i) => {
        const lw = widths[i];
        const y0 = pad + base * 0.88 + i * lh + (curve < 0 ? sagMax : 0);
        let x = pad;
        if (P.align === 'center') x = (W - lw) / 2;
        else if (P.align === 'right') x = W - pad - lw;
        const arc = arcOf(lw);
        if (!arc) {
          if (!track) put(line, x, y0, 0);
          else { let cx = x; for (const ch of Array.from(line)) { put(ch, cx, y0, 0); cx += probe.measureText(ch).width + track; } }
          return;
        }
        // teks di sepanjang busur: tiap huruf diputar mengikuti kelengkungan
        const mid = x + lw / 2, up = curve > 0;
        let s = 0;
        for (const ch of Array.from(line)) {
          const cw = probe.measureText(ch).width;
          const d = s + cw / 2 - lw / 2, phi = d / arc.R;
          const px = mid + arc.R * Math.sin(phi) - cw / 2 * Math.cos(phi);
          const dy2 = arc.R * (1 - Math.cos(phi));
          const py = up ? y0 + dy2 - 0 : y0 - dy2;
          const rot = up ? phi : -phi;
          ctx.save(); ctx.translate(px + dx, py + dy); ctx.rotate(rot);
          ctx.translate(cw / 2 - cw / 2 * Math.cos(phi) * 0, 0);
          ctx.restore();
          // tempatkan huruf: pusat huruf di titik busur, lalu geser setengah lebar ke kiri dalam sistem putar
          ctx.save();
          ctx.translate(mid + arc.R * Math.sin(phi) + dx, py + dy);
          ctx.rotate(rot);
          if (lw2 > 0) ctx.strokeText(ch, -cw / 2, 0);
          ctx.fillText(ch, -cw / 2, 0);
          ctx.restore();
          s += cw + track;
        }
      });
      ctx.globalCompositeOperation = 'source-over';
    };

    if (variant === 'plate') pass(fxm, 0, 0, 'source-over');
    else if (variant === 'shadow') pass(0, fxm * 0.7, fxm * 0.7, 'source-over');
    else if (variant === 'ring') { pass(fxm, 0, 0, 'source-over'); pass(fxm * 0.45, 0, 0, 'destination-out'); }
    else pass(0, 0, 0, 'source-over');
    return { w, h, data: ctx.getImageData(0, 0, w, h).data };
  }

  /* ---------------- tekstur ---------------- */
  function effectiveMode() {
    if (tab === 'text' && P.colorMode === 'original') return 'gradient';
    if (P.colorMode === 'image' && !texImg) return 'gradient';
    return P.colorMode;
  }

  let texImg = null, texImgId = 0;
  function makeTexture(shapes) {
    const mode = effectiveMode();
    let base;
    if (mode === 'original' && isImg()) {
      const B = shapes.bounds, fx = src.natW / shapes.w, fy = src.natH / shapes.h;
      const sx = Math.max(0, B.minX * fx), sy = Math.max(0, B.minY * fy);
      const sw = Math.min(src.natW - sx, (B.maxX - B.minX) * fx), sh = Math.min(src.natH - sy, (B.maxY - B.minY) * fy);
      const k = Math.min(1, 2048 / Math.max(sw, sh));
      const tw = Math.max(4, Math.round(sw * k)), th = Math.max(4, Math.round(sh * k));
      base = newCanvas(tw, th);
      const ctx = base.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(src.img, sx, sy, sw, sh, 0, 0, tw, th);
      const id = ctx.getImageData(0, 0, tw, th);
      S.bleedRGBA(id.data, tw, th);
      ctx.putImageData(id, 0, 0);
    } else if (mode === 'image' && texImg) {
      // gambar sebagai motif: dipotong menutupi kanvas persegi, dengan pengulangan sesuai kerapatan
      base = newCanvas(512, 512);
      const ctx = base.getContext('2d');
      const k = Math.max(1, Math.round(P.texScale));
      const s = Math.min(texImg.naturalWidth, texImg.naturalHeight), sx = (texImg.naturalWidth - s) / 2, sy = (texImg.naturalHeight - s) / 2;
      const cell = 512 / k;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) ctx.drawImage(texImg, sx, sy, s, s, i * cell, j * cell, cell, cell);
    } else if (mode === 'proc') {
      base = newCanvas(512, 512);
      window.S3DTextures.draw(P.texPat, base, P.colorA, P.colorB, P.texScale);
    } else if (mode === 'solid') {
      base = newCanvas(16, 16);
      const ctx = base.getContext('2d');
      ctx.fillStyle = P.colorA; ctx.fillRect(0, 0, 16, 16);
    } else {
      const n = 512;
      base = newCanvas(n, n);
      const ctx = base.getContext('2d');
      const a = (P.gradAngle * Math.PI) / 180;
      const dx = Math.sin(a), dy = -Math.cos(a);
      const half = (n / 2) * (Math.abs(dx) + Math.abs(dy));
      const g = ctx.createLinearGradient(n / 2 - dx * half, n / 2 - dy * half, n / 2 + dx * half, n / 2 + dy * half);
      g.addColorStop(0, P.colorA); g.addColorStop(1, P.colorB);
      ctx.fillStyle = g; ctx.fillRect(0, 0, n, n);
    }
    const fxOn = tab === 'text' && P.fx !== 'none';
    if (!P.sideOn && !fxOn) return { canvas: base, uvScale: [1, 1], sideUV: null, fxUV: null };
    const strip = Math.max(16, Math.round(base.height * 0.12));
    const out = newCanvas(Math.max(base.width, 32), base.height + strip);
    const ctx = out.getContext('2d');
    ctx.drawImage(base, 0, 0, out.width, base.height);
    const half = out.width / 2;
    ctx.fillStyle = P.sideColor; ctx.fillRect(0, base.height, half, strip);
    ctx.fillStyle = P.fxColor; ctx.fillRect(half, base.height, out.width - half, strip);
    const vMid = (base.height + strip / 2) / out.height;
    return { canvas: out, uvScale: [1, base.height / out.height], sideUV: P.sideOn ? [0.25, vMid] : null, fxUV: fxOn ? [0.75, vMid] : null };
  }

  /* ---------------- pratinjau area terdeteksi ---------------- */
  function drawDetect(shapes) {
    const cv = $('detect');
    const scale = Math.min(1, 520 / Math.max(shapes.w, shapes.h));
    const w = Math.max(1, Math.round(shapes.w * scale)), h = Math.max(1, Math.round(shapes.h * scale));
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const id = ctx.createImageData(w, h);
    const F = shapes.field, L = shapes.level;
    for (let y = 0; y < h; y++) {
      const sy = Math.min(shapes.h - 1, Math.floor(y / scale));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(shapes.w - 1, Math.floor(x / scale));
        const v = F[sy * shapes.w + sx];
        const k = (y * w + x) * 4;
        if (v >= L) { id.data[k] = 120; id.data[k + 1] = 190; id.data[k + 2] = 255; id.data[k + 3] = 255; }
      }
    }
    ctx.putImageData(id, 0, 0);
  }

  /* ---------------- relief bertingkat ---------------- */
  function addSmoothRelief(shapes, tex, baseMesh) {
    const r = cache.raster;
    const mode = P.relief.slice(1); // hbright → bright
    const hm = S.buildHeightRelief(r.data, r.w, r.h, shapes.field, shapes.level, {
      mode, width: P.width, baseZ: P.thick / 2, height: P.reliefH, res: P.reliefQ, blur: P.reliefBlur,
      maxTriangles: Math.round(P.maxTri * 0.55), uvScale: tex.uvScale, frame: shapes.bounds, flip: P.flip,
    });
    cache.layers = hm ? [{}] : []; // dipakai untuk catatan "relief kosong"
    if (!hm) return baseMesh;
    const out = S.mergeMeshes([baseMesh, hm]);
    out.bevelFallbacks = baseMesh.bevelFallbacks || 0;
    return out;
  }

  function addRelief(shapes, tex, baseMesh) {
    if (P.relief[0] === 'h') return addSmoothRelief(shapes, tex, baseMesh);
    const r = cache.raster;
    const lkey = cache.shapeKey + JSON.stringify([P.relief, P.levels, P.smooth, P.maxTri]);
    if (cache.layerKey !== lkey) {
      const rm = S.reliefMasks(r.data, r.w, r.h, shapes.field, shapes.level, { mode: P.relief, levels: P.levels });
      const budget = Math.max(300, Math.floor((P.maxTri * 0.55) / Math.max(1, rm.n - 1)));
      cache.layers = rm.layers.filter((l) => l.any).map((l) => ({
        k: l.k,
        shapes: S.extractShapes({ data: l.rgba, width: r.w, height: r.h }, { sensitivity: 50, fillHoles: 0, removeSpecks: 6, source: 'alpha', smooth: P.smooth, maxTriangles: budget, bevel: false }),
      })).filter((l) => l.shapes.polys.length);
      cache.layerKey = lkey; cache.layerN = rm.n;
    }
    const step = P.reliefH / Math.max(1, cache.layerN - 1);
    const parts = [baseMesh];
    for (const l of cache.layers) {
      const t = step + 0.03;
      const m = S.buildMesh(l.shapes, { width: P.width, thickness: t, bevel: 0, flip: false, uvScale: tex.uvScale, sideUV: tex.sideUV, frame: shapes.bounds });
      S.translateMesh(m, 0, 0, P.thick / 2 + l.k * step - t / 2);
      parts.push(m);
    }
    const out = S.mergeMeshes(parts);
    out.bevelFallbacks = baseMesh.bevelFallbacks || 0;
    return out;
  }

  // Efek teks: alas, bayangan, atau garis tepi ganda. Selalu satu warna (fxColor) lewat strip tekstur.
  function addTextFx(shapes, tex, mainMesh) {
    const T = P.thick, tf = Math.max(0.05, (T * P.fxThick) / 100);
    const m = S.buildMesh(cache.fxShapes, {
      width: P.width, thickness: tf, bevel: P.bevel * (tf / 2), bevelSeg: P.bevelSeg, flip: false,
      uvScale: tex.uvScale, sideUV: tex.fxUV, capUV: tex.fxUV, frame: shapes.bounds,
    });
    // sejajar dasar teks, sedikit menembus agar tidak ada celah
    S.translateMesh(m, 0, 0, -T / 2 + tf / 2 - (P.fx === 'shadow' ? tf * 0.4 : 0));
    const out = S.mergeMeshes([mainMesh, m]);
    out.bevelFallbacks = (mainMesh.bevelFallbacks || 0) + (m.bevelFallbacks || 0);
    return out;
  }

  /* ---------------- pipeline ---------------- */
  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(update, delay == null ? 140 : delay);
  }

  async function update() {
    const my = ++seq;
    const notes = [];
    try {
      if (tab === 'maker') return;
      if (tab === 'draw' && (!draw || !draw.hasContent())) {
        current = null; cache.shapeKey = ''; setDownloads(false);
        if (viewer) viewer.clearMesh();
        setNotice([{ msg: 'Kanvas masih kosong. Gambar sesuatu di kanvas, lalu hasilnya langsung jadi 3D.' }]);
        return;
      }
      if (tab === 'draw') { srcDraw.img = draw.canvas; }
      if (isImg() && !src.img) return;
      setBusy(true);
      await nextFrame();
      if (my !== seq) return;

      const bevelOn = P.bevel > 0;
      const reliefOn = isImg() && P.relief !== 'flat';
      const shapeParams = isImg()
        ? [src.id, P.sens, P.fill, P.specks, P.detailLogo, P.invert, reliefOn]
        : [P.text, P.font, P.align, P.spacing, P.lineGap, P.boldText, P.detailText, P.curve, P.fx, P.fxSize];
      const shapeKey = JSON.stringify([tab, shapeParams, P.smooth, P.maxTri, bevelOn, P.bevelSeg]);

      if (shapeKey !== cache.shapeKey) {
        let raster;
        if (isImg()) raster = rasterLogo();
        else {
          await ensureFont(currentFontDef());
          if (my !== seq) return;
          raster = rasterText();
        }
        if (!raster) {
          current = null; setDownloads(false);
          setNotice([{ err: true, msg: 'Teks masih kosong. Ketik sesuatu di kolom isi teks.' }]);
          setBusy(false); return;
        }
        const shapes = S.extractShapes({ data: raster.data, width: raster.w, height: raster.h }, {
          sensitivity: isImg() ? P.sens : 18,
          fillHoles: isImg() ? P.fill : 0,
          removeSpecks: isImg() ? P.specks : 6,
          invert: isImg() && P.invert,
          source: tab === 'logo' ? 'auto' : 'alpha',
          smooth: P.smooth, maxTriangles: reliefOn ? Math.round(P.maxTri * 0.45) : (tab === 'text' && P.fx !== 'none' ? Math.round(P.maxTri * 0.6) : P.maxTri), bevel: bevelOn, bevelSeg: P.bevelSeg,
        });
        cache.fxShapes = null;
        if (tab === 'text' && P.fx !== 'none') {
          const r2 = rasterText(P.fx);
          if (r2) {
            const fs = S.extractShapes({ data: r2.data, width: r2.w, height: r2.h }, { sensitivity: 18, fillHoles: 0, removeSpecks: 6, source: 'alpha', smooth: P.smooth, maxTriangles: Math.round(P.maxTri * 0.35), bevel: bevelOn, bevelSeg: P.bevelSeg });
            if (fs.polys.length) cache.fxShapes = fs;
          }
        }
        cache.raster = raster;
        cache.shapeKey = shapeKey; cache.shapes = shapes; cache.texKey = ''; cache.meshKey = '';
        if (isImg()) drawDetect(shapes);
      }
      const shapes = cache.shapes;
      if (!shapes.polys.length) {
        current = null; setDownloads(false);
        setNotice([{ err: true, msg: isImg()
          ? 'Tidak ada bentuk yang terdeteksi. Naikkan sensitivitas, kecilkan "Buang bintik kecil", atau coba "Balik area logo".'
          : 'Tidak ada bentuk yang terdeteksi. Coba font lain atau naikkan detail bentuk.' }]);
        setBusy(false); return;
      }

      const texKey = shapeKey + JSON.stringify([effectiveMode(), P.colorA, P.colorB, P.gradAngle, P.sideOn, P.sideColor, P.texPat, P.texScale, texImgId]);
      if (texKey !== cache.texKey) { cache.tex = makeTexture(shapes); cache.texKey = texKey; cache.meshKey = ''; }
      const tex = cache.tex;

      const meshKey = texKey + JSON.stringify([P.width, P.thick, P.bevel, P.bevelSeg, P.flip, reliefOn ? [P.relief, P.levels, P.reliefH, P.maxTri, P.reliefQ, P.reliefBlur] : 0, P.fxThick]);
      let fresh = false;
      if (meshKey !== cache.meshKey) {
        const baseMesh = S.buildMesh(shapes, {
          width: P.width, thickness: P.thick, bevel: P.bevel * (P.thick / 2), bevelSeg: P.bevelSeg, flip: P.flip,
          uvScale: tex.uvScale, sideUV: tex.sideUV,
        });
        let m0 = reliefOn ? addRelief(shapes, tex, baseMesh) : baseMesh;
        if (cache.fxShapes && tex.fxUV) m0 = addTextFx(shapes, tex, m0);
        cache.mesh = m0;
        cache.meshKey = meshKey; fresh = true;
      }
      const mesh = cache.mesh;
      if (my !== seq) return;

      if (viewer) {
        viewer.setMesh(mesh, tex.canvas, { metallic: P.metal, roughness: P.rough, glow: P.glow }, cache.lastShapeKey === shapeKey);
      }
      cache.lastShapeKey = shapeKey;
      current = { mesh, tex, shapes };

      // ringkasan
      const st = shapes.stats;
      $('st-tri').textContent = mesh.triangles.toLocaleString('id-ID');
      $('st-parts').textContent = shapes.polys.length.toLocaleString('id-ID');
      $('st-size').textContent = `${mesh.size[0].toFixed(1)} × ${mesh.size[1].toFixed(1)} × ${mesh.size[2].toFixed(2)}`;
      const ratio = mesh.triangles / TRI_LIMIT;
      const meter = $('st-meter');
      meter.style.width = Math.min(100, ratio * 100) + '%';
      meter.parentElement.className = 'meter' + (ratio > 1 ? ' over' : ratio > 0.85 ? ' warn' : '');

      { const ln = limitNote('Model', mesh.triangles, 'Turunkan batas segitiga, kehalusan outline, kebulatan tepi, atau matikan bevel.'); if (ln) notes.push(ln); }
      if (st.dropped > 0) notes.push({ msg: `${st.dropped} bagian terkecil dibuang agar muat batas ${P.maxTri.toLocaleString('id-ID')} segitiga.` });
      else if (st.simplifyTolerance > st.baseTolerance * 1.6) notes.push({ msg: `Outline disederhanakan otomatis agar muat batas ${P.maxTri.toLocaleString('id-ID')} segitiga. Naikkan batas jika ingin lebih detail.` });
      if (mesh.bevelFallbacks > 0) notes.push({ msg: `Bevel dilewati di ${mesh.bevelFallbacks} bagian yang terlalu tipis.` });
      if (reliefOn && cache.layers && !cache.layers.length) notes.push({ msg: 'Relief tidak menemukan area bertingkat. Coba gaya relief lain atau ubah sensitivitas.' });
      if (tab === 'logo' && !st.hasAlpha) notes.push({ msg: 'Gambar ini tidak transparan, jadi latar dikenali dari warna di tepi gambar. PNG transparan memberi hasil lebih akurat.' });
      if (!viewer) notes.push({ msg: 'Pratinjau 3D tidak tersedia di perangkat ini, tetapi unduhan tetap bisa dipakai.' });
      setNotice(notes);
      setDownloads(true);
    } catch (e) {
      console.error(e);
      current = null; setDownloads(false);
      setNotice([{ err: true, msg: 'Terjadi kesalahan saat membuat model: ' + (e && e.message ? e.message : e) }]);
    } finally {
      if (my === seq) setBusy(false);
    }
  }

  /* ---------------- unduhan ---------------- */
  function setDownloads(on) { ['dl-glb', 'dl-obj', 'dl-stl', 'dl-png', 'copy-obj', 'dl-check', 'dl-pbr'].forEach((id) => { $(id).disabled = !on; }); $('dl-webm').disabled = !on || !window.MediaRecorder; }
  const canvasToPng = (cv) => new Promise((res, rej) => cv.toBlob((b) => (b ? b.arrayBuffer().then((a) => res(new Uint8Array(a))) : rej(new Error('Gagal membuat tekstur.'))), 'image/png'));

  function fileBase() {
    if (tab === 'maker') return 'saltoria-bentuk-3d';
    if (tab === 'draw') return 'saltoria-desain';
    const raw = tab === 'text' ? P.text.split('\n')[0] : src.name.replace(/\.[^.]+$/, '');
    const slug = (raw || 'model').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 32);
    return 'saltoria-' + (slug || 'model');
  }
  function save(bytesOrText, name, type) {
    const blob = new Blob([bytesOrText], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  const exportOpts = { autoFix: false };
  function exportSource() {
    let es;
    if (tab === 'maker') {
      const d = maker && maker.exportData();
      es = d ? { mesh: d.mesh, canvas: d.canvas, material: d.material } : null;
    } else es = current ? { mesh: current.mesh, canvas: current.tex.canvas, material: { metallic: P.metal, roughness: P.rough, name: 'SaltoriaModel' } } : null;
    if (es && exportOpts.autoFix) es = Object.assign({}, es, { mesh: S.repairMesh(es.mesh).mesh });
    return es;
  }

  /* ---------------- pemeriksa mesh, kurangi segitiga, ekspor per objek ---------------- */
  async function downloadParts() {
    const parts = maker && maker.exportParts();
    if (!parts || !parts.length) { dockMsg('Belum ada objek yang tampil di scene.'); return; }
    try {
      const files = [], used = new Set();
      for (const p of parts) {
        const base = (p.name || 'objek').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 32) || 'objek';
        let nm = base, k = 2; while (used.has(nm)) nm = base + '-' + k++;
        used.add(nm);
        const mesh = exportOpts.autoFix ? S.repairMesh(p.data.mesh).mesh : p.data.mesh;
        files.push({ name: nm + '.glb', data: S.buildGLB(mesh, await canvasToPng(p.data.canvas), p.data.material) });
      }
      const name = fileBase() + '-per-objek.zip';
      save(S.buildZip(files), name, 'application/zip');
      dockMsg(files.length + ' berkas .glb dalam ' + name + ' (posisi scene dipertahankan)');
    } catch (e) { dockMsg('Gagal membuat zip: ' + e.message); }
  }

  function reduceTrianglesNow(target) {
    if (tab === 'maker') {
      const r = maker.autoReduce(target);
      return Promise.resolve(r.changed ? { ok: r.after <= target, before: r.before, after: r.after, how: 'detail bentuk lengkung diturunkan ke ' + Math.round(r.detail * 100) + '%' } : { ok: true, before: r.before, after: r.after, how: 'sudah di bawah target' });
    }
    return (async () => {
      const before = current ? current.mesh.triangles : 0;
      const sl = $('maxTri'); let how = [];
      for (let i = 0; i < 8 && current && current.mesh.triangles > target; i++) {
        if (P.bevelSeg > 1) { P.bevelSeg--; $('bevelSeg').value = P.bevelSeg; readControl($('bevelSeg')); how.push('kebulatan tepi turun'); }
        else { P.maxTri = Math.max(+sl.min, Math.floor(Math.min(P.maxTri, current.mesh.triangles) * 0.75)); sl.value = P.maxTri; readControl(sl); how.push('outline disederhanakan'); if (P.maxTri <= +sl.min) { await update(); break; } }
        await update();
      }
      const after = current ? current.mesh.triangles : before;
      return { ok: after <= target, before, after, how: how.length ? how.filter((v, k, ar) => ar.indexOf(v) === k).join(' dan ') : 'sudah di bawah target' };
    })();
  }

  function openChecker() {
    const es = exportSource();
    if (!es) { dockMsg('Belum ada model untuk diperiksa.'); return; }
    const dlg = $('checker'), body = $('checker-body');
    const fill = () => {
      const src2 = (() => { if (tab === 'maker') { const d = maker.exportData(); return d && d.mesh; } return current && current.mesh; })();
      const rep = S.checkMesh(src2, { target: TARGET, limit: TRI_LIMIT });
      body.textContent = '';
      const mk = (t, props, kids) => { const e = document.createElement(t); if (props) Object.assign(e, props); (kids || []).forEach((k) => e.append(k)); return e; };
      body.append(mk('p', { className: 'hint', textContent: `${rep.triangles.toLocaleString('id-ID')} segitiga, ${rep.vertices.toLocaleString('id-ID')} titik. Target: ${TARGETS[TARGET].label || TARGET}.` }));
      const ul = mk('ul', { className: 'checks' });
      for (const it of rep.issues) ul.append(mk('li', { className: 'chk ' + it.level }, [mk('b', { textContent: { ok: 'Lulus', err: 'Galat', warn: 'Peringatan', info: 'Info' }[it.level] }), ' ' + it.msg]));
      body.append(ul);
      const fixable = rep.issues.some((i) => i.fixable);
      const fx = mk('label', { className: 'check' }, [Object.assign(mk('input'), { type: 'checkbox', checked: exportOpts.autoFix, onchange: (e) => { exportOpts.autoFix = e.target.checked; } }), ' Perbaiki otomatis saat unduh (buang segitiga gepeng, balik muka terbalik)' + (fixable ? '' : ' — tidak ada yang perlu diperbaiki sekarang')]);
      body.append(fx);
      body.append(mk('h3', { textContent: 'Kurangi segitiga otomatis' }));
      const tgt = Object.assign(mk('input'), { type: 'number', min: 200, max: 400000, step: 500, value: Math.min(TRI_LIMIT, Math.max(200, rep.triangles > TRI_LIMIT ? TRI_LIMIT : Math.round(rep.triangles * 0.6))), className: 'txt' });
      tgt.setAttribute('aria-label', 'Target jumlah segitiga');
      const out = mk('p', { className: 'hint', role: 'status' });
      const go = mk('button', { type: 'button', className: 'chip', textContent: 'Kurangi ke target', onclick: async () => {
        go.disabled = true; out.textContent = 'Menghitung ulang…';
        const r = await reduceTrianglesNow(Math.max(200, +tgt.value || 0));
        out.textContent = `${r.before.toLocaleString('id-ID')} jadi ${r.after.toLocaleString('id-ID')} segitiga (${r.how}).` + (r.ok ? '' : ' Belum mencapai target; naikkan target atau sederhanakan bentuknya.');
        go.disabled = false; fill2(out.textContent);
      } });
      body.append(mk('p', { className: 'hint', textContent: tab === 'maker' ? 'Menurunkan jumlah segmen bentuk lengkung (bola, tabung, kerucut, dan sebagainya). Bentuk bersudut seperti kotak tidak berubah.' : 'Menurunkan kebulatan tepi dan menyederhanakan outline sampai muat target.' }), mk('label', { className: 'nf' }, [mk('span', { textContent: 'Target segitiga' }), tgt]), go);
      if (tab === 'maker') body.append(mk('button', { type: 'button', className: 'chip', textContent: 'Kembalikan detail penuh', onclick: () => { maker.resetDetail(); fill2('Detail dikembalikan ke 100%.'); } }));
      body.append(out);
      function fill2(msg) { setTimeout(() => { const keep = msg; fill(); const o2 = body.querySelector('[role=status]'); if (o2) o2.textContent = keep; }, 50); }
    };
    fill();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  async function downloadGLB() {
    const es = exportSource();
    if (!es) return;
    try {
      const png = await canvasToPng(es.canvas);
      const glb = S.buildGLB(es.mesh, png, es.material);
      const name = fileBase() + '.glb';
      save(glb, name, 'model/gltf-binary');
      dockMsg('Tersimpan: ' + name);
    } catch (e) { dockMsg('Gagal membuat .glb: ' + e.message); }
  }
  async function downloadOBJ() {
    const es = exportSource();
    if (!es) return;
    try {
      const png = await canvasToPng(es.canvas);
      const enc = new TextEncoder();
      const zip = S.buildZip([
        { name: 'model.obj', data: enc.encode(S.buildOBJ(es.mesh, { mtl: 'model.mtl' })) },
        { name: 'model.mtl', data: enc.encode(S.buildMTL({ texture: 'logo_texture.png' })) },
        { name: 'logo_texture.png', data: png },
      ]);
      const name = fileBase() + '-obj.zip';
      save(zip, name, 'application/zip');
      dockMsg('Tersimpan: ' + name);
    } catch (e) { dockMsg('Gagal membuat zip: ' + e.message); }
  }
  // Peta PBR dari tekstur warna: normal (Sobel pada kecerahan), roughness (gelap = lebih kasar), metalness (konstan).
  function buildPBRMaps(cv, mat) {
    const w = cv.width, h = cv.height, src = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) lum[i] = (0.2126 * src[i * 4] + 0.7152 * src[i * 4 + 1] + 0.0722 * src[i * 4 + 2]) / 255;
    const mk = () => { const c = newCanvas(w, h); const x = c.getContext('2d'); return { c, x, id: x.createImageData(w, h) }; };
    const nrm = mk(), rgh = mk(), met = mk();
    const at = (x, y) => lum[((y + h) % h) * w + ((x + w) % w)];
    const strength = 3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -gx * strength, ny = gy * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const o = (y * w + x) * 4;
      nrm.id.data[o] = (nx * 0.5 + 0.5) * 255; nrm.id.data[o + 1] = (ny * 0.5 + 0.5) * 255; nrm.id.data[o + 2] = (nz * 0.5 + 0.5) * 255; nrm.id.data[o + 3] = 255;
      const r = Math.max(0, Math.min(1, (mat.roughness == null ? 0.7 : mat.roughness) + (0.5 - lum[y * w + x]) * 0.4)) * 255;
      rgh.id.data[o] = rgh.id.data[o + 1] = rgh.id.data[o + 2] = r; rgh.id.data[o + 3] = 255;
      const m = (mat.metallic || 0) * 255;
      met.id.data[o] = met.id.data[o + 1] = met.id.data[o + 2] = m; met.id.data[o + 3] = 255;
    }
    for (const t of [nrm, rgh, met]) t.x.putImageData(t.id, 0, 0);
    return { normal: nrm.c, roughness: rgh.c, metalness: met.c };
  }
  async function downloadPBR() {
    const es = exportSource();
    if (!es) return;
    try {
      const maps = buildPBRMaps(es.canvas, es.material || {});
      const enc = new TextEncoder();
      const zip = S.buildZip([
        { name: 'albedo.png', data: await canvasToPng(es.canvas) },
        { name: 'normal.png', data: await canvasToPng(maps.normal) },
        { name: 'roughness.png', data: await canvasToPng(maps.roughness) },
        { name: 'metalness.png', data: await canvasToPng(maps.metalness) },
        { name: 'BACA-SAYA.txt', data: enc.encode('Peta PBR dibuat dari tekstur warna model (albedo.png).\r\nnormal.png: dihitung dari kecerahan (bukan hasil bake dari geometri).\r\nroughness.png / metalness.png: nilai dari slider Kekasaran dan Metalik.\r\nCatatan: GLB dari Saltoria 3D Studio hanya membawa tekstur warna. Di Roblox, peta ini dipasang manual lewat SurfaceAppearance (NormalMap, RoughnessMap, MetalnessMap). Hasil di Roblox perlu dicoba sendiri.\r\n') },
      ]);
      const name = fileBase() + '-pbr.zip';
      save(zip, name, 'application/zip');
      dockMsg('Tersimpan: ' + name);
    } catch (e) { dockMsg('Gagal membuat peta PBR: ' + e.message); }
  }
  function downloadSTL() {
    const es = exportSource();
    if (!es) return;
    try {
      const name = fileBase() + '.stl';
      save(S.buildSTL(es.mesh, 1), name, 'model/stl');
      dockMsg('Tersimpan: ' + name + ' (1 stud = 1 satuan)');
    } catch (e) { dockMsg('Gagal membuat .stl: ' + e.message); }
  }

  // Render bersih (tanpa grid dan gizmo). Di Modeler, seleksi disembunyikan dulu agar warnanya asli.
  function withCleanRender(fn) {
    if (!viewer) throw new Error('Pratinjau 3D tidak tersedia.');
    let restore = () => {};
    if (tab === 'maker' && maker) {
      const d = maker.exportData();
      if (d) { viewer.setMesh(d.mesh, d.canvas, d.material, true); restore = () => maker.refresh(); }
    }
    try { return fn(); } finally { restore(); }
  }

  function downloadPNG() {
    try {
      withCleanRender(() => viewer.renderAt(null, true).toBlob((b) => {
        if (!b) { dockMsg('Gagal membuat gambar.'); return; }
        const name = fileBase() + '.png';
        save(b, name, 'image/png');
        dockMsg('Tersimpan: ' + name + ' (latar transparan)');
      }, 'image/png'));
    } catch (e) { dockMsg('Gagal membuat gambar: ' + e.message); }
  }

  let recording = false;
  async function recordWebM() {
    if (recording) return;
    if (!window.MediaRecorder || !viewer) { dockMsg('Browser ini belum mendukung rekam video.'); return; }
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) { dockMsg('Browser ini belum mendukung rekam video WebM.'); return; }
    recording = true; $('dl-webm').disabled = true;
    let restore = () => {};
    try {
      if (tab === 'maker' && maker) { const d = maker.exportData(); if (d) { viewer.setMesh(d.mesh, d.canvas, d.material, true); restore = () => maker.refresh(); } }
      const N = 720, cv = newCanvas(N, N), c2 = cv.getContext('2d');
      const rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 5000000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const done = new Promise((res) => { rec.onstop = res; });
      const css = getComputedStyle(document.body);
      const bgTop = css.getPropertyValue('--bg-top').trim() || '#070b1b', bgBot = css.getPropertyValue('--bg-bot').trim() || '#060914';
      const yaw0 = viewer.getCamera().yaw, DUR = 4000;
      rec.start();
      const t0 = performance.now();
      for (;;) {
        const t = performance.now() - t0;
        if (t >= DUR) break;
        const gl = viewer.renderAt(yaw0 + (t / DUR) * Math.PI * 2, true);
        const g = c2.createLinearGradient(0, 0, 0, N); g.addColorStop(0, bgTop); g.addColorStop(1, bgBot);
        c2.fillStyle = g; c2.fillRect(0, 0, N, N);
        const k = Math.min(N / gl.width, N / gl.height);
        c2.drawImage(gl, (N - gl.width * k) / 2, (N - gl.height * k) / 2, gl.width * k, gl.height * k);
        dockMsg('Merekam… ' + Math.round((t / DUR) * 100) + '%');
        await new Promise((r) => setTimeout(r, 33));
      }
      rec.stop(); await done;
      const name = fileBase() + '-putar.webm';
      save(new Blob(chunks, { type: 'video/webm' }), name, 'video/webm');
      dockMsg('Tersimpan: ' + name);
    } catch (e) { dockMsg('Gagal merekam: ' + e.message); }
    finally { restore(); viewer.redraw(); recording = false; $('dl-webm').disabled = !exportSource() || !window.MediaRecorder; }
  }

  async function copyOBJ() {
    const es = exportSource();
    if (!es) return;
    const text = S.buildOBJ(es.mesh, { mtl: 'model.mtl' });
    try { await navigator.clipboard.writeText(text); dockMsg('Teks OBJ disalin.'); }
    catch (e) { dockMsg('Browser menolak menyalin. Pakai Unduh .obj + texture.'); }
  }

  /* ---------------- editor bentuk 3D ---------------- */
  let lastMakerNote = '';
  function showStats(tri, parts, size) {
    $('st-tri').textContent = tri.toLocaleString('id-ID');
    $('st-parts').textContent = parts.toLocaleString('id-ID');
    $('st-size').textContent = size;
    const ratio = tri / TRI_LIMIT;
    const meter = $('st-meter');
    meter.style.width = Math.min(100, ratio * 100) + '%';
    meter.parentElement.className = 'meter' + (ratio > 1 ? ' over' : ratio > 0.85 ? ' warn' : '');
  }

  function showMakerBuild(out) {
    let notes = [];
    if (!out) {
      if (viewer) viewer.clearMesh();
      showStats(0, 0, '0');
      setDownloads(false);
      notes = [{ msg: 'Scene masih kosong. Pilih bentuk di panel Tambah bentuk untuk memulai.' }];
    } else {
      if (viewer) viewer.setMesh(out.mesh, out.canvas, out.material, true);
      const m = out.mesh;
      showStats(m.triangles, out.stats.objects, `${m.size[0].toFixed(1)} × ${m.size[1].toFixed(1)} × ${m.size[2].toFixed(1)}`);
      setDownloads(true);
      { const ln = limitNote('Scene', m.triangles, 'Kurangi jumlah segmen atau objek.'); if (ln) notes.push(ln); }
      if (out.stats.hidden > 0) notes.push({ msg: `${out.stats.hidden} objek disembunyikan dan tidak ikut diekspor.` });
      if (!viewer) notes.push({ msg: 'Pratinjau 3D tidak tersedia di perangkat ini, tetapi unduhan tetap bisa dipakai.' });
    }
    const key = JSON.stringify(notes);
    if (key !== lastMakerNote) { lastMakerNote = key; setNotice(notes); }
  }

  function enterMaker() {
    if (!maker) maker = window.S3DMaker.create({ root: $('maker-ui'), stage: document.querySelector('.vstage'), downloadParts, openChecker, getViewer: () => viewer, onBuild: showMakerBuild, toast: dockMsg });
    $('btn-auto').setAttribute('aria-pressed', 'false');
    lastMakerNote = '';
    setNotice([]);
    maker.activate();
  }
  function leaveMaker() {
    if (maker) maker.deactivate();
    cache.lastShapeKey = '';
    setDownloads(false);
    setNotice([]);
  }

  /* ---------------- kontrol ---------------- */
  function paintRange(el) {
    const min = +el.min || 0, max = +el.max || 100;
    el.style.setProperty('--p', ((el.value - min) / (max - min)) * 100 + '%');
  }
  function showOutput(el) {
    const out = el.parentElement.querySelector('output');
    if (!out) return;
    const f = fmt[el.dataset.key];
    out.textContent = f ? f(+el.value) : el.value;
  }

  function readControl(el) {
    const k = el.dataset.key;
    if (el.type === 'range') { P[k] = +el.value; paintRange(el); showOutput(el); }
    else if (el.type === 'checkbox') P[k] = el.checked;
    else if (el.type === 'radio') { if (el.checked) P[k] = el.value; }
    else P[k] = el.value;
  }

  function syncVisibility() {
    const mode = effectiveMode();
    $('color-pickers').hidden = mode === 'original';
    if ($('fx-wrap')) $('fx-wrap').hidden = P.fx === 'none';
    $('colorB-wrap').hidden = mode !== 'gradient' && mode !== 'proc';
    if ($('img-wrap')) $('img-wrap').hidden = P.colorMode !== 'image';
    if ($('texScale-wrap')) $('texScale-wrap').hidden = mode !== 'proc' && mode !== 'image';
    if ($('proc-wrap')) $('proc-wrap').hidden = mode !== 'proc';
    if ($('texPat-wrap')) $('texPat-wrap').hidden = mode !== 'proc';
    $('grad-wrap').hidden = mode !== 'gradient';
    $('colorA-label').textContent = mode === 'gradient' || mode === 'proc' ? 'Warna awal' : 'Warna';
    $('side-wrap').hidden = !P.sideOn;
    $('relief-wrap').hidden = P.relief === 'flat';
    if ($('relief-levels')) $('relief-levels').hidden = P.relief[0] === 'h';
    if ($('relief-smooth')) $('relief-smooth').hidden = P.relief[0] !== 'h';
  }

  function fillColorModes() {
    const sel = $('colorMode');
    const opts = isImg()
      ? [['original', 'Warna logo asli (tanpa cahaya tambahan)'], ['solid', 'Satu warna'], ['gradient', 'Gradient dua warna'], ['proc', 'Tekstur motif (marmer, kayu, karbon…)'], ['image', 'Tekstur dari gambar']]
      : [['solid', 'Satu warna'], ['gradient', 'Gradient dua warna'], ['proc', 'Tekstur motif (marmer, kayu, karbon…)'], ['image', 'Tekstur dari gambar']];
    sel.textContent = '';
    for (const [v, l] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = l; sel.appendChild(o); }
    if (tab === 'text' && P.colorMode === 'original') P.colorMode = 'gradient';
    sel.value = P.colorMode;
    const ps = $('texPat');
    if (ps && !ps.options.length) for (const t of window.S3DTextures.list) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.label; ps.appendChild(o); }
    if (ps) ps.value = P.texPat;
  }

  function setTab(name, silent) {
    const prev = tab;
    tab = name;
    if (name === 'logo') src = srcLogo;
    if (name === 'draw') {
      src = srcDraw;
      if (!draw) draw = window.S3DDraw.create({ root: $('draw-ui'), onChange: () => { if (tab === 'draw') { srcDraw.img = draw.canvas; srcDraw.id++; schedule(0); } } });
      srcDraw.img = draw.canvas;
    }
    document.body.dataset.tab = name;
    document.querySelectorAll('.tabs [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    if (name !== 'maker') { fillColorModes(); syncVisibility(); if (viewer) viewer.setGlow(P.glow); }
    if (viewer && name !== 'maker') { viewer.setOverlays([]); viewer.setGizmo(null); }
    if (prev === 'maker' && name !== 'maker') leaveMaker();
    if (name === 'maker' && prev !== 'maker') enterMaker();
    if (!silent) schedule(0);
  }

  function fillFonts() {
    const sel = $('font'), cs = $('font-cat'), q = $('font-q').value.trim().toLowerCase();
    const all = FONTS.concat(customFonts);
    // kategori
    const cats = ['Semua kategori'].concat(window.S3DFonts.cats);
    if (customFonts.length) cats.push('Font unggahanmu');
    const keep = cs.value || 'Semua kategori';
    if (cs.options.length !== cats.length) {
      cs.textContent = '';
      for (const c of cats) { const o = document.createElement('option'); o.value = o.textContent = c; cs.appendChild(o); }
    }
    cs.value = cats.indexOf(keep) >= 0 ? keep : 'Semua kategori';
    const inCat = (f) => cs.value === 'Semua kategori' || (cs.value === 'Font unggahanmu' ? f.src === 'upload' : f.cat === cs.value);
    const shown = all.filter((f) => inCat(f) && (!q || f.label.toLowerCase().indexOf(q) >= 0));
    // font yang sedang dipakai tetap ada di daftar agar pilihan tidak hilang
    const cur = all.find((f) => f.family === P.font);
    if (cur && shown.indexOf(cur) < 0) shown.unshift(cur);
    sel.textContent = '';
    for (const f of shown) {
      const o = document.createElement('option');
      o.value = f.family; o.textContent = f.label;
      sel.appendChild(o);
    }
    sel.value = P.font;
    sel.size = shown.length > 1 ? Math.min(7, shown.length) : 1;
    $('font-count').textContent = `(${shown.length} dari ${all.length})`;
  }

  async function addCustomFont(file) {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const family = 'SaltoriaCustom' + (customFonts.length + 1);
      const face = new FontFace(family, buf);
      await face.load();
      document.fonts.add(face);
      customFonts.push({ label: file.name.replace(/\.[^.]+$/, ''), family, weight: 400, src: 'upload', cat: 'Font unggahanmu' });
      P.font = family;
      fillFonts();
      schedule(0);
    } catch (e) { setNotice([{ err: true, msg: 'Font tidak bisa dibaca. Pakai berkas .ttf, .otf, atau .woff.' }]); }
  }

  function bindControls() {
    document.querySelectorAll('[data-key]').forEach((el) => {
      readControl(el);
      const ev = el.type === 'range' || el.tagName === 'TEXTAREA' || el.type === 'color' ? 'input' : 'change';
      el.addEventListener(ev, () => {
        readControl(el);
        const k = el.dataset.key;
        if (k === 'metal' || k === 'rough' || k === 'glow') { if (viewer) viewer.setMaterial({ metallic: P.metal, roughness: P.rough, glow: P.glow }); return; }
        if (k === 'colorMode' || k === 'sideOn' || k === 'relief' || k === 'fx') syncVisibility();
        schedule(el.type === 'range' || el.tagName === 'TEXTAREA' ? 150 : 40);
      });
    });
    syncVisibility();

    document.querySelectorAll('.tabs [role="tab"]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

    $('file').addEventListener('change', (e) => { setLogoFromFile(e.target.files[0]); e.target.value = ''; });
    const drop = $('drop');
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => setLogoFromFile(e.dataTransfer.files[0]));
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => { if (!drop.contains(e.target)) { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) setLogoFromFile(f); } });
    window.addEventListener('paste', (e) => {
      const f = [...(e.clipboardData ? e.clipboardData.files : [])].find((x) => /^image\//.test(x.type));
      if (f) { e.preventDefault(); setLogoFromFile(f); }
    });
    $('use-default').addEventListener('click', async () => {
      await setLogoFromUrl(BASE + 'assets/saltoria-logo.png', 'Logo Saltoria Community');
      setTab('logo', true); schedule(0);
    });
    $('font-q').addEventListener('input', fillFonts);
    $('font-cat').addEventListener('change', fillFonts);
    window.S3DFonts.loadManifest().then((n) => { if (n) fillFonts(); });
    $('font-file').addEventListener('change', (e) => { addCustomFont(e.target.files[0]); e.target.value = ''; });

    $('btn-auto').addEventListener('click', (e) => {
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
      e.currentTarget.setAttribute('aria-pressed', String(on));
      if (viewer) viewer.setAutoRotate(on);
    });
    $('shading').addEventListener('change', (e) => { if (viewer) viewer.setShading(e.target.value); });
    $('btn-proj').addEventListener('click', (e) => {
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
      e.currentTarget.setAttribute('aria-pressed', String(on));
      if (viewer) viewer.setProjection(on ? 'ortho' : 'persp');
    });
    document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('btn-reset').addEventListener('click', () => { if (viewer) { viewer.resetView(); if (tab === 'maker' && maker) maker._api.focusAll(true); } });

    $('dl-glb').addEventListener('click', downloadGLB);
    $('dl-obj').addEventListener('click', downloadOBJ);
    $('dl-stl').addEventListener('click', downloadSTL);
    $('dl-png').addEventListener('click', downloadPNG);
    $('dl-webm').addEventListener('click', recordWebM);
    $('copy-obj').addEventListener('click', copyOBJ);
    $('dl-check').addEventListener('click', openChecker);
    $('dl-pbr').addEventListener('click', downloadPBR);
    $('texImg').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      const url = URL.createObjectURL(f), im = new Image();
      im.onload = () => { texImg = im; texImgId++; syncVisibility(); schedule(0); };
      im.onerror = () => dockMsg('Gambar tidak bisa dibaca.');
      im.src = url; e.target.value = '';
    });
  }

  function setTarget(t, quiet) {
    const T = TARGETS[t] || TARGETS.roblox;
    TARGET = TARGETS[t] ? t : 'roblox'; TRI_LIMIT = T.limit;
    $('target').value = TARGET;
    $('st-of').textContent = 'dari ' + triFmt(TRI_LIMIT);
    const sl = $('maxTri');
    sl.max = T.max; sl.step = T.step; sl.min = Math.min(2000, T.max);
    P.maxTri = Math.min(Math.max(P.maxTri, +sl.min), T.max);
    if (!quiet && P.maxTri < T.def && TARGET !== 'roblox') P.maxTri = T.def;
    sl.value = P.maxTri; readControl(sl);
    try { localStorage.setItem('saltoria3d.target', TARGET); } catch (e) { /* abaikan */ }
    if (!quiet) { if (tab === 'maker' && maker) maker.refresh(); else schedule(0); }
  }

  /* ---------------- tampilan: arah pandang, sumbu, tema, layar penuh ---------------- */
  function setView(name) {
    if (!viewer) return;
    viewer.setView(name);
    $('btn-auto').setAttribute('aria-pressed', 'false');
  }

  function setupAxis() {
    const cv = $('axis');
    if (!cv || !viewer) return;
    const ctx = cv.getContext('2d');
    const C = 84, R = 52;
    const AX = [
      { n: 'X', v: [1, 0, 0], col: '#ff6b7a', view: 'right', neg: 'left' },
      { n: 'Y', v: [0, 1, 0], col: '#7ee0a0', view: 'top', neg: 'bottom' },
      { n: 'Z', v: [0, 0, 1], col: '#6ea8ff', view: 'front', neg: 'back' },
    ];
    let hits = [], lastKey = '';
    function paint() {
      const cam = viewer.getCamera();
      const key = [cam.yaw, cam.pitch, viewer.projection].map((v) => (typeof v === 'number' ? v.toFixed(3) : v)).join('|');
      if (key !== lastKey) {
        lastKey = key;
        ctx.clearRect(0, 0, 168, 168);
        const pts = [];
        for (const a of AX) {
          const x = a.v[0] * cam.R[0] + a.v[1] * cam.R[1] + a.v[2] * cam.R[2];
          const y = -(a.v[0] * cam.Up[0] + a.v[1] * cam.Up[1] + a.v[2] * cam.Up[2]);
          const d = a.v[0] * cam.F[0] + a.v[1] * cam.F[1] + a.v[2] * cam.F[2];
          pts.push({ a, x: C + x * R, y: C + y * R, d, pos: true }, { a, x: C - x * R, y: C - y * R, d: -d, pos: false });
        }
        pts.sort((p, q) => q.d - p.d); // yang jauh digambar dulu
        hits = [];
        ctx.lineWidth = 3; ctx.font = '600 22px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const p of pts) {
          if (p.pos) { ctx.strokeStyle = p.a.col; ctx.beginPath(); ctx.moveTo(C, C); ctx.lineTo(p.x, p.y); ctx.stroke(); }
          ctx.beginPath(); ctx.arc(p.x, p.y, p.pos ? 17 : 11, 0, Math.PI * 2);
          ctx.fillStyle = p.pos ? p.a.col : 'rgba(150,170,210,0.35)'; ctx.fill();
          if (p.pos) { ctx.fillStyle = '#071024'; ctx.fillText(p.a.n, p.x, p.y + 1); }
          hits.push({ x: p.x / 2, y: p.y / 2, r: p.pos ? 17 / 2 + 4 : 11 / 2 + 4, view: p.pos ? p.a.view : p.a.neg, d: p.d });
        }
      }
      requestAnimationFrame(paint);
    }
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 84, y = ((e.clientY - r.top) / r.height) * 84;
      let best = null;
      for (const h of hits) { const d = Math.hypot(h.x - x, h.y - y); if (d <= h.r && (!best || h.d < best.d)) best = h; }
      if (best) setView(best.view);
    });
    paint();
  }

  const PRESETS = [
    { id: 'kristal', label: 'Saltoria Kristal', metal: 0.25, rough: 0.3, glow: 0, colors: ['#9fc4ff', '#a98bff'] },
    { id: 'chrome', label: 'Chrome', metal: 1, rough: 0.12, glow: 0, colors: ['#f6f8fb', '#8c97aa'] },
    { id: 'emas', label: 'Emas', metal: 1, rough: 0.28, glow: 0, colors: ['#ffe08a', '#c98a1a'] },
    { id: 'rose', label: 'Emas mawar', metal: 1, rough: 0.3, glow: 0, colors: ['#ffd2c4', '#c9806a'] },
    { id: 'neon', label: 'Neon', metal: 0, rough: 0.4, glow: 0.7, colors: ['#62e6ff', '#9d85ff'] },
    { id: 'plastik', label: 'Plastik', metal: 0, rough: 0.25, glow: 0 },
    { id: 'matte', label: 'Matte', metal: 0, rough: 1, glow: 0 },
  ];
  function setSlider(id, v) { const el = $(id); el.value = v; readControl(el); }
  function applyPreset(p) {
    if (tab === 'maker') { if (maker) maker.setMaterial({ metallic: p.metal, roughness: p.rough, glow: p.glow }); if (viewer) viewer.setGlow(p.glow); dockMsg('Preset ' + p.label + ' dipakai.'); return; }
    setSlider('metal', p.metal); setSlider('rough', p.rough); setSlider('glow', p.glow);
    let recolor = false;
    if (p.colors && (tab === 'text' || P.colorMode !== 'original')) {
      P.colorMode = 'gradient'; $('colorMode').value = 'gradient';
      P.colorA = p.colors[0]; P.colorB = p.colors[1]; $('colorA').value = p.colors[0]; $('colorB').value = p.colors[1];
      syncVisibility(); recolor = true;
    }
    if (viewer) viewer.setMaterial({ metallic: P.metal, roughness: P.rough, glow: P.glow });
    dockMsg('Preset ' + p.label + (p.colors && !recolor ? ' dipakai (warna asli logo dipertahankan).' : ' dipakai.'));
    if (recolor) schedule(0);
  }
  function fillPresets() {
    const box = $('presets');
    for (const p of PRESETS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = p.label;
      b.addEventListener('click', () => applyPreset(p));
      box.appendChild(b);
    }
  }

  // Tema terang/gelap dikendalikan navbar website (shared.js, kunci localStorage 'saltoria-theme').
  // Studio cukup menyesuaikan warna browser dan menggambar ulang pratinjau saat tema berganti.
  function onSiteTheme() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#06060A');
    if (viewer) viewer.redraw();
  }
  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
      else dockMsg('Browser ini tidak mendukung layar penuh.');
    } catch (e) { dockMsg('Layar penuh ditolak browser.'); }
  }

  /* ---------------- palet perintah ---------------- */
  function commands() {
    const list = [
      ['Buka tab Logo / gambar', 'tab', () => setTab('logo')], ['Buka tab Teks 3D', 'tab', () => setTab('text')],
      ['Buka tab Desain sendiri', 'tab', () => setTab('draw')], ['Buka tab Modeler 3D', 'tab', () => setTab('maker')],
      ['Unduh .glb', 'unduh', downloadGLB], ['Unduh .obj + texture', 'unduh', downloadOBJ], ['Unduh .stl', 'unduh', downloadSTL],
      ['Simpan gambar .png transparan', 'unduh', downloadPNG], ['Rekam putar .webm', 'unduh', recordWebM], ['Salin teks OBJ', 'unduh', copyOBJ],
      ['Tampak depan', 'tampilan', () => setView('front')], ['Tampak kanan', 'tampilan', () => setView('right')], ['Tampak atas', 'tampilan', () => setView('top')],
      ['Tampak isometrik', 'tampilan', () => setView('iso')], ['Reset tampilan', 'tampilan', () => $('btn-reset').click()],
      ['Ganti ortho / perspektif', 'tampilan', () => $('btn-proj').click()], ['Layar penuh', 'tampilan', toggleFullscreen],
      ['Ganti tema terang / gelap', 'tema', () => { const b = $('theme-btn'); if (b) b.click(); }],
      ['Pakai logo Saltoria', 'sumber', () => $('use-default').click()],
    ];
    // tool Saltoria lain (daftar dari shared.js) supaya bisa berpindah tanpa keluar dari keyboard
    const tools = window.SaltoriaTools || [], res = (window.SaltoriaShared && window.SaltoriaShared.resolveHref) || ((h) => h);
    for (const t of tools) if (!/3d-studio/.test(t.href)) list.push(['Buka tool: ' + t.name, 'tool', () => { location.href = res(t.href); }]);
    list.push(['Ke beranda Saltoria', 'tool', () => { location.href = res('index.html'); }]);
    for (const p of PRESETS) list.push(['Preset material: ' + p.label, 'material', () => applyPreset(p)]);
    return list;
  }
  function setupPalette() {
    const dlg = $('palette'), q = $('palette-q'), ul = $('palette-list');
    let items = [], sel = 0;
    const draw = () => {
      const t = q.value.trim().toLowerCase();
      items = commands().filter((c) => !t || (c[0] + ' ' + c[1]).toLowerCase().includes(t));
      sel = Math.min(sel, Math.max(0, items.length - 1));
      ul.textContent = '';
      items.forEach((c, i) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i === sel));
        const a = document.createElement('span'); a.textContent = c[0];
        const b = document.createElement('small'); b.textContent = c[1];
        li.append(a, b);
        li.addEventListener('click', () => run(i));
        ul.appendChild(li);
      });
      if (!items.length) { const li = document.createElement('li'); li.textContent = 'Tidak ada perintah yang cocok.'; ul.appendChild(li); }
    };
    const run = (i) => { const c = items[i]; if (!c) return; dlg.close(); c[2](); };
    const open = () => { if (dlg.open) return; q.value = ''; sel = 0; draw(); if (dlg.showModal) dlg.showModal(); q.focus(); };
    q.addEventListener('input', () => { sel = 0; draw(); });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    $('btn-palette').addEventListener('click', open);
    window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); } });
  }

  /* ---------------- mulai ---------------- */
  async function init() {
    fillFonts();
    fillColorModes();
    fillPresets();
    bindControls();
    setupPalette();
    $('btn-full').addEventListener('click', toggleFullscreen);
    $('target').addEventListener('change', (e) => setTarget(e.target.value));
    try { const tg = localStorage.getItem('saltoria3d.target'); if (tg && TARGETS[tg]) setTarget(tg, true); } catch (e) { /* abaikan */ }
    document.addEventListener('fullscreenchange', () => $('btn-full').setAttribute('aria-pressed', String(!!document.fullscreenElement)));
    window.addEventListener('saltoria-theme', onSiteTheme);
    onSiteTheme();
    if ('ResizeObserver' in window) new ResizeObserver(() => document.documentElement.style.setProperty('--dock-h', document.querySelector('.dock').offsetHeight + 'px')).observe(document.querySelector('.dock'));
    try { viewer = window.S3DViewer.create($('view')); } catch (e) { console.warn('WebGL gagal:', e); viewer = null; }
    setupAxis();
    if (viewer && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) $('btn-auto').setAttribute('aria-pressed', 'false');
    setDownloads(false);
    try {
      await setLogoFromUrl(BASE + 'assets/saltoria-logo.png', 'Logo Saltoria Community');
      schedule(0);
    } catch (e) {
      setNotice([{ err: true, msg: 'Logo bawaan tidak bisa dimuat. Pilih gambar sendiri untuk mulai.' }]);
    }
  }

  window.S3DApp = { state: P, get draw() { return draw; }, onSiteTheme, applyPreset, setView, update, get current() { return current; }, setTab, get tab() { return tab; }, get viewer() { return viewer; }, get maker() { return maker; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
