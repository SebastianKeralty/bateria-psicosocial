function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Batería Psicosocial - Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── ID de la carpeta de Drive (cambia este valor si cambias la carpeta) ──
var CARPETA_POR_DEFECTO = '1Uz3i7_fwmPIc5-abgyeqXEJz0L_-UaEj';

// ── Autorizar Drive ──
function autorizarDrive() {
  DriveApp.getRootFolder().getName();
  return true;
}

// ── Configurar carpeta (guardar ID en PropertiesService) ──
function configurarCarpeta(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  PropertiesService.getScriptProperties().setProperty('BATERIAS_FOLDER_ID', folderId);
  return { id: folderId, name: folder.getName() };
}

// ── Obtener info de la carpeta configurada ──
function obtenerInfoCarpeta() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty('BATERIAS_FOLDER_ID');
  if (!folderId) folderId = CARPETA_POR_DEFECTO;
  if (!folderId) return null;
  try {
    const folder = DriveApp.getFolderById(folderId);
    if (!props.getProperty('BATERIAS_FOLDER_ID')) {
      props.setProperty('BATERIAS_FOLDER_ID', folderId);
    }
    return { id: folderId, name: folder.getName(), url: folder.getUrl() };
  } catch(e) {
    props.deleteProperty('BATERIAS_FOLDER_ID');
    return null;
  }
}

// ── Drive: carpeta central ──
function _getBateriasFolder() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty('BATERIAS_FOLDER_ID');
  // Si no hay ID guardado, usar el ID por defecto
  if (!folderId) folderId = CARPETA_POR_DEFECTO;
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch(e) {
      props.deleteProperty('BATERIAS_FOLDER_ID');
      throw new Error('La carpeta configurada no está disponible. Ve a Baterías y configura una nueva.');
    }
  }
  throw new Error('No hay carpeta configurada. Ve a Baterías y configura una carpeta de Drive.');
}

function _readIndice() {
  const props = PropertiesService.getScriptProperties();
  try { return JSON.parse(props.getProperty('BATERIAS_INDICE') || '[]'); } catch(e) { return []; }
}

function _writeIndice(data) {
  PropertiesService.getScriptProperties().setProperty('BATERIAS_INDICE', JSON.stringify(data));
}

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

// ── API: guardar batería ──
function guardarBateria(excelBase64, datosProcesados, nombre, anio, metadata) {
  const rootFolder = _getBateriasFolder();
  const yearFolder = _getYearFolder(rootFolder, anio);
  const cacheFolder = _getYearCacheFolder(rootFolder, anio);
  const indice = _readIndice();

  const id = 'b_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  // Guardar Excel original en {año}/
  const blob = Utilities.newBlob(
    Utilities.base64Decode(excelBase64),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    anio + '_' + nombre + '.xlsx'
  );
  const excelFile = yearFolder.createFile(blob);

  // Guardar JSON procesado en .cache/{año}/
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
    fileId: excelFile.getId(),
    dataFileId: dataFile.getId()
  };

  indice.push(entry);
  _writeIndice(indice);
  return entry;
}

function listarBaterias() {
  return _readIndice();
}

function cargarBateria(id) {
  const indice = _readIndice();
  const entry = indice.find(e => e.id === id);
  if (!entry) throw new Error('Batería no encontrada');
  // Intentar cargar JSON procesado (rápido)
  if (entry.dataFileId) {
    try {
      const dataFile = DriveApp.getFileById(entry.dataFileId);
      const datos = JSON.parse(dataFile.getBlob().getDataAsString());
      datos.meta = datos.meta || {};
      datos.meta.id = id;
      return { tipo: 'json', datos: datos, meta: entry };
    } catch(e) {}
  }
  // Fallback: leer Excel original y convertir a base64
  const file = DriveApp.getFileById(entry.fileId);
  const blob = file.getBlob();
  return {
    tipo: 'excel',
    base64: Utilities.base64Encode(blob.getBytes()),
    fileName: entry.nombre + '.xlsx',
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
  indice.splice(idx, 1);
  _writeIndice(indice);
}
