const { contextBridge, ipcRenderer, webUtils } = require('electron');
const { pathToFileURL } = require('url');
contextBridge.exposeInMainWorld('api', {
  open: () => ipcRenderer.invoke('open'),
  save: n => ipcRenderer.invoke('save', n),
  exportClip: o => ipcRenderer.invoke('export', o),
  onProgress: cb => ipcRenderer.on('progress', (_e, f) => cb(f)),
  pathOf: f => webUtils.getPathForFile(f),
  toURL: p => pathToFileURL(p).href
});
