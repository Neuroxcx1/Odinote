// =====================================================
// Odinote — pruebas de src/drive.js con un Drive simulado.
//
//   node scripts/test-drive.js
//
// drive.js está escrito para recibir su `fetch` desde fuera, así que se puede
// ejercitar entero sin cuenta de Google. Esto NO sustituye a probar el
// compartir de verdad con dos cuentas, pero sí responde a la pregunta que más
// importa: ¿puede esta app llenar el Drive de alguien duplicando archivos?
// =====================================================

const path = require('path');
const OdiDrive = require(path.join(__dirname, '..', 'src', 'drive.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// ── Drive de mentira: guarda archivos en memoria y cuenta las llamadas ──
function crearDriveFalso() {
  const archivos = new Map(); // id -> { name, parents }
  const llamadas = { creados: 0, actualizados: 0, permisos: 0, busquedas: 0 };
  let siguienteId = 1;

  const json = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: () => null },
  });

  const fetchFalso = async (url, opts = {}) => {
    const metodo = opts.method || 'GET';

    // Búsqueda de archivos/carpetas por nombre
    if (url.includes('/drive/v3/files?q=')) {
      llamadas.busquedas++;
      const q = decodeURIComponent(url.split('q=')[1].split('&')[0]);
      const nombre = (q.match(/name='([^']+)'/) || [])[1];
      const padre = (q.match(/'([^']+)' in parents/) || [])[1];
      const encontrados = [...archivos.entries()]
        .filter(([, f]) => f.name === nombre && f.parents.includes(padre))
        .map(([id]) => ({ id }));
      return json({ files: encontrados });
    }

    // Permiso público
    if (url.includes('/permissions')) {
      llamadas.permisos++;
      return json({ id: 'perm' });
    }

    // Inicio de subida reanudable
    if (url.includes('/upload/drive/v3/files')) {
      const existente = url.match(/files\/([^?]+)\?/);
      if (existente) {
        llamadas.actualizados++;
        return { ok: true, status: 200, headers: { get: (h) => h === 'Location' ? `https://sesion/${existente[1]}` : null } };
      }
      llamadas.creados++;
      const cuerpo = JSON.parse(opts.body || '{}');
      const id = `file${siguienteId++}`;
      archivos.set(id, { name: cuerpo.name, parents: cuerpo.parents || [] });
      return { ok: true, status: 200, headers: { get: (h) => h === 'Location' ? `https://sesion/${id}` : null } };
    }

    // Envío de los bytes
    if (url.startsWith('https://sesion/')) {
      const id = url.split('/').pop();
      return json({ id });
    }

    // Crear carpeta
    if (url.endsWith('/drive/v3/files') && metodo === 'POST') {
      const cuerpo = JSON.parse(opts.body || '{}');
      const id = `folder${siguienteId++}`;
      archivos.set(id, { name: cuerpo.name, parents: cuerpo.parents || [] });
      return json({ id });
    }

    return json({}, 404);
  };

  return { fetchFalso, archivos, llamadas };
}

const imagen = 'data:image/png;base64,aGVsbG8=';
const nuevoEstado = () => ({
  proj1: {
    title: 'Raíz',
    items: [
      { id: 'n1', type: 'image', src: imagen },
      { id: 'n2', type: 'board', canvasId: 'sub1' },
    ],
  },
  sub1: { title: 'Anidado', items: [{ id: 'n3', type: 'image', src: imagen }] },
});

(async () => {
  // ── 1. Primera publicación: sube los medios y devuelve URLs ──
  {
    const { fetchFalso, archivos, llamadas } = crearDriveFalso();
    const canvases = nuevoEstado();
    const res = await OdiDrive.syncProjectMedia({
      canvases, projectId: 'proj1', folderId: 'carpetaProyecto',
      accessToken: 'tok', fetchFn: fetchFalso,
    });
    check('sube los medios de la raíz y de los tableros anidados',
      res.uploaded === 2, `subidos ${res.uploaded} de ${res.attempted}`);
    const carpetasMedia = [...archivos.values()].filter(f => f.name === 'media');
    check('crea UNA sola carpeta media/, dentro del proyecto',
      carpetasMedia.length === 1 && carpetasMedia[0].parents.includes('carpetaProyecto'),
      `${carpetasMedia.length} carpetas media`);
    check('los medios van dentro de media/, no sueltos en el proyecto',
      [...archivos.values()].filter(f => f.name.startsWith('media_')).length === 2 && llamadas.creados === 2,
      `${llamadas.creados} archivos subidos`);
    check('deja los archivos públicos para que se vean en otros equipos',
      llamadas.permisos === 2, `${llamadas.permisos} permisos`);
    check('devuelve URLs servibles como <img>',
      Object.values(res.replaced.proj1)[0].startsWith('https://lh3.googleusercontent.com/d/'));
  }

  // ── 2. LA PREGUNTA IMPORTANTE: publicar otra vez, ¿duplica? ──
  {
    const { fetchFalso, archivos, llamadas } = crearDriveFalso();
    const canvases = nuevoEstado();

    const primera = await OdiDrive.syncProjectMedia({
      canvases, projectId: 'proj1', folderId: 'carpetaProyecto',
      accessToken: 'tok', fetchFn: fetchFalso,
    });
    const trasPrimera = archivos.size;

    // Como hace la app: aplicar las URLs devueltas a los nodos
    canvases.proj1.items[0].src = primera.replaced.proj1.n1;
    canvases.sub1.items[0].src = primera.replaced.sub1.n3;

    const creadosAntes = llamadas.creados;
    const segunda = await OdiDrive.syncProjectMedia({
      canvases, projectId: 'proj1', folderId: 'carpetaProyecto',
      accessToken: 'tok', fetchFn: fetchFalso,
    });

    check('volver a publicar NO vuelve a subir nada',
      segunda.attempted === 0 && segunda.uploaded === 0,
      `intentos ${segunda.attempted}`);
    check('volver a publicar NO crea archivos nuevos en Drive',
      archivos.size === trasPrimera, `${archivos.size} archivos, antes ${trasPrimera}`);
    check('ni siquiera crea otra carpeta media/',
      llamadas.creados === creadosAntes, `${llamadas.creados - creadosAntes} creaciones nuevas`);
  }

  // ── 3. Aunque el src siguiera siendo local, reutiliza el archivo ──
  {
    const { fetchFalso, archivos, llamadas } = crearDriveFalso();
    const canvases = nuevoEstado();
    await OdiDrive.syncProjectMedia({
      canvases, projectId: 'proj1', folderId: 'carpetaProyecto', accessToken: 'tok', fetchFn: fetchFalso,
    });
    const trasPrimera = archivos.size;
    // Sin aplicar las URLs: el peor caso posible
    await OdiDrive.syncProjectMedia({
      canvases, projectId: 'proj1', folderId: 'carpetaProyecto', accessToken: 'tok', fetchFn: fetchFalso,
    });
    check('en el peor caso ACTUALIZA el archivo existente en vez de duplicarlo',
      archivos.size === trasPrimera && llamadas.actualizados === 2,
      `${archivos.size} archivos, ${llamadas.actualizados} actualizaciones`);
  }

  // ── 4. Token caducado a mitad: se avisa, no se sube a medias en silencio ──
  {
    const { fetchFalso } = crearDriveFalso();
    const con401 = async (url, opts) => {
      if (url.includes('/upload/')) return { ok: false, status: 401, json: async () => ({}), headers: { get: () => null } };
      return fetchFalso(url, opts);
    };
    const res = await OdiDrive.syncProjectMedia({
      canvases: nuevoEstado(), projectId: 'proj1', folderId: 'carpetaProyecto',
      accessToken: 'caducado', fetchFn: con401,
    });
    check('un token caducado se reporta como authError', res.authError === 401, `${res.authError}`);
  }

  // ── 5. Sin carpeta de proyecto no se sube nada suelto a la raíz del Drive ──
  {
    const { fetchFalso, archivos } = crearDriveFalso();
    const res = await OdiDrive.syncProjectMedia({
      canvases: nuevoEstado(), projectId: 'proj1', folderId: null,
      accessToken: 'tok', fetchFn: fetchFalso,
    });
    check('sin carpeta de proyecto no ensucia la raíz del Drive',
      res.attempted === 0 && archivos.size === 0);
  }

  // ── 6. Las URLs antiguas uc?export=view se reparan sin volver a subir ──
  {
    const { fetchFalso, archivos } = crearDriveFalso();
    const canvases = {
      proj1: { title: 'Raíz', items: [
        { id: 'n1', type: 'image', src: 'https://drive.google.com/uc?export=view&id=abcdefghijklmnopqrstu' },
      ] },
    };
    const res = await OdiDrive.syncProjectMedia({
      canvases, projectId: 'proj1', folderId: 'carpetaProyecto', accessToken: 'tok', fetchFn: fetchFalso,
    });
    check('las URLs antiguas se reparan sin volver a subir el archivo',
      res.replaced.proj1.n1 === 'https://lh3.googleusercontent.com/d/abcdefghijklmnopqrstu' && archivos.size === 1,
      `${archivos.size} archivo (solo la carpeta media)`);
  }

  console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo correcto');
  process.exit(fallos ? 1 : 0);
})();
