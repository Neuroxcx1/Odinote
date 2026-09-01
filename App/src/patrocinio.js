// =====================================================
// Odinote — la corona de quien ha invitado a un café
//
// Todo el trabajo de verdad lo hace Ko-fi avisando a Firebase (ver
// `functions/index.js`). Aquí solo se pregunta una cosa, y una vez al día:
// ¿está mi correo en la lista de patrocinadores?
//
// Tres decisiones que conviene entender antes de tocar nada:
//
//   · Se recuerda la respuesta en el equipo. Odinote se usa en aviones, en el
//     metro y en sitios sin cobertura, y perder la corona por no tener línea
//     sería exactamente el peor momento para recordarle a alguien que pagó.
//     Mientras no haya una respuesta nueva, vale la última que hubo.
//
//   · Se pregunta por el correo de la sesión de Google, no por el que la app
//     tenga guardado de antes. Son casi siempre el mismo, pero las reglas de
//     Firestore comprueban el de la sesión, así que preguntar por otro solo
//     serviría para llevarse un "permiso denegado" que no ayuda a nadie.
//
//   · Si la consulta falla —sin línea, bloqueador de anuncios, Firestore
//     caído— NO se apaga la corona. Un fallo de red no es una respuesta.
//
// Y una cosa que no es un descuido: quien quiera ponerse la corona sin pagar
// puede hacerlo, porque el programa es de código abierto y basta con editar
// este archivo. No hay forma de evitarlo en un programa que se ejecuta en el
// equipo de otro, y tampoco merece la pena intentarlo: es un adorno, no una
// función de pago. Nada de lo que Odinote hace está detrás de esto.
// =====================================================

(function () {
  'use strict';

  var CLAVE = 'odinote.patrocinio.v1';

  // Cada cuánto se vuelve a preguntar. Y no es el mismo plazo para un sí que
  // para un no, a propósito:
  //
  //   · Un SÍ dura un día. Ya tiene la corona; volver a preguntar cada rato
  //     no le aporta nada y solo gasta cuota.
  //
  //   · Un NO caduca en un cuarto de hora. Este es el caso que importa: quien
  //     acaba de pagar. Si un no durase un día, alguien podría donar, abrir
  //     Odinote ilusionado y no ver nada hasta el día siguiente, que es
  //     exactamente el momento en el que peor sienta. Quince minutos es lo que
  //     tarda en tomarse un café.
  //
  // Preguntar de más aquí no cuesta nada: es UNA lectura por persona cada
  // cuarto de hora como mucho, contra las 50.000 diarias que Firestore regala.
  var VIGENCIA_SI = 24 * 60 * 60 * 1000;
  var VIGENCIA_NO = 15 * 60 * 1000;

  // Se busca el almacén y la sesión así, y no directamente, para que las
  // pruebas de `scripts/test-patrocinio.js` puedan poner los suyos. En el
  // navegador devuelven exactamente lo de siempre.
  function almacen() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (err) {
      // Modo privado con cookies bloqueadas: el simple hecho de nombrarlo tira.
      return null;
    }
  }

  function sesion() {
    try {
      if (typeof firebase === 'undefined' || !firebase.auth) return null;
      return firebase.auth();
    } catch (err) {
      return null;
    }
  }

  function leeCache() {
    var caja = almacen();
    if (!caja) return null;
    try {
      var crudo = caja.getItem(CLAVE);
      if (!crudo) return null;
      var dato = JSON.parse(crudo);
      if (!dato || typeof dato.correo !== 'string') return null;
      return dato;
    } catch (err) {
      return null;
    }
  }

  function guardaCache(dato) {
    var caja = almacen();
    if (!caja) return;
    try {
      caja.setItem(CLAVE, JSON.stringify(dato));
    } catch (err) {
      // Sin espacio o en modo privado. No es motivo para romper nada: se
      // volverá a preguntar en el próximo arranque.
    }
  }

  function normaliza(correo) {
    return typeof correo === 'string' ? correo.trim().toLowerCase() : '';
  }

  // El correo con el que se puede preguntar: el de la sesión de Google. Una
  // sesión anónima —la que se abre para entrar en una sala sin cuenta— no
  // tiene correo, y con ella no hay nada que consultar.
  function correoDeSesion() {
    var auth = sesion();
    if (!auth) return '';
    var usuario = auth.currentUser;
    if (!usuario || usuario.isAnonymous) return '';
    return normaliza(usuario.email);
  }

  // Lo que se sabe ahora mismo, sin preguntar a nadie y sin esperar. Es lo que
  // pinta la primera pantalla: si el último arranque dijo que sí, la corona
  // sale ya, sin el parpadeo de esperar a que conteste Firestore.
  function activo(correo) {
    var cache = leeCache();
    if (!cache) return false;
    var quien = normaliza(correo) || correoDeSesion();
    if (!quien) return false;
    if (cache.correo !== quien) return false;
    return cache.activo === true;
  }

  // ¿Es la primera vez que esta persona se entera de que tiene la corona? Sirve
  // para dar las gracias una sola vez y no en cada arranque.
  function esNuevo(correo) {
    var cache = leeCache();
    if (!cache || cache.activo !== true) return false;
    if (cache.correo !== (normaliza(correo) || correoDeSesion())) return false;
    return cache.avisado !== true;
  }

  function marcaAvisado() {
    var cache = leeCache();
    if (!cache) return;
    cache.avisado = true;
    guardaCache(cache);
  }

  // Al cerrar sesión se borra: la corona es de una cuenta, no del equipo. Si no
  // se borrase, el siguiente que entrara en ese ordenador la heredaría.
  function olvida() {
    var caja = almacen();
    if (!caja) return;
    try {
      caja.removeItem(CLAVE);
    } catch (err) {}
  }

  function disponible() {
    try {
      return typeof firebase !== 'undefined' && !!firebase.firestore;
    } catch (err) {
      return false;
    }
  }

  // La consulta de verdad. Devuelve siempre algo utilizable: si no se puede
  // preguntar, lo último que se supo.
  function comprueba(opciones) {
    opciones = opciones || {};
    var correo = correoDeSesion();

    if (!correo) {
      // Nadie con cuenta de Google delante. No se borra el recuerdo: puede que
      // la sesión aún no haya terminado de restaurarse al arrancar.
      return Promise.resolve(false);
    }

    var cache = leeCache();
    var mismoDueno = !!cache && cache.correo === correo;
    var loSabido = mismoDueno && cache.activo === true;
    var vigencia = loSabido ? VIGENCIA_SI : VIGENCIA_NO;
    var reciente = mismoDueno &&
                   typeof cache.comprobadoEn === 'number' &&
                   (Date.now() - cache.comprobadoEn) < vigencia;

    if (reciente && !opciones.forzar) {
      return Promise.resolve(loSabido);
    }

    if (!disponible()) {
      return Promise.resolve(loSabido);
    }

    return firebase.firestore().collection('patrocinadores').doc(correo).get()
      .then(function (doc) {
        var esta = !!(doc && doc.exists);
        guardaCache({
          correo: correo,
          activo: esta,
          comprobadoEn: Date.now(),
          // Si alguien deja de estar en la lista y vuelve, que se le den las
          // gracias otra vez. Al de siempre no se le repite en cada arranque.
          avisado: esta && loSabido ? cache.avisado === true : false,
        });
        return esta;
      })
      .catch(function (err) {
        // Sin línea, con un bloqueador de anuncios delante, o con Firestore
        // devolviendo un no. Lo único que NO se hace aquí es apagar la corona:
        // no se toca el recuerdo y se devuelve lo último que se supo.
        console.warn('[Patrocinio] No se pudo consultar la lista:', err && err.code);
        return loSabido;
      });
  }

  var Patrocinio = {
    CLAVE: CLAVE,
    VIGENCIA_SI: VIGENCIA_SI,
    VIGENCIA_NO: VIGENCIA_NO,
    activo: activo,
    esNuevo: esNuevo,
    marcaAvisado: marcaAvisado,
    comprueba: comprueba,
    olvida: olvida,
  };

  if (typeof window !== 'undefined') window.Patrocinio = Patrocinio;
  if (typeof module !== 'undefined' && module.exports) module.exports = Patrocinio;
})();
