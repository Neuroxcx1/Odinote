// =====================================================
// Oddinote — las plantillas de tablero (window.OdiPlantillas)
//
// Pedidas por el usuario: cuatro o cinco bien hechas, para que nadie se quede
// delante de un lienzo en blanco sin saber por dónde empezar. Se abren desde un
// menú en la esquina de abajo a la derecha (Canvas.jsx). Van sin imágenes a
// propósito: si las llevaran tendrían que ser CC0, y así no hay nada que
// comprobar ni que repartir aparte.
//
// Cada plantilla es solo datos: nodos con su posición relativa (la esquina de
// arriba a la izquierda es 0, 0) y las flechas entre ellos, por su `ref`. El
// lienzo los crea con makeNewItem —así nacen con todos sus campos de siempre—
// y les pone encima lo de aquí. Los textos van en español e inglés, como el
// resto de los nodos.
// =====================================================
(function () {
  const p = (es, en) => ({ es, en });
  // El texto de una nota: un título en negrita y una línea que ayuda a empezar.
  const nota = (tituloEs, tituloEn, ayudaEs, ayudaEn) => p(
    `<p><b>${tituloEs}</b></p><p>${ayudaEs}</p>`,
    `<p><b>${tituloEn}</b></p><p>${ayudaEn}</p>`
  );
  const tareas = (lista) => lista.map(([es, en], k) => ({ id: 'pl-t' + k, text: p(es, en), done: false, indent: 0 }));

  const PLANTILLAS = [
    {
      id: 'kanban',
      icono: 'view_kanban',
      nombre: p('Tablero Kanban', 'Kanban board'),
      descripcion: p('Por hacer, haciendo y hecho, con su barra de progreso.', 'To do, doing and done, with its progress bar.'),
      nodos: [
        { ref: 'titulo', tipo: 'bigtitle', x: 0, y: 0, w: 1040, h: 70, content: p('Mi proyecto', 'My project') },
        { ref: 'c1', tipo: 'column', x: 0, y: 100, w: 320, h: 420, color: 'white', content: p('Por hacer', 'To do'),
          hijos: [
            { tipo: 'note', h: 90, color: 'cream', content: nota('Primera tarea', 'First task', 'Arrástrala a la columna de al lado cuando la empieces.', 'Drag it to the next column when you start it.') },
            { tipo: 'note', h: 90, color: 'cream', content: nota('Segunda tarea', 'Second task', 'Una idea por tarjeta.', 'One idea per card.') },
            { tipo: 'note', h: 90, color: 'cream', content: nota('Tercera tarea', 'Third task', 'Doble clic para escribir.', 'Double-click to write.') },
          ] },
        { ref: 'c2', tipo: 'column', x: 360, y: 100, w: 320, h: 420, color: 'white', content: p('Haciendo', 'Doing'),
          hijos: [
            { tipo: 'note', h: 90, color: 'sage', content: nota('En marcha', 'In progress', 'Lo que tienes entre manos ahora mismo.', 'What you are working on right now.') },
          ] },
        { ref: 'c3', tipo: 'column', x: 720, y: 100, w: 320, h: 420, color: 'white', content: p('Hecho', 'Done'),
          hijos: [
            { tipo: 'note', h: 90, color: 'mist', content: nota('Terminado', 'Finished', 'Lo hecho se queda aquí para verlo crecer.', 'What is done stays here so you can watch it grow.') },
          ] },
        { ref: 'lista', tipo: 'todo', x: 1080, y: 100, w: 300, h: 250, title: p('Hitos', 'Milestones'),
          items: tareas([['Primera versión', 'First version'], ['Probarla con alguien', 'Test it with someone'], ['Arreglar lo que salga', 'Fix what comes up'], ['Publicar', 'Release']]) },
        { ref: 'progreso', tipo: 'progreso', x: 1080, y: 380, w: 300, h: 130, alcance: 'tablero' },
      ],
      flechas: [],
    },
    {
      id: 'ideas',
      icono: 'emoji_objects',
      nombre: p('Lluvia de ideas', 'Brainstorm'),
      descripcion: p('Una idea en el centro y seis ramas para tirar del hilo.', 'One idea in the middle and six branches to pull the thread.'),
      nodos: [
        { ref: 'centro', tipo: 'shape', x: 380, y: 230, w: 260, h: 170, figura: 'circulo', color: 'sage', content: p('<p><b>La idea</b></p>', '<p><b>The idea</b></p>') },
        { ref: 'i1', tipo: 'note', x: 0, y: 0, w: 260, h: 110, color: 'cream', content: nota('¿Para quién?', 'For whom?', 'Quién lo usaría y por qué.', 'Who would use it and why.') },
        { ref: 'i2', tipo: 'note', x: 380, y: 0, w: 260, h: 110, color: 'cream', content: nota('¿Qué problema resuelve?', 'What problem does it solve?', 'En una frase.', 'In one sentence.') },
        { ref: 'i3', tipo: 'note', x: 760, y: 0, w: 260, h: 110, color: 'cream', content: nota('Lo que ya existe', 'What already exists', 'Y en qué se queda corto.', 'And where it falls short.') },
        { ref: 'i4', tipo: 'note', x: 0, y: 520, w: 260, h: 110, color: 'rose', content: nota('Lo más difícil', 'The hardest part', 'Lo que puede salir mal.', 'What could go wrong.') },
        { ref: 'i5', tipo: 'note', x: 380, y: 520, w: 260, h: 110, color: 'rose', content: nota('Lo más pequeño que funciona', 'The smallest thing that works', 'La versión de un fin de semana.', 'The weekend version.') },
        { ref: 'i6', tipo: 'note', x: 760, y: 520, w: 260, h: 110, color: 'rose', content: nota('Siguiente paso', 'Next step', 'Uno solo, y para mañana.', 'Just one, for tomorrow.') },
      ],
      flechas: [['centro', 'i1'], ['centro', 'i2'], ['centro', 'i3'], ['centro', 'i4'], ['centro', 'i5'], ['centro', 'i6']],
    },
    {
      id: 'personaje',
      icono: 'person',
      nombre: p('Ficha de personaje', 'Character sheet'),
      descripcion: p('Para una novela o un juego: quién es, qué quiere y cómo cambia.', 'For a novel or a game: who they are, what they want and how they change.'),
      nodos: [
        { ref: 'marco', tipo: 'frame', x: 0, y: 0, w: 1000, h: 640, title: p('Personaje', 'Character') },
        { ref: 'nombre', tipo: 'bigtitle', x: 40, y: 60, w: 920, h: 70, content: p('Nombre del personaje', 'Character name') },
        { ref: 'n1', tipo: 'note', x: 40, y: 160, w: 290, h: 140, color: 'cream', content: nota('Aspecto', 'Looks', 'Lo primero que se ve de él o de ella.', 'The first thing anyone notices.') },
        { ref: 'n2', tipo: 'note', x: 355, y: 160, w: 290, h: 140, color: 'cream', content: nota('Personalidad', 'Personality', 'Tres palabras, y una que la contradiga.', 'Three words, and one that contradicts them.') },
        { ref: 'n3', tipo: 'note', x: 670, y: 160, w: 290, h: 140, color: 'cream', content: nota('De dónde viene', 'Where they come from', 'Lo que le pasó antes de la historia.', 'What happened before the story.') },
        { ref: 'n4', tipo: 'note', x: 40, y: 330, w: 290, h: 140, color: 'sage', content: nota('Qué quiere', 'What they want', 'Lo que persigue durante la historia.', 'What they chase through the story.') },
        { ref: 'n5', tipo: 'note', x: 355, y: 330, w: 290, h: 140, color: 'rose', content: nota('Qué teme', 'What they fear', 'Lo que le impide conseguirlo.', 'What keeps them from getting it.') },
        { ref: 'n6', tipo: 'note', x: 670, y: 330, w: 290, h: 140, color: 'mist', content: nota('Relaciones', 'Relationships', 'Quién le ayuda y quién le estorba.', 'Who helps them and who stands in the way.') },
        { ref: 'arco', tipo: 'note', x: 40, y: 500, w: 920, h: 110, color: 'white', content: nota('Su arco', 'Their arc', 'Cómo empieza, qué le cambia y cómo acaba.', 'How they start, what changes them and how they end.') },
      ],
      flechas: [],
    },
    {
      id: 'tres-actos',
      icono: 'auto_stories',
      nombre: p('Historia en tres actos', 'Three-act story'),
      descripcion: p('Planteamiento, nudo y desenlace, con sus momentos clave unidos.', 'Setup, confrontation and resolution, with their key beats linked.'),
      nodos: [
        { ref: 'a1', tipo: 'frame', x: 0, y: 0, w: 380, h: 520, title: p('Acto I · Planteamiento', 'Act I · Setup') },
        { ref: 'a2', tipo: 'frame', x: 420, y: 0, w: 380, h: 520, title: p('Acto II · Nudo', 'Act II · Confrontation') },
        { ref: 'a3', tipo: 'frame', x: 840, y: 0, w: 380, h: 520, title: p('Acto III · Desenlace', 'Act III · Resolution') },
        { ref: 'b1', tipo: 'note', x: 30, y: 70, w: 320, h: 120, color: 'cream', content: nota('El mundo de siempre', 'The ordinary world', 'Quién es y cómo vive antes de que todo cambie.', 'Who they are and how they live before everything changes.') },
        { ref: 'b2', tipo: 'note', x: 30, y: 230, w: 320, h: 120, color: 'cream', content: nota('El detonante', 'The inciting incident', 'Lo que rompe la rutina.', 'What breaks the routine.') },
        { ref: 'b3', tipo: 'note', x: 30, y: 390, w: 320, h: 100, color: 'sage', content: nota('Primer punto de giro', 'First turning point', 'Decide meterse en ello.', 'They choose to get involved.') },
        { ref: 'b4', tipo: 'note', x: 450, y: 70, w: 320, h: 120, color: 'cream', content: nota('Pruebas y aliados', 'Trials and allies', 'Lo que intenta, y con quién.', 'What they try, and with whom.') },
        { ref: 'b5', tipo: 'note', x: 450, y: 230, w: 320, h: 120, color: 'sage', content: nota('Punto medio', 'Midpoint', 'Algo se revela y lo cambia todo.', 'Something is revealed and changes everything.') },
        { ref: 'b6', tipo: 'note', x: 450, y: 390, w: 320, h: 100, color: 'rose', content: nota('La crisis', 'The crisis', 'Lo peor que podía pasar.', 'The worst that could happen.') },
        { ref: 'b7', tipo: 'note', x: 870, y: 70, w: 320, h: 120, color: 'rose', content: nota('El clímax', 'The climax', 'El enfrentamiento final.', 'The final confrontation.') },
        { ref: 'b8', tipo: 'note', x: 870, y: 230, w: 320, h: 120, color: 'mist', content: nota('La resolución', 'The resolution', 'Cómo queda todo.', 'How everything ends up.') },
        { ref: 'b9', tipo: 'note', x: 870, y: 390, w: 320, h: 100, color: 'mist', content: nota('El mundo nuevo', 'The new world', 'Qué ha cambiado en él o en ella.', 'What has changed in them.') },
      ],
      flechas: [['b1', 'b2'], ['b2', 'b3'], ['b3', 'b4'], ['b4', 'b5'], ['b5', 'b6'], ['b6', 'b7'], ['b7', 'b8'], ['b8', 'b9']],
    },
    {
      id: 'juego',
      icono: 'sports_esports',
      nombre: p('Diseño de juego en una página', 'One-page game design'),
      descripcion: p('El concepto, el bucle, las mecánicas y lo que falta para el prototipo.', 'The concept, the loop, the mechanics and what the prototype still needs.'),
      nodos: [
        { ref: 'titulo', tipo: 'bigtitle', x: 0, y: 0, w: 1000, h: 70, content: p('Nombre del juego', 'Game title') },
        { ref: 'g1', tipo: 'note', x: 0, y: 100, w: 480, h: 120, color: 'sage', content: nota('El concepto', 'The pitch', 'En una frase: «Es como X, pero…».', 'In one sentence: “It is like X, but…”.') },
        { ref: 'g2', tipo: 'note', x: 520, y: 100, w: 480, h: 120, color: 'cream', content: nota('Quién juega', 'Who plays', 'Qué es el jugador y qué siente al jugar.', 'What the player is and how it feels to play.') },
        { ref: 'g3', tipo: 'note', x: 0, y: 250, w: 320, h: 150, color: 'cream', content: nota('El bucle principal', 'The core loop', 'Lo que se repite cada minuto: hacer, conseguir, mejorar.', 'What repeats every minute: act, earn, improve.') },
        { ref: 'g4', tipo: 'note', x: 340, y: 250, w: 320, h: 150, color: 'cream', content: nota('Mecánicas', 'Mechanics', 'Los verbos del jugador: saltar, construir, negociar…', 'The player’s verbs: jump, build, bargain…') },
        { ref: 'g5', tipo: 'note', x: 680, y: 250, w: 320, h: 150, color: 'cream', content: nota('Cómo se gana y se pierde', 'How you win and lose', 'Las metas y lo que está en juego.', 'The goals and what is at stake.') },
        { ref: 'g6', tipo: 'note', x: 0, y: 430, w: 320, h: 120, color: 'mist', content: nota('Estilo visual', 'Visual style', 'Dos o tres referencias.', 'Two or three references.') },
        { ref: 'g7', tipo: 'note', x: 340, y: 430, w: 320, h: 120, color: 'mist', content: nota('Sonido', 'Sound', 'Cómo suena el mundo.', 'What the world sounds like.') },
        { ref: 'g8', tipo: 'note', x: 680, y: 430, w: 320, h: 120, color: 'mist', content: nota('Plataformas', 'Platforms', 'Dónde se juega y con qué mando.', 'Where it is played and with what controls.') },
        { ref: 'prototipo', tipo: 'todo', x: 1040, y: 100, w: 300, h: 270, title: p('Para el prototipo', 'For the prototype'),
          items: tareas([['Mover al personaje', 'Move the character'], ['El bucle, aunque sea feo', 'The loop, even if ugly'], ['Un nivel de prueba', 'A test level'], ['Que lo juegue alguien', 'Have someone play it']]) },
        { ref: 'progreso', tipo: 'progreso', x: 1040, y: 400, w: 300, h: 130, alcance: 'tablero' },
      ],
      flechas: [['g3', 'g4']],
    },
  ];

  // El tamaño total de una plantilla, para centrarla en la vista.
  function caja(plantilla) {
    let w = 0, h = 0;
    (plantilla.nodos || []).forEach(n => { w = Math.max(w, n.x + (n.w || 0)); h = Math.max(h, n.y + (n.h || 0)); });
    return { w, h };
  }

  const OdiPlantillas = { PLANTILLAS, caja };
  if (typeof window !== 'undefined') window.OdiPlantillas = OdiPlantillas;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiPlantillas;
})();
