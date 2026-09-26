// =====================================================
// Oddinote — el recorrido de las flechas rectas (window.FlechaRecta)
//
// Una flecha en modo recto va en ángulos rectos de un nodo a otro. Hay dos
// maneras de tener su recorrido:
//
//   · Automática: la flecha que nadie ha tocado. Su recorrido se calcula entero
//     cada vez que se pinta, a partir de dónde están los nodos AHORA: por qué
//     lado sale de cada uno y por dónde va. No se guarda nada, así que al mover
//     un nodo la flecha se rehace limpia, sin arrastrar codos viejos.
//   · A mano: en cuanto alguien arrastra un tramo, sus codos se guardan
//     (conn.ortho, con conn.orthoManual) y se respetan tal cual en cada
//     pintada. Nada los "limpia" ni los recoloca al pintar.
//
// Antes todas las flechas guardaban su codo nada más pintarse, aunque nadie
// las hubiera tocado; desde ahí ese codo quedaba clavado donde estaba, y al
// mover los nodos la flecha daba ganchos absurdos y cambiaba de lado sola.
// Encima, cada pintada "limpiaba" los codos con márgenes de 10-15 px y los
// movía. Es lo que el usuario veía como "se acomodan solas".
//
// Los codos se guardan como siempre (los puntos de conn.ortho): el recorrido
// sale del primer nodo por el eje de su lado, va alternando horizontal y
// vertical pasando por cada codo, y entra en el segundo por el eje del suyo.
//
// Sin React ni DOM: se prueba entero desde Node (scripts/test-flecha-recta.js).
// =====================================================
(function () {
  'use strict';

  const GAP = 16;     // hueco entre la punta de la flecha y el borde del nodo
  const TRAMO = 22;   // lo que sale recto de un nodo antes de doblar para rodearlo
  const CODO = 45;    // lo que "cuesta" un doblez al elegir: gana la de menos dobleces
  const CORTO = 14;   // un tramo más corto que esto se ve como un tropiezo

  const LADOS = {
    izq: { dir: 'h', sgn: -1 },
    der: { dir: 'h', sgn: 1 },
    arr: { dir: 'v', sgn: -1 },
    aba: { dir: 'v', sgn: 1 },
  };

  function ladoDeFrac(frac) {
    if (!frac) return null;
    if (frac.x === 0) return 'izq';
    if (frac.x === 1) return 'der';
    if (frac.y === 0) return 'arr';
    if (frac.y === 1) return 'aba';
    return null;
  }

  // El punto del borde (e) y el de la punta (p, a GAP del borde) de un lado,
  // a la altura t (0..1 a lo largo de ese lado; 0,5 es el medio). El hueco
  // puede ser menor que GAP cuando dos nodos están tan pegados que, con el
  // hueco entero a cada lado, la flecha no cabría.
  function salida(rect, lado, t, hueco) {
    const L = LADOS[lado];
    let e;
    if (lado === 'izq') e = { x: rect.x, y: rect.y + t * rect.h };
    else if (lado === 'der') e = { x: rect.x + rect.w, y: rect.y + t * rect.h };
    else if (lado === 'arr') e = { x: rect.x + t * rect.w, y: rect.y };
    else e = { x: rect.x + t * rect.w, y: rect.y + rect.h };
    const g = hueco == null ? GAP : hueco;
    const p = L.dir === 'h' ? { x: e.x + L.sgn * g, y: e.y } : { x: e.x, y: e.y + L.sgn * g };
    return { e, p, dir: L.dir, sgn: L.sgn, lado };
  }

  // Si los dos lados se miran de frente, el espacio entre ellos; si no, null.
  function espacioEntre(rA, lA, rB, lB) {
    if (!rA || !rB) return null;
    if (lA === 'der' && lB === 'izq') return rB.x - (rA.x + rA.w);
    if (lA === 'izq' && lB === 'der') return rA.x - (rB.x + rB.w);
    if (lA === 'aba' && lB === 'arr') return rB.y - (rA.y + rA.h);
    if (lA === 'arr' && lB === 'aba') return rA.y - (rB.y + rB.h);
    return null;
  }
  // El hueco que cabe entre dos lados que se miran: el de siempre si sobra
  // sitio; si no, lo que deje un tramo visible en medio.
  function huecoPara(espacio) {
    if (espacio == null) return GAP;
    return Math.max(3, Math.min(GAP, (espacio - CORTO) / 2));
  }

  // Un extremo suelto (sin nodo): sale del mismo punto, en la dirección dada.
  function salidaLibre(punto, lado) {
    const L = LADOS[lado];
    return { e: { x: punto.x, y: punto.y }, p: { x: punto.x, y: punto.y }, dir: L.dir, sgn: L.sgn, lado };
  }

  // ── El recorrido a partir de los codos ──
  // Cada tramo sabe qué coordenada de qué codo lo mueve (wpIndex; -1 si está
  // pegado a una salida y al arrastrarlo hay que meter un codo nuevo).
  function construye(p1, dA, codos, p2, dB) {
    const verts = [p1];
    const segs = [];
    let prev = p1, dir = dA;
    const push = (to, axis, wpIndex, insertAfter) => {
      segs.push({ from: prev, to, axis, wpIndex, insertAfter });
      verts.push(to);
      prev = to;
    };
    (codos || []).forEach((wp, k) => {
      if (dir === 'h') {
        push({ x: wp.x, y: prev.y }, 'y', k - 1, k);
        push({ x: wp.x, y: wp.y }, 'x', k, k + 1);
      } else {
        push({ x: prev.x, y: wp.y }, 'x', k - 1, k);
        push({ x: wp.x, y: wp.y }, 'y', k, k + 1);
      }
      dir = dir === 'h' ? 'v' : 'h';
    });
    const n = (codos || []).length;
    if (dB === 'h') {
      push({ x: prev.x, y: p2.y }, 'x', n - 1, n);
      push({ x: p2.x, y: p2.y }, 'y', -1, n);
    } else {
      push({ x: p2.x, y: prev.y }, 'y', n - 1, n);
      push({ x: p2.x, y: p2.y }, 'x', -1, n);
    }
    return { verts, segs };
  }

  // Quita los tramos de longitud cero y junta los que siguen la misma recta
  // (también las idas y vueltas sobre la misma línea).
  function limpia(verts, tol) {
    const t = tol == null ? 0.5 : tol;
    const out = [];
    for (const v of verts) {
      const u = out[out.length - 1];
      if (u && Math.abs(u.x - v.x) <= t && Math.abs(u.y - v.y) <= t) continue;
      out.push({ x: v.x, y: v.y });
      while (out.length >= 3) {
        const a = out[out.length - 3], b = out[out.length - 2], c = out[out.length - 1];
        const mismaX = Math.abs(a.x - b.x) <= t && Math.abs(b.x - c.x) <= t;
        const mismaY = Math.abs(a.y - b.y) <= t && Math.abs(b.y - c.y) <= t;
        if (mismaX || mismaY) out.splice(out.length - 2, 1);
        else break;
      }
    }
    return out;
  }

  const ejeDe = (a, b) => (Math.abs(a.x - b.x) >= Math.abs(a.y - b.y) ? 'h' : 'v');

  // Los codos que dan exactamente este recorrido, o null si no se puede
  // expresar así (empieza o acaba por el eje equivocado). Cada esquina es un
  // codo: construye() llega a cada uno por el eje que toca en ese momento, así
  // que pasando por todas las esquinas sale el mismo recorrido (con tramos de
  // cero que limpia() quita). El recorrido tiene que ir alternando horizontal
  // y vertical, como sale de construye() o de limpia().
  function codosDeVertices(v, dA, dB) {
    const n = v.length - 1;
    if (n < 1) return null;
    if (ejeDe(v[0], v[1]) !== dA || ejeDe(v[n - 1], v[n]) !== dB) return null;
    return v.slice(1, n).map(p => ({ x: p.x, y: p.y }));
  }

  // ¿Pasa este tramo (horizontal o vertical) por dentro del nodo?
  function cruza(a, b, r) {
    if (!r) return false;
    const x1 = r.x + 1, x2 = r.x + r.w - 1, y1 = r.y + 1, y2 = r.y + r.h - 1;
    if (Math.abs(a.y - b.y) < 0.5) {
      const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
      return a.y > y1 && a.y < y2 && hi > x1 && lo < x2;
    }
    const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
    return a.x > x1 && a.x < x2 && hi > y1 && lo < y2;
  }

  // Lo que "cuesta" un recorrido: largo + dobleces + tramos que tropiezan. Si
  // no sale del nodo hacia fuera, no entra en el otro de frente o atraviesa
  // alguno de los dos, no vale.
  function nota(verts, sA, sB, rA, rB) {
    const v = limpia(verts);
    if (v.length < 2) return Infinity;
    const d0 = ejeDe(v[0], v[1]);
    const s0 = d0 === 'h' ? Math.sign(v[1].x - v[0].x) : Math.sign(v[1].y - v[0].y);
    if (d0 !== sA.dir || s0 !== sA.sgn) return Infinity;
    const m = v.length - 1;
    const dn = ejeDe(v[m - 1], v[m]);
    const sn = dn === 'h' ? Math.sign(v[m].x - v[m - 1].x) : Math.sign(v[m].y - v[m - 1].y);
    if (dn !== sB.dir || sn !== -sB.sgn) return Infinity;
    let largo = 0, pena = 0;
    for (let i = 0; i < m; i++) {
      const L = Math.abs(v[i + 1].x - v[i].x) + Math.abs(v[i + 1].y - v[i].y);
      largo += L;
      if (L < CORTO) pena += 250;
      if (cruza(v[i], v[i + 1], rA) || cruza(v[i], v[i + 1], rB)) return Infinity;
    }
    return largo + CODO * (m - 1) + pena;
  }

  const redondea = (n) => Math.round(n * 2) / 2;

  // Las coordenadas por las que tiene sentido que pase un codo: las de las
  // puntas, el medio entre ellas, lo justo para salir recto de cada nodo, el
  // hueco entre los dos nodos y por fuera de los dos.
  function coordenadas(sA, sB, rA, rB) {
    const xs = new Set(), ys = new Set();
    const p1 = sA.p, p2 = sB.p;
    [p1.x, p2.x, (p1.x + p2.x) / 2].forEach(v => xs.add(redondea(v)));
    [p1.y, p2.y, (p1.y + p2.y) / 2].forEach(v => ys.add(redondea(v)));
    if (sA.dir === 'h') xs.add(redondea(p1.x + sA.sgn * TRAMO)); else ys.add(redondea(p1.y + sA.sgn * TRAMO));
    if (sB.dir === 'h') xs.add(redondea(p2.x + sB.sgn * TRAMO)); else ys.add(redondea(p2.y + sB.sgn * TRAMO));
    const rs = [rA, rB].filter(Boolean);
    if (rs.length) {
      xs.add(redondea(Math.min(...rs.map(r => r.x)) - GAP - TRAMO));
      xs.add(redondea(Math.max(...rs.map(r => r.x + r.w)) + GAP + TRAMO));
      ys.add(redondea(Math.min(...rs.map(r => r.y)) - GAP - TRAMO));
      ys.add(redondea(Math.max(...rs.map(r => r.y + r.h)) + GAP + TRAMO));
    }
    if (rA && rB) {
      if (rA.x + rA.w < rB.x) xs.add(redondea((rA.x + rA.w + rB.x) / 2));
      if (rB.x + rB.w < rA.x) xs.add(redondea((rB.x + rB.w + rA.x) / 2));
      if (rA.y + rA.h < rB.y) ys.add(redondea((rA.y + rA.h + rB.y) / 2));
      if (rB.y + rB.h < rA.y) ys.add(redondea((rB.y + rB.h + rA.y) / 2));
    }
    return { xs: [...xs], ys: [...ys] };
  }

  // El mejor recorrido entre dos salidas ya decididas.
  function mejorEntre(sA, sB, rA, rB) {
    const { xs, ys } = coordenadas(sA, sB, rA, rB);
    let mejor = { nota: Infinity, codos: null };
    const prueba = (codos) => {
      const { verts } = construye(sA.p, sA.dir, codos, sB.p, sB.dir);
      const n = nota(verts, sA, sB, rA, rB);
      if (n < mejor.nota) mejor = { nota: n, codos };
    };
    for (const x of xs) for (const y of ys) prueba([{ x, y }]);
    // Con dos codos, unidos por un tramo del eje contrario a la salida: las
    // "U" y las "S" que rodean un nodo.
    if (sA.dir === 'h') {
      for (const x0 of xs) for (const x1 of xs) for (const y of ys) prueba([{ x: x0, y }, { x: x1, y }]);
    } else {
      for (const y0 of ys) for (const y1 of ys) for (const x of xs) prueba([{ x, y: y0 }, { x, y: y1 }]);
    }
    return mejor;
  }

  // Por qué lados puede salir un extremo sin enganche guardado: los dos que
  // miran al otro extremo (el horizontal y el vertical).
  function ladosQueMiran(desde, hacia) {
    const cx = desde.x + (desde.w || 0) / 2, cy = desde.y + (desde.h || 0) / 2;
    const ox = hacia.x + (hacia.w || 0) / 2, oy = hacia.y + (hacia.h || 0) / 2;
    return [ox >= cx ? 'der' : 'izq', oy >= cy ? 'aba' : 'arr'];
  }

  // ── El recorrido automático ──
  // a y b: { rect } si el extremo está pegado a un nodo (con su frac si tiene
  // enganche guardado), o { punto } si está suelto. Prueba los lados que miran
  // al otro extremo (o el del enganche, si lo hay) y se queda con el mejor.
  // Si los dos nodos están enfrentados y solapan lo bastante, prueba también
  // una línea recta a la altura del solape: sale sin ningún doblez.
  const cache = new Map();
  function automatica(a, b) {
    const clave = JSON.stringify([a.rect || a.punto, a.frac || null, b.rect || b.punto, b.frac || null]);
    const guardado = cache.get(clave);
    if (guardado) return guardado;

    const zona = (x) => x.rect || { x: x.punto.x, y: x.punto.y, w: 0, h: 0 };
    const zA = zona(a), zB = zona(b);
    const opciones = (x, yo, otro) => {
      const fijo = x.rect && ladoDeFrac(x.frac);
      if (fijo) return [{ lado: fijo, t: fijo === 'izq' || fijo === 'der' ? x.frac.y : x.frac.x, fijo: true }];
      return ladosQueMiran(yo, otro).map(lado => ({ lado, t: 0.5 }));
    };
    const salidaDe = (x, o, hueco) => (x.rect ? salida(x.rect, o.lado, o.t, hueco) : salidaLibre(x.punto, o.lado));

    // El lado principal: el de la separación mayor. Los demás pagan un poco,
    // para que la flecha no salte de un lado a otro por un píxel.
    const gx = Math.max(zB.x - (zA.x + zA.w), zA.x - (zB.x + zB.w));
    const gy = Math.max(zB.y - (zA.y + zA.h), zA.y - (zB.y + zB.h));
    const principal = gx >= gy ? 'h' : 'v';

    let mejor = null;
    const evalua = (sA, sB, extra) => {
      const r = mejorEntre(sA, sB, a.rect, b.rect);
      const n = r.nota + (extra || 0);
      if (r.codos && Number.isFinite(n) && (!mejor || n < mejor.nota)) {
        const v = limpia(construye(sA.p, sA.dir, r.codos, sB.p, sB.dir).verts);
        mejor = { nota: n, sA, sB, codos: r.codos, dobleces: v.length - 2 };
      }
    };
    const prueba = (lA, lB, extraBase) => {
      for (const oA of lA) {
        for (const oB of lB) {
          const hueco = huecoPara(espacioEntre(a.rect, oA.lado, b.rect, oB.lado));
          const sA = salidaDe(a, oA, hueco), sB = salidaDe(b, oB, hueco);
          const extra = extraBase + (oA.fijo || sA.dir === principal ? 0 : 20) + (oB.fijo || sB.dir === principal ? 0 : 20);
          evalua(sA, sB, extra);
          // Enfrentados y solapando: la recta a la altura del medio del solape.
          if (!oA.fijo && !oB.fijo && a.rect && b.rect && sA.dir === sB.dir && sA.sgn === -sB.sgn) {
            const h = sA.dir === 'h';
            const lo = Math.max(h ? a.rect.y : a.rect.x, h ? b.rect.y : b.rect.x);
            const hi = Math.min(h ? a.rect.y + a.rect.h : a.rect.x + a.rect.w, h ? b.rect.y + b.rect.h : b.rect.x + b.rect.w);
            if (hi - lo >= 24) {
              const c = (lo + hi) / 2;
              const tA = h ? (c - a.rect.y) / a.rect.h : (c - a.rect.x) / a.rect.w;
              const tB = h ? (c - b.rect.y) / b.rect.h : (c - b.rect.x) / b.rect.w;
              evalua(salida(a.rect, oA.lado, tA, hueco), salida(b.rect, oB.lado, tB, hueco), extra);
            }
          }
        }
      }
    };
    prueba(opciones(a, zA, zB), opciones(b, zB, zA), 0);
    // Con los lados que se miran sale una ruta con muchos dobleces cuando los
    // nodos están pegados o metidos uno en la esquina del otro: entonces se
    // prueban los cuatro lados de cada uno (una C suele ser mucho mejor).
    if (!mejor || mejor.dobleces > 2) {
      const todos = (x, o) => (o.length === 1 && o[0].fijo ? o : Object.keys(LADOS).map(lado => ({ lado, t: 0.5 })));
      prueba(todos(a, opciones(a, zA, zB)), todos(b, opciones(b, zB, zA)), 30);
    }
    // Si nada vale (nodos encima el uno del otro), la de siempre: salir por
    // el lado principal y cruzar por el medio.
    if (!mejor) {
      const oA = opciones(a, zA, zB)[principal === 'h' ? 0 : 1] || opciones(a, zA, zB)[0];
      const oB = opciones(b, zB, zA)[principal === 'h' ? 0 : 1] || opciones(b, zB, zA)[0];
      const sA = salidaDe(a, oA), sB = salidaDe(b, oB);
      mejor = { nota: Infinity, sA, sB, codos: [{ x: (sA.p.x + sB.p.x) / 2, y: (sA.p.y + sB.p.y) / 2 }] };
    }
    if (cache.size > 400) cache.clear();
    cache.set(clave, mejor);
    return mejor;
  }

  // Limpieza de un recorrido hecho a mano, SOLO al soltar lo que se arrastró:
  // quita tramos de menos de 2 px y junta los que siguen la misma recta. Si
  // el resultado no se puede expresar con codos, se quedan los de antes.
  function limpiaCodos(codos, sA, sB) {
    const { verts } = construye(sA.p, sA.dir, codos, sB.p, sB.dir);
    const v = limpia(verts, 2);
    const c = codosDeVertices(v, sA.dir, sB.dir);
    return c || codos;
  }

  // ¿Tiene esta flecha un recorrido hecho a mano? Las de ahora lo marcan
  // (orthoManual). Las de antes guardaban siempre un codo aunque nadie las
  // tocara: con uno solo se toman por automáticas (así se arreglan solas las
  // que ya estaban torcidas); con más de uno, alguien las trabajó.
  function esAMano(conn) {
    if (!conn || !Array.isArray(conn.ortho)) return false;
    if (conn.orthoManual === true) return true;
    return conn.ortho.length > 1;
  }

  // Lo que hay que cambiar en una flecha para que vuelva al recorrido
  // automático: fuera sus codos y, de paso, fuera los enganches que fijó la
  // propia aplicación (marcados con fijado) al tocar el recorrido. Los que
  // puso alguien a mano, deslizando el punto verde, se respetan.
  function patchAutomatica(conn) {
    const p = { ortho: undefined, orthoManual: undefined, bend: undefined };
    if (conn && conn.fromEnd && conn.fromEnd.fijado) p.fromEnd = { itemId: conn.fromEnd.itemId };
    if (conn && conn.toEnd && conn.toEnd.fijado) p.toEnd = { itemId: conn.toEnd.itemId };
    return p;
  }

  const FlechaRecta = {
    GAP, LADOS, ladoDeFrac, salida, salidaLibre, construye, limpia, codosDeVertices,
    cruza, nota, automatica, limpiaCodos, esAMano, patchAutomatica,
  };
  if (typeof window !== 'undefined') window.FlechaRecta = FlechaRecta;
  if (typeof module !== 'undefined' && module.exports) module.exports = FlechaRecta;
})();
