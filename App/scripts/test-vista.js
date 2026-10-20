// =====================================================
// Oddinote — pruebas de src/vista.js (el enlace para ver).
//
//   node scripts/test-vista.js
//
// Lo que importa: que el enlace lleve SOLO ese proyecto (ni los demás, ni lo
// que es del disco de quien comparte), que su llave no se pueda adivinar, y
// que el enlace se lea igual venga como venga.
// =====================================================

const path = require('path');
const V = require(path.join(__dirname, '..', 'src', 'vista.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// ── La llave ──
{
  const ids = new Set();
  for (let i = 0; i < 2000; i++) ids.add(V.idNuevo());
  const uno = V.idNuevo();
  check('el id tiene 22 letras y números', /^[A-Za-z0-9]{22}$/.test(uno), uno);
  check('2000 ids, ninguno repetido', ids.size === 2000);
  // Con un azar que siempre da lo mismo sale siempre lo mismo (las pruebas de
  // la app lo usan), y los bytes que se tiran no lo dejan colgado.
  let k = 0;
  const fijo = () => [0.99, 0.5, 0.1][k++ % 3];
  const a = V.idNuevo(fijo);
  check('con un azar fijo no se cuelga aunque toque bytes que se tiran', /^[A-Za-z0-9]{22}$/.test(a), a);
}

// ── El enlace, de ida y vuelta ──
{
  const id = 'Ab3dEf6hIj9kLm2oPq5sTu';
  const e = V.enlace(id);
  check('el enlace va a la web y lleva el id detrás de #ver=', e === V.BASE_WEB + '#ver=' + id, e);
  check('se lee de vuelta', V.leeEnlace(e) === id);
  check('también con ?ver=', V.leeEnlace('https://x.y/App/index.html?ver=' + id) === id);
  check('y con más cosas detrás', V.leeEnlace('https://x.y/#ver=' + id + '&otra=1') === id);
  check('sin ver= no hay vista', V.leeEnlace('https://x.y/App/index.html') === null);
  check('un id con forma rara no cuenta (nada de inyectar rutas)', V.leeEnlace('https://x.y/#ver=../salas/ABC') === null);
  check('uno demasiado corto tampoco', V.leeEnlace('https://x.y/#ver=abc') === null);
  check('y lo que no es texto, tampoco', V.leeEnlace(null) === null);
}

// ── Lo que se sube ──
{
  const canvases = {
    raiz: {
      title: { es: 'Encargo', en: 'Commission' },
      pan: { x: 1, y: 2 }, scale: 0.8,
      items: [
        { id: 'n1', type: 'note', x: 10, y: 10, content: { es: 'hola' }, _editing: true, _dragging: true },
        { id: 'i1', type: 'image', src: 'https://lh3.googleusercontent.com/d/abc', srcLocal: 'media/cloud_i1.png', rutaOrigen: 'C:/Users/Ana/Descargas/foto.png' },
        { id: 'i2', type: 'image', src: 'media/media_i2_aaaa.png' },
        { id: 'c1', type: 'column', children: [{ id: 'h1', src: 'https://lh3.googleusercontent.com/d/h', srcLocal: 'media/h.png', _x: 1 }, { id: 'h2', src: 'file:///D:/b/media/h2.png' }] },
        { id: 'g1', type: 'galeria', fotos: [{ id: 'f1', src: 'https://lh3.googleusercontent.com/d/f', srcLocal: 'media/galeria_f.webp' }] },
        { id: 'b1', type: 'board', canvasId: 'tab1' },
      ],
      connectors: [{ id: 'k1', from: 'n1', to: 'i1', _sel: true }],
    },
    tab1: { title: { es: 'Personajes' }, parent: 'raiz', items: [{ id: 'n2', type: 'note', content: { es: 'Ana' } }] },
    otro: { title: { es: 'Mi diario' }, items: [{ id: 'secreto', type: 'note', content: { es: 'privado' } }] },
  };
  const r = V.prepara(canvases, 'raiz');
  const texto = JSON.stringify(r.lienzos);
  check('lleva el proyecto y sus tableros', !!r.lienzos.raiz && !!r.lienzos.tab1);
  check('y NADA de otro proyecto', !r.lienzos.otro && texto.indexOf('privado') === -1);
  check('sin los campos del momento', texto.indexOf('_editing') === -1 && texto.indexOf('_dragging') === -1 && texto.indexOf('_sel') === -1 && texto.indexOf('"_x"') === -1);
  check('sin srcLocal (la ruta de este disco), tampoco en hijos ni fotos', texto.indexOf('srcLocal') === -1);
  check('sin rutaOrigen (de dónde salió el archivo en tu equipo)', texto.indexOf('rutaOrigen') === -1 && texto.indexOf('Descargas') === -1);
  check('las direcciones de Drive sí van', texto.indexOf('lh3.googleusercontent.com/d/abc') !== -1 && texto.indexOf('lh3.googleusercontent.com/d/f') !== -1);
  check('cuenta lo que solo está en este equipo (saldría vacío)', r.sinSubir === 2, String(r.sinSubir));
  check('conserva la cámara del lienzo', r.lienzos.raiz.pan && r.lienzos.raiz.scale === 0.8);
  check('un lienzo sin cámara no lleva undefined (Firestore no los admite)', !('pan' in r.lienzos.tab1) && !('bgColor' in r.lienzos.tab1));
  check('cabe', r.cabe && r.pesa > 0);
  check('no se toca el original', canvases.raiz.items[0]._editing === true && canvases.raiz.items[1].srcLocal === 'media/cloud_i1.png');

  const grande = { raiz: { items: [{ id: 'x', type: 'note', content: { es: 'a'.repeat(V.TOPE + 10) } }] } };
  check('uno de más de 900 KB no cabe', V.prepara(grande, 'raiz').cabe === false);
  check('sin raíz no sale nada', Object.keys(V.prepara(canvases, null).lienzos).length === 0);
  // Un tablero que se apunta a sí mismo no deja la preparación dando vueltas.
  const bucle = { a: { items: [{ id: 'b', type: 'board', canvasId: 'a' }] } };
  check('un tablero que se contiene a sí mismo no cuelga', Object.keys(V.prepara(bucle, 'a').lienzos).length === 1);

  const doc = V.documento({ uid: 'u1', proyecto: { id: 'raiz', name: { es: 'Encargo', en: 'Commission' }, emoji: '✍️', collaborators: [{ id: 'a@b.c' }] }, lienzos: r.lienzos, raiz: 'raiz', cuando: 123 });
  check('el documento lleva solo lo que admiten las reglas',
    Object.keys(doc).sort().join(',') === 'actualizadoEn,dueno,emoji,lienzos,nombre,raiz,version', Object.keys(doc).join(','));
  check('y no lleva los correos de los colaboradores', JSON.stringify(doc).indexOf('a@b.c') === -1);
  const conHueco = V.documento({ uid: 'u1', proyecto: { name: 'X' }, lienzos: { raiz: { items: [{ id: 'n', w: undefined }] } }, raiz: 'raiz', cuando: 1 });
  check('quita los undefined de dentro de los nodos', JSON.stringify(conHueco.lienzos.raiz.items[0]) === '{"id":"n"}');

  check('cambio: la primera vez siempre se sube', V.cambio(r.lienzos, null) === true);
  check('cambio: lo mismo no se vuelve a subir', V.cambio(r.lienzos, JSON.parse(JSON.stringify(r.lienzos))) === false);
  const otra = JSON.parse(JSON.stringify(r.lienzos)); otra.raiz.items[0].x = 99;
  check('cambio: mover una nota sí', V.cambio(otra, r.lienzos) === true);

  const p = V.paraPintar(doc);
  check('paraPintar da el proyecto y sus lienzos', p && p.proyecto.id === 'raiz' && p.lienzos.tab1 && p.proyecto.vistaPublica === true);
  check('paraPintar con un documento roto da null', V.paraPintar({ raiz: 'x', lienzos: {} }) === null && V.paraPintar(null) === null);
}

console.log('');
console.log(fallos === 0 ? 'Todo bien' : fallos + ' fallo(s).');
process.exit(fallos === 0 ? 0 : 1);
