// Shared helpers for the Node scripts that write article JSON files.
// No backend: articles live as static JSON under public/articles/.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { dialectInstruction } from './dialects.mjs'

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

/** Normalise a slot which may be a plain topic string or {topic, keywords}. */
function normalizeSlot(slot) {
  if (typeof slot === 'string') return { topic: slot, keywords: [] }
  return {
    topic: String(slot?.topic || ''),
    keywords: Array.isArray(slot?.keywords)
      ? slot.keywords.map((k) => String(k).trim()).filter(Boolean)
      : [],
  }
}

/** Build the user message that pins the exact JSON output schema. */
export function buildUserPrompt(
  count,
  sectionIds,
  slots = [],
  dialect = 'bokmal',
  spin = false,
) {
  const chosen = SECTIONS.filter((s) => sectionIds.includes(s.id))
  const menu = chosen
    .map((s) => `- "${s.id}" (${s.label}): ${s.brief}`)
    .join('\n')
  const dialectText = dialectInstruction(dialect)
  const dialectBlock = dialectText ? `\nDIALEKT: ${dialectText}\n` : ''
  const spinBlock = spin
    ? '\nSPINN: Temaene under er ekte, aktuelle norske nyhetsoverskrifter. Lag en absurd, oppdiktet PARODI av hvert tema: behold det gjenkjennelige emnet, men gjør alt innhold, sitater, tall og detaljer fullstendig fiktivt og morsomt. Bruk FIKTIVE personnavn – ikke gjengi ekte, navngitte personer eller deres utsagn. Ikke gjenfortell den ekte saken.\n'
    : ''
  const norm = slots.map(normalizeSlot)
  const hasContent = norm.some((s) => s.topic.trim() || s.keywords.length)
  const anyKeywords = norm.some((s) => s.keywords.length)
  const slotBlock = hasContent
    ? `\nSkriv én sak per punkt under, i denne rekkefølgen. «Fritt valg» betyr at du selv velger tema. Velg alltid den seksjonen som passer best.\n${norm
        .map((s, i) => {
          const topic = s.topic.trim() || 'fritt valg'
          const kw = s.keywords.length
            ? ` — MÅ inneholde disse ordene ordrett i brødteksten: ${s.keywords
                .map((k) => `«${k}»`)
                .join(', ')}`
            : ''
          return `${i + 1}. Tema: ${topic}${kw}`
        })
        .join('\n')}${
        anyKeywords
          ? '\n\nVIKTIG: Nøkkelordene som er oppgitt for en sak SKAL forekomme ordrett i den sakens brødtekst. Vev dem inn naturlig, men de må stå der.'
          : ''
      }\n`
    : ''
  return `Lag ${count} oppdiktede nyhetssaker i tabloid-stil (VG/Dagbladet). Innholdet skal være absurd, underholdende og fullstendig oppspinn – men helt ekte i formen.
${dialectBlock}${spinBlock}
Fordel sakene på disse seksjonene:
${menu}
${slotBlock}
Krav:
- Bruk fiktive personnavn, alltid med alder i parentes ved første nevning: «Ola (52)» <- dette er bare et eksempel, ikke ta det bokstavelig.
- Overskrift: kort, muntlig. «Kolon + – sitat» er ett mønster, men variér: bruk også «Dette/Slik/Derfor», «Navn (alder) + verb», tall/liste eller «-sjokk/-kaos»-ord. Ikke punktum til slutt.
- IKKE bruk «Det er helt sykt/vilt/galskap» (eller «helt» i sitatet) i mer enn maks én overskrift i denne bunken – helst ingen. La overskriftene være tydelig ulike hverandre.
- kicker: 1–3 ord, gjerne VERSALER (tema/sted).
- lead (ingress): 1–2 setninger som lokker, holder igjen poenget.
- body: 4–8 korte avsnitt. Legg minst to sitater; sitatavsnitt starter med «– » (tankestrek) og attribueres, f.eks. «– Helt vilt, sier Kari (33).»
- imageQuery: 1–3 ENGELSKE søkeord (adskilt med komma) for et illustrasjonsfoto som passer saken, f.eks. «seagull, beach» eller «roundabout, traffic». Bruk konkrete substantiv, ingen navn.
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
      "imageQuery": "<1-3 engelske søkeord>",
      "author": "<fullt navn>"
    }
  ]
}
factBox er valgfri (ta med på omtrent halvparten). Returner nøyaktig ${count} saker.`
}

/** Extract the outermost {...} / [...] region, dropping junk on either side. */
function sliceOutermost(t) {
  const firstObj = t.indexOf('{')
  const firstArr = t.indexOf('[')
  let start = -1
  let end = -1
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr
    end = t.lastIndexOf(']')
  } else if (firstObj !== -1) {
    start = firstObj
    end = t.lastIndexOf('}')
  }
  return start !== -1 && end > start ? t.slice(start, end + 1) : t
}

/**
 * Pull each article object out of the array by scanning balanced braces (string-
 * aware). Tolerates a missing comma between objects — the exact failure small
 * models hit on longer outputs — because it never relies on the commas.
 */
function extractArticleObjects(text) {
  const from = text.indexOf('[') + 1 || 0
  const objs = []
  let depth = 0
  let start = -1
  let inStr = false
  let esc = false
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') {
      if (depth === 0) start = i
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        objs.push(text.slice(start, i + 1))
        start = -1
      }
      if (depth < 0) depth = 0
    } else if (c === ']' && depth === 0) {
      break // end of the articles array
    }
  }
  return objs
}

/** Pull the JSON payload out of a raw model response, tolerating fences/prose. */
export function parseArticlesResponse(text) {
  let t = String(text).trim()
  // Strip ```json ... ``` fences if present.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  t = sliceOutermost(t)

  // Fast path: a clean, well-formed response.
  try {
    const data = JSON.parse(t)
    const list = Array.isArray(data) ? data : data.articles
    if (Array.isArray(list) && list.length) return list
  } catch {
    /* fall through to salvage */
  }

  // Salvage: parse each article object on its own, skipping any broken one.
  const articles = []
  for (const objText of extractArticleObjects(t)) {
    const cleaned = objText.replace(/,(\s*[}\]])/g, '$1') // drop trailing commas
    try {
      const obj = JSON.parse(cleaned)
      if (obj && typeof obj === 'object' && (obj.title || obj.body || obj.lead)) {
        articles.push(obj)
      }
    } catch {
      /* skip this one, keep the rest */
    }
  }
  if (articles.length) return articles
  throw new Error('Fant ingen gyldige saker i modell-svaret')
}

const VALID_SECTIONS = new Set(SECTIONS.map((s) => s.id))

// Small models occasionally leak stray CJK/Hangul/Kana tokens into otherwise
// Norwegian text. Strip those scripts (never valid here); keep æøå, «», – etc.
const FOREIGN_SCRIPTS =
  /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-䶿一-鿿가-힯＀-￯]/g

function clean(str) {
  return String(str).replace(FOREIGN_SCRIPTS, '').replace(/[ \t]{2,}/g, ' ').trim()
}

/** Normalise one raw LLM article into a full, valid Article record. */
export function finalizeArticle(raw, { publishedAt, index = 0, source = 'llm' }) {
  const section = VALID_SECTIONS.has(raw.section) ? raw.section : 'nyheter'
  const title = clean(raw.title || 'Uten tittel')
  const body = (Array.isArray(raw.body) ? raw.body : [String(raw.body || '')])
    .map((p) => clean(p))
    .filter(Boolean)
  const idBase = slugify(title) || `sak-${index}`
  const id = `${idBase}-${(hashString(title + index) % 100000)
    .toString(36)
    .padStart(3, '0')}`
  const factBox =
    raw.factBox && Array.isArray(raw.factBox.items) && raw.factBox.items.length
      ? {
          title: clean(raw.factBox.title || 'Dette vet vi'),
          items: raw.factBox.items.map((i) => clean(i)).filter(Boolean),
        }
      : undefined
  return {
    id,
    section,
    kicker: clean(raw.kicker || section).toUpperCase().slice(0, 24),
    title,
    lead: clean(raw.lead || ''),
    body,
    factBox,
    author: clean(raw.author || AUTHORS[index % AUTHORS.length]),
    publishedAt,
    image: imageForId(id),
    imageQuery: raw.imageQuery ? String(raw.imageQuery).slice(0, 80) : '',
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

/** Read a single article by id, or null if it does not exist. */
export function readArticle(id) {
  if (!id || !/^[a-z0-9-]+$/i.test(id)) return null
  const file = join(ARTICLES_DIR, `${id}.json`)
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
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
