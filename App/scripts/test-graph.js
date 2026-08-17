// Pruebas del grafo de conexiones (src/graph.js).  node scripts/test-graph.js
const path = require('path');
require(path.join(__dirname, '..', 'src', 'search.js'));
const L = require(path.join(__dirname, '..', 'src', 'links.js'));
const G = require(path.join(__dirname, '..', 'src', 'graph.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const linkA = (id, t) => L.makeLinkHtml({ itemId: id, canvasId: 'c', text: t });
const projects = [{ id: 'p1', name: { es: 'Juego 3' } }];
const canvases = {
  p1: { title: { es: 'Juego 3' }, items: [
    { id: 'idea', type: 'note', content: { es: 'La premisa depende del ' + linkA('mecanica', 'hambre') } },
    { id: 'tabArte', type: 'board', content: { es: 'Arte' }, canvasId: 'arte' },
    { id: 'mecanica', type: 'note', content: { es: 'Hambre de almas' } },
  ] },
  arte: { title: { es: 'Arte' }, items: [
    { id: 'ghost', type: 'note', content: { es: 'Ghost usa la ' + linkA('mecanica', 'mecánica') } },
    { id: 'paleta', type: 'color', content: { es: 'Paleta' } },
  ] },
};

const g = G.buildGraph({ projects, canvases, projectId: 'p1', lang: 'es' });

check('recoge los nodos de la raíz y de los tableros anidados',
  g.nodes.length === 5, `${g.nodes.length} nodos`);
check('marca cuáles son tableros',
  g.nodes.filter(n => n.isBoard).length === 1);

const nest = g.edges.filter(e => e.kind === 'nest');
const link = g.edges.filter(e => e.kind === 'link');
check('el anidamiento aparece como relación',
  nest.length === 2 && nest.every(e => e.from === 'tabArte'), `${nest.length} de anidamiento`);
check('los enlaces escritos aparecen como relación',
  link.length === 2 && link.every(e => e.to === 'mecanica'), `${link.length} enlaces`);
check('un enlace cruza de un tablero a otro',
  link.some(e => e.from === 'ghost' && e.to === 'mecanica'));

const mecanica = g.nodes.find(n => n.id === 'mecanica');
check('el nodo más referenciado tiene más grado', mecanica.degree === 2, `grado ${mecanica.degree}`);
check('cada nodo sabe cómo llegar a él',
  g.nodes.every(n => Array.isArray(n.trailIds) && n.trailIds.length >= 1));
check('el nodo de un tablero anidado trae su ruta',
  g.nodes.find(n => n.id === 'ghost').path.join(' / ') === 'Juego 3 / Arte',
  g.nodes.find(n => n.id === 'ghost').path.join(' / '));

// Enlaces a nodos que ya no existen no deben dibujarse
const conMuerto = JSON.parse(JSON.stringify(canvases));
conMuerto.p1.items[0].content.es = 'apunta a ' + linkA('borrado-hace-tiempo', 'nada');
const g2 = G.buildGraph({ projects, canvases: conMuerto, projectId: 'p1', lang: 'es' });
check('un enlace a un nodo inexistente no genera relación',
  !g2.edges.some(e => e.to === 'borrado-hace-tiempo'));

// Colocado
const pos = G.layout({ nodes: g.nodes, edges: g.edges, width: 900, height: 620 });
check('coloca todos los nodos', pos.length === g.nodes.length);
check('todos caen dentro del lienzo',
  pos.every(p => p.x >= 0 && p.x <= 900 && p.y >= 0 && p.y <= 620));
check('no deja posiciones inválidas',
  pos.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
const separados = pos.some((a, i) => pos.some((b, j) => i !== j && Math.hypot(a.x-b.x, a.y-b.y) > 40));
check('los nodos quedan separados, no amontonados', separados);

// Mismo dibujo con los mismos datos
const pos2 = G.layout({ nodes: g.nodes, edges: g.edges, width: 900, height: 620 });
check('el resultado es determinista (mismo dibujo al reabrir)',
  pos.every((p, i) => Math.abs(p.x - pos2[i].x) < 0.001 && Math.abs(p.y - pos2[i].y) < 0.001));

// Casos límite
let reventó = null;
try {
  G.buildGraph({ projects: [], canvases: {}, projectId: 'nope', lang: 'es' });
  G.buildGraph({ projects: null, canvases: null, projectId: 'p1', lang: 'es' });
  G.layout({ nodes: [], edges: [], width: 900, height: 620 });
  G.layout({ nodes: [{ id: 'solo' }], edges: [], width: 900, height: 620 });
} catch (e) { reventó = e.message; }
check('proyecto vacío o inexistente no rompe nada', reventó === null, reventó || '');

// ── Contenedores: tablero, MARCO (por geometría) y COLUMNA (por datos) ──
const conContenedores = {
  p9: { title: { es: 'Con contenedores' }, items: [
    // Marco grande con dos nodos dentro y uno fuera
    { id: 'marco', type: 'frame', title: { es: 'Fase 1' }, x: 0, y: 0, w: 400, h: 400 },
    { id: 'dentro1', type: 'note', content: { es: 'cae dentro' }, x: 50, y: 50, w: 100, h: 60 },
    { id: 'dentro2', type: 'note', content: { es: 'también dentro' }, x: 200, y: 200, w: 100, h: 60 },
    { id: 'fuera', type: 'note', content: { es: 'queda fuera' }, x: 900, y: 900, w: 100, h: 60 },
    // Marco pequeño dentro del grande → cuelga de él
    { id: 'marcoHijo', type: 'frame', title: { es: 'Sub' }, x: 20, y: 260, w: 120, h: 120 },
    // Columna con dos tarjetas dentro (viven en el propio nodo)
    { id: 'col', type: 'column', title: { es: 'Backlog' }, x: 600, y: 0, w: 200, h: 300,
      children: [
        { id: 'tarjeta1', type: 'note', content: { es: 'tarea suelta' } },
        { id: 'tarjeta2', type: 'note', content: { es: 'otra tarea' } },
      ] },
  ] },
};
const gc = G.buildGraph({ projects: [{ id: 'p9', name: 'Con contenedores' }], canvases: conContenedores, projectId: 'p9', lang: 'es' });
const nestDe = (id) => gc.edges.filter(e => e.kind === 'nest' && e.from === id).map(e => e.to);

check('un MARCO contiene lo que cae dentro de él',
  nestDe('marco').includes('dentro1') && nestDe('marco').includes('dentro2'),
  nestDe('marco').join(','));
check('…y no lo que queda fuera', !nestDe('marco').includes('fuera'));
check('un marco pequeño cuelga del grande que lo contiene',
  nestDe('marco').includes('marcoHijo'));
check('el marco pequeño NO se lleva al grande (relación de un solo sentido)',
  !nestDe('marcoHijo').includes('marco'));
check('una COLUMNA contiene sus tarjetas',
  nestDe('col').includes('tarjeta1') && nestDe('col').includes('tarjeta2'));
check('las tarjetas de una columna aparecen como nodos',
  gc.nodes.some(n => n.id === 'tarjeta1' && n.inColumn));
check('una tarjeta de columna salta a su columna al pulsarla',
  gc.nodes.find(n => n.id === 'tarjeta1').navId === 'col');
check('los nodos normales saltan a sí mismos',
  gc.nodes.find(n => n.id === 'fuera').navId === 'fuera');

// ── Capas de anidamiento (el color de cada bola en la vista) ──
const capaDe = (id) => (gc.nodes.find(n => n.id === id) || {}).depth;
check('lo que no está dentro de nada es la capa 0',
  capaDe('marco') === 0 && capaDe('fuera') === 0 && capaDe('col') === 0,
  `marco=${capaDe('marco')} fuera=${capaDe('fuera')} col=${capaDe('col')}`);
check('lo que cae dentro de un marco baja una capa',
  capaDe('dentro1') === 1 && capaDe('dentro2') === 1);
check('las tarjetas de una columna bajan una capa',
  capaDe('tarjeta1') === 1 && capaDe('tarjeta2') === 1);
check('un marco dentro de otro baja una capa',
  capaDe('marcoHijo') === 1, String(capaDe('marcoHijo')));

// Un nodo dentro de un marco que a su vez está dentro de otro marco recibe DOS
// relaciones de anidamiento. Tiene que quedarse con la del marco más interno,
// que es el que se ve al mirar el lienzo.
const marcosAnidados = {
  pm: { title: 'Marcos', items: [
    { id: 'grande', type: 'frame', title: { es: 'Grande' }, x: 0, y: 0, w: 600, h: 600 },
    { id: 'pequeno', type: 'frame', title: { es: 'Pequeño' }, x: 100, y: 100, w: 200, h: 200 },
    { id: 'hoja', type: 'note', content: { es: 'dentro del pequeño' }, x: 130, y: 130, w: 80, h: 50 },
    { id: 'soloGrande', type: 'note', content: { es: 'solo en el grande' }, x: 400, y: 400, w: 80, h: 50 },
  ] },
};
const gm = G.buildGraph({ projects: [{ id: 'pm', name: 'Marcos' }], canvases: marcosAnidados, projectId: 'pm', lang: 'es' });
const capaM = (id) => (gm.nodes.find(n => n.id === id) || {}).depth;
check('el marco de fuera es la capa 0', capaM('grande') === 0);
check('el marco de dentro es la capa 1', capaM('pequeno') === 1, String(capaM('pequeno')));
check('un nodo dentro del marco interior cuenta desde ESE marco, no del de fuera',
  capaM('hoja') === 2, String(capaM('hoja')));
check('un nodo que solo está en el marco de fuera se queda en la capa 1',
  capaM('soloGrande') === 1, String(capaM('soloGrande')));

// Con tableros anidados de verdad la cuenta tiene que seguir bajando
const anidado = {
  pz: { title: 'Raíz', items: [
    { id: 'tab1', type: 'board', content: 'Tablero 1', canvasId: 'c1' },
    { id: 'suelta', type: 'note', content: { es: 'en la raíz' } },
  ] },
  c1: { title: 'Uno', items: [
    { id: 'tab2', type: 'board', content: 'Tablero 2', canvasId: 'c2' },
  ] },
  c2: { title: 'Dos', items: [
    { id: 'hondo', type: 'note', content: { es: 'muy adentro' } },
  ] },
};
const gz = G.buildGraph({ projects: [{ id: 'pz', name: 'Anidado' }], canvases: anidado, projectId: 'pz', lang: 'es' });
const capaZ = (id) => (gz.nodes.find(n => n.id === id) || {}).depth;
check('un tablero de la raíz está en la capa 0', capaZ('tab1') === 0);
check('lo que hay dentro de un tablero está en la capa 1', capaZ('tab2') === 1, String(capaZ('tab2')));
check('y dentro de ese, en la capa 2', capaZ('hondo') === 2, String(capaZ('hondo')));
check('todos los nodos traen capa', gz.nodes.every(n => typeof n.depth === 'number'));

// Un ciclo en los datos no debe colgar el cálculo
const ciclo = {
  pc: { title: 'Ciclo', items: [
    { id: 'a', type: 'board', content: 'A', canvasId: 'cb' },
  ] },
  cb: { title: 'B', items: [
    { id: 'b', type: 'board', content: 'B', canvasId: 'pc' },
  ] },
};
let colgó = null;
try { G.buildGraph({ projects: [{ id: 'pc', name: 'Ciclo' }], canvases: ciclo, projectId: 'pc', lang: 'es' }); }
catch (e) { colgó = e.message; }
check('un anidamiento circular no cuelga el cálculo de capas', colgó === null, colgó || '');

// ── Interacción: arrastrar un nodo y apartar con el cursor ──
const W = 900, H = 620;
const nuevasPos = () => g.nodes.map((node, i) => {
  const a = (i / g.nodes.length) * Math.PI * 2;
  return { id: node.id, x: W/2 + Math.cos(a) * 40, y: H/2 + Math.sin(a) * 40, vx: 0, vy: 0 };
});

let pos3 = nuevasPos();
for (let i = 0; i < 300; i++) G.step({ nodes: g.nodes, edges: g.edges, pos: pos3, width: W, height: H, progress: i/300 });

// Un nodo anclado obedece al ratón, no a la física
const agarrado = pos3.find(p => p.id === 'mecanica');
agarrado.fx = 120; agarrado.fy = 90;
const vecino = pos3.find(p => p.id === 'idea');
const vecinoAntes = { x: vecino.x, y: vecino.y };
for (let i = 0; i < 60; i++) G.step({ nodes: g.nodes, edges: g.edges, pos: pos3, width: W, height: H, progress: 1 });
check('el nodo agarrado se queda donde lo pone el ratón',
  Math.round(agarrado.x) === 120 && Math.round(agarrado.y) === 90);
check('sus vecinos le siguen al arrastrarlo',
  Math.hypot(vecino.x - vecinoAntes.x, vecino.y - vecinoAntes.y) > 5,
  `se movió ${Math.round(Math.hypot(vecino.x - vecinoAntes.x, vecino.y - vecinoAntes.y))}px`);

// Al soltar vuelve a obedecer a la física
agarrado.fx = null; agarrado.fy = null;
const antesSoltar = { x: agarrado.x, y: agarrado.y };
for (let i = 0; i < 60; i++) G.step({ nodes: g.nodes, edges: g.edges, pos: pos3, width: W, height: H, progress: 1 });
check('al soltarlo vuelve a colocarse solo',
  Math.hypot(agarrado.x - antesSoltar.x, agarrado.y - antesSoltar.y) > 1);

// El cursor aparta lo que tiene cerca
let pos4 = nuevasPos();
for (let i = 0; i < 300; i++) G.step({ nodes: g.nodes, edges: g.edges, pos: pos4, width: W, height: H, progress: i/300 });
const foco = { x: pos4[0].x, y: pos4[0].y };
const dAntes = pos4.slice(1).map(p => Math.hypot(p.x - foco.x, p.y - foco.y));
for (let i = 0; i < 40; i++) G.step({ nodes: g.nodes, edges: g.edges, pos: pos4, width: W, height: H, progress: 1, pointer: foco });
const dDespues = pos4.slice(1).map(p => Math.hypot(p.x - foco.x, p.y - foco.y));
const cercanos = dAntes.map((d, i) => ({ d, nuevo: dDespues[i] })).filter(x => x.d < 150);
check('el cursor aparta los nodos que tiene cerca',
  cercanos.length > 0 && cercanos.every(x => x.nuevo >= x.d - 0.01),
  `${cercanos.filter(x => x.nuevo > x.d).length} de ${cercanos.length} se apartaron`);

// La simulación no se congela: sigue viva para poder reaccionar
let pos5 = nuevasPos();
for (let i = 0; i < 600; i++) G.step({ nodes: g.nodes, edges: g.edges, pos: pos5, width: W, height: H, progress: 1 });
const antesEmpujon = { x: pos5[0].x, y: pos5[0].y };
pos5[0].vx = 30;
G.step({ nodes: g.nodes, edges: g.edges, pos: pos5, width: W, height: H, progress: 1 });
check('la simulación sigue viva tras asentarse (responde a un empujón)',
  Math.abs(pos5[0].x - antesEmpujon.x) > 0.5);

check('nada de esto produce posiciones inválidas',
  [...pos3, ...pos4, ...pos5].every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));

// ── Se tiene que poder APUNTAR: si las bolas huyen del ratón, no hay forma
// de pulsarlas. Esto vigila las dos causas que lo provocaron. ──
let pos6 = nuevasPos();
for (let i = 0; i < 300; i++) G.step({ nodes: g.nodes, edges: g.edges, pos: pos6, width: W, height: H, progress: i/300 });

// 1) el nodo señalado no debe apartarse aunque el cursor esté encima
const apuntado = pos6[0];
const posIni = { x: apuntado.x, y: apuntado.y };
for (let i = 0; i < 60; i++) {
  G.step({ nodes: g.nodes, edges: g.edges, pos: pos6, width: W, height: H,
    energy: 0.05, pointer: { x: posIni.x, y: posIni.y, exclude: apuntado.id } });
}
check('el nodo al que apuntas no huye del cursor',
  Math.hypot(apuntado.x - posIni.x, apuntado.y - posIni.y) < 6,
  `${Math.hypot(apuntado.x - posIni.x, apuntado.y - posIni.y).toFixed(1)}px en 1s`);

// 2) en reposo la red debe estarse quieta, no derivar sin parar
let pos7 = nuevasPos();
for (let i = 0; i < 300; i++) G.step({ nodes: g.nodes, edges: g.edges, pos: pos7, width: W, height: H, progress: i/300 });
const reposoAntes = pos7.map(p => ({ x: p.x, y: p.y }));
for (let i = 0; i < 60; i++) G.step({ nodes: g.nodes, edges: g.edges, pos: pos7, width: W, height: H, energy: 0.05 });
const deriva = pos7.reduce((s, p, i) => s + Math.hypot(p.x - reposoAntes[i].x, p.y - reposoAntes[i].y), 0) / pos7.length;
check('en reposo la red se queda quieta', deriva < 5, `${deriva.toFixed(2)}px/s de media`);

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
