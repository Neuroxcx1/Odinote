// Pruebas del nodo de calendario.  node scripts/test-calendario.js
//
// Los cuatro ajustes que se pidieron —tamaño del texto de los días, tamaño del
// mes y el año, color de los números y poder quitar el verde de hoy— no son
// lógica: son una variable de CSS que tiene que llegar desde el item hasta la
// regla correcta. Lo que se rompe en algo así es la CADENA: alguien añade una
// regla nueva al calendario, se olvida del multiplicador, y esa parte deja de
// crecer con las demás sin que nadie se entere. Eso es lo que se vigila aquí.
const path = require('path');
const fs = require('fs');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const ruta = (...p) => path.join(__dirname, '..', ...p);
const items = fs.readFileSync(ruta('src', 'items.jsx'), 'utf-8');
const css = fs.readFileSync(ruta('src', 'styles.css'), 'utf-8');
const ctx = fs.readFileSync(ruta('src', 'ContextSidebar.jsx'), 'utf-8');

// ── El nodo pone las variables ──
check('el nodo pasa el tamaño del texto', /'--cal-texto': item\.textScale \|\| 1/.test(items));
check('y el del mes y el año, que va aparte', /'--cal-cabecera': item\.headScale \|\| 1/.test(items));
check('el color de los números solo se pone si lo han elegido',
  /\.\.\.\(item\.numberColor \? \{ '--cal-numero': item\.numberColor \} : null\)/.test(items));

// ── El verde de hoy ──
check('hoy se marca salvo que lo hayan quitado',
  /const claveHoy = item\.hoyMarcado === false \? null : todayKey;/.test(items));
// Las dos clases tienen que mirar LA MISMA clave. Mirando una todayKey y la
// otra claveHoy, con el aviso quitado el día de hoy no se podría seleccionar
// en rojo como cualquier otro: seguiría excluido por la condición vieja.
check('la casilla de hoy y la de seleccionado miran la misma clave',
  /c\.key === claveHoy \? 'today' : ''\} \$\{c\.key === selectedKey && c\.key !== claveHoy/.test(items));
check('ya no queda ninguna clase mirando todayKey a secas',
  !/c\.key === todayKey \? 'today'/.test(items));

// ── La cadena hasta el CSS ──
//
// La regla se busca por su selector AL PRINCIPIO DE UNA LÍNEA. Buscándolo con
// un indexOf pelado se engancha antes el mismo nombre dentro de otro selector
// más largo —".cal-mb-cell.today .cal-mb-day"— y se acaba comprobando una
// regla que no es (así fallaban dos de estas comprobaciones sin que el código
// tuviera nada malo).
const regla = (sel) => {
  const i = css.indexOf('\n' + sel);
  if (i === -1) return null;
  return css.slice(i + 1, css.indexOf('}', i));
};

for (const sel of ['.cal-mb-head {',
                   '.cal-mb-head .material-symbols-rounded {',
                   '.cal-mb-nav {',
                   '.cal-mb-nav .material-symbols-rounded {']) {
  const linea = regla(sel);
  check('crece con el mes y el año: ' + sel.replace(' {', ''),
    !!linea && /var\(--cal-cabecera, 1\)/.test(linea));
}
check('los selectores de día/mes/año también',
  (css.match(/calc\(12px \* var\(--node-scale, 1\) \* var\(--cal-cabecera, 1\)\)/g) || []).length === 2);

for (const sel of ['.cal-mb-day {', '.cal-mb-dow {', '.cal-mb-event {', '.cal-mb-input {']) {
  const linea = regla(sel);
  check('crece con el texto: ' + sel.replace(' {', ''),
    !!linea && /var\(--cal-texto, 1\)/.test(linea));
}
check('el color de los números sale de la variable, con el de siempre de reserva',
  /color: var\(--cal-numero, var\(--ink-2\)\)/.test(css));
// Con el texto al doble y el alto de la casilla fijo, el número se cortaba por
// abajo: la casilla tiene que crecer con la letra.
check('la casilla crece con la letra',
  /min-height: calc\(36px \* var\(--cal-texto, 1\)\)/.test(css));

// ── Los botones del menú del nodo ──
check('el calendario usa el mismo botón de tamaño de texto que las notas',
  /\['note','comment','todo','calendar'\]\.includes\(item\.type\)/.test(ctx));
check('hay botón para agrandar el mes y el año', /Mes y año más grandes/.test(ctx));
check('y para empequeñecerlo', /Mes y año más pequeños/.test(ctx));
check('hay panel de color de los números del calendario', /pane === 'calNumeros'/.test(ctx));
check('y un interruptor para el verde de hoy',
  /hoyMarcado: item\.hoyMarcado === false/.test(ctx));
check('el interruptor nace encendido, como estaba',
  /ctx-btn \$\{item\.hoyMarcado !== false \? 'active' : ''\}/.test(ctx));
// Un selector de color sin vuelta atrás solo va en una dirección: en cuanto
// tocas un color, el que se calculaba solo ya no vuelve.
check('los dos colores de números se pueden devolver al de siempre',
  (ctx.match(/onUpdate\(\{ numberColor: null \}\)/g) || []).length === 2);

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo en orden.');
process.exit(fallos ? 1 : 0);
