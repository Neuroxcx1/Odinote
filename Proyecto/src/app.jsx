// =====================================================
// Odinote — root app (Home <-> Canvas, theme, persistence)
// Using standard IndexedDB for unlimited local storage quota
// (essential for large audios and images) and 100% executable-friendly!
// =====================================================
const { useState: useStateApp, useEffect: useEffectApp } = React;

const STORE_KEY = 'odinote.state.v6';
window.ODINOTE_STORE_KEY = STORE_KEY;

// Clean up old versions in localStorage
try {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('odinote.state.') && k !== STORE_KEY) {
      localStorage.removeItem(k);
    }
  }
} catch {}

// IndexedDB Persistence Layer
const DB_NAME = 'OdinoteDB';
const DB_VERSION = 1;
const STORE_NAME = 'state';

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function saveStateToDB(state) {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(state, 'current');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }).catch(err => {
    console.error('Failed to save state to IndexedDB:', err);
  });
}

function loadStateFromDB() {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('current');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }).catch(err => {
    console.error('Failed to load state from IndexedDB:', err);
    return null;
  });
}

function App() {
  const [loading, setLoading]   = useStateApp(true);

  const [view, setView]         = useStateApp({ kind: 'home' });
  const [lang, setLang]         = useStateApp('es');
  const [theme, setTheme]       = useStateApp('light');
  const [projects, setProjects] = useStateApp(window.SAMPLE_PROJECTS);
  const [canvases, setCanvases] = useStateApp(JSON.parse(JSON.stringify(window.INITIAL_CANVASES)));
  const [vaultPath, setVaultPath] = useStateApp(null);

  // Load state on startup (Electron Local Folder Vault has precedence, falls back to browser IndexedDB)
  useEffectApp(() => {
    const savedVault = localStorage.getItem('odinote.vault_path');
    if (savedVault && window.electronAPI) {
      setVaultPath(savedVault);
      window.electronAPI.readVault(savedVault).then(vaultState => {
        if (vaultState) {
          if (vaultState.view) setView(vaultState.view);
          if (vaultState.lang) setLang(vaultState.lang);
          if (vaultState.theme) setTheme(vaultState.theme);
          if (vaultState.projects) setProjects(vaultState.projects);
          if (vaultState.canvases) setCanvases(vaultState.canvases);
        }
        setLoading(false);
      }).catch(() => {
        localStorage.removeItem('odinote.vault_path');
        setVaultPath(null);
        // load fallback from browser IndexedDB
        loadStateFromDB().then(dbState => {
          if (dbState) {
            if (dbState.view) setView(dbState.view);
            if (dbState.lang) setLang(dbState.lang);
            if (dbState.theme) setTheme(dbState.theme);
            if (dbState.projects) setProjects(dbState.projects);
            if (dbState.canvases) setCanvases(dbState.canvases);
          }
          setLoading(false);
        });
      });
    } else {
      loadStateFromDB().then(dbState => {
        if (dbState) {
          if (dbState.view) setView(dbState.view);
          if (dbState.lang) setLang(dbState.lang);
          if (dbState.theme) setTheme(dbState.theme);
          if (dbState.projects) setProjects(dbState.projects);
          if (dbState.canvases) setCanvases(dbState.canvases);
        } else {
          // Fallback / migration from localStorage
          try {
            const raw = localStorage.getItem(STORE_KEY);
            if (raw) {
              const localState = JSON.parse(raw);
              if (localState.view) setView(localState.view);
              if (localState.lang) setLang(localState.lang);
              if (localState.theme) setTheme(localState.theme);
              if (localState.projects) setProjects(localState.projects);
              if (localState.canvases) setCanvases(localState.canvases);
              saveStateToDB(localState);
            }
          } catch {}
        }
        setLoading(false);
      });
    }
  }, []);

  // apply theme on body
  useEffectApp(() => {
    document.body.setAttribute('data-theme', theme);
    document.body.setAttribute('data-lang', lang);
  }, [theme, lang]);

  const saveBase64MediaLocally = async (currentCanvases, activeVaultPath) => {
    if (!window.electronAPI || !activeVaultPath) return currentCanvases;
    
    let changed = false;
    const nextCanvases = JSON.parse(JSON.stringify(currentCanvases));
    const saves = [];

    for (const [cid, canvas] of Object.entries(nextCanvases)) {
      if (!canvas.items) continue;
      canvas.items.forEach(item => {
        if (item.src && item.src.startsWith('data:')) {
          changed = true;
          const ext = item.fileType || (item.type === 'image' ? 'png' : item.type === 'audio' ? 'mp3' : 'dat');
          const rawName = item.name || `media_${item.id}.${ext}`;
          
          saves.push((async () => {
            try {
              const relativePath = await window.electronAPI.saveMedia(activeVaultPath, rawName, item.src);
              const normalizedRelative = relativePath.replace(/\\/g, '/');
              const absolutePath = `file:///${activeVaultPath.replace(/\\/g, '/')}/${normalizedRelative}`;
              
              item.src = absolutePath;
              
              setCanvases(prev => {
                const c = prev[cid];
                if (!c || !c.items) return prev;
                return {
                  ...prev,
                  [cid]: {
                    ...c,
                    items: c.items.map(it => it.id === item.id ? { ...it, src: absolutePath } : it)
                  }
                };
              });
            } catch (err) {
              console.error('Failed to save file physically inside vault:', err);
            }
          })());
        }
      });
    }

    if (changed) {
      await Promise.all(saves);
    }
    return nextCanvases;
  };

  // persist — debounced so IndexedDB/Vault writes don't run on every single keystroke/drag frame.
  useEffectApp(() => {
    if (loading) return;
    const id = setTimeout(async () => {
      if (vaultPath && window.electronAPI) {
        const cleanCanvases = await saveBase64MediaLocally(canvases, vaultPath);
        window.electronAPI.writeVault(vaultPath, { view, lang, theme, projects, canvases: cleanCanvases });
      } else {
        saveStateToDB({ view, lang, theme, projects, canvases });
      }
    }, 400);
    return () => clearTimeout(id);
  }, [view, lang, theme, projects, canvases, loading, vaultPath]);

  // Flush immediately on tab close / window unload so no pending change is lost
  useEffectApp(() => {
    if (loading) return;
    const flush = () => {
      if (vaultPath && window.electronAPI) {
        window.electronAPI.writeVault(vaultPath, { view, lang, theme, projects, canvases });
      } else {
        saveStateToDB({ view, lang, theme, projects, canvases });
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [view, lang, theme, projects, canvases, loading, vaultPath]);

  const openLocalVault = async () => {
    if (!window.electronAPI) return;
    const path = await window.electronAPI.selectFolder();
    if (!path) return;
    
    setLoading(true);
    localStorage.setItem('odinote.vault_path', path);
    setVaultPath(path);
    
    try {
      const vaultState = await window.electronAPI.readVault(path);
      if (vaultState) {
        if (vaultState.view) setView(vaultState.view);
        if (vaultState.lang) setLang(vaultState.lang);
        if (vaultState.theme) setTheme(vaultState.theme);
        if (vaultState.projects) setProjects(vaultState.projects);
        if (vaultState.canvases) setCanvases(vaultState.canvases);
      } else {
        // If empty / new folder, initialize it with the current active state
        await window.electronAPI.writeVault(path, { view, lang, theme, projects, canvases });
      }
    } catch (err) {
      alert(lang === 'es' ? 'No se pudo leer la boveda seleccionada.' : 'Could not read the selected vault.');
    } finally {
      setLoading(false);
    }
  };

  const closeLocalVault = () => {
    setLoading(true);
    localStorage.removeItem('odinote.vault_path');
    setVaultPath(null);
    
    // Reload original browser IndexedDB state
    loadStateFromDB().then(dbState => {
      if (dbState) {
        if (dbState.view) setView(dbState.view);
        if (dbState.lang) setLang(dbState.lang);
        if (dbState.theme) setTheme(dbState.theme);
        if (dbState.projects) setProjects(dbState.projects);
        if (dbState.canvases) setCanvases(dbState.canvases);
      } else {
        setProjects(window.SAMPLE_PROJECTS);
        setCanvases(JSON.parse(JSON.stringify(window.INITIAL_CANVASES)));
      }
      setLoading(false);
    });
  };

  const openProject = (projectId) => {
    setCanvases(prev => {
      if (prev[projectId]) return prev;
      const proj = projects.find(p => p.id === projectId);
      return {
        ...prev,
        [projectId]: {
          title: proj ? proj.name : { es: 'Sin título', en: 'Untitled' },
          items: [], connectors: [],
        },
      };
    });
    setView({ kind: 'canvas', projectId });
  };

  const goHome = () => setView({ kind: 'home' });

  const createProject = (project) => {
    setProjects(p => [project, ...p]);
    setCanvases(prev => ({
      ...prev,
      [project.id]: { title: project.name, items: [], connectors: [] },
    }));
  };

  // Soft delete → moves the project to the Trash (recoverable). Canvas data is kept.
  const deleteProject = (projectId) => {
    setProjects(p => p.map(x => x.id === projectId ? { ...x, deleted: true, starred: false } : x));
  };

  const restoreProject = (projectId) => {
    setProjects(p => p.map(x => x.id === projectId ? { ...x, deleted: false } : x));
  };

  const toggleStarProject = (projectId) => {
    setProjects(p => p.map(x => x.id === projectId ? { ...x, starred: !x.starred } : x));
  };

  // Permanent delete → removes the project and its (nested) canvases for good.
  const purgeProject = (projectId) => {
    setProjects(p => p.filter(x => x.id !== projectId));
    setCanvases(prev => {
      const next = { ...prev };
      const toRemove = new Set([projectId]);
      let added = true;
      while (added) {
        added = false;
        Object.keys(next).forEach(k => {
          if (toRemove.has(k) && next[k]) {
            (next[k].items || []).forEach(it => {
              if (it.type === 'board' && it.canvasId && !toRemove.has(it.canvasId)) {
                toRemove.add(it.canvasId); added = true;
              }
            });
          }
        });
      }
      toRemove.forEach(k => delete next[k]);
      return next;
    });
  };

  const exportBackup = () => {
    const data = {
      app: 'Odinote',
      version: 1,
      exportedAt: new Date().toISOString(),
      state: { view, lang, theme, projects, canvases },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `odinote-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const state = parsed.state || parsed;
          if (!state.projects || !state.canvases) {
            alert(lang === 'es' ? 'Este archivo no parece ser un respaldo valido de Odinote.' : 'This file does not look like a valid Odinote backup.');
            return;
          }
          setView(state.view || { kind: 'home' });
          setLang(state.lang || 'es');
          setTheme(state.theme || 'light');
          setProjects(state.projects);
          setCanvases(state.canvases);
        } catch {
          alert(lang === 'es' ? 'No se pudo importar el respaldo.' : 'The backup could not be imported.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // keep project meta item-count up to date — debounced (counts are only shown on Home,
  // so no need to recompute on every drag frame). Avoids a setProjects + re-render per change.
  useEffectApp(() => {
    const id = setTimeout(() => {
      setProjects(prev => {
        let changed = false;
        const next = prev.map(p => {
          const counted = new Set();
          let total = 0;
          const walk = (cid) => {
            if (counted.has(cid)) return;
            counted.add(cid);
            const can = canvases[cid];
            if (!can) return;
            total += (can.items || []).length;
            (can.items || []).forEach(it => { if (it.type === 'board' && it.canvasId) walk(it.canvasId); });
          };
          walk(p.id);
          if (p.items !== total) changed = true;
          return p.items === total ? p : { ...p, items: total };
        });
        return changed ? next : prev; // skip state update if nothing changed
      });
    }, 700);
    return () => clearTimeout(id);
  // eslint-disable-next-line
  }, [canvases]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-main, #FAF8F6)',
        fontFamily: 'system-ui'
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid var(--line-soft, #E5E1DD)',
          borderTopColor: 'var(--wine, #7B2D26)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (view.kind === 'home') {
    return <window.Home
      lang={lang} setLang={setLang}
      theme={theme} setTheme={setTheme}
      projects={projects}
      onOpenProject={openProject}
      onCreate={createProject}
      onDelete={deleteProject}
      onRestore={restoreProject}
      onPurge={purgeProject}
      onToggleStar={toggleStarProject}
      onExport={exportBackup}
      onImport={importBackup}
      vaultPath={vaultPath}
      onOpenVault={openLocalVault}
      onCloseVault={closeLocalVault}
    />;
  }
  return <window.Canvas
    key={view.projectId}
    projectId={view.projectId}
    lang={lang} setLang={setLang}
    theme={theme} setTheme={setTheme}
    onHome={goHome}
    canvasesIn={canvases}
    setCanvases={setCanvases}
  />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
