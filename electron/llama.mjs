// Spawn the vendored llama-server binary and wait for it to be ready. The
// binary already speaks the OpenAI-compatible /v1/chat/completions and
// /v1/models endpoints, so scripts/llm.mjs needs no awareness of any of this
// — main.mjs just points LLM_BASE_URL at it once it's up.
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { llamaServerDir } from './paths.mjs'

let child = null
let exited = true

async function waitUntilReady(port, { timeoutMs = 120_000, intervalMs = 300 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/v1/models`)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`llama-server did not become ready on port ${port} within ${timeoutMs}ms`)
}

/** Spawn llama-server with `modelPath` on `port`, resolving once it's ready. */
export async function startLlamaServer({ modelPath, port }) {
  const bin = join(llamaServerDir(), 'llama-server')
  child = spawn(bin, ['-m', modelPath, '--host', '127.0.0.1', '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  exited = false
  child.stdout.on('data', (d) => process.stdout.write(`[llama-server] ${d}`))
  child.stderr.on('data', (d) => process.stderr.write(`[llama-server] ${d}`))
  child.on('exit', (code, signal) => {
    console.log(`llama-server exited (code=${code} signal=${signal})`)
    exited = true
    child = null
  })

  await waitUntilReady(port)
  return child
}

/** Terminate the spawned llama-server, escalating to SIGKILL if it lingers. */
export function stopLlamaServer({ graceMs = 3000 } = {}) {
  if (!child) return
  const proc = child
  proc.kill('SIGTERM')
  setTimeout(() => {
    if (!exited) proc.kill('SIGKILL')
  }, graceMs)
}
