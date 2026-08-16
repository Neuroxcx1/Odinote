// =====================================================
// Odinote — empaqueta dist/Odinote-win32-x64 en un .zip listo para repartir.
//
// Se ejecuta solo, después de electron-packager, como parte de
// `npm run build:exe`. El zip sale en dist/release/, nunca dentro de la
// carpeta que node_modules usa para las dependencias (ahí es donde antes se
// creaba a mano, mezclado con archivos internos del empaquetado).
//
// No incluye datos del usuario porque no los hay que incluir: los proyectos y
// la bóveda viven en app.getPath('userData') (fuera de esta carpeta por
// completo), así que cada zip es una copia limpia del código sin importar
// cuántas veces se regenere.
// =====================================================

const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const APP_DIR = path.join(__dirname, '..');
const pkg = require(path.join(APP_DIR, 'package.json'));

const SRC_DIR = path.join(APP_DIR, 'dist', 'Odinote-win32-x64');
const RELEASE_DIR = path.join(APP_DIR, 'dist', 'release');
const ZIP_NAME = `Odinote-${pkg.version}-win32-x64.zip`;
const ZIP_PATH = path.join(RELEASE_DIR, ZIP_NAME);

if (!fs.existsSync(SRC_DIR)) {
  console.error(`No se encuentra ${SRC_DIR}. Ejecuta electron-packager antes que este script.`);
  process.exit(1);
}

fs.mkdirSync(RELEASE_DIR, { recursive: true });
// Empezar en limpio: si ya existía un zip de esta misma versión, se sustituye
// entero en vez de mezclarse con él.
if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);

const output = fs.createWriteStream(ZIP_PATH);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const mb = (archive.pointer() / 1024 / 1024).toFixed(1);
  console.log(`\n  Listo: dist/release/${ZIP_NAME} (${mb} MB)\n`);
});
archive.on('warning', (err) => { console.warn(err); });
archive.on('error', (err) => { throw err; });

archive.pipe(output);
// La carpeta raíz dentro del zip se llama "Odinote", no "Odinote-win32-x64":
// al extraerlo, el atajo/acceso directo que la gente cree queda con un
// nombre limpio.
archive.directory(SRC_DIR, 'Odinote');
archive.finalize();
