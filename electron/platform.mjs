// Apple Silicon check — the vendored llama-server binary is arm64-only, and
// CPU-only inference on Intel would be too slow to be worth shipping. On real
// Intel hardware macOS itself refuses to launch this arm64-only app before
// any JS runs, so this mainly guards dev-loop edge cases.
import electron from 'electron'
const { app, dialog } = electron

export function requireAppleSilicon() {
  if (process.arch === 'arm64') return true
  dialog.showErrorBox(
    'Apple Silicon required',
    'VG Generator’s bundled AI model requires an Apple Silicon Mac (M1 or newer). ' +
      'It is not supported on Intel Macs.',
  )
  app.quit()
  return false
}
