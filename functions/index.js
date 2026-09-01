// =====================================================
// Odinote — el aviso de Ko-fi que enciende la corona
//
// Ko-fi no puede hablar con Firebase, y la app que cada persona tiene
// instalada tampoco se entera de que alguien ha pagado. Este archivo es lo
// que hay en medio: una dirección de internet a la que Ko-fi llama en el
// momento del pago, y que deja apuntado el correo del que ha pagado en la
// colección `patrocinadores`.
//
// A partir de ahí la app hace el resto sola: cuando esa persona entra con su
// Google, mira si su correo está en la lista y le enciende los cosméticos.
// Nadie tiene que apuntar nada a mano.
//
// Vive DENTRO de Firebase a propósito. Así no hay ninguna llave privada que
// generar, ni que guardar en ningún sitio, ni que se pueda filtrar: al correr
// dentro del proyecto ya tiene permiso para escribir. Esa es también la razón
// de que pueda escribir en `patrocinadores` cuando las reglas se lo prohíben a
// todo el mundo — el SDK de administrador no pasa por las reglas.
//
// Se usa la API de primera generación (`firebase-functions/v1`) por una razón
// práctica: su dirección es predecible y se puede escribir de antemano en las
// instrucciones y en el panel de Ko-fi. Las funciones de segunda generación
// llevan un trozo aleatorio en la dirección que solo se conoce después de
// desplegarlas.
//
// ── Cómo se pone en marcha (una vez y ya está) ──
//
//   1. npm --prefix functions install
//   2. firebase login
//   3. firebase functions:secrets:set KOFI_TOKEN   ← pega aquí el token de
//      Ko-fi cuando lo pida. No se queda escrito en ningún archivo.
//   4. firebase deploy --only functions,firestore:rules
//   5. En https://ko-fi.com/manage/webhooks, pegar como URL:
//      https://us-central1-odinote-firebase.cloudfunctions.net/kofi97941138ba45a559b3e4
// =====================================================

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();

// Comparar dos textos secretos con `===` tarda más cuanto más se parecen, y
// esa diferencia de tiempo, medida muchas veces, deja adivinar el token letra
// a letra. Esta compara siempre en el mismo tiempo.
function mismoToken(recibido, esperado) {
  if (typeof recibido !== 'string' || typeof esperado !== 'string') return false;
  const a = Buffer.from(recibido, 'utf8');
  const b = Buffer.from(esperado, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// El identificador de un patrocinador es su correo en minúsculas. Firestore
// distingue mayúsculas en los nombres de documento, así que sin esto
// "Juan@gmail.com" y "juan@gmail.com" serían dos personas distintas y la
// corona no aparecería según cómo hubiera escrito su correo en PayPal.
function normalizaCorreo(valor) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim().toLowerCase();
  // Comprobación deliberadamente floja: no valida direcciones, solo descarta
  // lo que Firestore no admite como nombre de documento: la barra, que
  // partiría la ruta, y los nombres rodeados de guiones bajos, que están
  // reservados. Ninguna dirección de correo real cae en eso.
  if (!limpio || limpio.length > 320) return null;
  if (/^__.*__$/.test(limpio)) return null;
  if (limpio.includes('/')) return null;
  if (!limpio.includes('@')) return null;
  return limpio;
}

// ── El cortafuegos de la avalancha ──
//
// Cuál es de verdad el recurso caro aquí: Firestore. Las llamadas a la función
// van casi todas dentro de lo que Google regala, pero cada escritura y cada
// lectura de la base de datos cuenta contra una cuota diaria mucho más
// estrecha. Así que lo que hay que proteger no es la función: es la base.
//
// Este contador vive en la memoria de la copia que esté corriendo y no cuesta
// nada —ni una lectura, ni una escritura—. Cuando llegan más avisos de los que
// puede haber de verdad, se contesta y se corta ANTES de tocar Firestore. Un
// atacante puede hacer que la función se ejecute; lo que no puede es hacer que
// escriba.
//
// Que el contador se pierda al apagarse la copia no importa: apagarse ya es la
// prueba de que no había avalancha. Y con `maxInstances: 1` hay una sola copia,
// así que este contador las ve todas.
const VENTANA = 60 * 1000;
const TOPE_POR_VENTANA = 20;   // Ko-fi manda unos pocos al mes, no 20 al minuto
let ventanaInicio = Date.now();
let ventanaCuenta = 0;

function hayAvalancha() {
  const ahora = Date.now();
  if (ahora - ventanaInicio > VENTANA) {
    ventanaInicio = ahora;
    ventanaCuenta = 0;
  }
  ventanaCuenta++;
  return ventanaCuenta > TOPE_POR_VENTANA;
}

exports.kofi97941138ba45a559b3e4 = functions
  .region('us-central1')
  .runWith({
    // El token que Ko-fi manda dentro de cada aviso para demostrar que el
    // aviso es suyo y no de un gracioso. Se guarda en el almacén de secretos
    // de Google, no en este archivo: el repositorio es público y aquí quedaría
    // a la vista. Llega como variable de entorno.
    secrets: ['KOFI_TOKEN'],

    // El freno de mano de la factura, y no es adorno.
    //
    // El plan de pago por uso no tiene tope: si alguien descubriera esta
    // dirección y la llamara un millón de veces, cada llamada sería un gasto.
    // UNA sola copia como máximo. Es el freno más fuerte que se puede poner
    // desde aquí: por muchas llamadas que lleguen a la vez, solo se atiende de
    // una en una y las demás se quedan esperando o fuera. Los avisos legítimos
    // de Ko-fi son unos pocos al mes, así que una copia sobra de largo, y a
    // cambio el peor caso queda acotado por arriba.
    maxInstances: 1,

    // Lo que hace esto es leer un mensaje corto y escribir una línea. Con la
    // memoria mínima va sobrado, y es lo que menos cuesta por llamada. El
    // tiempo máximo, corto por el mismo motivo: se paga por tiempo de ejecución
    // y aquí nada legítimo tarda ni un segundo.
    memory: '128MB',
    timeoutSeconds: 10,
  })
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).send('Solo POST');
    }

    // Lo primero de todo, antes de leer nada y antes de tocar la base.
    if (hayAvalancha()) {
      console.error('[kofi] Demasiados avisos seguidos. Cortando sin tocar Firestore.');
      // 429 y no 500: es la respuesta que le dice a Ko-fi "ahora no, vuelve a
      // intentarlo", así que un aviso legítimo que cayera justo en medio de una
      // avalancha no se perdería.
      return res.status(429).send('Demasiadas peticiones');
    }

    const esperado = process.env.KOFI_TOKEN;
    if (!esperado) {
      // Desplegada sin el secreto. Mejor gritarlo en el registro que aceptar
      // cualquier aviso que llegue.
      console.error('[kofi] Falta el secreto KOFI_TOKEN. Ejecuta: firebase functions:secrets:set KOFI_TOKEN');
      return res.status(500).send('Sin configurar');
    }

    // Ko-fi manda un formulario con un único campo, `data`, y dentro de ese
    // campo va el JSON de verdad.
    const crudo = req.body && req.body.data;
    if (!crudo) {
      console.warn('[kofi] Aviso sin campo `data`. Ignorado.');
      return res.status(400).send('Sin datos');
    }

    let pago;
    try {
      pago = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
    } catch (err) {
      console.warn('[kofi] El campo `data` no era JSON válido.');
      return res.status(400).send('Datos ilegibles');
    }

    if (!mismoToken(pago.verification_token, esperado)) {
      console.error('[kofi] Token de verificación incorrecto. Aviso rechazado.');
      return res.status(401).send('No autorizado');
    }

    const correo = normalizaCorreo(pago.email);
    if (!correo) {
      // Pasa con las donaciones anónimas. No es un fallo, y hay que responder
      // que todo fue bien: si se devuelve un error, Ko-fi reintenta el mismo
      // aviso durante días.
      console.warn('[kofi] Pago sin correo utilizable (¿donación anónima?). No se apunta a nadie.');
      return res.status(200).send('OK');
    }

    const ahora = admin.firestore.FieldValue.serverTimestamp();
    const ficha = {
      nivel: 'apoyo',
      nombre: typeof pago.from_name === 'string' ? pago.from_name.slice(0, 120) : 'Anónimo',
      origen: 'kofi',
      ultimoPago: ahora,
      ultimaTransaccion: typeof pago.kofi_transaction_id === 'string' ? pago.kofi_transaction_id : null,
      // `desde` solo se escribe si el documento aún no existía. Así, quien
      // dona por segunda vez conserva la fecha de la primera.
      desde: ahora,
    };

    try {
      const db = admin.firestore();
      const ref = db.collection('patrocinadores').doc(correo);
      // Una transacción y no un `set(..., { merge: true })` a secas, porque
      // hay que respetar el `desde` original y para eso hay que leer antes.
      // Ko-fi reintenta los avisos que no contesta a tiempo, así que este
      // camino se recorre a veces dos veces con el mismo pago; escrito así,
      // repetirlo no cambia nada.
      await db.runTransaction(async (tx) => {
        const previo = await tx.get(ref);
        if (previo.exists) {
          const actualizacion = Object.assign({}, ficha);
          delete actualizacion.desde;
          tx.update(ref, actualizacion);
        } else {
          tx.set(ref, ficha);
        }
      });
      console.log('[kofi] Patrocinador apuntado:', correo);
    } catch (err) {
      // Aquí sí conviene devolver error: el pago es real y el fallo es
      // nuestro, así que interesa que Ko-fi lo reintente.
      console.error('[kofi] No se pudo escribir en Firestore:', err);
      return res.status(500).send('Error al guardar');
    }

    return res.status(200).send('OK');
  });
