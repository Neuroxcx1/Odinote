const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readVault: (folderPath) => ipcRenderer.invoke('read-vault', folderPath),
  // `carpetas` es el mapa id-de-proyecto → nombre de su carpeta. Lo calcula la
  // aplicación (ver boveda.js) para que el disco y la pantalla estén de acuerdo
  // sobre cómo se llama la carpeta de cada uno.
  writeVault: (folderPath, data, carpetas) => ipcRenderer.invoke('write-vault', { folderPath, data, carpetas }),
  saveMedia: (folderPath, fileName, base64Data, carpeta) => ipcRenderer.invoke('save-media', { folderPath, fileName, base64Data, carpeta }),
  getVaultPath: () => ipcRenderer.invoke('get-vault-path'),
  setVaultPath: (vaultPath) => ipcRenderer.invoke('set-vault-path', vaultPath),
  onShowContextMenu: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('show-context-menu', listener);
    return () => ipcRenderer.removeListener('show-context-menu', listener);
  },
  replaceMisspelling: (suggestion) => ipcRenderer.invoke('replace-misspelling', suggestion),
  addToDictionary: (word) => ipcRenderer.invoke('add-to-dictionary', word),
  setSpellcheckerLanguages: (langs) => ipcRenderer.invoke('set-spellchecker-languages', langs),
  openCustomDictionary: () => ipcRenderer.invoke('open-custom-dictionary'),
  openUserDataFolder: () => ipcRenderer.invoke('open-user-data-folder'),
  // Enseñar en el explorador el archivo del que salió un nodo. Devuelve
  // { ok, motivo }: 'no-esta' cuando la ruta ya no existe, que es lo normal
  // cuando alguien mueve o borra el original meses después.
  mostrarEnCarpeta: (datos) => ipcRenderer.invoke('mostrar-en-carpeta', datos),
  // El nodo de carpeta: elegirla, leer lo que tiene (cuántos archivos y las
  // miniaturas de los últimos) y abrirla en el Explorador.
  carpetaElegir: (desde) => ipcRenderer.invoke('carpeta-elegir', desde),
  carpetaLeer: (ruta) => ipcRenderer.invoke('carpeta-leer', ruta),
  carpetaAbrir: (ruta) => ipcRenderer.invoke('carpeta-abrir', ruta),
  // Copiar las imágenes de un tablero a la carpeta del proyecto en que se convierte.
  fetchImageBase64: (url) => ipcRenderer.invoke('fetch-image-base64', url),
  downloadMediaToVault: (folderPath, url, fileName) => ipcRenderer.invoke('download-media-to-vault', { folderPath, url, fileName }),
  getCustomDictionaryWords: () => ipcRenderer.invoke('get-custom-dictionary-words'),
  removeWordFromDictionary: (word) => ipcRenderer.invoke('remove-word-from-dictionary', word),
  setWindowTheme: (theme) => ipcRenderer.invoke('set-window-theme', theme),
  startGoogleLogin: () => ipcRenderer.invoke('start-google-login'),
  // Renovar el acceso a Drive sin molestar al usuario, y saber si se puede.
  googleRefreshAccess: () => ipcRenderer.invoke('google-refresh-access'),
  capturarLienzo: (recorte) => ipcRenderer.invoke('capturar-lienzo', recorte),
  googleHasRefresh: () => ipcRenderer.invoke('google-has-refresh'),
  googleSignOut: () => ipcRenderer.invoke('google-sign-out'),
  // Descarga el instalador del release y lo ejecuta (auto-actualización).
  // onProgress recibe el porcentaje descargado (0-100).
  downloadAndRunUpdate: (url, fileName, onProgress) => {
    if (onProgress) {
      const listener = (event, pct) => onProgress(pct);
      ipcRenderer.on('update-download-progress', listener);
    }
    return ipcRenderer.invoke('download-and-run-update', { url, fileName });
  },
  // La ventana: "siempre encima" sin bordes (la chincheta de arriba a la
  // izquierda, ver src/Ventana.jsx) y moverla cuando está fijada, que ya no
  // tiene barra de título de donde agarrarla.
  ventana: {
    fija: (si) => ipcRenderer.invoke('ventana:fija', !!si),
    estado: () => ipcRenderer.invoke('ventana:estado'),
    alCambiar: (cb) => {
      const f = (event, est) => cb(est);
      ipcRenderer.on('ventana:estado', f);
      return () => ipcRenderer.removeListener('ventana:estado', f);
    },
    arrastra: (que) => ipcRenderer.send('ventana:arrastra', que),
  },
  onGoogleSigninCompleted: (callback) => {
    const listener = (event, profile) => callback(profile);
    ipcRenderer.on('google-signin-completed', listener);
    return () => ipcRenderer.removeListener('google-signin-completed', listener);
  }
});
