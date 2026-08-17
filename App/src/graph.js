// =====================================================
// Odinote — grafo de conexiones (window.OdiGraph)
//
// Construye la red de nodos del proyecto y la coloca en el plano. Se dibujan
// DOS clases de relación, que son distintas y conviene no confundir:
//
//   · anidamiento — el tablero X contiene el nodo Y. Es el árbol de siempre.
//   · enlace      — un texto de X apunta a Y. Es lo que el árbol NO puede
//                   expresar, porque cruza ramas e incluso proyectos.
//
// El colocado es una simulación de fuerzas sencilla: los nodos se repelen
// entre sí y las relaciones tiran de ellos. No busca ser exacta, sino que los
// grupos que están relacionados acaben juntos, que es lo que hace legible un
// grafo de este tipo.
//
// Sin React ni DOM, para poder probarlo desde Node.
// =====================================================
(function () {

  // Reúne nodos y relaciones de un proyecto entero (raíz + tableros anidados).
  function buildGraph({ projects, canvases, projectId, lang }) {
    const search = (typeof window !== 'undefined' && window.OdiSearch) || safeRequire('./search.js');
    const links = (typeof window !== 'undefined' && window.OdiLinks) || safeRequire('./links.js');
    if (!search || !links) return { nodes: [], edges: [] };

    const project = (projects || []).find(p => p && p.id === projectId);
    if (!project) return { nodes: [], edges: [] };

    const rootLabel = labelOf(project.name, lang);
    const pages = search.walkProject(canvases, projectId, rootLabel, lang);

    const nodes = [];
    const byId = new Map();
    const edges = [];

    for (const page of pages) {
      const canvas = canvases[page.canvasId];
      const items = Array.isArray(canvas && canvas.items) ? canvas.items : [];

      const nuevoNodo = (item, extra) => {
        const label = (search.nodeText(item, lang, true) || '').slice(0, 42) || tipoLegible(item.type);
        const node = Object.assign({
          id: item.id,
          type: item.type || 'note',
          label,
          canvasId: page.canvasId,
          trailIds: page.trailIds,
          path: page.path,
          isBoard: !!item.canvasId,
          // A qué nodo saltar al pulsarlo. Para una tarjeta dentro de una
          // columna es la columna: es lo que existe en el lienzo.
          navId: item.id,
          degree: 0,
        }, extra || {});
        nodes.push(node);
        byId.set(item.id, node);
        return node;
      };

      for (const item of items) {
        if (!item || !item.id) continue;
        nuevoNodo(item);

        // Un TABLERO contiene el lienzo que abre.
        if (item.canvasId) {
          const dentro = canvases[item.canvasId];
          const hijos = Array.isArray(dentro && dentro.items) ? dentro.items : [];
          hijos.forEach(h => { if (h && h.id) edges.push({ from: item.id, to: h.id, kind: 'nest' }); });
        }

        // Una COLUMNA contiene sus tarjetas. Viven dentro del propio nodo, no
        // sueltas en el lienzo, así que sin esto ni siquiera aparecían.
        if (Array.isArray(item.children)) {
          item.children.forEach(hijo => {
            if (!hijo || !hijo.id) return;
            nuevoNodo(hijo, { inColumn: true, navId: item.id });
            edges.push({ from: item.id, to: hijo.id, kind: 'nest' });
          });
        }
      }

      // Un MARCO contiene por geometría, no por datos: lo que cae dentro de él.
      // Se usa la MISMA regla que el lienzo al arrastrarlo (Canvas.jsx), para
      // que el grafo diga lo mismo que hace la aplicación.
      const marcos = items.filter(it => it && it.type === 'frame');
      for (const marco of marcos) {
        const fw = marco.w || 400, fh = marco.h || 400;
        for (const it of items) {
          if (!it || !it.id || it.id === marco.id || it.type === 'line') continue;
          const w = it.w !== undefined ? it.w : 200;
          const h = it.h !== undefined ? it.h : 120;
          let dentro;
          if (it.type === 'frame') {
            // Un marco solo cuelga de otro si cabe ENTERO y es más pequeño: así
            // la relación es de un solo sentido y no se forman bucles.
            dentro = it.x >= marco.x && it.y >= marco.y &&
                     it.x + w <= marco.x + fw && it.y + h <= marco.y + fh &&
                     (w * h) < (fw * fh);
          } else {
            const cx = it.x + w / 2, cy = it.y + h / 2;
            dentro = cx >= marco.x && cx <= marco.x + fw &&
                     cy >= marco.y && cy <= marco.y + fh;
          }
          if (dentro) edges.push({ from: marco.id, to: it.id, kind: 'nest' });
        }
      }
    }

    // Enlaces escritos dentro de los textos
    for (const page of pages) {
      const canvas = canvases[page.canvasId];
      const items = Array.isArray(canvas && canvas.items) ? canvas.items : [];
      for (const item of items) {
        if (!item || !item.id) continue;
        links.linksOf(item).forEach(l => {
          if (byId.has(l.itemId)) edges.push({ from: item.id, to: l.itemId, kind: 'link' });
        });
      }
    }

    // Solo cuentan las relaciones entre nodos que existen de verdad
    const vivos = edges.filter(e => byId.has(e.from) && byId.has(e.to));
    vivos.forEach(e => { byId.get(e.from).degree++; byId.get(e.to).degree++; });

    marcaProfundidad(nodes, byId, vivos);

    return { nodes, edges: vivos };
  }

  // En qué CAPA de anidamiento vive cada nodo: 0 es lo que no está dentro de
  // nada, 1 lo que está dentro de eso, y así.
  //
  // Se calcula sobre las relaciones de anidamiento, no leyendo el árbol de
  // tableros. Así la misma cuenta sirve para un tablero (que abre otro lienzo),
  // para una columna y para un marco dentro de otro marco, sin escribir tres
  // reglas distintas que luego se contradigan.
  //
  // Se toma el camino MÁS LARGO hasta cada nodo, no el más corto. Un marco
  // pequeño dentro de uno grande genera dos relaciones hacia lo que hay dentro
  // —una de cada marco—, y quedarse con la más corta pondría esos nodos en la
  // capa del marco de fuera. Un nodo pertenece al contenedor más interno que lo
  // abarca, que es el que se ve al mirar el lienzo.
  const MAX_CAPAS = 64;
  function marcaProfundidad(nodes, byId, edges) {
    const nest = edges.filter(e => e.kind === 'nest');
    nodes.forEach(n => { n.depth = 0; });

    // Relajación repetida: cada vuelta empuja hacia abajo a los hijos que aún
    // estaban demasiado arriba, y se para en cuanto nada cambia. El tope corta
    // el caso patológico de un anidamiento circular, que si no crecería sin fin.
    for (let i = 0; i < MAX_CAPAS; i++) {
      let cambio = false;
      for (const e of nest) {
        const padre = byId.get(e.from), hijo = byId.get(e.to);
        if (!padre || !hijo) continue;
        if (hijo.depth < padre.depth + 1) {
          hijo.depth = Math.min(MAX_CAPAS, padre.depth + 1);
          cambio = true;
        }
      }
      if (!cambio) break;
    }
  }

  function tipoLegible(t) {
    const map = { note: 'Nota', todo: 'To-do', doc: 'Documento', bigtitle: 'Título', image: 'Imagen',
      audio: 'Audio', link: 'Enlace', color: 'Color', board: 'Tablero', column: 'Columna',
      table: 'Tabla', frame: 'Marco', calendar: 'Calendario', comment: 'Comentario', file: 'Archivo', map: 'Mapa' };
    return map[t] || 'Nodo';
  }

  function labelOf(name, lang) {
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object') return name[lang] || name.es || name.en || Object.values(name)[0] || '';
    return '';
  }

  function safeRequire(p) {
    try { return require(p); } catch (e) { return null; }
  }

  // Coloca los nodos: repulsión entre todos, atracción por cada relación, y un
  // tirón suave hacia el centro para que nada se escape del lienzo.
  // Determinista a propósito (posición inicial en círculo, sin azar): abrir la
  // vista dos veces con los mismos datos debe dar el mismo dibujo.
  // UNA iteración de la simulación sobre posiciones ya existentes. Se saca
  // aparte para poder animarla desde la vista: dibujar cada paso es lo que deja
  // ver cómo se separan los grupos, en vez de aparecer la maraña ya cuajada.
  // `progress` va de 0 a 1 y enfría el movimiento para que acabe quieta.
  function step({ nodes, edges, pos, width, height, progress, pointer, energy }) {
    const n = pos.length;
    if (!n) return pos;
    const W = width || 900, H = height || 620;
    const cx = W / 2, cy = H / 2;
    const index = new Map(pos.map((p, i) => [p.id, i]));
    // Energía del paso. En reposo se deja MUY baja: con un suelo alto la red
    // no paraba nunca de derivar y apuntar a una bola era como cazar moscas.
    // La vista la sube cuando hay interacción (arrastre), que es cuando los
    // vecinos sí tienen que reaccionar deprisa.
    const enfriado = (energy != null) ? energy : Math.max(0.05, 1 - (progress || 0));
    const repulsion = 6400;
    const largoIdeal = 92;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = (i - j) * 0.1 + 0.1; dy = 0.1; d2 = dx * dx + dy * dy; }
        const d = Math.sqrt(d2);
        const f = repulsion / d2;
        pos[i].vx += (dx / d) * f; pos[i].vy += (dy / d) * f;
        pos[j].vx -= (dx / d) * f; pos[j].vy -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const a = index.get(e.from), b = index.get(e.to);
      if (a === undefined || b === undefined) continue;
      const dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const fuerza = (d - largoIdeal) * (e.kind === 'link' ? 0.05 : 0.028);
      pos[a].vx += (dx / d) * fuerza; pos[a].vy += (dy / d) * fuerza;
      pos[b].vx -= (dx / d) * fuerza; pos[b].vy -= (dy / d) * fuerza;
    }
    // El cursor aparta lo que tiene cerca, pero MUY poco: es un gesto, no una
    // huida. Con la fuerza alta que tenía antes, las bolas escapaban del ratón
    // y se volvía imposible pulsarlas.
    //
    // Tres reglas para que apuntar siga siendo fácil:
    //  · zona muerta — lo que está pegado al cursor es a lo que estás apuntando,
    //    así que no se toca.
    //  · el nodo señalado nunca se aparta, pase lo que pase.
    //  · el empujón se aplica solo si el nodo se acerca, nunca acumulándose.
    if (pointer) {
      const radio = pointer.radius || 120;
      const zonaMuerta = pointer.deadZone || 46;
      const r2 = radio * radio, z2 = zonaMuerta * zonaMuerta;
      for (const p of pos) {
        if (pointer.exclude && p.id === pointer.exclude) continue;
        if (p.fx != null) continue;
        const dx = p.x - pointer.x, dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2 || d2 < z2) continue;
        const d = Math.sqrt(d2);
        // Se desvanece hacia los bordes del radio: sin saltos al entrar y salir
        const caida = (d - zonaMuerta) / (radio - zonaMuerta);
        const f = (pointer.strength || 260) * (1 - caida) / Math.max(d, 40);
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
      }
    }

    for (const p of pos) {
      // Nodo agarrado con el ratón: manda la mano, no la física. Sus vecinos sí
      // siguen calculándose, así que la red se estira detrás de él.
      if (p.fx != null && p.fy != null) {
        p.x = p.fx; p.y = p.fy; p.vx = 0; p.vy = 0;
        continue;
      }
      p.vx += (cx - p.x) * 0.004;
      p.vy += (cy - p.y) * 0.004;
      p.x += Math.max(-24, Math.min(24, p.vx)) * enfriado;
      p.y += Math.max(-24, Math.min(24, p.vy)) * enfriado;
      p.vx *= 0.55; p.vy *= 0.55;
    }
    return pos;
  }

  function layout({ nodes, edges, width, height, iterations }) {
    const n = nodes.length;
    if (!n) return [];
    const W = width || 900, H = height || 620;
    const cx = W / 2, cy = H / 2;
    const pos = nodes.map((node, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = Math.min(W, H) * 0.34;
      return { id: node.id, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: 0, vy: 0 };
    });
    const index = new Map(pos.map((p, i) => [p.id, i]));

    const pasos = iterations || 220;
    const repulsion = 5200;
    const largoIdeal = 74;

    for (let paso = 0; paso < pasos; paso++) {
      const enfriado = 1 - paso / pasos; // se va calmando, para que no vibre al final

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = pos[i].x - pos[j].x;
          let dy = pos[i].y - pos[j].y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) { dx = (i - j) * 0.1 + 0.1; dy = 0.1; d2 = dx * dx + dy * dy; }
          const f = repulsion / d2;
          const d = Math.sqrt(d2);
          pos[i].vx += (dx / d) * f; pos[i].vy += (dy / d) * f;
          pos[j].vx -= (dx / d) * f; pos[j].vy -= (dy / d) * f;
        }
      }

      for (const e of edges) {
        const a = index.get(e.from), b = index.get(e.to);
        if (a === undefined || b === undefined) continue;
        const dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        // Los enlaces escritos tiran más que el anidamiento: interesa ver
        // juntos los nodos que hablan entre sí.
        const fuerza = (d - largoIdeal) * (e.kind === 'link' ? 0.05 : 0.03);
        pos[a].vx += (dx / d) * fuerza; pos[a].vy += (dy / d) * fuerza;
        pos[b].vx -= (dx / d) * fuerza; pos[b].vy -= (dy / d) * fuerza;
      }

      for (const p of pos) {
        p.vx += (cx - p.x) * 0.006;
        p.vy += (cy - p.y) * 0.006;
        p.x += Math.max(-18, Math.min(18, p.vx)) * enfriado;
        p.y += Math.max(-18, Math.min(18, p.vy)) * enfriado;
        p.vx *= 0.55; p.vy *= 0.55;
        p.x = Math.max(30, Math.min(W - 30, p.x));
        p.y = Math.max(30, Math.min(H - 30, p.y));
      }
    }
    return pos;
  }

  const OdiGraph = { buildGraph, layout, step };
  if (typeof window !== 'undefined') window.OdiGraph = OdiGraph;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiGraph;
})();
