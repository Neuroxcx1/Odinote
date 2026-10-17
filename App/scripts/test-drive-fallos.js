// Que un fallo de Google Drive se explique por lo que es.  node scripts/test-drive-fallos.js
//
// El aviso de siempre («No se pudo subir a Google Drive») servía para todo y
// no dejaba saber qué arreglar. Aquí, cada respuesta típica de Drive con su
// explicación, con las respuestas copiadas de las que da Google.
const F = require('../src/drive-fallos.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};
// Una respuesta como las de fetch, con su cuerpo de error de Google.
const respuesta = (status, cuerpo) => ({
  status,
  clone() { return { json: async () => cuerpo }; },
});

(async () => {
  // Sin la casilla de Drive marcada al entrar.
  const sinPermiso = await F.deRespuesta('buscar la carpeta Odinote', respuesta(403, {
    error: { code: 403, message: 'Request had insufficient authentication scopes.', errors: [{ reason: 'insufficientPermissions' }] },
  }));
  check('apunta el paso, el estado y el motivo', sinPermiso.paso === 'buscar la carpeta Odinote' && sinPermiso.status === 403 && /insufficient/.test(sinPermiso.reason));
  check('reconoce la falta de permiso', F.esFaltaDePermiso(sinPermiso));
  check('y lo explica: hay que marcar la casilla de Drive', /casilla/i.test(F.explica(sinPermiso)) && /MARCAR/.test(F.explica(sinPermiso)));
  check('siempre dice que no se perdió nada', /no se ha perdido nada/.test(F.explica(sinPermiso)));

  // Drive lleno: también es un 403, pero no es falta de permiso.
  const lleno = await F.deRespuesta('crear el archivo del proyecto', respuesta(403, {
    error: { code: 403, message: 'The user\'s Drive storage quota has been exceeded.', errors: [{ reason: 'storageQuotaExceeded' }] },
  }));
  check('Drive lleno no se toma por falta de permiso', !F.esFaltaDePermiso(lleno));
  check('y se explica como Drive lleno', /lleno/.test(F.explica(lleno)));

  const caducado = await F.deRespuesta('buscar la carpeta Odinote', respuesta(401, { error: { code: 401, message: 'Invalid Credentials' } }));
  check('la sesión caducada se explica como caducada', /caduc/.test(F.explica(caducado)));

  const limite = await F.deRespuesta('guardar el archivo del proyecto', respuesta(429, { error: { code: 429, message: 'User rate limit exceeded.' } }));
  check('demasiadas peticiones: esperar un momento', /esperar/.test(F.explica(limite)));

  const sinRed = F.deExcepcion('buscar la carpeta Odinote', new TypeError('Failed to fetch'));
  check('sin respuesta es estado 0', sinRed.status === 0 && /Failed to fetch/.test(sinRed.reason));
  check('y se explica como falta de conexión', /conexión/.test(F.explica(sinRed)));

  const raro = await F.deRespuesta('crear la carpeta del proyecto', respuesta(500, { error: { code: 500, message: 'Backend Error' } }));
  const texto = F.explica(raro);
  check('lo que no se conoce dice paso, error y motivo', /crear la carpeta del proyecto/.test(texto) && /500/.test(texto) && /Backend Error/.test(texto), texto);

  const sinCuerpo = await F.deRespuesta('x', { status: 502, clone() { return { json: async () => { throw new Error('no es JSON'); } }; } });
  check('una respuesta sin JSON no rompe nada', sinCuerpo.status === 502 && sinCuerpo.reason === '');
  check('sin fallo apuntado, el aviso de siempre', /No se pudo subir/.test(F.explica(null)));
  check('el aviso al entrar no habla de proyectos offline', !/offline/.test(F.avisoSinPermiso()) && /casilla/.test(F.avisoSinPermiso()));

  console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
  process.exit(fallos ? 1 : 0);
})();
