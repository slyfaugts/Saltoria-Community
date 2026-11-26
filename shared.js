/*!
 * Saltoria Shared — dipakai di index.html & semua tools/*.html
 * Fitur: Command Palette (Ctrl/Cmd+K), Recently Used Tools tracker, aria-label auto-patch.
 * Self-contained: style di-inject sendiri (prefix "sk-cmdk-") biar nggak bentrok sama CSS tiap tool page.
 */
(function () {
  'use strict';

  // ── REGISTRY: source of truth buat semua tool (dipakai command palette + recently-used) ──
  var TOOLS = [
    { name: 'Audio Optimizer',      sub: 'Convert · Normalize · Upload ke Roblox',   icon: '🎙️', href: 'tools/audio-optimizer.html',      category: 'Converter'  },
    { name: 'Skybox Converter',     sub: 'Panorama 360° → 6 face skybox',            icon: '🌌', href: 'tools/skybox-converter.html',     category: 'Converter'  },
    { name: 'Loot Table Calc',      sub: 'Weighted random + simulasi drop',          icon: '🎲', href: 'tools/loot-table-calc.html',      category: 'Calculator' },
    { name: 'Script Header Gen',    sub: 'Generate comment header profesional',      icon: '📄', href: 'tools/script-header-gen.html',    category: 'Generator'  },
    { name: 'Gradient Generator',   sub: 'UIGradient siap pakai buat Roblox GUI',    icon: '🔮', href: 'tools/gradient-generator.html',   category: 'Generator'  },
    { name: 'Asset Permission',     sub: 'Izin pakai aset Audio · Animasi · Decal',  icon: '🔑', href: 'tools/asset-permission.html',     category: 'Manager'    },
    { name: 'DataStore Manager',    sub: 'Explorer · Editor · Migrasi · Backup',     icon: '🗄️', href: 'tools/datastore-manager.html',    category: 'Manager'    },
    { name: 'Lua Obfuscator',       sub: 'Rename + enkripsi string, tanpa loadstring', icon: '🔒', href: 'tools/lua-obfuscator.html',      category: 'Security'   },
    { name: '3D Studio',            sub: 'Logo · Teks · Modeler → GLB / OBJ / STL',  icon: '🧊', href: 'tools/3d-studio.html',            category: '3D'         },
    { name: 'Shirt Generator',      sub: 'Classic Shirt & Pants · 585×559 PNG',      icon: '👕', href: 'tools/shirt-generator.html',      category: 'Generator'  },
    { name: 'Sprite Sheet',         sub: 'Video / GIF → sprite sheet + kode Luau',   icon: '🎞️', href: 'tools/sprite-sheet.html',         category: 'Converter'  },
    { name: 'Material Generator',   sub: 'Color · Normal · Roughness · Metalness',   icon: '🧱', href: 'tools/material-generator.html',   category: 'Generator'  },
    { name: 'Discord & Text Tools', sub: 'Font · Format · Timestamp · Template',     icon: '💬', href: 'tools/discord-text-tools.html',   category: 'Generator'  },
    { name: 'Batch Uploader',       sub: 'Upload banyak asset + ekspor Asset ID',    icon: '📤', href: 'tools/batch-uploader.html',       category: 'Manager'    },
    { name: 'Animation Studio',     sub: 'Keyframe R6/R15 · Preview 3D · Upload',    icon: '🏃', href: 'tools/animation-studio.html',     category: '3D'         }
  ];
  window.SaltoriaTools = TOOLS;

  var ON_TOOL_PAGE = /\/tools\//.test(location.pathname);
  // Halaman yang punya palet perintah sendiri (mis. 3D Studio) memakai Ctrl+K untuk palet itu.
  // Pencarian tool tetap bisa dibuka lewat tombol "Cari tool" di navbar.
  var OWN_PALETTE = document.documentElement.hasAttribute('data-own-palette');
  function resolveHref(rootRelativeHref) {
    return ON_TOOL_PAGE ? '../' + rootRelativeHref : rootRelativeHref;
  }
  function homeHref() {
    return ON_TOOL_PAGE ? '../index.html' : 'index.html';
  }

  // ── RECENTLY USED TRACKER ──
  var RECENT_KEY = 'saltoria-recent';
  var MAX_RECENT = 6;

  function getRecentHrefs() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function trackCurrentTool() {
    if (!ON_TOOL_PAGE) return;
    var strip = function (p) { return p.split('/').pop().replace(/\.html$/, ''); };
    var file = strip(location.pathname);
    var match = TOOLS.find(function (t) { return strip(t.href) === file; });
    if (!match) return;
    var recent = getRecentHrefs().filter(function (h) { return h !== match.href; });
    recent.unshift(match.href);
    recent = recent.slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }

  function getRecentTools() {
    return getRecentHrefs()
      .map(function (h) { return TOOLS.find(function (t) { return t.href === h; }); })
      .filter(Boolean);
  }
  window.SaltoriaShared = { getRecentTools: getRecentTools, resolveHref: resolveHref };

  // ── COMMAND PALETTE (Ctrl/Cmd+K) ──
  var paletteEl = null, inputEl = null, listEl = null, activeIndex = 0, filteredTools = TOOLS.slice();

  function injectStyle() {
    var css = '.sk-cmdk-overlay{position:fixed;inset:0;background:rgba(4,4,10,.7);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:12vh 1.25rem 2rem;font-family:Inter,sans-serif}' +
      '.sk-cmdk-overlay.sk-hidden{display:none}' +
      '.sk-cmdk-box{width:100%;max-width:560px;background:var(--surface,#0D0D15);border:1px solid var(--border,rgba(255,255,255,.08));border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.6);overflow:hidden}' +
      '.sk-cmdk-input-wrap{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border,rgba(255,255,255,.06))}' +
      '.sk-cmdk-input-wrap svg{flex-shrink:0;color:var(--muted,#8B87A6)}' +
      '.sk-cmdk-input{flex:1;background:none;border:none;outline:none;color:var(--text,#F2F0FC);font-family:Inter,sans-serif;font-size:14px}' +
      '.sk-cmdk-input::placeholder{color:var(--muted,#8B87A6)}' +
      '.sk-cmdk-esc{font-family:"JetBrains Mono",monospace;font-size:9px;color:var(--muted,#8B87A6);border:1px solid var(--border-strong,rgba(255,255,255,.1));padding:3px 7px;border-radius:5px}' +
      '.sk-cmdk-list{max-height:360px;overflow-y:auto;padding:8px}' +
      '.sk-cmdk-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;color:var(--text,#F2F0FC);text-decoration:none}' +
      '.sk-cmdk-item.sk-active{background:rgba(124,92,252,.15)}' +
      '.sk-cmdk-icon{width:32px;height:32px;border-radius:8px;background:rgba(124,92,252,.12);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}' +
      '.sk-cmdk-name{font-size:13px;font-weight:600}' +
      '.sk-cmdk-sub{font-size:11px;color:var(--muted,#8B87A6);margin-top:1px}' +
      '.sk-cmdk-empty{padding:2rem;text-align:center;color:var(--muted,#8B87A6);font-size:13px}' +
      '.sk-cmdk-trigger{display:inline-flex;align-items:center;gap:6px;background:none;border:1px solid var(--border,rgba(255,255,255,.08));color:var(--muted,#8B87A6);border-radius:8px;padding:6px 10px;font-size:11px;font-family:"JetBrains Mono",monospace;cursor:pointer;transition:all .2s}' +
      '@media(max-width:600px){.sk-cmdk-trigger span{display:none}}' +
      '.sk-cmdk-trigger:hover{color:var(--accent2,#C3B4FF);border-color:rgba(195,180,255,.3)}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildPalette() {
    paletteEl = document.createElement('div');
    paletteEl.className = 'sk-cmdk-overlay sk-hidden';
    paletteEl.innerHTML =
      '<div class="sk-cmdk-box">' +
        '<div class="sk-cmdk-input-wrap">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' +
          '<input class="sk-cmdk-input" type="text" placeholder="Cari tool... (nama atau kategori)" aria-label="Cari tool">' +
          '<span class="sk-cmdk-esc">ESC</span>' +
        '</div>' +
        '<div class="sk-cmdk-list"></div>' +
      '</div>';
    document.body.appendChild(paletteEl);
    inputEl = paletteEl.querySelector('.sk-cmdk-input');
    listEl = paletteEl.querySelector('.sk-cmdk-list');

    paletteEl.addEventListener('click', function (e) { if (e.target === paletteEl) closePalette(); });
    inputEl.addEventListener('input', function () { renderList(inputEl.value); });
    inputEl.addEventListener('keydown', handleKeyNav);
  }

  function renderList(query) {
    query = (query || '').toLowerCase().trim();
    filteredTools = TOOLS.filter(function (t) {
      return !query || t.name.toLowerCase().includes(query) || t.category.toLowerCase().includes(query) || t.sub.toLowerCase().includes(query);
    });
    activeIndex = 0;
    if (!filteredTools.length) {
      listEl.innerHTML = '<div class="sk-cmdk-empty">Tidak ada tool yang cocok 🔍</div>';
      return;
    }
    listEl.innerHTML = filteredTools.map(function (t, i) {
      return '<a class="sk-cmdk-item' + (i === 0 ? ' sk-active' : '') + '" href="' + resolveHref(t.href) + '" data-i="' + i + '">' +
        '<span class="sk-cmdk-icon">' + t.icon + '</span>' +
        '<span><span class="sk-cmdk-name">' + t.name + '</span><br><span class="sk-cmdk-sub">' + t.sub + '</span></span>' +
      '</a>';
    }).join('');
  }

  function handleKeyNav(e) {
    var items = listEl.querySelectorAll('.sk-cmdk-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIndex + 1, items.length - 1), items); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0), items); }
    else if (e.key === 'Enter') { e.preventDefault(); items[activeIndex].click(); }
  }
  function setActive(i, items) {
    items.forEach(function (el) { el.classList.remove('sk-active'); });
    activeIndex = i;
    items[i].classList.add('sk-active');
    items[i].scrollIntoView({ block: 'nearest' });
  }

  function openPalette() {
    if (!paletteEl) buildPalette();
    paletteEl.classList.remove('sk-hidden');
    inputEl.value = '';
    renderList('');
    setTimeout(function () { inputEl.focus(); }, 10);
  }
  function closePalette() {
    if (paletteEl) paletteEl.classList.add('sk-hidden');
  }
  window.SaltoriaOpenPalette = openPalette;

  function injectTrigger() {
    var nav = document.querySelector('nav');
    if (!nav) return;
    var btn = document.createElement('button');
    btn.className = 'sk-cmdk-trigger';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Buka pencarian cepat tool (Ctrl+K)');
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Cari tool' + (OWN_PALETTE ? '' : ' <span style="opacity:.6">Ctrl K</span>') + '';
    btn.addEventListener('click', openPalette);
    var navRight = nav.querySelector('.nav-right') || nav.querySelector('.nav-back') || nav;
    if (nav.hasAttribute('data-tool') && navRight.classList.contains('nav-right')) navRight.insertBefore(btn, navRight.firstChild);
    else if (navRight.parentElement === nav && navRight !== nav) nav.insertBefore(btn, navRight);
    else nav.appendChild(btn);
  }


  // ── NAVBAR + TEMA (khusus halaman tool) ──
  // Markup navbar dibuat di sini supaya SAMA dengan landing page & cukup diubah di satu tempat.
  // Pemakaian di halaman tool:  <nav id="main-nav" data-tool="NAMA TOOL"></nav>
  var THEME_KEY = 'saltoria-theme';
  var NAV_LINKS = [
    ['Projects', 'projects'], ['Tools', 'tools'], ['Store', 'store'], ['Maps', 'maps'],
    ['Jasa Map', 'jasa-map'], ['Free Assets', 'free-assets.html', true],
    ['Team', 'team'], ['Partners', 'partners']
  ];
  // entri ber-flag true (indeks 2) = halaman sendiri, bukan anchor di index.html
  function navHref(l) { return l[2] ? '../' + l[1] : '../index.html#' + l[1]; }
  var ICON_ROBLOX  = '<svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M117.3 0L0 394.7 394.7 512 512 117.3zm166.1 311.9l-94.3-27.5 27.6-94.3 94.3 27.6z"/></svg>';
  var ICON_DISCORD = '<svg width="14" height="14" viewBox="0 0 71 55" fill="currentColor" aria-hidden="true"><path d="M60.1 4.9A58.5 58.5 0 0045.7.6a.22.22 0 00-.23.11 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0 37.4 37.4 0 00-1.83-3.7.23.23 0 00-.23-.11 58.3 58.3 0 00-14.4 4.3.21.21 0 00-.09.08C1.58 18.7-.96 32.1.3 45.3a.24.24 0 00.09.17 58.8 58.8 0 0017.7 8.9.23.23 0 00.25-.08 42 42 0 003.6-5.9.22.22 0 00-.12-.31 38.7 38.7 0 01-5.5-2.6.23.23 0 01-.02-.37c.37-.28.74-.57 1.1-.86a.22.22 0 01.23-.03c11.55 5.27 24.06 5.27 35.47 0a.22.22 0 01.23.03l1.1.86a.23.23 0 01-.02.37 36.2 36.2 0 01-5.52 2.6.23.23 0 00-.12.32 47.1 47.1 0 003.6 5.88.22.22 0 00.25.09 58.6 58.6 0 0017.73-8.9.23.23 0 00.09-.16c1.5-15.45-2.5-28.88-10.58-40.78a.18.18 0 00-.09-.09zM23.7 37.3c-3.5 0-6.38-3.22-6.38-7.17s2.82-7.17 6.38-7.17c3.59 0 6.44 3.25 6.38 7.17 0 3.95-2.82 7.17-6.38 7.17zm23.6 0c-3.5 0-6.38-3.22-6.38-7.17s2.82-7.17 6.38-7.17c3.59 0 6.44 3.25 6.38 7.17 0 3.95-2.79 7.17-6.38 7.17z"/></svg>';
  var ICON_MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var ICON_SUN  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  function isLight() { return document.documentElement.classList.contains('light-mode'); }

  function syncThemeIcon() {
    var btn = document.getElementById('theme-btn');
    if (btn) btn.innerHTML = isLight() ? ICON_SUN : ICON_MOON;
  }

  function applyTheme(light) {
    document.documentElement.classList.toggle('light-mode', light);
    if (document.body) document.body.classList.toggle('light-mode', light);
    syncThemeIcon();
    window.dispatchEvent(new Event('saltoria-theme'));
  }

  function toggleTheme() {
    var light = !isLight();
    try { localStorage.setItem(THEME_KEY, light ? 'light' : 'dark'); } catch (e) {}
    applyTheme(light);
  }

  function buildNav() {
    var nav = document.getElementById('main-nav');
    if (!nav || !nav.hasAttribute('data-tool')) return false;
    var label = nav.getAttribute('data-tool');
    var links = NAV_LINKS.map(function (l) {
      var active = l[1] === 'tools' ? ' class="active"' : '';
      return '<li><a href="' + navHref(l) + '"' + active + '>' + l[0] + '</a></li>';
    }).join('');
    var mobile = NAV_LINKS.map(function (l) {
      var active = l[1] === 'tools' ? ' class="active"' : '';
      return '<a href="' + navHref(l) + '"' + active + '>' + l[0] + '</a>';
    }).join('');

    nav.innerHTML =
      '<a href="../index.html" class="nav-logo-wrap">' +
        '<img src="../assets/logo.png" alt="Saltoria" class="nav-logo" onerror="this.style.display=\'none\'">' +
        '<span class="nav-logo-text">SALT<span>ORIA</span></span>' +
        (label ? '<span class="nav-tool-label">' + label + '</span>' : '') +
      '</a>' +
      '<ul class="nav-links">' + links + '</ul>' +
      '<div class="nav-right">' +
        '<button class="theme-btn" id="theme-btn" type="button" title="Dark/Light mode" aria-label="Ganti tema terang/gelap"></button>' +
        '<div class="nav-social-btns">' +
          '<a href="https://www.roblox.com/share/g/209723897" target="_blank" rel="noopener" class="nav-roblox" title="Roblox Group">' + ICON_ROBLOX + ' Roblox</a>' +
          '<a href="https://discord.gg/VRQFamarnW" target="_blank" rel="noopener" class="nav-discord">' + ICON_DISCORD + ' Discord</a>' +
        '</div>' +
      '</div>' +
      '<button class="hamburger" id="hamburger" type="button" aria-label="Buka menu navigasi" aria-expanded="false" aria-controls="mobileMenu"><span></span><span></span><span></span></button>';

    var menu = document.createElement('div');
    menu.className = 'mobile-menu';
    menu.id = 'mobileMenu';
    menu.innerHTML = mobile +
      '<div class="mobile-social-btns">' +
        '<a href="https://www.roblox.com/share/g/209723897" target="_blank" rel="noopener" class="mobile-roblox-btn">' + ICON_ROBLOX + ' Roblox Group</a>' +
        '<a href="https://discord.gg/VRQFamarnW" target="_blank" rel="noopener" class="mobile-discord-btn">' + ICON_DISCORD + ' Join Discord</a>' +
      '</div>';
    nav.insertAdjacentElement('afterend', menu);

    var burger = document.getElementById('hamburger');
    function setMenu(open) {
      burger.classList.toggle('open', open);
      menu.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    }
    burger.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });

    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
    // selaraskan dengan pilihan tema di tab/halaman lain
    window.addEventListener('storage', function (e) {
      if (e.key === THEME_KEY) applyTheme(e.newValue === 'light');
    });
    // tema tersimpan (kelas di <html> sudah dipasang lebih awal oleh script kecil di <head>)
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(saved === 'light');
    return true;
  }

  // ── ARIA-LABEL AUTO-PATCH ──
  function patchAria() {
    var map = {
      'mute-btn': 'Toggle suara latar',
      'theme-btn': 'Ganti tema terang/gelap'
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.getAttribute('aria-label')) el.setAttribute('aria-label', map[id]);
    });
    document.querySelectorAll('.hamburger').forEach(function (el) {
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Buka menu navigasi');
    });
  }

  // ── INIT ──
  function init() {
    injectStyle();
    buildNav();
    injectTrigger();
    patchAria();
    trackCurrentTool();
    document.addEventListener('keydown', function (e) {
      var isK = e.key === 'k' || e.key === 'K';
      if ((e.metaKey || e.ctrlKey) && isK && !OWN_PALETTE) { e.preventDefault(); openPalette(); }
      else if (e.key === 'Escape') closePalette();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
