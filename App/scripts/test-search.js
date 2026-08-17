// Pruebas de la búsqueda global (src/search.js).  node scripts/test-search.js
const path = require('path');
const S = require(path.join(__dirname, '..', 'src', 'search.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// Estructura parecida a la real: proyecto con tableros anidados a 3 niveles
const projects = [
  { id: 'p1', name: { es: 'Juego 3', en: 'Game 3' } },
  { id: 'p2', name: { es: 'Marketing' } },
  { id: 'p3', name: { es: 'Borrado' }, deleted: true },
];
const canvases = {
  p1: { title: { es: 'Juego 3' }, items: [
    { id: 'n1', type: 'note', content: 'La premisa del juego' },
    { id: 'b1', type: 'board', content: 'Arte', canvasId: 'arte' },
  ] },
  arte: { title: { es: 'Arte' }, items: [
    { id: 'b2', type: 'board', content: 'Personajes', canvasId: 'pers' },
  ] },
  pers: { title: { es: 'Personajes' }, items: [
    { id: 'n2', type: 'note', content: 'Ghost flota porque es un fantasma' },
    { id: 't1', type: 'todo', title: 'Tareas', items: [{ text: 'Modelar el fantasma' }] },
  ] },
  p2: { title: { es: 'Marketing' }, items: [
    { id: 'n3', type: 'note', content: 'Publicar en AlternativeTo' },
  ] },
  p3: { title: { es: 'Borrado' }, items: [{ id: 'n4', type: 'note', content: 'fantasma oculto' }] },
};

// 1. Lo enterrado a 3 niveles aparece (el fallo que motiva todo esto)
const r1 = S.searchAll({ projects, canvases, query: 'fantasma', lang: 'es' });
check('encuentra una nota enterrada a 3 niveles', r1.some(r => r.itemId === 'n2'), `${r1.length} resultados`);
check('devuelve la ruta completa para poder llegar',
  (r1.find(r => r.itemId === 'n2') || {}).path.join(' / ') === 'Juego 3 / Arte / Personajes',
  (r1.find(r => r.itemId === 'n2') || {}).path.join(' / '));

// 2. Busca también dentro de las filas de un to-do
check('busca dentro de las tareas de un to-do', r1.some(r => r.itemId === 't1'));

// 3. No devuelve proyectos en la papelera
check('ignora los proyectos borrados', !r1.some(r => r.projectId === 'p3'));

// 4. Cruza proyectos
const r2 = S.searchAll({ projects, canvases, query: 'a', lang: 'es' });
const r3 = S.searchAll({ projects, canvases, query: 'AlternativeTo', lang: 'es' });
check('encuentra en otros proyectos', r3.length === 1 && r3[0].projectId === 'p2');

// 5. No busca por ruido interno (ids, tipos, colores)
const r4 = S.searchAll({ projects, canvases, query: 'note', lang: 'es' });
check('no devuelve todo al buscar un nombre de tipo interno', r4.length === 0, `${r4.length} resultados`);

// 6. El HTML del texto enriquecido no rompe la búsqueda
const conHtml = { ...canvases, pers: { ...canvases.pers, items: [
  { id: 'n9', type: 'note', content: '<p>El <b>hambre</b> de almas</p>' },
] } };
const r5 = S.searchAll({ projects, canvases: conHtml, query: 'hambre', lang: 'es' });
check('encuentra dentro de texto con formato', r5.length === 1, `${r5.length}`);
check('el extracto no muestra etiquetas HTML', !/[<>]/.test(r5[0].snippet), r5[0].snippet);

// 7. Consultas muy cortas no devuelven media aplicación
check('ignora consultas de menos de 2 letras', S.searchAll({ projects, canvases, query: 'f', lang: 'es' }).length === 0);

// 8. Un tablero que se apunta a sí mismo no cuelga el buscador
const ciclo = { ...canvases, arte: { title: { es: 'Arte' }, items: [
  { id: 'bx', type: 'board', content: 'Bucle', canvasId: 'arte' },
] } };
const r6 = S.searchAll({ projects, canvases: ciclo, query: 'bucle', lang: 'es' });
check('un tablero circular no cuelga la búsqueda', r6.length === 1);

// 9. Busca en el idioma en que se escribió, no solo en el de la interfaz
const r7 = S.searchAll({ projects, canvases, query: 'Game 3', lang: 'es' });
check('los campos traducidos se buscan en todos sus idiomas', Array.isArray(r7));

// 10. Tope de resultados
const muchos = { p1: { title: 'x', items: Array.from({ length: 200 }, (_, i) => ({ id: 'i' + i, content: 'repetido' })) } };
check('respeta el límite de resultados',
  S.searchAll({ projects: [{ id: 'p1', name: 'x' }], canvases: muchos, query: 'repetido', lang: 'es', limit: 25 }).length === 25);

// 11. La cadena de tableros que hace falta para plantarse en el resultado
const r8 = S.searchAll({ projects, canvases, query: 'fantasma', lang: 'es' });
const hit = r8.find(r => r.itemId === 'n2');
check('devuelve la cadena de tableros para navegar',
  hit.trailIds.join(' > ') === 'p1 > arte > pers', hit.trailIds.join(' > '));

// 12. Formas REALES de los nodos. Aquí se coló el fallo que reventó el
// buscador al abrirlo: en una tabla `rows` es el NÚMERO de filas, no una lista,
// y `cells` es un objeto { "fila,col": { value } }.
const reales = {
  p1: { title: 'Raíz', items: [
    { id: 'tabla', type: 'table', rows: 4, cols: 3, title: 'Presupuesto',
      cells: { '0,0': { value: 'Concepto' }, '1,0': { value: 'Servidor dedicado' } } },
    { id: 'todo', type: 'todo', title: 'Pendientes', items: [{ text: 'Comprar dominio' }] },
    { id: 'col', type: 'column', children: [{ id: 'hija', type: 'note', content: 'tarjeta en columna' }] },
    { id: 'cal', type: 'calendar', events: { '2026-08-16': [{ title: 'algo' }] } },
    { id: 'raro1', type: 'note', items: 'no soy una lista' },
    { id: 'raro2', type: 'note', children: 42 },
    { id: 'raro3', type: 'note', cells: 'tampoco' },
    { id: 'nulo', type: 'note', content: null },
  ] },
};
const soloP1 = [{ id: 'p1', name: 'Raíz' }];
let reventó = null;
try {
  check('encuentra dentro de una celda de tabla',
    S.searchAll({ projects: soloP1, canvases: reales, query: 'servidor dedicado', lang: 'es' }).length === 1);
  check('encuentra una tarjeta dentro de una columna',
    S.searchAll({ projects: soloP1, canvases: reales, query: 'tarjeta en columna', lang: 'es' }).length === 1);
  check('encuentra una tarea del to-do',
    S.searchAll({ projects: soloP1, canvases: reales, query: 'comprar dominio', lang: 'es' }).length === 1);
  // Lo importante: campos con el tipo equivocado no deben tumbar la búsqueda
  S.searchAll({ projects: soloP1, canvases: reales, query: 'lo que sea', lang: 'es' });
} catch (e) { reventó = e.message; }
check('campos con tipo inesperado no rompen el buscador', reventó === null, reventó || '');

// 13. Un lienzo sin items, o con items que no son una lista
const rotos = { p1: { title: 'x' }, p2: { title: 'y', items: null }, p3: { title: 'z', items: 'texto' } };
let reventó2 = null;
try {
  S.searchAll({ projects: [{ id: 'p1', name: 'a' }, { id: 'p2', name: 'b' }, { id: 'p3', name: 'c' }],
    canvases: rotos, query: 'hola', lang: 'es' });
} catch (e) { reventó2 = e.message; }
check('un lienzo sin lista de nodos no rompe nada', reventó2 === null, reventó2 || '');

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
