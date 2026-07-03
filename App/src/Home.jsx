// =====================================================
// Odinote — Home v4 (Miro-style with sidebar)
// =====================================================
const { useState: useStateHome, useMemo: useMemoHome } = React;

function BrandMark() {
  // Original logo, shown without the black box (container background is transparent now)
  return (
    <img
      src="./Icon/Icon.png"
      alt="Odinote"
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
const EMOJI_PRESETS = ['⚔️','🌾','🚀','🧩','🎲','🗺️','🏰','🐉','🎮','🌙','🔥','💎','🎨','📚','💡','🎯'];

function Home({ lang, setLang, theme, setTheme, onOpenProject, projects, onCreate, onDelete, onRename, onRestore, onPurge, onToggleStar, onExport, onImport, vaultPath, onOpenVault, onCloseVault, updateAvailable, onUpdateClick, onSettingsClick, userProfile, onUserClick, onJoinProjectClick, onTogglePublic }) {
  const t = window.TRANSLATIONS[lang];
  const [query, setQuery] = useStateHome('');
  const [modal, setModal] = useStateHome(false);
  const [section, setSection] = useStateHome('all');
  const [viewMode, setViewMode] = useStateHome('grid'); // 'grid' | 'list'
  const [editProject, setEditProject] = useStateHome(null);



  const filtered = useMemoHome(() => {
    let list = projects;
    if (section === 'starred') list = list.filter(p => p.starred);
    if (section === 'trash') list = list.filter(p => p.deleted);
    else list = list.filter(p => !p.deleted);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p => (p.name?.[lang] || p.name).toLowerCase().includes(q));
    }
    return list;
  }, [query, lang, projects, section]);

  const recents = projects.filter(p => !p.deleted).slice(0, 4);

  return (
    <div className="miro-home" data-screen-label="Home">
      {/* Sidebar */}
      <aside className="ms-side">
        <div className="ms-brand">
          <div className="brand-mark"><BrandMark/></div>
          <span>Odinote</span>
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
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>group_add</span>
          <span>{window.t('Unirse a Puesto', 'Join Workspace')}</span>
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
              {window.t('Apoya Odinote', 'Support Odinote')}
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
            {window.t('Odinote es 100% gratuito. Si te ayuda en tus apuntes, considera hacernos una donación para apoyar el desarrollo independiente.', 'Odinote is 100% free. If it helps you with your notes, consider supporting independent development.')}
          </p>

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
          <div className="ms-search">
            <span className="material-symbols-rounded">search</span>
            <input
              placeholder={window.t('Buscar proyectos, tableros, notas…', 'Search projects, boards, notes…')}
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
            />
          </div>
          <div className="ms-top-actions">
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
               (window.t('Todos los proyectos', 'All projects'))}
            </h2>
            <div className="ms-view-toggle">
              <button className={viewMode==='grid'?'active':''} onClick={()=>setViewMode('grid')} title={window.t('Cuadrícula', 'Grid')}>
                <span className="material-symbols-rounded">grid_view</span>
              </button>
              <button className={viewMode==='list'?'active':''} onClick={()=>setViewMode('list')} title={window.t('Lista', 'List')}>
                <span className="material-symbols-rounded">view_list</span>
              </button>
            </div>
          </div>
          <div className={`ms-grid ${viewMode==='list'?'ms-grid-list':''}`}>
            {section === 'all' && <NewProjectCard label={t.new_project} onClick={()=>setModal(true)} lang={lang}/>}
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
              />
            ))}
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
          onCreate={(p)=>{ onCreate(p); setModal(false); onOpenProject(p.id); }}
        />
      )}
      {editProject && (
        <RenameProjectModal
          project={editProject}
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
        <div className="ms-recent-emoji">{project.emoji}</div>
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
            {project.name?.[lang] || project.name}
          </div>
          {(project.isPublic || project.isRemote) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--olive, #6A8546)', flexShrink: 0 }} title={window.t('Proyecto Online', 'Online Project')}>
              <span className="material-symbols-rounded" style={{ fontSize: '18px', fontVariationSettings: '"FILL" 1' }}>cloud</span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--olive, #6A8546)', display: 'inline-block', boxShadow: '0 0 6px var(--olive, #6A8546)' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--line-soft, #A5A19C)', flexShrink: 0 }} title={window.t('Solo local', 'Local only')}>
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>cloud_off</span>
            </div>
          )}
        </div>
        <div className="ms-recent-meta">
          <span>{project.items} {t.items_count}</span>
          <span className="dot"/>
          <span>{project.updated?.[lang] || project.updated || (window.t('recién', 'recent'))}</span>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, lang, t, onOpen, onDelete, onRenameClick, onRestore, onPurge, onToggleStar, isTrash }) {
  const handleContextMenu = (e) => {
    if (isTrash) return;
    e.preventDefault();
    onRenameClick && onRenameClick(project);
  };

  return (
    <div
      className="ms-project-card"
      onClick={isTrash ? undefined : onOpen}
      onContextMenu={handleContextMenu}
      style={{position:'relative'}}
    >
      <div className="ms-project-cover" style={{ background: project.cover }}>
        <div className="ms-project-emoji">{project.emoji}</div>
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
            {project.name?.[lang] || project.name}
          </div>
          {(project.isPublic || project.isRemote) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--olive, #6A8546)', flexShrink: 0 }} title={window.t('Proyecto Online', 'Online Project')}>
              <span className="material-symbols-rounded" style={{ fontSize: '18px', fontVariationSettings: '"FILL" 1' }}>cloud</span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--olive, #6A8546)', display: 'inline-block', boxShadow: '0 0 6px var(--olive, #6A8546)' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--line-soft, #A5A19C)', flexShrink: 0 }} title={window.t('Solo local', 'Local only')}>
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>cloud_off</span>
            </div>
          )}
        </div>
        <div className="ms-project-meta">
          <span>{project.items} {t.items_count}</span>
          <span className="dot"/>
          <span>{project.updated?.[lang] || project.updated || (window.t('recién', 'recent'))}</span>
        </div>
      </div>
    </div>
  );
}

function NewProjectCard({ label, onClick, lang }) {
  return (
    <div className="ms-project-card ms-new-project-card" onClick={onClick}>
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
              <button key={e} className={`emoji-pick ${emoji===e?'active':''}`} onClick={()=>setEmoji(e)}>{e}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>{window.t('Portada', 'Cover')}</label>
          <div className="cover-row">
            {COVER_PRESETS.map(c => (
              <button
                key={c}
                className={`cover-pick ${cover===c?'active':''}`}
                style={{background: c, border: '1.5px solid var(--line)'}}
                onClick={()=>setCover(c)}
              />
            ))}
          </div>
        </div>

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
  const [name, setName]     = useStateHome(project.name?.[lang] || project.name || '');
  const [emoji, setEmoji]   = useStateHome(project.emoji || EMOJI_PRESETS[0]);
  const [cover, setCover]   = useStateHome(project.cover || COVER_PRESETS[0]);
  const [isPublic, setIsPublic] = useStateHome(!!project.isPublic);

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
              <button key={e} className={`emoji-pick ${emoji===e?'active':''}`} onClick={()=>setEmoji(e)}>{e}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>{window.t('Portada', 'Cover')}</label>
          <div className="cover-row">
            {COVER_PRESETS.map(c => (
              <button
                key={c}
                className={`cover-pick ${cover===c?'active':''}`}
                style={{background: c, border: '1.5px solid var(--line)'}}
                onClick={()=>setCover(c)}
              />
            ))}
          </div>
        </div>

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
                  setIsPublic(false);
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
                      setIsPublic(true);
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
