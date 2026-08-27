// =====================================================
// Odinote — Context Sidebar (left side when item selected)
// =====================================================

const EMOJI_OPTIONS = ['👍','❤️','🔥','💡','✨','🎉','👀','🤔','😂','😍','🙏','💯','⚡','🚀','🎯','🤝','👏','💪','😎','🥳'];

// Icon choices for boards (Material Symbols names) — uses the shared list defined in items.jsx
const BOARD_ICON_CHOICES = [
  // General / organización
  'dashboard','folder','folder_open','category','widgets','grid_view','space_dashboard','inventory_2','label','bookmark','push_pin','tag','workspaces','topic',
  // Trabajo / productividad
  'work','business_center','lightbulb','rocket_launch','trending_up','target','task_alt','checklist','event','schedule','calendar_month','timeline','flag','priority_high',
  // Creatividad / arte
  'palette','brush','draw','format_paint','color_lens','imagesmode','photo_camera','movie','theaters','music_note','headphones','mic','piano','auto_awesome','animation',
  // Desarrollo / juegos
  'code','terminal','bug_report','memory','smart_toy','sports_esports','stadia_controller','casino','extension','joystick','swords',
  // Conocimiento / escritura
  'book','menu_book','auto_stories','school','science','biotech','functions','calculate','history_edu','translate','psychology','quiz','description','edit_note',
  // Mundo / mapas
  'map','public','travel_explore','place','explore','terrain','forest','park','landscape','castle','cottage','home','apartment','store',
  // Personas / social
  'group','person','groups','diversity_3','handshake','forum','chat','campaign','volunteer_activism',
  // Naturaleza / elementos
  'eco','local_florist','pets','bug_report','water_drop','local_fire_department','bolt','wb_sunny','dark_mode','cloud','ac_unit','spa',
  // Objetos / símbolos
  'star','favorite','diamond','emoji_objects','emoji_events','military_tech','workspace_premium','shield','key','lock','visibility','build','construction','settings','tune','science','rocket','flight','directions_car','sailing','anchor','restaurant','local_cafe','sports_bar','cake','redeem',
];

// Color picker — separate background and header strip for columns
const STICKY_PALETTE = [
  { key: 'white',  hex: '#FFFFFF', label: 'Blanco' },
  { key: 'mist',   hex: '#ECEBEB', label: 'Gris' },
  { key: 'cream',  hex: '#FEF7E0', label: 'Crema' },
  { key: 'yellow', hex: '#F7DA84', label: 'Amarillo' },
  { key: 'orange', hex: '#F5A66B', label: 'Naranja' },
  { key: 'rose',   hex: '#FBDFDD', label: 'Rosa' },
  { key: 'red',    hex: '#E6544F', label: 'Rojo' },
  { key: 'pink',   hex: '#E58AB8', label: 'Magenta' },
  { key: 'purple', hex: '#B084D0', label: 'Púrpura' },
  { key: 'sky',    hex: '#8AC1E8', label: 'Cielo' },
  { key: 'sage',   hex: '#E8F0DA', label: 'Verde claro' },
  { key: 'green',  hex: '#90B968', label: 'Verde' },
  { key: 'dark',   hex: '#595459', label: 'Gris oscuro' },
];

// Deep saturated palette for column header strips & boards
const STRIP_PALETTE = [
  { key: 'navy',   hex: '#3D5A80' },
  { key: 'indigo', hex: '#6C5FAF' },
  { key: 'plum',   hex: '#955BA5' },
  { key: 'wine',   hex: '#993844' },
  { key: 'red',    hex: '#C24A45' },
  { key: 'orange', hex: '#D88040' },
  { key: 'gold',   hex: '#D5A949' },
  { key: 'olive',  hex: '#6A8546' },
  { key: 'forest', hex: '#1F4D3F' },
  { key: 'dark',   hex: '#595459' },
  { key: 'black',  hex: '#1A1A1A' },
];

function resolveStickyColor(key) {
  const found = STICKY_PALETTE.find(p => p.key === key);
  if (found) return found.hex;
  return key && key.startsWith('#') ? key : '#FFFFFF';
}
function resolveStripColor(key) {
  const found = STRIP_PALETTE.find(p => p.key === key);
  if (found) return found.hex;
  return key && key.startsWith('#') ? key : '#3D5A80';
}

function ContextSidebar({
  item, lang, onUpdate, onDelete, onDuplicate, onOpen, backlinks, onGoToBacklink,
  onClose, isColChild, onStartEdit, callbacks,
}) {
  const [pane, setPane] = React.useState(null); // 'color' | 'emoji' | 'comments' | 'rename' | null
  const [focusedRowVersion, setFocusedRowVersion] = React.useState(0);
  const [iconQuery, setIconQuery] = React.useState('');

  React.useEffect(() => {
    window._notifyFocusedRowChanged = () => setFocusedRowVersion(v => v + 1);
    return () => { window._notifyFocusedRowChanged = null; };
  }, []);

  if (!item || window._calendarDayMenuOpen) return null;

  const isText = ['note','comment','doc'].includes(item.type);
  const isColumn = item.type === 'column';
  const isBoard = item.type === 'board';
  const isLink = item.type === 'link';
  const isTodo = item.type === 'todo';
  const isImage = item.type === 'image';
  const isTable = item.type === 'table';
  const isAudio = item.type === 'audio';
  const isComment = item.type === 'comment';
  const isCalendar = item.type === 'calendar';
  const isColor = item.type === 'color';
  const isFile = item.type === 'file';
  const isDoc = item.type === 'doc';
  const isFrame = item.type === 'frame';
  const isBigTitle = item.type === 'bigtitle';
  const isMap = item.type === 'map';
  const isDraw = item.type === 'draw';
  const isCurrentlyCropping = isImage && callbacks?.croppingId === item.id;
  // Dibujando: la barra se convierte en la caja de herramientas del lápiz y
  // nada más. Es el mismo patrón del recorte de una imagen.
  const isDrawingNow = isDraw && callbacks?.drawingId === item.id;

  const DRAW_COLORS = [
    '#1A1A1A', '#595459', '#FFFFFF', '#E6544F',
    '#D88040', '#DDAF2C', '#90B968', '#3CA59E',
    '#3D5A80', '#6C5FAF', '#955BA5', '#E58AB8',
  ];
  const DRAW_WIDTHS = [2, 4, 8, 14, 22];

  const downloadDocPdf = () => {
    if (!window.html2pdf) return;
    const title = (window.pickLang ? window.pickLang(item.title, lang) : '') || 'documento';
    const bodyHtml = (window.pickLang ? window.pickLang(item.body, lang) : '') || '';
    const el = document.createElement('div');
    el.style.cssText = 'padding:24px;font-family:Georgia,serif;color:#1a1a1a;line-height:1.55;';
    el.innerHTML = `<h1 style="font-size:22px;margin:0 0 12px;">${title}</h1>` + bodyHtml;
    window.html2pdf().set({ filename: `${title}.pdf`, margin: 12, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).from(el).save();
  };
  const tableCell = isTable && window._focusedTableCell && window._focusedTableCell.itemId === item.id
    ? window._focusedTableCell : null;

  // "Estirar": ajusta la altura del nodo a la de su contenido real (para
  // comentarios/notas largos que se cortan). Mide con la altura en auto.
  const fitHeightToContent = () => {
    const wrap = document.querySelector(`.item[data-item-id="${item.id}"]`) ||
                 document.querySelector(`[data-item-id="${item.id}"]`);
    if (!wrap) return;
    const card = wrap.querySelector('.item-card') || wrap.firstElementChild;
    if (!card) return;
    const prev = wrap.style.height;
    wrap.style.height = 'auto';
    const target = Math.max(60, Math.round(card.scrollHeight + 6));
    wrap.style.height = prev;
    // Además devuelve la nota al ajuste automático (deshace el tamaño manual)
    onUpdate({ h: target, manualH: false });
    window.playAudioTone && window.playAudioTone('click');
  };

  const reactions = item.reactions || {};
  const comments = item.comments || [];

  const addReaction = (emoji) => {
    const next = { ...reactions };
    next[emoji] = (next[emoji] || 0) + 1;
    onUpdate({ reactions: next });
  };

  const addComment = (text) => {
    const t = text.trim();
    if (!t) return;
    const id = `cm-${Date.now()}-${Math.floor(Math.random()*9999)}`;
    onUpdate({ comments: [...comments, {
      id,
      author: 'Anonymous',
      text: t,
      time: Date.now(),
    }] });
  };

  return (
    <>
      <div className="ctx-side">
        <button
          className="ctx-close"
          onClick={()=>{
            if (isCurrentlyCropping) {
              callbacks.setCroppingId(null);
              return;
            }
            // Dibujando, "atrás" guarda: salir tirando lo dibujado sin avisar
            // sería la peor forma de perder un rato de trabajo. Para tirarlo
            // está el botón de descartar, que sí pregunta.
            if (isDrawingNow) {
              if (pane) { setPane(null); return; }
              callbacks.saveDrawing();
              return;
            }
            // Step 1: if a sub-pane is open, just close it
            if (pane) { setPane(null); return; }
            // Step 2: if a table cell is focused, deselect cell to go back to table-level menu
            if (tableCell && tableCell.clearCellSelection) { tableCell.clearCellSelection(); return; }
            // Step 3: otherwise close the sidebar entirely
            onClose();
          }}
          title={window.t('Atrás', 'Back')}
        >
          <span className="material-symbols-rounded">arrow_back</span>
        </button>

        {isCurrentlyCropping ? (
          <button
            className="ctx-btn"
            onClick={() => callbacks.setCroppingId(null)}
            title={window.t('Listo', 'Done')}
          >
            <span className="material-symbols-rounded">done</span>
            <span>{window.t('Listo', 'Done')}</span>
          </button>
        ) : isDrawingNow ? (
          <>
            <button
              className={`ctx-btn ${callbacks.drawTool === 'pen' ? 'active' : ''}`}
              onClick={()=>callbacks.setDrawTool('pen')}
              title={window.t('Lápiz', 'Pen')}
            >
              <span className="material-symbols-rounded">edit</span>
              <span>{window.t('Lápiz', 'Pen')}</span>
            </button>

            <button
              className={`ctx-btn ${callbacks.drawTool === 'move' ? 'active' : ''}`}
              onClick={()=>callbacks.setDrawTool('move')}
              title={window.t('Mover trazos', 'Move strokes')}
            >
              <span className="material-symbols-rounded">near_me</span>
              <span>{window.t('Mover', 'Move')}</span>
            </button>

            <button
              className={`ctx-btn ${callbacks.drawTool === 'eraser' ? 'active' : ''}`}
              onClick={()=>callbacks.setDrawTool('eraser')}
              title={window.t('Borrador', 'Eraser')}
            >
              <span className="material-symbols-rounded">ink_eraser</span>
              <span>{window.t('Borrar', 'Erase')}</span>
            </button>

            <button
              className={`ctx-btn ${pane === 'drawColor' ? 'active' : ''}`}
              onClick={()=>setPane(pane === 'drawColor' ? null : 'drawColor')}
              title="Color"
            >
              <div className="ctx-color-chip" style={{ background: callbacks.drawColor, border: '1.5px solid var(--line-soft)' }}/>
              <span>Color</span>
            </button>

            <button
              className={`ctx-btn ${pane === 'drawWidth' ? 'active' : ''}`}
              onClick={()=>setPane(pane === 'drawWidth' ? null : 'drawWidth')}
              title={window.t('Grosor', 'Thickness')}
            >
              <span className="material-symbols-rounded">line_weight</span>
              <span>{window.t('Grosor', 'Width')}</span>
            </button>

            <button
              className={`ctx-btn ${pane === 'drawPressure' ? 'active' : ''}`}
              onClick={()=>setPane(pane === 'drawPressure' ? null : 'drawPressure')}
              title={window.t('Cómo varía el trazo', 'How the stroke varies')}
            >
              <span className="material-symbols-rounded">stylus_note</span>
              <span>{window.t('Trazo', 'Stroke')}</span>
            </button>

            <div className="ctx-sep-h"/>

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="ctx-btn"
                disabled={!callbacks.canDrawUndo}
                style={{ flex: 1, opacity: callbacks.canDrawUndo ? 1 : 0.35 }}
                onClick={()=>callbacks.drawUndo()}
                title={window.t('Deshacer', 'Undo')}
              >
                <span className="material-symbols-rounded">undo</span>
              </button>
              <button
                className="ctx-btn"
                disabled={!callbacks.canDrawRedo}
                style={{ flex: 1, opacity: callbacks.canDrawRedo ? 1 : 0.35 }}
                onClick={()=>callbacks.drawRedo()}
                title={window.t('Rehacer', 'Redo')}
              >
                <span className="material-symbols-rounded">redo</span>
              </button>
            </div>

            <div className="ctx-sep-h"/>

            <button
              className="ctx-btn"
              onClick={()=>{
                window.customConfirm(window.t('¿Descartar lo dibujado en esta sesión?', 'Discard what you drew in this session?'))
                  .then(ok => { if (ok) callbacks.discardDrawing(); });
              }}
              title={window.t('Descartar', 'Discard')}
            >
              <span className="material-symbols-rounded">close</span>
              <span>{window.t('Descartar', 'Discard')}</span>
            </button>

            <button
              className="ctx-btn ctx-btn-primary"
              onClick={()=>callbacks.saveDrawing()}
              title={window.t('Guardar', 'Save')}
            >
              <span className="material-symbols-rounded">check</span>
              <span>{window.t('Guardar', 'Save')}</span>
            </button>
          </>
        ) : (
          <>
            {/* Botón de editar universal: entra al modo edición del nodo (para las
                notas, títulos, comentarios, etc. muestra las opciones de texto).
                Se omite en imagen (se edita con doble clic / recorte) y en nodos
                sin edición de contenido (color, audio, archivo). */}
            {!tableCell && onStartEdit && ['note','comment','bigtitle','todo','link','board','column','frame'].includes(item.type) && (
              <button
                className="ctx-btn"
                onClick={()=>{ onStartEdit(); window.playAudioTone && window.playAudioTone('click'); }}
                title={window.t('Editar', 'Edit')}
              >
                <span className="material-symbols-rounded">edit</span>
                <span>{window.t('Editar', 'Edit')}</span>
              </button>
            )}
            {/* Un dibujo no tiene fondo de tarjeta: su color es el de la tinta,
                y va en su propio botón (abajo) porque se aplica a los trazos. */}
            {!tableCell && !isImage && !isDraw && (
              <button
            className={`ctx-btn ${(pane === 'color' || pane === 'colorHex') ? 'active' : ''}`}
            onClick={()=> isColor ? setPane(pane === 'colorHex' ? null : 'colorHex') : setPane(pane === 'color' ? null : 'color')}
            title="Color"
          >
            <div className="ctx-color-chip" style={{ background: isColor ? (item.hex || '#56B3A7') : resolveStickyColor(item.color || 'white'), border: '1.5px solid var(--line-soft)' }}/>
            <span>Color</span>
          </button>
        )}

        <button
          className={`ctx-btn ${pane === 'emoji' ? 'active' : ''}`}
          onClick={()=>setPane(pane === 'emoji' ? null : 'emoji')}
          title="Reacciones"
        >
          <span className="material-symbols-rounded">add_reaction</span>
          <span>{window.t('Reacciones', 'React')}</span>
        </button>

        <button
          className={`ctx-btn ${pane === 'comments' ? 'active' : ''}`}
          onClick={()=>setPane(pane === 'comments' ? null : 'comments')}
          title="Comentarios"
        >
          <span className="material-symbols-rounded">chat_bubble</span>
          <span>{window.t('Comentar', 'Comment')}</span>
          {comments.length > 0 && <div className="ctx-badge">{comments.length}</div>}
        </button>

        {isTodo && (
          <>
            <button
              className={`ctx-btn ${item.showTitle !== false ? 'active' : ''}`}
              onClick={()=>onUpdate({ showTitle: item.showTitle === false })}
              title={window.t('Mostrar/ocultar título', 'Toggle title')}
            >
              <span className="material-symbols-rounded">title</span>
              <span>{window.t('Título', 'Title')}</span>
            </button>
            <button
              className={`ctx-btn ${pane === 'dueDate' ? 'active' : ''}`}
              onClick={()=>setPane(pane === 'dueDate' ? null : 'dueDate')}
              title={window.t('Fecha límite', 'Due date')}
            >
              <span className="material-symbols-rounded">calendar_today</span>
              <span>{window.t('Para', 'Due')}</span>
            </button>
            <button
              className={`ctx-btn ${pane === 'assign' ? 'active' : ''}`}
              onClick={()=>setPane(pane === 'assign' ? null : 'assign')}
              title={window.t('Asignar', 'Assign')}
            >
              <span className="material-symbols-rounded">person</span>
              <span>{window.t('Asignar', 'Assign')}</span>
            </button>
            <div className="ctx-sep-h"/>
            <button
              className="ctx-btn"
              onClick={()=>{
                let activeRowIdx = -1;
                if (window._focusedTodoRow && window._focusedTodoRow.todoId === item.id) {
                  activeRowIdx = (item.items || []).findIndex(r => r.id === window._focusedTodoRow.rowId);
                }
                if (activeRowIdx === -1 && item.items && item.items.length > 0) {
                  activeRowIdx = 0;
                }
                if (activeRowIdx !== -1) {
                  const nextItems = (item.items || []).map((r, i) =>
                    i === activeRowIdx ? { ...r, indent: Math.max(0, Math.min(2, (r.indent || 0) + 1)) } : r
                  );
                  onUpdate({ items: nextItems });
                }
              }}
              title={window.t('Aumentar sangría', 'Indent')}
            >
              <span className="material-symbols-rounded">format_indent_increase</span>
              <span>{window.t('Indentar', 'Indent')}</span>
            </button>
            <button
              className="ctx-btn"
              onClick={()=>{
                let activeRowIdx = -1;
                if (window._focusedTodoRow && window._focusedTodoRow.todoId === item.id) {
                  activeRowIdx = (item.items || []).findIndex(r => r.id === window._focusedTodoRow.rowId);
                }
                if (activeRowIdx === -1 && item.items && item.items.length > 0) {
                  activeRowIdx = 0;
                }
                if (activeRowIdx !== -1) {
                  const nextItems = (item.items || []).map((r, i) =>
                    i === activeRowIdx ? { ...r, indent: Math.max(0, Math.min(2, (r.indent || 0) - 1)) } : r
                  );
                  onUpdate({ items: nextItems });
                }
              }}
              title={window.t('Reducir sangría', 'Outdent')}
            >
              <span className="material-symbols-rounded">format_indent_decrease</span>
              <span>{window.t('Desindentar', 'Outdent')}</span>
            </button>
            <div className="ctx-sep-h"/>
          </>
        )}

        {isLink && (
          <>
            <button
              className={`ctx-btn ${item.showPreview !== false ? 'active' : ''}`}
              onClick={()=>{
                // Igual que el documento: al quitar la vista previa el nodo se
                // vuelve compacto (fila tipo marcador), y al activarla recupera
                // altura para que la miniatura no quede aplastada.
                const turningOff = item.showPreview !== false;
                if (isColChild) {
                  onUpdate({ showPreview: !turningOff });
                } else {
                  onUpdate(turningOff
                    ? { showPreview: false, h: 76 }
                    : { showPreview: true, h: Math.max(item.h || 0, 260) });
                }
                window.playAudioTone && window.playAudioTone('click');
              }}
              title={window.t('Alternar vista previa', 'Toggle preview')}
            >
              <span className="material-symbols-rounded">image</span>
              <span>{window.t('Vista previa', 'Preview')}</span>
            </button>
            <button
              className={`ctx-btn ${item.showInfo !== false ? 'active' : ''}`}
              onClick={()=>onUpdate({ showInfo: item.showInfo === false })}
              title={window.t('Mostrar informacion', 'Show info')}
            >
              <span className="material-symbols-rounded">link</span>
              <span>Info</span>
            </button>
            <button
              className={`ctx-btn ${item.showCaption === true ? 'active' : ''}`}
              onClick={()=>{
                const show = item.showCaption !== true;
                onUpdate({ showCaption: show, h: show ? (item.h || 230) + 46 : Math.max(120, (item.h || 230) - 46) });
              }}
              title={window.t('Leyenda', 'Caption')}
            >
              <span className="material-symbols-rounded">notes</span>
              <span>{window.t('Leyenda', 'Caption')}</span>
            </button>
            <button
              className="ctx-btn"
              onClick={()=>item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}
              title={window.t('Abrir enlace', 'Open link')}
            >
              <span className="material-symbols-rounded">open_in_new</span>
              <span>{window.t('Abrir', 'Open')}</span>
            </button>
          </>
        )}

        {isDraw && (
          <>
            <button
              className="ctx-btn"
              onClick={()=>{ callbacks.enterDrawMode(item.id); window.playAudioTone && window.playAudioTone('click'); }}
              title={window.t('Seguir dibujando', 'Keep drawing')}
            >
              <span className="material-symbols-rounded">gesture</span>
              {/* "Editar" y no "Dibujar": el mismo botón que en el resto de
                  nodos, porque hace lo mismo — entrar a modificarlo. */}
              <span>{window.t('Editar', 'Edit', 'Modifier', 'Bearbeiten', 'Modifica', 'Editar', '编辑', '編集', '편집', 'تعديل', 'Изменить')}</span>
            </button>
            <button
              className={`ctx-btn ${pane === 'inkColor' ? 'active' : ''}`}
              onClick={()=>setPane(pane === 'inkColor' ? null : 'inkColor')}
              title={window.t('Color de la tinta', 'Ink colour')}
            >
              <div className="ctx-color-chip" style={{
                background: (item.strokes && item.strokes[0] && item.strokes[0].color) || '#1A1A1A',
                border: '1.5px solid var(--line-soft)',
              }}/>
              <span>Color</span>
            </button>
          </>
        )}

        {(isBoard || isColumn) && (
          <button
            className={`ctx-btn ${pane === 'boardIcon' ? 'active' : ''}`}
            onClick={()=>setPane(pane === 'boardIcon' ? null : 'boardIcon')}
            title={window.t('Cambiar icono', 'Change icon')}
          >
            <span className="material-symbols-rounded">{item.icon || (isColumn ? 'view_column' : 'dashboard')}</span>
            <span>{window.t('Icono', 'Icon')}</span>
          </button>
        )}

        {isBoard && (
          <button
            className={`ctx-btn ${item.showPreview !== false ? 'active' : ''}`}
            onClick={()=>{
              const show = item.showPreview === false; // toggling ON
              if (show) {
                onUpdate(isColChild ? { showPreview: true } : { showPreview: true, w: 300, h: 240 });
              } else {
                onUpdate(isColChild ? { showPreview: false } : { showPreview: false, w: 300, h: 62 });
              }
            }}
            title={window.t('Vista previa', 'Preview')}
          >
            <span className="material-symbols-rounded">{item.showPreview === false ? 'crop_square' : 'grid_view'}</span>
            <span>{window.t('Vista previa', 'Preview')}</span>
          </button>
        )}

        {isAudio && (
          <>
            <button
              className={`ctx-btn ${item.loop === true ? 'active' : ''}`}
              onClick={()=>onUpdate({ loop: item.loop !== true })}
              title={window.t('Bucle', 'Loop')}
            >
              <span className="material-symbols-rounded">loop</span>
              <span>{window.t('Bucle', 'Loop')}</span>
            </button>
            <button
              className={`ctx-btn ${item.showCaption === true ? 'active' : ''}`}
              onClick={()=>{
                const show = item.showCaption !== true;
                onUpdate({ showCaption: show, h: show ? (item.h || 140) + 40 : Math.max(100, (item.h || 140) - 40) });
              }}
              title={window.t('Leyenda', 'Caption')}
            >
              <span className="material-symbols-rounded">notes</span>
              <span>{window.t('Leyenda', 'Caption')}</span>
            </button>
          </>
        )}

        {/* Title toggle for the title-bearing nodes (table has its own below) */}
        {(isLink || isAudio || isBoard || isColumn) && (
          <button
            className={`ctx-btn ${item.showTitle !== false ? 'active' : ''}`}
            onClick={()=>onUpdate({ showTitle: item.showTitle === false })}
            title={window.t('Mostrar/ocultar título', 'Toggle title')}
          >
            <span className="material-symbols-rounded">title</span>
            <span>{window.t('Título', 'Title')}</span>
          </button>
        )}

        {/* Color node: toggle showing the HEX code */}
        {isColor && (
          <button
            className={`ctx-btn ${item.showHex !== false ? 'active' : ''}`}
            onClick={()=>onUpdate({ showHex: item.showHex === false })}
            title={window.t('Mostrar HEX', 'Show HEX')}
          >
            <span className="ctx-letter" style={{fontWeight:800, fontSize:13}}>#</span>
            <span>HEX</span>
          </button>
        )}

        {/* File node: preview + info toggles (Info only matters with preview on) */}
        {isFile && (
          <>
            <button
              className={`ctx-btn ${item.showPreview === true ? 'active' : ''}`}
              onClick={()=>{
                const show = item.showPreview !== true;
                if (show) {
                  const ext = (item.fileType || (item.name ? item.name.split('.').pop() : '') || '').toLowerCase();
                  const isXls = ['xlsx','xls','ods','csv'].includes(ext);
                  if (isXls) onUpdate({ showPreview: true, w: 420, h: 280 });           // landscape sheet
                  else onUpdate({ showPreview: true, h: Math.max(Math.round((item.w || 230) * 1.3), 300) });
                } else {
                  // back to a small square (compact icon) state
                  onUpdate({ showPreview: false, showInfo: false, w: 200, h: 190 });
                }
              }}
              title={window.t('Vista previa', 'Preview')}
            >
              <span className="material-symbols-rounded">image</span>
              <span>{window.t('Vista previa', 'Preview')}</span>
            </button>
            {item.showPreview === true && (
              <button
                className={`ctx-btn ${item.showInfo === true ? 'active' : ''}`}
                onClick={()=>onUpdate({ showInfo: item.showInfo !== true })}
                title="Info"
              >
                <span className="material-symbols-rounded">info</span>
                <span>Info</span>
              </button>
            )}
          </>
        )}

        {/* Doc node: preview toggle (off → logo only) + download as PDF */}
        {isDoc && (
          <>
            <button
              className={`ctx-btn ${item.showPreview !== false ? 'active' : ''}`}
              onClick={()=>onUpdate({ showPreview: item.showPreview === false })}
              title={window.t('Vista previa', 'Preview')}
            >
              <span className="material-symbols-rounded">image</span>
              <span>{window.t('Vista previa', 'Preview')}</span>
            </button>
            <button className="ctx-btn" onClick={downloadDocPdf} title={window.t('Descargar PDF', 'Download PDF')}>
              <span className="material-symbols-rounded">download</span>
              <span>{window.t('Descargar', 'Download')}</span>
            </button>
          </>
        )}

        {/* Caption ("leyenda") toggle for image / board / comment / calendar / color */}
        {(isImage || isBoard || isComment || isCalendar || isColor) && (
          <button
            className={`ctx-btn ${item.showCaption === true ? 'active' : ''}`}
            onClick={()=>{
              const show = item.showCaption !== true;
              const dH = isImage ? 0 : 44; // image caption is an overlay (no extra height)
              onUpdate({ showCaption: show, h: show ? (item.h || 200) + dH : Math.max(80, (item.h || 200) - dH) });
            }}
            title={window.t('Leyenda', 'Caption')}
          >
            <span className="material-symbols-rounded">notes</span>
            <span>{window.t('Leyenda', 'Caption')}</span>
          </button>
        )}

        {/* Table — no cell selected: show table-level options */}
        {isTable && !tableCell && (
          <>
            <button
              className={`ctx-btn ${item.showTitle === true ? 'active' : ''}`}
              onClick={()=>onUpdate({ showTitle: item.showTitle !== true })}
              title={window.t('Mostrar/ocultar título', 'Toggle title')}
            >
              <span className="material-symbols-rounded">title</span>
              <span>{window.t('Título', 'Title')}</span>
            </button>
          </>
        )}

        {/* Table — cell selected: show cell-level options */}
        {isTable && tableCell && (
          <>
            <button
              className={`ctx-btn ${pane === 'tblStyle' ? 'active' : ''}`}
              onClick={()=>setPane(pane === 'tblStyle' ? null : 'tblStyle')}
              title={window.t('Estilo', 'Style')}
            >
              <span className="material-symbols-rounded">text_format</span>
              <span>{window.t('Estilo', 'Style')}</span>
            </button>
            <button
              className={`ctx-btn ${pane === 'tblColor' ? 'active' : ''}`}
              onClick={()=>setPane(pane === 'tblColor' ? null : 'tblColor')}
              title="Color"
            >
              <div className="ctx-color-chip" style={{ background: tableCell.cellData?.color || '#FFFFFF', border: '1.5px solid var(--line-soft)' }}/>
              <span>Color</span>
            </button>
            <button
              className="ctx-btn"
              onClick={()=>{ setPane(null); tableCell.startFormula && tableCell.startFormula(); }}
              title={window.t('Fórmula (= en la celda)', 'Formula (= in cell)')}
            >
              <span style={{fontFamily:'serif', fontStyle:'italic', fontWeight:700, fontSize:14}}>fx</span>
              <span>{window.t('Fórmula', 'Formula')}</span>
            </button>
            <button
              className={`ctx-btn ${pane === 'tblAlign' ? 'active' : ''}`}
              onClick={()=>setPane(pane === 'tblAlign' ? null : 'tblAlign')}
              title={window.t('Alineación', 'Alignment')}
            >
              <span className="material-symbols-rounded">format_align_center</span>
              <span>{window.t('Alineación', 'Align')}</span>
            </button>
            <div className="ctx-sep-h"/>
            <button
              className="ctx-btn"
              onClick={()=>tableCell.addCol()}
              title={window.t('Añadir columna', 'Add column')}
            >
              <span className="material-symbols-rounded">add_box</span>
              <span>{window.t('Columna', 'Column')}</span>
            </button>
            <button
              className="ctx-btn"
              onClick={()=>tableCell.addRow()}
              title={window.t('Añadir fila', 'Add row')}
            >
              <span className="material-symbols-rounded">add_row_below</span>
              <span>{window.t('Añadir fila', 'Add row')}</span>
            </button>
            <div className="ctx-sep-h"/>
            <button
              className="ctx-btn danger"
              onClick={()=>tableCell.removeCol()}
              title={window.t('Eliminar columna', 'Remove column')}
            >
              <span className="material-symbols-rounded">indeterminate_check_box</span>
              <span>{window.t('Col -', 'Col -')}</span>
            </button>
            <button
              className="ctx-btn danger"
              onClick={()=>tableCell.removeRow()}
              title={window.t('Eliminar fila', 'Remove row')}
            >
              <span className="material-symbols-rounded">remove</span>
              <span>{window.t('Fila -', 'Row -')}</span>
            </button>
          </>
        )}

        {isBoard && (
          <button
            className={`ctx-btn`}
            onClick={()=>onOpen && onOpen()}
            title={window.t('Abrir', 'Open')}
          >
            <span className="material-symbols-rounded">open_in_full</span>
            <span>{window.t('Abrir', 'Open')}</span>
          </button>
        )}

        {isImage && (
          <>
            <button
              className="ctx-btn"
              onClick={()=>onUpdate({ _triggerImagePick: true })}
              title={window.t('Cambiar imagen', 'Change image')}
            >
              <span className="material-symbols-rounded">swap_horiz</span>
              <span>{window.t('Cambiar', 'Change')}</span>
            </button>
            <button
              className={`ctx-btn ${callbacks?.croppingId === item.id ? 'active' : ''}`}
              onClick={() => {
                if (callbacks) {
                  callbacks.setCroppingId(callbacks.croppingId === item.id ? null : item.id);
                }
              }}
              title={window.t('Recortar imagen', 'Crop image')}
            >
              <span className="material-symbols-rounded">crop</span>
              <span>{window.t('Recortar', 'Crop')}</span>
            </button>
            <button
              className="ctx-btn"
              onClick={() => {
                const ratio = item.naturalRatio || 1;
                onUpdate({
                  crop: { x: 0, y: 0, w: 100, h: 100 },
                  h: Math.max(60, Math.round(item.w / ratio))
                });
              }}
              title={window.t('Aspecto original', 'Original aspect')}
            >
              <span className="material-symbols-rounded">aspect_ratio</span>
              <span>{window.t('Restaurar', 'Restore')}</span>
            </button>
            <button
              className={`ctx-btn ${item.flipH ? 'active' : ''}`}
              onClick={() => {
                onUpdate({ flipH: !item.flipH });
                window.playAudioTone && window.playAudioTone('click');
              }}
              title={window.t('Voltear horizontalmente (efecto espejo)', 'Flip horizontally (mirror)')}
            >
              <span className="material-symbols-rounded">flip</span>
              <span>{window.t('Espejo H', 'Flip H')}</span>
            </button>
            <button
              className={`ctx-btn ${item.flipV ? 'active' : ''}`}
              onClick={() => {
                onUpdate({ flipV: !item.flipV });
                window.playAudioTone && window.playAudioTone('click');
              }}
              title={window.t('Voltear verticalmente (espejo arriba/abajo)', 'Flip vertically (top/bottom mirror)')}
            >
              <span className="material-symbols-rounded" style={{ transform: 'rotate(90deg)' }}>flip</span>
              <span>{window.t('Espejo V', 'Flip V')}</span>
            </button>
          </>
        )}

        {isFrame && (
          <>
            {/* (El botón "Editar" universal ya entra a editar el título del marco,
                así que aquí solo quedan los controles de tamaño del título.) */}
            <button
              className="ctx-btn"
              onClick={() => {
                const sizes = [12, 14, 18, 24, 30, 36, 48, 60];
                const titleSize = item.titleSize || 14;
                const idx = sizes.indexOf(titleSize);
                const next = idx < sizes.length - 1 ? sizes[idx + 1] : sizes[sizes.length - 1];
                onUpdate({ titleSize: next });
                window.playAudioTone && window.playAudioTone('click');
              }}
              title={window.t('Aumentar tamaño del título', 'Increase title size')}
            >
              <span className="material-symbols-rounded">text_increase</span>
              <span>{window.t('Aumentar Título', 'Increase Title')}</span>
            </button>
            <button
              className="ctx-btn"
              onClick={() => {
                const sizes = [12, 14, 18, 24, 30, 36, 48, 60];
                const titleSize = item.titleSize || 14;
                const idx = sizes.indexOf(titleSize);
                const next = idx > 0 ? sizes[idx - 1] : sizes[0];
                onUpdate({ titleSize: next });
                window.playAudioTone && window.playAudioTone('click');
              }}
              title={window.t('Disminuir tamaño del título', 'Decrease title size')}
            >
              <span className="material-symbols-rounded">text_decrease</span>
              <span>{window.t('Disminuir Título', 'Decrease Title')}</span>
            </button>
          </>
        )}

        {isBigTitle && (
          <>
            <button
              className={`ctx-btn ${pane === 'bigtitleColor' ? 'active' : ''}`}
              onClick={()=>setPane(pane === 'bigtitleColor' ? null : 'bigtitleColor')}
              title={window.t('Color del texto', 'Text color')}
            >
              <div className="ctx-letter" style={{
                fontWeight: 800,
                fontSize: 14,
                color: item.textColor || '#1A1A1A',
                background: item.textColor ? 'none' : 'linear-gradient(90deg, #1A1A1A, #E6544F, #90B968)',
                WebkitBackgroundClip: item.textColor ? 'none' : 'text',
                WebkitTextFillColor: item.textColor ? 'none' : 'transparent',
                backgroundClip: item.textColor ? 'none' : 'text',
              }}>
                {item.textColor && item.textColor !== 'inherit' ? <span style={{color: item.textColor}}>A</span> : 'A'}
              </div>
              <span>{window.t('Color', 'Color')}</span>
            </button>
            <button
              className={`ctx-btn ${pane === 'bigtitleAlign' ? 'active' : ''}`}
              onClick={()=>setPane(pane === 'bigtitleAlign' ? null : 'bigtitleAlign')}
              title={window.t('Alineación del texto', 'Text alignment')}
            >
              <span className="material-symbols-rounded">format_align_center</span>
              <span>{window.t('Alineación', 'Align')}</span>
            </button>
          </>
        )}

        {isMap && (
          <>
            <button
              className="ctx-btn"
              onClick={() => {
                onUpdate({ _editingTitle: true });
                window.playAudioTone && window.playAudioTone('click');
              }}
              title={window.t('Cambiar título', 'Change title')}
            >
              <span className="material-symbols-rounded">title</span>
              <span>{window.t('Título', 'Title')}</span>
            </button>
            <button
              className="ctx-btn"
              onClick={() => {
                onStartEdit && onStartEdit();
                window.playAudioTone && window.playAudioTone('click');
              }}
              title={window.t('Editar enlace o dirección', 'Edit link or address')}
            >
              <span className="material-symbols-rounded">pin_drop</span>
              <span>{window.t('Dirección', 'Address')}</span>
            </button>
            <button
              className={`ctx-btn ${item.showCaption === true ? 'active' : ''}`}
              onClick={()=>{
                const show = item.showCaption !== true;
                onUpdate({ showCaption: show, h: show ? (item.h || 280) + 40 : Math.max(160, (item.h || 280) - 40) });
                if (show) {
                  setTimeout(() => {
                    const el = document.querySelector(`[data-item-id="${item.id}"] .map-caption-input .rich-caption`);
                    if (el) el.focus();
                  }, 50);
                }
                window.playAudioTone && window.playAudioTone('click');
              }}
              title={window.t('Leyenda', 'Caption')}
            >
              <span className="material-symbols-rounded">notes</span>
              <span>{window.t('Leyenda', 'Caption')}</span>
            </button>
          </>
        )}

        {/* Tamaño de letra de la leyenda — dos botones (aumentar/disminuir),
            disponibles en cualquier nodo con leyenda activa */}
        {item.showCaption === true && (
          <>
            <button
              className="ctx-btn"
              onClick={() => {
                const sizes = [11, 13, 15, 18, 22, 28, 34];
                const cur = item.captionSize || 11;
                const idx = sizes.indexOf(cur);
                const next = idx < sizes.length - 1 ? sizes[idx + 1] : sizes[sizes.length - 1];
                onUpdate({ captionSize: next });
                window.playAudioTone && window.playAudioTone('click');
              }}
              title={window.t('Aumentar tamaño de la leyenda', 'Increase caption size')}
            >
              <span className="material-symbols-rounded">text_increase</span>
              <span>{window.t('Aumentar Leyenda', 'Increase Caption')}</span>
            </button>
            <button
              className="ctx-btn"
              onClick={() => {
                const sizes = [11, 13, 15, 18, 22, 28, 34];
                const cur = item.captionSize || 11;
                const idx = sizes.indexOf(cur);
                const next = idx > 0 ? sizes[idx - 1] : sizes[0];
                onUpdate({ captionSize: next });
                window.playAudioTone && window.playAudioTone('click');
              }}
              title={window.t('Disminuir tamaño de la leyenda', 'Decrease caption size')}
            >
              <span className="material-symbols-rounded">text_decrease</span>
              <span>{window.t('Disminuir Leyenda', 'Decrease Caption')}</span>
            </button>
          </>
        )}

        {/* Tamaño del texto del nodo (A+ / A−). Multiplica todo el texto, así que
            convive con Título/Subtítulo, negritas y demás formato. */}
        {['note','comment','todo'].includes(item.type) && (
          <>
            <button
              className="ctx-btn"
              onClick={() => {
                const steps = [0.8, 0.9, 1, 1.15, 1.35, 1.6, 1.9, 2.3, 2.8];
                const cur = item.textScale || 1;
                const idx = steps.findIndex(s => Math.abs(s - cur) < 0.001);
                const next = idx === -1 ? 1.15 : steps[Math.min(steps.length - 1, idx + 1)];
                onUpdate({ textScale: next });
                window.playAudioTone && window.playAudioTone('click');
              }}
              title={window.t('Aumentar tamaño del texto', 'Increase text size')}
            >
              <span className="material-symbols-rounded">text_increase</span>
              <span>{window.t('Aumentar Texto', 'Increase Text')}</span>
            </button>
            <button
              className="ctx-btn"
              onClick={() => {
                const steps = [0.8, 0.9, 1, 1.15, 1.35, 1.6, 1.9, 2.3, 2.8];
                const cur = item.textScale || 1;
                const idx = steps.findIndex(s => Math.abs(s - cur) < 0.001);
                const next = idx === -1 ? 0.9 : steps[Math.max(0, idx - 1)];
                onUpdate({ textScale: next });
                window.playAudioTone && window.playAudioTone('click');
              }}
              title={window.t('Disminuir tamaño del texto', 'Decrease text size')}
            >
              <span className="material-symbols-rounded">text_decrease</span>
              <span>{window.t('Disminuir Texto', 'Decrease Text')}</span>
            </button>
          </>
        )}

        {/* Estirar: ajustar altura al contenido (útil en comentarios/notas largos) */}
        {['note','comment','todo','link'].includes(item.type) && (
          <button className="ctx-btn" onClick={fitHeightToContent} title={window.t('Ajustar la altura al contenido', 'Fit height to content')}>
            <span className="material-symbols-rounded">height</span>
            <span>{window.t('Estirar', 'Fit height')}</span>
          </button>
        )}

        <div className="ctx-sep-h"/>

        <button className="ctx-btn" onClick={onDuplicate} title={window.t('Duplicar', 'Duplicate')}>
          <span className="material-symbols-rounded">content_copy</span>
          <span>{window.t('Duplicar', 'Duplicate')}</span>
        </button>
        <button className="ctx-btn danger" onClick={onDelete} title={window.t('Eliminar', 'Delete')}>
          <span className="material-symbols-rounded">delete</span>
          <span>{window.t('Eliminar', 'Delete')}</span>
        </button>
        {/* Quién apunta a este nodo. Es la mitad que le falta a un enlace: sin
            esto, el origen sabe del destino pero el destino no sabe de nadie, y
            no puedes ver de qué depende lo que estás a punto de cambiar. */}
        {backlinks && backlinks.length > 0 && (
          <button
            className={`ctx-btn ${pane === 'backlinks' ? 'active' : ''}`}
            onClick={() => setPane(pane === 'backlinks' ? null : 'backlinks')}
            title={window.t('Nodos que enlazan aquí', 'Nodes linking here')}
          >
            <span className="material-symbols-rounded">hub</span>
            <span>{backlinks.length} {window.t('refs', 'refs')}</span>
          </button>
        )}
          </>
        )}
      </div>

      {/* Popout panes */}
      {pane === 'backlinks' && (
        <div className="ctx-popout odi-backlinks">
          <div className="ctx-pop-title">
            {window.t('Referenciado desde', 'Referenced from')}
          </div>
          {backlinks.map(b => (
            <button
              key={`${b.canvasId}:${b.itemId}`}
              className="odi-backlink"
              onClick={() => { onGoToBacklink && onGoToBacklink(b); setPane(null); }}
            >
              <span className="odi-backlink-text">“{b.linkText}”</span>
              <span className="odi-backlink-path">{b.path.join(' / ')}</span>
            </button>
          ))}
        </div>
      )}
      {pane === 'color' && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">{isColumn ? (window.t('Color de la franja', 'Strip color')) : (window.t('Color de fondo', 'Background'))}</div>
            <div className="ctx-sticky-grid">
              {(isFrame || isBigTitle) && (
                <button
                  className={`ctx-sticky-swatch ${(item.color || 'transparent') === 'transparent' ? 'active' : ''}`}
                  style={{ 
                    background: 'transparent', 
                    border: '1.5px dashed var(--line, #121214)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={()=>onUpdate({ color: 'transparent' })}
                  title={window.t('Transparente', 'Transparent')}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '14px', color: 'var(--ink)' }}>close</span>
                </button>
              )}
              {STICKY_PALETTE.map(p => (
                <button
                  key={p.key}
                  className={`ctx-sticky-swatch ${(item.color || 'white') === p.key ? 'active' : ''}`}
                  style={{ background: p.hex, border: p.hex === '#FFFFFF' ? '1.5px solid var(--line-soft)' : '1.5px solid var(--line)' }}
                  onClick={()=>onUpdate({ color: p.key })}
                  title={p.label}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {pane === 'colorHex' && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">{window.t('Color', 'Color')}</div>
            <div className="ctx-colorhex">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(item.hex||'') ? item.hex : '#56B3A7'}
                onChange={(e)=>onUpdate({ hex: e.target.value.toUpperCase() })}
              />
              <input
                type="text"
                className="ctx-hex-input"
                value={item.hex || '#56B3A7'}
                onChange={(e)=>{ let v = e.target.value.trim().toUpperCase(); if (v && !v.startsWith('#')) v = '#' + v; onUpdate({ hex: v }); }}
                onClick={(e)=>e.stopPropagation()}
                onMouseDown={(e)=>e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}

      {pane === 'boardIcon' && (() => {
        const q = iconQuery.trim().toLowerCase();
        const list = q ? BOARD_ICON_CHOICES.filter(ic => ic.includes(q)) : BOARD_ICON_CHOICES;
        const seen = new Set();
        const icons = list.filter(ic => { if (seen.has(ic)) return false; seen.add(ic); return true; });
        return (
          <div className="ctx-popout">
            <div className="ctx-pop-section">
              <div className="ctx-pop-title">{window.t('Icono', 'Icon')}</div>
              <input
                className="ctx-icon-search"
                placeholder={window.t('Buscar icono…', 'Search icon…')}
                value={iconQuery}
                onChange={(e)=>setIconQuery(e.target.value)}
                autoFocus
              />
              <div className="ctx-icon-grid ctx-icon-grid-scroll">
                {icons.map(ic => (
                  <button
                    key={ic}
                    className={`ctx-icon-btn ${(item.icon || 'dashboard') === ic ? 'active' : ''}`}
                    onClick={()=>onUpdate({ icon: ic })}
                    title={ic}
                  >
                    <span className="material-symbols-rounded">{ic}</span>
                  </button>
                ))}
                {icons.length === 0 && <div className="ctx-icon-empty">{window.t('Sin resultados','No results')}</div>}
              </div>
            </div>
          </div>
        );
      })()}

      {pane === 'emoji' && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">{window.t('Reacciones', 'Reactions')}</div>
            <div className="ctx-emoji-grid">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} className="ctx-emoji-btn" onClick={()=>addReaction(e)}>{e}</button>
              ))}
            </div>
            {Object.keys(reactions).length > 0 && (
              <>
                <div className="ctx-pop-sub">{window.t('Actuales', 'Current')}</div>
                <div className="ctx-reactions-current">
                  {Object.entries(reactions).map(([emoji, count]) => (
                    <button
                      key={emoji}
                      className="ctx-react-pill"
                      onClick={()=>{
                        const next = { ...reactions };
                        if (count <= 1) delete next[emoji];
                        else next[emoji] = count - 1;
                        onUpdate({ reactions: next });
                      }}
                      title={window.t('Clic para quitar', 'Click to remove')}
                    >
                      <span style={{fontSize:13}}>{emoji}</span>
                      <span>{count}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {pane === 'comments' && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">{window.t(`Comentarios (${comments.length})`, `Comments (${comments.length})`)}</div>
            <div className="ctx-comments-list">
              {comments.length === 0 && (
                <div className="ctx-comments-empty">
                  {window.t('Sin comentarios aún', 'No comments yet')}
                </div>
              )}
              {comments.map(c => (
                <div key={c.id} className="ctx-comment">
                  <div className="ctx-comment-head">
                    <div className="ctx-comment-avatar">A</div>
                    <span className="ctx-comment-author">{c.author}</span>
                    <span className="ctx-comment-time">
                      {new Date(c.time).toLocaleString(lang, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      className="ctx-comment-del"
                      onClick={()=>onUpdate({ comments: comments.filter(cm => cm.id !== c.id) })}
                      title={window.t('Eliminar comentario', 'Delete comment')}
                    >
                      <span className="material-symbols-rounded">close</span>
                    </button>
                  </div>
                  <div className="ctx-comment-body">{c.text}</div>
                </div>
              ))}
            </div>
            <CommentComposer onSubmit={addComment} lang={lang}/>
          </div>
        </div>
      )}

      {pane === 'dueDate' && (() => {
        let activeRowIdx = -1;
        if (window._focusedTodoRow && window._focusedTodoRow.todoId === item.id) {
          activeRowIdx = (item.items || []).findIndex(r => r.id === window._focusedTodoRow.rowId);
        }
        if (activeRowIdx === -1 && item.items && item.items.length > 0) {
          activeRowIdx = 0;
        }
        const hasActiveRow = activeRowIdx !== -1;
        const liveRow = hasActiveRow ? item.items[activeRowIdx] : null;
        const rowDate = liveRow?.dueDate || '';
        const updateLiveRowMeta = (patch) => {
          if (!hasActiveRow) return;
          const nextItems = (item.items || []).map((r, i) => i === activeRowIdx ? { ...r, ...patch } : r);
          onUpdate({ items: nextItems });
        };
        return (
          <div className="ctx-popout">
            <div className="ctx-pop-section">
              <div className="ctx-pop-title">
                {window.t('Fecha límite', 'Due date')}
                {!hasActiveRow && <div style={{fontSize:10,color:'var(--ink-3)',marginTop:2}}>{window.t('Enfoca una tarea primero', 'Focus a task first')}</div>}
              </div>
              {hasActiveRow && (
                <>
                  <label className="ctx-field">
                     <span>{window.t('Fecha', 'Date')}</span>
                     <input
                       type="date"
                       value={rowDate}
                       onChange={(e)=>{ updateLiveRowMeta({ dueDate: e.target.value || null }); window._notifyFocusedRowChanged?.(); }}
                     />
                  </label>
                  {rowDate && (
                    <button className="ctx-btn danger" style={{marginTop:6}} onClick={()=>{ updateLiveRowMeta({ dueDate: null }); window._notifyFocusedRowChanged?.(); }}>
                      <span className="material-symbols-rounded">close</span>
                      <span>{window.t('Quitar', 'Remove')}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {pane === 'assign' && (() => {
        let activeRowIdx = -1;
        if (window._focusedTodoRow && window._focusedTodoRow.todoId === item.id) {
          activeRowIdx = (item.items || []).findIndex(r => r.id === window._focusedTodoRow.rowId);
        }
        if (activeRowIdx === -1 && item.items && item.items.length > 0) {
          activeRowIdx = 0;
        }
        const hasActiveRow = activeRowIdx !== -1;
        const liveRow = hasActiveRow ? item.items[activeRowIdx] : null;
        const rowAssignee = liveRow?.assignee || '';
        const updateLiveRowMeta = (patch) => {
          if (!hasActiveRow) return;
          const nextItems = (item.items || []).map((r, i) => i === activeRowIdx ? { ...r, ...patch } : r);
          onUpdate({ items: nextItems });
        };
        return (
          <div className="ctx-popout">
            <div className="ctx-pop-section">
              <div className="ctx-pop-title">
                {window.t('Asignar a', 'Assign to')}
                {!hasActiveRow && <div style={{fontSize:10,color:'var(--ink-3)',marginTop:2}}>{window.t('Enfoca una tarea primero', 'Focus a task first')}</div>}
              </div>
              {hasActiveRow && (
                <label className="ctx-field">
                  <span>{window.t('Persona', 'Person')}</span>
                  <input
                     type="text"
                     value={rowAssignee}
                     placeholder={window.t('Nombre…', 'Name…')}
                     onChange={(e)=>{ updateLiveRowMeta({ assignee: e.target.value || null }); window._notifyFocusedRowChanged?.(); }}
                  />
                </label>
              )}
            </div>
          </div>
        );
      })()}

      {pane === 'tblStyle' && tableCell && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">{window.t('Estilo', 'Style')}</div>
            <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
              {[
                { k: 'bold',      icon: 'format_bold', label: 'B' },
                { k: 'italic',    icon: 'format_italic', label: 'I' },
                { k: 'underline', icon: 'format_underlined', label: 'U' },
                { k: 'strike',    icon: 'format_strikethrough', label: 'S' },
              ].map(b => (
                <button
                  key={b.k}
                  className={`ctx-btn ${tableCell.cellData?.[b.k] ? 'active' : ''}`}
                  onClick={()=>tableCell.updateCell({ [b.k]: !tableCell.cellData?.[b.k] })}
                  style={{minWidth: 36}}
                  title={b.label}
                >
                  <span className="material-symbols-rounded">{b.icon}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {pane === 'tblColor' && tableCell && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">{window.t('Color de celda', 'Cell color')}</div>
            <div className="ctx-sticky-grid">
              <button
                className={`ctx-sticky-swatch ${!tableCell.cellData?.color ? 'active' : ''}`}
                style={{ background: 'transparent', border: '1.5px dashed var(--line-soft)' }}
                onClick={()=>tableCell.updateCell({ color: null })}
                title={window.t('Ninguno', 'None')}
              />
              {STICKY_PALETTE.map(p => (
                <button
                  key={p.key}
                  className={`ctx-sticky-swatch ${tableCell.cellData?.color === p.hex ? 'active' : ''}`}
                  style={{ background: p.hex, border: p.hex === '#FFFFFF' ? '1.5px solid var(--line-soft)' : '1.5px solid var(--line)' }}
                  onClick={()=>tableCell.updateCell({ color: p.hex })}
                  title={p.label}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {pane === 'tblAlign' && tableCell && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">{window.t('Alineación', 'Alignment')}</div>
            <div style={{display:'flex', gap: 4}}>
              {['left','center','right','justify'].map(a => (
                <button
                  key={a}
                  className={`ctx-btn ${(tableCell.cellData?.align || 'left') === a ? 'active' : ''}`}
                  onClick={()=>tableCell.updateCell({ align: a })}
                  style={{minWidth: 36}}
                  title={a}
                >
                  <span className="material-symbols-rounded">{`format_align_${a}`}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Paneles del dibujo ── */}
      {pane === 'drawColor' && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">
              {callbacks.selectedStrokeId
                ? window.t('Color de este trazo', 'This stroke’s colour')
                : window.t('Color de la tinta', 'Ink colour')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '6px' }}>
              {DRAW_COLORS.map(c => (
                <button
                  key={c}
                  className="text-color-swatch"
                  style={{
                    background: c,
                    width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer',
                    border: callbacks.drawColor === c ? '2.5px solid var(--wine)' : '1.5px solid var(--line-soft)',
                  }}
                  onClick={()=>callbacks.setDrawColor(c)}
                  title={c}
                />
              ))}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 10.5, lineHeight: 1.35, color: 'var(--text-soft)' }}>
              {callbacks.selectedStrokeId
                ? window.t('Cambia el trazo elegido y la tinta siguiente.', 'Changes the picked stroke and the next ink.')
                : window.t('Elige un trazo con “Mover” para recolorearlo.', 'Pick a stroke with “Move” to recolour it.')}
            </p>
          </div>
        </div>
      )}

      {pane === 'drawWidth' && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">{window.t('Grosor del trazo', 'Stroke thickness')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {DRAW_WIDTHS.map(w => (
                <button
                  key={w}
                  className={`ctx-btn ${callbacks.drawWidth === w ? 'active' : ''}`}
                  onClick={()=>callbacks.setDrawWidth(w)}
                  style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-start', padding: '4px 8px' }}
                  title={`${w} px`}
                >
                  <span style={{
                    display: 'inline-block', width: 44, height: Math.max(2, w),
                    borderRadius: 999, background: 'currentColor', flex: 'none',
                  }}/>
                  <span style={{ fontSize: 11 }}>{w}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {pane === 'drawPressure' && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">{window.t('Cómo varía el trazo', 'How the stroke varies')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {[
                { id: 'auto',     icon: 'auto_awesome', label: window.t('Automático', 'Automatic'),  hint: window.t('Lápiz → presión · ratón → velocidad', 'Pen → pressure · mouse → speed') },
                { id: 'pressure', icon: 'stylus',       label: window.t('Presión', 'Pressure'),      hint: window.t('Solo con lápiz digital', 'Digital pen only') },
                { id: 'speed',    icon: 'speed',        label: window.t('Velocidad', 'Speed'),       hint: window.t('Despacio engorda, rápido afina', 'Slow thickens, fast thins') },
                { id: 'uniform',  icon: 'horizontal_rule', label: window.t('Uniforme', 'Uniform'),   hint: window.t('Siempre el mismo grosor', 'Always the same width') },
              ].map(m => (
                <button
                  key={m.id}
                  className={`ctx-btn ${callbacks.drawPressureMode === m.id ? 'active' : ''}`}
                  onClick={()=>callbacks.setDrawPressureMode(m.id)}
                  style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-start', padding: '5px 8px', textAlign: 'left' }}
                  title={m.hint}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 16, flex: 'none' }}>{m.icon}</span>
                  <span style={{ fontSize: 11, lineHeight: 1.2 }}>{m.label}</span>
                </button>
              ))}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 10.5, lineHeight: 1.35, color: 'var(--text-soft)' }}>
              {window.t(
                'Sin lápiz digital el ratón no informa de presión: “Velocidad” es su equivalente.',
                'Without a digital pen the mouse reports no pressure: “Speed” is its stand-in.'
              )}
            </p>
          </div>
        </div>
      )}

      {pane === 'inkColor' && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">{window.t('Color de la tinta', 'Ink colour')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '6px' }}>
              {DRAW_COLORS.map(c => (
                <button
                  key={c}
                  className="text-color-swatch"
                  style={{
                    background: c,
                    width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer',
                    border: '1.5px solid var(--line-soft)',
                  }}
                  // Recolorea el dibujo entero: es lo que se espera de un nodo
                  // ya guardado. Para teñir un solo trazo se entra a dibujar.
                  onClick={()=>onUpdate({ strokes: (item.strokes || []).map(s => ({ ...s, color: c })) })}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {pane === 'bigtitleColor' && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">{window.t('Color del texto', 'Text color')}</div>
            <div className="text-color-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '6px' }}>
              {[
                '#1A1A1A', '#595459', '#9A969A', '#FFFFFF',
                '#E6544F', '#D88040', '#DDAF2C', '#90B968',
                '#3CA59E', '#3D5A80', '#6C5FAF', '#955BA5',
                '#993844', '#1F4D3F'
              ].map(c => (
                <button
                  key={c}
                  className="text-color-swatch"
                  style={{
                    background: c,
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    border: c === '#FFFFFF' ? '1.5px solid var(--line-soft)' : '1.5px solid var(--line)',
                    cursor: 'pointer'
                  }}
                  onClick={()=>{
                    onUpdate({ textColor: c });
                  }}
                  title={c}
                />
              ))}
            </div>
            <button
              className="btn"
              style={{ marginTop: 8, width: '100%', justifyContent: 'center', fontSize: 11.5 }}
              onClick={()=>{
                onUpdate({ textColor: 'inherit' });
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>format_clear</span>
              {window.t('Color por defecto', 'Default color')}
            </button>
          </div>
        </div>
      )}

      {pane === 'bigtitleAlign' && (
        <div className="ctx-popout">
          <div className="ctx-pop-section">
            <div className="ctx-pop-title">{window.t('Alineación del texto', 'Text alignment')}</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              {['left', 'center', 'right'].map(a => (
                <button
                  key={a}
                  className={`ctx-btn ${(item.align || 'center') === a ? 'active' : ''}`}
                  onClick={()=>onUpdate({ align: a })}
                  style={{ minWidth: 36 }}
                  title={a}
                >
                  <span className="material-symbols-rounded">{`format_align_${a}`}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}




    </>
  );
}

function ColorTabs({ item, onUpdate }) {
  const [tab, setTab] = React.useState('bg');
  return (
    <div className="ctx-pop-section">
      <div className="ctx-color-tabs">
        <button
          className={tab === 'bg' ? 'active' : ''}
          onClick={()=>setTab('bg')}
        >
          <div className="tab-chip" style={{background: resolveStickyColor(item.bgColor || item.color || 'white'), border:'1.5px solid var(--line-soft)'}}/>
          <span>Fondo</span>
        </button>
        <button
          className={tab === 'strip' ? 'active' : ''}
          onClick={()=>setTab('strip')}
        >
          <div className="tab-chip" style={{background: resolveStripColor(item.color || 'navy')}}/>
          <span>Franja</span>
        </button>
      </div>

      {tab === 'bg' && (
        <div className="ctx-sticky-grid">
          {STICKY_PALETTE.map(p => (
            <button
              key={p.key}
              className={`ctx-sticky-swatch ${(item.bgColor || 'white') === p.key ? 'active' : ''}`}
              style={{ background: p.hex, border: p.hex === '#FFFFFF' ? '1.5px solid var(--line-soft)' : '1.5px solid var(--line)' }}
              onClick={()=>onUpdate({ bgColor: p.key })}
              title={p.label}
            />
          ))}
        </div>
      )}

      {tab === 'strip' && (
        <div className="ctx-strip-grid">
          {STRIP_PALETTE.map(p => (
            <button
              key={p.key}
              className={`ctx-strip-swatch ${(item.color || 'navy') === p.key ? 'active' : ''}`}
              style={{ background: p.hex }}
              onClick={()=>onUpdate({ color: p.key })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentComposer({ onSubmit, lang }) {
  const [draft, setDraft] = React.useState('');
  const submit = () => {
    if (!draft.trim()) return;
    onSubmit(draft);
    setDraft('');
  };
  return (
    <div className="ctx-comment-composer">
      <textarea
        value={draft}
        onChange={(e)=>setDraft(e.target.value)}
        placeholder={window.t('Escribe un comentario…', 'Write a comment…')}
        onKeyDown={(e)=>{
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
        }}
      />
      <button className="btn btn-primary press" onClick={submit} disabled={!draft.trim()}>
        {window.t('Enviar', 'Send')}
      </button>
    </div>
  );
}

window.ContextSidebar = ContextSidebar;
window.STICKY_PALETTE = STICKY_PALETTE;
window.STRIP_PALETTE = STRIP_PALETTE;
window.resolveStickyColor = resolveStickyColor;
window.resolveStripColor = resolveStripColor;
window.EMOJI_OPTIONS = EMOJI_OPTIONS;
