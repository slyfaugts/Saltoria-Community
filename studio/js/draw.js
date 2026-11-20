/*
 * Saltoria 3D Studio — kanvas "Desain sendiri".
 * Gambar bebas (kuas, bentuk, penghapus) di latar transparan; hasilnya dipakai sebagai sumber
 * yang sama dengan logo, lalu diekstrusi jadi 3D.
 */
(function (root) {
  'use strict';
  const SIZE = 720;
  const TOOLS = [
    ['brush', 'Kuas'], ['eraser', 'Penghapus'], ['line', 'Garis'], ['rect', 'Kotak'], ['ellipse', 'Elips'], ['tri', 'Segitiga'],
    ['star', 'Bintang'], ['heart', 'Hati'], ['hex', 'Segi enam'], ['arrow', 'Panah'], ['plus', 'Tambah'],
  ];
  const SWATCHES = ['#f2f5ff', '#6ea8ff', '#9d85ff', '#62e6ff', '#ffd166', '#ff7a90', '#7ee0a0', '#ff9f68', '#20242e'];

  function el(tag, props, kids) {
    const e = document.createElement(tag);
    if (props) for (const k of Object.keys(props)) {
      const v = props[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'data') Object.assign(e.dataset, v);
      else if (k in e) e[k] = v;
      else e.setAttribute(k, v);
    }
    if (kids) for (const c of [].concat(kids)) if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  }

  function create(host) {
    const canvas = el('canvas', { width: SIZE, height: SIZE, class: 'draw-canvas', 'aria-label': 'Kanvas gambar. Seret untuk menggambar.' });
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const st = { tool: 'brush', color: '#6ea8ff', size: 28, fill: true };
    const undoStack = [];
    let base = null, start = null, last = null, drawing = false, dirty = false, changeTimer = 0;

    function push() {
      undoStack.push(ctx.getImageData(0, 0, SIZE, SIZE));
      if (undoStack.length > 15) undoStack.shift();
      syncButtons();
    }
    function notify() {
      dirty = true;
      clearTimeout(changeTimer);
      changeTimer = setTimeout(() => host.onChange && host.onChange(), 220);
    }
    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
    }

    function shapePath(tool, a, b) {
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      ctx.beginPath();
      if (tool === 'rect') ctx.rect(x0, y0, w, h);
      else if (tool === 'ellipse') ctx.ellipse(cx, cy, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
      else if (tool === 'tri') { ctx.moveTo(cx, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath(); }
      else if (tool === 'star') {
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 0.42 : 1, ang = -Math.PI / 2 + (i * Math.PI) / 5;
          const px = cx + Math.cos(ang) * (w / 2) * r, py = cy + Math.sin(ang) * (h / 2) * r;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
      } else if (tool === 'heart') {
        ctx.moveTo(cx, y0 + h * 0.3);
        ctx.bezierCurveTo(cx, y0 - h * 0.05, x0, y0 - h * 0.05, x0, y0 + h * 0.32);
        ctx.bezierCurveTo(x0, y0 + h * 0.62, cx, y0 + h * 0.8, cx, y1);
        ctx.bezierCurveTo(cx, y0 + h * 0.8, x1, y0 + h * 0.62, x1, y0 + h * 0.32);
        ctx.bezierCurveTo(x1, y0 - h * 0.05, cx, y0 - h * 0.05, cx, y0 + h * 0.3);
        ctx.closePath();
      } else if (tool === 'hex') {
        for (let i = 0; i < 6; i++) {
          const ang = (i * Math.PI) / 3, px = cx + Math.cos(ang) * (w / 2), py = cy + Math.sin(ang) * (h / 2);
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
      } else if (tool === 'arrow') {
        const sh = h * 0.28, hx = x0 + w * 0.55;
        ctx.moveTo(x0, cy - sh); ctx.lineTo(hx, cy - sh); ctx.lineTo(hx, y0); ctx.lineTo(x1, cy); ctx.lineTo(hx, y1); ctx.lineTo(hx, cy + sh); ctx.lineTo(x0, cy + sh); ctx.closePath();
      } else if (tool === 'plus') {
        const tw = w * 0.34, th = h * 0.34;
        ctx.moveTo(cx - tw / 2, y0); ctx.lineTo(cx + tw / 2, y0); ctx.lineTo(cx + tw / 2, cy - th / 2); ctx.lineTo(x1, cy - th / 2); ctx.lineTo(x1, cy + th / 2);
        ctx.lineTo(cx + tw / 2, cy + th / 2); ctx.lineTo(cx + tw / 2, y1); ctx.lineTo(cx - tw / 2, y1); ctx.lineTo(cx - tw / 2, cy + th / 2); ctx.lineTo(x0, cy + th / 2);
        ctx.lineTo(x0, cy - th / 2); ctx.lineTo(cx - tw / 2, cy - th / 2); ctx.closePath();
      }
    }

    function paintStroke(a, b) {
      ctx.globalCompositeOperation = st.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = ctx.fillStyle = st.color; ctx.lineWidth = st.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (a.x === b.x && a.y === b.y) { ctx.beginPath(); ctx.arc(a.x, a.y, st.size / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
    }

    function paintShape(a, b) {
      ctx.putImageData(base, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = ctx.fillStyle = st.color; ctx.lineWidth = st.size * 0.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (st.tool === 'line') { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineWidth = st.size; ctx.stroke(); return; }
      shapePath(st.tool, a, b);
      if (st.fill) ctx.fill(); else { ctx.lineWidth = Math.max(6, st.size * 0.6); ctx.stroke(); }
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      push();
      drawing = true; start = last = pos(e);
      if (st.tool === 'brush' || st.tool === 'eraser') paintStroke(start, start);
      else base = ctx.getImageData(0, 0, SIZE, SIZE);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = pos(e);
      if (st.tool === 'brush' || st.tool === 'eraser') { paintStroke(last, p); last = p; }
      else paintShape(start, p);
    });
    const end = (e) => {
      if (!drawing) return;
      drawing = false;
      if (!(st.tool === 'brush' || st.tool === 'eraser') && e.type === 'pointerup') {
        const p = pos(e);
        // klik tanpa seret: stempel bentuk berukuran sedang
        if (Math.hypot(p.x - start.x, p.y - start.y) < 6) { const r = st.size * 2.2; paintShape({ x: start.x - r, y: start.y - r }, { x: start.x + r, y: start.y + r }); }
      }
      base = null; notify();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    function undo() {
      if (!undoStack.length) return;
      ctx.putImageData(undoStack.pop(), 0, 0); syncButtons(); notify();
    }
    function clearAll() {
      if (!hasContent()) return;
      push(); ctx.clearRect(0, 0, SIZE, SIZE); notify();
    }
    function hasContent() {
      const d = ctx.getImageData(0, 0, SIZE, SIZE).data;
      for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 20) return true;
      return false;
    }

    /* ---- UI ---- */
    const toolBtns = TOOLS.map(([t, l]) => el('button', { type: 'button', class: 'chip' + (t === st.tool ? ' on' : ''), text: l, data: { tool: t }, aria: {}, onclick: () => setTool(t) }));
    function setTool(t) { st.tool = t; toolBtns.forEach((b) => { b.classList.toggle('on', b.dataset.tool === t); b.setAttribute('aria-pressed', String(b.dataset.tool === t)); }); }
    toolBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === st.tool)));

    const color = el('input', { type: 'color', value: st.color, 'aria-label': 'Warna kuas' });
    color.addEventListener('input', () => { st.color = color.value; });
    const sw = el('div', { class: 'swatches' }, SWATCHES.map((c) => el('button', { type: 'button', class: 'swatch', style: 'background:' + c, 'aria-label': 'Warna ' + c, onclick: () => { st.color = c; color.value = c; } })));
    const sizeOut = el('output', { text: String(st.size) });
    const size = el('input', { type: 'range', min: 4, max: 120, step: 1, value: st.size, 'aria-label': 'Ukuran kuas' });
    size.addEventListener('input', () => { st.size = +size.value; sizeOut.textContent = size.value; size.style.setProperty('--p', ((size.value - 4) / 116) * 100 + '%'); });
    size.style.setProperty('--p', ((st.size - 4) / 116) * 100 + '%');
    const fill = el('input', { type: 'checkbox', checked: true });
    fill.addEventListener('change', () => { st.fill = fill.checked; });
    const bUndo = el('button', { type: 'button', class: 'chip', text: 'Batalkan', onclick: undo });
    const bClear = el('button', { type: 'button', class: 'chip danger', text: 'Hapus semua', onclick: clearAll });
    function syncButtons() { bUndo.disabled = !undoStack.length; }
    syncButtons();

    const card = el('section', { class: 'card', 'aria-labelledby': 'dr-h' }, [
      el('h2', { id: 'dr-h', text: 'Kanvas gambar' }),
      el('div', { class: 'draw-wrap' }, [canvas]),
      el('p', { class: 'hint', text: 'Gambar di latar kotak-kotak (transparan). Bagian yang tergambar jadi bentuk 3D. Untuk bentuk, seret dari sudut ke sudut, atau klik sekali untuk menstempel.' }),
    ]);
    const tools = el('section', { class: 'card', 'aria-labelledby': 'dr-t' }, [
      el('h2', { id: 'dr-t', text: 'Alat gambar' }),
      el('div', { class: 'btnrow' }, toolBtns),
      el('div', { class: 'ctl' }, [el('label', { text: 'Ukuran' }), sizeOut, size]),
      el('label', { class: 'field-label', text: 'Warna' }),
      el('div', { class: 'color-line' }, [color, sw]),
      el('label', { class: 'check' }, [fill, 'Isi bentuk (matikan untuk garis tepi saja)']),
      el('div', { class: 'btnrow' }, [bUndo, bClear]),
    ]);
    host.root.textContent = '';
    host.root.append(card, tools);

    return {
      canvas, undo, clear: clearAll, hasContent, setTool,
      // untuk uji
      _api: { st, push, notify },
    };
  }

  root.S3DDraw = { create, SIZE };
})(typeof self !== 'undefined' ? self : this);
