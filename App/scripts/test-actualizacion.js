// Pruebas del aviso de "hay versión nueva".  node scripts/test-actualizacion.js
//
// Esto nació de un problema que no se puede ver probando la aplicación: para
// que aparezca hay que publicar una versión de verdad en GitHub, y para ver el
// fallo hay que publicar DOS, una de ellas de Android. Para cuando se notara,
// ya se habría quedado media hora de gente sin enterarse de una actualización.
//
// La decisión —cuál de las publicaciones le toca al escritorio— vive en una
// función aparte, así que aquí se le pueden poner delante las listas que hagan
// falta y ver qué contesta. La función NO se copia: se saca del propio app.jsx,
// para que esta prueba hable de la que se está usando de verdad.
const path = require('path');
const fs = require('fs');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const ruta = (...p) => path.join(__dirname, '..', ...p);
const app = fs.readFileSync(ruta('src', 'app.jsx'), 'utf-8');

const re = /function eligePublicacionDeEscritorio\(publicaciones\) \{([\s\S]*?)\r?\n\}/;
const m = app.match(re);
check('se encuentra eligePublicacionDeEscritorio en app.jsx', !!m);
if (!m) { console.log('\n1 FALLOS'); process.exit(1); }
const elige = new Function('publicaciones', m[1]);

// Atajos para escribir las listas de abajo sin repetirse.
const windows = (tag) => ({ tag_name: tag, draft: false, prerelease: false, assets: [{ name: 'Odinote-' + tag.replace(/^v/, '') + '-win32-x64.zip' }] });
const android = (tag) => ({ tag_name: tag, draft: false, prerelease: false, assets: [{ name: 'Oddinote-1.0.8.1.apk' }] });

// ── Lo de siempre: solo publicaciones de Windows ──
check('con una sola, esa',
  elige([windows('v1.0.8.1')]).tag_name === 'v1.0.8.1');
check('con varias, la primera de la lista (GitHub las da de nueva a vieja)',
  elige([windows('v1.0.8.1'), windows('v1.0.8'), windows('v1.0.7')]).tag_name === 'v1.0.8.1');

// ── Lo que trae la versión de Android ──
//
// El caso que importa: la del móvil es la más reciente, y detrás va una de
// Windows que sí es nueva. Antes se cogía la del móvil y el escritorio decía
// "estás al día".
check('la del móvil NO tapa a la de Windows que va detrás',
  elige([android('v1.0.8.1-android'), windows('v1.0.8.1')]).tag_name === 'v1.0.8.1');
check('con dos de Android delante, sigue encontrando la de Windows',
  elige([android('v1.0.9-android'), android('v1.0.8.1-android'), windows('v1.0.8')]).tag_name === 'v1.0.8');

// Si solo hay publicaciones de Android no hay nada que ofrecerle a un
// ordenador: mejor "estás al día" que mandarle a descargar un APK.
check('si solo hay de Android, no elige ninguna',
  elige([android('v1.0.9-android')]) === null);

// Y si algún día se sube todo junto en una sola publicación, esa vale.
check('una publicación con el APK y el zip juntos sí cuenta',
  elige([{ tag_name: 'v1.0.9', draft: false, prerelease: false,
           assets: [{ name: 'Oddinote-1.0.9.apk' }, { name: 'Odinote-1.0.9-win32-x64.zip' }] }]).tag_name === 'v1.0.9');

// ── Borradores y prelanzamientos ──
check('un borrador no se ofrece a nadie',
  elige([{ tag_name: 'v2.0', draft: true, prerelease: false, assets: [{ name: 'x.zip' }] }, windows('v1.0.8.1')]).tag_name === 'v1.0.8.1');
check('un prelanzamiento tampoco, habiendo una estable',
  elige([{ tag_name: 'v2.0', draft: false, prerelease: true, assets: [{ name: 'x.zip' }] }, windows('v1.0.8.1')]).tag_name === 'v1.0.8.1');
check('pero si SOLO hay prelanzamientos, se usa como respaldo',
  elige([{ tag_name: 'v2.0', draft: false, prerelease: true, assets: [{ name: 'x.zip' }] }]).tag_name === 'v2.0');

// ── Que no se caiga con basura ──
//
// Esto contesta desde internet: puede llegar cualquier cosa, y una excepción
// aquí dejaría al programa sin comprobar actualizaciones nunca más.
check('si no es una lista, ninguna', elige(null) === null);
check('si viene un error de la API en vez de la lista, ninguna', elige({ message: 'API rate limit exceeded' }) === null);
check('una publicación sin archivos no cuenta', elige([{ tag_name: 'v9', draft: false, prerelease: false, assets: [] }]) === null);
check('una publicación sin la lista de archivos tampoco', elige([{ tag_name: 'v9', draft: false, prerelease: false }]) === null);
check('un archivo sin nombre no rompe nada', elige([{ tag_name: 'v9', draft: false, prerelease: false, assets: [{}] }]).tag_name === 'v9');
check('un hueco en la lista no rompe nada', elige([null, windows('v1.0.8.1')]).tag_name === 'v1.0.8.1');

// ── Mayúsculas ──
check('.APK en mayúsculas también es un APK',
  elige([{ tag_name: 'v9', draft: false, prerelease: false, assets: [{ name: 'Oddinote.APK' }] }]) === null);

console.log('');
if (fallos) { console.log(fallos + ' FALLOS'); process.exit(1); }
console.log('Todo en orden.');
