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
  return c.h || (c.type === 'note' ? 90 :
                 c.type === 'todo' ? 140 :
                 c.type === 'link' ? 180 :
                 c.type === 'image' ? 140 :
                 c.type === 'audio' ? 140 :
                 c.type === 'doc' ? 90 :
                 c.type === 'board' ? 130 :
                 c.type === 'comment' ? 80 :
                 c.type === 'calendar' ? 240 : 90);
}
function colNeededHeight(col, isEmpty) {
  const headerH = 42;
  const padding = 22;
  const gap = 7;
  const adderH = 36;
  if (isEmpty) return Math.max(160, padding + headerH + 90);
  const childrenH = (col.children || []).reduce((s, c) => s + colChildHeight(c), 0);
  const gaps = ((col.children || []).length - 1) * gap;
  return padding + headerH + childrenH + gaps + adderH;
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
    case 'note':     return { w: 300, h: 150 };
    case 'todo':     return { w: 300, h: 230 };
    case 'doc':      return { w: 300, h: 210 };
    case 'image':    return { w: 300, h: 220 };
    case 'link':     return { w: 340, h: 230 };
    case 'board':    return { w: 300, h: 240 };
    case 'column':   return { w: 320, h: 380 };
    case 'comment':  return { w: 280, h: 150 };
    case 'calendar': return { w: 520, h: 420 };
    case 'table':    return { w: 380, h: 220 };
    case 'audio':    return { w: 320, h: 140 };
    case 'color':    return { w: 220, h: 240 };
    case 'file':     return { w: 230, h: 150 };
    default:         return { w: 260, h: 160 };
  }
}

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
  const id = `it-${Date.now()}-${Math.floor(Math.random()*9999)}`;
  const base = { id, x, y, _new: true };
  const defaultSize = (defW, defH) => ({ w: Math.max(120, w || defW), h: Math.max(80, h || defH) });
  switch (type) {
    case 'note':
      return { ...base, type: 'note', ...defaultSize(300, 150), color: 'white', content: { es: '', en: '' } };
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
      return { ...base, type: 'link', ...defaultSize(380, 110), url: '', showPreview: true };
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
        name: lang==='es' ? 'Tú' : 'You',
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

function Canvas({ projectId, lang, setLang, theme, setTheme, onHome, canvasesIn, setCanvases: setExtCanvases, updateAvailable, onUpdateClick }) {
  const [canvases, _setCanvases] = useStateCanvas(() => canvasesIn || JSON.parse(JSON.stringify(window.INITIAL_CANVASES)));
  // Stable ref to App's setter — avoids the infinite loop caused by it being a dep on every render
  const setExtCanvasesRef = useRefCanvas(setExtCanvases);
  setExtCanvasesRef.current = setExtCanvases;
  // Sync canvas state up to the App (for persistence). Skipped during an active drag/resize
  // (body.odi-busy) so we don't trigger a full App+Canvas re-render on every mouse-move frame.
  // The final committed change (odi-busy removed on mouseup) syncs normally, so nothing is lost.
  useEffectCanvas(() => {
    if (document.body.classList.contains('odi-busy')) return;
    if (setExtCanvasesRef.current) setExtCanvasesRef.current(canvases);
  }, [canvases]);
  const setCanvases = (updater) => {
    _setCanvases(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  };

  const [stack, setStack] = useStateCanvas([projectId]);
  const [transition, setTransition] = useStateCanvas(null);

  const currentId = stack[stack.length - 1];
  const current = canvases[currentId] || {
    title: { es: 'Sin titulo', en: 'Untitled' },
    items: [],
    connectors: [],
  };

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
  const [scale, setScale] = useStateCanvas(1);

  // Refs to always have the latest pan, scale, and currentId in cleanup effects
  const panRef = useRefCanvas(pan);
  panRef.current = pan;
  const scaleRef = useRefCanvas(scale);
  scaleRef.current = scale;
  const currentIdRef = useRefCanvas(currentId);
  currentIdRef.current = currentId;

  // Load saved camera when currentId changes
  useEffectCanvas(() => {
    const saved = canvases[currentId];
    if (saved && saved.pan && saved.scale !== undefined) {
      setPan(saved.pan);
      setScale(saved.scale);
    } else {
      setPan({ x: 40, y: 20 });
      setScale(1);
    }
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

  // drag-to-create preview
  const [dragCreate, setDragCreate] = useStateCanvas(null); // { x,y,w,h, sx,sy }
  // tool ghost (drag-from-toolbar)
  const [toolGhost, setToolGhost] = useStateCanvas(null);

  // undo stack
  const [history, setHistory] = useStateCanvas([]);
  const [historyIdx, setHistoryIdx] = useStateCanvas(-1);
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
  const pushHistory = useCallbackCanvas((snap) => {
    setHistoryIdx(idx => {
      setHistory(h => {
        const cut = h.slice(0, idx + 1);
        cut.push(snap);
        if (cut.length > 50) cut.shift();
        return cut;
      });
      return Math.min(49, idx + 1);
    });
  }, []);

  useEffectCanvas(() => {
    if (skipHistory.current) { skipHistory.current = false; return; }
    pushHistory(JSON.stringify(canvases));
  // eslint-disable-next-line
  }, [canvases]);

  const undo = () => {
    if (historyIdx <= 0) return;
    skipHistory.current = true;
    const snap = JSON.parse(history[historyIdx - 1]);
    _setCanvases(snap);
    setHistoryIdx(i => i - 1);
  };
  const redo = () => {
    if (historyIdx >= history.length - 1) return;
    skipHistory.current = true;
    const snap = JSON.parse(history[historyIdx + 1]);
    _setCanvases(snap);
    setHistoryIdx(i => i + 1);
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
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ───── Keyboard ─────
  useEffectCanvas(() => {
    const onKey = (e) => {
      // While the read-only file viewer is open, don't run canvas shortcuts (it has its own Esc)
      if (fileOpen) return;
      const tag = (e.target.tagName || '').toLowerCase();
      const isPasteInt = e.target === pasteIntRef.current;
      const inField = !isPasteInt && (tag === 'input' || tag === 'textarea' || e.target.isContentEditable);
      if (inField) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selected) {
        e.preventDefault(); duplicateItem(selected);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault(); selectAllItems();
      }
      // Ctrl+C: copy the selected item to an in-app clipboard (no clipboard API needed)
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selected && !e.shiftKey) {
        const it = current.items.find(i => i.id === selected);
        if (it) {
          window._odiCopiedItem = JSON.parse(JSON.stringify(it));
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === '/' && !contextMenu) {
        e.preventDefault();
        document.querySelector('.mini-search input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ───── Focus the paste interceptor whenever an image node is selected ─────
  useEffectCanvas(() => {
    if (!selected) return;
    const selItem = current.items.find(i => i.id === selected);
    if (selItem?.type === 'image') {
      const t = setTimeout(() => pasteIntRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [selected]);

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
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).some(t => t === 'Files' || t === 'files')) {
        e.preventDefault();
      }
    };
    const onDrop = (e) => {
      // Don't intercept drops while a fullscreen modal (doc editor / file viewer) is open
      if (docOpen || fileOpen) return;
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;

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

      // Paste a previously-copied node at the mouse position
      const pasteCopiedNode = () => {
        e.preventDefault();
        const src = window._odiCopiedItem;
        const newId = `it-${Date.now()}-${Math.floor(Math.random()*9999)}`;
        const m = lastMouseRef.current || { x: 0, y: 0 };
        const pt = screenToCanvas(m.x, m.y);
        const w = src.w || 200, h = src.h || 120;
        const newItem = { ...JSON.parse(JSON.stringify(src)), id: newId, x: Math.round(pt.x - w / 2), y: Math.round(pt.y - h / 2), _new: true };
        if (newItem.type === 'board') newItem.canvasId = `b-${Date.now()}-${Math.floor(Math.random()*9999)}`;
        setCanvases(prev => {
          const c = prev[currentId];
          const out = { ...prev, [currentId]: { ...c, items: [...c.items, newItem] } };
          if (newItem.type === 'board') {
            out[newItem.canvasId] = { title: newItem.content, parent: currentId, parentLabel: c.title, items: [], connectors: [] };
          }
          return out;
        });
        setSelected(newId);
      };

      // Resolve to a usable image source (data URL from blob, or http URL string)
      const applyImageSrc = (src) => {
        e.preventDefault();
        const selItem = selected ? current.items.find(i => i.id === selected) : null;
        const img = new Image();
        img.onload = () => {
          const ratio = img.naturalWidth / img.naturalHeight;
          if (selItem && selItem.type === 'image') {
            const w = selItem.w || 260;
            updateItem(selected, { src, w, h: Math.max(60, Math.round(w / ratio)) });
          } else {
            const w = 300;
            const h = Math.max(60, Math.round(w / ratio));
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
        img.onerror = () => { if (selItem && selItem.type === 'image') updateItem(selected, { src }); };
        img.src = src;
      };

      // 1) Real image blob (screenshots, "copy image") — highest priority
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
      // 2) A copied node takes priority over plain text/URLs in the clipboard
      if (window._odiCopiedItem) { pasteCopiedNode(); return; }
      // 3) HTML with <img src="..."> (copying an image from a web page)
      if (types.includes('text/html')) {
        const html = cdata.getData('text/html');
        const match = html && html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && match[1]) { applyImageSrc(match[1]); return; }
      }
      // 4) A plain URL pointing to an image
      const urlText = (cdata.getData('text/uri-list') || cdata.getData('text/plain') || '').split('\n')[0].trim();
      if (urlText && /^https?:\/\//i.test(urlText) && /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(urlText)) {
        applyImageSrc(urlText);
      }
    };
    document.addEventListener('paste', onDocPaste);
    return () => document.removeEventListener('paste', onDocPaste);
  });

  // ───── Coordinates ─────
  const screenToCanvas = (clientX, clientY) => {
    const rect = surfaceRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / scale,
      y: (clientY - rect.top - pan.y) / scale,
    };
  };

  // ───── Item updates ─────
  const updateItem = useCallbackCanvas((itemId, patch) => {
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
      return { ...prev, [currentId]: { ...c, items: c.items.map(it => ids.includes(it.id) ? { ...it, _dragging: false } : it) } };
    });
  };

  const updateConnector = useCallbackCanvas((connId, patch) => {
    skipHistory.current = true;
    setCanvases(prev => {
      const c = prev[currentId];
      return { ...prev, [currentId]: { ...c, connectors: (c.connectors || []).map(co => co.id === connId ? { ...co, ...patch } : co) } };
    });
  // eslint-disable-next-line
  }, [currentId]);

  const addConnector = (fromEnd, toEnd) => {
    setCanvases(prev => {
      const c = prev[currentId];
      const conns = c.connectors || [];
      const newConn = {
        id: `cn-${Date.now()}-${Math.floor(Math.random()*9999)}`,
        fromEnd, toEnd,
        bend: { x: 0, y: 0 },
      };
      return { ...prev, [currentId]: { ...c, connectors: [...conns, newConn] } };
    });
  };

  const deleteConnector = (connId) => {
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

    // panning
    if (e.button === 1 || e.altKey || e.shiftKey) {
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
          if (['note','comment'].includes(item.type)) {
            setTimeout(() => setEditing(item.id), 40);
          }
          if (item.type === 'doc') {
            setTimeout(() => setDocOpen({ id: item.id }), 40);
          }
          if (item.type === 'link' || item.type === 'todo' || item.type === 'board' || item.type === 'column') {
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
        // Click on empty canvas → just deselect
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
        const ix = it.x, iy = it.y, iw = it.w, ih = it.h;
        // intersection test (any overlap counts)
        return !(ix + iw < rx || ix > rx + rw || iy + ih < ry || iy > ry + rh);
      }).map(it => it.id);
      setSelectedIds(hits);
      setSelected(hits.length === 1 ? hits[0] : null);
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
    if (editing === itemId) return;
    if (activeTool === 'line') return; // handled by startLineDrag
    if (activeTool) return;
    e.stopPropagation();
    // Multi-drag: if the clicked item is part of multi-selection, move all together
    const isMultiDrag = selectedIds.length > 1 && selectedIds.includes(itemId);
    if (!isMultiDrag) setSelectedIds([]);
    setSelected(isMultiDrag ? null : itemId);
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
    let moved = false;
    let currentDropCol = null;

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      if (isMultiDrag && multiStart) {
        // Move all selected items by the same delta
        _setCanvases(prev => {
          const c = prev[currentId];
          return { ...prev, [currentId]: {
            ...c,
            items: c.items.map(it => {
              const ms = multiStart.find(m => m.id === it.id);
              if (ms) return { ...it, x: ms.x + dx, y: ms.y + dy, _dragging: true };
              return it;
            }),
          }};
        });
        return;
      }
      const newX = startItemX + dx;
      const newY = startItemY + dy;
      updateItemSilent(itemId, { x: newX, y: newY, _dragging: true });

      // detect column drop target (item being dragged is NOT itself a column)
      if (item.type !== 'column') {
        const cx = newX + item.w / 2;
        const cy = newY + item.h / 2;
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
    };
    const onUp = () => {
      document.body.classList.remove('odi-busy');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDropTargetCol(null);
      if (isMultiDrag) {
        // Commit a non-silent update so history snapshots the new positions, and clear _dragging
        setCanvases(prev => {
          const c = prev[currentId];
          return { ...prev, [currentId]: {
            ...c,
            items: c.items.map(it => selectedIds.includes(it.id) ? { ...it, _dragging: false } : it),
          }};
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
    if (e.target.closest('input, textarea, button, .todo-check, .swatch-btn, .anchor, .todo-add, .cal-mb-input, .cal-mb-cell, .cal-mb-nav')) return;
    if (activeTool) return;
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    let extracted = false;
    let extractedId = null;
    let extractedW = 200, extractedH = 100;
    let currentDropCol = null;

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
      const nx = screenPt.x - extractedW / 2;
      const ny = screenPt.y - extractedH / 2;
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
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDropTargetCol(null);
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
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ───── Anchor drag (create connector) ─────
  const startAnchorDrag = (e, fromId, fromAnchor) => {
    e.stopPropagation(); e.preventDefault();
    const fromRect = window.getNodeRect?.(fromId, current.items);
    if (!fromRect) return;
    const startPos = anchorPos(fromRect, fromAnchor);
    setPendingConn({ fromId, fromAnchor, fromX: startPos.x, fromY: startPos.y, mx: startPos.x, my: startPos.y });

    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY);
      setPendingConn(pc => pc && { ...pc, mx: p.x, my: p.y });
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
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

    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY);
      setPendingConn(pc => pc && { ...pc, mx: p.x, my: p.y });
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
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
    setCanvases(prev => {
      const c = prev[currentId];
      const item = c.items.find(i => i.id === itemId);
      const nextCanvases = {
        ...prev,
        [currentId]: {
          ...c,
          items: c.items.filter(i => i.id !== itemId),
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
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      let nx = sx, ny = sy, nw = sw, nh = sh;
      if (corner.includes('r')) nw = Math.max(minW, sw + dx);
      if (corner.includes('b')) nh = Math.max(minH, sh + dy);
      if (corner.includes('l')) { nw = Math.max(minW, sw - dx); nx = sx + (sw - nw); }
      if (corner.includes('t')) { nh = Math.max(minH, sh - dy); ny = sy + (sh - nh); }
      // Shift locks aspect ratio for any node; the file node ALWAYS keeps its ratio.
      if (ev.shiftKey || item.type === 'file') {
        if (Math.abs(nw - sw) >= Math.abs(nh - sh)) {
          nh = Math.max(minH, Math.round(nw / aspectRatio));
          if (corner.includes('t')) ny = sy + (sh - nh);
        } else {
          nw = Math.max(minW, Math.round(nh * aspectRatio));
          if (corner.includes('l')) nx = sx + (sw - nw);
        }
      }
      updateItemSilent(itemId, { x: nx, y: ny, w: nw, h: nh });
    };
    const onUp = () => {
      document.body.classList.remove('odi-busy');
      updateItem(itemId, {});
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ───── Nested board open ─────
  const openBoard = (canvasId, fromItemId) => {
    if (!canvases[canvasId]) {
      const fromItem = current.items.find(i => i.id === fromItemId);
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

  // ───── Callbacks for items ─────
  const callbacks = useMemoCanvas(() => ({
    openBoard,
    openDoc: (id, colId) => setDocOpen({ id, colId }),
    openFile: (id) => setFileOpen({ id }),
    updateItem,
    getNestedItems,
    startEdit: (id) => setEditing(id),
    endEdit: () => setEditing(null),
    selectItem: (id) => setSelected(id),
    isSelectedItem: (id) => selected === id,
    resizeItemSilent: (id, patch) => updateItemSilent(id, patch),
    startColChildDrag,
    startAnchorDrag,
    editingChild,
    setEditingChild: (colId, childId) => setEditingChildState({ colId, childId }),
    updateColChild: (columnId, childId, patch) => {
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
          items: c.items.map(it => {
            if (it.id !== columnId) return it;
            return { ...it, children: (it.children || []).map(ch => ch.id === childId ? { ...ch, ...patch } : ch) };
          })
        };
        return nextCanvases;
      });
    },
  // eslint-disable-next-line
  }), [currentId, canvases, editingChild, selected]);

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

  const wrapClass = ['canvas-wrap'];
  if (transition === 'entering') wrapClass.push('entering');
  if (activeTool && activeTool !== 'line') wrapClass.push('placing');
  if (activeTool === 'line') wrapClass.push('linking');

  const selectedItem = (() => {
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
        if (['note','comment'].includes(item.type)) setTimeout(() => setEditing(item.id), 40);
        if (item.type === 'doc') setTimeout(() => setDocOpen({ id: item.id }), 40);
        if (['link','todo','board','column'].includes(item.type)) setTimeout(() => setEditing(item.id), 40);
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
        activeTool={activeTool} setActiveTool={setActiveTool}
        onHome={onHome}
        onUndo={undo} onRedo={redo}
        canUndo={historyIdx > 0} canRedo={historyIdx < history.length - 1}
        onToolDragStart={onToolDragStart}
        updateAvailable={updateAvailable}
        onUpdateClick={onUpdateClick}
      />

      {toolGhost && <ToolGhost {...toolGhost} lang={lang}/>}

      {/* Contextual sidebar */}
      {selectedItem && !captionFocusId && (
        <window.ContextSidebar
          item={selectedItem}
          lang={lang}
          onUpdate={(patch)=>updateItem(selectedItem.id, patch)}
          onDelete={()=>deleteItem(selectedItem.id)}
          onDuplicate={()=>duplicateItem(selectedItem.id)}
          onOpen={selectedItem.type === 'board' ? ()=>openBoard(selectedItem.canvasId, selectedItem.id) : null}
          onClose={()=>setSelected(null)}
        />
      )}

      {/* Connector sidebar (same style as item ctx) */}
      {selectedConn && (() => {
        const conn = (current.connectors || []).find(c => c.id === selectedConn);
        if (!conn) return null;
        const style = conn.style || 'solid';
        const shape = conn.shape || 'curve';
        const CONN_COLORS = ['#1A1A1A','#595459','#E6544F','#90B968','#F7DA84','#3D5A80','#955BA5','#FFFFFF'];
        return (
          <div className="ctx-side" onMouseDown={(e)=>e.stopPropagation()}>
            <button className="ctx-close" onClick={()=>setSelectedConn(null)} title={lang==='es'?'Cerrar':'Close'}>
              <span className="material-symbols-rounded">arrow_back</span>
            </button>

            <button className={`ctx-btn ${shape==='curve' ? 'active' : ''}`} onClick={()=>updateConnector(conn.id, { shape: 'curve' })}>
              <span className="material-symbols-rounded">show_chart</span>
              <span>{lang==='es'?'Curva':'Curve'}</span>
            </button>
            <button className={`ctx-btn ${shape==='orthogonal' ? 'active' : ''}`} onClick={()=>updateConnector(conn.id, { shape: 'orthogonal', bend: { x: 0, y: 0 } })}>
              <span className="material-symbols-rounded">stairs</span>
              <span>{lang==='es'?'Recta':'Right-angle'}</span>
            </button>

            <div className="ctx-sep-h"/>

            <button className={`ctx-btn ${style==='solid' ? 'active' : ''}`} onClick={()=>updateConnector(conn.id, { style: 'solid' })}>
              <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="2.5"/></svg>
              <span>{lang==='es'?'Sólida':'Solid'}</span>
            </button>
            <button className={`ctx-btn ${style==='dashed' ? 'active' : ''}`} onClick={()=>updateConnector(conn.id, { style: 'dashed' })}>
              <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 3"/></svg>
              <span>{lang==='es'?'Discontinua':'Dashed'}</span>
            </button>
            <button className={`ctx-btn ${style==='dotted' ? 'active' : ''}`} onClick={()=>updateConnector(conn.id, { style: 'dotted' })}>
              <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="2.5" strokeDasharray="1 3" strokeLinecap="round"/></svg>
              <span>{lang==='es'?'Punteada':'Dotted'}</span>
            </button>

            <div className="ctx-sep-h"/>

            <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 4, padding: '4px 6px'}}>
              {CONN_COLORS.map(c => (
                <button
                  key={c}
                  onClick={()=>updateConnector(conn.id, { color: c })}
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
              title={lang==='es'?'Flecha bidireccional':'Bidirectional arrow'}
            >
              <span className="material-symbols-rounded">sync_alt</span>
              <span>{lang==='es'?'Doble':'Two-way'}</span>
            </button>

            <button
              className={`ctx-btn ${connLabelOpen ? 'active' : ''}`}
              onClick={()=>setConnLabelOpen(o => !o)}
              title={lang==='es'?'Etiqueta':'Label'}
            >
              <span className="material-symbols-rounded">label</span>
              <span>{lang==='es'?'Etiqueta':'Label'}</span>
            </button>

            {connLabelOpen && (
              <div style={{padding:'4px 6px'}}>
                <input
                  className="conn-label-input"
                  autoFocus
                  value={conn.label || ''}
                  placeholder={lang==='es'?'Etiqueta…':'Label…'}
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
              <span>{lang==='es'?'Eliminar':'Delete'}</span>
            </button>
          </div>
        );
      })()}

      {/* Text format sidebar (when editing a text-based item) */}
      {editing && !captionFocusId && (() => {
        const it = current.items.find(i => i.id === editing);
        if (!it || !['note','comment'].includes(it.type)) return null;
        return (
          <window.TextFormatSidebar
            item={it}
            lang={lang}
            noCodeQuote={it.type === 'comment'}
            onUpdate={(patch)=>updateItem(it.id, patch)}
            onClose={()=>setEditing(null)}
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

      <div ref={surfaceRef} className={wrapClass.join(' ')} onMouseDown={onSurfaceMouseDown} onDoubleClick={onSurfaceDoubleClick} onContextMenu={onSurfaceContextMenu}>
        <div
          className="canvas-surface"
          style={{ left: 0, top: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0', width: bounds.w, height: bounds.h }}
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
              // Stack by interaction order: untouched (-1) at the bottom, last-touched at the top.
              const ai = zOrder.indexOf(a.id), bi = zOrder.indexOf(b.id);
              return ai - bi;
            }).map(item => {
              const matches = matchesSearch(item);
              const isEditing = editing === item.id;
              const isDropTarget = dropTargetCol === item.id;
              const def = defaultDims(item.type);
              const rawScale = Math.min((item.w || def.w) / def.w, (item.h || def.h) / def.h);
              const nodeScale = item.type === 'column'
                ? 1
                : 1 + (Math.min(2.25, Math.max(1, rawScale)) - 1) * 0.5;
              return (
                <div
                  key={item.id}
                  data-item-id={item.id}
                  className={`item ${(selected === item.id || selectedIds.includes(item.id)) ? 'selected' : ''} ${item._dragging ? 'dragging' : ''} ${isEditing ? 'editing' : ''} ${item._new ? 'new-item' : ''} ${isDropTarget ? 'drop-target' : ''}`}
                  style={{
                    left: item.x, top: item.y,
                    width: item.w, height: item.h,
                    '--node-scale': nodeScale,
                    zIndex: selected === item.id ? 100 : 2,
                    opacity: matches ? 1 : 0.18,
                    transition: item._dragging ? 'none' : 'opacity 200ms ease',
                  }}
                  onMouseDown={(e)=>{
                    if (activeTool === 'line') { startLineDrag(e, item.id); return; }
                    startDragItem(e, item.id);
                  }}
                  onDoubleClick={(e)=>{
                    if (item.type === 'doc') { e.stopPropagation(); setDocOpen({ id: item.id }); return; }
                    if (item.type === 'board') return;
                    if (['note','comment','todo','column','link','board'].includes(item.type)) {
                      e.stopPropagation(); setEditing(item.id);
                    }
                  }}
                  onContextMenu={(e)=>{
                    e.preventDefault(); e.stopPropagation();
                    setSelected(item.id);
                    const rect = surfaceRef.current.getBoundingClientRect();
                    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, itemId: item.id });
                  }}
                >
                  <window.NodeErrorBoundary key={`eb-${item.id}`}>
                    <window.ItemRenderer item={item} lang={lang} editing={isEditing} callbacks={callbacks}/>
                  </window.NodeErrorBoundary>
                  {/* Reactions */}
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
                      title={`${item.comments.length} ${lang==='es'?'comentarios':'comments'}`}
                    >
                      {item.comments.length}
                    </div>
                  )}
                  {/* Anchors */}
                  {!isEditing && !activeTool && (
                    <div className="anchors">
                      <div className="anchor top"    onMouseDown={(e)=>startAnchorDrag(e, item.id, 'top')}/>
                      <div className="anchor right"  onMouseDown={(e)=>startAnchorDrag(e, item.id, 'right')}/>
                      <div className="anchor bottom" onMouseDown={(e)=>startAnchorDrag(e, item.id, 'bottom')}/>
                      <div className="anchor left"   onMouseDown={(e)=>startAnchorDrag(e, item.id, 'left')}/>
                    </div>
                  )}
                  {/* Resize handles */}
                  {selected === item.id && !isEditing && (
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
                    panZoom={{ scale }}
                    screenToCanvas={screenToCanvas}
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

            {/* Connector toolbar moved to left sidebar (rendered above) */}
          </div>
        </div>

        {/* Mini-search */}
        <div className="mini-search" onMouseDown={(e)=>e.stopPropagation()}>
          <span className="material-symbols-rounded" style={{color:'var(--ink-3)', fontSize: 17}}>search</span>
          <input placeholder={window.TRANSLATIONS[lang].search_canvas} value={search} onChange={(e)=>setSearch(e.target.value)}/>
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
              ? (lang==='es'?'Arrastra de un nodo a otro':'Drag from one node to another')
              : (lang==='es'
                  ? `Arrastra para dibujar · clic simple para tamaño por defecto`
                  : `Drag to size · single click for default`)
            }
            <span className="esc">esc</span>
          </div>
        )}

        {/* Status pills */}
        <div className="status-bar">
          <div className="status-pill"><div className="dot-live"/> {lang==='es' ? 'Guardado' : 'Saved'}</div>
          <div className="status-pill">
            <span className="material-symbols-rounded" style={{fontSize:14}}>category</span>
            {current.items.length} {window.TRANSLATIONS[lang].items_count}
          </div>
          {stack.length > 1 && (
            <div className="status-pill accent">
              <span className="material-symbols-rounded" style={{fontSize:14}}>layers</span>
              {lang==='es' ? `Nivel ${stack.length}` : `Level ${stack.length}`}
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

        {/* Context menu */}
        {/* Right-click on empty canvas → quick-create menu */}
        {contextMenu && contextMenu.canvas && (
          <div ref={ctxMenuRef} className="context-menu context-menu-create" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={(e)=>e.stopPropagation()}>
            <button disabled={historyIdx <= 0} onClick={()=>{ undo(); setContextMenu(null); }}>
              <span className="material-symbols-rounded">undo</span>
              {lang==='es'?'Deshacer':'Undo'} <span style={{marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)'}}>⌘Z</span>
            </button>
            <button onClick={()=>{ selectAllItems(); setContextMenu(null); }}>
              <span className="material-symbols-rounded">select_all</span>
              {lang==='es'?'Seleccionar todo':'Select all'} <span style={{marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)'}}>⌘A</span>
            </button>
            <div className="ctx-sep"/>
            {(window.TOOLS || []).map(tool => (
              <button key={tool.id} onClick={()=>{ createNodeAt(tool.id, contextMenu.cx, contextMenu.cy); setContextMenu(null); }}>
                <span className="material-symbols-rounded">{tool.icon}</span>
                {window.TRANSLATIONS[lang][tool.label] || tool.id}
              </button>
            ))}
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
                  {lang==='es'?'Editar':'Edit'}
                </button>
              )}
              {it.type === 'doc' && (
                <button onClick={()=>{ setDocOpen({ id: it.id }); setContextMenu(null); }}>
                  <span className="material-symbols-rounded">edit_note</span>
                  {lang==='es'?'Abrir documento':'Open document'}
                </button>
              )}
              {it.type === 'board' && (
                <button onClick={()=>{ openBoard(it.canvasId, it.id); setContextMenu(null); }}>
                  <span className="material-symbols-rounded">open_in_full</span>
                  {lang==='es'?'Abrir tablero':'Open board'}
                </button>
              )}
              <button onClick={()=>{ duplicateItem(it.id); setContextMenu(null); }}>
                <span className="material-symbols-rounded">content_copy</span>
                {lang==='es'?'Duplicar':'Duplicate'} <span style={{marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)'}}>⌘D</span>
              </button>
              <div className="ctx-sep"/>
              <button className="danger" onClick={()=>{ deleteItem(it.id); }}>
                <span className="material-symbols-rounded">delete</span>
                {lang==='es'?'Eliminar':'Delete'} <span style={{marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)'}}>⌫</span>
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
    </div>
  );
}

window.Canvas = Canvas;

