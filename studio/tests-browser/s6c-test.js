const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8778);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 1400, height: 1100 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGE ' + e.message)); pg.on('console', m => { if (m.type()==='error' && !/fonts.g|ERR_|Failed to load resource/.test(m.text())) errs.push('CON ' + m.text()); });
  await pg.goto('http://localhost:8778/tools/3d-studio.html'); await pg.evaluate(() => { try { localStorage.setItem('s3d-guide-done-v6','1'); } catch(e){} }); await pg.reload(); await pg.waitForTimeout(2000);
  const ok = (n, c, x) => console.log((c ? 'OK   ' : 'GAGAL') + ' ' + n + (x ? '  ' + x : ''));
  await pg.evaluate(() => [...document.querySelectorAll('button')].find(x => /Modeler/.test(x.textContent)).click()); await pg.waitForTimeout(1500);
  const A = () => window.S3DApp.maker;
  await pg.evaluate(() => { const it = window.S3DShapes.CATALOG[0].items; window.S3DApp.maker._api.addShape(it[0]); });
  await pg.waitForTimeout(400);
  const t0 = await pg.evaluate(() => window.S3DApp.maker.exportData().mesh.triangles);
  // modifier lewat inspector
  const sel = await pg.$('select[aria-label="Tambah modifier"]'); ok('inspector modifier ada', !!sel);
  await sel.selectOption('mirror'); await pg.waitForTimeout(400);
  const t1 = await pg.evaluate(() => window.S3DApp.maker.exportData().mesh.triangles);
  ok('mirror menggandakan segitiga', t1 === t0 * 2, t0 + ' -> ' + t1);
  const sel2 = await pg.$('select[aria-label="Tambah modifier"]'); await sel2.selectOption('array'); await pg.waitForTimeout(400);
  const t2 = await pg.evaluate(() => window.S3DApp.maker.exportData().mesh.triangles);
  ok('array 3 salinan', t2 === t1 * 3, String(t2));
  await pg.evaluate(() => window.S3DApp.maker.undo()); await pg.waitForTimeout(300);
  ok('undo modifier', (await pg.evaluate(() => window.S3DApp.maker.exportData().mesh.triangles)) === t1);
  await pg.evaluate(() => window.S3DApp.maker.redo()); await pg.waitForTimeout(300);
  // simpan + muat ulang
  await pg.waitForTimeout(1200); await pg.reload(); await pg.waitForTimeout(2500);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find(x => /Modeler/.test(x.textContent)).click()); await pg.waitForTimeout(2000);
  const t3 = await pg.evaluate(() => window.S3DApp.maker.exportData().mesh.triangles);
  ok('modifier pulih setelah muat ulang', t3 === t2, t3 + ' vs ' + t2);
  // terapkan modifier
  await pg.evaluate(() => { const a = window.S3DApp.maker._api; a.select(a.objects()[0].id); a.bakeMods(); }); await pg.waitForTimeout(500);
  const bk = await pg.evaluate(() => { const a = window.S3DApp.maker._api; return [a.selected().type, window.S3DApp.maker.exportData().mesh.triangles]; });
  ok('terapkan modifier -> mesh', bk[0] === 'mesh' && bk[1] > 0, bk.join());
  // boolean: dua kotak/bola
  await pg.evaluate(() => { const a = window.S3DApp.maker._api; a.select(a.objects()[0].id); a.delete ? a.delete() : 0; });
  const nb = await pg.evaluate(() => { const a = window.S3DApp.maker._api; const o = a.objects(); return o.length; });
  console.log('   objek sekarang', nb);
  await pg.evaluate(() => { const m = window.S3DApp.maker; const a = m._api; const cat = window.S3DShapes.CATALOG; const all = cat.flatMap(c => c.items); const sph = all.find(i => /Bola/i.test(i.label)) || all[0]; const box = all.find(i => /Kubus/i.test(i.label)) || all[1]; a.addShape(box); a.addShape(sph); const os = a.objects(); const last = os[os.length-1]; last.pos = [0.6, 0.6, 0]; a.setSel([os[os.length-2].id, last.id]); });
  await pg.waitForTimeout(400);
  const before = await pg.evaluate(() => window.S3DApp.maker._api.objects().length);
  await pg.evaluate(() => window.S3DApp.maker._api.booleanOp('difference')); await pg.waitForTimeout(800);
  const bo = await pg.evaluate(() => { const a = window.S3DApp.maker._api; return [a.objects().length, a.selected() && a.selected().type, a.selected() && a.selected().name]; });
  ok('boolean kurangi: 2 objek jadi 1 mesh', bo[0] === before - 1 && bo[1] === 'mesh', bo.join());
  await pg.evaluate(() => window.S3DApp.maker.undo()); await pg.waitForTimeout(300);
  ok('undo boolean mengembalikan 2 objek', (await pg.evaluate(() => window.S3DApp.maker._api.objects().length)) === before);
  // lab bentuk
  await pg.evaluate(() => window.S3DApp.maker._api.openLab()); await pg.waitForTimeout(400);
  ok('dialog Lab Bentuk terbuka', !!(await pg.$('.s3d-modal')));
  const cv = await pg.$('.labcv'); const bb = await cv.boundingBox();
  await pg.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height * 0.05); await pg.waitForTimeout(150);
  const n0 = await pg.evaluate(() => window.S3DApp.maker._api.objects().length);
  await pg.click('.s3d-modal-card .chip.primary'); await pg.waitForTimeout(700);
  const ln = await pg.evaluate(() => { const a = window.S3DApp.maker._api; return [a.objects().length, a.selected().type, !!document.querySelector('.s3d-modal')]; });
  ok('lathe membuat objek mesh', ln[0] === n0 + 1 && ln[1] === 'mesh' && !ln[2], ln.join());
  await pg.evaluate(() => window.S3DApp.maker._api.openLab()); await pg.waitForTimeout(300);
  await pg.click('.s3d-modal [role=tab]:nth-of-type(2)'); await pg.waitForTimeout(200);
  await pg.click('.s3d-modal-card .chip.primary'); await pg.waitForTimeout(900);
  const sw = await pg.evaluate(() => { const a = window.S3DApp.maker._api; return [a.objects().length, a.selected().type]; });
  ok('sweep membuat objek mesh', sw[0] === n0 + 2 && sw[1] === 'mesh', sw.join());
  await pg.screenshot({ path: '/tmp/s3d/s6c.png' });
  ok('tanpa error', errs.length === 0, errs.join(';'));
  await b.close(); srv.close();
})();
