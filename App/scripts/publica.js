// =====================================================
// Oddinote — publicar una versión en GitHub, de una vez.
//
//   node scripts/publica.js --notas notas.md                 (solo dice lo que haría)
//   node scripts/publica.js --notas notas.md --de-verdad     (lo hace)
//   node scripts/publica.js --sustituye [--notas linea.md] [--de-verdad]
//
// Por defecto NO publica nada: enseña lo que haría. Publicar es algo que ve
// todo el mundo y que avisa a quien tenga la aplicación instalada, así que
// hace falta pedirlo con --de-verdad (y el «sí» del usuario cada vez).
//
// Desde la 1.2.2 (lo pidió el usuario): NADA de zips. Se reparte:
//   · Windows: dist/release/Oddinote-Setup-<versión>.exe (scripts/compila-publicacion.js)
//   · Android: dist/release/Oddinote-<versión>.apk (npm run apk, desde Movil/)
//   · Linux (AppImage) y Mac (.dmg): los compilan y suben solos los flujos de
//     GitHub (.github/workflows/linux.yml y mac.yml) al publicarse la versión;
//     en una sustitución se relanzan con la etiqueta.
//
// Y SIEMPRE con la marca de build en las notas (<!-- odinote-build: N -->,
// src/actualizacion-logica.js): sin ella, una mini actualización de la misma
// versión no avisaría a nadie. La marca sale de la build compilada.
//
// --sustituye: otra build de la MISMA versión (una mini actualización). Mueve
// la etiqueta a lo compilado (guarda la de antes como respaldo/v<versión>-build<N>),
// cambia los archivos de la publicación, pone la marca nueva en sus notas
// (añadiendo lo de --notas, si se da) y relanza Linux y Mac.
//
// La sesión de gh la abre quien publica, una sola vez: `gh auth login`. Este
// script no toca credenciales. Y la web (GitHub Pages) sirve main: después de
// publicar, `git push origin main`.
// =====================================================
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const A = require('../src/actualizacion-logica.js');

const APP = path.join(__dirname, '..');
const REPO = 'Neuroxcx1/Odinote';   // el repositorio se sigue llamando así (no renombrar)

const args = process.argv.slice(2);
const deVerdad = args.includes('--de-verdad');
const sustituye = args.includes('--sustituye');
const iNotas = args.indexOf('--notas');
const notas = iNotas >= 0 ? args[iNotas + 1] : null;

const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
const version = pkg.version;
const etiqueta = 'v' + version;
const build = (fs.readFileSync(path.join(APP, 'src', 'app.jsx'), 'utf8').match(/ODINOTE_BUILD = '([^']+)'/) || [])[1] || '';

const fallo = (texto) => { console.error('\n  ✗ ' + texto + '\n'); process.exit(1); };
const paso = (texto) => console.log('  · ' + texto);

// gh puede no estar en el PATH de una consola abierta antes de instalarlo.
function rutaGh() {
  for (const c of ['gh', 'C:\\Program Files\\GitHub CLI\\gh.exe']) {
    try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c; } catch (e) {}
  }
  return null;
}
// git con safe.directory: tras formatear el PC la carpeta quedó a nombre del
// usuario de Windows de antes y git no quiere tocarla sin esto.
const corre = (exe, a, opciones) => execFileSync(exe, exe === 'git' ? ['-c', 'safe.directory=*'].concat(a) : a, Object.assign({ cwd: APP, encoding: 'utf8' }, opciones || {}));

console.log(`\n  ${sustituye ? 'Sustituir' : 'Publicar'} Oddinote ${version} (build ${build}, ${etiqueta}) en ${REPO}${deVerdad ? '' : '  —  PRUEBA: no se publica nada'}\n`);

if (!A.numeroBuild(build)) fallo('No leo la build de src/app.jsx (window.ODINOTE_BUILD).');
if (A.versionDe(build) !== version) fallo(`La build (${build}) no es de la versión de package.json (${version}): node scripts/marca-build.js`);

const gh = rutaGh();
if (!gh) fallo('No encuentro gh (GitHub CLI). Se instala con: winget install --id GitHub.cli');
let conSesion = true;
try { corre(gh, ['auth', 'status'], { stdio: 'pipe' }); } catch (e) { conSesion = false; }
if (!conSesion && deVerdad) fallo('gh no tiene la sesión abierta. Ábrela una vez con: gh auth login');
paso(conSesion ? 'gh listo y con la sesión abierta' : 'gh instalado, SIN sesión (antes de publicar: gh auth login)');

// Los archivos: el instalador (obligatorio) y el APK. Nada de zips.
const dirRelease = path.join(APP, 'dist', 'release');
const setup = path.join(dirRelease, `Oddinote-Setup-${version}.exe`);
if (!fs.existsSync(setup)) fallo(`No está el instalador: ${setup}\n    Se hace con: node scripts/compila-publicacion.js`);
// Que el instalador sea de ESTA build: compila-publicacion.js deja su carpeta.
if (!fs.existsSync(path.join(APP, 'dist', `compila-${build}`))) fallo(`El instalador no es de la build ${build} (no está dist/compila-${build}). Vuelve a compilarlo: node scripts/compila-publicacion.js`);
const archivos = [setup];
const apk = path.join(dirRelease, `Oddinote-${version}.apk`);
if (fs.existsSync(apk)) archivos.push(apk);
else console.log('  ! Sin APK de esta versión (se publica sin él). Se hace con: npm run apk, desde Movil/');
archivos.forEach(a => paso('archivo: ' + path.basename(a) + ' (' + (fs.statSync(a).size / 1048576).toFixed(1) + ' MB)'));
paso('Linux (AppImage) y Mac (.dmg): los suben los flujos de GitHub');

const sucio = corre('git', ['status', '--porcelain', '--', '.']).trim();
if (sucio) fallo('Hay cambios sin guardar en git dentro de App/. La etiqueta tiene que apuntar a lo que se compiló:\n' + sucio);
paso('git sin cambios pendientes');

// Las notas, con su marca de build.
const tmpNotas = path.join(require('os').tmpdir(), `oddinote-notas-${build}.md`);
let textoNotas;
if (sustituye) {
  let actuales = '';
  if (conSesion) {
    try { actuales = corre(gh, ['release', 'view', etiqueta, '--repo', REPO, '--json', 'body', '-q', '.body'], { stdio: 'pipe' }); }
    catch (e) { fallo(`No existe la publicación ${etiqueta}: para una versión nueva, sin --sustituye.`); }
  }
  const extra = notas ? fs.readFileSync(path.resolve(process.cwd(), notas), 'utf8').trim() : '';
  textoNotas = A.ponMarca(A.ponMarca(actuales || 'x', build).replace(A.MARCA, '').replace(/\s*$/, '') + (extra ? '\n\n' + extra : ''), build);
} else {
  if (!notas) fallo('Faltan las notas: --notas archivo.md (en inglés).');
  const rutaNotas = path.resolve(process.cwd(), notas);
  if (!fs.existsSync(rutaNotas)) fallo('No existe el archivo de notas: ' + rutaNotas);
  textoNotas = A.ponMarca(fs.readFileSync(rutaNotas, 'utf8'), build);
}
fs.writeFileSync(tmpNotas, textoNotas, 'utf8');
paso(`notas con la marca de la build ${A.numeroBuild(build)}: ${tmpNotas}`);

let tieneEtiqueta = false;
try { corre('git', ['rev-parse', '-q', '--verify', 'refs/tags/' + etiqueta], { stdio: 'pipe' }); tieneEtiqueta = true; } catch (e) {}

const ordenes = [];
if (sustituye) {
  if (tieneEtiqueta) {
    const antes = corre('git', ['rev-parse', etiqueta + '^{commit}']).trim();
    ordenes.push(['git', ['tag', '-f', `respaldo/${etiqueta}-antes-de-${A.numeroBuild(build)}`, antes]]);
  }
  ordenes.push(['git', ['tag', '-f', '-a', etiqueta, '-m', 'Oddinote ' + version]]);
  ordenes.push(['git', ['push', '-f', 'origin', 'refs/tags/' + etiqueta]]);
  ordenes.push([gh, ['release', 'upload', etiqueta, '--repo', REPO, '--clobber'].concat(archivos)]);
  ordenes.push([gh, ['release', 'edit', etiqueta, '--repo', REPO, '--notes-file', tmpNotas]]);
  // Editar una publicación no lanza los flujos: se lanzan a mano.
  ordenes.push([gh, ['workflow', 'run', 'linux.yml', '--repo', REPO, '-f', 'etiqueta=' + etiqueta]]);
  ordenes.push([gh, ['workflow', 'run', 'mac.yml', '--repo', REPO, '-f', 'etiqueta=' + etiqueta]]);
} else {
  if (!tieneEtiqueta) ordenes.push(['git', ['tag', '-a', etiqueta, '-m', 'Oddinote ' + version]]);
  ordenes.push(['git', ['push', 'origin', etiqueta]]);
  // Al publicarse, los flujos de Linux y Mac salen solos (release: published).
  ordenes.push([gh, ['release', 'create', etiqueta, '--repo', REPO, '--title', 'Oddinote ' + version, '--notes-file', tmpNotas, '--latest', '--verify-tag'].concat(archivos)]);
}

console.log('');
for (const [exe, a] of ordenes) {
  const linea = [path.basename(exe)].concat(a.map(x => (/\s/.test(x) ? `"${x}"` : x))).join(' ');
  if (!deVerdad) { console.log('  haría: ' + linea); continue; }
  console.log('  > ' + linea);
  try { corre(exe, a, { stdio: 'inherit' }); }
  catch (e) { fallo('Falló ese paso; lo de antes ya está hecho. Mira el mensaje de arriba.'); }
}
console.log(deVerdad
  ? `\n  ✓ Hecho: https://github.com/${REPO}/releases/tag/${etiqueta}\n    Falta: git push origin main (la web sirve main).\n`
  : '\n  Para hacerlo de verdad, lo mismo con --de-verdad.\n');
