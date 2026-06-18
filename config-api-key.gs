// ── API Key ──
function configurarApiKey(key) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
  return true;
}

function _getApiKey() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('GEMINI_API_KEY');
  if (key) return key;
  var defaultKey = 'AIzaSyDZ4yVfRDegy1cVV9jvYmM5rmwUB_3Cbhc';
  props.setProperty('GEMINI_API_KEY', defaultKey);
  return defaultKey;
}
