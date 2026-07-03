// =====================================================
// Odinote — root app (Home <-> Canvas, theme, persistence)
// Using standard IndexedDB for unlimited local storage quota
// (essential for large audios and images) and 100% executable-friendly!
// =====================================================

// Firebase Initialization
const firebaseConfig = {
  apiKey: "AIzaSyBe-E7K19JD5OYQpyzS773rjuegR07Y1GU",
  authDomain: "odinote-firebase.firebaseapp.com",
  projectId: "odinote-firebase",
  storageBucket: "odinote-firebase.firebasestorage.app",
  messagingSenderId: "160850813780",
  appId: "1:160850813780:web:8e80553294301232ac5ec1",
  measurementId: "G-YT66TPQGQE"
};

let firestoreDB = null;
if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  firestoreDB = firebase.firestore();
}

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

// Global shortcuts configuration
window.shortcuts = {
  undo: { key: 'z', ctrl: true, shift: false, alt: false, label: 'Ctrl + Z' },
  redo: { key: 'y', ctrl: true, shift: false, alt: false, label: 'Ctrl + Y' },
  duplicate: { key: 'd', ctrl: true, shift: false, alt: false, label: 'Ctrl + D' },
  selectAll: { key: 'a', ctrl: true, shift: false, alt: false, label: 'Ctrl + A' },
  search: { key: '/', ctrl: false, shift: false, alt: false, label: '/' },
};

try {
  const savedShortcuts = localStorage.getItem('odinote.custom_shortcuts');
  if (savedShortcuts) {
    window.shortcuts = { ...window.shortcuts, ...JSON.parse(savedShortcuts) };
  }
} catch (e) {}

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
  const [dictWords, setDictWords] = useStateApp([]);
  const [userProfile, setUserProfile] = useStateApp(() => {
    const savedProfile = localStorage.getItem('odinote.google_profile');
    return savedProfile ? JSON.parse(savedProfile) : null;
  });
  const [userModalOpen, setUserModalOpen] = useStateApp(false);
  const [loginError, setLoginError] = useStateApp(null);
  const [waitingForWebLogin, setWaitingForWebLogin] = useStateApp(false);
  const [localGuestOpen, setLocalGuestOpen] = useStateApp(false);
  const [localGuestName, setLocalGuestName] = useStateApp('');
  const [localGuestAvatar, setLocalGuestAvatar] = useStateApp('🦊');
  const [customDialog, setCustomDialog] = useStateApp(null);
  
  const [toast, setToast] = useStateApp(null);
  const lastGoogleDriveSyncTimeRef = React.useRef(0);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.playAudioTone && window.playAudioTone('click');
  };
  window.showToast = showToast;

  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Definicion de metodos globales de Dialog para evitar alerts sincronos molestos en Electron
  React.useEffect(() => {
    window.customAlert = (msg) => {
      return new Promise((resolve) => {
        setCustomDialog({
          type: 'alert',
          message: String(msg),
          onAccept: () => {
            setCustomDialog(null);
            resolve(true);
          }
        });
      });
    };

    // Sobreescribir el alert nativo por defecto para evitar bloqueos
    window.alert = window.customAlert;

    window.customConfirm = (msg) => {
      return new Promise((resolve) => {
        setCustomDialog({
          type: 'confirm',
          message: msg,
          onAccept: () => {
            setCustomDialog(null);
            resolve(true);
          },
          onCancel: () => {
            setCustomDialog(null);
            resolve(false);
          }
        });
      });
    };

    // Escucha del inicio de sesion con Google completado en la ventana nativa
    if (window.electronAPI && window.electronAPI.onGoogleSigninCompleted) {
      const unsubscribe = window.electronAPI.onGoogleSigninCompleted((profile) => {
        setUserProfile(profile);
        localStorage.setItem('odinote.google_profile', JSON.stringify(profile));
        setWaitingForWebLogin(false);
        setUserModalOpen(false);
        showToast(window.t('¡Sesión iniciada con éxito mediante Google!', 'Successfully signed in with Google!'));
      });
      return unsubscribe;
    }
  }, []);

  useEffectApp(() => {
    if (userProfile && userProfile.accessToken) {
      syncProjectsFromGoogleDrive(userProfile.accessToken);
    }
  }, [userProfile]);

  const [sharingModalOpen, setSharingModalOpen] = useStateApp(false);
  const [activeSharingProjectId, setActiveSharingProjectId] = useStateApp(null);
  const [joiningModalOpen, setJoiningModalOpen] = useStateApp(false);

  useEffectApp(() => {
    if (settingsOpen && window.electronAPI && window.electronAPI.getCustomDictionaryWords) {
      window.electronAPI.getCustomDictionaryWords().then(words => {
        setDictWords(words || []);
      });
    }
  }, [settingsOpen]);
  const [shState, setShState] = useStateApp(window.shortcuts || {});
  const [listeningKey, setListeningKey] = useStateApp(null); // 'undo' | 'redo' | etc.

  useEffectApp(() => {
    if (!listeningKey) return;
    const handleCapture = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const key = e.key.toLowerCase();
      // Ignorar teclas modificadoras solas
      if (['control', 'shift', 'alt', 'meta'].includes(key)) return;
      
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;
      
      const parts = [];
      if (ctrl) parts.push('Ctrl');
      if (shift) parts.push('Shift');
      if (alt) parts.push('Alt');
      parts.push(e.key.toUpperCase());
      const label = parts.join(' + ');

      const updated = {
        ...shState,
        [listeningKey]: { key: e.key, ctrl, shift, alt, label }
      };
      
      setShState(updated);
      window.shortcuts = updated;
      localStorage.setItem('odinote.custom_shortcuts', JSON.stringify(updated));
      setListeningKey(null);
    };

    window.addEventListener('keydown', handleCapture, true);
    return () => window.removeEventListener('keydown', handleCapture, true);
  }, [listeningKey, shState]);

  const handleResetShortcuts = () => {
    const defaults = {
      undo: { key: 'z', ctrl: true, shift: false, alt: false, label: 'Ctrl + Z' },
      redo: { key: 'y', ctrl: true, shift: false, alt: false, label: 'Ctrl + Y' },
      duplicate: { key: 'd', ctrl: true, shift: false, alt: false, label: 'Ctrl + D' },
      selectAll: { key: 'a', ctrl: true, shift: false, alt: false, label: 'Ctrl + A' },
      search: { key: '/', ctrl: false, shift: false, alt: false, label: '/' },
    };
    setShState(defaults);
    window.shortcuts = defaults;
    localStorage.removeItem('odinote.custom_shortcuts');
  };
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
  const isIncomingRemoteChangeRef = React.useRef(false);

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

  const uploadToGoogleDriveReal = async (projectId, projectName, canvasesData, accessToken) => {
    if (!accessToken) return;
    try {
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };

      // 1. Obtener o crear la carpeta "Odinote"
      const searchRootUrl = `https://www.googleapis.com/drive/v3/files?q=name='Odinote' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`;
      const searchRootRes = await fetch(searchRootUrl, { headers });
      if (!searchRootRes.ok) return;
      const searchRootData = await searchRootRes.json();
      let rootFolderId = '';
      
      if (searchRootData.files && searchRootData.files.length > 0) {
        rootFolderId = searchRootData.files[0].id;
      } else {
        const createRootRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: 'Odinote',
            mimeType: 'application/vnd.google-apps.folder'
          })
        });
        if (!createRootRes.ok) return;
        const createRootData = await createRootRes.json();
        rootFolderId = createRootData.id;
      }

      if (!rootFolderId) return;

      // 2. Obtener o crear la carpeta con el nombre del proyecto dentro de "Odinote"
      const searchProjFolderUrl = `https://www.googleapis.com/drive/v3/files?q=name='${projectName}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`;
      const searchProjFolderRes = await fetch(searchProjFolderUrl, { headers });
      if (!searchProjFolderRes.ok) return;
      const searchProjFolderData = await searchProjFolderRes.json();
      let projFolderId = '';

      if (searchProjFolderData.files && searchProjFolderData.files.length > 0) {
        projFolderId = searchProjFolderData.files[0].id;
      } else {
        const createProjFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: projectName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [rootFolderId]
          })
        });
        if (!createProjFolderRes.ok) return;
        const createProjFolderData = await createProjFolderRes.json();
        projFolderId = createProjFolderData.id;
      }

      if (!projFolderId) return;

      // Guardar el ID de la carpeta del proyecto en localStorage para las subidas de imagenes
      localStorage.setItem(`odinote.gdrive_folder_${projectId}`, projFolderId);

      // 3. Buscar si ya existe "canvas_state.json" en esa carpeta
      const searchFileUrl = `https://www.googleapis.com/drive/v3/files?q=name='canvas_state.json' and '${projFolderId}' in parents and trashed=false&fields=files(id)`;
      const fileSearchRes = await fetch(searchFileUrl, { headers });
      if (!fileSearchRes.ok) return;
      const fileSearchData = await fileSearchRes.json();
      let fileId = '';

      const projectDataContent = JSON.stringify({
        projectId,
        name: projectName,
        canvases: canvasesData,
        syncedAt: new Date().toISOString()
      });

      if (fileSearchData.files && fileSearchData.files.length > 0) {
        fileId = fileSearchData.files[0].id;
        // Actualizar canvas_state.json
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
        await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: projectDataContent
        });
      } else {
        // Crear canvas_state.json
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelim = `\r\n--${boundary}--`;
        
        const metadata = {
          name: 'canvas_state.json',
          mimeType: 'application/json',
          parents: [projFolderId]
        };

        const multipartBody = 
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          projectDataContent +
          closeDelim;

        const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        await fetch(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        });
      }
    } catch (err) {
      console.error('Error synchronizing project file to Google Drive:', err);
    }
  };

  const uploadMediaToGoogleDriveReal = async (projectId, item, accessToken) => {
    try {
      const folderId = localStorage.getItem(`odinote.gdrive_folder_${projectId}`);
      if (!folderId) return null;

      // Extraer base64 data
      const parts = item.src.split(',');
      if (parts.length < 2) return null;
      const mime = parts[0].match(/:(.*?);/)[1];

      const ext = mime.split('/')[1] || 'png';
      const fileName = `media_${item.id}.${ext}`;

      // Crear el archivo (POST multipart upload)
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;
      
      const metadata = {
        name: fileName,
        mimeType: mime,
        parents: [folderId]
      };

      const multipartBody = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mime}\r\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        parts[1] +
        closeDelim;

      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (!uploadRes.ok) return null;
      const fileData = await uploadRes.json();
      const fileId = fileData.id;

      // Dar permiso público de lectura para que cualquiera pueda cargarlo en el canvas web/local
      const permUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
      await fetch(permUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });

      // Devolver la URL de descarga directa
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    } catch (err) {
      console.error('Error uploading media to Google Drive:', err);
      return null;
    }
  };

  const syncProjectsFromGoogleDrive = async (accessToken) => {
    if (!accessToken) return;
    try {
      const headers = { 'Authorization': `Bearer ${accessToken}` };
      
      // 1. Buscar la carpeta "Odinote"
      const searchRootUrl = `https://www.googleapis.com/drive/v3/files?q=name='Odinote' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`;
      const searchRootRes = await fetch(searchRootUrl, { headers });
      if (!searchRootRes.ok) return;
      const searchRootData = await searchRootRes.json();
      if (!searchRootData.files || searchRootData.files.length === 0) return;
      const rootFolderId = searchRootData.files[0].id;

      // 2. Listar las subcarpetas dentro de "Odinote"
      const listSubfoldersUrl = `https://www.googleapis.com/drive/v3/files?q='${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id, name)`;
      const subfoldersRes = await fetch(listSubfoldersUrl, { headers });
      if (!subfoldersRes.ok) return;
      const subfoldersData = await subfoldersRes.json();
      if (!subfoldersData.files || subfoldersData.files.length === 0) return;

      let hasImportedAny = false;
      const importedProjects = [];
      const importedCanvases = {};

      for (const folder of subfoldersData.files) {
        // 3. Buscar "canvas_state.json" dentro de la subcarpeta
        const searchFileUrl = `https://www.googleapis.com/drive/v3/files?q=name='canvas_state.json' and '${folder.id}' in parents and trashed=false&fields=files(id)`;
        const fileRes = await fetch(searchFileUrl, { headers });
        if (!fileRes.ok) continue;
        const fileData = await fileRes.json();
        if (!fileData.files || fileData.files.length === 0) continue;
        const fileId = fileData.files[0].id;

        // 4. Descargar "canvas_state.json"
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const downloadRes = await fetch(downloadUrl, { headers });
        if (!downloadRes.ok) continue;
        const projJSON = await downloadRes.json();

        if (projJSON && projJSON.projectId) {
          hasImportedAny = true;
          
          localStorage.setItem(`odinote.gdrive_folder_${projJSON.projectId}`, folder.id);

          const projectMetaData = {
            id: projJSON.projectId,
            name: projJSON.name,
            emoji: projJSON.emoji || '🗒️',
            cover: projJSON.cover || 'var(--bg-card, #FFFFFF)',
            starred: false,
            isPublic: true,
            useGoogleDrive: true,
            items: Object.keys(projJSON.canvases || {}).length,
            updated: { en: 'Synced', es: 'Sincronizado' }
          };
          importedProjects.push(projectMetaData);
          
          Object.assign(importedCanvases, projJSON.canvases);
        }
      }

      if (hasImportedAny) {
        setProjects(prev => {
          const next = [...prev];
          importedProjects.forEach(ip => {
            const idx = next.findIndex(p => p.id === ip.id);
            if (idx !== -1) {
              next[idx] = { ...next[idx], ...ip };
            } else {
              next.push(ip);
            }
          });
          return next;
        });

        setCanvases(prev => ({
          ...prev,
          ...importedCanvases
        }));

        window.showToast && window.showToast(window.t('¡Proyectos sincronizados desde Google Drive!', 'Projects synchronized from Google Drive!'));
      }
    } catch (err) {
      console.error('Error auto-syncing projects from Google Drive:', err);
    }
  };

  // persist — debounced so IndexedDB/Vault writes don't run on every single keystroke/drag frame.
  useEffectApp(() => {
    if (loading) return;
    if (ignoreNextPersistRef.current) {
      ignoreNextPersistRef.current = false;
      return;
    }
    if (isIncomingRemoteChangeRef.current) {
      isIncomingRemoteChangeRef.current = false;
      return;
    }
    const id = setTimeout(async () => {
      // 1. Guardado Local (IndexedDB / Vault)
      if (vaultPath && window.electronAPI) {
        const cleanCanvases = await saveBase64MediaLocally(canvases, vaultPath);
        window.electronAPI.writeVault(vaultPath, { view, lang, theme, projects, canvases: cleanCanvases, templatesVersion: 2 });
      } else {
        saveStateToDB({ view, lang, theme, projects, canvases, templatesVersion: 2 });
      }

      // 2. Sincronización en la nube (Firestore) para proyectos públicos
      if (firestoreDB && userProfile && view.projectId) {
        const activeProj = projects.find(p => p.id === view.projectId);
        if (activeProj && (activeProj.isPublic || activeProj.isRemote)) {
          try {
            await firestoreDB.collection('workspaces').doc(view.projectId).set({
              id: view.projectId,
              name: activeProj.name,
              emoji: activeProj.emoji || '',
              cover: activeProj.cover || '',
              isPublic: true,
              shareToken: activeProj.shareToken || '',
              collaborators: activeProj.collaborators || [],
              canvases: canvases,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              lastEditedBy: userProfile.email
            }, { merge: true });
          } catch (err) {
            console.error('Failed to sync to Firestore:', err);
          }
        }
      }

      // 3. Sincronización real con Google Drive si está habilitado
      if (userProfile && userProfile.accessToken && view.projectId) {
        const activeProj = projects.find(p => p.id === view.projectId);
        if (activeProj && activeProj.useGoogleDrive) {
          const now = Date.now();
          
          // 3.1 Escaneo y subida de imagenes Base64 locales a Google Drive
          const currentCanvas = canvases[view.projectId];
          if (currentCanvas && currentCanvas.items) {
            let changedMedia = false;
            const updatedItems = await Promise.all(currentCanvas.items.map(async (item) => {
              if (item.src && item.src.startsWith('data:')) {
                const driveUrl = await uploadMediaToGoogleDriveReal(view.projectId, item, userProfile.accessToken);
                if (driveUrl) {
                  changedMedia = true;
                  return { ...item, src: driveUrl };
                }
              }
              return item;
            }));

            if (changedMedia) {
              setCanvases(prev => ({
                ...prev,
                [view.projectId]: {
                  ...currentCanvas,
                  items: updatedItems
                }
              }));
              // Forzar un save de la nueva URL en el proximo render
              return;
            }
          }

          // 3.2 Sincronización del archivo JSON del proyecto a Google Drive
          if (now - lastGoogleDriveSyncTimeRef.current > 10000) {
            lastGoogleDriveSyncTimeRef.current = now;
            uploadToGoogleDriveReal(view.projectId, activeProj.name, canvases, userProfile.accessToken);
          }
        }
      }
    }, 400);
    return () => clearTimeout(id);
  }, [view, lang, theme, projects, canvases, loading, vaultPath]);

  // Sincronización remota (Firestore -> Local) en tiempo real
  useEffectApp(() => {
    if (!firestoreDB || !userProfile || !view.projectId) return;

    const activeProj = projects.find(p => p.id === view.projectId);
    if (!activeProj || (!activeProj.isPublic && !activeProj.isRemote)) return;

    // Escuchador en tiempo real
    const unsubscribe = firestoreDB.collection('workspaces').doc(view.projectId).onSnapshot((doc) => {
      if (!doc.exists) return;
      
      const data = doc.data();
      // Si el último que editó el documento no fui yo, aplicamos los cambios
      if (data && data.lastEditedBy !== userProfile.email) {
        // Marcamos que es un cambio remoto entrante para evitar que el loop local intente guardarlo de nuevo
        isIncomingRemoteChangeRef.current = true;
        
        if (data.canvases) {
          setCanvases(cleanCanvases(data.canvases));
        }
        
        // También actualizamos los metadatos del proyecto localmente
        setProjects(prev => prev.map(p => {
          if (p.id === view.projectId) {
            return {
              ...p,
              name: data.name || p.name,
              emoji: data.emoji || p.emoji,
              cover: data.cover || p.cover,
              collaborators: data.collaborators || p.collaborators
            };
          }
          return p;
        }));
      }
    }, (error) => {
      console.error('Error listening to firestore updates:', error);
    });

    return () => {
      unsubscribe();
    };
  }, [view.projectId, userProfile, projects]);

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

  const togglePublicProject = (projectId) => {
    if (!userProfile) {
      setUserModalOpen(true);
      return;
    }
    setProjects(p => p.map(x => {
      if (x.id === projectId) {
        const nextPublic = !x.isPublic;
        const nextToken = nextPublic 
          ? `odi-tok-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`
          : null;
        return { ...x, isPublic: nextPublic, shareToken: nextToken };
      }
      return x;
    }));
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
      userProfile={userProfile}
      onUserClick={() => setUserModalOpen(true)}
      onJoinProjectClick={() => setJoiningModalOpen(true)}
      onTogglePublic={togglePublicProject}
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
      userProfile={userProfile}
      onUserClick={() => setUserModalOpen(true)}
      projects={projects}
      setProjects={setProjects}
      onSharingClick={(pid) => { setActiveSharingProjectId(pid); setSharingModalOpen(true); }}
      processMediaSrc={(src) => {
        const activeProj = projects.find(p => p.id === view.projectId);
        if (activeProj && activeProj.useGoogleDrive) {
          if (src && (src.startsWith('data:') || src.startsWith('file:') || (!src.startsWith('http://') && !src.startsWith('https://')))) {
            const fileId = 'drive-file-' + Math.random().toString(36).substr(2, 9);
            return `https://drive.google.com/uc?export=view&id=${fileId}`;
          }
        }
        return src;
      }}
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
              width: '680px', 
              maxHeight: '90vh', 
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
                  <>
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

                    {dictWords.length > 0 && (() => {
                      const spanishPattern = /[áéíóúñüÁÉÍÓÚÑÜ]/i;
                      const esWords = dictWords.filter(w => spanishPattern.test(w));
                      const enWords = dictWords.filter(w => !spanishPattern.test(w));
                      
                      const renderWordList = (words) => (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {words.map(w => (
                            <div 
                              key={w} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                background: 'var(--paper, #FFFFFF)', 
                                border: '1px solid var(--line-soft, rgba(89,84,89,0.22))', 
                                borderRadius: '4px', 
                                padding: '2px 6px',
                                fontSize: '11px',
                                color: 'var(--text, #1A1A1A)'
                              }}
                            >
                              <span>{w}</span>
                              <span 
                                className="material-symbols-rounded" 
                                style={{ fontSize: '13px', cursor: 'pointer', color: 'var(--wine, #E6544F)' }}
                                title={window.t('Eliminar', 'Delete')}
                                onClick={() => {
                                  window.electronAPI.removeWordFromDictionary(w).then(success => {
                                    if (success) {
                                      setDictWords(prev => prev.filter(x => x !== w));
                                    }
                                  });
                                }}
                              >
                                close
                              </span>
                            </div>
                          ))}
                        </div>
                      );

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', padding: '12px', background: 'var(--bg-2, #E2E1E1)', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--line-soft, rgba(89,84,89,0.22))' }}>
                          {esWords.length > 0 && (
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--wine, #E6544F)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{window.t('Español', 'Spanish')}</div>
                              {renderWordList(esWords)}
                            </div>
                          )}
                          {enWords.length > 0 && (
                            <div style={{ marginTop: esWords.length > 0 ? '10px' : '0' }}>
                              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--wine, #E6544F)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{window.t('Inglés y Otros', 'English & Others')}</div>
                              {renderWordList(enWords)}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--wine, #7B2D26)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>keyboard</span>
                    <span>{window.t('Atajos de Teclado', 'Keyboard Shortcuts')}</span>
                  </div>
                  <button
                    className="btn btn-ghost"
                    onClick={handleResetShortcuts}
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '11px', 
                      borderRadius: '6px', 
                      border: '1px solid var(--line-soft, #E5E1DD)', 
                      cursor: 'pointer',
                      background: 'transparent',
                      color: 'var(--text-soft, #595459)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>restore</span>
                    <span>{window.t('Restablecer', 'Reset')}</span>
                  </button>
                </div>
                
                <p style={{ fontSize: '12px', color: 'var(--text-soft, #595459)', margin: '0 0 4px 0', lineHeight: '1.4' }}>
                  {window.t(
                    'Haz clic sobre cualquiera de los atajos configurables para cambiar su combinación de teclas asignada.',
                    'Click on any of the configurable shortcuts to rebind its key combination.'
                  )}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                  {/* Atajos Configurables */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--wine, #7B2D26)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                      {window.t('Personalizables', 'Configurable')}
                    </div>
                    {[
                      { id: 'undo', desc: window.t('Deshacer acción', 'Undo action') },
                      { id: 'redo', desc: window.t('Rehacer acción', 'Redo action') },
                      { id: 'duplicate', desc: window.t('Duplicar nodo', 'Duplicate selected node') },
                      { id: 'selectAll', desc: window.t('Seleccionar todo', 'Select all items') },
                      { id: 'search', desc: window.t('Enfocar buscador del lienzo', 'Focus search box') }
                    ].map((sh) => {
                      const cfg = shState[sh.id] || {};
                      const isListening = listeningKey === sh.id;
                      return (
                        <div key={sh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '6px 8px', background: 'var(--bg-main, #FAF8F6)', borderRadius: '6px', border: '1.5px solid var(--line-soft, #E5E1DD)' }}>
                          <span style={{ color: 'var(--text, #1A1A1A)', fontWeight: '500' }}>{sh.desc}</span>
                          <button
                            onClick={() => setListeningKey(isListening ? null : sh.id)}
                            style={{
                              background: isListening ? 'var(--wine-l, #FBDFDD)' : 'var(--bg-card, #FFFFFF)',
                              color: isListening ? 'var(--wine, #E6544F)' : 'var(--text, #1A1A1A)',
                              border: isListening ? '1.5px solid var(--wine, #E6544F)' : '1.5px solid var(--line, #595459)',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '10.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              boxShadow: isListening ? 'none' : '1px 1px 0 var(--line, #595459)',
                              fontFamily: 'var(--font-mono, monospace)'
                            }}
                          >
                            {isListening ? window.t('Pulsa teclas...', 'Press keys...') : cfg.label || 'None'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Atajos Estáticos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--wine, #7B2D26)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                      {window.t('Fijos de Sistema', 'System Fixed')}
                    </div>
                    {[
                      { keys: ['Ctrl', 'C'], desc: window.t('Copiar nodos', 'Copy nodes') },
                      { keys: ['Ctrl', 'V'], desc: window.t('Pegar nodos / archivos', 'Paste nodes or files') },
                      { keys: ['Ctrl', 'X'], desc: window.t('Cortar nodos', 'Cut nodes') },
                      { keys: ['F12', 'Ctrl+Shift+I'], desc: window.t('Consola de depuración', 'Toggle DevTools') },
                      { keys: ['Ctrl', 'Botón Central'], desc: window.t('Paneo de cámara global', 'Global camera panning') },
                      { keys: ['Shift', 'Click'], desc: window.t('Selección múltiple individual', 'Toggle item selection') },
                      { keys: ['Shift', 'Arrastrar'], desc: window.t('Seleccionar por recuadro', 'Box selection') },
                      { keys: ['Alt', 'Arrastrar'], desc: window.t('Desplazar lienzo (Paneo)', 'Pan the canvas') },
                      { keys: ['Ctrl', 'Rueda'], desc: window.t('Acercar / Alejar (Zoom)', 'Zoom In / Out') },
                      { keys: ['↑', '↓', '←', '→'], desc: window.t('Mover nodo seleccionado', 'Move selected node') },
                      { keys: ['Doble Clic'], desc: window.t('Editar texto / Renombrar', 'Edit text / Rename') },
                      { keys: ['Clic Derecho'], desc: window.t('Creación rápida / Opciones', 'Quick-create / Options') },
                      { keys: ['Tab', 'Enter'], desc: window.t('Navegar y editar celdas (Tablas)', 'Navigate and edit cells (Tables)') },
                      { keys: ['Supr', 'Backspace'], desc: window.t('Eliminar elemento', 'Delete item') },
                      { keys: ['Esc'], desc: window.t('Limpiar selección / Cerrar', 'Clear selection / Close') }
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
                              fontSize: '10px', 
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

      {/* User Profile Modal */}
      {/* User Profile Modal */}
      {userModalOpen && (
        <div className="doc-modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.45)' }} onClick={() => setUserModalOpen(false)}>
          <div className="doc-modal" style={{ width: '400px', background: 'var(--bg, #FAF9F6)', border: '1.5px solid var(--line, #595459)', padding: '24px', borderRadius: '12px', boxShadow: 'var(--pop-md)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '24px', color: 'var(--olive, #6A8546)' }}>
                  {userProfile ? 'account_circle' : 'login'}
                </span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--ink, #1A1A1A)' }}>
                  {userProfile ? window.t('Perfil de Colaborador', 'Collaborator Profile') : window.t('Iniciar sesión', 'Sign In')}
                </h3>
              </div>
              <button className="icon-btn lift" onClick={() => setUserModalOpen(false)}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            {!userProfile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {!waitingForWebLogin ? (
                  <>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-soft, #595459)', lineHeight: '1.5' }}>
                      {window.t(
                        'Para invitar colaboradores, unirte a proyectos compartidos y sincronizar tus lienzos en la nube, debes iniciar sesión con tu cuenta de Google real.',
                        'To invite collaborators, join shared projects, and sync your canvases in the cloud, you must sign in with your real Google account.'
                      )}
                    </p>

                    {loginError && (
                      <div style={{ padding: '10px 12px', background: 'rgba(230, 84, 79, 0.1)', border: '1.5px solid var(--wine, #E6544F)', borderRadius: '8px', fontSize: '12px', color: 'var(--wine, #E6544F)', fontWeight: '600' }}>
                        {loginError}
                      </div>
                    )}

                    <button
                      className="btn lift"
                      onClick={() => {
                        setLoginError(null);
                        if (window.electronAPI && window.electronAPI.startGoogleLogin) {
                          setWaitingForWebLogin(true);
                          window.electronAPI.startGoogleLogin()
                            .catch((err) => {
                              console.error("IPC startGoogleLogin error:", err);
                              setWaitingForWebLogin(false);
                              setLoginError(window.t(
                                'No se pudo iniciar el flujo de Google. Asegúrate de estar en la aplicación de escritorio.',
                                'Could not start Google flow. Please make sure you are in the desktop application.'
                              ));
                            });
                        } else {
                          const provider = new firebase.auth.GoogleAuthProvider();
                          provider.setCustomParameters({ prompt: 'select_account' });
                          provider.addScope('https://www.googleapis.com/auth/drive.file');
                          firebase.auth().signInWithPopup(provider)
                            .then((result) => {
                              const user = result.user;
                              const credential = result.credential;
                              const userProfileData = {
                                name: user.displayName || 'Google User',
                                email: user.email,
                                picture: user.photoURL || (user.displayName ? user.displayName.charAt(0) : 'G'),
                                accessToken: credential ? credential.accessToken : null
                              };
                              setUserProfile(userProfileData);
                              localStorage.setItem('odinote.google_profile', JSON.stringify(userProfileData));
                              showToast(window.t('¡Sesión iniciada con éxito mediante Google!', 'Successfully signed in with Google!'));
                            })
                            .catch((err) => {
                              console.error("Auth web error:", err);
                              setLoginError(err.message);
                            });
                        }
                        window.playAudioTone && window.playAudioTone('click');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1.5px solid var(--line, #595459)',
                        background: '#FFFFFF',
                        color: '#1A1A1A',
                        fontWeight: '700',
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        boxShadow: 'var(--pop-sm)'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18">
                        <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.8 2.17c1.64-1.51 2.59-3.74 2.59-6.5z"/>
                        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.8-2.17c-.78.52-1.78.83-3.16.83-2.43 0-4.49-1.64-5.22-3.85H.91v2.24C2.4 15.82 5.5 18 9 18z"/>
                        <path fill="#FBBC05" d="M3.78 10.63c-.19-.57-.3-1.18-.3-1.8s.11-1.23.3-1.8V4.78H.91C.33 5.93 0 7.23 0 8.63s.33 2.7 1.01 3.85l2.77-2.22z"/>
                        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47 1.09 11.43 0 9 0 5.5 0 2.4 2.18.91 5.16l2.87 2.24C4.51 5.22 6.57 3.58 9 3.58z"/>
                      </svg>
                      <span>{window.t('Iniciar sesión con Google', 'Sign in with Google')}</span>
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ position: 'relative', width: '48px', height: '48px', display: 'grid', placeItems: 'center' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '32px', color: 'var(--olive, #6A8546)', animation: 'spin 2s linear infinite' }}>
                        progress_activity
                      </span>
                    </div>
                    <style>{`
                      @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                    `}</style>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--ink, #1A1A1A)' }}>
                        {window.t('Esperando inicio de sesión...', 'Waiting for sign-in...')}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-soft, #595459)', lineHeight: '1.4' }}>
                        {window.t(
                          'Hemos abierto una pestaña en tu navegador web de internet. Por favor, inicia sesión allí.',
                          'We opened a tab in your default web browser. Please sign in there.'
                        )}
                      </span>
                    </div>

                    <button
                      className="btn lift"
                      onClick={() => {
                        if (window.electronAPI && window.electronAPI.startGoogleLogin) {
                          window.electronAPI.startGoogleLogin();
                        }
                      }}
                      style={{ padding: '8px 12px', fontSize: '12px', fontWeight: '700', borderRadius: '6px', border: '1.5px solid var(--line)', background: '#FFFFFF', cursor: 'pointer' }}
                    >
                      {window.t('Abrir página de nuevo', 'Re-open page')}
                    </button>

                    <button
                      className="btn lift"
                      onClick={() => {
                        setWaitingForWebLogin(false);
                        window.playAudioTone && window.playAudioTone('click');
                      }}
                      style={{ marginTop: '8px', padding: '6px 14px', borderRadius: '6px', border: '1.5px solid var(--wine, #E6544F)', color: 'var(--wine, #E6544F)', background: 'transparent', fontWeight: '700', fontSize: '11.5px', cursor: 'pointer' }}
                    >
                      {window.t('Cancelar', 'Cancel')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', background: 'var(--bg-card, #FFFFFF)', border: '1.5px solid var(--line-soft, #E5E1DD)', borderRadius: '8px' }}>
                  {userProfile.picture.startsWith('http') ? (
                    <img src={userProfile.picture} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--olive, #6A8546)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '18px', fontWeight: '700' }}>
                      {userProfile.picture}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--ink, #1A1A1A)' }}>{userProfile.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-soft, #595459)' }}>{userProfile.email}</span>
                  </div>
                </div>

                <div style={{ padding: '10px 12px', background: 'rgba(144, 185, 104, 0.1)', border: '1.5px solid var(--brand-green, #90B968)', borderRadius: '8px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-rounded" style={{ color: 'var(--brand-green, #90B968)', fontSize: '18px' }}>check_circle</span>
                  <span style={{ fontWeight: '600', color: 'var(--ink, #1A1A1A)' }}>
                    {window.t('Conectado mediante Google', 'Connected via Google')}
                  </span>
                </div>

                <div style={{ borderTop: '1px solid var(--line-soft, #E5E1DD)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    className="btn lift"
                    onClick={() => {
                      window.customConfirm(window.t('¿Seguro que quieres cerrar sesión? Perderás acceso temporal a la colaboración en la nube.', 'Are you sure you want to sign out? You will temporarily lose access to cloud collaboration.'))
                        .then((accepted) => {
                          if (accepted) {
                            setUserProfile(null);
                            localStorage.removeItem('odinote.google_profile');
                            window.playAudioTone && window.playAudioTone('click');
                          }
                        });
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: '1.5px solid var(--wine, #E6544F)',
                      color: 'var(--wine, #E6544F)',
                      background: 'transparent',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {window.t('Cerrar sesión', 'Sign out')}
                  </button>

                  <button
                    className="btn lift"
                    onClick={() => setUserModalOpen(false)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '6px',
                      background: 'var(--olive, #6A8546)',
                      color: 'white',
                      border: 'none',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {window.t('Aceptar', 'Accept')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Canvas Sharing Modal */}
      {sharingModalOpen && (() => {
        const project = projects.find(p => p.id === activeSharingProjectId);
        if (!project) return null;
        return (
          <div className="doc-modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.45)' }} onClick={() => setSharingModalOpen(false)}>
            <div className="doc-modal" style={{ width: '480px', background: 'var(--bg, #FAF9F6)', border: '1.5px solid var(--line, #595459)', padding: '24px', borderRadius: '12px', boxShadow: 'var(--pop-md)' }} onClick={(e) => e.stopPropagation()}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '24px', color: 'var(--olive, #6A8546)' }}>share</span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--ink, #1A1A1A)' }}>
                    {window.t('Colaboración en línea', 'Online Collaboration')}
                  </h3>
                </div>
                <button className="icon-btn lift" onClick={() => setSharingModalOpen(false)}>
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>

              {!project.isPublic ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(230, 84, 79, 0.08)', display: 'grid', placeItems: 'center' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 32, color: 'var(--wine, #E6544F)' }}>lock</span>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '700' }}>
                      {window.t('Este puesto de trabajo es Privado', 'This workspace is Private')}
                    </h4>
                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-soft)', lineHeight: 1.4 }}>
                      {window.t('Actualmente solo está guardado en tu disco duro. Nadie más puede acceder a él.', 'Currently saved only on your hard drive. No one else can access it.')}
                    </p>
                  </div>
                  <button
                    className="btn lift"
                    onClick={() => {
                      togglePublicProject(project.id);
                      window.playAudioTone && window.playAudioTone('click');
                    }}
                    style={{
                      marginTop: '8px',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      background: 'var(--olive, #6A8546)',
                      color: 'white',
                      border: 'none',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: 'var(--pop-sm)'
                    }}
                  >
                    {window.t('Publicar en la nube y compartir', 'Publish to cloud and share')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ padding: '12px', background: 'rgba(144, 185, 104, 0.1)', border: '1.5px solid var(--brand-green, #90B968)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="material-symbols-rounded" style={{ color: 'var(--brand-green, #90B968)' }}>public</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--brand-green, #90B968)' }}>
                        {window.t('PUESTO DE TRABAJO PÚBLICO', 'PUBLIC WORKSPACE')}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-soft)' }}>
                        {window.t('Cualquier persona con el token puede unirse.', 'Anyone with the token can join.')}
                      </div>
                    </div>
                    <button
                      className="btn lift"
                      onClick={() => {
                        window.customConfirm(window.t('¿Seguro que quieres hacer este espacio privado? Se eliminará el token de la nube y tus amigos perderán el acceso.', 'Are you sure you want to make this space private? The cloud token will be deleted and your friends will lose access.'))
                          .then((accepted) => {
                            if (accepted) {
                              togglePublicProject(project.id);
                              window.playAudioTone && window.playAudioTone('click');
                            }
                          });
                      }}
                      style={{ padding: '6px 12px', fontSize: '11px', border: '1px solid var(--wine)', color: 'var(--wine)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontWeight: '700' }}
                    >
                      {window.t('Hacer Privado', 'Make Private')}
                    </button>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-soft, #595459)', marginBottom: '6px' }}>
                      {window.t('Token de invitación (Comparte esto)', 'Invitation Token (Share this)')}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-main, #E5E1DD)', borderRadius: '8px', border: '1.5px solid var(--line-soft, #D5D1CD)' }}>
                      <code style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: 'var(--ink, #1A1A1A)' }}>
                        {project.shareToken}
                      </code>
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(project.shareToken);
                          window.playAudioTone && window.playAudioTone('click');
                          alert(window.t('¡Token copiado al portapapeles!', 'Token copied to clipboard!'));
                        }}
                        style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid var(--line-soft)', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        {window.t('Copiar', 'Copy')}
                      </button>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--line-soft, #E5E1DD)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'var(--text-soft)' }}>
                        {window.t('Colaboradores Invitados', 'Invited Collaborators')}
                      </h4>
                      <button
                        className="btn lift"
                        onClick={() => {
                          const friendId = prompt(window.t('Introduce el ID del usuario al que quieres invitar (ej. usr-xxxx):', 'Enter the ID of the user you want to invite (e.g. usr-xxxx):'));
                          if (friendId) {
                            // Simulación: Guardamos en project.collaborators
                            setProjects(prev => prev.map(p => {
                              if (p.id === project.id) {
                                const list = p.collaborators || [];
                                if (list.some(c => c.id === friendId)) return p;
                                return {
                                  ...p,
                                  collaborators: [...list, { id: friendId, name: friendId.replace('usr-', 'User_'), role: 'editor' }]
                                };
                              }
                              return p;
                            }));
                          }
                        }}
                        style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--olive)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '700' }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: 13 }}>person_add</span>
                        <span>{window.t('Invitar por ID', 'Invite by ID')}</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--line-soft)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--olive)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: '700' }}>
                            {userProfile?.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '700' }}>{userProfile?.name || 'Tú'}</span>
                            <span style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 4px', background: 'var(--olive-l, #EAEFE2)', color: 'var(--olive)', borderRadius: '3px', fontWeight: '700' }}>
                              {window.t('Propietario', 'Owner')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {(project.collaborators || []).map((col, cIdx) => (
                        <div key={cIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--line-soft)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--line-soft, #D5D1CD)', color: 'var(--text-soft)', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: '700' }}>
                              {col.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '12px', fontWeight: '700' }}>{col.name}</span>
                              <span style={{ fontSize: '9px', color: 'var(--text-soft)' }}>{col.id}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <select
                              value={col.role}
                              onChange={(e) => {
                                const nextRole = e.target.value;
                                setProjects(prev => prev.map(p => {
                                  if (p.id === project.id) {
                                    return {
                                      ...p,
                                      collaborators: p.collaborators.map(c => c.id === col.id ? { ...c, role: nextRole } : c)
                                    };
                                  }
                                  return p;
                                }));
                              }}
                              style={{ fontSize: '11px', padding: '3px', borderRadius: '4px', border: '1px solid var(--line-soft)' }}
                            >
                              <option value="editor">{window.t('Editor', 'Editor')}</option>
                              <option value="viewer">{window.t('Lector', 'Viewer')}</option>
                            </select>
                            <button
                              className="icon-btn danger"
                              onClick={() => {
                                window.customConfirm(window.t('¿Eliminar a este colaborador?', 'Remove this collaborator?'))
                                  .then((accepted) => {
                                    if (accepted) {
                                      setProjects(prev => prev.map(p => {
                                        if (p.id === project.id) {
                                          return {
                                            ...p,
                                            collaborators: p.collaborators.filter(c => c.id !== col.id)
                                          };
                                        }
                                        return p;
                                      }));
                                      window.playAudioTone && window.playAudioTone('click');
                                    }
                                  });
                              }}
                              style={{ padding: '3px' }}
                            >
                              <span className="material-symbols-rounded" style={{ fontSize: 15 }}>delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Google Drive Collaborative Storage Block */}
                  <div style={{ borderTop: '1px solid var(--line-soft, #E5E1DD)', paddingTop: '16px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '20px', color: '#34A853' }}>cloud_upload</span>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'var(--ink, #1A1A1A)' }}>
                          {window.t('Almacenamiento en Google Drive', 'Google Drive Cloud Storage')}
                        </h4>
                      </div>
                      <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '34px', height: '20px' }}>
                        <input
                          type="checkbox"
                          checked={!!project.useGoogleDrive}
                           onChange={(e) => {
                             if (!userProfile) {
                               alert(window.t('Debes iniciar sesión con Google primero para activar Drive.', 'You must sign in with Google first to activate Drive.'));
                               setUserModalOpen(true);
                               return;
                             }
                             const enable = e.target.checked;
                             if (enable) {
                               const msg = window.t(
                                 '¿Activar sincronización con tu Google Drive? Las imágenes y archivos pesados consumirán espacio de tus 15 GB gratuitos de tu cuenta personal de Google.',
                                 'Activate sync with your Google Drive? Images and large files will consume space from your 15 GB of free personal Google storage.'
                               );
                               window.customConfirm(msg).then((accepted) => {
                                 if (accepted) {
                                   setProjects(prev => prev.map(p => {
                                     if (p.id === project.id) {
                                       return { ...p, useGoogleDrive: true };
                                     }
                                     return p;
                                   }));
                                   window.playAudioTone && window.playAudioTone('click');
                                 }
                               });
                             } else {
                               const msg = window.t(
                                 '¿Desactivar Google Drive para este proyecto? Los archivos se mantendrán localmente pero los colaboradores invitados no podrán verlos.',
                                 'Deactivate Google Drive for this project? Files will be kept locally but invited collaborators won\'t be able to see them.'
                               );
                               window.customConfirm(msg).then((accepted) => {
                                 if (accepted) {
                                   setProjects(prev => prev.map(p => {
                                     if (p.id === project.id) {
                                       return { ...p, useGoogleDrive: false };
                                     }
                                     return p;
                                   }));
                                   window.playAudioTone && window.playAudioTone('click');
                                 }
                               });
                             }
                           }}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: project.useGoogleDrive ? '#34A853' : '#ccc',
                          transition: '.4s', borderRadius: '20px'
                        }}>
                          <span style={{
                            position: 'absolute', content: '""', height: '14px', width: '14px', left: '3px', bottom: '3px',
                            backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                            transform: project.useGoogleDrive ? 'translateX(14px)' : 'translateX(0)'
                          }}/>
                        </span>
                      </label>
                    </div>

                    <p style={{ margin: '0 0 10px 0', fontSize: '11.5px', color: 'var(--text-soft, #595459)', lineHeight: '1.4' }}>
                      {window.t(
                        'Permite que colaboradores externos agreguen y visualicen imágenes o audios en este canvas público cargándolos directamente a tu cuenta de Google Drive.',
                        'Allows external collaborators to add and view images or audios on this public canvas by uploading them directly to your Google Drive account.'
                      )}
                    </p>

                    {project.useGoogleDrive ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ padding: '10px', background: 'rgba(52, 168, 83, 0.08)', border: '1px solid #34A853', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="material-symbols-rounded" style={{ color: '#34A853', fontSize: '16px' }}>cloud_done</span>
                          <span style={{ fontWeight: '600', color: 'var(--ink, #1A1A1A)' }}>
                            {window.t('Sincronización activa con la carpeta: Odinote Canvases', 'Sync active with folder: Odinote Canvases')}
                          </span>
                        </div>
                        {window.electronAPI && (
                          <button
                            className="btn lift"
                            onClick={() => {
                              alert(window.t('Simulación: Descargando archivos en lote a tu Vault local...', 'Simulation: Downloading files in batch to your local Vault...'));
                              // Simular descarga
                              setProjects(prev => prev.map(p => {
                                if (p.id === project.id) {
                                  return { ...p, useGoogleDrive: false };
                                }
                                return p;
                              }));
                            }}
                            style={{
                              padding: '8px 12px',
                              fontSize: '11.5px',
                              border: '1.5px solid var(--line, #595459)',
                              borderRadius: '6px',
                              background: 'transparent',
                              cursor: 'pointer',
                              fontWeight: '700',
                              alignSelf: 'flex-start',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>download_for_offline</span>
                            {window.t('Desconectar y Descargar a Local', 'Disconnect & Download to Local')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '8px 10px', background: 'rgba(230, 84, 79, 0.06)', border: '1.5px solid var(--wine, #E6544F)', borderRadius: '6px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-symbols-rounded" style={{ color: 'var(--wine, #E6544F)', fontSize: '16px' }}>warning</span>
                        <span style={{ fontWeight: '500', color: 'var(--ink, #1A1A1A)' }}>
                          {window.t('Los colaboradores de la web no podrán ver imágenes locales sin sincronización de Drive.', 'Web collaborators won\'t see local images without Drive synchronization.')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--line-soft)', paddingTop: '12px' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setSharingModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1.5px solid var(--line-soft)',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {window.t('Cerrar', 'Close')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Canvas Joining Modal */}
      {joiningModalOpen && (() => {
        let tokenInputRef = React.createRef();
        return (
          <div className="doc-modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.45)' }} onClick={() => setJoiningModalOpen(false)}>
            <div className="doc-modal" style={{ width: '400px', background: 'var(--bg, #FAF9F6)', border: '1.5px solid var(--line, #595459)', padding: '24px', borderRadius: '12px', boxShadow: 'var(--pop-md)' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '24px', color: 'var(--olive, #6A8546)' }}>group_add</span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--ink, #1A1A1A)' }}>
                    {window.t('Unirse a Puesto de Trabajo', 'Join Workspace')}
                  </h3>
                </div>
                <button className="icon-btn lift" onClick={() => setJoiningModalOpen(false)}>
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-soft, #595459)', marginBottom: '6px' }}>
                    {window.t('Token del Canvas (Ej: odi-tok-...)', 'Canvas Token (E.g. odi-tok-...)')}
                  </label>
                  <input
                    ref={tokenInputRef}
                    type="text"
                    placeholder="odi-tok-xxxx-xxxx"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--line-soft, #E5E1DD)',
                      background: 'var(--bg-card, #FFFFFF)',
                      color: 'var(--text, #1A1A1A)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ padding: '12px', background: 'rgba(106, 133, 70, 0.08)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-soft)' }}>
                  {window.t('Al unirte, este puesto de trabajo aparecerá en tu menú principal al lado de tus proyectos locales.', 'Upon joining, this workspace will appear on your main menu next to your local projects.')}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--line-soft)', paddingTop: '12px' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setJoiningModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1.5px solid var(--line-soft)', cursor: 'pointer' }}
                >
                  {window.t('Cancelar', 'Cancel')}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const token = tokenInputRef.current?.value.trim();
                    if (!token) return;
                    if (!userProfile?.name) {
                      showToast(window.t('Configura tu nombre en tu perfil antes de unirte.', 'Configure your name in your profile before joining.'), 'error');
                      setUserModalOpen(true);
                      return;
                    }
                    
                    if (firestoreDB) {
                      showToast(window.t('Conectando al servidor...', 'Connecting to server...'));
                      firestoreDB.collection('workspaces').doc(token).get()
                        .then((doc) => {
                          if (!doc.exists) {
                            showToast(window.t('Token no válido o puesto de trabajo inexistente.', 'Invalid token or non-existent workspace.'), 'error');
                            return;
                          }
                          const data = doc.data();
                          const remoteId = token; // El ID del proyecto remoto local es el mismo token

                          const remoteProj = {
                            id: remoteId,
                            name: data.name || { en: 'Remote Workspace', es: 'Puesto Remoto' },
                            emoji: data.emoji || '☁️',
                            cover: data.cover || 'linear-gradient(135deg, #A8BEE4 0%, #D5E1F6 100%)',
                            starred: false,
                            isPublic: true,
                            isRemote: true,
                            shareToken: token,
                            items: Object.keys(data.canvases || {}).length,
                            updated: { en: 'Just now', es: 'Ahora mismo' }
                          };

                          setProjects(prev => {
                            if (prev.some(p => p.id === remoteId)) return prev;
                            return [remoteProj, ...prev];
                          });

                          if (data.canvases) {
                            setCanvases(prev => ({
                              ...prev,
                              [remoteId]: cleanCanvases(data.canvases)
                            }));
                          }

                          setJoiningModalOpen(false);
                          showToast(window.t('¡Conectado al puesto de trabajo de tu amigo con éxito!', 'Connected to your friend\'s workspace successfully!'));
                          
                          // Abrir el proyecto directamente
                          openProject(remoteId);
                        })
                        .catch((err) => {
                          console.error("Error connecting to remote database workspace:", err);
                          showToast(window.t('Fallo de red al conectar al puesto de trabajo.', 'Network failure connecting to workspace.'), 'error');
                        });
                    } else {
                      // Fallback simulado corregido para evitar la pantalla en blanco
                      const remoteId = 'remote-' + Math.random().toString(36).substr(2, 9);
                      const newProj = {
                        id: remoteId,
                        name: { en: 'Remote Workspace (Simulated)', es: 'Puesto Remoto (Simulado)' },
                        emoji: '☁️',
                        cover: 'linear-gradient(135deg, #A8BEE4 0%, #D5E1F6 100%)',
                        starred: false,
                        isPublic: true,
                        isRemote: true,
                        shareToken: token,
                        items: 3,
                        updated: { en: 'Just now', es: 'Ahora mismo' }
                      };
                      setProjects(prev => [newProj, ...prev]);

                      setCanvases(prev => ({
                        ...prev,
                        [remoteId]: {
                          title: { es: 'Puesto Remoto (Simulado)', en: 'Remote Workspace (Simulated)' },
                          items: [
                            { id: '1', type: 'bigtitle', x: 200, y: 150, width: 400, height: 60, title: { es: '¡Conectado con éxito!', en: 'Connected successfully!' } },
                            { id: '2', type: 'note', x: 200, y: 250, width: 220, height: 120, content: { es: 'Este lienzo está sincronizado a través de la red (simulado).', en: 'This canvas is synchronized over the network (simulated).' }, color: '#FAF9F6' },
                            { id: '3', type: 'note', x: 450, y: 250, width: 220, height: 120, content: { es: 'Puedes agregar y editar tarjetas como de costumbre.', en: 'You can add and edit cards as usual.' }, color: '#FAF9F6' }
                          ],
                          connectors: []
                        }
                      }));

                      setJoiningModalOpen(false);
                      showToast(window.t('¡Conectado al puesto de trabajo de tu amigo con éxito!', 'Connected to your friend\'s workspace successfully!'));
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: 'var(--olive, #6A8546)',
                    color: 'white',
                    border: 'none',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {window.t('Unirse', 'Join')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Custom Dialog / Alert / Confirm UI (No síncrono, no bloqueante, integrado en la UI) */}
      {customDialog && (
        <div 
          className="doc-modal-overlay" 
          style={{ 
            zIndex: 11000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)'
          }}
        >
          <div 
            className="doc-modal" 
            style={{ 
              width: '420px', 
              background: 'var(--bg, #FAF9F6)', 
              border: '2px solid var(--line, #595459)', 
              padding: '24px', 
              borderRadius: '12px', 
              boxShadow: 'var(--pop-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span 
                className="material-symbols-rounded" 
                style={{ 
                  fontSize: '26px', 
                  color: customDialog.type === 'confirm' ? 'var(--olive, #6A8546)' : 'var(--wine, #E6544F)' 
                }}
              >
                {customDialog.type === 'confirm' ? 'help' : 'info'}
              </span>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--ink, #1A1A1A)' }}>
                {customDialog.type === 'confirm' ? window.t('Confirmación', 'Confirmation') : window.t('Notificación', 'Notification')}
              </h4>
            </div>

            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--ink, #1A1A1A)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {customDialog.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--line-soft, #E5E1DD)', paddingTop: '14px', marginTop: '4px' }}>
              {customDialog.type === 'confirm' && (
                <button
                  className="btn btn-ghost"
                  onClick={customDialog.onCancel}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1.5px solid var(--line-soft, #E5E1DD)',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    background: 'transparent',
                    color: 'var(--text-soft, #595459)'
                  }}
                >
                  {window.t('Cancelar', 'Cancel')}
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={customDialog.onAccept}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  background: 'var(--olive, #6A8546)',
                  color: 'white',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                {window.t('Aceptar', 'OK')}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.type === 'success' ? '#FFFFFF' : '#FFF3F3',
            border: toast.type === 'success' ? '2px solid var(--line, #595459)' : '2px solid var(--wine, #E6544F)',
            color: toast.type === 'success' ? 'var(--ink, #1A1A1A)' : 'var(--wine, #E6544F)',
            padding: '12px 24px',
            borderRadius: '12px',
            boxShadow: '4px 4px 0px var(--line, #595459)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: '700',
            fontSize: '14px',
            pointerEvents: 'none',
            animation: 'toastSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both'
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '20px', color: toast.type === 'success' ? 'var(--olive, #6A8546)' : 'var(--wine, #E6544F)' }}>
            {toast.type === 'success' ? 'check_circle' : 'warning'}
          </span>
          <span>{toast.message}</span>
          <style>{`
            @keyframes toastSlideIn {
              0% { transform: translate(-50%, -40px); opacity: 0; }
              100% { transform: translate(-50%, 0); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
