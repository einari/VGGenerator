// Copies the shipped seed articles/images into the writable userData data
// root on first run only — never overwrites content the user has since
// generated. See scripts/store.mjs for the DATA_ROOT concept this feeds.
import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export function ensureSeeded(dataRoot, seedRoot) {
  if (existsSync(join(dataRoot, 'articles', 'index.json'))) return
  cpSync(join(seedRoot, 'articles'), join(dataRoot, 'articles'), { recursive: true })
  cpSync(join(seedRoot, 'images'), join(dataRoot, 'images'), { recursive: true })
}
