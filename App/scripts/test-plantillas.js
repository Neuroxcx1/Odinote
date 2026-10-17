// Las plantillas de tablero (src/plantillas.js).  node scripts/test-plantillas.js
//
// Son solo datos, pero un error en ellos no avisa: una flecha a un «ref» que no
// existe sale sin uno de sus extremos, y un tipo mal escrito crea un nodo vacío
// que no se puede pintar. Esto lo mira antes de que lo vea nadie.
const fs = require('fs');
const path = require('path');
const P = require('../src/plantillas.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// Los tipos que sabe crear el lienzo: los «case» de defaultDims en Canvas.jsx.
const CANVAS = fs.readFileSync(path.join(__dirname, '..', 'src', 'Canvas.jsx'), 'utf8');
const dims = CANVAS.slice(CANVAS.indexOf('function defaultDims'), CANVAS.indexOf('function makeNewItem'));
const TIPOS = new Set([...dims.matchAll(/case '([a-z]+)'/g)].map(m => m[1]));
check('se leen los tipos del lienzo', TIPOS.size > 15 && TIPOS.has('note') && TIPOS.has('progreso'), TIPOS.size + ' tipos');

const enDos = (t) => !!(t && typeof t.es === 'string' && t.es.trim() && typeof t.en === 'string' && t.en.trim());

check('hay entre cuatro y seis plantillas', P.PLANTILLAS.length >= 4 && P.PLANTILLAS.length <= 6, P.PLANTILLAS.length + '');
check('los id no se repiten', new Set(P.PLANTILLAS.map(p => p.id)).size === P.PLANTILLAS.length);

for (const pl of P.PLANTILLAS) {
  const pre = `[${pl.id}] `;
  check(pre + 'nombre y descripción en los dos idiomas', enDos(pl.nombre) && enDos(pl.descripcion));
  check(pre + 'tiene icono', typeof pl.icono === 'string' && pl.icono.length > 0);
  const refs = pl.nodos.map(n => n.ref);
  check(pre + 'cada nodo tiene un ref, sin repetir', refs.every(Boolean) && new Set(refs).size === refs.length);
  const malos = pl.nodos.filter(n => !TIPOS.has(n.tipo)).map(n => n.ref + ':' + n.tipo);
  check(pre + 'todos los tipos existen en el lienzo', malos.length === 0, malos.join(', '));
  const hijosMalos = pl.nodos.flatMap(n => (n.hijos || []).filter(h => !TIPOS.has(h.tipo)).map(h => n.ref + '>' + h.tipo));
  check(pre + 'los hijos de las columnas también', hijosMalos.length === 0, hijosMalos.join(', '));
  check(pre + 'posición y tamaño son números', pl.nodos.every(n => [n.x, n.y, n.w, n.h].every(v => Number.isFinite(v) && v >= 0)));
  const sueltas = (pl.flechas || []).filter(([a, b]) => !refs.includes(a) || !refs.includes(b) || a === b);
  check(pre + 'las flechas van entre nodos que existen', sueltas.length === 0, sueltas.map(f => f.join('→')).join(', '));
  const sinTexto = pl.nodos.filter(n => n.content && !enDos(n.content)).map(n => n.ref);
  check(pre + 'los textos van en los dos idiomas', sinTexto.length === 0, sinTexto.join(', '));
  const listas = pl.nodos.filter(n => n.tipo === 'todo');
  check(pre + 'las tareas tienen id distintos dentro de su lista',
    listas.every(l => (l.items || []).length > 0 && new Set(l.items.map(t => t.id)).size === l.items.length));
  const c = P.caja(pl);
  check(pre + 'la caja la abarca entera', c.w > 0 && c.h > 0 && pl.nodos.every(n => n.x + n.w <= c.w && n.y + n.h <= c.h));
}

// Una plantilla no puede llevar campos del momento: se copiarían al proyecto.
const conGuion = [];
const mira = (o, ruta) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (k[0] === '_') conGuion.push(ruta + '.' + k); mira(o[k], ruta + '.' + k); } };
P.PLANTILLAS.forEach(pl => mira(pl.nodos, pl.id));
check('ningún campo del momento (_algo)', conGuion.length === 0, conGuion.join(', '));

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
