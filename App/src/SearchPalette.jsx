// =====================================================
// Odinote — buscador global (Ctrl+K)
//
// El buscador del lienzo solo mira la página que tienes delante. Este recorre
// todos los proyectos y todos los tableros anidados, enseña la ruta de cada
// resultado y te lleva hasta él.
//
// La lógica de búsqueda vive en src/search.js (probada aparte con Node); aquí
// solo está la interfaz.
// =====================================================

// mode 'goto' → abrir el resultado (Ctrl+K)
// mode 'link' → devolverlo para enlazarlo desde un texto (al escribir "[[")
function SearchPalette({ open, onClose, projects, canvases, lang, onGoTo, mode }) {
  const linkMode = mode === 'link';
  const [query, setQuery] = React.useState('');
  const [cursor, setCursor] = React.useState(0);
  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);

  // Al abrir: campo limpio y con el foco puesto. En móvil no se enfoca solo,
  // para que el teclado no tape la mitad de la pantalla antes de tiempo.
  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    if (!(window.odiIsMobile && window.odiIsMobile())) {
      const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = React.useMemo(() => {
    if (!open || !window.OdiSearch) return [];
    return window.OdiSearch.searchAll({ projects, canvases, query, lang, limit: 40 });
  }, [open, query, projects, canvases, lang]);

  React.useEffect(() => { setCursor(0); }, [query]);

  // Mantener a la vista el resultado señalado al moverse con las flechas
  React.useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('.odi-sp-hit.active');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const go = (hit) => { if (hit) { onGoTo(hit); onClose(); } };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); go(results[cursor]); return; }
  };

  const ICONS = {
    note: 'sticky_note_2', todo: 'checklist', doc: 'description', bigtitle: 'title',
    image: 'image', audio: 'audiotrack', link: 'link', color: 'palette',
    board: 'dashboard', column: 'view_column', table: 'table_chart', frame: 'crop_free',
    calendar: 'calendar_month', comment: 'forum', file: 'draft', map: 'map',
  };

  return (
    <div className="odi-sp-backdrop" onMouseDown={onClose}>
      <div className="odi-sp" onMouseDown={(e) => e.stopPropagation()}>
        <div className="odi-sp-field">
          <span className="material-symbols-rounded">search</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={linkMode
              ? window.t('Enlazar con… (escribe para buscar el nodo)', 'Link to… (type to find the node)')
              : window.t('Buscar en todos los proyectos y tableros…', 'Search every project and board…')}
          />
          <button className="odi-sp-close" onClick={onClose} title={window.t('Cerrar', 'Close')}>
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div className="odi-sp-list" ref={listRef}>
          {query.trim().length < 2 && (
            <div className="odi-sp-empty">
              {linkMode
                ? window.t(
                    'Elige el nodo con el que enlazar este texto. Al pulsarlo, la palabra quedará vinculada y ese nodo mostrará que le apuntas desde aquí.',
                    'Pick the node to link this text to. The word becomes a link, and that node will show it is referenced from here.'
                  )
                : window.t(
                    'Escribe al menos dos letras. Busca dentro de notas, documentos, tareas, tablas y leyendas — también en los tableros anidados.',
                    'Type at least two letters. Searches notes, documents, tasks, tables and captions — nested boards included.'
                  )}
            </div>
          )}
          {query.trim().length >= 2 && results.length === 0 && (
            <div className="odi-sp-empty">
              {window.t('Sin resultados para', 'No results for')} “{query}”
            </div>
          )}
          {results.map((hit, i) => (
            <button
              key={`${hit.canvasId}:${hit.itemId}`}
              className={`odi-sp-hit ${i === cursor ? 'active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(hit)}
            >
              <span className="material-symbols-rounded odi-sp-icon">
                {ICONS[hit.type] || 'sticky_note_2'}
              </span>
              <span className="odi-sp-text">
                <span className="odi-sp-snippet">{hit.snippet}</span>
                <span className="odi-sp-path">
                  {hit.path.map((p, k) => (
                    <React.Fragment key={k}>
                      {k > 0 && <span className="odi-sp-sep">/</span>}
                      <span>{p}</span>
                    </React.Fragment>
                  ))}
                </span>
              </span>
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="odi-sp-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> {window.t('moverse', 'move')}</span>
            <span><kbd>↵</kbd> {window.t('abrir', 'open')}</span>
            <span><kbd>Esc</kbd> {window.t('cerrar', 'close')}</span>
            <span className="odi-sp-count">
              {results.length} {window.t('resultados', 'results')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

window.SearchPalette = SearchPalette;
