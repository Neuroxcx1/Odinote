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

// Colaboración en tiempo real por Firestore DESACTIVADA: la sincronización y las
// invitaciones funcionan 100% por Google Drive, así que no hay base de datos de
// Firebase que configurar ni que pueda generar cobros. Cambiar a true si algún
// día se reactiva (requiere crear la base de datos con reglas de seguridad).
const ENABLE_FIRESTORE_SYNC = false;
let firestoreDB = null;
if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  if (ENABLE_FIRESTORE_SYNC) {
    firestoreDB = firebase.firestore();
  }
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

// Marcador de build: si la consola no muestra esta versión, el navegador está
// sirviendo JS cacheado (subir ?v= en index.html invalida la caché)
window.ODINOTE_BUILD = 'corona-145';
console.log('[ODINOTE] Código cargado: ' + window.ODINOTE_BUILD);

// Global shortcuts configuration
window.shortcuts = {
  undo: { key: 'z', ctrl: true, shift: false, alt: false, label: 'Ctrl + Z' },
  redo: { key: 'y', ctrl: true, shift: false, alt: false, label: 'Ctrl + Y' },
  duplicate: { key: 'd', ctrl: true, shift: false, alt: false, label: 'Ctrl + D' },
  selectAll: { key: 'a', ctrl: true, shift: false, alt: false, label: 'Ctrl + A' },
  search: { key: '/', ctrl: false, shift: false, alt: false, label: '/' },
  // Comentar líneas dentro de un bloque de código. El Ctrl+/ de toda la vida
  // exige Shift+7 en un teclado español, así que aquí manda Ctrl+7, que se
  // pulsa de un tirón. Es configurable, y el Ctrl+/ inglés se sigue admitiendo.
  commentCode: { key: '7', ctrl: true, shift: false, alt: false, label: 'Ctrl + 7' },
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

// Lo prestado no se queda.
//
// Al entrar en la sesión de alguien, su proyecto se copia entero aquí para
// poder verlo — y hasta ahora se quedaba: en el menú para siempre y en el
// disco, con las notas y las imágenes de otra persona. Al abrir Odinote al día
// siguiente seguía ahí, muerto, sin forma de volver a entrar.
//
// Al terminar la sesión se limpia en caliente; esto es la red de seguridad
// para cuando el programa se cierra de golpe en mitad de una. Si vuelves a
// necesitarlo, pides el código otra vez: es de quien lo abrió, no tuyo.
function olvidaPrestados(state) {
  if (!state || !Array.isArray(state.projects)) return state;
  const prestados = state.projects.filter(p => p && p.invitado);
  if (!prestados.length) return state;

  const fuera = new Set();
  const canvases = state.canvases || {};
  const visita = (id) => {
    const c = canvases[id];
    if (!c || fuera.has(id)) return;
    fuera.add(id);
    (c.items || []).forEach(it => { if (it.canvasId) visita(it.canvasId); });
  };
  prestados.forEach(p => visita(p.id));

  const limpios = {};
  Object.keys(canvases).forEach(id => { if (!fuera.has(id)) limpios[id] = canvases[id]; });

  const proyectos = state.projects.filter(p => !(p && p.invitado));
  // Y si se cerró estando dentro del prestado, no se puede volver a abrir ahí.
  const vista = (state.view && fuera.has(state.view.projectId)) ? { name: 'home' } : state.view;
  return { ...state, projects: proyectos, canvases: limpios, view: vista };
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
  // Modal de actualización: { state:'available'|'uptodate'|'downloading'|'error', version, notes, assetUrl, assetName, progress }
  const [updateModal, setUpdateModal] = useStateApp(null);
  const [updateProgress, setUpdateProgress] = useStateApp(0);
  const [contextMenu, setContextMenu] = useStateApp(null);
  const [settingsOpen, setSettingsOpen] = useStateApp(false);
  const [showTouchDiag, setShowTouchDiag] = useStateApp(false);
  // Explicación del atajo señalado. Va en un elemento aparte con posición fija
  // porque la lista de atajos está dentro de un contenedor con scroll, y ahí
  // un globo colgado de la fila lo recortaba el propio contenedor: se veía el
  // cursor de ayuda pero nunca el texto.
  const [shortcutTip, setShortcutTip] = useStateApp(null);
  const showTip = (e, texto) => {
    if (!texto) return;
    const r = e.currentTarget.getBoundingClientRect();
    setShortcutTip({ texto, top: r.bottom + 8, left: r.left, width: r.width });
  };
  // Buscador global. jumpTarget lleva al lienzo el destino elegido: la cadena
  // de tableros por la que bajar y el nodo que hay que resaltar al llegar.
  const [searchOpen, setSearchOpen] = useStateApp(false);
  const [searchMode, setSearchMode] = useStateApp('goto'); // 'goto' | 'link'
  const [jumpTarget, setJumpTarget] = useStateApp(null);
  const [graphOpen, setGraphOpen] = useStateApp(false);
  const [dictWords, setDictWords] = useStateApp([]);
  const [userProfile, setUserProfile] = useStateApp(() => {
    const savedProfile = localStorage.getItem('odinote.google_profile');
    return savedProfile ? JSON.parse(savedProfile) : null;
  });
  // Si esta cuenta ha invitado a un café. Arranca con lo que se supo la última
  // vez (ver `patrocinio.js`) para que la corona salga ya pintada en el primer
  // fotograma: consultarlo desde cero en cada arranque la haría aparecer medio
  // segundo tarde, y ese parpadeo se ve mas que la corona.
  const [esPatrocinador, setEsPatrocinador] = useStateApp(() => {
    try { return !!(window.Patrocinio && window.Patrocinio.activo()); } catch (err) { return false; }
  });
  const [userModalOpen, setUserModalOpen] = useStateApp(false);
  const [loginError, setLoginError] = useStateApp(null);
  const [waitingForWebLogin, setWaitingForWebLogin] = useStateApp(false);
  const [localGuestOpen, setLocalGuestOpen] = useStateApp(false);
  const [localGuestName, setLocalGuestName] = useStateApp('');
  const [localGuestAvatar, setLocalGuestAvatar] = useStateApp('🦊');
  const [customDialog, setCustomDialog] = useStateApp(null);
  
  const [toast, setToast] = useStateApp(null);
  const [isSyncingDrive, setIsSyncingDrive] = useStateApp(false);
  const lastGoogleDriveSyncTimeRef = React.useRef(0);
  // true mientras el último cambio de canvases vino de una importación de Drive
  // (para no marcarlo como edición local y evitar guerras de re-subida)
  const driveImportRef = React.useRef(false);
  const lastSeenCanvasesRef = React.useRef(null);

  // Marcas de tiempo por proyecto para decidir la dirección de la sincronización:
  // drive_synced_at = versión de Drive que ya tenemos · local_edited_at = última edición local
  const getDriveSyncedAt = (pid) => parseInt(localStorage.getItem(`odinote.drive_synced_at_${pid}`) || '0', 10);
  const setDriveSyncedAtLS = (pid, ts) => localStorage.setItem(`odinote.drive_synced_at_${pid}`, String(ts));
  const getLocalEditedAt = (pid) => parseInt(localStorage.getItem(`odinote.local_edited_at_${pid}`) || '0', 10);
  const markLocalEditedAt = (pid) => localStorage.setItem(`odinote.local_edited_at_${pid}`, String(Date.now()));

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.playAudioTone && window.playAudioTone('click');
  };
  window.showToast = showToast;

  // ── La corona de quien ha invitado a un café ──
  //
  // Se espera a `onAuthStateChanged` en vez de consultar directamente porque
  // al arrancar la sesión de Firebase tarda un instante en restaurarse, y una
  // consulta lanzada antes de eso va sin correo y vuelve con un "no" que
  // apagaría la corona de alguien que sí ha pagado.
  useEffectApp(() => {
    if (!window.Patrocinio) return;

    if (!userProfile) {
      // Al cerrar sesión la corona se va con la cuenta, no se queda en el
      // equipo: si no, el siguiente que entrase en este ordenador la heredaría.
      setEsPatrocinador(false);
      window.Patrocinio.olvida();
      return;
    }

    if (typeof firebase === 'undefined' || !firebase.auth) return;

    let vivo = true;
    const suelta = firebase.auth().onAuthStateChanged(() => {
      window.Patrocinio.comprueba().then((si) => {
        if (!vivo) return;
        setEsPatrocinador(si);
        if (si && window.Patrocinio.esNuevo()) {
          window.Patrocinio.marcaAvisado();
          showToast(window.t(
            '👑 Gracias por el café. Tus cosméticos de patrocinador ya están activos.',
            '👑 Thanks for the coffee. Your supporter cosmetics are now active.'
          ));
        }
      });
    });

    return () => { vivo = false; suelta(); };
  }, [userProfile && userProfile.email]);

  // El cursor dorado se aplica desde la hoja de estilos colgando de este
  // atributo, para no tener que repetir la regla en cada componente.
  useEffectApp(() => {
    try { document.body.dataset.patrocinador = esPatrocinador ? '1' : '0'; } catch (err) {}
  }, [esPatrocinador]);

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
        if (window._odiEsperaLogin) { clearTimeout(window._odiEsperaLogin); window._odiEsperaLogin = null; }
        // Identificarse también ante Firebase, no solo ante Drive.
        //
        // El escritorio tiene su propio flujo de Google y terminaba con un
        // permiso para Drive y nada más: ante Firebase seguía siendo un
        // desconocido —una sesión anónima, sin correo—. Con el carnet firmado
        // que ahora pide main.js se cierra ese hueco, que es lo que permite a
        // las reglas del servidor comprobar si a esta persona la invitaron al
        // proyecto. La web ya lo tenía por entrar con Firebase directamente.
        identificaEnFirebase(profile.idToken);
        // El carnet no se guarda en el disco: caduca en una hora y no hace
        // falta para nada más.
        const { idToken, ...paraGuardar } = profile;
        setUserProfile(paraGuardar);
        localStorage.setItem('odinote.google_profile', JSON.stringify(paraGuardar));
        setWaitingForWebLogin(false);
        setUserModalOpen(false);
        showToast(window.t('¡Sesión iniciada con éxito mediante Google!', 'Successfully signed in with Google!'));
      });
      return unsubscribe;
    }
  }, []);

  // Cambiar la sesión anónima de Firebase por la de verdad, usando el carnet
  // firmado que devuelve Google. Si algo falla no se rompe nada: Drive y las
  // sesiones en vivo por código siguen igual, y lo único que se queda fuera es
  // el modo instantáneo, que necesita saber quién eres para dejarte escribir.
  const identificaEnFirebase = async (idToken) => {
    if (!idToken || typeof firebase === 'undefined' || !firebase.auth) return false;
    try {
      const credencial = firebase.auth.GoogleAuthProvider.credential(idToken);
      await firebase.auth().signInWithCredential(credencial);
      // Queda escrito en el registro: sin esto, cuando falla la corona o el
      // modo instantáneo no hay forma de saber si el problema fue aquí.
      console.log('[FIREBASE] identificado como', (firebase.auth().currentUser || {}).email || '(sin correo)');
      return true;
    } catch (err) {
      console.warn('[FIREBASE] no se pudo identificar con el carnet de Google:', err && err.message);
      return false;
    }
  };

  // Comprueba que el token de Drive siga vivo (expira ~1 hora después del login).
  // Devuelve { ok, status, reason } para distinguir token caducado (401) de
  // API de Drive deshabilitada en Google Cloud (403) — causas y remedios distintos.
  const validateDriveToken = async (accessToken) => {
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (res.ok) return { ok: true };
      let reason = '';
      try {
        const data = await res.json();
        reason = (data.error && data.error.message) || '';
      } catch (e) {}
      return { ok: false, status: res.status, reason };
    } catch (err) {
      return { ok: false, status: 0, reason: 'network' };
    }
  };

  // Aviso (máx. 1 vez por minuto) de que Drive está bloqueado por configuración,
  // no por el token: reiniciar sesión aquí NO arregla nada, así que no la tocamos
  const notifyDriveBlocked = (check) => {
    const now = Date.now();
    if (now - (window._odiLastDriveBlockToast || 0) < 60000) return;
    window._odiLastDriveBlockToast = now;
    const reason = (check && check.reason) || '';
    const apiDisabled = reason.includes('disabled') || reason.includes('has not been used');
    if (apiDisabled) {
      showToast(window.t(
        'La API de Google Drive está desactivada en tu proyecto de Google Cloud (odinote-firebase). Actívala en la consola de Google Cloud y vuelve a intentarlo.',
        'The Google Drive API is disabled in your Google Cloud project (odinote-firebase). Enable it in the Google Cloud console and try again.'
      ), 'error');
    } else if (check && check.status === 0) {
      showToast(window.t('Sin conexión con Google Drive. Se trabajará offline.', 'No connection to Google Drive. Working offline.'), 'error');
    } else {
      showToast(window.t(
        `Google Drive rechazó la conexión (error ${check ? check.status : '?'}). Revisa la configuración de tu proyecto de Google Cloud.`,
        `Google Drive refused the connection (error ${check ? check.status : '?'}). Check your Google Cloud project configuration.`
      ), 'error');
    }
  };

  // "Este proyecto está publicado en Drive" y "puedo hablar con Drive ahora
  // mismo" son dos cosas distintas, y antes se guardaban en la misma variable:
  // cuando el token caducaba (le pasa a la hora) se ponía isPublic:false a todo,
  // y eso se guardaba en disco. Al renovar la sesión no se recuperaba, porque la
  // importación se salta los proyectos sin cambios remotos — así que un proyecto
  // publicado hace semanas se quedaba marcado "Offline" para siempre aunque
  // siguiera perfectamente sincronizado en Drive.
  //
  // Ahora isPublic solo lo cambia el usuario al publicar o retirar un proyecto,
  // y que Drive esté alcanzable es este estado aparte, que no se persiste.
  const [driveReachable, setDriveReachable] = useStateApp(true);

  // Flujo de autenticación con Google, compartido entre el primer login y la
  // renovación del token de Drive (que caduca ~1 hora). En la renovación no se
  // fuerza el selector de cuenta, así el popup se resuelve casi solo.
  const startGoogleAuthFlow = (isRenewal) => {
    setLoginError(null);
    if (window.electronAPI && window.electronAPI.startGoogleLogin) {
      setWaitingForWebLogin(true);
      // Si Google falla en SU página (sin volver aquí), nadie nos avisa nunca y
      // la ventana se quedaba en "esperando" hasta que la cerraras. A los dos
      // minutos se corta y se dice qué mirar, en vez de dejarte colgado.
      if (window._odiEsperaLogin) clearTimeout(window._odiEsperaLogin);
      window._odiEsperaLogin = setTimeout(() => {
        setWaitingForWebLogin(false);
        setLoginError(window.t(
          'Google no respondió. Si en el navegador viste "Se ha producido un error", el problema está en la configuración del proyecto de Google Cloud, no en Odinote: revisa la pantalla de consentimiento de OAuth. Prueba también en una ventana de incógnito.',
          'Google never answered. If the browser showed "Something went wrong", the problem is in the Google Cloud project setup, not in Odinote: check the OAuth consent screen. Try an incognito window too.'
        ));
      }, 120000);
      window.electronAPI.startGoogleLogin()
        .catch((err) => {
          console.error('IPC startGoogleLogin error:', err);
          setWaitingForWebLogin(false);
          setLoginError(window.t(
            'No se pudo iniciar el flujo de Google. Asegúrate de estar en la aplicación de escritorio.',
            'Could not start Google flow. Please make sure you are in the desktop application.'
          ));
        });
    } else {
      const provider = new firebase.auth.GoogleAuthProvider();
      if (!isRenewal) provider.setCustomParameters({ prompt: 'select_account' });
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
          setUserModalOpen(false);
          showToast(isRenewal
            ? window.t('Acceso a Google Drive renovado.', 'Google Drive access renewed.')
            : window.t('¡Sesión iniciada con éxito mediante Google!', 'Successfully signed in with Google!'));
        })
        .catch((err) => {
          console.error('Auth web error:', err);
          // Firebase habla en inglés y en jerga. El caso que más se ve —abrir
          // Odinote por la dirección de red de otro equipo, para probar desde
          // el celular— soltaba un párrafo sobre "OAuth operations" y
          // "authorized domains" que asusta y no dice lo único que importa:
          // que las sesiones en vivo NO dependen de esto.
          const traducciones = {
            'auth/unauthorized-domain': window.t(
              'Iniciar sesión con Google no funciona desde esta dirección (' + location.hostname + '), porque Google solo lo permite desde los dominios oficiales. Las sesiones en vivo NO usan esto: puedes unirte con un código sin cuenta. Google solo hace falta para Google Drive.',
              'Signing in with Google does not work from this address (' + location.hostname + '), because Google only allows it from the official domains. Live sessions do NOT use it: you can join with a code and no account. Google is only needed for Google Drive.'
            ),
            'auth/popup-blocked': window.t(
              'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio y vuelve a intentarlo.',
              'The browser blocked the Google window. Allow pop-ups for this site and try again.'
            ),
            'auth/popup-closed-by-user': window.t(
              'Se cerró la ventana de Google antes de terminar.',
              'The Google window was closed before finishing.'
            ),
            'auth/network-request-failed': window.t(
              'Sin conexión con Google. Revisa tu internet.',
              'No connection to Google. Check your internet.'
            ),
          };
          setLoginError(traducciones[err.code] || err.message);
        });
    }
  };

  // ── Renovar el acceso a Drive sin molestar ──
  //
  // En el escritorio hay guardado en el propio equipo un token de refresco, así
  // que cuando el permiso de una hora caduca se pide otro y no se entera nadie.
  // Solo si eso falla —porque el usuario revocó el acceso, o porque nunca llegó
  // a guardarse— se le pide que vuelva a conectarse.
  const renuevaAccesoDrive = async () => {
    const api = window.electronAPI;
    if (!api || !api.googleRefreshAccess) return null;
    try {
      const r = await api.googleRefreshAccess();
      if (!r || !r.ok || !r.accessToken) return null;
      // El refresco trae tambien un carnet firmado. Se aprovecha: el
      // escritorio solo se identificaba ante Firebase al iniciar sesion, y
      // ese carnet caduca en una hora y no se guarda en disco.
      if (r.idToken) identificaEnFirebase(r.idToken);
      setUserProfile(prev => {
        const next = { ...(prev || {}), accessToken: r.accessToken };
        localStorage.setItem('odinote.google_profile', JSON.stringify(next));
        return next;
      });
      return r.accessToken;
    } catch (e) {
      return null;
    }
  };

  // ── Recuperar la sesión de Firebase al arrancar (solo escritorio) ──
  //
  // Este era el agujero: el perfil de Google se guarda en el disco, así que
  // al reabrir la aplicación parecía que seguías dentro. Ante Firebase no.
  // Allí no había nadie —o peor, una sesión anónima de haberte unido alguna
  // vez a una sala—, y todo lo que necesita saber quién eres se caía sin
  // decir por qué: la corona, la reclamación, el modo instantáneo.
  //
  // Se espera un poco antes de mirar porque Firebase restaura su propia
  // sesión al arrancar y tarda un instante; preguntar antes daría un falso
  // negativo y pediría un carnet que no hacía falta.
  useEffectApp(() => {
    if (!userProfile) return;
    const api = window.electronAPI;
    if (!api || !api.googleRefreshAccess) return;

    let vivo = true;
    const espera = setTimeout(async () => {
      try {
        if (typeof firebase === 'undefined' || !firebase.auth) return;
        const actual = firebase.auth().currentUser;
        if (actual && !actual.isAnonymous) return;   // ya identificado
        console.log('[FIREBASE] al arrancar no hay sesión de Google; pidiendo carnet nuevo…');
        const r = await api.googleRefreshAccess();
        if (!vivo) return;
        if (!r || !r.ok) {
          console.warn('[FIREBASE] el refresco falló:', (r && r.reason) || 'sin respuesta');
          return;
        }
        if (!r.idToken) {
          // Google solo devuelve carnet en el refresco si el permiso guardado
          // se pidió con `openid`. Uno anterior a ese cambio no lo trae.
          console.warn('[FIREBASE] el refresco no trajo carnet: hay que volver a iniciar sesión una vez.');
          return;
        }
        await identificaEnFirebase(r.idToken);
      } catch (e) {}
    }, 2500);

    return () => { vivo = false; clearTimeout(espera); };
  }, [userProfile && userProfile.email]);

  // El token murió: primero se intenta renovar solo; si no se puede, se limpia
  // del perfil sin interrumpir con ventanas. El botón ↻ muestra un punto rojo y
  // un solo clic vuelve a conectar.
  const invalidateDriveSession = async () => {
    const nuevo = await renuevaAccesoDrive();
    if (nuevo) {
      setDriveReachable(true);
      return;
    }
    setUserProfile(prev => {
      if (!prev || !prev.accessToken) return prev;
      const next = { ...prev, accessToken: null };
      localStorage.setItem('odinote.google_profile', JSON.stringify(next));
      return next;
    });
    showToast(window.t('El acceso a Drive venció: presiona el botón ↻ para renovarlo con un clic.', 'Drive access expired: press the ↻ button to renew it with one click.'), 'error');
  };

  // Renovar ANTES de que caduque, no después. El permiso dura una hora; a los 50
  // minutos se pide otro. Así el usuario no llega a ver ni un fallo: sin esto,
  // la primera petición de cada hora fallaba y había que reintentarla.
  useEffectApp(() => {
    if (!userProfile || !userProfile.accessToken) return;
    if (!window.electronAPI || !window.electronAPI.googleRefreshAccess) return;
    const t = setInterval(() => { renuevaAccesoDrive(); }, 50 * 60 * 1000);
    return () => clearInterval(t);
  }, [userProfile && userProfile.accessToken]);

  // Al arrancar, si hay un token de refresco guardado se recupera la sesión sola
  // aunque el permiso guardado en el navegador esté muerto.
  useEffectApp(() => {
    const api = window.electronAPI;
    if (!api || !api.googleHasRefresh) return;
    const perfil = userProfile;
    if (!perfil || perfil.accessToken) return;   // ya hay permiso, o no hay sesión
    (async () => {
      const r = await api.googleHasRefresh();
      if (r && r.ok) await renuevaAccesoDrive();
    })();
    // Solo al arrancar y cuando el perfil pasa a quedarse sin permiso
  }, [userProfile && userProfile.email, userProfile && userProfile.accessToken]);

  // Al arrancar o tras iniciar sesión: validar token e importar los proyectos guardados en Drive.
  // Si Drive no funciona (token muerto, API deshabilitada o sin red), los puestos de trabajo
  // pasan a offline: mostrar "online" sin sincronización real sería mentir.
  useEffectApp(() => {
    if (!userProfile || !userProfile.accessToken) return;
    let cancelled = false;
    (async () => {
      const check = await validateDriveToken(userProfile.accessToken);
      if (cancelled) return;
      if (check.ok) {
        window._odiDriveBlocked = false;
        setDriveReachable(true);
        syncProjectsFromGoogleDrive(userProfile.accessToken);
        return;
      }
      if (check.status === 401) {
        invalidateDriveSession();
      } else {
        window._odiDriveBlocked = true;
        notifyDriveBlocked(check);
      }
      // Drive no responde: se marca la CONEXIÓN como caída, no los proyectos.
      // Siguen publicados; simplemente ahora mismo no se puede sincronizar.
      setDriveReachable(false);
    })();
    return () => { cancelled = true; };
  }, [userProfile && userProfile.accessToken]);

  // Re-importar desde Drive cuando la ventana recupera el foco (máx. 1 vez por minuto),
  // para que lo publicado desde el otro dispositivo (web <-> .exe) aparezca solo
  useEffectApp(() => {
    const onFocus = () => {
      if (!userProfile || !userProfile.accessToken) return;
      const now = Date.now();
      if (now - (window._odiLastDriveImport || 0) < 60000) return;
      window._odiLastDriveImport = now;
      syncProjectsFromGoogleDrive(userProfile.accessToken);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [userProfile]);

  // Sin sesión iniciada no puede haber nada online: todos los puestos de trabajo
  // pasan a offline y se quedan así hasta que el usuario los vuelva a publicar
  useEffectApp(() => {
    if (loading) return;
    // Sin sesión no se puede sincronizar, pero los proyectos publicados siguen
    // publicados: al volver a entrar deben reaparecer como tales.
    if (!userProfile) setDriveReachable(false);
  }, [userProfile, loading]);

  const [sharingModalOpen, setSharingModalOpen] = useStateApp(false);
  const [activeSharingProjectId, setActiveSharingProjectId] = useStateApp(null);
  const [joiningModalOpen, setJoiningModalOpen] = useStateApp(false);
  const [inviteEmail, setInviteEmail] = useStateApp('');

  // ── Sesión en vivo ──
  // El mando lo tiene Canvas (window.__odiVivo), porque el lienzo es quien
  // sabe qué ha cambiado. Aquí solo está la ventana con el código.
  const [salaCodigo, setSalaCodigo] = useStateApp(null);
  const [salaOcupada, setSalaOcupada] = useStateApp(false);
  const [salaError, setSalaError] = useStateApp(null);
  // Quién hay dentro, y si esta máquina es la que abrió la sala (solo el
  // anfitrión reparte papeles y puede echar a alguien).
  const [salaGente, setSalaGente] = useStateApp([]);
  const [salaAnfitrion, setSalaAnfitrion] = useStateApp(false);
  // Papel con el que entrará el próximo. Se elige ANTES de dar el código:
  // es el único momento en que uno sabe a quién se lo va a dar.
  const [salaRolNuevos, setSalaRolNuevos] = useStateApp('editor');
  // En qué punto va el intento de entrar. Sin esto la única señal de vida
  // durante la espera era un botón gris, que en un móvil no se distingue de
  // una aplicación colgada.
  const [salaPaso, setSalaPaso] = useStateApp(null);

  // La lista de la sala vive en el lienzo. Mientras la ventana está abierta se
  // pregunta una vez por segundo: es lo que hace que al entrar alguien aparezca
  // solo, y que al cambiarle el papel se vea reflejado.
  useEffectApp(() => {
    if (!sharingModalOpen || !salaCodigo) return;
    const lee = () => {
      const v = window.__odiVivo;
      if (!v || !v.activa()) { setSalaGente([]); return; }
      setSalaGente(v.participantes() || []);
      setSalaAnfitrion(!!v.soyAnfitrion());
    };
    lee();
    const t = setInterval(lee, 1000);
    return () => clearInterval(t);
  }, [sharingModalOpen, salaCodigo]);

  // Copiar texto, también donde no hay portapapeles moderno.
  //
  // `navigator.clipboard` no existe si la página no viene por https, y el
  // servidor de pruebas del móvil va por http: ahí el botón de copiar el
  // código reventaba sin decir nada. El truco viejo del textarea invisible
  // funciona en todas partes y es exactamente para esto.
  const copiaAlPortapapeles = (texto) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).catch(() => {});
      return;
    }
    try {
      const caja = document.createElement('textarea');
      caja.value = texto;
      caja.setAttribute('readonly', '');
      caja.style.position = 'fixed';
      caja.style.opacity = '0';
      document.body.appendChild(caja);
      caja.select();
      document.execCommand('copy');
      document.body.removeChild(caja);
    } catch (e) {}
  };

  // Si la sesión se acaba por su cuenta, esta ventana tiene que enterarse.
  //
  // Pasa de dos formas: al anfitrión le da a "terminar", o a uno le expulsan.
  // En los dos casos quien corta es el lienzo, y sin esto el botón de compartir
  // seguía enseñando un código muerto y ofreciendo salir de una sala en la que
  // ya no había nadie.
  useEffectApp(() => {
    if (!salaCodigo) return;
    const t = setInterval(() => {
      const v = window.__odiVivo;
      if (v && v.activa()) return;
      setSalaCodigo(null);
      setSalaGente([]);
      setSalaAnfitrion(false);
    }, 2000);
    return () => clearInterval(t);
  }, [salaCodigo]);

  // El anfitrión cambia el papel de alguien que ya está dentro.
  const cambiaRolEnSala = (uid, rol) => {
    if (!window.__odiVivo || !window.__odiVivo.ponRol(uid, rol)) return;
    setSalaGente(window.__odiVivo.participantes() || []);
    window.playAudioTone && window.playAudioTone('click');
  };

  const expulsaDeSala = (persona) => {
    window.customConfirm(window.t(
      `¿Sacar a ${persona.nombre} de la sesión? Dejará de ver el lienzo al instante. Podrá volver a entrar solo si le das un código nuevo.`,
      `Remove ${persona.nombre} from the session? They stop seeing the canvas at once, and can only come back if you give them a new code.`
    )).then((acepta) => {
      if (!acepta || !window.__odiVivo) return;
      Promise.resolve(window.__odiVivo.expulsa(persona.uid)).then(() => {
        setSalaGente(window.__odiVivo.participantes() || []);
        showToast(window.t(`${persona.nombre} ya no está en la sesión.`, `${persona.nombre} is no longer in the session.`));
      });
    });
  };
  // Copiar el código no merece una ventana que haya que cerrar: el propio
  // botón dice que lo hizo y se le olvida solo.
  const [codigoCopiado, setCodigoCopiado] = useStateApp(false);
  const codigoEntradaRef = React.useRef(null);

  const abreSalaEnVivo = async () => {
    if (!window.__odiVivo) {
      showToast(window.t('Abre un proyecto antes de empezar una sesión.', 'Open a project before starting a session.'), 'error');
      return;
    }
    // Compartir exige Drive, sin excepciones: si el proyecto no está subido,
    // quien entre vería la estructura y ni una sola imagen. La ventana ya lo
    // impide, pero el candado tiene que estar también aquí.
    const suyo = projects.find(p => p.id === activeSharingProjectId);
    if (!suyo || !suyo.isPublic || !userProfile || !userProfile.accessToken) {
      setSalaError(window.t(
        'Para compartir este escritorio antes hay que ponerlo online en tu Google Drive: es lo que hace que la otra persona vea las imágenes y no recuadros vacíos.',
        'To share this workspace you must first put it online in your Google Drive: that is what lets the other person see the images instead of empty frames.'
      ));
      return;
    }
    setSalaOcupada(true);
    setSalaError(null);
    try {
      const r = await window.__odiVivo.conecta({
        modo: 'abrir',
        nombre: (userProfile && userProfile.name) || 'Anfitrión',
        rol: salaRolNuevos,
      });
      setSalaCodigo(r.codigo);
      setSalaAnfitrion(true);
      setSalaGente(window.__odiVivo.participantes() || []);
      window.odiTrack && window.odiTrack('sala_abierta', {});
    } catch (err) {
      console.error('[SALA] no se pudo abrir', err);
      const porQue = {
        'sin-soporte': window.t('Este navegador no admite las sesiones en vivo.', 'This browser does not support live sessions.'),
        'bloqueador': window.t(
          'Tu navegador está bloqueando la conexión con Firebase, y es por ahí por donde los dos equipos se encuentran. Suele ser el bloqueador de anuncios (Opera y Brave lo traen de serie): desactívalo para este sitio y vuelve a intentarlo.',
          'Your browser is blocking the connection to Firebase, which is how the two machines find each other. It is usually the ad blocker (Opera and Brave ship one): turn it off for this site and try again.'
        ),
      };
      setSalaError(porQue[err.message] || window.t('No se pudo abrir la sala: ' + err.message, 'Could not open the room: ' + err.message));
      window.odiTrack && window.odiTrack('sala_abierta_fallo', { motivo: String(err.message).slice(0, 60) });
    } finally {
      setSalaOcupada(false);
    }
  };

  // Unirse desde el menú principal, donde todavía no hay ningún lienzo abierto.
  //
  // El mando de la sesión vive dentro del lienzo, así que antes hay que abrir
  // uno. Pedirle a la persona que "abra un proyecto primero" para poder entrar
  // al de otro no tiene ningún sentido: se abre solo. Se prefiere el último
  // que estuviera usando, y si no tiene ninguno se le crea uno para la ocasión.
  const abreLienzoParaUnirse = async () => {
    if (window.__odiVivo) return true;
    const candidato = projects.find(p => !p.deleted);
    if (candidato) {
      openProject(candidato.id);
    } else {
      const nuevo = {
        id: `proj-${Date.now()}`,
        name: { es: 'Sesión compartida', en: 'Shared session' },
        emoji: '🤝',
        cover: 'linear-gradient(135deg, #A8BEE4 0%, #D5E1F6 100%)',
        starred: false,
      };
      createProject(nuevo);
      openProject(nuevo.id);
    }
    // Esperar a que el lienzo se monte de verdad (los .jsx los traduce Babel
    // en el navegador y tarda un poco en un equipo lento).
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 150));
      if (window.__odiVivo) return true;
    }
    return false;
  };

  const entraSalaEnVivo = async (codigo) => {
    if (!window.__odiVivo) {
      setSalaOcupada(true);
      const listo = await abreLienzoParaUnirse();
      setSalaOcupada(false);
      if (!listo) {
        showToast(window.t('No se pudo abrir un lienzo para la sesión.', 'Could not open a canvas for the session.'), 'error');
        return;
      }
    }
    setSalaOcupada(true);
    setSalaError(null);
    setSalaPaso('llamando');
    try {
      await window.__odiVivo.conecta({
        modo: 'entrar',
        codigo,
        nombre: (userProfile && userProfile.name) || 'Invitado',
        onProgreso: (paso) => setSalaPaso(paso),
      });
      setSalaCodigo(String(codigo).trim().toUpperCase());
      setSalaAnfitrion(false);
      setJoiningModalOpen(false);
      showToast(window.t('Conectado. Vas a ver el proyecto del anfitrión.', 'Connected. You will see the host\'s project.'));
      window.odiTrack && window.odiTrack('sala_unido', {});
    } catch (err) {
      console.error('[SALA] no se pudo entrar', err);
      const motivos = {
        'sala-no-existe': window.t('Ese código no corresponde a ninguna sesión abierta.', 'That code does not match any open session.'),
        'es-tu-propia-sala': window.t('Ese es tu propio código: dáselo a la otra persona.', 'That is your own code: give it to the other person.'),
        'sin-soporte': window.t('Este navegador no admite las sesiones en vivo.', 'This browser does not support live sessions.'),
        // El bloqueador de anuncios corta firestore.googleapis.com por venir de
        // un dominio de Google, y sin ese paso los dos equipos no pueden ni
        // decirse dónde están. Es la causa más común y la más difícil de
        // adivinar por tu cuenta.
        'bloqueador': window.t(
          'Tu navegador está bloqueando la conexión con Firebase, y es por ahí por donde los dos equipos se encuentran. Suele ser el bloqueador de anuncios (Opera y Brave lo traen de serie): desactívalo para este sitio y vuelve a intentarlo.',
          'Your browser is blocking the connection to Firebase, which is how the two machines find each other. It is usually the ad blocker (Opera and Brave ship one): turn it off for this site and try again.'
        ),
        // Los dos fallos de abajo eran antes el MISMO mensaje, y por eso no
        // servía para nada: uno es "no me ha oído" y el otro "me ha oído pero
        // no nos vemos". Se arreglan de formas distintas.
        'sin-respuesta': window.t(
          'El anfitrión no contestó. Comprueba con él que la ventana de compartir sigue abierta con ESE código: al terminar la sesión y empezar otra, el código cambia.',
          'The host did not answer. Check with them that the share window is still open with THAT code: ending a session and starting another changes the code.'
        ),
        'no-se-pudo-conectar': window.t(
          'El anfitrión sí contestó, pero los dos equipos no consiguieron verse. Suele ser la red: probad los dos en el mismo wifi, y si estáis en uno de invitados (los de hoteles y oficinas aíslan los aparatos entre sí), en otro.',
          'The host did answer, but the two machines could not reach each other. It is usually the network: try both on the same wi-fi, and if you are on a guest network (hotels and offices isolate devices from each other), on a different one.'
        ),
      };
      setSalaError(motivos[err.message] || window.t('No se pudo conectar: ' + err.message, 'Could not connect: ' + err.message));
      window.odiTrack && window.odiTrack('sala_unido_fallo', { motivo: String(err.message).slice(0, 60) });
    } finally {
      setSalaOcupada(false);
      setSalaPaso(null);
    }
  };

  const cierraSalaEnVivo = async () => {
    if (window.__odiVivo) await window.__odiVivo.desconecta();
    setSalaCodigo(null);
    setSalaError(null);
    setSalaGente([]);
    setSalaAnfitrion(false);
  };
  const [inviteBusy, setInviteBusy] = useStateApp(false);

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
      commentCode: { key: '7', ctrl: true, shift: false, alt: false, label: 'Ctrl + 7' },
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
  // Modo instantáneo. `acordado` es la última foto que quedó en común con el
  // servidor, la haya mandado yo o la haya recibido: comparando contra ella se
  // sabe si hay algo nuevo que subir, y un cambio que llega del otro lado no
  // rebota de vuelta hacia él para siempre.
  const acordadoNubeRef = React.useRef(null);
  const ultimaSubidaNubeRef = React.useRef(0);

  const CURRENT_VERSION = '1.0.7'; // debe coincidir con package.json

  // Compara versiones semánticas "a.b.c": devuelve true si `latest` > `current`
  const isNewerVersion = (latest, current) => {
    const lp = latest.split('.').map(Number);
    const cp = current.split('.').map(Number);
    for (let i = 0; i < Math.max(lp.length, cp.length); i++) {
      const l = lp[i] || 0, c = cp[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  };

  const checkUpdates = async (manual = false) => {
    if (checkingUpdates) return;
    if (manual) setCheckingUpdates(true);
    try {
      const res = await fetch('https://api.github.com/repos/Neuroxcx1/Odinote/releases');
      if (!res.ok) {
        if (manual) setUpdateModal({ state: 'error' });
        return;
      }
      const data = await res.json();
      const latestRelease = Array.isArray(data) ? data.find(r => !r.draft && !r.prerelease) || data[0] : null;
      const latestVersion = latestRelease && latestRelease.tag_name;
      if (!latestVersion) {
        if (manual) setUpdateModal({ state: 'uptodate', version: CURRENT_VERSION });
        return;
      }
      const cleanLatest = latestVersion.replace(/^v/, '');

      if (isNewerVersion(cleanLatest, CURRENT_VERSION)) {
        // Buscar el instalador .exe entre los archivos del release para poder
        // auto-descargarlo; si no hay, se ofrecerá abrir la página del release.
        const asset = (latestRelease.assets || []).find(a => /\.exe$/i.test(a.name));
        setUpdateAvailable(true);
        setUpdateModal({
          state: 'available',
          version: cleanLatest,
          notes: (latestRelease.body || '').slice(0, 600),
          assetUrl: asset ? asset.browser_download_url : null,
          assetName: asset ? asset.name : null,
        });
      } else {
        setUpdateAvailable(false);
        if (manual) setUpdateModal({ state: 'uptodate', version: CURRENT_VERSION });
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
      if (manual) setUpdateModal({ state: 'error' });
    } finally {
      if (manual) setCheckingUpdates(false);
    }
  };

  // Comprobar al arrancar (auto: si hay versión nueva, abre el modal directamente)
  useEffectApp(() => {
    if (window.electronAPI) {
      checkUpdates(false);
    }
  }, []);

  // Descarga el instalador y lo ejecuta (auto-actualización). Si no hay instalador
  // en el release, abre la página de descargas como respaldo.
  const runAutoUpdate = () => {
    if (!updateModal) return;
    if (!updateModal.assetUrl || !window.electronAPI || !window.electronAPI.downloadAndRunUpdate) {
      window.open('https://github.com/Neuroxcx1/Odinote/releases/latest', '_blank');
      return;
    }
    setUpdateProgress(0);
    setUpdateModal(m => ({ ...m, state: 'downloading' }));
    window.electronAPI.downloadAndRunUpdate(updateModal.assetUrl, updateModal.assetName, (pct) => setUpdateProgress(pct))
      .then(result => {
        if (!result || !result.ok) {
          setUpdateModal(m => ({ ...m, state: 'error' }));
        }
        // Si ok, main.js relanza el instalador y cierra la app
      });
  };

  const handleUpdateClick = () => {
    if (updateModal) return; // ya abierto
    if (updateAvailable) {
      checkUpdates(true); // reabre el modal con los datos frescos del release
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
        // La selección hay que guardarla AHORA: al abrirse el menú el foco se
        // va del editor y el rango se pierde, y sin él no se podría envolver el
        // texto elegido en un enlace.
        try {
          const sel = window.getSelection();
          savedSelectionRef.current = (sel && sel.rangeCount && !sel.isCollapsed)
            ? { range: sel.getRangeAt(0).cloneRange(), editor: sel.anchorNode && sel.anchorNode.parentElement }
            : null;
        } catch (e) { savedSelectionRef.current = null; }
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
            const migrated = olvidaPrestados(migrateTemplates(vaultState));
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
              const migrated = olvidaPrestados(migrateTemplates(dbState));
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
            const migrated = olvidaPrestados(migrateTemplates(dbState));
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
                const migrated = olvidaPrestados(migrateTemplates(localState));
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
    // Persistir el tema para que el splash del próximo arranque combine sin destello
    try { localStorage.setItem('odinote.theme', theme); } catch (e) {}
    // Y para que el fondo de la ventana nativa de Electron también combine
    if (window.electronAPI && window.electronAPI.setWindowTheme) {
      window.electronAPI.setWindowTheme(theme);
    }
  }, [theme, lang]);

  // Quitar la pantalla de carga una vez que la app montó y renderizó
  useEffectApp(() => {
    window.__hideSplash && window.__hideSplash();
  }, []);

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

  // Nombre legible del proyecto: en el estado es un objeto { es, en }
  const projectNameString = (name) => {
    if (!name) return 'Proyecto';
    if (typeof name === 'string') return name;
    return name.es || name.en || Object.values(name)[0] || 'Proyecto';
  };

  // Recolecta solo los canvases del proyecto (raíz + boards anidados),
  // para no subir a Drive los datos de TODOS los demás proyectos
  const collectProjectCanvases = window.OdiDrive.collectProjectCanvases;

  // Sube el estado del proyecto a Drive. Devuelve el id de la carpeta del proyecto o null si falló.
  const uploadToGoogleDriveReal = async (project, canvasesData, accessToken) => {
    if (!accessToken || !project) return null;
    const projectId = project.id;
    const projectName = projectNameString(project.name);
    const safeName = projectName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    setIsSyncingDrive(true);
    try {
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      const driveGet = async (url) => {
        const res = await fetch(url, { headers });
        if (res.status === 401) { invalidateDriveSession(); return null; }
        if (res.status === 403) {
          let reason = '';
          try {
            const data = await res.clone().json();
            reason = (data.error && data.error.message) || '';
          } catch (e) {}
          notifyDriveBlocked({ status: 403, reason });
          return null;
        }
        return res;
      };

      // 1. Obtener o crear la carpeta "Odinote"
      const searchRootUrl = `https://www.googleapis.com/drive/v3/files?q=name='Odinote' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`;
      const searchRootRes = await driveGet(searchRootUrl);
      if (!searchRootRes || !searchRootRes.ok) return null;
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
        if (!createRootRes.ok) return null;
        const createRootData = await createRootRes.json();
        rootFolderId = createRootData.id;
      }

      if (!rootFolderId) return null;

      // 2. Obtener o crear la carpeta del proyecto dentro de "Odinote".
      // Primero probamos el id guardado (sobrevive a renombres del proyecto).
      let projFolderId = '';
      const storedFolderId = localStorage.getItem(`odinote.gdrive_folder_${projectId}`);
      if (storedFolderId) {
        const checkRes = await driveGet(`https://www.googleapis.com/drive/v3/files/${storedFolderId}?fields=id,trashed`);
        if (checkRes && checkRes.ok) {
          const checkData = await checkRes.json();
          if (!checkData.trashed) projFolderId = checkData.id;
        }
      }

      if (!projFolderId) {
        const searchProjFolderUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(safeName)}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`;
        const searchProjFolderRes = await driveGet(searchProjFolderUrl);
        if (!searchProjFolderRes || !searchProjFolderRes.ok) return null;
        const searchProjFolderData = await searchProjFolderRes.json();

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
          if (!createProjFolderRes.ok) return null;
          const createProjFolderData = await createProjFolderRes.json();
          projFolderId = createProjFolderData.id;
        }
      }

      if (!projFolderId) return null;

      // Guardar el ID de la carpeta del proyecto en localStorage para las subidas de imagenes
      localStorage.setItem(`odinote.gdrive_folder_${projectId}`, projFolderId);

      // 3. Buscar si ya existe "canvas_state.json" en esa carpeta
      const searchFileUrl = `https://www.googleapis.com/drive/v3/files?q=name='canvas_state.json' and '${projFolderId}' in parents and trashed=false&fields=files(id)`;
      const fileSearchRes = await driveGet(searchFileUrl);
      if (!fileSearchRes || !fileSearchRes.ok) return null;
      const fileSearchData = await fileSearchRes.json();
      let fileId = '';

      const syncedAtISO = new Date().toISOString();
      const projectDataContent = JSON.stringify({
        projectId,
        name: project.name,
        emoji: project.emoji || '🗒️',
        cover: project.cover || '',
        isPublic: !!project.isPublic,
        shareToken: project.shareToken || null,
        collaborators: project.collaborators || [],
        canvases: collectProjectCanvases(canvasesData, projectId),
        syncedAt: syncedAtISO
      });

      if (fileSearchData.files && fileSearchData.files.length > 0) {
        fileId = fileSearchData.files[0].id;
        // Actualizar canvas_state.json
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
        const updateRes = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: projectDataContent
        });
        if (!updateRes.ok) return null;
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
        const createRes = await fetch(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        });
        if (!createRes.ok) return null;
      }
      // Registrar qué versión quedó en Drive: es la referencia para saber si hay
      // cambios locales pendientes o si lo remoto trae algo más nuevo
      setDriveSyncedAtLS(projectId, Date.parse(syncedAtISO));
      return projFolderId;
    } catch (err) {
      console.error('Error synchronizing project file to Google Drive:', err);
      return null;
    } finally {
      setTimeout(() => setIsSyncingDrive(false), 800);
    }
  };

  // (La subida de medios vive ahora en window.OdiDrive.syncProjectMedia — src/drive.js —
  // con subida reanudable sin límite de tamaño y cubierta por tests.)

  // Aplica al estado las URLs de Drive que reemplazan a los medios locales.
  // Devuelve true si hubo algo que aplicar. Usado por el autosave y el botón ↻.
  const applyMediaReplacements = (replaced) => {
    if (!replaced || Object.keys(replaced).length === 0) return false;
    setCanvases(prev => {
      const next = { ...prev };
      Object.keys(replaced).forEach(cid => {
        const canv = next[cid];
        if (!canv) return;
        next[cid] = {
          ...canv,
          items: (canv.items || []).map(it => {
            let updated = it;
            if (replaced[cid][it.id]) updated = { ...updated, src: replaced[cid][it.id] };
            if (updated.children && updated.children.some(ch => replaced[cid][`${it.id}::${ch.id}`])) {
              updated = {
                ...updated,
                children: updated.children.map(ch => replaced[cid][`${it.id}::${ch.id}`] ? { ...ch, src: replaced[cid][`${it.id}::${ch.id}`] } : ch)
              };
            }
            return updated;
          })
        };
      });
      return next;
    });
    // El próximo autosave debe subir el JSON con las URLs nuevas sin esperar el throttle
    lastGoogleDriveSyncTimeRef.current = 0;
    return true;
  };

  const syncProjectsFromGoogleDrive = async (accessToken) => {
    if (!accessToken) return;
    try {
      const headers = { 'Authorization': `Bearer ${accessToken}` };

      // 1. Buscar TODOS los canvas_state.json accesibles con UNA sola búsqueda.
      // Esto cubre tanto los proyectos de la carpeta Odinote propia como los
      // proyectos que otros usuarios COMPARTIERON contigo: las carpetas
      // compartidas no viven dentro de tu carpeta Odinote, así que la búsqueda
      // anterior (raíz → subcarpetas) jamás las encontraba y las invitaciones
      // no servían de nada.
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='canvas_state.json' and trashed=false&fields=files(id,parents)&pageSize=100`;
      const searchRes = await fetch(searchUrl, { headers });
      if (searchRes.status === 401) { invalidateDriveSession(); return; }
      if (!searchRes.ok) return;
      const searchData = await searchRes.json();
      if (!searchData.files || searchData.files.length === 0) return;

      let hasImportedAny = false;
      const importedProjects = [];
      const importedCanvases = {};
      const seenProjects = new Set();

      for (const file of searchData.files) {
        const folderId = (file.parents && file.parents[0]) || null;

        // 2. Descargar "canvas_state.json"
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        const downloadRes = await fetch(downloadUrl, { headers });
        if (!downloadRes.ok) continue;
        const projJSON = await downloadRes.json();

        if (projJSON && projJSON.projectId) {
          const pid = projJSON.projectId;
          if (seenProjects.has(pid)) continue;
          seenProjects.add(pid);
          const remoteTs = Date.parse(projJSON.syncedAt || '') || 0;
          const lastSynced = getDriveSyncedAt(pid);
          const localEdited = getLocalEditedAt(pid);

          if (folderId) localStorage.setItem(`odinote.gdrive_folder_${pid}`, folderId);

          // Nada nuevo en Drive desde la última sincronización: no tocar lo local
          if (remoteTs && remoteTs <= lastSynced) {
            console.log(`[DRIVE] Import ${pid}: sin cambios remotos (remoto ${remoteTs} <= visto ${lastSynced})`);
            continue;
          }
          // Hay ediciones locales posteriores a lo que trae Drive: lo local manda
          // (se subirá en el próximo guardado o con el botón de sincronizar)
          if (localEdited > lastSynced && localEdited >= remoteTs) {
            console.log(`[DRIVE] Import ${pid}: lo local es más nuevo (local ${localEdited} >= remoto ${remoteTs}), no se pisa`);
            continue;
          }

          console.log(`[DRIVE] Import ${pid}: aplicando versión remota (remoto ${remoteTs} > visto ${lastSynced})`);
          hasImportedAny = true;
          setDriveSyncedAtLS(pid, remoteTs || Date.now());

          const projectMetaData = {
            id: projJSON.projectId,
            name: projJSON.name,
            emoji: projJSON.emoji || '🗒️',
            cover: projJSON.cover || 'var(--bg-card, #FFFFFF)',
            isPublic: projJSON.isPublic !== false,
            shareToken: projJSON.shareToken || null,
            collaborators: projJSON.collaborators || [],
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
              // Conservamos lo local que Drive no conoce (favorito, papelera)
              next[idx] = { ...next[idx], ...ip, starred: next[idx].starred, deleted: next[idx].deleted };
            } else {
              next.push({ ...ip, starred: false });
            }
          });
          return next;
        });

        driveImportRef.current = true;
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
    // Ahora mismo nadie enciende esta bandera: la encendía el escuchador de
    // Firestore que se quitó por peligroso. Se queda puesta a propósito, porque
    // es justo el freno que necesitará lo que venga a sustituirlo — un cambio
    // que llega de fuera no debe rebotar de vuelta como si fuera tuyo.
    if (isIncomingRemoteChangeRef.current) {
      isIncomingRemoteChangeRef.current = false;
      return;
    }
    const id = setTimeout(async () => {
      // 0. Marca de edición local: solo cuando los canvases realmente cambiaron
      // y el cambio no vino de una importación de Drive
      if (lastSeenCanvasesRef.current === null) {
        lastSeenCanvasesRef.current = canvases;
      } else if (canvases !== lastSeenCanvasesRef.current) {
        const wasImport = driveImportRef.current;
        driveImportRef.current = false;
        lastSeenCanvasesRef.current = canvases;
        if (!wasImport && view.projectId) markLocalEditedAt(view.projectId);
      }

      // 1. Guardado Local (IndexedDB / Vault) — aislado para que un fallo aquí
      // no impida que la sincronización con Drive (sección 3) se ejecute
      try {
        if (vaultPath && window.electronAPI) {
          const cleanCanvases = await saveBase64MediaLocally(canvases, vaultPath);
          window.electronAPI.writeVault(vaultPath, { view, lang, theme, projects, canvases: cleanCanvases, templatesVersion: 2 });
        } else {
          saveStateToDB({ view, lang, theme, projects, canvases, templatesVersion: 2 });
        }
      } catch (err) {
        console.error('[SAVE] Local save failed:', err);
      }

      // 2. Aquí subía el proyecto a Firestore (colección `workspaces`).
      //
      // QUITADO, y no por limpieza: hacía dos cosas graves.
      //
      // Mandaba `canvases` ENTERO —todos tus proyectos, también los privados—
      // metido en un documento con el nombre de UNO solo, el que estuvieras
      // compartiendo. Cualquiera invitado a ese proyecto podía leer el resto
      // de tu trabajo. Compartir un tablero no puede significar entregar todo
      // lo demás.
      //
      // Y su pareja, el escuchador que había más abajo, hacía lo simétrico al
      // recibirlo: `setCanvases(data.canvases)`, o sea sustituir el estado
      // entero por lo que trajera el documento. Eso borra del disco todos los
      // proyectos que no vinieran dentro.
      //
      // Hoy las reglas de firestore.rules no dejan escribir fuera de `salas`,
      // así que esto fallaba en silencio; pero unas reglas viejas publicadas
      // en el servidor bastaban para armarlo. No se deja una cosa así apoyada
      // en que la puerta de al lado siga cerrada.
      //
      // Lo que viene a sustituirlo se diseña al revés: un documento POR
      // proyecto con solo los lienzos de ese proyecto, y al recibir se fusiona
      // con OdiSync (nodo a nodo, como las sesiones en vivo) en lugar de pisar.
      //
      // 2 bis. Modo instantáneo (apagado de fábrica, se enciende por proyecto).
      if (firestoreDB && window.OdiNube && view.projectId) {
        const activeProj = projects.find(p => p.id === view.projectId);
        const yo = firebase.auth().currentUser;
        if (activeProj && activeProj.sincroInstantanea && yo && userProfile) {
          const ahora = Date.now();
          const lienzos = window.OdiNube.soloDelProyecto(canvases, view.projectId);
          if (!window.OdiNube.cabe(lienzos)) {
            // Pasarse del mega no da un aviso suave: da un error que tira la
            // subida entera. Mejor decirlo una vez y seguir guardando en Drive.
            const ultimo = window._odiAvisoTope || 0;
            if (ahora - ultimo > 300000) {
              window._odiAvisoTope = ahora;
              showToast(window.t(
                'Este proyecto es demasiado grande para la sincronización instantánea. Se sigue guardando en tu Drive.',
                'This project is too large for instant sync. It is still being saved to your Drive.'
              ), 'error');
            }
          } else if (window.OdiNube.hayQueSubir(lienzos, acordadoNubeRef.current) &&
                     ahora - ultimaSubidaNubeRef.current > 2000) {
            // Espaciado a dos segundos: el plan gratuito son 20.000 escrituras
            // al día entre todo el mundo, y arrastrar un nodo genera cambios a
            // sesenta por segundo. Sin este freno se agota la cuota en minutos.
            ultimaSubidaNubeRef.current = ahora;
            const acordado = lienzos;
            firestoreDB.collection('proyectos').doc(view.projectId).set({
              dueno: yo.uid,
              correos: window.OdiNube.correosDe(activeProj, userProfile.email),
              raiz: view.projectId,
              lienzos,
              porUid: yo.uid,
              actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
              version: 1,
            }, { merge: true })
              .then(() => { acordadoNubeRef.current = acordado; })
              .catch(err => console.warn('[NUBE] no se pudo subir:', err && err.message));
          }
        }
      }

      // 3. Sincronización real con Google Drive si está habilitado
      if (userProfile && view.projectId) {
        const activeProj = projects.find(p => p.id === view.projectId);
        if (activeProj && !(activeProj.isPublic || activeProj.isRemote || activeProj.useGoogleDrive)) {
          console.log(`[DRIVE] ${view.projectId} está Offline: no se sincroniza (ponlo Online para subirlo)`);
        }
        if (activeProj && (activeProj.isPublic || activeProj.isRemote || activeProj.useGoogleDrive)) {
          if (!userProfile.accessToken) {
            console.log('[DRIVE] Sin token de Drive: pulsa ↻ para renovarlo');
            const lastAlert = window.lastDriveScopeAlertTime || 0;
            const now = Date.now();
            // Aviso espaciado (5 min) para no ser molesto: el punto rojo del botón ↻
            // ya indica el estado de forma permanente y silenciosa
            if (now - lastAlert > 300000) {
              window.lastDriveScopeAlertTime = now;
              showToast(window.t('El acceso a Drive venció: presiona ↻ para renovarlo con un clic.', 'Drive access expired: press ↻ to renew it with one click.'), 'error');
            }
            return;
          }
          const now = Date.now();

          // 3.0 Primera sincronización: crear las carpetas en Drive antes de subir medios
          if (!localStorage.getItem(`odinote.gdrive_folder_${view.projectId}`)) {
            lastGoogleDriveSyncTimeRef.current = now;
            const createdFolder = await uploadToGoogleDriveReal(activeProj, canvases, userProfile.accessToken);
            if (!createdFolder) return;
          }

          // 3.1 Escaneo y subida de medios locales (base64 o archivos del Vault) a Drive.
          // Toda la lógica vive en window.OdiDrive (src/drive.js), cubierta por tests
          // con la API simulada. Usa subida reanudable: el multipart anterior tenía
          // un límite de 5 MB y fallaba en silencio con imágenes grandes.
          // Guardia contra escaneos simultáneos (subirían los mismos archivos dos veces)
          if (window._odiMediaScanBusy) return;
          window._odiMediaScanBusy = true;
          try {
          setIsSyncingDrive(true);
          const mediaResult = await window.OdiDrive.syncProjectMedia({
            canvases,
            projectId: view.projectId,
            folderId: localStorage.getItem(`odinote.gdrive_folder_${view.projectId}`),
            accessToken: userProfile.accessToken,
            resolveSrc: window.resolveMediaSrc,
            log: (m) => console.log('[DRIVE] ' + m)
          });
          if (mediaResult.authError === 401) { invalidateDriveSession(); return; }
          if (mediaResult.authError === 403) { notifyDriveBlocked({ status: 403, reason: '' }); return; }
          if (mediaResult.attempted > mediaResult.uploaded) {
            console.warn(`[DRIVE] ${mediaResult.attempted - mediaResult.uploaded} medios no se pudieron subir (ver líneas anteriores)`);
          }
          if (applyMediaReplacements(mediaResult.replaced)) {
            showToast(window.t('Imágenes y archivos del proyecto subidos a Google Drive.', 'Project images and files uploaded to Google Drive.'));
            return;
          }
          } finally {
            window._odiMediaScanBusy = false;
            setTimeout(() => setIsSyncingDrive(false), 800);
          }

          // 3.2 Sincronización del archivo JSON del proyecto a Google Drive,
          // solo si hay ediciones locales que Drive aún no tiene
          if (getLocalEditedAt(view.projectId) > getDriveSyncedAt(view.projectId) &&
              now - lastGoogleDriveSyncTimeRef.current > 10000) {
            lastGoogleDriveSyncTimeRef.current = now;
            console.log(`[DRIVE] Subiendo canvas_state.json de ${view.projectId} (ediciones locales pendientes)`);
            uploadToGoogleDriveReal(activeProj, canvases, userProfile.accessToken)
              .then(ok => console.log(`[DRIVE] canvas_state.json de ${view.projectId}: ${ok ? 'subido' : 'FALLO'}`));
          }
        }
      }
    }, 400);
    return () => clearTimeout(id);
  }, [view, lang, theme, projects, canvases, loading, vaultPath]);

  // Aquí escuchaba Firestore para traer los cambios del otro en tiempo real.
  //
  // QUITADO junto con la escritura que lo alimentaba (ver el punto 2 del
  // guardado, más arriba). La línea del delito era esta:
  //
  //     if (data.canvases) setCanvases(cleanCanvases(data.canvases));
  //
  // `setCanvases` sustituye el estado ENTERO, y el estado entero son todos tus
  // proyectos. Aplicar ahí un documento que solo contiene los lienzos de UNO
  // borra todos los demás — y cuatrocientos milisegundos después el guardado
  // automático escribe ese estado vacío en el disco. Un solo mensaje del otro
  // lado y se acabó.
  //
  // No basta con colar un merge aquí: el problema es de forma. Lo que lo
  // sustituya tiene que (1) subir solo los lienzos del proyecto compartido y
  // (2) al recibir, calcular qué cambió respecto a la última versión vista y
  // aplicar SOLO eso, con OdiSync, igual que las sesiones en vivo. Así dos
  // personas tocando cosas distintas no se borran el trabajo, y lo que no
  // viene en el documento sencillamente no se toca.
  //
  // Eso es exactamente lo que hace lo de abajo, con la fusión en src/nube.js.
  useEffectApp(() => {
    if (!firestoreDB || !window.OdiNube || !view.projectId) return;
    const activeProj = projects.find(p => p.id === view.projectId);
    if (!activeProj || !activeProj.sincroInstantanea) return;
    const yo = firebase.auth().currentUser;
    if (!yo) return;

    const off = firestoreDB.collection('proyectos').doc(view.projectId).onSnapshot((doc) => {
      if (!doc.exists) return;
      const data = doc.data();
      if (!data || !data.lienzos) return;
      // Lo que acabo de mandar yo vuelve rebotado: no se aplica.
      if (data.porUid === yo.uid) { acordadoNubeRef.current = data.lienzos; return; }

      setCanvases(prev => {
        const r = window.OdiNube.fusiona({
          locales: prev,
          ultimoRemoto: acordadoNubeRef.current,
          remoto: data.lienzos,
          raiz: view.projectId,
        });
        // Se apunta la foto del otro lado ANTES de nada: es contra ella contra
        // la que se comparará la próxima, y también lo que evita que este
        // mismo cambio salga ahora de vuelta hacia quien lo mandó.
        acordadoNubeRef.current = data.lienzos;
        return r.cambio ? r.lienzos : prev;
      });
    }, (err) => {
      // Lo más probable es que las reglas no estén publicadas todavía.
      console.warn('[NUBE] no se pudo escuchar el proyecto:', err && err.message);
    });

    return () => off();
  }, [view.projectId, projects, userProfile]);

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
        const migrated = olvidaPrestados(migrateTemplates(vaultState));
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
        const migrated = olvidaPrestados(migrateTemplates(dbState));
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

  // Ctrl/Cmd+K abre el buscador global desde cualquier pantalla, incluso
  // escribiendo dentro de una nota: es el atajo estándar y se espera que
  // funcione siempre.
  useEffectApp(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchMode('goto');
        setSearchOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ───── Enlaces entre nodos: el disparador "[[" ─────
  // Al escribir "[[" dentro de cualquier texto (nota, documento, comentario o
  // leyenda) se abre el mismo buscador, pero para ELEGIR DESTINO en vez de
  // navegar. Es el gesto de Obsidian, y reaprovecha el buscador entero.
  const linkAnchorRef = React.useRef(null);
  const savedSelectionRef = React.useRef(null);
  useEffectApp(() => {
    const onInput = (e) => {
      const el = e.target;
      if (!el || !el.isContentEditable) return;
      const sel = window.getSelection();
      if (!sel || !sel.anchorNode || sel.anchorNode.nodeType !== 3) return;
      const offset = sel.anchorOffset;
      if (offset < 2) return;
      if (sel.anchorNode.textContent.slice(offset - 2, offset) !== '[[') return;
      // Se recuerda dónde estaba el cursor para poder sustituir los corchetes
      // por el enlace cuando el usuario elija destino.
      linkAnchorRef.current = { kind: 'brackets', editor: el, node: sel.anchorNode, offset };
      setSearchMode('link');
      setSearchOpen(true);
    };
    document.addEventListener('input', onInput, true);
    return () => document.removeEventListener('input', onInput, true);
  }, []);

  // Puerta para la barra de formato, que vive en otro componente.
  useEffectApp(() => {
    window.odiStartLinkFromSelection = (range) => {
      const container = range.commonAncestorContainer;
      const el = (container.nodeType === 1 ? container : container.parentElement);
      linkAnchorRef.current = { kind: 'selection', range, editor: el };
      setSearchMode('link');
      setSearchOpen(true);
    };
    return () => { window.odiStartLinkFromSelection = null; };
  }, []);

  // Sustituye los "[[" por el enlace al nodo elegido.
  const insertLinkTo = (hit) => {
    const anchor = linkAnchorRef.current;
    linkAnchorRef.current = null;
    savedSelectionRef.current = null;
    if (!anchor || !hit) return;

    let range, editor, label;

    if (anchor.kind === 'selection') {
      // Desde el menú contextual: se envuelve el texto ya seleccionado, así que
      // el enlace conserva las palabras que el usuario escribió.
      range = anchor.range;
      if (!range) return;
      editor = (range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement);
      editor = editor && editor.closest('[contenteditable="true"]');
      if (!editor) return;
      label = range.toString();
      range.deleteContents();
    } else {
      // Desde "[[": se quitan los corchetes y se pone el nombre del destino.
      const { node, offset } = anchor;
      editor = anchor.editor;
      if (!editor || !node || !node.isConnected) return;
      if (node.textContent.slice(offset - 2, offset) !== '[[') return;
      // El nombre del nodo desde el principio, no el extracto con contexto:
      // ese traía el texto de alrededor de la coincidencia y el enlace salía
      // empezado por la mitad de una palabra.
      label = (hit.label || hit.snippet || '').replace(/^…/, '').replace(/…$/, '').trim() || window.t('nodo', 'node');
      range = document.createRange();
      range.setStart(node, offset - 2);
      range.setEnd(node, offset);
      range.deleteContents();
    }

    const frag = range.createContextualFragment(
      window.OdiLinks.makeLinkHtml({ itemId: hit.itemId, canvasId: hit.canvasId, text: label }) +
      (anchor.kind === 'selection' ? '' : '&nbsp;')
    );
    range.insertNode(frag);

    // Cursor detrás del enlace, y avisar para que se guarde el cambio
    const sel = window.getSelection();
    sel.removeAllRanges();
    const after = document.createRange();
    after.selectNodeContents(editor);
    after.collapse(false);
    sel.addRange(after);
    editor.focus();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // Pulsar un enlace lleva a su nodo, igual que un resultado del buscador.
  useEffectApp(() => {
    const onClick = (e) => {
      const a = e.target && e.target.closest && e.target.closest('a.odi-link');
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      const itemId = a.getAttribute(window.OdiLinks.NODE_ATTR);
      const canvasId = a.getAttribute(window.OdiLinks.CANVAS_ATTR);
      if (!itemId) return;
      // Se localiza el destino para saber su proyecto y por dónde bajar
      const target = window.OdiSearch.locate({ projects, canvases, itemId, canvasId, lang });
      if (target) goToSearchHit(target);
      else showToast(window.t('Ese nodo ya no existe.', 'That node no longer exists.'), 'error');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [projects, canvases, lang]);

  // Ir a un resultado: abrir su proyecto y pasarle al lienzo por dónde bajar.
  // El nonce hace que dos saltos seguidos al MISMO nodo se distingan, para que
  // el segundo también resalte en vez de quedarse mudo.
  const goToSearchHit = (hit) => {
    if (!hit) return;
    setJumpTarget({ ...hit, nonce: Date.now() });
    setView(v => (v.kind === 'canvas' && v.projectId === hit.projectId)
      ? v
      : { kind: 'canvas', projectId: hit.projectId });
  };

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
      // Cerrar la de compartir antes de pedir la sesión: las dos ventanas
      // están al mismo nivel, así que la de iniciar sesión aparecía DETRÁS y
      // parecía que el botón no hacía nada.
      setSharingModalOpen(false);
      setUserModalOpen(true);
      return;
    }
    const target = projects.find(x => x.id === projectId);
    if (!target) return;

    // Poner offline siempre está permitido
    if (target.isPublic) {
      setProjects(p => p.map(x => x.id === projectId ? { ...x, isPublic: false, shareToken: null } : x));
      return;
    }

    // Poner online: primero se sube a Drive y SOLO si la subida fue real se marca
    // como online. Un puesto "online" sin datos en la nube sería falso.
    if (!userProfile.accessToken) {
      showToast(window.t('Google Drive no está autorizado, el proyecto se queda offline. Cierra e inicia sesión de nuevo.', 'Google Drive is not authorized, the project stays offline. Sign out and sign in again.'), 'error');
      return;
    }
    // Poner online ES guardarlo en tu Drive. Eran dos interruptores separados y
    // eso no tenía sentido: sin Drive, un invitado ve la estructura pero no las
    // imágenes ni los audios, porque esos archivos no salen de tu disco. Ahora
    // es una sola decisión, con la advertencia delante y no escondida.
    const aviso = window.t(
      'Al poner este proyecto online se guarda en TU Google Drive, en la carpeta "Odinote".\n\n' +
      '· Las imágenes y audios ocupan espacio de tus 15 GB gratuitos de Google.\n' +
      '· Es lo que permite que quien invites vea las imágenes, y no solo los recuadros.\n' +
      '· Puedes ponerlo offline cuando quieras: se deja de subir y lo que ya está sigue en tu Drive.\n\n' +
      '¿Seguimos?',
      'Putting this project online saves it in YOUR Google Drive, in the "Odinote" folder.\n\n' +
      '· Images and audio take space from your 15 GB of free Google storage.\n' +
      '· It is what lets the people you invite see the images, not just empty frames.\n' +
      '· You can take it offline whenever you like: nothing more is uploaded and what is there stays in your Drive.\n\n' +
      'Go ahead?'
    );
    window.customConfirm(aviso).then((acepta) => {
      if (!acepta) return;
      ponOnlineDeVerdad(projectId, target);
    });
  };

  const ponOnlineDeVerdad = (projectId, target) => {
    const nextToken = `odi-tok-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
    showToast(window.t('Subiendo el proyecto a Google Drive...', 'Uploading the project to Google Drive...'));
    uploadToGoogleDriveReal({ ...target, isPublic: true, shareToken: nextToken }, canvases, userProfile.accessToken)
      .then(folderId => {
        // Cuántos lo consiguen y cuántos no. Sin esto, que alguien no pueda
        // poner su espacio online solo se sabe si se molesta en escribir a
        // GitHub — y casi nadie lo hace.
        window.odiTrack && window.odiTrack('poner_online', { resultado: folderId ? 'ok' : 'fallo' });
        if (folderId) {
          // Online y Drive van juntos: es lo que se acaba de aceptar.
          setProjects(p => p.map(x => x.id === projectId ? { ...x, isPublic: true, useGoogleDrive: true, shareToken: nextToken } : x));
          showToast(window.t(`"${projectNameString(target.name)}" ya está online, guardado en tu Google Drive (carpeta Odinote).`, `"${projectNameString(target.name)}" is now online, saved to your Google Drive (Odinote folder).`));
        } else {
          showToast(window.t('No se pudo subir a Google Drive: el proyecto se queda offline.', 'Could not upload to Google Drive: the project stays offline.'), 'error');
        }
      });
  };

  // Sincronización manual con Drive: sube el proyecto activo (si está online)
  // y luego baja lo que haya nuevo en la nube. Es el botón de "refrescar".
  const manualDriveRefresh = async () => {
    if (!userProfile) {
      setUserModalOpen(true);
      return;
    }
    if (!userProfile.accessToken) {
      // Renovación directa: pulsar ↻ sin token válido lanza el flujo de Google
      // al instante (sin selector de cuenta), en vez de solo mostrar un aviso
      showToast(window.t('Renovando el acceso a Google Drive...', 'Renewing Google Drive access...'));
      startGoogleAuthFlow(true);
      return;
    }
    showToast(window.t('Sincronizando con Google Drive...', 'Syncing with Google Drive...'));
    setIsSyncingDrive(true);
    try {
      // 1. Bajar primero lo que haya nuevo en Drive (la importación ya compara
      // marcas de tiempo, así que nunca pisa ediciones locales más recientes)
      await syncProjectsFromGoogleDrive(userProfile.accessToken);

      // 2. Si estamos dentro de un proyecto online, subir también sus medios
      // locales (imágenes/audio) — es la sincronización completa garantizada
      let uploadedMedia = 0;
      let mediaReplaced = false;
      if (view.projectId) {
        const activeProj = projects.find(p => p.id === view.projectId);
        if (activeProj && (activeProj.isPublic || activeProj.useGoogleDrive)) {
          let folderId = localStorage.getItem(`odinote.gdrive_folder_${view.projectId}`);
          if (!folderId) {
            folderId = await uploadToGoogleDriveReal(activeProj, canvases, userProfile.accessToken);
          }
          if (folderId && !window._odiMediaScanBusy) {
            window._odiMediaScanBusy = true;
            try {
              const mediaResult = await window.OdiDrive.syncProjectMedia({
                canvases,
                projectId: view.projectId,
                folderId,
                accessToken: userProfile.accessToken,
                resolveSrc: window.resolveMediaSrc,
                log: (m) => console.log('[DRIVE] ' + m)
              });
              if (mediaResult.authError === 401) { invalidateDriveSession(); return; }
              if (mediaResult.authError === 403) { notifyDriveBlocked({ status: 403, reason: '' }); return; }
              uploadedMedia = mediaResult.uploaded;
              mediaReplaced = applyMediaReplacements(mediaResult.replaced);
              if (mediaResult.attempted > mediaResult.uploaded) {
                showToast(window.t(`${mediaResult.attempted - mediaResult.uploaded} archivos no se pudieron subir (detalles en la consola).`, `${mediaResult.attempted - mediaResult.uploaded} files could not be uploaded (details in console).`), 'error');
              }
            } finally {
              window._odiMediaScanBusy = false;
            }
          }
        } else if (activeProj) {
          console.log(`[DRIVE] ${view.projectId} está Offline: el botón de sincronizar no lo sube (ponlo Online primero)`);
        }
      }

      // 3. Subir TODOS los proyectos online que tengan cambios locales pendientes.
      // Si acabamos de reemplazar medios del proyecto actual, su JSON lo subirá el
      // autosave con el estado ya actualizado (el `canvases` de aquí sería el viejo).
      const onlineProjects = projects.filter(p => (p.isPublic || p.useGoogleDrive) && !p.deleted);
      for (const p of onlineProjects) {
        if (p.id === view.projectId && mediaReplaced) continue;
        if (getLocalEditedAt(p.id) > getDriveSyncedAt(p.id)) {
          await uploadToGoogleDriveReal(p, canvases, userProfile.accessToken);
        }
      }
      showToast(uploadedMedia > 0
        ? window.t(`Sincronización completada: ${uploadedMedia} archivos subidos a Drive.`, `Sync finished: ${uploadedMedia} files uploaded to Drive.`)
        : window.t('Sincronización con Google Drive completada.', 'Google Drive sync finished.'));
    } catch (err) {
      console.error('Manual Drive refresh failed:', err);
      showToast(window.t('La sincronización manual falló. Revisa tu conexión.', 'Manual sync failed. Check your connection.'), 'error');
    } finally {
      setTimeout(() => setIsSyncingDrive(false), 800);
    }
  };

  // Caché local de medios en el .exe: descarga a la bóveda (carpeta media/) los
  // medios alojados en la nube, para que el proyecto abra completo sin internet.
  // El src remoto se conserva (los demás dispositivos lo siguen usando); srcLocal
  // es el espejo local que la app de escritorio muestra con prioridad.
  useEffectApp(() => {
    if (!window.electronAPI || !window.electronAPI.downloadMediaToVault) return;
    if (!vaultPath || !view.projectId || loading) return;
    const t = setTimeout(async () => {
      if (window._odiLocalCacheBusy) return;
      window._odiLocalCacheBusy = true;
      try {
        const pages = collectProjectCanvases(canvases, view.projectId);
        const cached = {}; // { canvasId: { itemId | `${colId}::${childId}`: rutaLocal } }
        for (const cid of Object.keys(pages)) {
          for (const item of (pages[cid].items || [])) {
            const jobs = [[item.id, item]];
            (item.children || []).forEach(ch => jobs.push([`${item.id}::${ch.id}`, ch]));
            for (const [key, node] of jobs) {
              if (!node.src || !/^https?:\/\//.test(node.src) || node.srcLocal) continue;
              try {
                const localPath = await window.electronAPI.downloadMediaToVault(vaultPath, node.src, `cloud_${node.id}`);
                if (localPath) (cached[cid] = cached[cid] || {})[key] = localPath;
              } catch (err) {
                // Sin internet o URL rota: se reintentará en el próximo ciclo
              }
            }
          }
        }
        if (Object.keys(cached).length > 0) {
          console.log(`[CACHE] ${Object.values(cached).reduce((n, m) => n + Object.keys(m).length, 0)} medios de la nube copiados a la bóveda local`);
          setCanvases(prev => {
            const next = { ...prev };
            Object.keys(cached).forEach(cid => {
              const canv = next[cid];
              if (!canv) return;
              next[cid] = {
                ...canv,
                items: (canv.items || []).map(it => {
                  let updated = it;
                  if (cached[cid][it.id]) updated = { ...updated, srcLocal: cached[cid][it.id] };
                  if (updated.children && updated.children.some(ch => cached[cid][`${it.id}::${ch.id}`])) {
                    updated = {
                      ...updated,
                      children: updated.children.map(ch => cached[cid][`${it.id}::${ch.id}`] ? { ...ch, srcLocal: cached[cid][`${it.id}::${ch.id}`] } : ch)
                    };
                  }
                  return updated;
                })
              };
            });
            return next;
          });
        }
      } finally {
        window._odiLocalCacheBusy = false;
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [view.projectId, canvases, vaultPath, loading]);

  // Invita a un colaborador compartiendo la carpeta del proyecto en Drive con su cuenta de Google.
  // Google le envía el correo de invitación; no hay IDs inventados de por medio.
  const inviteCollaboratorByGoogle = async (project, email) => {
    const clean = (email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      showToast(window.t('Introduce un correo de Google válido.', 'Enter a valid Google email.'), 'error');
      return false;
    }
    if (!userProfile || !userProfile.accessToken) {
      showToast(window.t('Inicia sesión con Google para poder invitar.', 'Sign in with Google to invite.'), 'error');
      return false;
    }
    if (userProfile.email && clean === userProfile.email.toLowerCase()) {
      showToast(window.t('Ese correo es el tuyo: ya eres el propietario.', 'That email is yours: you are already the owner.'), 'error');
      return false;
    }
    try {
      // Asegurar que el proyecto ya existe en Drive antes de compartir la carpeta
      let folderId = localStorage.getItem(`odinote.gdrive_folder_${project.id}`);
      if (!folderId) {
        folderId = await uploadToGoogleDriveReal(project, canvases, userProfile.accessToken);
      }
      if (!folderId) {
        showToast(window.t('No se pudo preparar la carpeta del proyecto en Drive.', 'Could not prepare the project folder on Drive.'), 'error');
        return false;
      }
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userProfile.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: clean })
      });
      if (res.status === 401) { invalidateDriveSession(); return false; }
      if (!res.ok) {
        showToast(window.t('Google rechazó la invitación. Verifica que el correo sea una cuenta de Google real.', 'Google rejected the invitation. Make sure the email is a real Google account.'), 'error');
        return false;
      }
      setProjects(prev => prev.map(p => {
        if (p.id !== project.id) return p;
        const list = p.collaborators || [];
        if (list.some(c => (c.email || c.id || '').toLowerCase() === clean)) return p;
        return { ...p, collaborators: [...list, { id: clean, email: clean, name: clean.split('@')[0], role: 'editor' }] };
      }));
      showToast(window.t(`Invitación enviada por Google Drive a ${clean}.`, `Invitation sent via Google Drive to ${clean}.`));
      return true;
    } catch (err) {
      console.error('Error inviting collaborator via Google Drive:', err);
      showToast(window.t('Error de red al enviar la invitación.', 'Network error while sending the invitation.'), 'error');
      return false;
    }
  };

  // Quita al colaborador de la lista y revoca su permiso en la carpeta de Drive
  const removeCollaboratorByGoogle = async (project, col) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== project.id) return p;
      return { ...p, collaborators: (p.collaborators || []).filter(c => c.id !== col.id) };
    }));
    const email = (col.email || col.id || '').toLowerCase();
    const folderId = localStorage.getItem(`odinote.gdrive_folder_${project.id}`);
    if (!folderId || !userProfile || !userProfile.accessToken || !email.includes('@')) return;
    try {
      const headers = { 'Authorization': `Bearer ${userProfile.accessToken}` };
      const listRes = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions?fields=permissions(id,emailAddress)`, { headers });
      if (listRes.status === 401) { invalidateDriveSession(); return; }
      if (!listRes.ok) return;
      const listData = await listRes.json();
      const perm = (listData.permissions || []).find(pm => (pm.emailAddress || '').toLowerCase() === email);
      if (perm) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions/${perm.id}`, { method: 'DELETE', headers });
      }
    } catch (err) {
      console.error('Error revoking Drive permission:', err);
    }
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
          // FUSIONAR, no reemplazar: un respaldo importado solía borrar TODOS los
          // proyectos existentes. Ahora se añaden/actualizan por id, conservando
          // todo lo que ya tenías. Los ids nuevos (p. ej. de una plantilla de
          // ejemplo) simplemente se agregan a la lista.
          setProjects(prev => {
            const byId = new Map(prev.map(p => [p.id, p]));
            state.projects.forEach(p => byId.set(p.id, p));
            return Array.from(byId.values());
          });
          setCanvases(prev => ({ ...prev, ...state.canvases }));
          showToast(window.t(
            `Se importaron ${state.projects.length} proyecto(s). Tus proyectos existentes se conservaron.`,
            `Imported ${state.projects.length} project(s). Your existing projects were kept.`
          ));
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
      esPatrocinador={esPatrocinador}
      onUserClick={() => setUserModalOpen(true)}
      onJoinProjectClick={() => setJoiningModalOpen(true)}
      onTogglePublic={togglePublicProject}
      onManualSync={manualDriveRefresh}
      isSyncingDrive={isSyncingDrive}
      needsDriveAuth={!!(userProfile && !userProfile.accessToken)}
      driveReachable={driveReachable}
    />;
  } else {
    activeView = <window.Canvas
      key={view.projectId}
      projectId={view.projectId}
      /* El tablero concreto en el que estabas al cerrar, no solo el proyecto.
         Antes solo se guardaba projectId, asi que al abrir siempre caias en el
         lienzo raiz aunque hubieras cerrado tres tableros mas adentro. */
      initialTrail={view.trail}
      onTrailChange={(trail) => setView(v => {
        // El rastro siempre empieza por el proyecto: si no coincide, viene de
        // un Canvas que ya no es el visible y se descarta.
        if (v.kind !== 'canvas' || !trail || trail[0] !== v.projectId) return v;
        const igual = Array.isArray(v.trail) && v.trail.length === trail.length &&
          v.trail.every((x, i) => x === trail[i]);
        return igual ? v : { ...v, trail };
      })}
      jumpTarget={jumpTarget}
      onSearchClick={() => { setSearchMode("goto"); setSearchOpen(true); }}
      onGoToNode={goToSearchHit}
      onGraphClick={() => setGraphOpen(true)}
      isSyncingDrive={isSyncingDrive}
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
      esPatrocinador={esPatrocinador}
      onUserClick={() => setUserModalOpen(true)}
      projects={projects}
      setProjects={setProjects}
      // El error se borra al abrir: un "ese código no existe" de hace media
      // hora seguía ahí en rojo, debajo de unos botones que no tenían nada que
      // ver, como si acabara de fallar algo.
      onSharingClick={(pid) => { setActiveSharingProjectId(pid); setInviteEmail(''); setSalaError(null); setSharingModalOpen(true); }}
      onManualSync={manualDriveRefresh}
      needsDriveAuth={!!(userProfile && !userProfile.accessToken)}
      driveReachable={driveReachable}
    />;
  }

  return (
    <>
      {activeView}
      <window.SearchPalette
        open={searchOpen}
        mode={searchMode}
        onClose={() => { setSearchOpen(false); linkAnchorRef.current = null; }}
        projects={projects}
        canvases={canvases}
        lang={lang}
        onGoTo={searchMode === 'link' ? insertLinkTo : goToSearchHit}
      />
      {shortcutTip && (
        <div
          className="odi-sh-tip"
          style={{ top: shortcutTip.top, left: shortcutTip.left, width: shortcutTip.width }}
        >
          {shortcutTip.texto}
        </div>
      )}
      <window.GraphView
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
        projects={projects}
        canvases={canvases}
        projectId={view.projectId}
        lang={lang}
        onGoTo={(n) => goToSearchHit({
          projectId: view.projectId,
          canvasId: n.canvasId,
          trailIds: n.trailIds,
          itemId: n.id,
        })}
      />
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
                {/* Enlazar el texto seleccionado con otro nodo. Es el mismo
                    enlace que se hace escribiendo "[[", pero a partir de algo
                    ya escrito, que es como suele surgir: relees una frase y te
                    das cuenta de que apunta a otra parte. */}
                {contextMenu.selectionText && contextMenu.selectionText.trim() !== '' && (
                  <>
                    <div className="ctx-menu-divider" />
                    <button
                      className="ctx-menu-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        linkAnchorRef.current = savedSelectionRef.current
                          ? { kind: 'selection', ...savedSelectionRef.current }
                          : null;
                        setContextMenu(null);
                        setSearchMode('link');
                        setSearchOpen(true);
                      }}
                    >
                      <span className="material-symbols-rounded">add_link</span>
                      <span>{lang === 'es' ? 'Enlazar con un nodo…' : 'Link to a node…'}</span>
                    </button>
                  </>
                )}
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
                {/* En el móvil no hay consola: sin esto es imposible saber si el
                    navegador está sirviendo el código nuevo o una copia vieja de
                    su caché, y un fallo ya arreglado parece seguir ahí. */}
                <button
                  className="odi-build-tag"
                  title={window.t('Toca para ver el último gesto táctil', 'Tap to see the last touch gesture')}
                  onClick={() => setShowTouchDiag(v => !v)}
                >
                  {CURRENT_VERSION} · {window.ODINOTE_BUILD} ·{' '}
                  {window.innerWidth}×{window.innerHeight} ·{' '}
                  {/* Cómo se ve la aplicación a sí misma. Si aquí no pone
                      "escritorio" dentro del programa instalado, es que el
                      puente con Electron no llegó y las estadísticas de esa
                      copia se están contando como si fuera la web. */}
                  {window.ODINOTE_PLATFORM || '?'} ·{' '}
                  {(window.odiIsTouch && window.odiIsTouch())
                    ? window.t('táctil', 'touch')
                    : window.t('SIN táctil', 'NO touch')}
                </button>
              </div>
              <button 
                className="icon-btn" 
                onClick={() => setSettingsOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '20px', color: 'var(--text-soft, #595459)' }}>close</span>
              </button>
            </div>

            {/* Qué pasó con el último gesto táctil. En un móvil no hay consola:
                sin esto, ante un "no puedo arrastrar" no hay forma de saber si
                el toque llegó siquiera, si el puente lo tomó, o si el navegador
                se quedó el gesto antes que la app. */}
            {showTouchDiag && (
              <div className="odi-touch-diag">
                <div className="odi-touch-diag-title">
                  {window.t('Último gesto táctil', 'Last touch gesture')}
                </div>
                <code>{window.odiTouchDiag || '—'}</code>
                <div className="odi-touch-diag-hint">
                  {window.t(
                    'Cierra Ajustes, intenta arrastrar un nodo y vuelve aquí para leerlo.',
                    'Close Settings, try dragging a node, then come back and read this.'
                  )}
                </div>
              </div>
            )}

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
                      { id: 'undo', desc: window.t('Deshacer acción', 'Undo action'),
                        help: window.t('Deshace el último cambio. Los cambios seguidos se agrupan, para no tener que presionarlo veinte veces al borrar una frase.', 'Undoes the last change. Rapid edits are grouped, so deleting a sentence is one step, not twenty.') },
                      { id: 'redo', desc: window.t('Rehacer acción', 'Redo action'),
                        help: window.t('Vuelve a aplicar lo que acabas de deshacer.', 'Re-applies what you just undid.') },
                      { id: 'duplicate', desc: window.t('Duplicar nodo', 'Duplicate selected node'),
                        help: window.t('Crea una copia del nodo seleccionado justo al lado, con su contenido y su formato.', 'Creates a copy of the selected node beside it, keeping content and formatting.') },
                      { id: 'selectAll', desc: window.t('Seleccionar todo', 'Select all items'),
                        help: window.t('Selecciona todos los nodos y conectores del lienzo actual, no de todo el proyecto.', 'Selects every node and connector on the current canvas — not the whole project.') },
                      { id: 'search', desc: window.t('Enfocar buscador del lienzo', 'Focus search box'),
                        help: window.t('Pone el cursor en el buscador de ARRIBA, que atenúa lo que no coincide en este lienzo. Para buscar en todos los proyectos, usa Ctrl+K.', 'Focuses the search box above, which dims non-matching nodes on this canvas. To search every project, use Ctrl+K.') },
                      { id: 'commentCode', desc: window.t('Comentar líneas de código', 'Comment code lines'),
                        help: window.t('Dentro de un bloque de código, comenta o descomenta las líneas marcadas con la marca del lenguaje (//, #, --). Ctrl+/ también funciona, pero en un teclado español ese "/" pide Shift, así que por defecto es Ctrl+7.', 'Inside a code block, comments or uncomments the selected lines using that language\'s marker (//, #, --). Ctrl+/ also works, but on a Spanish keyboard that slash needs Shift, so the default here is Ctrl+7.') }
                    ].map((sh) => {
                      const cfg = shState[sh.id] || {};
                      const isListening = listeningKey === sh.id;
                      return (
                        <div key={sh.id} className="odi-sh-row" onMouseEnter={(e)=>showTip(e, sh.help)} onMouseLeave={()=>setShortcutTip(null)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '6px 8px', background: 'var(--bg-main, #FAF8F6)', borderRadius: '6px', border: '1.5px solid var(--line-soft, #E5E1DD)' }}>
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
                            {isListening ? window.t('Presiona las teclas...', 'Press keys...') : cfg.label || 'None'}
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
                      { keys: ['Ctrl', 'K'], desc: window.t('Buscar en TODO', 'Search everything'), nuevo: true,
                        help: window.t('Busca en todos los proyectos y en todos los tableros anidados a la vez, y te lleva al resultado. Es la forma de encontrar algo que enterraste hace meses.', 'Searches every project and every nested board at once and takes you to the result. This is how you find something you buried months ago.') },
                      { keys: ['[', '['], desc: window.t('Enlazar con otro nodo', 'Link to another node'), nuevo: true,
                        help: window.t('Escribiendo dos corchetes dentro de cualquier texto se abre el buscador para elegir un nodo. La palabra queda enlazada y el nodo de destino mostrará que le apuntas desde aquí. También sale con clic derecho sobre texto seleccionado.', 'Typing two brackets inside any text opens the picker. The word becomes a link, and the target node will show it is referenced from here. Also available by right-clicking selected text.') },
                      { keys: ['Ctrl', 'C'], desc: window.t('Copiar nodos', 'Copy nodes'),
                        help: window.t('Copia los nodos seleccionados, con su contenido y su formato, listos para pegar en otro lienzo o proyecto.', 'Copies the selected nodes with their content and formatting, ready to paste into another canvas or project.') },
                      { keys: ['Ctrl', 'V'], desc: window.t('Pegar nodos / archivos', 'Paste nodes or files'),
                        help: window.t('Pega nodos copiados, y también imágenes o archivos del portapapeles: se convierten en nodos automáticamente.', 'Pastes copied nodes, and also images or files from the clipboard: they become nodes automatically.') },
                      { keys: ['Ctrl', 'X'], desc: window.t('Cortar nodos', 'Cut nodes'),
                        help: window.t('Copia y elimina en un paso, para mover nodos entre tableros.', 'Copies and deletes in one step, to move nodes between boards.') },
                      { keys: ['F12', 'Ctrl+Shift+I'], desc: window.t('Consola de depuración', 'Toggle DevTools'),
                        help: window.t('Abre las herramientas de desarrollo del navegador. Útil solo para diagnosticar fallos: si algo va mal, aquí aparece el motivo.', 'Opens the browser developer tools. Only useful for diagnosing problems: if something breaks, the reason shows up here.') },
                      { keys: ['Ctrl', 'Botón Central'], desc: window.t('Paneo de cámara global', 'Global camera panning'),
                        help: window.t('Mueve el lienzo arrastrando con la rueda presionada, sin tocar ningún nodo por el camino.', 'Moves the canvas by dragging with the wheel pressed, without touching any node along the way.') },
                      { keys: ['Shift', 'Click'], desc: window.t('Selección múltiple individual', 'Toggle item selection'),
                        help: window.t('Añade o quita un nodo de la selección sin perder los que ya tenías elegidos.', 'Adds or removes one node from the selection without losing the ones already picked.') },
                      { keys: ['Shift', 'Arrastrar'], desc: window.t('Seleccionar por recuadro', 'Box selection'),
                        help: window.t('Dibuja un rectángulo y selecciona todo lo que quede dentro, sumándolo a lo ya seleccionado.', 'Draws a rectangle and selects everything inside it, adding to the current selection.') },
                      { keys: ['Alt', 'Arrastrar'], desc: window.t('Desplazar lienzo (Paneo)', 'Pan the canvas'),
                        help: window.t('Mueve la vista arrastrando desde cualquier punto, incluso encima de un nodo, sin moverlo.', 'Moves the view by dragging from anywhere, even over a node, without moving it.') },
                      { keys: ['Ctrl', 'Rueda'], desc: window.t('Acercar / Alejar (Zoom)', 'Zoom In / Out'),
                        help: window.t('Acerca o aleja manteniendo bajo el cursor el punto que estabas mirando.', 'Zooms in or out keeping the point under the cursor where it was.') },
                      { keys: ['↑', '↓', '←', '→'], desc: window.t('Mover nodo seleccionado', 'Move selected node'),
                        help: window.t('Desplaza el nodo elegido paso a paso, para ajustarlo con precisión cuando arrastrar se queda corto.', 'Nudges the selected node step by step, for precision that dragging cannot give.') },
                      { keys: ['Doble Clic'], desc: window.t('Editar texto / Renombrar', 'Edit text / Rename'),
                        help: window.t('Entra a editar el nodo. En pantallas táctiles NO se usa: ahí se edita con el botón "Editar" de la barra del nodo, porque dos toques seguidos son lo que uno hace al arrastrar.', 'Enters edit mode. NOT used on touch screens: there you edit with the "Edit" button on the node bar, since two quick taps is what dragging looks like.') },
                      { keys: ['Clic Derecho'], desc: window.t('Creación rápida / Opciones', 'Quick-create / Options'),
                        help: window.t('Sobre el lienzo vacío abre el menú de crear nodos. Sobre un texto seleccionado ofrece cortar, copiar, pegar y enlazar. Con el dedo equivale a dejar el dedo puesto.', 'On empty canvas it opens the create menu. On selected text it offers cut, copy, paste and link. With a finger, press and hold does the same.') },
                      { keys: ['Tab', 'Enter'], desc: window.t('Navegar y editar celdas (Tablas)', 'Navigate and edit cells (Tables)'),
                        help: window.t('Dentro de una tabla, Tab salta a la celda siguiente y Enter entra a editarla, como en una hoja de cálculo.', 'Inside a table, Tab moves to the next cell and Enter starts editing it, like a spreadsheet.') },
                      { keys: ['Supr', 'Backspace'], desc: window.t('Eliminar elemento', 'Delete item'),
                        help: window.t('Borra los nodos o conectores seleccionados. Dentro de una celda de tabla borra su contenido en lugar del nodo entero.', 'Deletes the selected nodes or connectors. Inside a table cell it clears the cell instead of the whole node.') },
                      { keys: ['Esc'], desc: window.t('Limpiar selección / Cerrar', 'Clear selection / Close'),
                        help: window.t('Sale del modo edición, suelta la herramienta activa y cierra menús y ventanas.', 'Leaves edit mode, drops the active tool, and closes menus and dialogs.') }
                    ].map((sh, idx) => (
                      <div key={idx} className="odi-sh-row" onMouseEnter={(e)=>showTip(e, sh.help)} onMouseLeave={()=>setShortcutTip(null)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '6px 8px', background: 'var(--bg-main, #FAF8F6)', borderRadius: '6px', border: '1.5px solid var(--line-soft, #E5E1DD)' }}>
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
          <div className="odi-dialog" style={{ width: '400px', background: 'var(--bg, #FAF9F6)', border: '1.5px solid var(--line, #595459)', padding: '24px', borderRadius: '12px', boxShadow: 'var(--pop-md)' }} onClick={(e) => e.stopPropagation()}>
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
                      {/* Ya no es cierto que haga falta cuenta para colaborar:
                          las sesiones en vivo funcionan sin ninguna. Decir lo
                          contrario espantaba a quien solo quería entrar con un
                          código. Google hace falta únicamente para Drive. */}
                      {window.t(
                        'Google solo hace falta para guardar tus lienzos en tu Google Drive y llevarlos entre computadores. Para trabajar en vivo con alguien no necesitas cuenta: basta con el código de la sesión.',
                        'Google is only needed to keep your canvases in your own Google Drive and carry them between machines. Working live with someone needs no account at all: the session code is enough.'
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
                        startGoogleAuthFlow(false);
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

                    {/* La salida, aquí mismo. Quien llega a esta ventana desde
                        un celular por la dirección de red se encuentra con que
                        Google no le deja pasar — y lo que quería hacer, entrar
                        al lienzo de alguien, no necesitaba a Google para nada.
                        Antes tenía que cerrar, buscar otro botón y adivinarlo. */}
                    <button
                      className="btn lift"
                      onClick={() => {
                        setUserModalOpen(false);
                        setLoginError(null);
                        setSalaError(null);
                        setJoiningModalOpen(true);
                        window.playAudioTone && window.playAudioTone('click');
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '11px', borderRadius: '8px',
                        border: '1.5px solid var(--line, #595459)',
                        background: 'var(--olive, #6A8546)', color: '#FFFFFF',
                        fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                        boxShadow: 'var(--pop-sm)',
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>sensors</span>
                      <span>{window.t('Unirme a una sesión con un código', 'Join a session with a code')}</span>
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
                      style={{ padding: '8px 12px', fontSize: '12px', fontWeight: '700', borderRadius: '6px', border: '1.5px solid var(--line)', background: '#FFFFFF', color: '#1A1A1A', cursor: 'pointer' }}
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

                {userProfile.accessToken ? (
                  <div style={{ padding: '10px 12px', background: 'rgba(144, 185, 104, 0.1)', border: '1.5px solid var(--brand-green, #90B968)', borderRadius: '8px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-rounded" style={{ color: 'var(--brand-green, #90B968)', fontSize: '18px' }}>check_circle</span>
                    <span style={{ fontWeight: '600', color: 'var(--ink, #1A1A1A)' }}>
                      {window.t('Conectado mediante Google', 'Connected via Google')}
                    </span>
                  </div>
                ) : (
                  <div style={{ padding: '10px 12px', background: 'rgba(230, 84, 79, 0.08)', border: '1.5px solid var(--wine, #E6544F)', borderRadius: '8px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="material-symbols-rounded" style={{ color: 'var(--wine, #E6544F)', fontSize: '18px' }}>sync_problem</span>
                    <span style={{ fontWeight: '600', color: 'var(--ink, #1A1A1A)', flex: 1 }}>
                      {window.t('El acceso a Google Drive caducó (dura ~1 hora).', 'Google Drive access expired (lasts ~1 hour).')}
                    </span>
                    <button
                      className="btn lift"
                      onClick={() => { startGoogleAuthFlow(true); window.playAudioTone && window.playAudioTone('click'); }}
                      style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--olive, #6A8546)', color: 'white', border: 'none', fontWeight: '700', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
                    >
                      {window.t('Renovar', 'Renew')}
                    </button>
                  </div>
                )}

                {/* Solo para quien todavia no tiene corona: al que ya la tiene
                    no hay nada que preguntarle. */}
                {!esPatrocinador && (
                  <window.PanelReclamo onConcedida={() => setEsPatrocinador(true)} />
                )}

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
        // Los tres escalones para poder compartir, en orden. No son opcionales
        // y no se pueden saltar: sin Drive el proyecto no sale de este disco,
        // así que "compartirlo" sería enseñarle a otro una carpeta vacía.
        const conCuenta = !!userProfile;
        const conDrive = !!(userProfile && userProfile.accessToken);
        const enLinea = !!project.isPublic;
        const puedeCompartir = conCuenta && conDrive && enLinea;
        return (
          <div className="doc-modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.45)' }} onClick={() => setSharingModalOpen(false)}>
            <div className="odi-dialog" style={{ width: '480px', background: 'var(--bg, #FAF9F6)', border: '1.5px solid var(--line, #595459)', padding: '24px', borderRadius: '12px', boxShadow: 'var(--pop-md)' }} onClick={(e) => e.stopPropagation()}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '24px', color: 'var(--olive, #6A8546)' }}>share</span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--ink, #1A1A1A)' }}>
                    {window.t('Colaboración en línea', 'Online Collaboration')}
                  </h3>
                </div>
                <button className="icon-btn lift" onClick={() => { setSharingModalOpen(false); }}>
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>

              {/* Esta ventana contesta a DOS preguntas muy distintas, y antes
                  las tenía revueltas: «quiero entrar donde me han invitado» y
                  «quiero abrir esto mío a los demás».

                  La primera no necesita nada de nada: ni cuenta de Google, ni
                  Drive, ni tener nada guardado. La segunda necesita Drive
                  obligatoriamente, porque es donde vive el proyecto en cuanto
                  deja de ser solo tuyo: sin él, quien entre ve los recuadros
                  pero no las imágenes ni los audios, que siguen en tu disco.

                  Por eso ya no hay un interruptor de Drive aparte. Encenderlo
                  y apagarlo por su cuenta dejaba estados que no significan
                  nada —"online sin nube"— y era la forma más rápida de que
                  compartir pareciera roto. Online y Drive son la misma
                  decisión, tomada una sola vez y en un solo sitio. */}

              {/* ── 1. Entrar donde me han invitado ──
                  Desaparece del todo si ya estás dentro de una sesión. Dejarlo
                  ahí apagado, diciendo "ya estás en una sesión", era una caja
                  entera de la ventana ocupada en contarte algo que ya sabías. */}
              {!salaCodigo && (
                <div style={{
                  border: '1.5px solid var(--line-soft, #D5D1CD)', borderRadius: '10px',
                  padding: '14px', marginBottom: '14px', background: 'var(--bg-card, #FFFFFF)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--text-soft)' }}>group_add</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: '13.5px' }}>{window.t('Entrar en la sesión de alguien', 'Join someone\'s session')}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-soft)' }}>
                        {window.t('Solo el código de seis letras. Nada más.', 'Just the six-letter code. Nothing else.')}
                      </div>
                    </div>
                    <button
                      className="btn lift"
                      disabled={salaOcupada}
                      onClick={() => { setSalaError(null); setJoiningModalOpen(true); }}
                      style={{
                        padding: '8px 12px', borderRadius: '8px', flexShrink: 0,
                        background: 'transparent', color: 'var(--ink)',
                        border: '1.5px solid var(--olive, #6A8546)',
                        fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                        opacity: salaOcupada ? 0.5 : 1,
                      }}
                    >
                      {window.t('Unirme', 'Join')}
                    </button>
                  </div>
                </div>
              )}

              {/* ── 2. Abrir este escritorio a los demás ── */}
              <div style={{
                border: '1.5px solid ' + (salaCodigo ? 'var(--brand-green, #90B968)' : 'var(--line-soft, #D5D1CD)'),
                borderRadius: '10px', padding: '14px', marginBottom: '18px',
                background: salaCodigo ? 'rgba(144, 185, 104, 0.08)' : 'var(--bg-card, #FFFFFF)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 20, color: salaCodigo ? 'var(--brand-green, #90B968)' : 'var(--text-soft)' }}>
                    {salaCodigo ? 'sensors' : 'share'}
                  </span>
                  <strong style={{ fontSize: '13.5px' }}>
                    {salaCodigo && !salaAnfitrion
                      ? window.t('Sesión en vivo', 'Live session')
                      : window.t('Compartir este escritorio', 'Share this workspace')}
                  </strong>
                </div>

                {/* Estar DENTRO de una sesión manda sobre todo lo demás — de
                    ahí el `&& !salaCodigo`. Sin él, quien hubiera entrado en la
                    sesión de otro desde un proyecto suyo sin subir a Drive
                    vería la lista de requisitos pendientes y ni rastro del
                    botón de salir de donde está. */}
                {(!puedeCompartir && !salaCodigo) ? (
                  <>
                    <p style={{ margin: '0 0 10px 0', fontSize: '11.5px', color: 'var(--text-soft)', lineHeight: 1.45 }}>
                      {window.t(
                        'Para dejar entrar a alguien, este puesto tiene que estar guardado en tu Google Drive. Es lo que permite que vea las imágenes y los audios, y no unos recuadros vacíos.',
                        'To let anyone in, this workspace has to be saved in your Google Drive. That is what lets them see the images and audio instead of empty frames.'
                      )}
                    </p>

                    {/* Los pasos, en orden y con su estado a la vista. Antes
                        esto eran errores sueltos que aparecían al pulsar, así
                        que no había forma de saber cuánto faltaba. */}
                    {[
                      {
                        hecho: conCuenta,
                        texto: window.t('Inicia sesión con tu cuenta de Google', 'Sign in with your Google account'),
                        accion: window.t('Iniciar sesión', 'Sign in'),
                        alPulsar: () => { setSharingModalOpen(false); setUserModalOpen(true); },
                      },
                      {
                        hecho: conCuenta && conDrive,
                        texto: window.t('Autoriza el acceso a tu Google Drive', 'Authorise access to your Google Drive'),
                        accion: window.t('Autorizar', 'Authorise'),
                        alPulsar: () => { setSharingModalOpen(false); startGoogleAuthFlow(true); },
                      },
                      {
                        hecho: enLinea,
                        texto: window.t('Pon el puesto online (se sube a tu carpeta Odinote)', 'Put the workspace online (uploaded to your Odinote folder)'),
                        accion: window.t('Poner Online', 'Put Online'),
                        alPulsar: () => { togglePublicProject(project.id); window.playAudioTone && window.playAudioTone('click'); },
                      },
                    ].map((paso, i, todos) => {
                      // Solo se ofrece el botón del primer paso que falta: los
                      // de más abajo no se pueden dar todavía.
                      const primeroPendiente = todos.findIndex(p => !p.hecho);
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '7px 9px', marginBottom: '6px', borderRadius: '7px',
                          background: paso.hecho ? 'rgba(144, 185, 104, 0.12)' : 'var(--bg-main, #F1EEEA)',
                          opacity: (!paso.hecho && i !== primeroPendiente) ? 0.55 : 1,
                        }}>
                          <span className="material-symbols-rounded" style={{
                            fontSize: 17, color: paso.hecho ? 'var(--brand-green, #90B968)' : 'var(--text-soft)',
                          }}>
                            {paso.hecho ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span style={{ flex: 1, fontSize: '11.5px', fontWeight: paso.hecho ? 500 : 700, lineHeight: 1.35 }}>
                            {paso.texto}
                          </span>
                          {!paso.hecho && i === primeroPendiente && (
                            <button
                              className="btn lift"
                              onClick={paso.alPulsar}
                              style={{
                                padding: '5px 10px', fontSize: '11px', fontWeight: 700,
                                background: 'var(--olive, #6A8546)', color: 'white',
                                border: 'none', borderRadius: '6px', cursor: 'pointer', flexShrink: 0,
                              }}
                            >
                              {paso.accion}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </>
                ) : !salaCodigo ? (
                  <>
                    <p style={{ margin: '0 0 10px 0', fontSize: '11.5px', color: 'var(--text-soft)', lineHeight: 1.45 }}>
                      {window.t(
                        'Se genera un código; quien lo tenga ve este mismo lienzo a la vez que tú, cada quien con su cursor de color. Los cambios viajan directo entre los dos equipos, sin pasar por ningún servidor.',
                        'A code is generated; whoever has it sees this same canvas at the same time as you, each with a coloured cursor. Changes travel straight between the two machines, through no server.'
                      )}
                    </p>

                    {/* El papel se elige ANTES de dar el código: es el único
                        momento en que uno sabe a quién se lo va a dar. */}
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-soft)', marginBottom: '5px' }}>
                        {window.t('Quien entre con el código podrá:', 'Whoever joins with the code will be able to:')}
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[
                          { id: 'editor', icono: 'edit', texto: window.t('Editar', 'Edit'), pie: window.t('toca el lienzo', 'can change things') },
                          { id: 'lector', icono: 'visibility', texto: window.t('Solo mirar', 'Only look'), pie: window.t('no cambia nada', 'changes nothing') },
                        ].map(op => (
                          <button
                            key={op.id}
                            className="btn"
                            onClick={() => { setSalaRolNuevos(op.id); window.playAudioTone && window.playAudioTone('click'); }}
                            style={{
                              flex: 1, padding: '7px 8px', borderRadius: '7px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                              border: '1.5px solid ' + (salaRolNuevos === op.id ? 'var(--olive, #6A8546)' : 'var(--line-soft, #D5D1CD)'),
                              background: salaRolNuevos === op.id ? 'rgba(106, 133, 70, 0.12)' : 'transparent',
                              color: 'var(--ink)', fontWeight: 700, fontSize: '11.5px',
                            }}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>{op.icono}</span>
                            <span>{op.texto}</span>
                            <span style={{ fontWeight: 500, fontSize: '10px', color: 'var(--text-soft)' }}>· {op.pie}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      className="btn lift"
                      disabled={salaOcupada}
                      onClick={abreSalaEnVivo}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--olive, #6A8546)', color: 'white', border: 'none', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', opacity: salaOcupada ? 0.6 : 1 }}
                    >
                      {salaOcupada ? window.t('Abriendo…', 'Opening…') : window.t('Empezar sesión y crear el código', 'Start session and create the code')}
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ margin: '0 0 8px 0', fontSize: '11.5px', color: 'var(--text-soft)' }}>
                      {salaAnfitrion
                        ? window.t('Dale este código a quien quieras invitar:', 'Give this code to whoever you want to invite:')
                        : window.t('Estás dentro de esta sesión:', 'You are inside this session:')}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{
                        flex: 1, fontFamily: 'var(--font-mono, monospace)', fontSize: '22px', fontWeight: 800,
                        letterSpacing: '0.16em', textAlign: 'center', padding: '10px',
                        background: 'var(--bg-main, #E5E1DD)', borderRadius: '8px', color: 'var(--ink)',
                      }}>{salaCodigo}</code>
                      <button
                        className="btn"
                        onClick={() => {
                          copiaAlPortapapeles(salaCodigo);
                          window.playAudioTone && window.playAudioTone('click');
                          setCodigoCopiado(true);
                          setTimeout(() => setCodigoCopiado(false), 1800);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '9px 12px', borderRadius: '8px',
                          border: '1.5px solid ' + (codigoCopiado ? 'var(--brand-green, #90B968)' : 'var(--line-soft)'),
                          color: codigoCopiado ? 'var(--brand-green, #90B968)' : 'inherit',
                          cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                          transition: 'color 120ms, border-color 120ms',
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                          {codigoCopiado ? 'check' : 'content_copy'}
                        </span>
                        <span>{codigoCopiado ? window.t('Copiado', 'Copied') : window.t('Copiar', 'Copy')}</span>
                      </button>
                    </div>

                    {/* Aquí vivían dos cosas más: mandar el código por correo
                        y elegir el papel del PRÓXIMO que entrara.

                        El correo era un mailto que se parecía como una gota de
                        agua al de "Colaboradores Invitados" de más abajo —misma
                        casilla, mismo botón verde "Invitar"— y hacía algo
                        completamente distinto. Dos invitaciones idénticas a la
                        vista no dan opciones, dan dudas. Para pasar seis letras
                        ya está el botón de copiar, que es lo que hace todo el
                        mundo de todas formas.

                        Y lo del papel del próximo sobraba: cuando entra, ahí
                        abajo está su nombre y se le cambia en un clic, sabiendo
                        ya quién es. Decidirlo a ciegas antes era una fila más
                        de letras mayúsculas para el mismo resultado. */}

                    {/* ── Quién hay dentro AHORA MISMO ──
                        Ojo, esta lista no es la de abajo. Abajo están las
                        cuentas de Google con las que se ha compartido la
                        carpeta, que es algo permanente; aquí están las personas
                        conectadas en este instante, con o sin cuenta. Confundir
                        las dos era lo que hacía imposible echar a alguien: se
                        buscaba en la lista equivocada. */}
                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--line-soft, #E5E1DD)', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-soft)' }}>
                          {window.t('En la sesión ahora', 'In the session now')}
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-soft)' }}>
                          {salaGente.length === 1
                            ? window.t('solo tú, de momento', 'just you, for now')
                            : window.t(`${salaGente.length} personas`, `${salaGente.length} people`)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '170px', overflowY: 'auto' }}>
                        {salaGente.map(persona => {
                          const soyYo = window.__odiVivo && window.__odiVivo.miUid() === persona.uid;
                          const rol = persona.rol || 'editor';
                          return (
                            <div key={persona.uid} style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '6px 9px', borderRadius: '7px',
                              background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--line-soft, #E5E1DD)',
                            }}>
                              <span style={{
                                width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                                background: persona.color || 'var(--line, #595459)',
                              }}/>
                              <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {persona.nombre}
                                {soyYo && <span style={{ fontWeight: 500, color: 'var(--text-soft)' }}> {window.t('(tú)', '(you)')}</span>}
                              </span>

                              {persona.anfitrion ? (
                                <span style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--olive-l, #EAEFE2)', color: 'var(--olive)', borderRadius: '4px', fontWeight: 700 }}>
                                  {window.t('Anfitrión', 'Host')}
                                </span>
                              ) : salaAnfitrion ? (
                                <>
                                  {/* Un interruptor de dos posiciones, no un
                                      desplegable. El <select> lo dibuja el
                                      sistema operativo con su propia tipografía
                                      y su propio menú gris: entre botones
                                      redondeados y hechos a mano cantaba como
                                      una pieza de otro programa. Y para dos
                                      opciones, un desplegable son dos clics y
                                      un menú que tapa la lista; así es uno. */}
                                  <div style={{
                                    display: 'flex', borderRadius: '999px', overflow: 'hidden',
                                    border: '1.5px solid var(--line-soft, #D5D1CD)', flexShrink: 0,
                                  }}>
                                    {[
                                      { id: 'editor', icono: 'edit', texto: window.t('Editor', 'Editor') },
                                      { id: 'lector', icono: 'visibility', texto: window.t('Lector', 'Reader') },
                                    ].map(op => (
                                      <button
                                        key={op.id}
                                        className="btn"
                                        title={op.id === 'editor'
                                          ? window.t('Puede cambiar el lienzo', 'Can change the canvas')
                                          : window.t('Solo puede mirar', 'Can only look')}
                                        onClick={() => { if (rol !== op.id) cambiaRolEnSala(persona.uid, op.id); }}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: '3px',
                                          padding: '3px 9px', border: 'none', cursor: 'pointer',
                                          fontSize: '10.5px', fontWeight: 700,
                                          background: rol === op.id ? 'var(--olive, #6A8546)' : 'transparent',
                                          color: rol === op.id ? '#FFFFFF' : 'var(--text-soft)',
                                        }}
                                      >
                                        <span className="material-symbols-rounded" style={{ fontSize: 13 }}>{op.icono}</span>
                                        <span>{op.texto}</span>
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    className="icon-btn danger"
                                    title={window.t('Sacar de la sesión', 'Remove from session')}
                                    onClick={() => expulsaDeSala(persona)}
                                    style={{ padding: '3px' }}
                                  >
                                    <span className="material-symbols-rounded" style={{ fontSize: 16 }}>person_remove</span>
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--bg-main, #E5E1DD)', color: 'var(--text-soft)', borderRadius: '4px', fontWeight: 700 }}>
                                  {rol === 'lector' ? window.t('Solo lectura', 'Read only') : window.t('Editor', 'Editor')}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      className="btn"
                      onClick={cierraSalaEnVivo}
                      style={{ marginTop: '10px', width: '100%', padding: '7px', borderRadius: '8px', border: '1px solid var(--wine)', color: 'var(--wine)', background: 'transparent', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700 }}
                    >
                      {salaAnfitrion
                        ? window.t('Terminar sesión en vivo', 'End live session')
                        : window.t('Salir de la sesión', 'Leave the session')}
                    </button>
                  </>
                )}

                {salaError && (
                  <p style={{ margin: '10px 0 0 0', fontSize: '11.5px', color: 'var(--wine, #E6544F)', lineHeight: 1.4 }}>
                    {salaError}
                  </p>
                )}
              </div>

              {/* ── 3. La carpeta en Drive: quién más la tiene ──
                  Solo aparece cuando el puesto ya está online, porque antes de
                  eso no hay ninguna carpeta que compartir. */}
              {enLinea && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ padding: '12px', background: 'rgba(144, 185, 104, 0.1)', border: '1.5px solid var(--brand-green, #90B968)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="material-symbols-rounded" style={{ color: 'var(--brand-green, #90B968)' }}>cloud_done</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--brand-green, #90B968)' }}>
                        {window.t('ONLINE, EN TU GOOGLE DRIVE', 'ONLINE, IN YOUR GOOGLE DRIVE')}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-soft)' }}>
                        {window.t('Se guarda en tu carpeta "Odinote". Ocupa espacio de tus 15 GB.', 'Saved in your "Odinote" folder. It uses space from your 15 GB.')}
                      </div>
                    </div>
                    <button
                      className="btn lift"
                      onClick={() => {
                        window.customConfirm(window.t(
                          '¿Poner este puesto offline?\n\n· Deja de subirse a tu Drive (lo que ya está subido se queda ahí).\n· Los colaboradores pierden el acceso.\n· Y no podrás abrir sesiones en vivo desde aquí hasta que lo vuelvas a poner online.',
                          'Take this workspace offline?\n\n· It stops uploading to your Drive (whatever is already there stays).\n· Collaborators lose access.\n· And you will not be able to open live sessions from here until you put it back online.'
                        )).then((accepted) => {
                          if (!accepted) return;
                          if (salaCodigo) cierraSalaEnVivo();
                          togglePublicProject(project.id);
                          window.playAudioTone && window.playAudioTone('click');
                        });
                      }}
                      style={{ padding: '6px 12px', fontSize: '11px', border: '1px solid var(--wine)', color: 'var(--wine)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontWeight: '700' }}
                    >
                      {window.t('Poner Offline', 'Take Offline')}
                    </button>
                  </div>

                  {/* ── Sincronización instantánea ──
                      Apagada de fábrica y a propósito. Con ella, el texto y las
                      posiciones de las notas se guardan en el servidor de
                      Odinote para que los cambios lleguen al instante sin que
                      nadie tenga que estar de anfitrión. Quien no la encienda
                      no manda ni un byte de contenido a ningún servidor, y por
                      eso lo que dice el interruptor está escrito sin rodeos:
                      quien acepta esto merece saber exactamente qué acepta. */}
                  <div style={{
                    border: '1.5px solid ' + (project.sincroInstantanea ? 'var(--brand-green, #90B968)' : 'var(--line-soft, #D5D1CD)'),
                    borderRadius: '8px', padding: '12px',
                    background: project.sincroInstantanea ? 'rgba(144, 185, 104, 0.08)' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="material-symbols-rounded" style={{
                        fontSize: 20, color: project.sincroInstantanea ? 'var(--brand-green, #90B968)' : 'var(--text-soft)',
                      }}>bolt</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: '12.5px' }}>{window.t('Sincronización instantánea', 'Instant sync')}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-soft)', lineHeight: 1.4 }}>
                          {window.t(
                            'Los cambios llegan al momento, sin que nadie tenga que abrir una sesión.',
                            'Changes arrive at once, with nobody having to open a session.'
                          )}
                        </div>
                      </div>
                      <button
                        className="btn lift"
                        onClick={() => {
                          if (project.sincroInstantanea) {
                            setProjects(prev => prev.map(p => p.id === project.id ? { ...p, sincroInstantanea: false } : p));
                            window.playAudioTone && window.playAudioTone('click');
                            return;
                          }
                          window.customConfirm(window.t(
                            '¿Encender la sincronización instantánea para este proyecto?\n\n· El TEXTO de las notas y dónde está cada una se guardan en el servidor de Odinote, no solo en tu Drive. Es lo que permite que los cambios lleguen al instante.\n· Las imágenes y los audios NO: esos siguen en tu Google Drive.\n· Solo pueden verlo las cuentas a las que ya compartiste el proyecto.\n· Puedes apagarla cuando quieras.\n\nEl resto de tus proyectos no se ven afectados.',
                            'Turn on instant sync for this project?\n\n· The TEXT of the notes and where each one sits are stored on Odinote\'s server, not only in your Drive. That is what makes changes arrive at once.\n· Images and audio are NOT: those stay in your Google Drive.\n· Only the accounts you already shared the project with can see it.\n· You can turn it off whenever you like.\n\nYour other projects are not affected.'
                          )).then((acepta) => {
                            if (!acepta) return;
                            setProjects(prev => prev.map(p => p.id === project.id ? { ...p, sincroInstantanea: true } : p));
                            window.playAudioTone && window.playAudioTone('click');
                          });
                        }}
                        style={{
                          padding: '6px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                          cursor: 'pointer', flexShrink: 0,
                          border: '1.5px solid ' + (project.sincroInstantanea ? 'var(--wine)' : 'var(--olive, #6A8546)'),
                          background: project.sincroInstantanea ? 'transparent' : 'var(--olive, #6A8546)',
                          color: project.sincroInstantanea ? 'var(--wine)' : 'white',
                        }}
                      >
                        {project.sincroInstantanea ? window.t('Apagar', 'Turn off') : window.t('Encender', 'Turn on')}
                      </button>
                    </div>
                    {project.sincroInstantanea && (
                      <div style={{ marginTop: '8px', fontSize: '10.5px', color: 'var(--text-soft)', lineHeight: 1.4 }}>
                        {window.t(
                          'El texto de este proyecto se guarda en el servidor de Odinote. Las imágenes y los audios siguen solo en tu Drive.',
                          'This project\'s text is stored on Odinote\'s server. Images and audio remain only in your Drive.'
                        )}
                      </div>
                    )}
                  </div>

                  {/* Un proyecto puesto online con una versión vieja podía
                      quedarse sin la marca de Drive. Aquí se arregla de un
                      botón, en vez de dejar un estado imposible a la vista. */}
                  {!project.useGoogleDrive && (
                    <div style={{ padding: '10px', background: 'rgba(230, 84, 79, 0.06)', border: '1.5px solid var(--wine, #E6544F)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-rounded" style={{ color: 'var(--wine, #E6544F)', fontSize: '18px' }}>sync_problem</span>
                      <span style={{ flex: 1, fontSize: '11.5px', lineHeight: 1.4 }}>
                        {window.t('Este puesto está online pero no se está subiendo a Drive: los invitados verán recuadros vacíos donde haya imágenes.', 'This workspace is online but is not uploading to Drive: guests will see empty frames where the images are.')}
                      </span>
                      <button
                        className="btn lift"
                        onClick={() => {
                          setProjects(prev => prev.map(p => p.id === project.id ? { ...p, useGoogleDrive: true } : p));
                          if (userProfile && userProfile.accessToken) {
                            uploadToGoogleDriveReal({ ...project, useGoogleDrive: true }, canvases, userProfile.accessToken)
                              .then(folderId => {
                                if (folderId) showToast(window.t('Proyecto sincronizado con tu Google Drive (carpeta Odinote).', 'Project synced with your Google Drive (Odinote folder).'));
                                else showToast(window.t('No se pudo subir a Google Drive.', 'Could not upload to Google Drive.'), 'error');
                              });
                          }
                          window.playAudioTone && window.playAudioTone('click');
                        }}
                        style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 700, background: 'var(--olive)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}
                      >
                        {window.t('Sincronizar', 'Sync')}
                      </button>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--line-soft, #E5E1DD)', paddingTop: '16px' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700', color: 'var(--text-soft)' }}>
                      {window.t('Colaboradores Invitados', 'Invited Collaborators')}
                    </h4>
                    <p style={{ margin: '0 0 10px 0', fontSize: '10.5px', color: 'var(--text-soft, #595459)', lineHeight: 1.4 }}>
                      {window.t(
                        'Esto es permanente y va por cuenta de Google: se comparte la carpeta del proyecto en tu Drive y el invitado recibe un correo. No es lo mismo que la sesión en vivo de arriba, que dura lo que dure la conexión.',
                        'This is permanent and goes by Google account: the project folder in your Drive is shared and the guest gets an email. It is not the same as the live session above, which lasts as long as the connection does.'
                      )}
                    </p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !inviteBusy) {
                            setInviteBusy(true);
                            inviteCollaboratorByGoogle(project, inviteEmail).then(ok => {
                              setInviteBusy(false);
                              if (ok) setInviteEmail('');
                            });
                          }
                        }}
                        placeholder={window.t('correo@gmail.com del invitado', 'guest email@gmail.com')}
                        style={{ flex: 1, padding: '7px 10px', fontSize: '12px', border: '1.5px solid var(--line-soft, #D5D1CD)', borderRadius: '6px', background: 'var(--bg-card, #FFFFFF)', color: 'var(--ink, #1A1A1A)' }}
                      />
                      <button
                        className="btn lift"
                        disabled={inviteBusy}
                        onClick={() => {
                          if (inviteBusy) return;
                          setInviteBusy(true);
                          inviteCollaboratorByGoogle(project, inviteEmail).then(ok => {
                            setInviteBusy(false);
                            if (ok) setInviteEmail('');
                          });
                          window.playAudioTone && window.playAudioTone('click');
                        }}
                        style={{ padding: '4px 10px', fontSize: '11px', background: 'var(--olive)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', opacity: inviteBusy ? 0.6 : 1 }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: 13 }}>{inviteBusy ? 'hourglass_top' : 'person_add'}</span>
                        <span>{inviteBusy ? window.t('Invitando...', 'Inviting...') : window.t('Invitar por Google', 'Invite via Google')}</span>
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
                                window.customConfirm(window.t('¿Eliminar a este colaborador? También se revocará su acceso a la carpeta de Drive.', 'Remove this collaborator? Their access to the Drive folder will also be revoked.'))
                                  .then((accepted) => {
                                    if (accepted) {
                                      removeCollaboratorByGoogle(project, col);
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
        // Al pulsar "Unirse", el teclado del móvil fuera.
        //
        // Ocupa media pantalla y tapa justo lo que hay que mirar mientras se
        // espera: en qué paso va la conexión y, si sale mal, el error. Se
        // quita quitándole el foco a la casilla; en el escritorio esto no se
        // nota porque no hay teclado que quitar.
        const intentaEntrar = () => {
          const casilla = tokenInputRef.current;
          const codigo = casilla && casilla.value.trim();
          if (!codigo || salaOcupada) return;
          if (casilla) casilla.blur();
          entraSalaEnVivo(codigo);
        };
        return (
          <div className="doc-modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.45)' }} onClick={() => setJoiningModalOpen(false)}>
            <div className="odi-dialog" style={{ width: '400px', background: 'var(--bg, #FAF9F6)', border: '1.5px solid var(--line, #595459)', padding: '24px', borderRadius: '12px', boxShadow: 'var(--pop-md)' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '24px', color: 'var(--olive, #6A8546)' }}>group_add</span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--ink, #1A1A1A)' }}>
                    {window.t('Unirme a una sesión', 'Join a session')}
                  </h3>
                </div>
                <button className="icon-btn lift" onClick={() => setJoiningModalOpen(false)}>
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  {/* Pedía el formato viejo (odi-tok-xxxx-xxxx), que ya no
                      existe: los códigos de sesión son seis letras. Quien
                      llegaba aquí con el código de un amigo no entendía qué
                      escribir. */}
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-soft, #595459)', marginBottom: '6px' }}>
                    {window.t('Código de la sesión (6 letras)', 'Session code (6 letters)')}
                  </label>
                  <input
                    ref={tokenInputRef}
                    type="text"
                    // En el móvil no se enfoca sola: abrir la ventana y que
                    // salte el teclado tapando el texto que explica de dónde
                    // sale el código es justo lo contrario de ayudar.
                    autoFocus={!(window.odiIsMobile && window.odiIsMobile())}
                    maxLength={8}
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="ABC123"
                    onInput={(e) => { e.target.value = e.target.value.toUpperCase(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') intentaEntrar(); }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '22px',
                      fontWeight: 800,
                      letterSpacing: '0.18em',
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono, monospace)',
                      borderRadius: '8px',
                      border: '1.5px solid var(--line-soft, #E5E1DD)',
                      background: 'var(--bg-card, #FFFFFF)',
                      color: 'var(--text, #1A1A1A)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ padding: '12px', background: 'rgba(106, 133, 70, 0.08)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-soft)', lineHeight: 1.45 }}>
                  {window.t(
                    'Pídele el código a quien abrió la sesión: lo ve en su botón de compartir. No necesitas cuenta de Google para entrar.',
                    'Ask whoever opened the session for the code: they see it under their share button. You need no Google account to join.'
                  )}
                </div>

                {/* En qué punto va la espera.
                    Antes aquí no había nada: se pulsaba "Unirse", el botón se
                    ponía gris, y durante veinticinco segundos la pantalla no
                    decía absolutamente nada. En un móvil eso no se distingue de
                    una aplicación colgada, así que la gente cerraba y volvía a
                    empezar — que además era lo peor que podía hacer. */}
                {salaOcupada && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-soft)' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 17, animation: 'spin 1.5s linear infinite', color: 'var(--olive, #6A8546)' }}>progress_activity</span>
                    <span>
                      {salaPaso === 'enlazando'
                        ? window.t('Te ha contestado. Enlazando los dos equipos…', 'They answered. Linking the two machines…')
                        : salaPaso === 'esperando'
                          ? window.t('Buscando a la otra persona…', 'Looking for the other person…')
                          : window.t('Preparando la conexión…', 'Setting up the connection…')}
                    </span>
                  </div>
                )}

                {salaError && !salaOcupada && (
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--wine, #E6544F)', lineHeight: 1.4 }}>{salaError}</p>
                )}
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
                  disabled={salaOcupada}
                  // Antes esto fabricaba un proyecto FALSO con tres notas de
                  // mentira y decía "conectado con éxito": Firestore estaba
                  // apagado y la rama de verdad nunca se ejecutaba. Ahora abre
                  // una conexión real con el equipo del anfitrión.
                  onClick={intentaEntrar}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: 'var(--olive, #6A8546)',
                    color: 'white',
                    border: 'none',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: salaOcupada ? 'default' : 'pointer',
                    opacity: salaOcupada ? 0.6 : 1
                  }}
                >
                  {salaOcupada ? window.t('Conectando…', 'Connecting…') : window.t('Unirse', 'Join')}
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
          {/* Clase propia y no `doc-modal`: esa es la del editor de documentos,
              que ocupa la pantalla entera a propósito (width y height al 100%).
              El ancho lo pisaba el estilo de aquí, pero el alto no, y por eso
              un aviso de dos líneas salía como una columna de arriba abajo. */}
          <div
            className="odi-dialog"
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
      {updateModal && (
        <div className="doc-modal-overlay" style={{ zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} onClick={() => { if (updateModal.state !== 'downloading') setUpdateModal(null); }}>
          <div style={{ width: '420px', maxWidth: '92vw', background: 'var(--paper, #FAF9F6)', border: '1.5px solid var(--line, #595459)', borderRadius: '14px', boxShadow: 'var(--pop-md)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            {/* Cabecera con gradiente de marca */}
            <div style={{ padding: '22px 24px', background: 'linear-gradient(135deg, var(--olive, #6A8546), var(--brand-green, #90B968))', color: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '30px' }}>
                {updateModal.state === 'uptodate' ? 'verified' : updateModal.state === 'error' ? 'error' : 'rocket_launch'}
              </span>
              <div>
                <div style={{ fontSize: '17px', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
                  {updateModal.state === 'available' && window.t(`Odinote v${updateModal.version} disponible`, `Odinote v${updateModal.version} available`)}
                  {updateModal.state === 'downloading' && window.t('Descargando actualización…', 'Downloading update…')}
                  {updateModal.state === 'uptodate' && window.t('Todo al día', 'You are up to date')}
                  {updateModal.state === 'error' && window.t('No se pudo actualizar', 'Update failed')}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>
                  {window.t(`Versión actual: v${CURRENT_VERSION}`, `Current version: v${CURRENT_VERSION}`)}
                </div>
              </div>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {updateModal.state === 'available' && (
                <>
                  <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: 'var(--ink, #1A1A1A)' }}>
                    {updateModal.assetUrl
                      ? window.t('Se descargará e instalará automáticamente. La app se reiniciará al terminar.', 'It will download and install automatically. The app will restart when finished.')
                      : window.t('Abre la página de descargas para obtener la nueva versión.', 'Open the downloads page to get the new version.')}
                  </p>
                  {updateModal.notes && (
                    <div style={{ maxHeight: '140px', overflowY: 'auto', fontSize: '12px', color: 'var(--text-soft, #595459)', background: 'var(--bg-main, #ECEAE6)', border: '1px solid var(--line-soft, #E5E1DD)', borderRadius: '8px', padding: '10px 12px', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                      {updateModal.notes}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setUpdateModal(null)} style={{ padding: '9px 16px', borderRadius: '8px', border: '1.5px solid var(--line-soft, #D5D1CD)', background: 'transparent', color: 'var(--ink)', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                      {window.t('Más tarde', 'Later')}
                    </button>
                    <button onClick={runAutoUpdate} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'var(--olive, #6A8546)', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>{updateModal.assetUrl ? 'download' : 'open_in_new'}</span>
                      {updateModal.assetUrl ? window.t('Actualizar ahora', 'Update now') : window.t('Abrir descargas', 'Open downloads')}
                    </button>
                  </div>
                </>
              )}

              {updateModal.state === 'downloading' && (
                <div>
                  <div style={{ height: '10px', borderRadius: '999px', background: 'var(--bg-main, #ECEAE6)', overflow: 'hidden', marginBottom: '10px' }}>
                    <div style={{ height: '100%', width: `${updateProgress}%`, background: 'var(--brand-green, #90B968)', transition: 'width 200ms' }}/>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-soft)', textAlign: 'center' }}>
                    {updateProgress}% · {window.t('No cierres la aplicación…', 'Do not close the app…')}
                  </p>
                </div>
              )}

              {(updateModal.state === 'uptodate' || updateModal.state === 'error') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--ink, #1A1A1A)' }}>
                    {updateModal.state === 'uptodate'
                      ? window.t('Ya tienes la versión más reciente de Odinote.', 'You already have the latest version of Odinote.')
                      : window.t('Revisa tu conexión a internet e inténtalo de nuevo, o descarga manualmente desde GitHub.', 'Check your internet connection and try again, or download manually from GitHub.')}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    {updateModal.state === 'error' && (
                      <button onClick={() => window.open('https://github.com/Neuroxcx1/Odinote/releases/latest', '_blank')} style={{ padding: '9px 16px', borderRadius: '8px', border: '1.5px solid var(--line-soft)', background: 'transparent', color: 'var(--ink)', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                        {window.t('Abrir GitHub', 'Open GitHub')}
                      </button>
                    )}
                    <button onClick={() => setUpdateModal(null)} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'var(--olive, #6A8546)', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                      {window.t('Entendido', 'Got it')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            // Abajo a la derecha para no tapar la barra superior ni el lienzo
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            maxWidth: 'min(380px, calc(100vw - 40px))',
            background: 'var(--paper, #FFFFFF)',
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
              0% { transform: translateY(28px); opacity: 0; }
              100% { transform: translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
