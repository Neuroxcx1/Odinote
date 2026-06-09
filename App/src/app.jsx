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

// Clean loaded canvases from ghost nodes (like the deleted title-1 node)
function cleanCanvases(canvases) {
  if (!canvases) return canvases;
  const next = { ...canvases };
  for (const [cid, canvas] of Object.entries(next)) {
    if (canvas) {
      let changed = false;
      let nextItems = canvas.items || [];
      let nextConnectors = canvas.connectors || [];
      
      const filteredItems = nextItems.filter(item => item.id !== 'title-1');
      if (filteredItems.length !== nextItems.length) {
        nextItems = filteredItems;
        changed = true;
      }
      
      const filteredConnectors = nextConnectors.filter(co => {
        const fromId = co.fromEnd?.itemId || co.from;
        const toId = co.toEnd?.itemId || co.to;
        return fromId !== 'title-1' && toId !== 'title-1';
      });
      if (filteredConnectors.length !== nextConnectors.length) {
        nextConnectors = filteredConnectors;
        changed = true;
      }
      
      if (changed) {
        next[cid] = { ...canvas, items: nextItems, connectors: nextConnectors };
      }
    }
  }
  return next;
}

// Migrate old templates for web version or vault
function migrateTemplates(state) {
  if (!state) return state;

  const currentVersion = 3;

  // Check if we need migration: version mismatch, or has old templates (not starting with 'proj-')
  const hasOldTemplates = state.projects && state.projects.some(p => !p.id.startsWith('proj-'));
  const needsMigration = state.templatesVersion !== currentVersion || hasOldTemplates;

  if (needsMigration) {
    console.log('Migrating templates to version', currentVersion);
    
    // 1. Filter projects
    let nextProjects = state.projects ? [...state.projects] : [];
    // Remove all template projects (anything not starting with proj-)
    nextProjects = nextProjects.filter(p => p.id.startsWith('proj-'));
    state.projects = nextProjects;

    // 2. Filter canvases
    if (state.canvases) {
      const nextCanvases = { ...state.canvases };
      // Delete all template canvases (anything not starting with proj- and not starting with b-)
      for (const cid of Object.keys(nextCanvases)) {
        if (!cid.startsWith('proj-') && !cid.startsWith('b-')) {
          delete nextCanvases[cid];
        }
      }
      state.canvases = nextCanvases;
    }
    state.templatesVersion = currentVersion;
  }
  return state;
}

function App() {
  const [loading, setLoading]   = useStateApp(true);

  const [view, setView]         = useStateApp({ kind: 'home' });
  const [lang, setLang]         = useStateApp('en');
  const [theme, setTheme]       = useStateApp('light');
  const [projects, setProjects] = useStateApp(window.SAMPLE_PROJECTS);
  const [canvases, setCanvases] = useStateApp(JSON.parse(JSON.stringify(window.INITIAL_CANVASES)));
  const [vaultPath, setVaultPath] = useStateApp(null);
  const [updateAvailable, setUpdateAvailable] = useStateApp(false);
  const [checkingUpdates, setCheckingUpdates] = useStateApp(false);
  const [contextMenu, setContextMenu] = useStateApp(null);
  const [volume, setVolume] = useStateApp(() => {
    const val = localStorage.getItem('odinote.volume');
    return val !== null ? parseFloat(val) : 0.5;
  });

  React.useEffect(() => {
    window.audioVolume = volume;
    window.isAudioMuted = (volume === 0);
    localStorage.setItem('odinote.volume', volume.toString());
  }, [volume]);

  const ignoreNextPersistRef = React.useRef(false);

  const MOCK_UPDATE_TEST = false; // Cambiar a true para probar la campana localmente.

  const checkUpdates = async (manual = false) => {
    if (checkingUpdates) return;
    if (manual) setCheckingUpdates(true);
    try {
      if (MOCK_UPDATE_TEST) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setUpdateAvailable(true);
        if (manual) {
          alert(window.t('¡Nueva versión disponible: v1.0.3! Haz clic en la campana para descargarla.', 'New version available: v1.0.3! Click the bell to download it.'));
        }
        return;
      }
      const res = await fetch('https://api.github.com/repos/Neuroxcx1/Odinote/releases');
      if (!res.ok) {
        if (manual) {
          alert(window.t('No se pudieron comprobar las actualizaciones. Comprueba tu conexión.', 'Could not check for updates. Please check your connection.'));
        }
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        if (manual) {
          alert(window.t('¡Estás al día! Odinote está en su versión más reciente (v1.0.2).', 'You are up to date! Odinote is on the latest version (v1.0.2).'));
        }
        return;
      }
      const latestRelease = data[0];
      const latestVersion = latestRelease.tag_name;
      if (!latestVersion) {
        if (manual) {
          alert(window.t('¡Estás al día! Odinote está en su versión más reciente (v1.0.2).', 'You are up to date! Odinote is on the latest version (v1.0.2).'));
        }
        return;
      }

      const cleanLatest = latestVersion.replace(/^v/, '');
      const cleanCurrent = '1.0.2'; // matches package.json

      const latestParts = cleanLatest.split('.').map(Number);
      const currentParts = cleanCurrent.split('.').map(Number);

      let hasNew = false;
      for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
        const l = latestParts[i] || 0;
        const c = currentParts[i] || 0;
        if (l > c) {
          hasNew = true;
          break;
        } else if (l < c) {
          break;
        }
      }

      if (hasNew) {
        setUpdateAvailable(true);
        if (manual) {
          alert(window.t(`¡Nueva versión disponible: v${cleanLatest}! Haz clic en la campana para descargarla.`, `New version available: v${cleanLatest}! Click the bell to download it.`));
        }
      } else {
        setUpdateAvailable(false);
        if (manual) {
          alert(window.t('¡Estás al día! Odinote está en su versión más reciente (v1.0.2).', 'You are up to date! Odinote is on the latest version (v1.0.2).'));
        }
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
      if (manual) {
        alert(window.t('Error al comprobar actualizaciones. Comprueba tu conexión a internet.', 'Error checking for updates. Please check your internet connection.'));
      }
    } finally {
      if (manual) setCheckingUpdates(false);
    }
  };

  // Check for updates instantly on mount
  useEffectApp(() => {
    if (window.electronAPI) {
      checkUpdates(false);
    }
  }, []);

  const handleUpdateClick = () => {
    if (updateAvailable) {
      window.open('https://github.com/Neuroxcx1/Odinote/releases/latest', '_blank');
    } else {
      checkUpdates(true);
    }
  };

  // Prevent Ctrl + Mousewheel zoom
  useEffectApp(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Listen to IPC event for Electron custom context menu
  useEffectApp(() => {
    if (window.electronAPI && window.electronAPI.onShowContextMenu) {
      const unsub = window.electronAPI.onShowContextMenu((data) => {
        setContextMenu(data);
      });
      
      const hideMenu = (e) => {
        if (e.target.closest('.custom-context-menu')) return;
        setContextMenu(null);
      };
      window.addEventListener('mousedown', hideMenu, true);
      window.addEventListener('contextmenu', hideMenu, true);
      return () => {
        unsub();
        window.removeEventListener('mousedown', hideMenu, true);
        window.removeEventListener('contextmenu', hideMenu, true);
      };
    }
  }, []);

  // Sync spellchecker languages dynamically when UI language changes
  useEffectApp(() => {
    if (window.electronAPI && window.electronAPI.setSpellcheckerLanguages) {
      let spellLangs = ['en-US', 'en'];
      if (lang === 'es') {
        spellLangs = ['es-ES', 'es-419', 'es'];
      } else if (lang === 'fr') {
        spellLangs = ['fr-FR', 'fr'];
      } else if (lang === 'de') {
        spellLangs = ['de-DE', 'de'];
      } else if (lang === 'it') {
        spellLangs = ['it-IT', 'it'];
      } else if (lang === 'pt') {
        spellLangs = ['pt-PT', 'pt-BR', 'pt'];
      } else if (lang === 'ru') {
        spellLangs = ['ru-RU', 'ru'];
      } else if (lang === 'ar') {
        spellLangs = [];
      } else if (lang === 'zh' || lang === 'ja' || lang === 'ko') {
        spellLangs = [];
      }
      window.electronAPI.setSpellcheckerLanguages(spellLangs);
    }
  }, [lang]);

  useEffectApp(() => {
    const initVault = async () => {
      let savedVault = null;
      if (window.electronAPI && window.electronAPI.getVaultPath) {
        savedVault = await window.electronAPI.getVaultPath();
      } else {
        savedVault = localStorage.getItem('odinote.vault_path');
      }

      if (savedVault) {
        setVaultPath(savedVault);
        window.electronAPI.readVault(savedVault).then(vaultState => {
          if (vaultState) {
            const migrated = migrateTemplates(vaultState);
            ignoreNextPersistRef.current = true;
            if (migrated.view) setView(migrated.view);
            if (migrated.lang) setLang(migrated.lang);
            if (migrated.theme) setTheme(migrated.theme);
            if (migrated.projects) setProjects(migrated.projects);
            if (migrated.canvases) setCanvases(cleanCanvases(migrated.canvases));
          }
          setLoading(false);
        }).catch(() => {
          if (window.electronAPI && window.electronAPI.setVaultPath) {
            window.electronAPI.setVaultPath(null);
          }
          localStorage.removeItem('odinote.vault_path');
          setVaultPath(null);
          // load fallback from browser IndexedDB
          loadStateFromDB().then(dbState => {
            if (dbState) {
              const migrated = migrateTemplates(dbState);
              ignoreNextPersistRef.current = true;
              if (migrated.view) setView(migrated.view);
              if (migrated.lang) setLang(migrated.lang);
              if (migrated.theme) setTheme(migrated.theme);
              if (migrated.projects) setProjects(migrated.projects);
              if (migrated.canvases) setCanvases(cleanCanvases(migrated.canvases));
            }
            setLoading(false);
          });
        });
      } else {
        loadStateFromDB().then(dbState => {
          if (dbState) {
            const migrated = migrateTemplates(dbState);
            ignoreNextPersistRef.current = true;
            if (migrated.view) setView(migrated.view);
            if (migrated.lang) setLang(migrated.lang);
            if (migrated.theme) setTheme(migrated.theme);
            if (migrated.projects) setProjects(migrated.projects);
            if (migrated.canvases) setCanvases(cleanCanvases(migrated.canvases));
          } else {
            // Fallback / migration from localStorage
            try {
              const raw = localStorage.getItem(STORE_KEY);
              if (raw) {
                const localState = JSON.parse(raw);
                const migrated = migrateTemplates(localState);
                ignoreNextPersistRef.current = true;
                if (migrated.view) setView(migrated.view);
                if (migrated.lang) setLang(migrated.lang);
                if (migrated.theme) setTheme(migrated.theme);
                if (migrated.projects) setProjects(migrated.projects);
                if (migrated.canvases) setCanvases(cleanCanvases(migrated.canvases));
                saveStateToDB(migrated);
              }
            } catch {}
          }
          setLoading(false);
        });
      }
    };
    initVault();
  }, []);


  // Keep the global language in sync SYNCHRONOUSLY during render so window.t() returns the
  // correct language on the very same render that `lang` changes (otherwise the old text
  // sticks until the next unrelated re-render — the "need to click the canvas" bug).
  window.currentLang = lang;

  // apply theme on body
  useEffectApp(() => {
    document.body.setAttribute('data-theme', theme);
    document.body.setAttribute('data-lang', lang);
    window.currentLang = lang;
  }, [theme, lang]);

  const savingMediaRef = React.useRef(new Set());

  const saveBase64MediaLocally = async (currentCanvases, activeVaultPath) => {
    if (!window.electronAPI || !activeVaultPath) return currentCanvases;
    
    let changed = false;
    const nextCanvases = JSON.parse(JSON.stringify(currentCanvases));
    const saves = [];

    for (const [cid, canvas] of Object.entries(nextCanvases)) {
      if (!canvas.items) continue;
      canvas.items.forEach(item => {
        if (item.src && item.src.startsWith('data:')) {
          // If already in progress of saving this specific item, skip it to avoid race conditions and duplicates
          if (savingMediaRef.current.has(item.id)) {
            return;
          }
          savingMediaRef.current.add(item.id);
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
            } finally {
              // Always clean up saving status so future updates can write if needed
              savingMediaRef.current.delete(item.id);
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
    if (ignoreNextPersistRef.current) {
      ignoreNextPersistRef.current = false;
      return;
    }
    const id = setTimeout(async () => {
      if (vaultPath && window.electronAPI) {
        const cleanCanvases = await saveBase64MediaLocally(canvases, vaultPath);
        window.electronAPI.writeVault(vaultPath, { view, lang, theme, projects, canvases: cleanCanvases, templatesVersion: 2 });
      } else {
        saveStateToDB({ view, lang, theme, projects, canvases, templatesVersion: 2 });
      }
    }, 400);
    return () => clearTimeout(id);
  }, [view, lang, theme, projects, canvases, loading, vaultPath]);

  // Flush immediately on tab close / window unload so no pending change is lost
  useEffectApp(() => {
    if (loading) return;
    const flush = () => {
      if (vaultPath && window.electronAPI) {
        window.electronAPI.writeVault(vaultPath, { view, lang, theme, projects, canvases, templatesVersion: 2 });
      } else {
        saveStateToDB({ view, lang, theme, projects, canvases, templatesVersion: 2 });
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
    if (window.electronAPI.setVaultPath) {
      await window.electronAPI.setVaultPath(path);
    }
    localStorage.setItem('odinote.vault_path', path);
    setVaultPath(path);
    
    try {
      const vaultState = await window.electronAPI.readVault(path);
      if (vaultState) {
        const migrated = migrateTemplates(vaultState);
        ignoreNextPersistRef.current = true;
        if (migrated.view) setView(migrated.view);
        if (migrated.lang) setLang(migrated.lang);
        if (migrated.theme) setTheme(migrated.theme);
        if (migrated.projects) setProjects(migrated.projects);
        if (migrated.canvases) setCanvases(cleanCanvases(migrated.canvases));
      } else {
        // If empty / new folder, initialize it with the current active state
        await window.electronAPI.writeVault(path, { view, lang, theme, projects, canvases, templatesVersion: 2 });
      }
    } catch (err) {
      alert(window.t('No se pudo leer la boveda seleccionada.', 'Could not read the selected vault.'));
    } finally {
      setLoading(false);
    }
  };

  const closeLocalVault = () => {
    setLoading(true);
    if (window.electronAPI && window.electronAPI.setVaultPath) {
      window.electronAPI.setVaultPath(null);
    }
    localStorage.removeItem('odinote.vault_path');
    setVaultPath(null);
    
    // Reload original browser IndexedDB state
    loadStateFromDB().then(dbState => {
      if (dbState) {
        const migrated = migrateTemplates(dbState);
        ignoreNextPersistRef.current = true;
        if (migrated.view) setView(migrated.view);
        if (migrated.lang) setLang(migrated.lang);
        if (migrated.theme) setTheme(migrated.theme);
        if (migrated.projects) setProjects(migrated.projects);
        if (migrated.canvases) setCanvases(cleanCanvases(migrated.canvases));
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

  const renameProject = (projectId, newName) => {
    setProjects(p => p.map(x => x.id === projectId ? { ...x, name: { es: newName, en: newName } } : x));
    setCanvases(prev => {
      if (!prev[projectId]) return prev;
      return {
        ...prev,
        [projectId]: {
          ...prev[projectId],
          title: { es: newName, en: newName }
        }
      };
    });
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
            alert(window.t('Este archivo no parece ser un respaldo valido de Odinote.', 'This file does not look like a valid Odinote backup.'));
            return;
          }
          setView(state.view || { kind: 'home' });
          setLang(state.lang || 'es');
          setTheme(state.theme || 'light');
          setProjects(state.projects);
          setCanvases(state.canvases);
        } catch {
          alert(window.t('No se pudo importar el respaldo.', 'The backup could not be imported.'));
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

  const handleSuggestion = (suggestion) => {
    if (window.electronAPI && window.electronAPI.replaceMisspelling) {
      window.electronAPI.replaceMisspelling(suggestion);
    }
    setContextMenu(null);
  };

  const handleAddToDictionary = () => {
    if (window.electronAPI && window.electronAPI.addToDictionary && contextMenu.misspelledWord) {
      window.electronAPI.addToDictionary(contextMenu.misspelledWord);
    }
    setContextMenu(null);
  };

  const handleCut = () => {
    document.execCommand('cut');
    setContextMenu(null);
  };

  const handleCopy = () => {
    document.execCommand('copy');
    setContextMenu(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      document.execCommand('insertText', false, text);
    } catch {
      document.execCommand('paste');
    }
    setContextMenu(null);
  };

  let activeView = null;
  if (view.kind === 'home') {
    activeView = <window.Home
      lang={lang} setLang={setLang}
      theme={theme} setTheme={setTheme}
      projects={projects}
      onOpenProject={openProject}
      onCreate={createProject}
      onDelete={deleteProject}
      onRename={renameProject}
      onRestore={restoreProject}
      onPurge={purgeProject}
      onToggleStar={toggleStarProject}
      onExport={exportBackup}
      onImport={importBackup}
      vaultPath={vaultPath}
      onOpenVault={openLocalVault}
      onCloseVault={closeLocalVault}
      updateAvailable={updateAvailable}
      onUpdateClick={handleUpdateClick}
    />;
  } else {
    activeView = <window.Canvas
      key={view.projectId}
      projectId={view.projectId}
      lang={lang} setLang={setLang}
      theme={theme} setTheme={setTheme}
      onHome={goHome}
      canvasesIn={canvases}
      setCanvases={setCanvases}
      updateAvailable={updateAvailable}
      onUpdateClick={handleUpdateClick}
      volume={volume}
      onChangeVolume={setVolume}
    />;
  }

  return (
    <>
      {activeView}
      {contextMenu && (
        <div
          className="custom-context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
          }}
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="custom-context-menu-wrapper">
            {contextMenu.misspelledWord && (
              <>
                <div className="ctx-menu-header">
                  <span className="material-symbols-rounded" style={{ fontSize: '14px', color: 'var(--wine)' }}>spellcheck</span>
                  <span>{lang === 'es' ? 'Ortografía' : 'Spelling'}</span>
                </div>
                <div className="ctx-menu-suggestions">
                  {contextMenu.dictionarySuggestions && contextMenu.dictionarySuggestions.length > 0 ? (
                    contextMenu.dictionarySuggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        className="ctx-menu-item suggestion-btn"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSuggestion(sug)}
                      >
                        <strong>{sug}</strong>
                      </button>
                    ))
                  ) : (
                    <div className="ctx-menu-no-suggestions">
                      <i>{lang === 'es' ? 'Sin sugerencias' : 'No suggestions'}</i>
                    </div>
                  )}
                </div>
                <button
                  className="ctx-menu-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAddToDictionary}
                >
                  <span className="material-symbols-rounded">add_to_photos</span>
                  <span>{lang === 'es' ? 'Añadir al diccionario' : 'Add to dictionary'}</span>
                </button>
                {(contextMenu.isEditable || (contextMenu.selectionText && contextMenu.selectionText.trim() !== '')) && <div className="ctx-menu-divider" />}
              </>
            )}

            {contextMenu.isEditable && (
              <>
                <button className="ctx-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={handleCut}>
                  <span className="material-symbols-rounded">content_cut</span>
                  <span>{lang === 'es' ? 'Cortar' : 'Cut'}</span>
                </button>
                <button className="ctx-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={handleCopy}>
                  <span className="material-symbols-rounded">content_copy</span>
                  <span>{lang === 'es' ? 'Copiar' : 'Copy'}</span>
                </button>
                <button className="ctx-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={handlePaste}>
                  <span className="material-symbols-rounded">content_paste</span>
                  <span>{lang === 'es' ? 'Pegar' : 'Paste'}</span>
                </button>
              </>
            )}

            {!contextMenu.isEditable && contextMenu.selectionText && contextMenu.selectionText.trim() !== '' && (
              <button className="ctx-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={handleCopy}>
                <span className="material-symbols-rounded">content_copy</span>
                <span>{lang === 'es' ? 'Copiar' : 'Copy'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
