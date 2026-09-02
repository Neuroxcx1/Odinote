const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
app.commandLine.appendSwitch('disable-features', 'WinUseBrowserSpellChecker');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow;
let serverInstance;
let activeVaultPath = '';

// Setup a logging path in the app's persistent user data directory
const logPath = path.join(app.getPath('userData'), 'odinote-debug.log');

function logToFile(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logPath, line, 'utf-8');
  } catch (e) {
    // Fail silently if write fails
  }
  console.log(msg);
}

// Clear the log on startup
try {
  fs.writeFileSync(logPath, `=== ODINOTE STARTUP DEBUG LOG ===\nDate: ${new Date().toString()}\nUser Data Path: ${app.getPath('userData')}\n\n`, 'utf-8');
} catch (e) {}

function createWindow() {
  logToFile('Initializing BrowserWindow...');

  const template = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: (item, focusedWindow) => {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools();
          }
        },
        {
          label: 'Toggle Developer Tools (CmdOrCtrl+Shift+I)',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: (item, focusedWindow) => {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools();
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  // backgroundColor evita el destello blanco de Electron antes de que cargue el
  // HTML (coincide con el fondo del splash). show:false + ready-to-show hace que
  // la ventana solo aparezca cuando ya hay algo pintado, no en blanco.
  const savedTheme = (() => {
    try {
      const configPath = path.join(app.getPath('userData'), 'window-theme.txt');
      if (fs.existsSync(configPath)) return fs.readFileSync(configPath, 'utf-8').trim();
    } catch (e) {}
    return 'light';
  })();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, 'Icon/Icon.ico'),
    title: 'Oddinote',
    show: false,
    backgroundColor: savedTheme === 'dark' ? '#232123' : '#F4F3EF',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const { session } = require('electron');
  if (session.defaultSession) {
    try {
      session.defaultSession.clearCache();
      session.defaultSession.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    } catch(e) {}
  }
  if (mainWindow.webContents && mainWindow.webContents.session) {
    try {
      mainWindow.webContents.session.clearCache();
    } catch(e) {}
  }

  if (session.defaultSession) {
    try {
      session.defaultSession.setSpellCheckerLanguages([
        'es-ES', 'es-419', 'es',
        'fr-FR', 'fr',
        'de-DE', 'de',
        'en-US', 'en-GB', 'en',
        'it-IT', 'it',
        'pt-PT', 'pt-BR', 'pt',
        'ru-RU', 'ru'
      ]);
    } catch (err) {
      logToFile(`Error setting initial spellchecker languages: ${err.message}`);
    }
  }

  // Hide default menu bar
  mainWindow.setMenuBarVisibility(false);

  // Redirect renderer console messages to main log
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logToFile(`[RENDERER CONSOLE] [Level ${level}] ${message} (at ${sourceId}:${line})`);
  });

  // Handle spellcheck suggestions and custom HTML context menu
  mainWindow.webContents.on('context-menu', (event, params) => {
    event.preventDefault();
    mainWindow.webContents.send('show-context-menu', {
      x: params.x,
      y: params.y,
      misspelledWord: params.misspelledWord,
      dictionarySuggestions: params.dictionarySuggestions,
      isEditable: params.isEditable,
      selectionText: params.selectionText
    });
  });

  // Open external links in default browser instead of new Electron windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const localPrefix = 'http://127.0.0.1:';
      if (!url.startsWith(localPrefix)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });

  // Start internal static HTTP server
  logToFile('Starting local HTTP server...');
  serverInstance = http.createServer((req, res) => {
    let rawPath = req.url.split('?')[0];
    if (rawPath === '/' || !rawPath) {
      rawPath = '/index.html';
    }

    const decodedPath = decodeURIComponent(rawPath);
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.jsx': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf'
    };

    if (decodedPath.startsWith('/vault-media/')) {
      if (!activeVaultPath) {
        logToFile(`HTTP Server: No active vault path when requesting: ${decodedPath}`);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 No Active Vault');
        return;
      }
      const relativePart = decodedPath.replace('/vault-media/', ''); // e.g., media/web_image_abc.png
      const filePath = path.join(activeVaultPath, relativePart);
      const ext = path.extname(filePath).toLowerCase();

      logToFile(`HTTP Request (Vault): ${req.method} ${req.url} -> Resolved: ${filePath}`);

      fs.readFile(filePath, (err, content) => {
        if (err) {
          logToFile(`[404] Vault file not found: ${filePath} (${err.message})`);
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found in Vault');
        } else {
          res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
          res.end(content);
        }
      });
      return;
    }

    const filePath = path.join(__dirname, decodedPath);
    const ext = path.extname(filePath).toLowerCase();

    logToFile(`HTTP Request: ${req.method} ${req.url} -> Resolved: ${filePath}`);

    fs.readFile(filePath, (err, content) => {
      if (err) {
        logToFile(`[404] File not found or failed to read: ${filePath} (${err.message})`);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(content);
      }
    });
  });

  // Puerto FIJO: localStorage/IndexedDB viven por origen (127.0.0.1:puerto).
  // Con el puerto aleatorio anterior, cada arranque estrenaba un origen vacío:
  // se perdía la sesión de Google, los ids de Drive y el estado local.
  const FIXED_PORT = 38471;
  serverInstance.on('listening', () => {
    const port = serverInstance.address().port;
    logToFile(`Static server running at: http://127.0.0.1:${port}`);
    mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);
  });
  serverInstance.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logToFile(`Port ${FIXED_PORT} busy (another Odinote running?), falling back to a random port — session/local data won't persist this run`);
      serverInstance.listen(0, '127.0.0.1');
    } else {
      logToFile(`Static server error: ${err.message}`);
    }
  });
  serverInstance.listen(FIXED_PORT, '127.0.0.1');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
const configPath = path.join(app.getPath('userData'), 'config.json');

ipcMain.handle('get-vault-path', async () => {
  logToFile('IPC Call: get-vault-path');
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      logToFile(`IPC get-vault-path: Found vault path in config: ${config.vaultPath}`);
      return config.vaultPath || null;
    }
  } catch (err) {
    logToFile(`IPC get-vault-path ERROR: ${err.message}`);
  }
  return null;
});

ipcMain.handle('set-vault-path', async (event, vaultPath) => {
  logToFile(`IPC Call: set-vault-path to ${vaultPath}`);
  try {
    let config = {};
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (e) {}
    }
    config.vaultPath = vaultPath;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    logToFile(`IPC set-vault-path: Saved successfully to config.json.`);
    return true;
  } catch (err) {
    logToFile(`IPC set-vault-path ERROR: ${err.message}`);
    throw err;
  }
});

ipcMain.handle('select-folder', async () => {
  logToFile('IPC Call: select-folder');
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled) {
    logToFile('IPC select-folder: Canceled');
    return null;
  }
  
  let selectedPath = result.filePaths[0];
  
  // 1. If the selected folder already contains "odinote.json", load it directly to preserve saves
  const hasExistingVault = fs.existsSync(path.join(selectedPath, 'odinote.json'));
  
  if (!hasExistingVault) {
    const baseName = path.basename(selectedPath).toLowerCase();
    // 2. Only isolate inside "Odinote" subfolder if the folder base name is not already "odinote"
    if (baseName !== 'odinote') {
      const subPath = path.join(selectedPath, 'Odinote');
      try {
        if (!fs.existsSync(subPath)) {
          fs.mkdirSync(subPath, { recursive: true });
          logToFile(`IPC select-folder: Created subfolder: ${subPath}`);
        }
        selectedPath = subPath;
      } catch (e) {
        logToFile(`IPC select-folder ERROR creating subfolder: ${e.message}`);
      }
    }
  } else {
    logToFile(`IPC select-folder: Existing vault detected in selected path: ${selectedPath}`);
  }
  
  logToFile(`IPC select-folder: Selected Final Path: ${selectedPath}`);
  return selectedPath;
});

// ─────────────────────────────────────────────────────────────
// Bóveda local: un archivo por proyecto
//
// Antes TODO vivía en un único odinote.json. Con un solo archivo, un corte de
// luz a media escritura o una línea corrupta se llevaba por delante todos los
// proyectos a la vez, y no había forma de respaldar o restaurar uno suelto.
// Ahora cada proyecto se guarda además en projects/<id>/project.json.
//
// odinote.json se SIGUE escribiendo igual que siempre, a propósito: es la red
// de seguridad. Si el reparto por proyecto quedara incompleto por lo que sea,
// la lectura lo detecta y vuelve a él sin perder nada.
// ─────────────────────────────────────────────────────────────

// Canvases que pertenecen a un proyecto: su raíz más los tableros anidados,
// que se alcanzan siguiendo el canvasId de cada nodo "board".
function canvasesOfProject(allCanvases, rootId) {
  const out = {};
  const visit = (id) => {
    const c = allCanvases[id];
    if (!c || out[id]) return;
    out[id] = c;
    (c.items || []).forEach(it => { if (it.canvasId) visit(it.canvasId); });
  };
  visit(rootId);
  return out;
}

function readSplitVault(folderPath) {
  const projectsDir = path.join(folderPath, 'projects');
  if (!fs.existsSync(projectsDir)) return null;

  const projects = [];
  const canvases = {};
  let meta = {};
  for (const entry of fs.readdirSync(projectsDir)) {
    const file = path.join(projectsDir, entry, 'project.json');
    if (!fs.existsSync(file)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (parsed.project) projects.push(parsed.project);
      Object.assign(canvases, parsed.canvases || {});
      if (parsed.meta) meta = parsed.meta;
    } catch (err) {
      // Un proyecto ilegible ya no se lleva a los demás por delante: se anota
      // y se sigue con el resto.
      logToFile(`read-vault: ${entry}/project.json ilegible (${err.message}), se omite`);
    }
  }
  if (!projects.length) return null;
  return { ...meta, projects, canvases };
}

ipcMain.handle('read-vault', async (event, folderPath) => {
  logToFile(`IPC Call: read-vault at ${folderPath}`);
  activeVaultPath = folderPath;
  const filePath = path.join(folderPath, 'odinote.json');
  try {
    const split = readSplitVault(folderPath);
    const legacy = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : null;

    // Se usa el reparto por proyecto salvo que el archivo antiguo tenga MÁS
    // proyectos: eso significaría que el reparto se quedó a medias, y perder
    // proyectos en silencio es lo único inaceptable aquí.
    if (split) {
      const legacyCount = (legacy && legacy.projects && legacy.projects.length) || 0;
      if (split.projects.length >= legacyCount) {
        logToFile(`IPC read-vault: leídos ${split.projects.length} proyectos de projects/`);
        return split;
      }
      logToFile(`IPC read-vault: projects/ tiene ${split.projects.length} y odinote.json ${legacyCount}; se usa odinote.json`);
    }

    if (legacy) {
      logToFile(`IPC read-vault: Found odinote.json. Read successfully.`);
      return legacy;
    }
    logToFile(`IPC read-vault: odinote.json not found.`);
    return null;
  } catch (err) {
    logToFile(`IPC read-vault ERROR: ${err.message}`);
    throw err;
  }
});

ipcMain.handle('write-vault', async (event, { folderPath, data }) => {
  logToFile(`IPC Call: write-vault at ${folderPath}`);
  activeVaultPath = folderPath;
  const filePath = path.join(folderPath, 'odinote.json');
  try {
    // 1. El archivo completo de siempre. Se escribe PRIMERO y pase lo que pase:
    // es el respaldo del que tira la lectura si el reparto sale mal.
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    // 2. Y además, un archivo por proyecto.
    try {
      const { projects = [], canvases = {}, ...meta } = data || {};
      const projectsDir = path.join(folderPath, 'projects');
      fs.mkdirSync(projectsDir, { recursive: true });

      const alive = new Set();
      for (const project of projects) {
        if (!project || !project.id) continue;
        const safeId = String(project.id).replace(/[^a-zA-Z0-9._-]/g, '_');
        alive.add(safeId);
        const dir = path.join(projectsDir, safeId);
        fs.mkdirSync(dir, { recursive: true });
        const payload = { meta, project, canvases: canvasesOfProject(canvases, project.id) };
        // Escritura atómica: a un archivo temporal y luego renombrar. Si se corta
        // la corriente a media escritura, el project.json anterior sigue entero
        // en vez de quedarse truncado.
        const tmp = path.join(dir, 'project.json.tmp');
        fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
        fs.renameSync(tmp, path.join(dir, 'project.json'));
      }

      // Carpetas de proyectos que ya no existen: se retiran para que la bóveda
      // no acumule restos. Solo se toca lo que tenga un project.json nuestro.
      for (const entry of fs.readdirSync(projectsDir)) {
        if (alive.has(entry)) continue;
        const stale = path.join(projectsDir, entry);
        if (fs.existsSync(path.join(stale, 'project.json'))) {
          fs.rmSync(stale, { recursive: true, force: true });
          logToFile(`write-vault: retirada la carpeta del proyecto eliminado ${entry}`);
        }
      }
    } catch (splitErr) {
      // El reparto es una mejora, no un requisito: si falla, odinote.json ya
      // está escrito y la app sigue funcionando exactamente como antes.
      logToFile(`write-vault: el reparto por proyecto falló (${splitErr.message}); odinote.json sí se guardó`);
    }

    logToFile(`IPC write-vault: Saved successfully.`);
    return true;
  } catch (err) {
    logToFile(`IPC write-vault ERROR: ${err.message}`);
    throw err;
  }
});

ipcMain.handle('save-media', async (event, { folderPath, fileName, base64Data }) => {
  logToFile(`IPC Call: save-media at ${folderPath} with name: ${fileName}`);
  const mediaDir = path.join(folderPath, 'media');
  try {
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    // Convert base64 to binary buffer and generate content-based hash
    const base64Content = base64Data.split(',')[1] || base64Data;
    const buffer = Buffer.from(base64Content, 'base64');
    
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(base64Content).digest('hex').slice(0, 16);

    const fileExt = path.extname(fileName) || '.png';
    const baseName = path.basename(fileName, fileExt).replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalName = `${baseName}_${hash}${fileExt}`;
    const destPath = path.join(mediaDir, finalName);

    // De-duplication check: if file already exists, reuse it and skip writing
    if (fs.existsSync(destPath)) {
      logToFile(`IPC save-media: File already exists on disk, reusing: media/${finalName}`);
      return `media/${finalName}`;
    }

    fs.writeFileSync(destPath, buffer);
    logToFile(`IPC save-media: Saved successfully to media/${finalName}`);
    return `media/${finalName}`;
  } catch (err) {
    logToFile(`IPC save-media ERROR: ${err.message}`);
    throw err;
  }
});

ipcMain.handle('replace-misspelling', async (event, suggestion) => {
  if (mainWindow) {
    mainWindow.webContents.replaceMisspelling(suggestion);
  }
  return true;
});

ipcMain.handle('add-to-dictionary', async (event, word) => {
  if (mainWindow && mainWindow.webContents.session) {
    mainWindow.webContents.session.addWordToSpellCheckerDictionary(word);
  }
  return true;
});

ipcMain.handle('set-spellchecker-languages', async (event, langs) => {
  const { session } = require('electron');
  if (session.defaultSession) {
    try {
      session.defaultSession.setSpellCheckerLanguages(langs);
      logToFile(`Spellchecker languages set to: ${langs.join(', ')}`);
      return true;
    } catch (err) {
      logToFile(`Error setting spellchecker languages: ${err.message}`);
    }
  }
  return false;
});

ipcMain.handle('open-custom-dictionary', async () => {
  logToFile('IPC Call: open-custom-dictionary');
  const dictPath = path.join(app.getPath('userData'), 'Custom Dictionary.txt');
  try {
    if (!fs.existsSync(dictPath)) {
      fs.writeFileSync(dictPath, '', 'utf-8');
    }
    await shell.openPath(dictPath);
    return true;
  } catch (err) {
    logToFile(`IPC open-custom-dictionary ERROR: ${err.message}`);
    return false;
  }
});

const writeDictionaryGrouped = (dictPath, words) => {
  const spanishPattern = /[áéíóúñüÁÉÍÓÚÑÜ]/i;
  const esWords = Array.from(new Set(words.filter(w => spanishPattern.test(w) && !w.startsWith('[') && !w.includes('checksum')))).sort();
  const enWords = Array.from(new Set(words.filter(w => !spanishPattern.test(w) && !w.startsWith('[') && !w.includes('checksum')))).sort();
  
  let newContent = '';
  if (esWords.length > 0) {
    newContent += '[spanish]\n' + esWords.join('\n') + '\n\n';
  }
  if (enWords.length > 0) {
    newContent += '[english]\n' + enWords.join('\n') + '\n\n';
  }
  newContent += 'checksum_v1 = 7535b60698ebf565ca21f40b422470c8\n';
  fs.writeFileSync(dictPath, newContent, 'utf-8');
};

ipcMain.handle('get-custom-dictionary-words', async () => {
  logToFile('IPC Call: get-custom-dictionary-words');
  const dictPath = path.join(app.getPath('userData'), 'Custom Dictionary.txt');
  try {
    if (fs.existsSync(dictPath)) {
      const content = fs.readFileSync(dictPath, 'utf-8');
      const words = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.includes('checksum') && !line.startsWith('['));
      
      // Re-ordenar y estructurar el archivo fisico
      writeDictionaryGrouped(dictPath, words);
      return words;
    }
  } catch (err) {
    logToFile(`IPC get-custom-dictionary-words ERROR: ${err.message}`);
  }
  return [];
});

ipcMain.handle('remove-word-from-dictionary', async (event, word) => {
  logToFile(`IPC Call: remove-word-from-dictionary for word: ${word}`);
  const dictPath = path.join(app.getPath('userData'), 'Custom Dictionary.txt');
  try {
    if (fs.existsSync(dictPath)) {
      const content = fs.readFileSync(dictPath, 'utf-8');
      const words = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.includes('checksum') && !line.startsWith('[') && line !== word);
      
      writeDictionaryGrouped(dictPath, words);
      return true;
    }
  } catch (err) {
    logToFile(`IPC remove-word-from-dictionary ERROR: ${err.message}`);
  }
  return false;
});

ipcMain.handle('open-user-data-folder', async () => {
  logToFile('IPC Call: open-user-data-folder');
  try {
    await shell.openPath(app.getPath('userData'));
    return true;
  } catch (err) {
    logToFile(`IPC open-user-data-folder ERROR: ${err.message}`);
    return false;
  }
});

ipcMain.handle('fetch-image-base64', async (event, url) => {
  logToFile(`IPC Call: fetch-image-base64 for ${url}`);
  try {
    const { net } = require('electron');
    const response = await net.fetch(url);
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    logToFile(`IPC fetch-image-base64 ERROR: ${err.message}`);
    throw err;
  }
});

ipcMain.handle('download-media-to-vault', async (event, { folderPath, url, fileName }) => {
  logToFile(`IPC Call: download-media-to-vault from ${url} to vault ${folderPath}`);
  try {
    const path = require('path');
    const fs = require('fs');
    const { net } = require('electron');
    
    const mediaDir = path.join(folderPath, 'media');
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
    
    // Descargar imagen usando Electron native net API con User-Agent de navegador
    const response = await net.fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) throw new Error(`HTTP status ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Generar un hash único del contenido para evitar duplicados
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
    
    const contentType = response.headers.get('content-type') || 'image/png';
    let fileExt = '.png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) fileExt = '.jpg';
    else if (contentType.includes('gif')) fileExt = '.gif';
    else if (contentType.includes('webp')) fileExt = '.webp';
    else if (contentType.includes('svg')) fileExt = '.svg';
    else if (contentType.includes('png')) fileExt = '.png';
    else {
      fileExt = path.extname(fileName) || '.png';
    }

    const baseName = path.basename(fileName, path.extname(fileName) || '.png').replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalName = `${baseName}_${hash}${fileExt}`;
    const destPath = path.join(mediaDir, finalName);
    
    if (!fs.existsSync(destPath)) {
      fs.writeFileSync(destPath, buffer);
      logToFile(`IPC download-media-to-vault: Saved successfully to media/${finalName}`);
    } else {
      logToFile(`IPC download-media-to-vault: Reuse existing: media/${finalName}`);
    }
    return `media/${finalName}`;
  } catch (err) {
    logToFile(`IPC download-media-to-vault ERROR: ${err.message}`);
    throw err;
  }
});

let authServer = null;
let authPort = 61234;
// Secreto de un solo uso para el inicio de sesión en curso. Se inyecta en la
// página que servimos y se exige de vuelta al recibir el perfil: así el único
// que puede entregarnos una sesión es la pestaña que abrimos nosotros.
let authNonce = null;

// =====================================================
// ACCESO A GOOGLE DRIVE QUE NO CADUCA CADA HORA
//
// Hasta ahora la sesión se abría con Firebase, que devuelve un permiso de Drive
// de una hora y NADA con lo que renovarlo: Firebase renueva su propia sesión,
// no el permiso de Google. Por eso al cabo de una hora la aplicación tenía que
// volver a pedir que te conectaras, una y otra vez.
//
// Aquí se habla directamente con Google, pidiendo `access_type=offline`. Google
// devuelve entonces un TOKEN DE REFRESCO: un papel con el que se puede pedir un
// permiso nuevo cuando el de una hora caduca, sin molestar a nadie.
//
// Ese papel se guarda SOLO en el equipo del usuario, cifrado con `safeStorage`
// de Electron (que en Windows usa DPAPI, atado a su cuenta del sistema). No hay
// servidor, no hay base de datos, y no pasa por ningún sitio nuestro.
//
// Sobre las credenciales, porque hay un matiz que confunde:
//
// Google EXIGE el "secreto de cliente" también en los clientes de escritorio,
// aunque se use PKCE. Lo dice su documentación del flujo para aplicaciones
// instaladas, y sin él el canje falla con "client_secret is missing".
//
// Ahora bien, de secreto tiene poco: en un programa que se descarga ese valor
// viaja dentro del ejecutable y cualquiera puede sacarlo con un editor de
// texto. Google lo asume. Lo que protege el flujo NO es ese valor, sino PKCE:
// cada intento se firma con un número inventado en el momento que solo conoce
// este proceso, así que un código robado por el camino no le sirve a nadie.
//
// Aun así no se escriben aquí, sino en google-oauth.json, que NO va al
// repositorio. Dos razones: la protección de GitHub bloquea la subida en
// cuanto reconoce el patrón, y si algún día hay que cambiar las credenciales
// se cambian sin reescribir el historial. El archivo sí entra en el ejecutable
// al empaquetar, así que quien descarga el programa no nota nada.
//
// Quien clone el repositorio para compilarlo tendrá que crear las suyas: está
// explicado en google-oauth.example.json y en el README.
// =====================================================
function leeCredenciales() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'google-oauth.json'), 'utf-8'));
    if (cfg && cfg.client_id && cfg.client_secret) return cfg;
    logToFile('google-oauth.json existe pero le faltan client_id o client_secret.');
  } catch (e) {
    logToFile('Sin google-oauth.json: la conexión con Google Drive queda desactivada.');
  }
  return null;
}

const CREDENCIALES = leeCredenciales();
const GOOGLE_CLIENT_ID = CREDENCIALES ? CREDENCIALES.client_id : null;
const GOOGLE_CLIENT_SECRET = CREDENCIALES ? CREDENCIALES.client_secret : null;
const GOOGLE_SCOPES = [
  // `openid` no pide ni un permiso más de los que ya se piden: lo que hace es
  // que Google devuelva, además del permiso para Drive, un CARNET firmado
  // (id_token) que demuestra de quién es esta sesión.
  //
  // Hace falta para el modo instantáneo. Las reglas del servidor tienen que
  // poder comprobar que quien escribe en un proyecto es alguien invitado a él,
  // y para eso necesitan un correo que no se pueda falsear desde el programa.
  // La versión web ya lo tenía por entrar con Firebase; el escritorio, con su
  // flujo propio, se identificaba solo ante Drive y ante nadie más.
  'openid',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

let pkceVerifier = null;   // el valor de un solo uso del intento en curso
let pkceState = null;      // para reconocer que la respuesta es de nuestro intento

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function nuevoPkce() {
  const crypto = require('crypto');
  pkceVerifier = base64url(crypto.randomBytes(48));
  pkceState = base64url(crypto.randomBytes(18));
  const challenge = base64url(crypto.createHash('sha256').update(pkceVerifier).digest());
  return { challenge, state: pkceState };
}

function urlDeAutorizacion() {
  const { challenge, state } = nuevoPkce();
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `http://127.0.0.1:${authPort}/oauth`,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    // Sin esto Google no da token de refresco, que es justo lo que buscamos.
    access_type: 'offline',
    // Y sin esto solo lo da la PRIMERA vez que el usuario acepta: si ya había
    // aceptado antes, las siguientes veces volvería sin él y estaríamos igual.
    prompt: 'consent',
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

// Habla con Google para cambiar un papel por otro. Vale tanto para el primer
// canje (código → tokens) como para las renovaciones (refresco → permiso nuevo).
function pideTokens(cuerpo) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const datos = new URLSearchParams(cuerpo).toString();
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(datos),
      },
    }, (res) => {
      let out = '';
      res.on('data', c => { out += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(out);
          if (res.statusCode >= 400) return reject(new Error(json.error_description || json.error || `HTTP ${res.statusCode}`));
          resolve(json);
        } catch (e) { reject(new Error('Respuesta ilegible de Google')); }
      });
    });
    req.on('error', reject);
    req.write(datos);
    req.end();
  });
}

// ── Guardar el token de refresco en este equipo, cifrado ──
function rutaRefresco() {
  return path.join(app.getPath('userData'), 'google-refresh.bin');
}

function guardaRefresco(token) {
  try {
    const { safeStorage } = require('electron');
    if (!token) return false;
    if (safeStorage.isEncryptionAvailable()) {
      fs.writeFileSync(rutaRefresco(), safeStorage.encryptString(token));
      logToFile('Token de refresco guardado (cifrado).');
      return true;
    }
    // Sin cifrado disponible NO se guarda en claro: preferimos que vuelva a
    // pedir la sesión antes que dejar la llave escrita en un archivo legible.
    logToFile('safeStorage no disponible: no se guarda el token de refresco.');
    return false;
  } catch (e) {
    logToFile(`Error guardando el token de refresco: ${e.message}`);
    return false;
  }
}

function leeRefresco() {
  try {
    const { safeStorage } = require('electron');
    const ruta = rutaRefresco();
    if (!fs.existsSync(ruta) || !safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(fs.readFileSync(ruta)) || null;
  } catch (e) {
    logToFile(`Error leyendo el token de refresco: ${e.message}`);
    return null;
  }
}

function borraRefresco() {
  try { fs.unlinkSync(rutaRefresco()); } catch (e) {}
}

// Datos de la persona, para enseñar su nombre y su foto en la aplicación.
function pidePerfil(accessToken) {
  return new Promise((resolve) => {
    const https = require('https');
    https.get({
      hostname: 'www.googleapis.com',
      path: '/oauth2/v3/userinfo',
      headers: { Authorization: 'Bearer ' + accessToken },
    }, (res) => {
      let out = '';
      res.on('data', c => { out += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(out)); } catch (e) { resolve({}); }
      });
    }).on('error', () => resolve({}));
  });
}

function startAuthServer() {
  if (authServer) return;
  const http = require('http');
  const fs = require('fs');
  const path = require('path');

  authServer = http.createServer((req, res) => {
    // Este servidor escucha en 127.0.0.1 mientras dura el login. Antes
    // respondía con `Access-Control-Allow-Origin: *`, así que CUALQUIER web
    // abierta en el navegador podía enviarle un perfil falso —con el token de
    // Drive de un atacante— y la app habría sincronizado los proyectos del
    // usuario contra la cuenta equivocada. Ahora solo aceptamos peticiones de
    // nuestro propio origen y con el nonce correcto.
    const origin = req.headers.origin;
    const allowedOrigins = [`http://localhost:${authPort}`, `http://127.0.0.1:${authPort}`];
    if (origin && !allowedOrigins.includes(origin)) {
      logToFile(`Auth server: origen rechazado (${origin})`);
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (req.method === 'POST' && req.url === '/auth-success') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
        // Un cuerpo enorme solo puede ser basura: cortamos por lo sano.
        if (body.length > 64 * 1024) { req.destroy(); }
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          if (!authNonce || payload.nonce !== authNonce) {
            logToFile('Auth server: nonce inválido, perfil descartado');
            res.writeHead(401);
            res.end('Unauthorized');
            return;
          }
          authNonce = null; // un solo uso
          const profile = {
            name: payload.name,
            email: payload.email,
            picture: payload.picture,
            accessToken: payload.accessToken,
          };
          logToFile(`Received auth-success via POST for ${profile.email}`);
          if (mainWindow) {
            mainWindow.webContents.send('google-signin-completed', profile);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));

          setTimeout(() => {
            if (authServer) {
              authServer.close();
              authServer = null;
            }
          }, 1000);
        } catch (err) {
          logToFile(`Error parsing auth POST body: ${err.message}`);
          res.writeHead(400);
          res.end('Bad Request');
        }
      });
    } else if (req.url.startsWith('/oauth')) {
      // Google devuelve aquí al usuario tras aceptar. Llega el código de un solo
      // uso, que se cambia por el permiso y —lo importante— por el token de
      // refresco. Todo esto ocurre en este equipo; el navegador solo trae el
      // código y se le enseña una página de "ya puedes cerrar".
      const url = new URL(req.url, `http://127.0.0.1:${authPort}`);
      const code = url.searchParams.get('code');
      const estado = url.searchParams.get('state');
      const errorGoogle = url.searchParams.get('error');

      const cierra = (titulo, texto, ok) => {
        res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><title>${titulo}</title>` +
          `<body style="font-family:system-ui;background:#14121F;color:#EDEAF6;display:grid;place-items:center;height:100vh;margin:0">` +
          `<div style="text-align:center;max-width:420px;padding:24px">` +
          `<div style="font-size:44px;margin-bottom:10px">${ok ? '✓' : '✕'}</div>` +
          `<h1 style="font-size:19px;margin:0 0 8px">${titulo}</h1>` +
          `<p style="opacity:.7;font-size:14px;margin:0">${texto}</p></div></body>`);
      };

      if (errorGoogle) {
        logToFile(`OAuth: Google devolvió error "${errorGoogle}"`);
        cierra('No se pudo conectar', 'Vuelve a Oddinote e inténtalo otra vez.', false);
        if (mainWindow) mainWindow.webContents.send('google-signin-failed', { error: errorGoogle });
        return;
      }
      if (!code || !estado || estado !== pkceState || !pkceVerifier) {
        // La respuesta no es del intento que abrimos nosotros: se descarta.
        logToFile('OAuth: respuesta descartada (estado o verificador que no cuadran)');
        cierra('Petición no válida', 'Vuelve a Oddinote y empieza la conexión de nuevo.', false);
        return;
      }

      const verificador = pkceVerifier;
      pkceVerifier = null; pkceState = null;   // un solo uso

      pideTokens({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        code_verifier: verificador,
        grant_type: 'authorization_code',
        redirect_uri: `http://127.0.0.1:${authPort}/oauth`,
      }).then(async (tok) => {
        const guardado = guardaRefresco(tok.refresh_token);
        const perfil = await pidePerfil(tok.access_token);
        logToFile(`OAuth: sesión iniciada para ${perfil.email || '?'} (refresco ${guardado ? 'guardado' : 'NO guardado'})`);
        if (mainWindow) {
          mainWindow.webContents.send('google-signin-completed', {
            name: perfil.name || 'Google User',
            email: perfil.email || '',
            picture: perfil.picture || '',
            accessToken: tok.access_token,
            // El carnet firmado, para que el escritorio pueda identificarse
            // también ante Firebase (ver `openid` arriba). Si Google no lo
            // manda, no pasa nada: todo lo demás sigue funcionando igual y
            // solo se queda fuera el modo instantáneo.
            idToken: tok.id_token || null,
            // Con esto la aplicación sabe si puede renovar sola o si tendrá que
            // volver a pedir la sesión cuando caduque.
            puedeRenovar: guardado,
          });
        }
        cierra('Ya está', 'Puedes cerrar esta pestaña y volver a Oddinote.', true);
        setTimeout(() => { if (authServer) { authServer.close(); authServer = null; } }, 1500);
      }).catch((err) => {
        logToFile(`OAuth: fallo al canjear el código — ${err.message}`);
        cierra('No se pudo completar', err.message, false);
        if (mainWindow) mainWindow.webContents.send('google-signin-failed', { error: err.message });
      });
    } else if (req.url.startsWith('/local-login.html') || req.url === '/' || req.url.startsWith('/?code=')) {
      const filePath = path.join(__dirname, 'local-login.html');
      fs.readFile(filePath, 'utf-8', (err, content) => {
        if (err) {
          res.writeHead(500);
          res.end('Error loading local-login.html');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content.replace('__ODINOTE_AUTH_NONCE__', authNonce || ''));
        }
      });
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  authServer.listen(authPort, '127.0.0.1', () => {
    logToFile(`Auth local server listening on http://127.0.0.1:${authPort}`);
  });

  authServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      authPort++;
      authServer.close();
      authServer = null;
      startAuthServer();
    } else {
      logToFile(`Auth server error: ${err.message}`);
    }
  });
}

// Guarda el tema para que el próximo arranque pinte el fondo de la ventana acorde
// (evita destello claro↔oscuro antes de que cargue el HTML).
ipcMain.handle('set-window-theme', async (event, theme) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'window-theme.txt');
    fs.writeFileSync(configPath, theme === 'dark' ? 'dark' : 'light', 'utf-8');
  } catch (e) {}
  return { ok: true };
});

ipcMain.handle('start-google-login', async () => {
  logToFile('IPC Call: start-google-login');
  // Sin credenciales no se abre nada: más vale decirlo con todas las letras que
  // mandar al usuario a una página de Google que va a fallar sin explicación.
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return {
      ok: false,
      error: 'sin-credenciales',
      mensaje: 'Esta compilación no trae credenciales de Google (falta App/google-oauth.json), ' +
        'así que no puede conectarse a Drive. Si has compilado tú el programa, crea ese archivo ' +
        'siguiendo google-oauth.example.json.',
    };
  }
  authNonce = require('crypto').randomBytes(24).toString('hex');
  startAuthServer();
  // Se va directo a Google en vez de pasar por la página de Firebase: ese
  // rodeo era justo lo que impedía obtener el token de refresco.
  shell.openExternal(urlDeAutorizacion());
  return { ok: true };
});

// Renovar el permiso de Drive sin molestar al usuario. La aplicación llama aquí
// cuando Drive contesta 401, y sigue trabajando con el permiso nuevo.
ipcMain.handle('google-refresh-access', async () => {
  const refresco = leeRefresco();
  if (!refresco) return { ok: false, reason: 'sin-refresco' };
  try {
    const tok = await pideTokens({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refresco,
      grant_type: 'refresh_token',
    });
    logToFile('OAuth: permiso de Drive renovado en silencio.');
    // Se devuelve tambien el carnet firmado, no solo el permiso de Drive.
    // Google lo incluye en el refresco porque entre los permisos va `openid`,
    // y es lo unico con lo que la aplicacion puede volver a identificarse ante
    // Firebase al arrancar sin pedirle nada a nadie.
    return { ok: true, accessToken: tok.access_token, idToken: tok.id_token || null, expiresIn: tok.expires_in || 3600 };
  } catch (err) {
    logToFile(`OAuth: no se pudo renovar — ${err.message}`);
    // Si Google dice que el papel ya no vale (revocado, contraseña cambiada, o
    // caducado por tener la app en modo de prueba), se tira y se pedirá sesión.
    if (/invalid_grant|expired|revoked/i.test(err.message)) borraRefresco();
    return { ok: false, reason: err.message };
  }
});

// ¿Hay guardado un permiso con el que renovar? Lo pregunta la aplicación al
// arrancar, para saber si puede reconectarse sola.
ipcMain.handle('google-has-refresh', async () => ({ ok: !!leeRefresco() }));

// ── Foto del lienzo ──
//
// Se captura la ventana de verdad y se recorta al trozo que ocupa el lienzo, en
// vez de redibujar el contenido en un <canvas>. Redibujarlo obliga a arrastrar
// una libreria que reinterpreta el CSS por su cuenta, y lo que sale nunca es
// exactamente lo que habia en pantalla: las sombras, las tipografias y los
// degradados salen aproximados. Aqui lo que se guarda es literalmente lo que se
// estaba viendo, que es lo que se pide cuando se pide una captura.
ipcMain.handle('capturar-lienzo', async (evt, recorte) => {
  try {
    if (!mainWindow) return { ok: false, motivo: 'sin-ventana' };

    // Los numeros vienen del navegador en pixeles CSS y capturePage los quiere
    // enteros; medio pixel de mas y Electron devuelve una imagen vacia.
    const rect = {
      x: Math.max(0, Math.round(recorte.x)),
      y: Math.max(0, Math.round(recorte.y)),
      width: Math.max(1, Math.round(recorte.width)),
      height: Math.max(1, Math.round(recorte.height)),
    };

    const imagen = await mainWindow.webContents.capturePage(rect);
    if (imagen.isEmpty()) return { ok: false, motivo: 'vacia' };

    const sugerido = 'odinote-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
    const destino = await dialog.showSaveDialog(mainWindow, {
      title: 'Guardar la captura',
      defaultPath: path.join(app.getPath('pictures'), sugerido),
      filters: [{ name: 'Imagen PNG', extensions: ['png'] }],
    });
    if (destino.canceled || !destino.filePath) return { ok: false, motivo: 'cancelado' };

    fs.writeFileSync(destino.filePath, imagen.toPNG());
    logToFile('Captura del lienzo guardada en ' + destino.filePath);
    return { ok: true, ruta: destino.filePath };
  } catch (err) {
    logToFile('No se pudo capturar el lienzo: ' + err.message);
    return { ok: false, motivo: err.message };
  }
});

// Cerrar sesión: se borra el papel de este equipo.
ipcMain.handle('google-sign-out', async () => { borraRefresco(); return { ok: true }; });

// Descarga el instalador (.exe) del último release y lo lanza, para actualizar
// sin que el usuario tenga que ir a GitHub. Devuelve { ok } o { ok:false, error }.
ipcMain.handle('download-and-run-update', async (event, { url, fileName }) => {
  logToFile(`IPC Call: download-and-run-update ${url}`);
  try {
    const path = require('path');
    const fs = require('fs');
    const os = require('os');
    const { net } = require('electron');

    const safeName = (fileName || 'Odinote-Setup.exe').replace(/[^a-zA-Z0-9._-]/g, '_');
    const destPath = path.join(os.tmpdir(), safeName);

    const response = await net.fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // Descarga en streaming para poder informar el progreso
    const total = Number(response.headers.get('content-length')) || 0;
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total && mainWindow) {
        mainWindow.webContents.send('update-download-progress', Math.round((received / total) * 100));
      }
    }
    fs.writeFileSync(destPath, Buffer.concat(chunks.map(c => Buffer.from(c))));
    logToFile(`Update installer saved to ${destPath}, launching...`);

    // Lanzar el instalador y cerrar la app para que pueda reemplazar los archivos
    const opened = await shell.openPath(destPath);
    if (opened) throw new Error(opened); // openPath devuelve string de error si falla
    setTimeout(() => app.quit(), 1200);
    return { ok: true };
  } catch (err) {
    logToFile(`download-and-run-update ERROR: ${err.message}`);
    return { ok: false, error: err.message };
  }
});


app.whenReady().then(() => {
  logToFile('App whenReady triggered.');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logToFile('App window-all-closed triggered.');
  if (serverInstance) {
    serverInstance.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
