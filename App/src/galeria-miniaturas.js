// =====================================================
// Oddinote — las miniaturas de la galería (window.GaleriaMinis)
//
// Una galería con 111 fotos iba a tirones: cada foto se pintaba con la imagen
// entera (hasta 1600 px), aunque en el nodo ocupara un cuadradito. Eran cientos
// de megas de imagen que la tarjeta gráfica tenía que subir y tirar en cada
// cuadro al mover el lienzo (medido: tirones de medio segundo al moverlo, y 18
// cuadros por segundo al hacer zoom en rejilla).
//
// Así que cada foto se pinta con una copia pequeña, del tamaño que de verdad
// ocupa en la pantalla. Las copias se hacen de pocas en pocas y descodificando
// fuera del hilo de la página (createImageBitmap), y se guardan en IndexedDB:
// al volver a abrir el proyecto salen ya hechas. NO se guardan en el proyecto:
// son cosa de este equipo y se rehacen solas, y así no hay que tocar los cinco
// sitios por donde viajan las fotos de una galería.
//
// Lo que decide qué tamaño hace falta no toca el navegador y tiene sus
// pruebas: scripts/test-galeria-miniaturas.js.
// =====================================================
(function () {
  // Los lados largos que se fabrican. Pocos a propósito: al hacer zoom no se
  // rehacen a cada paso, solo cuando el que hay se queda corto.
  const LADOS = [160, 320, 640, 1280];
  const A_LA_VEZ = 3;          // copias fabricándose al mismo tiempo
  const TOPE_GUARDADAS = 6000; // pasado esto, se vacía el almacén y se rehacen

  // Qué lado largo hace falta para que una foto cubra su caja (van con
  // object-fit: cover) sin verse borrosa. La caja va en píxeles del lienzo, y
  // escala es el zoom del lienzo por los píxeles de la pantalla. Devuelve 0
  // cuando vale la foto de siempre: ya es pequeña, o hace falta más que la
  // copia más grande.
  function ladoPara(foto, cajaW, cajaH, escala) {
    const fw = foto && foto.w, fh = foto && foto.h;
    const s = escala > 0 ? escala : 1;
    let necesita;
    if (fw > 0 && fh > 0) {
      necesita = Math.max(fw, fh) * Math.max(cajaW / fw, cajaH / fh) * s;
    } else {
      // Sin medidas (una foto traída de una dirección): no se sabe cuánto la
      // recorta la caja, así que se pide algo de sobra.
      necesita = Math.max(cajaW, cajaH) * s * 1.5;
    }
    const lado = LADOS.find(l => l >= necesita);
    if (!lado) return 0;
    if (fw > 0 && fh > 0 && Math.max(fw, fh) <= lado) return 0;
    return lado;
  }

  // El zoom por los píxeles de la pantalla, redondeado hacia arriba a cuartos
  // de octava (pasos de un 19 %): así la galería no se vuelve a pintar a cada
  // paso de la rueda, solo cuando cambia de verdad lo que hay que pedir.
  function escalaRedonda(x) {
    const v = x > 0 ? x : 1;
    const r = Math.pow(2, Math.ceil(Math.log2(v) * 4 - 1e-9) / 4);
    return Math.min(8, Math.max(0.125, r));
  }

  // Con qué se guarda cada foto: su id, que no cambia cuando la foto recién
  // añadida (una data: URL) pasa a ser un archivo de la bóveda o se sube a
  // Drive; con el src, las cien miniaturas se rehacían después del primer
  // guardado. Una foto sin id usa su src; una data: URL entera son cientos de
  // miles de letras, así que se resume con su largo y la huella de tres trozos.
  function claveDe(foto) {
    if (foto && foto.id) return 'f:' + foto.id;
    return clave(foto && foto.src);
  }
  function clave(src) {
    const s = String(src || '');
    if (s.length <= 300) return s;
    let h = 2166136261;
    const trozo = (a, b) => { for (let i = a; i < b; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } };
    const n = s.length, mitad = n >> 1;
    trozo(0, Math.min(n, 2000));
    trozo(Math.max(0, mitad - 1000), Math.min(n, mitad + 1000));
    trozo(Math.max(0, n - 2000), n);
    return 'd' + n + '-' + (h >>> 0).toString(36);
  }

  // Entre las copias que ya hay de una foto, cuál pintar para un lado:
  // la más pequeña que llegue (basta), o si no, la más grande que haya
  // mientras se hace la buena (se ve un poco borrosa un momento, pero no en
  // blanco).
  function eligeHecha(hechas, lado) {
    let basta = 0, mayor = 0;
    hechas.forEach((url, l) => {
      if (l >= lado && (!basta || l < basta)) basta = l;
      if (l > mayor) mayor = l;
    });
    if (basta) return { lado: basta, basta: true };
    if (mayor) return { lado: mayor, basta: false };
    return null;
  }

  // ── Lo que necesita el navegador ──
  const enNavegador = typeof window !== 'undefined' && typeof document !== 'undefined';

  // Por foto: { lados: Map(lado → url), original: bool }. "original" quiere
  // decir que no hay copia que valga (un GIF, que dejaría de moverse; o algo
  // que no se pudo leer) y se pinta la foto de siempre.
  const memoria = new Map();
  const enCurso = new Map();
  const cola = [];
  let activos = 0;

  const deFoto = (k) => {
    let m = memoria.get(k);
    if (!m) { m = { lados: new Map(), original: false }; memoria.set(k, m); }
    return m;
  };

  // Lo que hay ya en memoria para pintar ahora mismo, sin esperar:
  //   { url, basta }   url '' = aún nada; url null = la foto de siempre.
  function hecha(foto, lado) {
    if (!lado) return { url: null, basta: true };
    const m = memoria.get(claveDe(foto));
    if (!m) return { url: '', basta: false };
    if (m.original) return { url: null, basta: true };
    const e = eligeHecha(m.lados, lado);
    return e ? { url: m.lados.get(e.lado), basta: e.basta } : { url: '', basta: false };
  }

  // ── El almacén (IndexedDB) ──
  let dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise((res) => {
      try {
        const r = indexedDB.open('odinote-miniaturas', 1);
        r.onupgradeneeded = () => { try { r.result.createObjectStore('mini'); } catch (e) {} };
        r.onsuccess = () => {
          const d = r.result;
          // Sin límite crecería para siempre con las fotos que ya no están en
          // ningún proyecto; vaciarlo de vez en cuando cuesta rehacer las que
          // se vean, nada más.
          try {
            const q = d.transaction('mini').objectStore('mini').count();
            q.onsuccess = () => {
              if (q.result > TOPE_GUARDADAS) { try { d.transaction('mini', 'readwrite').objectStore('mini').clear(); } catch (e) {} }
            };
          } catch (e) {}
          res(d);
        };
        r.onerror = () => res(null);
        r.onblocked = () => res(null);
      } catch (e) { res(null); }
    });
    return dbP;
  }
  async function leeGuardada(k) {
    const d = await db();
    if (!d) return null;
    return new Promise((res) => {
      try {
        const q = d.transaction('mini').objectStore('mini').get(k);
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  async function guarda(k, blob) {
    const d = await db();
    if (!d) return;
    try { d.transaction('mini', 'readwrite').objectStore('mini').put(blob, k); } catch (e) {}
  }

  // ── Fabricar una copia ──
  const fuentes = (foto) => {
    const a = window.displayMediaSrc ? window.displayMediaSrc(foto) : foto.src;
    const b = window.resolveMediaSrc ? window.resolveMediaSrc(foto.src) : foto.src;
    return a === b ? [a] : [a, b];
  };
  async function leeFoto(foto) {
    let ultimo = null;
    for (const url of fuentes(foto)) {
      try {
        const r = await fetch(url);
        if (r.ok) return await r.blob();
        ultimo = new Error('HTTP ' + r.status);
      } catch (e) { ultimo = e; }
    }
    throw ultimo || new Error('sin foto');
  }
  async function fabrica(foto, lado) {
    const blob = await leeFoto(foto);
    if (/gif|svg/i.test(blob.type || '')) return null;
    const fw = foto.w, fh = foto.h;
    let bmp;
    if (fw > 0 && fh > 0) {
      const f = lado / Math.max(fw, fh);
      bmp = await createImageBitmap(blob, {
        resizeWidth: Math.max(1, Math.round(fw * f)),
        resizeHeight: Math.max(1, Math.round(fh * f)),
        resizeQuality: 'high',
      });
    } else {
      const entera = await createImageBitmap(blob);
      const f = lado / Math.max(entera.width, entera.height);
      if (f >= 1) { entera.close(); return null; }
      bmp = await createImageBitmap(entera, {
        resizeWidth: Math.max(1, Math.round(entera.width * f)),
        resizeHeight: Math.max(1, Math.round(entera.height * f)),
        resizeQuality: 'high',
      });
      entera.close();
    }
    try {
      const lienzo = new OffscreenCanvas(bmp.width, bmp.height);
      lienzo.getContext('2d').drawImage(bmp, 0, 0);
      let sale = await lienzo.convertToBlob({ type: 'image/webp', quality: 0.82 });
      if (!/webp/.test(sale.type)) sale = await lienzo.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
      return sale;
    } finally {
      bmp.close();
    }
  }

  function siguiente() {
    while (activos < A_LA_VEZ && cola.length) {
      const tarea = cola.shift();
      activos++;
      tarea().finally(() => { activos--; siguiente(); });
    }
  }

  // Pide la copia de una foto para un lado. Devuelve la url (blob:), o null
  // si hay que pintar la foto de siempre. Nunca falla: si algo sale mal, null.
  function pide(foto, lado) {
    if (!lado || !foto || !foto.src) return Promise.resolve(null);
    const k = claveDe(foto);
    const ya = hecha(foto, lado);
    if (ya.basta) return Promise.resolve(ya.url);
    const id = lado + '|' + k;
    if (enCurso.has(id)) return enCurso.get(id);
    const m = deFoto(k);
    const p = (async () => {
      // Primero el almacén, que no hace cola: al volver a abrir un proyecto
      // salen todas casi a la vez.
      const guardada = await leeGuardada(id);
      if (guardada) {
        const url = URL.createObjectURL(guardada);
        m.lados.set(lado, url);
        return url;
      }
      return new Promise((res) => {
        cola.push(async () => {
          try {
            const blob = await fabrica(foto, lado);
            if (!blob) { m.original = true; res(null); return; }
            const url = URL.createObjectURL(blob);
            m.lados.set(lado, url);
            guarda(id, blob);
            res(url);
          } catch (e) {
            m.original = true;
            res(null);
          }
        });
        siguiente();
      });
    })().finally(() => enCurso.delete(id));
    enCurso.set(id, p);
    return p;
  }

  // Un solo vigilante para todo lo que quiere saber si está cerca de verse
  // (una galería en el lienzo, una miniatura del visor o del panel): con
  // cientos de fotos, uno por foto sería otro montón de trabajo.
  let vigia = null;
  const avisos = new Map();
  function observa(el, cb) {
    if (!el) return () => {};
    if (typeof IntersectionObserver === 'undefined') { cb(true); return () => {}; }
    if (!vigia) {
      vigia = new IntersectionObserver((entradas) => {
        entradas.forEach(e => { const f = avisos.get(e.target); if (f) f(e.isIntersecting); });
      }, { rootMargin: '300px' });
    }
    avisos.set(el, cb);
    vigia.observe(el);
    return () => { avisos.delete(el); if (vigia) vigia.unobserve(el); };
  }

  const GaleriaMinis = { LADOS, ladoPara, escalaRedonda, clave, claveDe, eligeHecha };
  if (enNavegador) Object.assign(GaleriaMinis, { hecha, pide, observa });
  if (typeof window !== 'undefined') window.GaleriaMinis = GaleriaMinis;
  if (typeof module !== 'undefined' && module.exports) module.exports = GaleriaMinis;
})();
