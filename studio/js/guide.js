/*
 * Saltoria 3D Studio — Panduan interaktif singkat (langkah demi langkah, bisa dilewati, muncul sekali untuk pengguna baru).
 */
(function (root) {
  'use strict';
  const KEY = 's3d-guide-done-v6';
  const STEPS = [
    { t: 'Selamat datang di Modeler', b: 'Susun bentuk 3D langsung di browser. Panduan ini hanya 7 langkah dan bisa dilewati kapan saja.' },
    { t: 'Tambah dan pilih objek', b: 'Klik kartu bentuk di panel kiri untuk menambah. Klik objek di tampilan untuk memilih; Ctrl+klik memilih lebih dari satu. Seret di luar objek untuk memutar kamera.' },
    { t: 'Geser, putar, skala (G / R / S)', b: 'Tekan G, R, atau S lalu gerakkan mouse. Tekan X, Y, atau Z untuk mengunci sumbu, ketik angka untuk nilai pasti, klik atau Enter untuk menerima, Esc untuk batal. Ctrl saat menggeser menempel ke titik objek lain.' },
    { t: 'Tab: Edit Mode', b: 'Tab masuk ke Edit Mode: pilih titik, tepi, atau muka lalu extrude (E), inset (I), bevel (B), loop cut, subdivide, gabung, hapus, dan cermin.' },
    { t: 'Sculpt dan Cat', b: 'Shift+Tab memahat dengan kuas (tarik, haluskan, gembung, geser) dan mengecat warna. Shift+P mengecat tekstur langsung di model dan mengatur UV.' },
    { t: 'Modifier, Boolean, Lathe, Sweep', b: 'Inspector punya Modifier yang bisa diubah kapan saja (cermin, gandakan, solidify, subdivisi). Menu Edit punya Boolean untuk 2 objek dan Lab Bentuk untuk Lathe/Sweep.' },
    { t: 'Tampilan dan unduh', b: 'Menu Tampilan: preset cahaya, render PNG 2× atau 4×, dan alat ukur. Selesai? Klik "Selesai & Unduh" untuk GLB, OBJ, atau STL. Panduan ini bisa dibuka lagi dari menu Tampilan.' },
  ];
  const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  const mark = () => { try { localStorage.setItem(KEY, '1'); } catch (e) { /* abaikan */ } };

  function open(el, force) {
    if (!force && seen()) return;
    if (document.querySelector('.s3d-guide')) return;
    const prev = document.activeElement; let i = 0;
    const box = el('div', { class: 's3d-guide', role: 'dialog', 'aria-label': 'Panduan singkat Modeler' });
    const title = el('h3'), body = el('p'), count = el('span', { class: 'gcount' });
    const back = el('button', { type: 'button', class: 'chip', text: 'Kembali' }), next = el('button', { type: 'button', class: 'chip primary', text: 'Lanjut' }), skip = el('button', { type: 'button', class: 'chip', text: 'Lewati' });
    box.appendChild(count); box.appendChild(title); box.appendChild(body); box.appendChild(el('div', { class: 'chiprow' }, [back, next, skip]));
    const close = () => { mark(); box.remove(); document.removeEventListener('keydown', onKey, true); if (prev && prev.focus) prev.focus(); };
    const show = () => { const s = STEPS[i]; title.textContent = s.t; body.textContent = s.b; count.textContent = (i + 1) + ' / ' + STEPS.length; back.disabled = i === 0; next.textContent = i === STEPS.length - 1 ? 'Selesai' : 'Lanjut'; };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    next.addEventListener('click', () => { if (i === STEPS.length - 1) close(); else { i++; show(); } });
    back.addEventListener('click', () => { if (i > 0) { i--; show(); } });
    skip.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    show(); document.body.appendChild(box); if (force) next.focus();
  }
  root.S3DGuide = { open, STEPS, reset() { try { localStorage.removeItem(KEY); } catch (e) { /* abaikan */ } } };
})(typeof self !== 'undefined' ? self : this);
