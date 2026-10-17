// Que el nodo de progreso cuente bien.  node scripts/test-progreso.js
const P = require('../src/progreso.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};
const fila = (texto, hecha, indent) => ({ id: texto, text: { es: texto, en: texto }, done: !!hecha, indent: indent || 0 });

// ── Una lista ──
check('cuenta hechas y total', JSON.stringify(P.cuentaLista([fila('a', 1), fila('b'), fila('c', 1)])) === JSON.stringify({ hechas: 2, total: 3 }));
check('una fila vacía no es una tarea', P.cuentaLista([fila('a', 1), { id: 'v', text: { es: '', en: '' }, done: false }]).total === 1);
check('ni la que solo tiene etiquetas vacías', P.cuentaLista([{ id: 'v', text: { es: '<p><br></p>' }, done: false }]).total === 0);
// Una tarea con dos subtareas: cuentan las dos de abajo, no la de arriba.
const conHijas = [fila('padre', 0, 0), fila('hija 1', 1, 1), fila('hija 2', 0, 1), fila('suelta', 1, 0)];
const c = P.cuentaLista(conHijas);
check('una tarea con subtareas no se cuenta dos veces', c.total === 3 && c.hechas === 2, JSON.stringify(c));
check('sin filas, nada', P.cuentaLista(undefined).total === 0);

// ── Un proyecto con tableros dentro ──
const lienzos = {
  raiz: { items: [
    { id: 'l1', type: 'todo', items: [fila('a', 1), fila('b')] },
    { id: 'n1', type: 'note' },
    { id: 't1', type: 'board', canvasId: 'tablero' },
    { id: 'col', type: 'column', children: [
      { id: 'l2', type: 'todo', items: [fila('c', 1)] },
      { id: 't2', type: 'board', canvasId: 'enColumna' },
    ] },
  ] },
  tablero: { items: [
    { id: 'l3', type: 'todo', items: [fila('d'), fila('e', 1)] },
    { id: 't3', type: 'board', canvasId: 'nieto' },
  ] },
  nieto: { items: [{ id: 'l4', type: 'todo', items: [fila('f', 1)] }] },
  enColumna: { items: [{ id: 'l5', type: 'todo', items: [fila('g')] }] },
  otroProyecto: { items: [{ id: 'l9', type: 'todo', items: [fila('z', 1), fila('y', 1)] }] },
};
const todo = P.cuenta(lienzos, 'raiz');
check('cuenta el proyecto entero, tableros de dentro incluidos', todo.total === 7 && todo.hechas === 4, JSON.stringify(todo));
check('también las listas dentro de una columna', P.lienzosDesde(lienzos, 'raiz').enColumna !== undefined);
check('no se mete en otro proyecto', !P.lienzosDesde(lienzos, 'raiz').otroProyecto);
check('el porcentaje redondeado', todo.porcentaje === 57, String(todo.porcentaje));
const tablero = P.cuenta(lienzos, 'tablero');
check('un tablero cuenta lo suyo y lo de dentro', tablero.total === 3 && tablero.hechas === 2, JSON.stringify(tablero));
check('sin tareas, 0 % y no NaN', P.cuenta({ v: { items: [] } }, 'v').porcentaje === 0);
// Un tablero que se contiene a sí mismo (de una copia rara) no cuelga nada.
check('un tablero que se apunta a sí mismo no da vueltas para siempre',
  P.cuenta({ a: { items: [{ id: 'b', type: 'board', canvasId: 'a' }, { id: 'l', type: 'todo', items: [fila('x', 1)] }] } }, 'a').total === 1);

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
