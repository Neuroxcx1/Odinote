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

function Home({ lang, setLang, theme, setTheme, onOpenProject, projects, onCreate, onDelete, onRestore, onPurge, onToggleStar, onExport, onImport, vaultPath, onOpenVault, onCloseVault, updateAvailable, onUpdateClick }) {
  const t = window.TRANSLATIONS[lang];
  const [query, setQuery] = useStateHome('');
  const [modal, setModal] = useStateHome(false);
  const [section, setSection] = useStateHome('all');
  const [viewMode, setViewMode] = useStateHome('grid'); // 'grid' | 'list'



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

        <nav className="ms-nav">
          <div className="ms-nav-label">{lang==='es'?'Espacios':'Spaces'}</div>
          <button className={`ms-nav-item ${section==='all'?'active':''}`} onClick={()=>setSection('all')}>
            <span className="material-symbols-rounded">grid_view</span>
            <span>{lang==='es'?'Todos los proyectos':'All projects'}</span>
            <span className="ms-nav-count">{projects.length}</span>
          </button>
          <button className={`ms-nav-item ${section==='recent'?'active':''}`} onClick={()=>setSection('recent')}>
            <span className="material-symbols-rounded">schedule</span>
            <span>{lang==='es'?'Recientes':'Recent'}</span>
          </button>
          <button className={`ms-nav-item ${section==='starred'?'active':''}`} onClick={()=>setSection('starred')}>
            <span className="material-symbols-rounded">star</span>
            <span>{lang==='es'?'Favoritos':'Favorites'}</span>
          </button>
          <button className={`ms-nav-item ${section==='trash'?'active':''}`} onClick={()=>setSection('trash')}>
            <span className="material-symbols-rounded">delete_outline</span>
            <span>{lang==='es'?'Papelera':'Trash'}</span>
          </button>
        </nav>

        {/* Vault Controls */}
        {window.electronAPI ? (
          <div className="vault-sidebar-card" style={{ padding: '12px 16px', background: 'var(--bg-card, #FFFFFF)', borderRadius: '12px', border: '1.5px solid var(--line-soft, #E5E1DD)', display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0 12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--wine, #7B2D26)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>folder_shared</span>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>
                {lang === 'es' ? 'Bóveda Local' : 'Local Vault'}
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
                  <span>{lang === 'es' ? 'Desconectar Bóveda' : 'Disconnect Vault'}</span>
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: '11px', color: 'var(--text-soft, #595459)', margin: 0, lineHeight: '1.4' }}>
                  {lang === 'es' ? 'Guarda todo directamente en carpetas de tu PC.' : 'Save everything directly to folders on your PC.'}
                </p>
                <button
                  className="ms-new-btn"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px', background: 'var(--wine, #7B2D26)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  onClick={onOpenVault}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>folder_open</span>
                  <span>{lang === 'es' ? 'Abrir Carpeta' : 'Open Folder'}</span>
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="vault-sidebar-card disabled" style={{ padding: '12px 16px', background: 'var(--bg-card, #FFFFFF)', borderRadius: '12px', border: '1.5px solid var(--line-soft, #E5E1DD)', opacity: 0.7, display: 'flex', flexDirection: 'column', gap: '6px', margin: '16px 0 12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-soft, #595459)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>folder_shared</span>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>
                {lang === 'es' ? 'Bóveda Local' : 'Local Vault'}
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-soft, #595459)', margin: 0, lineHeight: '1.4' }}>
              {lang === 'es' ? 'Disponible en la versión de escritorio para PC.' : 'Available in the desktop version for PC.'}
            </p>
          </div>
        )}

        <div className="ms-side-spacer" style={{ flex: 1 }}/>

        <div className="kofi-sidebar-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-card, #FFFFFF)', borderRadius: '12px', border: '1.5px solid var(--line-soft, #E5E1DD)', marginTop: '8px' }}>
          <div className="kofi-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--wine, #7B2D26)', fontWeight: '600', fontSize: '14px' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>favorite</span>
            <span style={{ fontWeight: '600', fontSize: '14px' }}>
              {lang === 'es' ? 'Apoya Odinote' : 'Support Odinote'}
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
            {lang === 'es' 
              ? 'Odinote es 100% gratuito. Si te ayuda en tus apuntes, considera hacernos una donación para apoyar el desarrollo independiente.' 
              : 'Odinote is 100% free. If it helps you with your notes, consider supporting independent development.'}
          </p>

          <button
            className="ms-new-btn"
            style={{ width: '100%', padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--wine, #7B2D26)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', marginTop: '2px' }}
            onClick={() => window.open('https://ko-fi.com/neuroxcx', '_blank', 'noopener,noreferrer')}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>coffee</span>
            <span>{lang === 'es' ? 'Apoyar en Ko-fi' : 'Support on Ko-fi'}</span>
          </button>
        </div>

      </aside>

      {/* Main */}
      <main className="ms-main">
        <header className="ms-top">
          <div className="ms-search">
            <span className="material-symbols-rounded">search</span>
            <input
              placeholder={lang==='es'?'Buscar proyectos, tableros, notas…':'Search projects, boards, notes…'}
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
            />
          </div>
          <div className="ms-top-actions">
            {updateAvailable && (
              <button
                className="icon-btn lift update-bell-btn"
                style={{ color: 'var(--wine, #E6544F)', marginRight: 10, animation: 'pulse-bell 1s infinite alternate' }}
                onClick={onUpdateClick}
                title={lang === 'es' ? '¡Nueva actualización disponible! Haz clic para descargar de GitHub.' : 'New update available! Click to download from GitHub.'}
              >
                <span className="material-symbols-rounded">notifications_active</span>
              </button>
            )}
            <button
              className="icon-btn lift"
              onClick={()=>setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              <span className="material-symbols-rounded">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button className="icon-btn lift" onClick={onExport} title={lang==='es'?'Exportar respaldo JSON':'Export JSON backup'}>
              <span className="material-symbols-rounded">download</span>
            </button>
            <button className="icon-btn lift" onClick={onImport} title={lang==='es'?'Importar respaldo JSON':'Import JSON backup'}>
              <span className="material-symbols-rounded">upload</span>
            </button>
            <div className="lang-switch">
              <button className={lang==='es'?'active':''} onClick={()=>setLang('es')}>ES</button>
              <button className={lang==='en'?'active':''} onClick={()=>setLang('en')}>EN</button>
            </div>
          </div>
        </header>

        {section === 'all' && !query && (
          <>
            <section className="ms-hero">
              <div className="ms-hero-text">
                <div className="ms-hero-eyebrow">
                  <span className="dot"/>
                  {lang==='es' ? 'Open source · gratis para siempre' : 'Open source · free forever'}
                </div>
                <h1 className="ms-hero-title">
                  {lang==='es' ? (
                    <>Tu mente, ordenada<br/>en <span className="hero-mark">canvases anidados</span>.</>
                  ) : (
                    <>Your mind, organized<br/>as <span className="hero-mark">nested canvases</span>.</>
                  )}
                </h1>
                <p className="ms-hero-sub">{lang==='es'
                  ? 'Pensado para game devs, escritores y creativos que no caben en una sola pantalla. Notas, imágenes, vínculos, tableros — todo en un canvas infinito.'
                  : 'Built for game devs, writers and creatives who don\'t fit on one screen. Notes, images, links, boards — all on an infinite canvas.'}</p>
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
                <h2>{lang==='es'?'Recientes':'Recent'}</h2>
                <button className="ms-section-link">{lang==='es'?'Ver todos':'View all'}</button>
              </div>
              <div className="ms-recent-row">
                {recents.map(p => (
                  <RecentCard key={p.id} project={p} lang={lang} t={t}
                    onOpen={()=>onOpenProject(p.id)}
                    onDelete={()=>onDelete(p.id)}
                    onToggleStar={()=>onToggleStar(p.id)}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        <section className="ms-section">
          <div className="ms-section-head">
            <h2>
              {section === 'recent' ? (lang==='es'?'Recientes':'Recent') :
               section === 'starred' ? (lang==='es'?'Favoritos':'Favorites') :
               section === 'trash' ? (lang==='es'?'Papelera':'Trash') :
               (lang==='es'?'Todos los proyectos':'All projects')}
            </h2>
            <div className="ms-view-toggle">
              <button className={viewMode==='grid'?'active':''} onClick={()=>setViewMode('grid')} title={lang==='es'?'Cuadrícula':'Grid'}>
                <span className="material-symbols-rounded">grid_view</span>
              </button>
              <button className={viewMode==='list'?'active':''} onClick={()=>setViewMode('list')} title={lang==='es'?'Lista':'List'}>
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
                onRestore={()=>onRestore(p.id)}
                onPurge={()=>onPurge(p.id)}
                onToggleStar={()=>onToggleStar(p.id)}
              />
            ))}
            {section==='trash' && filtered.length === 0 && (
              <div className="ms-empty-hint">{lang==='es'?'La papelera está vacía':'Trash is empty'}</div>
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
    </div>
  );
}

function RecentCard({ project, lang, t, onOpen, onDelete, onToggleStar }) {
  return (
    <div className="ms-recent-card" onClick={onOpen}>
      <div className="ms-recent-cover" style={{background: project.cover}}>
        <div className="ms-recent-emoji">{project.emoji}</div>
        <div className="ms-card-actions" onClick={(e)=>e.stopPropagation()}>
          <button className={`ms-card-btn ${project.starred?'on':''}`} title={lang==='es'?'Favorito':'Star'}
            onClick={(e)=>{ e.stopPropagation(); onToggleStar && onToggleStar(); }}>
            <span className="material-symbols-rounded">{project.starred?'star':'star_border'}</span>
          </button>
          <button className="ms-card-btn danger" title={lang==='es'?'Mover a papelera':'Move to trash'}
            onClick={(e)=>{ e.stopPropagation(); onDelete && onDelete(); }}>
            <span className="material-symbols-rounded">delete</span>
          </button>
        </div>
      </div>
      <div className="ms-recent-body">
        <div className="ms-recent-title">{project.name?.[lang] || project.name}</div>
        <div className="ms-recent-meta">
          <span>{project.items} {t.items_count}</span>
          <span className="dot"/>
          <span>{project.updated?.[lang] || project.updated || (lang==='es'?'recién':'recent')}</span>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, lang, t, onOpen, onDelete, onRestore, onPurge, onToggleStar, isTrash }) {
  return (
    <div
      className="ms-project-card"
      onClick={isTrash ? undefined : onOpen}
      style={{position:'relative'}}
    >
      <div className="ms-project-cover" style={{ background: project.cover }}>
        <div className="ms-project-emoji">{project.emoji}</div>
        <div className="ms-card-actions" onClick={(e)=>e.stopPropagation()}>
          {isTrash ? (
            <>
              <button className="ms-card-btn" title={lang==='es'?'Restaurar':'Restore'}
                onClick={(e)=>{ e.stopPropagation(); onRestore && onRestore(); }}>
                <span className="material-symbols-rounded">restore_from_trash</span>
              </button>
              <button className="ms-card-btn danger" title={lang==='es'?'Eliminar definitivamente':'Delete forever'}
                onClick={(e)=>{ e.stopPropagation(); onPurge && onPurge(); }}>
                <span className="material-symbols-rounded">delete_forever</span>
              </button>
            </>
          ) : (
            <>
              <button className={`ms-card-btn ${project.starred?'on':''}`} title={lang==='es'?'Favorito':'Star'}
                onClick={(e)=>{ e.stopPropagation(); onToggleStar && onToggleStar(); }}>
                <span className="material-symbols-rounded">{project.starred?'star':'star_border'}</span>
              </button>
              <button className="ms-card-btn danger" title={lang==='es'?'Mover a papelera':'Move to trash'}
                onClick={(e)=>{ e.stopPropagation(); onDelete && onDelete(); }}>
                <span className="material-symbols-rounded">delete</span>
              </button>
            </>
          )}
        </div>
      </div>
      <div className="ms-project-body">
        <div className="ms-project-title">{project.name?.[lang] || project.name}</div>
        <div className="ms-project-meta">
          <span>{project.items} {t.items_count}</span>
          <span className="dot"/>
          <span>{project.updated?.[lang] || project.updated || (lang==='es'?'recién':'recent')}</span>
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
          <span>{lang==='es'?'Canvas en blanco':'Blank canvas'}</span>
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
        <h2>{lang==='es'?'Nuevo proyecto':'New project'}</h2>
        <p>{lang==='es'?'Empieza con un canvas en blanco — luego añade tableros, notas, lo que necesites.':'Start with a blank canvas — then add boards, notes, whatever you need.'}</p>

        <div className="field">
          <label>{lang==='es'?'Nombre':'Name'}</label>
          <input
            autoFocus
            value={name}
            onChange={(e)=>setName(e.target.value)}
            onKeyDown={(e)=>{ if (e.key==='Enter') submit(); }}
            placeholder={lang==='es'?'Mi nuevo proyecto…':'My new project…'}
          />
        </div>

        <div className="field">
          <label>{lang==='es'?'Ícono':'Icon'}</label>
          <div className="emoji-row">
            {EMOJI_PRESETS.map(e => (
              <button key={e} className={`emoji-pick ${emoji===e?'active':''}`} onClick={()=>setEmoji(e)}>{e}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>{lang==='es'?'Portada':'Cover'}</label>
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
          <button className="btn btn-ghost" onClick={onClose}>{lang==='es'?'Cancelar':'Cancel'}</button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={!name.trim()}
            style={{opacity: name.trim() ? 1 : 0.5}}
          >
            {lang==='es'?'Crear proyecto':'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}

window.Home = Home;
window.BrandMark = BrandMark;
