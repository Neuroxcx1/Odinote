// =====================================================
// Odinote — pruebas de src/nube.js (modo instantáneo).
//
//   node scripts/test-nube.js
//
// La pregunta que importa, y es la misma que hundió a la versión anterior de
// este código: cuando llega algo del otro lado, ¿se pierde algo mío?
//
// La respuesta tiene que ser que no en tres frentes: mis OTROS proyectos ni se
// tocan, lo que yo acabo de escribir no se deshace, y lo que sube lleva
// solamente el proyecto compartido y no el resto de mi trabajo.
// =====================================================

const path = require('path');
const N = require(path.join(__dirname, '..', 'src', 'nube.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};
const copia = (o) => JSON.parse(JSON.stringify(o));

// Un estado como el de verdad: el proyecto compartido, un tablero suyo, y
// OTRO proyecto que es solo mío y que no pinta nada en todo esto.
const estado = () => ({
  compartido: {
    title: { es: 'Compartido', en: 'Shared' },
    items: [
      { id: 'n1', type: 'note', x: 10, y: 10, content: { es: 'hola', en: 'hi' } },
      { id: 'n2', type: 'note', x: 200, y: 10, content: { es: 'dos', en: 'two' } },
      { id: 'b1', type: 'board', canvasId: 'tablero' },
    ],
    connectors: [],
  },
  tablero: { title: { es: 'Dentro', en: 'Inside' }, items: [], connectors: [] },
  miProyecto: {
    title: { es: 'Solo mío', en: 'Mine only' },
    items: [{ id: 'secreto', type: 'note', content: { es: 'privado', en: 'private' } }],
    connectors: [],
  },
});

// ── Lo que se sube ──
{
  const todo = estado();
  const subo = N.soloDelProyecto(todo, 'compartido');
  check('sube el proyecto y los tableros que cuelgan de él',
    !!subo.compartido && !!subo.tablero);
  check('NO sube mis otros proyectos', subo.miProyecto === undefined,
    Object.keys(subo).join(','));
  check('sin raíz no sube nada', Object.keys(N.soloDelProyecto(todo, null)).length === 0);
}

// ── El tope de tamaño ──
{
  const pequeno = estado();
  check('un proyecto normal cabe de sobra', N.cabe(pequeno), N.pesa(pequeno) + ' bytes');

  const gordo = { c: { title: {}, connectors: [], items: [
    { id: 'x', type: 'note', content: { es: 'a'.repeat(1000000), en: '' } },
  ] } };
  check('uno que se pasa del mega se detecta antes de subirlo', !N.cabe(gordo));
}

// ── Recibir sin pisar: LO IMPORTANTE ──
{
  // El otro cambia la nota n1. Yo, mientras, he escrito en n2 y no se lo he
  // mandado todavía. Al llegar su cambio tienen que sobrevivir los dos.
  const mios = estado();
  mios.compartido = { ...mios.compartido, items: mios.compartido.items.map(
    i => i.id === 'n2' ? { ...i, content: { es: 'MI TEXTO NUEVO', en: '' } } : i) };

  const ultimoRemoto = N.soloDelProyecto(estado(), 'compartido');   // la foto que ya vi
  const remoto = copia(ultimoRemoto);
  remoto.compartido.items = remoto.compartido.items.map(
    i => i.id === 'n1' ? { ...i, x: 999 } : i);

  const r = N.fusiona({ locales: mios, ultimoRemoto, remoto, raiz: 'compartido' });
  const n1 = r.lienzos.compartido.items.find(i => i.id === 'n1');
  const n2 = r.lienzos.compartido.items.find(i => i.id === 'n2');

  check('llega el cambio del otro', n1.x === 999);
  check('y NO se deshace lo que yo acababa de escribir',
    n2.content.es === 'MI TEXTO NUEVO', n2.content.es);
  check('mi otro proyecto sigue intacto',
    r.lienzos.miProyecto.items[0].content.es === 'privado');
}

{
  // El caso que borraba discos: llega una foto que solo contiene el proyecto
  // compartido. Ni se roza el resto del estado.
  const mios = estado();
  const remoto = N.soloDelProyecto(estado(), 'compartido');
  const r = N.fusiona({ locales: mios, ultimoRemoto: remoto, remoto, raiz: 'compartido' });
  check('una foto sin cambios no toca nada', r.cambio === false && r.lienzos === mios);
  check('y mis otros proyectos siguen ahí', !!r.lienzos.miProyecto);
}

{
  // Primera vez, sin foto anterior: te pones al día con lo que hay.
  const mios = estado();
  const remoto = copia(N.soloDelProyecto(estado(), 'compartido'));
  remoto.compartido.items.push({ id: 'n3', type: 'note', content: { es: 'del otro', en: '' } });

  const r = N.fusiona({ locales: mios, ultimoRemoto: null, remoto, raiz: 'compartido' });
  check('sin foto anterior se adopta lo que hay en el servidor',
    !!r.lienzos.compartido.items.find(i => i.id === 'n3'));
  check('y aun así mis otros proyectos no se tocan', !!r.lienzos.miProyecto);
}

{
  // Borrar también viaja: si el otro tira una nota, aquí desaparece.
  const mios = estado();
  const ultimoRemoto = N.soloDelProyecto(estado(), 'compartido');
  const remoto = copia(ultimoRemoto);
  remoto.compartido.items = remoto.compartido.items.filter(i => i.id !== 'n1');

  const r = N.fusiona({ locales: mios, ultimoRemoto, remoto, raiz: 'compartido' });
  check('lo que el otro borra, se borra aquí',
    !r.lienzos.compartido.items.find(i => i.id === 'n1'));
  check('pero solo eso', !!r.lienzos.compartido.items.find(i => i.id === 'n2'));
}

// ── Cuándo hay que subir ──
{
  const a = N.soloDelProyecto(estado(), 'compartido');
  check('sin nada acordado antes, se sube', N.hayQueSubir(a, null) === true);
  check('si no ha cambiado nada, no se sube', N.hayQueSubir(a, copia(a)) === false);
  const b = copia(a);
  b.compartido.items[0].x = 77;
  check('si cambió algo, se sube', N.hayQueSubir(b, a) === true);
}

// ── Quién puede entrar ──
{
  const proy = { collaborators: [{ id: 'Amiga@Gmail.com' }, { id: 'otro@gmail.com' }] };
  const c = N.correosDe(proy, 'Dueno@Gmail.com');
  check('el dueño va el primero y todo en minúsculas',
    c[0] === 'dueno@gmail.com' && c.indexOf('amiga@gmail.com') > 0, c.join(','));
  check('no se repiten', N.correosDe({ collaborators: [{ id: 'a@b.c' }] }, 'a@b.c').length === 1);
  check('sin colaboradores queda solo el dueño', N.correosDe({}, 'x@y.z').length === 1);
  check('sin nada no revienta', N.correosDe(null, null).length === 0);
}

console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} prueba(s) fallidas.`);
process.exit(fallos === 0 ? 0 : 1);
