// =====================================================
// Odinote — un solo selector de color para toda la aplicación
//
// Antes había cinco paletas escritas a mano, cada una en su archivo y con su
// propio número de colores: doce para dibujar, ocho para las flechas, catorce
// para el texto del documento, ocho para el subrayado. Ninguna dejaba elegir un
// color que no estuviera en la lista, así que quien quería el azul de su marca
// no lo tenía y punto.
//
// Ahora es al revés: unos pocos colores buenos a mano y una casilla que abre el
// selector del sistema. Cuatro y no doce a propósito — una fila de doce
// círculos parecidos obliga a comparar, y comparar cuesta más que elegir.
//
// La única excepción es el fondo del lienzo, que se queda con sus temas: ahí el
// color no es una decisión de quien escribe, es la piel del programa.
//
// Y desde el 17 de octubre de 2026, «el resto» ya no es la ventana de colores
// de Windows: es un panel propio (PanelColorLibre, más abajo), el mismo en el
// ordenador, la web y el teléfono. La ventana del sistema tapaba este panel, se
// llevaba la selección del texto, no dejaba escribir un código y en Android ni
// funcionaba.
// =====================================================

// Los cuatro de trazo: tinta, vino, oliva y azul. Son los de la propia
// aplicación, así que un tablero pintado con ellos sigue pareciendo Oddinote.
window.COLORES_ODINOTE = ['#1A1A1A', '#E6544F', '#90B968', '#3D5A80'];

// Los cuatro de subrayar. Van aparte porque un marcador tiene que dejar leer lo
// que hay debajo: los de arriba tapan el texto y no valen aquí.
window.COLORES_ODINOTE_SUAVES = ['#FFF3A3', '#FFC7C2', '#CFEFD6', '#CDE9FF'];

// El blanco va el primero de los de fondo. Sin él no hay forma de devolver una
// nota a su aspecto normal: el más claro sería un crema y la nota se quedaría
// amarilleando para siempre.
window.COLORES_ODINOTE_FONDO = ['#FFFFFF', '#F7DA84', '#FBDFDD', '#E8F0DA'];

// Los del cursor de quien invita a un café. El dorado va PRIMERO y no es
// decoración del orden: es el que se anuncia en la propia ventana —"el cursor
// dorado"— y hasta ahora no estaba en ninguna casilla, así que quien pagaba por
// él tenía que ir a buscarlo a la rueda del sistema y acertar el tono a ojo.
// Detrás, blanco para los lienzos oscuros y dos de la casa. El cuerpo de la
// flecha es oscuro y el color elegido es su borde, así que aquí no valen los
// tonos que se confunden con ese cuerpo.
window.COLORES_ODINOTE_CURSOR = ['#E0A82E', '#FFFFFF', '#E6544F', '#3D5A80'];

// Y los de una flecha: negro y blanco, nada más. Sobre el lienzo claro se ve el
// negro y sobre el oscuro el blanco, y con eso está casi todo resuelto; el resto
// está en el arcoíris. Además su barra lateral es estrecha y no caben más.
window.COLORES_ODINOTE_FLECHA = ['#1A1A1A', '#FFFFFF'];

// ── Los últimos que se usaron ──
//
// Quien se sale de la paleta casi siempre lo hace por algo suyo: el color de su
// marca, el de su juego. Y lo va a querer otra vez dentro de dos minutos, en
// otro nodo. Sin esto tendría que volver a buscarlo en la rueda cada vez, y
// acertar el mismo tono a ojo no se puede.
//
// Se guardan en el equipo y no en el proyecto: son una costumbre de quien
// trabaja, no parte del tablero.
const CLAVE_RECIENTES = 'odinote.colores.recientes';
const MAX_RECIENTES = 6;

function leeRecientes() {
  try {
    const crudo = localStorage.getItem(CLAVE_RECIENTES);
    const lista = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista.filter(c => typeof c === 'string').slice(0, MAX_RECIENTES) : [];
  } catch (e) {
    return [];
  }
}

function apuntaReciente(color) {
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return leeRecientes();
  const c = color.toLowerCase();
  const lista = [c, ...leeRecientes().filter(x => x.toLowerCase() !== c)].slice(0, MAX_RECIENTES);
  try { localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista)); } catch (e) {}
  return lista;
}
// Para quien usa el panel sin pasar por SelectorColor (el documento).
window.odiLeeRecientes = leeRecientes;
window.odiApuntaReciente = apuntaReciente;

// =====================================================
// El panel de color propio (la propuesta C, elegida el 17 de octubre)
//
// Sustituye a la ventana de colores de Windows, que tapaba el panel, se llevaba
// la selección del texto, no admitía códigos y en el teléfono ni existía. Aquí:
// una rueda de tono con el cuadro de saturación y brillo dentro, el
// cuentagotas, los recientes, los tres códigos (HEX, RGB y HSL) con su botón
// de copiar, y las paletas con nombre. Las cuentas viven en color-logica.js
// (window.OdiColor), sin React, con su prueba.
//
// Lo que se mueve en la rueda se va aplicando (es la única forma de acertar un
// tono) y se da por bueno al cerrar: con «Listo», pulsando fuera o volviendo a
// pulsar el arcoíris. Escape y «Antes» devuelven el color con el que se abrió.
// =====================================================

// ── Las paletas con nombre ──
// En el equipo, como los recientes: son una costumbre de quien trabaja y le
// sirven en cualquier proyecto. Para dejar una a la vista dentro de un tablero
// está el nodo de paleta (botón «Paleta» de la barra de una imagen).
const CLAVE_PALETAS = 'odinote.paletas';
const MAX_PALETAS = 40;
const MAX_COLORES_PALETA = 16;

function leePaletas() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_PALETAS) || '[]');
    if (!Array.isArray(lista)) return [];
    return lista.filter(p => p && typeof p.id === 'string' && Array.isArray(p.colores))
      .map(p => ({ id: p.id, nombre: String(p.nombre || ''), colores: p.colores.filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, MAX_COLORES_PALETA) }));
  } catch (e) {
    return [];
  }
}

function guardaPaletas(lista) {
  try { localStorage.setItem(CLAVE_PALETAS, JSON.stringify(lista.slice(0, MAX_PALETAS))); } catch (e) {}
  // Los paneles abiertos se enteran (puede haber más de uno: el de la barra y
  // el de un calendario, por ejemplo).
  try { window.dispatchEvent(new Event('odi-paletas')); } catch (e) {}
}

// Una paleta nueva, la primera de la lista. La usan el panel y el botón
// «Paleta» de las imágenes.
window.odiGuardaPaleta = function (nombre, colores) {
  const p = {
    id: 'pal-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e5).toString(36),
    nombre: String(nombre || '').slice(0, 60),
    colores: (colores || []).map(c => String(c).toUpperCase()).filter(c => /^#[0-9A-F]{6}$/.test(c)).slice(0, MAX_COLORES_PALETA),
  };
  guardaPaletas([p, ...leePaletas()]);
  return p;
};

// Los colores de una imagen, de una dirección que el navegador sepa pintar
// (media/…, blob:, data:). Se encoge a 64 px antes de mirarla: para saber qué
// colores pesan no hacen falta todos los píxeles, y una foto de 4.000 px
// tardaría un segundo entero.
window.odiPaletaDeImagen = async function (src, cuantos) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  const k = Math.min(1, 64 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * k));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * k));
  const lienzo = document.createElement('canvas');
  lienzo.width = w; lienzo.height = h;
  const cx = lienzo.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, w, h);
  return window.OdiColor.paletaDeImagen(cx.getImageData(0, 0, w, h).data, cuantos || 6);
};

// ── El cuentagotas cuando el navegador no trae uno ──
// Chromium (la aplicación y Chrome) tiene window.EyeDropper, que coge un color
// de cualquier punto de la pantalla. Firefox, Safari y el teléfono no: allí se
// toca una imagen del lienzo y se lee el píxel que hay debajo del dedo.
function cuentagotasDeLienzo() {
  return new Promise((resolve) => {
    document.body.classList.add('odi-cuentagotas');
    const acaba = (valor) => {
      document.removeEventListener('pointerdown', toca, true);
      document.removeEventListener('keydown', tecla, true);
      document.body.classList.remove('odi-cuentagotas');
      resolve(valor);
    };
    const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); acaba(null); } };
    const toca = (e) => {
      if (e.target.closest && e.target.closest('.panel-color')) return;
      e.preventDefault();
      e.stopPropagation();
      // El clic que sigue a este toque tampoco es para el lienzo.
      const tragaClic = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener('click', tragaClic, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', tragaClic, true), 600);
      let img = e.target.tagName === 'IMG' ? e.target : null;
      if (!img && e.target.closest) {
        const nodo = e.target.closest('.item, .col-child-wrap');
        img = nodo ? nodo.querySelector('img') : null;
      }
      if (!img || !img.naturalWidth) { acaba('nada'); return; }
      try {
        const r = img.getBoundingClientRect();
        const x = Math.min(img.naturalWidth - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * img.naturalWidth)));
        const y = Math.min(img.naturalHeight - 1, Math.max(0, Math.floor((e.clientY - r.top) / r.height * img.naturalHeight)));
        const lienzo = document.createElement('canvas');
        lienzo.width = 1; lienzo.height = 1;
        const cx = lienzo.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, x, y, 1, 1, 0, 0, 1, 1);
        const d = cx.getImageData(0, 0, 1, 1).data;
        acaba(window.OdiColor.rgbAHex({ r: d[0], g: d[1], b: d[2] }));
      } catch (err) {
        // Una imagen de otra web sin permiso para leerla «mancha» el lienzo.
        acaba('protegida');
      }
    };
    document.addEventListener('pointerdown', toca, true);
    document.addEventListener('keydown', tecla, true);
  });
}

const tostada = (es, en) => { if (window.showToast) window.showToast(window.t(es, en)); };

// incrustado: dentro del panel lateral (el de «Color de fondo», el del texto…)
// en vez de en una ventana aparte. Lo pidió el usuario al verlos juntos: dos
// selectores uno al lado del otro sobraban; queda solo el grande, con su
// historial y los colores de siempre como primera paleta. Ahí no hay «fuera»
// ni Escape que lo cierre: lo cierra el panel que lo contiene. Cada color que
// se da por bueno (soltar la rueda, Enter en un campo, una casilla) va al
// historial con onFin.
function PanelColorLibre({ valor, recientes, onVivo, onListo, onCancela, onFin, alTocar, ancla, enHoja, incrustado, paleta, incluirTransparente }) {
  const { useState, useRef, useEffect, useLayoutEffect } = React;
  const C = window.OdiColor;
  const deReserva = (paleta || []).find(c => C.hexARgb(c)) || '#1A1A1A';
  const deInicio = C.rgbAHex(C.hexARgb(C.hexARgb(valor || '') ? valor : deReserva));
  const esTransparente = valor === 'transparent' || valor === '';
  const antes = useRef(deInicio);
  // El color vive en HSV: es lo que dibujan la rueda (tono) y el cuadro
  // (saturación y brillo). Guardarlo en HEX perdería el tono de los grises:
  // al bajar el brillo a cero la rueda saltaría al rojo.
  const [hsv, setHsv] = useState(() => C.rgbAHsv(C.hexARgb(deInicio)));
  const hex = C.rgbAHex(C.hsvARgb(hsv));
  const hexRef = useRef(hex);
  hexRef.current = hex;

  // Lo que se arrastra se manda una vez por cuadro, no en cada movimiento del
  // ratón: así un paseo por la rueda no inunda el nodo de cambios.
  const pendiente = useRef(null);
  const manda = (h) => {
    if (pendiente.current == null) {
      requestAnimationFrame(() => {
        const c = pendiente.current;
        pendiente.current = null;
        if (c) onVivo(c);
      });
    }
    pendiente.current = h;
  };
  // El último color puesto, al momento (hexRef espera a que se pinte).
  const ultimo = useRef(deInicio);
  const termina = (c) => { if (onFin && c) onFin(c); };
  const ponHsv = (n) => { setHsv(n); ultimo.current = C.rgbAHex(C.hsvARgb(n)); manda(ultimo.current); };
  // Un color que llega hecho (campo, reciente, paleta, cuentagotas). Si es un
  // gris, el tono de la rueda se queda donde estaba.
  const ponHex = (h) => {
    const rgb = C.hexARgb(h);
    if (!rgb) return;
    const n = C.rgbAHsv(rgb);
    if (n.s < 0.5 || n.v < 0.5) n.h = hsv.h;
    setHsv(n);
    ultimo.current = C.rgbAHex(rgb);
    manda(ultimo.current);
  };

  // ── Los campos ──
  // Se escriben a gusto y se aplican con Enter o al salir; Escape devuelve lo
  // que había. Mientras se escribe en uno, los otros siguen al color.
  const [campos, setCampos] = useState(() => C.textos(deInicio));
  const escribiendo = useRef(null);
  useEffect(() => {
    const t = C.textos(hex);
    setCampos(prev => {
      if (!escribiendo.current) return t;
      const n = { hex: t.hex, rgb: t.rgb, hsl: t.hsl, copia: t.copia };
      n[escribiendo.current] = prev[escribiendo.current];
      return n;
    });
  }, [hex]);
  const aplicaCampo = (clave) => {
    const leido = C.lee(campos[clave], clave);
    escribiendo.current = null;
    if (leido) { ponHex(C.rgbAHex(leido)); termina(C.rgbAHex(leido)); }
    else setCampos(C.textos(hexRef.current));
  };
  const copia = async (clave) => {
    const texto = C.textos(hex).copia[clave];
    try {
      await navigator.clipboard.writeText(texto);
      tostada('Copiado: ' + texto, 'Copied: ' + texto);
    } catch (e) {
      tostada('No se pudo copiar: ' + texto, 'Could not copy: ' + texto);
    }
  };

  // ── La rueda y el cuadro ──
  // Un solo elemento recibe el puntero y decide al pulsar qué se arrastra: el
  // aro (tono) o el cuadro (saturación y brillo). Medidas en px del panel.
  const RUEDA = enHoja ? 220 : 180;
  const GROSOR = enHoja ? 22 : 18;
  const CUADRO = Math.round((RUEDA - 2 * GROSOR - 10) / Math.SQRT2);
  const ruedaRef = useRef(null);
  const arrastre = useRef(null);
  const desdePuntero = (e, que) => {
    const r = ruedaRef.current.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    if (que === 'tono') {
      let h = Math.atan2(x, -y) * 180 / Math.PI;
      if (h < 0) h += 360;
      ponHsv({ h, s: hsvRef.current.s, v: hsvRef.current.v });
      return;
    }
    const lado = CUADRO * (r.width / RUEDA);
    const s = Math.min(100, Math.max(0, (x + lado / 2) / lado * 100));
    const v = Math.min(100, Math.max(0, 100 - (y + lado / 2) / lado * 100));
    ponHsv({ h: hsvRef.current.h, s, v });
  };
  // ponHsv lee hsv del render en curso: durante un arrastre hay que leer el
  // último, o el tono y el cuadro se pisarían uno a otro.
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const alPulsar = (e) => {
    e.preventDefault();
    const r = ruedaRef.current.getBoundingClientRect();
    const k = r.width / RUEDA;
    const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    const d = Math.hypot(x, y);
    const medio = CUADRO * k / 2;
    let que = null;
    if (Math.abs(x) <= medio + 4 && Math.abs(y) <= medio + 4) que = 'cuadro';
    else if (d >= (RUEDA / 2 - GROSOR - 6) * k && d <= (RUEDA / 2 + 4) * k) que = 'tono';
    if (!que) return;
    // El negro, el blanco y los grises no tienen tono: mover el aro desde ahí
    // no cambiaba nada, y con el texto negro de siempre parecía roto. Al coger
    // el aro desde un color así se le da saturación y brillo para que el tono
    // se vea en el acto.
    const actual = hsvRef.current;
    if (que === 'tono' && (actual.s < 8 || actual.v < 15)) {
      hsvRef.current = { h: actual.h, s: Math.max(actual.s, 80), v: Math.max(actual.v, 80) };
    }
    arrastre.current = que;
    try { ruedaRef.current.setPointerCapture(e.pointerId); } catch (err) {}
    desdePuntero(e, que);
  };
  const alMover = (e) => { if (arrastre.current) desdePuntero(e, arrastre.current); };
  const alSoltar = () => {
    if (!arrastre.current) return;
    arrastre.current = null;
    termina(ultimo.current);
  };
  // Con el teclado: flechas en la rueda (tono) y en el cuadro (saturación y brillo).
  const teclaRueda = (e, que) => {
    const paso = e.shiftKey ? 10 : 1;
    const n = { h: hsv.h, s: hsv.s, v: hsv.v };
    if (que === 'tono') {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') n.h = (n.h + paso) % 360;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') n.h = (n.h - paso + 360) % 360;
      else return;
    } else {
      if (e.key === 'ArrowRight') n.s = Math.min(100, n.s + paso);
      else if (e.key === 'ArrowLeft') n.s = Math.max(0, n.s - paso);
      else if (e.key === 'ArrowUp') n.v = Math.min(100, n.v + paso);
      else if (e.key === 'ArrowDown') n.v = Math.max(0, n.v - paso);
      else return;
    }
    e.preventDefault();
    ponHsv(n);
  };

  // ── El cuentagotas ──
  const [conGotero, setConGotero] = useState(false);
  const cuentagotas = async () => {
    if (window.EyeDropper) {
      try {
        const r = await new window.EyeDropper().open();
        if (r && r.sRGBHex) {
          const h = r.sRGBHex.length === 7 ? r.sRGBHex : C.rgbAHex(C.lee(r.sRGBHex, 'rgb') || { r: 0, g: 0, b: 0 });
          ponHex(h);
          termina(C.rgbAHex(C.hexARgb(h)));
        }
      } catch (e) { /* Escape: no se cogió nada */ }
      return;
    }
    setConGotero(true);
    tostada('Toca una imagen del lienzo para coger su color (Escape para dejarlo).', 'Tap an image on the canvas to pick its colour (Escape to stop).');
    const r = await cuentagotasDeLienzo();
    setConGotero(false);
    if (r === 'nada') tostada('Ahí no hay ninguna imagen.', 'There is no image there.');
    else if (r === 'protegida') tostada('Esa imagen no deja leer sus colores.', 'That image does not let its colours be read.');
    else if (r) { ponHex(r); termina(r); }
  };

  // ── Las paletas ──
  const [paletas, setPaletas] = useState(leePaletas);
  const [renombrando, setRenombrando] = useState(null);
  const nombreRef = useRef(null);
  const [borrando, setBorrando] = useState(null);
  useEffect(() => {
    const al = () => setPaletas(leePaletas());
    window.addEventListener('odi-paletas', al);
    return () => window.removeEventListener('odi-paletas', al);
  }, []);
  const cambiaPaletas = (f) => { const n = f(leePaletas()); guardaPaletas(n); setPaletas(n); };
  const nuevaPaleta = () => {
    const p = window.odiGuardaPaleta(window.t('Paleta ', 'Palette ') + (paletas.length + 1), [hex]);
    setPaletas(leePaletas());
    setRenombrando(p.id);
  };
  const anadeA = (id) => cambiaPaletas(l => l.map(p => (p.id !== id || p.colores.includes(hex) || p.colores.length >= MAX_COLORES_PALETA) ? p : { id: p.id, nombre: p.nombre, colores: [...p.colores, hex] }));
  const quitaDe = (id, c) => cambiaPaletas(l => l.map(p => p.id !== id ? p : { id: p.id, nombre: p.nombre, colores: p.colores.filter(x => x !== c) }));
  const renombra = (id, nombre) => { cambiaPaletas(l => l.map(p => p.id !== id ? p : { id: p.id, nombre: nombre.slice(0, 60), colores: p.colores })); setRenombrando(null); };
  const borra = (id) => { cambiaPaletas(l => l.filter(p => p.id !== id)); setBorrando(null); };

  const archivoRef = useRef(null);
  const deImagen = async (archivo) => {
    if (!archivo) return;
    const url = URL.createObjectURL(archivo);
    try {
      const colores = await window.odiPaletaDeImagen(url, 6);
      if (!colores.length) { tostada('En esa imagen no hay colores que sacar.', 'There are no colours to take from that image.'); return; }
      const nombre = String(archivo.name || '').replace(/\.[^.]+$/, '') || window.t('imagen', 'image');
      window.odiGuardaPaleta(window.t('De ', 'From ') + nombre, colores);
      setPaletas(leePaletas());
      tostada('Paleta sacada de la imagen.', 'Palette taken from the image.');
    } catch (e) {
      tostada('No se pudo leer esa imagen.', 'Could not read that image.');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  // ── Dónde va ──
  // En el ordenador, pegado al lado del panel donde está el arcoíris (el de la
  // barra del nodo, el del texto…), a la derecha si cabe y si no a la
  // izquierda, y sin salirse de la ventana. En el teléfono va dentro de la
  // hoja de abajo, y de colocarlo se encarga ella.
  const panelRef = useRef(null);
  const [sitio, setSitio] = useState(null);
  useLayoutEffect(() => {
    if (enHoja || incrustado) return;
    const coloca = () => {
      const el = panelRef.current;
      if (!el || !ancla) return;
      const caja = (ancla.closest && ancla.closest('.ctx-popout, .ctx-sidebar, .text-sidebar, .tfs-panel, .cal-color-pop, .modal, [role="dialog"]')) || ancla;
      const rc = caja.getBoundingClientRect(), rb = ancla.getBoundingClientRect();
      const w = el.offsetWidth, h = el.offsetHeight;
      const W = window.innerWidth, H = window.innerHeight;
      let left = rc.right + 10;
      if (left + w > W - 8) left = rc.left - w - 10;
      if (left < 8) left = Math.max(8, Math.min(W - w - 8, rb.left));
      let top = rb.top - 60;
      top = Math.max(8, Math.min(top, H - h - 8));
      setSitio({ left, top });
    };
    coloca();
    window.addEventListener('resize', coloca);
    return () => window.removeEventListener('resize', coloca);
  }, [ancla, enHoja, incrustado]);

  // ── Cerrar ──
  const listoRef = useRef(onListo);
  listoRef.current = onListo;
  const cancelaRef = useRef(onCancela);
  cancelaRef.current = onCancela;
  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== 'Escape' || conGotero) return;
      // En un campo, Escape solo deshace lo escrito en él.
      if (e.target && e.target.closest && e.target.closest('.panel-color input')) return;
      e.stopPropagation();
      cancelaRef.current();
    };
    document.addEventListener('keydown', tecla, true);
    // En la hoja del teléfono y dentro de un panel lateral, Escape sí (devuelve
    // el color), pero pulsar fuera no cierra nada: lo cierra quien lo contiene.
    if (enHoja || incrustado) return () => document.removeEventListener('keydown', tecla, true);
    const fuera = (e) => {
      if (conGotero) return;
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      if (ancla && ancla.contains(e.target)) return;
      listoRef.current(hexRef.current);
    };
    document.addEventListener('pointerdown', fuera, true);
    return () => {
      document.removeEventListener('keydown', tecla, true);
      document.removeEventListener('pointerdown', fuera, true);
    };
  }, [ancla, enHoja, incrustado, conGotero]);

  // Que nada de lo que pasa aquí dentro llegue al lienzo: el panel se pinta en
  // el body, pero React pasa los eventos por el árbol de componentes, y el
  // lienzo entendería un clic aquí como un clic en el vacío (y soltaría el nodo).
  // Y que un clic en una casilla no le quite el foco al texto que se colorea.
  const aislado = {
    onMouseDown: (e) => {
      e.stopPropagation();
      // Antes de que un campo se quede el foco: quien colorea texto apunta aquí
      // su selección para poder devolverla.
      if (alTocar) alTocar();
      if (!(e.target.closest && e.target.closest('input'))) e.preventDefault();
    },
    onPointerDown: (e) => e.stopPropagation(),
    onClick: (e) => e.stopPropagation(),
    onDoubleClick: (e) => e.stopPropagation(),
    onKeyDown: (e) => e.stopPropagation(),
    onWheel: (e) => e.stopPropagation(),
    onContextMenu: (e) => e.stopPropagation(),
  };

  const casilla = (c, extra) => (
    <button
      key={c + (extra && extra.clave ? extra.clave : '')}
      type="button"
      className={`panel-color-casilla ${c === hex ? 'activa' : ''}`}
      style={{ background: c }}
      title={(extra && extra.titulo) || c}
      aria-label={c}
      onClick={() => { ponHex(c); termina(c); }}
      onContextMenu={extra && extra.alQuitar ? (e) => { e.preventDefault(); extra.alQuitar(); } : undefined}
    />
  );

  const fila = (clave, etiqueta) => (
    <div className="panel-color-fila" key={clave}>
      <span className="panel-color-etiqueta">{etiqueta}</span>
      <input
        className="panel-color-campo"
        value={campos[clave]}
        spellCheck={false}
        aria-label={etiqueta}
        onFocus={(e) => { escribiendo.current = clave; e.target.select(); }}
        onChange={(e) => { const v = e.target.value; setCampos(prev => { const n = { hex: prev.hex, rgb: prev.rgb, hsl: prev.hsl, copia: prev.copia }; n[clave] = v; return n; }); }}
        onBlur={() => aplicaCampo(clave)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
          else if (e.key === 'Escape') { escribiendo.current = null; setCampos(C.textos(hexRef.current)); e.target.blur(); }
        }}
      />
      <button type="button" className="panel-color-icono" onClick={() => copia(clave)}
        title={window.t('Copiar ', 'Copy ') + C.textos(hex).copia[clave]} aria-label={window.t('Copiar ', 'Copy ') + etiqueta}>
        <span className="material-symbols-rounded">content_copy</span>
      </button>
    </div>
  );

  const tonoPuro = C.rgbAHex(C.hsvARgb({ h: hsv.h, s: 100, v: 100 }));
  const angulo = hsv.h * Math.PI / 180;
  const radioAro = RUEDA / 2 - GROSOR / 2;

  const cuerpo = (
    <div
      ref={panelRef}
      className={`panel-color ${enHoja ? 'en-hoja' : ''} ${incrustado ? 'incrustado' : ''}`}
      style={(enHoja || incrustado) ? undefined : { left: sitio ? sitio.left : -9999, top: sitio ? sitio.top : 0, visibility: sitio ? 'visible' : 'hidden' }}
      role="dialog"
      aria-label={window.t('Elegir un color', 'Pick a colour')}
      {...aislado}
    >
      <div className="panel-color-izq">
        <div
          ref={ruedaRef}
          className="panel-color-rueda"
          style={{ width: RUEDA, height: RUEDA }}
          onPointerDown={alPulsar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          <div className="panel-color-aro" style={{ WebkitMask: `radial-gradient(circle, transparent ${RUEDA / 2 - GROSOR - 1}px, #000 ${RUEDA / 2 - GROSOR}px)`, mask: `radial-gradient(circle, transparent ${RUEDA / 2 - GROSOR - 1}px, #000 ${RUEDA / 2 - GROSOR}px)` }} />
          <div className="panel-color-aro-borde" style={{ inset: GROSOR }} />
          <div
            className="panel-color-cuadro"
            tabIndex={0}
            role="slider"
            aria-label={window.t('Saturación y brillo', 'Saturation and brightness')}
            aria-valuetext={`${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%`}
            onKeyDown={(e) => teclaRueda(e, 'cuadro')}
            style={{
              width: CUADRO, height: CUADRO,
              background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, ${tonoPuro})`,
            }}
          >
            <i className="panel-color-mira" style={{ left: hsv.s + '%', top: (100 - hsv.v) + '%', background: hex }} />
          </div>
          <i
            className="panel-color-mira aro"
            tabIndex={0}
            role="slider"
            aria-label={window.t('Tono', 'Hue')}
            aria-valuenow={Math.round(hsv.h)}
            onKeyDown={(e) => teclaRueda(e, 'tono')}
            style={{ left: RUEDA / 2 + Math.sin(angulo) * radioAro, top: RUEDA / 2 - Math.cos(angulo) * radioAro, background: tonoPuro }}
          />
        </div>
        <div className="panel-color-bajo-rueda">
          <button type="button" className={`panel-color-icono gotero ${conGotero ? 'activo' : ''}`} onClick={cuentagotas}
            title={window.t('Cuentagotas: coger un color de la pantalla', 'Eyedropper: pick a colour from the screen')}
            aria-label={window.t('Cuentagotas', 'Eyedropper')}>
            <span className="material-symbols-rounded">colorize</span>
          </button>
          <span className="panel-color-gotero-texto">{window.t('Cuentagotas', 'Eyedropper')}</span>
        </div>
      </div>

      <div className="panel-color-der">
        <div className="panel-color-arriba">
          <button type="button" className="panel-color-antes" style={{ background: antes.current }}
            onClick={() => ponHex(antes.current)}
            title={window.t('Antes: ', 'Before: ') + antes.current + window.t(' (pulsa para volver a él)', ' (click to go back to it)')}>
            <span style={{ color: C.luminancia(antes.current) > 0.45 ? '#1A1A1A' : '#FFFFFF' }}>{window.t('Antes', 'Before')}</span>
          </button>
          <span className="panel-color-ahora" style={{ background: hex }}>
            <span style={{ color: C.luminancia(hex) > 0.45 ? '#1A1A1A' : '#FFFFFF' }}>{window.t('Ahora', 'Now')}</span>
          </span>
          {/* En la hoja del teléfono no: abajo ya está «Aceptar», a todo lo
              ancho, y dos botones que hacen lo mismo hacían dudar. */}
          {!enHoja && (
            <button type="button" className="panel-color-listo" onClick={() => onListo && onListo(ultimo.current)}>
              {window.t('Listo', 'Done')}
            </button>
          )}
        </div>
        {fila('hex', 'HEX')}
        {fila('rgb', 'RGB')}
        {fila('hsl', 'HSL')}

        {/* El historial: los últimos que se usaron, en cualquier nodo. */}
        <div className="panel-color-tit">{window.t('Historial', 'History')}</div>
        <div className="panel-color-historial">
          {(recientes || []).length
            ? (recientes || []).slice(0, 10).map(c => casilla(c.toUpperCase(), { clave: '-r' }))
            : <span className="panel-color-vacio">{window.t('Aquí salen los últimos que uses.', 'The last ones you use show up here.')}</span>}
        </div>

        <div className="panel-color-tit">{window.t('Paletas', 'Palettes')}</div>
        <div className="panel-color-paletas">
          {/* Los de siempre de este sitio (los de fondo, los de texto…), y «sin
              color» donde se puede quitar. No se borran ni se renombran. */}
          {((paleta && paleta.length) || incluirTransparente) && (
            <div className="panel-color-paleta fija">
              <span className="panel-color-nombre" title={window.t('Los de siempre', 'The usual ones')}>{window.t('Básicos', 'Basics')}</span>
              <div className="panel-color-paleta-casillas">
                {incluirTransparente && (
                  <button
                    type="button"
                    className={`panel-color-casilla sin-color ${esTransparente ? 'activa' : ''}`}
                    title={window.t('Sin color', 'No colour')}
                    aria-label={window.t('Sin color', 'No colour')}
                    onClick={() => { onVivo('transparent'); termina('transparent'); }}
                  />
                )}
                {(paleta || []).filter(c => C.hexARgb(c)).map(c => casilla(C.rgbAHex(C.hexARgb(c)), { clave: '-b' }))}
              </div>
            </div>
          )}
          {paletas.length === 0 && !incrustado && (
            <div className="panel-color-vacio">
              {window.t('Aún no hay paletas. «Nueva» guarda el color de ahora; «De imagen» saca los de una foto.',
                'No palettes yet. "New" keeps the current colour; "From image" takes them from a photo.')}
            </div>
          )}
          {paletas.map(p => (
            <div className="panel-color-paleta" key={p.id}>
              {renombrando === p.id ? (
                <span className="panel-color-nombre-caja">
                  <input
                    ref={nombreRef}
                    className="panel-color-nombre-campo"
                    autoFocus
                    defaultValue={p.nombre}
                    onFocus={(e) => e.target.select()}
                    onBlur={(e) => renombra(p.id, e.target.value.trim() || p.nombre)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
                      else if (e.key === 'Escape') { e.preventDefault(); setRenombrando(null); }
                    }}
                  />
                  {/* Pedido por el usuario: con Enter o pulsando fuera ya se
                      guardaba, pero no se veía cómo terminar. */}
                  <button
                    type="button"
                    className="panel-color-ok"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => renombra(p.id, ((nombreRef.current && nombreRef.current.value) || '').trim() || p.nombre)}
                  >
                    OK
                  </button>
                </span>
              ) : (
                <span className="panel-color-nombre" onDoubleClick={() => setRenombrando(p.id)}
                  title={window.t('Doble clic para cambiarle el nombre', 'Double-click to rename')}>{p.nombre}</span>
              )}
              <div className="panel-color-paleta-casillas">
                {p.colores.map(c => casilla(c, {
                  clave: '-' + p.id,
                  titulo: c + window.t(' · clic derecho para quitarlo', ' · right-click to remove it'),
                  alQuitar: () => quitaDe(p.id, c),
                }))}
                <button type="button" className="panel-color-mas" onClick={() => anadeA(p.id)}
                  title={window.t('Añadir el color de ahora', 'Add the current colour')} aria-label={window.t('Añadir el color de ahora', 'Add the current colour')}>
                  <span className="material-symbols-rounded">add</span>
                </button>
              </div>
              <button type="button" className={`panel-color-borra ${borrando === p.id ? 'seguro' : ''}`}
                onClick={() => (borrando === p.id ? borra(p.id) : setBorrando(p.id))}
                onMouseLeave={() => setBorrando(b => (b === p.id ? null : b))}
                title={borrando === p.id ? window.t('Pulsa otra vez para borrarla', 'Click again to delete it') : window.t('Borrar la paleta', 'Delete the palette')}
                aria-label={window.t('Borrar la paleta', 'Delete the palette')}>
                <span className="material-symbols-rounded">{borrando === p.id ? 'delete_forever' : 'delete'}</span>
              </button>
            </div>
          ))}
        </div>
        <div className="panel-color-botones">
          <button type="button" className="panel-color-boton verde" onClick={nuevaPaleta}>
            <span className="material-symbols-rounded">add</span>{window.t('Nueva', 'New')}
          </button>
          <button type="button" className="panel-color-boton" onClick={() => archivoRef.current && archivoRef.current.click()}>
            <span className="material-symbols-rounded">image</span>{window.t('De imagen', 'From image')}
          </button>
          <input ref={archivoRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; deImagen(f); }} />
        </div>
      </div>
    </div>
  );

  if (enHoja || incrustado || !window.ReactDOM || !window.ReactDOM.createPortal) return cuerpo;
  return window.ReactDOM.createPortal(cuerpo, document.body);
}
window.PanelColorLibre = PanelColorLibre;

window.SelectorColor = function SelectorColor({
  valor,
  onCambio,
  colores,
  tam = 24,
  incluirTransparente = false,
  etiquetaLibre,
  // Todo en una fila en vez de en tres. Lo pide quien tiene ancho y no altura.
  compacto = false,
  // El panel grande dentro del panel que lo contiene, sin los círculos de
  // siempre ni el arcoíris (ver PanelColorLibre, «incrustado»). Para los
  // paneles laterales, donde cabe; los sitios estrechos (la barra de una
  // flecha, la fila de la ruleta) se quedan con el arcoíris.
  entero = false,
  // El color del botón de aceptar. Verde en toda la aplicación; la ventana de
  // la corona lo pide dorado, porque allí el dorado es lo que se ha comprado.
  acento,
  acentoTexto,
}) {
  const { useRef, useState } = React;
  // El arcoíris: el panel se coloca a su lado y no se cierra al pulsarlo.
  const libreRef = useRef(null);
  const paleta = colores || window.COLORES_ODINOTE;

  // Con el dedo el panel va en una hoja abajo, a todo lo ancho (ver más abajo).
  const conDedo = typeof window !== 'undefined' && !!(window.odiIsMobile && window.odiIsMobile());
  const [ruedaAbierta, setRuedaAbierta] = useState(false);
  const [libreAbierto, setLibreAbierto] = useState(false);

  const [recientes, setRecientes] = useState(leeRecientes);
  // El color que había al abrir el panel grande: Escape vuelve a él.
  const alAbrirEntero = useRef(valor);

  // Mientras se mueve el panel el color se va aplicando —es la única forma de
  // acertar un tono— pero NO se da por bueno hasta cerrarlo, y por eso hay que
  // recordar de dónde se venía.
  //
  // Que la rueda no dé nada por bueno arregla además el historial. Los
  // navegadores avisan del cambio en cada movimiento del ratón, así que
  // apuntarlo ahí llenaba la lista con seis tonos casi idénticos del mismo
  // color: elegías un rojo y todo el historial se volvía rojo. Ahora un paseo
  // entero por la rueda deja una sola entrada, la que se acepta.
  const [eligiendo, setEligiendo] = useState(null);

  // ── Que no se pierda lo que hay seleccionado ──
  //
  // Dos cosas se lo llevan por delante. Pulsar una casilla le quita el foco al
  // texto, y eso se evita cancelando el mousedown. Pero escribir un código en el
  // panel pone el foco en su campo y la selección se va con él, así que hay que
  // apuntarla antes y devolverla justo antes de aplicar el color.
  //
  // Sin esto, elegir un color y escribir después salía del color de antes.
  const rango = useRef(null);

  const apuntaSeleccion = () => {
    try {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      // La de un campo del propio panel no es la del texto que se colorea.
      const n = r.commonAncestorContainer;
      const el = n && (n.nodeType === 1 ? n : n.parentElement);
      if (el && el.closest && el.closest('.panel-color')) return;
      rango.current = r.cloneRange();
    } catch (e) {}
  };
  // Con el panel ya abierto no hay un clic en el arcoíris que la apunte: se
  // apunta al aparecer.
  React.useEffect(() => { if (entero) apuntaSeleccion(); }, []);

  const devuelveSeleccion = () => {
    try {
      if (!rango.current) return;
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(rango.current);
    } catch (e) {}
  };

  const sinRobarFoco = (e) => { e.preventDefault(); apuntaSeleccion(); };

  const norm = (c) => (typeof c === 'string' ? c.trim().toLowerCase() : '');
  const actual = norm(valor);
  const enPaleta = paleta.some(c => norm(c) === actual) ||
                   (incluirTransparente && (actual === 'transparent' || actual === ''));

  const marco = (activo) => (activo ? '2.5px solid var(--wine)' : '1.5px solid var(--line-soft)');
  const redondo = { width: tam + 'px', height: tam + 'px', borderRadius: '50%', cursor: 'pointer', padding: 0 };

  // Elegir de la paleta o de los recientes es inmediato: no hay nada que
  // confirmar, ya se sabía qué color era antes de pulsarlo.
  const elige = (c) => {
    setEligiendo(null);
    setRecientes(apuntaReciente(c));
    devuelveSeleccion();
    onCambio(c);
  };

  // En fila con salto de línea, no en rejilla de ancho fijo. La barra lateral de
  // un conector mide 86 píxeles: con columnas fijas el contenido se salía del
  // panel y las casillas se apilaban de cualquier manera.
  const enFila = { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' };

  const enCurso = (c) => setEligiendo(prev => (
    prev === null ? { previo: valor || '#1A1A1A', actual: c } : { ...prev, actual: c }
  ));

  // ── Las casillas, cada una definida una sola vez ──
  //
  // Se sacan del return porque hay dos maneras de colocarlas —en filas o todas
  // seguidas— y lo que no puede haber es dos copias del mismo botón: la
  // siguiente vez que se toque una, se arregla en una y se queda rota en la
  // otra.

  // Los recientes van un poco más pequeños. No es adorno: así se distinguen de
  // la paleta cuando van pegados en la misma fila, sin necesidad de un rótulo.
  const casillaReciente = (c) => (
    <button
      key={'reciente-' + c}
      type="button"
      style={{
        width: (tam - 5) + 'px', height: (tam - 5) + 'px', borderRadius: '50%',
        padding: 0, cursor: 'pointer', background: c,
        border: norm(c) === actual ? '2px solid var(--wine)' : '1.5px solid var(--line-soft)',
      }}
      onMouseDown={sinRobarFoco}
      onClick={() => elige(c)}
      title={window.t('Usado hace poco: ', 'Used recently: ') + c}
      aria-label={c}
    />
  );

  const casillaNinguno = () => (
    <button
      key="ninguno"
      type="button"
      className="selector-color-ninguno"
      style={{ ...redondo, border: marco(actual === 'transparent' || actual === '') }}
      onMouseDown={sinRobarFoco}
      onClick={() => elige('transparent')}
      title={window.t('Sin color', 'No colour')}
      aria-label={window.t('Sin color', 'No colour')}
    />
  );

  const casillaPaleta = (c) => (
    <button
      key={c}
      type="button"
      style={{ ...redondo, background: c, border: marco(norm(c) === actual) }}
      onMouseDown={sinRobarFoco}
      onClick={() => elige(c)}
      title={c}
      aria-label={c}
    />
  );

  // Lo que se mueve en el panel se aplica al momento y NO se da por bueno: eso
  // lo hace cerrarlo (Listo, pulsar fuera o volver al arcoíris). Así un paseo
  // entero por la rueda deja una sola entrada en los recientes.
  const vivo = (c) => { enCurso(c); devuelveSeleccion(); onCambio(c); };
  const cierraLibre = (aceptando, c) => {
    setLibreAbierto(false);
    setRuedaAbierta(false);
    if (aceptando) {
      const final = c || (eligiendo && eligiendo.actual);
      if (final && (eligiendo || norm(final) !== actual)) elige(final);
      else setEligiendo(null);
      return;
    }
    // Sin aceptar (Escape, la X de la hoja, tocar fuera de la hoja) se
    // deshace: quien cierra así no quiere quedarse con lo que probaba.
    if (eligiendo) {
      const previo = eligiendo.previo;
      setEligiendo(null);
      devuelveSeleccion();
      onCambio(previo);
    }
  };

  // El arcoíris: siempre arcoíris, tenga o no un color libre puesto. Si mostrara
  // el color elegido se confundiría con una casilla más de la paleta y dejaría
  // de leerse como "aquí hay más". Que esté elegido se ve por el aro, igual que
  // en las demás.
  const casillaLibre = () => (
    <button
      key="libre"
      ref={libreRef}
      type="button"
      className={`selector-color-libre ${(libreAbierto || ruedaAbierta) ? 'abierto' : ''}`}
      style={{
        ...redondo,
        position: 'relative',
        border: marco(!enPaleta || libreAbierto),
        background: 'conic-gradient(#E6544F, #DDAF2C, #90B968, #3CA59E, #3D5A80, #955BA5, #E6544F)',
      }}
      onMouseDown={sinRobarFoco}
      onClick={() => {
        if (conDedo) { setRuedaAbierta(true); return; }
        if (libreAbierto) cierraLibre(true);
        else setLibreAbierto(true);
      }}
      title={etiquetaLibre || window.t('Elegir otro color', 'Pick another colour')}
      aria-label={etiquetaLibre || window.t('Elegir otro color', 'Pick another colour')}
      aria-expanded={libreAbierto || ruedaAbierta}
    />
  );

  // ── En el teléfono: el panel en una hoja abajo y a todo lo ancho ──
  //
  // Primero la rueda del dedo vivía dentro del propio panel, y en el de un nodo
  // se veía bien. Pero el panel de una LÍNEA mide ochenta y pico píxeles: ahí no
  // cabía nada, se desbordaba el panel y ya no había manera ni de cerrarlo. Así
  // que va aparte, pegada abajo, que es donde los dedos llegan bien. Por un
  // portal al body a propósito: dentro del panel, cualquier antepasado con una
  // transformación la habría vuelto a encerrar.
  //
  // Y se cierra de tres maneras —Aceptar, la X, o tocando fuera—, porque el
  // fallo que más molestó no fue verla mal: fue no poder quitarla.
  const panelLibre = () => {
    if (!window.PanelColorLibre) return null;
    const Panel = window.PanelColorLibre;
    if (!conDedo) {
      if (!libreAbierto) return null;
      return (
        <Panel
          valor={valor}
          recientes={recientes}
          ancla={libreRef.current}
          onVivo={vivo}
          onListo={(c) => cierraLibre(true, c)}
          onCancela={() => cierraLibre(false)}
        />
      );
    }
    if (!ruedaAbierta || !window.ReactDOM || !window.ReactDOM.createPortal) return null;
    return window.ReactDOM.createPortal(
      <div
        className="odi-hoja-color-fondo"
        style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(20,18,26,0.42)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) { sinRobarFoco(e); cierraLibre(false); } }}
      >
        <div
          className="odi-hoja-color"
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            background: 'var(--paper, #FAF9F5)',
            borderTop: '1.5px solid var(--line)',
            borderRadius: '16px 16px 0 0',
            padding: ' 14px 14px calc(14px + env(safe-area-inset-bottom)) 14px',
            display: 'flex', flexDirection: 'column', gap: '10px',
            maxHeight: '88vh',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink, #1A1A1A)' }}>
              {window.t('Más colores', 'More colours')}
            </span>
            <button
              type="button"
              style={{
                width: '34px', height: '34px', borderRadius: '9px', padding: 0, lineHeight: 1,
                border: '1.5px solid var(--line-soft)', background: 'transparent',
                color: 'var(--ink-3, #595459)', fontSize: '18px', cursor: 'pointer',
              }}
              onMouseDown={sinRobarFoco}
              onClick={() => cierraLibre(false)}
              title={window.t('Cerrar', 'Close')}
              aria-label={window.t('Cerrar', 'Close')}
            >
              ×
            </button>
          </div>

          <div style={{ overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0 }}>
            <Panel
              enHoja
              valor={valor}
              recientes={recientes}
              onVivo={vivo}
              onListo={(c) => cierraLibre(true, c)}
              onCancela={() => cierraLibre(false)}
            />
          </div>

          <button
            type="button"
            style={{
              padding: '12px', borderRadius: '10px', border: 'none',
              background: acento || 'var(--olive, #6A8546)', color: acentoTexto || '#FFF',
              fontWeight: 700, fontSize: '13.5px', cursor: 'pointer',
            }}
            onMouseDown={sinRobarFoco}
            onClick={() => cierraLibre(true)}
          >
            {window.t('Aceptar', 'Accept')}
          </button>
        </div>
      </div>,
      document.body
    );
  };


  // ── Todo seguido, en una sola fila ──
  //
  // Para quien tiene ancho de sobra y ninguna prisa por la altura: una ventana,
  // no una barra lateral de 86 píxeles. Repartido en tres filas —recientes,
  // paleta, arcoíris— ninguna llegaba a la mitad del ancho y la ventana se
  // quedaba con un agujero al lado de los colores.
  //
  // ── Por qué el historial va a la DERECHA y con un reloj delante ──
  //
  // La primera versión de esta fila puso los recientes a la izquierda y los
  // separó de la paleta con una rayita de un píxel. No se entendía: la rayita
  // no se ve sobre fondo oscuro, y sin el rótulo que tenía en la versión de
  // tres filas, once círculos seguidos parecen una sola paleta larga. Quien la
  // usó dio por hecho que el historial era la parte de la derecha —la fija—,
  // eligió un color nuevo, vio que esa parte no cambiaba y concluyó que el
  // historial estaba roto. Funcionaba; no se veía.
  //
  // Ahora lo de siempre va primero, porque no cambia nunca, y detrás de una
  // separación de verdad viene el historial con un reloj delante. El color
  // recién elegido aparece justo después del reloj, que es donde se está
  // mirando al soltar la rueda.
  if (entero && !conDedo && window.PanelColorLibre) {
    const Panel = window.PanelColorLibre;
    return (
      <div className="selector-color-caja entero">
        <Panel
          incrustado
          valor={valor}
          recientes={recientes}
          paleta={paleta}
          incluirTransparente={incluirTransparente}
          alTocar={apuntaSeleccion}
          onVivo={(c) => { devuelveSeleccion(); onCambio(c); }}
          onFin={(c) => setRecientes(apuntaReciente(c))}
          onListo={(c) => {
            if (c && norm(c) !== actual) { devuelveSeleccion(); onCambio(c); }
            if (c) setRecientes(apuntaReciente(c));
            // El panel que lo contiene se cierra (lo escuchan las barras).
            try { window.dispatchEvent(new CustomEvent('odi-color-listo')); } catch (e) {}
          }}
          onCancela={() => {
            // Escape: se devuelve el color que había al abrir y se cierra.
            const antes = alAbrirEntero.current;
            if (antes && norm(antes) !== actual) { devuelveSeleccion(); onCambio(antes); }
            try { window.dispatchEvent(new CustomEvent('odi-color-listo')); } catch (e) {}
          }}
        />
      </div>
    );
  }

  if (compacto) {
    return (
      <div className="selector-color-caja" style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <div className="selector-color" style={enFila}>
          {incluirTransparente && casillaNinguno()}
          {paleta.map(casillaPaleta)}
          {casillaLibre()}

          {recientes.length > 0 && (
            <span
              className="selector-color-raya"
              aria-hidden="true"
              style={{ height: (tam + 2) + 'px' }}
            />
          )}
          {recientes.length > 0 && (
            <span
              className="material-symbols-rounded selector-color-reloj"
              title={window.t('Los últimos que usaste', 'The last ones you used')}
              aria-label={window.t('Los últimos que usaste', 'The last ones you used')}
            >
              schedule
            </span>
          )}
          {recientes.map(casillaReciente)}
        </div>
        {panelLibre()}
      </div>
    );
  }

  return (
    <div className="selector-color-caja" style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>

      {/* ── 1. Los últimos que usaste ── */}
      {recientes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3, #8E8A8E)' }}>
            {window.t('Los últimos que usaste', 'The last ones you used')}
          </div>
          <div className="selector-color-recientes" style={{ ...enFila, gap: '5px' }}>
            {recientes.map(casillaReciente)}
          </div>
        </div>
      )}

      {/* ── 2. Los de siempre ── */}
      <div className="selector-color" style={enFila}>
        {incluirTransparente && casillaNinguno()}
        {paleta.map(casillaPaleta)}
      </div>

      {/* ── 3. El arcoíris ── */}
      <div style={enFila}>
        {casillaLibre()}
      </div>
      {panelLibre()}
    </div>
  );
};
