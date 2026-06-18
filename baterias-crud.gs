// ── API: guardar batería ──
function guardarBateria(excelBase64, datosProcesados, nombre, anio, metadata, ext) {
  const rootFolder = _getBateriasFolder();
  const yearFolder = _getYearFolder(rootFolder, anio);
  const cacheFolder = _getYearCacheFolder(rootFolder, anio);
  const indice = _readIndice();

  const id = 'b_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  ext = ext || '.xlsx';
  var mime = ext === '.xlsb' ? 'application/vnd.ms-excel.sheet.binary.macroEnabled.12'
            : ext === '.xls' ? 'application/vnd.ms-excel'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const blob = Utilities.newBlob(
    Utilities.base64Decode(excelBase64),
    mime,
    anio + '_' + nombre + ext
  );
  const excelFile = yearFolder.createFile(blob);

  const dataFile = cacheFolder.createFile(
    anio + '_' + nombre + '.json',
    JSON.stringify(datosProcesados),
    'application/json'
  );

  const entry = {
    id, nombre, anio: String(anio),
    total: metadata.total || 0,
    forma: metadata.forma || '',
    intraP: metadata.intraP || 0,
    extraP: metadata.extraP || 0,
    stressP: metadata.stressP || 0,
    psicoPct: metadata.psicoPct || 0,
    fecha: new Date().toISOString().slice(0, 10),
    fileExt: ext,
    fileId: excelFile.getId(),
    dataFileId: dataFile.getId(),
    planesFileId: ''
  };

  indice.push(entry);
  _writeIndice(indice);
  return entry;
}

function listarBaterias() {
  var indice = _readIndice();
  var indicesLimpios = [];
  indice.forEach(function(entry) {
    entry.fileMissing = false;
    try {
      var file = DriveApp.getFileById(entry.fileId);
      if (file.isTrashed()) throw new Error('Archivo en papelera');
      indicesLimpios.push(entry);
    } catch(e) {
      try { if (entry.dataFileId) DriveApp.getFileById(entry.dataFileId).setTrashed(true); } catch(e2) {}
      try { if (entry.planesFileId) DriveApp.getFileById(entry.planesFileId).setTrashed(true); } catch(e2) {}
    }
  });
  if (indicesLimpios.length !== indice.length) {
    _writeIndice(indicesLimpios);
  }
  return indicesLimpios;
}

function verificarBateria(id) {
  var indice = _readIndice();
  var entry = indice.find(function(e) { return e.id === id; });
  if (!entry) return false;
  try {
    var file = DriveApp.getFileById(entry.fileId);
    return !file.isTrashed();
  } catch(e) {
    return false;
  }
}

function cargarBateria(id) {
  const indice = _readIndice();
  const entry = indice.find(e => e.id === id);
  if (!entry) throw new Error('Batería no encontrada');
  if (entry.dataFileId) {
    try {
      const dataFile = DriveApp.getFileById(entry.dataFileId);
      const datos = JSON.parse(dataFile.getBlob().getDataAsString());
      datos.meta = datos.meta || {};
      datos.meta.id = id;
      return { tipo: 'json', datos: datos, meta: entry };
    } catch(e) {}
  }
  const file = DriveApp.getFileById(entry.fileId);
  const blob = file.getBlob();
  return {
    tipo: 'excel',
    base64: Utilities.base64Encode(blob.getBytes()),
    fileName: entry.nombre + (entry.fileExt || '.xlsx'),
    meta: entry
  };
}

function eliminarBateria(id) {
  const indice = _readIndice();
  const idx = indice.findIndex(e => e.id === id);
  if (idx === -1) throw new Error('Batería no encontrada');
  const entry = indice[idx];
  try { DriveApp.getFileById(entry.fileId).setTrashed(true); } catch(e) {}
  try { if (entry.dataFileId) DriveApp.getFileById(entry.dataFileId).setTrashed(true); } catch(e) {}
  try { if (entry.planesFileId) DriveApp.getFileById(entry.planesFileId).setTrashed(true); } catch(e) {}
  indice.splice(idx, 1);
  _writeIndice(indice);
}
