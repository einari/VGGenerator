// Only preload in the app, and narrowly scoped: callback subscriptions plus
// the one first-run action (choosing a model), nothing else, to the plain
// HTML/JS progress window.
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
  // First-run only: main sends the model list, the page answers with the
  // user's pick (see electron/main.mjs askUserToChooseModel).
  onChooseModel: (callback) => {
    ipcRenderer.on('choose-model', (_event, data) => callback(data))
  },
  chooseModel: (id) => {
    ipcRenderer.send('model-chosen', id)
  },
})
