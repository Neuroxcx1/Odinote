// =====================================================
// Odinote — Text format sidebar v2
// Uses document.execCommand on the currently-focused contentEditable
// so formatting applies only to selected text.
// =====================================================

function TextFormatSidebar({ item, lang, onUpdate, onClose, variant, noCodeQuote }) {
  if (!item) return null;
  const isCaption = variant === 'caption'; // captions get only Color/H1/B/I/S/U (no lists, quote, code)
  const [active, setActive] = React.useState({});
  const [colorOpen, setColorOpen] = React.useState(false);

  const TEXT_COLORS = [
    '#1A1A1A', '#595459', '#9A969A', '#FFFFFF',
    '#E6544F', '#D88040', '#DDAF2C', '#90B968',
    '#3CA59E', '#3D5A80', '#6C5FAF', '#955BA5',
    '#993844', '#1F4D3F',
  ];

  const refresh = () => {
    try {
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
      });
    } catch {}
  };

  React.useEffect(() => {
    const iv = setInterval(refresh, 250);
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
          color: '#E6544F',
          background: 'linear-gradient(90deg, #1A1A1A, #E6544F, #90B968)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>A</div>
        <span>{lang==='es'?'Color':'Color'}</span>
      </button>

      {!isCaption && (
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

      <button className={`ctx-btn ${active.bold ? 'active' : ''}`} onClick={()=>exec('bold')}>
        <div className="ctx-letter" style={{fontWeight: 800}}>B</div>
        <span>{lang==='es'?'Negrita':'Bold'}</span>
      </button>

      <button className={`ctx-btn ${active.italic ? 'active' : ''}`} onClick={()=>exec('italic')}>
        <div className="ctx-letter" style={{fontStyle: 'italic', fontWeight: 700}}>I</div>
        <span>{lang==='es'?'Cursiva':'Italic'}</span>
      </button>

      <button className={`ctx-btn ${active.strike ? 'active' : ''}`} onClick={()=>exec('strikeThrough')}>
        <div className="ctx-letter" style={{textDecoration: 'line-through', fontWeight: 700}}>S</div>
        <span>{lang==='es'?'Tachado':'Strike'}</span>
      </button>

      <button className={`ctx-btn ${active.underline ? 'active' : ''}`} onClick={()=>exec('underline')}>
        <div className="ctx-letter" style={{textDecoration: 'underline', fontWeight: 700}}>U</div>
        <span>{lang==='es'?'Subrayado':'Underline'}</span>
      </button>

      {!isCaption && <>
      <div className="ctx-sep-h"/>

      <button className="ctx-btn" onClick={()=>exec('justifyLeft')} title={lang==='es'?'Alinear a la izquierda':'Align left'}>
        <span className="material-symbols-rounded">format_align_left</span>
        <span>{lang==='es'?'Izquierda':'Left'}</span>
      </button>

      <button className="ctx-btn" onClick={()=>exec('justifyCenter')} title={lang==='es'?'Centrar':'Align center'}>
        <span className="material-symbols-rounded">format_align_center</span>
        <span>{lang==='es'?'Centrar':'Center'}</span>
      </button>

      <button className="ctx-btn" onClick={()=>exec('justifyRight')} title={lang==='es'?'Alinear a la derecha':'Align right'}>
        <span className="material-symbols-rounded">format_align_right</span>
        <span>{lang==='es'?'Derecha':'Right'}</span>
      </button>

      <button className="ctx-btn" onClick={()=>exec('justifyFull')} title={lang==='es'?'Justificar':'Justify'}>
        <span className="material-symbols-rounded">format_align_justify</span>
        <span>{lang==='es'?'Justificar':'Justify'}</span>
      </button>

      <div className="ctx-sep-h"/>

      <button className={`ctx-btn ${active.ul ? 'active' : ''}`} onClick={()=>exec('insertUnorderedList')}>
        <span className="material-symbols-rounded">format_list_bulleted</span>
        <span>{lang==='es'?'Lista':'Bullets'}</span>
      </button>

      <button className={`ctx-btn ${active.ol ? 'active' : ''}`} onClick={()=>exec('insertOrderedList')}>
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
      </>}
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
                  exec('foreColor', c);
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
              exec('removeFormat');
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
