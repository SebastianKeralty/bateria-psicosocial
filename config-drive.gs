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
  if (!folderId) folderId = CARPETA_POR_DEFECTO;
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch(e) {
      props.deleteProperty('BATERIAS_FOLDER_ID');
      throw new Error('La carpeta configurada no está disponible. Ve a Baterías y configura una nueva.');
    }
  }
  throw new Error('No hay carpeta configurada. Ve a Baterías y configura una carpeta de Drive.');
}
