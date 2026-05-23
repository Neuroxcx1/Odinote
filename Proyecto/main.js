const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow;
let serverInstance;

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

  // Hide default menu bar
  mainWindow.setMenuBarVisibility(false);

  // OPEN DEVTOOLS SO WE CAN IMMEDIATELY SEE THE CONSOLE ERRORS
  logToFile('Opening DevTools...');
  mainWindow.webContents.openDevTools();

  // Start internal static HTTP server
  logToFile('Starting local HTTP server...');
  serverInstance = http.createServer((req, res) => {
    let rawPath = req.url.split('?')[0];
    if (rawPath === '/' || !rawPath) {
      rawPath = '/index.html';
    }

    const decodedPath = decodeURIComponent(rawPath);
    const filePath = path.join(__dirname, decodedPath);
    const ext = path.extname(filePath).toLowerCase();

    logToFile(`HTTP Request: ${req.method} ${req.url} -> Resolved: ${filePath}`);

    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.jsx': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf'
    };

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

  serverInstance.listen(0, '127.0.0.1', () => {
    const address = serverInstance.address();
    const port = address.port;
    logToFile(`Static server running at: http://127.0.0.1:${port}`);
    mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
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
  const baseName = path.basename(selectedPath).toLowerCase();
  
  // Automatically create and target an 'Odinote' subfolder to keep user filesystem clean
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
  
  logToFile(`IPC select-folder: Selected Final Path: ${selectedPath}`);
  return selectedPath;
});

ipcMain.handle('read-vault', async (event, folderPath) => {
  logToFile(`IPC Call: read-vault at ${folderPath}`);
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
