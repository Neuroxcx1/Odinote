// =====================================================
// Oddinote — el enlace para ver (window.OdiVista)
//
// Lo pidió alguien que encarga textos y comparte tableros de referencia: un
// enlace que se abre en el navegador, sin cuenta y sin escribir ningún código,
// para mirar el proyecto —moverse, entrar en los tableros— sin poder cambiar
// nada. Y que funcione aunque el dueño tenga la aplicación cerrada: la sesión
// en vivo necesita al anfitrión delante, y quien recibe un encargo lo mira
// cuando puede.
//
// Por eso es una COPIA del proyecto en Firestore (colección `vistas`, ver
// firestore.rules), que cualquiera con el enlace puede leer y nadie puede
// listar: el identificador del enlace es la llave, y es largo para que no se
// pueda adivinar. Las imágenes y los audios no van dentro: van sus direcciones
// de Google Drive, que ya son públicas (es lo que exige compartir).
//
// Lo que NO puede salir de este equipo se quita antes de subir: los campos del
// momento (`_…`) y `srcLocal`, la ruta de la copia de cada archivo en el disco
// de quien comparte.
//
// Sin React ni DOM: se prueba entero desde Node (scripts/test-vista.js).
// =====================================================
(function () {
  'use strict';

  // Un documento de Firestore no puede pasar de 1 MiB: se corta antes, como
  // en nube.js, porque pasarse da un error que tira la subida entera.
  const TOPE = 900 * 1024;

  // Donde vive la aplicación web (GitHub Pages, la rama main).
  const BASE_WEB = 'https://neuroxcx1.github.io/Odinote/App/index.html';

  const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const FORMA_ID = /^[A-Za-z0-9]{16,40}$/;

  // Un byte al azar. Con crypto si lo hay (siempre, en un navegador o en
  // Electron); `azar` es para las pruebas.
  function unByte(azar) {
    if (azar) return Math.floor(azar() * 256);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto.getRandomValues(new Uint8Array(1))[0];
    return Math.floor(Math.random() * 256);
  }

  // 22 letras de 62: unos 131 bits, imposible de adivinar. 256 no es múltiplo
  // de 62, así que los bytes del final del rango se tiran: si no, las primeras
  // letras saldrían más que las otras.
  function idNuevo(azar) {
    let s = '';
    while (s.length < 22) {
      const b = unByte(azar);
      if (b < 248) s += LETRAS[b % 62];
    }
    return s;
  }

  function enlace(id, base) {
    return (base || BASE_WEB) + '#ver=' + id;
  }

  // El id de un enlace, venga como venga: '#ver=…' (el que se copia) o
  // '?ver=…' (por si alguien lo reescribe a mano). null si no hay o no tiene
  // la forma de los nuestros.
  function leeEnlace(href) {
    if (typeof href !== 'string') return null;
    const m = href.match(/[#?&]ver=([^&#]+)/);
    if (!m) return null;
    let id = m[1];
    try { id = decodeURIComponent(id); } catch (e) {}
    return FORMA_ID.test(id) ? id : null;
  }

  // Un nodo (o hijo de columna, o foto de galería) sin lo que es de este equipo.
  function limpiaNodo(n) {
    if (!n || typeof n !== 'object' || Array.isArray(n)) return n;
    const out = {};
    Object.keys(n).forEach(k => {
      if (k.charAt(0) === '_' || k === 'srcLocal' || k === 'rutaOrigen') return;
      const v = n[k];
      if ((k === 'children' || k === 'fotos') && Array.isArray(v)) out[k] = v.map(limpiaNodo);
      else out[k] = v;
    });
    return out;
  }

  // ¿Este medio está solo en el disco de quien comparte? Eso en el enlace sale
  // vacío: se cuenta para avisar antes de crearlo.
  function soloEnEsteEquipo(src) {
    return typeof src === 'string' && !!src.trim() && !/^(https?:|data:)/i.test(src);
  }

  // Los lienzos del proyecto (el suyo y los tableros que cuelgan de él, como
  // nube.js) listos para subir.
  function prepara(canvases, raiz) {
    const lienzos = {};
    let sinSubir = 0;
    const cuenta = (n) => {
      if (!n || typeof n !== 'object') return;
      if (soloEnEsteEquipo(n.src)) sinSubir++;
      (Array.isArray(n.children) ? n.children : []).forEach(cuenta);
      (Array.isArray(n.fotos) ? n.fotos : []).forEach(cuenta);
    };
    const visita = (id) => {
      const c = canvases && canvases[id];
      if (!c || lienzos[id]) return;
      const items = Array.isArray(c.items) ? c.items : [];
      items.forEach(cuenta);
      lienzos[id] = {
        title: c.title,
        parent: c.parent,
        parentLabel: c.parentLabel,
        bgColor: c.bgColor,
        pan: c.pan,
        scale: c.scale,
        items: items.map(limpiaNodo),
        connectors: (Array.isArray(c.connectors) ? c.connectors : []).map(limpiaNodo),
      };
      // Sin los undefined: Firestore no los admite y la escritura fallaría.
      Object.keys(lienzos[id]).forEach(k => { if (lienzos[id][k] === undefined) delete lienzos[id][k]; });
      items.forEach(it => { if (it && it.canvasId) visita(it.canvasId); });
    };
    if (raiz) visita(raiz);
    const pesa = JSON.stringify(lienzos).length;
    return { lienzos, sinSubir, pesa, cabe: pesa <= TOPE };
  }

  // Firestore tampoco admite undefined DENTRO de los nodos (un campo que se
  // quedó sin valor). Se quitan en todo el árbol, sin tocar lo demás.
  function sinIndefinidos(v) {
    if (Array.isArray(v)) return v.map(x => (x === undefined ? null : sinIndefinidos(x)));
    if (v && typeof v === 'object') {
      const out = {};
      Object.keys(v).forEach(k => { if (v[k] !== undefined) out[k] = sinIndefinidos(v[k]); });
      return out;
    }
    return v;
  }

  // Lo que se sube: el documento entero de `vistas/{id}`. `cuando` lo pone el
  // que llama (el sello del servidor en la app, una fecha en las pruebas).
  function documento({ uid, proyecto, lienzos, raiz, cuando }) {
    const nombre = proyecto && proyecto.name;
    const doc = sinIndefinidos({
      dueno: uid,
      raiz,
      nombre: nombre && typeof nombre === 'object' ? nombre : String(nombre || ''),
      emoji: (proyecto && proyecto.emoji) || '',
      lienzos,
      version: 1,
    });
    // Fuera de sinIndefinidos a propósito: en la app es el sello de hora del
    // servidor, un objeto que Firestore reconoce y que copiado deja de serlo.
    doc.actualizadoEn = cuando === undefined ? null : cuando;
    return doc;
  }

  // ── El servidor ──
  // Aquí y no en la app para que las pruebas puedan cambiarlas por unas de
  // mentira (window.OdiVista.escucha = …) sin tocar Firestore.
  function db() {
    const fb = typeof window !== 'undefined' && window.firebase;
    return fb && fb.firestore ? fb.firestore() : null;
  }

  // Sigue una vista: llama a alLlegar con cada versión que publique el dueño,
  // o a alFallar('no-existe' | 'sin-conexion' | 'sin-servidor'). Devuelve
  // cómo dejar de seguirla. Sin iniciar sesión: las reglas dejan leerla.
  function escucha(id, alLlegar, alFallar) {
    const d = db();
    if (!d) { alFallar('sin-servidor'); return function () {}; }
    return d.collection('vistas').doc(id).onSnapshot(
      (doc) => { if (doc.exists) alLlegar(doc.data()); else alFallar('no-existe'); },
      // Una vista borrada, o un id que nunca existió, también puede llegar
      // como «sin permiso» según cómo estén las reglas: para quien abre el
      // enlace es lo mismo, ese enlace ya no lleva a nada.
      (err) => alFallar(err && err.code === 'permission-denied' ? 'no-existe' : 'sin-conexion')
    );
  }

  function publica(id, doc) {
    const d = db();
    if (!d) return Promise.reject(new Error('sin-servidor'));
    const fb = window.firebase;
    const conSello = Object.assign({}, doc, { actualizadoEn: fb.firestore.FieldValue.serverTimestamp() });
    return d.collection('vistas').doc(id).set(conSello);
  }

  function quita(id) {
    const d = db();
    if (!d) return Promise.reject(new Error('sin-servidor'));
    return d.collection('vistas').doc(id).delete();
  }

  // ¿Hace falta volver a subir? Solo si cambió lo que se ve.
  function cambio(lienzos, anterior) {
    if (!anterior) return true;
    return JSON.stringify(lienzos) !== JSON.stringify(anterior);
  }

  // Lo que hace falta para PINTAR una vista que llega: el proyecto con lo
  // mínimo que pide el lienzo, y los lienzos tal cual.
  function paraPintar(doc) {
    if (!doc || !doc.raiz || !doc.lienzos || !doc.lienzos[doc.raiz]) return null;
    return {
      proyecto: { id: doc.raiz, name: doc.nombre || '', emoji: doc.emoji || '', vistaPublica: true },
      lienzos: doc.lienzos,
      raiz: doc.raiz,
    };
  }

  const OdiVista = { TOPE, BASE_WEB, idNuevo, enlace, leeEnlace, limpiaNodo, prepara, documento, cambio, paraPintar, sinIndefinidos, escucha, publica, quita };
  if (typeof window !== 'undefined') window.OdiVista = OdiVista;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiVista;
})();
