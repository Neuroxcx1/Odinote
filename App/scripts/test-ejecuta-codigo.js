// La terminal del nodo de código (src/ejecuta-codigo.js).  node scripts/test-ejecuta-codigo.js
//
// El worker de verdad solo existe en el navegador. Aquí se ejecuta el MISMO
// programa que se le manda (fuenteDelTrabajador) dentro de un contexto de node
// aislado que hace de worker: con su postMessage, su onmessage y un fetch que
// no debería poder alcanzarse.
const vm = require('vm');
const E = require('../src/ejecuta-codigo.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra !== undefined ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// ── Cómo se escriben los valores ──
const f = E.formatea;
check('un texto suelto va tal cual', f('hola') === 'hola');
check('dentro de un objeto, con comillas', f({ a: 'x' }) === '{ a: "x" }', f({ a: 'x' }));
check('números, -0 y bigint', f(3) === '3' && f(-0) === '-0' && f(BigInt(5)) === '5n');
check('null y undefined', f(null) === 'null' && f(undefined) === 'undefined');
check('una lista', f([1, 'b', [2]]) === '[ 1, "b", [ 2 ] ]', f([1, 'b', [2]]));
check('una lista vacía', f([]) === '[]', f([]));
check('un objeto vacío', f({}) === '{}');
check('una función con nombre', f(function suma() {}) === '[Function: suma]');
check('un error', f(new TypeError('mal')) === 'TypeError: mal');
const ciclo = { a: 1 }; ciclo.yo = ciclo;
check('un objeto que se contiene a sí mismo no cuelga', f(ciclo) === '{ a: 1, yo: [Circular] }', f(ciclo));
check('Map y Set', f(new Map([['k', 1]])) === 'Map(1) { "k" => 1 }' && f(new Set([1, 2])) === 'Set(2) { 1, 2 }', f(new Map([['k', 1]])) + ' ' + f(new Set([1, 2])));
const largo = Array.from({ length: 150 }, (_, i) => i);
check('una lista enorme se corta', /… 50 más \]$/.test(f(largo)));
const hondo = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
check('muy anidado se resume', /\[Object\]/.test(f(hondo)), f(hondo));
check('una clave rara va entre comillas', f({ 'a-b': 1 }) === '{ "a-b": 1 }');
check('una clase dice su nombre', f(new (class Punto { constructor() { this.x = 1; } })()) === 'Punto { x: 1 }');

// ── El worker, en un contexto aislado ──
const fuente = E.fuenteDelTrabajador();
let sintaxisBien = true;
try { new vm.Script(fuente); } catch (e) { sintaxisBien = false; console.log(e.message); }
check('el programa del worker se puede leer', sintaxisBien);

function corre(codigo) {
  return new Promise((resolve) => {
    const mensajes = [];
    const ctx = {
      performance: { now: () => Date.now() },
      setTimeout, clearTimeout, Promise,
      fetch: () => 'RED ALCANZADA',
      XMLHttpRequest: function () { return 'RED ALCANZADA'; },
      importScripts: () => 'RED ALCANZADA',
      addEventListener: () => {},
    };
    ctx.self = ctx;
    ctx.postMessage = (m) => {
      mensajes.push(m);
      if (m.tipo === 'fin') setTimeout(() => resolve(mensajes), 30);
    };
    vm.createContext(ctx);
    vm.runInContext(fuente, ctx);
    ctx.onmessage({ data: { codigo } });
    setTimeout(() => resolve(mensajes), 1500);
  });
}
const lineas = (ms) => ms.filter(m => m.tipo !== 'fin').map(m => m.tipo + ':' + m.texto);
const finDe = (ms) => ms.find(m => m.tipo === 'fin') || {};

(async () => {
  let m = await corre('console.log("hola", 1 + 1); console.warn("ojo"); console.error({ a: 1 });');
  check('la consola llega en orden y con su tipo', JSON.stringify(lineas(m)) === JSON.stringify(['log:hola 2', 'warn:ojo', 'error:{ a: 1 }']), JSON.stringify(lineas(m)));

  m = await corre('const x = 6;\nx * 7');
  check('el valor de la última línea es el resultado', finDe(m).hay && finDe(m).resultado === '42', JSON.stringify(finDe(m)));

  m = await corre('let a = 1;\nlet b = 2;\nnoExiste(a, b);');
  check('un error dice su línea', lineas(m)[0] === 'error:ReferenceError: noExiste is not defined (línea 3)', lineas(m)[0]);
  check('y termina como fallo', finDe(m).fallo === true);

  m = await corre('const p = new Promise(r => setTimeout(() => r(5), 20));\nconst v = await p;\nconsole.log("vale", v);');
  check('un await suelto funciona', lineas(m)[0] === 'log:vale 5', JSON.stringify(lineas(m)));

  m = await corre('await Promise.resolve();\nnoHay();');
  check('y su error sigue diciendo la línea buena', /\(línea 2\)$/.test(lineas(m)[0] || ''), lineas(m)[0]);

  m = await corre('console.log(typeof fetch, typeof XMLHttpRequest, typeof importScripts, typeof Object.getPrototypeOf(self).fetch);');
  check('sin red: fetch, XMLHttpRequest e importScripts no están', lineas(m)[0] === 'log:undefined undefined undefined undefined', lineas(m)[0]);

  m = await corre('console = null; console.log("sigue")');
  check('la consola no se puede quitar', lineas(m).includes('log:sigue') || lineas(m).some(l => /error/.test(l)), JSON.stringify(lineas(m)));

  m = await corre('function f() { return 1 }');
  check('sin valor al final, sin resultado', finDe(m).hay === false);

  m = await corre('var g = 3; g');
  check('el código no estricto también va (var, sin "use strict")', finDe(m).resultado === '3', JSON.stringify(finDe(m)));

  m = await corre('console.time("t"); console.timeEnd("t"); console.clear();');
  check('time/timeEnd y clear', /^log:t: \d+\.\d ms$/.test(lineas(m)[0] || '') && m.some(x => x.tipo === 'limpia'), JSON.stringify(lineas(m)));

  m = await corre('if (');
  check('un error de sintaxis se cuenta, no rompe', /^error:SyntaxError/.test(lineas(m)[0] || ''), lineas(m)[0]);

  console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
  process.exit(fallos ? 1 : 0);
})();
