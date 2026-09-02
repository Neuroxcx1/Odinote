// =====================================================
// Odinote — pruebas de functions/reclamacion.js
//
//   node scripts/test-reclamacion.js
//
// Aquí se decide si alguien se queda con la corona de otro, así que las
// preguntas son dos y ninguna es de adorno:
//
//   1. ¿Deja pasar a quien no debe? Una donación ya reclamada, una sesión sin
//      correo, el correo con el que ya has entrado: todo eso tiene que ser un
//      no.
//
//   2. ¿Deja fuera a quien sí debe? Este es el que se olvida, y es el que hizo
//      que se quitara el importe: la gente escribe su correo con mayúsculas o
//      con un espacio pegado al final, y su donación puede ser de las viejas,
//      apuntadas cuando ni se guardaba cuánto se pagó.
//
// El importe ya no entra en la decisión, pero `normalizaImporte` sigue vivo:
// es lo que deja el aviso de Ko-fi guardado en la ficha, y ahí sí importa que
// "3", "3,00" y "$3.00" acaben siendo lo mismo.
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
    R.evalua(null, 'otro@hotmail.com', 'yo@gmail.com').motivo === 'no-existe');

  check('una que ya reclamó otro',
    R.evalua(donacion({ reclamadoPor: 'primero@gmail.com' }), 'otro@hotmail.com', 'yo@gmail.com')
      .motivo === 'ya-reclamado');

  check('sin sesión de Google (sesión anónima, sin correo)',
    R.evalua(donacion(), 'otro@hotmail.com', null).motivo === 'sin-sesion');

  check('reclamando el correo con el que ya has entrado',
    R.evalua(donacion(), 'yo@gmail.com', 'yo@gmail.com').motivo === 'es-el-mismo');

  check('con un correo que no es un correo',
    R.evalua(donacion(), 'esto-no-vale', 'yo@gmail.com').motivo === 'correo-invalido');

  check('sin decir ningún correo',
    R.evalua(donacion(), '', 'yo@gmail.com').motivo === 'correo-invalido');

  check('una barra dentro del correo (partiría la ruta de Firestore)',
    R.evalua(donacion(), 'a/b@hotmail.com', 'yo@gmail.com').motivo === 'correo-invalido');
}

// ── Quién SÍ puede ──
{
  const v = R.evalua(donacion(), 'otro@hotmail.com', 'yo@gmail.com');
  check('el correo de la donación, sin más', v.ok === true, v.motivo);
  check('devuelve los dos correos ya normalizados',
    v.correo === 'otro@hotmail.com' && v.mio === 'yo@gmail.com');

  check('da igual cómo escriba el correo (mayúsculas y espacios)',
    R.evalua(donacion(), '  Otro@Hotmail.COM ', 'YO@gmail.com').ok === true);

  // Las de antes de que se guardara el importe. Con la regla vieja se
  // quedaban fuera por un dato que no era culpa de quien pagó.
  check('una donación vieja, sin importe guardado',
    R.evalua(donacion({ importe: null }), 'otro@hotmail.com', 'yo@gmail.com').ok === true);

  // Y el importe ya no decide nada: está en la ficha como apunte, pero
  // reclamar no lo mira.
  check('el importe guardado ya no hace de contraseña',
    R.evalua(donacion({ importe: '999.00' }), 'otro@hotmail.com', 'yo@gmail.com').ok === true);

  // Hotmail, Yahoo, el que sea: aquí no se mira el proveedor de nadie.
  for (const correo of ['a@hotmail.com', 'b@yahoo.es', 'c@proton.me', 'd@empresa.com.co']) {
    check(`vale un correo de ${correo.split('@')[1]}`,
      R.evalua(donacion(), correo, 'yo@gmail.com').ok === true);
  }
}

console.log('');
console.log(fallos === 0 ? 'Todo en orden.' : fallos + ' fallo(s).');
process.exit(fallos === 0 ? 0 : 1);
