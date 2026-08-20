// Pruebas del nodo to-do con texto enriquecido.  node scripts/test-todo.js
//
// Las tareas se guardaban como texto plano y ahora se guardan con formato. Lo
// que se comprueba aquí es la parte peligrosa: que al abrir una lista escrita
// ANTES no se pierda ni se deforme lo que había. Una tarea que dijera
// "arreglar x < y" no puede acabar interpretada como marcado.
const path = require('path');
const fs = require('fs');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const items = fs.readFileSync(path.join(__dirname, '..', 'src', 'items.jsx'), 'utf-8');

// Se saca la función de verdad del código, en vez de copiarla aquí: si algún
// día alguien la cambia, esta prueba habla de la que se está usando.
const m = items.match(/const ETIQUETAS_DE_FILA = (\/.*\/i);[\s\S]*?function htmlDeFila\(txt\) \{([\s\S]*?)\n\}/);
check('se encuentra htmlDeFila en items.jsx', !!m);
if (!m) { console.log('\n1 FALLOS'); process.exit(1); }

const htmlDeFila = new Function('txt',
  'const ETIQUETAS_DE_FILA = ' + m[1] + ';' + m[2]);

// ── Texto plano de siempre: se escapa, no se interpreta ──
check('una tarea normal se queda igual',
  htmlDeFila('comprar pan') === 'comprar pan');
check('un "<" en la tarea NO se come el resto de la línea',
  htmlDeFila('arreglar x < y') === 'arreglar x &lt; y',
  htmlDeFila('arreglar x < y'));
check('mayor y menor a la vez',
  htmlDeFila('3 < 5 y 7 > 2') === '3 &lt; 5 y 7 &gt; 2');
check('un "&" no se convierte en otro carácter',
  htmlDeFila('pan & mantequilla') === 'pan &amp; mantequilla');
check('algo que parece una etiqueta pero no lo es',
  htmlDeFila('usar <clave> aquí') === 'usar &lt;clave&gt; aquí');

// ── Texto que YA lleva formato: se respeta tal cual ──
[['<b>urgente</b> llamar', 'negrita'],
 ['ver <i>luego</i>', 'cursiva'],
 ['linea<br>otra', 'salto de linea'],
 ['<span style="color: red">rojo</span>', 'color'],
 ['<a class="odi-link" data-odi-node="x">enlace</a>', 'enlace a otro nodo'],
 ['<u>sub</u> y <s>tach</s>', 'subrayado y tachado']].forEach(([html, que]) => {
  check(`el formato ya guardado se respeta: ${que}`, htmlDeFila(html) === html);
});

// ── Entradas raras ──
check('vacío y nulo no rompen',
  htmlDeFila('') === '' && htmlDeFila(null) === '' && htmlDeFila(undefined) === '');
check('un número no revienta', htmlDeFila(42) === '42');

// ── El texto sigue siendo legible para el buscador y los enlaces ──
const S = require(path.join(__dirname, '..', 'src', 'search.js'));
const L = require(path.join(__dirname, '..', 'src', 'links.js'));
const todo = { id: 't1', type: 'todo', items: [
  { id: 'r1', text: { es: '<b>urgente</b> llamar al banco' } },
  { id: 'r2', text: { es: 'comprar ' + L.makeLinkHtml({ itemId: 'nodo9', canvasId: 'c', text: 'pintura' }) } },
] };
const texto = S.nodeText(todo, 'es', true);
check('el buscador ve el texto sin las etiquetas',
  texto.includes('urgente') && texto.includes('llamar al banco') && !texto.includes('<b>'),
  JSON.stringify(texto));
check('una tarea puede llevar un enlace a otro nodo',
  L.linksOf(todo).some(l => l.itemId === 'nodo9'));

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
