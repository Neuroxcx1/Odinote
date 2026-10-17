// =====================================================
// Odinote — capa de dibujo a mano alzada
//
// Se enciende cuando un nodo de dibujo entra en modo edición: cubre el lienzo
// con un velo claro y recoge el puntero. Mientras se dibuja NADA de esto pasa
// por el estado de React: el trazo en curso se pinta en un <canvas> normal y
// solo al levantar el dedo se convierte en un trazo guardado. Un pointermove
// dispara hasta 120 veces por segundo, y cada cambio de estado del lienzo
// vuelca el proyecto entero a JSON para el historial — meter ahí cada punto
// dejaría la aplicación inservible.
//
// La geometría (grosor por presión o velocidad, simplificado, trazado y
// acierto del borrador) vive en src/draw.js, que se prueba desde Node.
// =====================================================

function DrawOverlay({
  strokes, tool, color, width, pressureMode,
  scale, pan, bounds, theme,
  selectedStrokeId,
  onCommitStroke, onEraseStroke, onEraseArea, onMoveStroke, onSelectStroke,
}) {
  const D = window.OdiDraw;
  const layerRef = React.useRef(null);
  const liveRef = React.useRef(null);
  // Trazo en curso y arrastre en curso: en refs, no en estado, para que mover
  // el puntero no repinte el árbol de React.
  const drawingRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const pointersRef = React.useRef(new Set());

  const strokesRef = React.useRef(strokes);
  strokesRef.current = strokes;
  const viewRef = React.useRef({ scale, pan });
  viewRef.current = { scale, pan };
  const toolRef = React.useRef({ tool, color, width, pressureMode });
  toolRef.current = { tool, color, width, pressureMode };

  // ── Coordenadas ──
  // Todo se guarda en coordenadas del lienzo; la pantalla es solo la vista.
  const toCanvas = (e) => {
    const rect = layerRef.current.getBoundingClientRect();
    const { scale: s, pan: p } = viewRef.current;
    return {
      x: (e.clientX - rect.left - p.x) / s,
      y: (e.clientY - rect.top - p.y) / s,
    };
  };

  // ── Lienzo del trazo en curso ──
  const sizeLive = () => {
    const cv = liveRef.current;
    const layer = layerRef.current;
    if (!cv || !layer) return;
    const dpr = window.devicePixelRatio || 1;
    const w = layer.clientWidth;
    const h = layer.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
    }
  };

  React.useEffect(() => {
    sizeLive();
    const onResize = () => sizeLive();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const clearLive = () => {
    const cv = liveRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
  };

  // Repinta el trazo en curso entero. Son unos cientos de segmentos: sobra de
  // rápido, y evita tener que llevar la cuenta de lo ya pintado.
  const paintLive = () => {
    const cur = drawingRef.current;
    const cv = liveRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
    if (!cur || cur.pts.length === 0) return;

    const { scale: s, pan: p } = viewRef.current;
    const sx = (pt) => pt[0] * s + p.x;
    const sy = (pt) => pt[1] * s + p.y;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = cur.color;
    ctx.fillStyle = cur.color;

    if (cur.pts.length === 1) {
      const r = (cur.width * (cur.pts[0][2] || 1) * s) / 2;
      ctx.beginPath();
      ctx.arc(sx(cur.pts[0]), sy(cur.pts[0]), Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    // Segmento a segmento, para que el grosor pueda cambiar por el camino.
    for (let i = 0; i < cur.pts.length - 1; i++) {
      const a = cur.pts[i];
      const b = cur.pts[i + 1];
      ctx.beginPath();
      ctx.lineWidth = Math.max(0.5, cur.width * ((a[2] + b[2]) / 2) * s);
      ctx.moveTo(sx(a), sy(a));
      ctx.lineTo(sx(b), sy(b));
      ctx.stroke();
    }
  };

  // ── La goma ──
  // Su tamaño sale del grosor elegido (así se cambia con el mismo botón), con
  // un mínimo en pantalla para que al alejarse no se quede en un punto.
  const radioGoma = () => Math.max(8 / viewRef.current.scale, (toolRef.current.width || 4) * 2.5);

  // El círculo de la goma sigue al puntero: sin verlo no se sabe qué se va a
  // borrar. Se pinta en el mismo lienzo del trazo en curso.
  const paintRing = (e) => {
    const cv = liveRef.current;
    const layer = layerRef.current;
    if (!cv || !layer) return;
    sizeLive();
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
    if (!e) return;
    const rect = layer.getBoundingClientRect();
    const r = radioGoma() * viewRef.current.scale;
    ctx.beginPath();
    ctx.arc(e.clientX - rect.left, e.clientY - rect.top, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(26,26,26,0.75)';
    ctx.stroke();
  };

  // Entre dos movimientos del ratón la mano puede haber recorrido mucho: se
  // borra también lo de en medio, cada medio radio, o quedarían islas sin
  // borrar en una pasada rápida.
  const pasoDeGoma = (a, b, r) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(d / (r / 2)));
    const out = [];
    for (let k = 1; k <= n; k++) out.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
    return out;
  };

  // ── Puntero ──
  const addSample = (e, isLast) => {
    const cur = drawingRef.current;
    if (!cur) return;
    const raw = toCanvas(e);
    const sample = { x: raw.x, y: raw.y, t: e.timeStamp, pressure: e.pressure };
    // El grosor se mide sobre el puntero de verdad (la velocidad real de la
    // mano), pero la línea se dibuja sobre el punto estabilizado.
    const f = D.factorFor(cur.mode, sample, cur.lastSample, cur.lastFactor);
    cur.smooth = D.stabilize(cur.smooth, raw);
    // Al levantar el dedo el trazo termina donde está el puntero de verdad: el
    // estabilizador va un poco por detrás y si no, la línea se quedaría corta.
    const p = isLast ? raw : cur.smooth;
    // Puntos demasiado juntos no aportan forma y sí bytes.
    const last = cur.pts[cur.pts.length - 1];
    if (!isLast && last && Math.hypot(p.x - last[0], p.y - last[1]) * viewRef.current.scale < 1) {
      cur.lastSample = sample;
      return;
    }
    cur.pts.push([p.x, p.y, f]);
    cur.lastSample = sample;
    cur.lastFactor = f;
  };

  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    pointersRef.current.add(e.pointerId);
    // Dos dedos = pellizco para hacer zoom, que resuelve Canvas. Lo que
    // hubiera empezado a dibujarse se descarta.
    if (pointersRef.current.size > 1) {
      drawingRef.current = null;
      dragRef.current = null;
      clearLive();
      return;
    }
    // Capturar el puntero mantiene el trazo vivo aunque la mano se salga de la
    // ventana. Si el navegador no puede, se sigue dibujando igual.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();

    const t = toolRef.current;
    const p = toCanvas(e);
    const tol = 6 / viewRef.current.scale;

    if (t.tool === 'eraser') {
      if (onEraseArea) {
        onEraseArea([p], radioGoma(), 'inicio');
      } else {
        const id = D.hitTest(strokesRef.current, p.x, p.y, tol);
        if (id) onEraseStroke(id);
      }
      dragRef.current = { kind: 'erase', last: p };
      paintRing(e);
      return;
    }

    if (t.tool === 'move') {
      const id = D.hitTest(strokesRef.current, p.x, p.y, tol);
      onSelectStroke(id);
      dragRef.current = id ? { kind: 'move', id, lastX: p.x, lastY: p.y, moved: false } : null;
      return;
    }

    // Lápiz
    const mode = t.pressureMode === 'auto'
      ? (e.pointerType === 'pen' ? 'pressure' : 'speed')
      : t.pressureMode;
    drawingRef.current = {
      id: `st-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      color: t.color,
      width: t.width,
      mode,
      pts: [],
      lastSample: null,
      lastFactor: null,
      smooth: null,      // posición estabilizada, la que de verdad se dibuja
    };
    sizeLive();
    addSample(e);
    paintLive();
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (toolRef.current.tool === 'eraser' && !drawingRef.current) paintRing(e);
    if (drag) {
      const p = toCanvas(e);
      if (drag.kind === 'erase') {
        if (onEraseArea) {
          const r = radioGoma();
          onEraseArea(pasoDeGoma(drag.last || p, p, r), r);
          drag.last = p;
        } else {
          const id = D.hitTest(strokesRef.current, p.x, p.y, 6 / viewRef.current.scale);
          if (id) onEraseStroke(id);
        }
      } else if (drag.kind === 'move') {
        const dx = p.x - drag.lastX;
        const dy = p.y - drag.lastY;
        if (dx || dy) {
          drag.lastX = p.x;
          drag.lastY = p.y;
          drag.moved = true;
          onMoveStroke(drag.id, dx, dy, false);
        }
      }
      return;
    }
    if (!drawingRef.current) return;
    e.preventDefault();
    // Chromium acumula las muestras que no llegó a entregar: recuperarlas es
    // lo que separa una curva suave de una línea a trompicones.
    const events = e.nativeEvent.getCoalescedEvents ? e.nativeEvent.getCoalescedEvents() : null;
    if (events && events.length) events.forEach(ev => addSample(ev));
    else addSample(e);
    paintLive();
  };

  const endPointer = (e) => {
    pointersRef.current.delete(e.pointerId);
    const drag = dragRef.current;
    // Al salirse de la capa el círculo de la goma no tiene dónde estar.
    if (e.type === 'pointerleave') paintRing(null);
    if (drag) {
      dragRef.current = null;
      // El movimiento se ha ido aplicando en vivo; aquí solo se cierra para
      // que quede UNA entrada de deshacer, no una por píxel.
      if (drag.kind === 'move' && drag.moved) onMoveStroke(drag.id, 0, 0, true);
      if (drag.kind === 'erase' && onEraseArea) onEraseArea(null, 0, 'fin');
      return;
    }
    const cur = drawingRef.current;
    if (cur && cur.pts.length) addSample(e, true);
    drawingRef.current = null;
    clearLive();
    if (!cur) return;
    const finished = D.finishStroke({ id: cur.id, color: cur.color, width: cur.width, pts: cur.pts });
    if (finished) onCommitStroke(finished);
  };

  const onPointerCancel = (e) => {
    pointersRef.current.delete(e.pointerId);
    drawingRef.current = null;
    dragRef.current = null;
    clearLive();
  };

  // ── Pintado de los trazos ya soltados ──
  const renderStroke = (s) => {
    const g = D.strokeGeometry(s);
    if (!g) return null;
    const isSel = selectedStrokeId === s.id;
    return (
      <g key={s.id}>
        {g.mode === 'fill' ? (
          <path d={g.d} fill={s.color} stroke="none" fillRule="nonzero"/>
        ) : (
          <path d={g.d} fill="none" stroke={s.color} strokeWidth={g.width}
                strokeLinecap="round" strokeLinejoin="round"/>
        )}
        {isSel && (
          <path
            d={g.mode === 'fill' ? g.d : g.d}
            fill="none"
            stroke="var(--wine, #E6544F)"
            strokeWidth={(g.width || 4) + 6 / scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.35"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </g>
    );
  };

  // Con la goma el cursor es su círculo (paintRing): la flecha encima estorba.
  const cursor = tool === 'eraser' ? 'none' : tool === 'move' ? 'default' : 'crosshair';

  // Al cambiar de herramienta, el círculo de la goma no se queda pintado.
  React.useEffect(() => { if (tool !== 'eraser') clearLive(); }, [tool]);

  return (
    <div
      ref={layerRef}
      className={`draw-layer tool-${tool}`}
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerLeave={endPointer}
      onPointerCancel={onPointerCancel}
      onMouseDown={(e)=>e.stopPropagation()}
      onDoubleClick={(e)=>e.stopPropagation()}
      onContextMenu={(e)=>e.preventDefault()}
    >
      <div className="draw-dim"/>
      <div
        className="draw-strokes"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0' }}
      >
        <svg
          width={bounds.w}
          height={bounds.h}
          viewBox={`0 0 ${bounds.w} ${bounds.h}`}
          style={{ overflow: 'visible', display: 'block' }}
        >
          {(strokes || []).map(renderStroke)}
        </svg>
      </div>
      <canvas ref={liveRef} className="draw-live"/>
    </div>
  );
}

window.DrawOverlay = DrawOverlay;
