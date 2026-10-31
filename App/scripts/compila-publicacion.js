// =====================================================
// Oddinote — compilar lo que se publica en Windows (desde la 1.2.2).
//
//   node scripts/compila-publicacion.js
//
// 1. Empaqueta como «Odinote» (scripts/empaqueta.js: con el código ya
//    traducido) en dist/compila-<versión>-<build>/. Se llama Odinote y no
//    Oddinote a propósito: el instalador busca Odinote.exe (productName de
//    package.json, que NO se cambia: de él cuelga la carpeta de datos), y
//    main.js reconoce una copia instalada por «Uninstall Odinote.exe».
// 2. Hace el instalador con electron-builder sobre esa carpeta
//    (--prepackaged): NSIS por usuario, sin pedir administrador, con la
//    pantalla de licencia (instalador/aviso.txt + LICENSE: ahí se aceptan las
//    estadísticas, lo pidió el usuario) y que también sabe instalarse en
//    silencio (/S), que es como se actualiza solo.
// 3. Lo deja en dist/release/Oddinote-Setup-<versión>.exe y dice su sha256.
//
// No sube nada: publicar es aparte y con el «sí» del usuario. Las notas de
// la publicación tienen que llevar <!-- odinote-build: N --> (ver
// src/actualizacion-logica.js): con eso avisa también una sustitución.
// =====================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const empaqueta = require('./empaqueta');

const APP = path.join(__dirname, '..');
const pkg = require(path.join(APP, 'package.json'));
const build = (fs.readFileSync(path.join(APP, 'src', 'app.jsx'), 'utf8').match(/ODINOTE_BUILD = '([^']+)'/) || [])[1] || pkg.version;
const SALIDA = path.join(APP, 'dist', `compila-${build}`);
const RELEASE = path.join(APP, 'dist', 'release');

(async () => {
  console.log(`\n  Compilando la ${build} para publicar…\n`);
  const carpeta = empaqueta({ nombre: 'Odinote', salida: SALIDA });

  // La licencia del instalador: el aviso y, debajo, la licencia entera.
  const licencia = path.join(SALIDA, 'licencia-instalador.txt');
  fs.writeFileSync(licencia, '﻿' + fs.readFileSync(path.join(APP, 'instalador', 'aviso.txt'), 'utf8') + fs.readFileSync(path.join(APP, 'LICENSE'), 'utf8'), 'utf8');

  const builder = require(path.join(APP, 'node_modules', 'electron-builder'));
  const salidaNsis = path.join(SALIDA, 'instalador');
  await builder.build({
    targets: builder.Platform.WINDOWS.createTarget(['nsis'], builder.Arch.x64),
    prepackaged: carpeta,
    publish: 'never',
    config: {
      ...pkg.build,
      directories: { output: salidaNsis },
      nsis: { ...pkg.build.nsis, license: licencia },
    },
  });
  const setup = fs.readdirSync(salidaNsis).find(f => /^Oddinote-Setup-.*\.exe$/.test(f));
  if (!setup) throw new Error('electron-builder no dejó el instalador');
  fs.mkdirSync(RELEASE, { recursive: true });
  const destino = path.join(RELEASE, setup);
  fs.copyFileSync(path.join(salidaNsis, setup), destino);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(destino)).digest('hex');
  const mb = (fs.statSync(destino).size / 1048576).toFixed(1);
  console.log(`\n  Instalador: ${destino} (${mb} MB)\n  sha256: ${sha}\n  En las notas de la publicación: <!-- odinote-build: ${build.split('-')[1]} -->\n`);
})().catch(e => { console.error(e); process.exit(1); });
