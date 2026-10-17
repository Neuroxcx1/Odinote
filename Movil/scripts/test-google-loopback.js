// Prueba de GoogleLoopback.java (entrar con Google desde el teléfono) en el
// ordenador: lo compila con el JDK junto a PruebaGoogleLoopback.java y lo pone
// contra un Google de mentira. La parte de Android (abrir el navegador, volver
// a la app, guardar el refresco cifrado) solo se puede ver en un teléfono.
//   node scripts/test-google-loopback.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const FUENTE = path.join(RAIZ, 'android', 'app', 'src', 'main', 'java', 'io', 'github', 'neuroxcx1', 'oddinote', 'GoogleLoopback.java');
const PRUEBA = path.join(__dirname, 'PruebaGoogleLoopback.java');

// El mismo JDK que compila el APK (ver README: vive suelto en android-tools).
function buscaJdk() {
  const candidatos = [];
  if (process.env.JAVA_HOME) candidatos.push(process.env.JAVA_HOME);
  const herramientas = path.join(os.homedir(), 'android-tools');
  if (fs.existsSync(herramientas)) {
    for (const d of fs.readdirSync(herramientas)) if (/^jdk/i.test(d)) candidatos.push(path.join(herramientas, d));
  }
  for (const c of candidatos) {
    const javac = path.join(c, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');
    if (fs.existsSync(javac)) return c;
  }
  return null;
}

const jdk = buscaJdk();
if (!jdk) {
  console.log('SALTA sin JDK en este equipo (JAVA_HOME o ~/android-tools/jdk-*): no se prueba GoogleLoopback.');
  process.exit(0);
}
const bin = (n) => path.join(jdk, 'bin', process.platform === 'win32' ? n + '.exe' : n);
const salida = fs.mkdtempSync(path.join(os.tmpdir(), 'oddinote-loopback-'));
try {
  execFileSync(bin('javac'), ['-encoding', 'UTF-8', '-d', salida, FUENTE, PRUEBA], { stdio: 'inherit' });
  execFileSync(bin('java'), ['-Dstdout.encoding=UTF-8', '-cp', salida, 'io.github.neuroxcx1.oddinote.PruebaGoogleLoopback'], { stdio: 'inherit' });
} catch (e) {
  process.exitCode = 1;
} finally {
  fs.rmSync(salida, { recursive: true, force: true });
}
