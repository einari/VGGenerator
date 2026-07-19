// Static file serving for the production (packaged) build. Not used in dev —
// Vite serves the frontend and its own proxy forwards /api to this backend.
//
// Two roots: `distRoot` (the built frontend — immutable, read-only app
// resources) and `dataRoot` (generated articles/images — writable, since the
// packaged app bundle can't be written to). See scripts/store.mjs for the
// matching DATA_ROOT concept on the write side.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function mimeFor(filePath) {
  return MIME[extname(filePath).toLowerCase()] || 'application/octet-stream'
}

/** Join `rel` onto `root`, rejecting any path that escapes `root`. */
function safeJoin(root, rel) {
  const target = resolve(join(root, rel))
  const base = resolve(root)
  if (target !== base && !target.startsWith(base + sep)) return null
  return target
}

/**
 * Returns a handler `(req, res) => boolean` that serves static files, or
 * `false` if the request path doesn't map to a file (so the caller can fall
 * through to a 404). Requests under /articles/ or /images/ (mutable, runtime-
 * generated content) are served from `dataRoot`; everything else (the built
 * frontend shell) is served from `distRoot`.
 */
export function createStaticHandler({ distRoot, dataRoot }) {
  return function serveStatic(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost')
    const mutable = pathname.startsWith('/articles/') || pathname.startsWith('/images/')
    const root = mutable ? dataRoot : distRoot
    const rel = pathname === '/' ? '/index.html' : pathname
    const filePath = safeJoin(root, rel)
    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) return false
    res.writeHead(200, { 'Content-Type': mimeFor(filePath), 'Cache-Control': 'no-store' })
    createReadStream(filePath).pipe(res)
    return true
  }
}
