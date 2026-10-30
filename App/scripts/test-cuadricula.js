// Que el imán de la cuadrícula pegue bien.  node scripts/test-cuadricula.js
const C = require('../src/cuadricula.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};
const memoria = () => { const d = {}; return { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, d }; };

// ── Ajustes ──
check('sin nada guardado: imán apagado y el paso de siempre', JSON.stringify(C.lee(memoria())) === JSON.stringify({ iman: false, paso: 22 }));
check('un paso fuera de rango se recorta', C.limpia({ paso: 3 }).paso === C.PASO_MIN && C.limpia({ paso: 500 }).paso === C.PASO_MAX);
check('basura en vez de paso: el de siempre', C.limpia({ paso: 'hola' }).paso === 22 && C.limpia({ paso: -4 }).paso === 22);
check('el imán solo se enciende con true', C.limpia({ iman: 'si' }).iman === false && C.limpia({ iman: true }).iman === true);
{
  const m = memoria();
  m.setItem(C.CLAVE, '{esto no es json');
  check('un guardado roto no rompe la lectura', C.lee(m).paso === 22);
}
{
  const m = memoria();
  C.guarda({ iman: true }, m);
  const tras = C.guarda({ paso: 40 }, m);
  check('guardar un ajuste respeta el otro', tras.iman === true && tras.paso === 40, JSON.stringify(tras));
  check('y queda escrito', JSON.parse(m.d[C.CLAVE]).paso === 40);
}

// ── Cuándo pega ──
check('con el imán encendido pega', C.activa({ iman: true }, {}) === true);
check('Alt lo suelta mientras se mantiene', C.activa({ iman: true }, { altKey: true }) === false);
check('apagado no pega', C.activa({ iman: false }, {}) === false);

// ── Mover ──
check('redondea al punto más cercano', C.pega(33, 22) === 44 && C.pega(32, 22) === 22 && C.pega(-12, 22) === -22);

// ── Estirar ──
{
  // Un nodo en x=44, 200 de ancho: el borde derecho en 244. Tirando 10 a la
  // derecha (254) cae en 264, el punto más cercano.
  const r = C.estiraLado('r', { p: 44, t: 200 }, 10, 22, 100);
  check('estirar por la derecha deja el borde en la cuadrícula', r.p === 44 && r.t === 220, JSON.stringify(r));
  // Por la izquierda: el borde derecho (244) no se mueve.
  const l = C.estiraLado('l', { p: 44, t: 200 }, -30, 22, 100);
  check('por la izquierda el otro borde se queda quieto', l.p === 22 && l.p + l.t === 244, JSON.stringify(l));
  // Encoger más allá del mínimo: se queda en el mínimo, no se da la vuelta.
  const min = C.estiraLado('r', { p: 44, t: 200 }, -190, 22, 100);
  check('no baja del mínimo', min.t === 100, JSON.stringify(min));
  const minL = C.estiraLado('t', { p: 0, t: 120 }, 100, 22, 50);
  check('ni por arriba', minL.t === 50 && minL.p + minL.t === 120, JSON.stringify(minL));
}

// ── El fondo ──
{
  // Con el paso de siempre tiene que salir el mismo dibujo que tenía styles.css.
  const css = require('fs').readFileSync(require('path').join(__dirname, '../src/styles.css'), 'utf8');
  const claro = C.fondo(22, false), oscuro = C.fondo(22, true);
  check('a 22 el fondo claro es el de siempre', css.includes(claro.replace(/^url\("|"\)$/g, '')), claro);
  check('y el oscuro también', css.includes(oscuro.replace(/^url\("|"\)$/g, '')), oscuro);
  check('a 40 el triángulo va en el centro y no crece', C.fondo(40, false).includes("width='40'") && C.fondo(40, false).includes('M20 18.5L21.6 21.3H18.4Z'));
}

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
