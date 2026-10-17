// =====================================================
// Oddinote — cuánto está hecho (window.OdiProgreso)
//
// Lo que cuenta el nodo de progreso: las casillas de TODAS las listas de
// tareas, del proyecto entero o de un tablero y lo que tiene dentro, también
// las que están dentro de una columna. Sin React ni DOM: se prueba desde Node
// (scripts/test-progreso.js), que es donde se ve si cuenta bien.
//
// Una tarea con subtareas no se cuenta a la vez que sus subtareas: estaría
// dos veces (la lista la da por hecha cuando lo están todas las de debajo).
// Se cuentan solo las de abajo del todo. Y una fila vacía —la que trae una
// lista recién puesta— no es una tarea.
// =====================================================
(function () {
  // Los lienzos que se alcanzan desde uno: él y los de sus tableros, en
  // cualquier nivel (lo mismo que collectProjectCanvases de drive.js).
  function lienzosDesde(lienzos, raiz) {
    const vistos = {};
    const visita = (id) => {
      const c = lienzos && lienzos[id];
      if (!c || vistos[id]) return;
      vistos[id] = c;
      (c.items || []).forEach(it => {
        if (it.canvasId) visita(it.canvasId);
        (it.children || []).forEach(h => { if (h.canvasId) visita(h.canvasId); });
      });
    };
    visita(raiz);
    return vistos;
  }

  const sinTexto = (t) => {
    if (!t) return true;
    if (typeof t === 'string') return !t.replace(/<[^>]*>/g, '').trim();
    return Object.values(t).every(v => sinTexto(v));
  };

  // Las tareas de una lista: { hechas, total }.
  function cuentaLista(filas) {
    const lista = Array.isArray(filas) ? filas : [];
    let hechas = 0, total = 0;
    lista.forEach((f, i) => {
      const siguiente = lista[i + 1];
      const tieneHijas = siguiente && (siguiente.indent || 0) > (f.indent || 0);
      if (tieneHijas || sinTexto(f.text)) return;
      total++;
      if (f.done) hechas++;
    });
    return { hechas, total };
  }

  // Todas las de los lienzos que se alcanzan desde `raiz`.
  function cuenta(lienzos, raiz) {
    let hechas = 0, total = 0, listas = 0;
    const suma = (it) => {
      if (it && it.type === 'todo') {
        const c = cuentaLista(it.items);
        hechas += c.hechas; total += c.total;
        if (c.total) listas++;
      }
    };
    Object.values(lienzosDesde(lienzos, raiz)).forEach(c => {
      (c.items || []).forEach(it => {
        suma(it);
        (it.children || []).forEach(suma);
      });
    });
    return { hechas, total, listas, porcentaje: total ? Math.round(hechas / total * 100) : 0 };
  }

  const OdiProgreso = { lienzosDesde, cuentaLista, cuenta };
  if (typeof window !== 'undefined') window.OdiProgreso = OdiProgreso;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiProgreso;
})();
