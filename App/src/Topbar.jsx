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
  // Conector y dibujo a mano → blanco
  { id: 'line',     icon: 'arrow_outward', label: 'tool_line',     bg: '#FFFFFF', fg: '#1A1A1A' },
  { id: 'draw',     icon: 'gesture',       label: 'tool_draw',     bg: '#FFFFFF', fg: '#1A1A1A' },
];

// touch.js marca <html data-mobile="1"> cuando la pantalla es de movil. Se
// consulta en el momento de dibujar: cambia al girar el aparato o al redimensionar.
function esMovil() {
  return typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-mobile') === '1';
}

// Las de más van en el desplegable y no en la barra: en una pantalla de 1080
// entran quince botones justos, y meter el dieciséis a la fuerza deja la barra
// con desplazamiento, que es peor que un clic de más.
const EXTRA_TOOLS = [
  { id: 'shape',    icon: 'category',      label: 'tool_shape',    bg: '#E6544F', fg: 'white' },
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
  onEstadoCompartir, estadoCompartir, estadoTitulo,
  onSettingsClick,
  userProfile, esPatrocinador, onAbrirCorona, onUserClick,
  onManualSync,
  isSyncingDrive,
  needsDriveAuth,
}) {
  const t = window.TRANSLATIONS[lang];
  const [extraOpen, setExtraOpen] = React.useState(false);
  // Donde se dibuja el panel de extras. Va en coordenadas de pantalla porque
  // el panel se pinta fuera de la barra (que recorta), no dentro de ella.
  const [extraPos, setExtraPos] = React.useState({ left: 0, top: 0 });
  const extraBtnRef = React.useRef(null);

  // El panel se coloca cuando ya esta en el DOM, con un efecto de disposicion:
  // se ejecuta despues de que React monte y antes de pintar, sin depender del
  // bucle de fotogramas. Ademas se encaja en la ventana, para que no se salga
  // por la derecha cuando el boton queda cerca del borde.
  React.useLayoutEffect(() => {
    if (!extraOpen) return;
    const ANCHO = 150; // ancho del panel mas su margen
    const coloca = () => {
      const el = extraBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setExtraPos({
        left: Math.max(8, Math.min(r.left, window.innerWidth - ANCHO - 8)),
        top: r.bottom + 8,
      });
    };
    coloca();
    // Y otra vez en el turno siguiente, por si el navegador movio la barra al
    // pulsar un boton que estaba a medias fuera (lo hace para traerlo a la
    // vista, y ocurre despues de este efecto). Es una precaucion barata.
    const t = setTimeout(coloca, 0);
    return () => clearTimeout(t);
  }, [extraOpen]);
  // En móvil la barra no cabe en una fila: las acciones de la derecha se
  // pliegan en un panel y las herramientas pasan a un raíl vertical.
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [railOpen, setRailOpen] = React.useState(true);
  // ── Deslizador de la barra de nodos ──
  // Solo aparece cuando la barra esta REALMENTE cortada. En una pantalla ancha
  // no pinta nada y solo seria ruido, asi que se mide el desbordamiento de
  // verdad en vez de suponerlo por la anchura de la ventana: hay quien tiene la
  // ventana a medio monitor, o el zoom del sistema al 150%.
  const toolsRef = React.useRef(null);
  const [toolsCortada, setToolsCortada] = React.useState(false);
  const [toolsPos, setToolsPos] = React.useState(0);

  const midaToolsFn = React.useCallback(() => {
    const el = toolsRef.current;
    if (!el) return;
    const sobra = el.scrollWidth - el.clientWidth;
    // 4px de margen: sin el, un redondeo de medio pixel encendia el deslizador
    // en pantallas donde en realidad cabe todo.
    setToolsCortada(sobra > 4);
    setToolsPos(sobra > 0 ? el.scrollLeft / sobra : 0);
  }, []);

  React.useEffect(() => {
    const el = toolsRef.current;
    if (!el) return;
    midaToolsFn();
    const ro = new ResizeObserver(midaToolsFn);
    ro.observe(el);
    window.addEventListener('resize', midaToolsFn);
    return () => { ro.disconnect(); window.removeEventListener('resize', midaToolsFn); };
  }, [midaToolsFn, railOpen]);

  const muevaTools = (frac) => {
    const el = toolsRef.current;
    if (!el) return;
    el.scrollLeft = frac * (el.scrollWidth - el.clientWidth);
  };

  // Desplegable con el camino completo hasta donde estas.
  const [pathOpen, setPathOpen] = React.useState(false);
  const actual = crumbs[crumbs.length - 1] || { label: window.t('Inicio', 'Home') };
  // Al cambiar de tablero se cierra solo: si no, se quedaria abierto
  // enseniando una ruta que ya no es la actual.
  React.useEffect(() => { setPathOpen(false); }, [crumbs.length, actual.id]);

  const goBack = () => {
    if (crumbs.length > 1) onCrumb(crumbs.length - 2);
    else onHome();
    window.playAudioTone && window.playAudioTone('click');
  };

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
      {/* Retroceder un nivel. Antes solo estaba en móvil, porque en escritorio
          se subía pulsando la miga anterior de la cadena. Al desaparecer esa
          cadena hace falta en todas partes: es el gesto de subir un nivel de un
          solo clic, sin abrir el desplegable de la ruta. */}
      {crumbs.length > 1 && (
      <button
        className="crumb-back"
        onClick={goBack}
        title={window.t('Volver al nivel anterior', 'Back one level')}
        aria-label={window.t('Volver', 'Back')}
      >
        <span className="material-symbols-rounded">arrow_back</span>
      </button>
      )}
      {/* Ruta actual.
          Antes era la cadena entera separada por "/", y con tableros anidados
          crecía sin límite: se comía el espacio de la barra de nodos y acababa
          cortada. Ahora es una sola pastilla con el sitio donde estás, y el
          camino completo se despliega al pulsarla. Ocupa lo mismo con dos
          niveles que con diez. */}
      <div className="crumb-path">
        <button
          className={`crumb-pill ${pathOpen ? 'open' : ''}`}
          onClick={() => { setPathOpen(o => !o); window.playAudioTone && window.playAudioTone('click'); }}
          title={crumbs.map(c => c.label).join('  ›  ')}
        >
          {actual.chipColor
            ? <div className="crumb-chip" style={{background: actual.chipColor}}/>
            : <span className="material-symbols-rounded crumb-pill-home">home</span>}
          <span className="crumb-pill-label">{actual.label}</span>
          {crumbs.length > 1 && (
            <span className="material-symbols-rounded crumb-pill-caret">
              {pathOpen ? 'expand_less' : 'expand_more'}
            </span>
          )}
        </button>

        {pathOpen && (
          <>
            <div className="crumb-path-scrim" onClick={() => setPathOpen(false)}/>
            <div className="crumb-path-menu">
              <div className="crumb-path-title">{window.t('Dónde estás', 'Where you are')}</div>
              {crumbs.map((c, i) => (
                <button
                  key={c.id || i}
                  className={`crumb-path-item ${i === crumbs.length - 1 ? 'current' : ''}`}
                  style={{ paddingLeft: 10 + Math.min(i, 6) * 13 }}
                  onClick={() => { setPathOpen(false); onCrumb(i); }}
                  title={c.label}
                >
                  {c.chipColor
                    ? <div className="crumb-chip" style={{background: c.chipColor}}/>
                    : <span className="material-symbols-rounded" style={{fontSize:15}}>home</span>}
                  <span className="crumb-path-label">{c.label}</span>
                  {i === crumbs.length - 1 && (
                    <span className="material-symbols-rounded crumb-path-here">my_location</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="topbar-spacer"/>

      {/* Muestra u oculta el raíl de herramientas (solo visible en móvil, donde
          el raíl ocupa el borde derecho de la pantalla). */}
      <button
        className={`tools-fab ${railOpen ? 'open' : ''}`}
        onClick={() => { setRailOpen(o => !o); window.playAudioTone && window.playAudioTone('click'); }}
        title={railOpen ? window.t('Ocultar herramientas', 'Hide tools') : window.t('Mostrar herramientas', 'Show tools')}
        aria-label={window.t('Herramientas', 'Tools')}
      >
        <span className="material-symbols-rounded">{railOpen ? 'close' : 'widgets'}</span>
      </button>

      <div className="tools-wrap">
      <div
        className={`tools ${railOpen ? 'rail-open' : 'rail-closed'}`}
        ref={toolsRef}
        onScroll={midaToolsFn}
      >
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
        <button
          ref={extraBtnRef}
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
      </div>

      {/* Deslizador: solo cuando la barra esta cortada de verdad. Si cabe todo,
          no se dibuja — no es una barra de scroll permanente. */}
      {toolsCortada && (
        <input
          className="tools-slider"
          type="range"
          min="0" max="1000" step="1"
          value={Math.round(toolsPos * 1000)}
          onChange={(e) => {
            // El pulgar se mueve con lo que dice el propio deslizador, sin
            // esperar al evento de scroll de la barra: asi el control responde
            // aunque el navegador agrupe o retrase ese evento.
            const frac = Number(e.target.value) / 1000;
            setToolsPos(frac);
            muevaTools(frac);
          }}
          title={window.t('Desplazar las herramientas', 'Scroll the tools')}
          aria-label={window.t('Desplazar las herramientas', 'Scroll the tools')}
        />
      )}
      </div>

      {/* Panel de herramientas extras.
          Va con un portal al final de la página, FUERA de la barra. La barra
          recorta lo que se sale de ella (hace falta para poder desplazarla), y
          este panel cuelga por debajo: dentro quedaba cortado y no se veía
          nada al pulsar "Más". Al estar fuera, se coloca en coordenadas fijas
          calculadas desde el botón. */}
      {extraOpen && ReactDOM.createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 400 }}
            onClick={() => setExtraOpen(false)}
          />
          <div
            className="extra-tools-popout"
            /* En movil el panel se ancla al rail vertical desde la hoja de
               estilos (right/bottom). Poner left/top aqui la pisaba y el panel
               se iba fuera de la pantalla, asi que ahi se deja en auto y manda
               el CSS. */
            style={esMovil()
              ? { position: 'fixed', left: 'auto', top: 'auto', margin: 0 }
              : { position: 'fixed', left: extraPos.left, top: extraPos.top, margin: 0 }}
            onMouseDown={(e)=>e.stopPropagation()}
          >
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
        </>,
        document.body
      )}

      {/* Botón "⋯": en móvil despliega todo lo que sigue como panel; en
          escritorio está oculto y .topbar-tail usa display:contents, así que la
          barra se ve exactamente igual que antes. */}
      <button
        className="topbar-more"
        onClick={() => { setMoreOpen(o => !o); window.playAudioTone && window.playAudioTone('click'); }}
        title={window.t('Más opciones', 'More options')}
        aria-label={window.t('Más opciones', 'More options')}
      >
        <span className="material-symbols-rounded">{moreOpen ? 'expand_less' : 'more_vert'}</span>
      </button>
      {moreOpen && <div className="topbar-tail-scrim" onClick={() => setMoreOpen(false)}/>}

      <div className={`topbar-tail ${moreOpen ? 'open' : ''}`}>
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

        {/* Online / Offline y compartir.
            Vivía abajo del todo, en la fila de pastillas de estado junto a
            "Guardado" y "2 nodos" — información de fondo que nadie mira. Pero
            no es un dato: es el botón que abre el compartir y las sesiones en
            vivo. Aquí arriba, con el resto de acciones, se ve y se pulsa. */}
        {onEstadoCompartir && (
          <button
            className={`odi-share-pill ${estadoCompartir}`}
            title={estadoTitulo}
            onClick={() => { onEstadoCompartir(); window.playAudioTone && window.playAudioTone('click'); }}
          >
            <span className="material-symbols-rounded">
              {estadoCompartir === 'invitado' ? 'sensors'
                : estadoCompartir === 'offline' ? 'cloud_off'
                : estadoCompartir === 'caido' ? 'cloud_alert'
                : 'cloud_done'}
            </span>
            <span>
              {estadoCompartir === 'invitado' ? window.t('Invitado', 'Guest')
                : estadoCompartir === 'offline' ? window.t('Compartir', 'Share')
                : estadoCompartir === 'caido' ? window.t('Sin conexión', 'Disconnected')
                : window.t('Online', 'Online')}
            </span>
          </button>
        )}

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
        <window.CoronaBoton activo={!!esPatrocinador} onAbrir={onAbrirCorona} />
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
    </div>
  );
}

window.Topbar = Topbar;
window.TOOLS = [...TOOLS, ...EXTRA_TOOLS];
