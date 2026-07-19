// Dev entry: opens a window against Vite's dev server. Assumes `yarn dev` is
// already running in a terminal (backend on :8787, Vite on :5173 with its
// /api proxy). Deliberately touches nothing under scripts/ or server/ — it
// cannot affect the hot-reload loop, by construction.
// Default import + destructure only — see the comment in windows.mjs.
import electron from 'electron'
import { createMainWindow, loadWithRetry } from './windows.mjs'
const { app } = electron

app.whenReady().then(async () => {
  const win = createMainWindow()
  await loadWithRetry(win, 'http://localhost:5173')
})

app.on('window-all-closed', () => app.quit())
