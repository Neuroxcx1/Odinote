// El recorrido de las flechas rectas.  node scripts/test-flecha-recta.js
//
// Una flecha recta que nadie ha tocado se recalcula entera cada vez: tiene
// que salir de un nodo de frente, entrar en el otro de frente, no atravesar
// ninguno de los dos y usar los menos dobleces posibles. Y una hecha a mano
// tiene que seguir siendo la misma después de pintarla.
const path = require('path');
const FR = require(path.join(__dirname, '..', 'src', 'flecha-recta.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const nodo = (x, y, w = 200, h = 100) => ({ x, y, w, h });
const ruta = (a, b) => {
  const r = FR.automatica(a, b);
  const { verts } = FR.construye(r.sA.p, r.sA.dir, r.codos, r.sB.p, r.sB.dir);
  const v = FR.limpia(verts);
  return { ...r, v, dobleces: v.length - 2 };
};
const describe = (r) => `${r.sA.lado}→${r.sB.lado}, ${r.dobleces} dobleces`;

// ── Enfrentados a la misma altura: una recta, sin dobleces ──
{
  const r = ruta({ rect: nodo(0, 0) }, { rect: nodo(400, 0) });
  check('dos nodos a la misma altura: línea recta', r.dobleces === 0 && r.sA.lado === 'der' && r.sB.lado === 'izq', describe(r));
}
// ── Enfrentados pero un poco desplazados (solapan): sigue recta, a la altura del solape ──
{
  const r = ruta({ rect: nodo(0, 0) }, { rect: nodo(400, 40) });
  check('desplazados pero solapando: recta a la altura del solape', r.dobleces === 0 && Math.abs(r.v[0].y - 70) < 0.6, `${describe(r)}, y=${r.v[0].y}`);
}
// ── En diagonal, lejos en horizontal: una Z con el tramo en medio del hueco ──
{
  const A = nodo(0, 0), B = nodo(500, 300);
  const r = ruta({ rect: A }, { rect: B });
  const vertical = r.v.find((p, i) => i > 0 && i < r.v.length - 1 && Math.abs(p.x - r.v[i + 1].x) < 0.5);
  check('en diagonal: Z de dos dobleces, saliendo por los lados', r.dobleces === 2 && r.sA.lado === 'der' && r.sB.lado === 'izq', describe(r));
  check('el tramo vertical cae en medio del hueco entre los dos', vertical && Math.abs(vertical.x - 350) < 1, vertical ? `x=${vertical.x}` : 'sin tramo vertical');
}
// ── Uno justo debajo del otro: recta vertical ──
{
  const r = ruta({ rect: nodo(0, 0) }, { rect: nodo(30, 300) });
  check('uno debajo del otro: recta vertical', r.dobleces === 0 && r.sA.lado === 'aba' && r.sB.lado === 'arr', describe(r));
}
// ── El caso que se veía en la captura: el de destino arriba y a la izquierda ──
{
  const r = ruta({ rect: nodo(180, 270, 300, 80) }, { rect: nodo(310, 10, 300, 80) });
  check('destino arriba y solapando: recta hacia arriba, sin gancho', r.dobleces === 0 && r.sA.lado === 'arr' && r.sB.lado === 'aba', describe(r));
}

// ── Con enganches fijados en lados "malos": rodea sin atravesar ──
{
  // A sale por la derecha, pero B está a su izquierda y entra por su izquierda.
  const A = nodo(400, 0), B = nodo(0, 40);
  const r = ruta({ rect: A, frac: { x: 1, y: 0.5 } }, { rect: B, frac: { x: 0, y: 0.5 } });
  check('enganches opuestos al sentido: rodea los nodos (ruta válida)', Number.isFinite(r.nota), describe(r));
  check('y respeta los lados fijados', r.sA.lado === 'der' && r.sB.lado === 'izq');
}
{
  // Salida fijada por arriba, destino a la derecha y abajo.
  const r = ruta({ rect: nodo(0, 200), frac: { x: 0.5, y: 0 } }, { rect: nodo(500, 400) });
  check('salida fijada por arriba: sube y luego va al otro', Number.isFinite(r.nota) && r.sA.lado === 'arr', describe(r));
}
// ── Un extremo suelto ──
{
  const r = ruta({ rect: nodo(0, 0) }, { punto: { x: 500, y: 50 } });
  check('hacia un punto suelto a la misma altura: recta', r.dobleces === 0 && r.sA.lado === 'der', describe(r));
  const r2 = ruta({ rect: nodo(0, 0) }, { punto: { x: 500, y: 400 } });
  check('hacia un punto suelto en diagonal: ruta válida', Number.isFinite(r2.nota), describe(r2));
}

// ── Barrido: el nodo B en 400 sitios alrededor de A ──
{
  const A = nodo(0, 0, 220, 120);
  let malas = 0, cruzan = 0, maxDobleces = 0, maxConSitio = 0, peor = '';
  let t0 = Date.now(), n = 0;
  for (let dx = -700; dx <= 700; dx += 70) {
    for (let dy = -500; dy <= 500; dy += 50) {
      const B = nodo(dx, dy, 180, 90);
      // Solapados de verdad: ahí no hay ruta limpia posible, se salta.
      if (dx < A.w && dx + B.w > 0 && dy < A.h && dy + B.h > 0) continue;
      n++;
      const r = ruta({ rect: A }, { rect: B });
      if (!Number.isFinite(r.nota)) { malas++; peor = `${dx},${dy}`; continue; }
      for (let i = 0; i < r.v.length - 1; i++) {
        if (FR.cruza(r.v[i], r.v[i + 1], A) || FR.cruza(r.v[i], r.v[i + 1], B)) { cruzan++; break; }
      }
      maxDobleces = Math.max(maxDobleces, r.dobleces);
      // Con sitio de verdad entre los dos (60 px o más en algún eje).
      const hx = Math.max(dx - A.w, -(dx + B.w)), hy = Math.max(dy - A.h, -(dy + B.h));
      if (Math.max(hx, hy) >= 60) maxConSitio = Math.max(maxConSitio, r.dobleces);
    }
  }
  const ms = (Date.now() - t0) / n;
  check(`en ${n} posiciones siempre hay ruta que sale y entra de frente`, malas === 0, malas ? `falla en ${peor}` : '');
  check('ninguna atraviesa un nodo', cruzan === 0, `${cruzan}`);
  check('con sitio entre los nodos, nunca más de dos dobleces', maxConSitio <= 2, `máximo ${maxConSitio}`);
  check('y con los nodos pegados, como mucho tres', maxDobleces <= 3, `máximo ${maxDobleces}`);
  check('calcularla es rápido', ms < 8, `${ms.toFixed(2)} ms de media`);
}

// ── Estable: mover B un píxel no le cambia el lado ──
{
  let saltos = 0;
  let antes = ruta({ rect: nodo(0, 0) }, { rect: nodo(300, 150) });
  for (let k = 1; k <= 40; k++) {
    const r = ruta({ rect: nodo(0, 0) }, { rect: nodo(300 + k, 150 + k) });
    if (r.sA.lado !== antes.sA.lado || r.sB.lado !== antes.sB.lado) saltos++;
    antes = r;
  }
  check('moviendo el nodo de píxel en píxel no cambia de lado a cada paso', saltos <= 1, `${saltos} cambios`);
}

// ── Los codos de una ruta hecha a mano se quedan como están ──
{
  const sA = FR.salida(nodo(0, 0), 'der', 0.5), sB = FR.salida(nodo(600, 300), 'izq', 0.5);
  const codos = [{ x: 300, y: 50 }, { x: 450, y: 350 }];
  const { verts } = FR.construye(sA.p, sA.dir, codos, sB.p, sB.dir);
  const v = FR.limpia(verts);
  const vuelta = FR.codosDeVertices(v, sA.dir, sB.dir);
  const { verts: verts2 } = FR.construye(sA.p, sA.dir, vuelta, sB.p, sB.dir);
  check('de codos a recorrido y vuelta: el mismo recorrido',
    JSON.stringify(FR.limpia(verts2)) === JSON.stringify(v), `${v.length} vértices`);
  const limpios = FR.limpiaCodos(codos, sA, sB);
  const { verts: verts3 } = FR.construye(sA.p, sA.dir, limpios, sB.p, sB.dir);
  check('limpiar al soltar no cambia un recorrido que ya está bien',
    JSON.stringify(FR.limpia(verts3)) === JSON.stringify(v));
  // Un tramo casi a cero (1 px) sí se quita.
  const conTropiezo = [{ x: 300, y: 50 }, { x: 301, y: 350 }];
  const l2 = FR.limpiaCodos(conTropiezo, sA, sB);
  const { verts: v4 } = FR.construye(sA.p, sA.dir, l2, sB.p, sB.dir);
  check('un tramo de 1 px se quita al soltar', FR.limpia(v4).length <= FR.limpia(FR.construye(sA.p, sA.dir, conTropiezo, sB.p, sB.dir).verts).length);
}

// ── Arrastrar el tramo que sale del nodo: aparece un escalón junto a la salida ──
{
  // Lo mismo que hace Connector al arrastrar: se mete un escalón al lado de la
  // salida, se mueven los vértices del tramo y se sacan los codos.
  const sA = FR.salida(nodo(0, 0, 300, 80), 'der', 0.5), sB = FR.salida(nodo(550, 290, 300, 80), 'izq', 0.5);
  const V = FR.limpia(FR.construye(sA.p, sA.dir, [{ x: 465, y: 0 }], sB.p, sB.dir).verts);
  const s = { x: V[0].x + 18, y: V[0].y };
  let arr = [V[0], s, { ...s }, ...V.slice(1)];
  arr = arr.map((p, k) => (k >= 2 && k <= 3 ? { ...p, y: p.y - 50 } : p));
  const codos = FR.codosDeVertices(arr, sA.dir, sB.dir);
  const hecho = FR.limpia(FR.construye(sA.p, sA.dir, codos, sB.p, sB.dir).verts);
  check('el escalón sale donde se arrastró (sube 50 el tramo de salida)',
    JSON.stringify(hecho) === JSON.stringify(FR.limpia(arr)), JSON.stringify(hecho.map(p => [p.x, p.y])));
  const limpios = FR.limpiaCodos(codos, sA, sB);
  const trasSoltar = FR.limpia(FR.construye(sA.p, sA.dir, limpios, sB.p, sB.dir).verts);
  check('y al soltar se queda igual', JSON.stringify(trasSoltar) === JSON.stringify(hecho));
  // Y el tramo del medio, sin escalón: los dos vértices del tramo se mueven.
  const mov = V.map((p, k) => (k >= 1 && k <= 2 ? { ...p, x: p.x + 80 } : p));
  const c2 = FR.codosDeVertices(mov, sA.dir, sB.dir);
  const h2 = FR.limpia(FR.construye(sA.p, sA.dir, c2, sB.p, sB.dir).verts);
  check('mover el tramo del medio lo lleva a donde se soltó', JSON.stringify(h2) === JSON.stringify(FR.limpia(mov)));
}

// ── Las flechas de antes y las que se hicieron a mano ──
{
  check('una flecha nueva sin codos es automática', !FR.esAMano({ shape: 'orthogonal' }));
  check('una de antes con UN codo guardado (el que se guardaba solo) se toma por automática',
    !FR.esAMano({ ortho: [{ x: 10, y: 20 }] }));
  check('una de antes con varios codos se respeta (alguien la trabajó)',
    FR.esAMano({ ortho: [{ x: 10, y: 20 }, { x: 30, y: 40 }] }));
  check('una marcada como hecha a mano se respeta aunque tenga un codo o ninguno',
    FR.esAMano({ ortho: [{ x: 1, y: 2 }], orthoManual: true }) && FR.esAMano({ ortho: [], orthoManual: true }));
  const p = FR.patchAutomatica({
    ortho: [{ x: 1, y: 2 }], orthoManual: true,
    fromEnd: { itemId: 'a', frac: { x: 1, y: 0.5 }, fijado: true },
    toEnd: { itemId: 'b', frac: { x: 0, y: 0.3 } },
  });
  check('volver a automática quita los codos', p.ortho === undefined && p.orthoManual === undefined && 'ortho' in p);
  check('suelta el enganche que fijó la aplicación', p.fromEnd && p.fromEnd.itemId === 'a' && !p.fromEnd.frac);
  check('y respeta el que puso alguien a mano', !('toEnd' in p));
}

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
