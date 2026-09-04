// La barra de nodos y el menú del "+".  node scripts/test-paleta.js
//
// El color no es decoración en esta barra: dice de qué es cada nodo. Verde lo
// que se escribe, gris los medios y los archivos, rojo la estructura, blanco
// las dos herramientas de trazo. Y por eso los nodos van agrupados por color,
// no por el día en que se añadieron. El menú del "+" estaba en ese otro orden
// —rojo, rojo, verde, gris, gris, verde, rojo— y se leía como un cajón de
// sastre colgando de una barra ordenada.
const path = require('path');
const fs = require('fs');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'Topbar.jsx'), 'utf-8');

// Se lee la lista de verdad del código, no una copia.
const lee = (nombre) => {
  const m = src.match(new RegExp('const ' + nombre + ' = \\[([\\s\\S]*?)\\n\\];'));
  check('se encuentra ' + nombre + ' en Topbar.jsx', !!m);
  if (!m) { console.log('\n1 FALLOS'); process.exit(1); }
  const filas = [];
  const re = /\{ id: '([a-z]+)',[\s\S]*?bg: '(#[0-9A-Fa-f]{6})'/g;
  let f;
  while ((f = re.exec(m[1]))) filas.push({ id: f[1], bg: f[2] });
  return filas;
};

const VERDE = '#90B968', GRIS = '#E1DFE3', ROJO = '#E6544F', BLANCO = '#FFFFFF';
const nombre = { [VERDE]: 'verde', [GRIS]: 'gris', [ROJO]: 'rojo', [BLANCO]: 'blanco' };
// El orden en que pueden aparecer los colores, de arriba abajo.
const ORDEN = [VERDE, GRIS, ROJO, BLANCO];

// Comprueba que los colores no se repiten a saltos: una vez que la lista pasa
// de verde a gris, no puede volver al verde.
const enOrden = (filas) => {
  let tope = -1;
  for (const fila of filas) {
    const puesto = ORDEN.indexOf(fila.bg);
    if (puesto === -1) return 'color desconocido en ' + fila.id + ': ' + fila.bg;
    if (puesto < tope) return fila.id + ' (' + nombre[fila.bg] + ') va detrás de un ' + nombre[ORDEN[tope]];
    tope = puesto;
  }
  return null;
};

const barra = lee('TOOLS');
const extras = lee('EXTRA_TOOLS');

check('la barra de arriba tiene sus catorce nodos', barra.length === 14, 'hay ' + barra.length);
check('y el menú del "+" los siete que sobran', extras.length === 7, 'hay ' + extras.length);

const malBarra = enOrden(barra);
check('la barra va verde → gris → rojo → blanco', malBarra === null, malBarra || undefined);

const malExtras = enOrden(extras);
check('el menú del "+" va verde → gris → rojo', malExtras === null, malExtras || undefined);

check('empieza por lo que se escribe',
  extras[0].bg === VERDE && extras[1].bg === VERDE,
  extras.slice(0, 2).map(x => x.id).join(', '));
check('sigue con los medios y los archivos',
  extras[2].bg === GRIS && extras[3].bg === GRIS,
  extras.slice(2, 4).map(x => x.id).join(', '));
check('y acaba con la estructura y las herramientas',
  extras.slice(4).every(x => x.bg === ROJO),
  extras.slice(4).map(x => x.id).join(', '));

// Que reordenar no se haya llevado ningún nodo por delante.
const ids = [...barra, ...extras].map(x => x.id).sort();
check('están los veintiún nodos, sin repetidos',
  ids.length === 21 && new Set(ids).size === 21, ids.length + ' ids');
for (const quien of ['comment', 'code', 'file', 'map', 'shape', 'calendar', 'timer']) {
  check('sigue estando ' + quien, ids.indexOf(quien) !== -1);
}

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo en orden.');
process.exit(fallos ? 1 : 0);
