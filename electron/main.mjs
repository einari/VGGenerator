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

const { app, BrowserWindow, dialog, ipcMain } = electron

const BACKEND_PORT = Number(process.env.PORT || 8787)
const LLAMA_PORT = Number(process.env.VGGEN_LLAMA_PORT || 8090)

// Without this, launching the app a second time (e.g. a user double-clicking
// it again because nothing visible happened yet during a slow first-run
// model download/llama-server startup) would start a *second* full instance,
// which would then fail to bind the same backend/llama-server ports the
// first instance already holds. Electron recommends acquiring this before
// app 'ready'.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let mainWindow = null

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  main((win) => {
    mainWindow = win
  }).catch((err) => {
    console.error('✖ Failed to start VG Generator:', err)
    dialog.showErrorBox('VG Generator kunne ikke starte', err.message || String(err))
    app.quit()
  })
}

async function showProgressWindow({ height = 240 } = {}) {
  const win = new BrowserWindow({
    width: 480,
    height,
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

/**
 * First run only: swap the progress window to its model-chooser view and
 * resolve with the chosen model. Resolves null if the user closes the window
 * instead of choosing (treated as "quit the app").
 */
function askUserToChooseModel(win, { MODELS, DEFAULT_MODEL_ID, getModel }) {
  return new Promise((resolve) => {
    const onChosen = (_event, id) => {
      cleanup()
      resolve(getModel(id) ?? getModel(DEFAULT_MODEL_ID))
    }
    const onClosed = () => {
      cleanup()
      resolve(null)
    }
    function cleanup() {
      ipcMain.off('model-chosen', onChosen)
      win.off('closed', onClosed)
    }
    ipcMain.once('model-chosen', onChosen)
    win.once('closed', onClosed)
    win.webContents.send('choose-model', {
      models: MODELS.map((m) => ({ id: m.id, label: m.label, sizeLabel: m.sizeLabel })),
      defaultId: DEFAULT_MODEL_ID,
    })
  })
}

async function main(onMainWindow) {
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

  // 5. Pick the model: the saved choice, or (true first run — nothing saved,
  // nothing downloaded) a chooser in the progress window before any download
  // starts. Gemma is the preselected default.
  const modelManager = await import('./modelManager.mjs')
  const { ensureModel, isModelComplete, resolveInitialModel } = modelManager
  const { readSettings, writeSettings } = await import('./settings.mjs')
  const userDataDir = app.getPath('userData')
  const modelsDir = join(userDataDir, 'models')

  const settings = readSettings(userDataDir)
  let progressWin = null
  let model = resolveInitialModel(settings.modelId, modelsDir)
  if (!model) {
    progressWin = await showProgressWindow({ height: 360 })
    model = await askUserToChooseModel(progressWin, modelManager)
    if (!model) {
      // Chooser window closed without picking — the user changed their mind.
      app.quit()
      return
    }
  }
  if (settings.modelId !== model.id) {
    writeSettings(userDataDir, { ...settings, modelId: model.id })
  }

  // 6. Ensure the model is downloaded, showing progress only if needed. The
  // progress window stays open (with an updated status) through step 7/9
  // below too — closing it right after the download, before the LLM/backend
  // are actually up, left a gap of several seconds to a minute or more with
  // *no window visible at all*, which looked exactly like the app failing to
  // start.
  if (!isModelComplete(modelsDir, model) && !progressWin) {
    progressWin = await showProgressWindow()
  }
  const resolvedModelPath = await ensureModel(modelsDir, model, (progress) => {
    progressWin?.webContents.send('model-download-progress', progress)
  })
  progressWin?.webContents.send('status', 'Starter modellen …')

  // 7. Spawn the bundled LLM.
  const { startLlamaServer, stopLlamaServer } = await import('./llama.mjs')
  await startLlamaServer({ modelPath: resolvedModelPath, port: LLAMA_PORT })
  app.on('will-quit', () => stopLlamaServer())

  // 8. Point the backend at it. No LLM_API_KEY/LLM_MODEL — llama-server needs
  // neither (scripts/llm.mjs already handles both being unset).
  process.env.LLM_BASE_URL = `http://127.0.0.1:${LLAMA_PORT}/v1`

  // 9. Start the backend in-process, serving the built frontend + data root.
  // The model controller backs GET/POST /api/model, letting the frontend's
  // topbar selector switch models at runtime (download → swap → restart).
  progressWin?.webContents.send('status', 'Starter appen …')
  const { createModelController } = await import('./modelController.mjs')
  const modelController = createModelController({
    userDataDir,
    modelsDir,
    port: LLAMA_PORT,
    currentModel: model,
  })
  const { startServer } = await import('../server/index.mjs')
  await startServer({ port: BACKEND_PORT, staticRoot: distDir(), dataRoot, modelController })

  // 10. Open the main window hidden, and only swap it in for the progress
  // window once it has actually finished loading — so there is never a
  // moment with zero windows visible between the two.
  const win = createMainWindow({ show: false })
  await win.loadURL(`http://127.0.0.1:${BACKEND_PORT}/`)
  progressWin?.close()
  win.show()
  onMainWindow(win)

  // 11. Single-purpose utility app: closing the window quits the app.
  app.on('window-all-closed', () => app.quit())
}
