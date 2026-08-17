// =====================================================
// Odinote — vista de conexiones
//
// Dibuja la red del proyecto a pantalla completa: cada nodo es un cuerpo con
// halo y cada relación una línea. El tamaño y el brillo crecen con el número
// de conexiones, así los nodos de los que cuelga todo se ven de un vistazo.
//
// La simulación corre EN VIVO (no se calcula y ya): la red se abre encogida y
// se despliega sola, que es lo que hace legible un grafo — ves cómo se separan
// los grupos. Se puede acercar con la rueda y arrastrar para moverse.
//
// No es solo decorativa: al pulsar un cuerpo se va a ese nodo.
//
// Qué se conecta con qué vive en src/graph.js, probado aparte con Node.
// =====================================================

// Un color por capa de anidamiento, del más superficial al más enterrado.
//
// El orden no es el del arcoíris a propósito. Puestos en escala, el ámbar y el
// amarillo de las capas 1 y 2 quedaban casi iguales sobre el fondo oscuro y no
// se distinguía una de otra. Lo que importa aquí no es que la escala sea bonita
// sino que dos capas SEGUIDAS no se parezcan, así que el morado sube al puesto
// 2 y el amarillo baja al final. A partir de la séptima se repiten: a esa
// profundidad ya nadie va contando.
const CAPAS = ['#FF6B5E', '#F5A65B', '#B49BEA', '#8FD17A', '#4FC7C0', '#6FA8F5', '#EFD05C'];
const NOMBRES_CAPA = (d) => (d === 0 ? window.t('raíz', 'root') : window.t('capa ' + d, 'layer ' + d));

function GraphView({ open, onClose, projects, canvases, projectId, lang, onGoTo }) {
  const [hover, setHover] = React.useState(null);
  const [, forceRedraw] = React.useState(0);
  const [cam, setCam] = React.useState({ x: 0, y: 0, k: 1 });

  const boxRef = React.useRef(null);
  const posRef = React.useRef([]);
  const rafRef = React.useRef(null);
  const dragRef = React.useRef(null);      // arrastre del lienzo (paneo)
  const nodeDragRef = React.useRef(null);  // arrastre de un nodo concreto
  const pointerRef = React.useRef(null);   // dónde está el ratón, en coords del grafo
  const hoverRef = React.useRef(null);     // nodo señalado (lo lee el bucle sin re-render)
  const camRef = React.useRef({ x: 0, y: 0, k: 1 });
  const sizeRef = React.useRef({ w: 1200, h: 800 });

  camRef.current = cam;
  hoverRef.current = hover;

  // Pantalla → coordenadas del grafo (deshaciendo el zoom y el desplazamiento)
  const aGrafo = (clientX, clientY) => {
    const box = boxRef.current;
    if (!box) return { x: 0, y: 0 };
    const r = box.getBoundingClientRect();
    const c = camRef.current;
    return { x: (clientX - r.left - c.x) / c.k, y: (clientY - r.top - c.y) / c.k };
  };

  const grafo = React.useMemo(() => {
    if (!open || !window.OdiGraph) return { nodes: [], edges: [] };
    return window.OdiGraph.buildGraph({ projects, canvases, projectId, lang });
  }, [open, projects, canvases, projectId, lang]);

  // Simulación animada. Se arranca al abrir y se deja correr unos segundos: el
  // usuario ve la red desplegarse en vez de aparecer ya cuajada.
  React.useEffect(() => {
    if (!open || !grafo.nodes.length) return;
    const box = boxRef.current;
    const W = (box && box.clientWidth) || 1200;
    const H = (box && box.clientHeight) || 800;
    sizeRef.current = { w: W, h: H };
    setCam({ x: 0, y: 0, k: 1 });

    // Empieza apretado en el centro para que al soltarse se note el despliegue
    const n = grafo.nodes.length;
    posRef.current = grafo.nodes.map((node, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = Math.min(W, H) * 0.06;
      return { id: node.id, x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, vx: 0, vy: 0 };
    });

    let paso = 0;
    const DESPLIEGUE = 420;
    // El bucle NO se detiene mientras la vista esté abierta: así el grafo
    // responde al ratón y a los arrastres en todo momento. Tras el despliegue
    // inicial se queda en energía baja, quieto pero vivo.
    const tick = () => {
      const veces = paso < DESPLIEGUE ? 3 : 1;
      for (let k = 0; k < veces; k++) {
        window.OdiGraph.step({
          nodes: grafo.nodes, edges: grafo.edges, pos: posRef.current,
          width: W, height: H,
          progress: Math.min(1, paso / DESPLIEGUE),
          // Ya desplegada, la red se queda casi quieta para poder apuntarle;
          // solo se reaviva mientras arrastras un nodo, que es cuando sus
          // vecinos tienen que reacomodarse a la vista.
          energy: paso < DESPLIEGUE ? undefined : (nodeDragRef.current ? 0.45 : 0.05),
          // El nodo señalado queda excluido del empujón: es al que estás
          // apuntando, y si se aparta no hay forma de pulsarlo. Y mientras
          // arrastras uno, el cursor no empuja a nadie.
          pointer: nodeDragRef.current ? null : (pointerRef.current
            ? { ...pointerRef.current, exclude: hoverRef.current }
            : null),
        });
        if (paso < DESPLIEGUE) paso++;
      }
      forceRedraw(v => v + 1);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [open, grafo]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pos = posRef.current;
  const porId = new Map(pos.map(p => [p.id, p]));
  const nodoPorId = new Map(grafo.nodes.map(n => [n.id, n]));
  const radio = (n) => 4.5 + Math.min(13, Math.sqrt(n.degree) * 3.4) + (n.isBoard ? 2 : 0);

  // Un color por capa de anidamiento. La escala va de cálido a frío según se
  // baja: lo de arriba pesa y salta a la vista, lo enterrado se retira. Antes
  // todo era lavanda salvo los tableros en rojo, y no se veía a qué nivel
  // pertenecía cada bola.
  const color = (n) => CAPAS[(n.depth || 0) % CAPAS.length];
  // Qué capas hay de verdad en este proyecto, para no pintar una leyenda con
  // siete colores cuando solo se usan dos.
  const capasUsadas = Array.from(new Set(grafo.nodes.map(n => n.depth || 0))).sort((a, b) => a - b);

  const conectado = (id) => {
    if (!hover) return true;
    if (hover === id) return true;
    return grafo.edges.some(e => (e.from === hover && e.to === id) || (e.to === hover && e.from === id));
  };
  const conexionesDe = (id) => grafo.edges.filter(e => e.from === id || e.to === id).length;

  // ── Acercar con la rueda, manteniendo bajo el cursor el punto mirado ──
  const onWheel = (e) => {
    e.preventDefault();
    const box = boxRef.current.getBoundingClientRect();
    const mx = e.clientX - box.left, my = e.clientY - box.top;
    setCam(c => {
      const k = Math.min(4, Math.max(0.25, c.k * (1 - e.deltaY * 0.0016)));
      return { k, x: mx - (mx - c.x) * (k / c.k), y: my - (my - c.y) * (k / c.k) };
    });
  };

  const onDown = (e) => {
    const gnode = e.target.closest && e.target.closest('.odi-gnode');
    if (gnode) {
      // Agarrar un nodo: se ancla al cursor y la red se estira detrás de él.
      const id = gnode.getAttribute('data-node-id');
      const p = posRef.current.find(q => q.id === id);
      if (p) {
        nodeDragRef.current = { id, movido: false, x0: e.clientX, y0: e.clientY };
        const g = aGrafo(e.clientX, e.clientY);
        p.fx = g.x; p.fy = g.y;
      }
      return;
    }
    dragRef.current = { x: e.clientX, y: e.clientY, cam: { ...camRef.current } };
  };

  const onMove = (e) => {
    pointerRef.current = aGrafo(e.clientX, e.clientY);

    const nd = nodeDragRef.current;
    if (nd) {
      if (Math.abs(e.clientX - nd.x0) > 3 || Math.abs(e.clientY - nd.y0) > 3) nd.movido = true;
      const p = posRef.current.find(q => q.id === nd.id);
      if (p) { const g = aGrafo(e.clientX, e.clientY); p.fx = g.x; p.fy = g.y; }
      return;
    }
    if (!dragRef.current) return;
    const d = dragRef.current;
    setCam({ k: d.cam.k, x: d.cam.x + (e.clientX - d.x), y: d.cam.y + (e.clientY - d.y) });
  };

  const onUp = () => {
    const nd = nodeDragRef.current;
    if (nd) {
      // Se suelta el ancla: el nodo vuelve a obedecer a la física y sus vecinos
      // lo reacomodan, en vez de quedarse clavado donde lo dejaste.
      const p = posRef.current.find(q => q.id === nd.id);
      if (p) { p.fx = null; p.fy = null; }
      nodeDragRef.current = null;
      // Si lo arrastraste, no era un clic: no debe navegar.
      if (nd.movido) { dragRef.current = null; return; }
      const nodo = grafo.nodes.find(n => n.id === nd.id);
      // navId: una tarjeta dentro de una columna no existe suelta en el
      // lienzo, así que se salta a la columna que la contiene.
      if (nodo) { onGoTo(Object.assign({}, nodo, { id: nodo.navId || nodo.id })); onClose(); return; }
    }
    dragRef.current = null;
  };

  const onLeave = () => { pointerRef.current = null; onUp(); };

  const info = hover && nodoPorId.get(hover);

  return (
    <div className="odi-graph-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="odi-graph" onMouseDown={(e) => e.stopPropagation()}>
        <div className="odi-graph-head">
          <span className="material-symbols-rounded">hub</span>
          <strong>{window.t('Conexiones', 'Connections')}</strong>
          <span className="odi-graph-count">
            {grafo.nodes.length} {window.t('nodos', 'nodes')} · {grafo.edges.length} {window.t('relaciones', 'links')}
          </span>
          <span className="odi-graph-legend">
            <i className="odi-legend-nest"/> {window.t('anidamiento', 'nesting')}
            <i className="odi-legend-link"/> {window.t('enlace', 'link')}
            {capasUsadas.length > 1 && (
              <span className="odi-legend-capas" title={window.t('Color por capa de anidamiento', 'Colour by nesting layer')}>
                {capasUsadas.map(d => (
                  <span key={d} className="odi-legend-capa">
                    <b style={{ background: CAPAS[d % CAPAS.length] }}/>
                    {NOMBRES_CAPA(d)}
                  </span>
                ))}
              </span>
            )}
            <span className="odi-legend-capa" title={window.t('Un tablero: contiene un lienzo entero', 'A board: it holds a whole canvas')}>
              <b className="odi-legend-board"/> {window.t('tablero', 'board')}
            </span>
          </span>
          <button className="odi-graph-zoom" onClick={() => setCam({ x: 0, y: 0, k: 1 })} title={window.t('Centrar', 'Reset view')}>
            <span className="material-symbols-rounded">recenter</span>
          </button>
          <button className="odi-graph-close" onClick={onClose} title={window.t('Cerrar', 'Close')}>
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div
          className="odi-graph-canvas"
          ref={boxRef}
          onWheel={onWheel}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onLeave}
        >
          {grafo.nodes.length === 0 ? (
            <div className="odi-graph-empty">
              {window.t('Este proyecto todavía no tiene nodos que mostrar.', 'This project has no nodes to show yet.')}
            </div>
          ) : (
            <svg width="100%" height="100%">
              <defs>
                {/* El halo: la propia forma desenfocada y superpuesta */}
                <filter id="odi-glow" x="-120%" y="-120%" width="340%" height="340%">
                  <feGaussianBlur stdDeviation="7" result="b"/>
                  <feMerge>
                    <feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <radialGradient id="odi-bg-glow">
                  <stop offset="0%" stopColor="#2A2740" stopOpacity="0.85"/>
                  <stop offset="100%" stopColor="#14121F" stopOpacity="0"/>
                </radialGradient>
              </defs>

              <rect width="100%" height="100%" fill="url(#odi-bg-glow)"/>

              <g transform={`translate(${cam.x},${cam.y}) scale(${cam.k})`}>
                <g>
                  {grafo.edges.map((e, i) => {
                    const a = porId.get(e.from), b = porId.get(e.to);
                    if (!a || !b) return null;
                    const vivo = !hover || e.from === hover || e.to === hover;
                    return (
                      <line
                        key={i}
                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        className={`odi-edge ${e.kind === 'link' ? 'is-link' : 'is-nest'}`}
                        opacity={vivo ? (e.kind === 'link' ? 0.85 : 0.4) : 0.05}
                      />
                    );
                  })}
                </g>
                <g>
                  {grafo.nodes.map(n => {
                    const p = porId.get(n.id);
                    if (!p) return null;
                    const vivo = conectado(n.id);
                    const r = radio(n);
                    return (
                      <g
                        key={n.id}
                        className="odi-gnode"
                        data-node-id={n.id}
                        opacity={vivo ? 1 : 0.12}
                        onMouseOver={() => setHover(n.id)}
                        onMouseOut={() => setHover(null)}
                      >
                        {/* Zona de agarre generosa e invisible: acertarle a un
                            círculo de 5px con el ratón es incómodo. */}
                        <circle cx={p.x} cy={p.y} r={r + 9} fill="transparent"/>
                        <circle
                          cx={p.x} cy={p.y} r={hover === n.id ? r * 1.35 : r}
                          className={`odi-gcircle ${n.isBoard ? 'is-board' : ''} ${hover === n.id ? 'is-hover' : ''}`}
                          /* Estilo en línea, NO el atributo fill: cualquier
                             regla de la hoja de estilos gana a un atributo de
                             presentación, así que el color de capa se lo comía
                             el `fill` de .odi-gcircle y salía todo morado. */
                          style={{ fill: color(n) }}
                          filter="url(#odi-glow)"
                        />
                        {/* Un tablero abre otro lienzo entero, así que sigue
                            teniendo que distinguirse de una nota que esté en su
                            misma capa: se marca con un anillo, no con otro
                            color, para no pelearse con el color de capa. */}
                        {n.isBoard && (
                          <circle
                            cx={p.x} cy={p.y} r={(hover === n.id ? r * 1.35 : r) + 3.5}
                            className="odi-gring"
                          />
                        )}
                        {(hover === n.id || n.degree >= 4 || n.isBoard) && (
                          <text
                            x={p.x} y={p.y - r - 7}
                            className="odi-glabel"
                            textAnchor="middle"
                            style={{ fontSize: `${Math.max(8, 11 / cam.k)}px` }}
                          >
                            {n.label.slice(0, 26)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>
          )}
        </div>

        <div className="odi-graph-foot">
          {info ? (
            <>
              <strong>{info.label}</strong>
              <span className="odi-legend-capa">
                <b style={{ background: color(info) }}/> {NOMBRES_CAPA(info.depth || 0)}
              </span>
              <span className="odi-graph-path">{info.path.join(' / ')}</span>
              <span className="odi-graph-deg">
                {conexionesDe(hover)} {window.t('conexiones', 'connections')}
              </span>
            </>
          ) : (
            <span className="odi-graph-hint">
              {window.t(
                'Rueda para acercar · arrastra el fondo para moverte · arrastra un nodo para colocarlo · púlsalo para ir hasta él',
                'Wheel to zoom · drag the background to move · drag a node to reposition it · click to jump to it'
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

window.GraphView = GraphView;
