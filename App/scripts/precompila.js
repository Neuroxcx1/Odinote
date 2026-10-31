// =====================================================
// Oddinote — dejar el código ya traducido en una copia empaquetada.
//
//   require('./precompila')(carpeta)   ·   node scripts/precompila.js <carpeta>
//
// La app escribe JSX y el navegador lo traduce con Babel AL ARRANCAR: 21
// archivos en cada apertura, unos 2,5 s hasta ver algo (lo pidió el usuario
// para la 1.2.2: «arranque rápido»). En la copia empaquetada eso sobra:
// aquí cada <script type="text/babel" src="./src/X.jsx?v=N"> se traduce una
// vez a X.js y la etiqueta pasa a ser un <script> normal; Babel sale de la
// página y de la copia. Es lo mismo que hace Movil/scripts/preparar-web.js
// para el APK. El código fuente no se toca: solo la copia que se reparte.
//
// Solo con el preset de React, como el APK: el Babel del navegador añadía por
// su cuenta transform-object-rest-spread (ver CLAUDE.md, «_excluded»), y aquí
// no hace falta porque Chromium ya entiende ...resto.
// =====================================================
const fs = require('fs');
const path = require('path');

function precompila(carpeta) {
  const B = require(path.join(__dirname, '..', 'lib', 'babel.min.js'));
  const Babel = B && B.transform ? B : global.Babel;
  const indice = path.join(carpeta, 'index.html');
  let html = fs.readFileSync(indice, 'utf8');
  const hechos = [];
  html = html.replace(/<script\b[^>]*type="text\/babel"[^>]*><\/script>/g, (etiqueta) => {
    const m = etiqueta.match(/src="\.\/([^"?]+)(\?[^"]*)?"/);
    if (!m) throw new Error('etiqueta text/babel sin src: ' + etiqueta);
    const relativo = m[1], marca = m[2] || '';
    const origen = path.join(carpeta, relativo);
    const destinoRel = relativo.replace(/\.jsx$/, '.js');
    const codigo = fs.readFileSync(origen, 'utf8');
    const salida = Babel.transform(codigo, { presets: ['react'], filename: path.basename(origen) }).code;
    fs.writeFileSync(path.join(carpeta, destinoRel), salida, 'utf8');
    if (destinoRel !== relativo) fs.unlinkSync(origen);
    hechos.push(destinoRel);
    return '<script src="./' + destinoRel + marca + '"></script>';
  });
  if (!hechos.length) throw new Error('no había nada que traducir en ' + indice);
  // Fuera Babel: ya no queda nada que traducir.
  html = html.replace(/[ \t]*<script src="\.\/lib\/babel\.min\.js"><\/script>\r?\n/, '');
  if (/babel\.min\.js/.test(html)) throw new Error('index.html sigue cargando Babel');
  fs.writeFileSync(indice, html, 'utf8');
  try { fs.unlinkSync(path.join(carpeta, 'lib', 'babel.min.js')); } catch (e) {}
  return hechos;
}

module.exports = precompila;

if (require.main === module) {
  const c = process.argv[2];
  if (!c) { console.error('Uso: node scripts/precompila.js <carpeta con index.html>'); process.exit(1); }
  const h = precompila(path.resolve(c));
  console.log(`Traducidos ${h.length} archivos; Babel fuera.`);
}
