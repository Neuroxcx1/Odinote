// =====================================================
// Odinote — pruebas de src/realtime.js (las salas en vivo).
//
//   node scripts/test-sala.js
//
// Dos preguntas, y las dos vienen de averías que se vieron de verdad:
//
//   1. ¿Un lector puede colar cambios? La respuesta tiene que ser que no
//      aunque su copia del programa esté trucada, porque la decisión se toma
//      en el equipo del anfitrión y no en el suyo.
//
//   2. ¿Se atiende el papel correcto cuando alguien lo intenta dos veces?
//      Contestar a la oferta vieja dejaba al otro esperando para siempre, y
//      eso salía en pantalla como "la otra persona no respondió a tiempo".
//
// El apretón de manos entero necesita dos navegadores y no cabe aquí, así que
// lo que se prueba son las dos piezas donde estaba el fallo, tal cual las usa
// el programa.
// =====================================================

const path = require('path');
const R = require(path.join(__dirname, '..', 'src', 'realtime.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// ── Quién puede tocar el lienzo ──
{
  check('un editor edita', R.puedeEditar({ uid: 'a', rol: 'editor' }) === true);
  check('un lector no edita', R.puedeEditar({ uid: 'b', rol: 'lector' }) === false);
  check('el anfitrión edita siempre, le pongas el papel que le pongas',
    R.puedeEditar({ uid: 'c', rol: 'lector', anfitrion: true }) === true);
  check('sin papel escrito se asume editor (es como entraba todo el mundo antes)',
    R.puedeEditar({ uid: 'd' }) === true);
  // Quien ya no está en la lista es quien acaba de ser expulsado: sus últimos
  // mensajes pueden llegar cuando ya se le ha cerrado la puerta.
  check('quien no está en la sala no edita', R.puedeEditar(null) === false);
  check('quien no está en la sala no edita (sin ficha)', R.puedeEditar(undefined) === false);
}

// ── El orden de los papeles del apretón de manos ──
{
  const papeles = [
    { id: 'c2', tipo: 'candidato', de: 'movil', creadaEn: 300 },
    { id: 'o1', tipo: 'oferta', de: 'movil', creadaEn: 100 },
    { id: 'c1', tipo: 'candidato', de: 'movil', creadaEn: 200 },
  ];
  const orden = R.ordenaYFiltra(papeles).map(p => p.id);
  check('se atienden en el orden en que se escribieron, no como los dé Firestore',
    orden.join(',') === 'o1,c1,c2', orden.join(','));
}

{
  // El caso que rompía el móvil: se intenta entrar, no sale, y se vuelve a
  // intentar sin cerrar nada. En la sala quedan las DOS ofertas.
  const papeles = [
    { id: 'vieja', tipo: 'oferta', de: 'movil', creadaEn: 1000 },
    { id: 'nueva', tipo: 'oferta', de: 'movil', creadaEn: 2000 },
  ];
  const salida = R.ordenaYFiltra(papeles);
  const vieja = salida.find(p => p.id === 'vieja');
  const nueva = salida.find(p => p.id === 'nueva');
  check('de dos intentos de la misma persona solo vale el último',
    vieja.rancia === true && nueva.rancia === false);
}

{
  // Y no confundir a dos personas distintas: que uno reintente no puede tirar
  // la oferta buena del otro.
  const papeles = [
    { id: 'movil-1', tipo: 'oferta', de: 'movil', creadaEn: 1000 },
    { id: 'portatil', tipo: 'oferta', de: 'portatil', creadaEn: 1500 },
    { id: 'movil-2', tipo: 'oferta', de: 'movil', creadaEn: 2000 },
  ];
  const salida = R.ordenaYFiltra(papeles);
  const rancias = salida.filter(p => p.rancia).map(p => p.id);
  check('la oferta de otra persona no se descarta por el camino',
    rancias.length === 1 && rancias[0] === 'movil-1', rancias.join(',') || 'ninguna');
}

{
  // Las respuestas y los candidatos no se filtran nunca: hacen falta todos, y
  // los que sobran ya los descarta la etiqueta del intento.
  const papeles = [
    { id: 'r1', tipo: 'respuesta', de: 'anfitrion', creadaEn: 10 },
    { id: 'r2', tipo: 'respuesta', de: 'anfitrion', creadaEn: 20 },
    { id: 'k1', tipo: 'candidato', de: 'anfitrion', creadaEn: 30 },
  ];
  check('respuestas y candidatos pasan todos',
    R.ordenaYFiltra(papeles).every(p => !p.rancia));
}

{
  check('sin papeles no revienta', R.ordenaYFiltra([]).length === 0 && R.ordenaYFiltra(null).length === 0);
  // Un papel sin fecha (escrito por una versión vieja) no puede colarse
  // delante y desordenar al resto.
  const orden = R.ordenaYFiltra([
    { id: 'b', tipo: 'candidato', de: 'x', creadaEn: 5 },
    { id: 'a', tipo: 'candidato', de: 'x' },
  ]).map(p => p.id);
  check('un papel sin fecha va el primero y no estorba', orden.join(',') === 'a,b', orden.join(','));
}

// ── Los papeles que se reparten ──
{
  check('solo hay dos papeles, editor y lector',
    Array.isArray(R.ROLES) && R.ROLES.length === 2 &&
    R.ROLES.indexOf('editor') >= 0 && R.ROLES.indexOf('lector') >= 0);
}

console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} prueba(s) fallidas.`);
process.exit(fallos === 0 ? 0 : 1);
