/* Pekerja latar untuk operasi mesh berat (kurangi detail, tambah detail, haluskan). */
importScripts('meshops.js', 'sculptops.js');
self.onmessage = (e) => {
  const { id, op, args } = e.data;
  try {
    const r = self.S3DSculptOps.runSync(op, args);
    self.postMessage({ id, ok: true, r }, self.S3DSculptOps.transferables(r));
  } catch (err) { self.postMessage({ id, ok: false, err: String(err && err.message || err) }); }
};
