// Carpetas de la pantalla de inicio.  node scripts/test-carpetas.js
//
// Una carpeta no se guarda en ninguna lista maestra: existe porque hay
// proyectos que dicen estar dentro de ella (p.carpeta, el nombre tal cual).
// Eso es lo que hace que agrupar NO toque la sincronización — el campo viaja
// dentro del proyecto como el nombre o el color de la portada— y es también lo
// que hay que vigilar: que quitar una carpeta no se lleve por delante ningún
// proyecto, y que una carpeta vacía (la única que no se puede deducir) siga
// existiendo sin inventarse una segunda fuente de la verdad.
//
// Las funciones se sacan del propio Home.jsx, no se copian aquí.
const path = require('path');
const fs = require('fs');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const ruta = (...p) => path.join(__dirname, '..', ...p);
const home = fs.readFileSync(ruta('src', 'Home.jsx'), 'utf-8');
const app = fs.readFileSync(ruta('src', 'app.jsx'), 'utf-8');

const m = home.match(/function carpetaDe\(p\) \{[\s\S]*?\r?\n(?=window\.carpetasVisibles)/);
check('se encuentran las funciones de carpetas en Home.jsx', !!m);
if (!m) { console.log('\n1 FALLOS'); process.exit(1); }
const { carpetaDe, carpetasVisibles, cuentaPorCarpeta, nombreLibreDeCarpeta } =
  new Function(m[0] + '\nreturn { carpetaDe, carpetasVisibles, cuentaPorCarpeta, nombreLibreDeCarpeta };')();

// ── El nombre de la carpeta de un proyecto ──
check('un proyecto sin carpeta no está en ninguna', carpetaDe({}) === '');
check('los espacios de los lados no cuentan', carpetaDe({ carpeta: '  Trabajo  ' }) === 'Trabajo');
check('una carpeta en blanco es no tener carpeta', carpetaDe({ carpeta: '   ' }) === '');
check('un null no revienta', carpetaDe({ carpeta: null }) === '');

// ── Qué carpetas se ven ──
const proyectos = [
  { id: 'a', carpeta: 'Trabajo' },
  { id: 'b', carpeta: 'Trabajo' },
  { id: 'c', carpeta: 'Novela' },
  { id: 'd' },
  { id: 'e', carpeta: 'Vieja', deleted: true },
];
check('salen las carpetas que nombran los proyectos',
  carpetasVisibles(proyectos, []).join('|') === 'Novela|Trabajo',
  carpetasVisibles(proyectos, []).join('|'));
// Un proyecto en la papelera no puede mantener viva una carpeta: si no, se
// quedaría ahí un cajón que no se puede abrir ni vaciar.
check('un proyecto en la papelera no mantiene viva su carpeta',
  carpetasVisibles(proyectos, []).indexOf('Vieja') === -1);
check('las vacías de este equipo también salen',
  carpetasVisibles(proyectos, ['Pendiente']).join('|') === 'Novela|Pendiente|Trabajo');
check('una vacía que ya usa un proyecto no sale dos veces',
  carpetasVisibles(proyectos, ['Trabajo']).join('|') === 'Novela|Trabajo');
check('se ordenan como las ordenaría una persona',
  carpetasVisibles([{ id: 'x', carpeta: 'Zamora' }, { id: 'y', carpeta: 'Ávila' }], []).join('|') === 'Ávila|Zamora');
check('sin proyectos y sin vacías no hay carpetas', carpetasVisibles([], []).length === 0);
check('aguanta que no le pasen nada', carpetasVisibles(null, null).length === 0);

// ── Cuántos hay en cada una ──
const cuenta = cuentaPorCarpeta(proyectos);
check('cuenta los de cada carpeta', cuenta['Trabajo'] === 2 && cuenta['Novela'] === 1,
  JSON.stringify(cuenta));
check('no cuenta los de la papelera', cuenta['Vieja'] === undefined);
check('los sueltos no cuentan en ninguna', Object.keys(cuenta).length === 2);

// ── Nombres que no se pisan ──
// Como la carpeta ES su nombre, dos carpetas iguales serían la misma y los
// proyectos se mezclarían sin avisar.
check('si el nombre está libre, se usa tal cual',
  nombreLibreDeCarpeta(['Trabajo'], 'Carpeta') === 'Carpeta');
check('si está cogido, se numera', nombreLibreDeCarpeta(['Carpeta'], 'Carpeta') === 'Carpeta 2');
check('y sigue numerando', nombreLibreDeCarpeta(['Carpeta', 'Carpeta 2'], 'Carpeta') === 'Carpeta 3');
check('da igual cómo esté escrito en mayúsculas',
  nombreLibreDeCarpeta(['CARPETA'], 'Carpeta') === 'Carpeta 2');

// ── Lo que hace la aplicación con esos nombres ──
check('mover un proyecto solo le cambia un campo',
  /const setProjectFolder = \(projectId, carpeta\) => \{[\s\S]{0,300}\{ \.\.\.x, carpeta: limpio \|\| null \}/.test(app));
check('renombrar una carpeta arrastra a todos sus proyectos',
  /const renameFolder = \([\s\S]{0,400}String\(x\.carpeta \|\| ''\)\.trim\(\) === de \? \{ \.\.\.x, carpeta: a \}/.test(app));
// Lo importante de todo esto: quitar la carpeta NO puede borrar un proyecto.
check('quitar una carpeta solo vacía el campo, no borra nada',
  /const removeFolder = \([\s\S]{0,400}\{ \.\.\.x, carpeta: null \}/.test(app));
check('quitar una carpeta no filtra la lista de proyectos',
  !/const removeFolder = \([\s\S]{0,400}\.filter\(/.test(app));

// ── La pantalla ──
check('en "Todos" solo se enseñan los sueltos, y dentro de una, los suyos',
  /carpetaAbierta\r?\n\s*\? list\.filter\(p => carpetaDe\(p\) === carpetaAbierta\)\r?\n\s*: list\.filter\(p => !carpetaDe\(p\)\)/.test(home));
// Quien escribe un nombre quiere ese proyecto, no que le recuerden en qué
// cajón lo dejó: buscando se sale de las carpetas.
check('buscando no se agrupa', /if \(buscando\) \{[\s\S]{0,400}return list\.filter/.test(home));
check('favoritos y papelera se quedan planos',
  /if \(section === 'all'\) \{\r?\n\s*list = carpetaAbierta/.test(home));
check('las carpetas vacías se apuntan solo en este equipo',
  /const CARPETAS_VACIAS_KEY = 'odinote\.carpetas_vacias'/.test(home));
check('un proyecto creado dentro de una carpeta nace dentro de ella',
  /onCreate\(carpetaAbierta \? \{ \.\.\.p, carpeta: carpetaAbierta \} : p\)/.test(home));
check('cada tarjeta tiene su botón de mover',
  home.indexOf('drive_file_move') !== -1 && home.indexOf('onMoveClick();') !== -1);
check('y se ve en qué carpeta vive cuando sale fuera de ella',
  /className="ms-carpeta-chip"/.test(home));

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo en orden.');
process.exit(fallos ? 1 : 0);
