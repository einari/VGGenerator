// Runtime model switching, owned by the Electron main process and surfaced
// to the frontend through the backend's /api/model endpoints (see
// server/index.mjs). Deliberately electron-free: main.mjs hands it the paths
// and port, so it stays testable and import-order-safe.
//
// Switch sequence: download the new model first (the old one keeps serving
// requests the whole time), and only then stop the old llama-server and
// start the new one — the service gap is just the process swap, not the
// multi-GB download.
import {
  MODELS,
  getModel,
  isModelComplete,
  ensureModel,
  modelPath,
} from './modelManager.mjs'
import { startLlamaServer, stopLlamaServer } from './llama.mjs'
import { readSettings, writeSettings } from './settings.mjs'

export function createModelController({ userDataDir, modelsDir, port, currentModel }) {
  let current = currentModel
  let status = 'ready' // 'ready' | 'downloading' | 'starting' | 'error'
  let target = null // model being switched to, while busy
  let progress = null // { receivedBytes, totalBytes } while downloading
  let error = null // last switch failure, cleared on the next attempt

  function getStatus() {
    return {
      supported: true,
      current: current.id,
      status,
      target: target?.id ?? null,
      progress,
      error,
      models: MODELS.map((m) => ({
        id: m.id,
        label: m.label,
        sizeLabel: m.sizeLabel,
        downloaded: isModelComplete(modelsDir, m),
      })),
    }
  }

  async function doSwitch(model) {
    try {
      if (!isModelComplete(modelsDir, model)) {
        status = 'downloading'
        progress = { receivedBytes: 0, totalBytes: 0 }
        await ensureModel(modelsDir, model, (p) => {
          progress = p
        })
      }
      status = 'starting'
      progress = null
      await stopLlamaServer()
      await startLlamaServer({ modelPath: modelPath(modelsDir, model), port })
      current = model
      writeSettings(userDataDir, { ...readSettings(userDataDir), modelId: model.id })
      status = 'ready'
      target = null
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      progress = null
      target = null
      console.error(`✖ Modellbytte til ${model.id} feilet:`, error)
      // A download failure leaves the old server untouched — just report and
      // carry on. A failure after the stop means nothing is serving; try to
      // bring the old model back so the app isn't left dead.
      if (status === 'starting') {
        try {
          // The new server may have half-started (e.g. ready-poll timeout
          // with the process still alive holding the port) — clear it first.
          await stopLlamaServer()
          await startLlamaServer({ modelPath: modelPath(modelsDir, current), port })
          status = 'ready'
        } catch (restartErr) {
          status = 'error'
          error += ` (klarte heller ikke å starte ${current.label} igjen: ${
            restartErr instanceof Error ? restartErr.message : restartErr
          })`
        }
      } else {
        status = 'ready'
      }
    }
  }

  /**
   * Begin switching to model `id`. Returns the immediate status snapshot —
   * the switch itself runs in the background; the frontend polls getStatus().
   */
  function select(id) {
    const model = getModel(id)
    if (!model) throw new Error(`Ukjent modell: ${id}`)
    if (status === 'downloading' || status === 'starting') {
      throw new Error('Et modellbytte pågår allerede')
    }
    if (model.id !== current.id) {
      target = model
      error = null
      void doSwitch(model)
    }
    return getStatus()
  }

  return { getStatus, select }
}
