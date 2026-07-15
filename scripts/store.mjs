// Shared helpers for the Node scripts that write article JSON files.
// No backend: articles live as static JSON under public/articles/.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..')
export const ARTICLES_DIR = join(ROOT, 'public', 'articles')
export const IMAGES_DIR = join(ROOT, 'public', 'images')
export const PROMPTS_DIR = join(ROOT, 'prompts')

export const SYSTEM_PROMPT = readFileSync(
  join(PROMPTS_DIR, 'system-prompt.md'),
  'utf8',
)

const config = JSON.parse(
  readFileSync(join(PROMPTS_DIR, 'sections.json'), 'utf8'),
)
export const SECTIONS = config.sections
export const AUTHORS = config.authors

/** Number of images available in public/images (img-01.jpg ...). */
export function imageCount() {
  try {
    return readdirSync(IMAGES_DIR).filter((f) => /^img-\d+\.jpg$/.test(f)).length
  } catch {
    return 24
  }
}

/** Stable string hash (djb2). */
export function hashString(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i)
  return h >>> 0
}

/** Deterministically map an article id to an image path. */
export function imageForId(id, count = imageCount()) {
  const n = (hashString(id) % count) + 1
  return `/images/img-${String(n).padStart(2, '0')}.jpg`
}

/** Build the user message that pins the exact JSON output schema. */
export function buildUserPrompt(count, sectionIds, topics = []) {
  const chosen = SECTIONS.filter((s) => sectionIds.includes(s.id))
  const menu = chosen
    .map((s) => `- "${s.id}" (${s.label}): ${s.brief}`)
    .join('\n')
  const hasTopics = topics.some((t) => t.trim())
  const topicBlock = hasTopics
    ? `\nSkriv én sak per punkt under, i denne rekkefølgen. «Fritt valg» betyr at du selv velger tema. Velg alltid den seksjonen som passer best til temaet:\n${topics
        .map((t, i) => `${i + 1}. ${t.trim() || 'fritt valg'}`)
        .join('\n')}\n`
    : ''
  return `Lag ${count} oppdiktede nyhetssaker i tabloid-stil (VG/Dagbladet). Innholdet skal være absurd, underholdende og fullstendig oppspinn – men helt ekte i formen.

Fordel sakene på disse seksjonene:
${menu}
${topicBlock}
Krav:
- Bruk fiktive personnavn, alltid med alder i parentes ved første nevning: «Ola (52)».
- Overskrift: kort, muntlig, ofte «kolon + – sitat». Ikke punktum til slutt.
- kicker: 1–3 ord, gjerne VERSALER (tema/sted).
- lead (ingress): 1–2 setninger som lokker, holder igjen poenget.
- body: 4–8 korte avsnitt. Legg minst to sitater; sitatavsnitt starter med «– » (tankestrek) og attribueres, f.eks. «– Helt vilt, sier Kari (33).»
- Variér sakene; ikke gjenta samme vri.

Svar med KUN gyldig JSON (ingen markdown, ingen forklaring) på nøyaktig dette skjemaet:
{
  "articles": [
    {
      "section": "<en av seksjons-id-ene over>",
      "kicker": "<kort etikett>",
      "title": "<overskrift>",
      "lead": "<ingress>",
      "body": ["<avsnitt>", "..."],
      "factBox": { "title": "Dette vet vi", "items": ["<punkt>", "..."] },
      "author": "<fullt navn>"
    }
  ]
}
factBox er valgfri (ta med på omtrent halvparten). Returner nøyaktig ${count} saker.`
}

/** Pull the JSON payload out of a raw model response, tolerating fences/prose. */
export function parseArticlesResponse(text) {
  let t = String(text).trim()
  // Strip ```json ... ``` fences if present.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  // Otherwise grab the outermost object.
  if (t[0] !== '{') {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start !== -1 && end !== -1) t = t.slice(start, end + 1)
  }
  const data = JSON.parse(t)
  const list = Array.isArray(data) ? data : data.articles
  if (!Array.isArray(list)) throw new Error('No "articles" array in response')
  return list
}

const VALID_SECTIONS = new Set(SECTIONS.map((s) => s.id))

/** Normalise one raw LLM article into a full, valid Article record. */
export function finalizeArticle(raw, { publishedAt, index = 0, source = 'llm' }) {
  const section = VALID_SECTIONS.has(raw.section) ? raw.section : 'nyheter'
  const title = String(raw.title || 'Uten tittel').trim()
  const body = (Array.isArray(raw.body) ? raw.body : [String(raw.body || '')])
    .map((p) => String(p).trim())
    .filter(Boolean)
  const idBase = slugify(title) || `sak-${index}`
  const id = `${idBase}-${(hashString(title + index) % 100000)
    .toString(36)
    .padStart(3, '0')}`
  const factBox =
    raw.factBox && Array.isArray(raw.factBox.items) && raw.factBox.items.length
      ? {
          title: String(raw.factBox.title || 'Dette vet vi'),
          items: raw.factBox.items.map((i) => String(i).trim()).filter(Boolean),
        }
      : undefined
  return {
    id,
    section,
    kicker: String(raw.kicker || section).toUpperCase().slice(0, 24),
    title,
    lead: String(raw.lead || '').trim(),
    body,
    factBox,
    author: String(raw.author || AUTHORS[index % AUTHORS.length]).trim(),
    publishedAt,
    image: imageForId(id),
    imageAlt: raw.imageAlt ? String(raw.imageAlt) : 'Illustrasjonsfoto',
    isPlus: typeof raw.isPlus === 'boolean' ? raw.isPlus : index % 5 === 0,
    featured: typeof raw.featured === 'boolean' ? raw.featured : index % 4 === 0,
    source,
  }
}

export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[æ]/g, 'ae')
    .replace(/[ø]/g, 'o')
    .replace(/[å]/g, 'a')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60)
}

export function ensureDirs() {
  mkdirSync(ARTICLES_DIR, { recursive: true })
}

/** Read every article file currently on disk. */
export function readAllArticles() {
  ensureDirs()
  return readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => JSON.parse(readFileSync(join(ARTICLES_DIR, f), 'utf8')))
}

export function writeArticle(article) {
  ensureDirs()
  writeFileSync(
    join(ARTICLES_DIR, `${article.id}.json`),
    JSON.stringify(article, null, 2) + '\n',
  )
}

/** Rebuild index.json from every article file on disk (newest first). */
export function rebuildIndex() {
  const all = readAllArticles().sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
  )
  const index = all.map(({ id, section, publishedAt }) => ({
    id,
    section,
    publishedAt,
  }))
  writeFileSync(
    join(ARTICLES_DIR, 'index.json'),
    JSON.stringify(index, null, 2) + '\n',
  )
  return index
}
