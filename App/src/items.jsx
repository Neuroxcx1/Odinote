// =====================================================
// Odinote — item renderers v4
// • Light mode = white-dominant
// • Columns: drop targets (items physically move IN); no internal picker
// • Board: vibrant category color + double-click rename in foot
// • Calendar: Miro-style month grid with event cards
// =====================================================

function resolveMediaSrc(src) {
  if (!src) return '';
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  if (src.startsWith('file:///') || src.includes(':/') || src.includes(':\\')) {
    const mediaMatch = src.match(/media\/[^/]+$/i);
    if (mediaMatch) {
      return `/vault-media/${mediaMatch[0]}`;
    }
  }
  if (src.startsWith('media/')) {
    return `/vault-media/${src}`;
  }
  if (src.startsWith('/vault-media/')) {
    return src;
  }
  return src;
}
window.resolveMediaSrc = resolveMediaSrc;

// Src a mostrar para un medio: en el .exe se prioriza la copia local de la bóveda
// (srcLocal) para que todo cargue sin internet; en la web se usa el src remoto.
function displayMediaSrc(item) {
  if (window.electronAPI && item.srcLocal) return resolveMediaSrc(item.srcLocal);
  return resolveMediaSrc(item.src);
}
window.displayMediaSrc = displayMediaSrc;

// Cadena de respaldo si una imagen no carga:
// 1) la copia local de la bóveda falló → probar la URL remota original
// 2) la URL lh3 de Drive falló (permiso propagándose) → probar el endpoint de miniaturas
function driveImageFallback(e) {
  const img = e.currentTarget || e.target;
  if (!img) return;
  const remote = img.dataset.remoteSrc;
  if (remote && !img.dataset.odiTriedRemote && img.src !== remote && !img.src.startsWith('https://lh3.') && !img.src.startsWith('https://drive.google.com/thumbnail')) {
    img.dataset.odiTriedRemote = '1';
    img.src = remote;
    return;
  }
  if (img.dataset.odiFallback) return;
  const m = (img.src || '').match(/^https:\/\/lh3\.googleusercontent\.com\/d\/([\w-]+)/);
  if (m) {
    img.dataset.odiFallback = '1';
    img.src = `https://drive.google.com/thumbnail?id=${m[1]}&sz=w2000`;
  }
}
window.driveImageFallback = driveImageFallback;

// Safety net: if a single node throws during render, show a small fallback for THAT node
// instead of blanking the whole app.
class NodeErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: false }; }
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e) { console.error('[Odinote] node render error:', e); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ width:'100%', height:'100%', display:'grid', placeItems:'center', background:'var(--paper)', border:'1.5px solid var(--wine)', borderRadius:2, color:'var(--wine)', fontSize:11, fontWeight:600, padding:8, textAlign:'center' }}>
          ⚠ Error al mostrar este nodo
        </div>
      );
    }
    return this.props.children;
  }
}
window.NodeErrorBoundary = NodeErrorBoundary;

const COLOR_HEX_RESOLVED = {
  white: '#FFFFFF', cream: '#FEF7E0', sage: '#E8F0DA', rose: '#FBDFDD',
  stone: '#F5F4F6', mist: '#E1DFE3', olive: '#90B968', wine: '#E6544F',
  yellow: '#F7DA84', pink: '#FBDFDD', mint: '#E8F0DA', sky: '#F5F4F6',
  lavender: '#E6544F', lav: '#E6544F', coral: '#F7DA84', lime: '#E8F0DA',
  paper: '#FFFFFF',
};
const STICKY_COLORS_NEW = ['white','cream','sage','rose','stone','mist','olive','wine'];

// categorization palette — maps to user's 5-color palette
const CATEGORY_COLORS = ['red','orange','yellow','green','teal','blue','purple','pink'];
const CATEGORY_HEX = {
  red:    '#E6544F', orange: '#E6544F', yellow: '#F7DA84', green:  '#90B968',
  teal:   '#90B968', blue:   '#595459', purple: '#595459', pink:   '#E6544F',
};

function colorClass(c) {
  const map = {
    yellow:'cream', pink:'rose', mint:'sage', sky:'stone',
    lavender:'wine', lav:'wine', coral:'cream', lime:'sage', paper:'white',
    green: 'olive', red: 'wine',
  };
  return map[c] || c || 'white';
}

function pickLang(v, lang) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v[lang] || v.es || v.en || '';
}

// ──────────────── NOTE ────────────────
// Rich text via contentEditable + execCommand (per-selection styling)
function NoteItem({ item, lang, editing, onUpdate }) {
  const cls = colorClass(item.color || 'white');
  const text = pickLang(item.content, lang);
  const bg = window.resolveStickyColor ? window.resolveStickyColor(item.color || 'white') : null;
  const isDarkBg = ['olive','wine','dark','green','red','purple'].includes(item.color);
  const textColor = isDarkBg ? 'white' : '#1A1A1A';
  const ref = React.useRef(null);

  // Ensure every <pre> has an editable <p> sibling after it (so user can click below)
  const ensureTrailingParagraph = (root) => {
    if (!root) return false;
    let changed = false;
    root.querySelectorAll('pre').forEach(pre => {
      const next = pre.nextElementSibling;
      if (!next || next.tagName !== 'P') {
        const p = document.createElement('p');
        p.appendChild(document.createElement('br'));
        pre.parentNode.insertBefore(p, pre.nextSibling);
        changed = true;
      }
    });
    return changed;
  };

  // Set HTML once when entering edit mode / item changes
  React.useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== (text || '')) {
      ref.current.innerHTML = text || '';
    }
    // Always guarantee a free <p> after every code block
    if (ensureTrailingParagraph(ref.current) && editing) {
      onUpdate({ content: { es: ref.current.innerHTML, en: ref.current.innerHTML } });
    }
    // Syntax highlight code blocks (only when NOT editing, to avoid cursor jumps)
    if (!editing && window.hljs) {
      ref.current.querySelectorAll('pre code').forEach(el => {
        if (!el.textContent.trim()) return; // skip empty code blocks to prevent highlight.js warning
        try {
          if (!el.dataset.highlighted) {
            el.textContent = el.textContent; // Strip existing HTML spans to prevent warnings
            window.hljs.highlightElement(el);
          }
        } catch {}
      });
    }
  // eslint-disable-next-line
  }, [editing, item.id, text]);

  // Re-highlight on blur (when user finishes editing a code block)
  const reHighlight = () => {
    if (!ref.current || !window.hljs) return;
    ref.current.querySelectorAll('pre code').forEach(el => {
      if (!el.textContent.trim()) return;
      try {
        delete el.dataset.highlighted;
        el.className = el.className.replace(/\bhljs\b[^\s]*/g, '').trim();
        el.textContent = el.textContent; // Strip existing HTML spans to prevent warnings
        window.hljs.highlightElement(el);
      } catch {}
    });
  };

  const onInput = () => {
    if (!ref.current) return;
    // Always keep a free paragraph after any <pre> so the user can click below
    ensureTrailingParagraph(ref.current);
    onUpdate({ content: { es: ref.current.innerHTML, en: ref.current.innerHTML } });
  };

  // Live highlight code blocks while preserving caret
  const liveHighlight = () => {
    if (!ref.current || !window.hljs) return;
    const sel = window.getSelection();
    let caretOffset = null;
    let activeCode = null;
    if (sel && sel.rangeCount) {
      let node = sel.anchorNode;
      while (node && node !== ref.current && !(node.tagName === 'CODE' && node.parentNode?.tagName === 'PRE')) {
        node = node.parentNode;
      }
      if (node && node.tagName === 'CODE') {
        activeCode = node;
        // compute caret offset as plain text position
        const range = sel.getRangeAt(0);
        const pre = range.cloneRange();
        pre.selectNodeContents(node);
        pre.setEnd(range.endContainer, range.endOffset);
        caretOffset = pre.toString().length;
      }
    }
    ref.current.querySelectorAll('pre code').forEach(el => {
      if (!el.textContent.trim()) return;
      try {
        delete el.dataset.highlighted;
        el.className = el.className.replace(/\bhljs\b[^\s]*|\blanguage-[^\s]+/g, '').trim();
        el.textContent = el.textContent; // Strip existing HTML spans to prevent warnings
        window.hljs.highlightElement(el);
      } catch {}
    });
    if (activeCode && caretOffset != null) {
      // restore caret by walking text nodes
      const walker = document.createTreeWalker(activeCode, NodeFilter.SHOW_TEXT);
      let total = 0, target = null, targetOffset = 0;
      let n;
      while ((n = walker.nextNode())) {
        const len = n.nodeValue.length;
        if (total + len >= caretOffset) {
          target = n; targetOffset = caretOffset - total; break;
        }
        total += len;
      }
      if (target) {
        const range = document.createRange();
        range.setStart(target, Math.min(targetOffset, target.nodeValue.length));
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };

  // Throttle highlighting to avoid breaking typing flow
  const highlightTimer = React.useRef(null);
  const scheduleHighlight = () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(liveHighlight, 350);
  };

  React.useEffect(() => {
    if (!ref.current) return;
    const contentEl = ref.current;
    const origHeight = contentEl.style.height;
    contentEl.style.height = 'auto';
    const naturalHeight = contentEl.scrollHeight;
    contentEl.style.height = origHeight;
    const totalHeight = Math.max(80, Math.round(naturalHeight + 3));
    if (Math.abs((item.h || 0) - totalHeight) > 3) {
      onUpdate({ h: totalHeight });
    }
  // eslint-disable-next-line
  }, [item.content, editing, item.h, lang]);

  if (editing) {
    return (
      <div className={`note c-${cls}`} style={{width:'100%', height:'100%'}}>
        <div className="item-card" style={{ background: bg }}>
          <div
            ref={ref}
            className="note-edit rich"
            contentEditable
            suppressContentEditableWarning
            spellCheck={true}
            data-placeholder={window.t('Escribe tu nota…', 'Write your note…')}
            onInput={(e) => { onInput(); scheduleHighlight(); }}
            onBlur={reHighlight}
            onClick={(e)=>e.stopPropagation()}
            onMouseDown={(e)=>e.stopPropagation()}
            onKeyDown={(e)=>{
              if (e.key === 'Tab') {
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                  let node = sel.anchorNode;
                  while (node && node !== ref.current && node.tagName !== 'PRE') {
                    node = node.parentNode;
                  }
                  if (node && node.tagName === 'PRE') {
                    e.preventDefault();
                    const range = sel.getRangeAt(0);
                    
                    if (!range.collapsed) {
                      // Selection exists: indent or unindent all selected lines
                      const selectedText = range.toString();
                      let processedText = '';
                      if (e.shiftKey) {
                        // Shift+Tab: remove up to 4 spaces from start of each line
                        processedText = selectedText.split('\n').map(line => line.replace(/^ {1,4}/, '')).join('\n');
                      } else {
                        // Tab: add 4 spaces to start of each line
                        processedText = selectedText.split('\n').map(line => '    ' + line).join('\n');
                      }
                      range.deleteContents();
                      const textNode = document.createTextNode(processedText);
                      range.insertNode(textNode);
                      
                      // Select the new text
                      const newRange = document.createRange();
                      newRange.selectNodeContents(textNode);
                      sel.removeAllRanges();
                      sel.addRange(newRange);
                    } else {
                      // No selection (collapsed cursor)
                      if (e.shiftKey) {
                        // Shift+Tab: unindent (remove up to 4 spaces before or after the cursor)
                        const startNode = range.startContainer;
                        const startOffset = range.startOffset;
                        if (startNode.nodeType === Node.TEXT_NODE) {
                          const textBefore = startNode.textContent.substring(0, startOffset);
                          const matchBefore = textBefore.match(/ {1,4}$/);
                          if (matchBefore) {
                            const numSpaces = matchBefore[0].length;
                            const newRange = document.createRange();
                            newRange.setStart(startNode, startOffset - numSpaces);
                            newRange.setEnd(startNode, startOffset);
                            sel.removeAllRanges();
                            sel.addRange(newRange);
                            newRange.deleteContents();
                          } else {
                            const textAfter = startNode.textContent.substring(startOffset);
                            const matchAfter = textAfter.match(/^ {1,4}/);
                            if (matchAfter) {
                              const numSpaces = matchAfter[0].length;
                              const newRange = document.createRange();
                              newRange.setStart(startNode, startOffset);
                              newRange.setEnd(startNode, startOffset + numSpaces);
                              sel.removeAllRanges();
                              sel.addRange(newRange);
                              newRange.deleteContents();
                            }
                          }
                        }
                      } else {
                        // Tab: insert 4 spaces at cursor
                        const spaces = '    ';
                        range.deleteContents();
                        const textNode = document.createTextNode(spaces);
                        range.insertNode(textNode);
                        
                        const r2 = document.createRange();
                        r2.setStartAfter(textNode);
                        r2.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(r2);
                      }
                    }
                    ref.current.dispatchEvent(new Event('input', { bubbles: true }));
                    onInput();
                    scheduleHighlight();
                    return;
                  }
                }
              }
              if (e.key === 'Escape') { e.target.blur(); return; }

              // Exit blockquote/heading/pre on backspace when empty
              if (e.key === 'Backspace') {
                const sel = window.getSelection();
                if (sel && sel.isCollapsed && sel.anchorOffset === 0) {
                  let node = sel.anchorNode;
                  let liNode = sel.anchorNode;
                  while (liNode && liNode !== ref.current && liNode.tagName !== 'LI') {
                    liNode = liNode.parentNode;
                  }
                  if (liNode && liNode.tagName === 'LI') {
                    e.preventDefault();
                    const list = liNode.parentNode;
                    const p = document.createElement('p');
                    p.innerHTML = liNode.innerHTML || '<br>';
                    if (list.children.length === 1) {
                      list.parentNode.replaceChild(p, list);
                    } else {
                      list.parentNode.insertBefore(p, list.nextSibling);
                      liNode.remove();
                    }
                    const range = document.createRange();
                    range.selectNodeContents(p);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    ref.current.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                  }
                  while (node && node !== ref.current && !['BLOCKQUOTE','H1','H2','PRE'].includes(node.tagName)) {
                    node = node.parentNode;
                  }
                  if (node && node !== ref.current) {
                    // If the block has no content, remove the whole block
                    if (!node.textContent.trim()) {
                      e.preventDefault();
                      const p = document.createElement('p');
                      p.appendChild(document.createElement('br'));
                      node.parentNode.replaceChild(p, node);
                      const range = document.createRange();
                      range.setStart(p, 0);
                      range.collapse(true);
                      sel.removeAllRanges();
                      sel.addRange(range);
                      ref.current.dispatchEvent(new Event('input', { bubbles: true }));
                    } else if (node.tagName !== 'PRE') {
                      e.preventDefault();
                      document.execCommand('formatBlock', false, 'P');
                      ref.current.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }
                }
              }
              // Enter inside PRE: always insert a newline of code (intuitive).
              // To exit the block, click the free paragraph below or press ArrowDown.
              if (e.key === 'Enter') {
                const sel = window.getSelection();
                if (sel && sel.isCollapsed) {
                  let node = sel.anchorNode;
                  while (node && node !== ref.current && node.tagName !== 'PRE') {
                    node = node.parentNode;
                  }
                  if (node && node.tagName === 'PRE') {
                    e.preventDefault();
                    const range = sel.getRangeAt(0);
                    range.deleteContents();
                    // Detect if caret is at the end of the code block. If so we need
                    // to insert TWO newlines (and place caret between them) because
                    // a trailing single \n is invisible in pre/contenteditable.
                    const probe = document.createRange();
                    probe.selectNodeContents(node);
                    probe.setStart(range.endContainer, range.endOffset);
                    const atEnd = probe.toString().replace(/\s+$/, '') === '';
                    const nl = document.createTextNode('\n');
                    range.insertNode(nl);
                    if (atEnd) {
                      const trail = document.createTextNode('\n');
                      nl.parentNode.insertBefore(trail, nl.nextSibling);
                    }
                    const r2 = document.createRange();
                    r2.setStartAfter(nl);
                    r2.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(r2);
                    ref.current.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                  }
                  // Enter on empty blockquote/heading line exits it
                  if (!e.shiftKey) {
                    let bnode = sel.anchorNode;
                    while (bnode && bnode !== ref.current && !['BLOCKQUOTE','H1','H2'].includes(bnode.tagName)) {
                      bnode = bnode.parentNode;
                    }
                    if (bnode && bnode !== ref.current && (bnode.textContent || '').trim() === '') {
                      e.preventDefault();
                      document.execCommand('formatBlock', false, 'P');
                      ref.current.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }
                }
              }
              // Arrow Down at end of pre → exit
              if (e.key === 'ArrowDown') {
                const sel = window.getSelection();
                if (sel && sel.isCollapsed) {
                  let node = sel.anchorNode;
                  while (node && node !== ref.current && node.tagName !== 'PRE') {
                    node = node.parentNode;
                  }
                  if (node && node.tagName === 'PRE' && !node.nextSibling) {
                    e.preventDefault();
                    const p = document.createElement('p');
                    p.appendChild(document.createElement('br'));
                    node.parentNode.appendChild(p);
                    const range = document.createRange();
                    range.setStart(p, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    ref.current.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                }
              }
            }}
            style={{ color: textColor }}
          />
        </div>
      </div>
    );
  }

  // Read-only render — HTML content with syntax highlight
  return (
    <div className={`note c-${cls}`} style={{width:'100%', height:'100%'}}>
      <div className="item-card" style={{ background: bg }}>
        <div
          ref={ref}
          className="note-inner rich"
          style={{ color: textColor }}
        />
      </div>
    </div>
  );
}

// ──────────────── CAPTION ("leyenda" — shared rich text) ────────────────
// A small contentEditable used by image/link/board/comment/calendar/audio nodes.
// Stores HTML in item.caption[lang] and reports focus/blur so the reduced
// caption format sidebar (Color/H1/B/I/S/U) can show next to it.
function NodeCaption({ item, lang, onUpdate, className, placeholder, style, autoGrow }) {
  const ref = React.useRef(null);
  const focusedRef = React.useRef(false);
  const html = (item.caption && item.caption[lang]) || '';

  // Keep current height / latest onUpdate in refs so the ResizeObserver isn't stale
  const itemHRef = React.useRef(item.h); itemHRef.current = item.h;
  const onUpdateRef = React.useRef(onUpdate); onUpdateRef.current = onUpdate;

  React.useEffect(() => {
    if (!ref.current) return;
    if (!focusedRef.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
    }
  }, [html, lang]);

  // Grow / shrink the NODE so the caption expands downward instead of being squashed.
  React.useEffect(() => {
    if (!autoGrow || !ref.current || typeof ResizeObserver === 'undefined') return;
    const el = ref.current;
    let last = null;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (last == null) { last = h; return; }      // ignore the initial measurement
      const delta = h - last;
      if (Math.abs(delta) >= 1) {
        last = h;
        onUpdateRef.current({ h: Math.max(40, Math.round((itemHRef.current || 0) + delta)) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoGrow]);

  const commit = () => {
    if (!ref.current) return;
    onUpdate({ caption: { es: ref.current.innerHTML, en: ref.current.innerHTML } });
  };

  return (
    <div
      ref={ref}
      className={`node-caption rich-caption${className ? ' ' + className : ''}`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      spellCheck={true}
      data-placeholder={placeholder || (window.t('Añade una leyenda…', 'Add a caption…'))}
      onInput={commit}
      onClick={(e)=>e.stopPropagation()}
      onMouseDown={(e)=>e.stopPropagation()}
      onDoubleClick={(e)=>e.stopPropagation()}
      onFocus={()=>{ focusedRef.current = true; if (window.__odiCaptionFocus) window.__odiCaptionFocus(item.id); }}
      onBlur={()=>{ focusedRef.current = false; commit(); if (window.__odiCaptionBlur) window.__odiCaptionBlur(item.id); }}
      onKeyDown={(e)=>{ if (e.key === 'Escape') { e.preventDefault(); e.target.blur(); } }}
    />
  );
}

// ──────────────── IMAGE ────────────────
function ImageItem({ item, lang, onUpdate, callbacks }) {
  const cb = callbacks || {};
  const fileRef = React.useRef(null);
  const hasImage = !!item.src;
  const bg = window.resolveStickyColor ? window.resolveStickyColor(item.color || 'white') : null;
  const [naturalRatio, setNaturalRatio] = React.useState(null);
  const onUpdateRef = React.useRef(onUpdate);
  React.useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  const itemWRef = React.useRef(item.w);
  React.useEffect(() => { itemWRef.current = item.w; }, [item.w]);

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return false;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        setNaturalRatio(ratio);
        const w = itemWRef.current || 260;
        onUpdateRef.current({ src, w, h: Math.max(60, Math.round(w / ratio)), naturalRatio: ratio });
      };
      img.onerror = () => onUpdateRef.current({ src });
      img.src = src;
    };
    reader.readAsDataURL(file);
    return true;
  };

  const onPick = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    loadFile(f);
    e.target.value = '';
  };

  React.useEffect(() => {
    if (item._triggerImagePick) {
      fileRef.current?.click();
      onUpdate({ _triggerImagePick: false });
    }
  }, [item._triggerImagePick]);

  const crop = item.crop || { x: 0, y: 0, w: 100, h: 100 };
  const isCropping = cb.croppingId === item.id;

  const startCropDrag = (e, handle) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    
    const imgFrame = e.currentTarget.parentElement;
    if (!imgFrame) return;
    const rect = imgFrame.getBoundingClientRect();

    const initialCrop = { ...crop };

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const dpX = (dx / rect.width) * 100;
      const dpY = (dy / rect.height) * 100;

      let newX = initialCrop.x;
      let newY = initialCrop.y;
      let newW = initialCrop.w;
      let newH = initialCrop.h;

      if (handle === 'tl') {
        newX = Math.max(0, Math.min(initialCrop.x + initialCrop.w - 10, initialCrop.x + dpX));
        newW = initialCrop.x + initialCrop.w - newX;
        newY = Math.max(0, Math.min(initialCrop.y + initialCrop.h - 10, initialCrop.y + dpY));
        newH = initialCrop.y + initialCrop.h - newY;
      } else if (handle === 'tr') {
        newW = Math.max(10, Math.min(100 - initialCrop.x, initialCrop.w + dpX));
        newY = Math.max(0, Math.min(initialCrop.y + initialCrop.h - 10, initialCrop.y + dpY));
        newH = initialCrop.y + initialCrop.h - newY;
      } else if (handle === 'bl') {
        newX = Math.max(0, Math.min(initialCrop.x + initialCrop.w - 10, initialCrop.x + dpX));
        newW = initialCrop.x + initialCrop.w - newX;
        newH = Math.max(10, Math.min(100 - initialCrop.y, initialCrop.h + dpY));
      } else if (handle === 'br') {
        newW = Math.max(10, Math.min(100 - initialCrop.x, initialCrop.w + dpX));
        newH = Math.max(10, Math.min(100 - initialCrop.y, initialCrop.h + dpY));
      } else if (handle === 'move') {
        // Arrastrar el área completa de recorte sin cambiar su tamaño
        newX = Math.max(0, Math.min(100 - initialCrop.w, initialCrop.x + dpX));
        newY = Math.max(0, Math.min(100 - initialCrop.h, initialCrop.y + dpY));
      }

      onUpdate({
        crop: {
          x: parseFloat(newX.toFixed(2)),
          y: parseFloat(newY.toFixed(2)),
          w: parseFloat(newW.toFixed(2)),
          h: parseFloat(newH.toFixed(2))
        }
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  
  let frameW = '100%';
  let frameH = '100%';
  let frameLeft = '0px';
  let frameTop = '0px';

  if (!isCropping && naturalRatio && item.w && item.h) {
    const cropAspect = naturalRatio * (crop.w / crop.h);
    const cardAspect = item.w / item.h;
    if (cropAspect > cardAspect) {
      const pct = (cardAspect / cropAspect) * 100;
      frameW = '100%';
      frameH = `${pct}%`;
      frameTop = `${(100 - pct) / 2}%`;
    } else {
      const pct = (cropAspect / cardAspect) * 100;
      frameW = `${pct}%`;
      frameH = '100%';
      frameLeft = `${(100 - pct) / 2}%`;
    }
  }

  return (
    <div className={`image-card${hasImage ? '' : ' empty'}`} style={{width:'100%', height:'100%'}}>
      <div className="item-card" style={{ backgroundColor: hasImage ? 'transparent' : bg }}>
        {hasImage ? (
          <div
            className="image-frame"
            style={{ width: frameW, height: frameH, overflow: 'hidden', position: 'absolute', left: frameLeft, top: frameTop }}
            onDoubleClick={(e)=>{ e.stopPropagation(); if (!isCropping) fileRef.current?.click(); }}
          >
            <img
              src={displayMediaSrc(item)}
              data-remote-src={/^https?:\/\//.test(item.src || '') ? item.src : undefined}
              draggable={false}
              onError={driveImageFallback}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  const ratio = img.naturalWidth / img.naturalHeight;
                  setNaturalRatio(ratio);
                  if (item.naturalRatio !== ratio) {
                    onUpdate({ naturalRatio: ratio });
                  }
                }
              }}
              style={{
                position: 'absolute',
                width: isCropping ? '100%' : `${(100 / crop.w) * 100}%`,
                height: isCropping ? '100%' : `${(100 / crop.h) * 100}%`,
                left: isCropping ? 0 : `${(-crop.x / crop.w) * 100}%`,
                top: isCropping ? 0 : `${(-crop.y / crop.h) * 100}%`,
                objectFit: 'fill',
                pointerEvents: 'none',
                transform: `${item.flipH ? 'scaleX(-1) ' : ''}${item.flipV ? 'scaleY(-1)' : ''}`.trim() || undefined
              }}
            />
            {isCropping && (
              <>
                {/* Capas de mascara blanca semitransparente */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${crop.y}%`, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: `${crop.y + crop.h}%`, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: `${crop.y}%`, left: 0, width: `${crop.x}%`, height: `${crop.h}%`, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: `${crop.y}%`, left: `${crop.x + crop.w}%`, right: 0, height: `${crop.h}%`, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />

                {/* Rectángulo punteado del área visible — arrastrable para mover
                    el recorte completo sin cambiar su tamaño */}
                <div
                  onMouseDown={(e) => startCropDrag(e, 'move')}
                  title={window.t('Arrastra para mover el recorte', 'Drag to move the crop area')}
                  style={{
                    position: 'absolute',
                    left: `${crop.x}%`,
                    top: `${crop.y}%`,
                    width: `${crop.w}%`,
                    height: `${crop.h}%`,
                    border: '1.5px dashed var(--olive, #6A8546)',
                    boxSizing: 'border-box',
                    cursor: 'move',
                    pointerEvents: 'auto',
                    zIndex: 14
                  }}
                />

                {/* Tiradores de recorte interactivos */}
                <div 
                  className="crop-handle tl" 
                  onMouseDown={(e) => startCropDrag(e, 'tl')}
                  style={{
                    position: 'absolute',
                    left: `calc(${crop.x}% - 6px)`,
                    top: `calc(${crop.y}% - 6px)`,
                    width: '12px',
                    height: '12px',
                    background: '#FFFFFF',
                    border: '2px solid var(--olive, #6A8546)',
                    borderRadius: '2px',
                    cursor: 'nwse-resize',
                    zIndex: 15
                  }}
                />
                <div 
                  className="crop-handle tr" 
                  onMouseDown={(e) => startCropDrag(e, 'tr')}
                  style={{
                    position: 'absolute',
                    left: `calc(${crop.x + crop.w}% - 6px)`,
                    top: `calc(${crop.y}% - 6px)`,
                    width: '12px',
                    height: '12px',
                    background: '#FFFFFF',
                    border: '2px solid var(--olive, #6A8546)',
                    borderRadius: '2px',
                    cursor: 'nesw-resize',
                    zIndex: 15
                  }}
                />
                <div 
                  className="crop-handle bl" 
                  onMouseDown={(e) => startCropDrag(e, 'bl')}
                  style={{
                    position: 'absolute',
                    left: `calc(${crop.x}% - 6px)`,
                    top: `calc(${crop.y + crop.h}% - 6px)`,
                    width: '12px',
                    height: '12px',
                    background: '#FFFFFF',
                    border: '2px solid var(--olive, #6A8546)',
                    borderRadius: '2px',
                    cursor: 'nesw-resize',
                    zIndex: 15
                  }}
                />
                <div 
                  className="crop-handle br" 
                  onMouseDown={(e) => startCropDrag(e, 'br')}
                  style={{
                    position: 'absolute',
                    left: `calc(${crop.x + crop.w}% - 6px)`,
                    top: `calc(${crop.y + crop.h}% - 6px)`,
                    width: '12px',
                    height: '12px',
                    background: '#FFFFFF',
                    border: '2px solid var(--olive, #6A8546)',
                    borderRadius: '2px',
                    cursor: 'nwse-resize',
                    zIndex: 15
                  }}
                />

              </>
            )}
            {item.showCaption && <NodeCaption item={item} lang={lang} onUpdate={onUpdate} className="image-caption"/>}
            {!isCropping && (
              <button
                className="image-change-btn"
                onClick={(e)=>{ e.stopPropagation(); fileRef.current?.click(); }}
                onMouseDown={(e)=>e.stopPropagation()}
                title={window.t('Cambiar imagen', 'Change image')}
              >
                <span className="material-symbols-rounded">swap_horiz</span>
              </button>
            )}
          </div>
        ) : item.bg ? (
          <div
            className="image-frame image-mood"
            style={{ background: item.bg }}
            onDoubleClick={(e)=>{ e.stopPropagation(); fileRef.current?.click(); }}
          >
            {item.content && <div className="image-mood-caption">{pickLang(item.content, lang)}</div>}
          </div>
        ) : (
          <div
            className="image-empty"
            onClick={(e)=>{ e.stopPropagation(); fileRef.current?.click(); }}
          >
            <span className="material-symbols-rounded">add_photo_alternate</span>
            <span style={{fontSize:11, fontWeight: 600, textAlign:'center', lineHeight:1.3}}>
              {window.t('Clic · pegar · soltar imagen', 'Click · paste · drop image')}
            </span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={onPick}/>
      </div>
    </div>
  );
}

// ──────────────── LINK ────────────────
function parseLink(url) {
  if (!url) return null;
  let u = url.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.replace(/^www\./, '');
    let yt = null;
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') yt = parsed.searchParams.get('v');
    else if (host === 'youtu.be') yt = parsed.pathname.slice(1);
    if (yt) return { kind: 'youtube', host: 'youtube.com', url: u, thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, title: 'YouTube · ' + yt, favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=32' };
    if (host === 'vimeo.com')           return { kind: 'vimeo',   host, url: u, title: 'Vimeo',   favicon: 'https://www.google.com/s2/favicons?domain=vimeo.com&sz=32' };
    if (host === 'open.spotify.com' || host === 'spotify.com')
                                        return { kind: 'spotify', host, url: u, title: 'Spotify', favicon: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=32' };
    return {
      kind: 'generic', host, url: u,
      title: parsed.pathname === '/' ? host : (parsed.pathname.split('/').filter(Boolean).pop() || host),
      favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=32`,
    };
  } catch { return null; }
}

// link-preview metadata cache (sessions)
const LINK_META_CACHE = {};
async function fetchLinkMeta(url) {
  if (LINK_META_CACHE[url]) return LINK_META_CACHE[url];
  try {
    // Abort if the preview API takes too long so the UI doesn't feel stuck
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('http ' + res.status);
    const json = await res.json();
    if (json.status !== 'success') return null;
    const d = json.data || {};
    const meta = {
      title: d.title || '',
      description: d.description || '',
      image: d.image?.url || null,
      logo: d.logo?.url || null,
      publisher: d.publisher || '',
    };
    LINK_META_CACHE[url] = meta;
    // Preload the image so it appears instantly once metadata arrives
    if (meta.image) { const im = new Image(); im.src = meta.image; }
    return meta;
  } catch (e) {
    return null;
  }
}

// Extract YouTube video id from a URL (supports youtube.com, music.youtube.com, youtu.be)
function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com')) return u.searchParams.get('v');
  } catch { }
  return null;
}

function LinkItem({ item, lang, onUpdate, editing, onEndEdit }) {
  const hasUrl = !!item.url;
  const meta = hasUrl ? parseLink(item.url) : null;
  const [fetched, setFetched] = React.useState(null);
  const [playing, setPlaying] = React.useState(false);
  const bg = window.resolveStickyColor ? window.resolveStickyColor(item.color || 'white') : null;
  const isDarkBg = ['olive','wine','dark','green','red','purple'].includes(item.color);
  const showPreview = item.showPreview !== false;
  const showInfo = item.showInfo !== false;
  const showCaption = item.showCaption === true;
  const caption = (item.caption && item.caption[lang]) || '';
  const ytId = hasUrl ? extractYouTubeId(item.url) : null;
  const [loadingMeta, setLoadingMeta] = React.useState(false);
  const onUpdateRef = React.useRef(onUpdate);
  React.useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  React.useEffect(() => {
    if (!hasUrl) { setFetched(null); setLoadingMeta(false); return; }
    if (meta?.thumb) { setFetched(null); setLoadingMeta(false); return; }
    let cancelled = false;
    setLoadingMeta(true);
    fetchLinkMeta(item.url).then(m => { if (!cancelled) { setFetched(m); setLoadingMeta(false); } });
    return () => { cancelled = true; };
  }, [item.url, hasUrl]);

  // Reset playback when URL changes
  React.useEffect(() => { setPlaying(false); }, [item.url]);

  if (!hasUrl || editing) {
    return (
      <div className="link-card empty" style={{width:'100%', height:'100%'}}>
        <div className="item-card" style={{ background: bg, color: isDarkBg ? 'white' : 'inherit' }}>
          <div className="link-edit-row">
            <span className="material-symbols-rounded link-prefix" style={{fontSize: 18, color:'var(--ink-3)'}}>link</span>
            <input
              className="link-input"
              autoFocus
              placeholder={window.t('Pega un enlace…', 'Paste a link…')}
              value={item.url || ''}
              onClick={(e)=>e.stopPropagation()}
              onMouseDown={(e)=>e.stopPropagation()}
              onChange={(e)=>onUpdate({ url: e.target.value })}
              onBlur={(e)=>{
                // Apply the link and exit edit mode automatically — no Enter required
                const v = e.target.value.trim();
                const grow = v
                  ? (!item._grewForUrl ? { h: Math.max(item.h || 0, 290), _grewForUrl: true } : {})
                  : { h: 74, _grewForUrl: false };
                onUpdate({ url: v, _editing: false, ...grow });
                onEndEdit && onEndEdit();
              }}
              onKeyDown={(e)=>{
                if (e.key === 'Enter' || e.key === 'Escape') e.target.blur();
              }}
            />
          </div>
          <div className="link-edit-hint">
            {window.t('Enter para guardar · Esc para salir', 'Enter to save · Esc to exit')}
          </div>
        </div>
      </div>
    );
  }

  const thumb = showPreview ? (meta?.thumb || fetched?.image) : null;
  const titleVal = item.title != null ? item.title : (fetched?.title || meta?.title || '');
  const titlePlaceholder = window.t('Título del enlace…', 'Link title…');
  const desc = fetched?.description;
  const openLink = () => item.url && window.open(item.url, '_blank', 'noopener,noreferrer');

  return (
    <div className="link-card" style={{width:'100%', height:'100%'}}>
      <div className="item-card" style={{ background: bg, color: isDarkBg ? 'white' : 'inherit' }}>
        {showPreview && (
        <div
          className="link-thumb"
          style={ thumb && !playing ? { backgroundImage: `url(${thumb})` } : null }
          onClick={(e)=>{ if (!ytId) { e.stopPropagation(); openLink(); } }}
          title={!ytId ? (window.t('Abrir enlace', 'Open link')) : null}
        >
          {ytId && playing ? (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
              title="YouTube video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position:'absolute', inset: 0, width:'100%', height:'100%', border: 0 }}
              onMouseDown={(e)=>e.stopPropagation()}
            />
          ) : (
            <>
              {ytId && (
                <button
                  className="link-play-btn"
                  onClick={(e)=>{ e.stopPropagation(); setPlaying(true); }}
                  onMouseDown={(e)=>e.stopPropagation()}
                  title={window.t('Reproducir', 'Play')}
                >
                  <span className="material-symbols-rounded">play_arrow</span>
                </button>
              )}
              {!ytId && !thumb && (
                <div className="link-thumb-placeholder">
                  {meta?.favicon ? (
                    <img src={meta.favicon} alt="" className="link-thumb-favicon" onError={(e)=>e.target.style.display='none'}/>
                  ) : (
                    <span className="material-symbols-rounded">
                      {meta?.kind === 'spotify' ? 'music_note' : meta?.kind === 'vimeo' ? 'play_circle' : 'language'}
                    </span>
                  )}
                  {loadingMeta && <div className="link-thumb-spinner"/>}
                </div>
              )}
            </>
          )}
        </div>
        )}
        {showInfo && (
        <div className="link-body">
          <div className="link-host">
            {meta?.favicon && <img src={meta.favicon} alt="" onError={(e)=>e.target.style.display='none'}/>}
            <span>{meta?.host || item.url}</span>
            <button
              className="link-open-btn"
              onClick={(e)=>{ e.stopPropagation(); openLink(); }}
              onMouseDown={(e)=>e.stopPropagation()}
              title={window.t('Abrir enlace', 'Open link')}
            >
              <span className="material-symbols-rounded">open_in_new</span>
            </button>
          </div>
          {item.showTitle !== false && (
            <textarea
              className="link-title-input"
              value={titleVal}
              placeholder={titlePlaceholder}
              onChange={(e)=>{
                onUpdate({ title: e.target.value });
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = el.scrollHeight + 'px';
                }
              }}
              onClick={(e)=>e.stopPropagation()}
              onMouseDown={(e)=>e.stopPropagation()}
              onDoubleClick={(e)=>e.stopPropagation()}
              onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
              rows={1}
              style={{
                resize: 'none',
                overflowY: 'hidden',
                height: 'auto',
                display: 'block',
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                fontWeight: '700',
                color: 'inherit',
                padding: 0
              }}
            />
          )}
          {showCaption && (
            <NodeCaption item={item} lang={lang} onUpdate={onUpdate} className="link-caption-input" autoGrow/>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

// ──────────────── TODO ────────────────
function TodoItem({ item, lang, onUpdate, editing, callbacks }) {
  const subs = item.items || [];
  const bg = window.resolveStickyColor ? window.resolveStickyColor(item.color || 'white') : null;
  const isDarkBg = ['olive','wine','dark','green','red','purple'].includes(item.color);

  const [focusedRowId, setFocusedRowId] = React.useState(() => {
    if (window._focusedTodoRow && window._focusedTodoRow.todoId === item.id) {
      return window._focusedTodoRow.rowId;
    }
    return subs[0]?.id || null;
  });

  React.useEffect(() => {
    if (window._focusedTodoRow && window._focusedTodoRow.todoId === item.id) {
      setFocusedRowId(window._focusedTodoRow.rowId);
    } else {
      setFocusedRowId(subs[0]?.id || null);
    }
  }, [item.id, subs[0]?.id]);

  const setFocusedRow = (rowId) => {
    setFocusedRowId(rowId);
    window._focusedTodoRow = {
      todoId: item.id,
      rowId: rowId,
    };
    window._notifyFocusedRowChanged?.();
  };

  const computeRowState = (idx) => {
    const row = subs[idx];
    if (!row) return { state: 'empty' };
    const myIndent = row.indent || 0;
    const children = [];
    for (let i = idx + 1; i < subs.length; i++) {
      const r = subs[i];
      const rIndent = r.indent || 0;
      if (rIndent <= myIndent) break;
      if (rIndent === myIndent + 1) children.push(r);
    }
    if (!children.length) return { state: row.done ? 'done' : 'open' };
    const doneCount = children.filter(c => c.done).length;
    if (doneCount === children.length) return { state: 'done' };
    if (doneCount > 0) return { state: 'partial' };
    return { state: 'open' };
  };

  const toggleRow = (idx) => {
    const row = subs[idx];
    const myIndent = row.indent || 0;
    const nowDone = !row.done;
    const next = subs.map(r => ({ ...r }));
    next[idx].done = nowDone;
    for (let i = idx + 1; i < next.length; i++) {
      const rIndent = next[i].indent || 0;
      if (rIndent <= myIndent) break;
      next[i].done = nowDone;
    }
    onUpdate({ items: next });
  };

  const updateRow = (idx, patch) => {
    onUpdate({ items: subs.map((r, i) => i === idx ? { ...r, ...patch } : r) });
  };
  const indentRow = (idx, delta) => {
    onUpdate({ items: subs.map((r, i) => i === idx ? { ...r, indent: Math.max(0, Math.min(2, (r.indent || 0) + delta)) } : r) });
  };
  const addRow = (afterIdx) => {
    const indent = afterIdx >= 0 ? (subs[afterIdx]?.indent || 0) : 0;
    const newRow = { id: `t-${Date.now()}-${Math.floor(Math.random()*9999)}`, text: { es: '', en: '' }, done: false, indent };
    onUpdate({ items: [...subs.slice(0, afterIdx + 1), newRow, ...subs.slice(afterIdx + 1)] });
  };
  const deleteRow = (idx) => {
    if (subs.length === 1) return;
    onUpdate({ items: subs.filter((_, i) => i !== idx) });
  };

  const cardRef = React.useRef(null);

  const moveRow = (idx, direction) => {
    const next = [...subs];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= subs.length) return;
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    onUpdate({ items: next });
  };

  React.useEffect(() => {
    if (!cardRef.current) return;
    const cardEl = cardRef.current;
    const titleEl = cardEl.querySelector('.todo-title');
    const listEl = cardEl.querySelector('.todo-list');
    if (!listEl) return;

    const overrideStyle = (el, prop, val) => {
      if (!el) return null;
      const origVal = el.style.getPropertyValue(prop);
      const origPrio = el.style.getPropertyPriority(prop);
      el.style.setProperty(prop, val, 'important');
      return () => {
        if (origVal) {
          el.style.setProperty(prop, origVal, origPrio);
        } else {
          el.style.removeProperty(prop);
        }
      };
    };

    // 1. Temporarily unconstrain height of all parent and container elements for natural layout measurement
    const itemEl = cardEl.parentElement;
    const itemCardEl = cardEl.querySelector('.item-card');
    const restores = [];

    restores.push(overrideStyle(itemEl, 'height', 'auto'));
    restores.push(overrideStyle(cardEl, 'height', 'auto'));
    restores.push(overrideStyle(itemCardEl, 'height', 'auto'));
    restores.push(overrideStyle(listEl, 'height', 'auto'));
    restores.push(overrideStyle(listEl, 'min-height', '0'));
    restores.push(overrideStyle(listEl, 'flex', 'none'));
    restores.push(overrideStyle(listEl, 'overflow-y', 'visible'));

    // 2. Adjust height of title edit if present under unconstrained height
    const titleEdits = cardEl.querySelectorAll('.todo-title-edit');
    titleEdits.forEach(el => {
      el.style.height = '0px';
      el.style.height = el.scrollHeight + 'px';
    });

    const padding = 22; // default padding in pixels (11 * 2)
    let totalHeight = padding;

    if (titleEl) {
      totalHeight += titleEl.offsetHeight + 8; // title + margin-bottom
    }

    const children = Array.from(listEl.children);
    let listHeight = 0;
    children.forEach((child) => {
      let chH = 0;
      if (child.classList.contains('todo-row')) {
        const inputEl = child.querySelector('.todo-input');
        if (inputEl) {
          inputEl.style.height = '0px';
          const sh = inputEl.scrollHeight;
          inputEl.style.height = sh + 'px';

          const metaEl = child.querySelector('.todo-row-meta');
          const controlsEl = child.querySelector('.todo-row-controls');
          const metaH = metaEl ? metaEl.offsetHeight : 0;
          const controlsH = controlsEl ? controlsEl.offsetHeight : 0;

          // textarea scrollHeight + meta height + controls height + padding
          chH = sh + metaH + controlsH + (metaEl || controlsEl ? 4 : 0) + 8;
        } else {
          chH = child.offsetHeight;
        }
      } else {
        chH = child.offsetHeight;
      }
      listHeight += chH + 3; // gap is 3px
    });
    totalHeight += listHeight;
    totalHeight += 4; // borders and minor spacing

    const calculatedHeight = Math.max(100, Math.round(totalHeight));

    // Restore the original styles so DOM matches state until update completes
    restores.forEach(restore => restore?.());

    if (Math.abs((item.h || 0) - calculatedHeight) > 3) {
      onUpdate({ h: calculatedHeight });
    }
  }, [subs, item.title, editing, item.h, lang]);

  return (
    <div ref={cardRef} className="todo-card" style={{width:'100%', height:'100%'}}>
      <div className="item-card" style={{ background: bg, color: isDarkBg ? 'white' : 'inherit' }}>
        {item.showTitle !== false && (
          <div className="todo-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            {editing ? (
              <textarea
                className="todo-title-edit"
                autoFocus
                value={pickLang(item.title, lang)}
                onChange={(e)=>{
                  onUpdate({ title: { es: e.target.value, en: e.target.value } });
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = el.scrollHeight + 'px';
                  }
                }}
                onClick={(e)=>e.stopPropagation()}
                onMouseDown={(e)=>e.stopPropagation()}
                onFocus={(e)=>{ if (item._new) e.target.select(); }}
                onKeyDown={(e)=>{ if (e.key==='Enter') { e.preventDefault(); e.target.blur(); } }}
                rows={1}
                style={{
                  resize: 'none',
                  overflowY: 'hidden',
                  height: 'auto',
                  display: 'block',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontWeight: '700',
                  color: 'inherit',
                  padding: 0
                }}
              />
            ) : (
              <span>{pickLang(item.title, lang) || (window.t('Pendientes', 'To-do'))}</span>
            )}
            {!editing && subs.some(ti => ti.done) && (
              <button
                className="todo-clear-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  const remaining = subs.filter(ti => !ti.done);
                  if (remaining.length === 0) {
                    remaining.push({ id: `t-${Date.now()}-1`, text: { es: '', en: '' }, done: false, indent: 0 });
                  }
                  onUpdate({ items: remaining });
                }}
                onMouseDown={(e)=>e.stopPropagation()}
                title={window.t('Eliminar tareas completadas', 'Clear completed tasks')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--wine, #E6544F)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  opacity: 0.8
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>delete_sweep</span>
              </button>
            )}
          </div>
        )}
        <div className="todo-list">
          {subs.map((ti, idx) => {
            const state = computeRowState(idx).state;
            const indent = Math.min(2, ti.indent || 0);
            const hasMeta = ti.dueDate || ti.assignee;
            const isSelected = callbacks?.isSelectedItem ? callbacks.isSelectedItem(item.id) : false;
            const isRowFocused = isSelected && focusedRowId === ti.id;

            return (
              <div
                key={ti.id}
                className={`todo-row ${ti.done ? 'done' : ''} indent-${indent} ${isRowFocused ? 'focused' : ''}`}
                onClick={(e)=>{
                  setFocusedRow(ti.id);
                }}
              >
                <div
                  className="todo-drag-handle"
                  onMouseDown={(e) => {
                    if (callbacks?.startDragTaskRow) {
                      callbacks.startDragTaskRow(e, item.id, idx);
                    }
                  }}
                  title={lang === 'es' ? 'Arrastrar tarea fuera o reordenar' : 'Drag task out or reorder'}
                >
                  <span className="material-symbols-rounded">drag_indicator</span>
                </div>
                <div
                  className={`todo-check ${state === 'done' ? 'done' : ''} ${state === 'partial' ? 'partial' : ''}`}
                  onClick={(e)=>{e.stopPropagation(); toggleRow(idx);}}
                  onMouseDown={(e)=>{ callbacks?.selectItem?.(item.id); e.stopPropagation(); }}
                />
                <div className="todo-row-body">
                  <textarea
                    className="todo-input"
                    value={pickLang(ti.text, lang)}
                    placeholder={window.t('Tarea…', 'Task…')}
                    spellCheck={true}
                    rows={1}
                    onChange={(e)=>{
                      updateRow(idx, { text: { es: e.target.value, en: e.target.value } });
                      e.target.style.height = '0px';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    ref={(el) => {
                      if (el) {
                        el.style.height = '0px';
                        el.style.height = el.scrollHeight + 'px';
                      }
                    }}
                    onClick={(e)=>e.stopPropagation()}
                    onMouseDown={(e)=>{ callbacks?.selectItem?.(item.id); e.stopPropagation(); }}
                    onFocus={()=>{
                      setFocusedRow(ti.id);
                    }}
                    onKeyDown={(e)=>{
                      if (e.key === 'Enter') {
                        if (e.shiftKey) {
                          // Let Shift+Enter insert a newline natively
                        } else {
                          e.preventDefault();
                          addRow(idx);
                          setTimeout(()=>{
                            const inputs = e.target.closest('.todo-list').querySelectorAll('.todo-input');
                            inputs[idx+1]?.focus();
                          }, 10);
                        }
                      }
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        indentRow(idx, e.shiftKey ? -1 : +1);
                      }
                      if (e.key === 'Backspace' && !e.target.value) {
                        // First step out of any indentation, then (at level 0) delete the row
                        if ((ti.indent || 0) > 0) {
                          e.preventDefault();
                          indentRow(idx, -1);
                          return;
                        }
                        if (subs.length > 1) {
                          e.preventDefault();
                          const prevInput = e.target.closest('.todo-list').querySelectorAll('.todo-input')[idx-1];
                          deleteRow(idx);
                          setTimeout(()=>{ prevInput?.focus(); }, 10);
                        }
                      }
                    }}
                  />
                  {hasMeta && (
                    <div className="todo-row-meta">
                      {ti.assignee && (
                        <span
                          className="todo-meta-chip assignee"
                          onClick={(e)=>{ e.stopPropagation(); updateRow(idx, { assignee: null }); }}
                          title={window.t('Clic para quitar', 'Click to remove')}
                        >
                          @{ti.assignee}
                        </span>
                      )}
                      {ti.dueDate && (
                        <span
                          className="todo-meta-chip due"
                          onClick={(e)=>{ e.stopPropagation(); updateRow(idx, { dueDate: null }); }}
                          title={window.t('Clic para quitar', 'Click to remove')}
                        >
                          <span className="material-symbols-rounded">notifications</span>
                          {window.t('Vence', 'Due')} {(() => {
                            const d = new Date(ti.dueDate + 'T00:00:00');
                            return isNaN(d.getTime()) ? ti.dueDate : d.toLocaleDateString(lang, { day:'numeric', month:'short' });
                          })()}
                        </span>
                      )}
                    </div>
                  )}
                  {isRowFocused && (
                    <div className="todo-row-controls" onMouseDown={(e)=>e.stopPropagation()} style={{ marginTop: '4px', marginLeft: 0 }}>
                      <button
                        disabled={ti.indent === 0}
                        onClick={(e) => { e.stopPropagation(); indentRow(idx, -1); }}
                        title={window.t('Disminuir sangría', 'Decrease indent')}
                      >
                        <span className="material-symbols-rounded">format_indent_decrease</span>
                      </button>
                      <button
                        disabled={ti.indent >= 2}
                        onClick={(e) => { e.stopPropagation(); indentRow(idx, 1); }}
                        title={window.t('Aumentar sangría', 'Increase indent')}
                      >
                        <span className="material-symbols-rounded">format_indent_increase</span>
                      </button>
                      <button
                        disabled={idx === 0}
                        onClick={(e) => { e.stopPropagation(); moveRow(idx, -1); }}
                        title={window.t('Subir tarea', 'Move up')}
                      >
                        <span className="material-symbols-rounded">arrow_upward</span>
                      </button>
                      <button
                        disabled={idx === subs.length - 1}
                        onClick={(e) => { e.stopPropagation(); moveRow(idx, 1); }}
                        title={window.t('Bajar tarea', 'Move down')}
                      >
                        <span className="material-symbols-rounded">arrow_downward</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteRow(idx); }}
                        title={window.t('Eliminar tarea', 'Delete task')}
                        className="danger"
                      >
                        <span className="material-symbols-rounded">delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div
            className="todo-add"
            onClick={(e)=>{
              e.stopPropagation();
              addRow(subs.length - 1);
              setTimeout(()=>{
                const inputs = e.target.closest('.todo-list').querySelectorAll('.todo-input');
                inputs[inputs.length - 1]?.focus();
              }, 50);
            }}
            onMouseDown={(e)=>e.stopPropagation()}
          >
            <span className="material-symbols-rounded">add</span>
            <span>{window.t('Nueva tarea', 'New task')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────── COLUMN — drop target for items ────────────────
function ColumnItem({ item, lang, onUpdate, editing, callbacks }) {
  const stripColor = window.resolveStickyColor ? window.resolveStickyColor(item.color || 'white') : '#FFFFFF';
  const stripIsDark = isColorDark(stripColor);
  const children = item.children || [];

  return (
    <div className="column-card" style={{width:'100%', height:'100%'}}>
      <div className="item-card" style={{ overflow: 'hidden', padding: 0 }}>
        <div
          className={`column-strip ${stripIsDark ? 'dark' : ''}`}
          style={{ background: stripColor }}
        >
          <div className="column-strip-head">
            <span className="material-symbols-rounded column-strip-icon">{item.icon || 'view_column'}</span>
            {item.showTitle !== false && (editing ? (
              <textarea
                autoFocus
                value={pickLang(item.content, lang)}
                onChange={(e)=>{
                  onUpdate({ content: { es: e.target.value, en: e.target.value } });
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = el.scrollHeight + 'px';
                  }
                }}
                onClick={(e)=>e.stopPropagation()}
                onMouseDown={(e)=>e.stopPropagation()}
                onFocus={(e)=>{ if (item._new) e.target.select(); }}
                onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
                rows={1}
                style={{
                  color: 'inherit',
                  textAlign: 'center',
                  resize: 'none',
                  overflowY: 'hidden',
                  height: 'auto',
                  display: 'block',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontWeight: '700',
                  padding: 0
                }}
              />
            ) : (
              <span className="column-strip-title">{pickLang(item.content, lang) || (window.t('Nueva Columna', 'New Column'))}</span>
            ))}
          </div>
          <div className="column-strip-meta">
            {children.length} {children.length === 1 ? (window.t('nodo', 'node')) : (window.t('nodos', 'nodes'))}
          </div>
        </div>
        <div className="column-body">
          {children.length === 0 && (
            <div className="column-empty"/>
          )}
          {children.map(child => {
            const isBoardCompact = child.type === 'board' && child.showPreview === false;
            const h = isBoardCompact ? 58 : (child.h || (child.type === 'board' ? 200 :
                                  child.type === 'note' ? 90 :
                                  child.type === 'todo' ? 140 :
                                  child.type === 'link' ? 180 :
                                  child.type === 'image' ? 140 :
                                  child.type === 'doc' ? 90 :
                                  child.type === 'comment' ? 80 :
                                  child.type === 'calendar' ? 220 : 90));
            const w = (item.w || 240) - 36;
            const isEditingChild = callbacks.editingChild && callbacks.editingChild.colId === item.id && callbacks.editingChild.childId === child.id;
            const isSelected = callbacks.isSelectedItem?.(child.id);
            return (
              <div
                key={child.id}
                className={`col-child-wrap ${isSelected ? 'selected' : ''}`}
                data-col-child-id={child.id}
                data-col-parent-id={item.id}
                data-item-id={child.id}
                style={{ height: h, width: '100%', position: 'relative' }}
                onMouseDown={(e) => {
                  if (isEditingChild) return;
                  callbacks.startColChildDrag && callbacks.startColChildDrag(e, item.id, child.id);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  callbacks.setEditingChild && callbacks.setEditingChild(item.id, child.id);
                  callbacks.selectItem && callbacks.selectItem(child.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (child.type === 'doc') { callbacks.openDoc && callbacks.openDoc(child.id, item.id); return; }
                  if (child.type === 'board') { callbacks.openBoard && callbacks.openBoard(child.canvasId, child.id); return; }
                  callbacks.setEditingChild && callbacks.setEditingChild(item.id, child.id);
                }}
              >
                <window.ItemRenderer
                  item={{ ...child, w, h, _inColumn: true }}
                  lang={lang}
                  editing={isEditingChild}
                  callbacks={{
                    ...callbacks,
                    updateItem: (id, patch) => callbacks.updateColChild(item.id, child.id, patch),
                  }}
                />
                {!isEditingChild && callbacks.startAnchorDrag && (
                  <div className="anchors">
                    <div
                      className="connect-handle"
                      title={lang==='es'?'Arrastra para conectar':'Drag to connect'}
                      onMouseDown={(e)=>callbacks.startAnchorDrag(e, child.id, 'center')}
                    >
                      <span className="material-symbols-rounded">trip_origin</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ──────────────── BOARD ────────────────
const BOARD_ICONS = ['dashboard','folder','category','widgets','book','map','palette','psychology','rocket_launch','sports_esports','castle','science'];

// Icon glyph shown for each node type in the board preview
const TYPE_ICON = {
  note: 'sticky_note_2', todo: 'checklist', doc: 'description', image: 'image',
  link: 'link', calendar: 'calendar_month', table: 'table_chart', board: 'dashboard',
  column: 'view_column', comment: 'forum', audio: 'audiotrack', color: 'palette', file: 'draft',
};

// Decide if a hex color is dark (so text on it should be white)
function isColorDark(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

function BoardItem({ item, lang, onUpdate, onOpenBoard, editing, getNestedItems, onStartEdit }) {
  const accent = window.resolveStickyColor ? window.resolveStickyColor(item.color || 'white') : '#FFFFFF';
  const darkAccent = isColorDark(accent);
  const nestedItems = getNestedItems ? getNestedItems(item.canvasId) : [];

  const cardRef = React.useRef(null);
  const lastCalculatedH = React.useRef(item.h);
  // null hasta el primer efecto: se calibra con las medidas REALES del pie.
  // (Antes se estimaba con un -60 fijo que no coincidía con el pie medido —
  // sobre todo con títulos de dos líneas — y el nodo crecía ~12px en cada arranque.)
  const desiredPreviewH = React.useRef(null);
  const [iconPickerOpen, setIconPickerOpen] = React.useState(false);

  // If item.h changes from the outside (e.g. user drag resize), update our desired preview height
  if (desiredPreviewH.current !== null && item.h !== lastCalculatedH.current) {
    const footEl = cardRef.current?.querySelector('.board-foot');
    const captionEl = cardRef.current?.querySelector('.node-caption-row');
    const footH = footEl ? footEl.offsetHeight : 52;
    const captionH = captionEl ? captionEl.offsetHeight : 0;
    const colorBarH = 8;
    const borderH = 3;
    const currentPreviewH = item.h - colorBarH - footH - captionH - borderH;
    desiredPreviewH.current = Math.max(50, currentPreviewH);
    lastCalculatedH.current = item.h;
  }

  const compact = item.showPreview === false; // compact = no preview, just a small square with logo + title

  React.useEffect(() => {
    if (compact) return; // compact mode uses a fixed small square, no preview auto-height
    if (!cardRef.current) return;
    const footEl = cardRef.current.querySelector('.board-foot');
    const captionEl = cardRef.current.querySelector('.node-caption-row');
    if (!footEl) return;

    const overrideStyle = (el, prop, val) => {
      if (!el) return null;
      const origVal = el.style.getPropertyValue(prop);
      const origPrio = el.style.getPropertyPriority(prop);
      el.style.setProperty(prop, val, 'important');
      return () => {
        if (origVal) {
          el.style.setProperty(prop, origVal, origPrio);
        } else {
          el.style.removeProperty(prop);
        }
      };
    };

    // Temporarily unconstrain height of all parent and container elements for natural layout measurement
    const cardEl = cardRef.current;
    const itemEl = cardEl.parentElement;
    const itemCardEl = cardEl.querySelector('.item-card');
    const restores = [];

    restores.push(overrideStyle(itemEl, 'height', 'auto'));
    restores.push(overrideStyle(cardEl, 'height', 'auto'));
    restores.push(overrideStyle(itemCardEl, 'height', 'auto'));

    const footH = footEl.offsetHeight;
    const captionH = captionEl ? captionEl.offsetHeight : 0;
    const colorBarH = 8;
    const borderH = 3;

    // Restore the original styles
    restores.forEach(restore => restore?.());

    // Primer render: derivar el alto del preview de item.h con las medidas reales.
    // item.h guardado ya es correcto — no hay nada que actualizar.
    if (desiredPreviewH.current === null) {
      desiredPreviewH.current = Math.max(50, item.h - colorBarH - footH - captionH - borderH);
      lastCalculatedH.current = item.h;
      return;
    }

    const totalHeight = Math.round(desiredPreviewH.current + colorBarH + footH + captionH + borderH);

    if (Math.abs((item.h || 0) - totalHeight) > 3) {
      lastCalculatedH.current = totalHeight;
      onUpdate({ h: totalHeight });
    }
  }, [item.content, editing, item.h, lang, item.showCaption, compact]);

  const previewW = item.w - 16;
  const colorBarH = 8;
  const borderH = 3;
  
  // Estimate or calculate the actual preview height for scale math
  const footElForScale = cardRef.current?.querySelector('.board-foot');
  const captionElForScale = cardRef.current?.querySelector('.node-caption-row');
  const footHForScale = footElForScale ? footElForScale.offsetHeight : 52;
  const captionHForScale = captionElForScale ? captionElForScale.offsetHeight : 0;
  const previewH = Math.max(50, item.h - colorBarH - footHForScale - captionHForScale - borderH);

  let scale = 1, bx = 8, by = 8;
  if (nestedItems.length) {
    let mx = 0, my = 0;
    nestedItems.forEach(it => { mx = Math.max(mx, it.x + it.w); my = Math.max(my, it.y + it.h); });
    const sx = (previewW - 16) / Math.max(mx, 1);
    const sy = (previewH - 16) / Math.max(my, 1);
    scale = Math.min(sx, sy, 0.35);
  }

  // ── Inside a column (compact) OR Compact Mode on Canvas: Milanote-style horizontal card (icon left, name + count right) ──
  if (compact) {
    return (
      <div
        className={`board-card board-in-column ${editing ? 'editing' : ''}`}
        style={{width:'100%', height:'100%'}}
        onDoubleClick={!item._inColumn ? (e)=>{ e.stopPropagation(); onOpenBoard && onOpenBoard(item.canvasId, item.id); } : undefined}
      >
        <div className="board-col-card" style={compact ? { border: '1.5px solid var(--line)', background: 'var(--paper)', borderRadius: '6px', overflow: 'hidden' } : {}}>
          <div
            className="board-col-icon"
            style={{ background: accent, color: darkAccent ? '#fff' : '#1A1A1A', cursor: editing ? 'pointer' : 'inherit', position: 'relative' }}
            onClick={editing ? (e)=>{ e.stopPropagation(); setIconPickerOpen(o=>!o); } : undefined}
            onMouseDown={editing ? (e)=>e.stopPropagation() : undefined}
            title={editing ? window.t('Cambiar icono', 'Change icon') : undefined}
          >
            <span className="material-symbols-rounded">{item.icon || 'dashboard'}</span>
            {editing && iconPickerOpen && (
              <div className="board-col-iconpicker" onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>
                {BOARD_ICONS.map(ic => (
                  <button key={ic} className={`board-col-iconopt ${(item.icon||'dashboard')===ic?'active':''}`}
                    onClick={(e)=>{ e.stopPropagation(); onUpdate({ icon: ic }); setIconPickerOpen(false); }}>
                    <span className="material-symbols-rounded">{ic}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="board-col-meta">
            {editing ? (
              <input
                className="board-col-title-edit"
                autoFocus
                value={pickLang(item.content, lang)}
                onChange={(e)=>onUpdate({ content: { es: e.target.value, en: e.target.value } })}
                onClick={(e)=>e.stopPropagation()}
                onMouseDown={(e)=>e.stopPropagation()}
                onFocus={(e)=>e.target.select()}
                onKeyDown={(e)=>{ if (e.key==='Enter' || e.key==='Escape') e.target.blur(); }}
              />
            ) : (
              <div className="board-col-title">{pickLang(item.content, lang) || (window.t('Tablero', 'Board'))}</div>
            )}
            <div className="board-col-count">{nestedItems.length} {window.t('nodos', 'nodes')} · {window.t('doble clic para abrir', 'double-click to open')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className="board-card"
      style={{width:'100%', height:'100%'}}
      onDoubleClick={(e)=>{ e.stopPropagation(); onOpenBoard && onOpenBoard(item.canvasId, item.id); }}
    >
      <div className="item-card" style={{borderColor: 'var(--line)'}}>
        <div className="board-color-bar" style={{background: accent}}/>
        <div className="board-cover" style={{ height: previewH, flex: 'none' }}>
          <div className="board-cover-grid"/>
          {nestedItems.length === 0 && (
            <div className="board-preview-item empty-message">
              {window.t('Tablero vacío', 'Empty board')}
            </div>
          )}
          {nestedItems.slice(0, 12).map((it) => {
            const x = bx + it.x * scale;
            const y = by + it.y * scale;
            const w = Math.max(30, it.w * scale);
            const h = Math.max(26, it.h * scale);
            // Always coerce to a string — some titles/contents are bilingual objects ({es,en})
            const rawLabel = pickLang(it.content, lang) || pickLang(it.title, lang) || '';
            const label = typeof rawLabel === 'string' ? rawLabel : '';
            return (
              <div
                key={it.id}
                className={`board-preview-item kind-${it.type}`}
                style={{ left: x, top: y, width: w, height: h }}
                title={label}
              >
                <span className="material-symbols-rounded board-preview-icon">{TYPE_ICON[it.type] || 'crop_square'}</span>
                <span className="board-preview-label">{label.slice(0, 24)}</span>
              </div>
            );
          })}
        </div>
        <div
          className={`board-foot ${darkAccent ? 'dark' : ''} ${item.showTitle === false ? 'no-title' : ''}`}
          style={{ background: accent }}
          onDoubleClick={(e)=>{ e.stopPropagation(); onStartEdit && onStartEdit(item.id); }}
        >
          <span className="material-symbols-rounded board-foot-icon">{item.icon || 'dashboard'}</span>
          {item.showTitle !== false && (editing ? (
            <textarea
              className="board-title-edit"
              autoFocus
              value={pickLang(item.content, lang)}
              onChange={(e)=>{
                onUpdate({ content: { es: e.target.value, en: e.target.value } });
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = el.scrollHeight + 'px';
                }
              }}
              onClick={(e)=>e.stopPropagation()}
              onMouseDown={(e)=>e.stopPropagation()}
              onFocus={(e)=>{ if (item._new) e.target.select(); }}
              onBlur={(e)=>{
                const val = e.target.value.trim();
                const defaultName = window.t('Nuevo tablero', 'New board');
                const finalName = val || defaultName;
                onUpdate({
                  content: { es: finalName, en: finalName },
                  _editing: false
                });
              }}
              onKeyDown={(e)=>{ if (e.key==='Enter') { e.preventDefault(); e.target.blur(); } }}
              rows={1}
              style={{
                resize: 'none',
                overflowY: 'hidden',
                height: 'auto',
                display: 'block',
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                fontWeight: '700',
                color: 'inherit',
                padding: 0
              }}
            />
          ) : (
            <div className="board-foot-title">
              {pickLang(item.content, lang) || (window.t('Tablero', 'Board'))}
            </div>
          ))}
          <span className="board-count">{nestedItems.length}</span>
        </div>
        {item.showCaption && (
          <div className="node-caption-row">
            <NodeCaption item={item} lang={lang} onUpdate={onUpdate} autoGrow/>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────── DOC ────────────────
function DocItem({ item, lang, onOpenDoc }) {
  const body = pickLang(item.body, lang);
  const bg = window.resolveStickyColor ? window.resolveStickyColor(item.color || 'white') : null;
  const isDarkBg = ['olive','wine','dark','green','red','purple'].includes(item.color);
  const compact = item.showPreview === false; // preview off → just the doc logo
  const title = pickLang(item.title, lang) || (window.t('Documento', 'Document'));
  return (
    <div className="doc-card" style={{width:'100%', height:'100%'}}>
      <div
        className="item-card"
        style={{ background: bg, color: isDarkBg ? 'white' : '#1A1A1A' }}
        onDoubleClick={(e)=>{ e.stopPropagation(); onOpenDoc && onOpenDoc(item.id); }}
      >
        {compact ? (
          <div className="doc-compact">
            <span className="material-symbols-rounded doc-compact-icon">description</span>
            <div className="doc-compact-title">{title}</div>
          </div>
        ) : (
          <>
            <div className="doc-head">
              <span className="material-symbols-rounded">description</span>
              <span style={{flex:1, wordBreak:'break-word', whiteSpace:'pre-wrap'}}>{title}</span>
            </div>
            <div className="doc-body-preview" dangerouslySetInnerHTML={{ __html: body || '' }}/>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────── CALENDAR (Miro-style) ────────────────
function CalendarItem({ item, lang, onUpdate, editing }) {
  const today = new Date();
  const [view, setView] = React.useState(() => ({
    year: item.year || today.getFullYear(),
    month: item.month != null ? item.month : today.getMonth(),
  }));
  const [adding, setAdding] = React.useState(null); // dateKey
  const [draft, setDraft] = React.useState('');
  const [dayMenu, setDayMenu] = React.useState(null); // { key, x, y }
  const openDayMenu = (menuData) => {
    setDayMenu(menuData);
    window._calendarDayMenuOpen = !!menuData;
    window._notifyFocusedRowChanged?.();
  };
  const [openPicker, setOpenPicker] = React.useState(null); // 'day' | 'month' | 'year' | null
  const [editingEvent, setEditingEvent] = React.useState(null); // { key, evId }
  const [eventDraft, setEventDraft] = React.useState('');
  const fileRef = React.useRef(null);
  const pendingImgKey = React.useRef(null);
  const bg = window.resolveStickyColor ? window.resolveStickyColor(item.color || 'white') : null;
  const isDarkBg = ['olive','wine','dark','green','red','purple'].includes(item.color);

  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const dows = lang === 'es' ? ['lun','mar','mié','jue','vie','sáb','dom'] : ['mon','tue','wed','thu','fri','sat','sun'];
  const start = (firstDay + 6) % 7;

  // Selected day (highlighted red unless it's today). Stored with full date so it doesn't bleed across months.
  const selectedDay = item.selectedDay != null ? item.selectedDay : null;
  const selectedYear = item.selectedYear != null ? item.selectedYear : view.year;
  const selectedMonth = item.selectedMonth != null ? item.selectedMonth : view.month;
  const selectedKey = selectedDay != null && selectedYear === view.year && selectedMonth === view.month
    ? `${view.year}-${view.month}-${selectedDay}` : null;

  // Month names for dropdown
  const monthNames = Array.from({ length: 12 }, (_, m) =>
    new Date(2024, m, 1).toLocaleDateString(lang, { month: 'long' })
  );
  // Year range +/- 5 from current view
  const yearOptions = [];
  for (let y = view.year - 5; y <= view.year + 5; y++) yearOptions.push(y);

  const events = item.events || {};
  const images = item.images || {};
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const cells = [];
  for (let i = 0; i < start; i++) cells.push({ muted: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `${view.year}-${view.month}-${d}` });
  while (cells.length % 7 !== 0) cells.push({ muted: true });

  const addEvent = (key, text) => {
    const t = text.trim();
    if (!t) return;
    const next = { ...events };
    const arr = Array.isArray(next[key]) ? [...next[key]] : [];
    arr.push({ id: `ev-${Date.now()}-${Math.floor(Math.random()*9999)}`, text: t, color: CATEGORY_COLORS[arr.length % CATEGORY_COLORS.length] });
    next[key] = arr;
    onUpdate({ events: next });
  };
  const deleteEvent = (key, evId) => {
    const next = { ...events };
    next[key] = (Array.isArray(next[key]) ? next[key] : []).filter(e => e.id !== evId);
    if (!next[key].length) delete next[key];
    onUpdate({ events: next });
  };
  const updateEventText = (key, evId, newText) => {
    const next = { ...events };
    next[key] = (Array.isArray(next[key]) ? next[key] : []).map(ev =>
      ev.id === evId ? { ...ev, text: newText } : ev
    );
    onUpdate({ events: next });
  };

  const startAddImage = (key) => {
    pendingImgKey.current = key;
    fileRef.current?.click();
  };
  const handlePickImage = (e) => {
    const f = e.target.files && e.target.files[0];
    const key = pendingImgKey.current;
    e.target.value = '';
    if (!f || !key) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdate({ images: { ...images, [key]: reader.result } });
    };
    reader.readAsDataURL(f);
  };
  const removeImage = (key) => {
    const next = { ...images };
    delete next[key];
    onUpdate({ images: next });
  };

  // Per-day color (background tint of day cell)
  const dayColors = item.dayColors || {};
  const setDayColor = (key, color) => {
    const next = { ...dayColors };
    if (color) next[key] = color; else delete next[key];
    onUpdate({ dayColors: next });
  };
  const clearDayEvents = (key) => {
    const next = { ...events };
    delete next[key];
    onUpdate({ events: next });
  };
  const DAY_COLORS = ['#FFFFFF','#F7DA84','#90B968','#E6544F','#3D5A80','#955BA5','#595459'];

  return (
    <div className="cal-mb" style={{width:'100%', height:'100%'}}>
      <div className="item-card" style={{padding: 10, display:'flex', flexDirection:'column', background: bg, color: isDarkBg ? 'white' : 'inherit'}}>
        <div className="cal-mb-head">
          <span className="material-symbols-rounded" style={{color:'var(--wine)'}}>calendar_month</span>

          <div className="cal-mb-pickers" style={{display:'flex', gap:4, position:'relative', flex:1}}>
            {/* Day picker */}
            <div style={{position:'relative'}}>
              <button
                className="cal-mb-pick-btn"
                onClick={(e)=>{ e.stopPropagation(); setOpenPicker(openPicker === 'day' ? null : 'day'); }}
                onMouseDown={(e)=>e.stopPropagation()}
              >
                {selectedDay != null ? selectedDay : (window.t('Día', 'Day'))}
                <span className="material-symbols-rounded" style={{fontSize:'1em'}}>arrow_drop_down</span>
              </button>
              {openPicker === 'day' && (
                <div className="cal-mb-dropdown" onMouseDown={(e)=>e.stopPropagation()}>
                  <button className="cal-mb-drop-item" onClick={(e)=>{ e.stopPropagation(); onUpdate({ selectedDay: null, selectedYear: null, selectedMonth: null }); setOpenPicker(null); }}>
                    {window.t('Ninguno', 'None')}
                  </button>
                  {Array.from({length: daysInMonth}, (_, i) => i + 1).map(d => (
                    <button
                      key={d}
                      className={`cal-mb-drop-item ${selectedDay === d && selectedYear === view.year && selectedMonth === view.month ? 'active' : ''}`}
                      onClick={(e)=>{ e.stopPropagation(); onUpdate({ selectedDay: d, selectedYear: view.year, selectedMonth: view.month }); setOpenPicker(null); }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Month picker */}
            <div style={{position:'relative'}}>
              <button
                className="cal-mb-pick-btn"
                onClick={(e)=>{ e.stopPropagation(); setOpenPicker(openPicker === 'month' ? null : 'month'); }}
                onMouseDown={(e)=>e.stopPropagation()}
                style={{textTransform:'capitalize'}}
              >
                {monthNames[view.month]}
                <span className="material-symbols-rounded" style={{fontSize:'1em'}}>arrow_drop_down</span>
              </button>
              {openPicker === 'month' && (
                <div className="cal-mb-dropdown" onMouseDown={(e)=>e.stopPropagation()}>
                  {monthNames.map((mn, m) => (
                    <button
                      key={m}
                      className={`cal-mb-drop-item ${view.month === m ? 'active' : ''}`}
                      onClick={(e)=>{ e.stopPropagation(); setView(v => ({...v, month: m})); setOpenPicker(null); }}
                      style={{textTransform:'capitalize'}}
                    >
                      {mn}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Year picker */}
            <div style={{position:'relative'}}>
              <button
                className="cal-mb-pick-btn"
                onClick={(e)=>{ e.stopPropagation(); setOpenPicker(openPicker === 'year' ? null : 'year'); }}
                onMouseDown={(e)=>e.stopPropagation()}
              >
                {view.year}
                <span className="material-symbols-rounded" style={{fontSize:'1em'}}>arrow_drop_down</span>
              </button>
              {openPicker === 'year' && (
                <div className="cal-mb-dropdown" onMouseDown={(e)=>e.stopPropagation()}>
                  {yearOptions.map(y => (
                    <button
                      key={y}
                      className={`cal-mb-drop-item ${view.year === y ? 'active' : ''}`}
                      onClick={(e)=>{ e.stopPropagation(); setView(v => ({...v, year: y})); setOpenPicker(null); }}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button className="cal-mb-nav" onClick={(e)=>{e.stopPropagation(); setView(v => v.month === 0 ? {year:v.year-1, month:11} : {...v, month:v.month-1});}} onMouseDown={(e)=>e.stopPropagation()} title={window.t('Mes anterior', 'Previous month')}>
            <span className="material-symbols-rounded">chevron_left</span>
          </button>
          <button className="cal-mb-nav" onClick={(e)=>{e.stopPropagation(); setView(v => v.month === 11 ? {year:v.year+1, month:0} : {...v, month:v.month+1});}} onMouseDown={(e)=>e.stopPropagation()} title={window.t('Mes siguiente', 'Next month')}>
            <span className="material-symbols-rounded">chevron_right</span>
          </button>
        </div>
        <div className="cal-mb-dows">
          {dows.map((d, i) => <div key={i} className="cal-mb-dow">{d}</div>)}
        </div>
        <div className="cal-mb-grid">
          {cells.map((c, i) => {
            const hasImg = !c.muted && images[c.key];
            const dayBg = !c.muted && dayColors[c.key];
            return (
              <div
                key={i}
                className={`cal-mb-cell ${c.muted ? 'muted' : ''} ${c.key === todayKey ? 'today' : ''} ${c.key === selectedKey && c.key !== todayKey ? 'selected-day' : ''} ${hasImg ? 'has-image' : ''}`}
                style={dayBg ? { background: dayBg, borderColor: dayBg } : null}
                onClick={(e)=>{
                  e.stopPropagation();
                  if (c.muted) return;
                  if (adding === c.key) return; // already adding
                  // open day menu instead of jumping straight to event input
                  openDayMenu({ key: c.key, x: e.clientX, y: e.clientY });
                }}
                onContextMenu={(e)=>{
                  e.preventDefault(); e.stopPropagation();
                  if (c.muted) return;
                  openDayMenu({ key: c.key, x: e.clientX, y: e.clientY });
                }}
                onMouseDown={(e)=>e.stopPropagation()}
              >
                {hasImg && <div className="cal-mb-cell-img" style={{backgroundImage:`url(${images[c.key]})`}}/>}
                {!c.muted && <div className="cal-mb-day">{c.day}</div>}
                {!c.muted && (
                  <div className="cal-mb-day-actions">
                    <button
                      title={window.t('Añadir imagen', 'Add image')}
                      onClick={(e)=>{e.stopPropagation(); startAddImage(c.key);}}
                      onMouseDown={(e)=>e.stopPropagation()}
                    >
                      <span className="material-symbols-rounded">image</span>
                    </button>
                    {hasImg && (
                      <button
                        title={window.t('Borrar imagen', 'Remove image')}
                        onClick={(e)=>{e.stopPropagation(); removeImage(c.key);}}
                        onMouseDown={(e)=>e.stopPropagation()}
                      >
                        <span className="material-symbols-rounded">close</span>
                      </button>
                    )}
                  </div>
                )}
                {!c.muted && (Array.isArray(events[c.key]) ? events[c.key] : []).map(ev => {
                  const isEditingEv = editingEvent && editingEvent.key === c.key && editingEvent.evId === ev.id;
                  if (isEditingEv) {
                    return (
                      <div key={ev.id} className="cal-mb-event-edit" onClick={(e)=>e.stopPropagation()} onMouseDown={(e)=>e.stopPropagation()}>
                        <input
                          className="cal-mb-input"
                          autoFocus
                          value={eventDraft}
                          onChange={(e)=>setEventDraft(e.target.value)}
                          onBlur={()=>{
                            if (eventDraft.trim()) updateEventText(c.key, ev.id, eventDraft.trim());
                            setEditingEvent(null); setEventDraft('');
                          }}
                          onKeyDown={(e)=>{
                            if (e.key === 'Enter') { e.target.blur(); }
                            if (e.key === 'Escape') { setEditingEvent(null); setEventDraft(''); }
                          }}
                        />
                        <button
                          className="cal-mb-event-del"
                          onClick={(e)=>{ e.stopPropagation(); deleteEvent(c.key, ev.id); setEditingEvent(null); setEventDraft(''); }}
                          onMouseDown={(e)=>{ e.preventDefault(); e.stopPropagation(); }}
                          title={window.t('Eliminar', 'Delete')}
                        >
                          <span className="material-symbols-rounded">close</span>
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={ev.id}
                      className="cal-mb-event"
                      style={{ background: CATEGORY_HEX[ev.color] || CATEGORY_HEX.blue }}
                      onClick={(e)=>{ e.stopPropagation(); setEditingEvent({ key: c.key, evId: ev.id }); setEventDraft(ev.text); }}
                      onMouseDown={(e)=>e.stopPropagation()}
                      onContextMenu={(e)=>{ e.preventDefault(); e.stopPropagation(); deleteEvent(c.key, ev.id); }}
                      title={window.t('Clic para editar · Clic derecho para borrar', 'Click to edit · Right-click to delete')}
                    >
                      {ev.text}
                    </div>
                  );
                })}
                {adding === c.key && (
                  <input
                    className="cal-mb-input"
                    autoFocus
                    value={draft}
                    onChange={(e)=>setDraft(e.target.value)}
                    onClick={(e)=>e.stopPropagation()}
                    onMouseDown={(e)=>e.stopPropagation()}
                    onBlur={()=>{ addEvent(c.key, draft); setDraft(''); setAdding(null); }}
                    onKeyDown={(e)=>{
                      if (e.key === 'Enter') { addEvent(c.key, draft); setDraft(''); setAdding(null); }
                      if (e.key === 'Escape') { setDraft(''); setAdding(null); }
                    }}
                    placeholder={window.t('+ evento', '+ event')}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="cal-mb-hint">
          {window.t('Clic en un día para evento · ícono de imagen para foto', 'Click a day for event · image icon for photo')}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handlePickImage}/>
        {dayMenu && (() => {
          const k = dayMenu.key;
          const hasImg = !!images[k];
          const hasEvents = (events[k] || []).length > 0;
          return ReactDOM.createPortal((
            <>
              <div style={{position:'fixed', inset:0, zIndex: 200}} onClick={()=>openDayMenu(null)} onMouseDown={(e)=>e.stopPropagation()}/>
              <div
                className="ctx-side ctx-side-day"
                onClick={(e)=>e.stopPropagation()}
                onMouseDown={(e)=>e.stopPropagation()}
              >
                <button className="ctx-close" onClick={()=>openDayMenu(null)} title={window.t('Cerrar', 'Close')}>
                  <span className="material-symbols-rounded">arrow_back</span>
                </button>
                <div style={{padding:'2px 6px 4px', fontSize:9, fontWeight:700, color:'var(--ink-3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', textAlign:'center'}}>
                  {window.t('Día', 'Day')} {k.split('-').pop()}
                </div>
                <button className="ctx-btn" onClick={()=>{ setAdding(k); openDayMenu(null); }}>
                  <span className="material-symbols-rounded">add</span>
                  <span>{window.t('Evento', 'Event')}</span>
                </button>
                <button className="ctx-btn" onClick={()=>{ startAddImage(k); openDayMenu(null); }}>
                  <span className="material-symbols-rounded">image</span>
                  <span>{hasImg ? (window.t('Cambiar', 'Change')) : (window.t('Imagen', 'Image'))}</span>
                </button>
                {hasImg && (
                  <button className="ctx-btn" onClick={()=>{ removeImage(k); }}>
                    <span className="material-symbols-rounded">hide_image</span>
                    <span>{window.t('Quitar', 'Remove')}</span>
                  </button>
                )}
                <div className="ctx-sep-h"/>
                <div style={{padding:'2px 4px 4px', fontSize:9, fontWeight:700, color:'var(--ink-3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', textAlign:'center'}}>
                  {window.t('Color', 'Color')}
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, padding:'2px 8px 6px', justifyItems:'center'}}>
                  {DAY_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={()=>{ setDayColor(k, c === '#FFFFFF' ? null : c); }}
                      style={{
                        width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
                        background: c, padding: 0,
                        border: dayColors[k] === c ? '2px solid var(--wine)' : '1.5px solid var(--line-soft)',
                      }}
                    />
                  ))}
                </div>
                {hasEvents && (
                  <>
                    <div className="ctx-sep-h"/>
                    <button className="ctx-btn danger" onClick={()=>{ clearDayEvents(k); openDayMenu(null); }}>
                      <span className="material-symbols-rounded">delete_sweep</span>
                      <span>{window.t('Limpiar', 'Clear')}</span>
                    </button>
                  </>
                )}
              </div>
            </>
          ), document.body);
        })()}
        {item.showCaption && (
          <div className="node-caption-row">
            <NodeCaption item={item} lang={lang} onUpdate={onUpdate} autoGrow/>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────── TABLE ────────────────
// Column letter from index: 0 → A, 1 → B, ..., 25 → Z, 26 → AA
function colLetter(n) {
  let s = '';
  n = n + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Convert "A" → 0, "B" → 1, "AA" → 26
function colIndexFromLetters(s) {
  let c = 0;
  for (let i = 0; i < s.length; i++) c = c * 26 + (s.toUpperCase().charCodeAt(i) - 64);
  return c - 1;
}

// Evaluate a formula. Supports SUM/SUBTRACT/AVERAGE/COUNT/MIN/MAX with comma args and ranges (A1:C1),
// cell references (including refs to other formula cells), and basic arithmetic (=A1+B2*2).
function evaluateFormula(formula, cells, _depth = 0) {
  if (!formula || !formula.startsWith('=')) return null;
  if (_depth > 20) return '#REF'; // circular reference guard
  let expr = formula.slice(1).trim();
  try {
    // Resolve a cell's numeric value — evaluating its formula recursively if needed
    const cellNum = (r, c) => {
      const raw = cells[`${r},${c}`]?.value;
      if (raw == null || raw === '') return 0;
      if (typeof raw === 'string' && raw.startsWith('=')) {
        const sub = evaluateFormula(raw, cells, _depth + 1);
        const n = parseFloat(sub);
        return isNaN(n) ? 0 : n;
      }
      const v = parseFloat(raw);
      return isNaN(v) ? 0 : v;
    };
    const refToVal = (ref) => {
      const m = ref.match(/^([A-Za-z]+)(\d+)$/);
      if (!m) return 0;
      return cellNum(parseInt(m[2], 10) - 1, colIndexFromLetters(m[1]));
    };
    const expandRange = (a, b) => {
      const ma = a.match(/^([A-Za-z]+)(\d+)$/), mb = b.match(/^([A-Za-z]+)(\d+)$/);
      if (!ma || !mb) return [];
      const A = { r: parseInt(ma[2],10)-1, c: colIndexFromLetters(ma[1]) };
      const B = { r: parseInt(mb[2],10)-1, c: colIndexFromLetters(mb[1]) };
      const vals = [];
      for (let r = Math.min(A.r,B.r); r <= Math.max(A.r,B.r); r++)
        for (let c = Math.min(A.c,B.c); c <= Math.max(A.c,B.c); c++)
          vals.push(cellNum(r, c));
      return vals;
    };
    const argsToValues = (argStr) => {
      const vals = [];
      argStr.split(',').map(s=>s.trim()).filter(Boolean).forEach(p => {
        if (p.includes(':')) { const [a,b] = p.split(':'); vals.push(...expandRange(a,b)); }
        else if (/^[A-Za-z]+\d+$/.test(p)) vals.push(refToVal(p));
        else { const n = parseFloat(p); if (!isNaN(n)) vals.push(n); }
      });
      return vals;
    };
    // Aggregate functions
    expr = expr.replace(/(SUM|SUBTRACT|AVERAGE|COUNT|MIN|MAX)\s*\(([^)]*)\)/gi, (_, fn, args) => {
      const vals = argsToValues(args);
      let res = 0;
      switch (fn.toUpperCase()) {
        case 'SUM':      res = vals.reduce((a,b)=>a+b,0); break;
        case 'SUBTRACT': res = vals.length ? vals.reduce((a,b)=>a-b) : 0; break;
        case 'AVERAGE':  res = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0; break;
        case 'COUNT':    res = vals.length; break;
        case 'MIN':      res = vals.length ? Math.min(...vals) : 0; break;
        case 'MAX':      res = vals.length ? Math.max(...vals) : 0; break;
      }
      return String(res);
    });
    // Remaining single cell references
    expr = expr.replace(/([A-Za-z]+)(\d+)/g, (m) => String(refToVal(m)));
    if (!/^[\d\s+\-*/().,]*$/.test(expr)) return '#ERR';
    // eslint-disable-next-line no-new-func
    const res = Function('"use strict";return (' + expr + ')')();
    return typeof res === 'number' && !isNaN(res) ? String(Math.round(res * 1e6) / 1e6) : '#ERR';
  } catch { return '#ERR'; }
}

// Formula function suggestions for the cell autocomplete
const FORMULA_FUNCTIONS = [
  { name: 'SUM',      desc: { es:'Suma de un rango',     en:'Sum of a range' } },
  { name: 'SUBTRACT', desc: { es:'Resta (A1-B1-…)',      en:'Subtract (A1-B1-…)' } },
  { name: 'AVERAGE',  desc: { es:'Promedio',             en:'Average' } },
  { name: 'COUNT',    desc: { es:'Contar números',       en:'Count numbers' } },
  { name: 'MIN',      desc: { es:'Mínimo',               en:'Minimum' } },
  { name: 'MAX',      desc: { es:'Máximo',               en:'Maximum' } },
];

function TableItem({ item, lang, onUpdate, editing, selected, onSelectItem, onResize }) {
  const rows = item.rows || 4;
  const cols = item.cols || 3;
  const cells = item.cells || {};
  const title = pickLang(item.title, lang) || '';
  const caption = pickLang(item.caption, lang) || '';
  const bg = window.resolveStickyColor ? window.resolveStickyColor(item.color || 'white') : null;
  const isWhite = !item.color || item.color === 'white';

  const MIN_COL_W = 80;
  const colTemplate = `30px repeat(${cols}, minmax(${MIN_COL_W}px, 1fr))`;

  const [selectedCell, setSelectedCell] = React.useState(null); // 'r,c' — the focus/anchor cell
  const [selRange, setSelRange] = React.useState(null); // { anchor:'r,c', focus:'r,c' } for multi-cell selection
  const [editingCell, setEditingCell] = React.useState(null); // 'r,c'
  const [cellDraft, setCellDraft] = React.useState('');
  const [suggestActive, setSuggestActive] = React.useState(0);
  const boxRef = React.useRef(null);
  const cellInputRef = React.useRef(null);
  // Tracks whether the table item was ALREADY selected at the moment the current gesture started.
  const gestureSelectedRef = React.useRef(false);
  // Fresh refs so the global focusedTableCell methods never use stale editing state
  const editingCellRef = React.useRef(editingCell);
  editingCellRef.current = editingCell;
  const cellDraftRef = React.useRef(cellDraft);
  cellDraftRef.current = cellDraft;
  // Keep fresh dims for the ResizeObserver callback
  const dimsRef = React.useRef({ w: item.w, h: item.h });
  dimsRef.current = { w: item.w, h: item.h };

  // Set of cell keys currently selected (single cell or rectangle)
  const selectedKeys = React.useMemo(() => {
    const set = new Set();
    if (selRange) {
      const [ar, ac] = selRange.anchor.split(',').map(Number);
      const [fr, fc] = selRange.focus.split(',').map(Number);
      for (let r = Math.min(ar,fr); r <= Math.max(ar,fr); r++)
        for (let c = Math.min(ac,fc); c <= Math.max(ac,fc); c++)
          set.add(`${r},${c}`);
    } else if (selectedCell) {
      set.add(selectedCell);
    }
    return set;
  }, [selRange, selectedCell]);

  // Clear cell selection when the canvas item is no longer selected
  React.useEffect(() => {
    if (!selected) {
      // Persist any in-progress edit before clearing (onBlur won't fire on unmount)
      if (editingCellRef.current != null) updateCellValue(editingCellRef.current, cellDraftRef.current);
      setSelectedCell(null);
      setSelRange(null);
      setEditingCell(null);
      setCellDraft('');
    }
  }, [selected]);

  // Enforce a minimum height (rows fill the rest) and a minimum width (columns need room).
  // Rows stretch to fill any extra height, so the user can resize taller without white space.
  React.useEffect(() => {
    const TITLE = (item.showTitle === true) ? 36 : 0;
    const minH = 32 + TITLE + rows * 30 + 4;
    const minW = 30 + cols * MIN_COL_W + 4;
    const patch = {};
    if ((item.h || 0) < minH) patch.h = minH;
    if ((item.w || 0) < minW) patch.w = minW;
    // Silent resize so it doesn't pollute the undo history
    if (Object.keys(patch).length) (onResize || onUpdate)(patch);
  }, [rows, cols, item.showTitle]);

  // Are we currently building a formula in some cell?
  const buildingFormula = editingCell && cellDraft.trim().startsWith('=');
  // Live preview of a range being dragged while building a formula
  const [rangePreview, setRangePreview] = React.useState(null); // { start: 'r,c', end: 'r,c' }

  // Start a click/drag selection over cells to insert a reference or range into the formula
  const startRefDrag = (startKey, e) => {
    e.preventDefault(); // keep the editing input focused
    let endKey = startKey;
    setRangePreview({ start: startKey, end: startKey });
    const onMove = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const cellEl = el && el.closest ? el.closest('[data-cell-key]') : null;
      // Only accept cells that belong to THIS table (avoids selecting cells from another table)
      if (cellEl && cellEl.dataset.cellKey && cellEl.dataset.tableId === item.id) {
        const k = cellEl.dataset.cellKey;
        const [r, c] = k.split(',').map(Number);
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          endKey = k;
          setRangePreview({ start: startKey, end: endKey });
        }
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setRangePreview(null);
      // Single click (no drag): toggle — if the reference is already in the formula, remove it
      if (startKey === endKey) {
        const ref = keyToRef(startKey);
        const tokenRe = new RegExp('\\b' + ref + '\\b');
        if (tokenRe.test(cellDraftRef.current)) { removeRef(ref); return; }
        insertRef(ref);
        return;
      }
      insertRef(`${keyToRef(startKey)}:${keyToRef(endKey)}`);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Normal cell selection drag (Excel-style): click to select one, drag to select a rectangle
  const startSelectDrag = (startKey, e) => {
    e.stopPropagation();
    // Persist any in-progress edit before switching cells (onBlur won't fire on unmount)
    if (editingCellRef.current != null) updateCellValue(editingCellRef.current, cellDraftRef.current);
    setSelectedCell(startKey);
    setSelRange({ anchor: startKey, focus: startKey });
    setEditingCell(null);
    setCellDraft('');
    let moved = false;
    const onMove = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const cellEl = el && el.closest ? el.closest('[data-cell-key]') : null;
      if (cellEl && cellEl.dataset.cellKey && cellEl.dataset.tableId === item.id) {
        const k = cellEl.dataset.cellKey;
        const [r, c] = k.split(',').map(Number);
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          moved = true;
          setSelRange({ anchor: startKey, focus: k });
          setSelectedCell(k);
        }
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!moved) setSelRange({ anchor: startKey, focus: startKey });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Move cell selection helper for keyboard navigation
  const moveCell = (dr, dc, save = true) => {
    if (!selectedCell) return;
    const [r, c] = selectedCell.split(',').map(Number);
    const nr = Math.max(0, Math.min(rows - 1, r + dr));
    const nc = Math.max(0, Math.min(cols - 1, c + dc));
    if (save && editingCell) {
      updateCellValue(editingCell, cellDraft);
    }
    const key = `${nr},${nc}`;
    setSelectedCell(key);
    setSelRange({ anchor: key, focus: key });
    setEditingCell(key);
    setCellDraft(cells[key]?.value || '');
  };

  const clampCell = (key, newRows, newCols) => {
    if (!key) return null;
    const [r, c] = key.split(',').map(Number);
    if (r >= newRows || c >= newCols) return null;
    return `${Math.min(r, newRows - 1)},${Math.min(c, newCols - 1)}`;
  };

  // Expose the selected cell + updater globally so the context sidebar can edit it
  React.useEffect(() => {
    if (selectedCell != null) {
      window._focusedTableCell = {
        itemId: item.id,
        cellKey: selectedCell,
        cellData: cells[selectedCell] || {},
        // Apply a patch to ALL currently selected cells (range or single)
        updateCell: (patch) => {
          const next = { ...cells };
          const keys = selectedKeys.size ? Array.from(selectedKeys) : [selectedCell];
          keys.forEach(k => { next[k] = { ...(next[k] || {}), ...patch }; });
          onUpdate({ cells: next });
        },
        addRow: () => {
          // Grow the node by one row's current height so rows stay consistent
          const headersH = 32 + (item.showTitle === true ? 36 : 0) + 4;
          const rowH = Math.max(30, ((item.h || 220) - headersH) / rows);
          onUpdate({ rows: rows + 1, h: Math.round((item.h || 220) + rowH) });
        },
        addCol: () => {
          const colW = Math.max(MIN_COL_W, ((item.w || 380) - 30) / cols);
          onUpdate({ cols: cols + 1, w: Math.round((item.w || 380) + colW) });
        },
        removeRow: () => {
          if (rows <= 1) return;
          // Remove the LAST row (preserves data in rows 1, 2, 3…)
          const lastR = rows - 1;
          const next = {};
          Object.keys(cells).forEach(k => {
            const [r, c] = k.split(',').map(Number);
            if (r < lastR) next[k] = cells[k];
          });
          const headersH = 32 + (item.showTitle === true ? 36 : 0) + 4;
          const rowH = Math.max(30, ((item.h || 220) - headersH) / rows);
          onUpdate({ rows: rows - 1, cells: next, h: Math.round(Math.max(headersH + 30, (item.h || 220) - rowH)) });
          // Keep selection valid
          const [sr, sc] = selectedCell.split(',').map(Number);
          if (sr >= lastR) { const k = `${lastR - 1},${sc}`; setSelectedCell(k); setSelRange({ anchor: k, focus: k }); }
        },
        removeCol: () => {
          if (cols <= 1) return;
          // Remove the LAST column (preserves data in columns A, B, C…)
          const lastC = cols - 1;
          const next = {};
          Object.keys(cells).forEach(k => {
            const [r, c] = k.split(',').map(Number);
            if (c < lastC) next[k] = cells[k];
          });
          const colW = Math.max(MIN_COL_W, ((item.w || 380) - 30) / cols);
          onUpdate({ cols: cols - 1, cells: next, w: Math.round(Math.max(30 + MIN_COL_W, (item.w || 380) - colW)) });
          const [sr, sc] = selectedCell.split(',').map(Number);
          if (sc >= lastC) { const k = `${sr},${lastC - 1}`; setSelectedCell(k); setSelRange({ anchor: k, focus: k }); }
        },
        clearCellSelection: () => { setSelectedCell(null); setSelRange(null); setEditingCell(null); },
        startFormula: () => {
          setSelRange({ anchor: selectedCell, focus: selectedCell });
          setEditingCell(selectedCell);
          setCellDraft('=');
          setSuggestActive(0);
        },
        isEditingCell: () => editingCellRef.current != null,
        moveSelection: (dr, dc) => {
          const [r, c] = selectedCell.split(',').map(Number);
          const nr = Math.max(0, Math.min(rows - 1, r + dr));
          const nc = Math.max(0, Math.min(cols - 1, c + dc));
          const key = `${nr},${nc}`;
          setSelectedCell(key);
          setSelRange({ anchor: key, focus: key });
        },
        typeChar: (ch) => {
          // Excel-style: typing on a selected cell enters edit mode. If already editing
          // this cell (focus race), append instead of replacing — prevents text from resetting.
          if (editingCellRef.current === selectedCell) {
            setCellDraft(cellDraftRef.current + ch);
          } else {
            setSelRange({ anchor: selectedCell, focus: selectedCell });
            setEditingCell(selectedCell);
            setCellDraft(ch);
          }
          setSuggestActive(0);
        },
        editCell: () => {
          // F2 / Enter to edit keeping existing content
          setEditingCell(selectedCell);
          setCellDraft(cells[selectedCell]?.value || '');
        },
        clearContent: () => {
          // Clear value of ALL selected cells (keep formatting). Used by Delete/Backspace.
          const next = { ...cells };
          const keys = selectedKeys.size ? Array.from(selectedKeys) : [selectedCell];
          keys.forEach(k => { if (next[k]) next[k] = { ...next[k], value: '' }; });
          onUpdate({ cells: next });
        },
      };
      window._notifyFocusedRowChanged?.();
    } else {
      if (window._focusedTableCell?.itemId === item.id) {
        window._focusedTableCell = null;
        window._notifyFocusedRowChanged?.();
      }
    }
  }, [selectedCell, selectedKeys, cells, rows, cols, item.id]);

  const updateCellValue = (key, value) => {
    let v = value;
    // Auto-close unbalanced parentheses for formulas
    if (v && v.startsWith('=')) {
      const open = (v.match(/\(/g) || []).length;
      const close = (v.match(/\)/g) || []).length;
      if (open > close) v = v + ')'.repeat(open - close);
    }
    const next = { ...cells };
    next[key] = { ...(next[key] || {}), value: v };
    onUpdate({ cells: next });
  };

  // Save the in-progress edit (the input doesn't fire onBlur when it unmounts on cell switch,
  // so we must persist the draft explicitly before changing/clearing the editing cell).
  const commitEdit = () => {
    if (editingCellRef.current != null) {
      updateCellValue(editingCellRef.current, cellDraftRef.current);
    }
  };

  // key "r,c" → "A1"
  const keyToRef = (key) => { const [r, c] = key.split(',').map(Number); return colLetter(c) + (r + 1); };

  // Insert arbitrary text at the cursor of the editing input
  const insertText = (text) => {
    const input = cellInputRef.current;
    if (!input) { setCellDraft(d => d + text); return; }
    const start = input.selectionStart ?? cellDraft.length;
    const end = input.selectionEnd ?? cellDraft.length;
    const nd = cellDraft.slice(0, start) + text + cellDraft.slice(end);
    setCellDraft(nd);
    requestAnimationFrame(() => {
      const el = cellInputRef.current;
      if (el) { el.focus(); const pos = start + text.length; el.setSelectionRange(pos, pos); }
    });
  };

  // Insert a reference (single "A1" or range "A1:C3"), auto-adding a comma when inside function args
  const insertRef = (refStr) => {
    const input = cellInputRef.current;
    const start = input ? (input.selectionStart ?? cellDraft.length) : cellDraft.length;
    const before = cellDraft.slice(0, start);
    const openParens = (before.match(/\(/g) || []).length - (before.match(/\)/g) || []).length;
    const lastChar = before.replace(/\s+$/, '').slice(-1);
    const needsComma = openParens > 0 && /[A-Za-z0-9)]/.test(lastChar);
    insertText((needsComma ? ',' : '') + refStr);
  };

  // Remove a reference token (e.g. "A1") from the formula, cleaning up an adjacent comma
  const removeRef = (refStr) => {
    let d = cellDraftRef.current;
    const tries = [
      new RegExp(',\\s*' + refStr + '\\b'),   // ",A1"
      new RegExp('\\b' + refStr + '\\s*,'),    // "A1,"
      new RegExp('\\b' + refStr + '\\b'),      // "A1"
    ];
    for (const re of tries) {
      if (re.test(d)) { d = d.replace(re, ''); break; }
    }
    setCellDraft(d);
    requestAnimationFrame(() => cellInputRef.current?.focus());
  };

  const showTitle = item.showTitle === true;
  const showCaption = item.showCaption === true;

  // Compute filtered formula suggestions based on what's typed after =
  const showSuggest = editingCell && cellDraft.startsWith('=') && !cellDraft.includes('(');
  const suggestFilter = showSuggest ? cellDraft.slice(1).toUpperCase().trim() : '';
  const suggestList = showSuggest
    ? FORMULA_FUNCTIONS.filter(f => f.name.startsWith(suggestFilter))
    : [];
  const applySuggest = (fnName) => {
    // Re-assert edit mode in case the input blurred when the dropdown was clicked
    if (selectedCell) setEditingCell(selectedCell);
    setCellDraft(`=${fnName}(`);
    requestAnimationFrame(() => cellInputRef.current?.focus());
  };

  // Dropdown screen position — placed right below the selected cell (portal, so it's never clipped)
  const [suggestPos, setSuggestPos] = React.useState(null);
  React.useLayoutEffect(() => {
    if (showSuggest && suggestList.length && cellInputRef.current) {
      const cellEl = cellInputRef.current.closest('.tbl-cell') || cellInputRef.current;
      const r = cellEl.getBoundingClientRect();
      setSuggestPos({ left: r.left, top: r.bottom + 2, width: Math.max(160, r.width) });
    } else {
      setSuggestPos(null);
    }
  }, [showSuggest, editingCell, cellDraft, suggestList.length]);

  // Highlight cells referenced in the formula being built (parsed refs + live drag preview)
  const referencedKeys = React.useMemo(() => {
    const set = new Set();
    if (buildingFormula) {
      // Expand ranges A1:C3 and single refs from the draft
      const upper = cellDraft.toUpperCase();
      const rangeRe = /([A-Z]+)(\d+):([A-Z]+)(\d+)/g;
      let consumed = upper;
      let rm;
      while ((rm = rangeRe.exec(upper))) {
        const c1 = colIndexFromLetters(rm[1]), r1 = parseInt(rm[2],10)-1;
        const c2 = colIndexFromLetters(rm[3]), r2 = parseInt(rm[4],10)-1;
        for (let r = Math.min(r1,r2); r <= Math.max(r1,r2); r++)
          for (let c = Math.min(c1,c2); c <= Math.max(c1,c2); c++)
            if (r >= 0 && c >= 0) set.add(`${r},${c}`);
        consumed = consumed.replace(rm[0], ' '.repeat(rm[0].length));
      }
      const singleRe = /([A-Z]+)(\d+)/g;
      let m;
      while ((m = singleRe.exec(consumed))) {
        const cc = colIndexFromLetters(m[1]);
        const rr = parseInt(m[2], 10) - 1;
        if (rr >= 0 && cc >= 0) set.add(`${rr},${cc}`);
      }
    }
    // Live drag preview
    if (rangePreview) {
      const [sr, sc] = rangePreview.start.split(',').map(Number);
      const [er, ec] = rangePreview.end.split(',').map(Number);
      for (let r = Math.min(sr,er); r <= Math.max(sr,er); r++)
        for (let c = Math.min(sc,ec); c <= Math.max(sc,ec); c++)
          set.add(`${r},${c}`);
    }
    return set;
  }, [buildingFormula, cellDraft, rangePreview]);

  return (
    <div className="table-card" style={{width:'100%', height:'100%'}}>
      <div className="item-card">
        <div ref={boxRef} className="tbl-box" style={{ background: bg }}>
          {/* Title row (if enabled) — above the A,B,C references */}
          {showTitle && (
            <div className="tbl-title-row">
              <input
                className="tbl-title"
                value={title}
                placeholder={window.t('Nueva Tabla', 'New Table')}
                onChange={(e)=>onUpdate({ title: { es: e.target.value, en: e.target.value } })}
                onClick={(e)=>e.stopPropagation()}
                onMouseDown={(e)=>e.stopPropagation()}
                onDoubleClick={(e)=>e.stopPropagation()}
              />
            </div>
          )}
          {/* Column header row */}
          <div className="tbl-colhead-row" style={{gridTemplateColumns: colTemplate, background: isWhite ? null : bg}}>
            <div className="tbl-corner" style={!isWhite ? { background: bg } : null}/>
            {Array.from({length: cols}, (_, c) => (
              <div
                key={c}
                className={`tbl-colhead ${selectedCell && selectedCell.split(',')[1] === String(c) ? 'active' : ''}`}
                style={!isWhite ? { background: bg } : null}
              >
                {colLetter(c)}
              </div>
            ))}
          </div>
          {/* Data rows */}
          <div className="tbl-grid">
            {Array.from({length: rows}, (_, r) => (
              <div key={r} className="tbl-row" style={{gridTemplateColumns: colTemplate}}>
                <div
                  className={`tbl-rownum ${selectedCell && selectedCell.split(',')[0] === String(r) ? 'active' : ''}`}
                  style={!isWhite ? { background: bg } : null}
                >{r + 1}</div>
                {Array.from({length: cols}, (_, c) => {
                  const key = `${r},${c}`;
                  const cell = cells[key] || {};
                  const isSel = selectedCell === key;
                  const isEd = editingCell === key;
                  const displayValue = cell.value && cell.value.startsWith('=')
                    ? evaluateFormula(cell.value, cells)
                    : (cell.value || '');
                  const style = {
                    background: cell.color || 'transparent',
                    fontWeight: cell.bold ? 700 : 400,
                    fontStyle: cell.italic ? 'italic' : 'normal',
                    textDecoration: [cell.underline && 'underline', cell.strike && 'line-through'].filter(Boolean).join(' ') || 'none',
                    textAlign: cell.align || 'left',
                    color: cell.textColor || 'inherit',
                  };
                  return (
                    <div
                      key={c}
                      data-cell-key={key}
                      data-table-id={item.id}
                      className={`tbl-cell ${selectedKeys.has(key) ? 'selected' : ''} ${selectedCell === key ? 'focus' : ''} ${referencedKeys.has(key) ? 'ref-highlight' : ''}`}
                      style={style}
                      onClick={(e)=>e.stopPropagation()}
                      onDoubleClick={(e)=>{
                        e.stopPropagation();
                        if (buildingFormula && editingCell !== key) return;
                        setSelectedCell(key);
                        setSelRange({ anchor: key, focus: key });
                        setEditingCell(key);
                        setCellDraft(cell.value || '');
                      }}
                      onMouseDown={(e)=>{
                        e.stopPropagation();
                        // Formula building: click/drag over cells to insert a reference or range
                        if (buildingFormula && editingCell !== key) {
                          startRefDrag(key, e);
                          return;
                        }
                        // First gesture on a not-yet-selected table only selects the node
                        gestureSelectedRef.current = !!selected;
                        if (!selected) { if (onSelectItem) onSelectItem(item.id); return; }
                        // Excel-style: click selects the cell, drag selects a range (no edit until double-click)
                        startSelectDrag(key, e);
                      }}
                    >
                      {isEd ? (
                        <>
                          <input
                            autoFocus
                            key="tbl-cell-edit"
                            ref={cellInputRef}
                            name="tbl-cell-edit"
                            autoComplete="off"
                            data-lpignore="true"
                            className="tbl-cell-input"
                            value={cellDraft}
                            style={{textAlign: cell.align || 'left'}}
                            onClick={(e)=>e.stopPropagation()}
                            onMouseDown={(e)=>e.stopPropagation()}
                            onChange={(e)=>{ setCellDraft(e.target.value); setSuggestActive(0); }}
                            onBlur={()=>{ updateCellValue(key, cellDraft); setEditingCell(null); setCellDraft(''); }}
                            onKeyDown={(e)=>{
                              // Formula suggestion navigation takes priority
                              if (showSuggest && suggestList.length) {
                                if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestActive(i => (i + 1) % suggestList.length); return; }
                                if (e.key === 'ArrowUp')   { e.preventDefault(); setSuggestActive(i => (i - 1 + suggestList.length) % suggestList.length); return; }
                                if (e.key === 'Tab' || e.key === 'Enter') {
                                  e.preventDefault();
                                  const fn = suggestList[suggestActive] || suggestList[0];
                                  if (fn) applySuggest(fn.name);
                                  return;
                                }
                                if (e.key === 'Escape') { setEditingCell(null); setCellDraft(''); return; }
                              }
                              // Excel-like navigation
                              if (e.key === 'Tab') {
                                e.preventDefault();
                                moveCell(0, e.shiftKey ? -1 : 1);
                                return;
                              }
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                moveCell(e.shiftKey ? -1 : 1, 0);
                                return;
                              }
                              if (e.key === 'Escape') { setEditingCell(null); setCellDraft(''); e.target.blur(); return; }
                              // (arrow keys move the text cursor while editing — like Excel)
                            }}
                          />
                          {showSuggest && suggestList.length > 0 && suggestPos && ReactDOM.createPortal(
                            <div
                              className="tbl-formula-suggest"
                              style={{ position:'fixed', left: suggestPos.left, top: suggestPos.top, minWidth: suggestPos.width }}
                              onMouseDown={(e)=>e.preventDefault()}
                            >
                              {suggestList.map((f, i) => (
                                <button
                                  key={f.name}
                                  className={`tbl-formula-suggest-item ${i === suggestActive ? 'active' : ''}`}
                                  onMouseDown={(e)=>{ e.preventDefault(); e.stopPropagation(); }}
                                  onClick={(e)=>{ e.stopPropagation(); applySuggest(f.name); }}
                                  onMouseEnter={()=>setSuggestActive(i)}
                                >
                                  {f.name}
                                  <span className="desc">{f.desc[lang]}</span>
                                </button>
                              ))}
                              <div className="tbl-formula-help">
                                {window.t('↑↓ navegar · Tab/Enter elegir', '↑↓ navigate · Tab/Enter pick')}
                              </div>
                            </div>,
                            document.body
                          )}
                        </>
                      ) : (
                        <span className="tbl-cell-view">{displayValue}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────── COMMENT ────────────────
// Behaves like a Note (rich contentEditable + text-format sidebar) but with a
// user header (avatar + name) on top.
function CommentItem({ item, lang, onUpdate, editing }) {
  const ref = React.useRef(null);
  const html = (item.text && (item.text[lang] || item.text.es || item.text.en)) || '';
  const bg = window.resolveStickyColor ? window.resolveStickyColor(item.color || 'cream') : null;
  const isDarkBg = ['olive','wine','dark','green','red','purple'].includes(item.color);

  React.useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== html) ref.current.innerHTML = html;
  }, [html, lang, editing]);

  // Focus the editor and drop the caret at the end when entering edit mode
  React.useEffect(() => {
    if (!editing || !ref.current) return;
    ref.current.focus();
    const r = document.createRange();
    r.selectNodeContents(ref.current);
    r.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }, [editing]);

  const onInput = () => {
    if (!ref.current) return;
    onUpdate({ text: { es: ref.current.innerHTML, en: ref.current.innerHTML } });
  };

  return (
    <div className="comment-card" style={{width:'100%', height:'100%'}}>
      <div className="item-card" style={{ background: bg, color: isDarkBg ? 'white' : 'inherit' }}>
        <div className="comment-head">
          <div className="comment-avatar" style={{background: COLOR_HEX_RESOLVED[colorClass(item.avatarColor || 'sage')]}}>
            {item.avatar || 'A'}
          </div>
          <div className="comment-name">{item.name}</div>
        </div>
        {editing ? (
          <div
            ref={ref}
            className="note-edit rich comment-rich"
            contentEditable
            suppressContentEditableWarning
            spellCheck={true}
            data-placeholder={window.t('Escribe un comentario…', 'Write a comment…')}
            onInput={onInput}
            onClick={(e)=>e.stopPropagation()}
            onMouseDown={(e)=>e.stopPropagation()}
            onKeyDown={(e)=>{ if (e.key==='Escape') e.target.blur(); }}
            style={{ color: isDarkBg ? 'white' : 'inherit' }}
          />
        ) : (
          <div ref={ref} className="note-inner rich comment-rich" style={{ color: isDarkBg ? 'white' : 'inherit' }}/>
        )}
        {item.showCaption && (
          <div className="node-caption-row">
            <NodeCaption item={item} lang={lang} onUpdate={onUpdate} autoGrow/>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────── AUDIO ────────────────
// Helper: luminance-based dark-color check (same logic as Column strip)
function isAudioColorDark(hex) {
  if (!hex || hex === '#FFFFFF' || hex === '#ffffff') return false;
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Relative luminance formula
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.5;
}

function AudioItem({ item, lang, onUpdate }) {
  const audioRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const hasAudio = !!item.src;

  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [editingName, setEditingName] = React.useState(false);
  const [nameInput, setNameInput] = React.useState('');
  const nameInputRef = React.useRef(null);

  // Sync loop state to DOM
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = !!item.loop;
    }
  }, [item.loop]);

  // Handle source changes - restart playback state if src changes
  React.useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [item.src]);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setPlaying(true))
        .catch(err => console.error("Playback failed:", err));
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const nextMute = !muted;
    audioRef.current.muted = nextMute;
    setMuted(nextMute);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
    setPlaying(false);
    setCurrentTime(0);
  };

  const handleScrub = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const val = parseFloat(e.target.value);
    audioRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const triggerFilePick = (e) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      alert(window.t('Por favor selecciona un archivo de audio válido.', 'Please select a valid audio file.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onUpdate({
        src: reader.result,
        name: file.name,
        _originalName: file.name,
        size: file.size
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startEditName = (e) => {
    e.stopPropagation();
    setNameInput(item.name || item._originalName || 'audio.mp3');
    setEditingName(true);
  };

  const commitName = () => {
    const trimmed = nameInput.trim();
    // If empty, revert to the original filename stored when the file was first loaded
    const resolved = trimmed || item._originalName || 'audio.mp3';
    onUpdate({ name: resolved });
    setEditingName(false);
  };

  const formatTime = (time) => {
    if (isNaN(time) || time === Infinity) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1).replace('.', ',')} MB`;
  };

  const bg = window.resolveStickyColor ? window.resolveStickyColor(item.color || 'white') : '#FFFFFF';
  const isDark = isAudioColorDark(bg);
  const nameColor = isDark ? 'white' : 'inherit';
  const metaColor = isDark ? 'rgba(255,255,255,0.65)' : 'var(--ink-3)';

  if (!hasAudio) {
    return (
      <div className="audio-card empty" style={{ width: '100%', height: '100%' }}>
        <div className="item-card" style={{ backgroundColor: bg }}>
          <div className="audio-empty" onClick={triggerFilePick}>
            <span className="material-symbols-rounded">cloud_upload</span>
            <span style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>
              {window.t('Clic para subir un audio', 'Click to upload audio')}
            </span>
            <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={onFileChange} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="audio-card" style={{ width: '100%', height: '100%' }}>
      <div className="item-card" style={{ backgroundColor: bg }}>
        {/* Custom audio element */}
        <audio
          ref={audioRef}
          src={displayMediaSrc(item)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />

        {/* Custom Player Header — header itself is draggable; only the controls stop propagation */}
        <div className="audio-player-header">
          <button className="audio-play-btn" onClick={togglePlay} onMouseDown={(e)=>e.stopPropagation()} title={playing ? 'Pause' : 'Play'}>
            <span className="material-symbols-rounded">{playing ? 'pause' : 'play_arrow'}</span>
          </button>

          <button className="audio-volume-btn" onClick={toggleMute} onMouseDown={(e)=>e.stopPropagation()} title={muted ? 'Unmute' : 'Mute'}>
            <span className="material-symbols-rounded">{muted ? 'volume_off' : 'volume_up'}</span>
          </button>

          <div className="audio-scrubber-container">
            <input
              type="range"
              className="audio-scrubber"
              min={0}
              max={duration || 100}
              value={currentTime || 0}
              onChange={handleScrub}
              onMouseDown={(e)=>e.stopPropagation()}
            />
            <div
              className="audio-scrubber-progress"
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
            />
          </div>

          <div className="audio-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Card Body */}
        <div className="audio-body">
          {/* Music file icon */}
          <svg className="audio-file-icon" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 0H3C1.35 0 0 1.35 0 3V35C0 36.65 1.35 38 3 38H29C30.65 38 32 36.65 32 35V10L22 0Z" fill="#F1F3F5"/>
            <path d="M22 0V10H32L22 0Z" fill="#DCDCE0"/>
            <path d="M3 36.5H29C29.8284 36.5 30.5 35.8284 30.5 35V11H21V1.5H3C2.17157 1.5 1.5 2.17157 1.5 3V35C1.5 35.8284 2.17157 36.5 3 36.5Z" stroke="var(--line)" strokeWidth="1.5"/>
            <path d="M21 1.5L30.5 11" stroke="var(--line)" strokeWidth="1.5"/>
            <circle cx="11" cy="24" r="2.5" fill="#4A90E2" stroke="var(--line)" strokeWidth="1.25"/>
            <circle cx="19" cy="21" r="2.5" fill="#4A90E2" stroke="var(--line)" strokeWidth="1.25"/>
            <path d="M13.5 24V14H21.5V21" stroke="var(--line)" strokeWidth="1.25" fill="none"/>
            <path d="M13.5 17.5H21.5" stroke="var(--line)" strokeWidth="1.25"/>
          </svg>

          <div className="audio-details">
            {item.showTitle !== false && (editingName ? (
              <input
                ref={nameInputRef}
                className="audio-name-input"
                value={nameInput}
                style={{ color: nameColor }}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    if (e.key === 'Escape') setNameInput(item.name || item._originalName || 'audio.mp3');
                    nameInputRef.current?.blur();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="audio-file-name"
                title={item.name || 'audio.mp3'}
                style={{ color: nameColor, cursor: 'text' }}
                onDoubleClick={startEditName}
              >
                {item.name || 'audio.mp3'}
              </div>
            ))}
            <div className="audio-actions" onMouseDown={(e) => e.stopPropagation()} style={{ color: metaColor }}>
              <a
                className="audio-download-link"
                href={item.src}
                download={item.name || 'audio.mp3'}
                style={{ color: metaColor }}
              >
                {window.t('Descargar', 'Download')}
              </a>
              <span>-</span>
              <span>{formatSize(item.size)}</span>
            </div>
          </div>
        </div>

        {/* Caption Row */}
        {item.showCaption && (
          <div className="audio-caption-row">
            <NodeCaption item={item} lang={lang} onUpdate={onUpdate} className="audio-caption-input" autoGrow/>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────── COLOR ────────────────
// Curated named colors (Name-That-Color style) — used to label a swatch by nearest match.
const COLOR_NAMES = [
  ['Black','#000000'],['White','#FFFFFF'],['Gray','#808080'],['Silver','#C0C0C0'],
  ['Gallery','#EFEFEF'],['Dove Gray','#666666'],['Mine Shaft','#333333'],['Boulder','#7A7A7A'],
  ['Red','#E6544F'],['Crimson','#D7263D'],['Monza','#C00A1E'],['Cardinal','#C41E3A'],
  ['Coral','#FF7F50'],['Salmon','#FA8072'],['Tomato','#FF6347'],['Burnt Sienna','#E97451'],
  ['Orange','#F5A66B'],['Carrot Orange','#ED9121'],['Tangerine','#F28500'],['Pumpkin','#FF7518'],
  ['Gold','#DDAF2C'],['Sunglow','#FFCC33'],['Mustard','#FFDB58'],['Cream Can','#F7DA84'],
  ['Yellow','#F2D14E'],['Khaki','#C3B091'],['Olive','#6A8546'],['Olivine','#9AB973'],
  ['Sushi','#90B968'],['Green','#3DA35D'],['Forest Green','#228B22'],['Fern','#5FB878'],
  ['Sea Green','#2E8B57'],['Jade','#00A86B'],['Emerald','#2ECC71'],['Spring Green','#00FA9A'],
  ['Teal','#008080'],['Tradewind','#56B3A7'],['Gossamer','#079E8B'],['Persian Green','#00A693'],
  ['Turquoise','#40E0D0'],['Cyan','#22B8CF'],['Pacific Blue','#0093C4'],['Cerulean','#02A4D3'],
  ['Sky','#8AC1E8'],['Picton Blue','#45B1E8'],['Dodger Blue','#3B82F6'],['Blue','#3D5A80'],
  ['Royal Blue','#4169E1'],['Navy','#2C3E70'],['Denim','#1560BD'],['Indigo','#4B0082'],
  ['Lavender','#B084D0'],['Purple','#955BA5'],['Amethyst','#9966CC'],['Violet','#7C5CBF'],
  ['Plum','#8E4585'],['Magenta','#C2185B'],['Pink','#E58AB8'],['Rose','#F472B6'],
  ['Cerise','#DE3163'],['Hot Pink','#FF69B4'],['Wine','#993844'],['Maroon','#7B1E2B'],
  ['Brown','#8B5A2B'],['Chocolate','#7B3F00'],['Tan','#D2B48C'],['Beige','#E8DCC0'],
  ['Cream','#FEF7E0'],['Ivory','#FFFFF0'],['Mist','#ECEBEB'],['Slate','#595459'],
];
function nearestColorName(hex) {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return hex || '';
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  let best = COLOR_NAMES[0], bestD = Infinity;
  for (const [name, chex] of COLOR_NAMES) {
    const c = chex.slice(1);
    const dr = r - parseInt(c.slice(0,2),16), dg = g - parseInt(c.slice(2,4),16), db = b - parseInt(c.slice(4,6),16);
    const d = dr*dr + dg*dg + db*db;
    if (d < bestD) { bestD = d; best = [name, chex]; }
  }
  return best[0];
}

function ColorItem({ item, lang, onUpdate }) {
  const hex = (item.hex || '#56B3A7').toUpperCase();
  const showHex = item.showHex !== false;
  const dark = isAudioColorDark(hex);
  const txt = dark ? 'rgba(255,255,255,0.95)' : '#1A1A1A';
  const name = nearestColorName(hex);
  return (
    <div className="color-card" style={{width:'100%', height:'100%'}}>
      <div className="item-card" style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div className="color-swatch" style={{ background: hex, color: txt }}>
          {showHex && <span className="color-hex">{hex}</span>}
        </div>
        <div className="color-name-row">
          <span className="color-name">{name}</span>
        </div>
        {item.showCaption && (
          <div className="node-caption-row">
            <NodeCaption item={item} lang={lang} onUpdate={onUpdate} autoGrow/>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────── FILE ────────────────
function fileKind(ext) {
  const e = (ext || '').toLowerCase();
  if (['png','jpg','jpeg','gif','webp','svg','bmp'].includes(e)) return 'image';
  if (e === 'pdf') return 'pdf';
  if (e === 'docx' || e === 'doc') return 'docx';
  if (['xlsx','xls','ods'].includes(e)) return 'excel';   // SheetJS also reads .ods
  if (['ppt','pptx','odp'].includes(e)) return 'pptx';     // no in-browser renderer
  if (['txt','md','csv','json','js','jsx','ts','tsx','html','css','xml','log','yml','yaml'].includes(e)) return 'text';
  return 'other';
}
function dataUrlToArrayBuffer(src) {
  const b64 = (src || '').split(',')[1] || '';
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}
// docx → html (mammoth) · xlsx → html table (SheetJS); resolves null when unsupported/missing lib
function renderOfficeFile(kind, src) {
  return new Promise((resolve, reject) => {
    try {
      if (kind === 'docx') {
        if (!window.mammoth) return resolve(null);
        window.mammoth.convertToHtml({ arrayBuffer: dataUrlToArrayBuffer(src) })
          .then(r => resolve(r.value || '<p></p>')).catch(reject);
      } else if (kind === 'excel') {
        if (!window.XLSX) return resolve(null);
        const wb = window.XLSX.read(dataUrlToArrayBuffer(src), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Clip the range so a sheet with a huge declared area can't freeze the UI
        if (ws && ws['!ref']) {
          const r = window.XLSX.utils.decode_range(ws['!ref']);
          r.e.r = Math.min(r.e.r, r.s.r + 200);
          r.e.c = Math.min(r.e.c, r.s.c + 30);
          ws['!ref'] = window.XLSX.utils.encode_range(r);
        }
        resolve(`<div class="file-xlsx">${ws ? window.XLSX.utils.sheet_to_html(ws) : ''}</div>`);
      } else resolve(null);
    } catch (err) { reject(err); }
  });
}

// Visual metadata (badge label + accent) for common file types.
function fileMeta(ext) {
  const e = (ext || '').toLowerCase();
  if (e === 'doc' || e === 'docx') return { label: 'W',   color: '#2B579A' };
  if (e === 'xls' || e === 'xlsx' || e === 'csv') return { label: 'X', color: '#217346' };
  if (e === 'ppt' || e === 'pptx') return { label: 'P',   color: '#D24726' };
  if (e === 'odt') return { label: 'ODT', color: '#2B579A' };
  if (e === 'ods') return { label: 'ODS', color: '#217346' };
  if (e === 'odp') return { label: 'ODP', color: '#D24726' };
  if (e === 'pdf') return { label: 'PDF', color: '#E6544F' };
  if (['zip','rar','7z','tar','gz'].includes(e)) return { label: 'ZIP', color: '#9A969A' };
  if (['png','jpg','jpeg','gif','webp','svg','bmp'].includes(e)) return { label: 'IMG', color: '#3CA59E' };
  if (['mp3','wav','ogg','m4a','flac'].includes(e)) return { label: '♪', color: '#955BA5' };
  if (['mp4','mov','avi','webm','mkv'].includes(e)) return { label: '▶', color: '#3D5A80' };
  return { label: (e ? e.slice(0, 4).toUpperCase() : 'FILE'), color: '#595459' };
}

function FileItem({ item, lang, onUpdate, onOpenFile }) {
  const fileInputRef = React.useRef(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [docHtml, setDocHtml] = React.useState(null); // rendered docx preview
  const hasFile = !!item.src;
  const ext = item.fileType || (item.name ? item.name.split('.').pop() : '');
  const meta = fileMeta(ext);
  const showPreview = item.showPreview === true;
  const showInfo = item.showInfo === true;

  const fmtSize = (b) => {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  };

  const onFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true); setProgress(0);
    const reader = new FileReader();
    reader.onprogress = (ev) => { if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100)); };
    reader.onload = () => {
      const fext = (file.name.split('.').pop() || '').toLowerCase();
      onUpdate({ src: reader.result, name: file.name, size: file.size, fileType: fext });
      setUploading(false); setProgress(100);
    };
    reader.onerror = () => setUploading(false);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Auto-open the picker right after the node is created
  React.useEffect(() => {
    if (item._triggerFilePick) { fileInputRef.current?.click(); onUpdate({ _triggerFilePick: false }); }
    // eslint-disable-next-line
  }, [item._triggerFilePick]);

  const kind = fileKind(ext);
  const REF = kind === 'excel' ? 1100 : 794; // excel is landscape/wide; docs are A4-portrait
  const scale = (item.w || 230) / REF;        // render at page width then scale to the node ("like an image")

  // Render docx (mammoth) / excel (SheetJS) → html when previewing
  React.useEffect(() => {
    if (!showPreview || !item.src) return;
    let cancelled = false;
    if (kind === 'docx' || kind === 'excel') {
      setDocHtml('loading');
      renderOfficeFile(kind, item.src).then(h => { if (!cancelled) setDocHtml(h); }).catch(() => { if (!cancelled) setDocHtml(null); });
    }
    return () => { cancelled = true; };
  }, [showPreview, kind, item.src]);

  // Uploading state
  if (uploading) {
    return (
      <div className="file-card" style={{width:'100%', height:'100%'}}>
        <div className="item-card file-uploading">
          <div className="file-icon" style={{ '--file-accent': '#9A969A' }}>
            <span className="file-icon-label">{window.t('Subiendo', 'Uploading')}</span>
            <div className="file-progress"><div className="file-progress-bar" style={{ width: `${progress}%` }}/></div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state (no file yet) — click to upload
  if (!hasFile) {
    return (
      <div className="file-card" style={{width:'100%', height:'100%'}}>
        <div className="item-card">
          <div className="file-empty" onClick={(e)=>{ e.stopPropagation(); fileInputRef.current?.click(); }}>
            <span className="material-symbols-rounded">upload_file</span>
            <span style={{fontSize:11, fontWeight:700, textAlign:'center'}}>{window.t('Clic para subir un archivo', 'Click to upload a file')}</span>
          </div>
          <input ref={fileInputRef} type="file" style={{display:'none'}} onChange={onFileChange}/>
        </div>
      </div>
    );
  }

  const cardBg = window.resolveStickyColor ? window.resolveStickyColor(item.color || 'white') : '#fff';
  return (
    <div className="file-card" style={{width:'100%', height:'100%'}}>
      <div className="item-card" style={{ display:'flex', flexDirection:'column', overflow:'hidden', backgroundColor: cardBg }}>
        {showPreview ? (
          <>
            <div
              className="file-preview"
              onDoubleClick={(e)=>{ e.stopPropagation(); onOpenFile && onOpenFile(item.id); }}
              title={window.t('Doble clic para ver completo', 'Double-click to view full')}
            >
              {kind === 'image' && <img src={window.resolveMediaSrc(item.src)} alt={item.name} onError={driveImageFallback}/>}
              {kind === 'pdf' && <iframe title={item.name} src={window.resolveMediaSrc(item.src)}/>}
              {kind === 'text' && (
                <div className="file-page-scale" style={{ width: REF, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  <FilePreviewText src={window.resolveMediaSrc(item.src)}/>
                </div>
              )}
              {(kind === 'docx' || kind === 'excel') && (
                docHtml && docHtml !== 'loading'
                  ? <div className="file-page-scale" style={{ width: REF, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                      <div className="file-doc-html" dangerouslySetInnerHTML={{ __html: docHtml }}/>
                    </div>
                  : <div className="file-preview-empty"><span className="material-symbols-rounded">{docHtml==='loading'?'hourglass_top':'description'}</span><span>{docHtml==='loading'?(window.t('Generando vista…', 'Rendering…')):(window.t('Sin vista previa', 'No preview'))}</span></div>
              )}
              {(kind === 'pptx' || kind === 'other') && (
                <div className="file-preview-empty">
                  <div className="file-icon" style={{ '--file-accent': meta.color }}><span className="file-icon-label">{meta.label}</span></div>
                  <span>{window.t('Sin vista previa', 'No preview')}</span>
                </div>
              )}
            </div>
            {showInfo && (
              <div className="file-info-row">
                <span className="file-info-name" title={item.name}>{item.name}</span>
                <span className="file-info-size">{fmtSize(item.size)}</span>
              </div>
            )}
          </>
        ) : (
          <div className="file-compact" onDoubleClick={(e)=>{ e.stopPropagation(); fileInputRef.current?.click(); }}>
            <div className="file-icon" style={{ '--file-accent': meta.color }}>
              <span className="file-icon-label">{meta.label}</span>
            </div>
            <div className="file-name" title={item.name}>{item.name}</div>
            <div className="file-size">{fmtSize(item.size)}</div>
          </div>
        )}
        <input ref={fileInputRef} type="file" style={{display:'none'}} onChange={onFileChange}/>
      </div>
    </div>
  );
}

// Decodes a base64 text dataURL for inline preview
function FilePreviewText({ src }) {
  const [txt, setTxt] = React.useState('');
  React.useEffect(() => {
    try {
      const b64 = src.split(',')[1] || '';
      setTxt(decodeURIComponent(escape(atob(b64))));
    } catch { setTxt(''); }
  }, [src]);
  return <pre className="file-text-preview">{txt}</pre>;
}

// ──────────────── FILE VIEWER (read-only, large, dark backdrop) ────────────────
function FileViewerModal({ fileItem, lang, onClose }) {
  const ext = (fileItem.fileType || (fileItem.name ? fileItem.name.split('.').pop() : '') || '').toLowerCase();
  const kind = fileKind(ext);
  const meta = fileMeta(ext);
  const [docHtml, setDocHtml] = React.useState(null);

  React.useEffect(() => {
    if ((kind !== 'docx' && kind !== 'excel') || !fileItem.src) return;
    let cancelled = false;
    renderOfficeFile(kind, fileItem.src).then(h => { if (!cancelled) setDocHtml(h); }).catch(() => { if (!cancelled) setDocHtml(null); });
    return () => { cancelled = true; };
  }, [kind, fileItem.src]);

  React.useEffect(() => {
    const onKey = (ev) => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="doc-modal-backdrop file-viewer-backdrop" onMouseDown={onClose}>
      <div className="file-viewer" onMouseDown={(ev)=>ev.stopPropagation()}>
        <div className="file-viewer-head">
          <div className="file-icon file-icon-sm" style={{ '--file-accent': meta.color }}><span className="file-icon-label">{meta.label}</span></div>
          <span className="file-viewer-name" title={fileItem.name}>{fileItem.name}</span>
          {kind !== 'pdf' && (
            <a className="btn btn-ghost" href={fileItem.src} download={fileItem.name}>
              <span className="material-symbols-rounded">download</span>
              {window.t('Descargar', 'Download')}
            </a>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            <span className="material-symbols-rounded">close</span>
            {window.t('Cerrar', 'Close')}
          </button>
        </div>
        <div className={`file-viewer-body kind-${kind}`}>
          {kind === 'image' && <img src={window.resolveMediaSrc(fileItem.src)} alt={fileItem.name} onError={driveImageFallback}/>}
          {kind === 'pdf' && <iframe title={fileItem.name} src={window.resolveMediaSrc(fileItem.src)}/>}
          {kind === 'text' && <FilePreviewText src={window.resolveMediaSrc(fileItem.src)}/>}
          {(kind === 'docx' || kind === 'excel') && (
            docHtml
              ? <div className="file-doc-html file-doc-page" dangerouslySetInnerHTML={{ __html: docHtml }}/>
              : <div className="file-preview-empty"><span className="material-symbols-rounded">hourglass_top</span><span>{window.t('Generando vista…', 'Rendering…')}</span></div>
          )}
          {(kind === 'pptx' || kind === 'other') && (
            <div className="file-preview-empty">
              <div className="file-icon" style={{ '--file-accent': meta.color }}><span className="file-icon-label">{meta.label}</span></div>
              <span>{window.t('Sin vista previa · usa Descargar', 'No preview · use Download')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FrameItem({ item, lang, editing, onUpdate, callbacks }) {
  const text = pickLang(item.title, lang);
  const cls = item.color === 'green' ? 'olive' : (item.color || 'transparent');
  const align = item.titleAlign || 'left';
  const titleColor = item.titleColor || 'inherit';
  const titleSize = item.titleSize || 14;

  const handleTitleChange = (val) => {
    onUpdate({ title: { es: val, en: val } });
  };

  const increaseSize = (e) => {
    e.stopPropagation();
    const sizes = [12, 14, 18, 24, 30, 36, 48, 60];
    const idx = sizes.indexOf(titleSize);
    const next = idx < sizes.length - 1 ? sizes[idx + 1] : sizes[sizes.length - 1];
    onUpdate({ titleSize: next });
  };

  const decreaseSize = (e) => {
    e.stopPropagation();
    const sizes = [12, 14, 18, 24, 30, 36, 48, 60];
    const idx = sizes.indexOf(titleSize);
    const next = idx > 0 ? sizes[idx - 1] : sizes[0];
    onUpdate({ titleSize: next });
  };

  return (
    <div className={`frame-card c-${cls}`} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div 
        className="frame-header" 
        style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '6px 12px', 
          borderBottom: '1px dashed var(--line-soft, #E5E1DD)',
          pointerEvents: 'auto',
          cursor: 'move',
          gap: '8px'
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (callbacks && callbacks.startEdit) {
            callbacks.startEdit(item.id);
          }
        }}
      >
        <div style={{ flex: 1, textAlign: align }}>
          {editing ? (
            <input
              type="text"
              value={text}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="frame-title-input"
              style={{ 
                width: '100%', 
                background: 'none', 
                border: 'none', 
                outline: 'none', 
                fontWeight: 800,
                fontSize: `${titleSize}px`,
                fontFamily: 'var(--font-display)',
                textAlign: align,
                color: titleColor === 'inherit' ? 'var(--frame-title-color, var(--ink))' : titleColor
              }}
              onClick={(e)=>e.stopPropagation()}
              onMouseDown={(e)=>e.stopPropagation()}
              onBlur={(e) => {
                const v = e.target.value.trim();
                onUpdate({ title: { es: v, en: v } });
                if (callbacks && callbacks.endEdit) {
                  callbacks.endEdit();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.target.blur();
                }
              }}
              placeholder={window.t('Nombre del marco', 'Frame name')}
              autoFocus
            />
          ) : (
            <div 
              className="frame-title" 
              style={{ 
                fontWeight: 800, 
                fontSize: `${titleSize}px`, 
                fontFamily: 'var(--font-display)',
                color: titleColor === 'inherit' ? 'var(--frame-title-color, var(--ink))' : titleColor,
                textAlign: align
              }}
            >
              {text || window.t('Sin título', 'Untitled')}
            </div>
          )}
        </div>
      </div>
      <div className="frame-body" style={{ flex: 1, pointerEvents: 'none' }}>
        {/* Cuerpo vacío transparente para agrupamiento */}
      </div>
    </div>
  );
}

// ──────────────── BIG TITLE ( head heading ) ────────────────
function BigTitleItem({ item, lang, editing, onUpdate }) {
  const text = pickLang(item.content, lang);
  const ref = React.useRef(null);
  const align = item.align || 'center';
  const color = item.textColor || 'inherit';

  React.useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerText !== (text || '')) {
      ref.current.innerText = text || '';
    }
  }, [item.id, text]);

  const onInput = () => {
    if (!ref.current) return;
    onUpdate({ content: { es: ref.current.innerText, en: ref.current.innerText } });
  };

  const hasColor = item.color && item.color !== 'transparent';
  const bg = hasColor && window.resolveStickyColor ? window.resolveStickyColor(item.color) : 'transparent';

  return (
    <div 
      className={`bigtitle-card ${hasColor ? 'has-bg' : ''}`}
      style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: align === 'center' ? 'center' : (align === 'right' ? 'flex-end' : 'flex-start'),
        background: bg,
        border: hasColor ? '1.5px solid var(--line)' : 'none',
        borderRadius: hasColor ? '8px' : '0px',
        boxShadow: hasColor ? 'var(--pop-sm)' : 'none',
        boxSizing: 'border-box',
        padding: hasColor ? '8px 12px' : '0px'
      }}
    >
      <div
        ref={ref}
        contentEditable={editing}
        suppressContentEditableWarning
        className="bigtitle-edit"
        onInput={onInput}
        onClick={(e)=>editing && e.stopPropagation()}
        onMouseDown={(e)=>editing && e.stopPropagation()}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '32px',
          fontWeight: 800,
          textAlign: align,
          color: color === 'inherit' ? 'var(--ink)' : color,
          background: 'none',
          border: 'none',
          outline: 'none',
          width: '100%',
          cursor: editing ? 'text' : 'move',
          padding: '4px'
        }}
        data-placeholder={window.t('Escribe un título…', 'Write a title…')}
      />
    </div>
  );
}

// ──────────────── GOOGLE MAPS PREVIEW ────────────────
const getMapsEmbedUrl = (url) => {
  if (!url) return '';
  let query = url.trim();

  // Si ya es un enlace de embed nativo de Google, usarlo tal cual
  if (query.includes('output=embed') || query.includes('/embed')) {
    return query;
  }

  // Si es un enlace normal de Google Maps del navegador
  if (query.includes('google.com/maps') || query.includes('google.es/maps') || query.includes('google.co/maps') || query.includes('google.com.co/maps')) {
    // 1. Intentar buscar /place/NOMBRE_LUGAR
    const placeMatch = query.match(/\/place\/([^\/]+)/);
    if (placeMatch && placeMatch[1]) {
      try {
        query = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      } catch {
        query = placeMatch[1].replace(/\+/g, ' ');
      }
    } else {
      // 2. Intentar buscar coordenadas de tipo /@LAT,LON
      const coordMatch = query.match(/\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch && coordMatch[1] && coordMatch[2]) {
        query = `${coordMatch[1]},${coordMatch[2]}`;
      }
    }
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
};

function MapItem({ item, lang, onUpdate, editing, onEndEdit, callbacks }) {
  const title = pickLang(item.title, lang);
  const caption = pickLang(item.caption, lang);
  const hasUrl = !!item.url;
  const embedUrl = getMapsEmbedUrl(item.url);
  const align = item.titleAlign || 'left';
  const titleColor = item.titleColor || 'inherit';

  if (!hasUrl || editing) {
    return (
      <div className="map-card empty" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div className="item-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px', justifyContent: 'center', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--text-soft, #595459)' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '24px' }}>map</span>
            <div style={{ fontSize: '11px', fontWeight: '800', marginTop: '2px' }}>
              {window.t('Configurar Mapa de Google', 'Configure Google Map')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--paper-2)', padding: '6px 8px', borderRadius: '4px', border: '1.5px solid var(--line)' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--ink-3)' }}>pin_drop</span>
            <input
              className="link-input"
              autoFocus
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '12.5px', color: 'var(--ink)', width: '100%' }}
              placeholder={window.t('Pega dirección o enlace de Maps…', 'Paste address or Maps link…')}
              value={item.url || ''}
              onClick={(e)=>e.stopPropagation()}
              onMouseDown={(e)=>e.stopPropagation()}
              onChange={(e)=>onUpdate({ url: e.target.value })}
              onBlur={(e)=>{
                const v = e.target.value.trim();
                const patch = { url: v, _editing: false };
                if (v) {
                  patch.w = 340;
                  patch.h = 280;
                }
                onUpdate(patch);
                onEndEdit && onEndEdit();
              }}
              onKeyDown={(e)=>{
                if (e.key === 'Enter' || e.key === 'Escape') e.target.blur();
              }}
            />
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-soft, #595459)', textAlign: 'center', marginTop: '6px' }}>
            {window.t('Enter para confirmar · Esc para salir', 'Enter to confirm · Esc to exit')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-card" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div className="item-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px', boxSizing: 'border-box' }}>
        
        <div className="map-iframe-container" style={{ flex: 1, background: 'var(--bg-2, #ECEAE6)', borderRadius: '4px', overflow: 'hidden', border: '1.5px solid var(--line-soft, #E5E1DD)', minHeight: 0, position: 'relative' }}>
          {embedUrl ? (
            <>
              <iframe
                title="Google Maps Preview"
                src={embedUrl}
                width="100%"
                height="100%"
                style={{ border: 0, display: 'block' }}
                allowFullScreen=""
                loading="lazy"
                onMouseDown={(e)=>e.stopPropagation()}
              />
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px', textAlign: 'center', color: 'var(--text-soft, #595459)', boxSizing: 'border-box' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '32px', marginBottom: '8px' }}>pin_drop</span>
              <div style={{ fontSize: '11.5px', fontWeight: '700' }}>
                {window.t('Sin dirección configurada', 'No address configured')}
              </div>
              <div style={{ fontSize: '10px', marginTop: '4px' }}>
                {window.t('Pega un enlace o dirección en la configuración lateral', 'Paste a link or address in the sidebar settings')}
              </div>
            </div>
          )}
        </div>

        <div className="map-info-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', color: 'var(--text-soft, #595459)', fontSize: '11px', fontFamily: 'var(--font-body)' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '15px', color: '#EA4335' }}>pin_drop</span>
          <span style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1
          }}>
            {item.url}
          </span>
        </div>

        {item.showTitle !== false && (
          item._editingTitle === true ? (
            <input
              type="text"
              className="map-title-input"
              value={title}
              placeholder={window.t('Google Maps', 'Google Maps')}
              onChange={(e) => onUpdate({ title: { es: e.target.value, en: e.target.value } })}
              onClick={(e)=>e.stopPropagation()}
              onMouseDown={(e)=>e.stopPropagation()}
              onBlur={(e) => {
                const v = e.target.value.trim();
                onUpdate({ title: { es: v, en: v }, _editingTitle: false });
              }}
              onKeyDown={(e)=>{
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.target.blur();
                }
              }}
              style={{
                fontWeight: 800,
                fontSize: '14px',
                fontFamily: 'var(--font-display)',
                marginTop: '8px',
                color: titleColor === 'inherit' ? 'var(--ink)' : titleColor,
                textAlign: align,
                width: '100%',
                background: 'none',
                border: 'none',
                outline: 'none',
                padding: 0
              }}
              autoFocus
            />
          ) : (
            <div 
              className="map-title" 
              style={{ 
                fontWeight: 800, 
                fontSize: '14px', 
                fontFamily: 'var(--font-display)', 
                marginTop: '8px', 
                color: titleColor === 'inherit' ? 'var(--ink)' : titleColor,
                textAlign: align,
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onUpdate({ _editingTitle: true });
              }}
            >
              {title || window.t('Google Maps', 'Google Maps')}
            </div>
          )
        )}

        {item.showCaption && (
          <div className="map-caption-wrap" style={{ marginTop: '8px', borderTop: '1px dashed var(--line-soft, #E5E1DD)', paddingTop: '6px' }}>
            <NodeCaption item={item} lang={lang} onUpdate={onUpdate} className="map-caption-input" autoGrow/>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────── TITLE (heading) ────────────────
function TitleItem({ item, lang }) {
  return (
    <div className="title-card" style={{ width: '100%', height: '100%' }}>
      <span className="title-text">{pickLang(item.content, lang)}</span>
    </div>
  );
}

// ──────────────── SWATCH (legacy palette) ────────────────
function SwatchItem({ item, lang }) {
  const colors = item.colors || [];
  return (
    <div className="swatch-card" style={{ width: '100%', height: '100%' }}>
      <div className="item-card">
        <div className="swatch-title">{pickLang(item.title, lang)}</div>
        <div className="swatch-row">
          {colors.map((c, i) => (
            <div key={i} className="swatch-chip" style={{ background: c.hex }} title={`${c.name || ''} ${c.hex}`}>
              <span className="swatch-hex">{c.hex}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────── Dispatcher ────────────────
function ItemRenderer({ item, lang, editing, callbacks }) {
  const cb = callbacks || {};
  const onUpdate = (patch) => {
    if (patch.h !== undefined) {
      console.log('[DEBUG-HEIGHT] ItemRenderer onUpdate height update for item.id =', item.id, 'patch.h =', patch.h);
    }
    if (cb.updateItem) {
      cb.updateItem(item.id, patch);
    } else {
      console.log('[DEBUG-HEIGHT] error: cb.updateItem is undefined in ItemRenderer');
    }
  };
  switch (item.type) {
    case 'note':     return <NoteItem  item={item} lang={lang} editing={editing} onUpdate={onUpdate}/>;
    case 'image':    return <ImageItem item={item} lang={lang} onUpdate={onUpdate} callbacks={cb}/>;
    case 'link':     return <LinkItem  item={item} lang={lang} editing={editing} onUpdate={onUpdate} onEndEdit={cb.endEdit}/>;
    case 'todo':     return <TodoItem  item={item} lang={lang} editing={editing} onUpdate={onUpdate} callbacks={cb}/>;
    case 'column':   return <ColumnItem item={item} lang={lang} editing={editing} onUpdate={onUpdate} callbacks={cb}/>;
    case 'board':    return <BoardItem item={item} lang={lang} editing={editing} onUpdate={onUpdate} onOpenBoard={cb.openBoard} getNestedItems={cb.getNestedItems} onStartEdit={cb.startEdit}/>;
    case 'doc':      return <DocItem   item={item} lang={lang} onOpenDoc={cb.openDoc}/>;
    case 'calendar': return <CalendarItem item={item} lang={lang} editing={editing} onUpdate={onUpdate}/>;
    case 'table':    return <TableItem item={item} lang={lang} editing={editing} onUpdate={onUpdate} selected={cb.isSelectedItem ? cb.isSelectedItem(item.id) : false} onSelectItem={cb.selectItem} onResize={cb.resizeItemSilent}/>;
    case 'comment':  return <CommentItem item={item} lang={lang} editing={editing} onUpdate={onUpdate}/>;
    case 'audio':    return <AudioItem item={item} lang={lang} onUpdate={onUpdate}/>;
    case 'color':    return <ColorItem item={item} lang={lang} onUpdate={onUpdate}/>;
    case 'file':     return <FileItem  item={item} lang={lang} onUpdate={onUpdate} onOpenFile={cb.openFile}/>;
    case 'title':    return <TitleItem item={item} lang={lang}/>;
    case 'swatch':   return <SwatchItem item={item} lang={lang}/>;
    case 'frame':    return <FrameItem item={item} lang={lang} editing={editing} onUpdate={onUpdate} callbacks={cb}/>;
    case 'bigtitle': return <BigTitleItem item={item} lang={lang} editing={editing} onUpdate={onUpdate}/>;
    case 'map':      return <MapItem item={item} lang={lang} editing={editing} onUpdate={onUpdate} onEndEdit={cb.endEdit} callbacks={cb}/>;
    default:         return <NoteItem  item={item} lang={lang}/>;
  }
}


Object.assign(window, {
  ItemRenderer, COLOR_HEX_RESOLVED, STICKY_COLORS_NEW, BOARD_ICONS,
  CATEGORY_COLORS, CATEGORY_HEX,
  colorClass, pickLang, parseLink,
  FileViewerModal,
});
