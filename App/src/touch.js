// =====================================================
// Odinote — capa táctil y detección de pantalla pequeña
//
// Toda la interacción de la app (arrastrar nodos, tiradores de tamaño,
// conectores, marquesina, sliders…) está construida sobre `mousedown` más
// `window.mousemove` / `window.mouseup`. En un móvil esos eventos casi no
// llegan: el navegador solo emite eventos de ratón "de compatibilidad" para
// toques cortos, y los cancela en cuanto el dedo se mueve.
//
// En vez de reescribir las ~40 interacciones una por una, aquí traducimos un
// dedo a la secuencia de ratón equivalente. Los gestos que necesitan el estado
// del lienzo (paneo con un dedo sobre el lienzo vacío y zoom de pellizco) se
// resuelven en Canvas.jsx; este puente se aparta cuando los detecta.
// =====================================================

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // Detección: <html data-touch="1" data-mobile="1">
  // El CSS cuelga de estos atributos; el JS de window.odiIsMobile().
  // ─────────────────────────────────────────────────────────────
  const MOBILE_MAX_WIDTH = 860;   // móvil o ventana estrecha
  const TOUCH_MAX_WIDTH = 1180;   // tablet: táctil pero con sitio de sobra

  // ¿El aparato puede producir toques?
  //
  // Antes esto era solo `(pointer: coarse)`, y esa consulta mira ÚNICAMENTE el
  // puntero principal. Basta con que el navegador declare otra cosa —modo
  // escritorio, un ratón o un lápiz emparejados— para que dé `false` en un
  // teléfono, y entonces TODA esta capa se queda dormida: no hay puente
  // táctil, ni touch-action, ni puntos de conexión al seleccionar. Los toques
  // sueltos siguen funcionando porque los emula el navegador, pero arrastrar
  // no, que es exactamente el fallo que salía solo en el móvil real.
  // Preguntamos por capacidad, que es lo que de verdad importa aquí.
  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  const isCoarse = () =>
    typeof window.ontouchstart !== 'undefined' ||
    (navigator.maxTouchPoints || 0) > 0 ||
    mq('(any-pointer: coarse)') ||
    mq('(pointer: coarse)');
  const isNarrow = () => window.innerWidth <= MOBILE_MAX_WIDTH;
  // Un portátil táctil de 1920px no debe pasar a la disposición de móvil solo
  // por tener pantalla táctil: ahí la barra superior cabe de sobra. El puente
  // táctil de más abajo sí se activa en cualquier dispositivo táctil.
  const isMobile = () => isNarrow() || (isCoarse() && window.innerWidth <= TOUCH_MAX_WIDTH);

  function applyEnvFlags() {
    const html = document.documentElement;
    html.setAttribute('data-touch', isCoarse() ? '1' : '0');
    html.setAttribute('data-mobile', isMobile() ? '1' : '0');
    html.setAttribute('data-orient', window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape');
    // 100vh en móvil incluye la barra de URL, que aparece y desaparece: usamos
    // la altura real para que el lienzo no quede cortado por debajo.
    html.style.setProperty('--app-h', window.innerHeight + 'px');
  }

  applyEnvFlags();
  window.addEventListener('resize', applyEnvFlags);
  window.addEventListener('orientationchange', () => setTimeout(applyEnvFlags, 150));
  // En móvil el evento resize no siempre llega al mostrar/ocultar la barra de
  // URL o el teclado; visualViewport sí, y un ResizeObserver cubre el resto.
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', applyEnvFlags);
    window.visualViewport.addEventListener('scroll', applyEnvFlags);
  }
  if (window.ResizeObserver) {
    try { new ResizeObserver(applyEnvFlags).observe(document.documentElement); } catch (e) {}
  }
  if (window.matchMedia) {
    const mq = window.matchMedia('(orientation: portrait)');
    if (mq.addEventListener) mq.addEventListener('change', applyEnvFlags);
  }

  window.odiIsMobile = isMobile;
  window.odiIsTouch = isCoarse;

  // Capacidad no es lo mismo que uso: un portátil táctil con ratón puede hacer
  // las dos cosas. Para decidir cosas como "el doble toque NO entra a editar"
  // hace falta saber con qué se acaba de interactuar, no qué admite el aparato.
  window.odiLastInputWasTouch = false;
  document.addEventListener('touchstart', () => { window.odiLastInputWasTouch = true; }, { capture: true, passive: true });
  document.addEventListener('mousedown', (e) => {
    if (!e.odiSynthetic) window.odiLastInputWasTouch = false;
  }, true);

  // ─────────────────────────────────────────────────────────────
  // Candado del zoom del navegador mientras se escribe
  //
  // Aunque los campos ya no bajen de 16px, el navegador puede seguir
  // ampliando la página al enfocar algo pequeño (por ejemplo el texto de un
  // nodo con el lienzo alejado). Ese zoom no lo controla la app y deja al
  // usuario atrapado. Mientras hay un campo enfocado prohibimos ampliar; al
  // salir lo permitimos otra vez, para que nunca se quede encerrado.
  // ─────────────────────────────────────────────────────────────
  const VIEWPORT_FREE = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
  const VIEWPORT_LOCKED = VIEWPORT_FREE + ', maximum-scale=1.0';

  function setViewport(content) {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta && meta.getAttribute('content') !== content) meta.setAttribute('content', content);
  }

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  document.addEventListener('focusin', (e) => {
    if (isCoarse() && isEditable(e.target)) setViewport(VIEWPORT_LOCKED);
  }, true);
  document.addEventListener('focusout', () => {
    if (!isCoarse()) return;
    // Un respiro: al saltar de un campo a otro no queremos soltar y volver a
    // echar el candado en el mismo parpadeo.
    setTimeout(() => {
      if (!isEditable(document.activeElement)) setViewport(VIEWPORT_FREE);
    }, 80);
  }, true);

  // ─────────────────────────────────────────────────────────────
  // Diagnóstico remoto (SOLO en el servidor de pruebas de la red local)
  //
  // Un móvil no tiene devtools a mano, así que un fallo que solo pasa ahí es
  // imposible de describir más allá de "no funciona". Cuando la página se
  // sirve desde dev-server.js, le va mandando lo que ocurre —errores de JS y
  // el resumen de cada gesto— y aparece en la consola del PC. Servido desde
  // GitHub Pages este bloque no se activa: no manda nada a ninguna parte.
  // ─────────────────────────────────────────────────────────────
  // Solo el puerto de dev-server.js. Ojo: la app de escritorio también se
  // sirve desde 127.0.0.1 (main.js usa el puerto 38471), así que comprobar
  // "es una IP local" activaría esto DENTRO del ejecutable, mandando peticiones
  // a un buzón que allí no existe. El puerto lo deja fuera sin lugar a dudas.
  const isLocalDev = location.port === '4173' || /[?&]odidebug=1\b/.test(location.search);

  const logQueue = [];
  let logTimer = null;

  function sendLogs() {
    logTimer = null;
    if (!logQueue.length) return;
    const batch = logQueue.splice(0, logQueue.length);
    try {
      fetch('/__log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  function remoteLog(kind, text) {
    if (!isLocalDev) return;
    logQueue.push({ kind: kind, text: String(text).slice(0, 500) });
    if (!logTimer) logTimer = setTimeout(sendLogs, 400);
  }
  window.odiRemoteLog = remoteLog;

  if (isLocalDev) {
    window.addEventListener('error', (e) => {
      remoteLog('ERROR', (e.message || 'error') + ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?'));
    });
    window.addEventListener('unhandledrejection', (e) => {
      remoteLog('PROMESA', (e.reason && (e.reason.message || e.reason)) || 'rechazo sin motivo');
    });
    const origError = console.error;
    console.error = function () {
      try { remoteLog('console.error', Array.prototype.join.call(arguments, ' ')); } catch (err) {}
      return origError.apply(console, arguments);
    };
    remoteLog('INICIO', 'build ' + (window.ODINOTE_BUILD || '?') +
      ' · ' + window.innerWidth + 'x' + window.innerHeight +
      ' · táctil=' + isCoarse() + ' · maxTouchPoints=' + (navigator.maxTouchPoints || 0));
  }

  // ─────────────────────────────────────────────────────────────
  // Aviso de página ampliada
  //
  // Si el navegador ya arrastra un zoom guardado del sitio (Brave y Chrome lo
  // recuerdan por dominio, y borrar cookies NO lo borra), la interfaz se ve
  // gigante y parece que la app está rota. Arreglar la causa no deshace ese
  // zoom ya guardado, así que hay que decírselo al usuario: es lo único que
  // puede quitarlo él.
  // ─────────────────────────────────────────────────────────────
  function pageZoomFactor() {
    try {
      const sw = window.screen && window.screen.width;
      if (!sw || !window.innerWidth) return 1;
      return sw / window.innerWidth;
    } catch (e) { return 1; }
  }

  let zoomNoticeShown = false;
  function checkPageZoom() {
    if (zoomNoticeShown || !isCoarse()) return;
    // Solo en vertical: en horizontal screen.width sigue dando el lado corto
    // en bastantes móviles y saldría un falso positivo.
    if (window.innerHeight < window.innerWidth) return;
    // Un móvil al 100% nunca baja de ~320px de ancho lógico.
    if (!(pageZoomFactor() > 1.35 && window.innerWidth < 320)) return;

    zoomNoticeShown = true;
    const es = (navigator.language || 'en').toLowerCase().indexOf('es') === 0;
    const bar = document.createElement('div');
    bar.setAttribute('role', 'status');
    bar.style.cssText = [
      'position:fixed', 'left:8px', 'right:8px', 'bottom:8px', 'z-index:999998',
      'background:#232123', 'color:#F0EEF0', 'padding:12px 14px', 'border-radius:12px',
      'font:600 13px/1.45 system-ui,sans-serif', 'box-shadow:0 6px 24px rgba(0,0,0,.35)',
      'display:flex', 'gap:10px', 'align-items:flex-start',
    ].join(';');
    const text = document.createElement('div');
    text.style.flex = '1';
    text.textContent = es
      ? 'Tu navegador tiene esta página ampliada (' + Math.round(pageZoomFactor() * 100) + '%), por eso se ve todo gigante. Ponla al 100% en el menú ⋮ del navegador → Zoom.'
      : 'Your browser has this page zoomed in (' + Math.round(pageZoomFactor() * 100) + '%), which is why everything looks huge. Set it back to 100% from the browser ⋮ menu → Zoom.';
    const close = document.createElement('button');
    close.textContent = es ? 'Vale' : 'Got it';
    close.style.cssText = 'background:#90B968;color:#1A1A1A;border:0;border-radius:8px;padding:8px 12px;font:700 13px system-ui,sans-serif;flex:0 0 auto';
    close.onclick = () => bar.remove();
    bar.appendChild(text);
    bar.appendChild(close);
    (document.body || document.documentElement).appendChild(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(checkPageZoom, 1200));
  } else {
    setTimeout(checkPageZoom, 1200);
  }

  // ─────────────────────────────────────────────────────────────
  // Puente táctil → ratón
  // ─────────────────────────────────────────────────────────────

  // Controles que el navegador debe manejar él mismo: si les bloqueamos el
  // toque no reciben el foco, no sale el teclado y no se puede colocar el
  // cursor dentro de un texto en edición.
  // La capa de dibujo se maneja sola con eventos de puntero (que sí traen la
  // presión del lápiz). Si el puente la tocara, cada trazo se convertiría en
  // un arrastre de nodo.
  const NATIVE_SELECTOR =
    'input, textarea, select, option, [contenteditable="true"], [contenteditable=""], ' +
    'audio, video, iframe, .draw-layer, [data-native-touch]';

  const MOVE_THRESHOLD = 5;    // px antes de considerar que es un arrastre
  const LONG_PRESS_MS = 520;   // mantener pulsado = clic derecho
  const DOUBLE_TAP_MS = 380;
  const DOUBLE_TAP_DIST = 28;

  let drag = null;             // gesto de un dedo en curso
  let lastTap = null;          // { x, y, time } para detectar el doble toque
  let longPressTimer = null;

  // Diagnóstico del último gesto. Desde un móvil no hay consola, y sin esto la
  // única información disponible es "no funciona": no se puede saber si el
  // toque llegó, si el puente lo tomó o lo dejó pasar, ni si el navegador
  // permitió cancelarlo. Se ve tocando la etiqueta de versión en Ajustes.
  window.odiTouchDiag = 'aún no se ha tocado nada';
  let diag = null;
  const shortName = (el) => {
    if (!el || !el.tagName) return '?';
    const c = (el.className && el.className.toString ? el.className.toString() : '').trim().split(/\s+/)[0];
    return el.tagName.toLowerCase() + (c ? '.' + c : '');
  };
  // El mismo diagnóstico, pero A LA VISTA en la pantalla del teléfono.
  //
  // Estaba escondido detrás de tocar la etiqueta de versión en Ajustes, y por
  // eso nunca se leía: cuando algo no funciona con el dedo, lo último que se
  // hace es irse a Ajustes a buscar un texto. Ahora, con ?odidebug=1 en la
  // dirección, sale una franja abajo con lo que pasó en el último gesto, que
  // se puede leer o fotografiar sin salir de donde está el fallo.
  //
  // Solo en el servidor de pruebas: en la versión publicada esto no existe.
  let cinta = null;
  function pintaDiag(texto) {
    if (!isLocalDev) return;
    if (!cinta) {
      cinta = document.createElement('div');
      cinta.style.cssText = [
        'position:fixed', 'left:4px', 'right:4px', 'bottom:4px', 'z-index:999999',
        'background:rgba(20,18,20,.92)', 'color:#EDEBED', 'padding:6px 8px',
        'border-radius:8px', 'font:600 10px/1.35 ui-monospace,monospace',
        'pointer-events:none',   // jamás debe estorbar al gesto que mide
        'white-space:pre-wrap', 'word-break:break-word',
      ].join(';');
      (document.body || document.documentElement).appendChild(cinta);
    }
    cinta.textContent = 'táctil=' + (isCoarse() ? 'sí' : 'NO') +
      ' movil=' + (isMobile() ? 'sí' : 'no') + '\n' + texto;
  }

  const publishDiag = () => {
    if (!diag) return;
    window.odiTouchDiag =
      'sobre ' + diag.target +
      ' | puente ' + (diag.bridged ? 'SÍ' : 'NO (' + diag.skipReason + ')') +
      ' | movs ' + diag.moves +
      ' | cancelable ' + (diag.moves ? (diag.cancelable ? 'sí' : 'NO') : '-') +
      ' | ' + diag.outcome;
    pintaDiag(window.odiTouchDiag);
  };

  function closestEl(el, selector) {
    // SVGElement soporta closest en navegadores modernos, pero curamos el caso
    // de nodos de texto y de elementos ya desconectados del documento.
    let node = el;
    while (node && node.nodeType !== 1) node = node.parentNode;
    if (!node || !node.closest) return null;
    try { return node.closest(selector); } catch (e) { return null; }
  }

  // ¿El dedo cayó sobre una zona que ya tiene scroll propio y contenido de
  // sobra? Entonces el usuario quiere desplazarla, no arrastrar el nodo.
  function scrollableAncestor(el) {
    let node = el;
    while (node && node !== document.body && node.nodeType === 1) {
      const style = window.getComputedStyle(node);
      const oy = style.overflowY;
      const ox = style.overflowX;
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight - node.clientHeight > 4) return node;
      if ((ox === 'auto' || ox === 'scroll') && node.scrollWidth - node.clientWidth > 4) return node;
      node = node.parentNode;
    }
    return null;
  }

  // El lienzo vacío lo gobierna Canvas.jsx (un dedo = paneo). Con una
  // herramienta activa sí lo puenteamos, porque ahí arrastrar crea el nodo.
  function isBareCanvasSurface(el) {
    const wrap = closestEl(el, '.canvas-wrap');
    if (!wrap) return false;
    if (wrap.classList.contains('placing') || wrap.classList.contains('linking')) return false;
    if (el === wrap) return true;
    const cl = el.classList;
    if (!cl) return false;
    return cl.contains('canvas-surface') || cl.contains('canvas-content') ||
           cl.contains('connectors') || cl.contains('board-cover-grid');
  }

  function shouldSkip(el) {
    if (!el) return true;
    if (closestEl(el, NATIVE_SELECTOR)) return true;
    if (isBareCanvasSurface(el)) return true;
    return false;
  }

  // Tras un toque "diferido" emitimos nosotros la secuencia de ratón. Si el
  // navegador emite además la suya de compatibilidad, el botón se pulsaría dos
  // veces: nos la comemos durante un momento.
  function swallowCompatMouse() {
    const stop = (ev) => {
      if (ev.odiSynthetic) return;
      ev.stopImmediatePropagation();
      ev.preventDefault();
    };
    const types = ['mousedown', 'mouseup', 'click', 'dblclick'];
    types.forEach(t => document.addEventListener(t, stop, true));
    setTimeout(() => types.forEach(t => document.removeEventListener(t, stop, true)), 400);
  }

  function fireMouse(type, touch, target, detail) {
    const ev = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      detail: detail || 0,
      clientX: touch.clientX,
      clientY: touch.clientY,
      screenX: touch.screenX,
      screenY: touch.screenY,
      button: type === 'contextmenu' ? 2 : 0,
      buttons: (type === 'mouseup' || type === 'click' || type === 'dblclick') ? 0 : 1,
      ctrlKey: false, shiftKey: false, altKey: false, metaKey: false,
    });
    ev.odiSynthetic = true;
    target.dispatchEvent(ev);
    return ev;
  }

  // Elemento que hay bajo el dedo ahora mismo (puede no ser el del touchstart).
  function targetUnder(touch) {
    return document.elementFromPoint(touch.clientX, touch.clientY);
  }

  function findTouch(list, id) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === id) return list[i];
    }
    return null;
  }

  function clearLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }

  // Suelta el gesto sin producir clic (lo usamos cuando entra un segundo dedo
  // o cuando el pulsado largo ya abrió el menú contextual).
  function abortDrag() {
    clearLongPress();
    if (!drag) return;
    // Si era diferido nunca llegamos a emitir el mousedown, así que tampoco
    // hay que cerrar nada.
    if (!drag.deferred) fireMouse('mouseup', drag.last, drag.target);
    drag = null;
  }

  document.addEventListener('touchstart', (e) => {
    if (!isCoarse()) return;

    // Segundo dedo: es un pellizco, que resuelve Canvas.jsx.
    if (e.touches.length > 1) {
      // Red de seguridad del candado de arriba: si el foco se perdió de una
      // forma que no disparó focusout (el nodo se desmontó, el navegador cerró
      // el teclado…), el candado se quedaría echado y el usuario otra vez sin
      // poder alejarse. Dos dedos significa "quiero hacer zoom": se suelta.
      setViewport(VIEWPORT_FREE);
      abortDrag();
      return;
    }

    const t = e.changedTouches[0];
    const target = document.elementFromPoint(t.clientX, t.clientY) || e.target;

    diag = { target: shortName(target), bridged: false, skipReason: '', moves: 0, cancelable: e.cancelable, outcome: 'en curso' };
    publishDiag();

    if (shouldSkip(target)) {
      diag.skipReason = closestEl(target, NATIVE_SELECTOR) ? 'campo nativo'
        : isBareCanvasSurface(target) ? 'lienzo (lo lleva Canvas)'
        : 'otro';
      diag.outcome = 'ignorado';
      publishDiag();
      drag = null;
      return;
    }
    diag.bridged = true;

    const inCanvas = !!closestEl(target, '.canvas-wrap');
    const scroller = scrollableAncestor(target);

    // Zona con scroll propio FUERA del lienzo (el raíl de herramientas, la
    // lista de proyectos, un modal…): el gesto todavía puede ser un
    // desplazamiento, así que no bloqueamos nada y esperamos a ver. Si el dedo
    // no se mueve, al levantarlo lo convertimos en clic; si se mueve, era un
    // scroll y nos apartamos.
    const deferred = !inCanvas && !!scroller;

    drag = {
      id: t.identifier,
      target,
      startX: t.clientX,
      startY: t.clientY,
      lastY: t.clientY,
      moved: false,
      last: t,
      deferred,
      // Dentro del lienzo el desplazamiento nativo está apagado
      // (touch-action: none), así que si hay una zona con scroll —una nota
      // larga, por ejemplo— la desplazamos nosotros: dedo en vertical =
      // desplazar su contenido, en horizontal = arrastrar el nodo.
      scroller: inCanvas ? scroller : null,
      // El de fuera se guarda aparte: hace falta para saber si al raíl le
      // queda cuerda hacia donde va el dedo antes de dar el gesto por scroll.
      scrollerFuera: inCanvas ? null : scroller,
      axisDecided: false,
      scrolling: false,
    };

    if (deferred) return;

    // Bloquea los eventos de ratón de compatibilidad y el scroll/zoom nativo.
    // Sin esto cada gesto se ejecutaría dos veces (el nuestro y el del
    // navegador) y el lienzo se movería solo.
    if (e.cancelable) e.preventDefault();

    fireMouse('mousedown', t, target, 1);

    // Pulsado largo = clic derecho. SOLO fuera de un nodo: al arrastrar con el
    // dedo es normal apoyarlo un instante antes de moverlo, y si ese instante
    // pasaba de medio segundo el temporizador cerraba el arrastre y el nodo ya
    // no se movía — "no puedo arrastrar" sin más pista. En un nodo no hace
    // falta: su barra ya tiene color, editar, duplicar y eliminar. El menú de
    // crear sobre el lienzo vacío lo lleva Canvas.jsx y no se toca.
    const wrap = closestEl(target, '.canvas-wrap');
    const toolActive = wrap && (wrap.classList.contains('placing') || wrap.classList.contains('linking'));
    const onItem = !!closestEl(target, '.item, .col-child-wrap');
    if (!toolActive && !onItem) {
      clearLongPress();
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        if (!drag || drag.moved) return;
        const held = drag;
        fireMouse('mouseup', held.last, held.target);
        fireMouse('contextmenu', held.last, held.target);
        drag = null;
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
      }, LONG_PRESS_MS);
    }
  }, { capture: true, passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!drag) return;
    if (e.touches.length > 1) { abortDrag(); return; }

    const t = findTouch(e.changedTouches, drag.id);
    if (!t) return;
    drag.last = t;
    if (diag) { diag.moves++; diag.cancelable = e.cancelable; publishDiag(); }

    if (!drag.moved) {
      const dx = t.clientX - drag.startX;
      const dy = t.clientY - drag.startY;
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        drag.moved = true;
        clearLongPress();
      }
    }

    // ── Zona con scroll fuera del lienzo: ¿desplazarla o sacar algo de ella? ──
    //
    // Aquí estaba el fallo de "no puedo arrastrar en el móvil", y no era en los
    // nodos: era en el RAÍL DE HERRAMIENTAS. El raíl es una columna con scroll
    // propio, así que todo gesto que empezara sobre él se marcaba como
    // "esperemos, quizá quiere desplazarlo", y en cuanto el dedo se movía un
    // pelo el puente se apartaba del todo — sin haber disparado nunca el
    // `mousedown`. Los toques sueltos sí llegaban (por eso los botones del raíl
    // respondían), pero sacar una herramienta hacia el lienzo para crear un
    // nodo era literalmente imposible con el dedo.
    //
    // El diagnóstico lo cantaba: «sobre div.tool-icon | puente SÍ | movs 1 |
    // en curso» — un movimiento, y a partir de ahí nada más.
    //
    // Ahora se decide por el eje, igual que ya se hacía dentro del lienzo:
    // hacia arriba o abajo se desplaza el raíl; hacia el lienzo se saca la
    // herramienta. Y el `mousedown` se dispara en ese momento, en el punto
    // donde empezó el dedo, para que el arrastre nazca de donde debe.
    if (drag.deferred) {
      if (!drag.moved) return;
      if (!drag.axisDecided) {
        drag.axisDecided = true;
        const dx = Math.abs(t.clientX - drag.startX);
        const dy = Math.abs(t.clientY - drag.startY);
        const el = drag.scrollerFuera;
        const haciaArriba = t.clientY < drag.startY;
        const cuerda = !el ? false : (haciaArriba
          ? el.scrollTop < el.scrollHeight - el.clientHeight - 1
          : el.scrollTop > 1);
        // Claramente vertical Y con sitio para desplazarse: era un scroll.
        if (dy > dx * 1.6 && cuerda) {
          if (diag) { diag.outcome = 'se apartó (era scroll)'; publishDiag(); }
          drag = null;
          return;
        }
        // No lo era: empieza el arrastre de verdad, desde el punto de origen.
        drag.deferred = false;
        swallowCompatMouse();
        fireMouse('mousedown', {
          clientX: drag.startX, clientY: drag.startY,
          screenX: drag.startX, screenY: drag.startY,
        }, drag.target, 1);
        if (diag) { diag.outcome = 'ARRASTRE desde zona con scroll'; publishDiag(); }
      }
    }

    // Nota larga (u otra zona con scroll) dentro del lienzo: en cuanto se sabe
    // hacia dónde va el dedo, o se desplaza su contenido o se arrastra el nodo.
    if (drag.scroller && !drag.axisDecided && drag.moved) {
      drag.axisDecided = true;
      const dx = Math.abs(t.clientX - drag.startX);
      const dy = Math.abs(t.clientY - drag.startY);
      // Claramente vertical, no "un poco más vertical que horizontal": si no,
      // cualquier arrastre en diagonal se interpretaba como desplazamiento y
      // el nodo se quedaba clavado. Y solo si de verdad queda contenido hacia
      // ese lado.
      const el = drag.scroller;
      const room = (t.clientY < drag.startY)
        ? el.scrollTop < el.scrollHeight - el.clientHeight - 1
        : el.scrollTop > 1;
      drag.scrolling = dy > dx * 1.6 && room;
      // Si es un desplazamiento, cerramos el arrastre de nodo ya iniciado
      // (no llegó a moverse, así que no deja rastro).
      if (drag.scrolling) fireMouse('mouseup', t, drag.target);
    }
    if (drag.scrolling) {
      if (e.cancelable) e.preventDefault();
      drag.scroller.scrollTop -= (t.clientY - drag.lastY);
      drag.lastY = t.clientY;
      return;
    }
    drag.lastY = t.clientY;

    if (e.cancelable) e.preventDefault();
    // Un ratón de verdad emite mousemove sobre el elemento que hay DEBAJO del
    // cursor en cada instante, no sobre el que se pulsó. Todo lo que detecta un
    // destino soltando encima (una flecha que busca nodo, una tarjeta que cae
    // en una columna) mira ese destino: si le mandamos siempre el nodo de
    // origen, nunca encuentra nada.
    fireMouse('mousemove', t, targetUnder(t) || drag.target);
  }, { capture: true, passive: false });

  function endTouch(e) {
    if (!drag) return;
    clearLongPress();

    const t = findTouch(e.changedTouches, drag.id) || drag.last;
    const { target, moved, deferred, scrolling } = drag;
    drag = null;

    if (diag) {
      diag.outcome = scrolling ? 'desplazó contenido'
        : moved ? (deferred ? 'se apartó (era scroll)' : 'ARRASTRE')
        : 'toque';
      publishDiag();
      remoteLog('gesto', window.odiTouchDiag + ' | foco=' + shortName(document.activeElement));
    }

    // Fue un desplazamiento del contenido de un nodo: el mouseup ya se emitió
    // al decidir el eje, y no hay ni clic ni doble toque que valgan.
    if (scrolling) { lastTap = null; return; }

    if (deferred) {
      if (moved) { lastTap = null; return; }
      // Toque limpio dentro de una zona con scroll: ahora sí sabemos que no
      // era un desplazamiento, así que lo emitimos entero de golpe.
      if (e.cancelable) e.preventDefault();
      swallowCompatMouse();
      fireMouse('mousedown', t, target, 1);
      fireMouse('mouseup', t, target);
    } else {
      // Igual que en mousemove: al soltar, el evento debe salir del elemento
      // que hay bajo el dedo, que es el destino del arrastre.
      fireMouse('mouseup', t, (moved && targetUnder(t)) || target);
      if (moved) { lastTap = null; return; }
    }

    // Fue un toque limpio. Como bloqueamos los eventos de compatibilidad, el
    // navegador no va a emitir el click: lo emitimos nosotros.
    fireMouse('click', t, target, 1);

    const now = Date.now();
    if (lastTap &&
        now - lastTap.time < DOUBLE_TAP_MS &&
        Math.abs(t.clientX - lastTap.x) < DOUBLE_TAP_DIST &&
        Math.abs(t.clientY - lastTap.y) < DOUBLE_TAP_DIST) {
      // Doble toque = doble clic: es como se entra a editar una nota o se abre
      // un tablero anidado.
      fireMouse('dblclick', t, target, 2);
      lastTap = null;
    } else {
      lastTap = { x: t.clientX, y: t.clientY, time: now };
    }
  }

  document.addEventListener('touchend', endTouch, { capture: true, passive: false });
  // `touchcancel` lo dispara el navegador cuando decide quedarse él con el
  // gesto (lo toma por un desplazamiento, o el sistema abre algo encima). Se
  // deja anotado porque es una de las pocas cosas que pasan en un teléfono de
  // verdad y nunca en uno emulado: si el arrastre muere aquí, el diagnóstico lo
  // dice con todas las letras en vez de dejar un "no funciona" sin causa.
  document.addEventListener('touchcancel', () => {
    if (diag && drag) { diag.outcome = 'CANCELADO por el navegador'; publishDiag(); }
    abortDrag();
    lastTap = null;
  }, { capture: true, passive: false });
})();
