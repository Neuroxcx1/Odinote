// Que recortar una imagen no la deforme.  node scripts/test-recorte-logica.js
const R = require('../src/recorte-logica.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};
const casi = (a, b) => Math.abs(a - b) < 0.01;

// Una foto 4:3 sin recortar, en una caja 400x300.
{
  const it = { x: 100, y: 50, w: 400, h: 300, naturalRatio: 4 / 3 };
  const f = R.abre(it);
  check('sin recorte, la caja de la foto entera es la misma', casi(f.x, 100) && casi(f.y, 50) && casi(f.w, 400) && casi(f.h, 300), JSON.stringify(f));
  // Se elige la mitad izquierda: la caja final es 200x300 en el mismo sitio.
  const fin = R.cierra(f, { x: 0, y: 0, w: 50, h: 100 });
  check('recortar la mitad izquierda deja 200x300', casi(fin.x, 100) && casi(fin.w, 200) && casi(fin.h, 300), JSON.stringify(fin));
  // Y la forma de la caja es la de esa parte de la foto (2:3): nada deformado.
  check('la caja tiene la forma de la parte elegida', casi(fin.w / fin.h, (4 / 3) * 0.5 / 1), (fin.w / fin.h).toFixed(3));
}

// Una foto ya recortada (cuadrado central de una 2:1) que alguien estiró.
{
  const it = { x: 0, y: 0, w: 300, h: 200, naturalRatio: 2, crop: { x: 25, y: 0, w: 50, h: 100 } };
  const f = R.abre(it);
  // Ancho entero = 300 / 0.5 = 600; alto con su forma de verdad = 300.
  check('al abrir, la foto entera sale con su forma (2:1)', casi(f.w, 600) && casi(f.h, 300), JSON.stringify(f));
  check('y la zona recortada se queda donde estaba', casi(f.x + 0.25 * f.w, 0) && casi(f.y, 0), JSON.stringify(f));
  const fin = R.cierra(f, it.crop);
  check('salir sin tocar nada le quita la deformación', casi(fin.w, 300) && casi(fin.h, 300), JSON.stringify(fin));
}

// Sin naturalRatio: se usa la de la caja y no se mueve nada.
{
  const it = { x: 10, y: 10, w: 200, h: 100, crop: { x: 0, y: 0, w: 100, h: 100 } };
  const f = R.abre(it);
  check('sin saber la forma de la foto, la caja no cambia', casi(f.w, 200) && casi(f.h, 100) && casi(f.x, 10));
}

// Un recorte roto o vacío se trata como la foto entera.
check('recorte vacío = foto entera', JSON.stringify(R.recorteDe({ crop: { x: 0, y: 0, w: 0, h: 0 } })) === JSON.stringify({ x: 0, y: 0, w: 100, h: 100 }));
check('redondear no baja de 8 px', R.redondea({ x: 1.4, y: 2.6, w: 2, h: 100.4 }).w === 8);

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
