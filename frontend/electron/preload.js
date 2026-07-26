// ============================================================================
// electron/preload.js — Script de Precarga para Moonlight Desktop.
// Expone APIs seguras al proceso de renderizado (React).
// ============================================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  onSharePickerOpen: (callback) => {
    const subscription = (event, sources) => callback(sources);
    ipcRenderer.on('electron:share-picker-open', subscription);
    return () => ipcRenderer.removeListener('electron:share-picker-open', subscription);
  },
  selectScreenSource: (sourceId) => ipcRenderer.invoke('electron:share-picker-select', sourceId),
  cancelScreenSource: () => ipcRenderer.invoke('electron:share-picker-cancel'),
});
