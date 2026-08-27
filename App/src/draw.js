// =====================================================
// Odinote — geometría del nodo de dibujo (window.OdiDraw)
//
// Módulo sin React ni DOM: convierte los puntos que va soltando el puntero en
// trazos guardables y en el `d` de un <path>. Se puede ejercitar entero desde
// Node (scripts/test-draw.js), que es donde se comprueba lo que de verdad
// importa aquí: que un trazo de mil puntos no acabe guardado tal cual dentro
// del proyecto.
//
// Un trazo es:
//   { id, color, width, pts: [[x, y, f], ...] }
// donde `f` es el factor de grosor de ese punto (1 = el grosor base). De ahí
// salen las dos formas de pintar: si todos los puntos valen lo mismo basta una
// línea con `stroke-width`; si varían hay que dibujar el contorno, porque un
// <path> no sabe engordar y adelgazar por el camino.
// =====================================================
(function () {
  'use strict';

  // ── Grosor por presión / velocidad ──
  //
  // El lápiz da presión de verdad (0..1). El ratón no: siempre manda 0.5, así
  // que ahí el grosor sale de lo rápido que se mueva la mano. Trazo lento =
  // línea gorda, trazo rápido = línea fina, que es como se comporta la tinta.
  const MIN_F = 0.5;
  const MAX_F = 1.12;

  // ── Estabilizador de la mano ──
  //
  // El puntero llega con todo el temblor de la muñeca, y una raya larga salía
  // ondulada. Aquí el punto que se dibuja PERSIGUE al puntero en vez de saltar
  // a él: se queda un poco por detrás y llega en un par de muestras, que es lo
  // que hace que la línea salga limpia sin que se note retraso al dibujar.
  // Es el mismo truco que usa cualquier programa de dibujo.
  // Se persigue DOS veces: un punto intermedio persigue al puntero y el que se
  // dibuja persigue a ese. Con una sola pasada el temblor apenas bajaba un
  // tercio; encadenando dos se corta de verdad sin añadir apenas retraso.
  const CHASE = 0.42;
  function stabilize(prev, raw, k) {
    if (!prev) return { x: raw.x, y: raw.y, x1: raw.x, y1: raw.y };
    const w = k == null ? CHASE : k;
    const x1 = prev.x1 + (raw.x - prev.x1) * w;
    const y1 = prev.y1 + (raw.y - prev.y1) * w;
    return {
      x: prev.x + (x1 - prev.x) * w,
      y: prev.y + (y1 - prev.y) * w,
      x1, y1,
    };
  }

  function clampFactor(f) {
    return Math.max(MIN_F, Math.min(MAX_F, f));
  }

  function factorFromPressure(pressure) {
    // Chromium manda 0 cuando el aparato no informa y 0.5 cuando es un ratón.
    const p = (pressure === 0 || pressure == null) ? 0.5 : pressure;
    return clampFactor(0.3 + p * 1.1);
  }

  // velocidad en píxeles por milisegundo; ~0.5 px/ms es un trazo tranquilo
  function factorFromSpeed(speed) {
    if (!isFinite(speed) || speed < 0) return 1;
    return clampFactor(MAX_F - speed * 0.26);
  }

  // Suavizado exponencial más un tope de cuánto puede cambiar el grosor de un
  // punto al siguiente. Sin el tope, entre dos puntos alejados (la
  // simplificación deja pocos) el borde daba un escalón visible, y un trazo
  // grueso parecía montado con piezas rectas.
  const MAX_STEP = 0.07;
  function smoothFactor(prev, next, weight) {
    if (prev == null) return next;
    const w = weight == null ? 0.22 : weight;
    const target = prev + (next - prev) * w;
    if (target - prev > MAX_STEP) return prev + MAX_STEP;
    if (prev - target > MAX_STEP) return prev - MAX_STEP;
    return target;
  }

  // Devuelve el factor de grosor para un punto nuevo, según el modo.
  //   mode: 'uniform' | 'pressure' | 'speed'
  //   sample: { x, y, t, pressure }
  //   prev:   la muestra anterior (o null)
  //   prevFactor: el factor ya suavizado del punto anterior (o null)
  function factorFor(mode, sample, prev, prevFactor) {
    if (mode === 'uniform') return 1;
    let raw;
    if (mode === 'pressure') {
      raw = factorFromPressure(sample.pressure);
    } else {
      if (!prev) return smoothFactor(prevFactor, 1, 0.5);
      const dt = Math.max(1, (sample.t || 0) - (prev.t || 0));
      const dx = sample.x - prev.x;
      const dy = sample.y - prev.y;
      raw = factorFromSpeed(Math.sqrt(dx * dx + dy * dy) / dt);
    }
    return smoothFactor(prevFactor, raw, 0.35);
  }

  // ── Simplificación (Ramer–Douglas–Peucker) ──
  //
  // El puntero dispara hasta 120 veces por segundo: medio minuto dibujando son
  // miles de puntos que acabarían en el JSON del proyecto, en cada instantánea
  // de deshacer y en cada subida a Drive. Al soltar el trazo se queda solo con
  // los puntos que cambian su forma.
  function perpDistance(p, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }

  function simplify(pts, epsilon) {
    const eps = epsilon == null ? 0.6 : epsilon;
    if (!pts || pts.length <= 2) return (pts || []).slice();
    const keep = new Array(pts.length).fill(false);
    keep[0] = true;
    keep[pts.length - 1] = true;
    // Pila explícita: un trazo largo desbordaría la recursión.
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [first, last] = stack.pop();
      let maxDist = 0;
      let idx = -1;
      for (let i = first + 1; i < last; i++) {
        const d = perpDistance(pts[i], pts[first], pts[last]);
        if (d > maxDist) { maxDist = d; idx = i; }
      }
      if (idx !== -1 && maxDist > eps) {
        keep[idx] = true;
        stack.push([first, idx], [idx, last]);
      }
    }
    const out = [];
    for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
    return out;
  }

  function roundPts(pts, decimals) {
    const m = Math.pow(10, decimals == null ? 1 : decimals);
    return (pts || []).map(p => [
      Math.round(p[0] * m) / m,
      Math.round(p[1] * m) / m,
      Math.round((p[2] == null ? 1 : p[2]) * 100) / 100,
    ]);
  }

  // Trazo terminado: se simplifica, se redondea y se descartan los que no son
  // más que un temblor de la mano al hacer clic.
  function finishStroke(stroke, epsilon) {
    const pts = roundPts(simplify(stroke.pts || [], epsilon), 1);
    if (pts.length === 0) return null;
    if (pts.length === 1) {
      // Un punto suelto sí vale: es un lunar de tinta. Se guarda duplicado
      // para que el trazado tenga a dónde ir.
      pts.push([pts[0][0] + 0.01, pts[0][1], pts[0][2]]);
    }
    return { ...stroke, pts };
  }

  // ── Trazado ──
  function isUniform(stroke) {
    const pts = stroke.pts || [];
    for (let i = 0; i < pts.length; i++) {
      const f = pts[i][2] == null ? 1 : pts[i][2];
      if (Math.abs(f - 1) > 0.02) return false;
    }
    return true;
  }

  const n2 = (v) => Math.round(v * 100) / 100;

  // Centro de dos puntos: la polilínea se redondea uniendo los puntos medios
  // con curvas cuadráticas, el truco de toda la vida para que un trazo a mano
  // no salga con esquinas.
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${n2(pts[0][0])} ${n2(pts[0][1])}`;
    if (pts.length === 2) return d + ` L ${n2(pts[1][0])} ${n2(pts[1][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q ${n2(pts[i][0])} ${n2(pts[i][1])} ${n2(mx)} ${n2(my)}`;
    }
    const last = pts[pts.length - 1];
    return d + ` L ${n2(last[0])} ${n2(last[1])}`;
  }

  // Anillo cerrado dibujado con curvas: cada vértice se convierte en el punto
  // de control de una cuadrática que pasa por los puntos medios. Es lo que
  // quita las esquinas — con segmentos rectos el contorno se ve facetado, y en
  // un trazo grueso eso parece hecho de cuadrados.
  function smoothRing(ring) {
    const n = ring.length;
    if (n < 3) return '';
    const midX = (a, b) => (a[0] + b[0]) / 2;
    const midY = (a, b) => (a[1] + b[1]) / 2;
    let d = `M ${n2(midX(ring[n - 1], ring[0]))} ${n2(midY(ring[n - 1], ring[0]))}`;
    for (let i = 0; i < n; i++) {
      const cur = ring[i];
      const nxt = ring[(i + 1) % n];
      d += ` Q ${n2(cur[0])} ${n2(cur[1])} ${n2(midX(cur, nxt))} ${n2(midY(cur, nxt))}`;
    }
    return d + ' Z';
  }

  // Media circunferencia para rematar una punta. Se parte del vector normal
  // que corresponda y se gira media vuelta: girar la normal izquierda -90°
  // da justo la dirección de avance, así que el arco pasa por delante de la
  // punta en vez de morderla.
  const CAP_STEPS = 10;
  function capPoints(center, normal, steps) {
    const out = [];
    for (let i = 1; i < steps; i++) {
      const a = -Math.PI * (i / steps);
      const cos = Math.cos(a), sin = Math.sin(a);
      out.push([
        center[0] + normal[0] * cos - normal[1] * sin,
        center[1] + normal[0] * sin + normal[1] * cos,
      ]);
    }
    return out;
  }

  // Contorno de un trazo de grosor variable: se va por un lado, se remata la
  // punta en redondo, se vuelve por el otro y se remata el principio igual.
  function ribbonPath(pts, width) {
    const half = width / 2;
    const left = [];
    const right = [];
    const halves = [];
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[i - 1] || pts[i];
      const next = pts[i + 1] || pts[i];
      let dx = next[0] - prev[0];
      let dy = next[1] - prev[1];
      const len = Math.hypot(dx, dy);
      if (len < 0.0001) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
      const h = half * (pts[i][2] == null ? 1 : pts[i][2]);
      halves.push(h);
      left.push([pts[i][0] - dy * h, pts[i][1] + dx * h]);
      right.push([pts[i][0] + dy * h, pts[i][1] - dx * h]);
    }
    const last = pts.length - 1;
    const endNormal = [left[last][0] - pts[last][0], left[last][1] - pts[last][1]];
    const startNormal = [right[0][0] - pts[0][0], right[0][1] - pts[0][1]];
    const ring = left
      .concat(capPoints([pts[last][0], pts[last][1]], endNormal, CAP_STEPS))
      .concat(right.slice().reverse())
      .concat(capPoints([pts[0][0], pts[0][1]], startNormal, CAP_STEPS));
    return smoothRing(ring);
  }

  // Devuelve { d, fill } (grosor variable) o { d, stroke } (grosor constante).
  function strokeGeometry(stroke) {
    const pts = stroke.pts || [];
    if (pts.length === 0) return null;
    const width = stroke.width || 4;
    if (isUniform(stroke)) return { d: smoothPath(pts), mode: 'line', width };
    return { d: ribbonPath(pts, width), mode: 'fill', width };
  }

  // ── Medidas ──
  function strokesBounds(strokes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    (strokes || []).forEach(s => {
      const half = (s.width || 4) / 2 * MAX_F;
      (s.pts || []).forEach(p => {
        if (p[0] - half < minX) minX = p[0] - half;
        if (p[1] - half < minY) minY = p[1] - half;
        if (p[0] + half > maxX) maxX = p[0] + half;
        if (p[1] + half > maxY) maxY = p[1] + half;
      });
    });
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }

  function translateStrokes(strokes, dx, dy) {
    return (strokes || []).map(s => ({
      ...s,
      pts: (s.pts || []).map(p => [n2(p[0] + dx), n2(p[1] + dy), p[2]]),
    }));
  }

  // Estirar los trazos (el nodo se redimensionó). El grosor no puede ser
  // distinto a lo ancho y a lo alto, así que sigue a la media: solo se nota si
  // alguien deformó mucho la caja, y es preferible a que la línea se parta.
  function scaleStrokes(strokes, sx, sy) {
    const wf = (Math.abs(sx) + Math.abs(sy)) / 2;
    return (strokes || []).map(s => ({
      ...s,
      width: Math.max(0.5, n2((s.width || 4) * wf)),
      pts: (s.pts || []).map(p => [n2(p[0] * sx), n2(p[1] * sy), p[2]]),
    }));
  }

  // ¿Cae (x, y) sobre este trazo? Se usa para el borrador y para seleccionar
  // un trazo y moverlo, que son la misma pregunta.
  function hitStroke(stroke, x, y, tolerance) {
    const pts = stroke.pts || [];
    const tol = (tolerance || 0) + (stroke.width || 4) / 2 + 2;
    for (let i = 0; i < pts.length - 1; i++) {
      if (perpDistance([x, y], pts[i], pts[i + 1]) <= tol) return true;
    }
    return pts.length === 1 ? Math.hypot(pts[0][0] - x, pts[0][1] - y) <= tol : false;
  }

  // El último trazo dibujado es el que está "encima": se busca del final al
  // principio para que el borrador quite lo que se ve, no lo que hay debajo.
  function hitTest(strokes, x, y, tolerance) {
    for (let i = (strokes || []).length - 1; i >= 0; i--) {
      if (hitStroke(strokes[i], x, y, tolerance)) return strokes[i].id;
    }
    return null;
  }

  function totalPoints(strokes) {
    return (strokes || []).reduce((n, s) => n + (s.pts || []).length, 0);
  }

  const OdiDraw = {
    MIN_F, MAX_F,
    factorFromPressure, factorFromSpeed, factorFor, smoothFactor, stabilize, CHASE,
    simplify, finishStroke, roundPts,
    scaleStrokes,
    smoothPath, ribbonPath, strokeGeometry, isUniform,
    strokesBounds, translateStrokes,
    hitStroke, hitTest, totalPoints,
  };
  if (typeof window !== 'undefined') window.OdiDraw = OdiDraw;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiDraw;
})();
