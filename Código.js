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

// ── Drive: carpeta central ──
function _getBateriasFolder() {
  const folders = DriveApp.getFoldersByName('Baterias Psicosocial');
  if (folders.hasNext()) return folders.next();
  const folder = DriveApp.createFolder('Baterias Psicosocial');
  folder.addViewer(DriveApp.getFileById(DriveApp.getRootFolder().getId()).getOwner());
  return folder;
}

function _readIndice(folder) {
  const files = folder.getFilesByName('indice.json');
  if (files.hasNext()) {
    try { return JSON.parse(files.next().getBlob().getDataAsString()); } catch(e) {}
  }
  return [];
}

function _writeIndice(folder, data) {
  const files = folder.getFilesByName('indice.json');
  while (files.hasNext()) files.next().setTrashed(true);
  folder.createFile('indice.json', JSON.stringify(data), 'application/json');
}

// ── API: guardar batería ──
function guardarBateria(datos, nombre, anio) {
  const folder = _getBateriasFolder();
  const indice = _readIndice(folder);

  const s = datos.summary;
  const total = s.total || 1;
  const intraP = Math.round((((s.intraGeneral?.["Riesgo alto"]||0)+(s.intraGeneral?.["Riesgo muy alto"]||0))/total)*100);
  const extraP = Math.round((((s.extraGeneral?.["Riesgo alto"]||0)+(s.extraGeneral?.["Riesgo muy alto"]||0))/total)*100);
  const stressP = Math.round((((s.stress?.["Riesgo alto"]||0)+(s.stress?.["Riesgo muy alto"]||0))/total)*100);
  const psicoPct = Math.round((intraP + extraP + stressP) / 3);

  const id = 'b_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const entry = {
    id, nombre, anio: String(anio),
    total: s.total, forma: datos.meta.forma,
    intraP, extraP, stressP, psicoPct,
    fecha: new Date().toISOString().slice(0, 10)
  };

  const dataFile = folder.createFile('data_' + id + '.json', JSON.stringify(datos), 'application/json');
  entry.fileId = dataFile.getId();

  indice.push(entry);
  _writeIndice(folder, indice);
  return entry;
}

// ── API: listar baterías ──
function listarBaterias() {
  return _readIndice(_getBateriasFolder());
}

// ── API: cargar batería (devuelve el JSON completo) ──
function cargarBateria(id) {
  const folder = _getBateriasFolder();
  const indice = _readIndice(folder);
  const entry = indice.find(e => e.id === id);
  if (!entry) throw new Error('Batería no encontrada');
  const file = DriveApp.getFileById(entry.fileId);
  return JSON.parse(file.getBlob().getDataAsString());
}

// ── API: eliminar batería ──
function eliminarBateria(id) {
  const folder = _getBateriasFolder();
  const indice = _readIndice(folder);
  const idx = indice.findIndex(e => e.id === id);
  if (idx === -1) throw new Error('Batería no encontrada');
  try { DriveApp.getFileById(indice[idx].fileId).setTrashed(true); } catch(e) {}
  indice.splice(idx, 1);
  _writeIndice(folder, indice);
}
