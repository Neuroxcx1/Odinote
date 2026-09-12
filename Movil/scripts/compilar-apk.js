// =====================================================
// Oddinote para Android — compilar el APK
//
// Gradle necesita saber dónde están Java y el SDK de Android, y en este equipo
// no están instalados "en el sistema": viven en una carpeta suelta
// (C:\Users\USER\android-tools) para no tocar nada más y para poder borrarlos
// de un tirón si algún día estorban. Así que el script los busca él.
//
// Al final el APK se copia a Movil/dist con la versión en el nombre. Lo hace
// aparte a propósito: el que escupe Gradle se llama SIEMPRE app-debug.apk, y
// tres de esos en la carpeta de descargas del teléfono son indistinguibles.
// =====================================================

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const ANDROID = path.join(RAIZ, 'android');
const DIST = path.join(RAIZ, 'dist');
const HERRAMIENTAS = path.join(process.env.USERPROFILE || 'C:\\Users\\USER', 'android-tools');

function buscaJava() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  if (fs.existsSync(HERRAMIENTAS)) {
    const jdk = fs.readdirSync(HERRAMIENTAS).find(n => n.startsWith('jdk-21'));
    if (jdk) return path.join(HERRAMIENTAS, jdk);
  }
  return null;
}

function buscaSdk() {
  if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) return process.env.ANDROID_HOME;
  const suelto = path.join(HERRAMIENTAS, 'sdk');
  if (fs.existsSync(suelto)) return suelto;
  return null;
}

const java = buscaJava();
const sdk = buscaSdk();

if (!java || !sdk) {
  console.error('Falta Java 21 o el SDK de Android.');
  console.error('  Java: ' + (java || 'no encontrado'));
  console.error('  SDK : ' + (sdk || 'no encontrado'));
  console.error('Mira Movil/README.md: explica cómo dejarlos otra vez en su sitio.');
  process.exit(1);
}

const entorno = Object.assign({}, process.env, { JAVA_HOME: java, ANDROID_HOME: sdk });
const gradlew = path.join(ANDROID, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

console.log('Java : ' + java);
console.log('SDK  : ' + sdk);
console.log('Compilando…');

// Con shell: true y el nombre entrecomillado, y no a pelo. Node ya no deja
// lanzar un .bat directamente (lo cerraron por seguridad hace unas versiones),
// y fallaba sin decir ni una palabra: escribía "Compilando…" y se iba, dejando
// creer que el problema estaba en Gradle.
// Todo en una sola cadena y no con la lista de argumentos aparte: mezclando las
// dos cosas Node avisa (con razón) de que los argumentos no se escapan.
const r = spawnSync('"' + gradlew + '" assembleDebug', {
  cwd: ANDROID, env: entorno, stdio: 'inherit', shell: true,
});
if (r.error) {
  console.error('No se pudo ni lanzar Gradle: ' + r.error.message);
  process.exit(1);
}
if (r.status !== 0) {
  console.error('Gradle terminó con error (' + r.status + ').');
  process.exit(r.status === null ? 1 : r.status);
}

// La versión sale de donde sale siempre: App/package.json.
const version = require(path.resolve(RAIZ, '..', 'App', 'package.json')).version;
const origen = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!fs.existsSync(origen)) {
  console.error('Gradle dijo que sí, pero no hay APK en ' + origen);
  process.exit(1);
}

fs.mkdirSync(DIST, { recursive: true });
const destino = path.join(DIST, 'Oddinote-' + version + '.apk');
fs.copyFileSync(origen, destino);

const mb = (fs.statSync(destino).size / 1024 / 1024).toFixed(1);
console.log('');
console.log('APK listo: ' + destino);
console.log('Pesa ' + mb + ' MB. Pásalo al teléfono y ábrelo desde el propio móvil.');
