// =====================================================
// Odinote — top toolbar v4 (tools draggable to canvas)
// =====================================================

const TOOLS = [
  // Texto / contenido → verde
  { id: 'note',     icon: 'sticky_note_2', label: 'tool_note',     bg: '#90B968', fg: 'white' },
  { id: 'todo',     icon: 'checklist',     label: 'tool_todo',     bg: '#90B968', fg: 'white' },
  { id: 'doc',      icon: 'description',   label: 'tool_doc',      bg: '#90B968', fg: 'white' },
  { id: 'bigtitle', icon: 'title',         label: 'tool_bigtitle', bg: '#90B968', fg: 'white' },
  // Medios / archivos → gris
  { id: 'image',    icon: 'image',         label: 'tool_image',    bg: '#E1DFE3', fg: '#1A1A1A' },
  { id: 'audio',    icon: 'audiotrack',    label: 'tool_audio',    bg: '#E1DFE3', fg: '#1A1A1A' },
  { id: 'link',     icon: 'link',          label: 'tool_link',     bg: '#E1DFE3', fg: '#1A1A1A' },
  { id: 'color',    icon: 'palette',       label: 'tool_color',    bg: '#E1DFE3', fg: '#1A1A1A' },
  // Estructura → rojo
  { id: 'board',    icon: 'dashboard',     label: 'tool_board',    bg: '#E6544F', fg: 'white' },
  { id: 'column',   icon: 'view_column',   label: 'tool_column',   bg: '#E6544F', fg: 'white' },
  { id: 'table',    icon: 'table_chart',   label: 'tool_table',    bg: '#E6544F', fg: 'white' },
  { id: 'frame',    icon: 'crop_free',     label: 'tool_frame',    bg: '#E6544F', fg: 'white' },
  // Conector → blanco
  { id: 'line',     icon: 'arrow_outward', label: 'tool_line',     bg: '#FFFFFF', fg: '#1A1A1A' },
];

const EXTRA_TOOLS = [
  { id: 'calendar', icon: 'calendar_month',label: 'tool_calendar', bg: '#E6544F', fg: 'white' },
  { id: 'comment',  icon: 'forum',         label: 'tool_comment',  bg: '#90B968', fg: 'white' },
  { id: 'file',     icon: 'draft',         label: 'tool_file',     bg: '#E1DFE3', fg: '#1A1A1A' },
  { id: 'map',      icon: 'map',           label: 'tool_map',      bg: '#E1DFE3', fg: '#1A1A1A' },
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
  volume, onChangeVolume,
  onSettingsClick,
  userProfile, onUserClick,
  onManualSync,
  isSyncingDrive,
  needsDriveAuth,
}) {
  const t = window.TRANSLATIONS[lang];
  const [extraOpen, setExtraOpen] = React.useState(false);

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
                  <div className="crumb crumb-ellipsis" title={window.t('Niveles ocultos', 'Hidden levels')}>…</div>
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
            {idx === 8 && <div className="tool-divider"/>}
            {idx === 12 && <div className="tool-divider"/>}
            <button
              className={`tool press ${activeTool === tool.id ? 'active' : ''}`}
              title={`${t[tool.label] || tool.id} · ${window.t('Arrastra al canvas o clic', 'Drag to canvas or click')}`}
              onMouseDown={(e)=>startToolDrag(e, tool.id)}
              onClick={() => window.playAudioTone && window.playAudioTone('click')}
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
              <div className="tool-label">{t[tool.label] || tool.id}</div>
            </button>
          </React.Fragment>
        ))}

        {/* Botón de tres puntos para herramientas extras */}
        <div style={{ position: 'relative' }}>
          <button
            className={`tool press ${extraOpen ? 'active' : ''}`}
            title={window.t('Más herramientas', 'More tools')}
            onClick={() => {
              setExtraOpen(o => !o);
              window.playAudioTone && window.playAudioTone('click');
            }}
          >
            <div className="tool-icon" style={{ background: '#E1DFE3', color: '#1A1A1A' }}>
              <span className="material-symbols-rounded">more_horiz</span>
            </div>
            <div className="tool-label">{window.t('Más', 'More')}</div>
          </button>

          {extraOpen && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 400 }} 
                onClick={() => setExtraOpen(false)} 
              />
              <div className="extra-tools-popout" onMouseDown={(e)=>e.stopPropagation()}>
                <div className="extra-tools-title">
                  {window.t('EXTRAS', 'EXTRAS')}
                </div>
                {EXTRA_TOOLS.map(tool => (
                  <button
                    key={tool.id}
                    className="extra-tools-btn"
                    onMouseDown={(e) => {
                      setExtraOpen(false);
                      startToolDrag(e, tool.id);
                    }}
                    onClick={() => {
                      setExtraOpen(false);
                      window.playAudioTone && window.playAudioTone('click');
                      setActiveTool(tool.id);
                    }}
                  >
                    <div
                      className="extra-tools-icon"
                      style={{
                        background: activeTool === tool.id ? 'var(--olive)' : tool.bg,
                        color: activeTool === tool.id ? 'white' : (tool.fg || 'var(--ink)'),
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>{tool.icon}</span>
                    </div>
                    <span className="extra-tools-label">
                      {t[tool.label] || tool.id}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="topbar-spacer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button
          className="feedback-topbar-btn"
          onClick={() => window.open('https://github.com/Neuroxcx1/Odinote/discussions', '_blank', 'noopener,noreferrer')}
          title={window.t('Comenta o danos tu feedback en GitHub', 'Give us feedback or suggestions on GitHub')}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>forum</span>
          <span>{window.t('Feedback', 'Feedback')}</span>
        </button>
        <button
          className="kofi-topbar-btn"
          onClick={() => window.open('https://ko-fi.com/W3G31ZYE06', '_blank', 'noopener,noreferrer')}
          title={window.t('Apóyame en Ko-fi', 'Support me on Ko-fi')}
        >
          <span className="material-symbols-rounded kofi-icon">coffee</span>
          <span>{window.t('Apoyar', 'Support')}</span>
        </button>
      </div>

      <div className="topbar-actions">
        <button
          className="icon-btn lift"
          title={needsDriveAuth
            ? window.t('El acceso a Drive caducó: haz clic para renovarlo', 'Drive access expired: click to renew it')
            : window.t('Sincronizar con Google Drive ahora', 'Sync with Google Drive now')}
          onClick={() => { onManualSync && onManualSync(); window.playAudioTone && window.playAudioTone('click'); }}
          style={{ marginRight: 6, position: 'relative' }}
        >
          <span
            className="material-symbols-rounded"
            style={isSyncingDrive ? { animation: 'spin 1.5s linear infinite', color: 'var(--brand-green, #90B968)' } : (needsDriveAuth ? { color: 'var(--wine, #E6544F)' } : undefined)}
          >
            {needsDriveAuth ? 'sync_problem' : 'sync'}
          </span>
          {needsDriveAuth && (
            <span style={{ position: 'absolute', top: '4px', right: '4px', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--wine, #E6544F)', border: '1.5px solid var(--paper)' }}/>
          )}
        </button>
        {window.electronAPI && (
          <button
            className={`icon-btn lift update-bell-btn ${updateAvailable ? 'has-update' : ''}`}
            style={{
              color: updateAvailable ? 'var(--wine, #E6544F)' : 'var(--text-soft, #595459)',
              marginRight: 6,
              animation: updateAvailable ? 'pulse-bell 1.5s infinite alternate' : 'none'
            }}
            onClick={() => { onUpdateClick(); window.playAudioTone && window.playAudioTone('click'); }}
            title={
              updateAvailable
                ? (window.t('¡Nueva actualización disponible! Haz clic para descargar de GitHub.', 'New update available! Click to download from GitHub.'))
                : (window.t('Buscar actualizaciones', 'Check for updates'))
            }
          >
            <span className="material-symbols-rounded">
              {updateAvailable ? 'notifications_active' : 'notifications'}
            </span>
          </button>
        )}
        <button
          className="icon-btn lift"
          title="Undo (⌘Z)"
          onClick={() => { onUndo(); window.playAudioTone && window.playAudioTone('click'); }}
          style={{ opacity: canUndo ? 1 : 0.4 }}
        >
          <span className="material-symbols-rounded">undo</span>
        </button>
        <button
          className="icon-btn lift"
          title="Redo (⌘⇧Z)"
          onClick={() => { onRedo(); window.playAudioTone && window.playAudioTone('click'); }}
          style={{ opacity: canRedo ? 1 : 0.4 }}
        >
          <span className="material-symbols-rounded">redo</span>
        </button>
        <div className="volume-ctrl" style={{ marginRight: 6 }}>
          <button
            className="icon-btn-mute"
            title={volume === 0 ? (lang === 'es' ? 'Activar sonido' : 'Unmute') : (lang === 'es' ? 'Silenciar' : 'Mute')}
            onClick={() => {
              let nextVol = 0.5;
              if (volume > 0) {
                localStorage.setItem('odinote.last_volume', volume.toString());
                nextVol = 0;
              } else {
                const last = localStorage.getItem('odinote.last_volume');
                nextVol = last ? parseFloat(last) : 0.5;
              }
              onChangeVolume(nextVol);
              setTimeout(() => { window.playAudioTone && window.playAudioTone('click'); }, 20);
            }}
          >
            <span className="material-symbols-rounded">
              {volume === 0 ? 'volume_off' : (volume < 0.4 ? 'volume_down' : 'volume_up')}
            </span>
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
            className="volume-slider"
            title={`${Math.round(volume * 100)}%`}
          />
        </div>
        {/* El estado "sincronizando" se muestra girando el botón ↻ (arriba), sin
            insertar texto que desplace toda la barra hacia la izquierda */}
        <button
          className={`icon-btn lift user-profile-btn ${userProfile ? 'has-name' : 'no-name'}`}
          title={userProfile ? `${window.t('Perfil de', 'Profile of')} ${userProfile.name}` : window.t('Iniciar sesión con Google (Requerido para colaborar)', 'Sign in with Google (Required to collaborate)')}
          onClick={() => { onUserClick && onUserClick(); window.playAudioTone && window.playAudioTone('click'); }}
          style={{ marginRight: '4px', position: 'relative' }}
        >
          <span className="material-symbols-rounded" style={{ color: userProfile ? 'var(--brand-green, #90B968)' : 'inherit' }}>person</span>
          {!userProfile && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--wine, #E6544F)',
              border: '1.5px solid var(--paper)'
            }}/>
          )}
        </button>
        <button
          className="icon-btn lift settings-btn"
          title={window.t('Ajustes', 'Settings')}
          onClick={() => { onSettingsClick && onSettingsClick(); window.playAudioTone && window.playAudioTone('click'); }}
          style={{ marginRight: '4px' }}
        >
          <span className="material-symbols-rounded">settings</span>
        </button>
        <button
          className="icon-btn lift theme-btn"
          title={theme==='dark'?'Light mode':'Dark mode'}
          onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); window.playAudioTone && window.playAudioTone('click'); }}
        >
          <span className="material-symbols-rounded">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
        </button>
        <div
          className="lang-switch"
          title={
            {
              es: 'Español',
              en: 'English',
              fr: 'Français',
              de: 'Deutsch',
              it: 'Italiano',
              pt: 'Português',
              zh: '中文 (Chinese)',
              ja: '日本語 (Japanese)',
              ko: '한국어 (Korean)',
              ar: 'العربية (Arabic)',
              ru: 'Русский (Russian)'
            }[lang] || ''
          }
          style={{ position: 'relative' }}
        >
          <span style={{ pointerEvents: 'none', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink)', fontSize: '11.5px', fontWeight: '700' }}>
            {lang.toUpperCase()}
          </span>
          <select
            value={lang}
            onChange={(e) => { setLang(e.target.value); window.playAudioTone && window.playAudioTone('click'); }}
            className="lang-select"
            style={{ opacity: 0, cursor: 'pointer', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2 }}
          >
            <option value="es" title="Español">ES - Español</option>
            <option value="en" title="English">EN - English</option>
            <option value="fr" title="Français">FR - Français</option>
            <option value="de" title="Deutsch">DE - Deutsch</option>
            <option value="it" title="Italiano">IT - Italiano</option>
            <option value="pt" title="Português">PT - Português</option>
            <option value="zh" title="中文 (Chinese)">ZH - 中文 (Chinese)</option>
            <option value="ja" title="日本語 (Japanese)">JA - 日本語 (Japanese)</option>
            <option value="ko" title="한국어 (Korean)">KO - 한국어 (Korean)</option>
            <option value="ar" title="العربية (Arabic)">AR - العربية (Arabic)</option>
            <option value="ru" title="Русский (Russian)">RU - Русский (Russian)</option>
          </select>
        </div>
      </div>
    </div>
  );
}

window.Topbar = Topbar;
window.TOOLS = [...TOOLS, ...EXTRA_TOOLS];
