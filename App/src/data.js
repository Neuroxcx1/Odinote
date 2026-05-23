// =====================================================
// Odinote — Sample Templates & Translations Data
// Showcasing Architecture, Game Design, and Marketing
// =====================================================

const SAMPLE_PROJECTS = [
  {
    id: 'architecture',
    name: { es: 'Estudio de Arquitectura — Casa Colina', en: 'Architecture Studio — Hillside House' },
    emoji: '🏡',
    cover: 'linear-gradient(135deg, #A8E6C9, #DFF26E)',
    updated: { es: 'hace 2 horas', en: '2 hours ago' },
    items: 7,
  },
  {
    id: 'gamedev',
    name: { es: 'Diseño de Videojuego — Project Aether', en: 'Game Design — Project Aether' },
    emoji: '👾',
    cover: 'linear-gradient(135deg, #D4B4FF, #FFB088)',
    updated: { es: 'ayer', en: 'yesterday' },
    items: 7,
  },
  {
    id: 'marketing',
    name: { es: 'Campaña de Marketing — Lanzamiento Nova', en: 'Marketing Campaign — Nova Launch' },
    emoji: '🚀',
    cover: 'linear-gradient(135deg, #FFB6D4, #FFD0E5)',
    updated: { es: 'hace 3 días', en: '3 days ago' },
    items: 7,
  },
];

// All canvases live in one big map. Root canvas key = project id.
// Boards are first-class items with their own canvas key.
const INITIAL_CANVASES = {
  // ─────────── 1. ARCHITECTURE ───────────
  'architecture': {
    title: { es: 'Estudio de Arquitectura — Casa Colina', en: 'Architecture Studio — Hillside House' },
    items: [
      {
        id: 'arch-note-1', type: 'note', x: 60, y: 130, w: 460, h: 80, color: 'mint',
        content: {
          es: '🏡 **Estudio preliminar - Casa Colina**\nDiseño ecológico de bajo impacto energético, adaptado a la topografía de la ladera oeste.',
          en: '🏡 **Preliminary study - Hillside House**\nLow-energy ecological design, adapted to the topography of the western hillside.',
        },
      },
      {
        id: 'arch-board-1', type: 'board', x: 60, y: 240, w: 260, h: 180, color: 'sky',
        canvasId: 'arch-plans',
        content: { es: 'Zonificación y Planos', en: 'Zoning & Blueprints' },
      },
      {
        id: 'arch-board-2', type: 'board', x: 340, y: 240, w: 260, h: 180, color: 'cream',
        canvasId: 'arch-materials',
        content: { es: 'Materiales y Acabados', en: 'Materials & Finishes' },
      },
      {
        id: 'arch-col-1', type: 'column', x: 60, y: 450, w: 280, h: 320, color: 'coral',
        content: { es: 'Fases del Proyecto', en: 'Project Phases' },
        children: [
          { id: 'ap1', text: { es: 'Fase 1: Levantamiento 3D', en: 'Phase 1: 3D Survey' } },
          { id: 'ap2', text: { es: 'Fase 2: Anteproyecto', en: 'Phase 2: Concept Design' } },
          { id: 'ap3', text: { es: 'Fase 3: Ingeniería Estructural', en: 'Phase 3: Structural Engineering' } },
        ],
      },
      {
        id: 'arch-todo-1', type: 'todo', x: 360, y: 450, w: 280, h: 220, color: 'yellow',
        title: { es: 'Pendientes', en: 'Tasks' },
        items: [
          { id: 'at1', text: { es: 'Verificar distancias reglamentarias', en: 'Check zoning setbacks' }, done: true },
          { id: 'at2', text: { es: 'Selección de vidrios fotovoltaicos', en: 'Select photovoltaic glass' }, done: false },
          { id: 'at3', text: { es: 'Reunión con paisajista', en: 'Meeting with landscape designer' }, done: false },
        ],
      },
      {
        id: 'arch-cmt-1', type: 'comment', x: 640, y: 240, w: 260, h: 120,
        avatar: 'M', avatarColor: 'sky',
        name: 'Arq. Mateo',
        text: {
          es: 'La inclinación de la ladera requiere un muro de contención reforzado en el eje norte.',
          en: 'The slope inclination requires a reinforced retaining wall on the north axis.',
        },
      },
      {
        id: 'arch-palette', type: 'swatch', x: 640, y: 390, w: 260, h: 140,
        title: { es: 'Paleta Orgánica', en: 'Organic Palette' },
        colors: [
          { hex: '#3E5C4E', name: 'Pino' },
          { hex: '#D2B48C', name: 'Arena' },
          { hex: '#705A4E', name: 'Piedra' },
          { hex: '#FAF9F6', name: 'Tiza' },
        ],
      },
    ],
    connectors: [
      { id: 'ac1', from: 'arch-note-1', to: 'arch-board-1', fromAnchor: 'bottom', toAnchor: 'top', bend: { x: -40, y: 0 } },
    ],
  },
  'arch-plans': {
    title: { es: 'Zonificación y Planos', en: 'Zoning & Blueprints' },
    parent: 'architecture',
    parentLabel: { es: 'Casa Colina', en: 'Hillside House' },
    items: [
      {
        id: 'arch-plans-t', type: 'title', x: 60, y: 40, w: 500, h: 60,
        content: { es: 'Planos y Distribución', en: 'Blueprints & Distribution' },
      },
      {
        id: 'arch-plans-n1', type: 'note', x: 60, y: 130, w: 260, h: 160, color: 'sky',
        content: {
          es: '**PLANTA BAJA**\n- Estacionamiento techado (2 autos)\n- Hall de acceso de doble altura\n- Cocina y comedor abierto\n- Terraza con borde infinito',
          en: '**GROUND FLOOR**\n- Covered parking (2 cars)\n- Double height access hall\n- Open kitchen & dining room\n- Infinity edge terrace',
        },
      },
      {
        id: 'arch-plans-n2', type: 'note', x: 340, y: 130, w: 260, h: 160, color: 'mint',
        content: {
          es: '**PLANTA ALTA**\n- Suite principal + vestidor\n- Biblioteca / Oficina en casa\n- 2 dormitorios secundarios con baño',
          en: '**FIRST FLOOR**\n- Master suite + walk-in closet\n- Library / Home office\n- 2 secondary bedrooms with bathroom',
        },
      },
    ],
    connectors: [],
  },
  'arch-materials': {
    title: { es: 'Materiales y Acabados', en: 'Materials & Finishes' },
    parent: 'architecture',
    parentLabel: { es: 'Casa Colina', en: 'Hillside House' },
    items: [
      {
        id: 'arch-mat-t', type: 'title', x: 60, y: 40, w: 500, h: 60,
        content: { es: 'Materiales Sugeridos', en: 'Suggested Materials' },
      },
      {
        id: 'arch-mat-n1', type: 'note', x: 60, y: 130, w: 260, h: 150, color: 'cream',
        content: {
          es: '**Fachada y Exteriores**\n- Hormigón visto texturizado\n- Paneles de madera de teca curada\n- Piedra volcánica local en la base',
          en: '**Facade & Exteriors**\n- Textured exposed concrete\n- Cured teak wood panels\n- Local volcanic stone at the base',
        },
      },
      {
        id: 'arch-mat-n2', type: 'note', x: 340, y: 130, w: 260, h: 150, color: 'yellow',
        content: {
          es: '**Interiores y Pisos**\n- Microcemento gris claro\n- Revestimientos en madera de roble\n- Griferías empotradas negro mate',
          en: '**Interiors & Floors**\n- Light gray microcement\n- Oak wood paneling\n- Matte black built-in faucets',
        },
      },
    ],
    connectors: [],
  },

  // ─────────── 2. GAME DESIGN ───────────
  'gamedev': {
    title: { es: 'Diseño de Videojuego — Project Aether', en: 'Game Design — Project Aether' },
    items: [
      {
        id: 'game-note-1', type: 'note', x: 60, y: 130, w: 460, h: 80, color: 'lavender',
        content: {
          es: '👾 **Project Aether (Metroidvania)**\nJuego de acción y exploración 2D. Enfoque en combos aéreos y personalización de prótesis mecánicas.',
          en: '👾 **Project Aether (Metroidvania)**\n2D action-exploration game. Focus on aerial combos and mechanical prosthetic customization.',
        },
      },
      {
        id: 'game-board-1', type: 'board', x: 60, y: 240, w: 260, h: 180, color: 'pink',
        canvasId: 'game-chars',
        content: { es: 'Personajes y Jefes', en: 'Characters & Bosses' },
      },
      {
        id: 'game-board-2', type: 'board', x: 340, y: 240, w: 260, h: 180, color: 'mint',
        canvasId: 'game-mechs',
        content: { es: 'Mecánicas Core', en: 'Core Mechanics' },
      },
      {
        id: 'game-col-1', type: 'column', x: 60, y: 450, w: 280, h: 320, color: 'coral',
        content: { es: 'Sprint Backlog', en: 'Sprint Backlog' },
        children: [
          { id: 'gp1', text: { es: 'Pulir salto y aceleración física', en: 'Polish jump & physics acceleration' } },
          { id: 'gp2', text: { es: 'Efectos de sonido de impacto', en: 'Hit impact sound effects' } },
          { id: 'gp3', text: { es: 'Diseño del Jefe: El Alquimista', en: 'Boss Design: The Alchemist' } },
        ],
      },
      {
        id: 'game-todo-1', type: 'todo', x: 360, y: 450, w: 280, h: 220, color: 'yellow',
        title: { es: 'Hitos Alpha', en: 'Alpha Milestones' },
        items: [
          { id: 'gt1', text: { es: 'Implementar el doble salto rúnico', en: 'Implement runic double jump' }, done: true },
          { id: 'gt2', text: { es: 'Integrar enemigo básico (Cazador)', en: 'Integrate basic enemy (Scout)' }, done: false },
          { id: 'gt3', text: { es: 'Prueba de control con Gamepad', en: 'Gamepad controller test' }, done: false },
        ],
      },
      {
        id: 'game-cmt-1', type: 'comment', x: 640, y: 240, w: 260, h: 120,
        avatar: 'N', avatarColor: 'pink',
        name: 'Niko (Gamedev)',
        text: {
          es: '¿Y si el gancho consume vapor de presión en vez de energía rúnica?',
          en: 'What if the grappling hook consumes pressure steam instead of runic energy?',
        },
      },
      {
        id: 'game-palette', type: 'swatch', x: 640, y: 390, w: 260, h: 140,
        title: { es: 'Paleta Steampunk', en: 'Steampunk Palette' },
        colors: [
          { hex: '#4A3B32', name: 'Cobre' },
          { hex: '#D4AF37', name: 'Bronce' },
          { hex: '#7D2E68', name: 'Aether' },
          { hex: '#1A1A1A', name: 'Hollín' },
        ],
      },
    ],
    connectors: [
      { id: 'gc1', from: 'game-note-1', to: 'game-board-1', fromAnchor: 'bottom', toAnchor: 'top', bend: { x: -40, y: 0 } },
    ],
  },
  'game-chars': {
    title: { es: 'Personajes y Jefes', en: 'Characters & Bosses' },
    parent: 'gamedev',
    parentLabel: { es: 'Project Aether', en: 'Project Aether' },
    items: [
      {
        id: 'game-chars-t', type: 'title', x: 60, y: 40, w: 500, h: 60,
        content: { es: 'Héroes y Enemigos', en: 'Heroes & Enemies' },
      },
      {
        id: 'game-chars-n1', type: 'note', x: 60, y: 130, w: 260, h: 160, color: 'pink',
        content: {
          es: '**VALERY (Protagonista)**\nIngeniera rebelde con brazo prostético de vapor adaptable. Puede equipar cañón, gancho o taladro.',
          en: '**VALERY (Protagonist)**\nRebel engineer with adaptable steam prosthetic arm. Can equip cannon, grapple, or drill.',
        },
      },
      {
        id: 'game-chars-n2', type: 'note', x: 340, y: 130, w: 260, h: 160, color: 'sky',
        content: {
          es: '**EL ALQUIMISTA (Jefe)**\nCientífico corrupto que usa Aether líquido para mutar. Se mueve suspendido por tentáculos mecánicos.',
          en: '**THE ALCHEMIST (Boss)**\nCorrupt scientist who uses liquid Aether to mutate. Moves suspended by mechanical tentacles.',
        },
      },
    ],
    connectors: [],
  },
  'game-mechs': {
    title: { es: 'Mecánicas Core', en: 'Core Mechanics' },
    parent: 'gamedev',
    parentLabel: { es: 'Project Aether', en: 'Project Aether' },
    items: [
      {
        id: 'game-mechs-t', type: 'title', x: 60, y: 40, w: 500, h: 60,
        content: { es: 'Sistemas del Juego', en: 'Game Systems' },
      },
      {
        id: 'game-mechs-n1', type: 'note', x: 60, y: 130, w: 260, h: 150, color: 'mint',
        content: {
          es: '**Presión de Vapor**\nEsquivar y atacar acumula calor. Si se sobrecalienta, Valery inflige más daño pero pierde vida gradualmente.',
          en: '**Steam Pressure**\nDashing and attacking builds up heat. Overheating increases damage output but drains health slowly.',
        },
      },
      {
        id: 'game-mechs-n2', type: 'note', x: 340, y: 130, w: 260, h: 150, color: 'yellow',
        content: {
          es: '**Instalación de Módulos**\nSlots de mejora en bancos de trabajo. Permite optimizar la prótesis para exploración o daño.',
          en: '**Module Upgrades**\nUpgrade slots at workbenches. Allows optimizing the prosthetic for mobility or raw damage.',
        },
      },
    ],
    connectors: [],
  },

  // ─────────── 3. MARKETING ───────────
  'marketing': {
    title: { es: 'Campaña de Marketing — Lanzamiento Nova', en: 'Marketing Campaign — Nova Launch' },
    items: [
      {
        id: 'mkt-note-1', type: 'note', x: 60, y: 130, w: 460, h: 80, color: 'pink',
        content: {
          es: '🚀 **Lanzamiento de Nova SaaS v3.0**\nCampaña de marketing digital multi-canal para posicionar a Nova como el software de colaboración líder en 2026.',
          en: '🚀 **Nova SaaS v3.0 Launch**\nMulti-channel digital marketing campaign to position Nova as the leading collaboration tool in 2026.',
        },
      },
      {
        id: 'mkt-board-1', type: 'board', x: 60, y: 240, w: 260, h: 180, color: 'sky',
        canvasId: 'mkt-channels',
        content: { es: 'Canales y Medios', en: 'Channels & Media' },
      },
      {
        id: 'mkt-board-2', type: 'board', x: 340, y: 240, w: 260, h: 180, color: 'yellow',
        canvasId: 'mkt-creative',
        content: { es: 'Recursos Creativos', en: 'Creative Assets' },
      },
      {
        id: 'mkt-col-1', type: 'column', x: 60, y: 450, w: 280, h: 320, color: 'coral',
        content: { es: 'Fases de Campaña', en: 'Campaign Phases' },
        children: [
          { id: 'mp1', text: { es: 'Fase 1: Teaser en Redes', en: 'Phase 1: Social Teaser' } },
          { id: 'mp2', text: { es: 'Fase 2: Lanzamiento General', en: 'Phase 2: General Release' } },
          { id: 'mp3', text: { es: 'Fase 3: Remarketing', en: 'Phase 3: Remarketing' } },
        ],
      },
      {
        id: 'mkt-todo-1', type: 'todo', x: 360, y: 450, w: 280, h: 220, color: 'yellow',
        title: { es: 'Pre-lanzamiento', en: 'Pre-launch Checklist' },
        items: [
          { id: 'mt1', text: { es: 'Redacción de notas de prensa', en: 'Write press releases' }, done: true },
          { id: 'mt2', text: { es: 'Configurar píxel de conversión', en: 'Set up conversion pixel' }, done: false },
          { id: 'mt3', text: { es: 'Enviar copias de prensa a medios', en: 'Send press kits to media outlets' }, done: false },
        ],
      },
      {
        id: 'mkt-cmt-1', type: 'comment', x: 640, y: 240, w: 260, h: 120,
        avatar: 'E', avatarColor: 'mint',
        name: 'Elisa (Growth)',
        text: {
          es: 'Las campañas de búsqueda de Google Ads deben enfocarse en palabras clave de dolor de usuario.',
          en: 'Google Ads search campaigns should target high-intent user pain points.',
        },
      },
      {
        id: 'mkt-palette', type: 'swatch', x: 640, y: 390, w: 260, h: 140,
        title: { es: 'Branding de Nova', en: 'Nova Branding' },
        colors: [
          { hex: '#FF6B6B', name: 'Coral' },
          { hex: '#4D96FF', name: 'Azul' },
          { hex: '#6BCB77', name: 'Menta' },
          { hex: '#FAF9F6', name: 'Blanco' },
        ],
      },
    ],
    connectors: [
      { id: 'mc1', from: 'mkt-note-1', to: 'mkt-board-1', fromAnchor: 'bottom', toAnchor: 'top', bend: { x: -40, y: 0 } },
    ],
  },
  'mkt-channels': {
    title: { es: 'Canales y Medios', en: 'Channels & Media' },
    parent: 'marketing',
    parentLabel: { es: 'Lanzamiento Nova', en: 'Nova Launch' },
    items: [
      {
        id: 'mkt-chan-t', type: 'title', x: 60, y: 40, w: 500, h: 60,
        content: { es: 'Canales de Adquisición', en: 'Acquisition Channels' },
      },
      {
        id: 'mkt-chan-n1', type: 'note', x: 60, y: 130, w: 260, h: 150, color: 'sky',
        content: {
          es: '**Orgánico e Inbound**\n- Post en el blog sobre silos de comunicación\n- Secuencia de correo para suscriptores\n- SEO enfocado en búsqueda semántica',
          en: '**Organic & Inbound**\n- Blog post on communication silos\n- Email sequence for subscribers\n- SEO optimized for semantic search',
        },
      },
      {
        id: 'mkt-chan-n2', type: 'note', x: 340, y: 130, w: 260, h: 150, color: 'pink',
        content: {
          es: '**Anuncios de Pago**\n- LinkedIn Ads para tomadores de decisiones (CTOs, PMs)\n- Retargeting en YouTube con videos cortos (15s)',
          en: '**Paid Advertising**\n- LinkedIn Ads targeting decision makers (CTOs, PMs)\n- YouTube Ads retargeting with short videos (15s)',
        },
      },
    ],
    connectors: [],
  },
  'mkt-creative': {
    title: { es: 'Recursos Creativos', en: 'Creative Assets' },
    parent: 'marketing',
    parentLabel: { es: 'Lanzamiento Nova', en: 'Nova Launch' },
    items: [
      {
        id: 'mkt-cre-t', type: 'title', x: 60, y: 40, w: 500, h: 60,
        content: { es: 'Recursos de Diseño', en: 'Design Assets' },
      },
      {
        id: 'mkt-cre-n1', type: 'note', x: 60, y: 130, w: 260, h: 140, color: 'yellow',
        content: {
          es: '**Línea Gráfica y Medios**\n- Banners en formatos horizontal y vertical\n- Capturas animadas de la app (GIFs)\n- Videos de testimonios subtitulados',
          en: '**Graphics & Media**\n- Horizontal and vertical banner formats\n- Animated app walkthroughs (GIFs)\n- Subtitled customer testimonial videos',
        },
      },
    ],
    connectors: [],
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
