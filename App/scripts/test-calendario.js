// Pruebas del nodo de calendario.  node scripts/test-calendario.js
//
// El calendario se rehízo en la 1.0.9 al estilo de Google Calendar y vive en su
// propio archivo (src/Calendario.jsx); las fechas se cuentan aparte, en
// src/calendario-logica.js, y esas tienen sus pruebas en
// test-calendario-logica.js. Aquí se vigilan las CADENAS: una variable de CSS
// que tiene que llegar del item a la regla correcta, una clave de día que
// tienen que mirar igual dos sitios, y que el calendario siga enganchado a la
// aplicación (su script, la barra, los avisos). Lo que se rompe en algo así es
// un eslabón suelto que nadie ve hasta que el tamaño deja de moverse.
const path = require('path');
const fs = require('fs');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const ruta = (...p) => path.join(__dirname, '..', ...p);
const cal = fs.readFileSync(ruta('src', 'Calendario.jsx'), 'utf-8');
const items = fs.readFileSync(ruta('src', 'items.jsx'), 'utf-8');
const css = fs.readFileSync(ruta('src', 'styles.css'), 'utf-8');
const ctx = fs.readFileSync(ruta('src', 'ContextSidebar.jsx'), 'utf-8');
const app = fs.readFileSync(ruta('src', 'app.jsx'), 'utf-8');
const html = fs.readFileSync(ruta('index.html'), 'utf-8');

// ── Enganchado a la aplicación ──
const iLogica = html.indexOf('src/calendario-logica.js');
const iCal = html.indexOf('src/Calendario.jsx');
const iColor = html.indexOf('src/ColorPicker.jsx');
check('index.html carga la lógica y el calendario', iLogica !== -1 && iCal !== -1);
check('la lógica antes que el calendario, que la usa al cargarse', iLogica < iCal);
check('y el calendario después del selector de color', iColor < iCal);
check('el nodo se pinta con el calendario nuevo', /case 'calendar': return window\.CalendarItem \?/.test(items));
check('y el viejo ya no está en items.jsx', !/function CalendarItem/.test(items));

// ── El nodo pone las variables ──
check('el nodo pasa el tamaño del texto (con su vista previa)', /'--cal-texto': `var\(--vista-escala, \$\{item\.textScale \|\| 1\}\)`/.test(cal));
check('la cabecera crece con el texto', /'--cal-cabecera': `calc\(\$\{item\.headScale \|\| 1\} \* var\(--cal-texto, 1\)\)`/.test(cal));
check('el color de los números solo se pone si lo han elegido',
  /\.\.\.\(item\.numberColor \? \{ '--cal-numero': item\.numberColor \} : null\)/.test(cal));

// ── Hoy y el día elegido ──
check('hoy se marca salvo que lo hayan quitado',
  /const claveHoy = item\.hoyMarcado === false \? null : claveDeHoy;/.test(cal));
// Las dos marcas tienen que mirar LA MISMA clave. Si una mirara la de hoy sin
// más, con el verde quitado el día de hoy no se podría elegir en rojo.
check('la casilla de hoy y la elegida miran la misma clave',
  /const esHoy = k === claveHoy;/.test(cal) && /const esSel = k === selectedKey && k !== claveHoy;/.test(cal));
check('un segundo clic en el día elegido lo suelta',
  /if \(k === selectedKey\) onUpdate\(\{ selectedDay: null, selectedYear: null, selectedMonth: null \}\)/.test(cal));

// ── Lo de Google ──
check('las cinco vistas', /const CAL_VISTAS = \['dia', 'semana', 'mes', 'anio', 'agenda'\];/.test(cal));
check('la vista elegida se guarda en el nodo', /onUpdate\(\{ vista: v \}\)/.test(cal));
check('los nombres de días y meses los da el navegador en el idioma de la aplicación',
  /toLocaleDateString\(lang, \{ weekday: forma \|\| 'short' \}\)/.test(cal));
check('el editor guarda según se escribe, sin botón de guardar', /onChange=\{\(e\) => cambia\(\{ text: e\.target\.value \}\)\}/.test(cal));
check('uno nuevo que se cierra sin título no se queda', /if \(ev && !String\(ev\.text \|\| ''\)\.trim\(\)\)/.test(cal));
check('borrar uno que se repite pregunta: solo este, los siguientes o todos',
  /quita\('este'\)/.test(cal) && /quita\('siguientes'\)/.test(cal) && /quita\('todos'\)/.test(cal));
check('arrastrar uno que se repite mueve solo esa vez',
  /excepciones: \[\.\.\.\(e\.excepciones \|\| \[\]\), o\.clave\]/.test(cal));
check('soltar un arrastre no crea un evento en el hueco',
  (cal.match(/Date\.now\(\) - recienArrastrado\.current < 400/g) || []).length === 2);
check('la hora de ahora se mueve sola cada minuto', /setInterval\(\(\) => setAhora\(new Date\(\)\), 60000\)/.test(cal));
check('lo que no cabe se resume en "+N más"', /\+\$\{resto\} más/.test(cal));

// ── Las fotos y el color de cada día ──
check('la foto de un día se encoge al ponerla', /function calFotoDelDia\(file\)/.test(cal) && /calFotoDelDia\(f\)\.then/.test(cal));
check('y se pinta pasando por resolveMediaSrc',
  /const fuenteFoto = \(v\) => \(window\.resolveMediaSrc \? window\.resolveMediaSrc\(v\) : v\);/.test(cal));
check('el color del día usa el selector de color de toda la aplicación',
  /onCambio=\{\(c\) => setDayColor\(k, c\)\}/.test(cal) && !/DAY_COLORS/.test(cal));

// ── La cadena hasta el CSS ──
//
// La regla se busca por su selector AL PRINCIPIO DE UNA LÍNEA. Buscándolo con
// un indexOf pelado se engancha antes el mismo nombre dentro de otro selector
// más largo, y se acaba comprobando una regla que no es.
const regla = (sel) => {
  const i = css.indexOf('\n' + sel);
  if (i === -1) return null;
  return css.slice(i + 1, css.indexOf('}', i));
};
for (const sel of ['.cal-mb-titulo {', '.cal-mb-nav {', '.cal-mb-selector, .cal-mb-vistas {']) {
  const linea = regla(sel);
  check('crece con la cabecera: ' + sel.replace(' {', ''), !!linea && /var\(--cal-cabecera, 1\)/.test(linea));
}
for (const sel of ['.cal-mb-dow {', '.cal-mb-grid {', '.cal-mb-lista {', '.cal-horas {', '.cal-anio {', '.cal-agenda, .cal-agenda-vacia {']) {
  const linea = regla(sel);
  check('crece con el texto: ' + sel.replace(' {', ''), !!linea && /var\(--cal-texto, 1\)/.test(linea));
}
// Dentro de cada parte todo va en em: así la variable de la parte mueve el
// número, los eventos y las horas a la vez, sin descolocarlos.
for (const sel of ['.cal-mb-day {', '.cal-mb-event {', '.cal-horas-evento {']) {
  const linea = regla(sel);
  check('va en em, colgando de su parte: ' + sel.replace(' {', ''), !!linea && !/font-size:[^;]*px/.test(linea));
}
check('el color de los números sale de la variable, con el de siempre de reserva',
  /color: var\(--cal-numero, inherit\)/.test(css));
check('las líneas salen de la tinta del nodo, no de un gris fijo',
  /--cal-linea: color-mix\(in srgb, currentColor 13%, transparent\)/.test(css));
check('ya no quedan los estilos del calendario de antes',
  !/cal-mb-hint|cal-mb-dropdown|cal-mb-drop-item/.test(css));

// ── La barra del nodo ──
check('un solo tamaño: el del mes ya no tiene botón', !/tamanos\.mes/.test(ctx));
check('el calendario usa el mismo tamaño de texto que las notas',
  /\['note', 'comment', 'todo', 'calendar'\]\.includes\(item\.type\) \? 13\.5/.test(ctx));
check('hay panel de ajustes', /pane === 'calAjustes'/.test(ctx));
check('con la semana, los fines de semana, los números de semana y el reloj',
  /primerDia: d/.test(ctx) && /'finesDeSemana'/.test(ctx) && /'numSemana'/.test(ctx) && /'formato24'/.test(ctx));
check('y el .ics de ida y de vuelta', /CalLogica\.aICS\(/.test(ctx) && /CalLogica\.deICS\(/.test(ctx));
check('hay panel de color de los números del calendario', /pane === 'calNumeros'/.test(ctx));
check('y un interruptor para el verde de hoy', /hoyMarcado: item\.hoyMarcado === false/.test(ctx));
check('los dos colores de números se pueden devolver al de siempre',
  (ctx.match(/onUpdate\(\{ numberColor: null \}\)/g) || []).length === 2);

// ── Los avisos ──
check('la aplicación mira los avisos cada medio minuto', /CalLogica\.avisosPendientes\(lienzosParaAvisosRef\.current/.test(app) && /setInterval\(mira, 30000\)/.test(app));
check('y apunta los ya avisados para no repetirlos', /'odinote\.avisos_dados'/.test(app));

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo en orden.');
process.exit(fallos ? 1 : 0);
