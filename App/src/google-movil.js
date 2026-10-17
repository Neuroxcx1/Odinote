// =====================================================
// Entrar con Google desde el APK de Android.
//
// Google bloquea su ventana de inicio de sesión dentro de una app como esta,
// así que el trabajo lo hace el propio teléfono (Movil/.../EntrarConGoogle.java):
// abre Google en el navegador, recoge la vuelta en 127.0.0.1 y guarda cifrado
// el token de refresco. Aquí solo se le da a la app la misma forma que tiene
// en el escritorio window.electronAPI (googleRefreshAccess, googleHasRefresh,
// googleSignOut), para que app.jsx no tenga que saber en cuál de los dos está.
//
// Fuera del APK window.odiGoogleMovil no existe.
// =====================================================
(function () {
  if (!window.ODINOTE_ANDROID) return;

  // El puente de Capacitor lo pone el teléfono al cargar la página; se busca
  // en el momento de usarlo y no al cargar este archivo, por si aún no está.
  const plugin = () => {
    const C = window.Capacitor;
    if (!C) return null;
    if (C.Plugins && C.Plugins.EntrarConGoogle) return C.Plugins.EntrarConGoogle;
    if (typeof C.registerPlugin === 'function') return C.registerPlugin('EntrarConGoogle');
    return null;
  };

  const motivo = (e) => (e && (e.code || e.message)) || 'desconocido';

  window.odiGoogleMovil = {
    disponible: () => !!plugin(),

    // { accessToken, idToken, expiresIn } o un error con su código
    // (cancelado, tiempo, google:access_denied, sin-credenciales, red…).
    entrar: () => {
      const p = plugin();
      if (!p) return Promise.reject(Object.assign(new Error('Sin el puente de Android'), { code: 'sin-puente' }));
      return p.entrar();
    },

    // Deja de esperar a Google (el teléfono cierra su escucha).
    cancelar: () => {
      const p = plugin();
      if (p && p.cancelar) p.cancelar().catch(() => {});
    },

    googleRefreshAccess: async () => {
      const p = plugin();
      if (!p) return { ok: false, reason: 'sin-puente' };
      try {
        const r = await p.renovar();
        return { ok: true, accessToken: r.accessToken, idToken: r.idToken || null, expiresIn: r.expiresIn || 3600 };
      } catch (e) {
        return { ok: false, reason: motivo(e) };
      }
    },

    googleHasRefresh: async () => {
      const p = plugin();
      if (!p) return { ok: false };
      try { return await p.hayRefresco(); } catch (e) { return { ok: false }; }
    },

    googleSignOut: async () => {
      const p = plugin();
      if (!p) return { ok: false };
      try { await p.salir(); return { ok: true }; } catch (e) { return { ok: false }; }
    },
  };
})();
