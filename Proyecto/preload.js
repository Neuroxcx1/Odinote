const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readVault: (folderPath) => ipcRenderer.invoke('read-vault', folderPath),
  writeVault: (folderPath, data) => ipcRenderer.invoke('write-vault', { folderPath, data }),
  saveMedia: (folderPath, fileName, base64Data) => ipcRenderer.invoke('save-media', { folderPath, fileName, base64Data })
});
