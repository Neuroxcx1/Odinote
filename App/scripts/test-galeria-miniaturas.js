// Pruebas de las miniaturas de la galería.  node scripts/test-galeria-miniaturas.js
//
// Si el tamaño se calcula corto, las fotos se ven borrosas; si se calcula
// largo, vuelve la galería lenta que había antes. Ninguna de las dos cosas se
// nota en una galería de cuatro fotos, así que se cuentan aquí.
const M = require('../src/galeria-miniaturas.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// ── Qué lado hace falta ──
const captura = { w: 1600, h: 900 };
check('una celda pequeña de la rejilla pide la copia más pequeña', M.ladoPara(captura, 70, 50, 1) === 160, M.ladoPara(captura, 70, 50, 1));
// 1600x900 cubriendo una caja de 70x70: la recorta por los lados y hace falta
// que su alto llegue a 70, o sea, 124 de largo.
check('cubrir una caja cuadrada cuenta el recorte', M.ladoPara(captura, 70, 70, 1) === 160);
// Una foto muy apaisada en una caja cuadrada necesita mucho más de largo.
const tira = { w: 1600, h: 400 };
check('una foto muy apaisada pide más para cubrir', M.ladoPara(tira, 60, 60, 1) === 320, M.ladoPara(tira, 60, 60, 1));
check('la pila (260 px) pide la de 320', M.ladoPara(captura, 260, 146, 1) === 320, M.ladoPara(captura, 260, 146, 1));
check('con zoom al doble pide la siguiente', M.ladoPara(captura, 260, 146, 2) === 640, M.ladoPara(captura, 260, 146, 2));
check('con una pantalla de más densidad también', M.ladoPara(captura, 260, 146, 1.5) === 640);
check('si hace falta más que la copia más grande, la foto de siempre', M.ladoPara(captura, 900, 600, 2) === 0);
check('una foto que ya es pequeña no se copia', M.ladoPara({ w: 300, h: 200 }, 250, 160, 1) === 0);
check('pero si la caja es mucho más pequeña, sí', M.ladoPara({ w: 900, h: 600 }, 60, 40, 1) === 160);
check('sin medidas pide algo de sobra', M.ladoPara({}, 100, 80, 1) === 160 && M.ladoPara({}, 120, 80, 1) === 320);
check('con zoom muy alejado se queda en la más pequeña', M.ladoPara(captura, 260, 146, 0.2) === 160);

// ── El zoom redondeado ──
check('zoom 1 se queda en 1', M.escalaRedonda(1) === 1);
check('redondea hacia arriba (nunca borroso)', M.escalaRedonda(1.05) >= 1.05 && M.escalaRedonda(1.05) < 1.25);
check('pasos pequeños del zoom caen en el mismo escalón', M.escalaRedonda(1.05) === M.escalaRedonda(1.15));
check('con topes', M.escalaRedonda(100) === 8 && M.escalaRedonda(0.001) === 0.125 && M.escalaRedonda(0) === 1);

// ── La clave ──
check('un src corto es su propia clave', M.clave('media/galeria_f-1_abc.webp') === 'media/galeria_f-1_abc.webp');
const grande = 'data:image/webp;base64,' + 'A'.repeat(50000) + 'B'.repeat(50000);
const otra = 'data:image/webp;base64,' + 'A'.repeat(50000) + 'C'.repeat(50000);
check('una data: URL se resume', M.clave(grande).length < 40, M.clave(grande));
check('y dos distintas no chocan', M.clave(grande) !== M.clave(otra));
check('y la misma da lo mismo', M.clave(grande) === M.clave(grande.slice()));
check('una foto con id se guarda por su id', M.claveDe({ id: 'f-1', src: grande }) === 'f:f-1');
check('y sigue igual cuando pasa a la bóveda', M.claveDe({ id: 'f-1', src: 'media/galeria_f-1_abc.webp' }) === M.claveDe({ id: 'f-1', src: grande }));
check('sin id, por su src', M.claveDe({ src: 'https://x/y.jpg' }) === 'https://x/y.jpg');

// ── Qué copia pintar mientras ──
const hechas = new Map([[160, 'a'], [640, 'c']]);
check('la más pequeña que llegue', JSON.stringify(M.eligeHecha(hechas, 320)) === JSON.stringify({ lado: 640, basta: true }));
check('la justa si está', M.eligeHecha(hechas, 160).lado === 160);
check('si ninguna llega, la más grande mientras tanto', JSON.stringify(M.eligeHecha(hechas, 1280)) === JSON.stringify({ lado: 640, basta: false }));
check('sin ninguna, nada', M.eligeHecha(new Map(), 320) === null);

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
