// =====================================================
// Oddinote para Android — preparar lo que va DENTRO del APK
//
// Un APK no es un servidor: lleva los archivos encima y los abre desde el
// propio teléfono, con cobertura o sin ella. Por eso aquí se hacen tres cosas
// que en el escritorio no hacían falta.
//
// 1. Traducir el JSX de una vez. En el navegador la aplicación se traduce sola
//    al arrancar: Babel con quince archivos, 1,7 MB. En un ordenador eso son
//    décimas de segundo; en un teléfono modesto son varios segundos mirando una
//    pantalla en blanco. Y el resultado es SIEMPRE el mismo, así que se hace
//    aquí una vez y el móvil ya se lo encuentra hecho. De paso se queda fuera
//    el propio Babel, que es casi un mega que no pinta nada dentro del APK.
//
// 2. Meter Firebase dentro. La aplicación se lo trae de gstatic.com al
//    arrancar; sin cobertura eso es esperar a un servidor que no va a
//    contestar. Las tres piezas viajan ya en el APK.
//
// 3. Decir que esto es Android. La plataforma se deduce del dominio, y dentro
//    del APK el dominio es "localhost" — el mismo del servidor de pruebas. Sin
//    esto, cada móvil contaría en las estadísticas como si fuera yo
//    programando, y no se sabría nunca cuánta gente la usa en el teléfono.
//
// Lo que NO entra, a propósito: node_modules y dist (que son el Electron
// entero, cientos de megas), main.js y preload.js (que son el escritorio),
// scripts/, y sobre todo google-oauth.json — es un secreto, y un APK se lo
// puede abrir cualquiera con un descompresor.
// =====================================================

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const APP = path.resolve(RAIZ, '..', 'App');
const WWW = path.join(RAIZ, 'www');
const VENDOR = path.join(RAIZ, 'vendor');

// El Babel que ya viaja dentro del proyecto. Se usa el mismo que usa la
// aplicación en el navegador para que el resultado sea idéntico: si algún día
// uno de los dos cambia de versión, no quiero que el móvil compile distinto.
const B = require(path.join(APP, 'lib', 'babel.min.js'));
const Babel = B && B.transform ? B : global.Babel;

function limpia(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copiaArbol(src, dst, saltar) {
  fs.mkdirSync(dst, { recursive: true });
  for (const nombre of fs.readdirSync(src)) {
    const desde = path.join(src, nombre);
    const hasta = path.join(dst, nombre);
    if (saltar && saltar(nombre, desde)) continue;
    const st = fs.statSync(desde);
    if (st.isDirectory()) copiaArbol(desde, hasta, saltar);
    else fs.copyFileSync(desde, hasta);
  }
}

function pesa(dir) {
  let total = 0;
  for (const nombre of fs.readdirSync(dir)) {
    const p = path.join(dir, nombre);
    const st = fs.statSync(p);
    total += st.isDirectory() ? pesa(p) : st.size;
  }
  return total;
}

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';

// ── 1. Sitio limpio ──
limpia(WWW);

// ── 2. Lo que se copia tal cual ──
// De lib/ se queda fuera Babel: en el APK ya no hay nada que traducir.
copiaArbol(path.join(APP, 'lib'), path.join(WWW, 'lib'), (nombre) => nombre === 'babel.min.js');

// De src/ se copian las hojas de estilo y los .js que no pasan por Babel; los
// .jsx no, porque de esos se escribe abajo la versión ya traducida.
copiaArbol(path.join(APP, 'src'), path.join(WWW, 'src'), (nombre) => nombre.endsWith('.jsx'));

fs.mkdirSync(path.join(WWW, 'Icon'), { recursive: true });
fs.copyFileSync(path.join(APP, 'Icon', 'Icon.png'), path.join(WWW, 'Icon', 'Icon.png'));
fs.copyFileSync(path.join(APP, 'boveda.js'), path.join(WWW, 'boveda.js'));

// Firebase, guardado en vendor/ y no bajado al vuelo: una compilación no puede
// depender de que gstatic.com conteste hoy.
copiaArbol(path.join(VENDOR, 'firebase'), path.join(WWW, 'lib', 'firebase'));

// ── 3. Traducir el JSX y reescribir el index.html ──
let html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');

const traducidos = [];
let fallos = 0;

// Cada <script type="text/babel" ... src="./src/X.jsx?v=N"> se traduce a un
// archivo normal y la etiqueta pasa a ser un <script> corriente. El orden de
// las etiquetas no se toca: la aplicación depende de él (cada archivo cuelga
// sus cosas de window y el siguiente ya las usa).
html = html.replace(/<script\b[^>]*type="text\/babel"[^>]*><\/script>/g, (etiqueta) => {
  const m = etiqueta.match(/src="\.\/([^"?]+)(\?[^"]*)?"/);
  if (!m) { fallos++; return etiqueta; }

  const relativo = m[1];
  const marca = m[2] || '';
  const origen = path.join(APP, relativo);
  const destinoRel = relativo.replace(/\.jsx$/, '.js');
  const destino = path.join(WWW, destinoRel);

  const codigo = fs.readFileSync(origen, 'utf8');
  const salida = Babel.transform(codigo, { presets: ['react'], filename: path.basename(origen) }).code;

  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, salida, 'utf8');
  traducidos.push(destinoRel);

  return '<script src="./' + destinoRel + marca + '"></script>';
});

// Fuera el Babel del navegador: ya no hay nada que traducir en el teléfono.
html = html.replace(/[ \t]*<script src="\.\/lib\/babel\.min\.js"><\/script>\r?\n/, '');

// Firebase, de gstatic a la copia local.
let firebaseCambiados = 0;
html = html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[0-9.]+\/(firebase-[a-z-]+\.js)/g, (_, archivo) => {
  firebaseCambiados++;
  return './lib/firebase/' + archivo;
});

// Y la plataforma. Se marca con una bandera propia en vez de preguntar por
// window.Capacitor: la bandera está puesta antes de que corra nada, y así no
// depende de en qué momento el teléfono inyecta su puente.
const anclaPlataforma = 'window.ODINOTE_PLATFORM = (function () {';
if (!html.includes(anclaPlataforma)) {
  console.error('AVISO: no encuentro donde se decide la plataforma; el APK contaría como "dev".');
  fallos++;
} else {
  html = html.replace(anclaPlataforma, 'window.ODINOTE_ANDROID = true;\n      ' + anclaPlataforma);
  html = html.replace(
    "if (window.electronAPI) return 'desktop';",
    "if (window.ODINOTE_ANDROID) return 'android';\n        if (window.electronAPI) return 'desktop';"
  );
}

fs.writeFileSync(path.join(WWW, 'index.html'), html, 'utf8');

// ── 4. Contarlo ──
console.log('JSX traducido de una vez : ' + traducidos.length + ' archivos');
console.log('Firebase metido dentro   : ' + firebaseCambiados + ' de 3');
console.log('Plataforma               : android');
console.log('Peso de lo que va dentro : ' + mb(pesa(WWW)));
if (fs.existsSync(path.join(WWW, 'google-oauth.json'))) {
  console.error('PARA: se ha colado google-oauth.json dentro del APK.');
  process.exit(1);
}
if (fallos) {
  console.error('Hubo ' + fallos + ' problema(s) al preparar; míralos antes de compilar.');
  process.exit(1);
}
