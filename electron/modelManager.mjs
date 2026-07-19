// The catalog of selectable GGUF chat models, plus the logic to ensure the
// chosen one is present in userData/models/ (downloading with progress).
//
// Model choices:
//  - Gemma 4 E2B (default): the model this app originally used via oMLX
//    (gemma-4-e2b-it-4bit) — Q4_K_M GGUF from unsloth's public mirror.
//    Distributed under Google's Gemma Terms of Use (redistribution permitted
//    with conditions; the mirror is public and non-gated, unlike google/*'s
//    own GGUF repos which sit behind a license-acceptance gate and would 401
//    on an anonymous runtime download like ours).
//  - Llama 3.2 3B: from bartowski's GGUF mirror, under Meta's Llama 3.2
//    Community License (redistribution permitted).
//
// LICENSING LANDMINE — do not swap in Qwen2.5-3B-Instruct as a "drop-in
// upgrade": unlike the other Qwen2.5 sizes (1.5B/7B/14B/32B, all Apache-2.0),
// the 3B specifically ships under Alibaba's "qwen-research" license —
// research/non-commercial only, NOT redistributable in an app like this.
// Verified directly against the model card. Re-check licensing terms before
// ever adding or changing a model here.
//
// NOTE: the vendored llama-server must support each model's architecture —
// Gemma 4 needs llama.cpp b10068+ (see LLAMA_CPP_TAG in
// scripts/vendor-llama.mjs before downgrading it).
import { existsSync, statSync } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { join } from 'node:path'

// minBytes guards against a truncated/failed download looking complete.
export const MODELS = [
  {
    id: 'gemma',
    label: 'Gemma 4 E2B',
    sizeLabel: '3,1 GB',
    filename: 'gemma-4-E2B-it-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf',
    minBytes: 3_000_000_000, // actual: 3 106 738 272
  },
  {
    id: 'llama',
    label: 'Llama 3.2 3B',
    sizeLabel: '2,0 GB',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    minBytes: 2_000_000_000, // actual: ~2.02 GB
  },
]

export const DEFAULT_MODEL_ID = 'gemma'

export function getModel(id) {
  return MODELS.find((m) => m.id === id) ?? null
}

export function modelPath(modelsDir, model) {
  return join(modelsDir, model.filename)
}

export function isModelComplete(modelsDir, model) {
  const p = modelPath(modelsDir, model)
  return existsSync(p) && statSync(p).size >= model.minBytes
}

/**
 * Pick the model to run at startup, or null if the user must choose first
 * (true first run: nothing saved, nothing downloaded).
 * An install predating model selection has no saved choice but exactly one
 * model on disk — keep using it rather than surprising the user with a
 * multi-GB download of the new default.
 */
export function resolveInitialModel(savedModelId, modelsDir) {
  const saved = getModel(savedModelId)
  if (saved) return saved
  const downloaded = MODELS.filter((m) => isModelComplete(modelsDir, m))
  if (downloaded.length === 1) return downloaded[0]
  if (downloaded.length > 1) return getModel(DEFAULT_MODEL_ID)
  return null
}

/**
 * Ensure `model` is present in `modelsDir`, downloading it if missing.
 * Calls `onProgress({ receivedBytes, totalBytes })` as chunks arrive.
 * Returns the final model path.
 */
export async function ensureModel(modelsDir, model, onProgress) {
  if (isModelComplete(modelsDir, model)) return modelPath(modelsDir, model)

  await mkdir(modelsDir, { recursive: true })
  const finalPath = modelPath(modelsDir, model)
  const tmpPath = finalPath + '.download'
  await rm(tmpPath, { force: true })

  const res = await fetch(model.url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`GET ${model.url} -> ${res.status}`)
  const totalBytes = Number(res.headers.get('content-length') || 0)

  let receivedBytes = 0
  const reader = Readable.fromWeb(res.body)
  reader.on('data', (chunk) => {
    receivedBytes += chunk.length
    onProgress?.({ receivedBytes, totalBytes })
  })
  await pipeline(reader, createWriteStream(tmpPath))

  const finalSize = statSync(tmpPath).size
  if (finalSize < model.minBytes) {
    await rm(tmpPath, { force: true })
    throw new Error(`Downloaded model looks truncated (${finalSize} bytes) — try again`)
  }

  // Rename only on verified success, so a crashed/interrupted download never
  // looks complete to isModelComplete() on the next launch.
  await rename(tmpPath, finalPath)
  return finalPath
}
