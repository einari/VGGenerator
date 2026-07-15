#!/usr/bin/env node
// Generate fake VG-style articles with a local OpenAI-compatible LLM and write
// them to public/articles/*.json. No backend — the site just fetches the JSON.
//
// Usage:
//   LLM_API_KEY=... node scripts/generate.mjs --count 8
//
// Env:
//   LLM_BASE_URL  default http://127.0.0.1:8000/v1
//   LLM_MODEL     default: first model reported by /v1/models
//   LLM_API_KEY   bearer token for the local server (required by this server)
import {
  SYSTEM_PROMPT,
  SECTIONS,
  buildUserPrompt,
  parseArticlesResponse,
  finalizeArticle,
  writeArticle,
  rebuildIndex,
} from './store.mjs'

const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

const BASE_URL = process.env.LLM_BASE_URL || 'http://127.0.0.1:8000/v1'
const API_KEY = process.env.LLM_API_KEY || ''
const COUNT = Number(arg('count', '8'))
const SECTION_IDS = (arg('sections', '') || SECTIONS.map((s) => s.id).join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function headers() {
  const h = { 'Content-Type': 'application/json' }
  if (API_KEY) h.Authorization = `Bearer ${API_KEY}`
  return h
}

async function resolveModel() {
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL
  const res = await fetch(`${BASE_URL}/models`, { headers: headers() })
  if (!res.ok) throw new Error(`GET /models -> ${res.status} ${await res.text()}`)
  const data = await res.json()
  const id = data?.data?.[0]?.id
  if (!id) throw new Error('No model reported by /v1/models; set LLM_MODEL')
  return id
}

async function main() {
  console.log(`→ ${BASE_URL}  (${COUNT} saker: ${SECTION_IDS.join(', ')})`)
  const model = await resolveModel()
  console.log(`→ modell: ${model}`)

  const body = {
    model,
    temperature: 1.0,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(COUNT, SECTION_IDS) },
    ],
  }
  const post = (withJsonMode) =>
    fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(
        withJsonMode ? { ...body, response_format: { type: 'json_object' } } : body,
      ),
    })

  let res = await post(true)
  // Some local servers reject response_format — retry once without it.
  if (!res.ok && (res.status === 400 || res.status === 422)) res = await post(false)
  if (!res.ok) throw new Error(`POST /chat/completions -> ${res.status} ${await res.text()}`)
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty completion')

  const raw = parseArticlesResponse(content)
  const now = Date.now()
  let written = 0
  raw.forEach((r, i) => {
    // Stagger timestamps: newest first, ~17 min apart.
    const publishedAt = new Date(now - i * 17 * 60_000).toISOString()
    const article = finalizeArticle(r, { publishedAt, index: i, source: 'llm' })
    if (!article.title || !article.body.length) return
    writeArticle(article)
    written++
    console.log(`  ✓ [${article.section}] ${article.title}`)
  })

  const index = rebuildIndex()
  console.log(`\nSkrev ${written} saker. Totalt ${index.length} i index.json.`)
}

main().catch((err) => {
  console.error('\n✖ Feil:', err.message)
  console.error('  Sjekk at LLM-serveren kjører og at LLM_API_KEY er satt.')
  process.exit(1)
})
