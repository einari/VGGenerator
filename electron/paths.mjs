// Single source of truth for "where do vendored/packaged resources live" —
// dev (unpacked, running from the repo) vs. packaged (electron-builder's
// extraResources, under process.resourcesPath).
import electron from 'electron'
import { join } from 'node:path'

const { app } = electron

export function isPackaged() {
  return app.isPackaged
}

/** Directory containing the vendored llama-server binary + its dylibs. */
export function llamaServerDir() {
  return isPackaged()
    ? join(process.resourcesPath, 'llama-server')
    : join(app.getAppPath(), '.vendor', 'llama-server')
}

/** Directory containing the seed articles/images copied on first run. */
export function seedDataDir() {
  return isPackaged()
    ? join(process.resourcesPath, 'seed-data')
    : join(app.getAppPath(), 'public')
}

/** The built frontend (dist/) — served as the immutable app shell. */
export function distDir() {
  return join(app.getAppPath(), 'dist')
}
