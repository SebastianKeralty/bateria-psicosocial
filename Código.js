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

// ── API: guardar batería (recibe base64 del .xlsx) ──
function guardarBateria(excelBase64, nombre, anio, metadata) {
  const folder = _getBateriasFolder();
  const indice = _readIndice();

  const id = 'b_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const blob = Utilities.newBlob(
    Utilities.base64Decode(excelBase64),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    anio + '_' + nombre + '.xlsx'
  );
  const excelFile = folder.createFile(blob);

  const entry = {
    id, nombre, anio: String(anio),
    total: metadata.total || 0,
    forma: metadata.forma || '',
    intraP: metadata.intraP || 0,
    extraP: metadata.extraP || 0,
    stressP: metadata.stressP || 0,
    psicoPct: metadata.psicoPct || 0,
    fecha: new Date().toISOString().slice(0, 10),
    fileId: excelFile.getId()
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
  const file = DriveApp.getFileById(entry.fileId);
  const blob = file.getBlob();
  return {
    base64: Utilities.base64Encode(blob.getBytes()),
    fileName: entry.nombre + '.xlsx',
    meta: entry
  };
}

function eliminarBateria(id) {
  const indice = _readIndice();
  const idx = indice.findIndex(e => e.id === id);
  if (idx === -1) throw new Error('Batería no encontrada');
  try { DriveApp.getFileById(indice[idx].fileId).setTrashed(true); } catch(e) {}
  indice.splice(idx, 1);
  _writeIndice(indice);
}
