// =====================================================
// Odinote — qué cambió en el lienzo (window.OdiSync)
//
// Cuando dos personas trabajan a la vez no se puede mandar el proyecto entero
// en cada cambio: son megas, y encima el último en enviar borraría el trabajo
// del otro. Aquí se compara el estado anterior con el nuevo y sale la lista
// mínima de operaciones — "esta nota se movió a x=340", "este nodo ya no
// está" — que es lo que viaja por la red.
//
// Además es lo que hace que dos ediciones simultáneas no se peleen: si tú
// mueves una nota y yo cambio el color de OTRA, son operaciones distintas
// sobre campos distintos y las dos sobreviven. Mandando el proyecto entero,
// una de las dos se perdía siempre.
//
// Sin React ni DOM: se prueba entero desde Node (scripts/test-sync.js).
// =====================================================
(function () {
  'use strict';

  // Campos que NO viajan: son del momento y del equipo de cada uno. Mandar
  // `_dragging` haría parpadear el nodo en la pantalla del otro, y `_new`
  // le dispararía la animación de recién creado a destiempo.
  const CAMPOS_LOCALES = ['_dragging', '_new', '_editing', '_startDrawing',
                          '_triggerImagePick', '_triggerFilePick', 'srcLocal'];

  function esLocal(campo) {
    return campo.charAt(0) === '_' || CAMPOS_LOCALES.indexOf(campo) !== -1;
  }

  function igual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    return JSON.stringify(a) === JSON.stringify(b);
  }

  // Quita los campos locales de un nodo antes de mandarlo.
  function limpia(nodo) {
    const out = {};
    Object.keys(nodo).forEach(k => { if (!esLocal(k)) out[k] = nodo[k]; });
    return out;
  }

  // ── Diferencias entre dos versiones de un mismo nodo ──
  function camposCambiados(antes, ahora) {
    const cambios = {};
    let hay = false;
    Object.keys(ahora).forEach(k => {
      if (esLocal(k)) return;
      if (!igual(antes[k], ahora[k])) { cambios[k] = ahora[k]; hay = true; }
    });
    // Un campo que desaparece también es un cambio: se manda como null para
    // que el otro lado lo borre en vez de quedarse con el valor viejo.
    Object.keys(antes).forEach(k => {
      if (esLocal(k)) return;
      if (!(k in ahora)) { cambios[k] = null; hay = true; }
    });
    return hay ? cambios : null;
  }

  function porId(lista) {
    const m = new Map();
    (lista || []).forEach(x => m.set(x.id, x));
    return m;
  }

  // ── El diff completo ──
  //
  // Devuelve una lista de operaciones. Cada una dice sobre qué lienzo actúa,
  // porque un proyecto son muchos (los tableros anidados).
  function diff(antes, ahora) {
    const ops = [];
    const idsAntes = Object.keys(antes || {});
    const idsAhora = Object.keys(ahora || {});

    // Lienzos nuevos (alguien creó un tablero)
    idsAhora.forEach(cid => {
      if (antes && antes[cid]) return;
      ops.push({ o: 'lienzo+', c: cid, lienzo: limpiaLienzo(ahora[cid]) });
    });

    // Lienzos que ya no están
    idsAntes.forEach(cid => {
      if (ahora && ahora[cid]) return;
      ops.push({ o: 'lienzo-', c: cid });
    });

    // Y dentro de los que siguen, qué cambió
    idsAhora.forEach(cid => {
      const a = antes && antes[cid];
      const b = ahora[cid];
      if (!a || a === b) return;   // sin cambios (misma referencia)

      if (!igual(a.title, b.title)) ops.push({ o: 'titulo', c: cid, title: b.title });
      if (!igual(a.bgColor, b.bgColor)) ops.push({ o: 'fondo', c: cid, bgColor: b.bgColor });

      const nA = porId(a.items);
      const nB = porId(b.items);

      nB.forEach((nodo, id) => {
        const viejo = nA.get(id);
        if (!viejo) { ops.push({ o: 'nodo+', c: cid, nodo: limpia(nodo) }); return; }
        if (viejo === nodo) return;
        const cambios = camposCambiados(viejo, nodo);
        if (cambios) ops.push({ o: 'nodo~', c: cid, id, campos: cambios });
      });

      nA.forEach((_, id) => {
        if (!nB.has(id)) ops.push({ o: 'nodo-', c: cid, id });
      });

      const cA = porId(a.connectors);
      const cB = porId(b.connectors);
      cB.forEach((con, id) => {
        const viejo = cA.get(id);
        if (!viejo) { ops.push({ o: 'flecha+', c: cid, flecha: limpia(con) }); return; }
        if (viejo === con) return;
        const cambios = camposCambiados(viejo, con);
        if (cambios) ops.push({ o: 'flecha~', c: cid, id, campos: cambios });
      });
      cA.forEach((_, id) => {
        if (!cB.has(id)) ops.push({ o: 'flecha-', c: cid, id });
      });
    });

    return ops;
  }

  function limpiaLienzo(l) {
    return {
      title: l.title,
      parent: l.parent,
      parentLabel: l.parentLabel,
      bgColor: l.bgColor,
      items: (l.items || []).map(limpia),
      connectors: (l.connectors || []).map(limpia),
    };
  }

  // ── Aplicar lo que llega del otro lado ──
  //
  // Devuelve SIEMPRE objetos nuevos para lo que cambia y reutiliza los que no,
  // que es como React sabe qué tiene que volver a pintar. Copiarlo todo haría
  // parpadear el lienzo entero en cada movimiento del otro.
  function aplicaCampos(nodo, campos) {
    const out = { ...nodo };
    Object.keys(campos).forEach(k => {
      if (campos[k] === null) delete out[k];
      else out[k] = campos[k];
    });
    return out;
  }

  function aplica(canvases, ops) {
    if (!ops || !ops.length) return canvases;
    const siguiente = { ...canvases };
    // Se agrupa por lienzo para no copiar el mismo diez veces seguidas.
    const tocados = new Set();

    ops.forEach(op => {
      if (op.o === 'lienzo+') {
        if (!siguiente[op.c]) siguiente[op.c] = { items: [], connectors: [], ...op.lienzo };
        return;
      }
      if (op.o === 'lienzo-') { delete siguiente[op.c]; return; }

      const l = siguiente[op.c];
      if (!l) return;   // llega algo de un lienzo que aquí no existe: se ignora
      if (!tocados.has(op.c)) {
        siguiente[op.c] = { ...l, items: [...(l.items || [])], connectors: [...(l.connectors || [])] };
        tocados.add(op.c);
      }
      const dest = siguiente[op.c];

      switch (op.o) {
        case 'titulo': dest.title = op.title; break;
        case 'fondo':  dest.bgColor = op.bgColor; break;
        case 'nodo+': {
          if (!dest.items.some(i => i.id === op.nodo.id)) dest.items.push(op.nodo);
          break;
        }
        case 'nodo-': dest.items = dest.items.filter(i => i.id !== op.id); break;
        case 'nodo~': {
          const idx = dest.items.findIndex(i => i.id === op.id);
          if (idx !== -1) dest.items[idx] = aplicaCampos(dest.items[idx], op.campos);
          break;
        }
        case 'flecha+': {
          if (!dest.connectors.some(c => c.id === op.flecha.id)) dest.connectors.push(op.flecha);
          break;
        }
        case 'flecha-': dest.connectors = dest.connectors.filter(c => c.id !== op.id); break;
        case 'flecha~': {
          const idx = dest.connectors.findIndex(c => c.id === op.id);
          if (idx !== -1) dest.connectors[idx] = aplicaCampos(dest.connectors[idx], op.campos);
          break;
        }
      }
    });

    return siguiente;
  }

  // ── Tamaño ──
  // Un movimiento de nodo son ~80 bytes. Sirve para no intentar meter por el
  // canal algo que no cabe de una vez.
  function pesa(ops) {
    return JSON.stringify(ops).length;
  }

  const OdiSync = { diff, aplica, limpia, limpiaLienzo, camposCambiados, pesa, esLocal, CAMPOS_LOCALES };
  if (typeof window !== 'undefined') window.OdiSync = OdiSync;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiSync;
})();
