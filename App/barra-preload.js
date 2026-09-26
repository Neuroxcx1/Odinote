// =====================================================
// Oddinote — el puente de la barra de título (barra-titulo.html)
//
// La ventana no tiene el marco de Windows (ver createWindow en main.js): la
// barra la pinta barra-titulo.html, y esto es lo único que puede pedir al
// proceso principal: minimizar, maximizar, cerrar y enterarse del estado y
// del tema.
// =====================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('barra', {
  minimiza: () => ipcRenderer.send('ventana:minimiza'),
  maximiza: () => ipcRenderer.send('ventana:maximiza'),
  cierra: () => ipcRenderer.send('ventana:cierra'),
  estado: () => ipcRenderer.invoke('ventana:estado'),
  alCambiar: (cb) => ipcRenderer.on('ventana:estado', (event, est) => cb(est)),
  alTema: (cb) => ipcRenderer.on('barra:tema', (event, tema) => cb(tema)),
});
