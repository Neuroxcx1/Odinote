// =====================================================
// Odinote — pruebas de src/sync.js (trabajo a la vez entre dos personas).
//
//   node scripts/test-sync.js
//
// La pregunta que importa: si dos personas editan a la vez, ¿se pierde el
// trabajo de alguna? Aquí se simulan las dos partes con dos copias del mismo
// proyecto y se comprueba que lo que sale por un lado entra bien por el otro.
// =====================================================

const path = require('path');
const S = require(path.join(__dirname, '..', 'src', 'sync.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const proyecto = () => ({
  p1: {
    title: { es: 'Inicio', en: 'Home' },
    items: [
      { id: 'n1', type: 'note', x: 10, y: 10, w: 200, h: 100, content: { es: 'hola', en: 'hi' } },
      { id: 'n2', type: 'todo', x: 300, y: 10, w: 200, h: 200, items: [] },
    ],
    connectors: [{ id: 'c1', fromEnd: { itemId: 'n1' }, toEnd: { itemId: 'n2' }, color: '#000' }],
  },
});
const copia = (o) => JSON.parse(JSON.stringify(o));

// ── Lo básico ──
{
  const a = proyecto();
  check('sin cambios no se manda nada', S.diff(a, a).length === 0);

  const b = copia(a);
  b.p1.items[0] = { ...b.p1.items[0], x: 340 };
  const ops = S.diff(a, b);
  check('mover un nodo produce UNA operación', ops.length === 1, JSON.stringify(ops[0]));
  check('y solo lleva el campo que cambió',
    ops[0].o === 'nodo~' && Object.keys(ops[0].campos).length === 1 && ops[0].campos.x === 340);
  check('un movimiento pesa poco', S.pesa(ops) < 120, `${S.pesa(ops)} bytes`);
}

// ── Crear, borrar, tableros ──
{
  const a = proyecto();
  const b = copia(a);
  b.p1.items.push({ id: 'n3', type: 'image', x: 5, y: 5, w: 100, h: 100 });
  const ops = S.diff(a, b);
  check('un nodo nuevo viaja entero', ops.length === 1 && ops[0].o === 'nodo+' && ops[0].nodo.id === 'n3');

  const c = copia(a);
  c.p1.items = c.p1.items.filter(i => i.id !== 'n2');
  const ops2 = S.diff(a, c);
  check('borrar un nodo manda solo su id', ops2.length === 1 && ops2[0].o === 'nodo-' && ops2[0].id === 'n2');

  const d = copia(a);
  d.b9 = { title: { es: 'Tablero', en: 'Board' }, parent: 'p1', items: [], connectors: [] };
  d.p1.items.push({ id: 'n4', type: 'board', canvasId: 'b9', x: 0, y: 0, w: 300, h: 240 });
  const ops3 = S.diff(a, d);
  check('crear un tablero manda el lienzo nuevo y su nodo',
    ops3.some(o => o.o === 'lienzo+' && o.c === 'b9') && ops3.some(o => o.o === 'nodo+'));
}

// ── Lo que NO debe viajar ──
{
  const a = proyecto();
  const b = copia(a);
  b.p1.items[0] = { ...b.p1.items[0], _dragging: true, _new: true, srcLocal: 'C:\\algo.png' };
  check('los campos del momento no se mandan', S.diff(a, b).length === 0,
    'arrastrando, recién creado y la ruta local se quedan en casa');

  const c = copia(a);
  c.p1.items[0] = { ...c.p1.items[0], _dragging: true, x: 99 };
  const ops = S.diff(a, c);
  check('pero un cambio real sí, sin arrastrar la basura',
    ops.length === 1 && Object.keys(ops[0].campos).join() === 'x');
}

// ── Aplicar al otro lado ──
{
  const a = proyecto();
  const b = copia(a);
  b.p1.items[0] = { ...b.p1.items[0], x: 340, color: 'olive' };
  b.p1.items.push({ id: 'n5', type: 'note', x: 1, y: 1 });
  b.p1.items = b.p1.items.filter(i => i.id !== 'n2');

  const ops = S.diff(a, b);
  const recibido = S.aplica(copia(a), ops);
  check('el otro lado queda igual que el primero',
    JSON.stringify(recibido) === JSON.stringify(b),
    `${ops.length} operaciones`);
}

// ── Dos personas a la vez ──
{
  const base = proyecto();
  // Ana mueve la nota. Luis cambia el color de la tarea. A la vez.
  const ana = copia(base);
  ana.p1.items[0] = { ...ana.p1.items[0], x: 500 };
  const luis = copia(base);
  luis.p1.items[1] = { ...luis.p1.items[1], color: 'wine' };

  const deAna = S.diff(base, ana);
  const deLuis = S.diff(base, luis);

  // Cada uno aplica lo del otro sobre lo suyo.
  const finalAna = S.aplica(ana, deLuis);
  const finalLuis = S.aplica(luis, deAna);

  check('editar cosas distintas a la vez: no se pierde nada',
    finalAna.p1.items[0].x === 500 && finalAna.p1.items[1].color === 'wine');
  check('y los dos acaban viendo lo mismo',
    JSON.stringify(finalAna) === JSON.stringify(finalLuis));
}

// ── El mismo campo a la vez: gana el último, y no se rompe ──
{
  const base = proyecto();
  const ana = copia(base);  ana.p1.items[0] = { ...ana.p1.items[0], x: 100 };
  const luis = copia(base); luis.p1.items[0] = { ...luis.p1.items[0], x: 900 };

  const finalAna = S.aplica(ana, S.diff(base, luis));
  const finalLuis = S.aplica(luis, S.diff(base, ana));
  check('el mismo campo a la vez no rompe nada',
    finalAna.p1.items[0].x === 900 && finalLuis.p1.items[0].x === 100,
    'cada uno ve lo último que le llegó (se resuelve con la marca de tiempo al enviar)');
}

// ── Cosas raras que no deben tumbar la sesión ──
{
  const a = proyecto();
  check('un cambio sobre un lienzo que aquí no existe se ignora',
    S.aplica(copia(a), [{ o: 'nodo~', c: 'noexiste', id: 'n1', campos: { x: 1 } }]) !== null);
  check('un cambio sobre un nodo que aquí no existe se ignora',
    S.aplica(copia(a), [{ o: 'nodo~', c: 'p1', id: 'fantasma', campos: { x: 1 } }]).p1.items.length === 2);
  check('el mismo nodo nuevo dos veces no se duplica',
    S.aplica(copia(a), [
      { o: 'nodo+', c: 'p1', nodo: { id: 'n9', type: 'note' } },
      { o: 'nodo+', c: 'p1', nodo: { id: 'n9', type: 'note' } },
    ]).p1.items.length === 3);
  check('sin operaciones se devuelve el mismo objeto (React no repinta)',
    S.aplica(a, []) === a);
}

// ── Que React no repinte de más ──
{
  const a = proyecto();
  a.b2 = { title: { es: 'Otro', en: 'Other' }, items: [], connectors: [] };
  const despues = S.aplica(a, [{ o: 'nodo~', c: 'p1', id: 'n1', campos: { x: 7 } }]);
  check('el lienzo que no cambió conserva su identidad', despues.b2 === a.b2,
    'React solo vuelve a pintar el lienzo tocado');
  check('el lienzo tocado sí es nuevo', despues.p1 !== a.p1);
}

// ── Flechas ──
{
  const a = proyecto();
  const b = copia(a);
  b.p1.connectors[0] = { ...b.p1.connectors[0], color: '#E6544F' };
  const ops = S.diff(a, b);
  check('una flecha recoloreada viaja como cambio de campo',
    ops.length === 1 && ops[0].o === 'flecha~' && ops[0].campos.color === '#E6544F');
  const recibido = S.aplica(copia(a), ops);
  check('y llega bien', recibido.p1.connectors[0].color === '#E6544F');
}

// ── Un proyecto de verdad, no un juguete ──
{
  const grande = { p1: { title: {}, items: [], connectors: [] } };
  for (let i = 0; i < 400; i++) {
    grande.p1.items.push({ id: 'n' + i, type: 'note', x: i, y: i, w: 200, h: 100,
      content: { es: 'texto de relleno número ' + i, en: 'filler text number ' + i } });
  }
  const movido = copia(grande);
  movido.p1.items[200] = { ...movido.p1.items[200], x: 12345 };

  const ops = S.diff(grande, movido);
  const bytesOps = S.pesa(ops);
  const bytesTodo = JSON.stringify(movido).length;
  check('en un proyecto de 400 nodos, mover uno manda solo ese',
    ops.length === 1 && bytesOps < 100,
    `${bytesOps} bytes en vez de ${Math.round(bytesTodo / 1024)} KB del proyecto entero`);
}

console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} prueba(s) fallidas.`);
process.exit(fallos === 0 ? 0 : 1);
