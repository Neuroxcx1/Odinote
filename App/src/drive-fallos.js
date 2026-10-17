// =====================================================
// Oddinote — por qué falló Google Drive, dicho para personas
// (window.OdiDriveFallos)
//
// A un compañero del mantenedor, en la web, le salió «No se pudo subir a
// Google Drive: el proyecto se queda offline» y no hubo manera de saber por
// qué: la subida devolvía null en cualquiera de sus diez pasos y el aviso era
// el mismo para todo. Aquí se apunta QUÉ paso falló y con qué respuesta, y se
// traduce a algo que se pueda arreglar.
//
// El caso que más se espera es el de quien entra por primera vez: Google pide
// la cuenta y el permiso de Drive a la vez, y el de Drive es una casilla que
// hay que MARCAR. Quien pulsa «Continuar» sin marcarla entra con su cuenta
// pero sin Drive, y Drive contesta 403 «insufficient authentication scopes».
//
// Sin React ni DOM: se prueba desde Node (scripts/test-drive-fallos.js).
// =====================================================
(function () {
  const ALCANCE_DRIVE = 'https://www.googleapis.com/auth/drive.file';
  const t = (es, en) => (typeof window !== 'undefined' && window.t ? window.t(es, en) : es);

  // De una respuesta de Drive que no fue bien: { paso, status, reason }.
  async function deRespuesta(paso, res) {
    let reason = '';
    try {
      const data = await res.clone().json();
      const err = data && data.error;
      reason = (err && (err.message || (err.errors && err.errors[0] && err.errors[0].reason))) || '';
    } catch (e) {}
    return { paso, status: res.status, reason };
  }

  // Lo que se lanza cuando ni siquiera hay respuesta (sin internet, o algo del
  // navegador que bloquea la petición): status 0.
  function deExcepcion(paso, err) {
    return { paso, status: 0, reason: (err && err.message) || String(err || '') };
  }

  const esFaltaDePermiso = (f) => !!f && f.status === 403 &&
    /insufficient|scope|permission/i.test(f.reason || '') && !/storage|quota/i.test(f.reason || '');

  // El texto del aviso. Siempre acaba diciendo que el proyecto sigue offline,
  // que es lo que importa: no se ha perdido nada.
  function explica(f) {
    const offline = t(' El proyecto se queda offline: no se ha perdido nada.', ' The project stays offline: nothing was lost.');
    if (!f) return t('No se pudo subir a Google Drive.', 'Could not upload to Google Drive.') + offline;
    const reason = f.reason || '';
    if (esFaltaDePermiso(f)) {
      return t(
        'Google no dio permiso para usar tu Drive. Al entrar con Google hay que MARCAR la casilla de Google Drive (puede venir sin marcar). Cierra la sesión y vuelve a entrar marcándola.',
        'Google did not grant access to your Drive. When signing in with Google you have to TICK the Google Drive box (it may come unticked). Sign out and sign in again ticking it.'
      ) + offline;
    }
    if (f.status === 0) {
      return t(
        'No hubo conexión con Google Drive. Revisa internet; si lo tienes, puede que una extensión del navegador (un bloqueador) esté cortando la conexión con Google.',
        'Could not reach Google Drive. Check your internet; if it works, a browser extension (a blocker) may be cutting the connection to Google.'
      ) + offline;
    }
    if (f.status === 401) {
      return t('El permiso de Google caducó. Pulsa ↻ (o vuelve a entrar con Google) y reintenta.',
        'The Google permission expired. Press ↻ (or sign in with Google again) and retry.') + offline;
    }
    if (f.status === 403 && /storage|quota/i.test(reason)) {
      return t('Tu Google Drive está lleno. Libera espacio y vuelve a intentarlo.',
        'Your Google Drive is full. Free some space and try again.') + offline;
    }
    if ((f.status === 403 || f.status === 429) && /rate|limit/i.test(reason)) {
      return t('Google Drive pide esperar un momento (demasiadas peticiones seguidas). Prueba en un minuto.',
        'Google Drive asks to wait a moment (too many requests in a row). Try again in a minute.') + offline;
    }
    const donde = f.paso ? ` (${f.paso})` : '';
    return t(
      `No se pudo subir a Google Drive${donde}: error ${f.status}${reason ? ' — ' + reason : ''}.`,
      `Could not upload to Google Drive${donde}: error ${f.status}${reason ? ' — ' + reason : ''}.`
    ) + offline;
  }

  // ¿Este permiso deja usar Drive? Se le pregunta al propio Drive con una
  // petición mínima (quién es el usuario), con el token en la cabecera como
  // siempre. Devuelve null si todo va bien o si no se pudo saber (sin
  // conexión: entonces mejor no alarmar a nadie), y el fallo si Drive dice
  // que no: así se avisa nada más entrar, y no al intentar subir.
  async function compruebaDrive(accessToken) {
    if (!accessToken) return null;
    try {
      const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: 'Bearer ' + accessToken },
      });
      if (r.ok) return null;
      const f = await deRespuesta(t('comprobar el permiso de Drive', 'checking the Drive permission'), r);
      return f.status === 401 || f.status === 403 ? f : null;
    } catch (e) { return null; }
  }

  // Lo que se dice nada más entrar si falta el permiso: ahí todavía no se ha
  // intentado subir nada, así que no hay proyecto que «se quede offline».
  const avisoSinPermiso = () => t(
    'Has entrado, pero Google no dio permiso para usar tu Drive: la casilla de Google Drive no estaba marcada. Sin él no se puede guardar en Drive ni compartir proyectos. Para dárselo, cierra la sesión y vuelve a entrar marcándola.',
    'You are signed in, but Google did not grant access to your Drive: the Google Drive box was not ticked. Without it nothing can be saved to Drive or shared. To grant it, sign out and sign in again ticking it.'
  );

  const OdiDriveFallos = { ALCANCE_DRIVE, deRespuesta, deExcepcion, esFaltaDePermiso, explica, compruebaDrive, avisoSinPermiso };
  if (typeof window !== 'undefined') window.OdiDriveFallos = OdiDriveFallos;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiDriveFallos;
})();
