// Shared server-side LLM logic: talk to the local OpenAI-compatible server,
// generate articles (writing them to disk), and suggest topics.
// The API key lives in the environment (.env) — never in the browser.
import {
  SYSTEM_PROMPT,
  SECTIONS,
  buildUserPrompt,
  parseArticlesResponse,
  finalizeArticle,
  writeArticle,
  rebuildIndex,
} from './store.mjs'

const baseUrl = () => process.env.LLM_BASE_URL || 'http://127.0.0.1:8000/v1'
const apiKey = () => process.env.LLM_API_KEY || ''

function headers() {
  const h = { 'Content-Type': 'application/json' }
  const key = apiKey()
  if (key) h.Authorization = `Bearer ${key}`
  return h
}

export async function resolveModel() {
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL
  const res = await fetch(`${baseUrl()}/models`, { headers: headers() })
  if (!res.ok) throw new Error(`GET /models -> ${res.status} ${await res.text()}`)
  const data = await res.json()
  const id = data?.data?.[0]?.id
  if (!id) throw new Error('Ingen modell rapportert av /v1/models; sett LLM_MODEL')
  return id
}

/** One chat completion, tolerating servers that reject response_format. */
async function chatCompletion(model, messages, maxTokens) {
  const body = { model, temperature: 1.0, max_tokens: maxTokens, messages }
  const post = (withJsonMode) =>
    fetch(`${baseUrl()}/chat/completions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(
        withJsonMode ? { ...body, response_format: { type: 'json_object' } } : body,
      ),
    })

  let res = await post(true)
  if (!res.ok && (res.status === 400 || res.status === 422)) res = await post(false)
  if (!res.ok) throw new Error(`POST /chat/completions -> ${res.status} ${await res.text()}`)
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Tomt svar fra modellen')
  return content
}

function parseStringArray(text) {
  let t = String(text).trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const a = t.indexOf('[')
  const b = t.lastIndexOf(']')
  let data
  if (a !== -1 && b !== -1 && (t[0] === '[' || t.indexOf('{') === -1)) {
    data = JSON.parse(t.slice(a, b + 1))
  } else {
    const o = t.indexOf('{')
    const c = t.lastIndexOf('}')
    data = JSON.parse(o !== -1 ? t.slice(o, c + 1) : t)
  }
  const arr = Array.isArray(data) ? data : (data?.temaer ?? data?.topics ?? [])
  return (Array.isArray(arr) ? arr : []).map((x) => String(x).trim()).filter(Boolean)
}

/** Ask the LLM for `count` short, absurd tabloid topics. */
export async function suggestTopics(count = 6) {
  const model = await resolveModel()
  const content = await chatCompletion(
    model,
    [
      {
        role: 'system',
        content:
          'Du er en kreativ desk-redaktør i en norsk tabloid som finner på absurde, men troverdige nyhetstemaer.',
      },
      {
        role: 'user',
        content: `Foreslå nøyaktig ${count} korte nyhetstemaer (3–8 ord hver) for oppdiktede, morsomme tabloidsaker på norsk bokmål. Bland ulike seksjoner (nyheter, sport, kjendis, forbruker, meninger). Svar KUN som JSON på formen {"temaer": ["...", "..."]}. Ingen forklaring.`,
      },
    ],
    1024,
  )
  return parseStringArray(content).slice(0, count)
}

/**
 * Generate `count` articles, write them to public/articles/, rebuild the
 * index, and return the freshly written article objects (newest first).
 */
export async function generate({ count = 6, sections, topics = [] } = {}) {
  const sectionIds =
    Array.isArray(sections) && sections.length ? sections : SECTIONS.map((s) => s.id)
  const model = await resolveModel()
  const content = await chatCompletion(
    model,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(count, sectionIds, topics) },
    ],
    4096,
  )

  const raw = parseArticlesResponse(content)
  const now = Date.now()
  const written = []
  raw.forEach((r, i) => {
    const publishedAt = new Date(now - i * 1000).toISOString()
    const article = finalizeArticle(r, { publishedAt, index: i, source: 'llm' })
    if (!article.title || !article.body.length) return
    writeArticle(article)
    written.push(article)
  })
  rebuildIndex()
  return written
}
