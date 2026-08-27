// =====================================================
// Odinote — pruebas de src/draw.js (nodo de dibujo).
//
//   node scripts/test-draw.js
//
// La pregunta que más importa aquí no es si la línea sale bonita, sino si un
// trazo hecho a mano —que llega con miles de puntos— se guarda en el proyecto
// sin hincharlo. Eso, el grosor por presión/velocidad y el acierto del
// borrador se pueden comprobar enteros sin navegador.
// =====================================================

const path = require('path');
const OdiDraw = require(path.join(__dirname, '..', 'src', 'draw.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// ── Simplificación ──
{
  // Una recta con 500 puntos intermedios debe quedar en dos.
  const recta = [];
  for (let i = 0; i <= 500; i++) recta.push([i, 0, 1]);
  const simple = OdiDraw.simplify(recta, 0.6);
  check('una recta larga se reduce a sus extremos', simple.length === 2, `${recta.length} → ${simple.length}`);

  // Un garabato real: muchos puntos, forma que hay que conservar.
  const garabato = [];
  for (let i = 0; i <= 2000; i++) {
    const t = i / 40;
    garabato.push([t * 3, Math.sin(t) * 50, 1]);
  }
  const reducido = OdiDraw.simplify(garabato, 0.6);
  check('un garabato pierde la mayoría de puntos', reducido.length < garabato.length / 10,
    `${garabato.length} → ${reducido.length}`);
  check('el garabato conserva sus extremos',
    reducido[0][0] === garabato[0][0] &&
    reducido[reducido.length - 1][0] === garabato[garabato.length - 1][0]);

  // La forma no se destroza: ningún punto original queda lejos de la versión corta.
  let peor = 0;
  const dist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  garabato.forEach(p => {
    let d = Infinity;
    for (let i = 0; i < reducido.length - 1; i++) d = Math.min(d, dist(p, reducido[i], reducido[i + 1]));
    peor = Math.max(peor, d);
  });
  check('la forma simplificada no se aleja del trazo original', peor <= 0.7, `desvío máximo ${peor.toFixed(3)} px`);
}

// ── Lo que acaba guardado ──
{
  const pts = [];
  for (let i = 0; i <= 3000; i++) pts.push([i * 0.1 + Math.random() * 0.05, Math.sin(i / 30) * 20, 1]);
  const guardado = OdiDraw.finishStroke({ id: 's1', color: '#E6544F', width: 4, pts });
  const bytes = JSON.stringify(guardado).length;
  check('un trazo de 3000 puntos ocupa poco al guardarse', bytes < 12000, `${bytes} bytes`);
  check('las coordenadas guardadas van redondeadas',
    guardado.pts.every(p => String(p[0]).replace(/^-?\d+\.?/, '').length <= 1));

  const clic = OdiDraw.finishStroke({ id: 's2', color: '#000', width: 4, pts: [[10, 10, 1]] });
  check('un clic suelto se guarda como punto de tinta', clic && clic.pts.length === 2);

  check('un trazo vacío no se guarda', OdiDraw.finishStroke({ id: 's3', pts: [] }) === null);
}

// ── Grosor ──
{
  check('sin presión declarada se asume un trazo medio',
    Math.abs(OdiDraw.factorFromPressure(0) - OdiDraw.factorFromPressure(0.5)) < 0.0001);
  check('más presión, más grosor', OdiDraw.factorFromPressure(1) > OdiDraw.factorFromPressure(0.2));
  check('el grosor por presión nunca se sale del rango',
    OdiDraw.factorFromPressure(1) <= OdiDraw.MAX_F && OdiDraw.factorFromPressure(0.01) >= OdiDraw.MIN_F);

  check('ir despacio engorda la línea', OdiDraw.factorFromSpeed(0.05) > OdiDraw.factorFromSpeed(2));
  check('ir muy rápido no adelgaza hasta desaparecer', OdiDraw.factorFromSpeed(50) >= OdiDraw.MIN_F);

  // El modo uniforme ignora todo lo demás.
  const f = OdiDraw.factorFor('uniform', { x: 0, y: 0, t: 0, pressure: 1 }, null, null);
  check('el modo uniforme mantiene el grosor', f === 1);

  // Con el ratón (presión 0.5 siempre) el modo velocidad sí distingue.
  const lento = OdiDraw.factorFor('speed', { x: 1, y: 0, t: 100, pressure: 0.5 }, { x: 0, y: 0, t: 0 }, null);
  const rapido = OdiDraw.factorFor('speed', { x: 60, y: 0, t: 100, pressure: 0.5 }, { x: 0, y: 0, t: 0 }, null);
  check('con ratón, la velocidad cambia el grosor', lento > rapido, `${lento.toFixed(2)} vs ${rapido.toFixed(2)}`);
}

// ── Trazado SVG ──
{
  const uniforme = { id: 'a', width: 4, pts: [[0, 0, 1], [10, 10, 1], [20, 0, 1]] };
  const g1 = OdiDraw.strokeGeometry(uniforme);
  check('un trazo de grosor constante se pinta como línea', g1.mode === 'line');
  check('la línea empieza en el primer punto', g1.d.startsWith('M 0 0'));

  const variable = { id: 'b', width: 6, pts: [[0, 0, 0.4], [10, 10, 1.1], [20, 0, 0.5]] };
  const g2 = OdiDraw.strokeGeometry(variable);
  check('un trazo de grosor variable se pinta como contorno relleno', g2.mode === 'fill');
  check('el contorno se cierra', g2.d.trim().endsWith('Z'));
  check('el contorno tiene ida y vuelta', (g2.d.match(/L /g) || []).length >= 5);

  check('un trazo sin puntos no produce dibujo', OdiDraw.strokeGeometry({ id: 'c', pts: [] }) === null);
}

// ── Medidas y movimiento ──
{
  const strokes = [
    { id: 'a', width: 4, pts: [[10, 10, 1], [50, 30, 1]] },
    { id: 'b', width: 4, pts: [[-5, 60, 1], [20, 80, 1]] },
  ];
  const b = OdiDraw.strokesBounds(strokes);
  check('la caja envuelve todos los trazos', b.x <= -5 && b.y <= 10 && b.x + b.w >= 50 && b.y + b.h >= 80,
    `x=${b.x.toFixed(1)} y=${b.y.toFixed(1)} w=${b.w.toFixed(1)} h=${b.h.toFixed(1)}`);
  check('la caja deja sitio al grosor de la línea', b.x < -5 && b.y < 10);
  check('sin trazos no hay caja', OdiDraw.strokesBounds([]) === null);

  const movido = OdiDraw.translateStrokes(strokes, 100, -10);
  check('mover desplaza todos los puntos', movido[0].pts[0][0] === 110 && movido[0].pts[0][1] === 0);
  check('mover no toca el original', strokes[0].pts[0][0] === 10);
}

// ── Borrador / selección ──
{
  const strokes = [
    { id: 'fondo', width: 4, pts: [[0, 0, 1], [100, 0, 1]] },
    { id: 'encima', width: 4, pts: [[50, -20, 1], [50, 20, 1]] },
  ];
  check('acierta el trazo bajo el puntero', OdiDraw.hitTest(strokes, 20, 1, 2) === 'fondo');
  check('donde se cruzan, gana el de encima', OdiDraw.hitTest(strokes, 50, 0, 2) === 'encima');
  check('lejos de todo no acierta nada', OdiDraw.hitTest(strokes, 300, 300, 2) === null);
  check('el grosor de la línea cuenta para acertarla',
    OdiDraw.hitStroke({ id: 'x', width: 30, pts: [[0, 0, 1], [100, 0, 1]] }, 50, 12, 0));
}

console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} prueba(s) fallidas.`);
process.exit(fallos === 0 ? 0 : 1);
