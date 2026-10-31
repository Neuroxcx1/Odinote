// Markdown de ida y vuelta.  node scripts/test-markdown.js
const M = require('../src/markdown.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + JSON.stringify(extra) : ''}`);
  if (!ok) fallos++;
};

// ── HTML → Markdown ──
check('párrafos', M.htmlAMd('<p>Hola</p><p>mundo</p>') === 'Hola\n\nmundo', M.htmlAMd('<p>Hola</p><p>mundo</p>'));
check('negrita, cursiva, tachado y código', M.htmlAMd('<p><b>a</b> <i>b</i> <s>c</s> <code>d</code></p>') === '**a** *b* ~~c~~ `d`', M.htmlAMd('<p><b>a</b> <i>b</i> <s>c</s> <code>d</code></p>'));
check('enlaces', M.htmlAMd('<p>ver <a href="https://x.com">aquí</a></p>') === 'ver [aquí](https://x.com)');
check('títulos', M.htmlAMd('<h2>Uno</h2><p>texto</p>') === '## Uno\n\ntexto');
check('listas anidadas', M.htmlAMd('<ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul>') === '- a\n  - a1\n- b', M.htmlAMd('<ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul>'));
check('listas numeradas', M.htmlAMd('<ol><li>x</li><li>y</li></ol>') === '1. x\n2. y');
check('citas', M.htmlAMd('<blockquote><p>dicho</p></blockquote>') === '> dicho');
check('código en bloque', M.htmlAMd('<pre>let a = 1;\nlet b = 2;</pre>') === '```\nlet a = 1;\nlet b = 2;\n```');
check('saltos de línea dentro de un párrafo', M.htmlAMd('<p>uno<br>dos</p>') === 'uno\ndos');
check('entidades', M.htmlAMd('<p>a &amp; b &lt;c&gt;&nbsp;d</p>') === 'a & b <c> d');
check('span con estilos: solo el texto', M.htmlAMd('<p><span style="color:red">rojo</span></p>') === 'rojo');
check('las imágenes de la bóveda no salen (no existirían fuera)', M.htmlAMd('<p><img src="media/x.png"><img src="https://x/y.png" alt="y"></p>') === '![y](https://x/y.png)');
check('HTML mal cerrado no rompe', typeof M.htmlAMd('<p><b>a<p>b') === 'string');
check('una nota vacía da vacío', M.htmlAMd('<p><br></p>') === '');

// ── Markdown → HTML ──
check('párrafo y título', M.mdAHtml('# T\n\nhola') === '<h1>T</h1><p>hola</p>', M.mdAHtml('# T\n\nhola'));
check('h4 o más se queda en h3 (el editor llega a H3)', M.mdAHtml('#### x') === '<h3>x</h3>');
check('formato en línea', M.mdAHtml('**a** *b* ~~c~~ `d` [e](https://f)') === '<p><strong>a</strong> <em>b</em> <s>c</s> <code>d</code> <a href="https://f">e</a></p>', M.mdAHtml('**a** *b* ~~c~~ `d` [e](https://f)'));
check('lista con anidada', M.mdAHtml('- a\n  - a1\n- b') === '<ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul>', M.mdAHtml('- a\n  - a1\n- b'));
check('tareas como ☐ y ☑', M.mdAHtml('- [ ] por hacer\n- [x] hecho') === '<ul><li>☐ por hacer</li><li>☑ hecho</li></ul>');
check('código en bloque, escapado', M.mdAHtml('```js\na < b\n```') === '<pre><code>a &lt; b</code></pre>');
check('cita', M.mdAHtml('> uno\n> dos') === '<blockquote><p>uno dos</p></blockquote>');
check('separador', M.mdAHtml('a\n\n---\n\nb') === '<p>a</p><hr><p>b</p>');
check('enlaces de Obsidian [[página]]', M.mdAHtml('ver [[Mi nota]] y [[otra|esa]]') === '<p>ver Mi nota y esa</p>');
check('el HTML suelto se escapa (nada de scripts)', !/<script/i.test(M.mdAHtml('<script>alert(1)</script>')));
check('guion_bajo dentro de palabras no es cursiva', M.mdAHtml('mi_variable_larga') === '<p>mi_variable_larga</p>');

// ── Ida y vuelta ──
{
  const md = '## Lista\n\n- uno\n- **dos**\n\ntexto con [enlace](https://a.b)';
  check('Markdown → HTML → Markdown da lo mismo', M.htmlAMd(M.mdAHtml(md)) === md, M.htmlAMd(M.mdAHtml(md)));
}

// ── Un .md → Documento ──
{
  const d = M.mdADoc('---\ntags: [x]\n---\n# Receta\n\n- harina\n- agua', 'nota.md');
  check('el título sale del primer # y la cabecera de Obsidian se va', d.titulo === 'Receta' && d.html === '<ul><li>harina</li><li>agua</li></ul>', d);
  check('sin #, el título es el nombre del archivo', M.mdADoc('solo texto', 'Ideas de agosto.md').titulo === 'Ideas de agosto');
}

// ── Un lienzo → .md ──
{
  const lienzos = {
    raiz: { items: [
      { id: 'n2', type: 'note', x: 500, y: 0, content: { es: '<p>derecha</p>' } },
      { id: 't', type: 'bigtitle', x: 0, y: 0, content: { es: 'Plan' } },
      { id: 'n1', type: 'note', x: 0, y: 200, content: { es: '<p>abajo</p>' } },
      { id: 'td', type: 'todo', x: 0, y: 400, title: { es: 'Hacer' }, items: [{ text: { es: 'comprar' }, done: true }, { text: { es: 'llamar' }, done: false, indent: 1 }, { text: { es: '' } }] },
      { id: 'l', type: 'link', x: 0, y: 600, url: 'https://github.com', title: 'GitHub' },
      { id: 'b', type: 'board', x: 0, y: 800, canvasId: 'dentro', content: { es: 'Tablero' } },
      { id: 'img', type: 'image', x: 0, y: 900, src: 'media/foto.png' },
      { id: 'linea', type: 'line', x: 0, y: 0 },
    ] },
    dentro: { items: [{ id: 'd', type: 'doc', x: 0, y: 0, title: { es: 'Doc' }, body: { es: '<p>cuerpo</p>' } }] },
  };
  const md = M.lienzoAMd(lienzos, 'raiz', 'Proyecto', 'es');
  const esperado = '# Proyecto\n\n## Plan\n\nderecha\n\nabajo\n\n#### Hacer\n\n- [x] comprar\n  - [ ] llamar\n\n[GitHub](https://github.com)\n\n### Tablero\n\n#### Doc\n\ncuerpo\n';
  check('el lienzo sale en orden de lectura, con tareas, enlaces y tableros dentro', md === esperado, md);
  check('un tablero que se contiene a sí mismo no da vueltas sin fin', typeof M.lienzoAMd({ a: { items: [{ type: 'board', canvasId: 'a', content: { es: 'yo' } }] } }, 'a', 'x') === 'string');
}
// Lo que vio la prueba en el .exe: tareas y títulos de dentro de un documento.
check('las tareas importadas vuelven como [ ] y [x]', M.htmlAMd(M.mdAHtml('- [ ] a\n- [x] b')) === '- [ ] a\n- [x] b', M.htmlAMd(M.mdAHtml('- [ ] a\n- [x] b')));
{
  const md = M.lienzoAMd({ r: { items: [{ type: 'doc', x: 0, y: 0, title: { es: 'Receta' }, body: { es: '<h1>Uno</h1><h2>Dos</h2><p>x</p>' } }] } }, 'r', 'P', 'es');
  check('los títulos de un documento quedan por debajo del suyo', md === '# P\n\n### Receta\n\n#### Uno\n\n##### Dos\n\nx\n', md);
}
{
  // Ida y vuelta completo: un .md importado y exportado da el mismo contenido.
  const original = '- [x] Mezclar\n- [ ] Hornear\n\n> Paciencia.\n\n```\nhorno = 230\n```';
  const d = M.mdADoc('# Pan\n\n' + original, 'x.md');
  const vuelta = M.lienzoAMd({ r: { items: [{ type: 'doc', x: 0, y: 0, title: { es: d.titulo }, body: { es: d.html } }] } }, 'r', '', 'es');
  check('importar y exportar un .md da lo mismo', vuelta === '## Pan\n\n' + original + '\n', vuelta);
}
check('nombre de archivo válido', M.nombreArchivo('Mi: proyecto/2026?') === 'Mi proyecto 2026.md');

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
