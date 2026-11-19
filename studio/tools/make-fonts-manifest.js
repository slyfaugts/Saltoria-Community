#!/usr/bin/env node
// Memindai folder fonts/ dan menulis fonts/fonts.json untuk Saltoria 3D Studio.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'fonts');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(ttf|otf|woff2?)$/i.test(f)).sort() : [];
const out = files.map((f) => {
  const base = f.replace(/\.[^.]+$/, '');
  const label = base.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
  return { label, file: 'fonts/' + f, weight: /bold|black|heavy/i.test(base) ? 700 : 400 };
});
fs.writeFileSync(path.join(dir, 'fonts.json'), JSON.stringify(out, null, 2) + '\n');
console.log(out.length + ' font ditulis ke fonts/fonts.json');
