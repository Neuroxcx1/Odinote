// Que el marcador de caché y la versión cuadren.  node scripts/test-marca-build.js
//
// Un descuadre no da ningún error a la vista: o se sirve el código viejo de la
// caché, o la campana de actualización se enciende para siempre. Mejor que lo
// diga npm test.
const M = require('./marca-build.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const e = M.lee();
check('app.jsx tiene ODINOTE_BUILD con versión y número', !!e.marca && e.numero != null, e.marca);
check('la versión del build es la de package.json', e.versionDeLaMarca === e.version, `${e.versionDeLaMarca} / ${e.version}`);
check('index.html tiene sus etiquetas ?v', e.vs.length >= 30, String(e.vs.length));
check('todas las etiquetas ?v llevan el mismo número', new Set(e.vs).size === 1, [...new Set(e.vs)].join(', '));
check('y es el del build', e.vs.every(v => v === e.numero), `${e.vs[0]} / ${e.numero}`);
check('nada que no cuadre', M.problemas(e).length === 0, M.problemas(e).join('; '));
// app.jsx no puede volver a llevar la versión escrita a mano.
check('CURRENT_VERSION sale del build, no escrita a mano',
  /const CURRENT_VERSION = String\(window\.ODINOTE_BUILD/.test(e.app));

// Lo que detecta, con datos inventados.
const base = { version: '1.2.0', marca: '1.2.0-5', versionDeLaMarca: '1.2.0', numero: 5, vs: [5, 5, 5] };
check('todo bien, nada que decir', M.problemas(base).length === 0);
check('ve las etiquetas mezcladas', M.problemas({ ...base, vs: [5, 4, 5] }).length === 1);
check('ve el número distinto', M.problemas({ ...base, vs: [4, 4] }).length === 1);
check('ve la versión distinta', M.problemas({ ...base, version: '1.2.1' }).length === 1);

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
