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

// ── Forzar Autorización de Permisos IA ──
function FORZAR_AUTORIZACION_IA() {
  try {
    // Intentamos una petición real para forzar el detector de scopes de Google
    var response = UrlFetchApp.fetch('https://generativelanguage.googleapis.com', { muteHttpExceptions: true });
    return "Conexión intentada. Código de respuesta: " + response.getResponseCode() + ". Si ves esto, los permisos están activos.";
  } catch (e) {
    throw new Error("Sigue faltando el permiso. Por favor, revisa el archivo appsscript.json manualmente: " + e.message);
  }
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
  try { if (entry.planesFileId) DriveApp.getFileById(entry.planesFileId).setTrashed(true); } catch(e) {}
  indice.splice(idx, 1);
  _writeIndice(indice);
}

// ── API Key ──
function configurarApiKey(key) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
  return true;
}

function _getApiKey() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('GEMINI_API_KEY');
  if (key) return key;
  // API key por defecto (puedes cambiarla con configurarApiKey)
  var defaultKey = 'AIzaSyDZ4yVfRDegy1cVV9jvYmM5rmwUB_3Cbhc';
  props.setProperty('GEMINI_API_KEY', defaultKey);
  return defaultKey;
}

// ── Planes: carpeta ──
function _getPlanesFolder(bateriaId, anio) {
  const rootFolder = _getBateriasFolder();
  // .cache folder
  var cacheFolder = null;
  var folders = rootFolder.getFolders();
  while (folders.hasNext()) {
    var f = folders.next();
    if (f.getName() === '.planes') { cacheFolder = f; break; }
  }
  if (!cacheFolder) cacheFolder = rootFolder.createFolder('.planes');
  // year subfolder
  var yearFolder = null;
  var yearFolders = cacheFolder.getFolders();
  while (yearFolders.hasNext()) {
    var yf = yearFolders.next();
    if (yf.getName() === String(anio)) { yearFolder = yf; break; }
  }
  if (!yearFolder) yearFolder = cacheFolder.createFolder(String(anio));
  return yearFolder;
}

function _getPlanesFileId(bateriaId) {
  var indice = _readIndice();
  var entry = indice.find(function(e) { return e.id === bateriaId; });
  return entry ? entry.planesFileId : null;
}

function _setPlanesFileId(bateriaId, fileId) {
  var indice = _readIndice();
  var entry = indice.find(function(e) { return e.id === bateriaId; });
  if (entry) {
    entry.planesFileId = fileId;
    _writeIndice(indice);
  }
}

// ── Planes: guardar ──
function guardarPlan(bateriaId, dimension, planData) {
  var indice = _readIndice();
  var entry = indice.find(function(e) { return e.id === bateriaId; });
  if (!entry) throw new Error('Batería no encontrada');
  var folder = _getPlanesFolder(bateriaId, entry.anio);
  var planes = [];
  // Read existing file
  if (entry.planesFileId) {
    try {
      var existing = DriveApp.getFileById(entry.planesFileId);
      planes = JSON.parse(existing.getBlob().getDataAsString());
    } catch(e) { planes = []; }
  }
  // Update or add plan
  var idx = planes.findIndex(function(p) { return p.dimension === dimension; });
  if (idx >= 0) {
    planes[idx] = planData;
  } else {
    planes.push(planData);
  }
  // Write file
  if (entry.planesFileId) {
    try { DriveApp.getFileById(entry.planesFileId).setTrashed(true); } catch(e) {}
  }
  var fileName = 'planes_' + bateriaId + '.json';
  var file = folder.createFile(fileName, JSON.stringify(planes), 'application/json');
  _setPlanesFileId(bateriaId, file.getId());
  return true;
  }

  // ── Planes: eliminar ──
  function eliminarPlan(bateriaId, dimension) {
  var indice = _readIndice();
  var entry = indice.find(function(e) { return e.id === bateriaId; });
  if (!entry || !entry.planesFileId) return true;

  try {
    var file = DriveApp.getFileById(entry.planesFileId);
    var planes = JSON.parse(file.getBlob().getDataAsString());
    var newPlanes = planes.filter(function(p) { return p.dimension !== dimension; });

    file.setTrashed(true); // Borramos el archivo viejo sempre

    if (newPlanes.length === 0) {
      entry.planesFileId = null;
    } else {
      var folder = _getPlanesFolder(bateriaId, entry.anio);
      var newFile = folder.createFile("planes_" + bateriaId + ".json", JSON.stringify(newPlanes), "application/json");
      entry.planesFileId = newFile.getId();
    }
    _writeIndice(indice);
    return true;
  } catch(e) {
    throw new Error('Error al eliminar el plan: ' + e.message);
  }
  }

  // ── Gemini: generar sugerencia ──
function cargarPlanes(bateriaId) {
  var indice = _readIndice();
  var entry = indice.find(function(e) { return e.id === bateriaId; });
  if (!entry || !entry.planesFileId) return [];
  try {
    var file = DriveApp.getFileById(entry.planesFileId);
    return JSON.parse(file.getBlob().getDataAsString());
  } catch(e) { return []; }
}

// ── Planes: generar con IA ──
function generarPlanIA(dimension, riesgo, nivel, encuesta, total) {
  var apiKey = _getApiKey();
  if (!apiKey) return { error: 'No hay API key configurada. Ve a Reportes y configura la API key de Gemini.' };

  var prompt = 'Eres un experto en riesgo psicosocial laboral. Responde SOLO con JSON válido, sin markdown. Para la dimension "' + dimension + '" de la encuesta ' + encuesta + ' con ' + total + ' encuestados, riesgo actual: ' + riesgo + '% (' + nivel + '). Genera: {"plan": "texto del plan de accion...", "indicadores": ["indicador 1", "indicador 2", "indicador 3"], "beneficios": ["beneficio 1", "beneficio 2", "beneficio 3"], "pronostico": {"actual": ' + riesgo + ', "estimado": numero, "tiempo": "X meses", "mejora": numero}} donde estimado es el % de riesgo si se implementa el plan, tiempo los meses estimados, mejora el % de reduccion.';

  var payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

  try {
    var response = UrlFetchApp.fetch(url, options);
    var json = JSON.parse(response.getContentText());
    if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) {
      var text = json.candidates[0].content.parts[0].text || '';
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      var result = JSON.parse(text);
      result.dimension = dimension;
      result.encuesta = encuesta;
      result.riesgoActual = riesgo;
      result.nivel = nivel;
      result.generadoPorIA = true;
      result.fecha = new Date().toISOString().slice(0, 10);
      return result;
    }
    return { error: 'Gemini no devolvió una respuesta válida.', raw: response.getContentText().slice(0, 200) };
  } catch(e) {
    return { error: 'Error al llamar a Gemini: ' + e.message };
  }
}
