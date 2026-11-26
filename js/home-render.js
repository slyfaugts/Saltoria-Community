/* Saltoria — render data dinamis halaman utama (Store, Team, Partner, statistik, changelog).
   Data ada di data/store-data.js dan data/community-data.js — edit di sana, bukan di sini. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function icon(name) { var s = el('span', 'ms', name); s.setAttribute('aria-hidden', 'true'); return s; }

  /* ───────── harga ───────── */
  function fmtRp(n) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
  // price = harga jual, orig = harga normal (opsional), until = 'YYYY-MM-DD' akhir promo (opsional)
  function priceInfo(price, orig, until, now) {
    now = now == null ? Date.now() : now;
    if (!(price > 0)) return { kind: 'ask' };
    var hasDisc = orig > price;
    var live = hasDisc && (!until || Date.parse(until + 'T23:59:59') >= now);
    if (live) return { kind: 'promo', price: price, orig: orig, pct: Math.round((1 - price / orig) * 100), until: until || '' };
    return { kind: 'normal', price: hasDisc ? orig : price };   // promo berakhir → kembali ke harga normal
  }
  function fmtDate(s) {
    var d = new Date(s + 'T00:00:00'); if (isNaN(d)) return s;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  window.HomeUtil = { priceInfo: priceInfo, fmtRp: fmtRp };

  /* ───────── toast ───────── */
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = el('div', 'st-toast'); toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }

  /* ───────── STORE ───────── */
  var HUE = { aio: '228,190,124', mini: '124,92,252', music: '88,101,242', npc: '110,231,183', rental: '252,211,77', util: '248,113,113', service: '195,180,255' };

  function buildCard(p, cat, S) {
    var card = el('article', 'st-card' + (p.premium ? ' premium' : ''));
    card.style.setProperty('--h', HUE[cat.id] || '124,92,252');

    var th = el('div', 'st-thumb'), ph = el('div', 'st-ph'); ph.appendChild(icon(cat.icon || 'widgets')); th.appendChild(ph);
    var img = new Image(); img.alt = p.name; img.loading = 'lazy'; img.decoding = 'async';
    img.addEventListener('error', function () { img.remove(); });
    img.src = p.image || ('assets/store/' + p.id + '.jpg'); th.appendChild(img);
    card.appendChild(th);

    var body = el('div', 'st-body');
    body.appendChild(el('div', 'st-type', cat.short || cat.title));
    body.appendChild(el('h4', 'st-name', p.name));
    if (p.addon) body.appendChild(el('div', 'st-addon', '+ Add On: ' + p.addon));

    var sel = 0, priceBox = el('div', 'st-pricebox');
    function current() {
      var v = p.variants && p.variants[sel];
      return priceInfo(v && v.price > 0 ? v.price : p.price, v && v.originalPrice > 0 ? v.originalPrice : p.originalPrice, p.promoUntil);
    }
    var badge = null;
    function renderPrice() {
      var info = current(); priceBox.textContent = '';
      if (info.kind === 'ask') priceBox.appendChild(el('span', 'st-price ask', 'Cek Discord'));
      else if (info.kind === 'normal') priceBox.appendChild(el('span', 'st-price', fmtRp(info.price)));
      else {
        priceBox.appendChild(el('span', 'st-old', fmtRp(info.orig)));
        priceBox.appendChild(el('span', 'st-price', fmtRp(info.price)));
        priceBox.appendChild(el('span', 'st-off', '-' + info.pct + '%'));
        if (info.until) priceBox.appendChild(el('div', 'st-until', 'Promo sampai ' + fmtDate(info.until)));
      }
      if (badge) { badge.remove(); badge = null; }
      var txt = info.kind === 'promo' ? '-' + info.pct + '%' : (p.badge || '');
      if (txt) { badge = el('div', 'st-badge' + (info.kind === 'promo' ? ' promo' : ''), txt); th.appendChild(badge); }
    }

    if (p.variants && p.variants.length) {
      var vars = el('div', 'st-vars'); vars.setAttribute('role', 'group'); vars.setAttribute('aria-label', 'Pilih varian ' + p.name);
      p.variants.forEach(function (v, i) {
        var b = el('button', 'st-var' + (i === 0 ? ' on' : ''), v.name); b.type = 'button'; b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
        b.addEventListener('click', function () {
          sel = i; $$('.st-var', vars).forEach(function (x, j) { x.classList.toggle('on', j === i); x.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
          renderPrice();
        });
        vars.appendChild(b);
      });
      body.appendChild(vars);
    }
    body.appendChild(priceBox); renderPrice();

    var btn = el('a', 'st-btn', p.cta || 'ORDER VIA DISCORD');
    btn.href = S.discord; btn.target = '_blank'; btn.rel = 'noopener';
    btn.addEventListener('click', function () {
      var v = p.variants && p.variants[sel];
      var msg = 'Halo Saltoria, saya mau order: ' + p.name + (v ? ' (' + v.name + ')' : '') + (p.addon ? ' + ' + p.addon : '');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(msg).then(function () { toast('Pesan order disalin. Tempel di tiket Discord.'); }, function () {});
    });
    body.appendChild(btn); card.appendChild(body);
    return card;
  }

  function renderStore() {
    var S = window.STORE, root = $('#store-root'); if (!S || !root) return;
    root.textContent = '';
    var cats = S.categories.filter(function (c) { return S.products.some(function (p) { return p.cat === c.id; }); });

    var nav = el('nav', 'st-nav'); nav.setAttribute('aria-label', 'Lompat ke kategori store'); var lastGroup = null;
    cats.forEach(function (c) {
      if (c.group && c.group !== lastGroup) nav.appendChild(el('span', 'st-nav-label', c.group + ' ›'));
      if (!c.group && lastGroup) nav.appendChild(el('span', 'st-nav-label', '·'));
      lastGroup = c.group || null;
      var a = el('a', 'st-chip', c.short || c.title); a.href = '#st-' + c.id; nav.appendChild(a);
    });
    root.appendChild(nav);

    var small = window.matchMedia && window.matchMedia('(max-width:600px)').matches;
    var limit = small ? 4 : (S.perCategory > 0 ? S.perCategory : 8);   // ponsel: tampil lebih sedikit dulu
    cats.forEach(function (c) {
      var items = S.products.filter(function (p) { return p.cat === c.id; });
      var sec = el('section', 'st-cat'); sec.id = 'st-' + c.id;
      var head = el('div', 'st-cat-head'), left = el('div');
      if (c.group) left.appendChild(el('div', 'st-cat-eyebrow', c.group));
      left.appendChild(el('h3', 'st-cat-title', c.title));
      if (c.desc) left.appendChild(el('p', 'st-cat-desc', c.desc));
      head.appendChild(left); head.appendChild(el('span', 'st-count', items.length + ' item')); sec.appendChild(head);
      var grid = el('div', 'st-grid');
      items.forEach(function (p, i) { var card = buildCard(p, c, S); if (i >= limit) card.classList.add('st-extra'); grid.appendChild(card); });
      sec.appendChild(grid);
      if (items.length > limit) {
        var more = el('button', 'st-more', 'Tampilkan semua (' + items.length + ')'); more.type = 'button'; more.setAttribute('aria-expanded', 'false');
        more.addEventListener('click', function () {
          var open = sec.classList.toggle('open'); more.setAttribute('aria-expanded', open ? 'true' : 'false');
          more.textContent = open ? 'Sembunyikan' : 'Tampilkan semua (' + items.length + ')';
        });
        sec.appendChild(more);
      }
      root.appendChild(sec);
    });
  }

  /* ───────── TEAM ───────── */
  function avatar(logo, initials, alt, cls) {
    var wrap = el('div', cls || 'admin-avatar-wrap');
    var ph = el('div', 'admin-avatar-ph', initials || '?'); wrap.appendChild(ph);
    if (logo) {
      var img = new Image(); img.alt = alt || ''; img.loading = 'lazy'; img.decoding = 'async'; img.className = 'admin-avatar-img';
      img.style.cssText = 'position:absolute;inset:0'; img.addEventListener('error', function () { img.remove(); }); img.src = logo; wrap.appendChild(img);
    }
    return wrap;
  }
  function renderTeam() {
    var C = window.COMMUNITY, root = $('#team-root'); if (!C || !root) return; root.textContent = '';
    C.staff.forEach(function (g) {
      var grp = el('div', 'tm-group'); grp.appendChild(el('div', 'tm-label', g.group));
      var grid = el('div', 'tm-grid');
      g.members.forEach(function (m) {
        var card = el('div', 'admin-card' + (m.owner ? ' owner' : ''));
        card.appendChild(avatar(m.photo, m.initials || m.name.slice(0, 2).toUpperCase(), m.name));
        card.appendChild(el('div', 'admin-role', m.role));
        card.appendChild(el('div', 'admin-name', m.name));
        card.appendChild(el('div', 'admin-dc', '@' + m.username));
        if (m.alias) card.appendChild(el('div', 'admin-alias', 'aka ' + m.alias));
        grid.appendChild(card);
      });
      grp.appendChild(grid); root.appendChild(grp);
    });
  }

  /* ───────── PARTNER ───────── */
  function safeUrl(u) { try { var x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } }
  function svgUse(id) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('width', '11'); s.setAttribute('height', '11'); s.setAttribute('fill', 'currentColor');
    var u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
  }
  // inisial: satu kata → 3 huruf pertama (UAM), beberapa kata → huruf awal 2 kata (AB)
  function initials(name) {
    var w = String(name).replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '?';
    return (w.length === 1 ? w[0].slice(0, 3) : w[0][0] + w[1][0]).toUpperCase();
  }
  function renderPartners() {
    var C = window.COMMUNITY; if (!C) return;
    var root = $('#partner-root');
    if (root) {
      root.textContent = '';
      var grid = el('div', 'pt-grid');
      C.partners.forEach(function (p) {
        var card = el('div', 'partner-card official');
        var logo = el('div', 'partner-logo-wrap'); logo.style.position = 'relative';
        logo.appendChild(el('span', 'pt-initials', initials(p.name)));
        if (p.logo) { var img = new Image(); img.alt = p.name; img.loading = 'lazy'; img.decoding = 'async'; img.style.cssText = 'position:absolute;inset:0'; img.addEventListener('error', function () { img.remove(); }); img.src = p.logo; logo.appendChild(img); }
        card.appendChild(logo);
        card.appendChild(el('div', 'partner-name', p.name));
        if (p.fullName) card.appendChild(el('div', 'pt-full', p.fullName));
        card.appendChild(el('div', 'pt-status', p.status));
        var rb = safeUrl(p.roblox), dc = safeUrl(p.discord);
        if (rb || dc) {
          var btns = el('div', 'partner-btns');
          if (rb) { var a = el('a', 'partner-btn partner-btn-roblox'); a.href = rb; a.target = '_blank'; a.rel = 'noopener'; a.appendChild(svgUse('icon-roblox')); a.appendChild(document.createTextNode(' Roblox')); btns.appendChild(a); }
          if (dc) { var b = el('a', 'partner-btn partner-btn-discord'); b.href = dc; b.target = '_blank'; b.rel = 'noopener'; b.appendChild(svgUse('icon-discord')); b.appendChild(document.createTextNode(' Discord')); btns.appendChild(b); }
          card.appendChild(btns);
        }
        grid.appendChild(card);
      });
      root.appendChild(grid);
    }
    // strip "Partner" di hero
    var chips = $('.trusted-chips');
    if (chips && chips.lastElementChild) {
      var last = chips.lastElementChild; chips.textContent = '';
      C.partners.forEach(function (p) {
        var chip = el('div', 'trusted-chip');
        if (p.logo) { var im = new Image(); im.alt = ''; im.loading = 'lazy'; im.addEventListener('error', function () { im.remove(); }); im.src = p.logo; chip.appendChild(im); }
        chip.appendChild(el('span', '', p.name)); chips.appendChild(chip);
      });
      chips.appendChild(last);
    }
    // footer: tautan Discord partner (hanya yang diisi)
    var fcol = $$('.footer-col').filter(function (c) { var h = $('h4', c); return h && /links/i.test(h.textContent); })[0];
    if (fcol) C.partners.forEach(function (p) { var u = safeUrl(p.discord); if (u) { var a = el('a', '', p.name); a.href = u; a.target = '_blank'; a.rel = 'noopener'; fcol.appendChild(a); } });
  }

  /* ───────── statistik otomatis ───────── */
  function setStat(label, n) {
    var box = $$('.stat-box').filter(function (b) { var l = $('.stat-label', b); return l && l.textContent.trim() === label; })[0];
    if (box) $('.stat-num', box).setAttribute('data-count', String(n));
  }
  function autoStats() {
    var tools = $$('#tools .tool-card').length;
    var maps = $$('#maps .status-txt.active').length;
    var projects = $$('#projects .proj-badge.active').length;
    setStat('Free Tools', tools); setStat('Active Maps', maps); setStat('Core Projects', projects);
    var hs = $('.hero-status'); if (hs && tools) hs.innerHTML = '<b>●</b> Semua sistem online — ' + tools + '/' + tools + ' tools aktif';
  }

  /* ───────── changelog ringkas ───────── */
  function collapseChangelog() {
    var list = $('.changelog-list'); if (!list) return;
    var n = $$('.cl-item', list).length; if (n <= 3) return;
    list.classList.add('collapsed');
    var b = el('button', 'cl-toggle', 'Lihat semua riwayat (' + n + ')'); b.type = 'button'; b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', function () {
      var open = list.classList.toggle('collapsed') === false; b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.textContent = open ? 'Tampilkan ringkas' : 'Lihat semua riwayat (' + n + ')';
    });
    list.parentNode.insertBefore(b, list.nextSibling);
  }

  // render ulang Store saat lebar layar melewati batas ponsel (rotasi / resize)
  (function () {
    if (!window.matchMedia) return; var mq = window.matchMedia('(max-width:600px)');
    var h = function () { try { renderStore(); } catch (e) {} };
    if (mq.addEventListener) mq.addEventListener('change', h); else if (mq.addListener) mq.addListener(h);
  })();

  try { renderStore(); renderTeam(); renderPartners(); autoStats(); collapseChangelog(); }
  catch (e) { if (window.console) console.error('[home-render]', e); }
})();
