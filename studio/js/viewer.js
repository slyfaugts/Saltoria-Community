/*
 * Penampil 3D mungil berbasis WebGL (tanpa library).
 * Orbit (seret), geser (dua jari / klik kanan / Shift+seret), zoom (cubit / roda), klik dua kali = reset.
 * Untuk editor: grid lantai, sinar pick dari kursor, dan penangan seret objek.
 */
(function (root) {
  'use strict';

  const VERT = `
    attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUv; attribute vec3 aCol;
    uniform mat4 uMVP;
    varying vec3 vN; varying vec3 vP; varying vec2 vUv; varying vec3 vCol;
    void main() { vN = aNor; vP = aPos; vUv = aUv; vCol = aCol; gl_Position = uMVP * vec4(aPos, 1.0); }`;

  const FRAG = `
    precision mediump float;
    uniform sampler2D uTex;
    uniform vec3 uCam; uniform vec3 uL0; uniform vec3 uL1; uniform vec3 uL2;
    uniform float uMetal; uniform float uRough; uniform vec4 uFlat; uniform float uMode; uniform float uGlow; uniform float uVC; uniform float uAmb; uniform vec3 uK; uniform vec3 uTint; uniform float uRimK; uniform vec3 uRimC;
    varying vec3 vN; varying vec3 vP; varying vec2 vUv; varying vec3 vCol;
    void main() {
      if (uFlat.a > 0.0) { gl_FragColor = vec4(uFlat.rgb * uFlat.a, uFlat.a); return; }
      vec3 N = normalize(vN);
      vec3 V = normalize(uCam - vP);
      if (dot(N, V) < 0.0 && !gl_FrontFacing) N = -N;
      vec3 c = uMode > 0.5 ? vec3(0.74, 0.78, 0.86) : (uVC > 0.5 ? vCol : texture2D(uTex, vUv).rgb);
      float diff = uAmb + uK.x * max(dot(N, uL0), 0.0) + uK.y * max(dot(N, uL1), 0.0) + uK.z * max(dot(N, uL2), 0.0);
      vec3 H = normalize(uL0 + V);
      float shin = mix(90.0, 14.0, uRough);
      float sp = pow(max(dot(N, H), 0.0), shin) * (1.0 - uRough * 0.75);
      vec3 spec = mix(vec3(1.0), c, uMetal) * sp * (0.30 + 0.55 * uMetal);
      float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * uRimK;
      vec3 col = c * uTint * diff * mix(1.0, 0.6, uMetal) + spec * uTint + rim * uRimC;
      col += c * uGlow * (0.55 + 0.45 * rim * 4.0);
      gl_FragColor = vec4(col, 1.0);
    }`;

  // Preset cahaya: arah relatif kamera (kanan, atas, depan), ambient, kekuatan tiap lampu, warna lampu, cahaya tepi
  const LIGHTS = {
    studio: { label: 'Studio (bawaan)', c: [[1.0, -0.55, 0.75], [0.8, 0.9, 0.1], [-0.6, 0.0, 0.5]], amb: 0.32, k: [0.78, 0.30, 0.18], tint: [1, 1, 1], rim: 0.22, rimc: [0.55, 0.7, 1] },
    siang: { label: 'Siang cerah', c: [[0.4, 1.0, 0.6], [-0.7, 0.3, 0.4], [0.2, -0.6, 0.4]], amb: 0.46, k: [0.95, 0.22, 0.12], tint: [1.04, 1.02, 0.96], rim: 0.08, rimc: [0.8, 0.9, 1] },
    senja: { label: 'Senja hangat', c: [[1.0, 0.18, 0.5], [-0.8, 0.5, 0.3], [0.0, -0.4, 0.8]], amb: 0.26, k: [1.1, 0.2, 0.12], tint: [1.12, 0.92, 0.78], rim: 0.35, rimc: [1, 0.55, 0.4] },
    neon: { label: 'Neon malam', c: [[-1.0, 0.4, 0.6], [1.0, -0.2, 0.3], [0.0, 0.9, -0.3]], amb: 0.14, k: [0.7, 0.75, 0.35], tint: [0.85, 0.9, 1.1], rim: 0.75, rimc: [0.9, 0.35, 1] },
    kontras: { label: 'Kontras dramatis', c: [[1.0, 0.7, 0.4], [-1, -0.3, 0.2], [0, 0, 1]], amb: 0.08, k: [1.25, 0.12, 0.05], tint: [1, 1, 1], rim: 0.3, rimc: [0.7, 0.8, 1] },
    datar: { label: 'Datar (lihat warna asli)', c: [[0.5, 0.8, 0.8], [-0.5, 0.3, 0.6], [0, -0.5, 0.7]], amb: 0.78, k: [0.16, 0.08, 0.05], tint: [1, 1, 1], rim: 0.0, rimc: [1, 1, 1] },
  };

  /* ---- matematika matriks (kolom-mayor) ---- */
  const m4 = {
    perspective(fov, aspect, near, far) {
      const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
      return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    },
    ortho(l, r, b, t, n, f) {
      return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);
    },
    lookAt(e, t, u) {
      let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2];
      let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
      l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return new Float32Array([
        xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
        -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1,
      ]);
    },
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
      return o;
    },
  };

  function createViewer(canvas, opts) {
    opts = opts || {};
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true }) ||
               canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) return null;
    const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const uintExt = isGL2 ? true : gl.getExtension('OES_element_index_uint');
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(prog, 0, 'aPos'); gl.bindAttribLocation(prog, 1, 'aNor'); gl.bindAttribLocation(prog, 2, 'aUv'); gl.bindAttribLocation(prog, 3, 'aCol');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const U = {};
    ['uMVP', 'uTex', 'uCam', 'uL0', 'uL1', 'uL2', 'uMetal', 'uRough', 'uFlat', 'uMode', 'uGlow', 'uVC', 'uAmb', 'uK', 'uTint', 'uRimK', 'uRimC'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

    const state = {
      yaw: 0, pitch: 0.08, dist: 10, off: [0, 0, 0],
      radius: 1, baseDist: 10, fov: (34 * Math.PI) / 180,
      auto: !reduceMotion, interacted: false, wire: false, dirty: true,
      metal: 0, rough: 0.7, t0: performance.now(),
      center: [0, 0, 0], halfW: 1, halfH: 1, frame: false,
      light: 'studio', ortho: false, shading: 'material', glow: 0, clean: false, gizmo: null, overlays: [],
    };
    const gpu = { col: null, pos: null, nor: null, uv: null, idx: null, edgeIdx: null, count: 0, edgeCount: 0, tex: null, mesh: null };
    let grid = null; // { sets: [{buf,count,color}] }
    let dragHandler = null, hoverCb = null, tmpBuf = null;
    const cw = () => opts.fixedSize ? opts.fixedSize[0] : canvas.clientWidth;
    const ch = () => opts.fixedSize ? opts.fixedSize[1] : canvas.clientHeight;

    function makeTexture(source) {
      if (gpu.tex) gl.deleteTexture(gpu.tex);
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (isGL2) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gpu.tex = tex;
    }

    function buf(target, data, old) {
      if (old) gl.deleteBuffer(old);
      const b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      return b;
    }

    function setMesh(mesh, textureSource, mat, keepView) {
      if (!uintExt) throw new Error('Perangkat ini tidak mendukung mesh besar (OES_element_index_uint).');
      gpu.mesh = mesh;
      gpu.pos = buf(gl.ARRAY_BUFFER, mesh.positions, gpu.pos);
      gpu.nor = buf(gl.ARRAY_BUFFER, mesh.normals, gpu.nor);
      gpu.uv = buf(gl.ARRAY_BUFFER, mesh.uvs, gpu.uv);
      gpu.idx = buf(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gpu.idx);
      gpu.count = mesh.indices.length;
      const e = new Uint32Array(mesh.indices.length * 2);
      for (let i = 0, k = 0; i < mesh.indices.length; i += 3) {
        const a = mesh.indices[i], b = mesh.indices[i + 1], c = mesh.indices[i + 2];
        e[k++] = a; e[k++] = b; e[k++] = b; e[k++] = c; e[k++] = c; e[k++] = a;
      }
      gpu.edgeIdx = buf(gl.ELEMENT_ARRAY_BUFFER, e, gpu.edgeIdx);
      gpu.edgeCount = e.length;
      if (textureSource) makeTexture(textureSource);
      if (mat) { state.metal = mat.metallic || 0; state.rough = mat.roughness == null ? 0.7 : mat.roughness; if ('glow' in mat) state.glow = mat.glow || 0; }
      if (!state.frame) {
        const cx = (mesh.max[0] - mesh.min[0]) / 2, cy = (mesh.max[1] - mesh.min[1]) / 2, cz = (mesh.max[2] - mesh.min[2]) / 2;
        state.radius = Math.hypot(cx, cy, cz) || 1;
        state.center = [(mesh.max[0] + mesh.min[0]) / 2, (mesh.max[1] + mesh.min[1]) / 2, (mesh.max[2] + mesh.min[2]) / 2];
        state.halfW = cx; state.halfH = cy;
        fitDistance();
        if (!keepView) resetView(true);
      }
      state.dirty = true; requestRender();
    }

    // perbarui posisi/normal tanpa membangun ulang indeks (dipakai Sculpt)
    function updateVerts(positions, normals) {
      if (!gpu.pos || !gpu.mesh) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.pos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.nor); gl.bufferSubData(gl.ARRAY_BUFFER, 0, normals);
      gpu.mesh.positions = positions; gpu.mesh.normals = normals;
      state.dirty = true; requestRender();
    }
    // warna per titik (Float32Array 0..1, 3 per titik); null = pakai tekstur
    function setVertexColors(arr, partial) {
      if (!arr) { if (gpu.col) { gl.deleteBuffer(gpu.col); gpu.col = null; } state.vcol = false; state.dirty = true; requestRender(); return; }
      if (partial && gpu.col) { gl.bindBuffer(gl.ARRAY_BUFFER, gpu.col); gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr); }
      else gpu.col = buf(gl.ARRAY_BUFFER, arr, gpu.col);
      state.vcol = true; state.dirty = true; requestRender();
    }
    function clearMesh() { gpu.count = 0; gpu.edgeCount = 0; gpu.mesh = null; state.dirty = true; requestRender(); }
    function setTexture(source) { makeTexture(source); state.dirty = true; requestRender(); }
    function setMaterial(mat) { state.metal = mat.metallic || 0; state.rough = mat.roughness == null ? 0.7 : mat.roughness; if ('glow' in mat) state.glow = mat.glow || 0; state.dirty = true; requestRender(); }

    function fitDistance() {
      const aspect = cw() / Math.max(1, ch());
      const tanV = Math.tan(state.fov / 2);
      const dH = (state.halfH * 1.18 + state.radius * 0.05) / tanV;
      const dW = (state.halfW * 1.18 + state.radius * 0.05) / (tanV * aspect);
      state.baseDist = Math.max(dH, dW, state.radius * 1.2);
    }

    function resetView(silent) {
      state.yaw = 0; state.pitch = state.frame ? 0.38 : 0.08; state.off = [0, 0, 0]; state.dist = state.baseDist;
      state.interacted = false; state.t0 = performance.now();
      if (!silent) { state.dirty = true; requestRender(); }
    }

    // Bingkai kamera tetap (editor): kamera tidak lagi mengikuti ukuran mesh.
    function setFrame(f, reset) {
      if (!f) { state.frame = false; return; }
      state.frame = true;
      state.center = f.center.slice();
      state.radius = f.radius; state.halfW = f.halfW; state.halfH = f.halfH;
      fitDistance();
      if (reset !== false) resetView(true);
      state.dirty = true; requestRender();
    }

    function setGrid(g) {
      if (grid) grid.sets.forEach((s) => gl.deleteBuffer(s.buf));
      grid = null;
      if (g) {
        const N = g.half || 20, st = g.step || 1, L = N * st;
        const minor = [], major = [];
        for (let i = -N; i <= N; i++) {
          if (i === 0) continue;
          const v = i * st, arr = i % 5 === 0 ? major : minor;
          arr.push(-L, 0, v, L, 0, v, v, 0, -L, v, 0, L);
        }
        const mk = (data, color) => ({ buf: buf(gl.ARRAY_BUFFER, new Float32Array(data), null), count: data.length / 3, color });
        grid = { sets: [
          mk(minor, [0.62, 0.74, 1, 0.10]),
          mk(major, [0.62, 0.74, 1, 0.22]),
          mk([-L, 0, 0, L, 0, 0], [1, 0.42, 0.5, 0.75]),
          mk([0, 0, -L, 0, 0, L], [0.45, 0.62, 1, 0.75]),
        ] };
      }
      state.dirty = true; requestRender();
    }

    function resize() {
      const dpr = opts.fixedSize ? (opts.pixelRatio || 1) : Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(cw() * dpr)), h = Math.max(1, Math.round(ch() * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const prevBase = state.baseDist;
      fitDistance();
      if (prevBase > 0 && !state.interacted) state.dist = state.baseDist;
      else if (prevBase > 0) state.dist *= state.baseDist / prevBase;
      state.dirty = true;
    }

    let raf = 0;
    function requestRender() { if (!raf) raf = requestAnimationFrame(frame); }

    function currentYaw(now) {
      if (state.auto && !state.interacted) return Math.sin(((now == null ? performance.now() : now) - state.t0) / 1700) * 0.55;
      return state.yaw;
    }

    function frame(now) {
      raf = 0;
      if (state.auto && !state.interacted) state.dirty = true;
      if (state.dirty) { draw(currentYaw(now)); state.dirty = false; }
      if (state.auto && !state.interacted && !document.hidden) requestRender();
    }

    function camera(yaw) {
      const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      const c = state.center;
      const tgt = [c[0] + state.off[0], c[1] + state.off[1], c[2] + state.off[2]];
      const eye = [tgt[0] + state.dist * cp * Math.sin(yaw), tgt[1] + state.dist * sp, tgt[2] + state.dist * cp * Math.cos(yaw)];
      const view = m4.lookAt(eye, tgt, [0, 1, 0]);
      const aspect = canvas.width / Math.max(1, canvas.height);
      const hh = state.dist * Math.tan(state.fov / 2);
      const proj = state.ortho ? m4.ortho(-hh * aspect, hh * aspect, -hh, hh, -state.dist * 10, state.dist * 10)
                               : m4.perspective(state.fov, aspect, state.dist * 0.02, state.dist * 10);
      const fx = tgt[0] - eye[0], fy = tgt[1] - eye[1], fz = tgt[2] - eye[2];
      const fl = Math.hypot(fx, fy, fz) || 1;
      const F = [fx / fl, fy / fl, fz / fl];
      let R = [-F[2], 0, F[0]];
      const rl = Math.hypot(R[0], R[1], R[2]) || 1; R = [R[0] / rl, R[1] / rl, R[2] / rl];
      const Up = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]];
      return { eye, tgt, mvp: m4.mul(proj, view), F, R, Up, aspect, hh };
    }

    function draw(yaw) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);

      const cam = camera(yaw);
      const { F, R, Up } = cam;
      const comb = (a, b, c2) => {
        const v = [-F[0] * a + R[0] * b + Up[0] * c2, -F[1] * a + R[1] * b + Up[1] * c2, -F[2] * a + R[2] * b + Up[2] * c2];
        const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l];
      };
      gl.uniformMatrix4fv(U.uMVP, false, cam.mvp);
      gl.uniform3fv(U.uCam, cam.eye);
      const LP = LIGHTS[state.light] || LIGHTS.studio;
      gl.uniform3fv(U.uL0, comb(LP.c[0][0], LP.c[0][1], LP.c[0][2])); gl.uniform3fv(U.uL1, comb(LP.c[1][0], LP.c[1][1], LP.c[1][2])); gl.uniform3fv(U.uL2, comb(LP.c[2][0], LP.c[2][1], LP.c[2][2]));
      gl.uniform1f(U.uAmb, LP.amb); gl.uniform3fv(U.uK, LP.k); gl.uniform3fv(U.uTint, LP.tint); gl.uniform1f(U.uRimK, LP.rim); gl.uniform3fv(U.uRimC, LP.rimc);
      gl.uniform1f(U.uMetal, state.metal); gl.uniform1f(U.uRough, state.rough);
      gl.uniform1i(U.uTex, 0);
      gl.uniform1f(U.uMode, state.shading === 'solid' ? 1 : 0);
      gl.uniform1f(U.uGlow, state.glow);
      gl.uniform1f(U.uVC, state.vcol && gpu.col ? 1 : 0);
      gl.disableVertexAttribArray(3);

      if (gpu.count) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, gpu.tex);
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.pos); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.nor); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.uv); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
        if (state.vcol && gpu.col) { gl.bindBuffer(gl.ARRAY_BUFFER, gpu.col); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0); }

        gl.uniform4f(U.uFlat, 0, 0, 0, 0);
        if (state.shading === 'wire' && false) {}
        if (state.wire) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1); }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpu.idx);
        gl.drawElements(gl.TRIANGLES, gpu.count, gl.UNSIGNED_INT, 0);
        if (state.wire) {
          gl.disable(gl.POLYGON_OFFSET_FILL);
          gl.uniform4f(U.uFlat, 0.55, 0.85, 1.0, 1.0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpu.edgeIdx);
          gl.drawElements(gl.LINES, gpu.edgeCount, gl.UNSIGNED_INT, 0);
        }
      }

      gl.disableVertexAttribArray(3); gl.uniform1f(U.uVC, 0);
      if (grid && !state.clean) {
        gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        for (const s of grid.sets) {
          gl.bindBuffer(gl.ARRAY_BUFFER, s.buf);
          gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
          gl.uniform4f(U.uFlat, s.color[0], s.color[1], s.color[2], s.color[3]);
          gl.drawArrays(gl.LINES, 0, s.count);
        }
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
      if (!state.clean) drawExtras(cam);
    }

    /* ---- overlay garis & gizmo ---- */
    function dynDraw(data, mode, color) {
      if (!data.length) return;
      if (tmpBuf) gl.deleteBuffer(tmpBuf);
      tmpBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, tmpBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
      gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.uniform4f(U.uFlat, color[0], color[1], color[2], color[3]);
      gl.drawArrays(mode, 0, data.length / 3);
    }

    function pxScale(p, cam) {
      // ukuran dunia untuk 1 piksel layar di posisi p
      let d = state.dist;
      if (!state.ortho) d = Math.max(0.01, (p[0] - cam.eye[0]) * cam.F[0] + (p[1] - cam.eye[1]) * cam.F[1] + (p[2] - cam.eye[2]) * cam.F[2]);
      return (2 * d * Math.tan(state.fov / 2)) / Math.max(1, ch());
    }

    const AX = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const ACOL = { x: [1, 0.36, 0.42], y: [0.45, 0.95, 0.55], z: [0.42, 0.62, 1] };
    function gizmoGeom(g, cam) {
      const s = pxScale(g.pos, cam) * 96;
      const out = []; // { axis, mode, data }
      const P = g.pos;
      const AXG = g.axes || AX;
      const add = (i, k) => [P[0] + AXG[i][0] * k, P[1] + AXG[i][1] * k, P[2] + AXG[i][2] * k];
      for (let i = 0; i < 3; i++) {
        const ax = 'xyz'[i];
        if (g.mode === 'rotate') {
          const ring = []; const u = AXG[(i + 1) % 3], v = AXG[(i + 2) % 3];
          for (let a = 0; a < 48; a++) {
            const t = (a / 48) * Math.PI * 2, c = Math.cos(t) * s * 0.9, n = Math.sin(t) * s * 0.9;
            ring.push(P[0] + u[0] * c + v[0] * n, P[1] + u[1] * c + v[1] * n, P[2] + u[2] * c + v[2] * n);
          }
          out.push({ axis: ax, kind: 'ring', pts: ring, s });
        } else {
          out.push({ axis: ax, kind: g.mode, a: P, b: add(i, s), i, s, AX: AXG });
        }
      }
      return out;
    }

    // Garis siluet: tepi tajam + tepi di batas depan/belakang menurut sudut pandang kamera.
    // sil: Float32Array, 13 angka per tepi [p1(3) p2(3) n1(3) n2(3) selalu(1)].
    function silLines(sil, cam) {
      const out = [];
      const ortho = state.ortho, F = cam.F, e = cam.eye;
      for (let k = 0; k < sil.length; k += 13) {
        let draw = sil[k + 12] > 0;
        if (!draw) {
          let vx, vy, vz;
          if (ortho) { vx = -F[0]; vy = -F[1]; vz = -F[2]; }
          else { vx = e[0] - sil[k]; vy = e[1] - sil[k + 1]; vz = e[2] - sil[k + 2]; }
          const a = sil[k + 6] * vx + sil[k + 7] * vy + sil[k + 8] * vz, b = sil[k + 9] * vx + sil[k + 10] * vy + sil[k + 11] * vz;
          draw = (a > 0) !== (b > 0);
        }
        if (draw) out.push(sil[k], sil[k + 1], sil[k + 2], sil[k + 3], sil[k + 4], sil[k + 5]);
      }
      return out;
    }

    function drawExtras(cam) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      gl.depthMask(false);
      for (const o of state.overlays) {
        gl.disable(gl.DEPTH_TEST);
        if (o.tris) { dynDraw(o.tris, gl.TRIANGLES, o.color); continue; }
        if (o.pts) {
          // titik: kotak kecil menghadap kamera dengan ukuran tetap dalam piksel
          const H = canvas.clientHeight || canvas.height || 1, q = [], px = o.size || 3;
          for (let i = 0; i < o.pts.length; i += 3) {
            const p = [o.pts[i], o.pts[i + 1], o.pts[i + 2]];
            const depth = (p[0] - cam.eye[0]) * cam.F[0] + (p[1] - cam.eye[1]) * cam.F[1] + (p[2] - cam.eye[2]) * cam.F[2];
            const s = px * (state.ortho ? (2 * cam.hh) / H : (Math.max(0.01, depth) * 2 * Math.tan(state.fov / 2)) / H) * 0.5 * 2;
            const r = cam.R, u = cam.Up;
            const A = [p[0] - r[0] * s - u[0] * s, p[1] - r[1] * s - u[1] * s, p[2] - r[2] * s - u[2] * s], B = [p[0] + r[0] * s - u[0] * s, p[1] + r[1] * s - u[1] * s, p[2] + r[2] * s - u[2] * s];
            const C = [p[0] + r[0] * s + u[0] * s, p[1] + r[1] * s + u[1] * s, p[2] + r[2] * s + u[2] * s], D = [p[0] - r[0] * s + u[0] * s, p[1] - r[1] * s + u[1] * s, p[2] - r[2] * s + u[2] * s];
            q.push(...A, ...B, ...C, ...A, ...C, ...D);
          }
          dynDraw(q, gl.TRIANGLES, o.color); continue;
        }
        dynDraw(o.sil ? silLines(o.sil, cam) : o.lines, gl.LINES, o.color);
      }
      gl.disable(gl.DEPTH_TEST);
      const g = state.gizmo;
      if (g) {
        for (const part of gizmoGeom(g, cam)) {
          const hot = g.active === part.axis || (!g.active && g.hover === part.axis);
          const c = ACOL[part.axis].slice(); c[3] = hot ? 1 : 0.85;
          if (hot) { c[0] = Math.min(1, c[0] + 0.35); c[1] = Math.min(1, c[1] + 0.35); c[2] = Math.min(1, c[2] + 0.35); }
          if (part.kind === 'ring') {
            const d = []; const p = part.pts, n = p.length / 3;
            for (let k = 0; k < n; k++) { const j = (k + 1) % n; d.push(p[k * 3], p[k * 3 + 1], p[k * 3 + 2], p[j * 3], p[j * 3 + 1], p[j * 3 + 2]); }
            dynDraw(d, gl.LINES, c);
          } else {
            dynDraw([...part.a, ...part.b], gl.LINES, c);
            const AXP = part.AX, i = part.i, u = AXP[(i + 1) % 3], v = AXP[(i + 2) % 3], s = part.s;
            if (part.kind === 'move') {
              const h = s * 0.2, r = s * 0.07, base = part.b, tip = [base[0] + AXP[i][0] * h, base[1] + AXP[i][1] * h, base[2] + AXP[i][2] * h];
              const tri = [];
              for (let a = 0; a < 10; a++) {
                const t0 = (a / 10) * Math.PI * 2, t1 = ((a + 1) / 10) * Math.PI * 2;
                const q = (t) => [base[0] + (u[0] * Math.cos(t) + v[0] * Math.sin(t)) * r, base[1] + (u[1] * Math.cos(t) + v[1] * Math.sin(t)) * r, base[2] + (u[2] * Math.cos(t) + v[2] * Math.sin(t)) * r];
                tri.push(...tip, ...q(t0), ...q(t1));
              }
              dynDraw(tri, gl.TRIANGLES, c);
            } else {
              const h = s * 0.06, B = part.b, tri = [];
              const corner = (a, b2, c2) => [B[0] + (a * AXP[i][0] + b2 * u[0] + c2 * v[0]) * h, B[1] + (a * AXP[i][1] + b2 * u[1] + c2 * v[1]) * h, B[2] + (a * AXP[i][2] + b2 * u[2] + c2 * v[2]) * h];
              const faces = [[[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
                [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
                [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]];
              for (const f of faces) { const q = f.map((p) => corner(p[0], p[1], p[2])); tri.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]); }
              dynDraw(tri, gl.TRIANGLES, c);
            }
          }
        }
      }
      gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    }

    function project(p) {
      const cam = camera(currentYaw());
      const m = cam.mvp;
      const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
      const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      const r = canvas.getBoundingClientRect();
      return { x: r.left + ((x / w) * 0.5 + 0.5) * r.width, y: r.top + (1 - ((y / w) * 0.5 + 0.5)) * r.height };
    }
    const segDist = (px, py, a, b) => {
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2));
      return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
    };
    // Sumbu gizmo yang terkena kursor (koordinat klien) atau null.
    function gizmoHit(cx, cy) {
      const g = state.gizmo; if (!g) return null;
      const cam = camera(currentYaw());
      let best = null, bd = 11;
      for (const part of gizmoGeom(g, cam)) {
        let d = 1e9;
        if (part.kind === 'ring') {
          const n = part.pts.length / 3; let prev = project(part.pts.slice(0, 3));
          for (let k = 1; k <= n; k++) { const j = (k % n) * 3; const cur = project([part.pts[j], part.pts[j + 1], part.pts[j + 2]]); d = Math.min(d, segDist(cx, cy, prev, cur)); prev = cur; }
        } else d = segDist(cx, cy, project(part.a), project(part.b));
        if (d < bd) { bd = d; best = part.axis; }
      }
      return best;
    }

    // Sinar dari titik layar (koordinat klien) dalam ruang model.
    function rayFromClient(cx, cy) {
      const r = canvas.getBoundingClientRect();
      const nx = ((cx - r.left) / Math.max(1, r.width)) * 2 - 1;
      const ny = 1 - ((cy - r.top) / Math.max(1, r.height)) * 2;
      const cam = camera(currentYaw());
      const tanV = Math.tan(state.fov / 2);
      const kx = nx * tanV * cam.aspect, ky = ny * tanV;
      if (state.ortho) {
        const o = [0, 1, 2].map((i) => cam.eye[i] + cam.R[i] * nx * cam.hh * cam.aspect + cam.Up[i] * ny * cam.hh);
        return { o, d: cam.F.slice() };
      }
      const d = [cam.F[0] + cam.R[0] * kx + cam.Up[0] * ky, cam.F[1] + cam.R[1] * kx + cam.Up[1] * ky, cam.F[2] + cam.R[2] * kx + cam.Up[2] * ky];
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      return { o: cam.eye.slice(), d: [d[0] / l, d[1] / l, d[2] / l] };
    }

    /* ---- interaksi ---- */
    const pointers = new Map();
    let lastPinch = 0, lastMid = null;
    let capture = null; // { id } saat objek sedang diseret
    let tap = null;     // { id, x, y } kandidat klik
    const stopAuto = () => { if (!state.interacted) { state.yaw = currentYaw(); state.interacted = true; } };

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey });
      if (pointers.size === 2) {
        if (capture && dragHandler) { dragHandler.end(); capture = null; }
        tap = null;
        const [a, b] = [...pointers.values()];
        lastPinch = Math.hypot(a.x - b.x, a.y - b.y); lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      } else if (pointers.size === 1 && dragHandler && e.button === 0 && !e.shiftKey) {
        const ray = rayFromClient(e.clientX, e.clientY);
        if (dragHandler.start(ray, e)) { capture = { id: e.pointerId }; tap = null; return; }
        tap = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
      stopAuto();
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) { if (hoverCb) hoverCb(e); return; }
      if (capture && capture.id === e.pointerId) {
        dragHandler.move(rayFromClient(e.clientX, e.clientY), e);
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (tap && tap.id === e.pointerId && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 5) tap = null;
      if (pointers.size === 1) {
        if (p.b === 2 || p.shift || e.shiftKey) pan(dx, dy);
        else { state.yaw -= dx * 0.008; state.pitch = Math.max(-1.553, Math.min(1.553, state.pitch + dy * 0.008)); }
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (lastPinch > 0) zoomBy(lastPinch / d);
        if (lastMid) pan(mid.x - lastMid.x, mid.y - lastMid.y);
        lastPinch = d; lastMid = mid;
      }
      state.dirty = true; requestRender();
    });

    const up = (e) => {
      if (capture && capture.id === e.pointerId) { dragHandler.end(); capture = null; }
      else if (tap && tap.id === e.pointerId && e.type === 'pointerup' && dragHandler && dragHandler.tap) dragHandler.tap(rayFromClient(e.clientX, e.clientY));
      if (tap && tap.id === e.pointerId) tap = null;
      pointers.delete(e.pointerId); lastPinch = 0; lastMid = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault(); stopAuto();
      zoomBy(Math.exp(e.deltaY * 0.0012));
      state.dirty = true; requestRender();
    }, { passive: false });
    canvas.addEventListener('dblclick', () => { if (!dragHandler) resetView(); });

    function pan(dx, dy) {
      const cam = camera(currentYaw());
      const k = (2 * state.dist * Math.tan(state.fov / 2)) / Math.max(1, ch());
      for (let i = 0; i < 3; i++) state.off[i] += -dx * k * cam.R[i] + dy * k * cam.Up[i];
    }
    function zoomBy(f) { state.dist = Math.max(state.radius * 0.35, Math.min(state.baseDist * 4, state.dist * f)); }

    if (!opts.fixedSize) { const ro = new ResizeObserver(() => { resize(); requestRender(); }); ro.observe(canvas); }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) requestRender(); });
    resize();

    return {
      setMesh, clearMesh, updateVerts, setVertexColors, setTexture, setMaterial, resetView, resize, setFrame, setGrid, rayFromClient,
      setDragHandler(h) { dragHandler = h || null; if (!h) { capture = null; tap = null; } },
      setProjection(v) { state.ortho = v === 'ortho'; state.dirty = true; requestRender(); },
      get projection() { return state.ortho ? 'ortho' : 'persp'; },
      setShading(m) { state.shading = m; state.wire = m === 'wire' || m === 'solidwire'; state.dirty = true; requestRender(); },
      setGlow(v) { state.glow = v || 0; state.dirty = true; requestRender(); },
      setView(name) {
        const V = { front: [0, 0], back: [Math.PI, 0], right: [Math.PI / 2, 0], left: [-Math.PI / 2, 0], top: [0, 1.553], bottom: [0, -1.553], iso: [0.78, 0.6] }[name];
        if (!V) return;
        state.yaw = V[0]; state.pitch = V[1]; state.interacted = true; state.dirty = true; requestRender();
      },
      setOverlays(list) { state.overlays = list || []; state.dirty = true; requestRender(); },
      setGizmo(g) { state.gizmo = g; state.dirty = true; requestRender(); },
      gizmoHit, project,
      setHoverHandler(fn) { hoverCb = fn; },
      getCamera() { const c = camera(currentYaw()); return { R: c.R, Up: c.Up, F: c.F, eye: c.eye, hh: c.hh, yaw: currentYaw(), pitch: state.pitch }; },
      // Render bersih (tanpa grid/gizmo) pada yaw tertentu untuk PNG & rekaman.
      renderAt(yaw, clean) {
        const prev = state.clean; state.clean = clean !== false;
        draw(yaw == null ? currentYaw() : yaw); state.clean = prev; return canvas;
      },
      // render PNG beresolusi lebih tinggi (skala 1–4×); cb(blob)
      renderScaled(scale, clean, cb) {
        const ow = canvas.width, oh = canvas.height, s = Math.max(1, Math.min(4, scale || 1));
        const maxDim = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096, f = Math.min(s, maxDim / Math.max(ow, oh));
        const prevClean = state.clean; state.clean = clean !== false;
        canvas.width = Math.round(ow * f); canvas.height = Math.round(oh * f); gl.viewport(0, 0, canvas.width, canvas.height);
        draw(currentYaw());
        canvas.toBlob((b) => { cb(b, canvas.width, canvas.height); }, 'image/png');
        state.clean = prevClean; canvas.width = ow; canvas.height = oh; gl.viewport(0, 0, ow, oh); state.dirty = true; requestRender();
      },
      setLighting(name) { if (LIGHTS[name]) { state.light = name; state.dirty = true; requestRender(); } },
      get lighting() { return state.light; },
      lightPresets() { return Object.keys(LIGHTS).map((k) => ({ id: k, label: LIGHTS[k].label })); },
      get canvas() { return canvas; },
      setWireframe(v) { state.wire = !!v; state.dirty = true; requestRender(); },
      setAutoRotate(v) { state.auto = !!v; if (v) { state.interacted = false; state.t0 = performance.now(); } state.dirty = true; requestRender(); },
      get autoRotate() { return state.auto && !state.interacted; },
      get ready() { return gpu.count > 0; },
      redraw() { state.dirty = true; requestRender(); },
      snapshot() { draw(currentYaw()); return canvas.toDataURL('image/png'); },
    };
  }

  root.S3DViewer = { create: createViewer };
})(typeof self !== 'undefined' ? self : this);
