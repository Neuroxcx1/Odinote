// =====================================================
// Odinote — enlaces entre nodos y backlinks (window.OdiLinks)
//
// Un enlace apunta de un texto a OTRO NODO cualquiera del mismo proyecto o de
// otro. No hace falta inventar un tipo "definición": el significado de una
// palabra es, sencillamente, el nodo al que apunta.
//
// Se guarda dentro del propio HTML del texto enriquecido, como una etiqueta
// <a> con atributos data-. Así viaja solo en exportaciones, copias y en la
// sincronización con Drive, sin tocar el formato de los proyectos.
//
// El backlink no se guarda: se calcula recorriendo quién apunta a un nodo.
// Guardarlo por duplicado significaría mantener dos verdades sincronizadas, y
// al borrar un nodo quedarían referencias fantasma.
//
// Sin dependencias de React ni del DOM, para poder probarlo desde Node.
// =====================================================
(function () {

  const NODE_ATTR = 'data-odi-node';
  const CANVAS_ATTR = 'data-odi-canvas';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // HTML de un enlace. La clase permite darle estilo y detectar el clic.
  function makeLinkHtml({ itemId, canvasId, text }) {
    return '<a class="odi-link" ' + NODE_ATTR + '="' + escapeHtml(itemId) + '" ' +
      CANVAS_ATTR + '="' + escapeHtml(canvasId || '') + '">' + escapeHtml(text) + '</a>';
  }

  // Enlaces que contiene un texto. Se usa expresión regular a propósito: este
  // marcado lo generamos nosotros, y así el módulo funciona igual en Node
  // (para las pruebas) que en el navegador.
  function extractLinks(html) {
    if (!html || typeof html !== 'string') return [];
    const out = [];
    const re = new RegExp('<a[^>]*' + NODE_ATTR + '="([^"]+)"[^>]*>(.*?)<\\/a>', 'gi');
    let m;
    while ((m = re.exec(html)) !== null) {
      const canvasMatch = m[0].match(new RegExp(CANVAS_ATTR + '="([^"]*)"'));
      out.push({
        itemId: m[1],
        canvasId: canvasMatch ? canvasMatch[1] : '',
        text: m[2].replace(/<[^>]*>/g, ''),
      });
    }
    return out;
  }

  // Todos los campos de texto de un nodo donde puede haber enlaces. Las notas
  // guardan en `content`, los documentos en `body`, los comentarios en `text`,
  // y cualquiera puede llevar leyenda.
  function textFieldsOf(item) {
    if (!item) return [];
    const fields = [];
    const push = (v) => {
      if (typeof v === 'string') fields.push(v);
      else if (v && typeof v === 'object') {
        Object.values(v).forEach(x => { if (typeof x === 'string') fields.push(x); });
      }
    };
    push(item.content); push(item.body); push(item.text); push(item.caption); push(item.title);
    if (Array.isArray(item.items)) item.items.forEach(r => r && push(r.text));
    if (Array.isArray(item.children)) item.children.forEach(ch => {
      textFieldsOf(ch).forEach(t => fields.push(t));
    });
    return fields;
  }

  // ¿A qué nodos apunta este nodo?
  function linksOf(item) {
    const out = [];
    textFieldsOf(item).forEach(t => extractLinks(t).forEach(l => out.push(l)));
    // Sin repetidos: la misma nota puede enlazar dos veces al mismo sitio
    const seen = new Set();
    return out.filter(l => (seen.has(l.itemId) ? false : (seen.add(l.itemId), true)));
  }

  // ¿Quién apunta a este nodo? Se recorren todos los proyectos porque un enlace
  // puede cruzar de uno a otro, que es justo lo que el árbol de tableros no
  // puede expresar.
  function backlinksFor({ projects, canvases, targetItemId, lang }) {
    if (!targetItemId) return [];
    const out = [];
    const search = (typeof window !== 'undefined' && window.OdiSearch) ||
      (typeof require === 'function' ? safeRequireSearch() : null);

    for (const project of (projects || [])) {
      if (!project || project.deleted) continue;
      const rootLabel = labelOf(project.name, lang);
      const pages = search
        ? search.walkProject(canvases, project.id, rootLabel, lang)
        : [{ canvasId: project.id, path: [rootLabel], trailIds: [project.id] }];

      for (const page of pages) {
        const canvas = canvases[page.canvasId];
        const items = Array.isArray(canvas && canvas.items) ? canvas.items : [];
        for (const item of items) {
          if (!item || item.id === targetItemId) continue;
          const hit = linksOf(item).find(l => l.itemId === targetItemId);
          if (!hit) continue;
          out.push({
            projectId: project.id,
            canvasId: page.canvasId,
            trailIds: page.trailIds,
            itemId: item.id,
            type: item.type || 'note',
            path: page.path,
            linkText: hit.text,
          });
        }
      }
    }
    return out;
  }

  function labelOf(name, lang) {
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object') return name[lang] || name.es || name.en || Object.values(name)[0] || '';
    return '';
  }

  function safeRequireSearch() {
    try { return require('./search.js'); } catch (e) { return null; }
  }

  // Al borrar un nodo, los enlaces que apuntaban a él quedarían muertos.
  // Se desactivan conservando el texto: se pierde el salto, no lo escrito.
  function stripLinksTo(html, itemId) {
    if (!html || typeof html !== 'string') return html;
    const re = new RegExp('<a[^>]*' + NODE_ATTR + '="' + itemId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>(.*?)<\\/a>', 'gi');
    return html.replace(re, '$1');
  }

  // Repara un texto en el que un enlace quedó guardado ESCAPADO, y por tanto se
  // ve como marcado crudo ("&lt;a class=&quot;odi-link&quot;…") en vez de como
  // enlace. Pasó al cambiar cómo guardaba el título su contenido: una versión
  // lo escribía como HTML y otra lo leía como texto plano, y el marcado acabó
  // dentro del propio texto. Solo se toca si se reconoce un enlace de Odinote:
  // así un usuario que escriba "&lt;a&gt;" a mano no ve cambiar lo que escribió.
  function repairEscapedMarkup(html) {
    if (!html || typeof html !== 'string') return html;
    // Entre "&lt;a" y "odi-link" hay comillas escapadas (&quot;), así que la
    // comprobación tiene que admitir cualquier cosa en medio, incluido "&".
    if (!/&lt;a[\s\S]{0,80}odi-link/.test(html)) return html;
    return html
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  const OdiLinks = {
    repairEscapedMarkup,
    NODE_ATTR, CANVAS_ATTR,
    makeLinkHtml, extractLinks, textFieldsOf, linksOf, backlinksFor, stripLinksTo,
  };
  if (typeof window !== "undefined") { window.OdiLinks = OdiLinks; window.repairEscapedMarkup = repairEscapedMarkup; }
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiLinks;
})();
