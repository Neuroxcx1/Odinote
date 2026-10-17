// =====================================================
// Oddinote — pruebas del reparto de la bóveda
//
//   node scripts/test-boveda.js
//
// Esto decide en qué carpeta acaban las notas y las imágenes de cada proyecto,
// así que un fallo aquí no es un botón torcido: es una carpeta que se pisa con
// otra, o un proyecto que aparece vacío porque su carpeta cambió de nombre
// sola. Las dos preguntas:
//
//   1. ¿Dos proyectos pueden acabar en la misma carpeta? Nunca.
//   2. ¿La carpeta de un proyecto cambia sin que nadie lo renombre? Nunca.
// =====================================================

const fs = require('fs');
const path = require('path');
const B = require(path.join(__dirname, '..', 'boveda.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// ── Nombres que Windows admite ──
{
  const casos = [
    ['Diana', 'Diana'],
    ['Aurora Studio — Showcase', 'Aurora Studio — Showcase'],
    ['Portfolio: Agosto/2026', 'Portfolio- Agosto-2026'],
    ['  con espacios  ', 'con espacios'],
    ['termina en punto.', 'termina en punto'],
    ['termina en espacio ', 'termina en espacio'],
    ['a<b>c:d"e|f?g*h', 'a-b-c-d-e-f-g-h'],
    ['CON', 'CON-'],
    ['lpt3', 'lpt3-'],
  ];
  for (const [entra, sale] of casos) {
    check(`"${entra}" → "${sale}"`, B.saneaNombre(entra) === sale, B.saneaNombre(entra));
  }
  check('un nombre kilométrico se recorta a 60',
    B.saneaNombre('x'.repeat(200)).length === 60, String(B.saneaNombre('x'.repeat(200)).length));
  check('lo que queda en nada devuelve nada', B.saneaNombre('///') === '---');
  check('vacío es vacío', B.saneaNombre('') === '' && B.saneaNombre(null) === '');
}

// ── El nombre del proyecto, venga como venga ──
{
  check('nombre en dos idiomas', B.nombreLegible({ name: { es: 'Diana', en: 'Diana' } }) === 'Diana');
  check('nombre suelto', B.nombreLegible({ name: 'Suelto' }) === 'Suelto');
  check('sin nombre no revienta', B.nombreLegible({}) === '' && B.nombreLegible(null) === '');
  check('si falta el idioma pedido, tira del que haya',
    B.nombreLegible({ name: { en: 'Only English' } }, 'es') === 'Only English');
}

// ── Una carpeta por proyecto, y ninguna compartida ──
{
  const proyectos = [
    { id: 'proj-1788366801338-2299', name: { es: 'Diana' } },
    { id: 'proj-1788366801339-4471', name: { es: 'Diana' } },       // mismo nombre
    { id: 'proj-1788366801340-0002', name: { es: 'Aurora Studio' } },
    { id: 'proj-1788366801341-0003', name: { es: '' } },            // sin nombre
    { id: 'proj-1788366801342-0004', name: { es: '???' } },
  ];
  const mapa = B.carpetasDeProyectos(proyectos);

  check('el primer "Diana" se queda con su nombre limpio', mapa['proj-1788366801338-2299'] === 'Diana', mapa['proj-1788366801338-2299']);
  check('el segundo "Diana" no pisa al primero',
    mapa['proj-1788366801339-4471'] !== mapa['proj-1788366801338-2299'], mapa['proj-1788366801339-4471']);
  check('y se distingue por su identificador', /Diana \(\w+\)/.test(mapa['proj-1788366801339-4471']), mapa['proj-1788366801339-4471']);
  check('un proyecto sin nombre tiene carpeta igual', !!mapa['proj-1788366801341-0003'], mapa['proj-1788366801341-0003']);

  const carpetas = Object.values(mapa).map(c => c.toLowerCase());
  check('ninguna carpeta se repite (ni cambiando mayúsculas)', new Set(carpetas).size === carpetas.length);

  // Lo importante de verdad: llamar dos veces da lo mismo. Si no, la carpeta de
  // un proyecto cambiaría sola entre dos guardados y sus imágenes se perderían.
  const otraVez = B.carpetasDeProyectos(proyectos);
  check('dos llamadas seguidas dan lo mismo', JSON.stringify(mapa) === JSON.stringify(otraVez));

  // Y añadir un proyecto al final no mueve a los de antes.
  const conUnoMas = B.carpetasDeProyectos(proyectos.concat([{ id: 'proj-9', name: { es: 'Nuevo' } }]));
  check('añadir un proyecto no mueve las carpetas de los demás',
    proyectos.every(p => conUnoMas[p.id] === mapa[p.id]));
}

// ── Dónde está el archivo de un nodo ──
{
  const casos = [
    ['media/foto.png', 'Diana', 'Diana/media/foto.png'],
    ['media/foto.png', null, 'media/foto.png'],
    ['Diana/media/foto.png', 'Diana', 'Diana/media/foto.png'],
    ['/vault-media/Diana/media/foto.png', 'Diana', 'Diana/media/foto.png'],
    ['/vault-media/media/foto.png', 'Diana', 'media/foto.png'],
    ['file:///D:/Documentos/Oddinote/media/foto.png', 'Diana', 'media/foto.png'],
    // Una ruta absoluta se lee siempre como la del montón de antes: lo nuevo
    // no se guarda nunca en absoluto, y del texto no se puede distinguir una
    // carpeta de proyecto del nombre de la bóveda.
    ['file:///D:/Documentos/Oddinote/Diana/media/foto.png', 'Diana', 'media/foto.png'],
    ['file:///D:/Mis%20Juegos/Oddinote/media/foto%20uno.png', null, 'media/foto uno.png'],
  ];
  for (const [src, carpeta, sale] of casos) {
    check(`"${src.slice(0, 46)}" → ${sale}`, B.relativoEnBoveda(src, carpeta) === sale, String(B.relativoEnBoveda(src, carpeta)));
  }
  for (const nada of ['data:image/png;base64,AAA', 'https://ejemplo.com/f.png', '', null, undefined]) {
    check(`no hay archivo para ${JSON.stringify(nada)}`, B.relativoEnBoveda(nada, 'Diana') === null);
  }
}

// ══════════════════════════════════════════════════════════
// Y ahora contra el disco de verdad
// ══════════════════════════════════════════════════════════
//
// Esta parte crea una bóveda de mentira en la carpeta temporal del sistema, la
// escribe, la renombra y la borra. Es lo mismo que hace la aplicación con las
// notas de la gente, así que se prueba con archivos reales y no con imitaciones.
{
  const os = require('os');
  const io = { fs, path, log: () => {} };
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'boveda-'));

  const proyecto = (id, nombre, canvasHijo) => ({ id, name: { es: nombre, en: nombre } });
  const datos = (proyectos, canvases) => ({ lang: 'es', theme: 'light', projects: proyectos, canvases: canvases || {} });

  // Un proyecto con un tablero anidado, para comprobar que los lienzos de dentro
  // viajan con él.
  const canvases = {
    'p1': { items: [{ id: 'i1', type: 'board', canvasId: 'sub1' }] },
    'sub1': { items: [{ id: 'i2', type: 'note' }] },
    'p2': { items: [] },
    'suelto': { items: [] },   // de nadie: no debe acabar en ningún proyecto
  };
  const p1 = { id: 'p1', name: { es: 'Diana' } };
  const p2 = { id: 'p2', name: { es: 'Aurora Studio' } };

  // ── Primera escritura ──
  let hecho = B.escribeCarpetas(io, raiz, datos([p1, p2], canvases));
  check('escribe una carpeta por proyecto', hecho.escritos.length === 2, hecho.escritos.join(', '));
  check('la carpeta se llama como el proyecto', fs.existsSync(path.join(raiz, 'Diana', 'project.json')));
  check('y la del otro también', fs.existsSync(path.join(raiz, 'Aurora Studio', 'project.json')));

  const guardado = JSON.parse(fs.readFileSync(path.join(raiz, 'Diana', 'project.json'), 'utf-8'));
  check('el json lleva su proyecto', guardado.project && guardado.project.id === 'p1');
  check('y sus lienzos, incluido el tablero anidado',
    !!guardado.canvases.p1 && !!guardado.canvases.sub1, Object.keys(guardado.canvases).join(','));
  check('y NO los de otro proyecto', !guardado.canvases.p2 && !guardado.canvases.suelto);
  check('el idioma y el tema viajan como meta', guardado.meta && guardado.meta.lang === 'es');

  // ── Un renombrado mueve la carpeta con todo dentro ──
  fs.mkdirSync(path.join(raiz, 'Diana', 'media'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'Diana', 'media', 'foto.png'), 'x');

  const p1b = { id: 'p1', name: { es: 'Diana la buena' } };
  hecho = B.escribeCarpetas(io, raiz, datos([p1b, p2], canvases));
  check('renombrar el proyecto renombra su carpeta', hecho.renombrados.length === 1, JSON.stringify(hecho.renombrados));
  check('la carpeta vieja ya no está', !fs.existsSync(path.join(raiz, 'Diana')));
  check('la imagen viajó con ella', fs.existsSync(path.join(raiz, 'Diana la buena', 'media', 'foto.png')));
  check('y no se dejó un json huérfano', fs.existsSync(path.join(raiz, 'Diana la buena', 'project.json')));

  // ── Un proyecto borrado se lleva su carpeta ──
  hecho = B.escribeCarpetas(io, raiz, datos([p2], canvases));
  check('se retira la carpeta del proyecto eliminado', hecho.retirados.length === 1, JSON.stringify(hecho.retirados));
  check('ya no está en el disco', !fs.existsSync(path.join(raiz, 'Diana la buena')));
  check('y el que sigue vivo no se toca', fs.existsSync(path.join(raiz, 'Aurora Studio', 'project.json')));

  // ── Lo que no es nuestro no se toca NUNCA ──
  fs.mkdirSync(path.join(raiz, 'Mis cosas'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'Mis cosas', 'apuntes.txt'), 'no me borres');
  fs.mkdirSync(path.join(raiz, 'media'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'media', 'vieja.png'), 'x');

  B.escribeCarpetas(io, raiz, datos([p2], canvases));
  check('una carpeta ajena sigue ahí', fs.existsSync(path.join(raiz, 'Mis cosas', 'apuntes.txt')));
  check('el montón de imágenes de antes sigue ahí', fs.existsSync(path.join(raiz, 'media', 'vieja.png')));

  // ── Si el nombre nuevo está ocupado, no se pisa nada ──
  fs.mkdirSync(path.join(raiz, 'Ocupada'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'Ocupada', 'algo.txt'), 'mío');
  const p2b = { id: 'p2', name: { es: 'Ocupada' } };
  B.escribeCarpetas(io, raiz, datos([p2b], canvases));
  check('no se pisa una carpeta que ya existía', fs.readFileSync(path.join(raiz, 'Ocupada', 'algo.txt'), 'utf-8') === 'mío');

  // ── Y lo escrito se puede volver a leer ──
  const leido = B.leeCarpetas(io, raiz);
  check('lo escrito se lee de vuelta', !!leido && leido.projects.length >= 1, leido ? String(leido.projects.length) : 'null');

  fs.rmSync(raiz, { recursive: true, force: true });
}

// ── Un tablero que pasa a ser proyecto con el nombre de otro ──
//
// El caso del usuario: "New board" ya existía, el tablero convertido también se
// llamaba así y, al ir primero en la lista, se quedó el nombre limpio. La
// carpeta del otro se renombró al guardar y el proyecto nuevo estrenó una
// vacía: su imagen salía en blanco. Ahora, al escribir, cada proyecto se trae
// de otra carpeta los archivos que usa y no tiene.
{
  const io = { fs, path, log: () => {} };
  const os = require('os');
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'boveda-choque-'));
  const viejo = { id: 'pv', name: { es: 'New board' } };
  const origen = { id: 'po', name: { es: 'Origen' } };
  B.escribeCarpetas(io, raiz, { projects: [viejo, origen], canvases: {
    pv: { items: [] },
    po: { items: [{ id: 't', type: 'board', canvasId: 'b1' }] },
    b1: { items: [{ id: 'i1', type: 'image', src: 'media/foto_abc123.png' }] },
  } });
  fs.mkdirSync(path.join(raiz, 'Origen', 'media'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'Origen', 'media', 'foto_abc123.png'), 'png');
  // El tablero pasa a ser proyecto: sale el primero y se llama como el viejo.
  const nuevo = { id: 'pn', name: { es: 'New board' } };
  const canvases2 = { pv: { items: [] }, po: { items: [] }, pn: { items: [{ id: 'i1', type: 'image', src: 'media/foto_abc123.png' }] } };
  const hecho = B.escribeCarpetas(io, raiz, { projects: [nuevo, viejo, origen], canvases: canvases2 });
  check('el proyecto nuevo se queda el nombre limpio', B.carpetasDeProyectos([nuevo, viejo, origen]).pn === 'New board');
  check('y su imagen está en SU carpeta', fs.existsSync(path.join(raiz, 'New board', 'media', 'foto_abc123.png')), JSON.stringify(hecho));
  check('se trajo una', hecho.traidos === 1, String(hecho.traidos));
  check('la del proyecto de origen sigue en su sitio', fs.existsSync(path.join(raiz, 'Origen', 'media', 'foto_abc123.png')));
  check('buscaMedio la encuentra en la carpeta de otro proyecto', B.buscaMedio(io, raiz, 'Nadie/media/foto_abc123.png') !== null);
  check('buscaMedio no se sale de la bóveda', B.buscaMedio(io, raiz, '../fuera/media/x.png') === null);
  check('una segunda escritura no copia nada más',
    B.escribeCarpetas(io, raiz, { projects: [nuevo, viejo, origen], canvases: canvases2 }).traidos === 0);
  const med = B.mediosDeLienzos({ c: { items: [
    { id: 'g', type: 'galeria', fotos: [{ id: 'f', src: 'media/galeria_f.webp' }] },
    { id: 'col', type: 'column', children: [{ id: 'h', src: 'media/hijo.png' }] },
    { id: 'x', src: 'media/../../malo.png' },
  ] } });
  check('cuenta las fotos de galería y los hijos de columna, y no lo que sube de carpeta',
    med.sort().join(',') === 'galeria_f.webp,hijo.png', med.join(','));
  fs.rmSync(raiz, { recursive: true, force: true });
}

// ── Lo que encontró el bot de datos (17/10) ──
{
  const os = require('os');
  const io = { fs, path, log: () => {} };
  const p = (id, nombre) => ({ id, name: { es: nombre, en: nombre } });
  const datos = (proyectos, canvases) => ({ lang: 'es', projects: proyectos, canvases: canvases || {} });
  const nota = (id, texto) => ({ items: [{ id: 'n-' + id, type: 'note', text: texto }] });
  const textoDe = (raiz, carpeta, id) => JSON.parse(fs.readFileSync(path.join(raiz, carpeta, 'project.json'), 'utf-8')).canvases[id].items[0].text;
  const carpetasCon = (raiz) => B.carpetasConProyecto(io, raiz);

  // 1. Retirar no borra: va a .retirados, con su json y sus imágenes.
  {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'boveda-retira-'));
    B.escribeCarpetas(io, raiz, datos([p('a', 'Uno'), p('b', 'Dos')], { a: nota('a', 'x'), b: nota('b', 'y') }));
    fs.mkdirSync(path.join(raiz, 'Dos', 'media'), { recursive: true });
    fs.writeFileSync(path.join(raiz, 'Dos', 'media', 'foto.png'), 'png');
    const hecho = B.escribeCarpetas(io, raiz, datos([p('a', 'Uno')], { a: nota('a', 'x') }));
    const ret = fs.readdirSync(path.join(raiz, B.RETIRADOS));
    check('un proyecto borrado se retira, no se borra', hecho.retirados.includes('Dos') && !fs.existsSync(path.join(raiz, 'Dos')) && ret.length === 1, ret.join(','));
    check('y en .retirados sigue su json y su imagen', fs.existsSync(path.join(raiz, B.RETIRADOS, ret[0], 'project.json')) && fs.existsSync(path.join(raiz, B.RETIRADOS, ret[0], 'media', 'foto.png')));
    check('.retirados no se lee como un proyecto', B.leeCarpetas(io, raiz).projects.length === 1);

    // 2. Una lista vacía (una lectura fallida) no retira nada.
    const vacio = B.escribeCarpetas(io, raiz, datos([], {}));
    check('una lista sin proyectos no retira ninguna carpeta', vacio.retirados.length === 0 && fs.existsSync(path.join(raiz, 'Uno', 'project.json')));
  }

  // 3. El «gemelo» del bot: dos «Doble», se borra el que tenía el nombre
  // limpio, se edita el otro, y al leer tiene que salir uno, con lo último.
  {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'boveda-gemelo-'));
    const A = p('proj-a8618', 'Doble'), Bp = p('proj-b0001', 'Doble');
    B.escribeCarpetas(io, raiz, datos([A], { [A.id]: nota('a', 'v1') }));
    // B es nuevo y va primero en la lista: se queda el nombre limpio.
    B.escribeCarpetas(io, raiz, datos([Bp, A], { [A.id]: nota('a', 'v1'), [Bp.id]: nota('b', 'B') }));
    const antes = carpetasCon(raiz).map(c => c.carpeta + '=' + c.id).sort().join(' | ');
    // B se borra para siempre y A se edita.
    B.escribeCarpetas(io, raiz, datos([A], { [A.id]: nota('a', 'v3') }));
    const despues = carpetasCon(raiz);
    const deA = despues.filter(c => c.id === A.id);
    check('borrado el otro, el proyecto queda en UNA carpeta', deA.length === 1, despues.map(c => c.carpeta + '=' + c.id).join(' | ') + ' (antes: ' + antes + ')');
    check('y es la del nombre limpio', deA.length === 1 && deA[0].carpeta === 'Doble', deA.map(c => c.carpeta).join(','));
    const leido = B.leeCarpetas(io, raiz);
    check('al leer sale una vez y con lo último', leido.projects.length === 1 && leido.canvases[A.id].items[0].text === 'v3', leido.projects.length + ' · ' + (leido.canvases[A.id] && leido.canvases[A.id].items[0].text));
  }

  // 4. Una bóveda que YA tiene gemelos (de antes de este arreglo): al leer gana
  // la carpeta más reciente, y la siguiente escritura retira la vieja.
  {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'boveda-gemelos-viejos-'));
    const A = p('proj-zz77', 'Rico');
    const escribe = (carpeta, texto, cuando) => {
      fs.mkdirSync(path.join(raiz, carpeta), { recursive: true });
      const f = path.join(raiz, carpeta, 'project.json');
      fs.writeFileSync(f, JSON.stringify({ meta: {}, project: A, canvases: { [A.id]: nota('a', texto) } }));
      fs.utimesSync(f, cuando, cuando);
    };
    escribe('Rico', 'nuevo', new Date(Date.now() - 1000));
    escribe('CON-', 'viejo', new Date(Date.now() - 86400000));
    const leido = B.leeCarpetas(io, raiz);
    check('dos carpetas del mismo proyecto: se lee una, la más reciente', leido.projects.length === 1 && leido.canvases[A.id].items[0].text === 'nuevo', leido.projects.length + ' · ' + leido.canvases[A.id].items[0].text);
    B.escribeCarpetas(io, raiz, datos([A], leido.canvases));
    const quedan = carpetasCon(raiz).map(c => c.carpeta);
    check('y al guardar, la copia vieja se retira', quedan.length === 1 && quedan[0] === 'Rico' && fs.readdirSync(path.join(raiz, B.RETIRADOS)).length === 1, quedan.join(','));
  }

  // 4b. Un guardado con el mapa de carpetas vacío o incompleto (lo hizo el
  // guardado de última hora al cerrar, con un mapa del primer render) no
  // retira ninguna carpeta como «copia vieja».
  {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'boveda-mapa-vacio-'));
    const ps = [p('a1', 'Uno'), p('b2', 'Dos'), p('c3', 'Tres')];
    const cs = { a1: nota('a1', 'x'), b2: nota('b2', 'y'), c3: nota('c3', 'z') };
    B.escribeCarpetas(io, raiz, datos(ps, cs));
    const vacio = B.escribeCarpetas(io, raiz, datos(ps, cs), {});
    const medio = B.escribeCarpetas(io, raiz, datos(ps, cs), { a1: 'Uno' });
    check('con el mapa vacío no se retira ninguna carpeta', vacio.retirados.length === 0 && carpetasCon(raiz).length === 3, vacio.retirados.join(','));
    check('con el mapa a medias tampoco', medio.retirados.length === 0 && carpetasCon(raiz).length === 3, medio.retirados.join(','));
  }

  // 5. Lo de .retirados con más de 30 días se borra; lo reciente no.
  {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'boveda-limpia-'));
    const dir = path.join(raiz, B.RETIRADOS);
    fs.mkdirSync(path.join(dir, 'viejo'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'nuevo'), { recursive: true });
    const hace40 = new Date(Date.now() - 40 * 86400000);
    fs.utimesSync(path.join(dir, 'viejo'), hace40, hace40);
    const n = B.limpiaRetirados(io, raiz);
    check('.retirados: se borra lo de más de 30 días y se queda lo reciente', n === 1 && !fs.existsSync(path.join(dir, 'viejo')) && fs.existsSync(path.join(dir, 'nuevo')));
  }
  // 6. Solo se escribe lo que cambia: un segundo guardado igual no toca nada,
  // uno con un proyecto cambiado escribe solo ese, cambiar solo la vista no
  // reescribe ninguno, y un project.json tocado por fuera se vuelve a escribir.
  {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'boveda-iguales-'));
    const cv = { a: { items: [{ id: 'n1', type: 'note' }] }, b: { items: [] } };
    const pa = { id: 'a', name: { es: 'Alfa' } }, pb = { id: 'b', name: { es: 'Beta' } };
    const d = (canv, extra) => Object.assign({ lang: 'es', theme: 'light', projects: [pa, pb], canvases: canv }, extra || {});
    const h1 = B.escribeCarpetas(io, raiz, d(cv));
    const h2 = B.escribeCarpetas(io, raiz, d(cv));
    check('un guardado igual no reescribe ningún proyecto', h1.escritos.length === 2 && h2.escritos.length === 0 && h2.iguales.length === 2, JSON.stringify(h2));
    const h3 = B.escribeCarpetas(io, raiz, d(cv, { view: { kind: 'canvas', projectId: 'a' } }));
    check('cambiar solo la vista tampoco', h3.escritos.length === 0, JSON.stringify(h3));
    const cv2 = { a: { items: [{ id: 'n1', type: 'note', content: { es: 'hola' } }] }, b: { items: [] } };
    const h4 = B.escribeCarpetas(io, raiz, d(cv2));
    check('un proyecto cambiado se escribe, solo ese', h4.escritos.length === 1 && h4.escritos[0] === 'Alfa', JSON.stringify(h4));
    const leido = JSON.parse(fs.readFileSync(path.join(raiz, 'Alfa', 'project.json'), 'utf-8'));
    check('y lleva lo nuevo', leido.canvases.a.items[0].content && leido.canvases.a.items[0].content.es === 'hola');
    fs.writeFileSync(path.join(raiz, 'Beta', 'project.json'), '{"roto": true}');
    const h5 = B.escribeCarpetas(io, raiz, d(cv2));
    check('un project.json tocado por fuera se vuelve a escribir', h5.escritos.length === 1 && h5.escritos[0] === 'Beta', JSON.stringify(h5));
  }
}

console.log('');
console.log(fallos === 0 ? 'Todo en orden.' : fallos + ' fallo(s).');
process.exit(fallos === 0 ? 0 : 1);
