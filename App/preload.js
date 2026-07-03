const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readVault: (folderPath) => ipcRenderer.invoke('read-vault', folderPath),
  writeVault: (folderPath, data) => ipcRenderer.invoke('write-vault', { folderPath, data }),
  saveMedia: (folderPath, fileName, base64Data) => ipcRenderer.invoke('save-media', { folderPath, fileName, base64Data }),
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
  fetchImageBase64: (url) => ipcRenderer.invoke('fetch-image-base64', url),
  downloadMediaToVault: (folderPath, url, fileName) => ipcRenderer.invoke('download-media-to-vault', { folderPath, url, fileName }),
  getCustomDictionaryWords: () => ipcRenderer.invoke('get-custom-dictionary-words'),
  removeWordFromDictionary: (word) => ipcRenderer.invoke('remove-word-from-dictionary', word),
  startGoogleLogin: () => ipcRenderer.invoke('start-google-login'),
  onGoogleSigninCompleted: (callback) => {
    const listener = (event, profile) => callback(profile);
    ipcRenderer.on('google-signin-completed', listener);
    return () => ipcRenderer.removeListener('google-signin-completed', listener);
  }
});
