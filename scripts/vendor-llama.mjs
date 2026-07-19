#!/usr/bin/env node
// Downloads the prebuilt llama.cpp macOS arm64 release (containing
// `llama-server` + its dylibs) into the gitignored .vendor/llama-server/, for
// electron-builder's extraResources to bundle. Idempotent: skips the network
// entirely if the pinned version is already vendored, so `yarn electron:build`
// stays fast on repeat runs and this doubles as "fetch once, test locally."
//
// Bump LLAMA_CPP_TAG to update — check https://github.com/ggml-org/llama.cpp/releases
// for the current tag and confirm the macos-arm64 asset name still matches
// the `llama-<tag>-bin-macos-arm64.tar.gz` pattern before bumping.
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const LLAMA_CPP_TAG = 'b10068'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR_DIR = join(ROOT, '.vendor', 'llama-server')
const VERSION_FILE = join(VENDOR_DIR, '.version')
const ASSET = `llama-${LLAMA_CPP_TAG}-bin-macos-arm64.tar.gz`
const URL = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_TAG}/${ASSET}`

function alreadyVendored() {
  return existsSync(VERSION_FILE) && readFileSync(VERSION_FILE, 'utf8').trim() === LLAMA_CPP_TAG
}

async function download(url, destFile) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  await pipeline(res.body, createWriteStream(destFile))
}

async function main() {
  if (alreadyVendored()) {
    console.log(`✓ llama-server ${LLAMA_CPP_TAG} already vendored at ${VENDOR_DIR}`)
    return
  }

  rmSync(VENDOR_DIR, { recursive: true, force: true })
  const extractDir = join(ROOT, '.vendor', '.extract-tmp')
  rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(extractDir, { recursive: true })

  const tarPath = join(ROOT, '.vendor', ASSET)
  console.log(`→ downloading ${URL}`)
  await download(URL, tarPath)

  console.log(`→ extracting`)
  execFileSync('tar', ['-xzf', tarPath, '-C', extractDir], { stdio: 'inherit' })
  rmSync(tarPath, { force: true })

  // The release asset's top-level directory name embeds the version tag
  // (e.g. `llama-b10068/`) and contains llama-server + every dylib it needs
  // flatly (no build/bin/ subdirectory) — copy that directory's *contents*
  // straight into VENDOR_DIR so downstream code never needs to know the
  // tag-specific folder name.
  const entries = readdirSync(extractDir, { withFileTypes: true })
  const topLevelDir = entries.find((e) => e.isDirectory())
  const copyFrom = topLevelDir ? join(extractDir, topLevelDir.name) : extractDir
  mkdirSync(VENDOR_DIR, { recursive: true })
  execFileSync('cp', ['-R', copyFrom + '/.', VENDOR_DIR + '/'], { stdio: 'inherit' })
  rmSync(extractDir, { recursive: true, force: true })

  const serverBin = join(VENDOR_DIR, 'llama-server')
  if (!existsSync(serverBin)) {
    throw new Error(`Extraction succeeded but llama-server not found at ${serverBin} — release layout may have changed`)
  }
  execFileSync('chmod', ['+x', serverBin])

  // Written only now: a partial/failed run leaves no .version, so a retry
  // re-downloads rather than treating a broken extraction as done.
  writeFileSync(VERSION_FILE, LLAMA_CPP_TAG + '\n')
  console.log(`✓ vendored llama-server ${LLAMA_CPP_TAG} -> ${serverBin}`)
}

main().catch((err) => {
  console.error('✖ vendor-llama failed:', err.message)
  process.exit(1)
})
