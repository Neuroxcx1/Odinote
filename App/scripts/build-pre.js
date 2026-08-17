// =====================================================
// Odinote — compilación de PRUEBA (pre-release).
//
//   npm run build:pre
//
// Empaqueta en dist/pre-release/, aparte de la carpeta de la versión buena.
// Así se puede abrir la compilación de prueba sin tocar ni sustituir la
// instalación que se usa a diario: son dos carpetas distintas y ninguna pisa
// a la otra.
//
// Los datos son los mismos en las dos, ojo: proyectos y bóveda viven en
// AppData\Roaming\Odinote, fuera de estas carpetas. Probar aquí usa las notas
// de verdad.
// =====================================================

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const APP_DIR = path.join(__dirname, '..');
const pkg = require(path.join(APP_DIR, 'package.json'));
const OUT_DIR = path.join(APP_DIR, 'dist', 'pre-release');

fs.mkdirSync(OUT_DIR, { recursive: true });

console.log(`\n  Compilando prueba de la ${pkg.version} en dist/pre-release/ …\n`);

// Por el shell: en Windows el ejecutable del paquete es un .cmd, y execFile
// no sabe lanzarlo directamente.
//
// El --ignore de dist/ NO es opcional. El empaquetador excluye solo la carpeta
// de salida que se le indica, y aquí esa carpeta es dist/pre-release: todo lo
// demás que hubiera en dist/ —la compilación buena y su zip— se colaba DENTRO
// del ejecutable de prueba. Salían 1 GB en vez de 260 MB, y el zip para
// repartir pesaba cinco veces lo que debía.
execSync(
  `npx electron-packager . Odinote-pre --platform=win32 --arch=x64 --out="${OUT_DIR}" ` +
  `--overwrite --icon=Icon/Icon.ico --ignore="^/dist($|/)"`,
  { cwd: APP_DIR, stdio: 'inherit' }
);

const PACK_DIR = path.join(OUT_DIR, 'Odinote-pre-win32-x64');
const exe = path.join(PACK_DIR, 'Odinote-pre.exe');
console.log(`\n  Listo. Ábrelo desde:\n  ${exe}\n`);
console.log('  (Tu instalación normal en dist/Odinote-win32-x64 no se ha tocado.)\n');

// ── Y el zip, para poder subirlo a un release y probar el aviso de novedades ──
// Lleva el número de versión en el nombre porque es lo que ve quien lo descarga
// desde GitHub, no el nombre de la carpeta interna.
const archiver = require('archiver');
const ZIP_NAME = `Odinote-${pkg.version}-win32-x64.zip`;
const ZIP_PATH = path.join(OUT_DIR, ZIP_NAME);
if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);

const salida = fs.createWriteStream(ZIP_PATH);
const zip = archiver('zip', { zlib: { level: 9 } });
salida.on('close', () => {
  const mb = (zip.pointer() / 1024 / 1024).toFixed(1);
  console.log(`  Y el zip para repartir:\n  ${ZIP_PATH}  (${mb} MB)\n`);
});
zip.on('error', (err) => { throw err; });
zip.pipe(salida);
// Dentro del zip todo cuelga de una carpeta con el nombre del programa, para
// que al descomprimir no se desparrame por la carpeta de descargas.
zip.directory(PACK_DIR, `Odinote-${pkg.version}`);
zip.finalize();
