// Production entry: packaged app, and `yarn electron:start` for testing the
// full bundled-LLM flow without a full package build.
//
// Sequencing matters here — see the comment on VGGEN_DATA_ROOT in
// scripts/store.mjs. Backend modules (server/index.mjs and everything it
// imports) must only be loaded via dynamic import(), *after* VGGEN_DATA_ROOT
// is set, since store.mjs resolves its data paths once at module load time.
// LLM_BASE_URL has no such constraint (scripts/llm.mjs reads it per-call),
// but we set it at the same point for clarity.
import electron from 'electron'
import { join } from 'node:path'
import { createMainWindow } from './windows.mjs'
import { requireAppleSilicon } from './platform.mjs'
import { seedDataDir, distDir } from './paths.mjs'

const { app, BrowserWindow } = electron

const BACKEND_PORT = Number(process.env.PORT || 8787)
const LLAMA_PORT = Number(process.env.VGGEN_LLAMA_PORT || 8090)

async function showProgressWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 240,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'VG Generator',
    show: false, // avoid a blank-white flash — shown once content is ready
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(app.getAppPath(), 'electron', 'progress', 'preload.cjs'),
    },
  })
  win.once('ready-to-show', () => win.show())
  await win.loadFile(join(app.getAppPath(), 'electron', 'progress', 'index.html'))
  return win
}

async function main() {
  // 1. Name the app before anything reads userData — otherwise packaged
  // (productName) vs. unpackaged `electron:start` testing resolve different
  // userData folders, silently splitting data across two locations.
  app.setName('VG Generator')

  await app.whenReady()

  // 2. Apple Silicon only — the vendored llama-server binary is arm64-only.
  if (!requireAppleSilicon()) return

  // 3. Redirect the backend's data root to a writable location.
  const dataRoot = join(app.getPath('userData'), 'data')
  process.env.VGGEN_DATA_ROOT = dataRoot

  // 4. Seed articles/images on first run only.
  const { ensureSeeded } = await import('./seedData.mjs')
  ensureSeeded(dataRoot, seedDataDir())

  // 5. Ensure the model is downloaded, showing progress only if needed.
  const { ensureModel, isModelComplete } = await import('./modelManager.mjs')
  const modelsDir = join(app.getPath('userData'), 'models')
  let progressWin = null
  if (!isModelComplete(modelsDir)) {
    progressWin = await showProgressWindow()
  }
  const resolvedModelPath = await ensureModel(modelsDir, (progress) => {
    progressWin?.webContents.send('model-download-progress', progress)
  })
  progressWin?.close()

  // 6. Spawn the bundled LLM.
  const { startLlamaServer, stopLlamaServer } = await import('./llama.mjs')
  await startLlamaServer({ modelPath: resolvedModelPath, port: LLAMA_PORT })
  app.on('will-quit', () => stopLlamaServer())

  // 7. Point the backend at it. No LLM_API_KEY/LLM_MODEL — llama-server needs
  // neither (scripts/llm.mjs already handles both being unset).
  process.env.LLM_BASE_URL = `http://127.0.0.1:${LLAMA_PORT}/v1`

  // 8. Start the backend in-process, serving the built frontend + data root.
  const { startServer } = await import('../server/index.mjs')
  startServer({ port: BACKEND_PORT, staticRoot: distDir(), dataRoot })

  // 9. Open the main window. No preload — the React app is a plain
  // fetch()-based page, exactly as unaware of Electron as a browser tab.
  const win = createMainWindow()
  await win.loadURL(`http://127.0.0.1:${BACKEND_PORT}/`)

  // 10. Single-purpose utility app: closing the window quits the app.
  app.on('window-all-closed', () => app.quit())
}

main().catch((err) => {
  console.error('✖ Failed to start VG Generator:', err)
  app.quit()
})
