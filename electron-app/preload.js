// Bridges the main process's pet-state pushes into the page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petHost', {
  quit: () => ipcRenderer.send('pet:quit'),
  dragStart: () => ipcRenderer.send('pet:drag-start'),
  dragEnd: () => ipcRenderer.send('pet:drag-end'),
  onState: (cb) => {
    ipcRenderer.on('pet-state', (_event, state) => {
      try { cb(state); } catch (e) { /* ignore */ }
    });
  }
});