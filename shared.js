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
    { name: 'Anim Converter',       sub: 'Link → Command Bar script',                icon: '🎞️', href: 'tools/anim-converter.html',       category: 'Converter'  },
    { name: 'Color Converter',      sub: 'Hex/RGB → Color3 · BrickColor · HSV',      icon: '🎨', href: 'tools/color-converter.html',      category: 'Converter'  },
    { name: 'Robux Tax Calc',       sub: 'Hitung tax & penerimaan bersih',           icon: '💰', href: 'tools/robux-tax-calculator.html', category: 'Calculator' },
    { name: 'Loot Table Calc',      sub: 'Weighted random + simulasi drop',          icon: '🎲', href: 'tools/loot-table-calc.html',      category: 'Calculator' },
    { name: 'Roblox Info Lookup',   sub: 'Player · Game · Group lookup',             icon: '🔍', href: 'tools/roblox-info-lookup.html',   category: 'Lookup'     },
    { name: 'Server Status',        sub: 'Pantau status Roblox real-time',           icon: '📡', href: 'tools/server-status.html',        category: 'Lookup'     },
    { name: 'Badge Checker',        sub: 'Verifikasi badge user · bulk mode',        icon: '🏅', href: 'tools/badge-checker.html',        category: 'Lookup'     },
    { name: 'DS Key Generator',     sub: 'DataStore key builder & batch gen',        icon: '🗝️', href: 'tools/ds-key-gen.html',            category: 'Generator'  },
    { name: 'Tween Calculator',     sub: 'Generate TweenService Luau code',          icon: '✨', href: 'tools/tween-calculator.html',     category: 'Generator'  },
    { name: 'Thumbnail Generator',  sub: 'Cover game & Discord banner',              icon: '🖼️', href: 'tools/thumbnail-generator.html',  category: 'Generator'  },
    { name: 'Script Header Gen',    sub: 'Generate comment header profesional',      icon: '📄', href: 'tools/script-header-gen.html',    category: 'Generator'  },
    { name: 'Instance Tree Gen',    sub: 'Hierarki Instance → Luau code',            icon: '🌳', href: 'tools/instance-tree-gen.html',    category: 'Generator'  },
    { name: 'Gradient Generator',   sub: 'UIGradient siap pakai buat Roblox GUI',    icon: '🔮', href: 'tools/gradient-generator.html',   category: 'Generator'  },
    { name: 'Font Preview',         sub: 'Preview semua font Roblox GUI',            icon: '🔤', href: 'tools/font-preview.html',         category: 'Utility'    }
  ];
  window.SaltoriaTools = TOOLS;

  var ON_TOOL_PAGE = /\/tools\//.test(location.pathname);
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
    var file = location.pathname.split('/').pop();
    var match = TOOLS.find(function (t) { return t.href.endsWith(file); });
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
      '.sk-cmdk-box{width:100%;max-width:560px;background:#0D0D18;border:1px solid rgba(255,255,255,.08);border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.6);overflow:hidden}' +
      '.sk-cmdk-input-wrap{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.06)}' +
      '.sk-cmdk-input-wrap svg{flex-shrink:0;color:#6B7280}' +
      '.sk-cmdk-input{flex:1;background:none;border:none;outline:none;color:#F0EEFF;font-family:Inter,sans-serif;font-size:14px}' +
      '.sk-cmdk-input::placeholder{color:#6B7280}' +
      '.sk-cmdk-esc{font-family:"Space Mono",monospace;font-size:9px;color:#6B7280;border:1px solid rgba(255,255,255,.1);padding:3px 7px;border-radius:5px}' +
      '.sk-cmdk-list{max-height:360px;overflow-y:auto;padding:8px}' +
      '.sk-cmdk-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;color:#F0EEFF;text-decoration:none}' +
      '.sk-cmdk-item.sk-active{background:rgba(139,92,246,.15)}' +
      '.sk-cmdk-icon{width:32px;height:32px;border-radius:8px;background:rgba(139,92,246,.12);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}' +
      '.sk-cmdk-name{font-size:13px;font-weight:600}' +
      '.sk-cmdk-sub{font-size:11px;color:#6B7280;margin-top:1px}' +
      '.sk-cmdk-empty{padding:2rem;text-align:center;color:#6B7280;font-size:13px}' +
      '.sk-cmdk-trigger{display:inline-flex;align-items:center;gap:6px;background:none;border:1px solid rgba(255,255,255,.08);color:#6B7280;border-radius:8px;padding:6px 10px;font-size:11px;font-family:"Space Mono",monospace;cursor:pointer;transition:all .2s}' +
      '.sk-cmdk-trigger:hover{color:#C4B5FD;border-color:rgba(196,181,253,.3)}';
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
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Cari tool <span style="opacity:.6">Ctrl K</span>';
    btn.addEventListener('click', openPalette);
    var navRight = nav.querySelector('.nav-right') || nav.querySelector('.nav-back') || nav;
    if (navRight.parentElement === nav && navRight !== nav) nav.insertBefore(btn, navRight);
    else nav.appendChild(btn);
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
    injectTrigger();
    patchAria();
    trackCurrentTool();
    document.addEventListener('keydown', function (e) {
      var isK = e.key === 'k' || e.key === 'K';
      if ((e.metaKey || e.ctrlKey) && isK) { e.preventDefault(); openPalette(); }
      else if (e.key === 'Escape') closePalette();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
