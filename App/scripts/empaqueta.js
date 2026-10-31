// =====================================================
// Oddinote — empaquetar para Windows (lo usan build-pre.js, build:exe y
// compila-publicacion.js).
//
//   node scripts/empaqueta.js <nombre> <carpeta de salida> [win32|linux]
//   require('./empaqueta')({ nombre, salida, plataforma })   → ruta de la carpeta hecha
// Sin plataforma, la del equipo (Linux lo usa el flujo de GitHub linux.yml).
//
// Por qué no `npx electron-packager` sin más:
//  · electron-packager 17 se queda colgado EN SILENCIO con Node 26 (dice
//    «Packaging…» y sale sin carpeta ni error: npm run build:pre dejaba un zip
//    de 0 MB). Por eso se ejecuta con el Node 18 que trae Electron
//    (ELECTRON_RUN_AS_NODE), en empaqueta-electron.js.
//  · Desde Git Bash el --ignore de dist/ llegaba mal y se colaba la carpeta
//    entera (CLAUDE.md): aquí va como expresión, por la API.
//  · Y deja el código ya traducido (precompila.js): arranca bastante antes.
// =====================================================
const path = require('path');
const { spawnSync } = require('child_process');

const APP = path.join(__dirname, '..');

function empaqueta({ nombre, salida, plataforma }) {
  const pl = plataforma || (process.platform === 'linux' ? 'linux' : 'win32');
  const electron = path.join(APP, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
  const r = spawnSync(electron, [path.join(__dirname, 'empaqueta-electron.js'), nombre, path.resolve(salida), pl], {
    cwd: APP,
    stdio: 'inherit',
    env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }),
  });
  if (r.status !== 0) throw new Error(`el empaquetado falló (código ${r.status})`);
  return path.join(path.resolve(salida), `${nombre}-${pl}-x64`);
}

module.exports = empaqueta;

if (require.main === module) {
  const [nombre, salida, plataforma] = process.argv.slice(2);
  if (!nombre || !salida) { console.error('Uso: node scripts/empaqueta.js <nombre> <carpeta de salida> [win32|linux]'); process.exit(1); }
  try { console.log('Hecho:', empaqueta({ nombre, salida, plataforma })); } catch (e) { console.error(e.message); process.exit(1); }
}
