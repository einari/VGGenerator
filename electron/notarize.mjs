// electron-builder afterSign hook.
//
// With `mac.identity: null` in electron-builder.yml, electron-builder skips
// its own signing step entirely — but the Electron template binary itself
// already carries a build-time ad-hoc signature from its original toolchain,
// covering its *original* contents. electron-builder then adds app.asar and
// our extraResources (llama-server, seed-data) on top, which orphans that
// signature: `codesign --verify --deep --strict` fails with "code has no
// resources but signature indicates they must be present" — exactly the
// defect class macOS reports to users as "'VG Generator' is damaged and
// can't be opened" (confirmed by reproducing it locally: this exact
// verification error before re-signing, gone after).
//
// Without a paid Apple Developer ID, real signing/notarization isn't
// possible yet — but re-signing ad-hoc (no certificate needed, free, but
// also not tied to a verified identity) fixes the mismatch and turns
// "damaged, must be trashed" back into the standard, expected "Apple could
// not verify this app" prompt with a right-click-to-open escape hatch.
import { execFileSync } from 'node:child_process'

export default async function notarizing(context) {
  const { appOutDir, packager } = context
  const appPath = `${appOutDir}/${packager.appInfo.productFilename}.app`

  if (process.env.NOTARIZE === 'true' && process.env.APPLE_ID) {
    const { notarize } = await import('@electron/notarize')
    await notarize({
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    })
    return
  }

  console.log('Not notarizing (no Apple credentials configured) — ad-hoc re-signing instead.')
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
}
