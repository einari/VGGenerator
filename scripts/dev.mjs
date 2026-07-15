#!/usr/bin/env node
// Run the Vite dev server and the Node backend together with one command.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

const children = [
  spawn(process.execPath, [join(ROOT, 'server', 'index.mjs')], {
    stdio: 'inherit',
    cwd: ROOT,
  }),
  spawn(process.execPath, [viteBin], { stdio: 'inherit', cwd: ROOT }),
]

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) c.kill('SIGTERM')
}

for (const c of children) {
  c.on('exit', (code) => {
    // If one process dies, take the other down too.
    if (!shuttingDown) {
      shutdown()
      process.exitCode = code ?? 0
    }
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
