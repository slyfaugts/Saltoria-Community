const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8775);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGE ' + e.message)); pg.on('console', m => { if (m.type()==='error' && !/fonts.g|ERR_|Failed to load resource/.test(m.text())) errs.push('CON ' + m.text()); });
  await pg.goto('http://localhost:8775/tools/3d-studio.html'); await pg.evaluate(() => { try { localStorage.setItem('s3d-guide-done-v6','1'); } catch(e){} }); await pg.reload(); await pg.waitForTimeout(2000);
  const ok = (n, c, x) => console.log((c ? 'OK   ' : 'GAGAL') + ' ' + n + (x ? '  ' + x : ''));
  await pg.evaluate(() => [...document.querySelectorAll('button')].find(x => /Modeler/.test(x.textContent)).click()); await pg.waitForTimeout(1500);
  await pg.evaluate(() => window.S3DApp.maker._api.addShape(window.S3DShapes.CATALOG[0].items[0])); await pg.waitForTimeout(500);
  await pg.keyboard.press('Shift+Tab'); await pg.waitForTimeout(600);
  const S = () => window.S3DApp.maker._api.sculpt;
  ok('Shift+Tab masuk Sculpt', await pg.evaluate(() => window.S3DApp.maker._api.sculpt.active));
  const nT0 = await pg.evaluate(() => window.S3DApp.maker._api.sculpt._state().T.length / 3);
  // dab langsung
  const r = await pg.evaluate(() => { const s = window.S3DApp.maker._api.sculpt, st = s._state(); const p0 = Array.from(st.P.slice(0, 3)); let top = 0; for (let i = 0; i < st.P.length; i += 3) if (st.P[i+1] > st.P[top*3+1]) top = i/3; const c = [st.P[top*3], st.P[top*3+1], st.P[top*3+2]]; const n = [0,1,0]; const y0 = st.P[top*3+1]; s._dab(c, n, 'draw'); return [y0, st.P[top*3+1], st.undo.length]; });
  ok('kuas Tarik menaikkan titik', r[1] > r[0], r.join());
  const u = await pg.evaluate(() => { const s = window.S3DApp.maker._api.sculpt; s.undo(); const st = s._state(); return st.undo.length; });
  ok('undo goresan', u === 0);
  // mouse nyata
  const cv = await pg.$('canvas'); const bb = await cv.boundingBox();
  await pg.mouse.move(bb.x + bb.width/2, bb.y + bb.height/2); await pg.mouse.down(); await pg.mouse.move(bb.x + bb.width/2 + 40, bb.y + bb.height/2 + 10, {steps: 8}); await pg.mouse.up(); await pg.waitForTimeout(300);
  const ul = await pg.evaluate(() => window.S3DApp.maker._api.sculpt._state().undo.length);
  ok('goresan mouse tercatat', ul === 1, String(ul));
  // cat
  await pg.keyboard.press('c'); 
  await pg.mouse.move(bb.x + bb.width/2 - 20, bb.y + bb.height/2); await pg.mouse.down(); await pg.mouse.move(bb.x + bb.width/2 + 20, bb.y + bb.height/2, {steps: 6}); await pg.mouse.up(); await pg.waitForTimeout(300);
  const pt = await pg.evaluate(() => window.S3DApp.maker._api.sculpt._state().painted);
  ok('cat warna menandai painted', pt === true);
  // tambah & turunkan detail (Worker)
  await pg.evaluate(() => { const s = window.S3DApp.maker._api.sculpt; s._state().p.maxEdge = 3; s._ops.refine(); });
  await pg.waitForFunction(() => { const st = window.S3DApp.maker._api.sculpt._state(); return !st.busy && st.T.length/3 > 2000; }, null, { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(800);
  const n1 = await pg.evaluate(() => { const st = window.S3DApp.maker._api.sculpt._state(); return [st.T.length / 3, st.busy, st.VC.length === st.P.length]; });
  ok('tambah detail menambah segitiga', n1[0] > nT0 * 1.5 && !n1[1] && n1[2], n1.join());
  const usedWorker = await pg.evaluate(() => typeof Worker !== 'undefined');
  await pg.evaluate(() => { const s = window.S3DApp.maker._api.sculpt; s._state().p.target = 30; s._ops.decimate(); });
  await pg.waitForFunction((n) => { const st = window.S3DApp.maker._api.sculpt._state(); return !st.busy && st.T.length/3 < n; }, n1[0], { timeout: 60000 }).catch(() => {});
  const n2 = await pg.evaluate(() => { const st = window.S3DApp.maker._api.sculpt._state(); return [st.T.length / 3, st.busy, st.VC.length === st.P.length]; });
  ok('turunkan detail', n2[0] < n1[0] && !n2[1] && n2[2], n2.join() + ' worker=' + usedWorker);
  await pg.screenshot({ path: '/tmp/s3d/s6a-sculpt.png' });
  await pg.evaluate(() => window.S3DApp.maker._api.sculpt.undo()); await pg.waitForTimeout(300);
  const n3 = await pg.evaluate(() => window.S3DApp.maker._api.sculpt._state().T.length / 3);
  ok('undo remesh mengembalikan jumlah', Math.abs(n3 - n1[0]) < 1, String(n3));
  await pg.keyboard.press('Tab'); await pg.waitForTimeout(800);
  const x = await pg.evaluate(() => { const a = window.S3DApp.maker._api; return [a.sculpt.active, a.selected().type, document.querySelector('.mb-mode').textContent, window.S3DApp.maker.exportData().mesh.triangles]; });
  ok('keluar Sculpt: objek jadi mesh', !x[0] && x[1] === 'mesh' && x[2] === 'Object Mode', x.join());
  const hasPal = await pg.evaluate(() => { const d = window.S3DApp.maker.exportData(); const c = d.canvas, g = c.getContext('2d'); const seen = new Set(); for (let y = 0; y < Math.min(c.height, 8); y++) for (let xx = 0; xx < Math.min(c.width, 64); xx++) { const p = g.getImageData(xx, y, 1, 1).data; seen.add(p[0]+','+p[1]+','+p[2]); } return seen.size; });
  ok('warna cat masuk atlas', hasPal >= 2, String(hasPal));
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(400);
  ok('undo objek kembali parametrik', await pg.evaluate(() => window.S3DApp.maker._api.selected().type !== 'mesh'));
  await pg.keyboard.press('Control+y'); await pg.waitForTimeout(1500); await pg.reload(); await pg.waitForTimeout(2500);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find(x => /Modeler/.test(x.textContent)).click()); await pg.waitForTimeout(2000);
  const d2 = await pg.evaluate(() => { const e = window.S3DApp.maker.exportData(); return e ? e.mesh.triangles : 0; });
  ok('hasil pahat pulih setelah muat ulang', d2 === x[3], d2 + ' vs ' + x[3]);
  // keluar tanpa commit
  await pg.evaluate(() => { const a = window.S3DApp.maker._api; a.select(a.objects()[0].id); a.toggleSculpt(); });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => window.S3DApp.maker._api.sculpt._dab([0,0,0],[0,1,0],'draw'));
  await pg.evaluate(() => window.S3DApp.maker._api.sculpt.exit(false)); await pg.waitForTimeout(500);
  ok('buang perubahan', await pg.evaluate(() => !window.S3DApp.maker._api.sculpt.active));
  ok('tanpa error', errs.length === 0, errs.join(';'));
  await b.close(); srv.close();
})();
