// =====================================================
// Odinote — Text format sidebar v2
// Uses document.execCommand on the currently-focused contentEditable
// so formatting applies only to selected text.
// =====================================================

function TextFormatSidebar({ item, lang, onUpdate, onClose, variant, noCodeQuote }) {
  if (!item) return null;
  const isCaption = variant === 'caption'; // captions get only Color/H1/B/I/S/U (no lists, quote, code)
  const isBigTitle = item.type === 'bigtitle';
  const isFrame = item.type === 'frame';
  const isMap = item.type === 'map';
  const isTodo = item.type === 'todo';
  const isBoard = item.type === 'board';
  // Estos tipos guardan el formato como propiedades del nodo en vez de HTML, así
  // que NUNCA deben llegar a execCommand (findEditor haría fallback al primer
  // editor de nota del documento y formatearía un nodo ajeno).
  //
  // El to-do ya NO está en esa lista: sus tareas son texto con formato, así que
  // la negrita y el resto se aplican a lo seleccionado como en una nota. Antes
  // eran propiedades de la fila entera y por eso teñían la línea completa.
  // El tablero se trata como el título grande: color/negrita/cursiva son
  // propiedades del NODO entero, no de la selección —un pie de tablero con
  // dos tamaños de letra en dos palabras se vería mal—, pero sin alineación,
  // que ahí no significa nada (es una barra icono+texto+contador, no un bloque).
  const isCustomPropType = isBigTitle || isFrame || isMap || isBoard;
  // Ambos guardan el color en el mismo campo (item.textColor); frame y map
  // usan uno propio (item.titleColor) porque su titulo vive aparte del cuerpo.
  const usaTextColor = isBigTitle || isBoard;

  // ── To-do: el formato se aplica a la TAREA enfocada; si no hay ninguna
  // enfocada, se aplica a todas las tareas del nodo. ──
  const todoRows = isTodo ? (item.items || []) : [];
  const focusedTodoRowId = isTodo && window._focusedTodoRow && window._focusedTodoRow.todoId === item.id
    ? window._focusedTodoRow.rowId : null;
  const activeTodoRow = focusedTodoRowId
    ? todoRows.find(r => r.id === focusedTodoRowId)
    : todoRows[0];
  const applyTodoStyle = (patch) => {
    onUpdate({
      items: todoRows.map(r => (focusedTodoRowId ? r.id === focusedTodoRowId : true) ? { ...r, ...patch } : r)
    });
  };
  const toggleTodoStyle = (key) => applyTodoStyle({ [key]: !(activeTodoRow && activeTodoRow[key]) });
  const [active, setActive] = React.useState({});
  const [colorOpen, setColorOpen] = React.useState(false);

  const TEXT_COLORS = [
    '#1A1A1A', '#595459', '#9A969A', '#FFFFFF',
    '#E6544F', '#D88040', '#DDAF2C', '#90B968',
    '#3CA59E', '#3D5A80', '#6C5FAF', '#955BA5',
    '#993844', '#1F4D3F',
  ];

  // ── Qué botones salen encendidos ──
  //
  // Hay dos clases de nodo y no se pueden mirar igual:
  //
  //  · Título, marco y mapa guardan el formato como PROPIEDADES del nodo. Ahí
  //    el estado se lee de las props en cada render y ya está. Antes se metía
  //    en un estado que refrescaba un setInterval, y ese intervalo se quedaba
  //    con el `item` del render en que se creó: quitarle la negrita al título
  //    cambiaba el texto pero el botón seguía verde para siempre, así que
  //    parecía averiado. (Solo `align` estaba en las dependencias, por eso la
  //    alineación era lo único que respondía.)
  //
  //  · Notas, comentarios y tareas son HTML editable: ahí el formato depende
  //    de dónde esté el cursor, y eso solo se puede preguntar al navegador.
  //    Para eso sigue el sondeo — pero llamando siempre a la última versión.
  const propActive = React.useMemo(() => {
    if (item.type === 'bigtitle') {
      return {
        bold: item.bold !== false,
        italic: !!item.italic,
        strike: !!item.strike,
        underline: !!item.underline,
        alignLeft: (item.align || 'center') === 'left',
        alignCenter: (item.align || 'center') === 'center',
        alignRight: (item.align || 'center') === 'right',
        alignJustify: (item.align || 'center') === 'justify',
      };
    }
    // El tablero también guarda su formato como propiedades: su título es un
    // campo de texto plano, no HTML editable, así que B/I/S/U valen para el
    // título entero. Se lee igual que el del Título grande.
    if (item.type === 'board') {
      return {
        bold: item.bold !== false,
        italic: !!item.italic,
        strike: !!item.strike,
        underline: !!item.underline,
      };
    }
    if (item.type === 'frame' || item.type === 'map') {
      return {
        alignLeft: (item.titleAlign || 'left') === 'left',
        alignCenter: (item.titleAlign || 'left') === 'center',
        alignRight: (item.titleAlign || 'left') === 'right',
        alignJustify: (item.titleAlign || 'left') === 'justify',
      };
    }
    return null;
  }, [item.type, item.bold, item.italic, item.strike, item.underline, item.align, item.titleAlign]);

  const refresh = () => {
    if (propActive) return; // se lee de las props, no hay nada que sondear
    try {
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
        alignLeft: document.queryCommandState('justifyLeft'),
        alignCenter: document.queryCommandState('justifyCenter'),
        alignRight: document.queryCommandState('justifyRight'),
        alignJustify: document.queryCommandState('justifyFull'),
      });
    } catch {}
  };

  // Lo que se pinta: las propiedades del nodo cuando las hay, y si no lo que
  // diga el navegador sobre la selección actual.
  const shown = propActive || active;

  // El intervalo llama a través de una ref: así siempre ejecuta la función del
  // último render y no la que existía cuando se montó el temporizador.
  const refreshRef = React.useRef(refresh);
  refreshRef.current = refresh;
  React.useEffect(() => {
    const iv = setInterval(() => refreshRef.current(), 250);
    return () => clearInterval(iv);
  }, []);

  // Helper: find the active contenteditable; if not focused, focus the note's editor
  const findEditor = () => {
    let el = document.activeElement;
    if (el && el.isContentEditable) return el;
    // fallback to first .note-edit.rich
    el = document.querySelector(isCaption ? '.rich-caption' : '.note-edit.rich');
    if (el) { el.focus(); return el; }
    return null;
  };

  const exec = (cmd, val) => {
    const ed = findEditor();
    if (!ed) return;
    if (cmd === 'formatBlock') {
      const cleanTag = val.replace(/[<>]/g, '').toLowerCase();
      const changed = window.changeBlockTag && window.changeBlockTag(ed, cleanTag);
      if (changed) {
        ed.dispatchEvent(new Event('input', { bubbles: true }));
        refresh();
        return;
      }
      document.execCommand('removeFormat', false, null);
    }
    document.execCommand(cmd, false, val);
    // notify the note to persist via input event
    ed.dispatchEvent(new Event('input', { bubbles: true }));
    refresh();
  };

  return (
    <>
    <div className="ctx-side text-format" onMouseDown={(e)=>e.preventDefault()}>
      <button className="ctx-close" onClick={onClose} title={lang==='es'?'Cerrar':'Close'}>
        <span className="material-symbols-rounded">arrow_back</span>
      </button>

      <button
        className={`ctx-btn ${colorOpen ? 'active' : ''}`}
        onClick={()=>setColorOpen(o=>!o)}
        title={lang==='es'?'Color del texto':'Text color'}
      >
        <div className="ctx-letter" style={{
          fontWeight: 800,
          fontSize: 14,
          color: usaTextColor ? (item.textColor || '#1A1A1A') : ((isFrame || isMap) ? (item.titleColor || '#1A1A1A') : '#E6544F'),
          background: isCustomPropType && (usaTextColor ? item.textColor : item.titleColor) && (usaTextColor ? item.textColor : item.titleColor) !== 'inherit' ? 'none' : 'linear-gradient(90deg, #1A1A1A, #E6544F, #90B968)',
          WebkitBackgroundClip: isCustomPropType && (usaTextColor ? item.textColor : item.titleColor) && (usaTextColor ? item.textColor : item.titleColor) !== 'inherit' ? 'none' : 'text',
          WebkitTextFillColor: isCustomPropType && (usaTextColor ? item.textColor : item.titleColor) && (usaTextColor ? item.textColor : item.titleColor) !== 'inherit' ? 'none' : 'transparent',
          backgroundClip: isCustomPropType && (usaTextColor ? item.textColor : item.titleColor) && (usaTextColor ? item.textColor : item.titleColor) !== 'inherit' ? 'none' : 'text',
        }}>
          {isCustomPropType && (usaTextColor ? item.textColor : item.titleColor) && (usaTextColor ? item.textColor : item.titleColor) !== 'inherit' ? <span style={{color: usaTextColor ? item.textColor : item.titleColor}}>A</span> : 'A'}
        </div>
        <span>{lang==='es'?'Color':'Color'}</span>
      </button>

      {/* Bloques (titulos, listas, cita, codigo): no en una tarea ni en una
          leyenda. Una tarea es UNA linea; meterle una lista dentro no significa
          nada y descuadra la fila. Lo que si tiene sentido —color, negrita,
          cursiva, subrayado, tachado y enlazar— queda disponible. */}
      {!isCaption && !isTodo && !isCustomPropType && (
        <>
          <button className="ctx-btn" onClick={()=>exec('formatBlock', '<h1>')}>
            <div className="ctx-letter" style={{fontWeight: 800, fontSize: 14}}>H1</div>
            <span>{lang==='es'?'Título':'Heading'}</span>
          </button>
          <button className="ctx-btn" onClick={()=>exec('formatBlock', '<h2>')}>
            <div className="ctx-letter" style={{fontWeight: 700, fontSize: 12}}>H2</div>
            <span>{lang==='es'?'Subtítulo':'Subheading'}</span>
          </button>
          <button className="ctx-btn" onClick={()=>exec('formatBlock', '<p>')}>
            <span className="material-symbols-rounded">notes</span>
            <span>{lang==='es'?'Texto normal':'Paragraph'}</span>
          </button>
        </>
      )}

      {(!isCustomPropType || isBigTitle || isBoard) && (
        <>
          {/* En el título y en las tareas, B/I/S/U son toggles de propiedad
              (texto plano); en las notas usan execCommand por selección. */}
          <button className={`ctx-btn ${shown.bold ? 'active' : ''}`} onClick={()=> (isBigTitle || isBoard) ? onUpdate({ bold: item.bold === false }) : exec('bold')}>
            <div className="ctx-letter" style={{fontWeight: 800}}>B</div>
            <span>{lang==='es'?'Negrita':'Bold'}</span>
          </button>

          <button className={`ctx-btn ${shown.italic ? 'active' : ''}`} onClick={()=> (isBigTitle || isBoard) ? onUpdate({ italic: !item.italic }) : exec('italic')}>
            <div className="ctx-letter" style={{fontStyle: 'italic', fontWeight: 700}}>I</div>
            <span>{lang==='es'?'Cursiva':'Italic'}</span>
          </button>

          <button className={`ctx-btn ${shown.strike ? 'active' : ''}`} onClick={()=> (isBigTitle || isBoard) ? onUpdate({ strike: !item.strike }) : exec('strikeThrough')}>
            <div className="ctx-letter" style={{textDecoration: 'line-through', fontWeight: 700}}>S</div>
            <span>{lang==='es'?'Tachado':'Strike'}</span>
          </button>

          <button className={`ctx-btn ${shown.underline ? 'active' : ''}`} onClick={()=> (isBigTitle || isBoard) ? onUpdate({ underline: !item.underline }) : exec('underline')}>
            <div className="ctx-letter" style={{textDecoration: 'underline', fontWeight: 700}}>U</div>
            <span>{lang==='es'?'Subrayado':'Underline'}</span>
          </button>
        </>
      )}

      {/* Alineación: no aplica a las tareas (y evitaría caer en execCommand) */}
      {!isTodo && !isBoard && (isCustomPropType || !isCaption) && (
        <>
          <div className="ctx-sep-h"/>

          <button
            className={`ctx-btn ${shown.alignLeft ? 'active' : ''}`}
            onClick={()=>{
              if (isBigTitle) {
                onUpdate({ align: 'left' });
              } else if (isFrame || isMap) {
                onUpdate({ titleAlign: 'left' });
              } else {
                exec('justifyLeft');
              }
            }}
            title={lang==='es'?'Alinear a la izquierda':'Align left'}
          >
            <span className="material-symbols-rounded">format_align_left</span>
            <span>{lang==='es'?'Izquierda':'Left'}</span>
          </button>

          <button
            className={`ctx-btn ${shown.alignCenter ? 'active' : ''}`}
            onClick={()=>{
              if (isBigTitle) {
                onUpdate({ align: 'center' });
              } else if (isFrame || isMap) {
                onUpdate({ titleAlign: 'center' });
              } else {
                exec('justifyCenter');
              }
            }}
            title={lang==='es'?'Centrar':'Align center'}
          >
            <span className="material-symbols-rounded">format_align_center</span>
            <span>{lang==='es'?'Centrar':'Center'}</span>
          </button>

          <button
            className={`ctx-btn ${shown.alignRight ? 'active' : ''}`}
            onClick={()=>{
              if (isBigTitle) {
                onUpdate({ align: 'right' });
              } else if (isFrame || isMap) {
                onUpdate({ titleAlign: 'right' });
              } else {
                exec('justifyRight');
              }
            }}
            title={lang==='es'?'Alinear a la derecha':'Align right'}
          >
            <span className="material-symbols-rounded">format_align_right</span>
            <span>{lang==='es'?'Derecha':'Right'}</span>
          </button>

          <button
            className={`ctx-btn ${shown.alignJustify ? 'active' : ''}`}
            onClick={()=>{
              if (isBigTitle) {
                onUpdate({ align: 'justify' });
              } else if (isFrame || isMap) {
                onUpdate({ titleAlign: 'justify' });
              } else {
                exec('justifyFull');
              }
            }}
            title={lang==='es'?'Justificar':'Justify'}
          >
            <span className="material-symbols-rounded">format_align_justify</span>
            <span>{lang==='es'?'Justificar':'Justify'}</span>
          </button>
        </>
      )}

      {!isCaption && !isTodo && !isCustomPropType && (
        <>
          <div className="ctx-sep-h"/>

          <button className={`ctx-btn ${shown.ul ? 'active' : ''}`} onClick={()=>exec('insertUnorderedList')}>
            <span className="material-symbols-rounded">format_list_bulleted</span>
            <span>{lang==='es'?'Lista':'Bullets'}</span>
          </button>

          <button className={`ctx-btn ${shown.ol ? 'active' : ''}`} onClick={()=>exec('insertOrderedList')}>
            <span className="material-symbols-rounded">format_list_numbered</span>
            <span>{lang==='es'?'Numerada':'Numbered'}</span>
          </button>

          {!noCodeQuote && (
          <button className="ctx-btn" onClick={()=>exec('formatBlock', 'BLOCKQUOTE')}>
            <span className="material-symbols-rounded">format_quote</span>
            <span>{lang==='es'?'Cita':'Quote'}</span>
          </button>
          )}


          {!noCodeQuote && (
          <button className="ctx-btn" onClick={()=>{
            const ed = findEditor();
            if (!ed) return;
            const sel = window.getSelection();
            if (sel && !sel.isCollapsed && sel.toString().includes('\n') === false && sel.toString().length < 60) {
              // inline code — short single-line selection
              const range = sel.getRangeAt(0);
              const code = document.createElement('code');
              code.appendChild(range.extractContents());
              range.insertNode(code);
            } else {
              // block code — wrap selection (or insert empty block) in <pre><code>
              let content = '';
              if (sel && !sel.isCollapsed) {
                const range = sel.getRangeAt(0);
                content = range.toString();
                range.deleteContents();
              }
              const pre = document.createElement('pre');
              const code = document.createElement('code');
              code.textContent = content || '// código';
              pre.appendChild(code);
              if (sel && sel.rangeCount) {
                sel.getRangeAt(0).insertNode(pre);
              } else {
                ed.appendChild(pre);
              }
              // ensure a trailing paragraph after pre so user can click below
              let next = pre.nextSibling;
              if (!next || (next.nodeType === 1 && next.tagName === 'PRE')) {
                const p = document.createElement('p');
                p.appendChild(document.createElement('br'));
                pre.parentNode.insertBefore(p, pre.nextSibling);
              }
              if (window.hljs) {
                try {
                  code.textContent = code.textContent;
                  window.hljs.highlightElement(code);
                } catch {}
              }
            }
            ed.dispatchEvent(new Event('input', { bubbles: true }));
          }}>
            <span className="material-symbols-rounded">code</span>
            <span>{lang==='es'?'Código':'Code'}</span>
          </button>
          )}
        </>
      )}

      {/* Enlazar con otro nodo. FUERA del bloque de arriba a propósito: ese
          está cerrado para títulos y leyendas porque usan execCommand, que en
          esos tipos formatearía otro nodo. Enlazar no usa execCommand —solo
          envuelve la selección—, así que puede estar en todos los textos. */}
      <div className="ctx-sep-h"/>
      <button
        className="ctx-btn"
        onClick={()=>{
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed || !sel.rangeCount) {
            window.showToast && window.showToast(
              window.t('Selecciona antes el texto que quieres enlazar.', 'Select the text you want to link first.')
            );
            return;
          }
          window.odiStartLinkFromSelection && window.odiStartLinkFromSelection(sel.getRangeAt(0).cloneRange());
        }}
        title={lang==='es'?'Enlazar la selección con otro nodo':'Link selection to another node'}
      >
        <span className="material-symbols-rounded">add_link</span>
        <span>{lang==='es'?'Enlazar':'Link'}</span>
      </button>
    </div>

    {colorOpen && (
      <div className="ctx-popout text-color-pop" onMouseDown={(e)=>e.preventDefault()}>
        <div className="ctx-pop-section">
          <div className="ctx-pop-title">{lang==='es'?'Color del texto':'Text color'}</div>
          <div className="text-color-grid">
            {TEXT_COLORS.map(c => (
              <button
                key={c}
                className="text-color-swatch"
                style={{background: c, border: c === '#FFFFFF' ? '1.5px solid var(--line-soft)' : '1.5px solid var(--line)'}}
                onClick={()=>{
                  if (usaTextColor) {
                    onUpdate({ textColor: c });
                  } else if (isFrame || isMap) {
                    onUpdate({ titleColor: c });
                  } else {
                    exec('foreColor', c);
                  }
                  setColorOpen(false);
                }}
                title={c}
              />
            ))}
          </div>
          <button
            className="btn"
            style={{marginTop: 8, width: '100%', justifyContent: 'center', fontSize: 11.5}}
            onClick={()=>{
              if (isTodo) {
                // En una tarea hay dos formatos que limpiar: el de lo
                // seleccionado y las propiedades antiguas de la fila entera,
                // que si no seguirian tiniendo la linea completa.
                exec('removeFormat');
                applyTodoStyle({ color: null, bold: false, italic: false, underline: false, strike: false });
              } else if (usaTextColor) {
                onUpdate({ textColor: 'inherit' });
              } else if (isFrame || isMap) {
                onUpdate({ titleColor: 'inherit' });
              } else {
                exec('removeFormat');
              }
              setColorOpen(false);
            }}
          >
            <span className="material-symbols-rounded" style={{fontSize:14}}>format_clear</span>
            {lang==='es'?'Limpiar formato':'Clear formatting'}
          </button>
        </div>
      </div>
    )}
    </>
  );
}

window.TextFormatSidebar = TextFormatSidebar;
