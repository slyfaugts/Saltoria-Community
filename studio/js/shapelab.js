/*
 * Saltoria 3D Studio — Lab Bentuk: dialog untuk Lathe (putar profil) dan Sweep (sapu profil sepanjang jalur).
 * Profil digambar di kanvas: klik menambah titik, seret memindahkan, klik kanan / dobel-klik menghapus.
 */
(function (root) {
  'use strict';
  const L = root.S3DLathe;
  const PROFILES = {
    persegi: [[-0.15, -0.15], [0.15, -0.15], [0.15, 0.15], [-0.15, 0.15]],
    segitiga: [[0, 0.2], [-0.18, -0.12], [0.18, -0.12]],
    lingkaran: Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * 2 * Math.PI) * 0.15, Math.sin((i / 16) * 2 * Math.PI) * 0.15]),
    bintang: Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 0.08 : 0.2, a = (i / 10) * 2 * Math.PI; return [Math.cos(a) * r, Math.sin(a) * r]; }),
  };
  const PATHS = {
    lurus: { closed: false, pts: () => [[0, 0, 0], [0, 1, 0], [0, 2, 0]] },
    busur: { closed: false, pts: () => Array.from({ length: 16 }, (_, i) => { const a = (i / 15) * Math.PI; return [Math.cos(a) * 0.8 - 0.8, Math.sin(a) * 0.8, 0]; }) },
    cincin: { closed: true, pts: () => Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * 2 * Math.PI; return [Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9]; }) },
    spiral: { closed: false, pts: () => Array.from({ length: 80 }, (_, i) => { const a = (i / 80) * 6 * Math.PI; return [Math.cos(a) * 0.6, i / 80 * 2, Math.sin(a) * 0.6]; }) },
    simpul: { closed: true, pts: () => Array.from({ length: 80 }, (_, i) => { const a = (i / 80) * 2 * Math.PI; return [(Math.sin(a) + 2 * Math.sin(2 * a)) * 0.3, (Math.cos(a) - 2 * Math.cos(2 * a)) * 0.3, -Math.sin(3 * a) * 0.3]; }) },
  };

  function open(opt) {
    const el = opt.el;
    const prev = document.activeElement;
    const state = { tab: 'lathe', lathe: { pts: L.PRESETS.vas.map((p) => p.slice()), seg: 32, angle: 360, cap: true }, sweep: { profile: PROFILES.lingkaran.map((p) => p.slice()), path: 'spiral', taper: false, drawn: [[-0.6, 0], [-0.2, 0.6], [0.3, 0.9], [0.8, 1.6]] } };
    const back = el('div', { class: 's3d-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Lab Bentuk: Lathe dan Sweep' });
    const card = el('div', { class: 's3d-modal-card' }); back.appendChild(card);
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); if (prev && prev.focus) prev.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });

    function editor(canvas, getPts, setPts, view, onChange) {
      // view: {x0,x1,y0,y1} → piksel; titik [x,y]
      const W = canvas.width, H = canvas.height;
      const toPx = (p) => [((p[0] - view.x0) / (view.x1 - view.x0)) * W, H - ((p[1] - view.y0) / (view.y1 - view.y0)) * H];
      const toVal = (px, py) => [view.x0 + (px / W) * (view.x1 - view.x0), view.y0 + ((H - py) / H) * (view.y1 - view.y0)];
      const draw = () => {
        const g = canvas.getContext('2d'), pts = getPts(); g.clearRect(0, 0, W, H); g.fillStyle = '#0c1430'; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= 10; i++) { g.moveTo((i / 10) * W, 0); g.lineTo((i / 10) * W, H); g.moveTo(0, (i / 10) * H); g.lineTo(W, (i / 10) * H); } g.stroke();
        const o = toPx([0, 0]); g.strokeStyle = 'rgba(123,232,255,0.7)'; g.beginPath(); if (view.axisX) { g.moveTo(o[0], 0); g.lineTo(o[0], H); } if (view.axisY) { g.moveTo(0, o[1]); g.lineTo(W, o[1]); } g.stroke();
        g.strokeStyle = '#7be8ff'; g.lineWidth = 2; g.beginPath(); pts.forEach((p, i) => { const q = toPx(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); if (view.closed) g.closePath(); g.stroke();
        g.fillStyle = '#fff'; pts.forEach((p) => { const q = toPx(p); g.beginPath(); g.arc(q[0], q[1], 4, 0, 7); g.fill(); });
      };
      let drag = -1;
      const pos = (e) => { const b = canvas.getBoundingClientRect(); return [((e.clientX - b.left) / b.width) * W, ((e.clientY - b.top) / b.height) * H]; };
      const near = (px, py) => getPts().findIndex((p) => { const q = toPx(p); return Math.hypot(q[0] - px, q[1] - py) < 9; });
      const clampPt = (v) => [view.minX != null ? Math.max(view.minX, v[0]) : v[0], v[1]];
      canvas.addEventListener('pointerdown', (e) => {
        if (e.button === 2) return; const [px, py] = pos(e), i = near(px, py);
        if (i >= 0) { drag = i; canvas.setPointerCapture(e.pointerId); } else { const pts = getPts().slice(); pts.push(clampPt(toVal(px, py))); setPts(pts); drag = pts.length - 1; canvas.setPointerCapture(e.pointerId); onChange(); }
        draw();
      });
      canvas.addEventListener('pointermove', (e) => { if (drag < 0) return; const [px, py] = pos(e), pts = getPts().slice(); pts[drag] = clampPt(toVal(px, py)); setPts(pts); draw(); });
      canvas.addEventListener('pointerup', () => { if (drag >= 0) { drag = -1; onChange(); } });
      const del = (e) => { e.preventDefault(); const [px, py] = pos(e), i = near(px, py); if (i >= 0 && getPts().length > 2) { const pts = getPts().slice(); pts.splice(i, 1); setPts(pts); draw(); onChange(); } };
      canvas.addEventListener('contextmenu', del); canvas.addEventListener('dblclick', del);
      draw(); return draw;
    }

    const body = el('div', { class: 's3d-modal-body' });
    function render() {
      body.textContent = '';
      const tabs = el('div', { class: 'seg', role: 'tablist' }, [['lathe', 'Lathe (putar profil)'], ['sweep', 'Sweep (profil sepanjang jalur)']].map(([k, t]) => el('button', { type: 'button', class: 'chip', role: 'tab', text: t, 'aria-pressed': String(state.tab === k), onclick: () => { state.tab = k; render(); } })));
      body.appendChild(tabs);
      const info = el('p', { class: 'hint' }); const stat = (m) => { info.textContent = m; };
      if (state.tab === 'lathe') {
        const s = state.lathe;
        body.appendChild(el('p', { class: 'hint', text: 'Gambar sisi kanan profil (garis kiri = sumbu putar). Klik menambah titik, seret memindahkan, klik kanan menghapus. Urutan titik dari bawah ke atas.' }));
        const cv = el('canvas', { class: 'labcv', width: 300, height: 360, 'aria-label': 'Editor profil lathe' }); body.appendChild(cv);
        editor(cv, () => s.pts, (p) => { s.pts = p; }, { x0: -0.1, x1: 1.4, y0: -0.1, y1: 2.3, axisX: false, axisY: true, minX: 0 }, () => {});
        const pre = el('select', { 'aria-label': 'Contoh profil' }, [el('option', { value: '', text: 'Contoh profil…' })].concat(Object.keys(L.PRESETS).map((k) => el('option', { value: k, text: k }))));
        pre.addEventListener('change', () => { if (pre.value) { s.pts = L.PRESETS[pre.value].map((p) => p.slice()); render(); } });
        body.appendChild(pre);
        const num = (label, key, min, max, step) => { const i = el('input', { type: 'number', min, max, step, value: s[key], inputMode: 'numeric', 'aria-label': label }); i.addEventListener('input', () => { const v = parseFloat(i.value); if (isFinite(v)) s[key] = Math.max(min, Math.min(max, v)); }); return el('label', { class: 'nf' }, [el('span', { text: label }), i]); };
        body.appendChild(num('Jumlah sisi', 'seg', 3, 128, 1)); body.appendChild(num('Sudut putar (derajat)', 'angle', 10, 360, 10));
        const cap = el('input', { type: 'checkbox' }); cap.checked = s.cap; cap.addEventListener('change', () => { s.cap = cap.checked; }); body.appendChild(el('label', { class: 'nf chk' }, [cap, el('span', { text: 'Tutup ujung (bila di luar sumbu)' })]));
        body.appendChild(info);
        body.appendChild(el('div', { class: 'chiprow' }, [el('button', { type: 'button', class: 'chip primary', text: 'Buat objek', onclick: () => { try { if (s.pts.length < 2) throw new Error('Butuh minimal 2 titik profil.'); opt.onCreate(L.lathe(s.pts, s.seg, s.angle, s.cap), 'Lathe'); close(); } catch (e) { stat(e.message); } } }), el('button', { type: 'button', class: 'chip', text: 'Tutup', onclick: close })]));
      } else {
        const s = state.sweep;
        body.appendChild(el('p', { class: 'hint', text: 'Gambar penampang (bentuk potongan) lalu pilih jalur. Jalur "Gambar sendiri" dibuat di bidang depan (X-Y).' }));
        const cv = el('canvas', { class: 'labcv', width: 300, height: 220, 'aria-label': 'Editor penampang sweep' }); body.appendChild(cv);
        editor(cv, () => s.profile, (p) => { s.profile = p; }, { x0: -0.4, x1: 0.4, y0: -0.3, y1: 0.3, axisX: true, axisY: true, closed: true }, () => {});
        const pre = el('select', { 'aria-label': 'Contoh penampang' }, [el('option', { value: '', text: 'Contoh penampang…' })].concat(Object.keys(PROFILES).map((k) => el('option', { value: k, text: k }))));
        pre.addEventListener('change', () => { if (pre.value) { s.profile = PROFILES[pre.value].map((p) => p.slice()); render(); } }); body.appendChild(pre);
        const ps = el('select', { 'aria-label': 'Jalur' }, Object.keys(PATHS).concat(['gambar sendiri']).map((k) => el('option', { value: k, text: k }))); ps.value = s.path;
        ps.addEventListener('change', () => { s.path = ps.value; render(); }); body.appendChild(el('label', { class: 'nf' }, [el('span', { text: 'Jalur' }), ps]));
        if (s.path === 'gambar sendiri') { const cp = el('canvas', { class: 'labcv', width: 300, height: 260, 'aria-label': 'Editor jalur' }); body.appendChild(cp); editor(cp, () => s.drawn, (p) => { s.drawn = p; }, { x0: -1.5, x1: 1.5, y0: -0.2, y1: 2.8, axisX: false, axisY: true }, () => {}); }
        const tp = el('input', { type: 'checkbox' }); tp.checked = s.taper; tp.addEventListener('change', () => { s.taper = tp.checked; }); body.appendChild(el('label', { class: 'nf chk' }, [tp, el('span', { text: 'Mengecil ke ujung' })]));
        body.appendChild(info);
        body.appendChild(el('div', { class: 'chiprow' }, [el('button', { type: 'button', class: 'chip primary', text: 'Buat objek', onclick: () => {
          try {
            if (s.profile.length < 3) throw new Error('Penampang butuh minimal 3 titik.');
            let path, closed = false;
            if (s.path === 'gambar sendiri') { if (s.drawn.length < 2) throw new Error('Jalur butuh minimal 2 titik.'); path = s.drawn.map((p) => [p[0], p[1], 0]); } else { path = PATHS[s.path].pts(); closed = PATHS[s.path].closed; }
            opt.onCreate(L.sweep(s.profile, path, closed, s.taper && !closed ? (t) => 1 - 0.85 * t : null), 'Sweep'); close();
          } catch (e) { stat(e.message); }
        } }), el('button', { type: 'button', class: 'chip', text: 'Tutup', onclick: close })]));
      }
    }
    card.appendChild(el('h3', { text: 'Lab Bentuk' })); card.appendChild(body); render();
    document.body.appendChild(back);
    const f = back.querySelector('button'); if (f) f.focus();
  }
  root.S3DShapeLab = { open };
})(typeof self !== 'undefined' ? self : this);
