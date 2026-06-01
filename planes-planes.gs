// ── Planes: carpeta ──
function _getPlanesFolder(bateriaId, anio) {
  const rootFolder = _getBateriasFolder();
  var cacheFolder = null;
  var folders = rootFolder.getFolders();
  while (folders.hasNext()) {
    var f = folders.next();
    if (f.getName() === '.planes') { cacheFolder = f; break; }
  }
  if (!cacheFolder) cacheFolder = rootFolder.createFolder('.planes');
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
  if (entry.planesFileId) {
    try {
      var existing = DriveApp.getFileById(entry.planesFileId);
      planes = JSON.parse(existing.getBlob().getDataAsString());
    } catch(e) { planes = []; }
  }
  var idx = planes.findIndex(function(p) { return p.dimension === dimension; });
  if (idx >= 0) {
    planes[idx] = planData;
  } else {
    planes.push(planData);
  }
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

    file.setTrashed(true);

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
