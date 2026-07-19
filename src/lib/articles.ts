import type { Article, ArticleIndexEntry } from './types'

// Articles live as static JSON on disk (written by the backend / seed script).
// The browser just reads them; no client-side generation or storage.
const BASE = import.meta.env.BASE_URL // usually "/"

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  try {
    return (await res.json()) as T
  } catch {
    // A non-JSON 200 (e.g. an HTML error/fallback page) throws a cryptic
    // raw parse error otherwise ("Unexpected token '<' ... is not valid
    // JSON") with no indication of which request it came from.
    throw new Error(`${path} -> respons var ikke gyldig JSON`)
  }
}

let cache: Article[] | null = null

/** Load every article from public/articles/, newest first. */
export async function loadAllArticles(force = false): Promise<Article[]> {
  if (cache && !force) return cache
  let list: Article[] = []
  try {
    const index = await fetchJson<ArticleIndexEntry[]>(`${BASE}articles/index.json`)
    list = await Promise.all(
      index.map((e) => fetchJson<Article>(`${BASE}articles/${e.id}.json`)),
    )
  } catch (err) {
    console.warn('Kunne ikke laste artikler:', err)
  }
  list.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
  cache = list
  return list
}

export async function getArticle(id: string): Promise<Article | null> {
  const all = await loadAllArticles()
  return all.find((a) => a.id === id) ?? null
}
