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
  setSpellcheckerLanguages: (langs) => ipcRenderer.invoke('set-spellchecker-languages', langs)
});
