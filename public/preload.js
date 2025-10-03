const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  processFile: (filePath) => ipcRenderer.invoke('process-file', filePath),
  generateDocument: (options) => ipcRenderer.invoke('generate-document', options),
  generatePreview: (options) => ipcRenderer.invoke('generate-preview', options),
  
  // Utility functions
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Environment info
  getPlatform: () => process.platform
});

// Log to confirm preload script is loaded
console.log('Preload script loaded successfully');