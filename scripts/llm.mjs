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
import { downloadArticleImage } from './images.mjs'
import { dialectInstruction } from './dialects.mjs'

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

/** Extract a single JSON object from a raw model response. */
function parseObject(text) {
  let t = String(text).trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1)
  return JSON.parse(t)
}

/** Which of `keywords` are absent from the article's visible text. */
function missingKeywords(article, keywords) {
  const hay = [
    article.title,
    article.lead,
    ...(article.body || []),
    ...(article.factBox?.items || []),
  ]
    .join(' ')
    .toLowerCase()
  return keywords.filter((k) => k && !hay.includes(k.toLowerCase()))
}

/** Ask the model to rewrite one article so the given keywords appear verbatim. */
async function repairKeywords(model, rawArticle, keywords, dialect = 'bokmal') {
  const payload = {
    section: rawArticle.section,
    kicker: rawArticle.kicker,
    title: rawArticle.title,
    lead: rawArticle.lead,
    body: rawArticle.body,
    factBox: rawArticle.factBox,
    imageQuery: rawArticle.imageQuery,
    author: rawArticle.author,
  }
  const dialectText = dialectInstruction(dialect)
  const dialectNote = dialectText ? ` ${dialectText}` : ''
  const content = await chatCompletion(
    model,
    [
      {
        role: 'system',
        content:
          'Du er redaktør i en norsk tabloid og skriver om saker uten å endre stil, dialekt eller lengde.',
      },
      {
        role: 'user',
        content: `Her er en nyhetssak som JSON:\n${JSON.stringify(payload)}\n\nSkriv saken om slik at ALLE disse ordene står ordrett i brødteksten (body): ${keywords
          .map((k) => `«${k}»`)
          .join(
            ', ',
          )}. Behold samme tema, seksjon, stil, lengde og struktur.${dialectNote} Returner KUN gyldig JSON med de samme feltene.`,
      },
    ],
    4096,
  )
  return parseObject(content)
}

/**
 * Generate `count` articles, write them to public/articles/, rebuild the
 * index, and return the freshly written article objects (newest first).
 */
export async function generate({
  count = 6,
  sections,
  slots,
  topics = [],
  dialect = 'bokmal',
} = {}) {
  const sectionIds =
    Array.isArray(sections) && sections.length ? sections : SECTIONS.map((s) => s.id)
  // slots = [{topic, keywords[]}]; fall back to plain topic strings.
  const effectiveSlots =
    Array.isArray(slots) && slots.length
      ? slots
      : topics.map((t) => ({ topic: t, keywords: [] }))
  const model = await resolveModel()
  const content = await chatCompletion(
    model,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(count, sectionIds, effectiveSlots, dialect) },
    ],
    4096,
  )

  const raw = parseArticlesResponse(content)
  const now = Date.now()
  const written = []
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]
    const publishedAt = new Date(now - i * 1000).toISOString()
    let article = finalizeArticle(r, { publishedAt, index: i, source: 'llm' })
    if (!article.title || !article.body.length) continue

    // Enforce the slot's keywords: verify they made it in, else one rewrite pass.
    const keywords = effectiveSlots[i]?.keywords || []
    if (keywords.length && missingKeywords(article, keywords).length) {
      try {
        const repairedRaw = await repairKeywords(model, r, keywords, dialect)
        const fixed = finalizeArticle(repairedRaw, { publishedAt, index: i, source: 'llm' })
        // Keep the rewrite only if it covers more keywords; preserve identity.
        if (
          fixed.title &&
          fixed.body.length &&
          missingKeywords(fixed, keywords).length < missingKeywords(article, keywords).length
        ) {
          fixed.id = article.id
          fixed.image = article.image
          article = fixed
        }
      } catch {
        /* keep best-effort original */
      }
    }

    // Fetch a content-relevant image; keep the pool fallback on failure.
    const img = await downloadArticleImage(article.id, article.imageQuery, article.section)
    if (img) {
      article.image = img.path
      if (!r.imageAlt) article.imageAlt = `Illustrasjonsfoto (${img.tags})`
    }

    writeArticle(article)
    written.push(article)
  }
  rebuildIndex()
  return written
}
