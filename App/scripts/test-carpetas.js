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

// ── Meter proyectos en una carpeta que ya tiene cosas fuera ──
//
// Dos caminos, porque uno solo no bastaba: arrastrar la tarjeta a la carpeta,
// y un botón dentro de la carpeta para traer varios de fuera. Dentro de una
// carpeta vacía no hay nada que arrastrar — lo que quieres meter está en la
// lista que no estás viendo.
check('la tarjeta de un proyecto se puede arrastrar', home.indexOf('draggable={!isTrash}') !== -1);
check('y la carpeta recibe lo que le sueltes', home.indexOf('if (id && onSoltar) onSoltar(id);') !== -1);
check('la flecha de volver saca de la carpeta', home.indexOf("if (id) mueveACarpeta(id, '');") !== -1);
// Al soltar, React quita esa tarjeta de la lista y el dragend llega cuando su
// elemento ya no está en la página: si la marca solo se limpiara ahí, se
// quedaría puesta y todas las carpetas con el borde de puntos para siempre.
// Uno por cada sitio donde se puede soltar —la carpeta, la flecha de volver y
// el cuadrado de sacar— más el dragend de la propia tarjeta. Si aparece otro
// sitio donde soltar y no limpia, esta cuenta lo canta.
check('cada sitio donde se suelta limpia la marca de arrastrar',
  home.split("classList.remove('arrastrando-proyecto')").length - 1 === 4);
check('hay botón para añadir proyectos dentro de la carpeta', home.indexOf('Meter aquí proyectos que ya existen') !== -1);
check('la ventana solo ofrece los que están fuera',
  home.indexOf("projects.filter(p => !p.deleted && window.carpetaDe(p) !== carpeta)") !== -1);
check('varios de golpe se mueven en un solo cambio de estado',
  app.indexOf('const setProjectFolderMany = (ids, carpeta) =>') !== -1 && app.indexOf('cuales.has(x.id)') !== -1);
check('dentro de su propia carpeta la tarjeta no repite la chapa',
  home.indexOf('window.carpetaDe(project) !== dentroDe') !== -1);

// ── La carpeta vacía no puede desaparecer sola ──
//
// Al meter un proyecto, la carpeta salía de la lista de vacías porque ya se
// deducía de él. Al sacarlo, nadie la volvía a poner: la carpeta se esfumaba
// con el último proyecto que salía. La crea una persona a propósito y solo
// ella debe poder quitarla.
check('sacar el último proyecto vuelve a apuntar la carpeta como vacía',
  home.indexOf('const ajustaVacias = (entra, salen)') !== -1 &&
  home.indexOf('lista = [...lista, nombre];') !== -1);
check('se mira cuántos salen, no solo la cuenta de antes',
  home.indexOf('const carpetasQueDejan = (ids)') !== -1 &&
  home.indexOf('if ((cuentas[nombre] || 0) > salen[nombre]) continue;') !== -1);
check('mandar a la papelera el último tampoco se lleva la carpeta',
  home.indexOf('const borraProyecto = (projectId)') !== -1);
check('la carpeta solo se olvida cuando una persona la quita',
  home.indexOf('// Esta sí se olvida: la está quitando una persona a propósito.') !== -1);

// ── El cuadrado de sacar ──
// La flecha de volver ya recibía, pero eso no lo adivina nadie: es una flecha
// de navegar. Metiendo un proyecto se aprende que se puede meter; para sacarlo
// hacía falta que se viera.
check('hay un sitio visible donde soltar para sacar', home.indexOf('function SacarDeCarpetaCard(') !== -1);
check('solo aparece dentro de una carpeta',
  home.indexOf("{section === 'all' && carpetaAbierta && (") !== -1);

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo en orden.');
process.exit(fallos ? 1 : 0);
