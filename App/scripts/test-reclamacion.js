// =====================================================
// Odinote — pruebas de functions/reclamacion.js
//
//   node scripts/test-reclamacion.js
//
// Aquí se decide si alguien se queda con la corona de otro, así que las
// preguntas son dos y ninguna es de adorno:
//
//   1. ¿Deja pasar a quien no debe? Una donación ya reclamada, un importe que
//      no cuadra, una sesión sin correo: todo eso tiene que ser un no.
//
//   2. ¿Deja fuera a quien sí debe? Este es el que se olvida. La gente escribe
//      "3", "3,00" o "$3.00" para decir lo mismo, y si el programa exige una
//      forma concreta, el donante de verdad se queda sin su corona y encima
//      pensando que le han engañado.
// =====================================================

const path = require('path');
const R = require(path.join(__dirname, '..', '..', 'functions', 'reclamacion.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// Una donación tal cual la deja el aviso de Ko-fi.
const donacion = (extra) => Object.assign({
  nivel: 'apoyo',
  nombre: 'Ana',
  origen: 'kofi',
  importe: '5.00',
  moneda: 'USD',
}, extra || {});

// ── Lo mismo escrito de siete maneras ──
{
  const casos = [
    ['5', '5.00'],
    ['5.00', '5.00'],
    ['5,00', '5.00'],
    ['  5.00  ', '5.00'],
    ['$5.00', '5.00'],
    ['5.00 USD', '5.00'],
    ['1.234,56', '1234.56'],
    ['1,234.56', '1234.56'],
    [5, '5.00'],
    [3.5, '3.50'],
  ];
  for (const [entra, sale] of casos) {
    check(`"${entra}" se entiende como ${sale}`, R.normalizaImporte(entra) === sale,
      String(R.normalizaImporte(entra)));
  }

  for (const basura of ['', '   ', 'hola', null, undefined, {}, '-3']) {
    check(`no se traga ${JSON.stringify(basura)}`, R.normalizaImporte(basura) === null);
  }
}

// ── Quién NO puede reclamar ──
{
  check('una donación que no existe',
    R.evalua(null, 'otro@hotmail.com', '5.00', 'yo@gmail.com').motivo === 'no-existe');

  check('una que ya reclamó otro',
    R.evalua(donacion({ reclamadoPor: 'primero@gmail.com' }), 'otro@hotmail.com', '5.00', 'yo@gmail.com')
      .motivo === 'ya-reclamado');

  check('con el importe equivocado',
    R.evalua(donacion(), 'otro@hotmail.com', '3.00', 'yo@gmail.com').motivo === 'importe-no-cuadra');

  check('sin sesión de Google (sesión anónima, sin correo)',
    R.evalua(donacion(), 'otro@hotmail.com', '5.00', null).motivo === 'sin-sesion');

  check('reclamando el correo con el que ya has entrado',
    R.evalua(donacion(), 'yo@gmail.com', '5.00', 'yo@gmail.com').motivo === 'es-el-mismo');

  check('con un correo que no es un correo',
    R.evalua(donacion(), 'esto-no-vale', '5.00', 'yo@gmail.com').motivo === 'correo-invalido');

  check('sin decir cuánto pagó',
    R.evalua(donacion(), 'otro@hotmail.com', '', 'yo@gmail.com').motivo === 'importe-invalido');

  // Donaciones apuntadas antes de que se guardara el importe: no se pueden
  // comprobar, así que van por la vía manual en vez de colarse.
  check('una donación vieja sin importe guardado',
    R.evalua(donacion({ importe: null }), 'otro@hotmail.com', '5.00', 'yo@gmail.com')
      .motivo === 'sin-importe');
}

// ── Quién SÍ puede ──
{
  const v = R.evalua(donacion(), 'otro@hotmail.com', '5.00', 'yo@gmail.com');
  check('el correo y el importe correctos', v.ok === true, v.motivo);
  check('devuelve los dos correos ya normalizados',
    v.correo === 'otro@hotmail.com' && v.mio === 'yo@gmail.com');

  check('da igual cómo escriba el importe (5 en vez de 5.00)',
    R.evalua(donacion(), 'otro@hotmail.com', '5', 'yo@gmail.com').ok === true);

  check('da igual la coma decimal (5,00)',
    R.evalua(donacion(), 'otro@hotmail.com', '5,00', 'yo@gmail.com').ok === true);

  check('da igual si copia el símbolo de la moneda ($5.00)',
    R.evalua(donacion(), 'otro@hotmail.com', '$5.00', 'yo@gmail.com').ok === true);

  check('da igual cómo escriba el correo (mayúsculas y espacios)',
    R.evalua(donacion(), '  Otro@Hotmail.COM ', '5.00', 'YO@gmail.com').ok === true);

  // Hotmail, Yahoo, el que sea: aquí no se mira el proveedor de nadie.
  for (const correo of ['a@hotmail.com', 'b@yahoo.es', 'c@proton.me', 'd@empresa.com.co']) {
    check(`vale un correo de ${correo.split('@')[1]}`,
      R.evalua(donacion(), correo, '5.00', 'yo@gmail.com').ok === true);
  }
}

console.log('');
console.log(fallos === 0 ? 'Todo en orden.' : fallos + ' fallo(s).');
process.exit(fallos === 0 ? 0 : 1);
