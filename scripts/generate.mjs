#!/usr/bin/env node
// CLI: generate fake VG-style articles with the local LLM and write them to
// public/articles/*.json. Same logic the backend uses.
//
// Usage:
//   node scripts/generate.mjs --count 8 --topics "måke tar pølse; strømpris"
// Env (or .env): LLM_BASE_URL, LLM_MODEL, LLM_API_KEY
import { loadDotEnv } from './env.mjs'
import { generate } from './llm.mjs'

loadDotEnv()

const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

const count = Number(arg('count', '8'))
const sections = (arg('sections', '') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const topics = (arg('topics', '') || '')
  .split(';')
  .map((t) => t.trim())
  .filter(Boolean)
const dialect = arg('dialect', 'bokmal')

console.log(
  `→ genererer ${count} saker (${dialect})${topics.length ? ` (temaer: ${topics.join(', ')})` : ''}`,
)

generate({ count, sections: sections.length ? sections : undefined, topics, dialect })
  .then((articles) => {
    for (const a of articles) console.log(`  ✓ [${a.section}] ${a.title}`)
    console.log(`\nSkrev ${articles.length} saker til public/articles/.`)
  })
  .catch((err) => {
    console.error('\n✖ Feil:', err.message)
    console.error('  Sjekk at LLM-serveren kjører og at LLM_API_KEY er satt (.env).')
    process.exit(1)
  })
