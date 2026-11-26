/* Saltoria — render halaman Free Assets dari data/free-assets-data.js */
(function () {
  'use strict';
  var MODEL_VIEWER_SRC = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
  var ICON = { Model: '🧊', Script: '📜', UI: '🖼️', Template: '📐', Map: '🗺️', Audio: '🎵', Resource: '📦' };
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* ── URL helpers (dipakai juga oleh tes) ── */
  function safeUrl(u, base) {
    if (!u || typeof u !== 'string') return null;
    try { var x = new URL(u, base || location.href); return (x.protocol === 'https:' || x.protocol === 'http:') ? x : null; } catch (e) { return null; }
  }
  function driveId(u) {
    var m = /drive\.google\.com\/file\/d\/([\w-]{10,})/.exec(u) || /drive\.google\.com\/(?:open|uc)\?[^#]*\bid=([\w-]{10,})/.exec(u) || /docs\.google\.com\/uc\?[^#]*\bid=([\w-]{10,})/.exec(u);
    return m ? m[1] : null;
  }
  // → { href, kind: 'file'|'drive'|'drive-folder'|'mediafire'|'external', host, download }
  function resolveDownload(raw, base) {
    var x = safeUrl(raw, base); if (!x) return null;
    var host = x.hostname.replace(/^www\./, ''), same = x.origin === (base ? new URL(base).origin : location.origin);
    if (/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/.test(host)) {
      if (/\/drive\/(u\/\d+\/)?folders\//.test(x.pathname)) return { href: x.href, kind: 'drive-folder', host: 'Google Drive', download: false };
      var id = driveId(x.href);
      if (id) return { href: 'https://drive.google.com/uc?export=download&id=' + id, kind: 'drive', host: 'Google Drive', download: false };
      return { href: x.href, kind: 'external', host: 'Google Drive', download: false };
    }
    if (/(^|\.)mediafire\.com$/.test(host)) return { href: x.href, kind: 'mediafire', host: 'MediaFire', download: false };
    if (same) return { href: x.href, kind: 'file', host: 'Langsung', download: true };
    return { href: x.href, kind: 'external', host: host, download: false };
  }
  window.FA_UTIL = { driveId: driveId, resolveDownload: resolveDownload, safeUrl: safeUrl };

  function dlButton(d, primary, small) {
    var r = resolveDownload(d.url); if (!r) return null;
    var a = el('a', 'fa-btn' + (primary ? '' : ' sec') + (small ? ' sm' : ''));
    a.href = r.href;
    if (r.download) { a.setAttribute('download', ''); } else { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.appendChild(document.createTextNode((r.kind === 'file' || r.kind === 'drive' ? '⬇ ' : '↗ ') + (d.label || 'Download')));
    var h = el('span', 'fa-host', r.kind === 'file' ? '' : r.host); if (h.textContent) a.appendChild(h);
    return a;
  }

  var DATA = (window.FREE_ASSETS && window.FREE_ASSETS.items) || [];
  var state = { q: '', cat: 'Semua' };

  function matches(a) {
    if (state.cat !== 'Semua' && a.category !== state.cat) return false;
    if (!state.q) return true;
    var hay = [a.title, a.description, a.category, (a.tags || []).join(' ')].join(' ').toLowerCase();
    return state.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }
  function thumbNode(a) {
    var t = el('div', 'fa-thumb'), th = a.thumb && safeUrl(a.thumb);
    t.textContent = ICON[a.category] || '📦';
    if (th) { var img = new Image(); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.onload = function () { t.textContent = ''; t.appendChild(img); }; img.src = th.href; }
    return t;
  }
  function card(a) {
    var c = el('article', 'fa-card'), t = thumbNode(a);
    t.addEventListener('click', function () { openDetail(a); }); t.style.cursor = 'pointer';
    var b = el('div', 'fa-body'), m = el('div', 'fa-meta');
    m.appendChild(el('span', 'fa-pill cat', a.category || 'Resource'));
    if (a.license) m.appendChild(el('span', 'fa-pill', a.license));
    b.appendChild(m); b.appendChild(el('h3', '', a.title || 'Tanpa judul'));
    if (a.description) b.appendChild(el('p', '', a.description));
    var acts = el('div', 'fa-acts');
    var first = (a.downloads || []).map(function (d) { return dlButton(d, true); }).filter(Boolean)[0];
    if (first) acts.appendChild(first);
    var det = el('button', 'fa-btn sec', 'Detail & Preview'); det.type = 'button'; det.addEventListener('click', function () { openDetail(a); }); acts.appendChild(det);
    b.appendChild(acts); c.appendChild(t); c.appendChild(b); return c;
  }
  function renderChips() {
    var cats = ['Semua'].concat(DATA.map(function (a) { return a.category; }).filter(function (c, i, arr) { return c && arr.indexOf(c) === i; }));
    var box = $('chips'); box.textContent = ''; if (cats.length < 2) return;
    cats.forEach(function (c) { var b = el('button', 'fa-chip' + (c === state.cat ? ' on' : ''), c); b.type = 'button'; b.setAttribute('aria-pressed', c === state.cat ? 'true' : 'false'); b.addEventListener('click', function () { state.cat = c; renderChips(); render(); }); box.appendChild(b); });
  }
  function render() {
    var list = DATA.filter(matches).sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    var grid = $('grid'); grid.textContent = ''; list.forEach(function (a) { grid.appendChild(card(a)); });
    $('count').textContent = DATA.length ? list.length + ' DARI ' + DATA.length + ' ASET' : '';
    $('empty').hidden = list.length > 0;
    if (!list.length && DATA.length) { $('emptyTitle').textContent = 'Tidak ada hasil'; $('emptyText').textContent = 'Coba kata kunci lain atau pilih kategori Semua.'; $('emptyJoin').hidden = true; }
    else { $('emptyTitle').textContent = 'Belum ada aset gratis'; $('emptyText').textContent = 'Koleksi sedang disiapkan. Gabung Discord untuk jadi yang pertama tahu saat aset baru dirilis.'; $('emptyJoin').hidden = false; }
  }

  /* ── Jendela detail ── */
  var dlg = $('detail'), viewer = $('viewer'), side = $('side'), mvPromise = null;
  function loadModelViewer() {
    if (window.customElements && customElements.get('model-viewer')) return Promise.resolve();
    if (!mvPromise) mvPromise = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.type = 'module'; s.src = MODEL_VIEWER_SRC; s.onload = res; s.onerror = function () { mvPromise = null; rej(new Error('gagal')); }; document.head.appendChild(s);
    });
    return mvPromise;
  }
  function showImage(src) { viewer.textContent = ''; var im = new Image(); im.alt = ''; im.src = src; viewer.appendChild(im); }
  function showModel(src) {
    viewer.textContent = ''; var note = el('div', 'fa-vnote', 'Memuat model 3D…'); viewer.appendChild(note);
    loadModelViewer().then(function () {
      var mv = document.createElement('model-viewer'); mv.setAttribute('src', src); mv.setAttribute('camera-controls', ''); mv.setAttribute('auto-rotate', ''); mv.setAttribute('shadow-intensity', '0.8'); mv.setAttribute('touch-action', 'pan-y'); mv.setAttribute('alt', 'Preview 3D');
      viewer.textContent = ''; viewer.appendChild(mv);
    }, function () { note.textContent = 'Preview 3D tidak bisa dimuat (periksa koneksi). Gunakan foto preview atau unduh aset.'; });
  }
  function openDetail(a) {
    var thumbs = $('thumbs'); thumbs.textContent = '';
    var media = [];
    var model = a.model && safeUrl(a.model); if (model) media.push({ type: 'model', src: model.href, label: '3D' });
    (a.gallery || []).forEach(function (g, i) { var u = safeUrl(g); if (u) media.push({ type: 'img', src: u.href, label: String(i + 1) }); });
    if (!media.length && a.thumb && safeUrl(a.thumb)) media.push({ type: 'img', src: safeUrl(a.thumb).href, label: '1' });
    function pick(m, btn) { Array.prototype.forEach.call(thumbs.children, function (x) { x.classList.toggle('on', x === btn); }); if (m.type === 'model') showModel(m.src); else showImage(m.src); }
    viewer.textContent = ''; if (!media.length) viewer.appendChild(el('div', 'fa-vnote', (ICON[a.category] || '📦') + '  Belum ada preview'));
    media.forEach(function (m, i) { var b = el('button', 'fa-tb' + (i === 0 ? ' on' : ''), m.type === 'model' ? '3D' : m.label); b.type = 'button'; b.setAttribute('aria-label', m.type === 'model' ? 'Preview 3D' : 'Foto ' + m.label); b.addEventListener('click', function () { pick(m, b); }); thumbs.appendChild(b); });
    if (media.length) pick(media[0], thumbs.firstChild); thumbs.hidden = media.length < 2;

    side.textContent = '';
    var m1 = el('div', 'fa-meta'); m1.appendChild(el('span', 'fa-pill cat', a.category || 'Resource')); if (a.license) m1.appendChild(el('span', 'fa-pill', a.license)); side.appendChild(m1);
    var h = el('h2', '', a.title || ''); h.id = 'detailTitle'; side.appendChild(h);
    if (a.description) side.appendChild(el('p', 'fa-desc', a.description));
    var info = [['Versi', a.version], ['Ukuran', a.size], ['Format', a.format], ['Rilis', a.date]].filter(function (x) { return x[1]; });
    if (info.length) { var dl = el('dl', 'fa-info'); info.forEach(function (x) { dl.appendChild(el('dt', '', x[0])); dl.appendChild(el('dd', '', x[1])); }); side.appendChild(dl); }
    if ((a.tags || []).length) { var tg = el('div', 'fa-tags'); a.tags.forEach(function (t) { tg.appendChild(el('span', 'fa-pill', '#' + t)); }); side.appendChild(tg); }
    var acts = el('div', 'fa-acts col');
    (a.downloads || []).forEach(function (d, i) { var b = dlButton(d, i === 0); if (b) acts.appendChild(b); });
    (a.links || []).forEach(function (l) { var u = safeUrl(l.url); if (!u) return; var b = el('a', 'fa-btn sec', '↗ ' + (l.label || 'Buka')); b.href = u.href; b.target = '_blank'; b.rel = 'noopener noreferrer'; acts.appendChild(b); });
    if (!acts.childNodes.length) acts.appendChild(el('p', 'fa-desc', 'Link download belum tersedia.'));
    side.appendChild(acts);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.body.classList.add('fa-lock');
  }
  function closeDetail() { viewer.textContent = ''; if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); document.body.classList.remove('fa-lock'); }
  $('detailClose').addEventListener('click', closeDetail);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDetail(); });
  dlg.addEventListener('close', function () { viewer.textContent = ''; document.body.classList.remove('fa-lock'); });
  window.FA_OPEN = openDetail;

  $('q').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
  renderChips(); render();
})();
