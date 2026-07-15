import type { Article, ArticleIndexEntry, SectionId } from './types'
import { AUTHORS } from './sections'

// Number of images available under public/images (img-01.jpg ... img-24.jpg).
export const IMAGE_COUNT = 24

const BASE = import.meta.env.BASE_URL // usually "/"
const LS_KEY = 'vg:generated-articles'

/** Stable string hash (djb2) — matches scripts/store.mjs. */
export function hashString(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i)
  return h >>> 0
}

/** Deterministically map an article id to a local image path. */
export function imageForId(id: string, count = IMAGE_COUNT): string {
  const n = (hashString(id) % count) + 1
  return `${BASE}images/img-${String(n).padStart(2, '0')}.jpg`
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60)
}

const VALID_SECTIONS = new Set<SectionId>([
  'nyheter',
  'sport',
  'rampelys',
  'meninger',
  'forbruker',
])

interface RawArticle {
  section?: string
  kicker?: string
  title?: string
  lead?: string
  body?: string[] | string
  factBox?: { title?: string; items?: string[] }
  author?: string
  imageAlt?: string
  isPlus?: boolean
  featured?: boolean
}

interface FinalizeOpts {
  publishedAt: string
  index?: number
  source?: Article['source']
}

/** Normalise one raw LLM article into a full, valid Article — matches store.mjs. */
export function finalizeArticle(raw: RawArticle, opts: FinalizeOpts): Article {
  const { publishedAt, index = 0, source = 'llm' } = opts
  const section = (
    raw.section && VALID_SECTIONS.has(raw.section as SectionId)
      ? raw.section
      : 'nyheter'
  ) as SectionId
  const title = String(raw.title || 'Uten tittel').trim()
  const body = (Array.isArray(raw.body) ? raw.body : [String(raw.body || '')])
    .map((p) => String(p).trim())
    .filter(Boolean)
  const idBase = slugify(title) || `sak-${index}`
  const id = `${idBase}-${(hashString(title + index) % 100000).toString(36)}`
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

// ---- localStorage: browser-generated articles ---------------------------------

export function loadGenerated(): Article[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveGenerated(articles: Article[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(articles))
}

/** Prepend newly generated articles (newest first), keeping at most 60. */
export function addGenerated(fresh: Article[]): Article[] {
  const existing = loadGenerated()
  const seen = new Set(fresh.map((a) => a.id))
  const merged = [...fresh, ...existing.filter((a) => !seen.has(a.id))].slice(0, 60)
  saveGenerated(merged)
  return merged
}

export function clearGenerated(): void {
  localStorage.removeItem(LS_KEY)
}

// ---- loading the static JSON --------------------------------------------------

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json() as Promise<T>
}

let cache: Article[] | null = null

/** Load every article: static JSON files + locally generated, newest first. */
export async function loadAllArticles(force = false): Promise<Article[]> {
  const generated = loadGenerated()
  if (cache && !force) {
    return mergeSorted(cache, generated)
  }
  let seeded: Article[] = []
  try {
    const index = await fetchJson<ArticleIndexEntry[]>(`${BASE}articles/index.json`)
    seeded = await Promise.all(
      index.map((e) => fetchJson<Article>(`${BASE}articles/${e.id}.json`)),
    )
  } catch (err) {
    console.warn('Kunne ikke laste artikler fra JSON:', err)
  }
  cache = seeded
  return mergeSorted(seeded, generated)
}

function mergeSorted(seeded: Article[], generated: Article[]): Article[] {
  const seen = new Set(generated.map((a) => a.id))
  return [...generated, ...seeded.filter((a) => !seen.has(a.id))].sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt),
  )
}

export async function getArticle(id: string): Promise<Article | null> {
  const all = await loadAllArticles()
  return all.find((a) => a.id === id) ?? null
}
