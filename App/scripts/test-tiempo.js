// Pruebas del nodo de tiempo.  node scripts/test-tiempo.js
//
// Lo que se mide aquí es justo lo que no se podía medir antes: el salto de
// trabajo a descanso del pomodoro solo se veía esperando los minutos de
// verdad, así que nadie lo comprobó nunca. Sacando esa decisión a una función
// aparte —siguienteFasePomodoro— se le pueden pasar los cuatro casos y ver qué
// contesta, sin esperar ni un segundo.
//
// Las funciones NO se copian aquí: se sacan del propio items.jsx. Si alguien
// las cambia, esta prueba habla de la que se está usando de verdad.
const path = require('path');
const fs = require('fs');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const ruta = (...p) => path.join(__dirname, '..', ...p);
const items = fs.readFileSync(ruta('src', 'items.jsx'), 'utf-8');
const canvas = fs.readFileSync(ruta('src', 'Canvas.jsx'), 'utf-8');
const ctx = fs.readFileSync(ruta('src', 'ContextSidebar.jsx'), 'utf-8');

// Saca una función del código fuente y la deja llamable desde aquí.
const sacaFuncion = (nombre, args) => {
  const re = new RegExp('function ' + nombre + '\\(' + args.replace(/, /g, ', ') + '\\) \\{([\\s\\S]*?)\\r?\\n\\}');
  const m = items.match(re);
  check(`se encuentra ${nombre} en items.jsx`, !!m);
  if (!m) { console.log('\n1 FALLOS'); process.exit(1); }
  return new Function(...args.split(',').map(s => s.trim()), m[1]);
};

const duracionFase = sacaFuncion('duracionFase', 'item');
const formateaTiempo = sacaFuncion('formateaTiempo', 'ms');
const siguienteFasePomodoro = sacaFuncion('siguienteFasePomodoro', 'item, ahora, sigueCorriendo');

// ── Cuánto dura cada fase ──
check('la cuenta atrás nace en cinco minutos',
  duracionFase({ modoTiempo: 'cuentaAtras' }) === 300000);
check('minutos y segundos suman',
  duracionFase({ modoTiempo: 'cuentaAtras', minutos: 1, segundos: 30 }) === 90000);
check('solo segundos también vale',
  duracionFase({ modoTiempo: 'cuentaAtras', minutos: 0, segundos: 45 }) === 45000);
check('el cronómetro no tiene final',
  duracionFase({ modoTiempo: 'cronometro' }) === 0);
check('el pomodoro trabaja 25 minutos por defecto',
  duracionFase({ modoTiempo: 'pomodoro' }) === 1500000);
check('y descansa 5',
  duracionFase({ modoTiempo: 'pomodoro', faseDescanso: true }) === 300000);
check('el pomodoro también cuenta los segundos del trabajo',
  duracionFase({ modoTiempo: 'pomodoro', minutosTrabajo: 0, segundosTrabajo: 20 }) === 20000);
check('y los del descanso',
  duracionFase({ modoTiempo: 'pomodoro', faseDescanso: true, minutosDescanso: 1, segundosDescanso: 5 }) === 65000);
// Un nodo guardado ANTES de que existieran los segundos del pomodoro no puede
// empezar a contar mal por eso: sin el campo, los segundos son cero.
check('un pomodoro de antes, sin el campo de segundos, sigue durando lo mismo',
  duracionFase({ modoTiempo: 'pomodoro', minutosTrabajo: 50 }) === 3000000);
check('sin modo se comporta como cuenta atrás',
  duracionFase({ minutos: 2, segundos: 0 }) === 120000);

// ── Cómo se lee el reloj ──
check('cero es 0:00', formateaTiempo(0) === '0:00');
check('un minuto y un segundo', formateaTiempo(61000) === '1:01', formateaTiempo(61000));
check('nueve segundos llevan el cero delante', formateaTiempo(9000) === '0:09');
check('pasando de la hora aparece la hora', formateaTiempo(3661000) === '1:01:01', formateaTiempo(3661000));
check('no salen números negativos', formateaTiempo(-5000) === '0:00');

// ── El salto de fase del pomodoro ──
const AHORA = 1788000000000;

const finDeTrabajo = siguienteFasePomodoro({ faseDescanso: false, rondas: 2 }, AHORA, true);
check('al acabar el trabajo se pasa a descanso', finDeTrabajo.faseDescanso === true);
check('y se apunta la ronda', finDeTrabajo.rondas === 3);
check('encadenando, la fase nueva arranca sola', finDeTrabajo.arrancadoEn === AHORA);
check('con el reloj de la fase nueva a cero', finDeTrabajo.acumulado === 0);

const finDeDescanso = siguienteFasePomodoro({ faseDescanso: true, rondas: 3 }, AHORA, true);
check('al acabar el descanso se vuelve al trabajo', finDeDescanso.faseDescanso === false);
// Lo que uno cuenta al final del día son los ratos trabajados, no los
// descansos: si el descanso también sumara, cada pomodoro contaría dos.
check('el descanso NO suma una ronda', finDeDescanso.rondas === 3, 'rondas=' + finDeDescanso.rondas);

const aManoParado = siguienteFasePomodoro({ faseDescanso: false, rondas: 0 }, AHORA, false);
check('cambiando a mano con el reloj parado, la fase nueva no arranca',
  aManoParado.arrancadoEn === null);
check('pero el cambio de fase sí se hace', aManoParado.faseDescanso === true);
check('y la ronda se cuenta igual', aManoParado.rondas === 1);

const sinRondas = siguienteFasePomodoro({ faseDescanso: false }, AHORA, true);
check('un nodo sin rondas empieza a contarlas en uno', sinRondas.rondas === 1);

// ── Que el interruptor del encadenado se respete ──
// Es la única diferencia de comportamiento que pidió el usuario, y vive en una
// condición sola: si alguien la borra, el nodo vuelve a encadenar siempre.
check('el nodo mira item.autoCambio antes de encadenar',
  /modo === 'pomodoro' && item\.autoCambio !== false/.test(items));
check('y con el encadenado apagado se para al acabar la fase',
  /onUpdate\(\{ arrancadoEn: null, acumulado: duracion \}\)/.test(items));
check('hay un botón para cambiar de fase a mano',
  /const cambiaFase = \(\) => \{[\s\S]{0,240}siguienteFasePomodoro\(item, Date\.now\(\), enMarcha\)/.test(items));
check('y un interruptor que enciende y apaga el encadenado',
  /autoCambio: item\.autoCambio === false/.test(items));

// ── El tiempo se pone EN EL NODO, no en el menú de la izquierda ──
check('el reloj del nodo tiene sus dos casillas para escribir el tiempo',
  (items.match(/className="timer-num"/g) || []).length === 2);
check('el menú de la izquierda ya no tiene el panel de duración',
  !/timerDuracion/.test(ctx));
check('ni sus casillas de minutos y segundos',
  !/ctx-duracion/.test(ctx));

// ── La barra de arriba y su título ──
check('el nodo tiene barra superior con color',
  /className="timer-bar"/.test(items));
check('el título se guarda en su propio campo',
  /timerTitle: e\.target\.value/.test(items));
check('el título se edita desde el menú del nodo, como el del bloque de código',
  /Poner nombre al reloj/.test(ctx));
check('y la barra de texto (color, negrita, alineación) sale con él',
  /selectedItem\.type === 'timer'\) && selectedItem\._editingTitle/.test(canvas));
check('el fondo del nodo es semitransparente',
  /window\.conAlfa\(colorSolido, 0\.58\)/.test(items));

// ── Lo que trae un nodo recién puesto ──
check('nace encadenando solo, como un pomodoro de siempre',
  /autoCambio: true/.test(canvas));
check('y con el nombre vacío', /timerTitle: ''/.test(canvas));
check('con sitio para la barra y el interruptor',
  /type: 'timer', \.\.\.defaultSize\(260, 252\)/.test(canvas));

// ── El título no se puede perder al cerrar la barra de texto ──
//
// Los dos títulos se guardaban SOLO al perder el foco, y la barra de texto se
// cierra con su propia flecha: eso desmonta el campo sin que el navegador mande
// ningún blur, así que lo escrito se iba sin decir nada. Reproducido en la
// aplicación con los dos nodos antes de tocar el código.
check('el título del reloj se guarda según se escribe',
  /className="timer-title-input"[\s\S]{0,600}value=\{titulo\}[\s\S]{0,400}onChange=\{\(e\)=>onUpdate\(\{ timerTitle: e\.target\.value \}\)\}/.test(items));
check('y el del bloque de código también',
  /className="code-title-input"[\s\S]{0,600}value=\{titulo\}[\s\S]{0,400}onChange=\{\(e\)=>onUpdate\(\{ codeTitle: e\.target\.value \}\)\}/.test(items));
check('ninguno de los dos se queda esperando al blur',
  !/onBlur=\{\(e\)=>\{ onUpdate\(\{ (codeTitle|timerTitle): e\.target\.value \}\); \}\}/.test(items));

// ── Detalles de idioma ──
check('una ronda se dice en singular',
  /item\.rondas === 1 \? window\.t\('ronda', 'round'\)/.test(items));
check('la fila de la fase solo sale en el pomodoro',
  /\{modo === 'pomodoro' && \(\r?\n\s*<div className="timer-fase"/.test(items));

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo en orden.');
process.exit(fallos ? 1 : 0);
