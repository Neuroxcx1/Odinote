// =====================================================
// Odinote — DocModal (fullscreen rich text editor)
// Uses contenteditable + execCommand for B/I/U/lists.
// =====================================================

function DocModal({ docItem, lang, onClose, onUpdate }) {
  const titleRef = React.useRef(null);
  const bodyRef = React.useRef(null);
  const [active, setActive] = React.useState({});
  const [linkMenu, setLinkMenu] = React.useState(null); // { top, left, value }
  const savedRangeRef = React.useRef(null);             // selection captured when the link menu opened
  const linkInputRef = React.useRef(null);

  const timeoutRef = React.useRef(null);
  const pendingUpdateRef = React.useRef(null);

  const debounceUpdate = React.useCallback((patch) => {
    pendingUpdateRef.current = { ...pendingUpdateRef.current, ...patch };
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (pendingUpdateRef.current) {
        onUpdate(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
    }, 600); // 600ms debounce
  }, [onUpdate]);

  // Flush pending updates on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pendingUpdateRef.current) {
        onUpdate(pendingUpdateRef.current);
      }
    };
  }, [onUpdate]);

  // Set initial content once
  React.useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.innerHTML = window.pickLang(docItem.body, lang) || '';
    }
    if (titleRef.current) {
      titleRef.current.value = window.pickLang(docItem.title, lang) || '';
      // Adjust height to fit loaded title
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
    setTimeout(() => bodyRef.current?.focus(), 50);
  // eslint-disable-next-line
  }, [docItem.id]);

  const refreshActive = () => {
    const sel = window.getSelection();
    const hasSel = !!(sel && sel.rangeCount && !sel.isCollapsed &&
      bodyRef.current && bodyRef.current.contains(sel.getRangeAt(0).commonAncestorContainer));
      
    let isH1 = false;
    let isH2 = false;
    let isQuote = false;
    if (sel && sel.rangeCount) {
      let node = sel.anchorNode;
      while (node && node !== bodyRef.current) {
        if (node.nodeType === 1) {
          if (node.tagName === 'H1') isH1 = true;
          if (node.tagName === 'H2') isH2 = true;
          if (node.tagName === 'BLOCKQUOTE') isQuote = true;
        }
        node = node.parentNode;
      }
    }
    const isP = !isH1 && !isH2 && !isQuote && !document.queryCommandState('insertUnorderedList') && !document.queryCommandState('insertOrderedList');

    setActive({
      bold:      document.queryCommandState('bold'),
      italic:    document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike:    document.queryCommandState('strikeThrough'),
      ul:        document.queryCommandState('insertUnorderedList'),
      ol:        document.queryCommandState('insertOrderedList'),
      alignC:    document.queryCommandState('justifyCenter'),
      alignR:    document.queryCommandState('justifyRight'),
      alignJ:    document.queryCommandState('justifyFull'),
      h1:        isH1,
      h2:        isH2,
      p:         isP,
      quote:     isQuote,
      hasSel,
    });
  };

  const exec = (cmd, val) => {
    if (cmd === 'formatBlock') {
      const cleanTag = val.replace(/[<>]/g, '').toLowerCase();
      const changed = window.changeBlockTag && window.changeBlockTag(bodyRef.current, cleanTag);
      if (changed) {
        bodyRef.current?.focus();
        refreshActive();
        commitBody();
        return;
      }
      // Clean inline styling so the block takes theme styles cleanly
      document.execCommand('removeFormat', false, null);
    }
    document.execCommand(cmd, false, val);
    bodyRef.current?.focus();
    refreshActive();
    commitBody();
  };

  const commitBody = () => {
    if (!bodyRef.current) return;
    debounceUpdate({ body: { es: bodyRef.current.innerHTML, en: bodyRef.current.innerHTML } });
  };

  const commitTitle = () => {
    if (!titleRef.current) return;
    debounceUpdate({ title: { es: titleRef.current.value, en: titleRef.current.value } });
  };

  // Toggle blockquote on/off
  const toggleQuote = () => {
    const sel = window.getSelection();
    let node = sel?.anchorNode;
    while (node && node !== bodyRef.current) {
      if (node.tagName === 'BLOCKQUOTE') { exec('formatBlock', '<p>'); return; }
      node = node.parentNode;
    }
    exec('formatBlock', '<blockquote>');
  };

  // Open the floating link editor next to the current text selection.
  const openLinkMenu = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    // Must be inside the editor
    if (!bodyRef.current || !bodyRef.current.contains(range.commonAncestorContainer)) return;
    savedRangeRef.current = range.cloneRange();
    const rect = range.getBoundingClientRect();
    // Pre-fill if the selection already sits inside an existing link
    let existing = '';
    let node = sel.anchorNode;
    while (node && node !== bodyRef.current) {
      if (node.tagName === 'A') { existing = node.getAttribute('href') || ''; break; }
      node = node.parentNode;
    }
    const top = (rect.bottom || rect.top) + 8;
    const left = rect.left || rect.x || 0;
    setLinkMenu({ top, left, value: existing });
    setTimeout(() => linkInputRef.current?.focus(), 0);
  };

  // Apply (or update) the link on the saved selection, painted with the wine accent via CSS.
  const applyLink = () => {
    const url = (linkMenu?.value || '').trim();
    const sel = window.getSelection();
    if (savedRangeRef.current) { sel.removeAllRanges(); sel.addRange(savedRangeRef.current); }
    if (url) {
      const href = /^(https?:\/\/|mailto:)/i.test(url) ? url : 'https://' + url;
      if (savedRangeRef.current && savedRangeRef.current.collapsed) {
        // No text selected → insert the URL itself as the linked text
        const safe = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        document.execCommand('insertHTML', false, `<a href="${safe}">${safe}</a>`);
      } else {
        document.execCommand('createLink', false, href);
      }
    } else if (savedRangeRef.current && !savedRangeRef.current.collapsed) {
      document.execCommand('unlink');
    }
    setLinkMenu(null);
    commitBody();
    bodyRef.current?.focus();
  };

  const removeLink = () => {
    const sel = window.getSelection();
    if (savedRangeRef.current) { sel.removeAllRanges(); sel.addRange(savedRangeRef.current); }
    document.execCommand('unlink');
    setLinkMenu(null);
    commitBody();
    bodyRef.current?.focus();
  };

  // Turn a bare URL ending at the caret into a hyperlink. Returns true if it did.
  const linkifyBeforeCaret = (addSpace) => {
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed) return false;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3) return false; // must be a text node
    // bail out if we're already inside a link, or outside the editor
    let p = node.parentNode;
    while (p && p !== bodyRef.current) { if (p.nodeName === 'A') return false; p = p.parentNode; }
    if (p !== bodyRef.current) return false;
    const offset = sel.anchorOffset;
    const m = node.textContent.slice(0, offset).match(/(https?:\/\/[^\s]+|www\.[^\s]+)$/i);
    if (!m) return false;
    const url = m[0];
    const range = document.createRange();
    range.setStart(node, offset - url.length);
    range.setEnd(node, offset);
    sel.removeAllRanges();
    sel.addRange(range);
    const href = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    document.execCommand('createLink', false, href);
    // drop the caret just after the new link (plus a space if requested) so typing continues outside it
    let aEl = window.getSelection().anchorNode;
    while (aEl && aEl.nodeName !== 'A' && aEl !== bodyRef.current) aEl = aEl.parentNode;
    if (aEl && aEl.nodeName === 'A') {
      const after = document.createTextNode(addSpace ? ' ' : '');
      aEl.parentNode.insertBefore(after, aEl.nextSibling);
      const rng = document.createRange();
      rng.setStart(after, after.length);
      rng.collapse(true);
      const s2 = window.getSelection();
      s2.removeAllRanges();
      s2.addRange(rng);
    }
    commitBody();
    return true;
  };

  // Paste of a single bare URL → insert it as a clickable link automatically.
  const onBodyPaste = (e) => {
    const text = ((e.clipboardData && e.clipboardData.getData('text/plain')) || '').trim();
    if (text && !/\s/.test(text) && /^(https?:\/\/|www\.)\S+$/i.test(text)) {
      e.preventDefault();
      const href = /^https?:\/\//i.test(text) ? text : 'https://' + text;
      const safe = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      document.execCommand('insertHTML', false, `<a href="${safe}">${safe}</a>`);
      commitBody();
    }
  };

  const onBodyKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    // Typing a space right after a bare URL auto-links it
    if (e.key === ' ') {
      if (linkifyBeforeCaret(true)) { e.preventDefault(); return; }
    }
    // Backspace at start of empty blockquote exits it
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (sel?.isCollapsed && sel.anchorOffset === 0) {
        let node = sel.anchorNode;
        while (node && node !== bodyRef.current) {
          if (node.tagName === 'BLOCKQUOTE') {
            if ((node.textContent || '').trim() === '') {
              e.preventDefault();
              document.execCommand('formatBlock', false, '<p>');
              commitBody();
            }
            return;
          }
          node = node.parentNode;
        }
      }
    }
    // Enter on empty blockquote line exits it
    if (e.key === 'Enter' && !e.shiftKey) {
      // auto-link a bare URL at the end of the line before the new line is created
      linkifyBeforeCaret(false);
      const sel = window.getSelection();
      let node = sel?.anchorNode;
      while (node && node !== bodyRef.current) {
        if (node.tagName === 'BLOCKQUOTE') {
          if ((node.textContent || '').trim() === '') {
            e.preventDefault();
            document.execCommand('formatBlock', false, '<p>');
            commitBody();
          }
          return;
        }
        node = node.parentNode;
      }
    }
  };

  // Open links on click inside contentEditable
  const onBodyClick = (e) => {
    const a = e.target.closest('a[href]');
    if (a) {
      e.preventDefault();
      window.open(a.href, '_blank', 'noopener,noreferrer');
    }
  };

  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="doc-modal-backdrop" onMouseDown={onClose}>
      <div className="doc-modal" onMouseDown={(e)=>e.stopPropagation()} onKeyDown={onKey}>
        <div className="doc-modal-head">
          <span className="material-symbols-rounded" style={{color:'var(--wine)'}}>description</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <textarea
              ref={titleRef}
              className="doc-title-input"
              placeholder={lang==='es'?'Sin título':'Untitled'}
              onChange={(e) => {
                commitTitle();
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
              rows={1}
              style={{
                resize: 'none',
                overflowY: 'hidden',
                height: 'auto',
                fontFamily: 'var(--font-display)',
                fontWeight: '800',
                fontSize: '20px',
                flex: 1,
                letterSpacing: '-0.02em',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'inherit',
                padding: '4px 0'
              }}
            />
            <button
              className="icon-btn lift"
              onClick={() => titleRef.current?.select()}
              title={lang==='es' ? 'Editar título' : 'Edit title'}
              style={{
                padding: '6px',
                minWidth: 'auto',
                height: 'auto',
                flexShrink: 0,
                background: '#FFFFFF',
                borderColor: '#E1DFE3',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#595459' }}>edit</span>
            </button>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            <span className="material-symbols-rounded">close</span>
            {lang==='es'?'Cerrar':'Close'}
          </button>
        </div>
        <div className="doc-modal-body">
          <div className="doc-modal-toolbar">
            <button onClick={()=>exec('bold')}        className={active.bold ? 'active' : ''} title="Negrita (⌘B)">
              <span className="doc-tool-label">B</span>
            </button>
            <button onClick={()=>exec('italic')}      className={active.italic ? 'active' : ''} title="Cursiva (⌘I)">
              <i>I</i>
            </button>
            <button onClick={()=>exec('underline')}   className={active.underline ? 'active' : ''} title="Subrayado (⌘U)">
              <span style={{textDecoration:'underline', fontWeight: 700}}>U</span>
            </button>
            <button onClick={()=>exec('strikeThrough')} className={active.strike ? 'active' : ''} title="Tachado">
              <span style={{textDecoration:'line-through', fontWeight: 700}}>S</span>
            </button>
            <div className="doc-tool-sep"/>
            <button onClick={()=>exec('formatBlock', '<h1>')} className={active.h1 ? 'active' : ''} title="Título 1"><span style={{fontFamily:'var(--font-display)', fontWeight: 800, fontSize: 14}}>H1</span></button>
            <button onClick={()=>exec('formatBlock', '<h2>')} className={active.h2 ? 'active' : ''} title="Título 2"><span style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize: 12}}>H2</span></button>
            <button onClick={()=>exec('formatBlock', '<p>')}  className={active.p ? 'active' : ''} title="Párrafo"><span className="material-symbols-rounded">notes</span></button>
            <div className="doc-tool-sep"/>
            <button onClick={()=>exec('insertUnorderedList')} className={active.ul ? 'active' : ''} title="Lista con viñetas">
              <span className="material-symbols-rounded">format_list_bulleted</span>
            </button>
            <button onClick={()=>exec('insertOrderedList')} className={active.ol ? 'active' : ''} title="Lista numerada">
              <span className="material-symbols-rounded">format_list_numbered</span>
            </button>
            <button onClick={toggleQuote} className={active.quote ? 'active' : ''} title="Cita">
              <span className="material-symbols-rounded">format_quote</span>
            </button>
            <div className="doc-tool-sep"/>
            <button onClick={()=>exec('justifyLeft')}   className={!active.alignC && !active.alignR && !active.alignJ ? 'active' : ''} title="Alinear izquierda">
              <span className="material-symbols-rounded">format_align_left</span>
            </button>
            <button onClick={()=>exec('justifyCenter')} className={active.alignC ? 'active' : ''} title="Centrar">
              <span className="material-symbols-rounded">format_align_center</span>
            </button>
            <button onClick={()=>exec('justifyRight')}  className={active.alignR ? 'active' : ''} title="Alinear derecha">
              <span className="material-symbols-rounded">format_align_right</span>
            </button>
            <button onClick={()=>exec('justifyFull')}   className={active.alignJ ? 'active' : ''} title="Justificar">
              <span className="material-symbols-rounded">format_align_justify</span>
            </button>
            <div className="doc-tool-sep"/>
            <button
              onMouseDown={(e)=>e.preventDefault()}
              onClick={openLinkMenu}
              disabled={!active.hasSel}
              className={linkMenu ? 'active' : ''}
              title={active.hasSel ? (lang==='es'?'Enlace':'Link') : (lang==='es'?'Selecciona texto primero':'Select text first')}
            >
              <span className="material-symbols-rounded">link</span>
            </button>
          </div>
          <div className="doc-modal-editor-pane" onClick={(e) => { if (e.target === e.currentTarget) bodyRef.current?.focus(); }}>
            <div
              ref={bodyRef}
              className="doc-modal-content"
              contentEditable
              suppressContentEditableWarning
              spellCheck={true}
              onInput={commitBody}
              onKeyUp={refreshActive}
              onMouseUp={refreshActive}
              onKeyDown={onBodyKey}
              onPaste={onBodyPaste}
              onClick={onBodyClick}
            />
          </div>
        </div>
      </div>

      {/* Floating link editor — appears right next to the selected text */}
      {linkMenu && ReactDOM.createPortal(
        <>
          <div className="doc-link-overlay" onMouseDown={(e)=>{ e.preventDefault(); setLinkMenu(null); }}/>
          <div
            className="doc-link-pop"
            style={{ position:'fixed', top: linkMenu.top, left: linkMenu.left }}
            onMouseDown={(e)=>e.stopPropagation()}
          >
            <span className="material-symbols-rounded" style={{fontSize:18, color:'var(--olive)'}}>link</span>
            <input
              ref={linkInputRef}
              className="doc-link-input"
              placeholder={lang==='es'?'Pega o escribe el enlace…':'Paste or type the link…'}
              value={linkMenu.value}
              onChange={(e)=>setLinkMenu(m => ({ ...m, value: e.target.value }))}
              onKeyDown={(e)=>{
                if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
                if (e.key === 'Escape') { e.preventDefault(); setLinkMenu(null); bodyRef.current?.focus(); }
              }}
            />
            {linkMenu.value && (
              <button className="doc-link-rm" title={lang==='es'?'Quitar enlace':'Remove link'} onClick={removeLink}>
                <span className="material-symbols-rounded" style={{fontSize:17}}>link_off</span>
              </button>
            )}
            <button className="doc-link-ok" onClick={applyLink}>{lang==='es'?'Aplicar':'Apply'}</button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

window.DocModal = DocModal;
