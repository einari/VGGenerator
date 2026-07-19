// electron-builder afterSign hook. No-op unless real Apple credentials are
// configured — signing/notarization is explicitly out of scope for this pass
// (no Apple Developer ID available). Wired now so flipping it on later is
// just setting env vars, not writing new code.
export default async function notarizing(context) {
  if (process.env.NOTARIZE !== 'true' || !process.env.APPLE_ID) {
    console.log('Skipping notarization (not configured) — expected for this pass.')
    return
  }

  const { notarize } = await import('@electron/notarize')
  const { appOutDir, packager } = context
  const appName = packager.appInfo.productFilename

  await notarize({
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  })
}
