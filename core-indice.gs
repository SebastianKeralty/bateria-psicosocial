function _readIndice() {
  const props = PropertiesService.getScriptProperties();
  try { return JSON.parse(props.getProperty('BATERIAS_INDICE') || '[]'); } catch(e) { return []; }
}

function _writeIndice(data) {
  PropertiesService.getScriptProperties().setProperty('BATERIAS_INDICE', JSON.stringify(data));
}
