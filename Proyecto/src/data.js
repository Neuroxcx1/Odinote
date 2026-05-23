// =====================================================
// Odinote — sample game-dev data
// Theme: "Bifrost" — Norse action-RPG project
// =====================================================

const SAMPLE_PROJECTS = [
  {
    id: 'bifrost',
    name: { es: 'Bifrost — Action RPG', en: 'Bifrost — Action RPG' },
    emoji: '⚔️',
    cover: 'linear-gradient(135deg, #FFD0E5, #C9E5FF)',
    updated: { es: 'hace 2 horas', en: '2 hours ago' },
    items: 27,
  },
  {
    id: 'verdant',
    name: { es: 'Verdant — Cozy Farm Sim', en: 'Verdant — Cozy Farm Sim' },
    emoji: '🌾',
    cover: 'linear-gradient(135deg, #DFF26E, #A8E6C9)',
    updated: { es: 'ayer', en: 'yesterday' },
    items: 14,
  },
  {
    id: 'voidrun',
    name: { es: 'Voidrun — Roguelike', en: 'Voidrun — Roguelike' },
    emoji: '🚀',
    cover: 'linear-gradient(135deg, #D4B4FF, #FFB088)',
    updated: { es: 'hace 3 días', en: '3 days ago' },
    items: 41,
  },
  {
    id: 'lattice',
    name: { es: 'Lattice — Puzzle Platformer', en: 'Lattice — Puzzle Platformer' },
    emoji: '🧩',
    cover: 'linear-gradient(135deg, #FFE066, #FFB6D4)',
    updated: { es: 'la semana pasada', en: 'last week' },
    items: 8,
  },
  {
    id: 'gm-notes',
    name: { es: 'Notas de Game Master', en: 'Game Master Notes' },
    emoji: '🎲',
    cover: 'linear-gradient(135deg, #FFB088, #FFE066)',
    updated: { es: 'hace 2 semanas', en: '2 weeks ago' },
    items: 19,
  },
];

// All canvases live in one big map. Root canvas key = project id.
// Boards are first-class items with their own canvas key.
const INITIAL_CANVASES = {
  // ─────────── ROOT CANVAS for Bifrost ───────────
  'bifrost': {
    title: { es: 'Bifrost — Action RPG', en: 'Bifrost — Action RPG' },
    items: [
      {
        id: 'sub-1', type: 'note', x: 60, y: 130, w: 360, h: 70, color: 'cream',
        content: {
          es: 'Action-RPG noruega · combate pesado · mundo abierto',
          en: 'Norse action-RPG · heavy combat · open world',
        },
      },
      // 4 board cards
      {
        id: 'board-chars', type: 'board', x: 60, y: 240, w: 260, h: 200,
        color: 'pink',
        canvasId: 'b-chars',
        content: { es: 'Personajes', en: 'Characters' },
      },
      {
        id: 'board-levels', type: 'board', x: 340, y: 240, w: 260, h: 200,
        color: 'sky',
        canvasId: 'b-levels',
        content: { es: 'Niveles', en: 'Levels' },
      },
      {
        id: 'board-mechs', type: 'board', x: 620, y: 240, w: 260, h: 200,
        color: 'mint',
        canvasId: 'b-mechs',
        content: { es: 'Mecánicas', en: 'Mechanics' },
      },
      {
        id: 'board-lore', type: 'board', x: 900, y: 240, w: 260, h: 200,
        color: 'lavender',
        canvasId: 'b-lore',
        content: { es: 'Lore', en: 'Lore' },
      },
      // kanban-style column with nested column
      {
        id: 'col-roadmap', type: 'column', x: 60, y: 470, w: 280, h: 360,
        content: { es: 'Roadmap Q3', en: 'Roadmap Q3' },
        color: 'coral',
        children: [
          { id: 'r1', text: { es: 'Vertical slice', en: 'Vertical slice' }, color: 'yellow' },
          { id: 'r2', text: { es: 'Sistema de combate v2', en: 'Combat system v2' }, color: 'pink' },
          // ─── nested column inside this column ───
          { id: 'r-nest', type: 'nested-column', label: { es: 'Bugs urgentes', en: 'Urgent bugs' }, color: 'coral',
            children: [
              { id: 'rn1', text: { es: 'Crash al desbloquear runa', en: 'Crash on rune unlock' } },
              { id: 'rn2', text: { es: 'Hit-stop inconsistente', en: 'Inconsistent hit-stop' } },
              { id: 'rn3', text: { es: 'Save corrupto en biome 3', en: 'Save corrupt in biome 3' } },
            ]
          },
          { id: 'r3', text: { es: 'Demo de Steam Next Fest', en: 'Steam Next Fest demo' }, color: 'mint' },
        ],
      },
      // Mood / reference image
      {
        id: 'img-mood', type: 'image', x: 370, y: 470, w: 230, h: 200,
        content: {
          es: 'Mood: Senua\'s Saga · God of War',
          en: 'Mood: Senua\'s Saga · God of War',
        },
        bg: 'linear-gradient(135deg, #4a3a55 0%, #2a1f2f 50%, #6e4a2e 100%)',
      },
      // Todo list
      {
        id: 'todo-1', type: 'todo', x: 620, y: 470, w: 260, h: 200,
        title: { es: 'Esta semana', en: 'This week' },
        items: [
          { id: 't1', text: { es: 'Pulir parry timing', en: 'Polish parry timing' }, done: true },
          { id: 't2', text: { es: 'Audio pase 2 — boss', en: 'Audio pass 2 — boss' }, done: true },
          { id: 't3', text: { es: 'Capítulo 2 dialogue', en: 'Chapter 2 dialogue' }, done: false },
          { id: 't4', text: { es: 'Build para playtest', en: 'Build for playtest' }, done: false },
        ],
      },
      // Comment
      {
        id: 'cmt-1', type: 'comment', x: 900, y: 470, w: 260, h: 110,
        avatar: 'F', avatarColor: 'lavender',
        name: 'Freyja',
        text: {
          es: '¿Y si el combo pesado consume estamina de runa en vez de stamina?',
          en: 'What if heavy combos drain rune-stamina instead of stamina?',
        },
      },
      // Link
      {
        id: 'link-1', type: 'link', x: 900, y: 600, w: 260, h: 100,
        title: 'Tactical Combat Talk · GDC 2024',
        url: 'gdcvault.com/play/tactical-combat',
        icon: 'play_circle',
      },
      // Color palette
      {
        id: 'pal-1', type: 'swatch', x: 370, y: 690, w: 230, h: 140,
        title: { es: 'Paleta de Midgard', en: 'Midgard palette' },
        colors: [
          { hex: '#2C1810', name: 'Ink' },
          { hex: '#7A5A3A', name: 'Bark' },
          { hex: '#C9A876', name: 'Gold' },
          { hex: '#8E2E2E', name: 'Blood' },
        ],
      },
      // Sketch placeholder
      {
        id: 'sketch-1', type: 'doc', x: 900, y: 720, w: 260, h: 130,
        title: { es: 'Pitch en 1 frase', en: 'One-line pitch' },
        body: {
          es: 'Un guerrero exiliado recolecta runas de dioses caídos para reescribir el destino.',
          en: 'An exiled warrior gathers fallen-god runes to rewrite fate itself.',
        },
      },
    ],
    connectors: [
      // curvable
      { id: 'c1', from: 'board-chars', to: 'board-mechs', fromAnchor: 'bottom', toAnchor: 'bottom',
        bend: { x: 0, y: 80 } },
      { id: 'c2', from: 'sub-1', to: 'board-chars', fromAnchor: 'bottom', toAnchor: 'top',
        bend: { x: -40, y: 0 } },
    ],
  },

  // ─────────── NESTED: Characters ───────────
  'b-chars': {
    title: { es: 'Personajes', en: 'Characters' },
    parent: 'bifrost',
    parentLabel: { es: 'Bifrost', en: 'Bifrost' },
    items: [
      {
        id: 'ct', type: 'title', x: 60, y: 40, w: 460, h: 60,
        content: { es: 'Elenco principal', en: 'Main cast' },
      },
      {
        id: 'ch-astrid', type: 'note', x: 60, y: 130, w: 220, h: 160, color: 'pink',
        content: {
          es: '**ASTRID**\nProtagonista. Cazadora exiliada de Vanaheim. Runa: tormenta.',
          en: '**ASTRID**\nProtagonist. Exiled hunter from Vanaheim. Rune: storm.',
        },
      },
      {
        id: 'ch-knut', type: 'note', x: 300, y: 130, w: 220, h: 160, color: 'sky',
        content: {
          es: '**KNUT**\nAliado. Skald que ve futuros posibles. Comic relief.',
          en: '**KNUT**\nAlly. Skald who sees possible futures. Comic relief.',
        },
      },
      {
        id: 'ch-fenris', type: 'note', x: 540, y: 130, w: 220, h: 160, color: 'coral',
        content: {
          es: '**FENRIS-EL-MARCADO**\nAntagonista. Hermano perdido. Runa: silencio.',
          en: '**FENRIS-THE-MARKED**\nAntagonist. Lost brother. Rune: silence.',
        },
      },
      {
        id: 'ch-board-sup', type: 'board', x: 60, y: 320, w: 240, h: 180,
        color: 'mint', canvasId: 'b-chars-sup',
        content: { es: 'Personajes secundarios', en: 'Supporting cast' },
      },
      {
        id: 'ch-img-astrid', type: 'image', x: 320, y: 320, w: 200, h: 180,
        content: { es: 'Astrid · concept', en: 'Astrid · concept' },
        bg: 'linear-gradient(160deg, #5a3a2a, #2a1f1f 60%, #c9a876)',
      },
      {
        id: 'ch-rel', type: 'doc', x: 540, y: 320, w: 220, h: 180,
        title: { es: 'Relaciones', en: 'Relationships' },
        body: {
          es: 'Astrid y Knut empiezan como aliados de conveniencia. Fenris fue su mentor — ahora es la sombra que la persigue.',
          en: 'Astrid and Knut start as allies of convenience. Fenris was her mentor — now the shadow chasing her.',
        },
      },
    ],
    connectors: [
      { id: 'cc1', from: 'ch-astrid', to: 'ch-fenris', fromAnchor: 'right', toAnchor: 'left',
        bend: { x: 0, y: -50 } },
    ],
  },

  // sub-sub board
  'b-chars-sup': {
    title: { es: 'Personajes secundarios', en: 'Supporting cast' },
    parent: 'b-chars',
    parentLabel: { es: 'Personajes', en: 'Characters' },
    grandparent: 'bifrost',
    grandparentLabel: { es: 'Bifrost', en: 'Bifrost' },
    items: [
      {
        id: 'sup-t', type: 'title', x: 60, y: 40, w: 460, h: 60,
        content: { es: 'Reparto secundario', en: 'Supporting cast' },
      },
      {
        id: 'sup-1', type: 'note', x: 60, y: 130, w: 200, h: 130, color: 'yellow',
        content: { es: '**HILDA**\nHerrera. Vende runas raras.', en: '**HILDA**\nSmith. Sells rare runes.' },
      },
      {
        id: 'sup-2', type: 'note', x: 280, y: 130, w: 200, h: 130, color: 'mint',
        content: { es: '**JÖRMUN**\nLobo místico. Compañero.', en: '**JÖRMUN**\nMystic wolf. Companion.' },
      },
      {
        id: 'sup-3', type: 'note', x: 500, y: 130, w: 200, h: 130, color: 'lavender',
        content: { es: '**LA VIDENTE**\nGuía cíclica.', en: '**THE SEER**\nCyclical guide.' },
      },
    ],
    connectors: [],
  },

  // Levels
  'b-levels': {
    title: { es: 'Niveles', en: 'Levels' },
    parent: 'bifrost',
    parentLabel: { es: 'Bifrost', en: 'Bifrost' },
    items: [
      {
        id: 'lt', type: 'title', x: 60, y: 40, w: 500, h: 60,
        content: { es: 'Mapa del mundo', en: 'World map' },
      },
      {
        id: 'lv1', type: 'image', x: 60, y: 130, w: 240, h: 180,
        content: { es: '1. Bosques de Midgard', en: '1. Midgard forests' },
        bg: 'linear-gradient(160deg, #2a4a2a, #1a2a1a 60%, #5a7a4a)',
      },
      {
        id: 'lv2', type: 'image', x: 320, y: 130, w: 240, h: 180,
        content: { es: '2. Minas de Svartalfheim', en: '2. Svartalfheim mines' },
        bg: 'linear-gradient(160deg, #3a2a4a, #1a1a2a 60%, #8a5a8a)',
      },
      {
        id: 'lv3', type: 'image', x: 580, y: 130, w: 240, h: 180,
        content: { es: '3. Cumbres de Asgard', en: '3. Asgard peaks' },
        bg: 'linear-gradient(160deg, #c9a876, #8a5a2a 60%, #ffd680)',
      },
      {
        id: 'lv-col', type: 'column', x: 60, y: 340, w: 280, h: 280,
        content: { es: 'Encuentros tipo', en: 'Encounter types' },
        color: 'sky',
        children: [
          { id: 'le1', text: { es: 'Patrulla de draugr (x3)', en: 'Draugr patrol (x3)' }, color: 'sky' },
          { id: 'le2', text: { es: 'Mini-boss: Jotun', en: 'Mini-boss: Jotun' }, color: 'pink' },
          { id: 'le3', text: { es: 'Puzzle de runas', en: 'Rune puzzle' }, color: 'yellow' },
          { id: 'le4', text: { es: 'Santuario (heal)', en: 'Shrine (heal)' }, color: 'mint' },
        ],
      },
      {
        id: 'lv-doc', type: 'doc', x: 360, y: 340, w: 260, h: 200,
        title: { es: 'Ritmo de nivel', en: 'Level pacing' },
        body: {
          es: 'Tensión-relajación cada 6-8 min. Encuentro denso → exploración → reto opcional → checkpoint.',
          en: 'Tension-release every 6-8 min. Dense encounter → exploration → optional challenge → checkpoint.',
        },
      },
    ],
    connectors: [],
  },

  // Mechanics
  'b-mechs': {
    title: { es: 'Mecánicas', en: 'Mechanics' },
    parent: 'bifrost',
    parentLabel: { es: 'Bifrost', en: 'Bifrost' },
    items: [
      {
        id: 'mt', type: 'title', x: 60, y: 40, w: 500, h: 60,
        content: { es: 'Sistemas core', en: 'Core systems' },
      },
      {
        id: 'm-col-combat', type: 'column', x: 60, y: 130, w: 260, h: 320,
        content: { es: 'Combate', en: 'Combat' }, color: 'pink',
        children: [
          { id: 'mc1', text: { es: 'Light / heavy / parry', en: 'Light / heavy / parry' }, color: 'pink' },
          { id: 'mc2', text: { es: 'Hit-stop dinámico', en: 'Dynamic hit-stop' }, color: 'coral' },
          { id: 'mc3', text: { es: 'Runas activas (x4)', en: 'Active runes (x4)' }, color: 'yellow' },
        ],
      },
      {
        id: 'm-col-prog', type: 'column', x: 340, y: 130, w: 260, h: 320,
        content: { es: 'Progresión', en: 'Progression' }, color: 'sky',
        children: [
          { id: 'mp1', text: { es: 'Árbol de runas', en: 'Rune tree' }, color: 'sky' },
          { id: 'mp2', text: { es: 'Equipo: 3 slots', en: 'Gear: 3 slots' }, color: 'mint' },
          { id: 'mp-nest', type: 'nested-column', label: { es: 'Loot tiers', en: 'Loot tiers' }, color: 'sky',
            children: [
              { id: 'mpn1', text: { es: 'Común · gris', en: 'Common · gray' } },
              { id: 'mpn2', text: { es: 'Rúnico · violeta', en: 'Runic · violet' } },
              { id: 'mpn3', text: { es: 'Mítico · oro', en: 'Mythic · gold' } },
            ]
          },
        ],
      },
      {
        id: 'm-col-explore', type: 'column', x: 620, y: 130, w: 260, h: 320,
        content: { es: 'Exploración', en: 'Exploration' }, color: 'mint',
        children: [
          { id: 'me1', text: { es: 'Travesía con Jörmun', en: 'Traverse with Jörmun' }, color: 'mint' },
          { id: 'me2', text: { es: 'Climb selectivo', en: 'Selective climb' }, color: 'lavender' },
          { id: 'me3', text: { es: 'Visión de runa (eco)', en: 'Rune sight (echo)' }, color: 'yellow' },
        ],
      },
    ],
    connectors: [],
  },

  // Lore
  'b-lore': {
    title: { es: 'Lore', en: 'Lore' },
    parent: 'bifrost',
    parentLabel: { es: 'Bifrost', en: 'Bifrost' },
    items: [
      {
        id: 'lor-t', type: 'title', x: 60, y: 40, w: 500, h: 60,
        content: { es: 'Mitología y mundo', en: 'Mythology & world' },
      },
      {
        id: 'lor-doc', type: 'doc', x: 60, y: 130, w: 340, h: 280,
        title: { es: 'Premisa', en: 'Premise' },
        body: {
          es: 'Los dioses cayeron en una guerra antigua. Sus runas se dispersaron por los nueve mundos. Quien las una vuelve a escribir destino — pero a costo de su propia mortalidad.',
          en: 'The gods fell in an ancient war. Their runes scattered across the nine worlds. Whoever unites them rewrites fate — at the cost of their own mortality.',
        },
      },
      {
        id: 'lor-tl', type: 'note', x: 420, y: 130, w: 260, h: 130, color: 'cream',
        content: {
          es: '**Edad 1** · Guerra de dioses\n**Edad 2** · Silencio (200 años)\n**Edad 3** · Astrid encuentra la primera runa',
          en: '**Age 1** · Gods\' war\n**Age 2** · Silence (200 years)\n**Age 3** · Astrid finds first rune',
        },
      },
      {
        id: 'lor-img', type: 'image', x: 420, y: 280, w: 260, h: 130,
        content: { es: 'Yggdrasil · árbol del mundo', en: 'Yggdrasil · world tree' },
        bg: 'linear-gradient(160deg, #1a2a1a, #4a3a2a 60%, #c9a876)',
      },
    ],
    connectors: [],
  },

  // ─────────── ROOT CANVAS for Verdant (cozy farm sim) ───────────
  'verdant': {
    title: { es: 'Verdant — Cozy Farm Sim', en: 'Verdant — Cozy Farm Sim' },
    items: [
      { id: 'v-title', type: 'title', x: 60, y: 40, w: 520, h: 70, content: { es: 'Verdant', en: 'Verdant' } },
      { id: 'v-sub', type: 'note', x: 60, y: 120, w: 380, h: 84, color: 'sage',
        content: { es: 'Farm sim acogedor · estaciones · vida de pueblo · sin combate', en: 'Cozy farm sim · seasons · village life · no combat' } },
      { id: 'v-b-crops',   type: 'board', x: 60,  y: 240, w: 250, h: 190, color: 'green',  canvasId: 'v-crops',    content: { es: 'Cultivos', en: 'Crops' } },
      { id: 'v-b-village', type: 'board', x: 330, y: 240, w: 250, h: 190, color: 'rose',   canvasId: 'v-village',  content: { es: 'Aldeanos', en: 'Villagers' } },
      { id: 'v-b-seasons', type: 'board', x: 600, y: 240, w: 250, h: 190, color: 'yellow', canvasId: 'v-seasons',  content: { es: 'Estaciones', en: 'Seasons' } },
      { id: 'v-todo', type: 'todo', x: 60, y: 460, w: 280, h: 210, title: { es: 'Esta semana', en: 'This week' },
        items: [
          { id: 'vt1', text: { es: 'Ciclo día/noche', en: 'Day/night cycle' }, done: true,  indent: 0 },
          { id: 'vt2', text: { es: 'Sistema de riego', en: 'Watering system' }, done: true,  indent: 0 },
          { id: 'vt3', text: { es: 'Diálogos del herrero', en: 'Blacksmith dialogue' }, done: false, indent: 0 },
          { id: 'vt4', text: { es: 'Festival de cosecha', en: 'Harvest festival' }, done: false, indent: 0 },
        ] },
      { id: 'v-color', type: 'color', x: 360, y: 460, w: 200, h: 210, hex: '#90B968', showHex: true },
      { id: 'v-cmt', type: 'comment', x: 580, y: 460, w: 270, h: 150, avatar: 'M', avatarColor: 'green', name: 'Maple',
        text: { es: 'Que regar cultivos dé afinidad con la tierra 🌱', en: 'Watering crops should grant land-affinity 🌱' } },
      { id: 'v-doc', type: 'doc', x: 60, y: 700, w: 280, h: 150, title: { es: 'Pitch', en: 'Pitch' },
        body: { es: 'Heredas la granja olvidada de tu abuela y devuelves la vida a un pueblo dormido, una estación a la vez.', en: 'You inherit grandma\'s forgotten farm and bring a sleepy village back to life, one season at a time.' } },
      { id: 'v-link', type: 'link', x: 360, y: 700, w: 270, h: 100, title: 'Stardew Valley · postmortem', url: 'youtube.com/watch?v=stardew' },
    ],
    connectors: [
      { id: 'vc1', fromEnd: { itemId: 'v-sub' }, toEnd: { itemId: 'v-b-crops' }, shape: 'curve', bend: { x: -30, y: 10 } },
    ],
  },
};

const TRANSLATIONS = {
  es: {
    home_hero: 'Tu mente,\nordenada en\ncanvases.',
    home_sub: 'Odinote es un canvas infinito con tableros anidados. Pensado para game devs, escritores y creativos que no caben en una sola pantalla.',
    new_project: 'Nuevo proyecto',
    search_projects: 'Buscar proyectos…',
    recent: 'Recientes',
    all_projects: 'Todos los proyectos',
    items_count: 'nodos',
    open_board: 'Abrir',
    home: 'Inicio',
    tool_note: 'Nota', tool_link: 'Enlace', tool_todo: 'To-do', tool_line: 'Línea',
    tool_board: 'Tablero', tool_column: 'Columna', tool_comment: 'Comentar',
    tool_image: 'Imagen', tool_doc: 'Documento', tool_calendar: 'Calendario',
    tool_table: 'Tabla', tool_audio: 'Audio',
    tool_color: 'Color', tool_file: 'Archivo',
    search_canvas: 'Buscar en este canvas…',
    new_canvas: 'Nuevo canvas',
  },
  en: {
    home_hero: 'Your mind,\norganized as\ncanvases.',
    home_sub: 'Odinote is an infinite canvas with nested boards. Built for game devs, writers and creatives who don\'t fit on one screen.',
    new_project: 'New project',
    search_projects: 'Search projects…',
    recent: 'Recent',
    all_projects: 'All projects',
    items_count: 'nodes',
    open_board: 'Open',
    home: 'Home',
    tool_note: 'Note', tool_link: 'Link', tool_todo: 'To-do', tool_line: 'Line',
    tool_board: 'Board', tool_column: 'Column', tool_comment: 'Comment',
    tool_image: 'Image', tool_doc: 'Document', tool_calendar: 'Calendar',
    tool_table: 'Table', tool_audio: 'Audio',
    tool_color: 'Color', tool_file: 'File',
    search_canvas: 'Search this canvas…',
    new_canvas: 'New canvas',
  },
};

Object.assign(window, { SAMPLE_PROJECTS, INITIAL_CANVASES, TRANSLATIONS });
