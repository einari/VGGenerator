// Ensures the default GGUF chat model is present in userData/models/,
// downloading it (with progress) on first run.
//
// Model choice: Llama-3.2-3B-Instruct-Q4_K_M, from bartowski's GGUF mirror,
// under Meta's Llama 3.2 Community License (redistribution permitted).
//
// LICENSING LANDMINE — do not swap this for Qwen2.5-3B-Instruct as a
// "drop-in upgrade": unlike the other Qwen2.5 sizes (1.5B/7B/14B/32B, all
// Apache-2.0), the 3B specifically ships under Alibaba's "qwen-research"
// license — research/non-commercial only, NOT redistributable in an app like
// this. Verified directly against the model card before picking Llama 3.2
// instead. Re-check licensing terms before ever changing the default model.
import { existsSync, statSync } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { join } from 'node:path'

const MODEL_URL =
  'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf'
const MODEL_FILENAME = 'Llama-3.2-3B-Instruct-Q4_K_M.gguf'
const EXPECTED_MIN_BYTES = 2_000_000_000 // ~2.02GB expected; guard against a truncated/failed download

export function modelPath(modelsDir) {
  return join(modelsDir, MODEL_FILENAME)
}

export function isModelComplete(modelsDir) {
  const p = modelPath(modelsDir)
  return existsSync(p) && statSync(p).size >= EXPECTED_MIN_BYTES
}

/**
 * Ensure the model is present in `modelsDir`, downloading it if missing.
 * Calls `onProgress({ receivedBytes, totalBytes })` as chunks arrive.
 * Returns the final model path.
 */
export async function ensureModel(modelsDir, onProgress) {
  if (isModelComplete(modelsDir)) return modelPath(modelsDir)

  await mkdir(modelsDir, { recursive: true })
  const finalPath = modelPath(modelsDir)
  const tmpPath = finalPath + '.download'
  await rm(tmpPath, { force: true })

  const res = await fetch(MODEL_URL, { redirect: 'follow' })
  if (!res.ok) throw new Error(`GET ${MODEL_URL} -> ${res.status}`)
  const totalBytes = Number(res.headers.get('content-length') || 0)

  let receivedBytes = 0
  const reader = Readable.fromWeb(res.body)
  reader.on('data', (chunk) => {
    receivedBytes += chunk.length
    onProgress?.({ receivedBytes, totalBytes })
  })
  await pipeline(reader, createWriteStream(tmpPath))

  const finalSize = statSync(tmpPath).size
  if (finalSize < EXPECTED_MIN_BYTES) {
    await rm(tmpPath, { force: true })
    throw new Error(`Downloaded model looks truncated (${finalSize} bytes) — try again`)
  }

  // Rename only on verified success, so a crashed/interrupted download never
  // looks complete to isComplete() on the next launch.
  await rename(tmpPath, finalPath)
  return finalPath
}
