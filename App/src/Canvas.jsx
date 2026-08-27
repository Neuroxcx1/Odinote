// =====================================================
// Odinote — Canvas v3
// • drag-to-create for ALL tools
// • hover anchors → drag to create connectors
// • Line tool: drag between items
// • image picker, link input, doc modal, calendar
// • theme prop, no zoom-out, subtle enter animation
// =====================================================
const {
  useState: useStateCanvas,
  useRef: useRefCanvas,
  useEffect: useEffectCanvas,
  useCallback: useCallbackCanvas,
  useMemo: useMemoCanvas,
} = React;

// Column auto-resize helpers
function colChildHeight(c) {
  if (c.type === 'board') {
    return c.showPreview === false ? 58 : (c.h || 200);
  }
  if (c.h !== undefined && c.h !== null) return c.h;
  return c.type === 'note' ? 90 :
         c.type === 'todo' ? 140 :
         c.type === 'link' ? 180 :
         c.type === 'image' ? 140 :
         c.type === 'doc' ? 90 :
         c.type === 'comment' ? 80 :
         c.type === 'calendar' ? 220 : 90;
}
function colNeededHeight(col, isEmpty) {
  const headerH = 40;
  const padding = 20; // top 10px + bottom 10px
  const gap = 7;
  if (isEmpty) return 160;
  const childrenH = (col.children || []).reduce((s, c) => s + colChildHeight(c), 0);
  const gaps = ((col.children || []).length - 1) * gap;
  return headerH + padding + childrenH + gaps;
}
function withResizedColumn(items, colId) {
  return items.map(it => {
    if (it.id !== colId) return it;
    const empty = !(it.children || []).length;
    const h = colNeededHeight(it, empty);
    return { ...it, h };
  });
}

// ───── default templates per tool ─────
function defaultDims(type) {
  switch (type) {
    case 'note':     return { w: 300, h: 120 };
    case 'todo':     return { w: 300, h: 230 };
    case 'doc':      return { w: 300, h: 210 };
    case 'image':    return { w: 300, h: 220 };
    case 'link':     return { w: 400, h: 74 };
    case 'board':    return { w: 300, h: 240 };
    case 'column':   return { w: 320, h: 380 };
    case 'comment':  return { w: 280, h: 150 };
    case 'calendar': return { w: 520, h: 420 };
    case 'table':    return { w: 380, h: 220 };
    case 'audio':    return { w: 320, h: 140 };
    case 'color':    return { w: 220, h: 240 };
    case 'file':     return { w: 230, h: 150 };
    case 'frame':    return { w: 400, h: 400 };
    case 'bigtitle': return { w: 300, h: 80 };
    case 'map':      return { w: 340, h: 280 };
    case 'draw':     return { w: 420, h: 300 };
    default:         return { w: 260, h: 160 };
  }
}
window.defaultDims = defaultDims;

function ToolGhost({ x, y, tool, lang }) {
  const t = window.TRANSLATIONS[lang];
  const conf = (window.TOOLS || []).find(t => t.id === tool);
  return (
    <div style={{
      position: 'fixed', left: x, top: y,
      transform: 'translate(8px, 8px)',
      pointerEvents: 'none',
      zIndex: 9999,
      background: 'var(--paper)',
      border: '1.5px solid var(--line)',
      borderRadius: 8,
      boxShadow: 'var(--pop)',
      padding: '6px 10px',
      display: 'flex', alignItems: 'center', gap: 7,
      fontSize: 12, fontWeight: 600,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        background: conf?.bg || 'var(--paper)',
        color: conf?.fg || 'var(--ink)',
        border: '1.5px solid var(--line)',
        display: 'grid', placeItems: 'center',
      }}>
        <span className="material-symbols-rounded" style={{fontSize:14}}>{conf?.icon || 'add'}</span>
      </div>
      <span>{t[conf?.label] || tool}</span>
    </div>
  );
}

// Pleasant random color (HSL → hex) for new color nodes
function randomHex() {
  const h = Math.random() * 360;
  const s = 0.55 + Math.random() * 0.2;   // 55–75% saturation
  const l = 0.52 + Math.random() * 0.14;  // 52–66% lightness
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function makeNewItem(type, x, y, w, h, lang) {
  // Toda creación de nodo pasa por aquí, sea desde la barra, el menú del botón
  // derecho o pegando: es el único sitio donde contarlo una vez y sin repetir.
  window.odiTrack && window.odiTrack('nodo_creado', { tipo: type });
  const id = `it-${Date.now()}-${Math.floor(Math.random()*9999)}`;
  const base = { id, x, y, _new: true };
  const defaultSize = (defW, defH) => ({ w: Math.max(80, w || defW), h: Math.max(40, h || defH) });
  switch (type) {
    case 'note':
      return { ...base, type: 'note', ...defaultSize(300, 120), color: 'white', content: { es: '', en: '' } };
    case 'todo':
      return { ...base, type: 'todo', ...defaultSize(300, 230),
        title: { es: 'Pendientes', en: 'To-do' },
        items: [{ id: `t-${Date.now()}-1`, text: { es: '', en: '' }, done: false, indent: 0 }] };
    case 'doc':
      return { ...base, type: 'doc', ...defaultSize(300, 210),
        title: { es: 'Sin título', en: 'Untitled' },
        body:  { es: '', en: '' } };
    case 'image':
      return { ...base, type: 'image', ...defaultSize(300, 220) };
    case 'link':
      return { ...base, type: 'link', ...defaultSize(400, 74), url: '', showPreview: true };
    case 'board': {
      const cid = `b-${Date.now()}-${Math.floor(Math.random()*9999)}`;
      return { ...base, type: 'board', ...defaultSize(300, 240), color: 'white',
        canvasId: cid, icon: 'dashboard',
        content: { es: 'Nuevo tablero', en: 'New board' } };
    }
    case 'column':
      return { ...base, type: 'column', ...defaultSize(320, 380), color: 'white', icon: 'view_column',
        content: { es: 'Nueva columna', en: 'New column' }, children: [] };
    case 'comment':
      return { ...base, type: 'comment', ...defaultSize(280, 150),
        avatar: 'A', avatarColor: 'sage',
        name: window.t('Tú', 'You'),
        text: { es: '', en: '' } };
    case 'calendar':
      return { ...base, type: 'calendar', ...defaultSize(520, 420), events: {} };
    case 'table':
      return { ...base, type: 'table', ...defaultSize(380, 220),
        rows: 4, cols: 3,
        cells: {}, // keyed by "r,c" → { value, bold, italic, underline, strike, color, align, type }
        title: { es: '', en: '' },
        caption: { es: '', en: '' } };
    case 'audio':
      return { ...base, type: 'audio', ...defaultSize(320, 140), name: '', src: '', size: 0, loop: false, autoplay: false, showCaption: false };
    case 'color':
      return { ...base, type: 'color', ...defaultSize(220, 240), hex: randomHex(), showHex: true };
    case 'file':
      return { ...base, type: 'file', ...defaultSize(230, 150), name: '', src: '', size: 0, fileType: '', showPreview: false, showInfo: false, _triggerFilePick: true };
    case 'frame':
      return { ...base, type: 'frame', ...defaultSize(400, 400),
        color: 'transparent',
        title: { es: 'Nuevo marco', en: 'New frame' },
        titleColor: 'inherit',
        titleAlign: 'left',
        children: [] };
    case 'bigtitle':
      return { ...base, type: 'bigtitle', ...defaultSize(300, 80),
        color: 'transparent',
        align: 'center',
        content: { es: 'Título Grande', en: 'Large Title' } };
    case 'draw': {
      const size = defaultSize(420, 300);
      // Nace vacío y abre el modo dibujo solo: nadie coloca un lienzo en
      // blanco para mirarlo.
      return { ...base, type: 'draw', ...size, strokes: [], vw: size.w, vh: size.h, _startDrawing: true };
    }
    case 'map':
      return { ...base, type: 'map', ...defaultSize(340, 280),
        title: { es: 'Mapa de Google', en: 'Google Map' },
        url: '',
        caption: { es: '', en: '' } };
    default:
      return null;
  }
}

// ───── anchor helper (must match Connector.jsx) ─────
function anchorPos(item, anchor) {
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2;
  switch (anchor) {
    case 'top':    return { x: cx, y: item.y };
    case 'bottom': return { x: cx, y: item.y + item.h };
    case 'left':   return { x: item.x, y: cy };
    case 'right':  return { x: item.x + item.w, y: cy };
    default:       return { x: cx, y: cy };
  }
}
function closestAnchor(item, x, y) {
  const opts = ['top','right','bottom','left'].map(a => ({ a, p: anchorPos(item, a) }));
  opts.sort((u, v) => {
    const du = (u.p.x - x) ** 2 + (u.p.y - y) ** 2;
    const dv = (v.p.x - x) ** 2 + (v.p.y - y) ** 2;
    return du - dv;
  });
  return opts[0].a;
}

function cleanupOrtho(ortho) {
  console.log('[DEBUG-ORTHO-CANVAS] Entrada cleanupOrtho:', JSON.stringify(ortho));
  if (!ortho || ortho.length <= 1) return ortho;

  let currentPts = ortho.map(p => ({ x: p.x, y: p.y }));
  let changed = true;
  let iterations = 0;
  const THRESHOLD = 10;

  while (changed && iterations < 5) {
    changed = false;
    iterations++;

    // 1. Alinear puntos casi alineados en el mismo eje
    for (let i = 0; i < currentPts.length - 1; i++) {
      const p1 = currentPts[i];
      const p2 = currentPts[i + 1];
      if (Math.abs(p1.x - p2.x) > 0 && Math.abs(p1.x - p2.x) < THRESHOLD) {
        p2.x = p1.x;
        changed = true;
      }
      if (Math.abs(p1.y - p2.y) > 0 && Math.abs(p1.y - p2.y) < THRESHOLD) {
        p2.y = p1.y;
        changed = true;
      }
    }

    // 2. Fusionar puntos coincidentes o muy cercanos (eliminar stubs)
    let merged = [currentPts[0]];
    for (let i = 1; i < currentPts.length; i++) {
      const prev = merged[merged.length - 1];
      const cur = currentPts[i];
      const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      if (dist < THRESHOLD) {
        changed = true;
      } else {
        merged.push(cur);
      }
    }
    currentPts = merged;

    if (currentPts.length <= 2) break;

    // 3. Eliminar puntos colineales
    let nonCollinear = [currentPts[0]];
    for (let i = 1; i < currentPts.length - 1; i++) {
      const prev = nonCollinear[nonCollinear.length - 1];
      const cur = currentPts[i];
      const next = currentPts[i + 1];

      const isCollinearX = Math.abs(prev.x - cur.x) < THRESHOLD && Math.abs(cur.x - next.x) < THRESHOLD;
      const isCollinearY = Math.abs(prev.y - cur.y) < THRESHOLD && Math.abs(cur.y - next.y) < THRESHOLD;

      if (isCollinearX) {
        cur.x = prev.x;
        next.x = prev.x;
        changed = true;
      } else if (isCollinearY) {
        cur.y = prev.y;
        next.y = prev.y;
        changed = true;
      } else {
        nonCollinear.push(cur);
      }
    }
    nonCollinear.push(currentPts[currentPts.length - 1]);
    currentPts = nonCollinear;

    if (currentPts.length <= 2) break;

    // 4. Eliminar zigzags/bucles en "U" redundantes (backtracking)
    let cleanLoops = [currentPts[0]];
    for (let i = 1; i < currentPts.length; i++) {
      const last = cleanLoops[cleanLoops.length - 1];
      const cur = currentPts[i];
      if (i < currentPts.length - 1) {
        const next = currentPts[i + 1];
        if (Math.abs(last.x - next.x) < THRESHOLD && Math.abs(last.y - cur.y) < THRESHOLD) {
          cleanLoops.pop();
          cleanLoops.push({ x: last.x, y: next.y });
          i++;
          changed = true;
          continue;
        }
      }
      cleanLoops.push(cur);
    }
    currentPts = cleanLoops;

    if (currentPts.length <= 2) break;

    // 5. Eliminar picos estrechos (zigzags de ida y vuelta muy pegados)
    let cleanPikes = [currentPts[0]];
    const PIKE_THRESHOLD = 15;
    for (let i = 1; i < currentPts.length - 1; i++) {
      const prev = cleanPikes[cleanPikes.length - 1];
      const cur = currentPts[i];
      const next = currentPts[i + 1];

      const isVerticalPike = Math.abs(prev.x - next.x) < PIKE_THRESHOLD;
      const isHorizontalPike = Math.abs(prev.y - next.y) < PIKE_THRESHOLD;

      if (isVerticalPike) {
        next.x = prev.x;
        changed = true;
      } else if (isHorizontalPike) {
        next.y = prev.y;
        changed = true;
      } else {
        cleanPikes.push(cur);
      }
    }
    cleanPikes.push(currentPts[currentPts.length - 1]);
    currentPts = cleanPikes;
  }

  console.log('[DEBUG-ORTHO-CANVAS] Salida cleanupOrtho:', JSON.stringify(currentPts));
  if (currentPts.length === 0) return ortho;
  return currentPts;
}

function duplicateCanvasState(state, origId, newId) {
  if (!state[origId]) return;
  const origCanvas = state[origId];
  const canvasIdMap = {};
  const innerCanvasDuplications = [];
  const duplicatedItems = origCanvas.items.map(it => {
    const itemNewId = `it-${Date.now()}-${Math.floor(Math.random()*99999)}-${Math.floor(Math.random()*99999)}`;
    canvasIdMap[it.id] = itemNewId;
    const copy = { ...it, id: itemNewId };
    if (copy.type === 'board' && copy.canvasId) {
      const innerNewCid = `b-${Date.now()}-${Math.floor(Math.random()*99999)}`;
      copy.canvasId = innerNewCid;
      innerCanvasDuplications.push({ orig: it.canvasId, next: innerNewCid });
    }
    return copy;
  });

  const duplicatedConnectors = (origCanvas.connectors || []).map(co => {
    const connNewId = `co-${Date.now()}-${Math.floor(Math.random()*99999)}`;
    const copy = { ...co, id: connNewId };
    if (copy.fromEnd && canvasIdMap[copy.fromEnd.itemId]) {
      copy.fromEnd = { ...copy.fromEnd, itemId: canvasIdMap[copy.fromEnd.itemId] };
    }
    if (copy.toEnd && canvasIdMap[copy.toEnd.itemId]) {
      copy.toEnd = { ...copy.toEnd, itemId: canvasIdMap[copy.toEnd.itemId] };
    }
    return copy;
  });

  state[newId] = {
    ...origCanvas,
    items: duplicatedItems,
    connectors: duplicatedConnectors
  };

  innerCanvasDuplications.forEach(({ orig, next }) => {
    duplicateCanvasState(state, orig, next);
  });
}

// Zoom con el que se abre un lienzo que aún no tiene cámara guardada.
const defaultScale = () => (window.odiIsMobile && window.odiIsMobile()) ? 0.7 : 1;

function Canvas({ projectId, lang, setLang, theme, setTheme, onHome, canvasesIn, setCanvases: setExtCanvases, updateAvailable, onUpdateClick, volume, onChangeVolume, onSettingsClick, vaultPath, userProfile, onUserClick, projects, setProjects, onSharingClick, onManualSync, isSyncingDrive, needsDriveAuth, driveReachable, jumpTarget, onSearchClick, onGoToNode, onGraphClick, initialTrail, onTrailChange }) {
  const currentProject = projects ? projects.find(p => p.id === projectId) : null;
  const [canvases, _setCanvases] = useStateCanvas(() => canvasesIn || JSON.parse(JSON.stringify(window.INITIAL_CANVASES)));
  // Stable ref to App's setter — avoids the infinite loop caused by it being a dep on every render
  const setExtCanvasesRef = useRefCanvas(setExtCanvases);
  setExtCanvasesRef.current = setExtCanvases;

  // Track canvases we sent to App to avoid circular updates and old echoes overwriting local state
  const sentCanvasesRef = useRefCanvas(new Set());

  // Sync canvas state up to the App (for persistence). Skipped during an active drag/resize
  // (body.odi-busy) so we don't trigger a full App+Canvas re-render on every mouse-move frame.
  // The final committed change (odi-busy removed on mouseup) syncs normally, so nothing is lost.
  useEffectCanvas(() => {
    if (document.body.classList.contains('odi-busy')) return;
    if (setExtCanvasesRef.current) {
      // Keep track of the reference we are sending to the parent
      sentCanvasesRef.current.add(canvases);
      // Bounded set size to prevent memory leaks
      if (sentCanvasesRef.current.size > 50) {
        const first = sentCanvasesRef.current.values().next().value;
        sentCanvasesRef.current.delete(first);
      }
      setExtCanvasesRef.current(canvases);
    }
  }, [canvases]);

  // Sync external changes (e.g. from media saving or vault loading) into local canvas state
  // Skip while dragging/resizing (odi-busy) to prevent the debounced App save from resetting
  // node positions mid-drag and causing the "convulsion" jitter bug.
  useEffectCanvas(() => {
    if (document.body.classList.contains('odi-busy')) return;
    if (canvasesIn) {
      // Avoid circular update loops and old echoes overwriting newer local state
      if (sentCanvasesRef.current.has(canvasesIn)) return;
      _setCanvases(canvasesIn);
    }
  }, [canvasesIn]);

  const setCanvases = (updater) => {
    _setCanvases(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  };

  // Se vuelve al tablero donde estabas, no al lienzo raiz. El rastro guardado
  // se valida antes de usarlo: si borraste uno de esos tableros entre sesiones,
  // se entra hasta el ultimo que siga existiendo en vez de fallar.
  const [stack, setStack] = useStateCanvas(() => {
    const guardado = Array.isArray(initialTrail) ? initialTrail : null;
    if (!guardado || guardado[0] !== projectId) return [projectId];
    const base = canvasesIn || {};
    const valido = [projectId];
    for (let i = 1; i < guardado.length; i++) {
      const cid = guardado[i];
      const padre = base[valido[valido.length - 1]];
      const existe = base[cid] && padre && (padre.items || []).some(it => it.canvasId === cid);
      if (!existe) break;
      valido.push(cid);
    }
    return valido;
  });

  // Se avisa hacia arriba para que el rastro se guarde con el resto del estado.
  const onTrailChangeRef = useRefCanvas(onTrailChange);
  onTrailChangeRef.current = onTrailChange;
  useEffectCanvas(() => {
    if (onTrailChangeRef.current) onTrailChangeRef.current(stack);
  }, [stack]);
  const [transition, setTransition] = useStateCanvas(null);

  const currentId = stack[stack.length - 1];
  const current = canvases[currentId] || {
    title: { es: 'Sin titulo', en: 'Untitled' },
    items: [],
    connectors: [],
  };

  // ───── Sesión en vivo ─────
  //
  // Todo el trabajo del lienzo pasa por el estado de arriba, así que aquí está
  // el único sitio donde hay que mirar para saber qué mandar: se compara con
  // lo último que se envió y solo viaja la diferencia. Lo que llega del otro
  // lado entra por _setCanvases, sin pasar por el historial y marcado para que
  // no rebote de vuelta.
  const sesionRef = useRefCanvas(null);
  const ultimoEnviadoRef = useRefCanvas(null);
  const aplicandoRemotoRef = useRefCanvas(false);
  const [cursoresAjenos, setCursoresAjenos] = useStateCanvas({});   // uid -> {x, y, lienzo, color, nombre}
  const [participantes, setParticipantes] = useStateCanvas([]);

  const aplicaRemoto = useCallbackCanvas((ops) => {
    if (!ops || !ops.length) return;
    aplicandoRemotoRef.current = true;
    skipHistory.current = true;
    _setCanvases(prev => {
      const next = window.OdiSync.aplica(prev, ops);
      // Lo que llega del otro no debe volver a salir hacia él.
      ultimoEnviadoRef.current = next;
      return next;
    });
  }, []);

  // Envío: cada cambio local se compara con lo último enviado.
  useEffectCanvas(() => {
    const s = sesionRef.current;
    if (!s) { ultimoEnviadoRef.current = canvases; return; }
    if (aplicandoRemotoRef.current) { aplicandoRemotoRef.current = false; return; }
    if (ultimoEnviadoRef.current === canvases) return;
    // Durante un arrastre se dejan pasar los cambios igual: son 50 bytes por
    // fotograma y es justo lo que hace que el otro vea el nodo moverse.
    const ops = window.OdiSync.diff(ultimoEnviadoRef.current || {}, canvases);
    ultimoEnviadoRef.current = canvases;
    if (ops.length) s.envia({ t: 'ops', ops }, null);
  }, [canvases]);

  // El puntero se manda aparte y con cuentagotas: 20 veces por segundo basta
  // para que se vea fluido, y así no se mezcla con los cambios de verdad.
  const ultimoCursorRef = useRefCanvas(0);
  const mandaCursor = useCallbackCanvas((clientX, clientY) => {
    const s = sesionRef.current;
    if (!s) return;
    const ahora = Date.now();
    if (ahora - ultimoCursorRef.current < 50) return;
    ultimoCursorRef.current = ahora;
    const p = screenToCanvas(clientX, clientY);
    s.envia({ t: 'cursor', x: Math.round(p.x), y: Math.round(p.y), lienzo: currentId }, null);
  }, [currentId]);

  const colorDe = (uid) => {
    const p = participantes.find(x => x.uid === uid);
    return (p && p.color) || '#595459';
  };
  const nombreDe = (uid) => {
    const p = participantes.find(x => x.uid === uid);
    return (p && p.nombre) || 'Invitado';
  };

  const recibeMensaje = useCallbackCanvas((m, de) => {
    if (m.t === 'ops') { aplicaRemoto(m.ops); return; }

    if (m.t === 'cursor') {
      setCursoresAjenos(prev => ({ ...prev, [de]: { x: m.x, y: m.y, lienzo: m.lienzo, visto: Date.now() } }));
      return;
    }

    if (m.t === 'quienes') { setParticipantes(m.lista || []); return; }

    if (m.t === 'proyecto') {
      // Quien acaba de entrar recibe el proyecto entero una sola vez y a
      // partir de ahí solo los cambios.
      //
      // Se MEZCLA, no se sustituye: los lienzos que trae el anfitrión se
      // añaden a los que ya tenía esta persona. Sustituir el estado entero le
      // borraría del disco sus propios proyectos, porque este mismo estado es
      // el que se guarda.
      aplicandoRemotoRef.current = true;
      skipHistory.current = true;
      _setCanvases(prev => {
        const mezcla = { ...prev, ...(m.canvases || {}) };
        ultimoEnviadoRef.current = mezcla;
        return mezcla;
      });
      // Y hay que ir a SU tablero: el invitado seguía mirando el suyo, que no
      // existe en el proyecto del anfitrión, así que veía un lienzo vacío.
      if (m.raiz) setStack([m.raiz]);
      showToastCanvas(window.t('Proyecto recibido del anfitrión.', 'Project received from the host.'));
      return;
    }

    if (m.t === 'adios') {
      setCursoresAjenos(prev => { const n = { ...prev }; delete n[de]; return n; });
    }
  }, [aplicaRemoto]);

  const showToastCanvas = (msg, tipo) => { window.showToast && window.showToast(msg, tipo); };

  const desconectaSesion = useCallbackCanvas(async () => {
    const s = sesionRef.current;
    sesionRef.current = null;
    setParticipantes([]);
    setCursoresAjenos({});
    if (s) await s.cierra();
  }, []);

  const conectaSesion = useCallbackCanvas(async ({ modo, codigo, nombre }) => {
    if (sesionRef.current) await desconectaSesion();
    const callbacks = {
      onMensaje: recibeMensaje,
      onParticipantes: (lista) => setParticipantes(lista),
      onEstado: (estado, uid) => {
        if (estado === 'conectado') {
          showToastCanvas(window.t('Alguien se ha unido a la sesión.', 'Someone joined the session.'));
        } else if (estado === 'desconectado' || estado === 'failed') {
          setCursoresAjenos(prev => { const n = { ...prev }; delete n[uid]; return n; });
        }
      },
      onError: (err) => {
        console.error('[SALA]', err);
        showToastCanvas(window.t('Error en la sesión en vivo: ' + err.message, 'Live session error: ' + err.message), 'error');
      },
      // Lo que se le manda a quien entra: el proyecto tal y como está ahora.
      pideProyecto: () => ({ canvases: canvasesLiveRef.current, raiz: projectId }),
    };
    const s = modo === 'abrir'
      ? await window.OdiRealtime.abreSala({ nombre, callbacks })
      : await window.OdiRealtime.entraSala({ codigo, nombre, callbacks });
    sesionRef.current = s;
    ultimoEnviadoRef.current = canvasesLiveRef.current;
    return { codigo: s.codigo };
  }, [recibeMensaje, desconectaSesion, projectId]);

  // El modal de compartir vive en app.jsx; se le deja aquí el mando, como ya
  // se hace con otras piezas que necesitan hablar entre archivos.
  useEffectCanvas(() => {
    window.__odiVivo = {
      conecta: conectaSesion,
      desconecta: desconectaSesion,
      activa: () => !!sesionRef.current,
      codigo: () => sesionRef.current && sesionRef.current.codigo,
      participantes: () => participantes,
      diagnostico: () => sesionRef.current && sesionRef.current.diagnostico(),
    };
    return () => { delete window.__odiVivo; };
  }, [conectaSesion, desconectaSesion, participantes]);

  // Un cursor que lleva diez segundos sin moverse es alguien que se fue sin
  // avisar (cerró el portátil, se cayó el wifi): se retira solo.
  useEffectCanvas(() => {
    if (!Object.keys(cursoresAjenos).length) return;
    const t = setInterval(() => {
      const corte = Date.now() - 10000;
      setCursoresAjenos(prev => {
        let cambio = false;
        const n = {};
        Object.keys(prev).forEach(k => {
          if (prev[k].visto > corte) n[k] = prev[k]; else cambio = true;
        });
        return cambio ? n : prev;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [cursoresAjenos]);


  useEffectCanvas(() => {
    if (canvases[currentId]) return;
    setCanvases(prev => ({
      ...prev,
      [currentId]: {
        title: { es: 'Sin titulo', en: 'Untitled' },
        items: [],
        connectors: [],
      },
    }));
  // eslint-disable-next-line
  }, [currentId]);

  const [pan, setPan] = useStateCanvas({ x: 40, y: 20 });
  // En un móvil, al 100% una nota corriente (300px) ocupa el 80% del ancho y
  // no ves nada alrededor. Los lienzos sin cámara guardada se abren más
  // alejados para tener contexto; acercar es un pellizco.
  const [scale, setScale] = useStateCanvas(defaultScale);
  const [showBgSelector, setShowBgSelector] = useStateCanvas(false);
  // Nodo sobre el que caería la flecha que se está arrastrando ahora mismo.
  const [linkTargetId, setLinkTargetId] = useStateCanvas(null);
  // Al crear una nota, el escritorio abre el editor de una. En el móvil eso
  // encadenaba tres cosas de golpe (nodo nuevo + salto de zoom + teclado) y
  // era justo lo que se sentía descontrolado: ahora se crea seleccionada y se
  // entra a escribir con un toque doble, cuando tú quieras.
  const skipAutoEdit = () => !!(window.odiIsMobile && window.odiIsMobile());
  const [windowSize, setWindowSize] = useStateCanvas({ w: window.innerWidth, h: window.innerHeight });
  useEffectCanvas(() => {
    const handleResize = () => {
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Refs to always have the latest pan, scale, and currentId in cleanup effects
  const panRef = useRefCanvas(pan);
  panRef.current = pan;
  const scaleRef = useRefCanvas(scale);
  scaleRef.current = scale;
  const currentIdRef = useRefCanvas(currentId);
  currentIdRef.current = currentId;

  // Load saved camera when currentId changes
  useEffectCanvas(() => {
    setCroppingId(null);
    const saved = canvases[currentId];
    if (saved && saved.pan && saved.scale !== undefined) {
      // Si el lienzo ya tiene cámara guardada se respeta tal cual, también en
      // móvil: es el zoom que el usuario dejó puesto.
      setPan(saved.pan);
      setScale(saved.scale);
    } else {
      setPan({ x: 40, y: 20 });
      setScale(defaultScale());
    }
  // eslint-disable-next-line
  }, [currentId]);

  // Clear selection and editing states on canvas level change to prevent crashes/inconsistencies
  useEffectCanvas(() => {
    setSelected(null);
    setSelectedIds([]);
    setSelectedConn(null);
    setEditing(null);
    setEditingChildState(null);
    setContextMenu(null);
    setShowBgSelector(false);
  }, [currentId]);

  // Save the camera when navigating away from currentId or when unmounting Canvas
  useEffectCanvas(() => {
    const cid = currentId;
    return () => {
      const p = panRef.current;
      const s = scaleRef.current;
      if (cid) {
        // Save to local copy
        _setCanvases(prev => {
          const existing = prev[cid];
          if (!existing) return prev;
          return {
            ...prev,
            [cid]: {
              ...existing,
              pan: p,
              scale: s
            }
          };
        });
        // Save to parent copy directly so it's not lost on unmount!
        if (setExtCanvasesRef.current) {
          setExtCanvasesRef.current(prev => {
            const existing = prev[cid];
            if (!existing) return prev;
            return {
              ...prev,
              [cid]: {
                ...existing,
                pan: p,
                scale: s
              }
            };
          });
        }
      }
    };
  }, [currentId]);

  const [selected, setSelected] = useStateCanvas(null);
  const [selectedIds, setSelectedIds] = useStateCanvas([]); // multi-select (rect drag)
  const [marquee, setMarquee] = useStateCanvas(null); // {x, y, w, h} in canvas coords while drag-selecting
  const [selectedConn, setSelectedConn] = useStateCanvas(null);
  const [connLabelOpen, setConnLabelOpen] = useStateCanvas(false); // connector label input open
  const [editing, setEditing] = useStateCanvas(null);
  const [captionFocusId, setCaptionFocusId] = useStateCanvas(null); // node whose rich caption ("leyenda") is focused
  const [zOrder, setZOrder] = useStateCanvas([]); // node ids in the order they were last touched (last = top layer)
  const [search, setSearch] = useStateCanvas('');
  const [activeTool, setActiveTool] = useStateCanvas(null);
  const [contextMenu, setContextMenu] = useStateCanvas(null);
  const [docOpen, setDocOpen] = useStateCanvas(null); // { id, colId? }
  const [fileOpen, setFileOpen] = useStateCanvas(null); // { id } — file viewer modal

  // connector being drawn (preview)
  const [pendingConn, setPendingConn] = useStateCanvas(null); // {fromId, fromAnchor, mx, my} or {fromX,fromY,...}
  // drop target column for current item drag
  const [dropTargetCol, setDropTargetCol] = useStateCanvas(null);
  const [dropTargetTodo, setDropTargetTodo] = useStateCanvas(null);

  // drag-to-create preview
  const [dragCreate, setDragCreate] = useStateCanvas(null); // { x,y,w,h, sx,sy }
  // tool ghost (drag-from-toolbar)
  const [toolGhost, setToolGhost] = useStateCanvas(null);

  // undo stack
  const [history, setHistory] = useStateCanvas([]);
  const [historyIdx, setHistoryIdx] = useStateCanvas(-1);
  const [croppingId, setCroppingId] = useStateCanvas(null);

  // ── Modo dibujo ──
  //
  // Funciona como el recorte de una imagen: un nodo entra en un modo propio,
  // la barra de la izquierda cambia a sus herramientas y el resto del lienzo
  // se aparta. La diferencia es que aquí se trabaja sobre una COPIA (la
  // sesión): así "Descartar" es gratis y todo lo dibujado entra en el
  // historial general como un solo paso al guardar.
  const [drawingId, setDrawingId] = useStateCanvas(null);
  const [drawSession, setDrawSession] = useStateCanvas(null); // { strokes, past, future }
  const [drawTool, setDrawTool] = useStateCanvas('pen');      // pen | move | eraser
  const [drawColor, setDrawColor] = useStateCanvas('#E6544F');
  const [drawWidth, setDrawWidth] = useStateCanvas(4);
  const [drawPressureMode, setDrawPressureMode] = useStateCanvas('auto');
  const [selectedStrokeId, setSelectedStrokeId] = useStateCanvas(null);

  // alignment guides and dragged task ghost
  const [guides, setGuides] = useStateCanvas(null);
  const [draggedTask, setDraggedTask] = useStateCanvas(null);
  const skipHistory = useRefCanvas(false);

  const surfaceRef = useRefCanvas(null);
  const ctxMenuRef = useRefCanvas(null); // right-click menu element (for edge-flip positioning)
  const pasteIntRef = useRefCanvas(null);
  // Last known mouse position (screen coords) — used to paste copied nodes where the cursor is
  const lastMouseRef = useRefCanvas({ x: 0, y: 0 });

  // Track interaction order: the node touched last goes to the end (top layer) and the
  // previously-touched nodes keep their relative stacking. Untouched nodes stay at the bottom.
  useEffectCanvas(() => {
    if (selected) setZOrder(prev => [...prev.filter(id => id !== selected), selected]);
  }, [selected]);

  // Rich captions ("leyendas") report focus/blur via these globals so the caption
  // format sidebar can appear next to them without threading props into every node.
  useEffectCanvas(() => {
    window.__odiCaptionFocus = (id) => setCaptionFocusId(id);
    window.__odiCaptionBlur  = () => setCaptionFocusId(null);
    return () => { delete window.__odiCaptionFocus; delete window.__odiCaptionBlur; };
  }, []);

  // ───── History ─────
  // Última instantánea registrada: evita guardar estados idénticos (los
  // micro-ajustes automáticos, como recalcular la altura de una nota, producían
  // entradas invisibles y hacían que Ctrl+Z "no hiciera nada" visible).
  const lastSnapRef = useRefCanvas(null);
  const historyTimerRef = useRefCanvas(null);

  // Espejos en refs para poder leer/actualizar el historial de forma síncrona
  const historyRef = useRefCanvas([]);
  const historyIdxRef = useRefCanvas(-1);
  historyRef.current = history;
  historyIdxRef.current = historyIdx;
  // Estado vivo del lienzo (evita leer datos obsoletos desde un closure viejo)
  const canvasesLiveRef = useRefCanvas(canvases);
  canvasesLiveRef.current = canvases;

  const pushHistory = useCallbackCanvas((snap) => {
    if (lastSnapRef.current === snap) return; // sin cambios reales
    lastSnapRef.current = snap;
    const cut = historyRef.current.slice(0, historyIdxRef.current + 1);
    cut.push(snap);
    if (cut.length > 50) cut.shift();
    historyRef.current = cut;
    historyIdxRef.current = cut.length - 1;
    setHistory(cut);
    setHistoryIdx(cut.length - 1);
  }, []);

  // Se agrupan los cambios rápidos (escribir letra por letra, arrastrar) en una
  // sola entrada tras una pausa, para que cada Ctrl+Z deshaga algo perceptible.
  useEffectCanvas(() => {
    if (skipHistory.current) { skipHistory.current = false; return; }
    const snap = JSON.stringify(canvases);
    // La primera instantánea se guarda de inmediato (estado base del lienzo)
    if (lastSnapRef.current === null) { pushHistory(snap); return; }
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      historyTimerRef.current = null;
      pushHistory(snap);
    }, 450);
  // eslint-disable-next-line
  }, [canvases]);

  const applySnapshot = (idx) => {
    const snapStr = historyRef.current[idx];
    if (snapStr == null) return;
    skipHistory.current = true;
    lastSnapRef.current = snapStr;
    historyIdxRef.current = idx;
    setHistoryIdx(idx);
    _setCanvases(JSON.parse(snapStr));
  };

  const undo = () => {
    if (historyTimerRef.current) { clearTimeout(historyTimerRef.current); historyTimerRef.current = null; }
    // Volcar los cambios aún no registrados (p. ej. lo que se acaba de escribir)
    // para que este Ctrl+Z los pueda deshacer en lugar de perderse.
    const live = JSON.stringify(canvasesLiveRef.current);
    if (live !== lastSnapRef.current) pushHistory(live);
    if (historyIdxRef.current <= 0) return;
    applySnapshot(historyIdxRef.current - 1);
  };
  const redo = () => {
    if (historyTimerRef.current) { clearTimeout(historyTimerRef.current); historyTimerRef.current = null; }
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    applySnapshot(historyIdxRef.current + 1);
  };

  // ───── Reset state on canvas change ─────
  useEffectCanvas(() => {
    setSelected(null);
    setSelectedIds([]);
    setSelectedConn(null);
    setConnLabelOpen(false);
    setEditing(null);
    setContextMenu(null);
    setPendingConn(null);
    setDropTargetCol(null);
  }, [currentId]);

  // ───── Auto-clear _new flags so dragging doesn't replay animation ─────
  useEffectCanvas(() => {
    const hasNew = current?.items?.some(i => i._new);
    if (!hasNew) return;
    const t = setTimeout(() => {
      skipHistory.current = true;
      _setCanvases(prev => {
        const c = prev[currentId];
        if (!c) return prev;
        return { ...prev, [currentId]: { ...c, items: c.items.map(it => it._new ? { ...it, _new: false } : it) } };
      });
    }, 300);
    return () => clearTimeout(t);
  }, [current?.items, currentId]);

  // ───── Wheel pan/zoom ─────
  useEffectCanvas(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e) => {
      const target = e.target;
      const isScrollable = (element) => {
        if (!element || element === el) return false;
        if (element.tagName === 'IFRAME') return true;
        const style = window.getComputedStyle(element);
        const overflowY = style.overflowY || '';
        const overflowX = style.overflowX || '';
        const isScrollableY = (overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight;
        const isScrollableX = (overflowX === 'auto' || overflowX === 'scroll') && element.scrollWidth > element.clientWidth;
        if (isScrollableY || isScrollableX) return true;
        return isScrollable(element.parentElement);
      };
      if (isScrollable(target)) {
        return; // Allow native scroll / pan / zoom behavior inside the iframe/scrollable area
      }

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const delta = -e.deltaY * 0.0015;
        setScale(s => {
          const raw = Math.min(2.5, Math.max(0.2, s * (1 + delta)));
          const ns = Math.round(raw * 20) / 20;
          setPan(p => ({ x: mx - (mx - p.x) * (ns / s), y: my - (my - p.y) * (ns / s) }));
          return ns;
        });
      } else {
        e.preventDefault();
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    // Red de seguridad: si algo (foco por teclado, scrollIntoView, etc.) desplaza
    // el canvas o sus ancestros, lo devolvemos a 0 para que nada "suba" la interfaz
    // ni descuadre las coordenadas del zoom/paneo.
    const resetScroll = () => {
      let node = el;
      while (node) {
        if (node.scrollTop || node.scrollLeft) { node.scrollTop = 0; node.scrollLeft = 0; }
        node = node.parentElement;
      }
    };
    const scrollTargets = [];
    let n = el;
    while (n) { scrollTargets.push(n); n = n.parentElement; }
    scrollTargets.forEach(t => t.addEventListener('scroll', resetScroll, { passive: true }));

    return () => {
      el.removeEventListener('wheel', onWheel);
      scrollTargets.forEach(t => t.removeEventListener('scroll', resetScroll));
    };
  }, []);

  // Quién enlaza al nodo seleccionado. Se recalcula solo al cambiar la
  // selección o el contenido, no en cada render: recorre todos los proyectos.
  const backlinksForSelected = useMemoCanvas(() => {
    if (!selected || !window.OdiLinks) return [];
    try {
      return window.OdiLinks.backlinksFor({
        projects: projects || [], canvases, targetItemId: selected, lang,
      });
    } catch (e) { return []; }
  }, [selected, canvases, projects, lang]);

  // ───── Salto desde el buscador global ─────
  // Baja por la cadena de tableros hasta el lienzo del resultado, centra el
  // nodo y lo resalta un momento. Sin esto, encontrar algo enterrado a cuatro
  // niveles no serviría de nada: sabrías dónde está pero no cómo llegar.
  const [jumpHighlight, setJumpHighlight] = useStateCanvas(null);
  useEffectCanvas(() => {
    if (!jumpTarget || jumpTarget.projectId !== projectId) return;
    const trail = (jumpTarget.trailIds && jumpTarget.trailIds.length)
      ? jumpTarget.trailIds
      : [projectId];
    // Si el salto salió de un enlace dentro de un documento, hay que cerrarlo:
    // si no, la vista viaja por detrás y el documento sigue tapándola, así que
    // parece que no ha pasado nada.
    setDocOpen(null);
    setFileOpen(null);
    setStack(trail);

    // Un respiro para que el lienzo destino ya esté montado y medido antes de
    // calcular dónde está el nodo.
    const t = setTimeout(() => {
      const canvas = canvases[jumpTarget.canvasId];
      const item = canvas && (canvas.items || []).find(i => i.id === jumpTarget.itemId);
      const el = surfaceRef.current;
      if (item && el) {
        const rect = el.getBoundingClientRect();
        const def = defaultDims(item.type);
        const w = item.w !== undefined ? item.w : def.w;
        const h = item.h !== undefined ? item.h : def.h;
        const s = scaleRef.current || 1;
        setPan({
          x: rect.width / 2 - (item.x + w / 2) * s,
          y: rect.height / 2 - (item.y + h / 2) * s,
        });
        setSelected(item.id);
      }
      setJumpHighlight(jumpTarget.itemId);

      // Tras mover la cámara de golpe, el navegador reutiliza la imagen que ya
      // tenía rasterizada de la capa transformada y se ve borrosa hasta que
      // algo la obliga a repintar (por eso se arreglaba al mover el lienzo a
      // mano). Este empujón de una milésima la fuerza a redibujarse nítida.
      if (el) {
        el.style.willChange = 'transform';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { if (el) el.style.willChange = ''; });
        });
      }
    }, 60);

    const clear = setTimeout(() => setJumpHighlight(null), 3400);
    return () => { clearTimeout(t); clearTimeout(clear); };
  }, [jumpTarget && jumpTarget.nonce]);

  // ───── Gestos táctiles del lienzo ─────
  // touch.js traduce un dedo a eventos de ratón para todo lo demás (arrastrar
  // nodos, tiradores, conectores…), pero se aparta del lienzo vacío: aquí un
  // dedo significa PANEAR. Dibujar una marquesina con el dedo sería inútil y
  // dejaría el lienzo inmóvil, que es justo lo que hace difícil usarlo en el
  // móvil hoy. Dos dedos = zoom de pellizco, como en cualquier mapa.
  useEffectCanvas(() => {
    const el = surfaceRef.current;
    if (!el) return;

    let mode = null;      // 'pan' | 'pinch' | null
    let start = null;
    let moved = false;
    let longPress = null;

    const clearLong = () => { if (longPress) { clearTimeout(longPress); longPress = null; } };
    const gap = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const isBareSurface = (target) => {
      if (!target) return false;
      if (el.classList.contains('placing') || el.classList.contains('linking')) return false;
      if (target === el) return true;
      const cl = target.classList;
      return !!cl && (cl.contains('canvas-surface') || cl.contains('canvas-content') ||
                      cl.contains('connectors') || cl.contains('board-cover-grid'));
    };

    const beginPinch = (e) => {
      clearLong();
      const rect = el.getBoundingClientRect();
      const a = e.touches[0], b = e.touches[1];
      mode = 'pinch';
      moved = true;
      start = {
        gap: gap(a, b) || 1,
        mx: (a.clientX + b.clientX) / 2 - rect.left,
        my: (a.clientY + b.clientY) / 2 - rect.top,
        scale: scaleRef.current,
        pan: { ...panRef.current },
      };
    };

    const onTouchStart = (e) => {
      if (e.touches.length >= 2) {
        beginPinch(e);
        if (e.cancelable) e.preventDefault();
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      const target = document.elementFromPoint(t.clientX, t.clientY) || e.target;
      if (!isBareSurface(target)) { mode = null; return; }

      mode = 'pan';
      moved = false;
      start = { x: t.clientX, y: t.clientY, pan: { ...panRef.current }, target };
      if (e.cancelable) e.preventDefault();

      // Mantener pulsado sobre el lienzo vacío abre el menú de crear nodo, que
      // en escritorio es el clic derecho.
      const px = t.clientX, py = t.clientY;
      clearLong();
      longPress = setTimeout(() => {
        longPress = null;
        if (mode !== 'pan' || moved) return;
        mode = null;
        target.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true, cancelable: true, view: window,
          clientX: px, clientY: py, button: 2,
        }));
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
      }, 520);
    };

    const onTouchMove = (e) => {
      if (mode === 'pinch') {
        if (e.touches.length < 2) return;
        if (e.cancelable) e.preventDefault();
        const a = e.touches[0], b = e.touches[1];
        const rect = el.getBoundingClientRect();
        const factor = (gap(a, b) || 1) / start.gap;
        const ns = Math.min(2.5, Math.max(0.2, start.scale * factor));
        // El punto del lienzo bajo el centro del pellizco debe quedarse quieto,
        // y además el centro puede desplazarse: eso panea mientras se hace zoom.
        const mx = (a.clientX + b.clientX) / 2 - rect.left;
        const my = (a.clientY + b.clientY) / 2 - rect.top;
        setScale(ns);
        setPan({
          x: mx - (start.mx - start.pan.x) * (ns / start.scale),
          y: my - (start.my - start.pan.y) * (ns / start.scale),
        });
        return;
      }
      if (mode !== 'pan') return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) { moved = true; clearLong(); }
      if (!moved) return;
      if (e.cancelable) e.preventDefault();
      setPan({ x: start.pan.x + dx, y: start.pan.y + dy });
    };

    const onTouchEnd = (e) => {
      clearLong();
      if (mode === 'pinch') {
        // Al soltar un dedo, el zoom termina; el que queda no debe dar un salto.
        if (e.touches.length === 1) {
          mode = 'pan';
          moved = true;
          start = { x: e.touches[0].clientX, y: e.touches[0].clientY, pan: { ...panRef.current } };
        } else {
          mode = null;
          setScale(s => Math.round(s * 20) / 20);
        }
        return;
      }
      if (e.touches.length === 0) {
        // Toque limpio sobre el lienzo vacío: en escritorio esto es un clic que
        // deselecciona y cierra el editor abierto. Como aquí bloqueamos los
        // eventos de compatibilidad para poder panear, lo emitimos a mano.
        if (mode === 'pan' && !moved && start && start.target) {
          const t = e.changedTouches[0];
          const init = {
            bubbles: true, cancelable: true, view: window,
            clientX: t ? t.clientX : start.x,
            clientY: t ? t.clientY : start.y,
            button: 0,
          };
          start.target.dispatchEvent(new MouseEvent('mousedown', { ...init, buttons: 1, detail: 1 }));
          start.target.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
        }
        mode = null;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });
    return () => {
      clearLong();
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // ───── Editar texto en móvil sin que el navegador secuestre el zoom ─────
  // Al enfocar un texto diminuto (el lienzo suele estar al 50%, o sea letra de
  // ~6px), el navegador móvil hace SU propio zoom para que se vea el cursor.
  // Ese zoom es del navegador, no del lienzo: los botones − / + no lo
  // deshacen y el usuario se queda encerrado. Adelantándonos y acercando
  // nosotros a 100%, el texto ya es legible y el navegador no interviene; y si
  // aun así lo hiciera, se puede salir con un pellizco (por eso el viewport ya
  // no lleva user-scalable=no).
  useEffectCanvas(() => {
    if (!editing) return;
    if (!(window.odiIsMobile && window.odiIsMobile())) return;
    const el = surfaceRef.current;
    const item = current.items.find(i => i.id === editing);
    if (!el || !item) return;
    const rect = el.getBoundingClientRect();
    const def = defaultDims(item.type);
    const w = item.w !== undefined ? item.w : def.w;
    const h = item.h !== undefined ? item.h : def.h;
    // El raíl de herramientas flota sobre el borde derecho, así que el ancho
    // realmente visible es menor: si no lo descontamos, el nodo que estás
    // escribiendo se mete por debajo del raíl.
    const RAIL = 76;
    const visibleW = rect.width - RAIL;
    // Acercamos lo justo para que el nodo quepa en ese ancho, nunca más del
    // 100%: saltar siempre al 100% dejaba una nota pequeña comiéndose toda la
    // pantalla. Y nunca alejamos, para no deshacer un zoom hecho a mano.
    const fit = Math.min(1, (visibleW - 16) / w);
    const ns = Math.max(scaleRef.current, fit);
    if (ns <= scaleRef.current + 0.01) return; // ya se lee bien: no tocar la vista
    setScale(ns);
    // Un tercio de alto en vez de la mitad: el teclado se come la parte de
    // abajo, así el nodo que se está editando queda por encima de él.
    setPan({
      x: visibleW / 2 - (item.x + w / 2) * ns,
      y: rect.height * 0.32 - (item.y + h / 2) * ns,
    });
  }, [editing]);

  // ───── Keyboard ─────
  useEffectCanvas(() => {
    const onKey = (e) => {
      const matchShortcut = (s) => {
        if (!s || !window.shortcuts) return false;
        const eKey = e.key.toLowerCase();
        const configKey = s.key.toLowerCase();
        const hasCtrl = e.ctrlKey || e.metaKey;
        return eKey === configKey &&
               hasCtrl === !!s.ctrl &&
               e.shiftKey === !!s.shift &&
               e.altKey === !!s.alt;
      };
      // Con el visor de archivos o el editor de documentos abiertos, el lienzo
      // no ejecuta NINGUNO de sus atajos: cada uno tiene los suyos y su propio
      // Esc. Antes solo se comprobaba el visor, y por eso pulsar Suprimir en el
      // documento mientras el foco no estaba dentro del texto —por ejemplo tras
      // usar un botón de la barra— borraba el nodo entero del lienzo.
      if (fileOpen || docOpen) return;
      // Mientras se dibuja, el lienzo cede el teclado al modo dibujo: aquí
      // Ctrl+Z deshace trazos y Suprimir borra el trazo elegido, no el nodo.
      if (drawingId) {
        if (e.key === 'Escape') { e.preventDefault(); saveDrawing(); return; }
        if (matchShortcut(window.shortcuts.undo)) { e.preventDefault(); drawUndo(); return; }
        if (matchShortcut(window.shortcuts.redo)) { e.preventDefault(); drawRedo(); return; }
        if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); deleteSelectedStroke(); return; }
        return;
      }
      const tag = (e.target.tagName || '').toLowerCase();
      const isPasteInt = e.target === pasteIntRef.current;
      const inField = !isPasteInt && (tag === 'input' || tag === 'textarea' || e.target.isContentEditable);
      if (inField) {
        if (e.key === 'Escape') e.target.blur();
        // Deshacer/Rehacer TAMBIÉN mientras se escribe dentro de un nodo: antes se
        // salía aquí y Ctrl+Z solo llegaba al undo nativo del navegador, así que
        // parecía que no funcionaba en las notas. Se desenfoca primero para que el
        // contenido del editor se sincronice con el estado restaurado.
        if (matchShortcut(window.shortcuts.undo) || matchShortcut(window.shortcuts.redo)) {
          e.preventDefault();
          const isUndo = matchShortcut(window.shortcuts.undo);
          try { e.target.blur(); } catch (err) {}
          setEditing(null);
          setTimeout(() => { isUndo ? undo() : redo(); }, 0);
        }
        return;
      }
      // Tab fuera de un campo movía el foco a un nodo editable lejano y el navegador
      // desplazaba el canvas para revelarlo (aunque overflow sea hidden, el foco sí
      // desplaza). Eso subía la interfaz y descuadraba el zoom al cursor. Lo anulamos.
      if (e.key === 'Tab') { e.preventDefault(); return; }
      if (e.key === 'Escape') {
        setActiveTool(null); setSelected(null); setSelectedIds([]); setSelectedConn(null);
        setEditing(null); setPendingConn(null); setContextMenu(null); setDropTargetCol(null);
      }
      // Table cell Excel-style keyboard. (Only reached when the cell input is NOT focused,
      // since the inField check above returns early when typing inside the input.)
      {
        const ftc = window._focusedTableCell;
        if (ftc && ftc.itemId === selected) {
          const editingNow = ftc.isEditingCell?.();
          if (!editingNow) {
            if (e.key === 'ArrowUp')    { e.preventDefault(); ftc.moveSelection?.(-1, 0); return; }
            if (e.key === 'ArrowDown')  { e.preventDefault(); ftc.moveSelection?.(1, 0); return; }
            if (e.key === 'ArrowLeft')  { e.preventDefault(); ftc.moveSelection?.(0, -1); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); ftc.moveSelection?.(0, 1); return; }
            if (e.key === 'Tab')        { e.preventDefault(); ftc.moveSelection?.(0, e.shiftKey ? -1 : 1); return; }
            if (e.key === 'F2' || e.key === 'Enter') { e.preventDefault(); ftc.editCell?.(); return; }
          }
          // Printable key: type-to-edit. typeChar appends if already editing (handles the autofocus race).
          if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) {
            e.preventDefault(); ftc.typeChar?.(e.key); return;
          }
        }
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && (selected || selectedIds.length)) {
        // If a table cell is focused, clear its content instead of deleting the whole node
        const ftc = window._focusedTableCell;
        if (ftc && ftc.itemId === selected && !ftc.isEditingCell?.()) {
          e.preventDefault();
          ftc.clearContent && ftc.clearContent();
          return;
        }
        e.preventDefault();
        if (selectedIds.length > 1) {
          // Delete all multi-selected items in a single state update
          window.playAudioTone && window.playAudioTone('delete');
          setCanvases(prev => {
            const c = prev[currentId];
            return { ...prev, [currentId]: {
              ...c,
              items: c.items.filter(it => !selectedIds.includes(it.id)),
              connectors: (c.connectors || []).filter(co => !selectedIds.includes(co.id) && !selectedIds.includes(co.fromEnd?.itemId) && !selectedIds.includes(co.toEnd?.itemId)),
            }};
          });
          setSelectedIds([]); setSelected(null);
        } else if (selected) {
          deleteItem(selected);
        }
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedConn) {
        e.preventDefault(); deleteConnector(selectedConn);
      }
      if (matchShortcut(window.shortcuts.duplicate) && selected) {
        e.preventDefault(); duplicateItem(selected);
      }
      if (matchShortcut(window.shortcuts.selectAll)) {
        e.preventDefault(); selectAllItems();
      }
      if (matchShortcut(window.shortcuts.undo)) { e.preventDefault(); undo(); }
      if (matchShortcut(window.shortcuts.redo)) { e.preventDefault(); redo(); }
      // Cortar/Copiar nodos desde el teclado. Los eventos nativos 'cut'/'copy' solo se
      // disparan cuando el foco está en un elemento editable (el interceptor oculto);
      // si un nodo roba el foco (botones, celdas, etc.) nunca llegan, por lo que Ctrl+X
      // solo funcionaba con algunos nodos. preventDefault() cancela el evento nativo de
      // portapapeles, así que esta ruta nunca se ejecuta dos veces.
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey &&
          (e.key === 'x' || e.key === 'X' || e.key === 'c' || e.key === 'C') && !docOpen) {
        const isCutKey = e.key === 'x' || e.key === 'X';
        const selectedItems = current.items.filter(it => selectedIds.includes(it.id) || (selectedIds.length === 0 && it.id === selected));
        if (selectedItems.length > 0) {
          e.preventDefault();
          const selectedItemIds = selectedItems.map(it => it.id);
          const selectedConnectors = (current.connectors || []).filter(co =>
            selectedIds.includes(co.id) ||
            (selectedItemIds.includes(co.fromEnd?.itemId) && selectedItemIds.includes(co.toEnd?.itemId))
          );
          const copiedData = {
            odinote: true,
            items: JSON.parse(JSON.stringify(selectedItems)),
            connectors: JSON.parse(JSON.stringify(selectedConnectors)),
          };
          window._odiCopiedData = copiedData;
          window._odiCopiedItem = copiedData.items[0];
          const jsonStr = JSON.stringify(copiedData);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(jsonStr).catch(() => {});
          }
          if (isCutKey) {
            window.playAudioTone && window.playAudioTone('delete');
            setCanvases(prev => {
              const c = prev[currentId];
              return { ...prev, [currentId]: {
                ...c,
                items: c.items.filter(it => !selectedItemIds.includes(it.id)),
                connectors: (c.connectors || []).filter(co => !selectedItemIds.includes(co.id) && !selectedItemIds.includes(co.fromEnd?.itemId) && !selectedItemIds.includes(co.toEnd?.itemId)),
              }};
            });
            setSelectedIds([]); setSelected(null);
          }
          return;
        }
      }
      if (matchShortcut(window.shortcuts.search) && !contextMenu) {
        e.preventDefault();
        document.querySelector('.mini-search input')?.focus();
      }
    };
    const onMouseDownCapture = (e) => {
      if (e.button === 1 && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const startX = e.clientX, startY = e.clientY, startPan = { ...panRef.current };
        const onMove = (ev) => {
          setPan({ x: startPan.x + ev.clientX - startX, y: startPan.y + ev.clientY - startY });
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onMouseDownCapture, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouseDownCapture, { capture: true });
    };
  });

  // ───── Focus the paste interceptor whenever any node or connector is selected ─────
  useEffectCanvas(() => {
    if (!selected && selectedIds.length === 0 && !selectedConn) return;
    
    // Check if user is actively editing a text field or contentEditable
    const activeEl = document.activeElement;
    const isEditing = activeEl && (
      activeEl.tagName === 'INPUT' || 
      activeEl.tagName === 'TEXTAREA' || 
      activeEl.isContentEditable
    );
    if (isEditing) return;

    const t = setTimeout(() => {
      // Re-verify after timeout to avoid race conditions
      const currActive = document.activeElement;
      const currEditing = currActive && (
        currActive.tagName === 'INPUT' || 
        currActive.tagName === 'TEXTAREA' || 
        currActive.isContentEditable
      );
      // Con el dedo NO. Este div invisible existe solo para que Ctrl+V pegue
      // una imagen en el nodo seleccionado; en un teléfono no hay Ctrl+V, y
      // en cambio enfocar un contentEditable ABRE EL TECLADO. Como esto se
      // ejecuta tras CADA cambio de selección, el teclado saltaba al tocar un
      // nodo, al pulsar un botón de la barra o al borrar, y de paso el cambio
      // de foco y el teclado moviendo la pantalla se comían el arrastre.
      if (!currEditing && !window.odiLastInputWasTouch) {
        pasteIntRef.current?.focus();
      }
    }, 50);
    return () => clearTimeout(t);
  }, [selected, selectedIds, selectedConn]);

  // ───── Reset the connector label input when the selected connector changes ─────
  useEffectCanvas(() => { setConnLabelOpen(false); }, [selectedConn]);

  // ───── Track the mouse position so Ctrl+V pastes a copied node where the cursor is ─────
  useEffectCanvas(() => {
    const onMove = (e) => { lastMouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // ───── Keep the right-click menu on-screen: flip above/left when it would overflow the edges ─────
  React.useLayoutEffect(() => {
    if (!contextMenu || !ctxMenuRef.current || !surfaceRef.current) return;
    const menu = ctxMenuRef.current;
    const ww = surfaceRef.current.clientWidth;
    const wh = surfaceRef.current.clientHeight;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let left = contextMenu.x, top = contextMenu.y;
    if (left + mw > ww - 6) left = contextMenu.x - mw; // flip to the left of the cursor
    if (top + mh > wh - 6)  top = contextMenu.y - mh;  // flip above the cursor
    left = Math.max(6, Math.min(left, ww - mw - 6));
    top = Math.max(6, Math.min(top, wh - mh - 6));
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }, [contextMenu]);

  // ───── Close the right-click context menu on any outside click (incl. nodes that stopPropagation) ─────
  useEffectCanvas(() => {
    if (!contextMenu) return;
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('.context-menu')) return; // clicking the menu itself
      setContextMenu(null);
    };
    // Capture phase so it fires even when children call stopPropagation
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [contextMenu]);

  // ───── Document-level drag-drop: replace image/audio OR create a new image/audio node ─────
  useEffectCanvas(() => {
    const onDragOver = (e) => {
      if (e.dataTransfer) {
        const types = Array.from(e.dataTransfer.types || []);
        if (types.some(t => t === 'Files' || t === 'files' || t === 'text/uri-list' || t === 'text/html' || t === 'text/plain')) {
          e.preventDefault();
        }
      }
    };
    const onDrop = (e) => {
      // Don't intercept drops while a fullscreen modal (doc editor / file viewer) is open
      if (docOpen || fileOpen) return;
      let file = e.dataTransfer?.files?.[0];
      if (!file) {
        const urlList = e.dataTransfer?.getData('text/uri-list');
        const html = e.dataTransfer?.getData('text/html');
        let imgUrl = urlList ? urlList.split('\n')[0].trim() : '';
        if (!imgUrl && html) {
          const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (match && match[1]) imgUrl = match[1];
        }
        if (imgUrl && (imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('data:'))) {
          e.preventDefault();
          const targetEl = e.target?.closest?.('[data-item-id]');
          const targetId = targetEl?.dataset?.itemId;
          const targetItem = targetId ? current.items.find(i => i.id === targetId) : null;
          const pt = screenToCanvas(e.clientX, e.clientY);
          const applyDroppedImageSrc = (rawSrc) => {
            const src = rawSrc;
            const defW = 300;
            const defH = 220;

            const insertDroppedNode = (wVal, hVal) => {
              if (targetItem && targetItem.type === 'image') {
                updateItem(targetId, { src, name: 'image.png', w: wVal, h: hVal });
              } else {
                const newItem = makeNewItem('image', pt.x - wVal / 2, pt.y - hVal / 2, wVal, hVal, lang);
                newItem.src = src;
                newItem.name = 'image.png';
                newItem.w = wVal;
                newItem.h = hVal;
                setCanvases(prev => {
                  const c = prev[currentId];
                  return { ...prev, [currentId]: { ...c, items: [...c.items, newItem] } };
                });
                setSelected(newItem.id);
              }
            };

            if (src.startsWith('file:///')) {
              insertDroppedNode(defW, defH);
              return;
            }

            const img = new Image();
            img.onload = () => {
              const ratio = img.naturalWidth / img.naturalHeight;
              if (targetItem && targetItem.type === 'image') {
                const w = targetItem.w || 260;
                insertDroppedNode(w, Math.max(60, Math.round(w / ratio)));
              } else {
                insertDroppedNode(defW, Math.max(60, Math.round(defW / ratio)));
              }
            };
            img.onerror = () => {
              insertDroppedNode(defW, defH);
            };
            img.src = src;
          };
          if (imgUrl.startsWith('data:')) {
            applyDroppedImageSrc(imgUrl);
          } else {
            if (window.electronAPI && window.electronAPI.downloadMediaToVault && vaultPath) {
              let tentativeName = 'web_image.png';
              try {
                const parsedUrl = new URL(imgUrl);
                const base = parsedUrl.pathname.split('/').pop();
                if (base && base.includes('.')) tentativeName = base;
              } catch(e) {}
              window.electronAPI.downloadMediaToVault(vaultPath, imgUrl, tentativeName)
                .then(relativePath => {
                  const normalizedRelative = relativePath.replace(/\\/g, '/');
                  const absolutePath = `file:///${vaultPath.replace(/\\/g, '/')}/${normalizedRelative}`;
                  applyDroppedImageSrc(absolutePath);
                })
                .catch(err => {
                  console.warn('Failed to download dropped image via IPC, falling back to base64 fetch:', err);
                  if (window.electronAPI.fetchImageBase64) {
                    window.electronAPI.fetchImageBase64(imgUrl)
                      .then(applyDroppedImageSrc)
                      .catch(() => applyDroppedImageSrc(imgUrl));
                  } else {
                    applyDroppedImageSrc(imgUrl);
                  }
                });
            } else if (window.electronAPI && window.electronAPI.fetchImageBase64) {
              window.electronAPI.fetchImageBase64(imgUrl)
                .then(applyDroppedImageSrc)
                .catch(err => {
                  console.warn('Failed to fetch dropped image via IPC:', err);
                  applyDroppedImageSrc(imgUrl);
                });
            } else {
              fetch(imgUrl)
                .then(r => r.blob())
                .then(blob => {
                  const fr = new FileReader();
                  fr.onload = () => applyDroppedImageSrc(fr.result);
                  fr.readAsDataURL(blob);
                })
                .catch(err => {
                  console.warn('Failed to fetch dropped image, fallback to URL:', err);
                  applyDroppedImageSrc(imgUrl);
                });
            }
          }
          return;
        }
        return;
      }

      const isImg = file.type.startsWith('image/');
      const isAud = file.type.startsWith('audio/');

      e.preventDefault();

      const targetEl = e.target?.closest?.('[data-item-id]');
      const targetId = targetEl?.dataset?.itemId;
      const targetItem = targetId ? current.items.find(i => i.id === targetId) : null;

      // Read drop coordinates in canvas space for creating a new node
      const pt = screenToCanvas(e.clientX, e.clientY);

      if (isImg) {
        const fr = new FileReader();
        fr.onload = () => {
          const src = fr.result;
          const img = new Image();
          img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            if (targetItem && targetItem.type === 'image') {
              // Replace existing image
              const w = targetItem.w || 260;
              updateItem(targetId, { src, name: file.name, w, h: Math.max(60, Math.round(w / ratio)) });
            } else {
              // Create a new image node at drop location
              const w = 300;
              const h = Math.max(60, Math.round(w / ratio));
              const newItem = makeNewItem('image', pt.x - w / 2, pt.y - h / 2, w, h, lang);
              newItem.src = src;
              newItem.name = file.name;
              newItem.w = w;
              newItem.h = h;
              setCanvases(prev => {
                const c = prev[currentId];
                return { ...prev, [currentId]: { ...c, items: [...c.items, newItem] } };
              });
              setSelected(newItem.id);
            }
          };
          img.onerror = () => {
            if (targetItem && targetItem.type === 'image') updateItem(targetId, { src, name: file.name });
          };
          img.src = src;
        };
        fr.readAsDataURL(file);
      } else if (isAud) {
        const fr = new FileReader();
        fr.onload = () => {
          const src = fr.result;
          if (targetItem && targetItem.type === 'audio') {
            // Replace existing audio
            updateItem(targetId, { src, name: file.name, size: file.size });
          } else {
            // Create a new audio node at drop location
            const w = 320;
            const h = 140;
            const newItem = makeNewItem('audio', pt.x - w / 2, pt.y - h / 2, w, h, lang);
            newItem.src = src;
            newItem.name = file.name;
            newItem.size = file.size;
            setCanvases(prev => {
              const c = prev[currentId];
              return { ...prev, [currentId]: { ...c, items: [...c.items, newItem] } };
            });
            setSelected(newItem.id);
          }
        };
        fr.readAsDataURL(file);
      } else {
        // Any other file type → create (or replace) a File node
        const fr = new FileReader();
        fr.onload = () => {
          const src = fr.result;
          const ext = (file.name.split('.').pop() || '').toLowerCase();
          if (targetItem && targetItem.type === 'file') {
            updateItem(targetId, { src, name: file.name, size: file.size, fileType: ext });
          } else {
            const w = 200, h = 190;
            const newItem = makeNewItem('file', pt.x - w / 2, pt.y - h / 2, w, h, lang);
            newItem.src = src; newItem.name = file.name; newItem.size = file.size; newItem.fileType = ext;
            newItem._triggerFilePick = false;
            setCanvases(prev => {
              const c = prev[currentId];
              return { ...prev, [currentId]: { ...c, items: [...c.items, newItem] } };
            });
            setSelected(newItem.id);
          }
        };
        fr.readAsDataURL(file);
      }
    };
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
    };
  });

  // ───── Document-level paste: replace selected image OR create a new image node ─────
  useEffectCanvas(() => {
    const onDocPaste = (e) => {
      // Don't intercept paste while a fullscreen modal (doc editor / file viewer) is open
      if (docOpen || fileOpen) return;
      // If user is typing into a real input/textarea (not our hidden interceptor), ignore
      const af = document.activeElement;
      if (af && af !== pasteIntRef.current &&
          ((af.tagName || '').toLowerCase() === 'input' ||
           (af.tagName || '').toLowerCase() === 'textarea' ||
           (af.isContentEditable && af !== pasteIntRef.current))) {
        return;
      }
      const cdata = e.clipboardData;
      const items = cdata?.items;
      const types = cdata ? Array.from(cdata.types || []) : [];

      // Paste structured items and connectors
      const pasteData = (data) => {
        if (!data || !data.items || !data.items.length) return;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        data.items.forEach(it => {
          const w = it.w || 200;
          const h = it.h || 120;
          if (it.x < minX) minX = it.x;
          if (it.y < minY) minY = it.y;
          if (it.x + w > maxX) maxX = it.x + w;
          if (it.y + h > maxY) maxY = it.y + h;
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const m = lastMouseRef.current || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const pt = screenToCanvas(m.x, m.y);
        const dx = pt.x - centerX;
        const dy = pt.y - centerY;

        const idMap = {};
        const canvasDuplications = [];
        const pastedItems = data.items.map(it => {
          const newId = `it-${Date.now()}-${Math.floor(Math.random()*99999)}-${Math.floor(Math.random()*99999)}`;
          idMap[it.id] = newId;
          const copy = {
            ...it,
            id: newId,
            x: Math.round(it.x + dx),
            y: Math.round(it.y + dy),
            _new: true,
          };
          if (copy.type === 'board' && copy.canvasId) {
            const origCanvasId = copy.canvasId;
            const newCid = `b-${Date.now()}-${Math.floor(Math.random()*99999)}`;
            copy.canvasId = newCid;
            canvasDuplications.push({ orig: origCanvasId, next: newCid });
          }
          return copy;
        });

        const pastedConnectors = (data.connectors || []).map(co => {
          const newConnId = `co-${Date.now()}-${Math.floor(Math.random()*99999)}`;
          const copy = {
            ...co,
            id: newConnId,
          };
          if (copy.fromEnd && idMap[copy.fromEnd.itemId]) {
            copy.fromEnd = { ...copy.fromEnd, itemId: idMap[copy.fromEnd.itemId] };
          }
          if (copy.toEnd && idMap[copy.toEnd.itemId]) {
            copy.toEnd = { ...copy.toEnd, itemId: idMap[copy.toEnd.itemId] };
          }
          return copy;
        });

        setCanvases(prev => {
          const c = prev[currentId];
          const next = {
            ...prev,
            [currentId]: {
              ...c,
              items: [...c.items, ...pastedItems],
              connectors: [...(c.connectors || []), ...pastedConnectors],
            }
          };
          canvasDuplications.forEach(({ orig, next: nextCid }) => {
            duplicateCanvasState(next, orig, nextCid);
          });
          return next;
        });

        if (pastedItems.length === 1) {
          setSelected(pastedItems[0].id);
          setSelectedIds([]);
        } else if (pastedItems.length > 1) {
          setSelected(null);
          setSelectedIds(pastedItems.map(it => it.id));
        }
      };

      // Resolve to a usable image source (data URL from blob, or http URL string)
      const applyImageSrc = (rawSrc) => {
        const src = rawSrc;
        e.preventDefault();
        const selItem = selected ? current.items.find(i => i.id === selected) : null;
        
        const insertImageNode = (wVal, hVal) => {
          if (selItem && selItem.type === 'image') {
            updateItem(selected, { src, w: wVal, h: hVal });
          } else {
            const w = wVal;
            const h = hVal;
            const m = lastMouseRef.current || { x: 0, y: 0 };
            const pt = screenToCanvas(m.x, m.y);
            const newItem = makeNewItem('image', pt.x - w / 2, pt.y - h / 2, w, h, lang);
            newItem.src = src; newItem.w = w; newItem.h = h;
            setCanvases(prev => {
              const c = prev[currentId];
              return { ...prev, [currentId]: { ...c, items: [...c.items, newItem] } };
            });
            setSelected(newItem.id);
          }
        };

        const defW = 300;
        const defH = 220;

        if (src.startsWith('file:///')) {
          insertImageNode(defW, defH);
          return;
        }

        const img = new Image();
        img.onload = () => {
          const ratio = img.naturalWidth / img.naturalHeight;
          if (selItem && selItem.type === 'image') {
            const w = selItem.w || 260;
            insertImageNode(w, Math.max(60, Math.round(w / ratio)));
          } else {
            insertImageNode(defW, Math.max(60, Math.round(defW / ratio)));
          }
        };
        img.onerror = () => {
          insertImageNode(defW, defH);
        };
        img.src = src;
      };

      const fetchAndApplyImage = (url) => {
        if (url.startsWith('data:')) {
          applyImageSrc(url);
          return;
        }
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.downloadMediaToVault && vaultPath) {
          let tentativeName = 'web_image.png';
          try {
            const parsedUrl = new URL(url);
            const base = parsedUrl.pathname.split('/').pop();
            if (base && base.includes('.')) tentativeName = base;
          } catch(e) {}
          window.electronAPI.downloadMediaToVault(vaultPath, url, tentativeName)
            .then(relativePath => {
              const normalizedRelative = relativePath.replace(/\\/g, '/');
              const absolutePath = `file:///${vaultPath.replace(/\\/g, '/')}/${normalizedRelative}`;
              applyImageSrc(absolutePath);
            })
            .catch(err => {
              console.warn('Failed to download image to vault directly via IPC, falling back to base64 fetch:', err);
              if (window.electronAPI.fetchImageBase64) {
                window.electronAPI.fetchImageBase64(url)
                  .then(applyImageSrc)
                  .catch(err2 => {
                    console.warn('Failed base64 fetch too, fallback to URL:', err2);
                    applyImageSrc(url);
                  });
              } else {
                applyImageSrc(url);
              }
            });
        } else if (window.electronAPI && window.electronAPI.fetchImageBase64) {
          window.electronAPI.fetchImageBase64(url)
            .then(base64 => {
              applyImageSrc(base64);
            })
            .catch(err => {
              console.warn('Failed to fetch image via IPC, falling back to URL string:', err);
              applyImageSrc(url);
            });
        } else {
          fetch(url)
            .then(res => res.blob())
            .then(blob => {
              const fr = new FileReader();
              fr.onload = () => applyImageSrc(fr.result);
              fr.readAsDataURL(blob);
            })
            .catch(err => {
              console.warn('Failed to fetch image, falling back to URL string:', err);
              applyImageSrc(url);
            });
        }
      };

      // 1) Intentar leer JSON estructurado de Odinote síncronamente desde el portapapeles
      let parsedOdiData = null;
      try {
        const text = cdata?.getData('text/plain');
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed && parsed.odinote && parsed.items) {
            parsedOdiData = parsed;
          }
        }
      } catch (err) {}

      // OJO: aquí NO se usa window._odiCopiedData como respaldo. Antes se hacía y,
      // al copiar algo de fuera (texto o imagen), se pegaba el último nodo copiado
      // dentro de la app en lugar del contenido externo. El respaldo interno solo
      // se usa al final, si el portapapeles no trae nada aprovechable.
      if (parsedOdiData) {
        e.preventDefault();
        pasteData(parsedOdiData);
        return;
      }

      // 2) Real image blob (screenshots, "copy image") — highest priority
      if (items) {
        for (const it of Array.from(items)) {
          if (it.type.startsWith('image/')) {
            const file = it.getAsFile();
            if (file) {
              const fr = new FileReader();
              fr.onload = () => applyImageSrc(fr.result);
              fr.readAsDataURL(file);
              return;
            }
          }
        }
      }
      // 3) HTML with <img src="..."> (copying an image from a web page)
      if (types.includes('text/html')) {
        const html = cdata.getData('text/html');
        const match = html && html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && match[1]) { fetchAndApplyImage(match[1]); return; }
      }
      // 4) A plain URL pointing to an image
      const urlText = (cdata.getData('text/uri-list') || cdata.getData('text/plain') || '').split('\n')[0].trim();
      if (urlText && /^https?:\/\//i.test(urlText) && /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(urlText)) {
        fetchAndApplyImage(urlText);
        return;
      }

      // 5) Texto plano externo → crear una nota (o un enlace si es una URL)
      const plainText = (cdata.getData('text/plain') || '').trim();
      if (plainText) {
        e.preventDefault();
        const m = lastMouseRef.current || { x: 0, y: 0 };
        const pt = screenToCanvas(m.x, m.y);
        const isUrl = /^https?:\/\/\S+$/i.test(plainText);
        const type = isUrl ? 'link' : 'note';
        const def = defaultDims(type);
        const newItem = makeNewItem(type, pt.x - def.w / 2, pt.y - def.h / 2, def.w, def.h, lang);
        if (isUrl) {
          newItem.url = plainText;
        } else {
          // Respetar los saltos de línea del texto copiado
          const html = plainText
            .split(/\r?\n/)
            .map(line => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br>'}</p>`)
            .join('');
          newItem.content = { es: html, en: html };
        }
        setCanvases(prev => {
          const c = prev[currentId];
          return { ...prev, [currentId]: { ...c, items: [...c.items, newItem] } };
        });
        setSelected(newItem.id);
        window.playAudioTone && window.playAudioTone('drop');
        return;
      }

      // 6) El portapapeles no trae nada aprovechable → repetir la última copia interna
      if (window._odiCopiedData) {
        e.preventDefault();
        pasteData(window._odiCopiedData);
      }
    };
    const onDocCopy = (e) => {
      console.log('[CLIPBOARD DEBUG] onDocCopy event fired');
      if (docOpen || fileOpen) {
        console.log('[CLIPBOARD DEBUG] Ignored: docOpen or fileOpen is true');
        return;
      }
      const af = document.activeElement;
      if (af &&
          ((af.tagName || '').toLowerCase() === 'input' ||
           (af.tagName || '').toLowerCase() === 'textarea' ||
           (af.isContentEditable && af !== pasteIntRef.current))) {
        console.log('[CLIPBOARD DEBUG] Ignored: Focus is on editable element:', af);
        return; // Let native copy handle it
      }

      const selectedItems = current.items.filter(it => selectedIds.includes(it.id) || (selectedIds.length === 0 && it.id === selected));
      console.log('[CLIPBOARD DEBUG] Selected items for copy:', selectedItems);
      if (selectedItems.length > 0) {
        e.preventDefault();
        const selectedItemIds = selectedItems.map(it => it.id);
        const selectedConnectors = (current.connectors || []).filter(co =>
          selectedIds.includes(co.id) ||
          (selectedItemIds.includes(co.fromEnd?.itemId) && selectedItemIds.includes(co.toEnd?.itemId))
        );
        
        const copiedData = {
          odinote: true,
          items: JSON.parse(JSON.stringify(selectedItems)),
          connectors: JSON.parse(JSON.stringify(selectedConnectors)),
        };
        window._odiCopiedData = copiedData;
        window._odiCopiedItem = copiedData.items[0];
        
        const jsonStr = JSON.stringify(copiedData);
        console.log('[CLIPBOARD DEBUG] Serialized JSON string size:', jsonStr.length);
        
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', jsonStr);
          console.log('[CLIPBOARD DEBUG] Synchronous e.clipboardData.setData executed');
        } else {
          console.warn('[CLIPBOARD DEBUG] e.clipboardData is not available');
        }

        // Async fallback write
        setTimeout(() => {
          navigator.clipboard.writeText(jsonStr)
            .then(() => console.log('[CLIPBOARD DEBUG] Copy Async navigator.clipboard.writeText successful'))
            .catch(err => console.error('[CLIPBOARD DEBUG] Copy Async navigator.clipboard.writeText failed:', err));
        }, 0);
      }
    };

    const onDocCut = (e) => {
      console.log('[CLIPBOARD DEBUG] onDocCut event fired');
      if (docOpen || fileOpen) {
        console.log('[CLIPBOARD DEBUG] Ignored: docOpen or fileOpen is true');
        return;
      }
      const af = document.activeElement;
      if (af &&
          ((af.tagName || '').toLowerCase() === 'input' ||
           (af.tagName || '').toLowerCase() === 'textarea' ||
           (af.isContentEditable && af !== pasteIntRef.current))) {
        console.log('[CLIPBOARD DEBUG] Ignored: Focus is on editable element:', af);
        return; // Let native cut handle it
      }

      const selectedItems = current.items.filter(it => selectedIds.includes(it.id) || (selectedIds.length === 0 && it.id === selected));
      console.log('[CLIPBOARD DEBUG] Selected items for cut:', selectedItems);
      if (selectedItems.length > 0) {
        e.preventDefault();
        const selectedItemIds = selectedItems.map(it => it.id);
        const selectedConnectors = (current.connectors || []).filter(co =>
          selectedIds.includes(co.id) ||
          (selectedItemIds.includes(co.fromEnd?.itemId) && selectedItemIds.includes(co.toEnd?.itemId))
        );
        
        const copiedData = {
          odinote: true,
          items: JSON.parse(JSON.stringify(selectedItems)),
          connectors: JSON.parse(JSON.stringify(selectedConnectors)),
        };
        window._odiCopiedData = copiedData;
        window._odiCopiedItem = copiedData.items[0];
        
        const jsonStr = JSON.stringify(copiedData);
        console.log('[CLIPBOARD DEBUG] Serialized JSON string size:', jsonStr.length);
        
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', jsonStr);
          console.log('[CLIPBOARD DEBUG] Synchronous e.clipboardData.setData executed');
        } else {
          console.warn('[CLIPBOARD DEBUG] e.clipboardData is not available');
        }

        // Async fallback write
        setTimeout(() => {
          navigator.clipboard.writeText(jsonStr)
            .then(() => console.log('[CLIPBOARD DEBUG] Cut Async navigator.clipboard.writeText successful'))
            .catch(err => console.error('[CLIPBOARD DEBUG] Cut Async navigator.clipboard.writeText failed:', err));
        }, 0);

        // Delete the cut items
        setCanvases(prev => {
          const c = prev[currentId];
          return { ...prev, [currentId]: {
            ...c,
            items: c.items.filter(it => !selectedItemIds.includes(it.id)),
            connectors: (c.connectors || []).filter(co => !selectedItemIds.includes(co.id) && !selectedItemIds.includes(co.fromEnd?.itemId) && !selectedItemIds.includes(co.toEnd?.itemId)),
          }};
        });
        setSelectedIds([]); setSelected(null);
      }
    };

    document.addEventListener('paste', onDocPaste);
    document.addEventListener('copy', onDocCopy);
    document.addEventListener('cut', onDocCut);
    return () => {
      document.removeEventListener('paste', onDocPaste);
      document.removeEventListener('copy', onDocCopy);
      document.removeEventListener('cut', onDocCut);
    };
  });

  // ───── Coordinates ─────
  const screenToCanvas = (clientX, clientY) => {
    const rect = surfaceRef.current.getBoundingClientRect();
    const p = panRef.current || pan;
    const s = scaleRef.current || scale;
    return {
      x: (clientX - rect.left - p.x) / s,
      y: (clientY - rect.top - p.y) / s,
    };
  };

  // ───── Item updates ─────
  const updateItem = useCallbackCanvas((itemId, patch) => {
    if (patch.h !== undefined) {
      console.log('[DEBUG-HEIGHT] Canvas updateItem updating height for itemId =', itemId, 'patch.h =', patch.h);
    }
    setCanvases(prev => {
      const c = prev[currentId];
      const it = c.items.find(x => x.id === itemId);
      let nextCanvases = { ...prev };
      if (it && it.type === 'board' && patch.content && it.canvasId) {
        if (nextCanvases[it.canvasId]) {
          nextCanvases[it.canvasId] = {
            ...nextCanvases[it.canvasId],
            title: { ...(nextCanvases[it.canvasId].title || {}), ...patch.content }
          };
        }
      }
      nextCanvases[currentId] = {
        ...c,
        items: c.items.map(item => item.id === itemId ? { ...item, ...patch } : item)
      };
      return nextCanvases;
    });
  // eslint-disable-next-line
  }, [currentId]);

  const updateItemSilent = (itemId, patch) => {
    skipHistory.current = true;
    _setCanvases(prev => {
      const c = prev[currentId];
      const next = { ...prev, [currentId]: { ...c, items: c.items.map(it => it.id === itemId ? { ...it, ...patch } : it) } };
      return next;
    });
  };

  // Move several items together (used when dragging a connector to translate its attached nodes)
  const dragItemsSilent = (updates) => {
    document.body.classList.add('odi-busy');
    skipHistory.current = true;
    _setCanvases(prev => {
      const c = prev[currentId];
      return { ...prev, [currentId]: { ...c, items: c.items.map(it => {
        const u = updates.find(x => x.id === it.id);
        return u ? { ...it, x: u.x, y: u.y, _dragging: true } : it;
      }) } };
    });
  };
  const commitItemsDrag = (ids) => {
    document.body.classList.remove('odi-busy');
    setCanvases(prev => {
      const c = prev[currentId];
      return { ...prev, [currentId]: {
        ...c,
        items: c.items.map(it => ids.includes(it.id) ? { ...it, _dragging: false } : it),
        connectors: (c.connectors || []).map(co => {
          if (co.shape === 'orthogonal' && co.fromEnd && ids.includes(co.fromEnd.itemId) && co.toEnd && ids.includes(co.toEnd.itemId)) {
            return {
              ...co,
              ortho: cleanupOrtho(co.ortho || [])
            };
          }
          return co;
        })
      }};
    });
  };

  // ───── Modo dibujo ─────
  //
  // Dentro del modo se trabaja en coordenadas del LIENZO, no del nodo: así se
  // puede seguir dibujando fuera de la caja actual y la caja se ajusta sola al
  // guardar. El nodo guarda los trazos en un espacio propio (vw × vh) para
  // poder estirarse sin deformar los datos.
  const drawMovingRef = useRefCanvas(false);

  const strokesToCanvasSpace = (item) => {
    const D = window.OdiDraw;
    const vw = item.vw || item.w || 1;
    const vh = item.vh || item.h || 1;
    const scaled = D.scaleStrokes(item.strokes || [], (item.w || vw) / vw, (item.h || vh) / vh);
    return D.translateStrokes(scaled, item.x, item.y);
  };

  const enterDrawMode = (itemId) => {
    const it = (canvasesLiveRef.current[currentId].items || []).find(i => i.id === itemId);
    if (!it || it.type !== 'draw') return;
    // La marca de "ábreme al nacer" se gasta AQUÍ, no al guardar. Se guarda en
    // disco con el resto del nodo, así que si la sesión terminaba por un
    // reinicio en vez de por Guardar, la marca sobrevivía y ese nodo volvía a
    // robarle el modo dibujo al siguiente que se creara.
    if (it._startDrawing) updateItemSilent(itemId, { _startDrawing: false });
    setSelected(itemId);
    setEditing(null);
    setSelectedStrokeId(null);
    setDrawTool('pen');
    setDrawSession({ strokes: strokesToCanvasSpace(it), past: [], future: [] });
    setDrawingId(itemId);
  };

  // Cada cambio de la sesión guarda el estado anterior para el deshacer PROPIO
  // del modo (los botones de la barra), que no toca el historial del lienzo.
  const applyDrawChange = (fn) => {
    setDrawSession(s => {
      if (!s) return s;
      const next = fn(s.strokes);
      if (next === s.strokes) return s;
      const past = [...s.past, s.strokes].slice(-60);
      return { strokes: next, past, future: [] };
    });
  };

  const commitStroke = (stroke) => applyDrawChange(list => [...list, stroke]);

  const eraseStroke = (id) => applyDrawChange(list => {
    if (!list.some(s => s.id === id)) return list;
    return list.filter(s => s.id !== id);
  });

  const moveStroke = (id, dx, dy, isEnd) => {
    if (isEnd) { drawMovingRef.current = false; return; }
    const D = window.OdiDraw;
    // Un arrastre entero es UN paso de deshacer, no uno por píxel recorrido.
    if (!drawMovingRef.current) {
      drawMovingRef.current = true;
      applyDrawChange(list => list.map(s => s.id === id ? { ...s, pts: D.translateStrokes([s], dx, dy)[0].pts } : s));
      return;
    }
    setDrawSession(s => s && ({
      ...s,
      strokes: s.strokes.map(st => st.id === id ? { ...st, pts: D.translateStrokes([st], dx, dy)[0].pts } : st),
    }));
  };

  const recolorStroke = (hex) => {
    setDrawColor(hex);
    if (!selectedStrokeId) return;
    applyDrawChange(list => list.map(s => s.id === selectedStrokeId ? { ...s, color: hex } : s));
  };

  const deleteSelectedStroke = () => {
    if (!selectedStrokeId) return;
    eraseStroke(selectedStrokeId);
    setSelectedStrokeId(null);
  };

  const drawUndo = () => setDrawSession(s => {
    if (!s || !s.past.length) return s;
    const prev = s.past[s.past.length - 1];
    return { strokes: prev, past: s.past.slice(0, -1), future: [s.strokes, ...s.future].slice(0, 60) };
  });

  const drawRedo = () => setDrawSession(s => {
    if (!s || !s.future.length) return s;
    return { strokes: s.future[0], past: [...s.past, s.strokes], future: s.future.slice(1) };
  });

  const exitDrawMode = () => {
    setDrawingId(null);
    setDrawSession(null);
    setSelectedStrokeId(null);
    drawMovingRef.current = false;
  };

  // Guardar: la caja del nodo se ajusta a lo que hay dibujado (si no, quedaría
  // un rectángulo enorme medio vacío) y los trazos pasan al espacio del nodo.
  const saveDrawing = () => {
    const D = window.OdiDraw;
    const id = drawingId;
    const session = drawSession;
    if (!id || !session) { exitDrawMode(); return; }
    const strokes = session.strokes;
    if (!strokes.length) {
      // Se borró todo: el nodo vacío no pinta nada en el lienzo.
      deleteItem(id);
      exitDrawMode();
      return;
    }
    const b = D.strokesBounds(strokes);
    const pad = 6;
    const x = Math.round(b.x - pad);
    const y = Math.round(b.y - pad);
    const w = Math.round(b.w + pad * 2);
    const h = Math.round(b.h + pad * 2);
    window.odiTrack && window.odiTrack('dibujo_guardado', { trazos: strokes.length });
    updateItem(id, {
      strokes: D.translateStrokes(strokes, -x, -y),
      x, y, w, h, vw: w, vh: h,
      _startDrawing: false,
    });
    exitDrawMode();
    window.playAudioTone && window.playAudioTone('click');
  };

  const discardDrawing = () => {
    const id = drawingId;
    const it = id ? (canvasesLiveRef.current[currentId].items || []).find(i => i.id === id) : null;
    // Un nodo recién creado que se descarta sin un solo trazo no debe quedarse
    // como una caja invisible en medio del lienzo.
    if (it && it.type === 'draw' && !(it.strokes || []).length) deleteItem(id);
    exitDrawMode();
  };

  // Un nodo de dibujo recién soltado abre el modo por su cuenta.
  //
  // Se exige también `_new`, que el lienzo apaga a los 300 ms de crear un nodo
  // y por tanto solo vale dentro de esta sesión. Sin eso, un nodo que se quedó
  // a medias (se recargó la página antes de guardar) conservaba la marca en
  // disco y le robaba el modo dibujo al siguiente nodo que se creara.
  useEffectCanvas(() => {
    if (drawingId) return;
    const pend = (current.items || []).find(i => i.type === 'draw' && i._startDrawing && i._new);
    if (pend) enterDrawMode(pend.id);
    // eslint-disable-next-line
  }, [current.items, drawingId]);

  // Si el nodo que se estaba dibujando desaparece (deshacer, borrado desde
  // otro sitio), el modo se cierra solo en vez de quedarse pintando en el aire.
  useEffectCanvas(() => {
    if (!drawingId) return;
    if (!(current.items || []).some(i => i.id === drawingId)) exitDrawMode();
    // eslint-disable-next-line
  }, [current.items, drawingId]);

  const updateConnector = useCallbackCanvas((connId, patch) => {
    skipHistory.current = true;
    setCanvases(prev => {
      const c = prev[currentId];
      return { ...prev, [currentId]: { ...c, connectors: (c.connectors || []).map(co => co.id === connId ? { ...co, ...patch } : co) } };
    });
  // eslint-disable-next-line
  }, [currentId]);

  const addConnector = (fromEnd, toEnd) => {
    window.playAudioTone && window.playAudioTone('connect');
    setCanvases(prev => {
      const c = prev[currentId];
      const conns = c.connectors || [];
      const newConn = {
        id: `cn-${Date.now()}-${Math.floor(Math.random()*9999)}`,
        fromEnd, toEnd,
        bend: { x: 0, y: 0 },
        isColorExplicit: false,
      };
      return { ...prev, [currentId]: { ...c, connectors: [...conns, newConn] } };
    });
  };

  const deleteConnector = (connId) => {
    window.playAudioTone && window.playAudioTone('delete');
    setCanvases(prev => {
      const c = prev[currentId];
      return { ...prev, [currentId]: { ...c, connectors: (c.connectors || []).filter(co => co.id !== connId) } };
    });
    setSelectedConn(null);
  };

  // ───── Surface mousedown ─────
  const onSurfaceMouseDown = (e) => {
    if (e.button === 2) return; // right-click is handled by the create menu, not the marquee
    if (!surfaceRef.current.contains(e.target)) return;
    const isSurface =
      e.target === surfaceRef.current ||
      e.target.classList.contains('canvas-surface') ||
      e.target.classList.contains('canvas-content') ||
      e.target.classList.contains('connectors') ||
      e.target.classList.contains('board-cover-grid');

    if (!isSurface) return;

    // Commit any open inline editor (cell/event/etc.) — the marquee preventDefault below would
    // otherwise keep the focused input from blurring, leaving it stuck in edit mode.
    const ae = document.activeElement;
    if (ae && ae !== pasteIntRef.current && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) {
      ae.blur();
    }

    setContextMenu(null);
    setShowBgSelector(false);

    // panning
    if (e.button === 1 || e.altKey) {
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY, startPan = { ...pan };
      const onMove = (ev) => setPan({ x: startPan.x + ev.clientX - startX, y: startPan.y + ev.clientY - startY });
      const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
      window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
      return;
    }

    // line tool from empty canvas → start a free arrow
    if (activeTool === 'line') {
      e.preventDefault();
      startLineDrag(e, null);
      return;
    }

    // tool placement (drag-to-create)
    if (activeTool && activeTool !== 'line') {
      e.preventDefault();
      const startPt = screenToCanvas(e.clientX, e.clientY);
      setDragCreate({ sx: startPt.x, sy: startPt.y, x: startPt.x, y: startPt.y, w: 0, h: 0 });

      const onMove = (ev) => {
        const p = screenToCanvas(ev.clientX, ev.clientY);
        setDragCreate(d => d && ({
          sx: d.sx, sy: d.sy,
          x: Math.min(d.sx, p.x),
          y: Math.min(d.sy, p.y),
          w: Math.abs(p.x - d.sx),
          h: Math.abs(p.y - d.sy),
        }));
      };
      const onUp = (ev) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        const p = screenToCanvas(ev.clientX, ev.clientY);
        const sx = startPt.x, sy = startPt.y;
        const dx = Math.abs(p.x - sx);
        const dy = Math.abs(p.y - sy);
        const small = dx < 14 && dy < 14;
        const w = small ? 0 : dx;
        const h = small ? 0 : dy;
        const def = defaultDims(activeTool);
        const x = small ? sx - def.w / 2 : Math.min(sx, p.x);
        const y = small ? sy - def.h / 2 : Math.min(sy, p.y);
        const item = makeNewItem(activeTool, x, y, w, h, lang);
        if (item) {
          window.playAudioTone && window.playAudioTone('create');
          setCanvases(prev => {
            const c = prev[currentId];
            const next = { ...prev, [currentId]: { ...c, items: [...c.items, item] } };
            if (item.type === 'board') {
              next[item.canvasId] = {
                title: item.content,
                parent: currentId,
                parentLabel: c.title,
                items: [], connectors: [],
              };
            }
            return next;
          });
          setSelected(item.id);
          // auto-enter edit mode for text types
          if (['note','comment','bigtitle'].includes(item.type) && !skipAutoEdit()) {
            setTimeout(() => setEditing(item.id), 40);
          }
          if (item.type === 'doc') {
            setTimeout(() => setDocOpen({ id: item.id }), 40);
          }
          if (['link','todo','board','column','map','frame'].includes(item.type)) {
            // for these, edit mode just allows inline rename / URL input
            setTimeout(() => setEditing(item.id), 40);
          }
        }
        setDragCreate(null);
        setActiveTool(null);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return;
    }

    // Drag-rectangle selection (marquee) — empty canvas, no tool
    e.preventDefault();
    const startPt = screenToCanvas(e.clientX, e.clientY);
    let didDrag = false;
    setMarquee({ sx: startPt.x, sy: startPt.y, x: startPt.x, y: startPt.y, w: 0, h: 0 });

    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY);
      const dx = ev.clientX - e.clientX;
      const dy = ev.clientY - e.clientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
      setMarquee({
        sx: startPt.x, sy: startPt.y,
        x: Math.min(startPt.x, p.x),
        y: Math.min(startPt.y, p.y),
        w: Math.abs(p.x - startPt.x),
        h: Math.abs(p.y - startPt.y),
      });
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const p = screenToCanvas(ev.clientX, ev.clientY);
      setMarquee(null);

      if (!didDrag) {
        if (e.shiftKey || ev.shiftKey) {
          // Si hace Shift+Clic en el lienzo vacio, no deseleccionamos nada
          return;
        }
        // Click on empty canvas → just deselect
        if (croppingId) setCroppingId(null);
        setSelected(null);
        setSelectedIds([]);
        setSelectedConn(null);
        setEditing(null);
        setEditingChildState(null);
        return;
      }

      // Compute selection rect in canvas coords
      const rx = Math.min(startPt.x, p.x);
      const ry = Math.min(startPt.y, p.y);
      const rw = Math.abs(p.x - startPt.x);
      const rh = Math.abs(p.y - startPt.y);
      const hits = current.items.filter(it => {
        const ix = it.x, iy = it.y, iw = it.w;
        const ih = it.type === 'frame' ? 36 : it.h;
        // intersection test (any overlap counts)
        return !(ix + iw < rx || ix > rx + rw || iy + ih < ry || iy > ry + rh);
      }).map(it => it.id);

      if (e.shiftKey || ev.shiftKey) {
        // Seleccion aditiva con Shift
        let baseSelected = [...selectedIds];
        if (selected && !baseSelected.includes(selected)) {
          baseSelected.push(selected);
        }
        const union = Array.from(new Set([...baseSelected, ...hits]));
        setSelectedIds(union);
        setSelected(union.length === 1 ? union[0] : null);
      } else {
        setSelectedIds(hits);
        setSelected(hits.length === 1 ? hits[0] : null);
      }
      setSelectedConn(null);
      setEditing(null);
      setEditingChildState(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Double-click on empty canvas → drop a note where the cursor is
  const onSurfaceDoubleClick = (e) => {
    if (activeTool) return;
    if (!surfaceRef.current || !surfaceRef.current.contains(e.target)) return;
    const isEmpty =
      e.target === surfaceRef.current ||
      e.target.classList.contains('canvas-surface') ||
      e.target.classList.contains('canvas-content') ||
      e.target.classList.contains('connectors');
    if (!isEmpty) return;
    const p = screenToCanvas(e.clientX, e.clientY);
    const def = defaultDims('note');
    const item = makeNewItem('note', p.x - def.w / 2, p.y - def.h / 2, 0, 0, lang);
    if (!item) return;
    window.playAudioTone && window.playAudioTone('create');
    setCanvases(prev => {
      const c = prev[currentId];
      return { ...prev, [currentId]: { ...c, items: [...c.items, item] } };
    });
    setSelected(item.id);
    setSelectedIds([]);
    setTimeout(() => setEditing(item.id), 40);
  };

  // Create a node centered at the given canvas coords (used by the right-click menu)
  const createNodeAt = (type, cx, cy) => {
    if (type === 'line') { setActiveTool('line'); return; }
    const def = defaultDims(type);
    const item = makeNewItem(type, cx - def.w / 2, cy - def.h / 2, 0, 0, lang);
    if (!item) return;
    window.playAudioTone && window.playAudioTone('create');
    setCanvases(prev => {
      const c = prev[currentId];
      const next = { ...prev, [currentId]: { ...c, items: [...c.items, item] } };
      if (item.type === 'board') {
        next[item.canvasId] = { title: item.content, parent: currentId, parentLabel: c.title, items: [], connectors: [] };
      }
      return next;
    });
    setSelected(item.id);
    setSelectedIds([]);
    if (item.type === 'doc') setTimeout(() => setDocOpen({ id: item.id }), 40);
    else if (['note','comment','link','todo','board','column'].includes(item.type)) setTimeout(() => setEditing(item.id), 40);
  };

  const selectAllItems = () => {
    const itemIds = current.items.map(i => i.id);
    const connIds = (current.connectors || []).map(c => c.id);
    setSelectedIds([...itemIds, ...connIds]);
    setSelected(null);
    setSelectedConn(null);
  };

  // Right-click on empty canvas → quick-create menu
  const onSurfaceContextMenu = (e) => {
    if (activeTool) return;
    if (e.target.closest('.item') || e.target.closest('.connector-hit')) return;
    e.preventDefault();
    const rect = surfaceRef.current.getBoundingClientRect();
    const cpt = screenToCanvas(e.clientX, e.clientY);
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, canvas: true, cx: cpt.x, cy: cpt.y });
  };

  // ───── Item drag (with column drop detection) ─────
  const startDragItem = (e, itemId) => {
    if (e.target.closest('input, textarea, button, .todo-check, .swatch-btn, .anchor, .todo-add, .cal-mb-input, .cal-mb-cell, .cal-mb-nav')) return;

    if (e.shiftKey) {
      e.stopPropagation();
      e.preventDefault();
      // Iniciar el marquee de selección desde esta posición
      const startPt = screenToCanvas(e.clientX, e.clientY);
      let didDrag = false;
      setMarquee({ sx: startPt.x, sy: startPt.y, x: startPt.x, y: startPt.y, w: 0, h: 0 });

      const onMove = (ev) => {
        const p = screenToCanvas(ev.clientX, ev.clientY);
        const dx = ev.clientX - e.clientX;
        const dy = ev.clientY - e.clientY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
        setMarquee({
          sx: startPt.x, sy: startPt.y,
          x: Math.min(startPt.x, p.x),
          y: Math.min(startPt.y, p.y),
          w: Math.abs(p.x - startPt.x),
          h: Math.abs(p.y - startPt.y),
        });
      };

      const onUp = (ev) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setMarquee(null);

        if (!didDrag) {
          // Fue un Shift+Clic individual -> Hacer toggle del item en la selección
          let nextSelectedIds = [...selectedIds];
          if (selected && !nextSelectedIds.includes(selected)) {
            nextSelectedIds.push(selected);
          }
          if (nextSelectedIds.includes(itemId)) {
            nextSelectedIds = nextSelectedIds.filter(id => id !== itemId);
          } else {
            nextSelectedIds.push(itemId);
          }
          
          if (nextSelectedIds.length === 1) {
            setSelected(nextSelectedIds[0]);
            setSelectedIds([]);
          } else if (nextSelectedIds.length > 1) {
            setSelected(null);
            setSelectedIds(nextSelectedIds);
          } else {
            setSelected(null);
            setSelectedIds([]);
          }
          setSelectedConn(null);
          setEditing(null);
          setEditingChildState(null);
          return;
        }

        // Fue un Shift+Arrastrar -> Seleccionar los elementos dentro del recuadro
        // y agregarlos/combinarlos con la selección existente
        const p = screenToCanvas(ev.clientX, ev.clientY);
        const rx = Math.min(startPt.x, p.x);
        const ry = Math.min(startPt.y, p.y);
        const rw = Math.abs(p.x - startPt.x);
        const rh = Math.abs(p.y - startPt.y);
        const hits = current.items.filter(it => {
          const ix = it.x, iy = it.y, iw = it.w, ih = it.h;
          return !(ix + iw < rx || ix > rx + rw || iy + ih < ry || iy > ry + rh);
        }).map(it => it.id);

        // Agregamos los nuevos elementos seleccionados a los que ya estaban
        let baseSelected = [...selectedIds];
        if (selected && !baseSelected.includes(selected)) {
          baseSelected.push(selected);
        }
        
        // Unir ambas listas de forma única
        const union = Array.from(new Set([...baseSelected, ...hits]));
        if (union.length === 1) {
          setSelected(union[0]);
          setSelectedIds([]);
        } else if (union.length > 1) {
          setSelected(null);
          setSelectedIds(union);
        } else {
          setSelected(null);
          setSelectedIds([]);
        }
        setSelectedConn(null);
        setEditing(null);
        setEditingChildState(null);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return;
    }
    // A column may only be grabbed by its top strip — clicking the gray body just selects it
    // (so its children stay interactive and the body isn't a drag handle).
    {
      const draggedItem = current.items.find(i => i.id === itemId);
      if (draggedItem && draggedItem.type === 'column' && e.target.closest('.column-body')) {
        if (!e.target.closest('.col-child-wrap')) {
          e.stopPropagation();
          setSelected(itemId); setSelectedIds([]); setSelectedConn(null); setContextMenu(null);
          setEditingChildState(null);
        }
      return;
    }
    }
    {
      const draggedItem = current.items.find(i => i.id === itemId);
      if (draggedItem && draggedItem.type === 'frame' && !e.target.closest('.frame-header')) {
        return;
      }
    }
    if (editing === itemId) return;
    if (editing && editing !== itemId) {
      setEditing(null);
      setEditingChildState(null);
    }
    if (activeTool === 'line') return; // handled by startLineDrag
    if (activeTool) return;
    e.stopPropagation();
    // Multi-drag: if the clicked item is part of multi-selection, move all together
    const isMultiDrag = selectedIds.length > 1 && selectedIds.includes(itemId);
    if (!isMultiDrag) setSelectedIds([]);
    setSelected(isMultiDrag ? null : itemId);
    setEditingChildState(null);
    setSelectedConn(null);
    setContextMenu(null);
    document.body.classList.add('odi-busy');
    const startX = e.clientX, startY = e.clientY;
    const item = current.items.find(i => i.id === itemId);
    if (!item) { document.body.classList.remove('odi-busy'); return; }
    const startItemX = item.x, startItemY = item.y;
    // Snapshot original positions for multi-drag
    const multiStart = isMultiDrag
      ? current.items.filter(it => selectedIds.includes(it.id)).map(it => ({ id: it.id, x: it.x, y: it.y }))
      : null;
    
    // Frame drag: snapshot geometrically-contained items, incluyendo MARCOS ANIDADOS
    // y su contenido (de forma recursiva).
    let frameChildrenStart = null;
    if (item.type === 'frame' && !isMultiDrag) {
      const sizeOf = (it) => ({
        w: it.w !== undefined ? it.w : (defaultDims ? defaultDims(it.type).w : 200),
        h: it.h !== undefined ? it.h : (defaultDims ? defaultDims(it.type).h : 120),
      });

      // Hijos directos de un marco.
      //  · Nodos normales: basta con que su CENTRO caiga dentro (regla tolerante).
      //  · Marcos: deben estar CONTENIDOS POR COMPLETO y ser de menor área. Esto
      //    hace la relación de un solo sentido por geometría — un marco grande
      //    nunca cabe entero dentro de uno pequeño, así que el hijo jamás
      //    arrastra al padre.
      const directChildren = (frame) => {
        const fw = frame.w || 400, fh = frame.h || 400;
        return current.items.filter(it => {
          if (it.id === frame.id || it.type === 'line') return false;
          const { w, h } = sizeOf(it);
          if (it.type === 'frame') {
            return it.x >= frame.x && it.y >= frame.y &&
                   it.x + w <= frame.x + fw && it.y + h <= frame.y + fh &&
                   (w * h) < (fw * fh);
          }
          const cx = it.x + w / 2, cy = it.y + h / 2;
          return cx >= frame.x && cx <= frame.x + fw &&
                 cy >= frame.y && cy <= frame.y + fh;
        });
      };

      // Recorrido en profundidad: al mover un marco se lleva sus marcos hijos y
      // todo lo que haya dentro de ellos. El Set evita duplicados y bucles.
      const collected = new Map();
      const walk = (frame) => {
        directChildren(frame).forEach(child => {
          if (collected.has(child.id) || child.id === itemId) return;
          collected.set(child.id, child);
          if (child.type === 'frame') walk(child);
        });
      };
      walk(item);

      frameChildrenStart = Array.from(collected.values()).map(it => ({ id: it.id, x: it.x, y: it.y }));
    }

    const startConnectors = (current.connectors || []).map(co => ({
      id: co.id,
      ortho: (co.ortho || []).map(p => ({ x: p.x, y: p.y }))
    }));
    let moved = false;
    let wasSnappedX = false;
    let wasSnappedY = false;
    let currentDropCol = null;
    let currentDropTodo = null;

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (!moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        moved = true;
        window.playAudioTone && window.playAudioTone('drag_start');
      }
      if (!moved) return;

      let targetX = startItemX + dx;
      let targetY = startItemY + dy;

      if (ev.shiftKey) {
        // Lock to horizontal or vertical axis based on major movement delta
        if (Math.abs(dx) > Math.abs(dy)) {
          targetY = startItemY;
        } else {
          targetX = startItemX;
        }
        // Snap to 20px grid
        targetX = Math.round(targetX / 20) * 20;
        targetY = Math.round(targetY / 20) * 20;
      }

      let activeGuidesX = [];
      let activeGuidesY = [];

      // Smart alignment guides relative to other items (ALWAYS active)
      const snapThreshold = 12;
      const w = item.w || 200;
      const h = item.h || 120;
      let bestDiffX = snapThreshold;
      let bestDiffY = snapThreshold;

      const currentItems = current.items || [];
      const MAX_ALIGN_DIST = 99999; // Constante de proximidad física perpendicular

      for (const other of currentItems) {
        if (other.id === itemId || other.type === 'line') continue;
        const ow = other.w || 200;
        const oh = other.h || 120;

        // Solo alinear en X (guías verticales) si la distancia vertical entre centros es menor al umbral
        const centerY = targetY + h / 2;
        const otherCenterY = other.y + oh / 2;
        const isNearY = Math.abs(centerY - otherCenterY) < MAX_ALIGN_DIST;

        if (isNearY) {
          // X alignments: left, center, right, left-to-right, right-to-left
          const xOpts = [
            { dragVal: targetX,       otherVal: other.x,        guideVal: other.x,        offset: 0 },
            { dragVal: targetX + w,   otherVal: other.x + ow,   guideVal: other.x + ow,   offset: -w },
            { dragVal: targetX,       otherVal: other.x + ow,   guideVal: other.x + ow,   offset: 0 },
            { dragVal: targetX + w,   otherVal: other.x,        guideVal: other.x,        offset: -w }
          ];
          if (other.type !== 'frame') {
            xOpts.push({ dragVal: targetX + w/2, otherVal: other.x + ow/2, guideVal: other.x + ow/2, offset: -w/2 });
          }
          for (const opt of xOpts) {
            const diff = Math.abs(opt.dragVal - opt.otherVal);
            if (diff < bestDiffX) {
              bestDiffX = diff;
              targetX = opt.otherVal + opt.offset;
              activeGuidesX = [{
                x: opt.guideVal,
                y1: Math.min(targetY, other.y),
                y2: Math.max(targetY + h, other.y + oh)
              }];
            }
          }
        }

        // Solo alinear en Y (guías horizontales) si la distancia horizontal entre centros es menor al umbral
        const centerX = targetX + w / 2;
        const otherCenterX = other.x + ow / 2;
        const isNearX = Math.abs(centerX - otherCenterX) < MAX_ALIGN_DIST;

        if (isNearX) {
          // Y alignments: top, middle, bottom, top-to-bottom, bottom-to-top
          const yOpts = [
            { dragVal: targetY,       otherVal: other.y,        guideVal: other.y,        offset: 0 },
            { dragVal: targetY + h,   otherVal: other.y + oh,   guideVal: other.y + oh,   offset: -h },
            { dragVal: targetY,       otherVal: other.y + oh,   guideVal: other.y + oh,   offset: 0 },
            { dragVal: targetY + h,   otherVal: other.y,        guideVal: other.y,        offset: -h }
          ];
          if (other.type !== 'frame') {
            yOpts.push({ dragVal: targetY + h/2, otherVal: other.y + oh/2, guideVal: other.y + oh/2, offset: -h/2 });
          }
          for (const opt of yOpts) {
            const diff = Math.abs(opt.dragVal - opt.otherVal);
            if (diff < bestDiffY) {
              bestDiffY = diff;
              targetY = opt.otherVal + opt.offset;
              activeGuidesY = [{
                y: opt.guideVal,
                x1: Math.min(targetX, other.x),
                x2: Math.max(targetX + w, other.x + ow)
              }];
            }
          }
        }
      }

      // ── Equal-spacing guides (Canva/Miro-style): snap so the gaps to the nearest
      //    same-row / same-column neighbours are equal, and draw bracket markers. ──
      const spacing = [];
      const SPACE_T = 8;
      const rowMates = currentItems.filter(o => o.id !== itemId && o.type !== 'line'
        && (targetY + h) > o.y + 4 && targetY < (o.y + (o.h || 120)) - 4);    // vertical overlap
      const colMates = currentItems.filter(o => o.id !== itemId && o.type !== 'line'
        && (targetX + w) > o.x + 4 && targetX < (o.x + (o.w || 200)) - 4);    // horizontal overlap

      // Horizontal equal spacing
      let hSnapped = false;
      {
        const Ls = rowMates.filter(o => (o.x + (o.w||200)) <= targetX + SPACE_T).sort((a,b)=>(b.x+(b.w||200))-(a.x+(a.w||200)));
        const Rs = rowMates.filter(o => o.x >= targetX + w - SPACE_T).sort((a,b)=>a.x-b.x);
        
        // Scenario 1: Center (L <- Target -> R)
        if (!hSnapped && Ls.length > 0 && Rs.length > 0) {
          const L = Ls[0], R = Rs[0];
          const lr = L.x + (L.w||200), rl = R.x;
          const gapL = targetX - lr, gapR = rl - (targetX + w);
          if (gapL > -SPACE_T && gapR > -SPACE_T && Math.abs(gapL - gapR) < SPACE_T * 2) {
            const free = rl - lr - w;
            targetX = lr + free / 2;
            const gy = targetY + h / 2;
            spacing.push({ x: lr, y: gy, w: targetX - lr, horizontal: true });
            spacing.push({ x: targetX + w, y: gy, w: rl - (targetX + w), horizontal: true });
            hSnapped = true;
          }
        }
        // Scenario 2: Right of two (A -> B -> Target)
        if (!hSnapped && Ls.length > 1) {
          const B = Ls[0], A = Ls[1];
          const gapAB = B.x - (A.x + (A.w||200));
          const gapBTarget = targetX - (B.x + (B.w||200));
          if (gapAB > 0 && gapBTarget > -SPACE_T && Math.abs(gapAB - gapBTarget) < SPACE_T * 2) {
            targetX = B.x + (B.w||200) + gapAB;
            const gy = targetY + h / 2;
            spacing.push({ x: A.x + (A.w||200), y: gy, w: gapAB, horizontal: true });
            spacing.push({ x: B.x + (B.w||200), y: gy, w: targetX - (B.x + (B.w||200)), horizontal: true });
            hSnapped = true;
          }
        }
        // Scenario 3: Left of two (Target -> A -> B)
        if (!hSnapped && Rs.length > 1) {
          const A = Rs[0], B = Rs[1];
          const gapAB = B.x - (A.x + (A.w||200));
          const gapTargetA = A.x - (targetX + w);
          if (gapAB > 0 && gapTargetA > -SPACE_T && Math.abs(gapAB - gapTargetA) < SPACE_T * 2) {
            targetX = A.x - gapAB - w;
            const gy = targetY + h / 2;
            spacing.push({ x: targetX + w, y: gy, w: A.x - (targetX + w), horizontal: true });
            spacing.push({ x: A.x + (A.w||200), y: gy, w: gapAB, horizontal: true });
            hSnapped = true;
          }
        }
      }

      // Vertical equal spacing
      let vSnapped = false;
      {
        const Ts = colMates.filter(o => (o.y + (o.h||120)) <= targetY + SPACE_T).sort((a,b)=>(b.y+(b.h||120))-(a.y+(a.h||120)));
        const Bns = colMates.filter(o => o.y >= targetY + h - SPACE_T).sort((a,b)=>a.y-b.y);
        
        // Scenario 1: Center (T <- Target -> B)
        if (!vSnapped && Ts.length > 0 && Bns.length > 0) {
          const T = Ts[0], Bn = Bns[0];
          const tb = T.y + (T.h||120), bt = Bn.y;
          const gapT = targetY - tb, gapB = bt - (targetY + h);
          if (gapT > -SPACE_T && gapB > -SPACE_T && Math.abs(gapT - gapB) < SPACE_T * 2) {
            const free = bt - tb - h;
            targetY = tb + free / 2;
            const gx = targetX + w / 2;
            spacing.push({ x: gx, y: tb, h: targetY - tb, horizontal: false });
            spacing.push({ x: gx, y: targetY + h, h: bt - (targetY + h), horizontal: false });
            vSnapped = true;
          }
        }
        // Scenario 2: Below two (A -> B -> Target)
        if (!vSnapped && Ts.length > 1) {
          const B = Ts[0], A = Ts[1];
          const gapAB = B.y - (A.y + (A.h||120));
          const gapBTarget = targetY - (B.y + (B.h||120));
          if (gapAB > 0 && gapBTarget > -SPACE_T && Math.abs(gapAB - gapBTarget) < SPACE_T * 2) {
            targetY = B.y + (B.h||120) + gapAB;
            const gx = targetX + w / 2;
            spacing.push({ x: gx, y: A.y + (A.h||120), h: gapAB, horizontal: false });
            spacing.push({ x: gx, y: B.y + (B.h||120), h: targetY - (B.y + (B.h||120)), horizontal: false });
            vSnapped = true;
          }
        }
        // Scenario 3: Above two (Target -> A -> B)
        if (!vSnapped && Bns.length > 1) {
          const A = Bns[0], B = Bns[1];
          const gapAB = B.y - (A.y + (A.h||120));
          const gapTargetA = A.y - (targetY + h);
          if (gapAB > 0 && gapTargetA > -SPACE_T && Math.abs(gapAB - gapTargetA) < SPACE_T * 2) {
            targetY = A.y - gapAB - h;
            const gx = targetX + w / 2;
            spacing.push({ x: gx, y: targetY + h, h: A.y - (targetY + h), horizontal: false });
            spacing.push({ x: gx, y: A.y + (A.h||120), h: gapAB, horizontal: false });
            vSnapped = true;
          }
        }
      }

      setGuides({ x: activeGuidesX, y: activeGuidesY, spacing });

      if (isMultiDrag && multiStart) {
        // Move all selected items by the same delta
        let finalDx = dx;
        let finalDy = dy;
        if (ev.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) {
            finalDy = 0;
          } else {
            finalDx = 0;
          }
        }
        _setCanvases(prev => {
          const c = prev[currentId];
          return { ...prev, [currentId]: {
            ...c,
            items: c.items.map(it => {
              const ms = multiStart.find(m => m.id === it.id);
              if (ms) {
                let nx = ms.x + finalDx;
                let ny = ms.y + finalDy;
                if (ev.shiftKey) {
                  nx = Math.round(nx / 20) * 20;
                  ny = Math.round(ny / 20) * 20;
                }
                return { ...it, x: nx, y: ny, _dragging: true };
              }
              return it;
            }),
            connectors: (c.connectors || []).map(co => {
              const sc = startConnectors.find(x => x.id === co.id);
              if (sc && sc.ortho.length && co.shape === 'orthogonal' && co.fromEnd && selectedIds.includes(co.fromEnd.itemId) && co.toEnd && selectedIds.includes(co.toEnd.itemId)) {
                return {
                  ...co,
                  ortho: sc.ortho.map(p => ({ x: p.x + finalDx, y: p.y + finalDy }))
                };
              }
              return co;
            })
          }};
        });
        return;
      }

      if (frameChildrenStart && frameChildrenStart.length > 0) {
        const finalDx = targetX - startItemX;
        const finalDy = targetY - startItemY;
        _setCanvases(prev => {
          const c = prev[currentId];
          return {
            ...prev,
            [currentId]: {
              ...c,
              items: c.items.map(it => {
                if (it.id === itemId) {
                  return { ...it, x: targetX, y: targetY, _dragging: true };
                }
                const fc = frameChildrenStart.find(x => x.id === it.id);
                if (fc) {
                  return { ...it, x: fc.x + finalDx, y: fc.y + finalDy, _dragging: true };
                }
                return it;
              })
            }
          };
        });
        return;
      }

      updateItemSilent(itemId, { x: targetX, y: targetY, _dragging: true });

      // detect column drop target (item being dragged is NOT itself a column)
      if (item.type !== 'column') {
        const cx = targetX + item.w / 2;
        const cy = targetY + item.h / 2;
        const overCol = current.items.find(it =>
          it.id !== itemId && it.type === 'column' &&
          cx >= it.x && cx <= it.x + it.w &&
          cy >= it.y && cy <= it.y + it.h
        );
        const newDropId = overCol?.id || null;
        if (newDropId !== currentDropCol) {
          currentDropCol = newDropId;
          setDropTargetCol(newDropId);
        }
      }

      // Detect To-do card drop target (only if item being dragged is a To-do card itself)
      if (item.type === 'todo') {
        const cx = targetX + item.w / 2;
        const cy = targetY + item.h / 2;
        const overTodo = current.items.find(it =>
          it.id !== itemId && it.type === 'todo' &&
          cx >= it.x && cx <= it.x + it.w &&
          cy >= it.y && cy <= it.y + it.h
        );
        const newDropTodoId = overTodo?.id || null;
        if (newDropTodoId !== currentDropTodo) {
          currentDropTodo = newDropTodoId;
          setDropTargetTodo(newDropTodoId);
        }
      }

      // Snap sound feedback
      const currentlySnappedX = (bestDiffX < snapThreshold);
      const currentlySnappedY = (bestDiffY < snapThreshold);
      if ((currentlySnappedX && !wasSnappedX) || (currentlySnappedY && !wasSnappedY)) {
        window.playAudioTone && window.playAudioTone('snap');
      }
      wasSnappedX = currentlySnappedX;
      wasSnappedY = currentlySnappedY;
    };
    const onUp = () => {
      document.body.classList.remove('odi-busy');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDropTargetCol(null);
      setDropTargetTodo(null);
      setGuides(null);

      if (moved) {
        window.playAudioTone && window.playAudioTone('drag_end');
      }

      if (isMultiDrag) {
        // Commit a non-silent update so history snapshots the new positions, and clear _dragging
        setCanvases(prev => {
          const c = prev[currentId];
          return { ...prev, [currentId]: {
            ...c,
            items: c.items.map(it => selectedIds.includes(it.id) ? { ...it, _dragging: false } : it),
            connectors: (c.connectors || []).map(co => {
              if (co.shape === 'orthogonal' && co.fromEnd && selectedIds.includes(co.fromEnd.itemId) && co.toEnd && selectedIds.includes(co.toEnd.itemId)) {
                return {
                  ...co,
                  ortho: cleanupOrtho(co.ortho || [])
                };
              }
              return co;
            })
          }};
        });
        return;
      }

      if (frameChildrenStart && frameChildrenStart.length > 0) {
        setCanvases(prev => {
          const c = prev[currentId];
          return {
            ...prev,
            [currentId]: {
              ...c,
              items: c.items.map(it => (it.id === itemId || frameChildrenStart.some(x => x.id === it.id)) ? { ...it, _dragging: false } : it)
            }
          };
        });
        return;
      }

      if (currentDropCol) {
        // ABSORB item into column
        setCanvases(prev => {
          const c = prev[currentId];
          const movedItem = c.items.find(i => i.id === itemId);
          if (!movedItem) return prev;
          const childCopy = { ...movedItem };
          delete childCopy._dragging;
          delete childCopy._new;
          return {
            ...prev,
            [currentId]: {
              ...c,
              items: withResizedColumn(
                c.items
                  .filter(i => i.id !== itemId)
                  .map(i => i.id === currentDropCol
                    ? { ...i, children: [...(i.children || []), childCopy] }
                    : i),
                currentDropCol
              ),
              connectors: c.connectors || [],
            },
          };
        });
        setSelected(null);
      } else if (currentDropTodo && item.type === 'todo') {
        // ABSORB todo tasks into another todo card
        setCanvases(prev => {
          const c = prev[currentId];
          const draggedTodo = c.items.find(i => i.id === itemId);
          const destTodo = c.items.find(i => i.id === currentDropTodo);
          if (!draggedTodo || !destTodo) return prev;

          const mergedTasks = [...(destTodo.items || []), ...(draggedTodo.items || [])];

          return {
            ...prev,
            [currentId]: {
              ...c,
              items: c.items
                .filter(i => i.id !== itemId)
                .map(i => i.id === currentDropTodo ? { ...i, items: mergedTasks } : i)
            }
          };
        });
        setSelected(null);
      } else {
        if (moved) updateItem(itemId, { _dragging: false });
        else updateItemSilent(itemId, { _dragging: false });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ───── Drag a child OUT of a column (extract on movement) ─────
  const startColChildDrag = (e, columnId, childId) => {
    if (e.target.closest('input, textarea, button, .todo-check, .swatch-btn, .anchor, .todo-add, .cal-mb-input, .cal-mb-cell, .cal-mb-nav, [contenteditable="true"]')) return;
    if (activeTool) return;
    e.stopPropagation();
    document.body.classList.add('odi-busy');
    const startX = e.clientX, startY = e.clientY;
    let extracted = false;
    let wasSnappedX = false;
    let wasSnappedY = false;
    let extractedId = null;
    let extractedW = 200, extractedH = 100;
    let currentDropCol = null;
    let startItemX = 0, startItemY = 0;
    let extractStartX = 0, extractStartY = 0;

    const onMove = (ev) => {
      if (!extracted) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        // EXTRACT child from column
        const col = current.items.find(i => i.id === columnId);
        if (!col) return;
        const child = (col.children || []).find(c => c.id === childId);
        if (!child) return;
        extracted = true;
        window.playAudioTone && window.playAudioTone('drag_start');
        extractedW = child.w || 200;
        extractedH = child.h || 100;
        const screenPt = screenToCanvas(ev.clientX, ev.clientY);
        const newItem = {
          ...child,
          x: screenPt.x - extractedW / 2,
          y: screenPt.y - extractedH / 2,
          _dragging: true,
        };
        extractedId = newItem.id;
        extractStartX = ev.clientX;
        extractStartY = ev.clientY;
        startItemX = newItem.x;
        startItemY = newItem.y;
        setCanvases(prev => {
          const c = prev[currentId];
          return {
            ...prev,
            [currentId]: {
              ...c,
              items: withResizedColumn(
                c.items
                  .map(it => it.id === columnId
                    ? { ...it, children: (it.children || []).filter(ch => ch.id !== childId) }
                    : it)
                  .concat([newItem]),
                columnId
              ),
            },
          };
        });
        setSelected(extractedId);
        return;
      }
      // continue drag
      const screenPt = screenToCanvas(ev.clientX, ev.clientY);
      let nx = screenPt.x - extractedW / 2;
      let ny = screenPt.y - extractedH / 2;

      // Snapping/constraining
      if (ev.shiftKey) {
        const dx = (ev.clientX - extractStartX) / scale;
        const dy = (ev.clientY - extractStartY) / scale;
        if (Math.abs(dx) > Math.abs(dy)) {
          ny = startItemY;
        } else {
          nx = startItemX;
        }
        nx = Math.round(nx / 20) * 20;
        ny = Math.round(ny / 20) * 20;
      }

      let activeGuidesX = [];
      let activeGuidesY = [];
      const snapThreshold = 12;
      const w = extractedW;
      const h = extractedH;
      let bestDiffX = snapThreshold;
      let bestDiffY = snapThreshold;

      const currentItems = current.items || [];
      const MAX_ALIGN_DIST = 99999;

      for (const other of currentItems) {
        if (other.id === extractedId || other.type === 'line') continue;
        const ow = other.w || 200;
        const oh = other.h || 120;

        // Solo alinear en X (guías verticales) si la distancia vertical entre centros es menor al umbral
        const centerY = ny + h / 2;
        const otherCenterY = other.y + oh / 2;
        const isNearY = Math.abs(centerY - otherCenterY) < MAX_ALIGN_DIST;

        if (isNearY) {
          // X alignments
          const xOpts = [
            { dragVal: nx,       otherVal: other.x,        guideVal: other.x,        offset: 0 },
            { dragVal: nx + w/2, otherVal: other.x + ow/2, guideVal: other.x + ow/2, offset: -w/2 },
            { dragVal: nx + w,   otherVal: other.x + ow,   guideVal: other.x + ow,   offset: -w },
            { dragVal: nx,       otherVal: other.x + ow,   guideVal: other.x + ow,   offset: 0 },
            { dragVal: nx + w,   otherVal: other.x,        guideVal: other.x,        offset: -w }
          ];
          for (const opt of xOpts) {
            const diff = Math.abs(opt.dragVal - opt.otherVal);
            if (diff < bestDiffX) {
              bestDiffX = diff;
              nx = opt.otherVal + opt.offset;
              activeGuidesX = [{
                x: opt.guideVal,
                y1: Math.min(ny, other.y),
                y2: Math.max(ny + h, other.y + oh)
              }];
            }
          }
        }

        // Solo alinear en Y (guías horizontales) si la distancia horizontal entre centros es menor al umbral
        const centerX = nx + w / 2;
        const otherCenterX = other.x + ow / 2;
        const isNearX = Math.abs(centerX - otherCenterX) < MAX_ALIGN_DIST;

        if (isNearX) {
          // Y alignments
          const yOpts = [
            { dragVal: ny,       otherVal: other.y,        guideVal: other.y,        offset: 0 },
            { dragVal: ny + h/2, otherVal: other.y + oh/2, guideVal: other.y + oh/2, offset: -h/2 },
            { dragVal: ny + h,   otherVal: other.y + oh,   guideVal: other.y + oh,   offset: -h },
            { dragVal: ny,       otherVal: other.y + oh,   guideVal: other.y + oh,   offset: 0 },
            { dragVal: ny + h,   otherVal: other.y,        guideVal: other.y,        offset: -h }
          ];
          for (const opt of yOpts) {
            const diff = Math.abs(opt.dragVal - opt.otherVal);
            if (diff < bestDiffY) {
              bestDiffY = diff;
              ny = opt.otherVal + opt.offset;
              activeGuidesY = [{
                y: opt.guideVal,
                x1: Math.min(nx, other.x),
                x2: Math.max(nx + w, other.x + ow)
              }];
            }
          }
        }
      }

      setGuides({ x: activeGuidesX, y: activeGuidesY });
      updateItemSilent(extractedId, { x: nx, y: ny, _dragging: true });

      const cx = nx + extractedW / 2;
      const cy = ny + extractedH / 2;
      const overCol = current.items.find(it =>
        it.id !== extractedId && it.type === 'column' &&
        cx >= it.x && cx <= it.x + it.w &&
        cy >= it.y && cy <= it.y + it.h
      );
      const newDropId = overCol?.id || null;
      if (newDropId !== currentDropCol) {
        currentDropCol = newDropId;
        setDropTargetCol(newDropId);
      }

      // Snap sound feedback
      const currentlySnappedX = (bestDiffX < snapThreshold);
      const currentlySnappedY = (bestDiffY < snapThreshold);
      if ((currentlySnappedX && !wasSnappedX) || (currentlySnappedY && !wasSnappedY)) {
        window.playAudioTone && window.playAudioTone('snap');
      }
      wasSnappedX = currentlySnappedX;
      wasSnappedY = currentlySnappedY;
    };
    const onUp = () => {
      document.body.classList.remove('odi-busy');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDropTargetCol(null);
      setGuides(null);

      if (extracted) {
        window.playAudioTone && window.playAudioTone('drag_end');
      }

      if (extracted && extractedId) {
        if (currentDropCol) {
          setCanvases(prev => {
            const c = prev[currentId];
            const movedItem = c.items.find(i => i.id === extractedId);
            if (!movedItem) return prev;
            const childCopy = { ...movedItem };
            delete childCopy._dragging;
            return {
              ...prev,
              [currentId]: {
                ...c,
                items: withResizedColumn(
                  c.items
                    .filter(i => i.id !== extractedId)
                    .map(i => i.id === currentDropCol
                      ? { ...i, children: [...(i.children || []), childCopy] }
                      : i),
                  currentDropCol
                ),
              },
            };
          });
          setSelected(null);
        } else {
          updateItem(extractedId, { _dragging: false });
        }
      } else {
        setSelected(childId);
        setSelectedIds([]);
        setSelectedConn(null);
        setEditingChildState({ colId: columnId, childId });
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ───── Drag a task row OUT of a todo card (create/absorb task on drop) ─────
  // Remove a to-do node entirely if it is a titleless (pulled-out) card that has just become
  // empty — so dragging its only task into another to-do doesn't leave a dangling empty box.
  const pruneEmptyTitlelessTodos = (items, srcTodoId, newSrcItems) => {
    if (newSrcItems && newSrcItems.length > 0) return items; // still has tasks → keep
    const src = items.find(i => i.id === srcTodoId);
    if (src) {
      if (src.type === 'todo' && src.showTitle === false) {
        return items.filter(i => i.id !== srcTodoId);
      }
      return items;
    }
    // Source might be a column child
    return items.map(it => {
      if (it.type === 'column' && it.children) {
        const ch = it.children.find(c => c.id === srcTodoId);
        if (ch && ch.type === 'todo' && ch.showTitle === false) {
          return { ...it, children: it.children.filter(c => c.id !== srcTodoId) };
        }
      }
      return it;
    });
  };

  const startDragTaskRow = (e, todoId, rowIdx) => {
    e.preventDefault();
    e.stopPropagation();

    // Helper to find a todo item in canvas or columns
    const findTodo = (items, itemId) => {
      const top = items.find(it => it.id === itemId);
      if (top) return { item: top, colId: null };
      for (const it of items) {
        if (it.type === 'column' && it.children) {
          const ch = it.children.find(c => c.id === itemId);
          if (ch) return { item: ch, colId: it.id };
        }
      }
      return { item: null, colId: null };
    };

    const { item: todoItem } = findTodo(current.items, todoId);
    if (!todoItem || !todoItem.items) return;
    const task = todoItem.items[rowIdx];
    if (!task) return;

    document.body.classList.add('odi-busy', 'dragging-task');
    setDraggedTask({
      todoId,
      rowIdx,
      x: e.clientX,
      y: e.clientY,
      text: window.pickLang(task.text, lang)
    });

    let currentDropTodoId = null;

    // Posición en la que caería la tarea. La misma cuenta se hacía solo al
    // soltar, así que durante el arrastre no había forma de saber si la tarea
    // iba a quedar por encima o por debajo de la de al lado.
    const insertIndexAt = (destId, clientY) => {
      const destEl = destId && document.querySelector(`[data-item-id="${destId}"]`);
      if (!destEl) return 0;
      const rows = Array.from(destEl.querySelectorAll('.todo-row'));
      for (let i = 0; i < rows.length; i++) {
        const rect = rows[i].getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return i;
      }
      return rows.length;
    };

    // La línea se pinta tocando el DOM en vez de con estado de React: durante
    // un arrastre esto se ejecuta en cada movimiento del dedo y re-renderizar
    // el nodo entero cada vez lo volvería lento.
    const paintDropLine = (destId, clientY) => {
      document.querySelectorAll('.todo-row.drop-before, .todo-row.drop-after')
        .forEach(r => r.classList.remove('drop-before', 'drop-after'));
      if (!destId) return;
      const destEl = document.querySelector(`[data-item-id="${destId}"]`);
      if (!destEl) return;
      const rows = Array.from(destEl.querySelectorAll('.todo-row'));
      if (!rows.length) return;
      const idx = insertIndexAt(destId, clientY);
      if (idx >= rows.length) rows[rows.length - 1].classList.add('drop-after');
      else rows[idx].classList.add('drop-before');
    };

    const onMove = (ev) => {
      setDraggedTask(prev => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null);

      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const todoCardEl = el?.closest('.todo-card');
      const itemEl = todoCardEl?.closest('[data-item-id]');
      const newDropId = itemEl?.getAttribute('data-item-id') || null;

      if (newDropId !== currentDropTodoId) {
        currentDropTodoId = newDropId;
        setDropTargetTodo(newDropId);
      }
      paintDropLine(newDropId, ev.clientY);
    };

    const onUp = (ev) => {
      document.body.classList.remove('odi-busy', 'dragging-task');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDraggedTask(null);
      setDropTargetTodo(null);
      paintDropLine(null);

      const canvasPt = screenToCanvas(ev.clientX, ev.clientY);

      // Helper to apply todo changes to items array (handling both canvas & columns)
      const updateTodo = (items, targetId, fields) => {
        return items.map(it => {
          if (it.id === targetId) {
            return { ...it, ...fields };
          }
          if (it.type === 'column' && it.children) {
            return {
              ...it,
              children: it.children.map(ch => ch.id === targetId ? { ...ch, ...fields } : ch)
            };
          }
          return it;
        });
      };

      if (currentDropTodoId) {
        // Drop inside a To-do (can be the source todoId or a destTodoId!)
        setCanvases(prev => {
          const c = prev[currentId];
          const { item: srcTodo, colId: srcColId } = findTodo(c.items, todoId);
          const { item: destTodo, colId: destColId } = findTodo(c.items, currentDropTodoId);
          if (!srcTodo || !destTodo) return prev;

          const taskToMove = srcTodo.items[rowIdx];
          if (!taskToMove) return prev;

          let newSrcItems = [...srcTodo.items];
          let insertIdx = (destTodo.items || []).length; // default to end

          // Misma cuenta que pinta la línea guía, para que caiga exactamente
          // donde el usuario ha visto que iba a caer.
          if (document.querySelector(`[data-item-id="${currentDropTodoId}"]`)) {
            insertIdx = insertIndexAt(currentDropTodoId, ev.clientY);
          }

          let updatedItems = c.items;

          if (todoId === currentDropTodoId) {
            // Reordering within the same todo card!
            newSrcItems.splice(rowIdx, 1);
            let adjustedInsertIdx = insertIdx;
            if (adjustedInsertIdx > rowIdx) {
              adjustedInsertIdx--;
            }
            newSrcItems.splice(adjustedInsertIdx, 0, taskToMove);

            updatedItems = updateTodo(updatedItems, todoId, { items: newSrcItems });
          } else {
            // Moving to a different todo card!
            newSrcItems.splice(rowIdx, 1);
            const newDestItems = [...(destTodo.items || [])];
            newDestItems.splice(insertIdx, 0, { ...taskToMove, indent: 0 });

            updatedItems = updateTodo(updatedItems, todoId, { items: newSrcItems });
            updatedItems = updateTodo(updatedItems, currentDropTodoId, { items: newDestItems });
            // If the SOURCE was a titleless (pulled-out) to-do and is now empty, remove it
            updatedItems = pruneEmptyTitlelessTodos(updatedItems, todoId, newSrcItems);
          }

          // If source or destination was in a column, trigger column resize
          if (srcColId) {
            updatedItems = withResizedColumn(updatedItems, srcColId);
          }
          if (destColId && destColId !== srcColId) {
            updatedItems = withResizedColumn(updatedItems, destColId);
          }

          return {
            ...prev,
            [currentId]: {
              ...c,
              items: updatedItems
            }
          };
        });
      } else {
        // Drop on canvas -> Create a new To-do card!
        setCanvases(prev => {
          const c = prev[currentId];
          const { item: srcTodo, colId: srcColId } = findTodo(c.items, todoId);
          if (!srcTodo) return prev;

          const taskToMove = srcTodo.items[rowIdx];
          if (!taskToMove) return prev;

          const newSrcItems = srcTodo.items.filter((_, idx) => idx !== rowIdx);

          const newTodoId = `todo-${Date.now()}`;
          const newTodoNode = {
            id: newTodoId,
            type: 'todo',
            x: canvasPt.x - 150,
            y: canvasPt.y - 60,
            w: 300,
            h: 120,
            color: srcTodo.color || 'white',
            showTitle: false,                 // pulled-out task → no title until the user adds one
            title: { es: '', en: '' },
            items: [{ ...taskToMove, indent: 0 }]
          };

          let updatedItems = updateTodo(c.items, todoId, { items: newSrcItems });
          updatedItems = updatedItems.concat([newTodoNode]);
          // If the SOURCE was a titleless (pulled-out) to-do and is now empty, remove it
          updatedItems = pruneEmptyTitlelessTodos(updatedItems, todoId, newSrcItems);

          if (srcColId) {
            updatedItems = withResizedColumn(updatedItems, srcColId);
          }

          return {
            ...prev,
            [currentId]: {
              ...c,
              items: updatedItems
            }
          };
        });
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startAnchorDrag = (e, fromId, fromAnchor) => {
    e.stopPropagation(); e.preventDefault();
    const fromRect = window.getNodeRect?.(fromId, current.items);
    if (!fromRect) return;
    const startPos = anchorPos(fromRect, fromAnchor);
    setPendingConn({ fromId, fromAnchor, fromX: startPos.x, fromY: startPos.y, mx: startPos.x, my: startPos.y });

    // Nodo que hay bajo el puntero mientras se arrastra la flecha. En escritorio
    // esto se ve solo, porque al pasar por encima de un nodo se encienden sus
    // puntos de anclaje; con el dedo no existe "pasar por encima", así que sin
    // esto no hay forma de saber si la flecha va a engancharse o a quedar suelta.
    const highlightUnder = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const itemEl = el && el.closest ? el.closest('.item, .col-child-wrap') : null;
      const id = itemEl && itemEl.getAttribute('data-item-id');
      setLinkTargetId(id && id !== fromId ? id : null);
    };

    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY);
      setPendingConn(pc => pc && { ...pc, mx: p.x, my: p.y });
      highlightUnder(ev);
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setLinkTargetId(null);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const itemEl = el?.closest('.item, .col-child-wrap');
      const targetId = itemEl?.getAttribute('data-item-id');
      if (targetId && targetId !== fromId) {
        const targetRect = window.getNodeRect?.(targetId, current.items);
        if (targetRect) {
          const p = screenToCanvas(ev.clientX, ev.clientY);
          const toAnchor = closestAnchor(targetRect, p.x, p.y);
          addConnector({ itemId: fromId, anchor: fromAnchor }, { itemId: targetId, anchor: toAnchor });
        }
      }
      // No free arrow from anchor drag — only Line tool creates floating arrows
      setPendingConn(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ───── Line tool: draw an arrow (from item or free) ─────
  const startLineDrag = (e, fromId) => {
    e.stopPropagation(); e.preventDefault();
    const startPt = screenToCanvas(e.clientX, e.clientY);
    let fromEnd;
    if (fromId) {
      const fromRect = window.getNodeRect?.(fromId, current.items);
      if (fromRect) {
        const anchor = 'center';
        fromEnd = { itemId: fromId, anchor };
        const ap = { x: fromRect.x + fromRect.w / 2, y: fromRect.y + fromRect.h / 2 };
        setPendingConn({ fromX: ap.x, fromY: ap.y, mx: ap.x, my: ap.y });
      }
    } else {
      fromEnd = { x: startPt.x, y: startPt.y };
      setPendingConn({ fromX: startPt.x, fromY: startPt.y, mx: startPt.x, my: startPt.y });
    }
    if (!fromEnd) return;

    // Nodo que hay bajo el puntero mientras se arrastra la flecha. En escritorio
    // esto se ve solo, porque al pasar por encima de un nodo se encienden sus
    // puntos de anclaje; con el dedo no existe "pasar por encima", así que sin
    // esto no hay forma de saber si la flecha va a engancharse o a quedar suelta.
    const highlightUnder = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const itemEl = el && el.closest ? el.closest('.item, .col-child-wrap') : null;
      const id = itemEl && itemEl.getAttribute('data-item-id');
      setLinkTargetId(id && id !== fromId ? id : null);
    };

    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY);
      setPendingConn(pc => pc && { ...pc, mx: p.x, my: p.y });
      highlightUnder(ev);
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setLinkTargetId(null);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const itemEl = el?.closest('.item, .col-child-wrap');
      const targetId = itemEl?.getAttribute('data-item-id');
      let toEnd;
      const dropPt = screenToCanvas(ev.clientX, ev.clientY);
      if (targetId && targetId !== fromId) {
        const targetRect = window.getNodeRect?.(targetId, current.items);
        if (targetRect) {
          const anchor = 'center';
          toEnd = { itemId: targetId, anchor };
        }
      }
      if (!toEnd) {
        // ensure minimum length for a 'free' arrow
        const startX = startPt.x, startY = startPt.y;
        const dist = Math.hypot(dropPt.x - startX, dropPt.y - startY);
        if (dist < 30) {
          // make a default-length arrow to the right
          toEnd = { x: dropPt.x + 120, y: dropPt.y };
        } else {
          toEnd = { x: dropPt.x, y: dropPt.y };
        }
      }
      addConnector(fromEnd, toEnd);
      setPendingConn(null);
      setActiveTool(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ───── Item ops ─────
  const deleteItem = (itemId) => {
    window.playAudioTone && window.playAudioTone('delete');
    setCanvases(prev => {
      const c = prev[currentId];
      let item = c.items.find(i => i.id === itemId);
      let nextItems;
      if (item) {
        nextItems = c.items.filter(i => i.id !== itemId);
      } else {
        // La tarjeta puede vivir DENTRO de una columna: antes estos nodos no se
        // podían eliminar porque solo se buscaba en el primer nivel del lienzo
        nextItems = c.items.map(it => {
          if (it.type === 'column' && it.children) {
            const found = it.children.find(ch => ch.id === itemId);
            if (found) {
              item = found;
              return { ...it, children: it.children.filter(ch => ch.id !== itemId) };
            }
          }
          return it;
        });
        if (!item) return prev;
      }
      const nextCanvases = {
        ...prev,
        [currentId]: {
          ...c,
          items: nextItems,
          connectors: (c.connectors || []).filter(co => {
            const fromId = co.fromEnd?.itemId || co.from;
            const toId   = co.toEnd?.itemId   || co.to;
            return fromId !== itemId && toId !== itemId;
          }),
        },
      };
      if (item && item.type === 'board' && item.canvasId) {
        const toRemove = new Set([item.canvasId]);
        let added = true;
        while (added) {
          added = false;
          Object.keys(nextCanvases).forEach(k => {
            if (toRemove.has(k) && nextCanvases[k]) {
              (nextCanvases[k].items || []).forEach(it => {
                if (it.type === 'board' && it.canvasId && !toRemove.has(it.canvasId)) {
                  toRemove.add(it.canvasId); added = true;
                }
              });
            }
          });
        }
        toRemove.forEach(id => delete nextCanvases[id]);
      }
      return nextCanvases;
    });
    setSelected(null); setEditing(null); setContextMenu(null);
  };

  const duplicateItem = (itemId) => {
    window.playAudioTone && window.playAudioTone('create');
    setCanvases(prev => {
      const c = prev[currentId];
      const it = c.items.find(i => i.id === itemId);
      if (!it) return prev;
      const copy = JSON.parse(JSON.stringify(it));
      copy.id = `it-${Date.now()}-${Math.floor(Math.random()*9999)}`;
      copy.x += 28; copy.y += 28;
      copy._new = true;
      const next = { ...prev, [currentId]: { ...c, items: [...c.items, copy] } };
      if (copy.type === 'board' && copy.canvasId) {
        const newCid = `b-${Date.now()}-${Math.floor(Math.random()*9999)}`;
        const orig = prev[copy.canvasId];
        if (orig) {
          next[newCid] = JSON.parse(JSON.stringify(orig));
          next[newCid].parent = currentId;
          next[newCid].parentLabel = c.title;
        }
        copy.canvasId = newCid;
      }
      return next;
    });
  };

  const setItemColor = (itemId, color) => updateItem(itemId, { color });

  // ───── Resize ─────
  const startResize = (e, itemId, corner) => {
    e.stopPropagation(); e.preventDefault();
    const item = current.items.find(i => i.id === itemId);
    if (!item) return;
    document.body.classList.add('odi-busy');
    const startX = e.clientX, startY = e.clientY;
    const sx = item.x, sy = item.y, sw = item.w, sh = item.h;
    const minW = 100, minH = 50;
    const aspectRatio = sw / sh;
    // Nodos en modo compacto (sin vista previa): el redimensionado mantiene la
    // proporción (no se puede poner "más gordo o más flaco"), igual que con Shift.
    const aspectLocked = item.showPreview === false && ['board','doc','link'].includes(item.type);
    
    // Multi-resize logic setup
    const isMulti = selectedIds.length > 1 && selectedIds.includes(itemId);
    let groupStarts = null;
    let groupMinX = Infinity, groupMinY = Infinity, groupMaxX = -Infinity, groupMaxY = -Infinity;
    let groupW = 0, groupH = 0;
    
    if (isMulti) {
      const selectedItems = current.items.filter(it => selectedIds.includes(it.id));
      for (const it of selectedItems) {
        const w = it.w !== undefined ? it.w : (it.type === 'frame' ? 400 : 200);
        const h = it.h !== undefined ? it.h : (it.type === 'frame' ? 400 : 120);
        if (it.x < groupMinX) groupMinX = it.x;
        if (it.y < groupMinY) groupMinY = it.y;
        if (it.x + w > groupMaxX) groupMaxX = it.x + w;
        if (it.y + h > groupMaxY) groupMaxY = it.y + h;
      }
      groupW = groupMaxX - groupMinX;
      groupH = groupMaxY - groupMinY;
      
      groupStarts = selectedItems.map(it => {
        const w = it.w !== undefined ? it.w : (it.type === 'frame' ? 400 : 200);
        const h = it.h !== undefined ? it.h : (it.type === 'frame' ? 400 : 120);
        return {
          id: it.id,
          relX: groupW > 0 ? (it.x - groupMinX) / groupW : 0,
          relY: groupH > 0 ? (it.y - groupMinY) / groupH : 0,
          relW: groupW > 0 ? w / groupW : 0,
          relH: groupH > 0 ? h / groupH : 0,
          startX: it.x,
          startY: it.y,
          startW: w,
          startH: h
        };
      });
    }
    
    // Desde el primer momento marcamos la altura como manual en los nodos que se
    // auto-ajustan al texto, para que dejen de imponer su propia altura.
    if (['note', 'comment', 'todo'].includes(item.type) && !item.manualH) {
      updateItemSilent(itemId, { manualH: true });
    }

    let resizeMaster = null; // Locked to 'x' or 'y' on first move to prevent jumps
    let wasSnappedX = false;
    let wasSnappedY = false;

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      
      // Determine master axis once past a tiny deadzone
      if (resizeMaster === null && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        resizeMaster = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      }

      let nx = sx, ny = sy, nw = sw, nh = sh;
      
      let activeGuidesX = [];
      let activeGuidesY = [];
      const snapThreshold = 10;
      const MAX_ALIGN_DIST = 99999;
      const currentItems = current.items || [];

      if (ev.shiftKey || item.type === 'file' || aspectLocked) {
        const master = resizeMaster || 'x'; // default to x
        if (master === 'x') {
          if (corner.includes('r')) nw = Math.max(minW, sw + dx);
          if (corner.includes('l')) nw = Math.max(minW, sw - dx);

          // Snap X
          let bestDiffX = snapThreshold;
          let snapXVal = null;
          let guideY1 = null, guideY2 = null;
          const myVal = corner.includes('r') ? (nx + nw) : (sx + sw - nw);

          for (const other of currentItems) {
            if (other.id === itemId || other.type === 'line') continue;
            const ow = other.w || 200;
            const oh = other.h || 120;
            const centerY = ny + nh / 2;
            const otherCenterY = other.y + oh / 2;
            if (Math.abs(centerY - otherCenterY) < MAX_ALIGN_DIST) {
              const otherXOpts = other.type === 'frame' ? [other.x, other.x + ow] : [other.x, other.x + ow/2, other.x + ow];
              for (const otherVal of otherXOpts) {
                const diff = Math.abs(myVal - otherVal);
                if (diff < bestDiffX) {
                  bestDiffX = diff;
                  snapXVal = otherVal;
                  guideY1 = Math.min(sy, other.y);
                  guideY2 = Math.max(sy + sh, other.y + oh);
                }
              }
            }
          }
          if (snapXVal !== null) {
            if (corner.includes('r')) {
              nw = snapXVal - nx;
            } else {
              nw = sx + sw - snapXVal;
            }
            activeGuidesX = [{ x: snapXVal, y1: guideY1, y2: guideY2 }];
          }

          nh = Math.max(minH, Math.round(nw / aspectRatio));
        } else {
          if (corner.includes('b')) nh = Math.max(minH, sh + dy);
          if (corner.includes('t')) nh = Math.max(minH, sh - dy);

          // Snap Y
          let bestDiffY = snapThreshold;
          let snapYVal = null;
          let guideX1 = null, guideX2 = null;
          const myVal = corner.includes('b') ? (ny + nh) : (sy + sh - nh);

          for (const other of currentItems) {
            if (other.id === itemId || other.type === 'line') continue;
            const ow = other.w || 200;
            const oh = other.h || 120;
            const centerX = nx + nw / 2;
            const otherCenterX = other.x + ow / 2;
            if (Math.abs(centerX - otherCenterX) < MAX_ALIGN_DIST) {
              const otherYOpts = other.type === 'frame' ? [other.y, other.y + oh] : [other.y, other.y + oh/2, other.y + oh];
              for (const otherVal of otherYOpts) {
                const diff = Math.abs(myVal - otherVal);
                if (diff < bestDiffY) {
                  bestDiffY = diff;
                  snapYVal = otherVal;
                  guideX1 = Math.min(sx, other.x);
                  guideX2 = Math.max(sx + sw, other.x + ow);
                }
              }
            }
          }
          if (snapYVal !== null) {
            if (corner.includes('b')) {
              nh = snapYVal - ny;
            } else {
              nh = sy + sh - snapYVal;
            }
            activeGuidesY = [{ y: snapYVal, x1: guideX1, x2: guideX2 }];
          }

          nw = Math.max(minW, Math.round(nh * aspectRatio));
        }
        
        // Re-adjust top-left position if resizing left or top sides
        if (corner.includes('l')) nx = sx + (sw - nw);
        if (corner.includes('t')) ny = sy + (sh - nh);
      } else {
        // Free resize
        if (corner.includes('r')) nw = Math.max(minW, sw + dx);
        if (corner.includes('b')) nh = Math.max(minH, sh + dy);
        if (corner.includes('l')) { nw = Math.max(minW, sw - dx); nx = sx + (sw - nw); }
        if (corner.includes('t')) { nh = Math.max(minH, sh - dy); ny = sy + (sh - nh); }

        // Snap X
        let bestDiffX = snapThreshold;
        let snapXVal = null;
        let guideY1 = null, guideY2 = null;
        const myXVal = corner.includes('r') ? (nx + nw) : (corner.includes('l') ? nx : null);

        if (myXVal !== null) {
          for (const other of currentItems) {
            if (other.id === itemId || other.type === 'line') continue;
            const ow = other.w || 200;
            const oh = other.h || 120;
            const centerY = ny + nh / 2;
            const otherCenterY = other.y + oh / 2;
            if (Math.abs(centerY - otherCenterY) < MAX_ALIGN_DIST) {
              const otherXOpts = other.type === 'frame' ? [other.x, other.x + ow] : [other.x, other.x + ow/2, other.x + ow];
              for (const otherVal of otherXOpts) {
                const diff = Math.abs(myXVal - otherVal);
                if (diff < bestDiffX) {
                  bestDiffX = diff;
                  snapXVal = otherVal;
                  guideY1 = Math.min(ny, other.y);
                  guideY2 = Math.max(ny + nh, other.y + oh);
                }
              }
            }
          }
          if (snapXVal !== null) {
            if (corner.includes('r')) {
              nw = snapXVal - nx;
            } else if (corner.includes('l')) {
              nx = snapXVal;
              nw = (sx + sw) - nx;
            }
            activeGuidesX = [{ x: snapXVal, y1: guideY1, y2: guideY2 }];
          }
        }

        // Snap Y
        let bestDiffY = snapThreshold;
        let snapYVal = null;
        let guideX1 = null, guideX2 = null;
        const myYVal = corner.includes('b') ? (ny + nh) : (corner.includes('t') ? ny : null);

        if (myYVal !== null) {
          for (const other of currentItems) {
            if (other.id === itemId || other.type === 'line') continue;
            const ow = other.w || 200;
            const oh = other.h || 120;
            const centerX = nx + nw / 2;
            const otherCenterX = other.x + ow / 2;
            if (Math.abs(centerX - otherCenterX) < MAX_ALIGN_DIST) {
              const otherYOpts = other.type === 'frame' ? [other.y, other.y + oh] : [other.y, other.y + oh/2, other.y + oh];
              for (const otherVal of otherYOpts) {
                const diff = Math.abs(myYVal - otherVal);
                if (diff < bestDiffY) {
                  bestDiffY = diff;
                  snapYVal = otherVal;
                  guideX1 = Math.min(nx, other.x);
                  guideX2 = Math.max(nx + nw, other.x + ow);
                }
              }
            }
          }
          if (snapYVal !== null) {
            if (corner.includes('b')) {
              nh = snapYVal - ny;
            } else if (corner.includes('t')) {
              ny = snapYVal;
              nh = (sy + sh) - ny;
            }
            activeGuidesY = [{ y: snapYVal, x1: guideX1, x2: guideX2 }];
          }
        }
      }
      
      // Snap sound feedback
      const currentlySnappedX = (activeGuidesX.length > 0);
      const currentlySnappedY = (activeGuidesY.length > 0);
      if ((currentlySnappedX && !wasSnappedX) || (currentlySnappedY && !wasSnappedY)) {
        window.playAudioTone && window.playAudioTone('snap');
      }
      wasSnappedX = currentlySnappedX;
      wasSnappedY = currentlySnappedY;

      setGuides({ x: activeGuidesX, y: activeGuidesY });
      if (isMulti && groupStarts) {
        const scaleX = sw > 0 ? nw / sw : 1;
        const scaleY = sh > 0 ? nh / sh : 1;
        _setCanvases(prev => {
          const c = prev[currentId];
          return {
            ...prev,
            [currentId]: {
              ...c,
              items: c.items.map(it => {
                const gs = groupStarts.find(x => x.id === it.id);
                if (gs) {
                  const newW = Math.max(minW, gs.startW * scaleX);
                  const newH = Math.max(minH, gs.startH * scaleY);
                  let newX = gs.startX;
                  let newY = gs.startY;
                  if (corner.includes('r')) {
                    newX = groupMinX + gs.relX * (groupW * scaleX);
                  } else if (corner.includes('l')) {
                    newX = groupMaxX - (1 - gs.relX) * (groupW * scaleX);
                  }
                  if (corner.includes('b')) {
                    newY = groupMinY + gs.relY * (groupH * scaleY);
                  } else if (corner.includes('t')) {
                    newY = groupMaxY - (1 - gs.relY) * (groupH * scaleY);
                  }
                  return { ...it, x: newX, y: newY, w: newW, h: newH };
                }
                return it;
              })
            }
          };
        });
      } else {
        updateItemSilent(itemId, { x: nx, y: ny, w: nw, h: nh });
      }
    };
    const onUp = () => {
      document.body.classList.remove('odi-busy');
      setGuides(null);
      // Marcar que la altura la fijó el usuario, para que el auto-ajuste al
      // contenido (notas/comentarios) deje de pisar el tamaño elegido.
      const manualPatch = ['note', 'comment', 'todo'].includes(item.type) ? { manualH: true } : {};
      updateItem(itemId, manualPatch);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ───── Nested board open ─────
  const openBoard = (canvasId, fromItemId) => {
    // La profundidad dice si la gente llega a usar los tableros dentro de
    // tableros, que es lo que diferencia a Odinote de lo demás.
    window.odiTrack && window.odiTrack('tablero_abierto', { profundidad: stack.length });
    if (!canvases[canvasId]) {
      let fromItem = current.items.find(i => i.id === fromItemId);
      if (!fromItem) {
        for (const it of current.items) {
          if (it.type === 'column' && it.children) {
            const child = it.children.find(c => c.id === fromItemId);
            if (child) { fromItem = child; break; }
          }
        }
      }
      setCanvases(prev => ({
        ...prev,
        [canvasId]: {
          title: fromItem?.content || { es: 'Tablero', en: 'Board' },
          parent: currentId,
          parentLabel: current.title,
          items: [], connectors: [],
        },
      }));
    }
    setStack(s => [...s, canvasId]);
    setTransition('entering');
    setTimeout(() => setTransition(null), 350);
    window.playAudioTone && window.playAudioTone('board_open');
  };

  const goBackTo = (idx) => {
    if (idx >= stack.length - 1) return;
    setStack(s => s.slice(0, idx + 1));
    setTransition('entering');
    setTimeout(() => setTransition(null), 350);
  };

  const renameCanvas = (canvasId, newName) => {
    setCanvases(prev => {
      const c = prev[canvasId];
      if (!c) return prev;
      const next = { ...prev, [canvasId]: { ...c, title: { ...(c.title || {}), [lang]: newName } } };
      // also update parent board item's content
      const parent = c.parent;
      if (parent && next[parent]) {
        next[parent] = {
          ...next[parent],
          items: next[parent].items.map(it => it.canvasId === canvasId
            ? { ...it, content: { ...(it.content || {}), [lang]: newName } } : it),
        };
      }
      return next;
    });
  };

  // ───── Helper: get items inside a board for preview ─────
  const getNestedItems = useCallbackCanvas((canvasId) => {
    return (canvases[canvasId]?.items) || [];
  }, [canvases]);

  const [editingChild, setEditingChildState] = useStateCanvas(null); // {colId, childId} | null

  const callbacks = useMemoCanvas(() => ({
    openBoard,
    openDoc: (id, colId) => setDocOpen({ id, colId }),
    openFile: (id) => setFileOpen({ id }),
    updateItem,
    getNestedItems,
    croppingId,
    setCroppingId,
    startEdit: (id) => setEditing(id),
    endEdit: () => setEditing(null),
    selectItem: (id) => {
      setSelected(id);
      let isColChild = false;
      const c = canvases[currentId];
      if (c && c.items) {
        for (const it of c.items) {
          if (it.type === 'column' && it.children && it.children.some(ch => ch.id === id)) {
            isColChild = true;
            break;
          }
        }
      }
      if (!isColChild) {
        setEditingChildState(null);
      }
    },
    isSelectedItem: (id) => selected === id,
    resizeItemSilent: (id, patch) => updateItemSilent(id, patch),
    startColChildDrag,
    startAnchorDrag,
    startDragTaskRow,
    editingChild,
    setEditingChild: (colId, childId) => setEditingChildState({ colId, childId }),
    updateColChild: (columnId, childId, patch) => {
      if (patch.h !== undefined) {
        console.log('[DEBUG-HEIGHT] Canvas updateColChild updating height for columnId =', columnId, 'childId =', childId, 'patch.h =', patch.h);
      }
      setCanvases(prev => {
        const c = prev[currentId];
        const col = c.items.find(x => x.id === columnId);
        const child = col?.children?.find(x => x.id === childId);
        let nextCanvases = { ...prev };
        if (child && child.type === 'board' && patch.content && child.canvasId) {
          if (nextCanvases[child.canvasId]) {
            nextCanvases[child.canvasId] = {
              ...nextCanvases[child.canvasId],
              title: { ...(nextCanvases[child.canvasId].title || {}), ...patch.content }
            };
          }
        }
        nextCanvases[currentId] = {
          ...c,
          items: withResizedColumn(
            c.items.map(it => {
              if (it.id !== columnId) return it;
              return { ...it, children: (it.children || []).map(ch => ch.id === childId ? { ...ch, ...patch } : ch) };
            }),
            columnId
          )
        };
        return nextCanvases;
      });
    },
    // Modo dibujo (lo consume la barra contextual)
    drawingId,
    enterDrawMode,
    saveDrawing,
    discardDrawing,
    drawTool, setDrawTool,
    drawColor, setDrawColor: recolorStroke,
    drawWidth, setDrawWidth,
    drawPressureMode, setDrawPressureMode,
    drawUndo, drawRedo,
    canDrawUndo: !!(drawSession && drawSession.past.length),
    canDrawRedo: !!(drawSession && drawSession.future.length),
    selectedStrokeId,
    deleteSelectedStroke,
  // eslint-disable-next-line
  }), [currentId, canvases, editingChild, selected, croppingId,
       drawingId, drawSession, drawTool, drawColor, drawWidth, drawPressureMode, selectedStrokeId]);

  // ───── Breadcrumbs ─────
  const crumbs = useMemoCanvas(() => {
    const out = [{ id: '__home', label: window.TRANSLATIONS[lang].home }];
    stack.forEach((cid, idx) => {
      const c = canvases[cid];
      if (!c) return;
      const proj = window.SAMPLE_PROJECTS.find(p => p.id === cid);
      const fromParent = idx > 0 ? (canvases[stack[idx-1]]?.items || []).find(i => i.canvasId === cid) : null;
      const colorKey = window.colorClass(fromParent?.color || 'olive');
      out.push({
        id: cid,
        label: proj ? (proj.name?.[lang] || proj.name) : window.pickLang(c.title, lang),
        chipColor: idx === 0 ? 'var(--ink)' : window.COLOR_HEX_RESOLVED[colorKey],
      });
    });
    return out;
  }, [stack, canvases, lang]);

  const onCrumb = (idx) => {
    if (idx === 0) onHome();
    else if (idx >= 1 && idx < stack.length) goBackTo(idx - 1);
  };
  const onCrumbRename = (idx, newName) => {
    if (idx === 0) return;
    const cid = stack[idx - 1];
    renameCanvas(cid, newName);
  };

  if (!current) return <div style={{padding:40}}>Canvas not found</div>;

  const matchesSearch = (item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return JSON.stringify(item).toLowerCase().includes(q);
  };

  const bounds = useMemoCanvas(() => {
    const items = current.items;
    if (!items.length) return { w: 2400, h: 1800 };
    let mx = 0, my = 0;
    items.forEach(i => { mx = Math.max(mx, i.x + i.w); my = Math.max(my, i.y + i.h); });
    return { w: Math.max(2400, mx + 400), h: Math.max(1800, my + 400) };
  }, [current.items]);

  const wrapClass = ['canvas-wrap', `canvas-bg-${current.bgColor || 'default'}`];
  // Flecha en curso: enciende los puntos de anclaje de todos los nodos
  if (pendingConn) wrapClass.push('conn-drag');
  if (transition === 'entering') wrapClass.push('entering');
  if (activeTool && activeTool !== 'line') wrapClass.push('placing');
  if (activeTool === 'line') wrapClass.push('linking');

  const selectedItem = (() => {
    if (editingChild) {
      const col = current.items.find(it => it.id === editingChild.colId);
      const child = col?.children?.find(c => c.id === editingChild.childId);
      if (child) return child;
    }
    if (!selected) return null;
    for (const it of current.items) {
      if (it.id === selected) return it;
      if (it.type === 'column' && it.children) {
        const child = it.children.find(c => c.id === selected);
        if (child) return child;
      }
    }
    return null;
  })();
  // Resolve doc item: either a top-level item or a child of a column
  let docItem = null;
  let docUpdater = null;
  if (docOpen) {
    if (docOpen.colId) {
      const col = current.items.find(i => i.id === docOpen.colId);
      const child = (col?.children || []).find(c => c.id === docOpen.id);
      if (child) {
        docItem = child;
        docUpdater = (patch) => callbacks.updateColChild(docOpen.colId, docOpen.id, patch);
      }
    } else {
      docItem = current.items.find(i => i.id === docOpen.id);
      if (docItem) docUpdater = (patch) => updateItem(docOpen.id, patch);
    }
  }

  // ───── Tool drag-from-toolbar ─────
  const onToolDragStart = (e, toolId) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    setActiveTool(toolId);
    setToolGhost({ x: e.clientX, y: e.clientY, tool: toolId });

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > 5) dragging = true;
      if (dragging) setToolGhost({ x: ev.clientX, y: ev.clientY, tool: toolId });
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setToolGhost(null);
      if (!dragging) {
        // Dibujar no se "coloca": se empieza a dibujar. Pulsar el botón y
        // tener que ir a dar otro clic al lienzo para que pase algo se sentía
        // raro — con el resto de nodos tiene sentido elegir dónde va, pero
        // aquí el sitio lo decide el propio trazo.
        if (toolId === 'draw') {
          setActiveTool(null);
          const wrap = surfaceRef.current;
          const rect = wrap ? wrap.getBoundingClientRect() : { width: 900, height: 600 };
          // En el centro de lo que se está viendo ahora mismo.
          const centro = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
          const def = defaultDims('draw');
          const item = makeNewItem('draw', centro.x - def.w / 2, centro.y - def.h / 2, def.w, def.h, lang);
          if (item) {
            setCanvases(prev => {
              const c = prev[currentId];
              return { ...prev, [currentId]: { ...c, items: [...c.items, item] } };
            });
            window.playAudioTone && window.playAudioTone('create');
          }
          return;
        }
        // click without drag → keep tool active for click-create
        return;
      }
      // dropped over canvas?
      const wrap = surfaceRef.current;
      if (!wrap) { setActiveTool(null); return; }
      const rect = wrap.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) {
        setActiveTool(null);
        return;
      }
      // create at drop position
      const pt = screenToCanvas(ev.clientX, ev.clientY);
      if (toolId === 'line') {
        // create a default-length floating arrow
        addConnector({ x: pt.x - 60, y: pt.y }, { x: pt.x + 60, y: pt.y });
        setActiveTool(null);
        return;
      }
      const def = defaultDims(toolId);
      const item = makeNewItem(toolId, pt.x - def.w / 2, pt.y - def.h / 2, def.w, def.h, lang);
      if (item) {
        setCanvases(prev => {
          const c = prev[currentId];
          const next = { ...prev, [currentId]: { ...c, items: [...c.items, item] } };
          if (item.type === 'board') {
            next[item.canvasId] = {
              title: item.content,
              parent: currentId,
              parentLabel: c.title,
              items: [], connectors: [],
            };
          }
          return next;
        });
        setSelected(item.id);
        window.playAudioTone && window.playAudioTone('drop');
        if (['note','comment','bigtitle'].includes(item.type) && !skipAutoEdit()) setTimeout(() => setEditing(item.id), 40);
        if (item.type === 'doc') setTimeout(() => setDocOpen({ id: item.id }), 40);
        if (['link','todo','board','column','map','frame'].includes(item.type)) setTimeout(() => setEditing(item.id), 40);
      }
      setActiveTool(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Paste interceptor: hidden contentEditable that receives paste events when an image node is selected ──
  const onPasteIntercept = (e) => {
    if (!selected) return;
    const selItem = current.items.find(i => i.id === selected);
    if (!selItem || selItem.type !== 'image') return;
    e.preventDefault();
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (!file) continue;
        const fr = new FileReader();
        fr.onload = () => {
          const src = fr.result;
          const img = new Image();
          img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            const w = selItem.w || 260;
            updateItem(selected, { src, w, h: Math.max(60, Math.round(w / ratio)) });
          };
          img.onerror = () => updateItem(selected, { src });
          img.src = src;
        };
        fr.readAsDataURL(file);
        return;
      }
    }
  };

  return (
    <div className="app" data-screen-label={`Canvas · ${window.pickLang(current.title, lang)}`}>
      {/* Invisible paste interceptor — focused when an image node is selected, so Ctrl+V fires paste here */}
      <div
        ref={pasteIntRef}
        contentEditable
        suppressContentEditableWarning
        data-paste-interceptor="true"
        onPaste={onPasteIntercept}
        onInput={(e) => { e.currentTarget.innerHTML = ''; }}
        onKeyDown={(e) => {
          // Don't let typing accumulate; let canvas-level shortcuts (Backspace, Ctrl+D, etc.) still work
          if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) return;
          if (e.key.length === 1) e.preventDefault();
        }}
        style={{ position:'fixed', opacity:0, width:1, height:1, overflow:'hidden', top:0, left:0, zIndex:-1, outline:'none' }}
      />
      <window.Topbar
        lang={lang} setLang={setLang}
        theme={theme} setTheme={setTheme}
        crumbs={crumbs} onCrumb={onCrumb} onCrumbRename={onCrumbRename}
        onSettingsClick={onSettingsClick}
        onManualSync={onManualSync}
        isSyncingDrive={isSyncingDrive}
        needsDriveAuth={needsDriveAuth}
        activeTool={activeTool} setActiveTool={setActiveTool}
        onHome={onHome}
        onUndo={undo} onRedo={redo}
        canUndo={historyIdx > 0} canRedo={historyIdx < history.length - 1}
        onToolDragStart={onToolDragStart}
        updateAvailable={updateAvailable}
        onUpdateClick={onUpdateClick}
        volume={volume}
        onChangeVolume={onChangeVolume}
        {...(() => {
          // El estado de compartir sube a la barra de arriba. Tres estados y no
          // dos: publicado y "puedo hablar con Drive ahora mismo" son cosas
          // distintas, y confundirlas dejaba proyectos publicados marcados como
          // offline para siempre cuando caducaba el permiso.
          if (!currentProject) return {};
          const publicado = !!currentProject.isPublic;
          const caido = publicado && driveReachable === false;
          return {
            estadoCompartir: !publicado ? 'offline' : caido ? 'caido' : 'online',
            estadoTitulo: !publicado
              ? window.t('Solo en este equipo. Haz clic para compartirlo o trabajar en vivo con alguien.', 'Only on this device. Click to share it or work live with someone.')
              : caido
                ? window.t('Publicado en tu Google Drive, pero ahora no hay conexión: los cambios se guardan aquí y se subirán al reconectar.', 'Published to your Google Drive, but there is no connection right now: changes are saved here and will upload once reconnected.')
                : window.t('Publicado en tu Google Drive. Haz clic para compartir o empezar una sesión en vivo.', 'Published to your Google Drive. Click to share or start a live session.'),
            onEstadoCompartir: () => { onSharingClick && onSharingClick(projectId); },
          };
        })()}
        userProfile={userProfile}
        onUserClick={onUserClick}
      />

      {toolGhost && <ToolGhost {...toolGhost} lang={lang}/>}

      {/* Contextual sidebar — hidden while actively editing THIS node's text (format sidebar shows instead) */}
      {selectedItem && !captionFocusId && editing !== selectedItem.id && !selectedItem._editingTitle && (() => {
        const isColChild = editingChild && selectedItem.id === editingChild.childId;
        return (
          <window.ContextSidebar
            item={selectedItem}
            lang={lang}
            isColChild={isColChild}
            callbacks={callbacks}
            backlinks={backlinksForSelected}
            onGoToBacklink={(b) => onGoToNode && onGoToNode(b)}
            onStartEdit={() => setEditing(selectedItem.id)}
            onUpdate={(patch) => {
              if (isColChild) {
                callbacks.updateColChild(editingChild.colId, editingChild.childId, patch);
              } else {
                updateItem(selectedItem.id, patch);
              }
            }}
            onDelete={() => {
              if (isColChild) {
                setCanvases(prev => {
                  const c = prev[currentId];
                  return { ...prev, [currentId]: {
                    ...c,
                    items: withResizedColumn(
                      c.items.map(it => {
                        if (it.id !== editingChild.colId) return it;
                        return { ...it, children: (it.children || []).filter(ch => ch.id !== editingChild.childId) };
                      }),
                      editingChild.colId
                    )
                  }};
                });
                setEditingChildState(null);
              } else {
                deleteItem(selectedItem.id);
              }
            }}
            onDuplicate={() => {
              if (isColChild) {
                setCanvases(prev => {
                  const c = prev[currentId];
                  const col = c.items.find(it => it.id === editingChild.colId);
                  const child = col?.children?.find(ch => ch.id === editingChild.childId);
                  if (!child) return prev;
                  const copy = JSON.parse(JSON.stringify(child));
                  copy.id = `it-${Date.now()}-${Math.floor(Math.random()*9999)}`;
                  if (copy.type === 'board' && copy.canvasId) {
                    const origCid = copy.canvasId;
                    const newCid = `b-${Date.now()}-${Math.floor(Math.random()*9999)}`;
                    copy.canvasId = newCid;
                    const next = { ...prev, [currentId]: {
                      ...c,
                      items: withResizedColumn(
                        c.items.map(it => {
                          if (it.id !== editingChild.colId) return it;
                          return { ...it, children: [...(it.children || []), copy] };
                        }),
                        editingChild.colId
                      )
                    }};
                    duplicateCanvasState(next, origCid, newCid);
                    return next;
                  } else {
                    return { ...prev, [currentId]: {
                      ...c,
                      items: withResizedColumn(
                        c.items.map(it => {
                          if (it.id !== editingChild.colId) return it;
                          return { ...it, children: [...(it.children || []), copy] };
                        }),
                        editingChild.colId
                      )
                    }};
                  }
                });
              } else {
                duplicateItem(selectedItem.id);
              }
            }}
            onOpen={selectedItem.type === 'board' ? () => {
              if (isColChild) {
                openBoard(selectedItem.canvasId, selectedItem.id);
              } else {
                openBoard(selectedItem.canvasId, selectedItem.id);
              }
            } : null}
            onClose={() => {
              if (isColChild) {
                setEditingChildState(null);
              } else {
                setSelected(null);
              }
            }}
          />
        );
      })()}

      {/* Connector sidebar (same style as item ctx) */}
      {selectedConn && (() => {
        const conn = (current.connectors || []).find(c => c.id === selectedConn);
        if (!conn) return null;
        const style = conn.style || 'solid';
        const shape = conn.shape || 'curve';
        const CONN_COLORS = ['#1A1A1A','#595459','#E6544F','#90B968','#F7DA84','#3D5A80','#955BA5','#FFFFFF'];
        return (
          <div className="ctx-side" onMouseDown={(e)=>e.stopPropagation()}>
            <button className="ctx-close" onClick={()=>setSelectedConn(null)} title={window.t('Cerrar', 'Close')}>
              <span className="material-symbols-rounded">arrow_back</span>
            </button>

            <button className={`ctx-btn ${shape==='curve' ? 'active' : ''}`} onClick={()=>updateConnector(conn.id, { shape: 'curve' })}>
              <span className="material-symbols-rounded">show_chart</span>
              <span>{window.t('Curva', 'Curve')}</span>
            </button>
            <button className={`ctx-btn ${shape==='orthogonal' ? 'active' : ''}`} onClick={()=>updateConnector(conn.id, { shape: 'orthogonal', bend: { x: 0, y: 0 }, ortho: undefined })}>
              <span className="material-symbols-rounded">stairs</span>
              <span>{window.t('Recta', 'Right-angle')}</span>
            </button>

            <div className="ctx-sep-h"/>

            <button className={`ctx-btn ${style==='solid' ? 'active' : ''}`} onClick={()=>updateConnector(conn.id, { style: 'solid' })}>
              <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="2.5"/></svg>
              <span>{window.t('Sólida', 'Solid')}</span>
            </button>
            <button className={`ctx-btn ${style==='dashed' ? 'active' : ''}`} onClick={()=>updateConnector(conn.id, { style: 'dashed' })}>
              <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 3"/></svg>
              <span>{window.t('Discontinua', 'Dashed')}</span>
            </button>
            <button className={`ctx-btn ${style==='dotted' ? 'active' : ''}`} onClick={()=>updateConnector(conn.id, { style: 'dotted' })}>
              <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="2.5" strokeDasharray="1 3" strokeLinecap="round"/></svg>
              <span>{window.t('Punteada', 'Dotted')}</span>
            </button>

            <div className="ctx-sep-h"/>

            <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 4, padding: '4px 6px'}}>
              {CONN_COLORS.map(c => (
                <button
                  key={c}
                  onClick={()=>updateConnector(conn.id, { color: c, isColorExplicit: true })}
                  style={{
                    aspectRatio: 1,
                    borderRadius: '50%',
                    background: c,
                    border: (conn.color || '#1A1A1A') === c ? '2px solid var(--wine)' : '1.5px solid var(--line-soft)',
                    cursor: 'pointer',
                  }}
                  title={c}
                />
              ))}
            </div>

            <div className="ctx-sep-h"/>

            <button
              className={`ctx-btn ${conn.bidirectional ? 'active' : ''}`}
              onClick={()=>updateConnector(conn.id, { bidirectional: !conn.bidirectional })}
              title={window.t('Flecha bidireccional', 'Bidirectional arrow')}
            >
              <span className="material-symbols-rounded">sync_alt</span>
              <span>{window.t('Doble', 'Two-way')}</span>
            </button>

            <button
              className={`ctx-btn ${connLabelOpen ? 'active' : ''}`}
              onClick={()=>setConnLabelOpen(o => !o)}
              title={window.t('Etiqueta', 'Label')}
            >
              <span className="material-symbols-rounded">label</span>
              <span>{window.t('Etiqueta', 'Label')}</span>
            </button>

            {connLabelOpen && (
              <div style={{padding:'4px 6px'}}>
                <input
                  className="conn-label-input"
                  autoFocus
                  value={conn.label || ''}
                  placeholder={window.t('Etiqueta…', 'Label…')}
                  onChange={(e)=>updateConnector(conn.id, { label: e.target.value })}
                  onClick={(e)=>e.stopPropagation()}
                  onMouseDown={(e)=>e.stopPropagation()}
                  style={{ width:'100%', font:'inherit', fontSize:12, padding:'5px 7px', border:'1.5px solid var(--line-soft)', borderRadius:2 }}
                />
              </div>
            )}

            <div className="ctx-sep-h"/>

            <button className="ctx-btn danger" onClick={()=>deleteConnector(conn.id)}>
              <span className="material-symbols-rounded">delete</span>
              <span>{window.t('Eliminar', 'Delete')}</span>
            </button>
          </div>
        );
      })()}

      {/* Text format sidebar (when editing a text-based item) */}
      {((editing && editing === selected) || (selectedItem && selectedItem.type === 'map' && selectedItem._editingTitle)) && !captionFocusId && (() => {
        const it = selectedItem;
        if (!it) return null;
        const isEditingMapTitle = it.type === 'map' && it._editingTitle;
        // 'board' entró aquí porque, al empezar a escribir su título, el menú
        // contextual normal se ocultaba (se oculta siempre que editing===selected)
        // y esta barra de texto tampoco lo cubría: el panel de la izquierda
        // desaparecía entero mientras se cambiaba el nombre del tablero.
        const isEditingTextNode = editing && editing === selected && ['note','comment','bigtitle','frame','todo','board'].includes(it.type);
        if (!isEditingTextNode && !isEditingMapTitle) return null;
        return (
          <window.TextFormatSidebar
            item={it}
            lang={lang}
            noCodeQuote={it.type === 'comment'}
            onUpdate={(patch)=>updateItem(it.id, patch)}
            onClose={()=>{
              if (isEditingMapTitle) {
                updateItem(it.id, { _editingTitle: false });
              } else {
                setEditing(null);
              }
            }}
          />
        );
      })()}

      {/* Caption ("leyenda") format sidebar — reduced option set, shown while a caption is focused */}
      {captionFocusId && (() => {
        const it = current.items.find(i => i.id === captionFocusId);
        if (!it) return null;
        return (
          <window.TextFormatSidebar
            variant="caption"
            item={it}
            lang={lang}
            onUpdate={(patch)=>updateItem(it.id, patch)}
            onClose={()=>{ setCaptionFocusId(null); }}
          />
        );
      })()}

      <div
        ref={surfaceRef}
        className={wrapClass.join(' ')}
        style={{
          backgroundSize: `${22 * scale}px ${22 * scale}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
        onMouseDown={onSurfaceMouseDown}
        onMouseMove={(e) => { if (sesionRef.current) mandaCursor(e.clientX, e.clientY); }}
        onDoubleClick={onSurfaceDoubleClick}
        onContextMenu={onSurfaceContextMenu}
      >
        <div
          className="canvas-surface"
          style={{ 
            left: 0, 
            top: 0, 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, 
            transformOrigin: '0 0', 
            width: bounds.w, 
            height: bounds.h,
            '--handle-scale': Math.min(3, 1 / scale)
          }}
        >
          <div className="canvas-content" style={{width: bounds.w, height: bounds.h}}>
            <svg className="connectors" width={bounds.w} height={bounds.h} viewBox={`0 0 ${bounds.w} ${bounds.h}`} style={{ overflow:'visible' }}>
              <g>
                {(current.connectors || []).map(conn => (
                  <window.Connector
                    key={conn.id}
                    layer="lines"
                    conn={conn}
                    items={current.items}
                    selected={selectedConn === conn.id}
                    selectedIds={selectedIds}
                    onSelect={(id)=>{ setSelectedConn(id); setSelected(null); }}
                    onUpdate={updateConnector}
                    onDragNodes={dragItemsSilent}
                    onDragNodesEnd={commitItemsDrag}
                    panZoom={{ scale }}
                    screenToCanvas={screenToCanvas}
                    theme={theme}
                  />
                ))}
                {/* preview of pending connector */}
                {pendingConn && (
                  <g>
                    <line
                      x1={pendingConn.fromX} y1={pendingConn.fromY}
                      x2={pendingConn.mx} y2={pendingConn.my}
                      stroke="var(--olive)" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round"
                    />
                    <circle cx={pendingConn.mx} cy={pendingConn.my} r="5" fill="var(--olive)" stroke="white" strokeWidth="2"/>
                  </g>
                )}
              </g>
            </svg>

            {[...current.items].sort((a, b) => {
              const ai = zOrder.indexOf(a.id), bi = zOrder.indexOf(b.id);
              return ai - bi;
            }).map(item => {
              const matches = matchesSearch(item);
              const isEditing = editing === item.id;
              const isDropTarget = dropTargetCol === item.id || dropTargetTodo === item.id;
              const def = defaultDims(item.type);
              const rawScale = Math.min((item.w || def.w) / def.w, (item.h || def.h) / def.h);
              const nodeScale = item.type === 'column'
                ? 1
                : 1 + (Math.min(2.25, Math.max(1, rawScale)) - 1) * 0.5;
              // Tamaño de texto elegido por el usuario con los botones A+ / A−
              const textScale = item.textScale || 1;
              return (
                <div
                  key={item.id}
                  data-item-id={item.id}
                  className={`item ${item.type === 'frame' ? 'item-frame' : ''} ${(selected === item.id || selectedIds.includes(item.id)) ? 'selected' : ''} ${item._dragging ? 'dragging' : ''} ${isEditing ? 'editing' : ''} ${item._new ? 'new-item' : ''} ${isDropTarget ? 'drop-target' : ''} ${linkTargetId === item.id ? 'link-target' : ''} ${jumpHighlight === item.id ? 'jump-target' : ''}`}
                  style={{
                    left: item.x, top: item.y,
                    width: item.w !== undefined ? item.w : def.w,
                    height: item.h !== undefined ? item.h : def.h,
                    '--node-scale': nodeScale,
                    '--text-scale': textScale,
                    zIndex: (selected === item.id || selectedIds.includes(item.id))
                      ? (item.type === 'frame' ? 1.5 : 100)
                      : (item.type === 'frame' ? 1 : 2),
                    // El nodo que se está dibujando lo pinta la capa de dibujo:
                    // dejarlo visible aquí lo mostraría dos veces, uno bajo el velo.
                    opacity: drawingId === item.id ? 0 : (matches ? 1 : 0.18),
                    transition: item._dragging ? 'none' : 'opacity 200ms ease',
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={(e)=>{
                    if (croppingId === item.id) { e.stopPropagation(); return; }
                    if (activeTool === 'line') { startLineDrag(e, item.id); return; }
                    startDragItem(e, item.id);
                  }}
                  onDoubleClick={(e)=>{
                    if (item.type === 'doc') { e.stopPropagation(); setDocOpen({ id: item.id }); return; }
                    if (item.type === 'draw') { e.stopPropagation(); enterDrawMode(item.id); return; }
                    if (item.type === 'board') return;
                    if (['note','comment','todo','column','link','board','bigtitle','frame'].includes(item.type)) {
                      e.stopPropagation();
                      setSelected(item.id);
                      setSelectedIds([]);
                      setSelectedConn(null);
                      // Con el dedo NO se entra a editar tocando dos veces. Dos
                      // toques seguidos son lo que uno hace sin querer al
                      // seleccionar y arrastrar, o al pulsar Eliminar justo
                      // después de seleccionar, y el editor se abría solo (con
                      // teclado incluido). En táctil se edita con el botón
                      // "Editar" de la barra del nodo. Se mira el último gesto
                      // y no la capacidad del aparato, para que en un portátil
                      // táctil el doble clic con ratón siga entrando a editar.
                      if (!window.odiLastInputWasTouch) setEditing(item.id);
                    }
                  }}
                  onContextMenu={(e)=>{
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('[contenteditable="true"]')) {
                      return;
                    }
                    if (editing && editing !== item.id) {
                      setEditing(null);
                      setEditingChildState(null);
                    }
                    e.preventDefault(); e.stopPropagation();
                    setSelected(item.id);
                    const rect = surfaceRef.current.getBoundingClientRect();
                    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, itemId: item.id });
                  }}
                >
                  <window.NodeErrorBoundary key={`eb-${item.id}`}>
                    <window.ItemRenderer item={item} lang={lang} editing={isEditing} callbacks={callbacks}/>
                  </window.NodeErrorBoundary>
                  {item.reactions && Object.keys(item.reactions).length > 0 && (
                    <div className="item-reactions" style={{position:'absolute', left: 6, bottom: -10, zIndex: 6}}>
                      {Object.entries(item.reactions).map(([emoji, count]) => (
                        <div key={emoji} className="item-reaction-pill">
                          <span>{emoji}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Comment badge */}
                  {item.comments && item.comments.length > 0 && (
                    <div
                      className="item-comment-badge"
                      onClick={(e)=>{ e.stopPropagation(); setSelected(item.id); }}
                      title={`${item.comments.length} ${window.t('comentarios', 'comments')}`}
                    >
                      {item.comments.length}
                    </div>
                  )}
                  {/* Puntos de conexión estilo Miro en los cuatro lados del nodo.
                      Aparecen al pasar el cursor; arrastra cualquiera hasta otro nodo. */}
                  {!isEditing && !activeTool && item.type !== 'line' && (
                    <div className="anchors">
                      {['top', 'right', 'bottom', 'left'].map(pos => (
                        <div
                          key={pos}
                          className={`connect-handle ${pos === 'right' ? '' : `pos-${pos}`}`}
                          title={lang==='es'?'Arrastra para conectar':'Drag to connect'}
                          onMouseDown={(e)=>startAnchorDrag(e, item.id, 'center')}
                        >
                          <span className="material-symbols-rounded">trip_origin</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Con el dedo: arrastrar desde CUALQUIER punto del nodo.
                      Un calendario o una tabla son una rejilla de controles
                      pequeños, y al tocarlos el dedo caía siempre en una
                      casilla en vez de en el nodo: había que acertarle al
                      borde para poder moverlo. Con el nodo ya elegido, esta
                      lámina invisible se lleva el arrastre; un toque limpio
                      sobre ella entra a editar, que es lo que se quería hacer
                      al tocar dentro. Se aparta sola mientras se edita. */}
                  {window.odiIsTouch && window.odiIsTouch() &&
                   selected === item.id && !isEditing && croppingId !== item.id &&
                   ['calendar', 'table', 'todo', 'column', 'map'].includes(item.type) && (
                    <div
                      className="item-drag-shield"
                      onMouseDown={(e) => {
                        const x0 = e.clientX, y0 = e.clientY;
                        let movido = false;
                        const alMover = (ev) => {
                          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) movido = true;
                        };
                        const alSoltar = () => {
                          window.removeEventListener('mousemove', alMover);
                          window.removeEventListener('mouseup', alSoltar);
                          if (!movido) setEditing(item.id);
                        };
                        window.addEventListener('mousemove', alMover);
                        window.addEventListener('mouseup', alSoltar);
                        startDragItem(e, item.id);
                      }}
                    />
                  )}

                  {/* Resize handles */}
                  {(selected === item.id || (selectedIds.includes(item.id) && selectedIds.length > 1)) && !isEditing && croppingId !== item.id && (
                    <div className="handles">
                      <div className="handle tl" onMouseDown={(e)=>startResize(e, item.id, 'tl')}/>
                      <div className="handle tr" onMouseDown={(e)=>startResize(e, item.id, 'tr')}/>
                      <div className="handle bl" onMouseDown={(e)=>startResize(e, item.id, 'bl')}/>
                      <div className="handle br" onMouseDown={(e)=>startResize(e, item.id, 'br')}/>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Connector handles layer — drawn ABOVE the nodes so the center
                anchors stay grabbable even when they sit inside a node. */}
            <svg className="connectors connectors-top" width={bounds.w} height={bounds.h} viewBox={`0 0 ${bounds.w} ${bounds.h}`} style={{ overflow:'visible' }}>
              <g>
                {(current.connectors || []).map(conn => (
                  <window.Connector
                    key={`h-${conn.id}`}
                    layer="handles"
                    conn={conn}
                    items={current.items}
                    selected={selectedConn === conn.id}
                    selectedIds={selectedIds}
                    onSelect={(id)=>{ setSelectedConn(id); setSelected(null); }}
                    onUpdate={updateConnector}
                    onDragNodes={dragItemsSilent}
                    onDragNodesEnd={commitItemsDrag}
                    panZoom={{ scale }}
                    screenToCanvas={screenToCanvas}
                    theme={theme}
                  />
                ))}
              </g>
            </svg>

            {/* Drag-create preview */}
            {dragCreate && (dragCreate.w > 6 || dragCreate.h > 6) && (
              <div className="drag-preview" style={{ left: dragCreate.x, top: dragCreate.y, width: dragCreate.w, height: dragCreate.h }}/>
            )}

            {/* Marquee selection rectangle */}
            {marquee && (marquee.w > 2 || marquee.h > 2) && (
              <div className="marquee-rect" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}/>
            )}

            {/* Smart alignment guides (Canva-style) — inside the transform so they track the nodes */}
            {guides && (guides.x?.length || guides.y?.length || guides.spacing?.length) ? (
              <svg className="alignment-guides" width={bounds.w} height={bounds.h} viewBox={`0 0 ${bounds.w} ${bounds.h}`} style={{ overflow:'visible', position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 9000 }}>
                {guides.x && guides.x.map((g, idx) => (
                  <line key={`gx-${idx}`} x1={g.x} y1={g.y1} x2={g.x} y2={g.y2} stroke="#18a0fb" strokeWidth={1.5 / scale} strokeDasharray={`${4/scale} ${3/scale}`}/>
                ))}
                {guides.y && guides.y.map((g, idx) => (
                  <line key={`gy-${idx}`} x1={g.x1} y1={g.y} x2={g.x2} y2={g.y} stroke="#18a0fb" strokeWidth={1.5 / scale} strokeDasharray={`${4/scale} ${3/scale}`}/>
                ))}
                {/* Equal-spacing brackets (pink bars showing equal gaps between nodes) */}
                {guides.spacing && guides.spacing.map((s, idx) => {
                  const cap = 5 / scale, sw = 2 / scale, col = 'var(--pink, #E58AB8)';
                  if (s.horizontal) {
                    return (
                      <g key={`sp-${idx}`} stroke={col} strokeWidth={sw}>
                        <line x1={s.x} y1={s.y} x2={s.x + s.w} y2={s.y}/>
                        <line x1={s.x} y1={s.y - cap} x2={s.x} y2={s.y + cap}/>
                        <line x1={s.x + s.w} y1={s.y - cap} x2={s.x + s.w} y2={s.y + cap}/>
                      </g>
                    );
                  }
                  return (
                    <g key={`sp-${idx}`} stroke={col} strokeWidth={sw}>
                      <line x1={s.x} y1={s.y} x2={s.x} y2={s.y + s.h}/>
                      <line x1={s.x - cap} y1={s.y} x2={s.x + cap} y2={s.y}/>
                      <line x1={s.x - cap} y1={s.y + s.h} x2={s.x + cap} y2={s.y + s.h}/>
                    </g>
                  );
                })}
              </svg>
            ) : null}

            {/* Cursores de las otras personas. Van dentro de la capa que se
                mueve con el lienzo, así que si alguien señala un nodo, su
                flecha señala ESE nodo aunque cada uno tenga el lienzo en otro
                sitio o con otro zoom. Solo se ven los que están mirando este
                mismo tablero. */}
            {Object.keys(cursoresAjenos).map(uid => {
              const c = cursoresAjenos[uid];
              if (!c || c.lienzo !== currentId) return null;
              const color = colorDe(uid);
              return (
                <div
                  key={uid}
                  className="odi-cursor"
                  // El puntero se dibuja siempre del mismo tamaño: se deshace
                  // el zoom del lienzo para que no acabe siendo una flecha
                  // gigante al alejarse ni un punto al acercarse.
                  style={{ left: c.x, top: c.y, transform: `scale(${1 / scale})` }}
                >
                  <svg width="20" height="22" viewBox="0 0 20 22" style={{ display: 'block' }}>
                    <path d="M2 1 L2 17 L6.5 13 L9.5 20 L12.5 18.7 L9.6 12 L15.5 12 Z"
                          fill={color} stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
                  <span className="odi-cursor-nombre" style={{ background: color }}>{nombreDe(uid)}</span>
                </div>
              );
            })}

            {/* Connector toolbar moved to left sidebar (rendered above) */}
          </div>
        </div>

        {/* Capa de dibujo a mano: va fuera de .canvas-surface para poder velar
            todo el lienzo, y repite su misma transformación para que los
            trazos queden clavados sobre los nodos. */}
        {drawingId && drawSession && (
          <window.DrawOverlay
            strokes={drawSession.strokes}
            tool={drawTool}
            color={drawColor}
            width={drawWidth}
            pressureMode={drawPressureMode}
            scale={scale}
            pan={pan}
            bounds={bounds}
            theme={theme}
            selectedStrokeId={selectedStrokeId}
            onCommitStroke={commitStroke}
            onEraseStroke={eraseStroke}
            onMoveStroke={moveStroke}
            onSelectStroke={setSelectedStrokeId}
          />
        )}

        {/* Mini-search */}
        <div className="mini-search" onMouseDown={(e)=>e.stopPropagation()}>
          <span className="material-symbols-rounded" style={{color:'var(--ink-3)', fontSize: 17}}>search</span>
          <input placeholder={window.TRANSLATIONS[lang].search_canvas} value={search} onChange={(e)=>setSearch(e.target.value)}/>
          {/* Puerta al buscador global. En móvil no hay Ctrl+K, así que este
              botón es el único acceso; en escritorio recuerda el atajo. */}
          <button
            className="mini-search-global"
            onClick={() => onSearchClick && onSearchClick()}
            title={window.t('Buscar en todos los proyectos (Ctrl+K)', 'Search every project (Ctrl+K)')}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>travel_explore</span>
            <span className="mini-search-kbd">Ctrl K</span>
          </button>
          {search && (
            <button onClick={()=>setSearch('')}>
              <span className="material-symbols-rounded" style={{fontSize: 15, color:'var(--ink-3)'}}>close</span>
            </button>
          )}
        </div>

        {/* Place hint */}
        {activeTool && (
          <div className="place-hint">
            <span className="material-symbols-rounded" style={{fontSize:15}}>
              {activeTool === 'line' ? 'arrow_outward' : 'ads_click'}
            </span>
            {activeTool === 'line'
              ? (window.t('Arrastra de un nodo a otro', 'Drag from one node to another'))
              : (window.t(`Arrastra para dibujar · clic simple para tamaño por defecto`, `Drag to size · single click for default`))
            }
            <span className="esc">esc</span>
          </div>
        )}

        {/* Status pills */}
        <div className="status-bar">
          {/* La pastilla de Online/Offline se mudó a la barra de arriba,
              junto al volumen: no era un dato de fondo como "Guardado" o el
              número de nodos, sino el botón que abre compartir y las
              sesiones en vivo. Abajo del todo nadie lo miraba. */}
          <div className="status-pill"><div className="dot-live"/> {window.t('Guardado', 'Saved')}</div>
          {/* Vista de conexiones, junto al contador de nodos: es información
              sobre el lienzo, así que vive con el resto de la información. */}
          <button
            className="odi-graph-btn"
            onClick={() => { onGraphClick && onGraphClick(); window.playAudioTone && window.playAudioTone('click'); }}
            title={window.t('Ver cómo se conectan los nodos', 'See how the nodes connect')}
          >
            <span className="material-symbols-rounded">hub</span>
            <span>{window.t('Conexiones', 'Connections')}</span>
          </button>
          <div className="status-pill">
            <span className="material-symbols-rounded" style={{fontSize:14}}>category</span>
            {current.items.length} {window.TRANSLATIONS[lang].items_count}
          </div>
          {stack.length > 1 && (
            <div className="status-pill accent">
              <span className="material-symbols-rounded" style={{fontSize:14}}>layers</span>
              {window.t(`Nivel ${stack.length}`, `Level ${stack.length}`)}
            </div>
          )}
        </div>

        {/* Zoom controls */}
        <div className="zoom-ctrls">
          <button title="Zoom out" onClick={()=>setScale(s => Math.max(0.2, s - 0.1))}>
            <span className="material-symbols-rounded" style={{fontSize:15}}>remove</span>
          </button>
          <button className="zoom-level" onClick={()=>{ setScale(1); setPan({x:40, y:20}); }}>
            {Math.round(scale * 100)}%
          </button>
          <button title="Zoom in" onClick={()=>setScale(s => Math.min(2.5, s + 0.1))}>
            <span className="material-symbols-rounded" style={{fontSize:15}}>add</span>
          </button>
        </div>

        {/* Background Color Selector */}
        <div className="canvas-bg-selector" style={{ position: 'absolute', bottom: '16px', right: '160px', zIndex: 40 }}>
          <button 
            className="icon-btn lift" 
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '2px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            onClick={() => setShowBgSelector(!showBgSelector)}
            title={window.t('Color de fondo del lienzo', 'Canvas background color')}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>texture</span>
          </button>
          {showBgSelector && (
            <div 
              className="ctx-popout" 
              style={{ 
                position: 'absolute', 
                bottom: '40px', 
                right: '0', 
                top: 'auto',
                left: 'auto',
                width: 'auto',
                padding: '10px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px', 
                minWidth: '130px',
                borderRadius: '4px',
                boxShadow: 'var(--pop-md)'
              }}
              onMouseDown={(e)=>e.stopPropagation()}
            >
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-soft, #595459)', marginBottom: '2px' }}>
                {window.t('Fondo del Lienzo', 'Canvas Background')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {['default', 'gray', 'sand', 'mint', 'sky', 'pink'].map(bgOpt => {
                  const colorsMap = {
                    default: { light: '#FAF8F6', dark: '#2A282A', label: { es: 'Por defecto', en: 'Default' } },
                    gray: { light: '#ECEAE6', dark: '#1E1C1E', label: { es: 'Gris', en: 'Gray' } },
                    sand: { light: '#F4EFE6', dark: '#38322B', label: { es: 'Arena', en: 'Sand' } },
                    mint: { light: '#EAF2EB', dark: '#25332A', label: { es: 'Menta', en: 'Mint' } },
                    sky: { light: '#E6F0FA', dark: '#232F3D', label: { es: 'Celeste', en: 'Sky' } },
                    pink: { light: '#FAEBEF', dark: '#3A232F', label: { es: 'Rosa', en: 'Pink' } }
                  };
                  const colorHex = theme === 'dark' ? colorsMap[bgOpt].dark : colorsMap[bgOpt].light;
                  const active = (current.bgColor || 'default') === bgOpt;
                  return (
                    <button
                      key={bgOpt}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: colorHex,
                        border: active ? '2.5px solid var(--wine, #7B2D26)' : '1px solid var(--line-soft, #E5E1DD)',
                        cursor: 'pointer',
                        boxShadow: active ? '0 0 4px rgba(0,0,0,0.2)' : 'none',
                        transition: 'transform 100ms'
                      }}
                      onClick={() => {
                        setCanvases(prev => ({
                          ...prev,
                          [currentId]: {
                            ...prev[currentId],
                            bgColor: bgOpt
                          }
                        }));
                      }}
                      title={lang === 'es' ? colorsMap[bgOpt].label.es : colorsMap[bgOpt].label.en}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Context menu */}
        {/* Right-click on empty canvas → quick-create menu */}
        {contextMenu && contextMenu.canvas && (
          <div ref={ctxMenuRef} className="context-menu context-menu-create" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={(e)=>e.stopPropagation()}>
            <button disabled={historyIdx <= 0} onClick={()=>{ undo(); setContextMenu(null); }}>
              <span className="material-symbols-rounded">undo</span>
              {window.t('Deshacer', 'Undo')} <span style={{marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)'}}>⌘Z</span>
            </button>
            <button onClick={()=>{ selectAllItems(); setContextMenu(null); }}>
              <span className="material-symbols-rounded">select_all</span>
              {window.t('Seleccionar todo', 'Select all')} <span style={{marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)'}}>⌘A</span>
            </button>
             <div class="ctx-sep"/>
            {(window.TOOLS || []).map(tool => (
              <button key={tool.id} onClick={()=>{ createNodeAt(tool.id, contextMenu.cx, contextMenu.cy); setContextMenu(null); }}>
                <span className="material-symbols-rounded">{tool.icon}</span>
                {window.TRANSLATIONS[lang][tool.label] || tool.id}
              </button>
            ))}
            <div className="ctx-sep"/>
            <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'var(--text-soft, #595459)' }}>
              {window.t('Cambiar fondo del lienzo', 'Change canvas background')}
            </div>
            <div style={{ display: 'flex', gap: '6px', padding: '4px 12px 10px 12px', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }} onMouseDown={(e)=>e.stopPropagation()}>
              {['default', 'gray', 'sand', 'mint', 'sky', 'pink'].map(bgOpt => {
                const colorsMap = {
                  default: { light: '#FAF8F6', dark: '#2A282A', label: { es: 'Por defecto', en: 'Default' } },
                  gray: { light: '#ECEAE6', dark: '#1E1C1E', label: { es: 'Gris', en: 'Gray' } },
                  sand: { light: '#F4EFE6', dark: '#38322B', label: { es: 'Arena', en: 'Sand' } },
                  mint: { light: '#EAF2EB', dark: '#25332A', label: { es: 'Menta', en: 'Mint' } },
                  sky: { light: '#E6F0FA', dark: '#232F3D', label: { es: 'Celeste', en: 'Sky' } },
                  pink: { light: '#FAEBEF', dark: '#3A232F', label: { es: 'Rosa', en: 'Pink' } }
                };
                const colorHex = theme === 'dark' ? colorsMap[bgOpt].dark : colorsMap[bgOpt].light;
                const active = (current.bgColor || 'default') === bgOpt;
                return (
                  <button
                    key={bgOpt}
                    style={{
                      display: 'block',
                      width: '20px',
                      height: '20px',
                      minWidth: '20px',
                      padding: 0,
                      borderRadius: '50%',
                      background: colorHex,
                      border: active ? '2.5px solid var(--wine, #7B2D26)' : '1px solid var(--line-soft, #E5E1DD)',
                      cursor: 'pointer',
                      boxShadow: active ? '0 0 4px rgba(0,0,0,0.2)' : 'none',
                      transition: 'transform 100ms',
                      margin: 0
                    }}
                    onClick={() => {
                      setCanvases(prev => ({
                        ...prev,
                        [currentId]: {
                          ...prev[currentId],
                          bgColor: bgOpt
                        }
                      }));
                      setContextMenu(null);
                    }}
                    title={lang === 'es' ? colorsMap[bgOpt].label.es : colorsMap[bgOpt].label.en}
                  />
                );
              })}
            </div>
          </div>
        )}

        {contextMenu && !contextMenu.canvas && (() => {
          const it = current.items.find(i => i.id === contextMenu.itemId);
          if (!it) return null;
          return (
            <div ref={ctxMenuRef} className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={(e)=>e.stopPropagation()}>
              {['note','todo','link','column','comment','board'].includes(it.type) && (
                <button onClick={()=>{ setEditing(it.id); setContextMenu(null); }}>
                  <span className="material-symbols-rounded">edit</span>
                  {window.t('Editar', 'Edit')}
                </button>
              )}
              {it.type === 'image' && (
                <button onClick={()=>{ setCroppingId(it.id); setContextMenu(null); }}>
                  <span className="material-symbols-rounded">crop</span>
                  {window.t('Recortar imagen', 'Crop Image')}
                </button>
              )}
              {it.type === 'doc' && (
                <button onClick={()=>{ setDocOpen({ id: it.id }); setContextMenu(null); }}>
                  <span className="material-symbols-rounded">edit_note</span>
                  {window.t('Abrir documento', 'Open document')}
                </button>
              )}
              {it.type === 'board' && (
                <button onClick={()=>{ openBoard(it.canvasId, it.id); setContextMenu(null); }}>
                  <span className="material-symbols-rounded">open_in_full</span>
                  {window.t('Abrir tablero', 'Open board')}
                </button>
              )}
              <button onClick={()=>{ duplicateItem(it.id); setContextMenu(null); }}>
                <span className="material-symbols-rounded">content_copy</span>
                {window.t('Duplicar', 'Duplicate')} <span style={{marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)'}}>⌘D</span>
              </button>
              <div className="ctx-sep"/>
              <button className="danger" onClick={()=>{ deleteItem(it.id); }}>
                <span className="material-symbols-rounded">delete</span>
                {window.t('Eliminar', 'Delete')} <span style={{marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)'}}>⌫</span>
              </button>
            </div>
          );
        })()}
      </div>

      {/* Doc fullscreen modal */}
      {docItem && (
        <window.DocModal
          docItem={docItem}
          lang={lang}
          onClose={()=>setDocOpen(null)}
          onUpdate={docUpdater}
        />
      )}

      {/* File viewer modal (read-only, paginated) */}
      {fileOpen && (() => {
        const fileItem = current.items.find(i => i.id === fileOpen.id);
        if (!fileItem) return null;
        return <window.FileViewerModal fileItem={fileItem} lang={lang} onClose={()=>setFileOpen(null)}/>;
      })()}

      {/* Alignment Guides */}
      {/* Dragged Task Ghost */}
      {draggedTask && (
        <div
          className="todo-drag-ghost"
          style={{
            position: 'fixed',
            left: draggedTask.x + 12,
            top: draggedTask.y + 12,
            pointerEvents: 'none',
            zIndex: 99999,
            background: 'var(--paper)',
            border: '1.5px solid var(--wine)',
            borderRadius: '3px',
            padding: '8px 12px',
            boxShadow: 'var(--pop-deep)',
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '240px',
            wordBreak: 'break-all',
            opacity: 0.95
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '15px', color: 'var(--wine)' }}>checklist</span>
          <span>{draggedTask.text || '...'}</span>
        </div>
      )}
    </div>
  );
}

window.Canvas = Canvas;


