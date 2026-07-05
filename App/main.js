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
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, 'Icon/Icon.ico'),
    title: 'Odinote',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    }
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

ipcMain.handle('read-vault', async (event, folderPath) => {
  logToFile(`IPC Call: read-vault at ${folderPath}`);
  activeVaultPath = folderPath;
  const filePath = path.join(folderPath, 'odinote.json');
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      logToFile(`IPC read-vault: Found odinote.json. Read successfully.`);
      return JSON.parse(content);
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
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
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

function startAuthServer() {
  if (authServer) return;
  const http = require('http');
  const fs = require('fs');
  const path = require('path');

  authServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/auth-success') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const profile = JSON.parse(body);
          logToFile(`Received auth-success via POST for ${profile.email}`);
          if (mainWindow) {
            mainWindow.webContents.send('google-signin-completed', profile);
          }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
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
    } else if (req.url.startsWith('/local-login.html') || req.url === '/' || req.url.startsWith('/?code=')) {
      const filePath = path.join(__dirname, 'local-login.html');
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(500);
          res.end('Error loading local-login.html');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
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

ipcMain.handle('start-google-login', async () => {
  logToFile('IPC Call: start-google-login');
  startAuthServer();
  const authUrl = `http://localhost:${authPort}/`;
  shell.openExternal(authUrl);
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
