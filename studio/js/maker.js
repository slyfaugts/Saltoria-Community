/*
 * Saltoria 3D Studio — editor scene "Bentuk 3D".
 * Susun banyak bangun ruang, atur posisi/rotasi/skala/warna, lalu gabungkan jadi satu mesh
 * (satu tekstur palet warna) untuk diekspor ke Roblox.
 */
(function (root) {
  'use strict';
  const Sh = root.S3DShapes;
  const MO = root.S3DMeshOps;
  const Ed = root.S3DEditMode;
  const Scu = root.S3DSculpt;
  const Pnt = root.S3DPaintMode;
  const Guide = root.S3DGuide;
  const Mods = root.S3DMods, CSG = root.S3DCSG, Lab = root.S3DShapeLab;
  const Lib = root.S3DLibrary;
  const STORE_KEY = 'saltoria3d.maker.v1';
  const TRI_LIMIT = 20000;
  const MAX_OBJECTS = 300;
  const DEG = Math.PI / 180;
  const PALETTE_COLS = 16, CELL = 16;
  const COLORS = ['#6ea8ff', '#9d85ff', '#62e6ff', '#ffd166', '#ff7a90', '#7ee0a0', '#f2f5ff', '#ff9f68'];
  const DEFAULT_FRAME = { center: [0, 2.5, 0], halfW: 9, halfH: 5.5, radius: 11 };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const hexOk = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);

  function el(tag, props, kids) {
    const e = document.createElement(tag);
    if (props) for (const k of Object.keys(props)) {
      const v = props[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'data') Object.assign(e.dataset, v);
      else if (k === 'aria') for (const a of Object.keys(v)) e.setAttribute('aria-' + a, v[a]);
      else if (k in e) e[k] = v;
      else e.setAttribute(k, v);
    }
    if (kids) for (const c of [].concat(kids)) if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  }

  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  }

  function create(host) {
    const rootEl = host.root;
    let objects = [];
    let nextId = 1, selectedId = null, colorIdx = 0, nextGroup = 1;
    let selIds = [], groups = [];
    const settings = { snap: 0.5, grid: true, drag: 'xz', metal: 0.2, rough: 0.5, glow: 0, tool: 'select', space: 'global', outline: 'shape', detail: 1 };
    const undoStack = [], redoStack = [];
    let editBase = null, editLabel = 'Ubah';
    let active = false;
    let saveTimer = 0;
    const worldCache = new Map();
    const baseCache = new Map();
    const fieldRefs = [];
    const ui = {};

    /* ------------------------------------------------------------ */
    /* Model data                                                    */
    /* ------------------------------------------------------------ */
    // Model impor: registri mesh (berindeks, sudah dinormalkan) + geometri "soup" untuk Modeler
    const meshes = new Map(); let nextMid = 1;
    const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
    const unb64 = (t) => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
    function registerMesh(welded, name, mid) {
      mid = mid || nextMid++; nextMid = Math.max(nextMid, mid + 1);
      if (welded.UV) { // mesh berUV (hasil unwrap/cat): geometri tidak diubah, tekstur cat ikut
        const nV = welded.P.length / 3, P = Float32Array.from(welded.P);
        let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < nV; i++) for (let a = 0; a < 3; a++) { const v = P[i * 3 + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
        meshes.set(mid, { name, mesh: welded, geo: { positions: P, normals: Float32Array.from(welded.N), indices: Uint32Array.from(welded.T), uvs: Float32Array.from(welded.UV), min: mn, max: mx, triangles: welded.T.length / 3 }, paint: { S: welded.S, canvas: welded.canvas } });
        return mid;
      }
      meshes.set(mid, { name, mesh: welded, geo: MO.toSoup(welded, 4, 'y', true) });
      return mid;
    }
    const meshGeo = (mid) => { const e = meshes.get(mid); if (!e) throw new Error('Model impor hilang (id ' + mid + ').'); return e.geo; };
    const meshesJSON = () => {
      const used = new Set(objects.filter((o) => o.type === 'mesh').map((o) => o.params.mid)), out = [];
      for (const mid of used) { const e = meshes.get(mid); if (!e) continue; const P = new Float32Array(e.mesh.P); out.push({ mid, name: e.name, p: b64(new Uint8Array(P.buffer)), t: b64(new Uint8Array(Uint32Array.from(e.mesh.T).buffer)), c: e.mesh.C ? b64(new Uint8Array(Uint16Array.from(e.mesh.C).buffer)) : undefined, pal: e.mesh.pal || undefined, uv: e.paint ? b64(new Uint8Array(Float32Array.from(e.mesh.UV).buffer)) : undefined, n: e.paint ? b64(new Uint8Array(Float32Array.from(e.mesh.N).buffer)) : undefined, s: e.paint ? e.paint.S : undefined, img: e.paint ? e.paint.canvas.toDataURL('image/png') : undefined }); }
      return out;
    };
    const texOk = (t) => (t && typeof t.pat === 'string' && window.S3DTextures && window.S3DTextures.list.some((p) => p.id === t.pat) && /^#[0-9a-f]{6}$/i.test(t.a) && /^#[0-9a-f]{6}$/i.test(t.b)
      ? { pat: t.pat, scale: Math.max(0.5, Math.min(4, +t.scale || 1)), a: t.a, b: t.b } : null);
    const clean = (o) => ({ id: o.id, type: o.type, name: o.name, params: o.params, pos: o.pos, rot: o.rot, scale: o.scale, color: o.color, tint: o.tint || null, tex: o.tex || null, shade: o.shade || 'asis', crease: o.crease == null ? 40 : o.crease, visible: o.visible, lock: !!o.lock, grp: o.grp || null, mods: o.mods && o.mods.length ? o.mods : undefined });
    const snapshot = () => JSON.stringify({ objects: objects.map(clean), groups, selIds, selectedId, nextId, nextGroup });

    function restore(json) {
      const d = JSON.parse(json);
      objects = d.objects; groups = d.groups || []; nextGroup = d.nextGroup || (groups.reduce((m, g) => Math.max(m, g.id), 0) + 1);
      selIds = d.selIds || (d.selectedId != null ? [d.selectedId] : []); selectedId = d.selectedId; nextId = d.nextId;
      worldCache.clear();
    }

    function beginEdit(label) { if (editBase == null) { editBase = snapshot(); editLabel = label || 'Ubah'; } }
    function commitEdit() {
      if (editBase == null) return;
      if (snapshot() !== editBase) {
        undoStack.push({ s: editBase, label: editLabel }); if (undoStack.length > 100) undoStack.shift();
        redoStack.length = 0;
        scheduleSave();
      }
      editBase = null;
      syncHistoryButtons();
    }
    function act(fn, label) { if (cm()) { host.toast('Keluar dari ' + cm().label + ' dulu (Tab).'); return; } beginEdit(label); fn(); commitEdit(); rebuild(); renderAll(); }

    function undo() {
      if (cm()) { cm().undo(); return; }
      if (editBase != null) commitEdit();
      if (!undoStack.length) return;
      const e = undoStack.pop();
      redoStack.push({ s: snapshot(), label: e.label }); restore(e.s);
      afterHistory();
    }
    function redo() {
      if (cm()) { cm().redo(); return; }
      if (!redoStack.length) return;
      const e = redoStack.pop();
      undoStack.push({ s: snapshot(), label: e.label }); restore(e.s);
      afterHistory();
    }
    function undoTo(k) { for (let i = 0; i <= k && undoStack.length; i++) undo(); }
    function afterHistory() { rebuild(); renderAll(); syncHistoryButtons(); scheduleSave(); }

    function labelFor(type, override) {
      const base = override || (type === 'prefab' ? 'Objek' : type === 'mesh' ? 'Model impor' : Sh.DEFS[type].label);
      let n = 1;
      for (const o of objects) if (o.name.indexOf(base) === 0) n++;
      return base + ' ' + n;
    }

    function rotMat(rot) {
      const rx = rot[0] * DEG, ry = rot[1] * DEG, rz = rot[2] * DEG;
      const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
      return [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx, sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx, -sy, cy * sx, cy * cx];
    }
    function matToEuler(m) {
      const ry = Math.asin(clamp(-m[6], -1, 1));
      let rx, rz;
      if (Math.abs(m[6]) < 0.99999) { rx = Math.atan2(m[7], m[8]); rz = Math.atan2(m[3], m[0]); }
      else { rx = Math.atan2(-m[5], m[4]); rz = 0; }
      return [rx / DEG, ry / DEG, rz / DEG].map((v) => Math.round(v * 100) / 100);
    }
    const matMul = (a, b) => { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]; return o; };

    function xformGeo(g, pos, rot, scale) {
      const n = g.positions.length;
      const P = new Float32Array(n), N = new Float32Array(n);
      const m = rotMat(rot);
      const S = scale.map((v) => (Math.abs(v) < 1e-4 ? (v < 0 ? -1e-4 : 1e-4) : v));
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < n; i += 3) {
        const x = g.positions[i] * S[0], y = g.positions[i + 1] * S[1], z = g.positions[i + 2] * S[2];
        const X = m[0] * x + m[1] * y + m[2] * z + pos[0], Y = m[3] * x + m[4] * y + m[5] * z + pos[1], Z = m[6] * x + m[7] * y + m[8] * z + pos[2];
        P[i] = X; P[i + 1] = Y; P[i + 2] = Z;
        if (X < min[0]) min[0] = X; if (X > max[0]) max[0] = X;
        if (Y < min[1]) min[1] = Y; if (Y > max[1]) max[1] = Y;
        if (Z < min[2]) min[2] = Z; if (Z > max[2]) max[2] = Z;
        const nx = g.normals[i] / S[0], ny = g.normals[i + 1] / S[1], nz = g.normals[i + 2] / S[2];
        const X2 = m[0] * nx + m[1] * ny + m[2] * nz, Y2 = m[3] * nx + m[4] * ny + m[5] * nz, Z2 = m[6] * nx + m[7] * ny + m[8] * nz;
        const l = Math.hypot(X2, Y2, Z2) || 1;
        N[i] = X2 / l; N[i + 1] = Y2 / l; N[i + 2] = Z2 / l;
      }
      let I = g.indices;
      if (S[0] * S[1] * S[2] < 0) { I = new Uint32Array(g.indices); for (let t = 0; t < I.length; t += 3) { const b = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = b; } }
      const out = { positions: P, normals: N, indices: I, min, max };
      if (g.uvs) out.uvs = g.uvs;
      return out;
    }

    // Kurangi jumlah segmen bentuk lengkung menurut settings.detail (1 = penuh). Bentuk bersudut tidak berubah.
    function withDetail(type, params) {
      const d = settings.detail;
      if (d >= 0.999) return params;
      const q = Object.assign({}, params);
      for (const k of ['seg', 'segR', 'segr']) if (typeof q[k] === 'number') q[k] = Math.max(k === 'segr' ? 4 : 6, Math.round(q[k] * d));
      if (typeof q.rs === 'number') q.rs = Math.max(1, Math.round(q.rs * d));
      return Sh.sanitize(type, q);
    }

    function prefabGeo(id) {
      const it = Lib && Lib.get(id);
      if (!it) throw new Error('Objek library tidak dikenal: ' + id);
      const geos = [], ranges = [];
      let nv = 0, ni = 0;
      let pk = 0;
      for (const p of it.parts) {
        const g = xformGeo(Sh.build(p.t, withDetail(p.t, p.p)), p.pos, p.rot, p.s);
        // variasi nada halus antar bagian agar permukaan sewarna tetap terbaca bentuknya
        const jt = (((pk++ * 37) % 9) - 4) / 4 * 0.05;
        ranges.push({ hex: /^#[0-9a-f]{6}$/i.test(p.c) ? mixHex(p.c, jt > 0 ? '#ffffff' : '#000000', Math.abs(jt)) : p.c, start: nv, count: g.positions.length / 3 });
        nv += g.positions.length / 3; ni += g.indices.length; geos.push(g);
      }
      const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), indices = new Uint32Array(ni);
      let vo = 0, io = 0;
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const g of geos) {
        positions.set(g.positions, vo * 3); normals.set(g.normals, vo * 3);
        for (let i = 0; i < g.indices.length; i++) indices[io + i] = g.indices[i] + vo;
        vo += g.positions.length / 3; io += g.indices.length;
        for (let a = 0; a < 3; a++) { if (g.min[a] < min[a]) min[a] = g.min[a]; if (g.max[a] > max[a]) max[a] = g.max[a]; }
      }
      const lift = -min[1];
      for (let i = 1; i < positions.length; i += 3) positions[i] += lift;
      min[1] = 0; max[1] += lift;
      return { positions, normals, indices, min, max, ranges, lift, triangles: ni / 3 };
    }

    function baseGeo(type, params) {
      const key = type + JSON.stringify(params) + '|d' + settings.detail;
      let g = baseCache.get(key);
      if (!g) { if (baseCache.size > 150) baseCache.clear(); g = type === 'mesh' ? meshGeo(params.mid) : type === 'prefab' ? prefabGeo(params.id) : Sh.build(type, withDetail(type, params)); baseCache.set(key, g); }
      return g;
    }

    function makeObject(type, over, opts) {
      opts = opts || {};
      const params = type === 'mesh' ? { mid: over.mid } : type === 'prefab' ? { id: over.id } : Sh.sanitize(type, Object.assign(Sh.defaults(type), over || {}));
      const o = {
        id: nextId++, type, params,
        name: opts.name || labelFor(type, opts.label),
        pos: opts.pos ? opts.pos.slice() : [0, 0, 0],
        rot: opts.rot ? opts.rot.slice() : [0, 0, 0],
        scale: opts.scale ? opts.scale.slice() : [1, 1, 1],
        color: opts.color || COLORS[colorIdx++ % COLORS.length],
        shade: 'asis', crease: 40,
        visible: true, lock: false, grp: null,
      };
      if (!opts.pos) o.pos[1] = -baseGeo(type, params).min[1] * o.scale[1];
      return o;
    }

    /* ------------------------------------------------------------ */
    /* Geometri dunia                                                */
    /* ------------------------------------------------------------ */
    // geometri lokal setelah modifier (di-cache menurut bentuk dasar + daftar modifier)
    function moddedGeo(o, g) {
      const k = 'md' + o.type + JSON.stringify(o.params) + JSON.stringify(o.mods) + '|d' + settings.detail;
      let r = baseCache.get(k);
      if (!r) { try { r = Mods.apply(g, o.mods); } catch (e) { host.toast('Modifier gagal: ' + e.message); r = g; } if (baseCache.size > 150) baseCache.clear(); baseCache.set(k, r); }
      return r;
    }
    function worldGeo(o) {
      const eg = edit && edit.active ? edit.geoFor(o) : null; // geometri sementara saat objek sedang diedit
      const key = JSON.stringify([o.type, o.params, o.pos, o.rot, o.scale, o.shade, o.crease, settings.detail, o.mods]) + (eg ? '|E' + eg.rev : '');
      const c = worldCache.get(o.id);
      if (c && c.key === key) return c.geo;
      let g = eg ? eg.geo : baseGeo(o.type, o.params);
      if (!eg && o.mods && o.mods.length && !g.uvs) g = moddedGeo(o, g);
      if ((o.shade === 'auto' || o.shade === 'smooth') && !g.uvs) {
        const sk = 'sm' + o.type + JSON.stringify(o.params) + JSON.stringify(o.mods || '') + o.shade + o.crease + '|d' + settings.detail;
        let sg = eg ? null : baseCache.get(sk);
        if (!sg) { sg = Sh.smoothNormals(g, o.shade === 'smooth' ? 180 : o.crease); if (!eg) baseCache.set(sk, sg); }
        g = sg;
      }
      const geo = xformGeo(g, o.pos, o.rot, o.scale);
      if (g.ranges) geo.ranges = g.ranges;
      worldCache.set(o.id, { key, geo });
      return geo;
    }

    /* ------------------------------------------------------------ */
    /* Gabung jadi satu mesh + palet warna                           */
    /* ------------------------------------------------------------ */
    function buildMerged(preview, list) {
      const vis = (list || objects).filter((o) => o.visible);
      if (!vis.length) return null;
      const cells = [], cellOf = new Map();
      const cellFor = (hex) => { let c = cellOf.get(hex); if (c == null) { c = cells.length; cellOf.set(hex, c); cells.push(hex); } return c; };
      const hl = (o, hex) => (preview && isSel(o.id) && !list ? mixHex(hex, '#7be8ff', 0.32) : hex);
      const geos = vis.map((o) => worldGeo(o));
      const picks = vis.map((o, k) => (geos[k].ranges && !o.tint ? geos[k].ranges.map((r) => cellFor(hl(o, r.hex))) : cellFor(hl(o, o.tint || o.color))));
      const rows = Math.max(1, Math.ceil(cells.length / PALETTE_COLS));

      // tekstur motif / gambar per objek: satu petak 128px per konfigurasi, diletakkan di bawah palet warna
      const paintObjs = new Map();
      vis.forEach((o, k) => { if (o.type === 'mesh' && geos[k].uvs) { const e = meshes.get(o.params.mid); if (e && e.paint && paintObjs.size < 4) paintObjs.set(k, e.paint); } });
      const TILE = 128, H0 = rows * CELL, tiles = new Map();
      vis.forEach((o) => { if (o.tex && window.S3DTextures) { const key = [o.tex.pat, o.tex.scale, o.tex.a, o.tex.b].join('|'); if (!tiles.has(key) && tiles.size < 16) tiles.set(key, { i: tiles.size, tex: o.tex }); } });
      const tilesH = Math.ceil(tiles.size / 2) * TILE;
      const pBudget = Math.max(128, Math.floor((4096 - H0 - tilesH) / Math.max(1, paintObjs.size)));
      let pY = H0 + tilesH; const paintAt = new Map();
      for (const [k, p] of paintObjs) { const es = Math.min(p.S, pBudget); paintAt.set(k, { es, oy: pY, p }); pY += es; }
      const W = Math.max(PALETTE_COLS * CELL, ...Array.from(paintAt.values()).map((q) => q.es));
      const H = pY;
      const tileOf = (o) => (o.tex && window.S3DTextures ? tiles.get([o.tex.pat, o.tex.scale, o.tex.a, o.tex.b].join('|')) : null);
      // proyeksi kotak otomatis: tiap segitiga memakai bidang sumbu terdekat dengan normalnya
      const expandTex = (g, tl) => {
        const nT = g.indices.length / 3, pos = new Float32Array(nT * 9), nor = new Float32Array(nT * 9), idx = new Uint32Array(nT * 3), uv = new Float32Array(nT * 6);
        const ox = (tl.i % 2) * TILE, oy = H0 + Math.floor(tl.i / 2) * TILE, ins = 2;
        const sz = [0, 1, 2].map((a) => Math.max(1e-6, g.max[a] - g.min[a]));
        for (let t = 0; t < nT; t++) {
          const ia = [g.indices[t * 3], g.indices[t * 3 + 1], g.indices[t * 3 + 2]];
          const p = ia.map((i) => [g.positions[i * 3], g.positions[i * 3 + 1], g.positions[i * 3 + 2]]);
          const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
          const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]].map(Math.abs);
          const ax = n[0] >= n[1] && n[0] >= n[2] ? 0 : n[1] >= n[2] ? 1 : 2, ua = ax === 0 ? 2 : 0, va = ax === 1 ? 2 : 1;
          for (let c = 0; c < 3; c++) {
            const o = t * 9 + c * 3, i = ia[c];
            pos[o] = p[c][0]; pos[o + 1] = p[c][1]; pos[o + 2] = p[c][2];
            nor[o] = g.normals[i * 3]; nor[o + 1] = g.normals[i * 3 + 1]; nor[o + 2] = g.normals[i * 3 + 2];
            const u = (p[c][ua] - g.min[ua]) / sz[ua], v = 1 - (p[c][va] - g.min[va]) / sz[va];
            uv[t * 6 + c * 2] = (ox + ins + u * (TILE - 2 * ins)) / W; uv[t * 6 + c * 2 + 1] = (oy + ins + v * (TILE - 2 * ins)) / H;
            idx[t * 3 + c] = t * 3 + c;
          }
        }
        return { positions: pos, normals: nor, indices: idx, uvs: uv, min: g.min, max: g.max };
      };
      const texd = vis.map((o, k) => { const tl = tileOf(o); return tl ? expandTex(geos[k], tl) : null; });
      const geosU = geos.map((g, k) => texd[k] || g);

      let nv = 0, ni = 0;
      for (const g of geosU) { nv += g.positions.length / 3; ni += g.indices.length; }
      const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), indices = new Uint32Array(ni);
      let vo = 0, io = 0;
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      geosU.forEach((g, k) => {
        const c = picks[k];
        const uvOf = (ci) => [((ci % PALETTE_COLS) + 0.5) * CELL / W, (Math.floor(ci / PALETTE_COLS) + 0.5) * CELL / H];
        const cnt = g.positions.length / 3;
        positions.set(g.positions, vo * 3); normals.set(g.normals, vo * 3);
        if (texd[k]) uvs.set(texd[k].uvs, vo * 2);
        else if (paintAt.has(k)) { const q = paintAt.get(k); for (let i = 0; i < cnt; i++) { uvs[(vo + i) * 2] = (g.uvs[i * 2] * q.es) / W; uvs[(vo + i) * 2 + 1] = (q.oy + g.uvs[i * 2 + 1] * q.es) / H; } }
        else if (Array.isArray(c)) g.ranges.forEach((r, ri) => { const [u, v] = uvOf(c[ri]); for (let i = r.start; i < r.start + r.count; i++) { uvs[(vo + i) * 2] = u; uvs[(vo + i) * 2 + 1] = v; } });
        else { const [u, v] = uvOf(c); for (let i = 0; i < cnt; i++) { uvs[(vo + i) * 2] = u; uvs[(vo + i) * 2 + 1] = v; } }
        for (let i = 0; i < g.indices.length; i++) indices[io + i] = g.indices[i] + vo;
        vo += cnt; io += g.indices.length;
        for (let a = 0; a < 3; a++) { if (g.min[a] < min[a]) min[a] = g.min[a]; if (g.max[a] > max[a]) max[a] = g.max[a]; }
      });

      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
      cells.forEach((hex, i) => { ctx.fillStyle = hex; ctx.fillRect((i % PALETTE_COLS) * CELL, Math.floor(i / PALETTE_COLS) * CELL, CELL, CELL); });
      for (const q of paintAt.values()) ctx.drawImage(q.p.canvas, 0, q.oy, q.es, q.es);
      for (const tl of tiles.values()) {
        const tc = document.createElement('canvas'); tc.width = TILE; tc.height = TILE;
        window.S3DTextures.draw(tl.tex.pat, tc, tl.tex.a, tl.tex.b, tl.tex.scale);
        ctx.drawImage(tc, (tl.i % 2) * TILE, H0 + Math.floor(tl.i / 2) * TILE);
      }

      return {
        mesh: { positions, normals, uvs, indices, triangles: indices.length / 3, min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], bevelFallbacks: 0, flipped: false },
        canvas,
        material: { metallic: settings.metal, roughness: settings.rough, glow: settings.glow, name: 'SaltoriaBentuk3D' },
        stats: { objects: vis.length, hidden: objects.length - vis.length },
      };
    }

    function rebuild() {
      if (!active) return;
      if (sculpt.active || paintMode.active) return; // Sculpt/Cat menampilkan objeknya sendiri
      const out = buildMerged(true);
      host.onBuild(out);
      updateOverlays();
    }

    /* ---- garis siluet mengikuti bentuk ---- */
    const silMap = new WeakMap();
    function silEdges(g) {
      if (silMap.has(g)) return silMap.get(g);
      const P = g.positions, I = g.indices, nT = I.length / 3;
      let res = null;
      if (nT <= 20000) {
        const canon = new Map(), cid = new Int32Array(P.length / 3);
        for (let v = 0; v < cid.length; v++) {
          const k = Math.round(P[v * 3] * 2000) + ',' + Math.round(P[v * 3 + 1] * 2000) + ',' + Math.round(P[v * 3 + 2] * 2000);
          let c = canon.get(k); if (c == null) { c = v; canon.set(k, v); } cid[v] = c;
        }
        const edges = new Map();
        for (let t = 0; t < nT; t++) {
          const ia = I[t * 3], ib = I[t * 3 + 1], ic = I[t * 3 + 2];
          const ax = P[ib * 3] - P[ia * 3], ay = P[ib * 3 + 1] - P[ia * 3 + 1], az = P[ib * 3 + 2] - P[ia * 3 + 2];
          const bx = P[ic * 3] - P[ia * 3], by = P[ic * 3 + 1] - P[ia * 3 + 1], bz = P[ic * 3 + 2] - P[ia * 3 + 2];
          let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
          const l = Math.hypot(nx, ny, nz); if (l < 1e-12) continue;
          nx /= l; ny /= l; nz /= l;
          const vs = [ia, ib, ic];
          for (let e = 0; e < 3; e++) {
            const a = cid[vs[e]], b = cid[vs[(e + 1) % 3]]; if (a === b) continue;
            const key = a < b ? a + '_' + b : b + '_' + a;
            const r = edges.get(key);
            if (!r) edges.set(key, { a, b, n: [nx, ny, nz], m: null, c: 1 });
            else { r.c++; if (!r.m) r.m = [nx, ny, nz]; }
          }
        }
        const out = [];
        const cosCrease = Math.cos(35 * DEG);
        for (const r of edges.values()) {
          let always = 0, n2 = r.m;
          if (!n2) { always = 1; n2 = [0, 0, 0]; }
          else if (r.n[0] * n2[0] + r.n[1] * n2[1] + r.n[2] * n2[2] < cosCrease) always = 1;
          out.push(P[r.a * 3], P[r.a * 3 + 1], P[r.a * 3 + 2], P[r.b * 3], P[r.b * 3 + 1], P[r.b * 3 + 2], r.n[0], r.n[1], r.n[2], n2[0], n2[1], n2[2], always);
          if (out.length > 13 * 60000) break;
        }
        res = new Float32Array(out);
      }
      silMap.set(g, res);
      return res;
    }

    function selBox() {
      const vis = selList().filter((o) => o.visible);
      if (!vis.length) return null;
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const o of vis) { const g = worldGeo(o); for (let a = 0; a < 3; a++) { if (g.min[a] < min[a]) min[a] = g.min[a]; if (g.max[a] > max[a]) max[a] = g.max[a]; } }
      return { min, max, c: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2] };
    }
    function boxLines(a, b) {
      const c = [[a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]], [a[0], b[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]];
      const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      const lines = []; for (const e of E) lines.push(...c[e[0]], ...c[e[1]]);
      return lines;
    }
    function gizmoAxes() {
      const p = selected();
      if (settings.space === 'local' && p) { const m = rotMat(p.rot); return [[m[0], m[3], m[6]], [m[1], m[4], m[7]], [m[2], m[5], m[8]]]; }
      return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    }

    function updateOverlays() {
      const v = host.getViewer(); if (!v || !active) return;
      if (cm()) { cm().refreshView(); return; }
      const box = selBox();
      if (!box) { v.setOverlays(measureOv()); v.setGizmo(null); return; }
      const ov = [];
      const sel = selList().filter((o) => o.visible);
      for (const o of sel) {
        const g = worldGeo(o);
        const sil = settings.outline === 'shape' ? silEdges(g) : null;
        const col = o.id === selectedId ? [0.48, 0.91, 1, 0.9] : [0.62, 0.78, 1, 0.7];
        if (sil && sil.length) ov.push({ sil, color: col });
        else ov.push({ lines: boxLines(g.min, g.max), color: col });
      }
      if (sel.length > 1) ov.push({ lines: boxLines(box.min, box.max), color: [1, 0.85, 0.4, 0.55] });
      v.setOverlays(ov.concat(measureOv()));
      v.setGizmo(settings.tool === 'select' ? null : { mode: settings.tool, pos: box.c, axes: gizmoAxes(), active: gizmoActive, hover: gizmoHover });
    }
    function exportData() { return buildMerged(false); }

    // Satu berkas per objek (grup dihitung satu). Posisi dunia dipertahankan agar mudah dirakit ulang.
    function exportParts() {
      const done = new Set(), parts = [];
      for (const o of objects) {
        if (!o.visible || done.has(o.id)) continue;
        const members = o.grp ? objects.filter((x) => x.grp === o.grp && x.visible) : [o];
        members.forEach((m) => done.add(m.id));
        const g = o.grp ? groups.find((x) => x.id === o.grp) : null;
        const d = buildMerged(false, members);
        if (d) parts.push({ name: g ? g.name : o.name, data: d });
      }
      return parts;
    }
    function totalTriangles() { let n = 0; for (const o of objects) if (o.visible) n += worldGeo(o).indices.length / 3; return n; }
    // Turunkan detail bentuk lengkung sampai segitiga <= target.
    function autoReduce(target) {
      const before = totalTriangles();
      if (before <= target) return { before, after: before, detail: settings.detail, changed: false };
      let d = settings.detail;
      while (d > 0.25) { d = Math.round(d * 0.85 * 100) / 100; settings.detail = d; if (totalTriangles() <= target) break; }
      settings.detail = Math.max(0.2, d);
      const after = totalTriangles();
      scheduleSave(); rebuild(); renderAll();
      return { before, after, detail: settings.detail, changed: true };
    }
    function resetDetail() { settings.detail = 1; scheduleSave(); rebuild(); renderAll(); }

    /* ------------------------------------------------------------ */
    /* Picking & seret                                               */
    /* ------------------------------------------------------------ */
    function rayBox(o, d, min, max) {
      let tmin = 0, tmax = Infinity;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(d[k]) < 1e-12) { if (o[k] < min[k] || o[k] > max[k]) return false; }
        else {
          let t1 = (min[k] - o[k]) / d[k], t2 = (max[k] - o[k]) / d[k];
          if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
          if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
          if (tmin > tmax) return false;
        }
      }
      return true;
    }

    function pick(ray) {
      let best = null;
      for (const o of objects) {
        if (!o.visible) continue;
        const g = worldGeo(o);
        if (!rayBox(ray.o, ray.d, g.min, g.max)) continue;
        const P = g.positions, I = g.indices;
        for (let t = 0; t < I.length; t += 3) {
          const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
          const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
          const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
          const px = ray.d[1] * e2z - ray.d[2] * e2y, py = ray.d[2] * e2x - ray.d[0] * e2z, pz = ray.d[0] * e2y - ray.d[1] * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (Math.abs(det) < 1e-12) continue;
          const inv = 1 / det;
          const tx = ray.o[0] - P[a], ty = ray.o[1] - P[a + 1], tz = ray.o[2] - P[a + 2];
          const u = (tx * px + ty * py + tz * pz) * inv;
          if (u < 0 || u > 1) continue;
          const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
          const v = (ray.d[0] * qx + ray.d[1] * qy + ray.d[2] * qz) * inv;
          if (v < 0 || u + v > 1) continue;
          const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (tt > 1e-6 && (!best || tt < best.t)) best = { obj: o, t: tt };
        }
      }
      return best;
    }

    const snapV = (v) => (settings.snap > 0 ? Math.round(v / settings.snap) * settings.snap : Math.round(v * 1000) / 1000);
    let drag = null, gizmoActive = null, gizmoHover = null;

    /* ---- gizmo ---- */
    let gz = null;
    const AXV = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    function axisParam(ray, P0, A) {
      const w = [P0[0] - ray.o[0], P0[1] - ray.o[1], P0[2] - ray.o[2]];
      const b = dot3(A, ray.d), d = dot3(A, w), e = dot3(ray.d, w), den = 1 - b * b;
      if (Math.abs(den) < 1e-5) return null;
      return (b * e - d) / den;
    }
    function planeHit(ray, P0, N) {
      const den = dot3(N, ray.d); if (Math.abs(den) < 1e-5) return null;
      const t = dot3(N, [P0[0] - ray.o[0], P0[1] - ray.o[1], P0[2] - ray.o[2]]) / den;
      if (t < 0) return null;
      return [ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t];
    }
    const r3 = (v) => Math.round(v * 1000) / 1000;
    function startGizmo(ax, ray) {
      const all = selList(), items = all.filter((o) => !o.lock);
      if (!items.length) { host.toast('Objek terkunci. Buka kunci dulu lewat menu Edit.'); return; }
      const box = selBox(), C = box.c, AXS = gizmoAxes(), i = 'xyz'.indexOf(ax), A = AXS[i];
      gz = { items: items.map((o) => ({ o, pos0: o.pos.slice(), sc0: o.scale.slice(), rot0: o.rot.slice() })), ax, i, A, C, tool: settings.tool, multi: items.length > 1, local: settings.space === 'local' };
      if (gz.tool === 'rotate') {
        const h = planeHit(ray, C, A), u = AXS[(i + 1) % 3], v = AXS[(i + 2) % 3];
        gz.u = u; gz.v = v;
        const d = h ? [h[0] - C[0], h[1] - C[1], h[2] - C[2]] : [1, 0, 0];
        gz.a0 = h ? Math.atan2(dot3(d, v), dot3(d, u)) : 0;
      } else {
        const t = axisParam(ray, C, A);
        gz.t0 = t == null ? 0 : t;
        gz.len0 = Math.max(0.4, Math.abs(gz.t0));
      }
      gizmoActive = ax; beginEdit(gz.tool === 'move' ? 'Pindah' : gz.tool === 'rotate' ? 'Putar' : 'Skala'); updateOverlays();
    }
    function moveGizmo(ray, e) {
      const G = gz; let changed = false;
      if (G.tool === 'move') {
        const t = axisParam(ray, G.C, G.A); if (t == null) return;
        const d0 = t - G.t0, i = G.i;
        for (const it of G.items) {
          const o = it.o;
          let np;
          if (!G.multi && !G.local) { np = it.pos0.slice(); np[i] = snapV(it.pos0[i] + d0); }
          else { const d = settings.snap > 0 ? Math.round(d0 / settings.snap) * settings.snap : d0; np = [r3(it.pos0[0] + G.A[0] * d), r3(it.pos0[1] + G.A[1] * d), r3(it.pos0[2] + G.A[2] * d)]; }
          if (np.some((v, k) => v !== o.pos[k])) { o.pos = np; changed = true; }
        }
      } else if (G.tool === 'scale') {
        const t = axisParam(ray, G.C, G.A); if (t == null) return;
        const f = clamp((G.len0 + (Math.abs(t) - Math.abs(G.t0))) / G.len0, 0.05, 30);
        const i = G.i;
        const fix = (v) => { const r = Math.round(v * 20) / 20; return Math.abs(r) < 0.05 ? 0.05 * (v < 0 ? -1 : 1) : r; };
        const uni = !!(e && e.shiftKey);
        for (const it of G.items) {
          const o = it.o, ns = it.sc0.slice();
          if (uni) for (let k = 0; k < 3; k++) ns[k] = fix(it.sc0[k] * f); else ns[i] = fix(it.sc0[i] * f);
          let np = o.pos;
          if (G.multi) {
            np = it.pos0.slice();
            if (uni) for (let k = 0; k < 3; k++) np[k] = r3(G.C[k] + (it.pos0[k] - G.C[k]) * f); else np[i] = r3(G.C[i] + (it.pos0[i] - G.C[i]) * f);
          }
          if (ns.some((v, k) => v !== o.scale[k]) || np.some((v, k) => v !== o.pos[k])) { o.scale = ns; o.pos = np; changed = true; }
        }
      } else {
        const h = planeHit(ray, G.C, G.A); if (!h) return;
        const d = [h[0] - G.C[0], h[1] - G.C[1], h[2] - G.C[2]];
        let ang = Math.atan2(dot3(d, G.v), dot3(d, G.u)) - G.a0;
        if (settings.snap > 0) ang = Math.round(ang / (15 * DEG)) * 15 * DEG;
        const A = G.A, c = Math.cos(ang), s2 = Math.sin(ang), t1 = 1 - c;
        const R = [t1 * A[0] * A[0] + c, t1 * A[0] * A[1] - s2 * A[2], t1 * A[0] * A[2] + s2 * A[1],
          t1 * A[0] * A[1] + s2 * A[2], t1 * A[1] * A[1] + c, t1 * A[1] * A[2] - s2 * A[0],
          t1 * A[0] * A[2] - s2 * A[1], t1 * A[1] * A[2] + s2 * A[0], t1 * A[2] * A[2] + c];
        for (const it of G.items) {
          const o = it.o;
          const eu = matToEuler(matMul(R, rotMat(it.rot0)));
          let np = o.pos;
          if (G.multi) {
            const q = [it.pos0[0] - G.C[0], it.pos0[1] - G.C[1], it.pos0[2] - G.C[2]];
            np = [r3(G.C[0] + R[0] * q[0] + R[1] * q[1] + R[2] * q[2]), r3(G.C[1] + R[3] * q[0] + R[4] * q[1] + R[5] * q[2]), r3(G.C[2] + R[6] * q[0] + R[7] * q[1] + R[8] * q[2])];
          }
          if (eu.some((v, k) => v !== o.rot[k]) || np.some((v, k) => v !== o.pos[k])) { o.rot = eu; o.pos = np; changed = true; }
        }
      }
      if (changed) { rebuild(); syncFields(); }
    }

    const handler = {
      start(ray, e) {
        const sel = selList();
        if (sel.length && settings.tool !== 'select') {
          const ax = host.getViewer().gizmoHit(e.clientX, e.clientY);
          if (ax) { startGizmo(ax, ray); return !!gz; }
        }
        const hit = pick(ray);
        if (!hit) return false;
        const o = hit.obj;
        const additive = e.ctrlKey || e.metaKey;
        if (additive) { select(o.id, 'toggle'); return true; }
        if (!isSel(o.id)) select(o.id, 'only');
        else if (selectedId !== o.id) { selectedId = o.id; renderAll(); updateOverlays(); }
        const movers = selList().filter((x) => !x.lock);
        if (!movers.length) { host.toast('Objek terkunci. Buka kunci dulu lewat menu Edit.'); return true; }
        const H = [ray.o[0] + ray.d[0] * hit.t, ray.o[1] + ray.d[1] * hit.t, ray.o[2] + ray.d[2] * hit.t];
        const vertical = settings.drag === 'y' || !!e.altKey;
        let n = [-ray.d[0], 0, -ray.d[2]];
        const nl = Math.hypot(n[0], n[2]);
        n = nl > 1e-6 ? [n[0] / nl, 0, n[2] / nl] : [0, 0, 1];
        const ref = movers.indexOf(o) >= 0 ? o : movers[0];
        drag = { o: ref, items: movers.map((x) => ({ o: x, start: x.pos.slice() })), vertical, n, H, off: [ref.pos[0] - H[0], ref.pos[1] - H[1], ref.pos[2] - H[2]], refStart: ref.pos.slice() };
        beginEdit('Pindah');
        return true;
      },
      move(ray, e) {
        if (gz) { moveGizmo(ray, e); return; }
        if (!drag) return;
        const ref = drag.o;
        let np = null;
        if (!drag.vertical) {
          if (Math.abs(ray.d[1]) < 1e-4) return;
          const t = (drag.H[1] - ray.o[1]) / ray.d[1];
          if (t < 0 || t > 500) return;
          np = [snapV(ray.o[0] + ray.d[0] * t + drag.off[0]), drag.refStart[1], snapV(ray.o[2] + ray.d[2] * t + drag.off[2])];
        } else {
          const den = ray.d[0] * drag.n[0] + ray.d[2] * drag.n[2];
          if (Math.abs(den) < 1e-4) return;
          const t = ((drag.H[0] - ray.o[0]) * drag.n[0] + (drag.H[2] - ray.o[2]) * drag.n[2]) / den;
          if (t < 0 || t > 500) return;
          np = [drag.refStart[0], snapV(ray.o[1] + ray.d[1] * t + drag.off[1]), drag.refStart[2]];
        }
        const d = [np[0] - drag.refStart[0], np[1] - drag.refStart[1], np[2] - drag.refStart[2]];
        let changed = false;
        for (const it of drag.items) {
          const p = [r3(it.start[0] + d[0]), r3(it.start[1] + d[1]), r3(it.start[2] + d[2])];
          if (p.some((v, k) => v !== it.o.pos[k])) { it.o.pos = p; changed = true; }
        }
        if (changed) { rebuild(); syncFields(); }
      },
      end() { commitEdit(); drag = null; gz = null; gizmoActive = null; updateOverlays(); },
      tap(e) { if (selIds.length && !(e && (e.ctrlKey || e.metaKey))) select(null); },
    };

    /* ------------------------------------------------------------ */
    /* Aksi                                                          */
    /* ------------------------------------------------------------ */
    const selected = () => objects.find((o) => o.id === selectedId) || null;
    const isSel = (id) => selIds.indexOf(id) >= 0;
    const selList = () => objects.filter((o) => isSel(o.id));
    function setSel(ids, primary) {
      selIds = ids.filter((id, k) => ids.indexOf(id) === k && objects.some((o) => o.id === id));
      selectedId = selIds.length ? (primary != null && selIds.indexOf(primary) >= 0 ? primary : selIds[selIds.length - 1]) : null;
    }
    const withGroup = (o) => (o && o.grp ? objects.filter((x) => x.grp === o.grp).map((x) => x.id) : o ? [o.id] : []);
    // mode: 'only' (satu objek atau grupnya), 'single' (hanya objek itu), 'toggle', 'add'
    function select(id, mode) {
      if (cm()) return;
      if (id == null) { setSel([]); }
      else {
        const o = objects.find((x) => x.id === id); if (!o) return;
        const ids = mode === 'single' ? [id] : withGroup(o);
        if (mode === 'toggle') { const on = isSel(id); setSel(on ? selIds.filter((x) => ids.indexOf(x) < 0) : selIds.concat(ids), on ? null : id); }
        else if (mode === 'add') setSel(selIds.concat(ids), id);
        else setSel(ids, id);
      }
      rebuild(); renderAll();
    }
    function selectAll() { setSel(objects.filter((o) => o.visible).map((o) => o.id)); rebuild(); renderAll(); }

    function addShape(item) {
      if (objects.length >= MAX_OBJECTS) { host.toast('Scene sudah penuh (' + MAX_OBJECTS + ' objek).'); return; }
      act(() => {
        const o = makeObject(item.type, item.params, { label: item.label });
        objects.push(o); setSel([o.id]);
      }, 'Tambah ' + item.label);
    }
    async function importModel(files) {
      files = Array.from(files || []);
      const file = files.find((f) => /\.(glb|obj)$/i.test(f.name));
      if (!file) { host.toast('Pilih berkas .glb atau .obj (untuk OBJ, boleh sertakan .mtl).'); return; }
      const mtlFile = files.find((f) => /\.mtl$/i.test(f.name));
      if (objects.length >= MAX_OBJECTS) { host.toast('Scene sudah penuh (' + MAX_OBJECTS + ' objek).'); return; }
      if (file.size > 60 * 1024 * 1024) { host.toast('Berkas terlalu besar (maksimal 60 MB).'); return; }
      try {
        host.toast('Membaca ' + file.name + '…');
        await new Promise((r) => setTimeout(r, 30));
        let w = await MO.parseAny(file.name, await file.arrayBuffer(), { mtl: mtlFile ? await mtlFile.text() : null }, 24);
        const n0 = w.T.length / 3, CAP = 30000;
        let note = '';
        if (n0 > CAP) { host.toast('Menurunkan detail ' + n0.toLocaleString('id-ID') + ' segitiga…'); await new Promise((r) => setTimeout(r, 30)); w = MO.decimate(w, CAP); note = ' (diturunkan dari ' + n0.toLocaleString('id-ID') + ')'; }
        const norm = MO.normalize(w, 4, 'y');
        const mid = registerMesh(norm, file.name.replace(/\.[^.]+$/, '').slice(0, 30));
        act(() => { const o = makeObject('mesh', { mid }, { name: labelFor('mesh', meshes.get(mid).name), color: '#9fb4d9' }); o.shade = 'auto'; objects.push(o); setSel([o.id]); }, 'Impor model');
        focusAll(false);
        host.toast('Model diimpor: ' + (norm.T.length / 3).toLocaleString('id-ID') + ' segitiga' + (norm.pal ? ', ' + norm.pal.length + ' warna' : '') + note + (/\.obj$/i.test(file.name) ? '. Jika model tidur, pakai Edit > Putar Z-atas ke Y-atas.' : '.'));
      } catch (e) { host.toast('Gagal impor: ' + e.message); }
    }
    async function decimateSel(frac) {
      const list = selList().filter((o) => o.type === 'mesh');
      if (!list.length) { host.toast('Pilih objek model impor dulu.'); return; }
      host.toast('Menurunkan detail…'); await new Promise((r) => setTimeout(r, 30));
      const res = new Map();
      for (const o of list) {
        const e = meshes.get(o.params.mid); if (!e || res.has(o.params.mid)) continue;
        const d = MO.decimate(e.mesh, Math.max(60, Math.round((e.mesh.T.length / 3) * frac)));
        res.set(o.params.mid, registerMesh(d, e.name));
      }
      act(() => { for (const o of list) if (res.has(o.params.mid)) o.params = { mid: res.get(o.params.mid) }; worldCache.clear(); }, 'Turunkan detail model');
      host.toast('Detail diturunkan ke ' + Math.round(frac * 100) + '%.');
    }
    function addPrefab(id) {
      const it = Lib && Lib.get(id); if (!it) return;
      if (objects.length >= MAX_OBJECTS) { host.toast('Scene sudah penuh (' + MAX_OBJECTS + ' objek).'); return; }
      act(() => {
        const o = makeObject('prefab', { id }, { name: labelFor('prefab', it.name), color: it.parts[0].c });
        objects.push(o); setSel([o.id]);
      }, 'Tambah ' + it.name);
      focusAll(false);
    }
    function explode() {
      const s = selected(); if (!s || s.type !== 'prefab') return;
      const k = Math.abs(s.scale[0]);
      if (Math.abs(Math.abs(s.scale[1]) - k) > 1e-6 || Math.abs(Math.abs(s.scale[2]) - k) > 1e-6 || s.scale[0] < 0 || s.scale[1] < 0 || s.scale[2] < 0) { host.toast('Pecah bagian hanya untuk skala seragam dan tidak dicerminkan.'); return; }
      const it = Lib.get(s.params.id), lift = baseGeo('prefab', s.params).lift, m = rotMat(s.rot);
      if (objects.length - 1 + it.parts.length > MAX_OBJECTS) { host.toast('Scene tidak cukup ruang untuk memecah objek ini.'); return; }
      act(() => {
        const parts = it.parts.map((p, i) => {
          const lp = [p.pos[0] * k, (p.pos[1] + lift) * k, p.pos[2] * k];
          const pos = [m[0] * lp[0] + m[1] * lp[1] + m[2] * lp[2] + s.pos[0], m[3] * lp[0] + m[4] * lp[1] + m[5] * lp[2] + s.pos[1], m[6] * lp[0] + m[7] * lp[1] + m[8] * lp[2] + s.pos[2]].map((v) => Math.round(v * 1000) / 1000);
          const o = makeObject(p.t, p.p, { name: it.name + ' ' + (i + 1), pos, color: s.tint || p.c, rot: matToEuler(matMul(m, rotMat(p.rot))), scale: p.s.map((v) => v * k) });
          return o;
        });
        const gid = nextGroup++;
        groups.push({ id: gid, name: it.name });
        parts.forEach((p) => { p.grp = gid; });
        objects = objects.filter((o) => o.id !== s.id).concat(parts);
        worldCache.delete(s.id); setSel(parts.map((p) => p.id));
      }, 'Pecah ' + it.name);
      host.toast('Dipecah jadi ' + it.parts.length + ' bagian.');
    }
    function arrayCopies(opt) {
      const s = selected(); if (!s) return;
      const n = clamp(Math.round(opt.count), 2, 60) - 1;
      if (objects.length + n > MAX_OBJECTS) { host.toast('Scene akan melebihi ' + MAX_OBJECTS + ' objek.'); return; }
      act(() => {
        const made = [];
        for (let i = 1; i <= n; i++) {
          const o = JSON.parse(JSON.stringify(s));
          o.id = nextId++; o.name = s.name.replace(/\s+\d+$/, '') + ' ' + (objects.length + made.length + 1);
          if (opt.mode === 'linear') { for (let a = 0; a < 3; a++) o.pos[a] = Math.round((s.pos[a] + opt.d[a] * i) * 1000) / 1000; }
          else {
            const th = (360 / (n + 1)) * i * DEG, c = Math.cos(th), sn = Math.sin(th);
            const px = s.pos[0], pz = s.pos[2];
            o.pos[0] = Math.round((c * px + sn * pz) * 1000) / 1000; o.pos[2] = Math.round((-sn * px + c * pz) * 1000) / 1000;
            const m = matMul(rotMat([0, th / DEG, 0]), rotMat(s.rot)); o.rot = matToEuler(m);
          }
          made.push(o);
        }
        objects.push(...made);
      });
      host.toast((n + 1) + ' objek disusun.');
    }
    function setTool(t) {
      settings.tool = t;
      for (const b of (ui.panelTools || []).concat(ui.fTools || [])) { b.setAttribute('aria-pressed', String(b.dataset.tool === t)); b.classList.toggle('on', b.dataset.tool === t); }
      updateOverlays();
    }
    function setMaterial(m) {
      if (isNum(m.metallic)) settings.metal = clamp(m.metallic, 0, 1);
      if (isNum(m.roughness)) settings.rough = clamp(m.roughness, 0, 1);
      if (isNum(m.glow)) settings.glow = clamp(m.glow, 0, 1);
      syncSettingsUI(); scheduleSave(); rebuild();
    }
    function duplicate() {
      const list = selList(); if (!list.length) return;
      if (objects.length + list.length > MAX_OBJECTS) { host.toast('Scene akan melebihi ' + MAX_OBJECTS + ' objek.'); return; }
      act(() => {
        const gmap = new Map(), made = [];
        for (const s0 of list) {
          const o = JSON.parse(JSON.stringify(clean(s0)));
          o.id = nextId++; o.name = labelFor(s0.type, s0.name.replace(/\s+\d+$/, '')); o.pos[0] += 1; o.pos[2] += 1; o.lock = false;
          if (s0.grp) {
            if (!gmap.has(s0.grp)) { const g0 = groups.find((g) => g.id === s0.grp); const gid = nextGroup++; groups.push({ id: gid, name: (g0 ? g0.name : 'Grup') + ' salinan' }); gmap.set(s0.grp, gid); }
            o.grp = gmap.get(s0.grp);
          }
          made.push(o);
        }
        objects.push(...made); setSel(made.map((o) => o.id));
      }, 'Duplikat');
    }
    function pruneGroups() { groups = groups.filter((g) => objects.filter((o) => o.grp === g.id).length >= 2); objects.forEach((o) => { if (o.grp && !groups.some((g) => g.id === o.grp)) o.grp = null; }); }
    function remove(id) {
      const ids = id != null ? [id] : selIds.slice();
      if (!ids.length) return;
      act(() => { objects = objects.filter((o) => ids.indexOf(o.id) < 0); ids.forEach((k) => worldCache.delete(k)); pruneGroups(); setSel(selIds.filter((k) => ids.indexOf(k) < 0)); }, ids.length > 1 ? 'Hapus ' + ids.length + ' objek' : 'Hapus');
    }
    function toFloor() {
      const list = selList().filter((o) => !o.lock); if (!list.length) return;
      act(() => {
        let low = Infinity; for (const o of list) low = Math.min(low, worldGeo(o).min[1]);
        for (const o of list) o.pos[1] = r3(o.pos[1] - low);
      }, 'Taruh di lantai');
    }
    // Cermin di sumbu dunia terhadap pusat seleksi (copy=true: buat salinan tercermin).
    function mirrorWorld(axis, copy) {
      const list = selList().filter((o) => !o.lock || copy); if (!list.length) return;
      const i = 'xyz'.indexOf(axis);
      const box = selBox(); const c = box ? box.c[i] : 0;
      if (copy && objects.length + list.length > MAX_OBJECTS) { host.toast('Scene akan melebihi ' + MAX_OBJECTS + ' objek.'); return; }
      act(() => {
        const targets = copy ? list.map((s0) => { const o = JSON.parse(JSON.stringify(clean(s0))); o.id = nextId++; o.name = s0.name + ' cermin'; o.grp = null; o.lock = false; objects.push(o); return o; }) : list;
        for (const o of targets) {
          o.pos[i] = r3(2 * c - o.pos[i]);
          const m = rotMat(o.rot), sg = [1, 1, 1]; sg[i] = -1;
          const R = m.map((v, k) => v * sg[Math.floor(k / 3)] * sg[k % 3]);
          o.rot = matToEuler(R);
          o.scale[i] = -o.scale[i];
        }
        if (copy) setSel(targets.map((o) => o.id));
      }, copy ? 'Cermin + salin ' + axis.toUpperCase() : 'Cermin ' + axis.toUpperCase());
    }
    function mirrorX() { mirrorWorld('x', false); }
    // Ratakan batas kotak objek: edge = 'min' | 'center' | 'max'
    function align(axis, edge) {
      const list = selList().filter((o) => !o.lock); if (list.length < 2) { host.toast('Pilih minimal 2 objek untuk meratakan.'); return; }
      const i = 'xyz'.indexOf(axis);
      const gs = list.map((o) => worldGeo(o));
      const lo = Math.min(...gs.map((g) => g.min[i])), hi = Math.max(...gs.map((g) => g.max[i]));
      const target = edge === 'min' ? lo : edge === 'max' ? hi : (lo + hi) / 2;
      act(() => {
        list.forEach((o, k) => {
          const g = gs[k], cur = edge === 'min' ? g.min[i] : edge === 'max' ? g.max[i] : (g.min[i] + g.max[i]) / 2;
          o.pos[i] = r3(o.pos[i] + (target - cur));
        });
      }, 'Ratakan ' + axis.toUpperCase());
    }
    // Bagi jarak sama rata antar objek di satu sumbu (minimal 3 objek).
    function distribute(axis) {
      const list = selList().filter((o) => !o.lock); if (list.length < 3) { host.toast('Pilih minimal 3 objek untuk membagi jarak.'); return; }
      const i = 'xyz'.indexOf(axis);
      const items = list.map((o) => { const g = worldGeo(o); return { o, c: (g.min[i] + g.max[i]) / 2 }; }).sort((a, b) => a.c - b.c);
      const a = items[0].c, b = items[items.length - 1].c;
      act(() => { items.forEach((it, k) => { const want = a + ((b - a) * k) / (items.length - 1); it.o.pos[i] = r3(it.o.pos[i] + (want - it.c)); }); }, 'Bagi jarak ' + axis.toUpperCase());
    }
    function groupSel() {
      const list = selList(); if (list.length < 2) { host.toast('Pilih minimal 2 objek untuk dijadikan grup.'); return; }
      act(() => {
        const gid = nextGroup++;
        groups.push({ id: gid, name: 'Grup ' + gid });
        for (const o of list) o.grp = gid;
        pruneGroups(); setSel(list.map((o) => o.id));
      }, 'Buat grup');
    }
    function ungroupSel() {
      const list = selList().filter((o) => o.grp); if (!list.length) return;
      act(() => { for (const o of list) o.grp = null; pruneGroups(); }, 'Lepas grup');
    }
    function setLock(v) { const list = selList(); if (!list.length) return; act(() => { for (const o of list) o.lock = v; }, v ? 'Kunci' : 'Buka kunci'); }
    function setHidden(hide) {
      const list = hide ? selList() : objects; if (!list.length) return;
      act(() => { for (const o of list) o.visible = !hide; }, hide ? 'Sembunyikan' : 'Tampilkan semua');
    }
    function renameGroup(id, name) { const g = groups.find((x) => x.id === id); if (!g) return; act(() => { g.name = String(name || 'Grup').slice(0, 40); }, 'Ganti nama grup'); }
    function newProject() {
      if (!objects.length) return;
      act(() => { objects = []; groups = []; setSel([]); worldCache.clear(); }, 'Proyek baru');
    }
    function clearAll() { newProject(); }

    function focusAll(reset) {
      const v = host.getViewer(); if (!v) return;
      const vis = objects.filter((o) => o.visible);
      if (!vis.length) { v.setFrame(DEFAULT_FRAME, reset !== false); return; }
      const min = [0, 0, 0], max = [0, 0, 0];
      vis.forEach((o, i) => { const g = worldGeo(o); for (let a = 0; a < 3; a++) { if (i === 0 || g.min[a] < min[a]) min[a] = g.min[a]; if (i === 0 || g.max[a] > max[a]) max[a] = g.max[a]; } });
      min[1] = Math.min(min[1], 0);
      const sx = max[0] - min[0], sy = max[1] - min[1], sz = max[2] - min[2];
      v.setFrame({
        center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
        halfW: Math.max(sx, sz, 8) / 2 * 1.05, halfH: Math.max(sy, 5) / 2 * 1.05,
        radius: Math.hypot(sx, sy, sz) / 2 + 1,
      }, reset !== false);
    }

    /* ------------------------------------------------------------ */
    /* Contoh scene                                                  */
    /* ------------------------------------------------------------ */
    const SAMPLES = {
      rumah() {
        const o = (t, p, c, pos, name, rot) => makeObject(t, p, { color: c, pos, name, rot });
        return [
          o('cuboid', { w: 5, h: 3, d: 4 }, '#f2f5ff', [0, 1.5, 0], 'Dinding'),
          o('rectPyramid', { w: 6, d: 5, h: 2 }, '#ff7a90', [0, 4, 0], 'Atap'),
          o('cuboid', { w: 1.1, h: 2, d: 0.2 }, '#9a6b3f', [0, 1, 2.05], 'Pintu'),
          o('cuboid', { w: 1.2, h: 1.1, d: 0.2 }, '#62e6ff', [1.6, 1.7, 2.05], 'Jendela'),
          o('cuboid', { w: 0.7, h: 1.6, d: 0.7 }, '#8a8fa8', [-1.7, 4.1, -0.9], 'Cerobong'),
        ];
      },
      pohon() {
        const o = (t, p, c, pos, name) => makeObject(t, p, { color: c, pos, name });
        return [
          o('cylinder', { r: 0.4, h: 2, seg: 16 }, '#9a6b3f', [0, 1, 0], 'Batang'),
          o('cone', { r: 1.7, h: 2.6, seg: 24 }, '#3fae6a', [0, 3.2, 0], 'Daun bawah'),
          o('cone', { r: 1.3, h: 2.2, seg: 24 }, '#52c77f', [0, 4.6, 0], 'Daun tengah'),
          o('cone', { r: 0.9, h: 1.8, seg: 24 }, '#7ee0a0', [0, 5.8, 0], 'Daun atas'),
        ];
      },
      roket() {
        const list = [
          makeObject('cylinder', { r: 1, h: 5, seg: 32 }, { color: '#f2f5ff', pos: [0, 2.5, 0], name: 'Badan' }),
          makeObject('cone', { r: 1, h: 2, seg: 32 }, { color: '#ff7a90', pos: [0, 6, 0], name: 'Hidung' }),
          makeObject('sphere', { r: 0.45, seg: 20 }, { color: '#62e6ff', pos: [0, 3.4, 0.92], name: 'Jendela', scale: [1, 1, 0.45] }),
          makeObject('frustum', { rb: 0.7, rt: 0.45, h: 0.8, seg: 24 }, { color: '#8a8fa8', pos: [0, -0.4, 0], name: 'Nozel' }),
        ];
        [0, 120, 240].forEach((a, i) => {
          const x0 = 1 + 0.6, r = a * DEG;
          list.push(makeObject('wedge', { w: 1.2, h: 2.2, d: 0.2 }, { color: '#ff7a90', pos: [x0 * Math.cos(r), 1.1, -x0 * Math.sin(r)], rot: [0, a, 0], name: 'Sirip ' + (i + 1) }));
        });
        return list;
      },
    };

    function loadSample(name) {
      act(() => { objects = SAMPLES[name](); groups = []; worldCache.clear(); setSel([]); }, 'Contoh ' + name);
      focusAll(true);
    }

    /* ------------------------------------------------------------ */
    /* Simpan / buka                                                 */
    /* ------------------------------------------------------------ */
    function projectJSON() { return JSON.stringify({ app: 'saltoria-3d-studio', version: 3, settings, nextId, groups, objects: objects.map(clean), meshes: meshesJSON() }, null, 1); }

    function parseProject(text) {
      const d = JSON.parse(text);
      if (!d || !Array.isArray(d.objects)) throw new Error('Berkas bukan proyek Saltoria 3D Studio.');
      const list = [];
      let maxId = 0;
      for (const mr of Array.isArray(d.meshes) ? d.meshes.slice(0, 40) : []) {
        try {
          if (!mr || !isNum(mr.mid) || typeof mr.p !== 'string' || typeof mr.t !== 'string') continue;
          const pb = unb64(mr.p), tb = unb64(mr.t);
          const P = Float64Array.from(new Float32Array(pb.buffer, 0, pb.length >> 2)), T = new Uint32Array(tb.buffer, 0, tb.length >> 2);
          let okT = T.length >= 3 && T.length % 3 === 0; for (let i = 0; okT && i < T.length; i++) if (T[i] >= P.length / 3) okT = false;
          if (okT) {
            const mesh = { P, T: Uint32Array.from(T) };
            if (typeof mr.c === 'string' && Array.isArray(mr.pal) && mr.pal.length && mr.pal.every((h) => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h))) {
              const cb = unb64(mr.c), C = new Uint16Array(cb.buffer, 0, cb.length >> 1);
              if (C.length === T.length / 3 && C.every((v) => v < mr.pal.length)) { mesh.C = Uint16Array.from(C); mesh.pal = mr.pal.slice(0, 64); }
            }
            if (typeof mr.uv === 'string' && typeof mr.n === 'string' && isNum(mr.s) && mr.s >= 64 && mr.s <= 2048) {
              const ub = unb64(mr.uv), nb = unb64(mr.n), nV = P.length / 3;
              if (ub.length === nV * 8 && nb.length === nV * 12) {
                mesh.UV = new Float32Array(ub.buffer.slice(0, ub.length)); mesh.N = new Float32Array(nb.buffer.slice(0, nb.length)); mesh.S = Math.round(mr.s);
                const cv = document.createElement('canvas'); cv.width = cv.height = mesh.S; const g2 = cv.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, mesh.S, mesh.S); mesh.canvas = cv;
                if (typeof mr.img === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(mr.img)) { const im = new Image(); im.onload = () => { g2.drawImage(im, 0, 0, mesh.S, mesh.S); rebuild(); }; im.src = mr.img; }
              }
            }
            registerMesh(mesh, String(mr.name || 'Model impor').slice(0, 40), mr.mid);
          }
        } catch (e) { /* mesh rusak dilewati */ }
      }
      for (const r of d.objects.slice(0, MAX_OBJECTS)) {
        if (!r || !(Sh.DEFS[r.type] || (r.type === 'prefab' && r.params && Lib && Lib.get(r.params.id)) || (r.type === 'mesh' && r.params && meshes.has(r.params.mid)))) continue;
        const tri3 = (a, def) => (Array.isArray(a) && a.length === 3 && a.every(isNum) ? a.slice() : def);
        const id = isNum(r.id) ? r.id : ++maxId;
        maxId = Math.max(maxId, id);
        list.push({
          id, type: r.type, params: r.type === 'mesh' ? { mid: r.params.mid } : r.type === 'prefab' ? { id: r.params.id } : Sh.sanitize(r.type, r.params), name: String(r.name || (r.type === 'prefab' ? 'Objek' : r.type === 'mesh' ? 'Model impor' : Sh.DEFS[r.type].label)).slice(0, 40),
          pos: tri3(r.pos, [0, 0, 0]).map((v) => clamp(v, -5000, 5000)), rot: tri3(r.rot, [0, 0, 0]),
          scale: tri3(r.scale, [1, 1, 1]).map((v) => (Math.abs(v) < 0.01 ? 0.01 : clamp(v, -500, 500))),
          color: hexOk(r.color) ? r.color : '#6ea8ff', tint: hexOk(r.tint) ? r.tint : null, tex: texOk(r.tex), shade: ['asis', 'auto', 'smooth'].indexOf(r.shade) >= 0 ? r.shade : 'asis', crease: isNum(r.crease) ? clamp(r.crease, 5, 90) : 40, visible: r.visible !== false, lock: r.lock === true, grp: isNum(r.grp) ? r.grp : null, mods: Array.isArray(r.mods) ? r.mods.slice(0, 6).map(Mods.sanitize).filter(Boolean) : [],
        });
      }
      const groupsIn = (Array.isArray(d.groups) ? d.groups : []).filter((g) => g && isNum(g.id)).map((g) => ({ id: g.id, name: String(g.name || 'Grup').slice(0, 40) }));
      const gOk = (id) => groupsIn.some((g) => g.id === id);
      list.forEach((o) => { if (o.grp && !gOk(o.grp)) o.grp = null; });
      return { list, maxId, settings: d.settings, groups: groupsIn };
    }

    function saveProject() {
      const blob = new Blob([projectJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'saltoria-proyek-3d.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      host.toast('Proyek tersimpan: saltoria-proyek-3d.json');
    }

    async function openProject(file) {
      if (!file) return;
      try {
        const p = parseProject(await file.text());
        act(() => { objects = p.list; groups = p.groups; nextGroup = Math.max(nextGroup, p.groups.reduce((m, g) => Math.max(m, g.id), 0) + 1); nextId = Math.max(nextId, p.maxId + 1); setSel([]); worldCache.clear(); }, 'Buka proyek');
        applySettings(p.settings);
        focusAll(true);
        host.toast('Proyek dibuka: ' + p.list.length + ' objek.');
      } catch (e) { host.toast('Gagal membuka proyek: ' + e.message); }
    }

    function applySettings(s) {
      if (!s) return;
      if ([0, 0.25, 0.5, 1].includes(s.snap)) settings.snap = s.snap;
      if (s.space === 'local' || s.space === 'global') settings.space = s.space;
      if (isNum(s.detail)) settings.detail = clamp(s.detail, 0.2, 1);
      if (s.outline === 'shape' || s.outline === 'box') settings.outline = s.outline;
      if (typeof s.grid === 'boolean') settings.grid = s.grid;
      if (s.drag === 'xz' || s.drag === 'y') settings.drag = s.drag;
      if (isNum(s.metal)) settings.metal = clamp(s.metal, 0, 1);
      if (isNum(s.rough)) settings.rough = clamp(s.rough, 0, 1);
      if (isNum(s.glow)) settings.glow = clamp(s.glow, 0, 1);
      syncSettingsUI(); applyGrid();
      if (active) { const v = host.getViewer(); if (v) v.setMaterial({ metallic: settings.metal, roughness: settings.rough }); }
    }

    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try { localStorage.setItem(STORE_KEY, projectJSON()); } catch (e) { /* penyimpanan tidak tersedia */ }
      }, 400);
    }
    function loadStored() {
      try {
        const t = localStorage.getItem(STORE_KEY);
        if (!t) return;
        const p = parseProject(t);
        objects = p.list; groups = p.groups; nextGroup = p.groups.reduce((m, g) => Math.max(m, g.id), 0) + 1; nextId = Math.max(nextId, p.maxId + 1);
        applySettings(p.settings);
      } catch (e) { /* abaikan data rusak */ }
    }

    /* ------------------------------------------------------------ */
    /* UI                                                            */
    /* ------------------------------------------------------------ */
    const fmtNum = (v) => String(Math.round(v * 1000) / 1000);

    function numField(label, spec, get, set, onChangeRerender) {
      const inp = el('input', { type: 'number', step: spec.step || 0.1, inputMode: 'decimal', value: fmtNum(get()) });
      if (spec.min != null) inp.min = spec.min;
      if (spec.max != null) inp.max = spec.max;
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        if (!isFinite(v)) return;
        beginEdit();
        set(spec.min != null || spec.max != null ? clamp(v, spec.min != null ? spec.min : -Infinity, spec.max != null ? spec.max : Infinity) : v);
        rebuild();
      });
      inp.addEventListener('change', () => {
        commitEdit();
        if (onChangeRerender) renderProps(); else syncFields();
      });
      fieldRefs.push({ inp, get });
      return el('label', { class: 'nf' }, [el('span', { text: label }), inp]);
    }

    function syncFields() {
      for (const f of fieldRefs) if (document.activeElement !== f.inp) f.inp.value = fmtNum(f.get());
    }

    function renderProps() {
      fieldRefs.length = 0;
      const box = ui.props;
      box.textContent = '';
      if (cm()) { cm().renderPanel(box); return; }
      const s = selected();
      if (!s) { box.appendChild(el('p', { class: 'hint', text: 'Pilih objek di pratinjau atau di daftar untuk mengatur ukuran, posisi, rotasi, dan warnanya. Ctrl/⌘ + klik untuk memilih banyak objek.' })); return; }
      if (selIds.length > 1) { renderMulti(box); return; }
      const def = s.type === 'prefab' || s.type === 'mesh' ? null : Sh.DEFS[s.type];

      box.appendChild(el('label', { class: 'field-label', text: 'Nama objek', htmlFor: 'mk-name' }));
      const name = el('input', { type: 'text', id: 'mk-name', value: s.name, maxLength: 40, class: 'txt' });
      name.addEventListener('input', () => { beginEdit(); s.name = name.value; });
      name.addEventListener('change', () => { commitEdit(); renderList(); });
      box.appendChild(name);
      if (def) {
        box.appendChild(el('p', { class: 'hint', text: def.label + ' (' + def.en + ')' }));
        box.appendChild(el('h3', { text: 'Ukuran bentuk' }));
        const pg = el('div', { class: 'nfgrid' });
        for (const spec of def.params) pg.appendChild(numField(spec.label, spec, () => s.params[spec.k], (v) => { s.params = Sh.sanitize(s.type, Object.assign({}, s.params, { [spec.k]: v })); }, true));
        box.appendChild(pg);
      } else {
        if (s.type === 'mesh') { const e = meshes.get(s.params.mid); box.appendChild(el('p', { class: 'hint', text: 'Model impor' + (e ? ' (' + (e.mesh.T.length / 3).toLocaleString('id-ID') + ' segitiga)' : '') + '. Ubah ukuran lewat Skala. Turunkan detail lewat menu Edit. Warna berlaku untuk seluruh model; bayangan halus bisa diatur di bagian Bayangan.' })); }
        else box.appendChild(el('p', { class: 'hint', text: 'Objek library (' + Lib.get(s.params.id).parts.length + ' bagian berwarna). Ubah ukuran lewat Skala, atau pecah jadi bagian agar tiap bagian bisa diedit.' }));
      }

      const trio = (title, arr, spec, extra) => {
        box.appendChild(el('h3', { text: title }));
        const g = el('div', { class: 'nfgrid three' });
        ['X', 'Y', 'Z'].forEach((ax, i) => g.appendChild(numField(ax, spec, () => arr()[i], (v) => extra(i, v))));
        box.appendChild(g);
      };
      trio('Posisi (studs)', () => s.pos, { step: 0.1 }, (i, v) => { s.pos[i] = v; });
      trio('Rotasi (derajat)', () => s.rot, { step: 5 }, (i, v) => { s.rot[i] = v; });
      let lock = true;
      trio('Skala', () => s.scale, { step: 0.1 }, (i, v) => {
        if (Math.abs(v) < 0.01) return;
        if (lock && s.scale[i] !== 0) { const k = v / s.scale[i]; s.scale = s.scale.map((x, j) => (j === i ? v : x * k)); syncFields(); }
        else s.scale[i] = v;
      });
      box.appendChild(el('label', { class: 'check' }, [el('input', { type: 'checkbox', checked: true, onchange: (e) => { lock = e.target.checked; } }), 'Kunci proporsi skala']));

      box.appendChild(el('h3', { text: def ? 'Warna' : 'Warna (menimpa semua bagian)' }));
      const col = el('input', { type: 'color', value: s.color, 'aria-label': 'Warna objek' });
      col.addEventListener('input', () => { beginEdit(); s.color = col.value; if (!def) s.tint = col.value; rebuild(); });
      col.addEventListener('change', () => { commitEdit(); renderList(); });
      box.appendChild(col);

      if (!def) box.appendChild(el('div', { class: 'btnrow' }, [
        el('button', { type: 'button', class: 'chip', text: 'Warna asli', onclick: () => act(() => { s.tint = null; }) }),
        el('button', { type: 'button', class: 'chip', text: 'Pecah jadi bagian', onclick: explode }),
      ]));

      // Shading (kehalusan permukaan)
      box.appendChild(el('h3', { text: 'Permukaan' }));
      const shSel = el('select', { 'aria-label': 'Gaya permukaan', onchange: (e) => act(() => { s.shade = e.target.value; }) }, [
        el('option', { value: 'asis', text: 'Sesuai bentuk (tepi tajam tetap tajam)' }),
        el('option', { value: 'auto', text: 'Halus otomatis (sudut di bawah batas dihaluskan)' }),
        el('option', { value: 'smooth', text: 'Halus semua (tanpa tepi tajam)' }),
      ]);
      shSel.value = s.shade || 'asis';
      box.appendChild(shSel);
      if (s.shade === 'auto') {
        const ang = el('input', { type: 'number', min: 5, max: 90, step: 5, value: s.crease, inputMode: 'numeric', 'aria-label': 'Batas sudut halus' });
        ang.addEventListener('change', () => act(() => { s.crease = clamp(parseFloat(ang.value) || 40, 5, 90); }));
        box.appendChild(el('label', { class: 'nf' }, [el('span', { text: 'Batas sudut (derajat)' }), ang]));
      }
      box.appendChild(el('p', { class: 'hint', text: 'Halus hanya mengubah pencahayaan, jadi tidak menambah segitiga. Untuk sudut yang benar-benar membulat, pakai Radius sudut pada kubus/balok.' }));


      // Modifier non-destruktif
      if (!(s.type === 'mesh' && meshes.get(s.params.mid) && meshes.get(s.params.mid).paint)) {
        box.appendChild(el('h3', { text: 'Modifier (non-destruktif)' }));
        const mods = s.mods || [];
        mods.forEach((md, i) => {
          const T = Mods.TYPES[md.type], card = el('div', { class: 'modcard' });
          const on = el('input', { type: 'checkbox', 'aria-label': 'Aktifkan ' + T.label }); on.checked = md.on !== false; on.addEventListener('change', () => act(() => { s.mods[i].on = on.checked; }, 'Modifier'));
          const head = el('div', { class: 'modhead' }, [on, el('strong', { text: T.label }), el('span', { class: 'sp' }),
            el('button', { type: 'button', class: 'chip', text: '▲', title: 'Naikkan', disabled: i === 0, 'aria-label': 'Naikkan modifier', onclick: () => act(() => { const x = s.mods.splice(i, 1)[0]; s.mods.splice(i - 1, 0, x); }, 'Urutan modifier') }),
            el('button', { type: 'button', class: 'chip', text: '▼', title: 'Turunkan', disabled: i === mods.length - 1, 'aria-label': 'Turunkan modifier', onclick: () => act(() => { const x = s.mods.splice(i, 1)[0]; s.mods.splice(i + 1, 0, x); }, 'Urutan modifier') }),
            el('button', { type: 'button', class: 'chip', text: '✕', title: 'Hapus modifier', 'aria-label': 'Hapus modifier', onclick: () => act(() => { s.mods.splice(i, 1); }, 'Hapus modifier') })]);
          card.appendChild(head);
          const mnum = (label, key, min, max, step) => { const inp = el('input', { type: 'number', min, max, step, value: md[key], inputMode: 'decimal', 'aria-label': label }); inp.addEventListener('change', () => act(() => { const v = parseFloat(inp.value); if (isFinite(v)) s.mods[i][key] = clamp(v, min, max); s.mods[i] = Mods.sanitize(s.mods[i]); }, 'Modifier')); return el('label', { class: 'nf' }, [el('span', { text: label }), inp]); };
          if (md.type === 'mirror') { const ax = el('select', { 'aria-label': 'Sumbu cermin' }, ['x', 'y', 'z'].map((a) => el('option', { value: a, text: 'Sumbu ' + a.toUpperCase() + ' (lokal)' }))); ax.value = md.axis; ax.addEventListener('change', () => act(() => { s.mods[i].axis = ax.value; }, 'Modifier')); card.appendChild(ax); }
          if (md.type === 'array') { card.appendChild(mnum('Jumlah salinan', 'count', 2, 24, 1)); card.appendChild(el('div', { class: 'three' }, [mnum('Jarak X', 'ox', -100, 100, 0.1), mnum('Jarak Y', 'oy', -100, 100, 0.1), mnum('Jarak Z', 'oz', -100, 100, 0.1)])); }
          if (md.type === 'solidify') card.appendChild(mnum('Ketebalan', 't', -5, 5, 0.05));
          if (md.type === 'subdiv') card.appendChild(mnum('Tingkat (1–3)', 'level', 1, 3, 1));
          box.appendChild(card);
        });
        const add = el('select', { 'aria-label': 'Tambah modifier' }, [el('option', { value: '', text: 'Tambah modifier…' })].concat(Object.keys(Mods.TYPES).map((k) => el('option', { value: k, text: Mods.TYPES[k].label }))));
        add.addEventListener('change', () => { if (!add.value) return; if (mods.length >= 6) { host.toast('Maksimal 6 modifier per objek.'); add.value = ''; return; } const t = add.value; act(() => { s.mods = (s.mods || []).concat([Mods.sanitize(Object.assign({ type: t }, Mods.TYPES[t].def))]); }, 'Tambah modifier'); });
        box.appendChild(add);
        box.appendChild(el('p', { class: 'hint', text: mods.length ? 'Modifier dihitung ulang dari bentuk dasar, jadi ukuran dan jumlahnya bisa diubah kapan saja. Pakai Edit > "Terapkan modifier" untuk menjadikannya mesh permanen (agar bisa diedit/dipahat).' : 'Cermin, Gandakan, Solidify, dan Subdivisi bisa ditumpuk dan diubah kapan saja tanpa merusak bentuk dasar.' }));
      }

      // Tekstur motif (UV otomatis lewat proyeksi kotak)
      if (window.S3DTextures) {
        box.appendChild(el('h3', { text: 'Tekstur motif' }));
        const tx = s.tex;
        const tSel = el('select', { 'aria-label': 'Motif tekstur', onchange: (e) => act(() => { s.tex = e.target.value ? { pat: e.target.value, scale: (s.tex && s.tex.scale) || 1, a: (s.tex && s.tex.a) || '#e9edf7', b: (s.tex && s.tex.b) || '#5b6fd6' } : null; }, 'Tekstur motif') }, [el('option', { value: '', text: 'Tanpa motif (warna polos)' })].concat(window.S3DTextures.list.map((p) => el('option', { value: p.id, text: p.label }))));
        tSel.value = tx ? tx.pat : '';
        box.appendChild(tSel);
        if (tx) {
          const ca = el('input', { type: 'color', value: tx.a, 'aria-label': 'Warna motif pertama' }), cb = el('input', { type: 'color', value: tx.b, 'aria-label': 'Warna motif kedua' });
          ca.addEventListener('change', () => act(() => { s.tex = Object.assign({}, s.tex, { a: ca.value }); }, 'Warna motif'));
          cb.addEventListener('change', () => act(() => { s.tex = Object.assign({}, s.tex, { b: cb.value }); }, 'Warna motif'));
          const sc = el('input', { type: 'number', min: 0.5, max: 4, step: 0.5, value: tx.scale, inputMode: 'decimal', 'aria-label': 'Kerapatan motif' });
          sc.addEventListener('change', () => act(() => { s.tex = Object.assign({}, s.tex, { scale: clamp(parseFloat(sc.value) || 1, 0.5, 4) }); }, 'Kerapatan motif'));
          box.appendChild(el('div', { class: 'two' }, [ca, cb]));
          box.appendChild(el('label', { class: 'nf' }, [el('span', { text: 'Kerapatan motif' }), sc]));
        }
        box.appendChild(el('p', { class: 'hint', text: 'UV dibuat otomatis dengan proyeksi kotak dari ukuran objek, jadi tidak perlu unwrap manual. Objek bermotif memakai segitiga yang sama, hanya titiknya dipisah per segitiga untuk UV.' }));
      }

      // Gandakan
      box.appendChild(el('h3', { text: 'Gandakan (array)' }));
      const arr = { mode: 'linear', count: 5, d: [2, 0, 0] };
      const modeSel = el('select', { 'aria-label': 'Mode gandakan', onchange: (e) => { arr.mode = e.target.value; dxrow.hidden = arr.mode !== 'linear'; } }, [el('option', { value: 'linear', text: 'Berderet (garis lurus)' }), el('option', { value: 'radial', text: 'Melingkar di sekitar titik pusat' })]);
      const cnt = el('input', { type: 'number', min: 2, max: 60, step: 1, value: 5, inputMode: 'numeric', 'aria-label': 'Jumlah total' });
      cnt.addEventListener('input', () => { arr.count = parseFloat(cnt.value) || 2; });
      const dxrow = el('div', { class: 'nfgrid three' });
      ['X', 'Y', 'Z'].forEach((ax, i) => { const inp = el('input', { type: 'number', step: 0.5, value: arr.d[i], inputMode: 'decimal', 'aria-label': 'Jarak ' + ax }); inp.addEventListener('input', () => { arr.d[i] = parseFloat(inp.value) || 0; }); dxrow.appendChild(el('label', { class: 'nf' }, [el('span', { text: 'Jarak ' + ax }), inp])); });
      box.append(modeSel, el('label', { class: 'nf' }, [el('span', { text: 'Jumlah total' }), cnt]), dxrow,
        el('p', { class: 'hint', text: 'Mode melingkar memutar salinan mengelilingi titik (0, 0, 0); jauhkan objek dari pusat dulu untuk menentukan jari-jari.' }),
        el('button', { type: 'button', class: 'chip', text: 'Buat salinan', onclick: () => arrayCopies(arr) }));

      box.appendChild(el('div', { class: 'btnrow' }, [
        el('button', { type: 'button', class: 'chip', text: 'Duplikat', onclick: duplicate }),
        el('button', { type: 'button', class: 'chip', text: 'Cermin X', onclick: mirrorX }),
        el('button', { type: 'button', class: 'chip', text: 'Taruh di lantai', onclick: toFloor }),
        el('button', { type: 'button', class: 'chip danger', text: 'Hapus', onclick: () => remove() }),
      ]));
      box.appendChild(el('label', { class: 'check' }, [el('input', { type: 'checkbox', class: 'lockchk', checked: !!s.lock, onchange: (e) => setLock(e.target.checked) }), 'Kunci objek (tidak bisa digeser atau diubah)']));
      if (s.lock) {
        box.querySelectorAll('input:not(.lockchk), select, button').forEach((n) => { n.disabled = true; });
        box.appendChild(el('p', { class: 'hint', text: 'Objek ini terkunci. Hilangkan centang "Kunci objek" untuk mengubahnya.' }));
      }
    }

    function renderMulti(box) {
      const list = selList(), n = list.length;
      box.appendChild(el('p', { class: 'hint strong', text: n + ' objek dipilih. Gizmo bergerak, memutar, dan menskala semuanya sekaligus dari pusat seleksi.' }));
      const row = (items) => el('div', { class: 'btnrow' }, items.map(([t, f, cls, title]) => el('button', { type: 'button', class: 'chip' + (cls ? ' ' + cls : ''), text: t, title: title || t, onclick: f })));
      box.appendChild(el('h3', { text: 'Grup' }));
      box.appendChild(row([['Jadikan grup (Ctrl+G)', groupSel], ['Lepas grup', ungroupSel]]));
      box.appendChild(el('h3', { text: 'Ratakan' }));
      for (const ax of ['x', 'y', 'z']) box.appendChild(el('div', { class: 'btnrow' }, [el('span', { class: 'axlab ax-' + ax, text: ax.toUpperCase() }),
        ...[['Min', 'min'], ['Tengah', 'center'], ['Maks', 'max']].map(([t, e]) => el('button', { type: 'button', class: 'chip', text: t, title: 'Ratakan sisi ' + t.toLowerCase() + ' pada sumbu ' + ax.toUpperCase(), onclick: () => align(ax, e) })),
        el('button', { type: 'button', class: 'chip', text: 'Bagi jarak', title: 'Bagi jarak sama rata (min. 3 objek)', onclick: () => distribute(ax) })]));
      box.appendChild(el('h3', { text: 'Cermin (terhadap pusat seleksi)' }));
      for (const ax of ['x', 'y', 'z']) box.appendChild(el('div', { class: 'btnrow' }, [el('span', { class: 'axlab ax-' + ax, text: ax.toUpperCase() }),
        el('button', { type: 'button', class: 'chip', text: 'Cermin', onclick: () => mirrorWorld(ax, false) }),
        el('button', { type: 'button', class: 'chip', text: 'Cermin + salin', onclick: () => mirrorWorld(ax, true) })]));
      box.appendChild(el('h3', { text: 'Warna semua' }));
      const col = el('input', { type: 'color', value: selected().color, 'aria-label': 'Warna untuk semua objek terpilih' });
      col.addEventListener('change', () => act(() => { for (const o of list) { o.color = col.value; o.tint = o.type === 'prefab' || o.type === 'mesh' ? col.value : null; } }, 'Warna'));
      box.appendChild(col);
      box.appendChild(row([['Duplikat', duplicate], ['Taruh di lantai', toFloor], ['Kunci', () => setLock(true)], ['Buka kunci', () => setLock(false)], ['Hapus', () => remove(), 'danger']]));
    }

    const collapsed = new Set();
    function renameInline(host2, current, onDone) {
      const inp = el('input', { type: 'text', class: 'txt rename', value: current, maxLength: 40, 'aria-label': 'Nama baru' });
      let done = false;
      const fin = (ok) => { if (done) return; done = true; if (ok && inp.value.trim() && inp.value !== current) onDone(inp.value.trim()); else renderList(); };
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') fin(true); else if (e.key === 'Escape') fin(false); });
      inp.addEventListener('blur', () => fin(true));
      host2.textContent = ''; host2.appendChild(inp); inp.focus(); inp.select();
    }
    function renderList() {
      const box = ui.list;
      box.textContent = '';
      if (!objects.length) {
        box.appendChild(el('p', { class: 'hint', text: 'Scene masih kosong. Tambahkan bentuk dari panel di atas, atau mulai dari contoh di bawah.' }));
        return;
      }
      const ul = el('ul', { class: 'objs', role: 'listbox', 'aria-multiselectable': 'true', aria: { label: 'Objek di scene' } });
      const clickSel = (o, mode) => (e) => select(o.id, e.ctrlKey || e.metaKey ? 'toggle' : e.shiftKey ? 'add' : mode);
      const objRow = (o, nested) => {
        const on = isSel(o.id);
        const row = el('li', { class: 'obj' + (on ? ' sel' : '') + (nested ? ' nested' : '') + (o.visible ? '' : ' dim'), role: 'option', aria: { selected: String(on) } });
        const nm = el('span', { class: 'obj-name', text: o.name, title: 'Klik dua kali untuk mengganti nama' });
        const main = el('button', { type: 'button', class: 'obj-main', onclick: clickSel(o, 'single') }, [el('i', { class: 'sw', style: 'background:' + o.color }), nm]);
        nm.addEventListener('dblclick', (e) => { e.preventDefault(); e.stopPropagation(); renameInline(main, o.name, (v) => act(() => { o.name = v; }, 'Ganti nama')); });
        const eye = el('button', { type: 'button', class: 'icon', text: o.visible ? 'Tampil' : 'Sembunyi', aria: { pressed: String(o.visible), label: (o.visible ? 'Sembunyikan ' : 'Tampilkan ') + o.name }, onclick: () => act(() => { o.visible = !o.visible; }, o.visible ? 'Sembunyikan' : 'Tampilkan') });
        const lk = el('button', { type: 'button', class: 'icon' + (o.lock ? ' on' : ''), text: o.lock ? 'Terkunci' : 'Kunci', aria: { label: (o.lock ? 'Buka kunci ' : 'Kunci ') + o.name }, onclick: () => act(() => { o.lock = !o.lock; }, o.lock ? 'Buka kunci' : 'Kunci') });
        const del = el('button', { type: 'button', class: 'icon', text: 'Hapus', aria: { label: 'Hapus ' + o.name }, onclick: () => remove(o.id) });
        row.append(main, eye, lk, del);
        return row;
      };
      const done = new Set();
      for (const o of objects) {
        if (done.has(o.id)) continue;
        if (!o.grp) { done.add(o.id); ul.appendChild(objRow(o, false)); continue; }
        const g = groups.find((x) => x.id === o.grp);
        const members = objects.filter((x) => x.grp === o.grp);
        members.forEach((m) => done.add(m.id));
        const allSel = members.every((m) => isSel(m.id)), open = !collapsed.has(o.grp);
        const head = el('li', { class: 'obj grp' + (allSel ? ' sel' : ''), role: 'option', aria: { selected: String(allSel) } });
        const caret = el('button', { type: 'button', class: 'icon caret', text: open ? '▾' : '▸', aria: { expanded: String(open), label: (open ? 'Ciutkan ' : 'Buka ') + (g ? g.name : 'grup') }, onclick: () => { if (open) collapsed.add(o.grp); else collapsed.delete(o.grp); renderList(); } });
        const nm = el('span', { class: 'obj-name', text: (g ? g.name : 'Grup') + ' (' + members.length + ')', title: 'Klik dua kali untuk mengganti nama' });
        const main = el('button', { type: 'button', class: 'obj-main', onclick: clickSel(o, 'only') }, [el('i', { class: 'sw grpsw' }), nm]);
        nm.addEventListener('dblclick', (e) => { e.preventDefault(); e.stopPropagation(); renameInline(main, g ? g.name : 'Grup', (v) => renameGroup(o.grp, v)); });
        const anyVis = members.some((m) => m.visible);
        const eye = el('button', { type: 'button', class: 'icon', text: anyVis ? 'Tampil' : 'Sembunyi', aria: { label: (anyVis ? 'Sembunyikan' : 'Tampilkan') + ' grup' }, onclick: () => act(() => { members.forEach((m) => { m.visible = !anyVis; }); }, anyVis ? 'Sembunyikan grup' : 'Tampilkan grup') });
        const ung = el('button', { type: 'button', class: 'icon', text: 'Lepas', aria: { label: 'Lepas grup' }, onclick: () => act(() => { members.forEach((m) => { m.grp = null; }); pruneGroups(); }, 'Lepas grup') });
        const del = el('button', { type: 'button', class: 'icon', text: 'Hapus', aria: { label: 'Hapus grup' }, onclick: () => { const ids = members.map((m) => m.id); act(() => { objects = objects.filter((x) => ids.indexOf(x.id) < 0); ids.forEach((k) => worldCache.delete(k)); pruneGroups(); setSel(selIds.filter((k) => ids.indexOf(k) < 0)); }, 'Hapus grup'); } });
        head.append(caret, main, eye, ung, del);
        ul.appendChild(head);
        if (open) for (const m of members) ul.appendChild(objRow(m, true));
      }
      box.appendChild(ul);
      box.appendChild(el('p', { class: 'hint', text: 'Ctrl/⌘ + klik menambah atau melepas seleksi. Klik dua kali nama untuk mengganti nama. Klik grup memilih semua anggotanya.' }));
    }

    function renderAll() { renderList(); renderProps(); syncHistoryButtons(); }

    function syncHistoryButtons() {
      if (ui.undo) { ui.undo.disabled = !undoStack.length; ui.redo.disabled = !redoStack.length; ui.undo.title = undoStack.length ? 'Batalkan: ' + undoStack[undoStack.length - 1].label : ''; ui.redo.title = redoStack.length ? 'Ulangi: ' + redoStack[redoStack.length - 1].label : ''; }
    }

    function applyGrid() {
      const v = host.getViewer();
      if (v && active) v.setGrid(settings.grid ? { half: 16, step: 1 } : null);
    }

    function syncSettingsUI() {
      if (!ui.snap) return;
      ui.snap.value = String(settings.snap); ui.drag.value = settings.drag; ui.gridOn.checked = settings.grid; if (ui.outlineSel) ui.outlineSel.value = settings.outline; syncToolbar();
      ui.metal.value = settings.metal; ui.rough.value = settings.rough;
      paint(ui.metal); paint(ui.rough);
      ui.metalOut.textContent = settings.metal.toFixed(2); ui.roughOut.textContent = settings.rough.toFixed(2);
    }
    function paint(r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%'); }

    function rangeRow(id, label, key) {
      const out = el('output', { htmlFor: id });
      const r = el('input', { type: 'range', id, min: 0, max: 1, step: 0.05, value: settings[key] });
      r.addEventListener('input', () => {
        settings[key] = parseFloat(r.value); out.textContent = settings[key].toFixed(2); paint(r);
        const v = host.getViewer(); if (v) v.setMaterial({ metallic: settings.metal, roughness: settings.rough });
        scheduleSave();
      });
      ui[key] = r; ui[key + 'Out'] = out;
      return el('div', { class: 'ctl' }, [el('label', { htmlFor: id, text: label }), out, r]);
    }

    const thumbs = new Map();
    let thumbViewer = null, thumbFail = false;
    function thumbShape(item) {
      return thumbOf('s:' + item.type + JSON.stringify(item.params || {}), () => makeObject(item.type, item.params || {}, { name: item.label, color: '#8fb6ff', pos: [0, 0, 0] }));
    }
    function thumbFor(it) {
      return thumbOf(it.id, () => makeObject('prefab', { id: it.id }, { name: it.name, color: it.parts[0].c, pos: [0, 0, 0] }));
    }
    function thumbOf(key, makeObj) {
      if (thumbs.has(key)) return thumbs.get(key);
      if (thumbFail || !root.S3DViewer) return null;
      try {
        if (!thumbViewer) {
          const cv = document.createElement('canvas');
          thumbViewer = root.S3DViewer.create(cv, { fixedSize: [144, 144], pixelRatio: 1 });
          if (!thumbViewer) { thumbFail = true; return null; }
          thumbViewer.setAutoRotate(false);
        }
        const o = makeObj();
        const m = buildMerged(false, [o]);
        thumbViewer.setMesh(m.mesh, m.canvas, { metallic: 0.1, roughness: 0.6 }, false);
        thumbViewer.setView('iso');
        const url = thumbViewer.renderAt(null, true).toDataURL('image/png');
        thumbs.set(key, url); worldCache.delete(o.id);
        return url;
      } catch (e) { thumbFail = true; return null; }
    }

    /* ------------------------------------------------------------ */
    /* Menu bar + toolbar melayang di pratinjau                      */
    /* ------------------------------------------------------------ */
    const ICON = {
      select: '<path d="M5 3l12 7-5.2 1.4L9.4 17z" />',
      move: '<path d="M10 2v16M2 10h16M10 2l-2.4 2.6M10 2l2.4 2.6M10 18l-2.4-2.6M10 18l2.4-2.6M2 10l2.6-2.4M2 10l2.6 2.4M18 10l-2.6-2.4M18 10l-2.6 2.4" />',
      rotate: '<path d="M16 10a6 6 0 1 1-2-4.5M16 3v4h-4" />',
      scale: '<path d="M4 16L16 4M16 4h-5M16 4v5M4 16h5M4 16v-5" />',
    };
    const svgIcon = (k) => { const w = document.createElement('span'); w.className = 'ico'; w.innerHTML = '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>'; return w; };
    let closeOpenMenu = null;
    function closeMenus() { if (closeOpenMenu) { closeOpenMenu(); closeOpenMenu = null; } }
    function makeMenu(label, itemsFn) {
      const btn = el('button', { type: 'button', class: 'mb-btn', aria: { haspopup: 'true', expanded: 'false' } }, [label, el('span', { class: 'mb-car', text: ' ▾' })]);
      const pop = el('div', { class: 'mb-pop', role: 'menu', hidden: true });
      const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!pop.hidden) { closeMenus(); return; }
        closeMenus();
        pop.textContent = '';
        for (const it of itemsFn()) {
          if (it.sep) { pop.appendChild(el('hr')); continue; }
          if (it.head) { pop.appendChild(el('div', { class: 'mb-head', text: it.head })); continue; }
          const b = el('button', { type: 'button', class: 'mb-item', role: 'menuitem', disabled: !!it.disabled }, [el('span', { text: it.label }), it.key ? el('kbd', { text: it.key }) : null]);
          b.addEventListener('click', (ev) => { ev.stopPropagation(); closeMenus(); it.run(); });
          pop.appendChild(b);
        }
        pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); closeOpenMenu = close;
      });
      return el('div', { class: 'mb-menu' }, [btn, pop]);
    }
    const clickDock = (id) => { const b = document.getElementById(id); if (b) b.click(); };
    function fileItems() {
      return [
        { label: 'Proyek baru', run: newProject, disabled: !objects.length },
        { label: 'Simpan proyek (.json)', run: saveProject },
        { label: 'Buka proyek…', run: () => ui.fileIn.click() },
        { label: 'Impor model (.glb / .obj + .mtl)…', run: () => ui.modelIn.click() },
        { sep: 1 },
        { label: 'Unduh .glb', run: () => clickDock('dl-glb') },
        { label: 'Unduh .obj + texture', run: () => clickDock('dl-obj') },
        { label: 'Unduh .stl', run: () => clickDock('dl-stl') },
        { label: 'Gambar .png', run: () => clickDock('dl-png') },
        { label: 'Ekspor per objek (zip banyak .glb)', run: () => { if (host.downloadParts) host.downloadParts(); }, disabled: !objects.some((o) => o.visible) },
        { sep: 1 },
        { label: 'Periksa mesh…', run: () => { if (host.openChecker) host.openChecker(); } },
      ];
    }

    /* ------------------------------------------------------------ */
    /* Boolean, terapkan modifier, Lab Bentuk                        */
    /* ------------------------------------------------------------ */
    function booleanOp(op) {
      const list = selIds.map((id) => objects.find((o) => o.id === id)).filter(Boolean);
      if (list.length !== 2) { host.toast('Pilih tepat 2 objek. Urutan pilih penting: objek pertama dikurangi objek kedua.'); return; }
      if (list.some((o) => o.lock)) { host.toast('Ada objek terkunci.'); return; }
      const pal = [], idx = new Map();
      const tri = list.map((o) => { const g = worldGeo(o), gg = o.tint || !g.ranges ? Object.assign({}, g, { ranges: null }) : g, base = o.tint || o.color; return CSG.fromGeo(gg, (hex) => { const h = (hex || base).toLowerCase(); if (!idx.has(h)) { idx.set(h, pal.length); pal.push(h); } return idx.get(h); }); });
      if (tri[0].length + tri[1].length > 24000) { host.toast('Terlalu banyak segitiga untuk Boolean (' + (tri[0].length + tri[1].length).toLocaleString('id-ID') + '). Turunkan detail dulu (maks 24.000 gabungan).'); return; }
      let res;
      try { res = CSG.run(op, tri[0], tri[1]); } catch (e) { host.toast('Boolean gagal: ' + e.message); return; }
      if (!res.length) { host.toast('Hasil boolean kosong (objek tidak saling beririsan).'); return; }
      const mesh = MO.weld(CSG.toMesh(res, pal), 1e-6);
      const label = { union: 'Gabung', difference: 'Kurangi', intersect: 'Irisan' }[op];
      const mid = registerMesh(mesh, 'Boolean ' + label);
      act(() => {
        const ids = new Set(list.map((o) => o.id)); for (let i = objects.length - 1; i >= 0; i--) if (ids.has(objects[i].id)) objects.splice(i, 1);
        const o = makeObject('mesh', { mid }, { name: 'Boolean ' + label, color: list[0].color }); o.shade = 'auto'; objects.push(o); setSel([o.id]);
      }, 'Boolean ' + label);
      host.toast('Boolean ' + label + ': ' + mesh.T.length / 3 + ' segitiga. Mesh hasil bisa diedit di Edit Mode.');
    }
    function bakeMods() {
      const list = selList().filter((o) => o.mods && o.mods.length && !o.lock);
      if (!list.length) { host.toast('Tidak ada objek terpilih yang punya modifier.'); return; }
      const made = [];
      for (const o of list) {
        try { const g = moddedGeo(o, baseGeo(o.type, o.params)); made.push([o, registerMesh(Ed.soupToTri(g), String(o.name || 'Model').slice(0, 30))]); } catch (e) { host.toast('Gagal menerapkan modifier: ' + e.message); return; }
      }
      act(() => { for (const [o, mid] of made) { o.type = 'mesh'; o.params = { mid }; o.mods = []; worldCache.delete(o.id); } }, 'Terapkan modifier');
      host.toast('Modifier diterapkan: objek menjadi mesh biasa.');
    }
    function openLab() {
      if (!Lab) return;
      Lab.open({ el, onCreate(mesh, name) {
        const w = MO.weld(mesh, 1e-7), mid = registerMesh(w, name);
        // letakkan di lantai di tengah
        let mn = 1e9; for (let i = 1; i < w.P.length; i += 3) mn = Math.min(mn, w.P[i]);
        act(() => { const o = makeObject('mesh', { mid }, { name, color: '#9fb4d9' }); o.shade = 'auto'; o.pos = [0, -mn, 0]; objects.push(o); setSel([o.id]); }, name);
        host.toast(name + ' dibuat: ' + (w.T.length / 3).toLocaleString('id-ID') + ' segitiga. Bisa dilanjut di Edit Mode / Sculpt.');
      } });
    }

    function editItems() {
      const n = selIds.length, has = n > 0;
      const items = [
        { label: edit.active ? 'Keluar dari Edit Mode' : 'Masuk Edit Mode', key: 'Tab', run: toggleEdit },
        { label: sculpt.active ? 'Keluar dari Sculpt Mode' : 'Masuk Sculpt Mode', key: 'Shift+Tab', run: toggleSculpt },
        { label: paintMode.active ? 'Keluar dari Cat tekstur' : 'Masuk Cat tekstur & UV', key: 'Shift+P', run: togglePaint },
        { sep: 1 },
        { label: 'Batalkan', key: 'Ctrl+Z', run: undo, disabled: !(cm() || undoStack.length) },
        { label: 'Ulangi', key: 'Ctrl+Y', run: redo, disabled: !redoStack.length },
      ];
      if (undoStack.length) {
        items.push({ head: 'Riwayat (klik untuk kembali ke sebelum langkah itu)' });
        for (let k = 0; k < Math.min(8, undoStack.length); k++) { const e = undoStack[undoStack.length - 1 - k]; items.push({ label: (k === 0 ? 'Terakhir: ' : '') + e.label, run: () => undoTo(k) }); }
      }
      items.push({ sep: 1 },
        { label: 'Pilih semua', key: 'Ctrl+A', run: selectAll, disabled: !objects.length },
        { label: 'Duplikat', key: 'Shift+D', run: duplicate, disabled: !has },
        { label: 'Hapus', key: 'X', run: () => remove(), disabled: !has },
        { sep: 1 },
        { label: 'Sembunyikan', key: 'H', run: () => setHidden(true), disabled: !has },
        { label: 'Tampilkan semua', key: 'Alt+H', run: () => setHidden(false), disabled: !objects.some((o) => !o.visible) },
        { label: 'Kunci', run: () => setLock(true), disabled: !has },
        { label: 'Buka kunci', run: () => setLock(false), disabled: !has },
        { sep: 1 },
        { label: 'Jadikan grup', key: 'Ctrl+G', run: groupSel, disabled: n < 2 },
        { label: 'Lepas grup', key: 'Ctrl+Shift+G', run: ungroupSel, disabled: !selList().some((o) => o.grp) },
        { sep: 1 },
        { label: 'Cermin X', run: () => mirrorWorld('x', false), disabled: !has },
        { label: 'Cermin Y', run: () => mirrorWorld('y', false), disabled: !has },
        { label: 'Cermin Z', run: () => mirrorWorld('z', false), disabled: !has },
        { label: 'Cermin + salin X', run: () => mirrorWorld('x', true), disabled: !has },
        { label: 'Taruh di lantai', run: toFloor, disabled: !has },
        { head: 'Boolean (pilih 2 objek: pertama dikurangi kedua)' },
        { label: 'Gabung (union)', run: () => booleanOp('union'), disabled: n !== 2 },
        { label: 'Kurangi (pertama − kedua)', run: () => booleanOp('difference'), disabled: n !== 2 },
        { label: 'Irisan (intersect)', run: () => booleanOp('intersect'), disabled: n !== 2 },
        { head: 'Bentuk dari profil' },
        { label: 'Lathe & Sweep…', run: openLab },
        { label: 'Terapkan modifier (jadi mesh)', run: bakeMods, disabled: !selList().some((o) => o.mods && o.mods.length) },
        { head: 'Model impor' },
        { label: 'Putar Z-atas ke Y-atas (model dari Blender)', run: () => act(() => { for (const o of selList()) if (o.type === 'mesh') o.rot = [(o.rot[0] || 0) - 90, o.rot[1], o.rot[2]]; }, 'Putar Z-atas ke Y-atas'), disabled: !selList().some((o) => o.type === 'mesh') },
        { label: 'Turunkan detail ke 50%', run: () => decimateSel(0.5), disabled: !selList().some((o) => o.type === 'mesh') },
        { label: 'Turunkan detail ke 25%', run: () => decimateSel(0.25), disabled: !selList().some((o) => o.type === 'mesh') },
        { label: 'Turunkan detail ke 10%', run: () => decimateSel(0.1), disabled: !selList().some((o) => o.type === 'mesh') },
        { label: 'Fokus ke semua', key: 'F', run: () => focusAll(true) });
      return items;
    }
    function addItems() {
      const items = [{ label: 'Library objek (' + Lib.items.length + ')…', run: () => ui.libCard && ui.libCard.scrollIntoView({ behavior: 'smooth', block: 'start' }) }];
      for (const g of Sh.CATALOG) { items.push({ head: g.label }); for (const it of g.items) items.push({ label: it.label, run: () => addShape(it) }); }
      return items;
    }
    function cycleSnap() { const order = [0.5, 1, 0.25, 0]; settings.snap = order[(order.indexOf(settings.snap) + 1) % order.length]; syncSettingsUI(); syncToolbar(); scheduleSave(); host.toast('Snap: ' + (settings.snap ? settings.snap + ' stud' : 'mati')); }
    function setSpace(sp) { settings.space = sp; syncToolbar(); updateOverlays(); }
    function syncToolbar() {
      if (!ui.fSpace) return;
      ui.fSpace.textContent = settings.space === 'local' ? 'Lokal' : 'Dunia';
      ui.fSpace.setAttribute('aria-pressed', String(settings.space === 'local'));
      ui.fSpace.title = settings.space === 'local' ? 'Gizmo mengikuti rotasi objek (klik untuk ke sumbu dunia)' : 'Gizmo sejajar sumbu dunia (klik untuk mengikuti rotasi objek)';
      ui.fSnap.textContent = settings.snap ? 'Snap ' + settings.snap : 'Snap mati';
      ui.fSnap.setAttribute('aria-pressed', String(settings.snap > 0));
      if (ui.spaceSel) ui.spaceSel.value = settings.space;
    }
    function buildStage() {
      const st = host.stage; if (!st || ui.stageBuilt) return;
      ui.stageBuilt = true;
      const bar = el('div', { class: 'mbar', role: 'menubar', 'aria-label': 'Menu Modeler' }, [
        makeMenu('File', fileItems), makeMenu('Edit', editItems), makeMenu('Tambah', addItems), makeMenu('Tampilan', viewItems),
        (ui.modeBtn = el('button', { type: 'button', class: 'mb-mode', text: 'Object Mode', title: 'Ganti ke Edit Mode (Tab): edit titik, tepi, dan muka objek terpilih', 'aria-pressed': 'false', onclick: toggleEdit })),
        (ui.sculptBtn = el('button', { type: 'button', class: 'mb-mode', text: 'Sculpt', title: 'Sculpt Mode (Shift+Tab): pahat dan cat warna objek terpilih', 'aria-pressed': 'false', onclick: toggleSculpt })),
        (ui.paintBtn = el('button', { type: 'button', class: 'mb-mode', text: 'Cat', title: 'Cat tekstur langsung di model + editor UV (Shift+P)', 'aria-pressed': 'false', onclick: togglePaint })),
        el('button', { type: 'button', class: 'mb-done', text: 'Selesai & Unduh', onclick: () => clickDock('dl-glb') }),
      ]);
      ui.fTools = ['select', 'move', 'rotate', 'scale'].map((t, k) => {
        const lab = { select: 'Pilih (Q)', move: 'Pindah (W)', rotate: 'Putar (E)', scale: 'Skala (T)' }[t];
        const b = el('button', { type: 'button', class: 'ftool', title: lab, data: { tool: t }, aria: { label: lab, pressed: String(settings.tool === t) }, onclick: () => setTool(t) });
        b.appendChild(svgIcon(t)); return b;
      });
      ui.fSpace = el('button', { type: 'button', class: 'ftool txt', onclick: () => setSpace(settings.space === 'local' ? 'global' : 'local') });
      ui.fSnap = el('button', { type: 'button', class: 'ftool txt', onclick: cycleSnap });
      const ft = el('div', { class: 'ftoolbar', role: 'toolbar', 'aria-label': 'Alat transformasi', 'aria-orientation': 'vertical' }, [...ui.fTools, el('hr'), ui.fSpace, ui.fSnap]);
      ui.mbar = bar; ui.ftb = ft;
      document.addEventListener('click', closeMenus);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
      st.append(bar, ft);
      syncToolbar();
    }

    function buildUI() {
      rootEl.textContent = '';

      // Alat transformasi
      ui.panelTools = [['select', 'Pilih (Q)'], ['move', 'Pindah (W)'], ['rotate', 'Putar (E)'], ['scale', 'Skala (T)']].map(([t, l]) => el('button', { type: 'button', class: 'chip' + (settings.tool === t ? ' on' : ''), text: l, data: { tool: t }, aria: { pressed: String(settings.tool === t) }, onclick: () => setTool(t) }));
      const toolCard = el('section', { class: 'card', aria: { labelledby: 'mk-h-tool' } }, [el('h2', { id: 'mk-h-tool', text: 'Alat' }), el('div', { class: 'btnrow' }, ui.panelTools),
        ui.spaceSel = el('select', { 'aria-label': 'Arah gizmo', onchange: (e) => setSpace(e.target.value) }, [el('option', { value: 'global', text: 'Gizmo sejajar sumbu dunia (Global)' }), el('option', { value: 'local', text: 'Gizmo mengikuti rotasi objek (Lokal)' })]),
        el('p', { class: 'hint', text: 'Pilih objek, lalu seret panah (pindah), cincin (putar), atau kotak (skala) pada pratinjau. Tahan Shift saat menskala untuk skala seragam. Ctrl/⌘ + klik menambah objek ke seleksi.' })]);
      ui.spaceSel.value = settings.space;

      // Library objek
      ui.libSearch = el('input', { type: 'search', class: 'txt', placeholder: 'Cari objek: pohon, mobil, robot...', 'aria-label': 'Cari objek library' });
      ui.libCat = 'Semua';
      ui.libCats = el('div', { class: 'chips' });
      ui.libGrid = el('div', { class: 'libgrid' });
      const drawLib = () => {
        ui.libCats.textContent = '';
        for (const c of ['Semua', ...Lib.cats]) ui.libCats.appendChild(el('button', { type: 'button', class: 'chip' + (ui.libCat === c ? ' on' : ''), text: c, onclick: () => { ui.libCat = c; drawLib(); } }));
        const q = ui.libSearch.value.trim().toLowerCase();
        ui.libGrid.textContent = '';
        for (const it of Lib.items) {
          if (ui.libCat !== 'Semua' && it.cat !== ui.libCat) continue;
          if (q && it.name.toLowerCase().indexOf(q) < 0 && it.id.indexOf(q) < 0 && it.cat.toLowerCase().indexOf(q) < 0) continue;
          const img = el('img', { alt: '', width: 72, height: 72, loading: 'lazy' });
          const thumb = thumbFor(it); if (thumb) img.src = thumb;
          ui.libGrid.appendChild(el('button', { type: 'button', class: 'lib-item', title: it.name, onclick: () => addPrefab(it.id) }, [img, el('span', { text: it.name })]));
        }
        if (!ui.libGrid.children.length) ui.libGrid.appendChild(el('p', { class: 'hint', text: 'Tidak ada objek yang cocok.' }));
      };
      ui.libSearch.addEventListener('input', drawLib);
      ui.drawLib = drawLib;
      const libCard = ui.libCard = el('section', { class: 'card', aria: { labelledby: 'mk-h-lib' } }, [el('h2', { id: 'mk-h-lib', text: 'Library objek (' + Lib.items.length + ')' }), ui.libSearch, ui.libCats, ui.libGrid,
        el('p', { class: 'hint', text: 'Objek dirakit dari bentuk dasar, jadi tetap ringan. Klik untuk menambahkan ke scene.' })]);

      // Tambah bentuk
      ui.shapeSearch = el('input', { type: 'search', class: 'txt', placeholder: 'Cari bentuk: bola, prisma, limas...', 'aria-label': 'Cari bentuk' });
      ui.shapeGrid = el('div', { class: 'shapegrid' });
      const drawShapes = () => {
        const q = ui.shapeSearch.value.trim().toLowerCase();
        ui.shapeGrid.textContent = '';
        for (const g of Sh.CATALOG) {
          const items = g.items.filter((item) => !q || (item.label + ' ' + Sh.DEFS[item.type].en + ' ' + g.label).toLowerCase().indexOf(q) >= 0);
          if (!items.length) continue;
          ui.shapeGrid.appendChild(el('h3', { text: g.label }));
          const grid = el('div', { class: 'libgrid flat' });
          for (const item of items) {
            const img = el('img', { alt: '', width: 72, height: 72, loading: 'lazy' });
            const t = thumbShape(item); if (t) img.src = t;
            grid.appendChild(el('button', { type: 'button', class: 'lib-item', title: Sh.DEFS[item.type].en, onclick: () => addShape(item) }, [img, el('span', { text: item.label })]));
          }
          ui.shapeGrid.appendChild(grid);
        }
        if (!ui.shapeGrid.children.length) ui.shapeGrid.appendChild(el('p', { class: 'hint', text: 'Tidak ada bentuk yang cocok.' }));
      };
      ui.shapeSearch.addEventListener('input', drawShapes);
      ui.drawShapes = drawShapes;
      const addCard = el('section', { class: 'card', aria: { labelledby: 'mk-h-add' } }, [el('h2', { id: 'mk-h-add', text: 'Tambah bentuk' }), ui.shapeSearch, ui.shapeGrid,
        el('p', { class: 'hint', text: 'Bentuk baru muncul di tengah lantai. Seret objek di pratinjau untuk memindahkannya, atau isi angka pada panel objek.' })]);

      // Objek terpilih
      ui.props = el('div', { class: 'props' });
      const propCard = el('section', { class: 'card', aria: { labelledby: 'mk-h-sel' } }, [el('h2', { id: 'mk-h-sel', text: 'Objek terpilih' }), ui.props]);

      // Daftar objek
      ui.list = el('div', { class: 'objlist' });
      ui.undo = el('button', { type: 'button', class: 'chip', text: 'Batalkan', onclick: undo });
      ui.redo = el('button', { type: 'button', class: 'chip', text: 'Ulangi', onclick: redo });
      const listCard = el('section', { class: 'card', aria: { labelledby: 'mk-h-list' } }, [
        el('div', { class: 'card-head' }, [el('h2', { id: 'mk-h-list', text: 'Objek di scene' }), el('div', { class: 'btnrow tight' }, [ui.undo, ui.redo])]),
        ui.list,
      ]);

      // Scene
      ui.snap = el('select', { id: 'mk-snap', onchange: (e) => { settings.snap = parseFloat(e.target.value); scheduleSave(); } }, [
        el('option', { value: '0', text: 'Mati' }), el('option', { value: '0.25', text: '0,25 stud' }), el('option', { value: '0.5', text: '0,5 stud' }), el('option', { value: '1', text: '1 stud' }),
      ]);
      ui.drag = el('select', { id: 'mk-drag', onchange: (e) => { settings.drag = e.target.value; scheduleSave(); } }, [
        el('option', { value: 'xz', text: 'Mendatar (kiri-kanan, depan-belakang)' }), el('option', { value: 'y', text: 'Tegak (naik-turun)' }),
      ]);
      ui.gridOn = el('input', { type: 'checkbox', id: 'mk-grid', onchange: (e) => { settings.grid = e.target.checked; applyGrid(); scheduleSave(); } });
      ui.modelIn = el('input', { type: 'file', accept: '.glb,.obj,.mtl', multiple: true, hidden: true, onchange: (e) => { importModel(e.target.files); e.target.value = ''; } });
      document.body.appendChild(ui.modelIn);
      const fileIn = ui.fileIn = el('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: (e) => { openProject(e.target.files[0]); e.target.value = ''; } });
      const sceneCard = el('section', { class: 'card', aria: { labelledby: 'mk-h-scene' } }, [
        el('h2', { id: 'mk-h-scene', text: 'Scene dan proyek' }),
        el('label', { class: 'field-label', htmlFor: 'mk-snap', text: 'Tempel ke grid saat menyeret' }), ui.snap,
        el('label', { class: 'field-label', htmlFor: 'mk-drag', text: 'Arah seret' }), ui.drag,
        el('label', { class: 'check' }, [ui.gridOn, 'Tampilkan grid lantai']),
        el('label', { class: 'field-label', htmlFor: 'mk-outline', text: 'Garis seleksi' }),
        (ui.outlineSel = el('select', { id: 'mk-outline', onchange: (e) => { settings.outline = e.target.value; updateOverlays(); scheduleSave(); } }, [el('option', { value: 'shape', text: 'Mengikuti bentuk (siluet)' }), el('option', { value: 'box', text: 'Kotak pembatas' })])),
        rangeRow('mk-metal', 'Metalik', 'metal'),
        rangeRow('mk-rough', 'Kekasaran', 'rough'),
        el('p', { class: 'hint', text: 'Warna tiap objek digabung jadi satu tekstur palet, jadi seluruh scene diekspor sebagai satu mesh. Metalik dan kekasaran berlaku untuk seluruh scene.' }),
        el('h3', { text: 'Mulai dari contoh' }),
        el('div', { class: 'btnrow' }, [
          el('button', { type: 'button', class: 'chip', text: 'Rumah', onclick: () => loadSample('rumah') }),
          el('button', { type: 'button', class: 'chip', text: 'Pohon', onclick: () => loadSample('pohon') }),
          el('button', { type: 'button', class: 'chip', text: 'Roket', onclick: () => loadSample('roket') }),
        ]),
        el('h3', { text: 'Tampilan dan proyek' }),
        el('div', { class: 'btnrow' }, [
          el('button', { type: 'button', class: 'chip', text: 'Fokus ke semua objek', onclick: () => focusAll(true) }),
          el('button', { type: 'button', class: 'chip', text: 'Simpan proyek', onclick: saveProject }),
          el('button', { type: 'button', class: 'chip', text: 'Buka proyek', onclick: () => fileIn.click() }),
          el('button', { type: 'button', class: 'chip', text: 'Impor model', title: 'Impor .glb atau .obj', onclick: () => ui.modelIn.click() }),
          el('button', { type: 'button', class: 'chip danger', text: 'Kosongkan scene', onclick: clearAll }),
        ]),
        fileIn,
      ]);

      rootEl.append(toolCard, addCard, libCard, propCard, listCard, sceneCard);
      drawLib();
      drawShapes();
      syncSettingsUI();
      renderAll();
    }

    /* ------------------------------------------------------------ */
    /* Edit Mode (titik / tepi / muka)                               */
    /* ------------------------------------------------------------ */
    const toWorldPt = (o, p) => { const m = rotMat(o.rot), S = o.scale.map((v) => (Math.abs(v) < 1e-4 ? 1e-4 : v)); const x = p[0] * S[0], y = p[1] * S[1], z = p[2] * S[2]; return [m[0] * x + m[1] * y + m[2] * z + o.pos[0], m[3] * x + m[4] * y + m[5] * z + o.pos[1], m[6] * x + m[7] * y + m[8] * z + o.pos[2]]; };
    const toLocalPt = (o, w) => { const m = rotMat(o.rot), S = o.scale.map((v) => (Math.abs(v) < 1e-4 ? 1e-4 : v)); const x = w[0] - o.pos[0], y = w[1] - o.pos[1], z = w[2] - o.pos[2]; return [(m[0] * x + m[3] * y + m[6] * z) / S[0], (m[1] * x + m[4] * y + m[7] * z) / S[1], (m[2] * x + m[5] * y + m[8] * z) / S[2]]; };
    const cm = () => (edit.active ? edit : sculpt.active ? sculpt : paintMode.active ? paintMode : null);
    function updateModeChip() { const c = cm(); if (ui.modeBtn) { ui.modeBtn.textContent = c ? c.label : 'Object Mode'; ui.modeBtn.setAttribute('aria-pressed', String(!!c)); ui.modeBtn.classList.toggle('on', !!c); } if (ui.sculptBtn) { ui.sculptBtn.setAttribute('aria-pressed', String(sculpt.active)); ui.sculptBtn.classList.toggle('on', sculpt.active); } if (ui.paintBtn) { ui.paintBtn.setAttribute('aria-pressed', String(paintMode.active)); ui.paintBtn.classList.toggle('on', paintMode.active); } }
    function drawBox(x0, y0, x1, y1) {
      const st = host.stage; if (!st) return;
      if (!ui.edBox) { ui.edBox = el('div', { class: 'ed-box', hidden: true }); st.appendChild(ui.edBox); }
      if (x0 == null) { ui.edBox.hidden = true; return; }
      const r = st.getBoundingClientRect();
      Object.assign(ui.edBox.style, { left: Math.min(x0, x1) - r.left + 'px', top: Math.min(y0, y1) - r.top + 'px', width: Math.abs(x1 - x0) + 'px', height: Math.abs(y1 - y0) + 'px' });
      ui.edBox.hidden = false;
    }
    const modeCtx = {
      el, toast: (t) => host.toast(t), viewer: () => host.getViewer(),
      localGeo: (o) => baseGeo(o.type, o.params),
      meshOf: (o) => { const e = meshes.get(o.params.mid), me = e.mesh; if (!me.UV) return me; host.toast('Cat tekstur dibuang: mesh berUV dibuka untuk diedit.'); return MO.weld({ P: Float64Array.from(me.P), T: me.T, C: me.C, pal: me.pal }, 1e-7); },
      uvMeshOf: (o) => { if (o.type !== 'mesh') return null; const e = meshes.get(o.params.mid); return e && e.paint ? { P: e.mesh.P, T: e.mesh.T, UV: e.mesh.UV, N: e.mesh.N, C: e.mesh.C, pal: e.mesh.pal, S: e.paint.S, canvas: e.paint.canvas } : null; },
      surfaceOf: (o) => { if (o.type === 'mesh') { const me = meshes.get(o.params.mid).mesh; return me.UV ? MO.weld({ P: Float64Array.from(me.P), T: me.T, C: me.C, pal: me.pal }, 1e-7) : me; } return Ed.soupToTri(baseGeo(o.type, o.params)); },
      commitPaint(o, r) {
        const mid = registerMesh({ P: r.P, T: r.T, C: r.C, pal: r.pal, UV: r.UV, N: r.N, S: r.S, canvas: r.canvas }, String(o.name || 'Model').slice(0, 30));
        act(() => { o.type = 'mesh'; o.params = { mid }; o.tint = null; o.shade = 'asis'; worldCache.delete(o.id); }, 'Cat tekstur');
        host.toast('Cat tekstur tersimpan (' + r.S + ' px).');
      },
      toWorld: toWorldPt, toLocal: toLocalPt,
      axes: (o) => { if (settings.space === 'local') { const m = rotMat(o.rot); return [[m[0], m[3], m[6]], [m[1], m[4], m[7]], [m[2], m[5], m[8]]]; } return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; },
      getTool: () => settings.tool, setTool: (t) => setTool(t), snap: () => settings.snap,
      rebuild: () => rebuild(), requestPanel: () => renderProps(), drawBox,
      commitMesh(o, tri, conv, extra) {
        const mid = registerMesh({ P: tri.P, T: tri.T, C: tri.C, pal: tri.pal }, String(o.name || 'Model').slice(0, 30));
        act(() => { o.type = 'mesh'; o.params = { mid }; if (extra && extra.painted) o.tint = null; worldCache.delete(o.id); }, 'Edit Mode');
        host.toast('Selesai: ' + (tri.T.length / 3).toLocaleString('id-ID') + ' segitiga.');
      },
      onExit() {
        const v = host.getViewer();
        if (v && active) {
          v.setDragHandler(handler);
          v.setHoverHandler((e) => { if (settings.tool === 'select' || !selected()) { if (gizmoHover) { gizmoHover = null; updateOverlays(); } return; } const h = v.gizmoHit(e.clientX, e.clientY); if (h !== gizmoHover) { gizmoHover = h; updateOverlays(); } });
          v.setOverlays([]);
        }
        drawBox(null); updateModeChip(); worldCache.clear(); rebuild(); renderAll();
      },
    };
    const edit = Ed.create(modeCtx);
    edit.label = 'Edit Mode';
    const sculpt = Scu.create(modeCtx);
    const paintMode = Pnt.create(modeCtx);
    function toggleMode(ctl) {
      const cur = cm();
      if (cur) { const same = cur === ctl; cur.exit(true); if (same) return; }
      const o = selected();
      if (selIds.length !== 1 || !o) { host.toast('Pilih satu objek dulu untuk masuk ' + ctl.label + '.'); return; }
      if (o.lock) { host.toast('Objek terkunci. Buka kunci dulu.'); return; }
      if (!o.visible) { host.toast('Objek tersembunyi. Tampilkan dulu.'); return; }
      commitEdit();
      const v = host.getViewer();
      if (!ctl.enter(o)) return;
      if (v) { v.setDragHandler(ctl.handler); v.setHoverHandler(ctl.hover); }
      if (ctl === edit && settings.tool === 'select') setTool('move');
      updateModeChip(); renderAll(); updateOverlays();
    }
    const toggleEdit = () => toggleMode(edit), toggleSculpt = () => toggleMode(sculpt), togglePaint = () => toggleMode(paintMode);


    /* ------------------------------------------------------------ */
    /* Transformasi modal G / R / S, snap titik, ukur, tampilan      */
    /* ------------------------------------------------------------ */
    let modal = null, measure = null, lastPtr = { x: 0, y: 0 };
    const hud = (t) => { const st = host.stage; if (!st) return; if (!ui.hud) { ui.hud = el('div', { class: 'modal-hud', role: 'status', hidden: true }); st.appendChild(ui.hud); } ui.hud.textContent = t || ''; ui.hud.hidden = !t; };
    const unit3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const AX = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    function modalAxisVec() {
      if (!modal.axis) return null;
      if (modal.local && modal.items[0]) { const m = rotMat(modal.items[0].rot), i = { x: 0, y: 1, z: 2 }[modal.axis]; return unit3([m[i], m[3 + i], m[6 + i]]); }
      return AX[modal.axis];
    }
    function vertexSnap(cx, cy) {
      const v = host.getViewer(); let best = null, bd = 16; const skip = new Set(modal ? modal.items.map((it) => it.o.id) : []);
      for (const o of objects) {
        if (!o.visible || skip.has(o.id)) continue;
        const g = worldGeo(o), P = g.positions, step = Math.max(1, Math.floor(P.length / 3 / 40000)) * 3;
        for (let i = 0; i < P.length; i += step) { const q = v.project([P[i], P[i + 1], P[i + 2]]); const d = Math.hypot(q.x - cx, q.y - cy); if (d < bd) { bd = d; best = [P[i], P[i + 1], P[i + 2]]; } }
      }
      return best;
    }
    function modalApply() {
      const v = host.getViewer(), cam = v.getCamera(), M = modal, A = modalAxisVec(), snapOn = settings.snap > 0;
      const typed = M.typed !== '' && isFinite(parseFloat(M.typed)) ? parseFloat(M.typed) : null;
      let label = '';
      if (M.kind === 'g') {
        let d;
        const ray = v.rayFromClient(lastPtr.x, lastPtr.y), den = dot3(ray.d, cam.F);
        const hitP = Math.abs(den) > 1e-6 ? (() => { const t = dot3([M.C[0] - ray.o[0], M.C[1] - ray.o[1], M.C[2] - ray.o[2]], cam.F) / den; return [ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t]; })() : M.C;
        d = [hitP[0] - M.P0[0], hitP[1] - M.P0[1], hitP[2] - M.P0[2]];
        if (A) { const k = dot3(d, A); d = [A[0] * k, A[1] * k, A[2] * k]; }
        if (typed != null) { const ax = A || AX.x; d = [ax[0] * typed, ax[1] * typed, ax[2] * typed]; }
        else if (M.ctrl) { const s = vertexSnap(lastPtr.x, lastPtr.y); if (s) { d = [s[0] - M.items[0].pos[0], s[1] - M.items[0].pos[1], s[2] - M.items[0].pos[2]]; M.snapPt = s; } else M.snapPt = null; }
        else if (snapOn) d = d.map((x) => Math.round(x / settings.snap) * settings.snap);
        for (const it of M.items) it.o.pos = [r3(it.pos[0] + d[0]), r3(it.pos[1] + d[1]), r3(it.pos[2] + d[2])];
        label = 'Geser' + (M.axis ? ' ' + M.axis.toUpperCase() + (M.local ? ' (lokal)' : '') : '') + ': ' + d.map((x) => r3(x)).join(', ') + (M.snapPt ? ' [menempel ke titik]' : '');
      } else if (M.kind === 'r') {
        const ax = A || cam.F.map((x) => -x);
        let ang;
        if (typed != null) ang = typed * DEG;
        else {
          const a0 = Math.atan2(M.start.y - M.sc.y, M.start.x - M.sc.x), a1 = Math.atan2(lastPtr.y - M.sc.y, lastPtr.x - M.sc.x);
          let da = -(a1 - a0); if (dot3(ax, cam.F) > 0) da = -da; ang = da;
          if (snapOn || M.ctrl) ang = Math.round(ang / (15 * DEG)) * 15 * DEG;
        }
        const c = Math.cos(ang), s2 = Math.sin(ang), t1 = 1 - c;
        const R = [t1 * ax[0] * ax[0] + c, t1 * ax[0] * ax[1] - s2 * ax[2], t1 * ax[0] * ax[2] + s2 * ax[1], t1 * ax[0] * ax[1] + s2 * ax[2], t1 * ax[1] * ax[1] + c, t1 * ax[1] * ax[2] - s2 * ax[0], t1 * ax[0] * ax[2] - s2 * ax[1], t1 * ax[1] * ax[2] + s2 * ax[0], t1 * ax[2] * ax[2] + c];
        for (const it of M.items) {
          it.o.rot = matToEuler(matMul(R, rotMat(it.rot)));
          if (M.items.length > 1) { const q = [it.pos[0] - M.C[0], it.pos[1] - M.C[1], it.pos[2] - M.C[2]]; it.o.pos = [r3(M.C[0] + R[0] * q[0] + R[1] * q[1] + R[2] * q[2]), r3(M.C[1] + R[3] * q[0] + R[4] * q[1] + R[5] * q[2]), r3(M.C[2] + R[6] * q[0] + R[7] * q[1] + R[8] * q[2])]; }
        }
        label = 'Putar' + (M.axis ? ' ' + M.axis.toUpperCase() : ' (sumbu pandang)') + ': ' + Math.round((ang / DEG) * 10) / 10 + '°';
      } else {
        let f;
        if (typed != null) f = typed;
        else { const d0 = Math.hypot(M.start.x - M.sc.x, M.start.y - M.sc.y) || 1, d1 = Math.hypot(lastPtr.x - M.sc.x, lastPtr.y - M.sc.y); f = d1 / d0; if (snapOn || M.ctrl) f = Math.round(f * 10) / 10; }
        f = clamp(f, 0.01, 50);
        const ai = M.axis ? { x: 0, y: 1, z: 2 }[M.axis] : -1;
        for (const it of M.items) {
          const ns = it.scale.slice(); for (let k = 0; k < 3; k++) if (ai < 0 || k === ai) ns[k] = Math.round(it.scale[k] * f * 1000) / 1000;
          it.o.scale = ns.map((x) => (Math.abs(x) < 0.01 ? 0.01 * (x < 0 ? -1 : 1) : x));
          if (M.items.length > 1) { const np = it.pos.slice(); for (let k = 0; k < 3; k++) if (ai < 0 || k === ai) np[k] = r3(M.C[k] + (it.pos[k] - M.C[k]) * f); it.o.pos = np; }
        }
        label = 'Skala' + (M.axis ? ' ' + M.axis.toUpperCase() : '') + ': ×' + Math.round(f * 1000) / 1000;
      }
      hud(label + '   |   X Y Z kunci sumbu · ketik angka · klik/Enter terima · Esc batal');
      rebuild(); syncFields();
      const ov = []; if (A) ov.push({ lines: [M.C[0] - A[0] * 500, M.C[1] - A[1] * 500, M.C[2] - A[2] * 500, M.C[0] + A[0] * 500, M.C[1] + A[1] * 500, M.C[2] + A[2] * 500], color: { x: [1, 0.35, 0.4, 0.9], y: [0.5, 1, 0.5, 0.9], z: [0.4, 0.6, 1, 0.9] }[M.axis] });
      if (M.snapPt) ov.push({ pts: M.snapPt, size: 6, color: [1, 0.85, 0.2, 1] });
      v.setOverlays(ov);
    }
    function modalEnd(ok) {
      if (!modal) return; const M = modal; modal = null;
      const st = host.stage; st.removeEventListener('pointermove', modalMove, true); st.removeEventListener('pointerdown', modalDown, true); document.removeEventListener('keydown', modalKey, true);
      if (!ok) { for (const it of M.items) { it.o.pos = it.pos; it.o.rot = it.rot; it.o.scale = it.scale; } }
      commitEdit(); hud(''); rebuild(); renderAll(); updateOverlays();
    }
    function modalMove(e) { lastPtr = { x: e.clientX, y: e.clientY }; if (modal) { e.stopPropagation(); modalApply(); } }
    function modalDown(e) { e.stopPropagation(); e.preventDefault(); modalEnd(e.button === 0); }
    function modalKey(e) {
      if (!modal) return; const k = e.key.toLowerCase(); e.stopImmediatePropagation(); e.preventDefault();
      if (k === 'escape') return modalEnd(false);
      if (k === 'enter') return modalEnd(true);
      if ('xyz'.includes(k) && k.length === 1) { if (modal.axis === k && !modal.local) modal.local = true; else if (modal.axis === k) { modal.axis = null; modal.local = false; } else { modal.axis = k; modal.local = false; } }
      else if (/^[0-9.\-]$/.test(e.key)) { if (e.key === '-' && modal.typed.length) modal.typed = modal.typed.startsWith('-') ? modal.typed.slice(1) : '-' + modal.typed; else modal.typed += e.key; }
      else if (k === 'backspace') modal.typed = modal.typed.slice(0, -1);
      else if (k === 'control') modal.ctrl = true;
      modalApply();
    }
    function modalKeyUp(e) { if (modal && e.key === 'Control') { modal.ctrl = false; modal.snapPt = null; modalApply(); } }
    document.addEventListener('keyup', modalKeyUp);
    function startModal(kind) {
      if (modal || cm()) return;
      const list = selList().filter((o) => o.visible && !o.lock); if (!list.length) { host.toast('Pilih objek yang tidak terkunci dulu.'); return; }
      const v = host.getViewer(), box = selBox(), C = box.c, cam = v.getCamera(), sc = v.project(C);
      const ray = v.rayFromClient(lastPtr.x, lastPtr.y), den = dot3(ray.d, cam.F);
      const t = Math.abs(den) > 1e-6 ? dot3([C[0] - ray.o[0], C[1] - ray.o[1], C[2] - ray.o[2]], cam.F) / den : 0;
      modal = { kind, axis: null, local: false, typed: '', ctrl: false, C, sc, start: { x: lastPtr.x, y: lastPtr.y }, P0: [ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t], items: list.map((o) => ({ o, pos: o.pos.slice(), rot: o.rot.slice(), scale: o.scale.slice() })) };
      beginEdit({ g: 'Pindah', r: 'Putar', s: 'Skala' }[kind]);
      const st = host.stage; st.addEventListener('pointermove', modalMove, true); st.addEventListener('pointerdown', modalDown, true); document.addEventListener('keydown', modalKey, true);
      modalApply();
    }
    if (host.stage) host.stage.addEventListener('pointermove', (e) => { lastPtr = { x: e.clientX, y: e.clientY }; }, true);

    // Ukur jarak
    function measureOv() {
      if (!measure) return [];
      const out = [], p = measure.pts;
      if (p.length) out.push({ pts: p.flat(), size: 6, color: [1, 0.85, 0.2, 1] });
      if (p.length === 2) out.push({ lines: [...p[0], ...p[1]], color: [1, 0.85, 0.2, 1] });
      return out;
    }
    function measureText() {
      const p = measure.pts; if (p.length < 2) return 'Ukur: klik titik ' + (p.length + 1) + ' di permukaan objek · Esc keluar';
      const d = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
      return 'Jarak: ' + r3(Math.hypot(d[0], d[1], d[2])) + ' satuan  (ΔX ' + r3(Math.abs(d[0])) + ', ΔY ' + r3(Math.abs(d[1])) + ', ΔZ ' + r3(Math.abs(d[2])) + ')  ·  klik lagi untuk ukur baru · Esc keluar';
    }
    function measureDown(e) {
      if (e.button !== 0 || !measure) return; const v = host.getViewer(); const ray = v.rayFromClient(e.clientX, e.clientY), h = pick(ray); if (!h) return;
      e.stopPropagation(); e.preventDefault();
      const P = [ray.o[0] + ray.d[0] * h.t, ray.o[1] + ray.d[1] * h.t, ray.o[2] + ray.d[2] * h.t];
      if (measure.pts.length >= 2) measure.pts = []; measure.pts.push(P); hud(measureText()); updateOverlays();
    }
    function measureKey(e) { if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); toggleMeasure(false); } }
    function toggleMeasure(on) {
      if (on === undefined) on = !measure;
      if (on && !measure) { if (cm() || modal) return; measure = { pts: [] }; host.stage.addEventListener('pointerdown', measureDown, true); document.addEventListener('keydown', measureKey, true); hud(measureText()); }
      else if (!on && measure) { measure = null; host.stage.removeEventListener('pointerdown', measureDown, true); document.removeEventListener('keydown', measureKey, true); hud(''); }
      updateOverlays();
    }

    // Tampilan: cahaya dan render PNG
    function setLight(id) { const v = host.getViewer(); if (v) { v.setLighting(id); } settings.light = id; }
    function renderPNG(scale) {
      const v = host.getViewer(); if (!v) return;
      v.renderScaled(scale, true, (blob, w, h) => {
        if (!blob) { host.toast('Gagal membuat gambar.'); return; }
        const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'saltoria-render-' + w + 'x' + h + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
        host.toast('Gambar ' + w + '×' + h + ' px tersimpan (latar transparan).');
      });
    }
    function viewItems() {
      const v = host.getViewer(), cur = v ? v.lighting : 'studio', items = [{ head: 'Cahaya' }];
      for (const p of v ? v.lightPresets() : []) items.push({ label: (p.id === cur ? '✓ ' : '') + p.label, run: () => setLight(p.id) });
      items.push({ sep: 1 }, { head: 'Render gambar (.png transparan)' },
        { label: 'Resolusi layar (1×)', run: () => renderPNG(1) }, { label: 'Resolusi 2×', run: () => renderPNG(2) }, { label: 'Resolusi 4×', run: () => renderPNG(4) },
        { sep: 1 }, { label: measure ? 'Selesai mengukur' : 'Ukur jarak (klik 2 titik)', run: () => toggleMeasure(), key: 'M' },
        { sep: 1 }, { label: 'Panduan singkat', run: () => Guide && Guide.open(el, true) });
      return items;
    }

    /* ------------------------------------------------------------ */
    /* Papan ketik                                                   */
    /* ------------------------------------------------------------ */
    document.addEventListener('keydown', (e) => {
      if (!active) return;
      const t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      if (cm()) { if (cm().onKey(e)) e.preventDefault(); return; }
      if (e.key === 'Tab' && !mod && (t === document.body || tag === 'CANVAS')) { e.preventDefault(); if (e.shiftKey) toggleSculpt(); else toggleEdit(); return; }
      if (e.shiftKey && !mod && e.key.toLowerCase() === 'p' && (t === document.body || tag === 'CANVAS')) { e.preventDefault(); togglePaint(); return; }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); }
      else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAll(); }
      else if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); if (e.shiftKey) ungroupSel(); else groupSel(); }
      else if (e.shiftKey && !mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); }
      else if (e.key === 'Delete' || e.key === 'Backspace' || (!mod && e.key.toLowerCase() === 'x')) { if (selIds.length) { e.preventDefault(); remove(); } }
      else if (!mod && e.key.toLowerCase() === 'h') { e.preventDefault(); setHidden(!e.altKey); }
      else if (e.key === 'Escape') { if (selIds.length) select(null); }
      else if (!mod && !e.shiftKey && !e.altKey && 'grs'.indexOf(e.key.toLowerCase()) >= 0 && e.key.length === 1 && (t === document.body || tag === 'CANVAS')) { e.preventDefault(); startModal(e.key.toLowerCase()); }
      else if (!mod && !e.shiftKey && 'qwet'.indexOf(e.key.toLowerCase()) >= 0 && e.key.length === 1) setTool({ q: 'select', w: 'move', e: 'rotate', t: 'scale' }[e.key.toLowerCase()]);
      else if (!mod && !e.shiftKey && e.key.toLowerCase() === 'm' && (t === document.body || tag === 'CANVAS')) toggleMeasure();
      else if (e.key.toLowerCase() === 'f' && !mod) focusAll(true);
    });

    /* ------------------------------------------------------------ */
    /* Siklus hidup                                                  */
    /* ------------------------------------------------------------ */
    let started = false, started2 = false;
    function activate() {
      active = true;
      const v = host.getViewer();
      if (!started) { started = true; loadStored(); buildUI(); }
      buildStage();
      if (Guide && !started2) { started2 = true; setTimeout(() => Guide.open(el, false), 600); }
      if (ui.mbar) { ui.mbar.hidden = false; ui.ftb.hidden = false; }
      if (v) {
        v.setAutoRotate(false);
        v.setDragHandler(handler);
        v.setHoverHandler((e) => {
          if (settings.tool === 'select' || !selected()) { if (gizmoHover) { gizmoHover = null; updateOverlays(); } return; }
          const h = v.gizmoHit(e.clientX, e.clientY);
          if (h !== gizmoHover) { gizmoHover = h; updateOverlays(); }
        });
        v.setGrid(settings.grid ? { half: 16, step: 1 } : null);
        v.setMaterial({ metallic: settings.metal, roughness: settings.rough });
        v.setGlow(settings.glow);
        focusAll(true);
      }
      rebuild();
    }
    function deactivate() {
      if (cm()) cm().exit(true);
      if (modal) modalEnd(false); if (measure) toggleMeasure(false);
      { const vv = host.getViewer(); if (vv) vv.setLighting('studio'); }
      active = false;
      commitEdit(); closeMenus();
      if (ui.mbar) { ui.mbar.hidden = true; ui.ftb.hidden = true; }
      const v = host.getViewer();
      if (v) { v.setDragHandler(null); v.setHoverHandler(null); v.setGrid(null); v.setFrame(null); v.setOverlays([]); v.setGizmo(null); }
    }

    return {
      activate, deactivate, exportData, exportParts, autoReduce, resetDetail, totalTriangles, get detail() { return settings.detail; }, undo, redo, setMaterial, refresh: () => rebuild(),
      get material() { return { metallic: settings.metal, roughness: settings.rough, name: 'SaltoriaBentuk3D' }; },
      // untuk uji
      _api: { selScreen: () => { const b = selBox(); return b ? host.getViewer().project(b.c) : null; }, startModal, modalEnd, toggleMeasure, setLight, renderPNG, booleanOp, bakeMods, openLab, edit, sculpt, paint: paintMode, toggleEdit, toggleSculpt, togglePaint, selList, setSel, groupSel, ungroupSel, mirrorWorld, align, distribute, setLock, setHidden, selectAll, setSpace, newProject, undoTo, silEdges, settings, groups: () => groups, addPrefab, explode, arrayCopies, setTool, thumbFor, addShape, objects: () => objects, selected, pick, handler, select, remove, duplicate, focusAll, worldGeo, loadSample, buildMerged },
    };
  }

  root.S3DMaker = { create, TRI_LIMIT };
})(typeof self !== 'undefined' ? self : this);
