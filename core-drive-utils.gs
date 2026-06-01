// ── Carpeta por año (busca o crea) ──
function _getYearFolder(rootFolder, anio) {
  const yearStr = String(anio);
  const folders = rootFolder.getFolders();
  while (folders.hasNext()) {
    const f = folders.next();
    if (f.getName() === yearStr) return f;
  }
  return rootFolder.createFolder(yearStr);
}

// ── Carpeta .cache (busca o crea) ──
function _getCacheFolder(rootFolder) {
  const folders = rootFolder.getFolders();
  while (folders.hasNext()) {
    const f = folders.next();
    if (f.getName() === '.cache') return f;
  }
  return rootFolder.createFolder('.cache');
}

// ── Subcarpeta por año dentro de .cache ──
function _getYearCacheFolder(rootFolder, anio) {
  const cache = _getCacheFolder(rootFolder);
  return _getYearFolder(cache, anio);
}
