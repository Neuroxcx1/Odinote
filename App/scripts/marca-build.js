// =====================================================
// Oddinote — el marcador de caché y la versión, puestos por el propio build
//
//   node scripts/marca-build.js            sube el número de build (lo hacen
//                                          solos build:pre y build:exe)
//   node scripts/marca-build.js --mira     solo dice cómo está
//
// Antes, cada compilación exigía subir a mano ?v=NNN en las 37 etiquetas de
// index.html y window.ODINOTE_BUILD en app.jsx. Olvidarlo no daba ningún
// error: se servía la versión guardada en caché y parecía que el cambio no se
// había hecho, y se perdieron ratos buscando fallos que no existían.
//
// Y la versión estaba escrita dos veces (package.json y CURRENT_VERSION en
// app.jsx); cuando no coincidían, la campana de actualización se quedaba
// encendida para siempre. Ahora la versión vive SOLO en package.json: este
// script la copia a ODINOTE_BUILD ("1.2.0-212") y app.jsx la lee de ahí.
//
// Los archivos son CRLF: solo se cambian trozos dentro de una línea, así que
// los finales de línea no se tocan.
// =====================================================

const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const RUTA_INDEX = path.join(APP, 'index.html');
const RUTA_APP = path.join(APP, 'src', 'app.jsx');
const RUTA_PKG = path.join(APP, 'package.json');

const RE_BUILD = /window\.ODINOTE_BUILD = '([^']*)';/;
const RE_V = /\?v=(\d+)\b/g;

// Cómo está todo ahora mismo. Sin escribir nada.
function lee() {
  const index = fs.readFileSync(RUTA_INDEX, 'utf8');
  const app = fs.readFileSync(RUTA_APP, 'utf8');
  const pkg = JSON.parse(fs.readFileSync(RUTA_PKG, 'utf8'));
  const m = RE_BUILD.exec(app);
  const marca = m ? m[1] : null;
  const partes = marca ? /^(.*)-(\d+)$/.exec(marca) : null;
  const vs = [...index.matchAll(RE_V)].map(x => Number(x[1]));
  return {
    version: pkg.version,
    marca,
    versionDeLaMarca: partes ? partes[1] : null,
    numero: partes ? Number(partes[2]) : null,
    vs,
    index, app,
  };
}

// Lo que no cuadra, en palabras. Vacío si está todo bien.
function problemas(e) {
  const p = [];
  if (!e.marca) p.push('app.jsx no tiene window.ODINOTE_BUILD');
  if (e.marca && e.numero == null) p.push(`ODINOTE_BUILD no acaba en un número: "${e.marca}"`);
  if (e.versionDeLaMarca && e.versionDeLaMarca !== e.version) {
    p.push(`ODINOTE_BUILD dice ${e.versionDeLaMarca} y package.json ${e.version}`);
  }
  if (!e.vs.length) p.push('index.html no tiene ninguna etiqueta ?v=');
  const distintos = [...new Set(e.vs)];
  if (distintos.length > 1) p.push(`index.html mezcla marcadores: ${distintos.join(', ')}`);
  if (e.numero != null && distintos.length === 1 && distintos[0] !== e.numero) {
    p.push(`index.html usa ?v=${distintos[0]} y ODINOTE_BUILD el ${e.numero}`);
  }
  return p;
}

// El siguiente número: uno más que el mayor que haya, para no repetir nunca
// uno ya servido aunque los archivos estuvieran descuadrados.
function sube() {
  const e = lee();
  const n = Math.max(e.numero || 0, ...e.vs, 0) + 1;
  const marca = `${e.version}-${n}`;
  const app = e.app.replace(RE_BUILD, `window.ODINOTE_BUILD = '${marca}';`);
  const index = e.index.replace(RE_V, `?v=${n}`);
  fs.writeFileSync(RUTA_APP, app, 'utf8');
  fs.writeFileSync(RUTA_INDEX, index, 'utf8');
  return { marca, etiquetas: e.vs.length };
}

module.exports = { lee, problemas, sube };

if (require.main === module) {
  if (process.argv.includes('--mira')) {
    const e = lee();
    const p = problemas(e);
    console.log(`  versión ${e.version} · build ${e.marca} · ${e.vs.length} etiquetas ?v en index.html`);
    p.forEach(x => console.log('  NO CUADRA: ' + x));
    process.exit(p.length ? 1 : 0);
  }
  const r = sube();
  console.log(`\n  Build ${r.marca} (${r.etiquetas} etiquetas ?v en index.html)\n`);
}
