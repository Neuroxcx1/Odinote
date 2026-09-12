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

// El APK sale a App/dist/Oddinote-Android, al lado de las demás entregas: ahí
// están ya la instalación de diario, pre-release y release. Tener las cosas que
// se reparten en un sitio y las de Android en otro es como se acaba subiendo a
// una publicación el archivo de la semana pasada.
const DIST = path.resolve(RAIZ, '..', 'App', 'dist', 'Oddinote-Android');
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

// Un papelito al lado del APK. Se reescribe en cada compilación para que no
// pueda quedarse contando una versión que ya no es la que hay en la carpeta, y
// está aquí porque dentro de tres meses nadie se acuerda de qué hacía falta
// para instalarlo ni de qué cosas no funcionaban todavía.
const hoy = new Date().toISOString().slice(0, 10);
const leeme = [
  'Oddinote ' + version + ' para Android',
  'Compilado el ' + hoy + ' — ' + mb + ' MB',
  '',
  'CÓMO INSTALARLO',
  '  Pasa el .apk al teléfono (cable, Drive, WhatsApp… da igual) y ábrelo',
  '  DESDE EL TELÉFONO. Avisará de que viene de una fuente desconocida: hay',
  '  que darle permiso una vez. Es lo normal fuera de las tiendas.',
  '',
  'QUÉ FUNCIONA SIN INTERNET',
  '  Todo lo de escribir: los tableros y las notas se guardan en el propio',
  '  teléfono. La aplicación entera va dentro del archivo, no se baja nada.',
  '',
  'QUÉ NO FUNCIONA TODAVÍA',
  '  Entrar con Google, y por tanto Drive, las salas en vivo y la corona.',
  '  Google bloquea a propósito su ventana de inicio de sesión dentro de una',
  '  aplicación como esta; hay que rehacerla abriendo el navegador del',
  '  teléfono. Tampoco está lo que era de Electron: el corrector, el menú del',
  '  botón derecho y la captura del lienzo a archivo.',
  '',
  'PARA PUBLICARLO',
  '  Sube este .apk tal cual a una publicación de GitHub. Sin comprimir: un',
  '  APK ya es un archivo comprimido, y metido en un zip el teléfono no puede',
  '  instalarlo de una pasada.',
  '',
  'Se rehace con: npm run apk   (desde la carpeta Movil)',
  '',
].join('\r\n');
fs.writeFileSync(path.join(DIST, 'LEEME.txt'), leeme, 'utf8');

console.log('');
console.log('APK listo: ' + destino);
console.log('Pesa ' + mb + ' MB. Al lado queda un LEEME.txt con las instrucciones.');
