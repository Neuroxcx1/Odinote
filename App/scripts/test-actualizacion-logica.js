// Que el aviso de actualización salte cuando debe.  node scripts/test-actualizacion-logica.js
const A = require('../src/actualizacion-logica.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};
const pub = (tag, build, assets, extra) => Object.assign({
  tag_name: tag,
  body: 'Notas de la versión\n' + (build ? `<!-- odinote-build: ${build} -->` : ''),
  assets: assets || [{ name: `Oddinote-Setup-${tag.slice(1)}.exe`, browser_download_url: 'https://x/setup.exe', size: 100, digest: 'sha256:' + 'a'.repeat(64) }, { name: 'Oddinote.apk', browser_download_url: 'https://x/o.apk' }],
}, extra || {});

check('lee el build de 1.2.2-237', A.numeroBuild('1.2.2-237') === 237 && A.numeroBuild('raro') === 0);
check('lee la marca escondida en las notas', A.marcaBuild('hola <!-- odinote-build: 240 --> adiós') === 240 && A.marcaBuild('sin marca') === 0);
check('compara versiones por números', A.versionMayor('1.2.10', '1.2.9') && A.versionMayor('1.0.8.1', '1.0.8') && !A.versionMayor('1.2.2', '1.2.2'));

// Lo que pidió el usuario: la misma versión con otra build TAMBIÉN avisa.
check('misma versión, build mayor: avisa', A.hayNueva('1.2.2-237', pub('v1.2.2', 238)) === true);
check('misma versión, misma build: no avisa', A.hayNueva('1.2.2-237', pub('v1.2.2', 237)) === false);
check('misma versión, build menor: no avisa', A.hayNueva('1.2.2-240', pub('v1.2.2', 238)) === false);
check('versión mayor: avisa aunque no traiga marca', A.hayNueva('1.2.1-236', pub('v1.2.2', 0)) === true);
check('versión menor: no avisa aunque su build sea mayor', A.hayNueva('1.2.2-237', pub('v1.2.1', 999)) === false);
check('un borrador no cuenta', A.hayNueva('1.2.1-236', pub('v1.2.2', 300, null, { draft: true })) === false);

// El archivo de cada sistema.
{
  const w = A.archivoPara(pub('v1.2.2', 238), 'windows');
  check('en Windows elige el instalador', w && /Setup/.test(w.nombre) && w.sha256 === 'a'.repeat(64), JSON.stringify(w));
  const an = A.archivoPara(pub('v1.2.2', 238), 'android');
  check('en Android elige el APK', an && an.nombre === 'Oddinote.apk' && an.sha256 === null);
  check('una publicación solo con zip no da instalador', A.archivoPara(pub('v1.2.1', 1, [{ name: 'Oddinote-1.2.1-win32-x64.zip' }]), 'windows') === null);
}

// Elegir la publicación: la primera que no es borrador y trae lo suyo.
{
  const lista = [
    pub('v1.2.3', 250, null, { draft: true }),
    pub('v1.2.2', 240, [{ name: 'Oddinote-1.2.2.apk', browser_download_url: 'u' }]),
    pub('v1.2.1', 236),
  ];
  check('Windows salta el borrador y la que solo trae APK', A.eligePublicacion(lista, 'windows').tag_name === 'v1.2.1');
  check('Android coge la que trae APK', A.eligePublicacion(lista, 'android').tag_name === 'v1.2.2');
}

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
