/**
 * SISERO · Copia automática de registros de asistencia a Google Sheets
 *
 * Cómo instalarlo (una sola vez):
 *  1. En la hoja de Google: Extensiones → Apps Script. Borra lo que haya y pega todo este archivo.
 *  2. Llena CORREO_LECTOR y CONTRASENA_LECTOR abajo (la cuenta de solo lectura).
 *  3. Guarda (ícono de disco), elige la función "configurar" arriba y presiona Ejecutar.
 *     Google pedirá permisos: Revisar permisos → tu cuenta → Avanzado → Ir a (proyecto) → Permitir.
 *  Listo: cada 5 minutos se agregan los registros nuevos a la pestaña "Registros".
 */

// ---------- CONFIGURACIÓN ----------
const SUPABASE_URL = 'https://mqavljoajujhdqgqkopl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xYXZsam9hanVqaGRxZ3Frb3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MDYxOTMsImV4cCI6MjEwNjk4MjE5M30._hcKgBWztmteGfMGA8D8dJaaeiziIQ8gx6OpkI3sWdg';
const CORREO_LECTOR = 'LECTOR_CORREO@gmail.com';
const CONTRASENA_LECTOR = 'CONTRASEÑA_DEL_LECTOR';
const PESTANA = 'Registros';
const MINUTOS = 5;                       // cada cuánto se sincroniza (1, 5, 10, 15 o 30)
const DIAS_ENLACE_FOTO = 365;            // los enlaces de las fotos duran este tiempo
// -----------------------------------

const ENCABEZADOS = ['Fecha', 'Hora', 'Tipo', 'Turno', 'Elemento', 'No.', 'Puesto', 'Servicio', 'Servicio base',
  'Cubre', 'Ubicación', 'Distancia (m)', 'Mapa', 'Sin señal', 'Foto', 'ID'];

/** Ejecuta esta función una vez para dejar todo listo. */
function configurar() {
  const hoja = obtenerHoja_();
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sincronizar')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sincronizar').timeBased().everyMinutes(MINUTOS).create();
  sincronizar();
  SpreadsheetApp.getActive().toast(`Listo: se sincroniza cada ${MINUTOS} minutos.`, 'SISERO', 8);
  return hoja.getName();
}

/** Trae los registros nuevos y los agrega al final de la hoja. */
function sincronizar() {
  const candado = LockService.getScriptLock();
  if (!candado.tryLock(20000)) return;          // ya hay otra sincronización corriendo
  try {
    const hoja = obtenerHoja_();
    const props = PropertiesService.getScriptProperties();
    let desde = props.getProperty('ULTIMO_RECIBIDO');   // null la primera vez = trae todo
    const yaEstan = idsExistentes_(hoja);
    const token = iniciarSesion_();
    let total = 0;

    for (let vuelta = 0; vuelta < 20; vuelta++) {       // hasta 20 000 registros por corrida
      const lote = rpc_(token, 'exportar_registros', { p_desde: desde, p_limite: 1000 });
      if (!lote.length) break;
      const nuevos = lote.filter(r => !yaEstan.has(r.id));
      const enlaces = firmarFotos_(token, nuevos.map(r => r.foto_path).filter(String));
      const filas = nuevos.map(r => [
        r.fecha, r.hora, r.tipo, r.turno || '', r.empleado, r.numero || '', r.puesto, r.servicio, r.servicio_base || '',
        r.cubre ? 'Sí' : 'No', r.ubicacion, r.distancia_m == null ? '' : r.distancia_m,
        r.lat == null ? '' : `https://www.google.com/maps?q=${r.lat},${r.lng}`,
        r.sin_senal ? 'Sí' : 'No',
        (r.foto_path && enlaces[r.foto_path]) || '',
        r.id
      ]);
      if (filas.length) {
        hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, ENCABEZADOS.length).setNumberFormat('@').setValues(filas);
        nuevos.forEach(r => yaEstan.add(r.id));
        total += filas.length;
      }
      desde = lote[lote.length - 1].recibido;
      props.setProperty('ULTIMO_RECIBIDO', desde);
      if (lote.length < 1000) break;
    }
    props.setProperty('ULTIMA_SINCRONIZACION', new Date().toISOString());
    if (total) console.log(`Se agregaron ${total} registros.`);
  } finally {
    candado.releaseLock();
  }
}

/** Borra la hoja y vuelve a copiar todo desde el principio (por si se borraron filas por error). */
function reiniciarDesdeCero() {
  PropertiesService.getScriptProperties().deleteProperty('ULTIMO_RECIBIDO');
  const hoja = obtenerHoja_();
  if (hoja.getLastRow() > 1) hoja.getRange(2, 1, hoja.getLastRow() - 1, hoja.getLastColumn()).clearContent();
  sincronizar();
}

// ---------- funciones internas ----------

function obtenerHoja_() {
  const libro = SpreadsheetApp.getActive();
  let hoja = libro.getSheetByName(PESTANA);
  if (!hoja) hoja = libro.insertSheet(PESTANA);
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, ENCABEZADOS.length).setValues([ENCABEZADOS])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#0b2c55');
    hoja.setFrozenRows(1);
    hoja.setColumnWidth(5, 220);
  }
  return hoja;
}

function idsExistentes_(hoja) {
  const n = hoja.getLastRow() - 1;
  if (n <= 0) return new Set();
  return new Set(hoja.getRange(2, ENCABEZADOS.length, n, 1).getValues().map(f => String(f[0])).filter(String));
}

function iniciarSesion_() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get('TOKEN');
  if (guardado) return guardado;
  if (CORREO_LECTOR.includes('LECTOR_CORREO')) throw new Error('Falta escribir CORREO_LECTOR y CONTRASENA_LECTOR en la configuración.');
  const res = UrlFetchApp.fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_ANON_KEY },
    payload: JSON.stringify({ email: CORREO_LECTOR, password: CONTRASENA_LECTOR })
  });
  if (res.getResponseCode() !== 200) throw new Error('No se pudo entrar con la cuenta de lectura: ' + res.getContentText());
  const datos = JSON.parse(res.getContentText());
  cache.put('TOKEN', datos.access_token, Math.max(60, Math.min(3000, (datos.expires_in || 3600) - 300)));
  return datos.access_token;
}

function rpc_(token, funcion, args) {
  const res = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcion}`, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    payload: JSON.stringify(args)
  });
  if (res.getResponseCode() !== 200) {
    CacheService.getScriptCache().remove('TOKEN');
    throw new Error(`Error al leer registros (${res.getResponseCode()}): ${res.getContentText()}`);
  }
  return JSON.parse(res.getContentText());
}

function firmarFotos_(token, rutas) {
  const enlaces = {};
  for (let i = 0; i < rutas.length; i += 100) {
    const parte = rutas.slice(i, i + 100);
    const res = UrlFetchApp.fetch(`${SUPABASE_URL}/storage/v1/object/sign/fotos`, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ expiresIn: DIAS_ENLACE_FOTO * 86400, paths: parte })
    });
    if (res.getResponseCode() !== 200) { console.warn('No se pudieron firmar fotos: ' + res.getContentText()); continue; }
    JSON.parse(res.getContentText()).forEach(x => {
      const url = x.signedURL || x.signedUrl;
      if (url && x.path) enlaces[x.path] = url.startsWith('http') ? url : `${SUPABASE_URL}/storage/v1${url}`;
    });
  }
  return enlaces;
}
