// =====================================================
// Odinote — top toolbar v4 (tools draggable to canvas)
// =====================================================

const TOOLS = [
  // Texto / contenido → verde
  { id: 'note',     icon: 'sticky_note_2', label: 'tool_note',     bg: '#90B968', fg: 'white' },
  { id: 'todo',     icon: 'checklist',     label: 'tool_todo',     bg: '#90B968', fg: 'white' },
  { id: 'doc',      icon: 'description',   label: 'tool_doc',      bg: '#90B968', fg: 'white' },
  { id: 'comment',  icon: 'forum',         label: 'tool_comment',  bg: '#90B968', fg: 'white' },
  // Medios / archivos → gris
  { id: 'image',    icon: 'image',         label: 'tool_image',    bg: '#E1DFE3' },
  { id: 'file',     icon: 'draft',         label: 'tool_file',     bg: '#E1DFE3' },
  { id: 'audio',    icon: 'audiotrack',    label: 'tool_audio',    bg: '#E1DFE3' },
  { id: 'link',     icon: 'link',          label: 'tool_link',     bg: '#E1DFE3' },
  { id: 'color',    icon: 'palette',       label: 'tool_color',    bg: '#E1DFE3' },
  // Estructura → rojo
  { id: 'board',    icon: 'dashboard',     label: 'tool_board',    bg: '#E6544F', fg: 'white' },
  { id: 'column',   icon: 'view_column',   label: 'tool_column',   bg: '#E6544F', fg: 'white' },
  { id: 'table',    icon: 'table_chart',   label: 'tool_table',    bg: '#E6544F', fg: 'white' },
  { id: 'calendar', icon: 'calendar_month',label: 'tool_calendar', bg: '#E6544F', fg: 'white' },
  // Conector → blanco
  { id: 'line',     icon: 'arrow_outward', label: 'tool_line',     bg: '#FFFFFF' },
];

function Topbar({
  lang, setLang,
  theme, setTheme,
  crumbs, onCrumb, onCrumbRename,
  activeTool, setActiveTool,
  onHome,
  onUndo, onRedo, canUndo, canRedo,
  onToolDragStart,
  updateAvailable, onUpdateClick,
}) {
  const t = window.TRANSLATIONS[lang];

  const startToolDrag = (e, toolId) => {
    if (e.button !== 0) return;
    if (!onToolDragStart) return;
    // Pass through to canvas: it will track drag and create on drop
    onToolDragStart(e, toolId);
  };

  return (
    <div className="topbar">
      <button className="brand press" onClick={onHome} title={t.home}>
        <div className="brand-mark"><window.BrandMark/></div>
      </button>
      <div className="crumbs">
        {(() => {
          // Collapse long trails to: Inicio · first · … · penultimate · current
          let shown;
          if (crumbs.length <= 5) {
            shown = crumbs.map((c, i) => ({ c, i }));
          } else {
            shown = [
              { c: crumbs[0], i: 0 },
              { c: crumbs[1], i: 1 },
              { ellipsis: true },
              { c: crumbs[crumbs.length - 2], i: crumbs.length - 2 },
              { c: crumbs[crumbs.length - 1], i: crumbs.length - 1 },
            ];
          }
          return shown.map((entry, pos) => {
            if (entry.ellipsis) {
              return (
                <React.Fragment key="ellipsis">
                  <div className="crumb crumb-ellipsis" title={lang==='es'?'Niveles ocultos':'Hidden levels'}>…</div>
                  <span className="crumb-sep">/</span>
                </React.Fragment>
              );
            }
            const { c, i } = entry;
            return (
              <React.Fragment key={c.id || i}>
                <div
                  className="crumb"
                  onClick={()=>onCrumb(i)}
                >
                  {c.chipColor && <div className="crumb-chip" style={{background: c.chipColor}}/>}
                  {!c.chipColor && i === 0 && <span className="material-symbols-rounded" style={{fontSize:14}}>home</span>}
                  <span className="crumb-label">{c.label}</span>
                </div>
                {pos < shown.length - 1 && <span className="crumb-sep">/</span>}
              </React.Fragment>
            );
          });
        })()}
      </div>

      <div className="topbar-spacer"/>

      <div className="tools">
        {TOOLS.map((tool, idx) => (
          <React.Fragment key={tool.id}>
            {idx === 4 && <div className="tool-divider"/>}
            {idx === 9 && <div className="tool-divider"/>}
            {idx === 13 && <div className="tool-divider"/>}
            <button
              className={`tool press ${activeTool === tool.id ? 'active' : ''}`}
              title={`${t[tool.label]} · ${lang==='es'?'Arrastra al canvas o clic':'Drag to canvas or click'}`}
              onMouseDown={(e)=>startToolDrag(e, tool.id)}
            >
              <div
                className="tool-icon"
                style={{
                  background: activeTool === tool.id ? 'var(--olive)' : tool.bg,
                  color: activeTool === tool.id ? 'white' : (tool.fg || 'var(--ink)'),
                }}
              >
                <span className="material-symbols-rounded">{tool.icon}</span>
              </div>
              <div className="tool-label">{t[tool.label]}</div>
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="topbar-spacer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button
          className="kofi-topbar-btn"
          onClick={() => window.open('https://ko-fi.com/W3G31ZYE06', '_blank', 'noopener,noreferrer')}
          title={lang === 'es' ? 'Apóyame en Ko-fi' : 'Support me on Ko-fi'}
        >
          <span className="material-symbols-rounded kofi-icon">coffee</span>
          <span>{lang === 'es' ? 'Apoyar' : 'Support'}</span>
        </button>
      </div>

      <div className="topbar-actions">
        {updateAvailable && (
          <button
            className="icon-btn lift update-bell-btn"
            style={{ color: 'var(--wine, #E6544F)', marginRight: 6, animation: 'pulse-bell 1s infinite alternate' }}
            onClick={onUpdateClick}
            title={lang === 'es' ? '¡Nueva actualización disponible! Haz clic para descargar de GitHub.' : 'New update available! Click to download from GitHub.'}
          >
            <span className="material-symbols-rounded">notifications_active</span>
          </button>
        )}
        <button className="icon-btn lift" title="Undo (⌘Z)" onClick={onUndo} style={{ opacity: canUndo ? 1 : 0.4 }}>
          <span className="material-symbols-rounded">undo</span>
        </button>
        <button className="icon-btn lift" title="Redo (⌘⇧Z)" onClick={onRedo} style={{ opacity: canRedo ? 1 : 0.4 }}>
          <span className="material-symbols-rounded">redo</span>
        </button>
        <button
          className="icon-btn lift theme-btn"
          title={theme==='dark'?'Light mode':'Dark mode'}
          onClick={()=>setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <span className="material-symbols-rounded">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
        </button>
        <div className="lang-switch">
          <button className={lang==='es'?'active':''} onClick={()=>setLang('es')}>ES</button>
          <button className={lang==='en'?'active':''} onClick={()=>setLang('en')}>EN</button>
        </div>
      </div>
    </div>
  );
}

window.Topbar = Topbar;
window.TOOLS = TOOLS;
