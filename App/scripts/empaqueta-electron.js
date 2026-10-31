// Lo que corre DENTRO del Node de Electron (ver empaqueta.js). No lanzar a
// mano: node scripts/empaqueta.js <nombre> <salida>.
//
// process.noAsar: el fs de Electron abre los .asar como si fueran carpetas, y
// el empaquetador falla con «Invalid package …default_app.asar» al copiar la
// plantilla de Electron.
process.noAsar = true;
const path = require('path');
const APP = path.join(__dirname, '..');
const packager = require(path.join(APP, 'node_modules', 'electron-packager'));
const precompila = require('./precompila');
const [nombre, salida] = process.argv.slice(2);

packager({
  dir: APP,
  name: nombre,
  platform: 'win32',
  arch: 'x64',
  out: salida,
  overwrite: true,
  icon: path.join(APP, 'Icon', 'Icon.ico'),
  // dist/ (lo compilado) e instalador/ (el texto de su licencia) no van dentro.
  ignore: [/^\/dist($|\/)/, /^\/instalador($|\/)/],
  electronVersion: require(path.join(APP, 'node_modules', 'electron', 'package.json')).version,
  // Con la copia ya hecha y antes de cerrarla: el código, traducido.
  afterCopy: [(carpeta, version, plataforma, arquitectura, listo) => {
    try {
      const h = precompila(carpeta);
      console.log(`  Código ya traducido: ${h.length} archivos (Babel fuera).`);
      listo();
    } catch (e) { listo(e); }
  }],
}).then((rutas) => {
  console.log('  Empaquetado:', rutas.join(', '));
}).catch((e) => { console.error(e); process.exit(1); });
