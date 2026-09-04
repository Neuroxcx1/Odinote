// =====================================================
// Odinote — Home v4 (Miro-style with sidebar)
// =====================================================
const { useState: useStateHome, useMemo: useMemoHome, useRef: useRefHome } = React;

// ──────────────── CARPETAS DE PROYECTOS ────────────────
//
// Agrupar los proyectos de la pantalla de inicio, que estaban todos sueltos
// uno detrás de otro. Es cosa de esta pantalla y de nadie más: NO se toca la
// sincronización, ni Google Drive, ni dónde vive cada archivo.
//
// Una carpeta no es un objeto que se guarde en ninguna lista maestra: existe
// porque hay proyectos que dicen estar dentro de ella (`p.carpeta`, el nombre
// tal cual). Eso tiene dos ventajas que se notan: viaja sola con el proyecto
// —va dentro de él, así que aparece igual en otro equipo sin escribir ni una
// línea de sincronización— y no puede quedarse una carpeta "fantasma"
// apuntando a proyectos que ya no están.
//
// El único caso que no se puede deducir de los proyectos es una carpeta VACÍA,
// que por definición no tiene a nadie que la nombre. Esas se apuntan aparte y
// solo en este equipo: son un cajón que acabas de crear y todavía no has
// llenado, no información que merezca viajar.
const CARPETAS_VACIAS_KEY = 'odinote.carpetas_vacias';

function leeCarpetasVacias() {
  try {
    const crudo = JSON.parse(localStorage.getItem(CARPETAS_VACIAS_KEY) || '[]');
    return Array.isArray(crudo) ? crudo.filter(x => typeof x === 'string' && x.trim()) : [];
  } catch (e) { return []; }
}

function guardaCarpetasVacias(nombres) {
  try { localStorage.setItem(CARPETAS_VACIAS_KEY, JSON.stringify(nombres)); } catch (e) {}
}

// El nombre de la carpeta de un proyecto, ya limpio. Vale '' si no tiene.
function carpetaDe(p) {
  return typeof p.carpeta === 'string' ? p.carpeta.trim() : '';
}

// Todas las carpetas que hay que enseñar: las que nombran los proyectos vivos
// más las vacías de este equipo. Ordenadas como las ordenaría una persona
// (localeCompare, para que "Ávila" no acabe detrás de "Zamora").
function carpetasVisibles(projects, vacias) {
  const nombres = new Set();
  for (const n of vacias || []) if (String(n).trim()) nombres.add(String(n).trim());
  for (const p of projects || []) {
    if (p.deleted) continue;
    const c = carpetaDe(p);
    if (c) nombres.add(c);
  }
  return [...nombres].sort((a, b) => a.localeCompare(b));
}

// Cuántos proyectos vivos hay en cada carpeta.
function cuentaPorCarpeta(projects) {
  const cuenta = {};
  for (const p of projects || []) {
    if (p.deleted) continue;
    const c = carpetaDe(p);
    if (c) cuenta[c] = (cuenta[c] || 0) + 1;
  }
  return cuenta;
}

// Un nombre libre para la carpeta nueva: "Carpeta", "Carpeta 2", "Carpeta 3"…
// Repetir nombre no es un detalle estético: como la carpeta ES su nombre, dos
// carpetas iguales serían la misma y los proyectos se mezclarían.
function nombreLibreDeCarpeta(existentes, base) {
  const usados = new Set((existentes || []).map(n => n.toLowerCase()));
  if (!usados.has(base.toLowerCase())) return base;
  for (let i = 2; i < 500; i++) {
    const intento = base + ' ' + i;
    if (!usados.has(intento.toLowerCase())) return intento;
  }
  return base + ' ' + Date.now();
}

window.carpetasVisibles = carpetasVisibles;
window.cuentaPorCarpeta = cuentaPorCarpeta;
window.nombreLibreDeCarpeta = nombreLibreDeCarpeta;
window.carpetaDe = carpetaDe;

function BrandMark() {
  // Original logo, shown without the black box (container background is transparent now)
  return (
    <img
      src="./Icon/Icon.png"
      alt="Oddinote"
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
    />
  );
}

const COVER_PRESETS = [
  'linear-gradient(135deg, #FFFFFF 0%, #E1DFE3 100%)',
  'linear-gradient(135deg, #F7DA84 0%, #E6544F 100%)',
  'linear-gradient(135deg, #90B968 0%, #595459 100%)',
  'linear-gradient(135deg, #E6544F 0%, #595459 100%)',
  'linear-gradient(135deg, #F7DA84 0%, #90B968 100%)',
  'linear-gradient(135deg, #595459 0%, #1A1A1A 100%)',
  'linear-gradient(135deg, #E1DFE3 0%, #595459 100%)',
  'linear-gradient(135deg, #90B968 0%, #F7DA84 100%)',
  'linear-gradient(135deg, #E6544F 0%, #F7DA84 100%)',
  'linear-gradient(135deg, #FFFFFF 0%, #90B968 100%)',
  'linear-gradient(135deg, #FFFFFF 0%, #E6544F 100%)',
  'linear-gradient(135deg, #FFFFFF 0%, #F7DA84 100%)',
];

// ── La portada, moviéndose por un degradado ──
//
// Los doce de arriba se quedan: son parejas de colores ya escogidas. Debajo,
// una barra por la que se pasea. Antes había un selector de colores fijos, y
// para una portada no es lo que se quiere: nadie busca "el #7B3FE4", busca
// "un poco más morado que eso", y eso se hace arrastrando, no eligiendo entre
// cuatro casillas y una rueda del sistema que se abre en otra ventana.
//
// El tono se guarda dentro del propio degradado —en hsl, que se lee de vuelta—
// así que no hace falta un campo nuevo en el proyecto: la portada sigue siendo
// una sola cadena de CSS, como la de los doce.
function portadaDeTono(tono) {
  const t = ((Math.round(tono) % 360) + 360) % 360;
  // El segundo color va veinte grados por detrás y mucho más oscuro: un
  // degradado entre dos tonos vecinos parece profundidad; entre dos opuestos,
  // un error de imprenta.
  const sombra = (t + 340) % 360;
  return 'linear-gradient(135deg, hsl(' + t + ', 72%, 62%) 0%, hsl(' + sombra + ', 62%, 32%) 100%)';
}

function tonoDePortada(cover) {
  const m = /hsl\((\d+)/.exec(String(cover || ''));
  return m ? Number(m[1]) : null;
}

// Una portada es "tuya" cuando no es ninguna de las doce. Da igual cómo se
// hiciera: las hay de cuando se elegía un color suelto, y esas también.
function esPortadaPropia(cover) {
  return !!cover && COVER_PRESETS.indexOf(cover) === -1;
}

function BarraDegradado({ tono, onCambio }) {
  const barra = useRefHome(null);

  const desdeX = (clientX) => {
    const r = barra.current.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onCambio(Math.round(p * 360));
  };

  return (
    <div
      ref={barra}
      className="portada-barra"
      role="slider"
      tabIndex={0}
      aria-label={window.t('Color de la portada', 'Cover colour')}
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={tono == null ? 0 : tono}
      // Con captura del puntero: se sigue arrastrando aunque el ratón se salga
      // de la barra, que es lo que hace todo el mundo al buscar un tono.
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); desdeX(e.clientX); }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) desdeX(e.clientX); }}
      onKeyDown={(e) => {
        const t = tono == null ? 0 : tono;
        if (e.key === 'ArrowLeft')  { e.preventDefault(); onCambio((t + 355) % 360); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onCambio((t + 5) % 360); }
      }}
    >
      {tono != null && (
        <span className="portada-barra-tirador" style={{ left: (tono / 360 * 100) + '%' }} />
      )}
    </div>
  );
}

// El mismo campo en las dos ventanas —crear y editar—, escrito una sola vez:
// dos copias del mismo formulario acaban siempre con una arreglada y la otra no.
function CampoPortada({ cover, onCambio }) {
  const propia = esPortadaPropia(cover);
  return (
    <div className="field">
      <label>{window.t('Portada', 'Cover')}</label>
      <div className="cover-row">
        {COVER_PRESETS.map(c => (
          <button
            key={c}
            className={`cover-pick ${cover === c ? 'active' : ''}`}
            style={{ background: c, border: '1.5px solid var(--line)' }}
            onClick={() => onCambio(c)}
          />
        ))}
        {/* La portada hecha a mano se pone la última, entre las demás y con su
            aro. Sin ella, moverse por la barra no se veía por ninguna parte:
            ningún recuadro quedaba marcado, y el degradado que iba a salir no
            aparecía hasta después de crear el proyecto. */}
        {propia && (
          <button
            className="cover-pick active"
            style={{ background: cover, border: '1.5px solid var(--line)' }}
            title={window.t('La tuya', 'Yours')}
            onClick={() => onCambio(cover)}
          />
        )}
      </div>
      <div style={{ marginTop: '10px' }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--ink-3, #8E8A8E)', marginBottom: '6px',
        }}>
          {window.t('O muévete por aquí', 'Or slide through here')}
        </div>
        <BarraDegradado tono={tonoDePortada(cover)} onCambio={(t) => onCambio(portadaDeTono(t))} />
      </div>
    </div>
  );
}

const EMOJI_PRESETS = [
  'icon:video_game', 'icon:crossed_swords', 'icon:rocket', 'icon:artist_palette',
  'icon:paintbrush', 'icon:puzzle_piece', 'icon:game_die', 'icon:world_map',
  'icon:open_book', 'icon:musical_notes', 'icon:movie_camera', 'icon:test_tube',
  'icon:light_bulb', 'icon:fire', 'icon:gem_stone', 'icon:trophy'
];

// Renderiza el icono del proyecto según su formato:
//  'icon:nombre' → PNG de Fluent Emoji · snake_case → Material Symbol · otro → emoji de texto
function renderProjectIcon(icon) {
  if (icon && icon.startsWith('icon:')) {
    return <img className="project-icon-img" src={`lib/project-icons/${icon.slice(5)}_3d.png`} alt="" draggable={false}/>;
  }
  if (icon && /^[a-z0-9_]+$/.test(icon)) {
    return <span className="material-symbols-rounded">{icon}</span>;
  }
  return icon;
}
window.renderProjectIcon = renderProjectIcon;

function Home({ lang, setLang, theme, setTheme, onOpenProject, projects, onCreate, onDelete, onRename, onRestore, onPurge, onToggleStar, onExport, onImport, vaultPath, onOpenVault, onCloseVault, updateAvailable, onUpdateClick, onSettingsClick, userProfile, esPatrocinador, onAbrirCorona, onUserClick, onJoinProjectClick, onTogglePublic, onManualSync, isSyncingDrive, needsDriveAuth, onSetFolder, onSetFolderMany, onRenameFolder, onDeleteFolder }) {
  const t = window.TRANSLATIONS[lang];
  const [query, setQuery] = useStateHome('');
  const [modal, setModal] = useStateHome(false);
  const [section, setSection] = useStateHome('all');
  // La vista elegida se recuerda. Antes era estado suelto: bastaba con entrar
  // en un proyecto y volver para encontrarse otra vez la cuadricula, y quien
  // prefiere la lista la volvia a elegir veinte veces al dia.
  const [viewMode, setViewMode] = useStateHome(() => {
    try { return localStorage.getItem('odinote.vista_proyectos') === 'list' ? 'list' : 'grid'; }
    catch (e) { return 'grid'; }
  });

  const cambiaVista = (modo) => {
    setViewMode(modo);
    try { localStorage.setItem('odinote.vista_proyectos', modo); } catch (e) {}
  };
  const [editProject, setEditProject] = useStateHome(null);
  // En móvil la barra lateral (con "Nuevo espacio", papelera, bóveda…) no cabe:
  // se abre como cajón desde el botón ☰. En escritorio esto no se usa.
  const [sideOpen, setSideOpen] = useStateHome(false);

  // ── Carpetas ──
  const [carpetaAbierta, setCarpetaAbierta] = useStateHome(null);
  const [carpetasVacias, setCarpetasVacias] = useStateHome(leeCarpetasVacias);
  const [moviendo, setMoviendo] = useStateHome(null);      // proyecto que se está moviendo
  const [nombrando, setNombrando] = useStateHome(null);    // { inicial } al crear o renombrar
  const [anadiendo, setAnadiendo] = useStateHome(null);    // carpeta a la que se meten varios

  const carpetas = useMemoHome(() => carpetasVisibles(projects, carpetasVacias), [projects, carpetasVacias]);
  const cuentas = useMemoHome(() => cuentaPorCarpeta(projects), [projects]);

  // La lista de vacías es solo para las que todavía no tiene nadie dentro.
  // En cuanto un proyecto la nombra, se deduce sola y hay que soltarla: si
  // no, esa lista va creciendo con nombres duplicados que ya no hacen falta.
  const guardaVacias = (siguiente) => { setCarpetasVacias(siguiente); guardaCarpetasVacias(siguiente); };
  const olvidaVacia = (nombre) => guardaVacias(carpetasVacias.filter(c => c !== nombre));

  const mueveACarpeta = (projectId, nombre) => {
    onSetFolder && onSetFolder(projectId, nombre);
    if (nombre) olvidaVacia(nombre);
    window.playAudioTone && window.playAudioTone('click');
  };
  // Varios de una vez, en un solo cambio de estado: moviéndolos de uno en uno
  // se repintaba la pantalla una vez por proyecto.
  const anadeACarpeta = (ids, nombre) => {
    onSetFolderMany && onSetFolderMany(ids, nombre);
    if (nombre) olvidaVacia(nombre);
    window.playAudioTone && window.playAudioTone('click');
  };
  const creaCarpeta = (nombre) => {
    guardaVacias([...new Set([...carpetasVacias, nombre])]);
    window.playAudioTone && window.playAudioTone('click');
  };
  const renombraCarpeta = (viejo, nuevo) => {
    if (!nuevo || nuevo === viejo) return;
    onRenameFolder && onRenameFolder(viejo, nuevo);
    guardaVacias(carpetasVacias.map(c => (c === viejo ? nuevo : c)));
    if (carpetaAbierta === viejo) setCarpetaAbierta(nuevo);
  };
  // Quitar la carpeta no borra nada: sus proyectos vuelven a quedar sueltos.
  const quitaCarpeta = (nombre) => {
    onDeleteFolder && onDeleteFolder(nombre);
    olvidaVacia(nombre);
    if (carpetaAbierta === nombre) setCarpetaAbierta(null);
    window.playAudioTone && window.playAudioTone('delete');
  };



  const buscando = !!query.trim();

  const filtered = useMemoHome(() => {
    let list = projects;
    if (section === 'starred') list = list.filter(p => p.starred);
    if (section === 'trash') list = list.filter(p => p.deleted);
    else list = list.filter(p => !p.deleted);
    if (buscando) {
      // Buscando NO se agrupa: quien escribe un nombre quiere ese proyecto,
      // no que le recuerden en qué cajón lo dejó.
      const q = query.toLowerCase();
      return list.filter(p => window.pickLang(p.name, lang).toLowerCase().includes(q));
    }
    // Sin buscar, en "Todos" la rejilla enseña las carpetas y SOLO los
    // proyectos sueltos; dentro de una carpeta, los suyos. Favoritos y
    // papelera se quedan planos: ahí lo que importa es la lista corta.
    if (section === 'all') {
      list = carpetaAbierta
        ? list.filter(p => carpetaDe(p) === carpetaAbierta)
        : list.filter(p => !carpetaDe(p));
    }
    return list;
  }, [query, lang, projects, section, carpetaAbierta, buscando]);

  const recents = projects.filter(p => !p.deleted).slice(0, 4);

  return (
    <div className={`miro-home ${sideOpen ? 'side-open' : ''}`} data-screen-label="Home">
      {sideOpen && <div className="ms-side-scrim" onClick={()=>setSideOpen(false)}/>}
      {/* Sidebar */}
      <aside className="ms-side" onClick={(e)=>{ if (e.target.closest('button, a')) setSideOpen(false); }}>
        <div className="ms-brand">
          <div className="brand-mark"><BrandMark/></div>
          <span>Oddinote</span>
        </div>

        <button className="ms-new-btn" onClick={()=>setModal(true)}>
          <span className="material-symbols-rounded">add</span>
          <span>{t.new_project}</span>
        </button>

        <button className="ms-join-btn" onClick={onJoinProjectClick} style={{
          marginTop: '6px',
          width: '100%',
          height: '36px',
          background: 'none',
          border: '1.5px dashed var(--olive, #6A8546)',
          borderRadius: '8px',
          color: 'var(--olive, #6A8546)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '12px',
          fontWeight: '700',
          cursor: 'pointer',
          transition: 'all 120ms'
        }}>
          {/* "Puesto de trabajo" era el nombre viejo de lo de Drive. Quien
              busca entrar con el código de un amigo no lo reconocía como el
              botón que estaba buscando. */}
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>sensors</span>
          <span>{window.t('Unirme a una sesión', 'Join a session')}</span>
        </button>

        <nav className="ms-nav">
          <div className="ms-nav-label">{window.t('Espacios', 'Spaces')}</div>
          <button className={`ms-nav-item ${section==='all'?'active':''}`} onClick={()=>setSection('all')}>
            <span className="material-symbols-rounded">grid_view</span>
            <span>{window.t('Todos los proyectos', 'All projects')}</span>
            <span className="ms-nav-count">{projects.length}</span>
          </button>
          <button className={`ms-nav-item ${section==='recent'?'active':''}`} onClick={()=>setSection('recent')}>
            <span className="material-symbols-rounded">schedule</span>
            <span>{window.t('Recientes', 'Recent')}</span>
          </button>
          <button className={`ms-nav-item ${section==='starred'?'active':''}`} onClick={()=>setSection('starred')}>
            <span className="material-symbols-rounded">star</span>
            <span>{window.t('Favoritos', 'Favorites')}</span>
          </button>
          <button className={`ms-nav-item ${section==='trash'?'active':''}`} onClick={()=>setSection('trash')}>
            <span className="material-symbols-rounded">delete_outline</span>
            <span>{window.t('Papelera', 'Trash')}</span>
          </button>
        </nav>

        {/* Vault Controls */}
        {window.electronAPI ? (
          <div className="vault-sidebar-card" style={{ padding: '12px 16px', background: 'var(--bg-card, #FFFFFF)', borderRadius: '12px', border: '1.5px solid var(--line-soft, #E5E1DD)', display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0 12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--wine, #7B2D26)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>folder_shared</span>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>
                {window.t('Bóveda Local', 'Local Vault')}
              </span>
            </div>
            {vaultPath ? (
              <>
                <div style={{ fontSize: '11px', color: 'var(--text-soft, #595459)', wordBreak: 'break-all', fontFamily: 'monospace', background: 'var(--bg-main, #FAF8F6)', padding: '6px', borderRadius: '6px', border: '1px solid var(--line-soft, #E5E1DD)' }}>
                  {vaultPath}
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: '1px solid var(--line-soft, #E5E1DD)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', color: 'var(--text, #1A1A1A)' }}
                  onClick={onCloseVault}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>eject</span>
                  <span>{window.t('Desconectar Bóveda', 'Disconnect Vault')}</span>
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: '11px', color: 'var(--text-soft, #595459)', margin: 0, lineHeight: '1.4' }}>
                  {window.t('Guarda todo directamente en carpetas de tu PC.', 'Save everything directly to folders on your PC.')}
                </p>
                <button
                  className="ms-new-btn"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px', background: 'var(--wine, #7B2D26)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  onClick={onOpenVault}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>folder_open</span>
                  <span>{window.t('Abrir Carpeta', 'Open Folder')}</span>
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="vault-sidebar-card disabled" style={{ padding: '12px 16px', background: 'var(--bg-card, #FFFFFF)', borderRadius: '12px', border: '1.5px solid var(--line-soft, #E5E1DD)', opacity: 0.7, display: 'flex', flexDirection: 'column', gap: '6px', margin: '16px 0 12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-soft, #595459)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>folder_shared</span>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>
                {window.t('Bóveda Local', 'Local Vault')}
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-soft, #595459)', margin: 0, lineHeight: '1.4' }}>
              {window.t('Disponible en la versión de escritorio para PC.', 'Available in the desktop version for PC.')}
            </p>
          </div>
        )}

        <div className="ms-side-spacer" style={{ flex: 1 }}/>

        <div className="kofi-sidebar-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-card, #FFFFFF)', borderRadius: '12px', border: '1.5px solid var(--line-soft, #E5E1DD)', marginTop: '8px' }}>
          <div className="kofi-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--wine, #7B2D26)', fontWeight: '600', fontSize: '14px' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>favorite</span>
            <span style={{ fontWeight: '600', fontSize: '14px' }}>
              {window.t('Apoya Oddinote', 'Support Oddinote')}
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '1.5px solid var(--wine, #7B2D26)', flexShrink: 0, background: '#fff', padding: '2px' }}>
              <img src="./Icon/Icon.png" style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Avatar" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text, #1A1A1A)', lineHeight: '1.2' }}>Neuroxcx</span>
              <span style={{ fontSize: '11px', color: 'var(--text-soft, #595459)' }}>ko-fi.com/neuroxcx</span>
            </div>
          </div>

          <p style={{ fontSize: '11px', color: 'var(--text-soft, #595459)', margin: 0, lineHeight: '1.4' }}>
            {window.t('Oddinote es 100% gratuito. Si te ayuda en tus apuntes, considera hacernos una donación para apoyar el desarrollo independiente.', 'Oddinote is 100% free. If it helps you with your notes, consider supporting independent development.')}
          </p>

          {/* El correo con el que hay que donar, dicho en el momento justo:
              justo antes de irse a Ko-fi. La corona se enciende comparando el
              correo del pago con el de la sesion, y en Ko-fi se paga con el de
              PayPal, que muchas veces es otro. Decirlo aqui evita casi todas
              las reclamaciones posteriores; para las que queden esta el panel
              de la ventana de perfil. */}
          {userProfile && userProfile.email && !esPatrocinador && (
            <div style={{ fontSize: '11px', lineHeight: 1.45, padding: '8px 10px', borderRadius: '6px', background: 'rgba(224, 168, 46, 0.12)', border: '1.5px solid rgba(224, 168, 46, 0.55)', color: 'var(--text, #1A1A1A)' }}>
              {window.t('Dona con este correo y tu corona se activa sola:', 'Donate with this email and your crown turns on by itself:')}
              <strong style={{ display: 'block', marginTop: '3px', wordBreak: 'break-all' }}>{userProfile.email}</strong>
            </div>
          )}

          <button
            className="ms-new-btn"
            style={{ width: '100%', padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--wine, #7B2D26)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', marginTop: '2px' }}
            onClick={() => window.open('https://ko-fi.com/neuroxcx', '_blank', 'noopener,noreferrer')}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>coffee</span>
            <span>{window.t('Apoyar en Ko-fi', 'Support on Ko-fi')}</span>
          </button>
        </div>

      </aside>

      {/* Main */}
      <main className="ms-main">
        <header className="ms-top">
          {/* Abre la barra lateral como cajón. Solo se ve en móvil. */}
          <button
            className="ms-side-toggle"
            onClick={()=>setSideOpen(true)}
            title={window.t('Menú', 'Menu')}
            aria-label={window.t('Menú', 'Menu')}
          >
            <span className="material-symbols-rounded">menu</span>
          </button>
          <div className="ms-search">
            <span className="material-symbols-rounded">search</span>
            <input
              placeholder={window.t('Buscar proyectos, tableros, notas…', 'Search projects, boards, notes…')}
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
            />
          </div>
          <div className="ms-top-actions">
            {/* Unirse a una sesión, arriba y con texto.
                Estaba solo en la barra lateral y con el nombre viejo, y nadie
                lo encontraba: quien llega con el código de un amigo lo busca
                aquí, entre los botones de siempre. */}
            <button
              className="ms-join-top lift"
              title={window.t('Entrar al lienzo de alguien con su código', 'Enter someone\'s canvas with their code')}
              onClick={() => { onJoinProjectClick && onJoinProjectClick(); window.playAudioTone && window.playAudioTone('click'); }}
            >
              <span className="material-symbols-rounded">sensors</span>
              <span>{window.t('Unirme a una sesión', 'Join a session')}</span>
            </button>
            <button
              className="icon-btn lift"
              title={needsDriveAuth
                ? window.t('El acceso a Drive caducó: haz clic para renovarlo', 'Drive access expired: click to renew it')
                : window.t('Sincronizar con Google Drive ahora', 'Sync with Google Drive now')}
              onClick={() => { onManualSync && onManualSync(); window.playAudioTone && window.playAudioTone('click'); }}
              style={{ marginRight: 10, position: 'relative' }}
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
                  marginRight: 10,
                  animation: updateAvailable ? 'pulse-bell 1.5s infinite alternate' : 'none'
                }}
                onClick={onUpdateClick}
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
            <window.CoronaBoton activo={!!esPatrocinador} onAbrir={onAbrirCorona} />
            <button
              className={`icon-btn lift user-profile-btn ${userProfile ? 'has-name' : 'no-name'}`}
              title={userProfile ? `${window.t('Perfil de', 'Profile of')} ${userProfile.name}` : window.t('Iniciar sesión con Google (Requerido para colaborar)', 'Sign in with Google (Required to collaborate)')}
              onClick={() => { onUserClick && onUserClick(); window.playAudioTone && window.playAudioTone('click'); }}
              style={{ marginRight: '6px', position: 'relative' }}
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
              onClick={onSettingsClick}
              style={{ marginRight: '6px' }}
            >
              <span className="material-symbols-rounded">settings</span>
            </button>
            <button
              className="icon-btn lift"
              onClick={()=>setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              <span className="material-symbols-rounded">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button className="icon-btn lift" onClick={onExport} title={window.t('Exportar respaldo JSON', 'Export JSON backup')}>
              <span className="material-symbols-rounded">download</span>
            </button>
            <button className="icon-btn lift" onClick={onImport} title={window.t('Importar respaldo JSON', 'Import JSON backup')}>
              <span className="material-symbols-rounded">upload</span>
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
                onChange={(e)=>setLang(e.target.value)}
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
        </header>

        {section === 'all' && !query && (
          <>
            <section className="ms-hero">
              <div className="ms-hero-text">
                <div className="ms-hero-eyebrow">
                  <span className="dot"/>
                  {window.t('Open source · gratis para siempre', 'Open source · free forever')}
                </div>
                <h1 className="ms-hero-title">
                  {lang==='es' ? (
                    <>Tu mente, ordenada<br/>en <span className="hero-mark">canvases anidados</span>.</>
                  ) : (
                    <>Your mind, organized<br/>as <span className="hero-mark">nested canvases</span>.</>
                  )}
                </h1>
                <p className="ms-hero-sub">{window.t('Pensado para game devs, escritores y creativos que no caben en una sola pantalla. Notas, imágenes, vínculos, tableros — todo en un canvas infinito.', "Built for game devs, writers and creatives who don't fit on one screen. Notes, images, links, boards — all on an infinite canvas.")}</p>
              </div>
              <div className="ms-hero-art">
                <div className="ms-art-card a" style={{background:'#F7DA84'}}>
                  <div className="ms-art-card-body">
                    <div className="ms-art-line w70"/>
                    <div className="ms-art-line w50"/>
                  </div>
                </div>
                <div className="ms-art-card b" style={{background:'#FFFFFF'}}>
                  <div className="ms-art-card-body">
                    <div className="ms-art-line w60"/>
                    <div className="ms-art-line w40"/>
                    <div className="ms-art-line w70"/>
                  </div>
                </div>
                <div className="ms-art-card c" style={{background:'#E8F0DA'}}>
                  <div className="ms-art-card-body">
                    <div className="ms-art-line w80"/>
                    <div className="ms-art-line w50"/>
                  </div>
                </div>
                <svg className="ms-art-line-svg" viewBox="0 0 300 200" preserveAspectRatio="none">
                  <path d="M 70 110 Q 150 50 230 120" stroke="#1A1A1A" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="3 5"/>
                  <circle cx="230" cy="120" r="4" fill="#1A1A1A"/>
                </svg>
              </div>
            </section>

            <section className="ms-section">
              <div className="ms-section-head">
                <h2>{window.t('Recientes', 'Recent')}</h2>
                <button className="ms-section-link">{window.t('Ver todos', 'View all')}</button>
              </div>
              <div className="ms-recent-row">
                {recents.map(p => (
                  <RecentCard key={p.id} project={p} lang={lang} t={t}
                    onOpen={()=>onOpenProject(p.id)}
                    onDelete={()=>onDelete(p.id)}
                    onRenameClick={setEditProject}
                    onToggleStar={()=>onToggleStar(p.id)}
                    onTogglePublic={()=>onTogglePublic(p.id)}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        <section className="ms-section">
          <div className="ms-section-head">
            <h2>
              {section === 'recent' ? (window.t('Recientes', 'Recent')) :
               section === 'starred' ? (window.t('Favoritos', 'Favorites')) :
               section === 'trash' ? (window.t('Papelera', 'Trash')) :
               carpetaAbierta ? (
                 <span className="ms-carpeta-migas">
                   {/* Y también saca: soltar aquí un proyecto lo devuelve a la
                       lista de sueltos. Entrar tenía gesto y salir no. */}
                   <button
                     onClick={()=>setCarpetaAbierta(null)}
                     title={window.t('Volver a todos (o suelta aquí un proyecto para sacarlo)', 'Back to all (or drop a project here to take it out)')}
                     onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                     onDrop={(e)=>{
                       e.preventDefault();
                       document.body.classList.remove('arrastrando-proyecto');
                       const id = e.dataTransfer.getData('text/plain');
                       if (id) mueveACarpeta(id, '');
                     }}
                   >
                     <span className="material-symbols-rounded">arrow_back</span>
                   </button>
                   <span className="material-symbols-rounded">folder</span>
                   {carpetaAbierta}
                 </span>
               ) :
               (window.t('Todos los proyectos', 'All projects'))}
            </h2>
            {section === 'all' && !carpetaAbierta && !buscando && (
              <button className="ms-carpeta-btn" onClick={()=>setNombrando({ inicial: '' })}
                title={window.t('Agrupar proyectos en una carpeta', 'Group projects into a folder')}>
                <span className="material-symbols-rounded">create_new_folder</span>
                <span>{window.t('Carpeta', 'Folder')}</span>
              </button>
            )}
            {/* Dentro de una carpeta, meter proyectos que ya existen. Dentro
                de una vacía no hay nada que arrastrar: lo que quieres meter
                está fuera, en la lista que no estás viendo. */}
            {section === 'all' && carpetaAbierta && (
              <button className="ms-carpeta-btn" onClick={()=>setAnadiendo(carpetaAbierta)}
                title={window.t('Meter aquí proyectos que ya existen', 'Bring existing projects in here')}>
                <span className="material-symbols-rounded">library_add</span>
                <span>{window.t('Añadir proyectos', 'Add projects')}</span>
              </button>
            )}
            <div className="ms-view-toggle">
              <button className={viewMode==='grid'?'active':''} onClick={()=>cambiaVista('grid')} title={window.t('Cuadrícula', 'Grid')}>
                <span className="material-symbols-rounded">grid_view</span>
              </button>
              <button className={viewMode==='list'?'active':''} onClick={()=>cambiaVista('list')} title={window.t('Lista', 'List')}>
                <span className="material-symbols-rounded">view_list</span>
              </button>
            </div>
          </div>
          <div className={`ms-grid ${viewMode==='list'?'ms-grid-list':''}`}>
            {section === 'all' && <NewProjectCard label={t.new_project} onClick={()=>setModal(true)} lang={lang}/>}
            {section === 'all' && !carpetaAbierta && !buscando && carpetas.map(c => (
              <FolderCard key={'carpeta-' + c} nombre={c} cuantos={cuentas[c] || 0} lang={lang}
                portadas={projects.filter(p => !p.deleted && carpetaDe(p) === c).slice(0, 4).map(p => p.cover)}
                onOpen={()=>{ setCarpetaAbierta(c); window.playAudioTone && window.playAudioTone('board_open'); }}
                onRename={()=>setNombrando({ inicial: c })}
                onDelete={()=>quitaCarpeta(c)}
                onSoltar={(id)=>mueveACarpeta(id, c)}
              />
            ))}
             {filtered.map(p => (
              <ProjectCard key={p.id} project={p} lang={lang} t={t}
                isTrash={section==='trash'}
                onOpen={()=>onOpenProject(p.id)}
                onDelete={()=>onDelete(p.id)}
                onRenameClick={setEditProject}
                onRestore={()=>onRestore(p.id)}
                onPurge={()=>onPurge(p.id)}
                onToggleStar={()=>onToggleStar(p.id)}
                onTogglePublic={()=>onTogglePublic(p.id)}
                onMoveClick={()=>setMoviendo(p)}
                dentroDe={carpetaAbierta}
              />
            ))}
            {section === 'all' && carpetaAbierta && filtered.length === 0 && (
              <div className="ms-empty-hint">{window.t('Esta carpeta está vacía. Muévele proyectos con el botón de la carpeta que hay en cada tarjeta.', 'This folder is empty. Move projects in with the folder button on each card.')}</div>
            )}
            {section==='trash' && filtered.length === 0 && (
              <div className="ms-empty-hint">{window.t('La papelera está vacía', 'Trash is empty')}</div>
            )}
          </div>
        </section>
      </main>

      {modal && (
        <NewProjectModal
          lang={lang}
          onClose={()=>setModal(false)}
          onCreate={(p)=>{ onCreate(carpetaAbierta ? { ...p, carpeta: carpetaAbierta } : p); setModal(false); onOpenProject(p.id); }}
        />
      )}
      {moviendo && (
        <MoverACarpetaModal
          project={projects.find(p => p.id === moviendo.id) || moviendo}
          carpetas={carpetas}
          lang={lang}
          onClose={()=>setMoviendo(null)}
          onElegir={(nombre)=>mueveACarpeta(moviendo.id, nombre)}
        />
      )}
      {anadiendo && (
        <AnadirACarpetaModal
          carpeta={anadiendo}
          projects={projects}
          lang={lang}
          onClose={()=>setAnadiendo(null)}
          onAnadir={(ids)=>anadeACarpeta(ids, anadiendo)}
        />
      )}
      {nombrando && (
        <NombrarCarpetaModal
          inicial={nombrando.inicial}
          carpetas={carpetas}
          lang={lang}
          onClose={()=>setNombrando(null)}
          onGuardar={(nombre)=>{ if (nombrando.inicial) renombraCarpeta(nombrando.inicial, nombre); else creaCarpeta(nombre); }}
        />
      )}
      {editProject && (
        <RenameProjectModal
          project={projects.find(p => p.id === editProject.id) || editProject}
          lang={lang}
          onClose={()=>setEditProject(null)}
          onSave={onRename}
          onTogglePublic={onTogglePublic}
          userProfile={userProfile}
        />
      )}
    </div>
  );
}

function RecentCard({ project, lang, t, onOpen, onDelete, onRenameClick, onToggleStar }) {
  const handleContextMenu = (e) => {
    e.preventDefault();
    onRenameClick && onRenameClick(project);
  };

  return (
    <div
      className="ms-recent-card"
      onClick={onOpen}
      onContextMenu={handleContextMenu}
      style={{ position: 'relative' }}
    >
      <div className="ms-recent-cover" style={{background: project.cover}}>
        <div className="ms-recent-emoji">{renderProjectIcon(project.emoji)}</div>
        <div className="ms-card-actions" onClick={(e)=>e.stopPropagation()}>
          <button className="ms-card-btn" title={window.t('Editar proyecto', 'Edit project')}
            onClick={(e)=>{ e.stopPropagation(); onRenameClick && onRenameClick(project); }}>
            <span className="material-symbols-rounded">edit</span>
          </button>
          <button className={`ms-card-btn star-btn ${project.starred?'on':''}`} title={window.t('Favorito', 'Star')}
            onClick={(e)=>{ e.stopPropagation(); onToggleStar && onToggleStar(); }}>
            <span className="material-symbols-rounded">{project.starred?'star':'star_border'}</span>
          </button>
          <button className="ms-card-btn danger" title={window.t('Mover a papelera', 'Move to trash')}
            onClick={(e)=>{ e.stopPropagation(); onDelete && onDelete(); }}>
            <span className="material-symbols-rounded">delete</span>
          </button>
        </div>
      </div>
      <div className="ms-recent-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div className="ms-recent-title" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {window.pickLang(project.name, lang)}
          </div>
          {(project.isPublic || project.isRemote) ? (
            <div
              className="odi-nube"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--olive, #6A8546)', flexShrink: 0, cursor: 'pointer' }}
              title={window.t('Proyecto Online - Clic para copiar token', 'Online Project - Click to copy token')}
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(project.shareToken || project.id);
                window.showToast && window.showToast(window.t('¡Token copiado al portapapeles!', 'Token copied to clipboard!'));
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px', fontVariationSettings: '"FILL" 1' }}>cloud</span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--olive, #6A8546)', display: 'inline-block', boxShadow: '0 0 6px var(--olive, #6A8546)' }} />
            </div>
          ) : (
            <div className="odi-nube" style={{ display: 'flex', alignItems: 'center', color: 'var(--line-soft, #A5A19C)', flexShrink: 0 }} title={window.t('Solo local', 'Local only')}>
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>cloud_off</span>
            </div>
          )}
        </div>
        <div className="ms-recent-meta">
          <span>{project.items} {t.items_count}</span>
          <span className="dot"/>
          <span>{window.pickLang(project.updated, lang) || (window.t('recién', 'recent'))}</span>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, lang, t, onOpen, onDelete, onRenameClick, onRestore, onPurge, onToggleStar, isTrash, onMoveClick, dentroDe }) {
  const handleContextMenu = (e) => {
    if (isTrash) return;
    e.preventDefault();
    onRenameClick && onRenameClick(project);
  };

  return (
    <div
      /* Un proyecto al que te invitaron se marca en ámbar: es de otra persona,
         vive en su equipo y desaparece cuando cierra la sesión. Sin esa señal
         se confunde con los propios y da un susto al no encontrarlo luego. */
      className={`ms-project-card ${project.invitado ? 'es-invitado' : ''}`}
      /* Se arrastra a una carpeta. El navegador ya distingue arrastrar de
         hacer clic, así que soltar sin moverse sigue abriendo el proyecto. */
      draggable={!isTrash}
      onDragStart={(e)=>{
        e.dataTransfer.setData('text/plain', project.id);
        e.dataTransfer.effectAllowed = 'move';
        document.body.classList.add('arrastrando-proyecto');
      }}
      onDragEnd={()=>document.body.classList.remove('arrastrando-proyecto')}
      onClick={isTrash ? undefined : onOpen}
      onContextMenu={handleContextMenu}
      style={{position:'relative'}}
    >
      <div className="ms-project-cover" style={{ background: project.cover }}>
        <div className="ms-project-emoji">{renderProjectIcon(project.emoji)}</div>
        {project.invitado && (
          <div className="ms-invitado-chip" title={window.t('Es de otra persona: lo ves mientras dure su sesión', 'Someone else\'s: you see it while their session lasts')}>
            <span className="material-symbols-rounded">group</span>
            <span>{window.t('Invitado', 'Guest')}</span>
          </div>
        )}
        <div className="ms-card-actions" onClick={(e)=>e.stopPropagation()}>
          {isTrash ? (
            <>
              <button className="ms-card-btn" title={window.t('Restaurar', 'Restore')}
                onClick={(e)=>{ e.stopPropagation(); onRestore && onRestore(); }}>
                <span className="material-symbols-rounded">restore_from_trash</span>
              </button>
              <button className="ms-card-btn danger" title={window.t('Eliminar definitivamente', 'Delete forever')}
                onClick={(e)=>{ e.stopPropagation(); onPurge && onPurge(); }}>
                <span className="material-symbols-rounded">delete_forever</span>
              </button>
            </>
          ) : (
            <>
              <button className="ms-card-btn" title={window.t('Editar proyecto', 'Edit project')}
                onClick={(e)=>{ e.stopPropagation(); onRenameClick && onRenameClick(project); }}>
                <span className="material-symbols-rounded">edit</span>
              </button>
              <button className={`ms-card-btn star-btn ${project.starred?'on':''}`} title={window.t('Favorito', 'Star')}
                onClick={(e)=>{ e.stopPropagation(); onToggleStar && onToggleStar(); }}>
                <span className="material-symbols-rounded">{project.starred?'star':'star_border'}</span>
              </button>
              {onMoveClick && (
                <button className="ms-card-btn" title={window.t('Mover a una carpeta', 'Move to a folder')}
                  onClick={(e)=>{ e.stopPropagation(); onMoveClick(); }}>
                  <span className="material-symbols-rounded">drive_file_move</span>
                </button>
              )}
              <button className="ms-card-btn danger" title={window.t('Mover a papelera', 'Move to trash')}
                onClick={(e)=>{ e.stopPropagation(); onDelete && onDelete(); }}>
                <span className="material-symbols-rounded">delete</span>
              </button>
            </>
          )}
        </div>
      </div>
      <div className="ms-project-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div className="ms-project-title" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {window.pickLang(project.name, lang)}
          </div>
          {(project.isPublic || project.isRemote) ? (
            <div
              className="odi-nube"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--olive, #6A8546)', flexShrink: 0, cursor: 'pointer' }}
              title={window.t('Proyecto Online - Clic para copiar token', 'Online Project - Click to copy token')}
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(project.shareToken || project.id);
                window.showToast && window.showToast(window.t('¡Token copiado al portapapeles!', 'Token copied to clipboard!'));
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px', fontVariationSettings: '"FILL" 1' }}>cloud</span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--olive, #6A8546)', display: 'inline-block', boxShadow: '0 0 6px var(--olive, #6A8546)' }} />
            </div>
          ) : (
            <div className="odi-nube" style={{ display: 'flex', alignItems: 'center', color: 'var(--line-soft, #A5A19C)', flexShrink: 0 }} title={window.t('Solo local', 'Local only')}>
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>cloud_off</span>
            </div>
          )}
        </div>
        <div className="ms-project-meta">
          <span>{project.items} {t.items_count}</span>
          <span className="dot"/>
          <span>{window.pickLang(project.updated, lang) || (window.t('recién', 'recent'))}</span>
          {/* Buscando y en Favoritos las tarjetas salen fuera de su carpeta;
              sin esto no había forma de saber dónde vive cada una. Dentro de
              esa misma carpeta no se enseña: ahí lo dicen ya las migas de
              arriba, y repetirlo en cada tarjeta es ruido. */}
          {window.carpetaDe(project) && window.carpetaDe(project) !== dentroDe && (
            <span className="ms-carpeta-chip" title={window.t('Está en esta carpeta', 'It lives in this folder')}>
              <span className="material-symbols-rounded">folder</span>
              {window.carpetaDe(project)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Una carpeta en la rejilla. Se abre con un clic, como un proyecto, y enseña
// los colores de portada de lo que guarda: de un vistazo se reconoce el cajón
// sin tener que leer el nombre.
function FolderCard({ nombre, cuantos, portadas, onOpen, onRename, onDelete, onSoltar, lang }) {
  // Solo para pintar el borde mientras tienes algo encima: sin esa señal no
  // se sabe si vas a soltarlo dentro o al lado.
  const [encima, setEncima] = useStateHome(false);
  return (
    <div
      className={`ms-project-card ms-folder-card${encima ? ' soltando' : ''}`}
      onClick={onOpen}
      onContextMenu={(e)=>{ e.preventDefault(); onRename && onRename(); }}
      onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!encima) setEncima(true); }}
      onDragLeave={()=>setEncima(false)}
      onDrop={(e)=>{
        e.preventDefault();
        setEncima(false);
        // Se limpia aqui y no solo en el dragend: al soltar, React quita esa
        // tarjeta de la lista y el dragend llega cuando su elemento ya no
        // esta en la pagina, asi que no se ejecuta nunca.
        document.body.classList.remove('arrastrando-proyecto');
        const id = e.dataTransfer.getData('text/plain');
        if (id && onSoltar) onSoltar(id);
      }}
      style={{position:'relative'}}
    >
      <div className="ms-project-cover ms-folder-cover">
        <div className="ms-folder-peek">
          {portadas.length === 0
            ? <span className="material-symbols-rounded ms-folder-vacia">folder_open</span>
            : portadas.map((c, i) => <i key={i} style={{ background: c }}/>)}
        </div>
        <div className="ms-card-actions" onClick={(e)=>e.stopPropagation()}>
          <button className="ms-card-btn" title={window.t('Cambiar el nombre', 'Rename')}
            onClick={(e)=>{ e.stopPropagation(); onRename && onRename(); }}>
            <span className="material-symbols-rounded">edit</span>
          </button>
          {/* Quitar la carpeta NO borra nada de dentro: sus proyectos vuelven a
              quedar sueltos. Por eso no lleva el rojo de los botones que sí
              destruyen algo. */}
          <button className="ms-card-btn" title={window.t('Quitar la carpeta (los proyectos se quedan)', 'Remove the folder (projects stay)')}
            onClick={(e)=>{ e.stopPropagation(); onDelete && onDelete(); }}>
            <span className="material-symbols-rounded">folder_off</span>
          </button>
        </div>
      </div>
      <div className="ms-project-body">
        <div className="ms-project-title" style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span className="material-symbols-rounded" style={{ fontSize:18, flexShrink:0 }}>folder</span>
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nombre}</span>
        </div>
        <div className="ms-project-meta">
          <span>{cuantos} {cuantos === 1 ? window.t('proyecto', 'project') : window.t('proyectos', 'projects')}</span>
        </div>
      </div>
    </div>
  );
}

// Elegir carpeta para un proyecto. Ventana y no menú flotante porque la
// tarjeta puede estar en cualquier parte de la rejilla —y en la vista de lista
// mide cuarenta píxeles de alto—: un desplegable ahí se sale de la pantalla en
// la última fila.
function MoverACarpetaModal({ project, carpetas, lang, onClose, onElegir }) {
  const actual = window.carpetaDe(project);
  const [nueva, setNueva] = useStateHome('');
  const elige = (nombre) => { onElegir(nombre); onClose(); };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <h2>{window.t('Mover a una carpeta', 'Move to a folder')}</h2>
        <p>{window.pickLang(project.name, lang)}</p>

        <div className="ms-carpeta-lista">
          <button className={`ms-carpeta-op ${!actual ? 'active' : ''}`} onClick={()=>elige('')}>
            <span className="material-symbols-rounded">folder_off</span>
            <span>{window.t('Sin carpeta', 'No folder')}</span>
            {!actual && <span className="material-symbols-rounded tic">check</span>}
          </button>
          {carpetas.map(c => (
            <button key={c} className={`ms-carpeta-op ${actual === c ? 'active' : ''}`} onClick={()=>elige(c)}>
              <span className="material-symbols-rounded">folder</span>
              <span>{c}</span>
              {actual === c && <span className="material-symbols-rounded tic">check</span>}
            </button>
          ))}
        </div>

        {/* Crear la carpeta desde aquí mismo: querer meter un proyecto en una
            carpeta que todavía no existe es justo cuando se crea la primera. */}
        <div className="field ms-carpeta-nueva">
          <label>{window.t('O una carpeta nueva', 'Or a new folder')}</label>
          <div className="ms-carpeta-nueva-fila">
            <input
              type="text"
              value={nueva}
              placeholder={window.t('Trabajo, Personal, Novela…', 'Work, Personal, Novel…')}
              onChange={(e)=>setNueva(e.target.value)}
              onKeyDown={(e)=>{ if (e.key === 'Enter' && nueva.trim()) elige(nueva.trim()); }}
            />
            <button className="btn btn-primary" disabled={!nueva.trim()}
              style={{opacity: nueva.trim() ? 1 : 0.5}}
              onClick={()=>{ if (nueva.trim()) elige(nueva.trim()); }}>
              {window.t('Crear y mover', 'Create & move')}
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>{window.t('Cancelar', 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
}

// Meter en la carpeta proyectos que ya existen, varios de una vez. Hace falta
// aunque se puedan arrastrar: dentro de una carpeta vacía no hay nada que
// arrastrar —lo que quieres meter está fuera, en la lista que no estás viendo—
// y con veinte proyectos, arrastrar de uno en uno es un castigo.
function AnadirACarpetaModal({ carpeta, projects, lang, onClose, onAnadir }) {
  const fuera = projects.filter(p => !p.deleted && window.carpetaDe(p) !== carpeta);
  const [elegidos, setElegidos] = useStateHome([]);
  const [busca, setBusca] = useStateHome('');
  const q = busca.trim().toLowerCase();
  const lista = q
    ? fuera.filter(p => window.pickLang(p.name, lang).toLowerCase().includes(q))
    : fuera;
  const alterna = (id) => setElegidos(prev => prev.indexOf(id) === -1 ? [...prev, id] : prev.filter(x => x !== id));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <h2>{window.t('Añadir a', 'Add to')} «{carpeta}»</h2>
        <p>{window.t('Marca los proyectos que quieras meter aquí. Los que ya estén en otra carpeta se cambian a esta.', 'Tick the projects you want in here. Any already in another folder move to this one.')}</p>

        {fuera.length === 0 ? (
          <p className="ms-carpeta-aviso">{window.t('No queda ningún proyecto fuera de esta carpeta.', 'No projects left outside this folder.')}</p>
        ) : (
          <>
            {/* El buscador solo aparece cuando hay bastantes: con cuatro
                proyectos es un campo de más que estorba. */}
            {fuera.length > 6 && (
              <div className="field">
                <input
                  type="text"
                  autoFocus
                  value={busca}
                  placeholder={window.t('Buscar entre tus proyectos…', 'Search your projects…')}
                  onChange={(e)=>setBusca(e.target.value)}
                />
              </div>
            )}
            <div className="ms-carpeta-lista">
              {lista.length === 0 && (
                <div className="ms-carpeta-op" style={{opacity:0.6, cursor:'default'}}>
                  <span className="material-symbols-rounded">search_off</span>
                  <span>{window.t('Nada con ese nombre', 'Nothing by that name')}</span>
                </div>
              )}
              {lista.map(p => {
                const marcado = elegidos.indexOf(p.id) !== -1;
                const suya = window.carpetaDe(p);
                return (
                  <button key={p.id} className={`ms-carpeta-op ${marcado ? 'active' : ''}`} onClick={()=>alterna(p.id)}>
                    <span className="material-symbols-rounded">{marcado ? 'check_box' : 'check_box_outline_blank'}</span>
                    <span className="ms-anadir-nombre">{window.pickLang(p.name, lang)}</span>
                    {/* Si ya está en otra, se dice: mover no es copiar, y desde
                        aquí no se ve de dónde sale. */}
                    {suya && !marcado && (
                      <span className="ms-anadir-donde">
                        <span className="material-symbols-rounded">folder</span>{suya}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>{window.t('Cancelar', 'Cancel')}</button>
          <button
            className="btn btn-primary"
            disabled={elegidos.length === 0}
            style={{opacity: elegidos.length ? 1 : 0.5}}
            onClick={()=>{ onAnadir(elegidos); onClose(); }}
          >
            {elegidos.length <= 1
              ? window.t('Añadir', 'Add')
              : window.t('Añadir ' + elegidos.length, 'Add ' + elegidos.length)}
          </button>
        </div>
      </div>
    </div>
  );
}

// Poner o cambiar el nombre de una carpeta.
function NombrarCarpetaModal({ inicial, carpetas, lang, onClose, onGuardar }) {
  const [nombre, setNombre] = useStateHome(inicial || '');
  const limpio = nombre.trim();
  // Dos carpetas con el mismo nombre serían la misma carpeta —el nombre ES la
  // carpeta—, así que se avisa antes de dejar guardar.
  const repetido = !!limpio && limpio.toLowerCase() !== String(inicial || '').toLowerCase()
    && carpetas.some(c => c.toLowerCase() === limpio.toLowerCase());
  const guarda = () => { if (limpio && !repetido) { onGuardar(limpio); onClose(); } };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <h2>{inicial ? window.t('Cambiar el nombre', 'Rename folder') : window.t('Carpeta nueva', 'New folder')}</h2>
        <p>{window.t('Las carpetas solo agrupan la pantalla de inicio. No mueven ningún archivo ni cambian dónde se guarda nada.', 'Folders only group the home screen. They move no files and change nothing about where anything is stored.')}</p>
        <div className="field">
          <label>{window.t('Nombre', 'Name')}</label>
          <input
            type="text"
            autoFocus
            value={nombre}
            placeholder={window.t('Trabajo, Personal, Novela…', 'Work, Personal, Novel…')}
            onChange={(e)=>setNombre(e.target.value)}
            onKeyDown={(e)=>{ if (e.key === 'Enter') guarda(); }}
          />
        </div>
        {repetido && (
          <p className="ms-carpeta-aviso">{window.t('Ya hay una carpeta con ese nombre', 'There is already a folder with that name')}</p>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>{window.t('Cancelar', 'Cancel')}</button>
          <button className="btn btn-primary" disabled={!limpio || repetido}
            style={{opacity: (limpio && !repetido) ? 1 : 0.5}} onClick={guarda}>
            {window.t('Guardar', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewProjectCard({ label, onClick, lang }) {
  return (
    // `position: relative` como en las tarjetas de proyecto de verdad, que lo
    // llevan puesto. Era la única que no, y esa asimetría es la que dejaba
    // suelta la textura de su portada: sin un antepasado colocado, lo que
    // debía cubrir 84x60 píxeles se estiraba por toda el área de proyectos.
    <div className="ms-project-card ms-new-project-card" onClick={onClick} style={{ position: 'relative' }}>
      <div className="ms-project-cover ms-new-cover">
        <div className="ms-new-plus">
          <span className="material-symbols-rounded">add</span>
        </div>
      </div>
      <div className="ms-project-body">
        <div className="ms-project-title">{label}</div>
        <div className="ms-project-meta">
          <span>{window.t('Canvas en blanco', 'Blank canvas')}</span>
        </div>
      </div>
    </div>
  );
}

function NewProjectModal({ lang, onClose, onCreate }) {
  const [name, setName]   = useStateHome('');
  const [emoji, setEmoji] = useStateHome(EMOJI_PRESETS[0]);
  const [cover, setCover] = useStateHome(COVER_PRESETS[0]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `proj-${Date.now()}-${Math.floor(Math.random()*9999)}`;
    onCreate({
      id,
      name: { es: trimmed, en: trimmed },
      emoji, cover,
      updated: { es: 'ahora', en: 'just now' },
      items: 0,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <h2>{window.t('Nuevo proyecto', 'New project')}</h2>
        <p>{window.t('Empieza con un canvas en blanco — luego añade tableros, notas, lo que necesites.', 'Start with a blank canvas — then add boards, notes, whatever you need.')}</p>

        <div className="field">
          <label>{window.t('Nombre', 'Name')}</label>
          <input
            autoFocus
            value={name}
            onChange={(e)=>setName(e.target.value)}
            onKeyDown={(e)=>{ if (e.key==='Enter') submit(); }}
            placeholder={window.t('Mi nuevo proyecto…', 'My new project…')}
          />
        </div>

        <div className="field">
          <label>{window.t('Ícono', 'Icon')}</label>
          <div className="emoji-row">
            {EMOJI_PRESETS.map(e => (
              <button key={e} className={`emoji-pick ${emoji===e?'active':''}`} onClick={()=>setEmoji(e)}>{renderProjectIcon(e)}</button>
            ))}
          </div>
        </div>

        <CampoPortada cover={cover} onCambio={setCover} />

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>{window.t('Cancelar', 'Cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={!name.trim()}
            style={{opacity: name.trim() ? 1 : 0.5}}
          >
            {window.t('Crear proyecto', 'Create project')}
          </button>
        </div>
      </div>
    </div>
  );
}

function RenameProjectModal({ project, lang, onClose, onSave, onTogglePublic, userProfile }) {
  const [name, setName]     = useStateHome(window.pickLang(project.name, lang));
  const [emoji, setEmoji]   = useStateHome(project.emoji || EMOJI_PRESETS[0]);
  const [cover, setCover]   = useStateHome(project.cover || COVER_PRESETS[0]);
  // Derivado del proyecto real: poner Online es asíncrono (sube a Drive primero),
  // así que un estado local aquí se quedaba desfasado y mostraba "Offline" a proyectos online
  const isPublic = !!project.isPublic;
  const [copied, setCopied] = useStateHome(false);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(project.id, trimmed, emoji, cover);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <h2>{window.t('Editar proyecto', 'Edit project')}</h2>
        <p>{window.t('Cambia el nombre, ícono, portada y disponibilidad en la nube de tu proyecto.', 'Change the name, icon, cover, and cloud availability of your project.')}</p>

        <div className="field">
          <label>{window.t('Nombre', 'Name')}</label>
          <input
            autoFocus
            value={name}
            onChange={(e)=>setName(e.target.value)}
            onKeyDown={(e)=>{ if (e.key==='Enter') submit(); }}
            placeholder={window.t('Nombre del proyecto…', 'Project name…')}
          />
        </div>

        <div className="field">
          <label>{window.t('Ícono', 'Icon')}</label>
          <div className="emoji-row">
            {EMOJI_PRESETS.map(e => (
              <button key={e} className={`emoji-pick ${emoji===e?'active':''}`} onClick={()=>setEmoji(e)}>{renderProjectIcon(e)}</button>
            ))}
          </div>
        </div>

        <CampoPortada cover={cover} onCambio={setCover} />

        {/* Cloud availability setting */}
        <div className="field" style={{ marginTop: '20px', borderTop: '1px solid var(--line-soft, #E5E1DD)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left', flex: 1, paddingRight: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--ink, #1A1A1A)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '18px', color: isPublic ? 'var(--brand-green, #90B968)' : 'var(--text-soft, #595459)' }}>
                  {isPublic ? 'cloud' : 'cloud_off'}
                </span>
                {window.t('Disponibilidad del Proyecto', 'Project Availability')}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-soft, #595459)', lineHeight: '1.4' }}>
                {isPublic 
                  ? window.t('Sincronizado en la nube (Online). Tus colaboradores pueden acceder.', 'Synced in the cloud (Online). Your collaborators can access.')
                  : window.t('Guardado solo localmente (Offline). Privado y seguro.', 'Saved locally only (Offline). Private and secure.')
                }
              </span>
            </div>
            
            <button
              className="btn"
              onClick={() => {
                if (isPublic) {
                  onTogglePublic && onTogglePublic(project.id);
                } else {
                  if (!userProfile) {
                    window.customAlert(window.t(
                      'Debes iniciar sesión con Google primero desde tu perfil (esquina superior derecha) antes de poner un proyecto Online.',
                      'You must sign in with Google first from your profile (top right corner) before putting a project Online.'
                    ));
                    return;
                  }
                  
                  const msg = window.t(
                    '¿Quieres poner este proyecto online? Se subirá a la nube y se vinculará con tu cuenta de Google Drive para imágenes y archivos pesados, consumiendo espacio de tu cuenta de Google.',
                    'Do you want to put this project online? It will be uploaded to the cloud and linked with your Google Drive account for images and large files, consuming space from your Google account.'
                  );
                  window.customConfirm(msg).then((accepted) => {
                    if (accepted) {
                      onTogglePublic && onTogglePublic(project.id);
                    }
                  });
                }
              }}
              style={{
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: '700',
                borderRadius: '6px',
                border: '1.5px solid var(--line)',
                background: isPublic ? 'rgba(144, 185, 104, 0.15)' : 'transparent',
                color: isPublic ? 'var(--brand-green, #6A8546)' : 'var(--ink, #1A1A1A)',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              {isPublic ? window.t('Poner Offline', 'Put Offline') : window.t('Poner Online', 'Put Online')}
            </button>
          </div>
          
          {isPublic && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-soft, #595459)' }}>
                {window.t('Token de invitación (Comparte esto)', 'Invitation Token (Share this)')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--bg-main, #FAF9F6)', border: '1.5px solid var(--line-soft, #E5E1DD)', borderRadius: '8px' }}>
                <code style={{ flex: 1, fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: 'var(--ink, #1A1A1A)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                  {project.shareToken || project.id}
                </code>
                <button
                  className="btn lift"
                  onClick={() => {
                    navigator.clipboard.writeText(project.shareToken || project.id);
                    setCopied(true);
                    window.playAudioTone && window.playAudioTone('click');
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    border: '1.5px solid var(--line)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: copied ? '#6A8546' : '#FFFFFF',
                    color: copied ? '#FFFFFF' : '#1A1A1A',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {copied ? window.t('¡Copiado!', 'Copied!') : window.t('Copiar', 'Copy')}
                </button>
              </div>
              {copied && (
                <div style={{ fontSize: '11px', color: '#6A8546', fontWeight: '700', marginTop: '4px', textAlign: 'left', animation: 'fadeIn 0.2s ease' }}>
                  ✓ {window.t('Copiado al portapapeles', 'Copied to clipboard')}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button className="btn btn-ghost" onClick={onClose}>{window.t('Cancelar', 'Cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={!name.trim()}
            style={{opacity: name.trim() ? 1 : 0.5}}
          >
            {window.t('Guardar cambios', 'Save changes')}
          </button>
        </div>
      </div>
    </div>
  );
}

window.Home = Home;
window.BrandMark = BrandMark;
