// =====================================================
// Odinote — Connector v3
// (Las flechas rectas: ver flecha-recta.js y la explicación de allí.)
// • Endpoints always anchor to the CENTER of a node.
// • The arrow keeps a small GAP from the node (never touches it).
// • The section that runs inside the node (center → edge) is drawn dotted
//   (rendered on top of nodes) and the center anchor shows clearly when selected.
// • Supports bidirectional arrows and a text label.
// =====================================================

// ───── Flecha recta ─────
// El recorrido lo calcula flecha-recta.js (window.FlechaRecta): el automático
// se rehace en cada pintada y el hecho a mano se respeta tal cual. Aquí van
// las ayudas para pasar de lo que guarda la flecha a lo que usa ese módulo.

// Por dónde sale un extremo de una flecha recta hecha a mano: por su enganche
// si lo tiene; si no (flechas de antes), por el lado que mira a su primer
// codo, como se hacía entonces.
function salidaRecta(end, hacia) {
  const FR = window.FlechaRecta;
  if (end.item && end.frac) {
    const { p: e, dir, sgn } = puntoDeFrac(end.item, end.frac);
    const lado = dir === 'h' ? (sgn < 0 ? 'izq' : 'der') : (sgn < 0 ? 'arr' : 'aba');
    const p = dir === 'h' ? { x: e.x + sgn * FR.GAP, y: e.y } : { x: e.x, y: e.y + sgn * FR.GAP };
    return { e, p, dir, sgn, lado };
  }
  const c = end.center;
  const hw = end.item ? end.item.w / 2 : 0, hh = end.item ? end.item.h / 2 : 0;
  const dx = hacia.x - c.x, dy = hacia.y - c.y;
  const nx = hw > 0 ? Math.abs(dx) / hw : Math.abs(dx);
  const ny = hh > 0 ? Math.abs(dy) / hh : Math.abs(dy);
  const lado = nx >= ny ? (dx >= 0 ? 'der' : 'izq') : (dy >= 0 ? 'aba' : 'arr');
  return end.item ? FR.salida(end.item, lado, 0.5) : FR.salidaLibre(c, lado);
}

// El enganche (frac) que corresponde a una salida: para fijar los extremos
// en cuanto alguien toca el recorrido, y que la flecha no cambie de lado sola.
function fracDeSalida(rect, s) {
  const r3 = (n) => +Math.min(1, Math.max(0, n)).toFixed(3);
  if (s.lado === 'izq') return { x: 0, y: r3((s.e.y - rect.y) / rect.h) };
  if (s.lado === 'der') return { x: 1, y: r3((s.e.y - rect.y) / rect.h) };
  if (s.lado === 'arr') return { x: r3((s.e.x - rect.x) / rect.w), y: 0 };
  return { x: r3((s.e.x - rect.x) / rect.w), y: 1 };
}

// El punto que queda a mitad del recorrido: ahí va la etiqueta.
function puntoEnMedio(verts) {
  let total = 0;
  for (let i = 0; i < verts.length - 1; i++) total += Math.hypot(verts[i + 1].x - verts[i].x, verts[i + 1].y - verts[i].y);
  let falta = total / 2;
  for (let i = 0; i < verts.length - 1; i++) {
    const a = verts[i], b = verts[i + 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L >= falta && L > 0) return { x: a.x + (b.x - a.x) * falta / L, y: a.y + (b.y - a.y) * falta / L };
    falta -= L;
  }
  return verts[0] || { x: 0, y: 0 };
}

function getCenter(item) { return { x: item.x + item.w / 2, y: item.y + item.h / 2 }; }

// Punto del borde del rectángulo más cercano a (tx,ty) — estilo Milanote: las
// flechas llegan a la altura del origen en vez de converger todas hacia el centro.
function nearestPointOnRect(item, tx, ty) {
  const l = item.x, r = item.x + item.w, t = item.y, b = item.y + item.h;
  if (tx < l || tx > r || ty < t || ty > b) {
    return { x: Math.max(l, Math.min(r, tx)), y: Math.max(t, Math.min(b, ty)) };
  }
  // El punto cae dentro del nodo: proyectar al borde más cercano
  const dl = tx - l, dr = r - tx, dt = ty - t, db = b - ty;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return { x: l, y: ty };
  if (m === dr) return { x: r, y: ty };
  if (m === dt) return { x: tx, y: t };
  return { x: tx, y: b };
}

// Polilínea ortogonal con esquinas redondeadas (aspecto Miro)
function roundedOrthoPath(pts, radius) {
  if (!pts || pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
    const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (l1 < 0.5 || l2 < 0.5) { d += ` L ${p1.x} ${p1.y}`; continue; }
    const rr = Math.min(radius, l1 / 2, l2 / 2);
    const a = { x: p1.x - ((p1.x - p0.x) / l1) * rr, y: p1.y - ((p1.y - p0.y) / l1) * rr };
    const b = { x: p1.x + ((p2.x - p1.x) / l2) * rr, y: p1.y + ((p2.y - p1.y) / l2) * rr };
    d += ` L ${a.x} ${a.y} Q ${p1.x} ${p1.y} ${b.x} ${b.y}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

// Where the ray from the item's center toward (tx,ty) exits the item's rectangle
function edgeIntersect(item, tx, ty) {
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = item.w / 2, hh = item.h / 2;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  
  const s = item.isColumn ? sx : Math.min(sx, sy);
  let rx = cx + dx * s;
  let ry = cy + dy * s;
  
  if (item.isColumn) {
    ry = Math.max(item.y, Math.min(item.y + item.h, ry));
  }
  
  return { x: rx, y: ry };
}

// Legacy helpers kept for backward compatibility (Canvas still calls these for creation)
function getAnchorPoint(item, anchor) {
  if (!item) return null;
  return getCenter(item); // always the center now
}
function closestAnchorTo() { return 'center'; }
function localDefaultDims(type) {
  switch (type) {
    case 'note':     return { w: 300, h: 120 };
    case 'todo':     return { w: 300, h: 230 };
    case 'doc':      return { w: 300, h: 210 };
    case 'image':    return { w: 300, h: 220 };
    case 'link':     return { w: 340, h: 230 };
    case 'board':    return { w: 300, h: 240 };
    case 'column':   return { w: 320, h: 380 };
    case 'comment':  return { w: 280, h: 150 };
    case 'calendar': return { w: 520, h: 420 };
    case 'separator': return { w: 640, h: 48 };
    case 'carpeta': return { w: 230, h: 240 };
    case 'ruleta': return { w: 340, h: 340 };
    case 'table':    return { w: 380, h: 220 };
    case 'audio':    return { w: 320, h: 140 };
    case 'color':    return { w: 220, h: 240 };
    case 'file':     return { w: 230, h: 150 };
    case 'map':      return { w: 340, h: 280 };
    default:         return { w: 260, h: 160 };
  }
}

function getNodeRect(itemId, items) {
  if (!items) return null;
  const topItem = items.find(i => i.id === itemId);
  if (topItem) {
    let w = topItem.w;
    let h = topItem.h;
    if (w === undefined || h === undefined) {
      const def = localDefaultDims(topItem.type);
      if (w === undefined) w = def.w;
      if (h === undefined) h = def.h;
    }
    return { id: topItem.id, x: topItem.x, y: topItem.y, w, h, isColumn: topItem.type === 'column' };
  }
  for (const it of items) {
    if (it.type === 'column' && it.children) {
      const idx = it.children.findIndex(c => c.id === itemId);
      if (idx !== -1) {
        const child = it.children[idx];
        let relY = 40; // updated column header height
        for (let i = 0; i < idx; i++) {
          const prev = it.children[i];
          const prevH = prev.type === 'board'
            ? (prev.showPreview === false ? 58 : (prev.h || 200))
            : (prev.h || (prev.type === 'note' ? 90 :
                          prev.type === 'todo' ? 140 :
                          prev.type === 'link' ? 180 :
                          prev.type === 'image' ? 140 :
                          prev.type === 'doc' ? 90 :
                          prev.type === 'comment' ? 80 :
                          prev.type === 'calendar' ? 220 : 90));
          relY += prevH + 7;
        }
        const h = child.type === 'board'
          ? (child.showPreview === false ? 58 : (child.h || 200))
          : (child.h || (child.type === 'note' ? 90 :
                        child.type === 'todo' ? 140 :
                        child.type === 'link' ? 180 :
                        child.type === 'image' ? 140 :
                        child.type === 'doc' ? 90 :
                        child.type === 'comment' ? 80 :
                        child.type === 'calendar' ? 220 : 90));
        return {
          id: child.id,
          x: it.x,
          y: it.y + relY,
          w: it.w || 320,
          h: h,
          isColumn: true
        };
      }
    }
  }
  return null;
}
window.getNodeRect = getNodeRect;

function resolveEndpoint(end, items) {
  if (end?.itemId) {
    const rect = getNodeRect(end.itemId, items);
    if (rect) return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }
  return { x: end?.x ?? 0, y: end?.y ?? 0 };
}

// ───── Enganche libre por el borde ─────
//
// Un extremo pegado a un nodo se guardaba solo como `{ itemId }`, y el sitio
// por el que salía la flecha se recalculaba con geometría en cada pintada: la
// flecha decidía sola por qué lado salir, y al mover los nodos se cambiaba de
// lado sola. Ahora un extremo puede llevar además `frac`, que es dónde se
// agarró EN EL NODO, en coordenadas de 0 a 1 (0,0 la esquina de arriba a la
// izquierda; 1,1 la de abajo a la derecha). Con eso el enganche se queda donde
// lo dejaste y se puede mover por todo el borde, no solo por los cuatro
// puntos de siempre.
//
// Sin `frac` todo sigue como estaba, así que las flechas ya hechas no cambian.

// Lleva un punto cualquiera del nodo al borde más cercano, en fracciones.
function fracEnElBorde(rect, x, y) {
  const w = rect.w || 1, h = rect.h || 1;
  let u = (x - rect.x) / w, v = (y - rect.y) / h;
  u = Math.min(1, Math.max(0, u));
  v = Math.min(1, Math.max(0, v));
  // ¿Qué borde está más cerca? El de menos distancia en fracción.
  const dIzq = u, dDer = 1 - u, dArr = v, dAba = 1 - v;
  const min = Math.min(dIzq, dDer, dArr, dAba);
  if (min === dIzq) u = 0; else if (min === dDer) u = 1;
  else if (min === dArr) v = 0; else v = 1;
  // Imán a los cuatro de siempre y a las esquinas: son los que uno busca el
  // 90% de las veces, y sin imán es imposible clavarlos con el pulso.
  const IMAN = 0.08;
  const pega = (t) => (Math.abs(t - 0.5) < IMAN ? 0.5 : (t < IMAN ? 0 : (t > 1 - IMAN ? 1 : t)));
  if (u === 0 || u === 1) v = pega(v); else u = pega(u);
  return { x: +u.toFixed(3), y: +v.toFixed(3) };
}

// El punto de la pantalla al que corresponde un `frac`, y por qué lado sale.
function puntoDeFrac(rect, frac) {
  const p = { x: rect.x + frac.x * rect.w, y: rect.y + frac.y * rect.h };
  // El lado por el que sale: el borde sobre el que está posado el punto.
  let dir = 'h', sgn = 1;
  if (frac.x === 0)      { dir = 'h'; sgn = -1; }
  else if (frac.x === 1) { dir = 'h'; sgn = 1; }
  else if (frac.y === 0) { dir = 'v'; sgn = -1; }
  else if (frac.y === 1) { dir = 'v'; sgn = 1; }
  else {
    // Por dentro (no debería, pero por si acaso): al borde más cercano.
    const f = fracEnElBorde(rect, p.x, p.y);
    return puntoDeFrac(rect, f);
  }
  return { p, dir, sgn };
}

function endInfo(end, items) {
  if (end?.itemId) {
    const rect = getNodeRect(end.itemId, items);
    if (rect) return {
      item: rect,
      center: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
      frac: end.frac && typeof end.frac.x === 'number' ? end.frac : null,
    };
  }
  return { item: null, center: { x: end?.x ?? 0, y: end?.y ?? 0 }, frac: null };
}

function Connector({ conn, items, selected, selectedIds, onSelect, onUpdate, onDragNodes, onDragNodesEnd, panZoom, screenToCanvas, layer, theme }) {
  const from = conn.fromEnd || (conn.from ? { itemId: conn.from } : null);
  const to = conn.toEnd || (conn.to ? { itemId: conn.to } : null);
  if (!from || !to) return null;

  const A = endInfo(from, items);
  const B = endInfo(to, items);
  const cA = A.center, cB = B.center;
  const bend = conn.bend || { x: 0, y: 0 };
  const shape = conn.shape || 'curve';

  // Move a point toward a target by `g` pixels (clamped so it never overshoots)
  const moveToward = (from, to, g) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    const l = Math.hypot(dx, dy) || 1;
    const gg = Math.min(g, l * 0.6);
    return { x: from.x + (dx / l) * gg, y: from.y + (dy / l) * gg };
  };
  const GAP = 16;

  let eA, eB, p1, p2, qx, qy, path, hx, hy, angleEnd, angleStart, exADir, exBDir;
  let rectaSA = null, rectaSB = null;  // por dónde sale y entra la flecha recta
  let rectaCodos = null;               // sus codos (automáticos o hechos a mano)
  let rectaVerts = null;               // el recorrido que se ve, ya limpio
  let rectaTramos = null;              // los tramos que se pueden arrastrar
  const rectaAMano = shape === 'orthogonal' && window.FlechaRecta.esAMano(conn);

  if (shape === 'orthogonal') {
    const FR = window.FlechaRecta;
    if (!rectaAMano) {
      // Sin tocar: se rehace entera cada vez con los nodos donde estén ahora.
      const ruta = FR.automatica(
        A.item ? { rect: A.item, frac: A.frac } : { punto: cA },
        B.item ? { rect: B.item, frac: B.frac } : { punto: cB });
      rectaSA = ruta.sA; rectaSB = ruta.sB; rectaCodos = ruta.codos;
    } else {
      // Hecha a mano: sus codos, tal cual, sin limpiar ni recolocar nada.
      rectaCodos = conn.ortho.map(p => ({ x: p.x, y: p.y }));
      rectaSA = salidaRecta(A, rectaCodos.length ? rectaCodos[0] : cB);
      rectaSB = salidaRecta(B, rectaCodos.length ? rectaCodos[rectaCodos.length - 1] : cA);
    }
    eA = rectaSA.e; eB = rectaSB.e;
    p1 = rectaSA.p; p2 = rectaSB.p;
    exADir = rectaSA.dir; exBDir = rectaSB.dir;
    rectaVerts = FR.limpia(FR.construye(p1, exADir, rectaCodos, p2, exBDir).verts);
    // Esquinas redondeadas (aspecto Miro).
    path = roundedOrthoPath(rectaVerts, 8);
    const medio = puntoEnMedio(rectaVerts);
    hx = medio.x; hy = medio.y;
    const cn = rectaVerts.length;
    angleEnd = cn >= 2 ? Math.atan2(rectaVerts[cn - 1].y - rectaVerts[cn - 2].y, rectaVerts[cn - 1].x - rectaVerts[cn - 2].x) : 0;
    angleStart = cn >= 2 ? Math.atan2(rectaVerts[0].y - rectaVerts[1].y, rectaVerts[0].x - rectaVerts[1].x) : 0;
    // Cada tramo que se ve, con su tirador. Uno por tramo de verdad (ya
    // juntados los que siguen la misma recta), no uno por cada trozo interno.
    rectaTramos = [];
    for (let i = 0; i < cn - 1; i++) {
      const a = rectaVerts[i], b = rectaVerts[i + 1];
      if (Math.abs(b.x - a.x) + Math.abs(b.y - a.y) < 10) continue;
      rectaTramos.push({
        i, from: a, to: b,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        // 'y': tramo horizontal, se mueve arriba y abajo; 'x': vertical.
        axis: Math.abs(a.y - b.y) < 0.5 ? 'y' : 'x',
      });
    }
  } else {
    // Punto de control del arco.
    //
    // Antes se sacaba del punto medio de los CENTROS. Con dos nodos de tamano
    // muy distinto eso no es el medio de la linea que se ve: el borde del nodo
    // grande queda lejisimos de su centro y el del pequeno casi encima, asi que
    // el medio de los centros se corre hacia el nodo pequeno y el tirador
    // aparecia pegado a el. Con nodos muy juntos era descarado.
    //
    // Ahora se afina en dos pasadas: con el medio de los centros se averiguan
    // los bordes, y con el medio de esos BORDES —que si es el medio del tramo
    // visible— se vuelven a calcular. Dos pasadas bastan; la tercera ya no
    // mueve nada apreciable.
    let qBase = { x: (cA.x + cB.x) / 2, y: (cA.y + cB.y) / 2 };
    for (let pasada = 0; pasada < 2; pasada++) {
      const bA = A.item ? edgeIntersect(A.item, qBase.x, qBase.y) : cA;
      const bB = B.item ? edgeIntersect(B.item, qBase.x, qBase.y) : cB;
      qBase = { x: (bA.x + bB.x) / 2, y: (bA.y + bB.y) / 2 };
    }
    qx = qBase.x + bend.x;
    qy = qBase.y + bend.y;
    // Con enganche guardado, la curva también sale por ahí en vez de buscar el
    // corte con el borde: si no, mover el tirador de un extremo no servía de
    // nada en modo curva.
    eA = A.frac && A.item ? puntoDeFrac(A.item, A.frac).p : (A.item ? edgeIntersect(A.item, qx, qy) : cA);
    eB = B.frac && B.item ? puntoDeFrac(B.item, B.frac).p : (B.item ? edgeIntersect(B.item, qx, qy) : cB);
    p1 = moveToward(eA, { x: qx, y: qy }, GAP);
    p2 = moveToward(eB, { x: qx, y: qy }, GAP);
    path = `M ${p1.x} ${p1.y} Q ${qx} ${qy} ${p2.x} ${p2.y}`;
    hx = 0.25 * p1.x + 0.5 * qx + 0.25 * p2.x;
    hy = 0.25 * p1.y + 0.5 * qy + 0.25 * p2.y;
    angleEnd = Math.atan2(p2.y - qy, p2.x - qx);   // arrival direction at the head
    angleStart = Math.atan2(p1.y - qy, p1.x - qx); // arrival direction at the tail (bidir)
  }

  const themeInk = theme === 'dark' ? '#F0EEF0' : '#1A1A1A';
  let strokeColor = conn.isColorExplicit ? (conn.color || themeInk) : themeInk;
  if (strokeColor === 'var(--ink)') {
    strokeColor = themeInk;
  }
  const isMultiSelected = selectedIds && selectedIds.includes(conn.id);
  // Seleccionar una flecha ya NO la repinta de vino. Antes se ponia toda roja
  // —linea, punta y etiqueta— y con eso desaparecia el color que la persona
  // habia elegido justo antes: elegias verde, la seleccionabas para seguir
  // trabajando, y lo que veias era rojo.
  //
  // Lo que marca que esta seleccionada son los tiradores, que ya salen en vino
  // y solo aparecen al seleccionarla, mas un trazo un poco mas grueso. Con eso
  // basta, y el color se queda donde tiene que estar: en la flecha.
  const sel = strokeColor;
  const bidir = !!conn.bidirectional;
  const label = conn.label || '';

  // Label pill follows the connector colour; pick readable text via luminance for hex colours
  let labelText = '#fff';
  if (!selected && /^#/.test(strokeColor)) {
    const c = strokeColor.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    if ((0.299 * r + 0.587 * g + 0.114 * b) > 150) labelText = '#1A1A1A';
  }

  const arrowPts = (px, py, ang) => {
    const ah = 11, aw = 7;
    const a1x = px - ah * Math.cos(ang) + aw * Math.cos(ang + Math.PI / 2);
    const a1y = py - ah * Math.sin(ang) + aw * Math.sin(ang + Math.PI / 2);
    const a2x = px - ah * Math.cos(ang) - aw * Math.cos(ang + Math.PI / 2);
    const a2y = py - ah * Math.sin(ang) - aw * Math.sin(ang + Math.PI / 2);
    return `${px},${py} ${a1x},${a1y} ${a2x},${a2y}`;
  };

  // Dotted "covered" segments (center → edge) — only for node-anchored ends
  const dottedA = A.item ? `M ${cA.x} ${cA.y} L ${eA.x} ${eA.y}` : null;
  const dottedB = B.item ? `M ${cB.x} ${cB.y} L ${eB.x} ${eB.y}` : null;

  const dashArray =
    conn.style === 'dashed' ? '10 7' :
    conn.style === 'dotted' ? '1 6' : null;

  const handleCurveDrag = (e) => {
    e.stopPropagation(); e.preventDefault();
    onSelect && onSelect(conn.id);
    const startX = e.clientX, startY = e.clientY;
    const startBendX = bend.x, startBendY = bend.y;
    const scale = panZoom?.scale || 1;
    // Curve uses a quadratic control point (curve midpoint moves at half rate → ×2);
    // orthogonal maps the bend 1:1 to the dragged segment.
    const mult = shape === 'orthogonal' ? 1 : 2;
    const onMove = (ev) => {
      const dxp = (ev.clientX - startX) / scale;
      const dyp = (ev.clientY - startY) / scale;
      onUpdate(conn.id, { bend: { x: startBendX + dxp * mult, y: startBendY + dyp * mult } });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Los extremos que salen por donde decidió el recorrido automático quedan
  // fijados ahí (como enganche) en cuanto alguien toca el recorrido: si no,
  // al mover un nodo la flecha podía cambiar de lado sola y el recorrido hecho
  // a mano dejaba de tener sentido.
  const fijaExtremos = () => {
    const patch = {};
    if (A.item && !A.frac && from?.itemId && rectaSA) {
      Object.assign(patch, { fromEnd: { itemId: from.itemId, frac: fracDeSalida(A.item, rectaSA), fijado: true }, from: undefined, fromAnchor: undefined });
    }
    if (B.item && !B.frac && to?.itemId && rectaSB) {
      Object.assign(patch, { toEnd: { itemId: to.itemId, frac: fracDeSalida(B.item, rectaSB), fijado: true }, to: undefined, toAnchor: undefined });
    }
    return patch;
  };

  // Volver al recorrido automático (doble clic en un tirador de tramo, o el
  // botón de la barra de la flecha).
  const vuelveAutomatica = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    onUpdate(conn.id, window.FlechaRecta.patchAutomatica(conn));
    window.playAudioTone && window.playAudioTone('click');
  };

  // ── Arrastrar un tramo ──
  //
  // Se mueve en paralelo a sí mismo (uno horizontal, arriba y abajo; uno
  // vertical, a los lados), con los tramos de al lado estirándose para
  // seguirle. Se trabaja con los vértices que se ven: se mueven los dos del
  // tramo y de ahí se sacan los codos. Si el tramo sale de un nodo, ese
  // extremo no se puede mover, así que junto a la salida aparece un escalón.
  // Imán a la altura de los otros vértices, para poder dejarlo recto.
  const handleTramoDrag = (tramo) => (e) => {
    e.stopPropagation(); e.preventDefault();
    onSelect && onSelect(conn.id);
    const FR = window.FlechaRecta;
    const startX = e.clientX, startY = e.clientY;
    const scale = panZoom?.scale || 1;
    const axis = tramo.axis;
    const sA = rectaSA, sB = rectaSB;
    let arr = rectaVerts.map(p => ({ x: p.x, y: p.y }));

    // ── Una línea recta se MUEVE, no se dobla ──
    // Un solo tramo recto entre dos nodos: se deslizan los dos enganches a la
    // vez por sus bordes y la línea entera se corre, sin escalón.
    if (arr.length === 2 && A.item && B.item && from?.itemId && to?.itemId) {
      const rectA = A.item, rectB = B.item;
      const iniA = A.frac ? { ...A.frac } : fracDeSalida(rectA, sA);
      const iniB = B.frac ? { ...B.frac } : fracDeSalida(rectB, sB);
      const largo = axis === 'y' ? 'h' : 'w';
      const eje = axis === 'y' ? 'y' : 'x';
      const onMoveRecta = (ev) => {
        const d = axis === 'y' ? (ev.clientY - startY) / scale : (ev.clientX - startX) / scale;
        const mueve = (rect, ini) => {
          const t = Math.min(1, Math.max(0, ini[eje] + d / (rect[largo] || 1)));
          const f = { ...ini };
          f[eje] = +t.toFixed(3);
          const IMAN = 0.06;
          if (Math.abs(f[eje] - 0.5) < IMAN) f[eje] = 0.5;
          else if (f[eje] < IMAN) f[eje] = 0;
          else if (f[eje] > 1 - IMAN) f[eje] = 1;
          return f;
        };
        onUpdate(conn.id, {
          fromEnd: { itemId: from.itemId, frac: mueve(rectA, iniA) },
          toEnd:   { itemId: to.itemId,   frac: mueve(rectB, iniB) },
          from: undefined, to: undefined, fromAnchor: undefined, toAnchor: undefined,
        });
      };
      const onUpRecta = () => {
        window.removeEventListener('mousemove', onMoveRecta);
        window.removeEventListener('mouseup', onUpRecta);
      };
      window.addEventListener('mousemove', onMoveRecta);
      window.addEventListener('mouseup', onUpRecta);
      return;
    }

    const fijos = fijaExtremos();
    const ESCALON = 18;
    const avanza = (a, b, d) => ({ x: a.x + Math.sign(b.x - a.x) * d, y: a.y + Math.sign(b.y - a.y) * d });
    const largoDe = (a, b) => Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    let iA = tramo.i, iB = tramo.i + 1;
    if (iA === 0) {
      const s = avanza(arr[0], arr[1], Math.min(ESCALON, largoDe(arr[0], arr[1]) / 3));
      arr = [arr[0], s, { ...s }, ...arr.slice(1)];
      iA = 2; iB += 2;
    }
    if (iB === arr.length - 1) {
      const u = arr.length - 1;
      const s = avanza(arr[u], arr[u - 1], Math.min(ESCALON, largoDe(arr[u], arr[u - 1]) / 3));
      arr = [...arr.slice(0, u), { ...s }, s, arr[u]];
      iB = u;
    }
    const startVal = arr[iA][axis];
    const imanes = arr.filter((_, k) => k !== iA && k !== iB).map(p => p[axis]);
    const calcula = (ev) => {
      const d = axis === 'x' ? (ev.clientX - startX) / scale : (ev.clientY - startY) / scale;
      let val = startVal + d;
      let cerca = 8 / scale;
      for (const c of imanes) {
        if (Math.abs(c - val) < cerca) { cerca = Math.abs(c - val); val = c; }
      }
      const nuevo = arr.map((p, k) => (k >= iA && k <= iB ? { ...p, [axis]: val } : p));
      return FR.codosDeVertices(nuevo, sA.dir, sB.dir);
    };
    const onMove = (ev) => {
      const codos = calcula(ev);
      if (codos) onUpdate(conn.id, { ...fijos, ortho: codos, orthoManual: true, bend: undefined });
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const codos = calcula(ev);
      // Al soltar, y solo entonces, se quitan los tramos que han quedado en
      // cero y se juntan los que han quedado en la misma recta.
      if (codos) onUpdate(conn.id, { ...fijos, ortho: FR.limpiaCodos(codos, sA, sB), orthoManual: true, bend: undefined });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Drag the connector line itself: hold + move TRANSLATES the whole connector together
  // with its two attached nodes (the shape/curvature is preserved). A plain click
  // (no movement) selects it for editing.
  const handleLineDrag = (e) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const scale = panZoom?.scale || 1;
    // Capture starting positions of attached nodes and free endpoints
    const nodeStarts = [];
    if (A.item) nodeStarts.push({ id: A.item.id, x: A.item.x, y: A.item.y });
    if (B.item) nodeStarts.push({ id: B.item.id, x: B.item.x, y: B.item.y });
    const fromFree = !A.item ? { x: from.x ?? cA.x, y: from.y ?? cA.y } : null;
    const toFree = !B.item ? { x: to.x ?? cB.x, y: to.y ?? cB.y } : null;
    // Solo los codos de una flecha hecha a mano: la automática se rehace sola.
    const orthoStarts = rectaAMano ? (conn.ortho || []).map(p => ({ x: p.x, y: p.y })) : [];
    let moved = false;
    const onMove = (ev) => {
      const dxp = (ev.clientX - startX) / scale;
      const dyp = (ev.clientY - startY) / scale;
      if (!moved && (Math.abs(dxp) > 2 || Math.abs(dyp) > 2)) moved = true;
      if (!moved) return;
      if (nodeStarts.length && onDragNodes) {
        onDragNodes(nodeStarts.map(n => ({ id: n.id, x: Math.round(n.x + dxp), y: Math.round(n.y + dyp) })));
      }
      if (fromFree) onUpdate(conn.id, { fromEnd: { x: fromFree.x + dxp, y: fromFree.y + dyp } });
      if (toFree)   onUpdate(conn.id, { toEnd:   { x: toFree.x + dxp,   y: toFree.y + dyp } });
      if (orthoStarts.length) {
        const nextOrtho = orthoStarts.map(p => ({ x: p.x + dxp, y: p.y + dyp }));
        onUpdate(conn.id, { ortho: nextOrtho });
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!moved) { onSelect && onSelect(conn.id); }            // plain click → edit mode
      else {
        if (nodeStarts.length && onDragNodesEnd) onDragNodesEnd(nodeStarts.map(n => n.id)); // commit
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Drag the center anchor to re-attach to another node, or drop on empty canvas to free it
  const handleEndpointDrag = (which) => (e) => {
    e.stopPropagation(); e.preventDefault();
    onSelect && onSelect(conn.id);
    const inicial = (which === 'from' ? from : to)?.itemId;
    let ultimo = inicial;
    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY);
      
      // Temporarily bypass pointer events on the overlay so we can see the item underneath
      const overlay = document.querySelector('.connectors-top');
      let oldPE = '';
      if (overlay) {
        oldPE = overlay.style.pointerEvents;
        overlay.style.pointerEvents = 'none';
      }
      
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      
      if (overlay) {
        overlay.style.pointerEvents = oldPE;
      }

      const itemEl = el?.closest('.item, .col-child-wrap');
      const targetId = itemEl?.getAttribute('data-item-id');
      if (targetId) {
        // Se guarda POR DÓNDE se soltó, no solo a qué nodo: el enganche se
        // queda ahí y se puede poner en cualquier punto del borde, con imán a
        // los cuatro de siempre y a las esquinas.
        const rect = getNodeRect(targetId, items);
        const newEnd = rect
          ? { itemId: targetId, frac: fracEnElBorde(rect, p.x, p.y) }
          : { itemId: targetId };
        ultimo = targetId;
        onUpdate(conn.id, which === 'from' ? { fromEnd: newEnd, from: undefined, fromAnchor: undefined } : { toEnd: newEnd, to: undefined, toAnchor: undefined });
      } else {
        ultimo = null;
        const newEnd = { x: p.x, y: p.y };
        onUpdate(conn.id, which === 'from' ? { fromEnd: newEnd, from: undefined, fromAnchor: undefined } : { toEnd: newEnd, to: undefined, toAnchor: undefined });
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // Pegada a otro nodo (o soltada), los codos hechos a mano ya no tienen
      // sentido: la flecha recta vuelve a su recorrido automático.
      if (shape === 'orthogonal' && rectaAMano && ultimo !== inicial) {
        const p = window.FlechaRecta.patchAutomatica(conn);
        // El extremo recién soltado se queda como lo dejó quien lo arrastró.
        if (which === 'from') delete p.fromEnd; else delete p.toEnd;
        onUpdate(conn.id, p);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Mover el punto de enganche por el borde del nodo, sin soltarlo de él.
  //
  // Es el tirador que faltaba: el del centro sirve para cambiar de nodo, pero
  // no para decir POR DÓNDE entra la flecha. Este se queda siempre en el mismo
  // nodo y se pasea por todo su borde, con imán a los cuatro puntos de siempre
  // y a las esquinas.
  const handleAnchorSlide = (which) => (e) => {
    e.stopPropagation(); e.preventDefault();
    onSelect && onSelect(conn.id);
    const end = which === 'from' ? from : to;
    if (!end?.itemId) return;
    // El lado por el que sale ahora. Si el enganche se pasa a otro lado, los
    // codos hechos a mano dejarían la flecha entrando al revés: se vuelve al
    // recorrido automático.
    const ladoInicial = (which === 'from' ? rectaSA : rectaSB)?.lado || null;
    const onMove = (ev) => {
      const rect = getNodeRect(end.itemId, items);
      if (!rect) return;
      const p = screenToCanvas(ev.clientX, ev.clientY);
      const frac = fracEnElBorde(rect, p.x, p.y);
      const nuevo = { itemId: end.itemId, frac };
      const patch = which === 'from'
        ? { fromEnd: nuevo, from: undefined, fromAnchor: undefined }
        : { toEnd: nuevo, to: undefined, toAnchor: undefined };
      if (shape === 'orthogonal' && rectaAMano && ladoInicial && window.FlechaRecta.ladoDeFrac(frac) !== ladoInicial) {
        const auto = window.FlechaRecta.patchAutomatica(conn);
        patch.ortho = undefined;
        patch.orthoManual = undefined;
        // El otro extremo, si lo fijó la aplicación, se suelta también.
        if (which === 'from' && auto.toEnd) patch.toEnd = auto.toEnd;
        if (which === 'to' && auto.fromEnd) patch.fromEnd = auto.fromEnd;
      }
      onUpdate(conn.id, patch);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // The handles layer (rendered ABOVE nodes) only carries the interactive
  // controls so the center anchors stay grabbable even when they sit inside a node.
  if (layer === 'handles') {
    if (!selected) return null;
    // Los tiradores miden lo mismo en pantalla al alejar el zoom (hasta el
    // triple): en coordenadas del lienzo encogían con él y, alejado, no había
    // forma de agarrar una píldora de cuatro píxeles.
    const k = Math.min(3, Math.max(1, 1 / (panZoom?.scale || 1)));
    return (
      <g>
        {/* Dotted covered segments — center → node edge, drawn over the node */}
        {dottedA && <path className="connector-covered" d={dottedA} style={{ stroke: sel }}/>}
        {dottedB && <path className="connector-covered" d={dottedB} style={{ stroke: sel }}/>}
        {/* Center anchor handles */}
        <circle className="connector-handle endpoint" cx={cA.x} cy={cA.y} r={8 * k} onMouseDown={handleEndpointDrag('from')}/>
        <circle className="connector-handle endpoint" cx={cB.x} cy={cB.y} r={8 * k} onMouseDown={handleEndpointDrag('to')}/>
        {/* Enganche: solo si esa punta está pegada a un nodo. Se pasea por su
            borde y no se despega. Doble clic lo devuelve a automático. */}
        {A.item && (
          <circle
            className="connector-handle anchor-slide" cx={eA.x} cy={eA.y} r={6 * k}
            onMouseDown={handleAnchorSlide('from')}
            onDoubleClick={(ev)=>{ ev.stopPropagation(); onUpdate(conn.id, { fromEnd: { itemId: from.itemId } }); }}
          />
        )}
        {B.item && (
          <circle
            className="connector-handle anchor-slide" cx={eB.x} cy={eB.y} r={6 * k}
            onMouseDown={handleAnchorSlide('to')}
            onDoubleClick={(ev)=>{ ev.stopPropagation(); onUpdate(conn.id, { toEnd: { itemId: to.itemId } }); }}
          />
        )}
        {shape === 'orthogonal' ? (
          <>
            {/* Un tirador por tramo: una píldora en su centro, tumbada a lo
                largo del tramo, que se arrastra en perpendicular. También se
                puede coger el tramo por cualquier sitio. Doble clic devuelve
                la flecha a su recorrido automático. */}
            {rectaTramos && rectaTramos.map(t => {
              const tumbada = t.axis === 'y';
              return (
                <g key={`tramo-${t.i}`}>
                  <path
                    d={`M ${t.from.x} ${t.from.y} L ${t.to.x} ${t.to.y}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14 * k}
                    style={{ cursor: t.axis === 'x' ? 'ew-resize' : 'ns-resize', pointerEvents: 'stroke' }}
                    onMouseDown={handleTramoDrag(t)}
                    onDoubleClick={rectaAMano ? vuelveAutomatica : undefined}
                  />
                  {/* La píldora solo en tramos con sitio: en uno corto tapaba la
                      punta de la flecha y se amontonaba con la de al lado. Esos
                      se agarran igual por la propia línea. */}
                  {Math.abs(t.to.x - t.from.x) + Math.abs(t.to.y - t.from.y) >= 36 && <rect
                    className="connector-handle seg-move"
                    x={t.mid.x - (tumbada ? 10 : 4) * k} y={t.mid.y - (tumbada ? 4 : 10) * k}
                    width={(tumbada ? 20 : 8) * k} height={(tumbada ? 8 : 20) * k} rx={4 * k}
                    style={{ cursor: t.axis === 'x' ? 'ew-resize' : 'ns-resize', pointerEvents: 'all' }}
                    onMouseDown={handleTramoDrag(t)}
                    onDoubleClick={rectaAMano ? vuelveAutomatica : undefined}
                  />}
                </g>
              );
            })}
          </>
        ) : (
          /* Curve bend handle */
          <circle className="connector-handle curve" cx={hx} cy={hy} r={7 * k} onMouseDown={handleCurveDrag}/>
        )}
      </g>
    );
  }

  // The lines layer (rendered BELOW nodes) carries the path, arrowheads and label.
  return (
    <g>
      {/* Invisible wide hit area — hold + drag moves the connector (no edit mode);
          a plain click selects it for editing. */}
      <path
        className="connector-hit"
        d={path}
        onMouseDown={handleLineDrag}
      />
      {/* Visible solid line */}
      <path
        className={`connector-path ${selected ? 'selected' : ''}`}
        d={path}
        style={{ stroke: sel }}
        strokeDasharray={dashArray}
        // El unico rastro de la seleccion en la propia linea: un pelo mas
        // gruesa. Vale tambien para la seleccion multiple, que antes solo se
        // notaba por el color y ahora no tendria nada.
        strokeWidth={(selected || isMultiSelected) ? 3 : 2}
      />
      {/* Arrowhead(s) */}
      <polygon className="arrowhead" points={arrowPts(p2.x, p2.y, angleEnd)} style={{ fill: sel }}/>
      {bidir && <polygon className="arrowhead" points={arrowPts(p1.x, p1.y, angleStart)} style={{ fill: sel }}/>}

      {/* Label */}
      {label && (
        <foreignObject x={hx - 75} y={hy - 13} width={150} height={26} style={{ overflow: 'visible', pointerEvents: 'none' }}>
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100%' }}>
            <span className="connector-label" style={{ background: sel, color: labelText, borderColor: sel }}>{label}</span>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

window.Connector = Connector;
window.getAnchorPoint = getAnchorPoint;
window.closestAnchorTo = closestAnchorTo;
window.resolveEndpoint = resolveEndpoint;
