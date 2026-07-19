// Only preload in the app, and narrowly scoped: exposes a single callback
// subscription, nothing else, to the plain HTML/JS progress window.
//
// Deliberately CommonJS (.cjs), not ESM: Electron's sandboxed preload
// context has historically had rougher edges with ESM preload scripts, and
// require()-based CJS is the one form that's reliably worked across every
// Electron version regardless of sandbox settings — not worth the risk for
// three lines of code.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vggen', {
  onProgress: (callback) => {
    ipcRenderer.on('model-download-progress', (_event, data) => callback(data))
  },
  onStatus: (callback) => {
    ipcRenderer.on('status', (_event, text) => callback(text))
  },
})
