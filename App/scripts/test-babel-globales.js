// Que dos .jsx no dejen la misma variable global.  node scripts/test-babel-globales.js
//
// Los .jsx se compilan en el navegador, cada uno por su lado, y se ejecutan en
// el MISMO ámbito global. Algunas formas de escribir hacen que Babel añada
// arriba del archivo una ayuda con nombre fijo: «const { a, ...resto } = o»
// deja «const _excluded = [...]». Si dos archivos la tienen, el segundo falla
// al cargar («Identifier '_excluded' has already been declared») y la
// aplicación se queda en BLANCO. Cada archivo compila bien por separado, así
// que solo se ve abriendo la app. Pasó el 17 de octubre con las plantillas.
const fs = require('fs');
const path = require('path');
const B = require('../lib/babel.min.js');
const Babel = B.transform ? B : global.Babel;

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// Hay que compilar COMO el navegador: a un <script type="text/babel"> sin
// data-plugins, Babel le pone por su cuenta estos tres plugins (está en
// lib/babel.min.js, donde arma las opciones de cada etiqueta). Con solo
// presets: ['react'] el «...resto» se queda tal cual y la prueba no ve nada.
const PLUGINS_DEL_NAVEGADOR = ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'];
const compila = (codigo, f) => Babel.transform(codigo, { presets: ['react'], plugins: PLUGINS_DEL_NAVEGADOR, filename: f }).code;

// Solo las ayudas que mete Babel (empiezan por guion bajo) y que quedan en lo
// más alto del archivo: las variables propias de cada uno no son cosa suya.
// Una «function _objectSpread» repetida en dos scripts no rompe nada (la
// segunda pisa a la primera, que es idéntica); lo que no se deja declarar dos
// veces en el ámbito global es const, let y class.
const ayudas = (codigo) => [...codigo.matchAll(/^(var|let|const|class|function) (_[A-Za-z]\w*)\b/gm)]
  .map(m => ({ nombre: m[2], fija: /^(let|const|class)$/.test(m[1]) }));

// Antes de mirar los de verdad: que la prueba sepa ver el fallo.
check('la prueba ve la ayuda de «...resto»',
  ayudas(compila('function f(o){ const { a, ...r } = o; return r; }', 'x.jsx')).some(a => a.nombre === '_excluded' && a.fija));

// Las etiquetas de index.html dicen qué se carga y en qué orden.
const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const etiquetas = [...INDEX.matchAll(/<script type="text\/babel"([^>]*)src="\.\/([^"?]+)/g)];
check('index.html carga .jsx con Babel', etiquetas.length > 10, etiquetas.length + ' etiquetas');
check('ninguna etiqueta cambia los plugins de Babel', etiquetas.every(m => !/data-plugins/.test(m[1])));

const deQuien = {};
for (const [, , rel] of etiquetas) {
  const codigo = compila(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'), path.basename(rel));
  for (const a of ayudas(codigo)) {
    const d = deQuien[a.nombre] = deQuien[a.nombre] || { archivos: new Set(), fija: false };
    d.archivos.add(path.basename(rel));
    d.fija = d.fija || a.fija;
  }
}
const repetidas = Object.entries(deQuien)
  .filter(([, d]) => d.fija && d.archivos.size > 1)
  .map(([n, d]) => [n, [...d.archivos]]);
check('ninguna ayuda de Babel se repite entre archivos', repetidas.length === 0,
  repetidas.map(([n, a]) => `${n} en ${a.join(' y ')}`).join('; '));

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
