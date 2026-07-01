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
  const [settingsOpen, setSettingsOpen] = useStateApp(false);
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
    const cleanCurrent = '1.0.4'; // matches package.json
    try {
      if (MOCK_UPDATE_TEST) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setUpdateAvailable(true);
        if (manual) {
          alert(window.t('¡Nueva versión disponible: v1.0.5! Haz clic en la campana para descargarla.', 'New version available: v1.0.5! Click the bell to download it.'));
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
          alert(window.t('¡Estás al día! Odinote está en su versión más reciente (%v).', 'You are up to date! Odinote is on the latest version (%v).').replace('%v', 'v' + cleanCurrent));
        }
        return;
      }
      const latestRelease = data[0];
      const latestVersion = latestRelease.tag_name;
      if (!latestVersion) {
        if (manual) {
          alert(window.t('¡Estás al día! Odinote está en su versión más reciente (%v).', 'You are up to date! Odinote is on the latest version (%v).').replace('%v', 'v' + cleanCurrent));
        }
        return;
      }

      const cleanLatest = latestVersion.replace(/^v/, '');

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
          alert(window.t('¡Estás al día! Odinote está en su versión más reciente (%v).', 'You are up to date! Odinote is on the latest version (%v).').replace('%v', 'v' + cleanCurrent));
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

  // Prevent Ctrl + Mousewheel zoom & Sanitize rich text paste in all contentEditables
  useEffectApp(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    
    const handleGlobalPaste = (e) => {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.isContentEditable) {
        if (activeEl.hasAttribute('data-paste-interceptor')) return;
        if (e.defaultPrevented) return;
        
        const text = ((e.clipboardData && e.clipboardData.getData('text/plain')) || '').trim();
        // If it's a single bare URL, let the local handlers process it (e.g. DocModal autolink)
        if (text && !/\s/.test(text) && /^(https?:\/\/|www\.)\S+$/i.test(text)) {
          return;
        }
        
        const html = e.clipboardData.getData('text/html');
        if (html) {
          e.preventDefault();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          const cleanNode = (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const attrNames = Array.from(node.attributes).map(attr => attr.name);
              attrNames.forEach(name => {
                if (!['href', 'src', 'alt', 'target', 'checked', 'type'].includes(name)) {
                  node.removeAttribute(name);
                }
              });
              
              if (['style', 'script', 'meta', 'link'].includes(node.tagName.toLowerCase())) {
                node.remove();
                return;
              }
            }
            Array.from(node.childNodes).forEach(cleanNode);
          };
          
          cleanNode(doc.body);
          document.execCommand('insertHTML', false, doc.body.innerHTML);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('paste', handleGlobalPaste, true);
    
    return () => {
      window.removeEventListener('wheel', handleWheel);
      document.removeEventListener('paste', handleGlobalPaste, true);
    };
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

  const renameProject = (projectId, newName, newEmoji, newCover) => {
    setProjects(p => p.map(x => x.id === projectId ? { ...x, name: { es: newName, en: newName }, emoji: newEmoji, cover: newCover } : x));
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
    try {
      document.execCommand('cut');
    } catch (err) {
      console.warn('Cut failed:', err);
    }
    setContextMenu(null);
  };

  const handleCopy = () => {
    try {
      document.execCommand('copy');
    } catch (err) {
      console.warn('Copy failed:', err);
    }
    setContextMenu(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      document.execCommand('insertText', false, text);
    } catch (err) {
      try {
        document.execCommand('paste');
      } catch (e) {
        console.warn('Paste failed:', e);
      }
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
      onSettingsClick={() => setSettingsOpen(true)}
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
      onSettingsClick={() => setSettingsOpen(true)}
      vaultPath={vaultPath}
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

      {settingsOpen && (
        <div className="doc-modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.45)' }} onClick={() => setSettingsOpen(false)}>
          <div 
            className="doc-modal-window" 
            style={{ 
              width: '450px', 
              maxHeight: '80vh', 
              padding: '24px', 
              borderRadius: '16px', 
              background: 'var(--bg-card, #FFFFFF)', 
              border: '1.5px solid var(--line-soft, #E5E1DD)', 
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line-soft, #E5E1DD)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--wine, #7B2D26)' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '24px' }}>settings</span>
                <span style={{ fontWeight: '700', fontSize: '18px' }}>
                  {window.t('Ajustes de Odinote', 'Odinote Settings')}
                </span>
              </div>
              <button 
                className="icon-btn" 
                onClick={() => setSettingsOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '20px', color: 'var(--text-soft, #595459)' }}>close</span>
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              {/* Sección Corrector Ortográfico */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--wine, #7B2D26)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>spellcheck</span>
                  <span>{window.t('Corrector Ortográfico', 'Spellchecker Dictionary')}</span>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-soft, #595459)', margin: 0, lineHeight: '1.5' }}>
                  {window.t(
                    'Las palabras que agregas al diccionario (haciendo clic derecho sobre una palabra subrayada en rojo) se guardan localmente en tu sistema en el archivo "Custom Dictionary.txt".',
                    'Words you add to the dictionary (by right-clicking a word underlined in red) are saved locally on your system in the "Custom Dictionary.txt" file.'
                  )}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-soft, #595459)', margin: 0, lineHeight: '1.5', background: 'var(--bg-main, #FAF8F6)', padding: '10px', borderRadius: '8px', border: '1px dashed var(--line-soft, #E5E1DD)' }}>
                  <strong>{window.t('¿Cómo corregir errores?', 'How to remove a word?')}</strong><br/>
                  {window.t(
                    'Si agregaste una palabra por error y quieres que vuelva a aparecer como incorrecta, abre el archivo con el botón de abajo y elimina la línea de esa palabra.',
                    'If you added a word by mistake and want it to be marked as misspelled again, open the file using the button below and delete that word\'s line.'
                  )}
                </p>
                
                {window.electronAPI ? (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      className="ms-new-btn"
                      style={{ 
                        flex: 1, 
                        padding: '10px 12px', 
                        fontSize: '12.5px', 
                        background: 'var(--wine, #7B2D26)', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontWeight: '600'
                      }}
                      onClick={() => {
                        window.electronAPI.openCustomDictionary();
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>edit_note</span>
                      <span>{window.t('Abrir Diccionario (.txt)', 'Open Dictionary (.txt)')}</span>
                    </button>
                    
                    <button
                      className="btn btn-ghost"
                      style={{ 
                        padding: '10px 12px', 
                        fontSize: '12.5px', 
                        background: 'transparent', 
                        color: 'var(--text, #1A1A1A)', 
                        border: '1.5px solid var(--line-soft, #E5E1DD)', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      onClick={() => {
                        window.electronAPI.openUserDataFolder();
                      }}
                      title={window.t('Abrir carpeta del sistema', 'Open system folder')}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>folder</span>
                    </button>
                  </div>
                ) : (
                   <p style={{ fontSize: '11px', color: 'var(--wine)', margin: 0, fontWeight: '500' }}>
                     {window.t(
                       'La edición directa del diccionario solo está disponible en la versión de escritorio.',
                       'Direct dictionary editing is only available in the desktop application.'
                     )}
                   </p>
                )}
              </div>

              {/* Sección Gestor de Atajos de Teclado */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--line-soft, #E5E1DD)', paddingTop: '14px', marginTop: '4px' }}>
                <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--wine, #7B2D26)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>keyboard</span>
                  <span>{window.t('Atajos de Teclado', 'Keyboard Shortcuts')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                  {[
                    { keys: ['Ctrl', 'Z'], desc: window.t('Deshacer acción', 'Undo action') },
                    { keys: ['Ctrl', 'Y'], desc: window.t('Rehacer acción', 'Redo action') },
                    { keys: ['Ctrl', 'C'], desc: window.t('Copiar nodos seleccionados', 'Copy selected nodes') },
                    { keys: ['Ctrl', 'V'], desc: window.t('Pegar nodos / archivos', 'Paste nodes or files') },
                    { keys: ['Ctrl', 'X'], desc: window.t('Cortar nodos seleccionados', 'Cut selected nodes') },
                    { keys: ['Ctrl', 'D'], desc: window.t('Duplicar nodo', 'Duplicate selected node') },
                    { keys: ['Ctrl', 'A'], desc: window.t('Seleccionar todo', 'Select all items') },
                    { keys: ['Shift', 'Click'], desc: window.t('Selección múltiple (individual)', 'Add/remove from selection') },
                    { keys: ['Shift', 'Arrastrar'], desc: window.t('Selección por recuadro múltiple', 'Add to selection with box') },
                    { keys: ['Alt', 'Arrastrar'], desc: window.t('Desplazar lienzo (Paneo)', 'Pan the canvas') },
                    { keys: ['Supr', 'Backspace'], desc: window.t('Eliminar elemento seleccionado', 'Delete selected item') },
                    { keys: ['/'], desc: window.t('Enfocar buscador del lienzo', 'Focus search box') },
                    { keys: ['Esc'], desc: window.t('Cerrar editor / Limpiar selección', 'Close editor / Clear selection') }
                  ].map((sh, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '6px 8px', background: 'var(--bg-main, #FAF8F6)', borderRadius: '6px', border: '1.5px solid var(--line-soft, #E5E1DD)' }}>
                      <span style={{ color: 'var(--text, #1A1A1A)', fontWeight: '500' }}>{sh.desc}</span>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {sh.keys.map((k, ki) => (
                          <kbd key={ki} style={{ 
                            background: 'var(--bg-card, #FFFFFF)', 
                            color: 'var(--text, #1A1A1A)', 
                            border: '1.5px solid var(--line, #595459)', 
                            borderRadius: '4px', 
                            padding: '1.5px 5px', 
                            fontSize: '10.5px', 
                            fontWeight: '700', 
                            boxShadow: '1px 1px 0 var(--line, #595459)',
                            fontFamily: 'var(--font-mono, monospace)',
                            margin: 0
                          }}>{k}</kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--line-soft, #E5E1DD)', paddingTop: '12px', marginTop: '4px' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setSettingsOpen(false)}
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '13px', 
                  borderRadius: '8px', 
                  border: '1.5px solid var(--line-soft, #E5E1DD)', 
                  cursor: 'pointer',
                  background: 'transparent',
                  color: 'var(--text, #1A1A1A)'
                }}
              >
                {window.t('Cerrar', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
