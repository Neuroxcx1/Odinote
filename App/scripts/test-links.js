// Pruebas de enlaces y backlinks (src/links.js).  node scripts/test-links.js
const path = require('path');
const L = require(path.join(__dirname, '..', 'src', 'links.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// ── Formar y volver a leer un enlace ──
const html = L.makeLinkHtml({ itemId: 'it-99', canvasId: 'c-arte', text: 'hambre de almas' });
check('el enlace lleva el nodo y el lienzo destino',
  html.includes('data-odi-node="it-99"') && html.includes('data-odi-canvas="c-arte"'));
const leidos = L.extractLinks('<p>El <a class="odi-link" data-odi-node="it-99" data-odi-canvas="c-arte">hambre de almas</a> manda</p>');
check('se vuelve a leer del HTML', leidos.length === 1 && leidos[0].itemId === 'it-99');
check('conserva el texto visible', leidos[0].text === 'hambre de almas', leidos[0].text);

// ── Texto con comillas o < > no rompe el marcado ──
const peligroso = L.makeLinkHtml({ itemId: 'it-1', canvasId: 'c', text: 'a "b" <script>x</script>' });
check('el texto se escapa y no inyecta marcado',
  !peligroso.includes('<script>') && L.extractLinks(peligroso).length === 1);

// ── Varios enlaces en un mismo texto ──
const dos = '<p>' + L.makeLinkHtml({ itemId: 'a1', canvasId: 'c', text: 'uno' }) +
            ' y ' + L.makeLinkHtml({ itemId: 'b2', canvasId: 'c', text: 'dos' }) + '</p>';
check('detecta varios enlaces seguidos', L.extractLinks(dos).length === 2);

// ── Enlaces de un nodo, mirando todos sus campos ──
const nota = { id: 'n1', type: 'note', content: { es: '<p>' + L.makeLinkHtml({ itemId: 'destino', canvasId: 'c', text: 'ver' }) + '</p>' } };
check('encuentra el enlace dentro de un campo traducido', L.linksOf(nota).length === 1);

const doc = { id: 'd1', type: 'doc', body: L.makeLinkHtml({ itemId: 'destino', canvasId: 'c', text: 'x' }),
              caption: L.makeLinkHtml({ itemId: 'otro', canvasId: 'c', text: 'y' }) };
check('mira también el cuerpo del documento y la leyenda', L.linksOf(doc).length === 2);

const todo = { id: 't1', type: 'todo', items: [{ text: { es: L.makeLinkHtml({ itemId: 'destino', canvasId: 'c', text: 'z' }) } }] };
check('mira dentro de las tareas de un to-do', L.linksOf(todo).length === 1);

const repetido = { id: 'r', content: L.makeLinkHtml({ itemId: 'destino', canvasId: 'c', text: 'a' }) +
                                    L.makeLinkHtml({ itemId: 'destino', canvasId: 'c', text: 'b' }) };
check('no cuenta dos veces el mismo destino', L.linksOf(repetido).length === 1);

// ── Backlinks: quién apunta a un nodo, cruzando proyectos ──
const linkA = (id, t) => L.makeLinkHtml({ itemId: id, canvasId: 'c', text: t });
const projects = [{ id: 'p1', name: { es: 'Juego 3' } }, { id: 'p2', name: { es: 'Marketing' } }, { id: 'p3', name: 'Papelera', deleted: true }];
const canvases = {
  p1: { title: { es: 'Juego 3' }, items: [
    { id: 'origen1', type: 'note', content: { es: 'Depende del ' + linkA('mecanica', 'hambre') } },
    { id: 'b1', type: 'board', content: 'Fases', canvasId: 'fases' },
    { id: 'mecanica', type: 'note', content: { es: 'Hambre de almas' } },
  ] },
  fases: { title: { es: 'Fases' }, items: [
    { id: 'origen2', type: 'doc', body: { es: 'La fase 1 usa ' + linkA('mecanica', 'la mecánica') } },
  ] },
  p2: { title: { es: 'Marketing' }, items: [
    { id: 'origen3', type: 'note', content: { es: 'Vender el ' + linkA('mecanica', 'gancho') } },
  ] },
  p3: { title: 'Papelera', items: [
    { id: 'borrado', type: 'note', content: { es: linkA('mecanica', 'no cuenta') } },
  ] },
};

// Con search.js disponible, para poder recorrer los tableros anidados
require(path.join(__dirname, '..', 'src', 'search.js'));
global.window = undefined;
const back = L.backlinksFor({ projects, canvases, targetItemId: 'mecanica', lang: 'es' });
check('encuentra quién le apunta desde el mismo lienzo', back.some(b => b.itemId === 'origen1'));
check('…y desde un tablero anidado', back.some(b => b.itemId === 'origen2'), back.map(b=>b.itemId).join(','));
check('…y desde OTRO proyecto', back.some(b => b.itemId === 'origen3'));
check('ignora los proyectos en la papelera', !back.some(b => b.itemId === 'borrado'));
check('no se cuenta a sí mismo', !back.some(b => b.itemId === 'mecanica'));
check('trae la ruta para poder ir al origen',
  (back.find(b => b.itemId === 'origen2') || {}).path.join(' / ') === 'Juego 3 / Fases',
  (back.find(b => b.itemId === 'origen2') || {}).path.join(' / '));
check('trae el texto con el que se enlazó',
  (back.find(b => b.itemId === 'origen1') || {}).linkText === 'hambre');

// ── Al borrar el destino, el texto se conserva y el enlace muere ──
const antes = '<p>El ' + linkA('mecanica', 'hambre') + ' manda</p>';
const despues = L.stripLinksTo(antes, 'mecanica');
check('al borrar el destino se conserva el texto escrito',
  despues === '<p>El hambre manda</p>', despues);
check('y ya no queda enlace', L.extractLinks(despues).length === 0);
check('no toca los enlaces a otros nodos',
  L.extractLinks(L.stripLinksTo(antes, 'otro-distinto')).length === 1);

// ── Entradas raras no rompen nada ──
let reventó = null;
try {
  L.extractLinks(null); L.extractLinks(42); L.linksOf(null);
  L.linksOf({ items: 'no soy lista', children: 7, content: 5 });
  L.backlinksFor({ projects: null, canvases: null, targetItemId: 'x', lang: 'es' });
  L.stripLinksTo(null, 'x');
} catch (e) { reventó = e.message; }
check('entradas inesperadas no rompen nada', reventó === null, reventó || '');

// ── Reparación de enlaces que quedaron guardados ESCAPADOS ──
// Pasó de verdad: una versión guardaba el título como HTML y otra lo leía como
// texto plano, y el marcado acabó dentro del propio texto, a la vista.
const escapado = '&lt;a class=&quot;odi-link&quot; data-odi-node=&quot;it-99&quot; data-odi-canvas=&quot;c1&quot;&gt;PAGINA &lt;/a&gt;PRICIPAL';
const reparado = L.repairEscapedMarkup(escapado);
check('repara un enlace guardado escapado', L.extractLinks(reparado).length === 1);
check('el enlace reparado apunta al nodo correcto',
  (L.extractLinks(reparado)[0] || {}).itemId === 'it-99');
check('la reparación conserva todo el texto',
  reparado.includes('PAGINA') && reparado.includes('PRICIPAL'));
check('no toca texto normal que lleve etiquetas escapadas a mano',
  L.repairEscapedMarkup('Hola &lt;b&gt;mundo&lt;/b&gt;') === 'Hola &lt;b&gt;mundo&lt;/b&gt;');
check('no toca un HTML que ya estaba sano',
  L.repairEscapedMarkup(linkA('x', 'y')).includes('<a class'));
check('entradas raras no rompen la reparación',
  L.repairEscapedMarkup(null) === null && L.repairEscapedMarkup(42) === 42);

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
