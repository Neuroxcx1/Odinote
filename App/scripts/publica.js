// =====================================================
// Oddinote — publicar una versión en GitHub, de una vez.
//
//   node scripts/publica.js --notas notas.md            (solo dice lo que haría)
//   node scripts/publica.js --notas notas.md --de-verdad (lo hace)
//
// Antes eran siete pasos en el navegador cada vez: crear la etiqueta, subirla,
// abrir la página de publicaciones, escribir el título, pegar las notas, subir
// el zip y el APK y marcarla como la última. Ahora es esto, con la GitHub CLI
// (gh), instalada el 17 de octubre de 2026.
//
// Por defecto NO publica nada: enseña lo que haría. Publicar es algo que ve
// todo el mundo y que avisa a quien tenga la aplicación instalada (la campana
// de actualización mira la última publicación), así que hace falta pedirlo
// con --de-verdad.
//
// La sesión de gh la abre quien publica, una sola vez: `gh auth login`. Este
// script no toca credenciales.
//
// Qué hace:
//   1. Lee la versión de package.json (la única que hay: ver marca-build.js).
//   2. Mira que existan dist/release/Oddinote-<versión>-win32-x64.zip y, si
//      lo hay, el APK de esa versión (npm run build:exe y npm run apk).
//   3. Mira que no haya cambios sin guardar en git: la etiqueta tiene que
//      apuntar a lo que se compiló.
//   4. Crea la etiqueta v<versión> (anotada) si no existe y la sube.
//   5. Crea la publicación con las notas, los archivos y como la última.
// =====================================================
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const REPO = 'Neuroxcx1/Odinote';   // el repositorio se sigue llamando así (no renombrar)

const args = process.argv.slice(2);
const deVerdad = args.includes('--de-verdad');
const iNotas = args.indexOf('--notas');
const notas = iNotas >= 0 ? args[iNotas + 1] : null;

const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
// --version X: otra versión que no sea la de package.json (para mirar en prueba
// cómo quedaría una ya compilada).
const iVersion = args.indexOf('--version');
const version = iVersion >= 0 ? args[iVersion + 1] : pkg.version;
const etiqueta = 'v' + version;

const fallo = (texto) => { console.error('\n  ✗ ' + texto + '\n'); process.exit(1); };
const paso = (texto) => console.log('  · ' + texto);

// gh puede no estar en el PATH de una consola abierta antes de instalarlo.
function rutaGh() {
  const candidatas = ['gh', 'C:\\Program Files\\GitHub CLI\\gh.exe'];
  for (const c of candidatas) {
    try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c; } catch (e) {}
  }
  return null;
}
const corre = (exe, a, opciones) => execFileSync(exe, a, Object.assign({ cwd: APP, encoding: 'utf8' }, opciones || {}));

console.log(`\n  Publicar Oddinote ${version} (${etiqueta}) en ${REPO}${deVerdad ? '' : '  —  PRUEBA: no se publica nada'}\n`);

const gh = rutaGh();
if (!gh) fallo('No encuentro gh (GitHub CLI). Se instala con: winget install --id GitHub.cli');
let conSesion = true;
try { corre(gh, ['auth', 'status'], { stdio: 'pipe' }); } catch (e) { conSesion = false; }
// En la prueba se sigue igual, para poder ver lo que haría; de verdad, no.
if (!conSesion && deVerdad) fallo('gh no tiene la sesión abierta. Ábrela una vez con: gh auth login');
paso(conSesion ? 'gh listo y con la sesión abierta' : 'gh instalado, SIN sesión (antes de publicar: gh auth login)');

if (!notas) fallo('Faltan las notas: --notas archivo.md (en inglés, como las de la 1.0.8 y la 1.0.9).');
const rutaNotas = path.resolve(process.cwd(), notas);
if (!fs.existsSync(rutaNotas)) fallo('No existe el archivo de notas: ' + rutaNotas);
paso('notas: ' + rutaNotas);

const dirRelease = path.join(APP, 'dist', 'release');
const zip = path.join(dirRelease, `Oddinote-${version}-win32-x64.zip`);
if (!fs.existsSync(zip)) fallo(`No está el zip de esta versión: ${zip}\n    Se hace con: npm run build:exe`);
const archivos = [zip];
const apk = path.join(dirRelease, `Oddinote-${version}.apk`);
if (fs.existsSync(apk)) archivos.push(apk);
else console.log('  ! Sin APK de esta versión (se publica solo el zip). Se hace con: npm run apk, desde Movil/');
archivos.forEach(a => paso('archivo: ' + path.basename(a) + ' (' + (fs.statSync(a).size / 1048576).toFixed(1) + ' MB)'));

const sucio = corre('git', ['status', '--porcelain', '--', '.']).trim();
if (sucio) fallo('Hay cambios sin guardar en git dentro de App/. La etiqueta tiene que apuntar a lo que se compiló:\n' + sucio);
paso('git sin cambios pendientes');

let tieneEtiqueta = false;
try { corre('git', ['rev-parse', '-q', '--verify', 'refs/tags/' + etiqueta], { stdio: 'pipe' }); tieneEtiqueta = true; } catch (e) {}

const ordenes = [];
if (!tieneEtiqueta) ordenes.push(['git', ['tag', '-a', etiqueta, '-m', 'Oddinote ' + version]]);
ordenes.push(['git', ['push', 'origin', etiqueta]]);
ordenes.push([gh, ['release', 'create', etiqueta, '--repo', REPO, '--title', 'Oddinote ' + version, '--notes-file', rutaNotas, '--latest', '--verify-tag'].concat(archivos)]);

console.log('');
for (const [exe, a] of ordenes) {
  const linea = [path.basename(exe)].concat(a.map(x => (/\s/.test(x) ? `"${x}"` : x))).join(' ');
  if (!deVerdad) { console.log('  haría: ' + linea); continue; }
  console.log('  > ' + linea);
  try { corre(exe, a, { stdio: 'inherit' }); }
  catch (e) { fallo('Falló ese paso; lo de antes ya está hecho. Mira el mensaje de arriba.'); }
}
console.log(deVerdad
  ? `\n  ✓ Publicada: https://github.com/${REPO}/releases/tag/${etiqueta}\n`
  : '\n  Para hacerlo de verdad, lo mismo con --de-verdad.\n');
