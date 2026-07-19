// Shared BrowserWindow factory used by both the dev entry (main.dev.mjs,
// pointed at Vite) and the production entry (main.mjs, pointed at the
// in-process backend). No preload here — the app is a plain fetch()-based
// web page, exactly as unaware of Electron as a normal browser tab.
// Electron's ESM interop only provides a default export (no static named
// exports), so this must be a default import + destructure, not `import {
// BrowserWindow } from 'electron'` (confirmed: the latter throws a
// SyntaxError at module load).
import electron from 'electron'
const { BrowserWindow } = electron

export function createMainWindow() {
  return new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'VG Generator',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
}

/** Load `url` into `win`, retrying while the dev server is still booting. */
export async function loadWithRetry(win, url, { attempts = 10, delayMs = 500 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      await win.loadURL(url)
      return
    } catch (err) {
      if (i === attempts - 1) throw err
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
}
