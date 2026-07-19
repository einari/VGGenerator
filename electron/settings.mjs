// Tiny persisted app settings (currently just the chosen model), stored as
// JSON in userData. Read once at startup, written on every change.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function settingsPath(userDataDir) {
  return join(userDataDir, 'settings.json')
}

export function readSettings(userDataDir) {
  const p = settingsPath(userDataDir)
  if (!existsSync(p)) return {}
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    // A corrupt settings file must never block startup — fall back to
    // defaults and let the next write repair it.
    return {}
  }
}

export function writeSettings(userDataDir, settings) {
  writeFileSync(settingsPath(userDataDir), JSON.stringify(settings, null, 2) + '\n')
}
