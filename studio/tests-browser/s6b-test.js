const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8777);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 1400, height: 1100 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGE ' + e.message)); pg.on('console', m => { if (m.type()==='error' && !/fonts.g|ERR_|Failed to load resource/.test(m.text())) errs.push('CON ' + m.text()); });
  await pg.goto('http://localhost:8777/tools/3d-studio.html'); await pg.evaluate(() => { try { localStorage.setItem('s3d-guide-done-v6','1'); } catch(e){} }); await pg.reload(); await pg.waitForTimeout(2000);
  const ok = (n, c, x) => console.log((c ? 'OK   ' : 'GAGAL') + ' ' + n + (x ? '  ' + x : ''));
  await pg.evaluate(() => [...document.querySelectorAll('button')].find(x => /Modeler/.test(x.textContent)).click()); await pg.waitForTimeout(1500);
  await pg.evaluate(() => window.S3DApp.maker._api.addShape(window.S3DShapes.CATALOG[0].items[0])); await pg.waitForTimeout(500);
  await pg.keyboard.press('Shift+P'); await pg.waitForTimeout(800);
  ok('Shift+P masuk Cat', await pg.evaluate(() => window.S3DApp.maker._api.paint.active));
  const st = await pg.evaluate(() => { const s = window.S3DApp.maker._api.paint._state(); return [s.res.charts.length, s.S, s.res.T.length / 3]; });
  ok('unwrap otomatis', st[0] >= 1, st.join());
  const cv = await pg.$('canvas'); const bb = await cv.boundingBox();
  const px0 = await pg.evaluate(() => { const s = window.S3DApp.maker._api.paint._state(); const d = s.canvas.getContext('2d').getImageData(0,0,s.S,s.S).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i+1] < 120) n++; return n; });
  await pg.evaluate(() => { const p = window.S3DApp.maker._api.paint._state().p; p.color = '#ff2020'; p.opacity = 1; });
  await pg.mouse.move(bb.x + bb.width/2 - 30, bb.y + bb.height/2); await pg.mouse.down(); await pg.mouse.move(bb.x + bb.width/2 + 30, bb.y + bb.height/2 + 5, {steps: 10}); await pg.mouse.up(); await pg.waitForTimeout(400);
  const px1 = await pg.evaluate(() => { const s = window.S3DApp.maker._api.paint._state(); const d = s.canvas.getContext('2d').getImageData(0,0,s.S,s.S).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i+1] < 120) n++; return [n, s.undo.length]; });
  ok('goresan mengecat piksel', px1[0] > px0 + 200 && px1[1] === 1, px0 + ' -> ' + px1.join());
  // pratinjau UV & operasi chart
  const prev = await pg.$('canvas.uvprev'); ok('panel UV ada', !!prev);
  const pb = await prev.boundingBox();
  await pg.mouse.click(pb.x + pb.width * 0.2, pb.y + pb.height * 0.2); await pg.waitForTimeout(200);
  let sel = await pg.evaluate(() => window.S3DApp.maker._api.paint._state().sel);
  if (sel < 0) { await pg.evaluate(() => window.S3DApp.maker._api.paint._select(0)); sel = 0; }
  const before = await pg.evaluate(() => { const s = window.S3DApp.maker._api.paint._state(); return Array.from(s.res.UV.slice(0, 2)); });
  await pg.evaluate(() => window.S3DApp.maker._api.paint._ops.rot90()); await pg.waitForTimeout(300);
  const after = await pg.evaluate(() => { const s = window.S3DApp.maker._api.paint._state(); return [Array.from(s.res.UV.slice(0, 2)), s.undo.length]; });
  ok('putar chart mengubah UV & dicatat', after[1] === 2 && (Math.abs(after[0][0] - before[0]) > 1e-4 || Math.abs(after[0][1] - before[1]) > 1e-4), JSON.stringify(after));
  const px2 = await pg.evaluate(() => { const s = window.S3DApp.maker._api.paint._state(); const d = s.canvas.getContext('2d').getImageData(0,0,s.S,s.S).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i+1] < 120) n++; return n; });
  ok('cat ikut pindah saat chart diputar', px2 > 100, String(px2));
  await pg.evaluate(() => window.S3DApp.maker._api.paint.undo()); await pg.waitForTimeout(200);
  // reunwrap ukuran 256
  await pg.evaluate(() => { const s = window.S3DApp.maker._api.paint._state(); s.p.size = 256; window.S3DApp.maker._api.paint._ops.reunwrap(); });
  await pg.waitForTimeout(500);
  const S2 = await pg.evaluate(() => window.S3DApp.maker._api.paint._state().S);
  ok('unwrap ulang ukuran 256', S2 === 256, String(S2));
  await pg.screenshot({ path: '/tmp/s3d/s6b-paint.png', fullPage: true });
  await pg.keyboard.press('Shift+P'); await pg.waitForTimeout(800);
  const x = await pg.evaluate(() => { const a = window.S3DApp.maker._api; const o = a.selected(); const d = window.S3DApp.maker.exportData(); const c = d.canvas, g = c.getContext('2d'); const img = g.getImageData(0, 0, c.width, c.height).data; let red = 0; for (let i = 0; i < img.length; i += 4) if (img[i] > 220 && img[i+1] < 90 && img[i+2] < 90) red++; return [a.paint.active, o.type, c.width, c.height, red, d.mesh.triangles]; });
  ok('keluar: mesh berUV masuk atlas', !x[0] && x[1] === 'mesh' && x[3] > 200 && x[4] > 100, x.join());
  await pg.waitForTimeout(1500); await pg.reload(); await pg.waitForTimeout(2500);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find(x => /Modeler/.test(x.textContent)).click()); await pg.waitForTimeout(2500);
  const y = await pg.evaluate(() => { const d = window.S3DApp.maker.exportData(); if (!d) return null; const c = d.canvas, g = c.getContext('2d'); const img = g.getImageData(0, 0, c.width, c.height).data; let red = 0; for (let i = 0; i < img.length; i += 4) if (img[i] > 220 && img[i+1] < 90 && img[i+2] < 90) red++; return [c.width, c.height, red]; });
  ok('cat pulih setelah muat ulang', y && y[2] > 100, JSON.stringify(y));
  // edit ulang membuang UV dengan peringatan
  await pg.evaluate(() => { const a = window.S3DApp.maker._api; a.select(a.objects()[0].id); a.toggleEdit(); });
  await pg.waitForTimeout(400);
  ok('Edit Mode pada mesh berUV tetap terbuka', await pg.evaluate(() => window.S3DApp.maker._api.edit.active));
  await pg.evaluate(() => window.S3DApp.maker._api.edit.exit(false)); await pg.waitForTimeout(300);
  ok('tanpa error', errs.length === 0, errs.join(';'));
  await b.close(); srv.close();
})();
