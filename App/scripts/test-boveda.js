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

console.log('');
console.log(fallos === 0 ? 'Todo en orden.' : fallos + ' fallo(s).');
process.exit(fallos === 0 ? 0 : 1);
