// Pruebas de geometría del conector.  node scripts/test-connector.js
//
// El tirador del centro aparecía pegado al nodo pequeño cuando los dos nodos
// tenían tamaños muy distintos. La causa: el punto de control salía del punto
// medio de los CENTROS, que no es el medio del tramo que se ve.
const path = require('path');
const fs = require('fs');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// Se saca edgeIntersect del código de verdad, no una copia
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'Connector.jsx'), 'utf-8');
const m = src.match(/function edgeIntersect\(item, tx, ty\) \{([\s\S]*?)\n\}/);
check('se encuentra edgeIntersect en Connector.jsx', !!m);
if (!m) { console.log('\n1 FALLOS'); process.exit(1); }
const edgeIntersect = new Function('item', 'tx', 'ty', m[1]);

const centro = (it) => ({ x: it.x + it.w / 2, y: it.y + it.h / 2 });

// Método viejo: el medio de los centros
function qViejo(A, B) {
  const cA = centro(A), cB = centro(B);
  return { x: (cA.x + cB.x) / 2, y: (cA.y + cB.y) / 2 };
}
// Método nuevo: dos pasadas hasta el medio de los bordes
function qNuevo(A, B) {
  const cA = centro(A), cB = centro(B);
  let q = { x: (cA.x + cB.x) / 2, y: (cA.y + cB.y) / 2 };
  for (let i = 0; i < 2; i++) {
    const bA = edgeIntersect(A, q.x, q.y);
    const bB = edgeIntersect(B, q.x, q.y);
    q = { x: (bA.x + bB.x) / 2, y: (bA.y + bB.y) / 2 };
  }
  return q;
}
// Cuánto se desvía el punto de control del medio REAL del tramo visible
function desvio(A, B, q) {
  const bA = edgeIntersect(A, q.x, q.y);
  const bB = edgeIntersect(B, q.x, q.y);
  const medioReal = { x: (bA.x + bB.x) / 2, y: (bA.y + bB.y) / 2 };
  return Math.hypot(q.x - medioReal.x, q.y - medioReal.y);
}

// ── El caso de la captura: un nodo ancho y uno estrecho, muy juntos ──
const grande = { x: 0,   y: 0,   w: 700, h: 500 };  // marco/tablero grande
const chico  = { x: 730, y: 180, w: 120, h: 400 };  // nota estrecha al lado

const dViejo = desvio(grande, chico, qViejo(grande, chico));
const dNuevo = desvio(grande, chico, qNuevo(grande, chico));
check('con tamaños muy distintos, el método viejo se desviaba del centro visible',
  dViejo > 20, `${dViejo.toFixed(1)}px`);
check('el nuevo queda prácticamente en el centro del tramo visible',
  dNuevo < 1, `${dNuevo.toFixed(2)}px`);
check('la mejora es grande, no cosmética',
  dNuevo < dViejo / 10, `${dViejo.toFixed(1)}px → ${dNuevo.toFixed(2)}px`);

// ── Con nodos del mismo tamaño no debe cambiar nada ──
const izq = { x: 0,   y: 0, w: 200, h: 120 };
const der = { x: 400, y: 0, w: 200, h: 120 };
const qv = qViejo(izq, der), qn = qNuevo(izq, der);
check('con nodos iguales el punto de control no se mueve',
  Math.hypot(qv.x - qn.x, qv.y - qn.y) < 0.01,
  `viejo (${qv.x.toFixed(0)},${qv.y.toFixed(0)}) → nuevo (${qn.x.toFixed(0)},${qn.y.toFixed(0)})`);

// ── El tirador cae de verdad en medio de la línea visible ──
const casos = [
  ['grande ↔ chico', grande, chico],
  ['iguales',        izq,    der],
  ['alto ↔ ancho',   { x:0,y:0,w:80,h:600 }, { x:300,y:250,w:600,h:80 }],
  ['uno dentro del otro (solapados)', { x:0,y:0,w:600,h:400 }, { x:100,y:100,w:150,h:100 }],
];
casos.forEach(([nombre, A, B]) => {
  const q = qNuevo(A, B);
  const bA = edgeIntersect(A, q.x, q.y), bB = edgeIntersect(B, q.x, q.y);
  // El tirador de un Bézier cuadrático en t=0.5
  const h = { x: 0.25*bA.x + 0.5*q.x + 0.25*bB.x, y: 0.25*bA.y + 0.5*q.y + 0.25*bB.y };
  const medio = { x: (bA.x + bB.x)/2, y: (bA.y + bB.y)/2 };
  const d = Math.hypot(h.x - medio.x, h.y - medio.y);
  check(`el tirador queda centrado (${nombre})`, d < 1.5, `${d.toFixed(2)}px del medio`);
  check(`el punto de control es finito (${nombre})`, Number.isFinite(q.x) && Number.isFinite(q.y));
});

// ── Nodos pegados o encima: no debe salir NaN ni infinito ──
const pegados = [
  ['bordes tocándose', { x:0,y:0,w:100,h:100 }, { x:100,y:0,w:100,h:100 }],
  ['mismo centro',     { x:0,y:0,w:100,h:100 }, { x:0,y:0,w:100,h:100 }],
  ['uno diminuto',     { x:0,y:0,w:1000,h:800 }, { x:400,y:400,w:2,h:2 }],
];
pegados.forEach(([nombre, A, B]) => {
  const q = qNuevo(A, B);
  check(`caso límite sin números inválidos (${nombre})`,
    Number.isFinite(q.x) && Number.isFinite(q.y), `q=(${q.x},${q.y})`);
});

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
