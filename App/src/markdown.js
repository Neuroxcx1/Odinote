// =====================================================
// Oddinote — Markdown de ida y vuelta (window.OdiMarkdown)
//
// Para llevarse un lienzo a Obsidian, Notion o cualquier editor de notas, y
// traerse sus notas: los dos leen y escriben archivos .md. Pedido para la
// 1.2.2 («qué otras aplicaciones se podrían conectar gratis y fácil»).
//
//  · lienzoAMd: un lienzo (y los tableros que tiene dentro) a un .md, en el
//    orden en que se lee: de arriba abajo y de izquierda a derecha.
//  · mdADoc: un .md a un nodo Documento (título + cuerpo en el HTML que usa
//    el editor de documentos). Notion y Obsidian guardan una página por
//    archivo, y un Documento es justo eso.
//
// Sin DOM: el HTML se lee con un analizador pequeño de aquí abajo, para que
// todo se pruebe desde Node (scripts/test-markdown.js) igual que corre en la
// aplicación. Entiende lo que escriben las notas y el editor: párrafos,
// títulos, negrita, cursiva, tachado, código, enlaces, listas (también de
// tareas), citas, separadores e imágenes de internet.
// =====================================================
(function () {
  // ── HTML → árbol ──
  const VACIAS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr']);
  const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
  const desentidad = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENTIDADES[e.toLowerCase()] != null ? ENTIDADES[e.toLowerCase()] : m;
  });
  function atributos(s) {
    const a = {};
    String(s || '').replace(/([a-zA-Z-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g, (m, k, v, d, sq, b) => { a[k.toLowerCase()] = desentidad(d != null ? d : sq != null ? sq : b != null ? b : ''); return ''; });
    return a;
  }
  function arbol(html) {
    const raiz = { tag: '#raiz', hijos: [] };
    const pila = [raiz];
    const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
    let m;
    while ((m = re.exec(String(html || '')))) {
      if (m[0].startsWith('<!--')) continue;
      const arriba = pila[pila.length - 1];
      if (m[3] != null) { arriba.hijos.push({ texto: desentidad(m[3]) }); continue; }
      const tag = m[1].toLowerCase();
      if (m[0][1] === '/') {
        // Cerrar hasta la etiqueta abierta que corresponda (HTML mal cerrado).
        for (let i = pila.length - 1; i > 0; i--) if (pila[i].tag === tag) { pila.length = i; break; }
        continue;
      }
      const nodo = { tag, attrs: atributos(m[2]), hijos: [] };
      arriba.hijos.push(nodo);
      if (!VACIAS.has(tag) && !/\/\s*$/.test(m[2])) pila.push(nodo);
    }
    return raiz;
  }
  const textoDe = (n) => n.texto != null ? n.texto : (n.hijos || []).map(textoDe).join('');

  // ── árbol → Markdown ──
  const BLOQUES = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'table']);
  function enLinea(nodos) {
    return nodos.map((n) => {
      if (n.texto != null) return n.texto.replace(/\s+/g, ' ');
      const dentro = () => enLinea(n.hijos);
      switch (n.tag) {
        case 'strong': case 'b': { const t = dentro(); return t.trim() ? `**${t.trim()}**` : t; }
        case 'em': case 'i': { const t = dentro(); return t.trim() ? `*${t.trim()}*` : t; }
        case 's': case 'strike': case 'del': { const t = dentro(); return t.trim() ? `~~${t.trim()}~~` : t; }
        case 'code': return '`' + textoDe(n) + '`';
        case 'a': { const t = dentro().trim(); const h = n.attrs.href || ''; return h ? `[${t || h}](${h})` : t; }
        case 'br': return '\n';
        case 'img': return /^https?:/i.test(n.attrs.src || '') ? `![${n.attrs.alt || ''}](${n.attrs.src})` : '';
        case 'input': return n.attrs.type === 'checkbox' ? ('checked' in n.attrs ? '[x] ' : '[ ] ') : '';
        default: return BLOQUES.has(n.tag) ? '\n' + bloques([n]) + '\n' : dentro();
      }
    }).join('');
  }
  function lista(n, nivel) {
    let i = 0;
    return n.hijos.filter(h => h.tag === 'li').map((li) => {
      i++;
      const pref = '  '.repeat(nivel) + (n.tag === 'ol' ? `${i}. ` : '- ');
      const propio = li.hijos.filter(h => h.tag !== 'ul' && h.tag !== 'ol');
      const hijas = li.hijos.filter(h => h.tag === 'ul' || h.tag === 'ol');
      // Las tareas que entraron como ☐/☑ (mdAHtml) vuelven a ser [ ] y [x].
      const linea = pref + enLinea(propio).replace(/\n+/g, ' ').trim().replace(/^☐\s*/, '[ ] ').replace(/^☑\s*/, '[x] ');
      return [linea, ...hijas.map(h => lista(h, nivel + 1))].join('\n');
    }).join('\n');
  }
  function bloques(nodos) {
    const sal = [];
    let suelto = [];
    const vacia = () => { const t = enLinea(suelto).trim(); if (t) sal.push(t); suelto = []; };
    nodos.forEach((n) => {
      if (n.texto != null || !BLOQUES.has(n.tag)) { suelto.push(n); return; }
      vacia();
      const t = n.tag;
      if (/^h[1-6]$/.test(t)) sal.push('#'.repeat(+t[1]) + ' ' + enLinea(n.hijos).replace(/\s+/g, ' ').trim());
      else if (t === 'p' || t === 'div') { const s = enLinea(n.hijos).trim(); if (s) sal.push(s); }
      else if (t === 'ul' || t === 'ol') sal.push(lista(n, 0));
      else if (t === 'blockquote') sal.push(bloques(n.hijos).split('\n').map(l => '> ' + l).join('\n'));
      else if (t === 'pre') sal.push('```\n' + textoDe(n).replace(/\n$/, '') + '\n```');
      else if (t === 'hr') sal.push('---');
      else sal.push(bloques(n.hijos));
    });
    vacia();
    return sal.filter(Boolean).join('\n\n');
  }
  function htmlAMd(html) {
    return bloques(arbol(html).hijos).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ── Markdown → HTML (el del editor de documentos) ──
  const escapa = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function enLineaMd(s) {
    const codigos = [];
    let t = escapa(s).replace(/`([^`]+)`/g, (m, c) => { codigos.push(c); return `\u0000${codigos.length - 1}\u0000`; });
    t = t.replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img src="$2" alt="$1">')
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')            // Obsidian: [[página|texto]]
      .replace(/\[\[([^\]]+)\]\]/g, '$1')                       // Obsidian: [[página]]
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (m, a, b) => `<strong>${a || b}</strong>`)
      .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_([^_\s][^_]*)_(?!_)/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>');
    return t.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${codigos[+i]}</code>`);
  }
  function mdAHtml(md) {
    const lineas = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const sal = [];
    let parrafo = [];
    const cierraParrafo = () => { if (parrafo.length) { sal.push(`<p>${enLineaMd(parrafo.join(' '))}</p>`); parrafo = []; } };
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (/^\s*```/.test(l)) {
        cierraParrafo();
        const cod = [];
        for (i++; i < lineas.length && !/^\s*```/.test(lineas[i]); i++) cod.push(lineas[i]);
        sal.push(`<pre><code>${escapa(cod.join('\n'))}</code></pre>`);
        continue;
      }
      const h = l.match(/^(#{1,6})\s+(.*)$/);
      if (h) { cierraParrafo(); const n = Math.min(3, h[1].length); sal.push(`<h${n}>${enLineaMd(h[2].trim())}</h${n}>`); continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { cierraParrafo(); sal.push('<hr>'); continue; }
      if (/^\s*>/.test(l)) {
        cierraParrafo();
        const cita = [];
        for (; i < lineas.length && /^\s*>/.test(lineas[i]); i++) cita.push(lineas[i].replace(/^\s*>\s?/, ''));
        i--;
        sal.push(`<blockquote>${mdAHtml(cita.join('\n'))}</blockquote>`);
        continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        cierraParrafo();
        // Una lista (anidada por la sangría).
        const items = [];
        for (; i < lineas.length; i++) {
          const m = lineas[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
          if (!m) break;
          items.push({ nivel: Math.floor(m[1].replace(/\t/g, '  ').length / 2), ord: /\d/.test(m[2]), texto: m[3] });
        }
        i--;
        sal.push(listaHtml(items, 0, 0).html);
        continue;
      }
      if (!l.trim()) { cierraParrafo(); continue; }
      parrafo.push(l.trim());
    }
    cierraParrafo();
    return sal.join('');
  }
  function listaHtml(items, desde, nivel) {
    const tag = items[desde] && items[desde].ord ? 'ol' : 'ul';
    let html = `<${tag}>`, i = desde;
    while (i < items.length && items[i].nivel >= nivel) {
      if (items[i].nivel > nivel) { const r = listaHtml(items, i, items[i].nivel); html = html.replace(/<\/li>$/, '') + r.html + '</li>'; i = r.hasta; continue; }
      // Las tareas de Markdown: ☐ y ☑ (el editor de documentos no tiene casillas).
      const tarea = items[i].texto.match(/^\[([ xX])\]\s+(.*)$/);
      const texto = tarea ? (tarea[1] === ' ' ? '☐ ' : '☑ ') + tarea[2] : items[i].texto;
      html += `<li>${enLineaMd(texto)}</li>`;
      i++;
    }
    return { html: html + `</${tag}>`, hasta: i };
  }

  // ── Un lienzo → .md ──
  const pick = (v, lang) => (v && typeof v === 'object') ? (v[lang] || v.es || v.en || '') : (v || '');
  function itemsEnOrden(items) {
    return (items || []).filter(it => it && it.type !== 'line').slice()
      .sort((a, b) => (Math.round((a.y || 0) / 40) - Math.round((b.y || 0) / 40)) || ((a.x || 0) - (b.x || 0)));
  }
  function nodoAMd(it, lienzos, nivel, lang, vistos) {
    const h = (n) => '#'.repeat(Math.min(6, nivel + n)) + ' ';
    switch (it.type) {
      case 'bigtitle': { const t = htmlAMd(pick(it.content, lang)).replace(/\n+/g, ' ').trim(); return t ? h(0) + t : ''; }
      case 'note': case 'comment': return htmlAMd(pick(it.content, lang));
      case 'doc': {
        const t = pick(it.title, lang).trim();
        // Los títulos de dentro del documento, por debajo del suyo: si no, un
        // «## Ingredientes» salía más grande que el «### Receta» que lo tiene.
        const baja = Math.min(5, nivel + 1);
        const cuerpo = htmlAMd(pick(it.body, lang)).replace(/^(#{1,6}) /gm, (m, a) => '#'.repeat(Math.min(6, a.length + baja)) + ' ');
        return [t ? h(1) + t : '', cuerpo].filter(Boolean).join('\n\n');
      }
      case 'todo': {
        const t = pick(it.title, lang).trim();
        const filas = (it.items || []).map(f => {
          const txt = htmlAMd(pick(f.text, lang)).replace(/\n+/g, ' ').trim();
          return txt ? '  '.repeat(f.indent || 0) + `- [${f.done ? 'x' : ' '}] ` + txt : '';
        }).filter(Boolean);
        return [t ? h(2) + t : '', filas.join('\n')].filter(Boolean).join('\n\n');
      }
      case 'link': return it.url ? `[${(it.title || '').trim() || it.url}](${it.url})` : '';
      case 'image': return /^https?:/i.test(it.src || '') ? `![${it.name || ''}](${it.src})` : '';
      case 'code': return it.code || it.content ? '```' + (it.lang || it.language || '') + '\n' + String(it.code != null ? it.code : pick(it.content, lang)) + '\n```' : '';
      case 'separator': { const t = pick(it.title || it.content, lang).trim(); return t ? `---\n\n${h(2)}${t}` : '---'; }
      case 'column': {
        const t = pick(it.title || it.content, lang).trim();
        const dentro = itemsEnOrden(it.children).map(c => nodoAMd(c, lienzos, nivel + 1, lang, vistos)).filter(Boolean).join('\n\n');
        return [t ? h(1) + t : '', dentro].filter(Boolean).join('\n\n');
      }
      case 'board': {
        const t = pick(it.content, lang).trim() || pick(lienzos[it.canvasId] && lienzos[it.canvasId].title, lang).trim();
        if (!it.canvasId || vistos.has(it.canvasId) || nivel >= 5) return t ? h(1) + t : '';
        return [t ? h(1) + t : '', lienzoCuerpo(lienzos, it.canvasId, nivel + 1, lang, vistos)].filter(Boolean).join('\n\n');
      }
      default: return '';
    }
  }
  function lienzoCuerpo(lienzos, id, nivel, lang, vistos) {
    const c = lienzos && lienzos[id];
    if (!c) return '';
    vistos.add(id);
    return itemsEnOrden(c.items).map(it => nodoAMd(it, lienzos, nivel, lang, vistos)).filter(Boolean).join('\n\n');
  }
  function lienzoAMd(lienzos, id, titulo, lang) {
    // Con título del proyecto arriba (#), lo de dentro empieza en ##.
    const cuerpo = lienzoCuerpo(lienzos, id, titulo ? 2 : 1, lang || 'es', new Set());
    return ((titulo ? `# ${titulo}\n\n` : '') + cuerpo).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // ── Un .md → nodo Documento ──
  function mdADoc(md, nombreArchivo) {
    let t = String(md || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    // La cabecera YAML de Obsidian (--- … ---) no es texto de la nota.
    t = t.replace(/^---\n[\s\S]*?\n---\n?/, '');
    let titulo = String(nombreArchivo || '').replace(/\.(md|markdown|txt)$/i, '').trim();
    const m = t.match(/^\s*#\s+(.+)\n?/);
    if (m) { titulo = m[1].trim(); t = t.slice(m[0].length); }
    return { titulo: titulo || 'Sin título', html: mdAHtml(t.trim()) };
  }

  // Un nombre de archivo que valga en Windows, Mac y Linux.
  const nombreArchivo = (s) => (String(s || 'lienzo').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'lienzo') + '.md';

  const api = { htmlAMd, mdAHtml, lienzoAMd, mdADoc, nombreArchivo };
  if (typeof window !== 'undefined') window.OdiMarkdown = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
