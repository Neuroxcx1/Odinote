// =====================================================
// Odinote — búsqueda global (window.OdiSearch)
//
// El buscador del lienzo solo mira los nodos del lienzo que tienes delante:
// una nota metida en un tablero anidado a cuatro niveles era, en la práctica,
// irrecuperable. Esto recorre TODOS los proyectos y TODOS sus tableros
// anidados, y devuelve además la ruta de cada resultado para poder ir hasta él.
//
// Sin dependencias de React a propósito, para poder probarlo desde Node.
// =====================================================
(function () {

  // Texto buscable de un nodo. No vale con JSON.stringify: mete ids, colores y
  // coordenadas, y entonces buscar "note" o "fff" devuelve media aplicación.
  // forDisplay=false → todos los idiomas, para BUSCAR: el usuario pudo escribir
  //   en español y tener la interfaz en inglés.
  // forDisplay=true  → un solo idioma, para MOSTRAR: si no, la ruta salía como
  //   "Nuevo tablero New board" y el extracto repetía la frase dos veces.
  function nodeText(item, lang, forDisplay) {
    if (!item) return '';
    const pick = (v) => {
      if (v == null) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'object') {
        const vals = Object.values(v).filter(x => typeof x === 'string' && x);
        if (forDisplay) return v[lang] || v.es || v.en || vals[0] || '';
        // Sin duplicados: muchas notas guardan el mismo texto en cada idioma
        return Array.from(new Set(vals)).join(' ');
      }
      return '';
    };
    const parts = [
      pick(item.content), pick(item.title), pick(item.text), pick(item.body),
      pick(item.label), pick(item.caption), pick(item.name), pick(item.url),
    ];
    // Todo lo que sigue se comprueba con Array.isArray a propósito: estos
    // campos NO siempre son listas. En una tabla, `rows` es el NÚMERO de filas,
    // y dar por hecho que era un array reventaba el buscador entero al abrirlo.
    if (Array.isArray(item.items)) {
      item.items.forEach(row => parts.push(pick(row && row.text)));
    }
    // Celdas de una tabla: objeto { "fila,columna": { value } }
    if (item.cells && typeof item.cells === 'object') {
      Object.values(item.cells).forEach(cell => {
        if (cell && typeof cell === 'object') parts.push(pick(cell.value));
        else parts.push(pick(cell));
      });
    }
    // Tarjetas dentro de una columna
    if (Array.isArray(item.children)) {
      item.children.forEach(ch => parts.push(nodeText(ch, lang, forDisplay)));
    }

    // El texto enriquecido se guarda como HTML: se quitan las etiquetas para
    // que buscar "hambre" encuentre "<b>hambre</b>" y no falle por el marcado.
    return parts.join(' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Título legible de un lienzo, para construir la ruta.
  function canvasTitle(canvas, lang) {
    if (!canvas) return '';
    const t = canvas.title;
    if (typeof t === 'string') return t;
    if (t && typeof t === 'object') return t[lang] || t.es || t.en || Object.values(t)[0] || '';
    return '';
  }

  // Recorre un proyecto entero: su lienzo raíz y, siguiendo el canvasId de cada
  // nodo "board", todos los tableros anidados. Devuelve la ruta de cada lienzo.
  // El Set corta los ciclos, que un tablero mal enlazado podría provocar.
  function walkProject(canvases, rootId, rootLabel, lang) {
    const pages = [];
    const seen = new Set();
    // trail  = nombres, para enseñar la ruta al usuario
    // trailIds = la cadena de canvasId, que es lo que hace falta para poder
    //            plantarse en ese tablero (la pila de navegación del lienzo)
    const visit = (id, trail, trailIds) => {
      if (!id || seen.has(id)) return;
      const canvas = canvases[id];
      if (!canvas) return;
      seen.add(id);
      pages.push({ canvasId: id, path: trail, trailIds: trailIds });
      (Array.isArray(canvas.items) ? canvas.items : []).forEach(it => {
        if (!it || !it.canvasId) return;
        const label = nodeText(it, lang, true).slice(0, 40) || canvasTitle(canvases[it.canvasId], lang) || '…';
        visit(it.canvasId, trail.concat(label), trailIds.concat(it.canvasId));
      });
    };
    visit(rootId, [rootLabel], [rootId]);
    return pages;
  }

  // Busca `query` en todos los proyectos.
  //   projects : [{ id, name, deleted }]
  //   canvases : mapa plano de lienzos
  // Devuelve [{ projectId, canvasId, itemId, type, path, snippet }]
  function searchAll({ projects, canvases, query, lang, limit }) {
    const q = (query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const max = limit || 50;
    const out = [];

    for (const project of (projects || [])) {
      if (!project || project.deleted) continue;
      const rootLabel = (typeof project.name === 'object'
        ? (project.name[lang] || project.name.es || project.name.en || Object.values(project.name)[0])
        : project.name) || '';

      for (const page of walkProject(canvases, project.id, rootLabel, lang)) {
        const canvas = canvases[page.canvasId];
        const items = Array.isArray(canvas && canvas.items) ? canvas.items : [];
        for (const item of items) {
          if (!item) continue;
          const text = nodeText(item, lang, false);
          const hit = text.toLowerCase().indexOf(q);
          if (hit === -1) continue;
          // El extracto se saca del texto en un solo idioma; si la coincidencia
          // estaba en otro, se enseña el principio en vez de un trozo raro.
          const shown = nodeText(item, lang, true) || text;
          const at = shown.toLowerCase().indexOf(q);
          out.push({
            projectId: project.id,
            canvasId: page.canvasId,
            trailIds: page.trailIds,
            itemId: item.id,
            type: item.type || 'note',
            path: page.path,
            snippet: makeSnippet(shown, at === -1 ? 0 : at, q.length),
            // Nombre limpio del nodo, desde el principio: es lo que se pone
            // como texto del enlace, donde el extracto con contexto quedaba mal.
            label: shown.slice(0, 60).trim(),
          });
          if (out.length >= max) return out;
        }
      }
    }
    return out;
  }

  // Trozo de texto alrededor de la coincidencia, para que se vea en contexto.
  function makeSnippet(text, at, len) {
    const before = Math.max(0, at - 30);
    const after = Math.min(text.length, at + len + 40);
    return (before > 0 ? '…' : '') + text.slice(before, after) + (after < text.length ? '…' : '');
  }

  // Localiza un nodo por su id y devuelve cómo llegar hasta él: el proyecto y
  // la cadena de tableros. Lo usan los enlaces, que solo guardan el id del
  // destino — así siguen funcionando aunque el nodo se mueva de tablero.
  function locate({ projects, canvases, itemId, canvasId, lang }) {
    if (!itemId) return null;
    for (const project of (projects || [])) {
      if (!project || project.deleted) continue;
      const rootLabel = (typeof project.name === 'object'
        ? (project.name[lang] || project.name.es || project.name.en || Object.values(project.name)[0])
        : project.name) || '';
      for (const page of walkProject(canvases, project.id, rootLabel, lang)) {
        // Si el enlace recordaba el lienzo, se comprueba primero ese
        if (canvasId && page.canvasId !== canvasId) {
          const canvas = canvases[page.canvasId];
          const items = Array.isArray(canvas && canvas.items) ? canvas.items : [];
          if (!items.some(i => i && i.id === itemId)) continue;
        }
        const canvas = canvases[page.canvasId];
        const items = Array.isArray(canvas && canvas.items) ? canvas.items : [];
        const item = items.find(i => i && i.id === itemId);
        if (!item) continue;
        return {
          projectId: project.id,
          canvasId: page.canvasId,
          trailIds: page.trailIds,
          itemId: item.id,
          type: item.type || 'note',
          path: page.path,
          snippet: nodeText(item, lang, true).slice(0, 80),
          label: nodeText(item, lang, true).slice(0, 60).trim(),
        };
      }
    }
    return null;
  }

  const OdiSearch = { nodeText, canvasTitle, walkProject, searchAll, locate };
  if (typeof window !== 'undefined') window.OdiSearch = OdiSearch;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiSearch;
})();
