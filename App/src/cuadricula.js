// =====================================================
// Oddinote — la cuadrícula del lienzo (window.OdiCuadricula)
//
// Pedido en la discusión 12 de GitHub: que los nodos se peguen a la
// cuadrícula y que se pueda cambiar su tamaño. Aquí van los ajustes y las
// cuentas, sin React ni DOM, para probarlos desde Node
// (scripts/test-cuadricula.js); Canvas.jsx los usa al mover y al estirar.
//
// Los ajustes son de ESTE equipo (localStorage), como el estabilizador del
// dibujo: no viajan en el proyecto. Así no hay nada nuevo que sincronizar, y
// un compañero con otro tamaño de cuadrícula no le cambia el suyo a nadie.
//
// Los puntos del fondo caen en los múltiplos del paso (Canvas corre el fondo
// medio paso para eso): la esquina de un nodo pegado queda ENCIMA de un
// punto, que es lo que se espera al ver la cuadrícula.
// =====================================================
(function () {
  const CLAVE = 'odinote.cuadricula';
  // 22 es lo que medía la cuadrícula de siempre: quien no toque nada la ve igual.
  const PASO_NORMAL = 22;
  const PASO_MIN = 8;
  const PASO_MAX = 80;
  const PASOS_RAPIDOS = [11, 22, 44];
  const EVENTO = 'odi-cuadricula';

  // Lo que venga de localStorage puede ser cualquier cosa (otra versión, una
  // mano en las herramientas de desarrollo): se deja siempre en algo válido.
  function limpia(c) {
    const o = c && typeof c === 'object' ? c : {};
    let paso = Math.round(Number(o.paso));
    if (!isFinite(paso) || paso <= 0) paso = PASO_NORMAL;
    paso = Math.max(PASO_MIN, Math.min(PASO_MAX, paso));
    return { iman: o.iman === true, paso };
  }

  function almacen() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }

  function lee(guardado) {
    const ls = guardado || almacen();
    try { return limpia(ls ? JSON.parse(ls.getItem(CLAVE) || 'null') : null); } catch (e) { return limpia(null); }
  }

  // Guarda y avisa: el lienzo, el botón del imán y el apartado de Ajustes
  // escuchan el mismo evento, así que cambiar en uno se ve en los otros.
  function guarda(cambio, guardado) {
    const ls = guardado || almacen();
    const nuevo = limpia({ ...lee(ls), ...(cambio || {}) });
    try { ls && ls.setItem(CLAVE, JSON.stringify(nuevo)); } catch (e) {}
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENTO, { detail: nuevo }));
      }
    } catch (e) {}
    return nuevo;
  }

  // ¿Pega este gesto? Alt lo suelta mientras se mantiene, para colocar algo
  // fino sin ir a apagar el imán.
  function activa(c, ev) {
    return !!(c && c.iman) && !(ev && ev.altKey);
  }

  const pega = (v, paso) => Math.round(v / paso) * paso;

  // Estirar con el imán: el borde que se mueve cae en la cuadrícula y el de
  // enfrente se queda donde estaba. Si la cuadrícula dejaría el nodo más
  // pequeño que su mínimo, se queda en el mínimo (antes que darle la vuelta).
  // `lado` es 'r' | 'l' | 'b' | 't'; ini es la posición y el tamaño de partida
  // en ese eje ({ p, t }) y `d` cuánto se ha movido el ratón en el lienzo.
  function estiraLado(lado, ini, d, paso, minimo) {
    if (lado === 'r' || lado === 'b') {
      let fin = pega(ini.p + ini.t + d, paso);
      if (fin - ini.p < minimo) fin = ini.p + minimo;
      return { p: ini.p, t: fin - ini.p };
    }
    const fin = ini.p + ini.t;
    let p = pega(ini.p + d, paso);
    if (fin - p < minimo) p = fin - minimo;
    return { p, t: fin - p };
  }

  // El dibujo del fondo para un paso: el mismo triangulito de siempre (no
  // crece con la cuadrícula: a 80 sería un borrón), en el centro de la
  // baldosa. Uno para el tema claro y otro para el oscuro, como en styles.css.
  function fondo(paso, oscuro) {
    const m = paso / 2;
    const n = (v) => Math.round(v * 10) / 10;
    const color = oscuro ? '%23F0EEF0' : '%231A1A1A';
    const opacidad = oscuro ? '0.18' : '0.13';
    return "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='" + paso + "' height='" + paso + "'%3E" +
      "%3Cpath d='M" + n(m) + ' ' + n(m - 1.5) + 'L' + n(m + 1.6) + ' ' + n(m + 1.3) + 'H' + n(m - 1.6) + "Z' fill='" + color + "' fill-opacity='" + opacidad + "'/%3E%3C/svg%3E\")";
  }

  const api = { CLAVE, EVENTO, PASO_NORMAL, PASO_MIN, PASO_MAX, PASOS_RAPIDOS, limpia, lee, guarda, activa, pega, estiraLado, fondo };
  if (typeof window !== 'undefined') window.OdiCuadricula = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
