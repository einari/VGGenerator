import type { Article } from './types'

// The Node backend (proxied at /api in dev) owns the LLM + disk persistence.
const API = '/api'

export interface HealthInfo {
  ok: boolean
  llm: string
  hasKey: boolean
  sections: { id: string; label: string }[]
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(
      'Fikk ikke kontakt med backend. Kjører «yarn dev» (som starter både nettstedet og serveren)?',
    )
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `Forespørsel feilet (${res.status})`)
  }
  return data as T
}

/** Quick, non-failing backend probe. Returns null if the backend is down. */
export async function health(): Promise<HealthInfo | null> {
  try {
    const res = await fetch(`${API}/health`)
    if (!res.ok) return null
    return (await res.json()) as HealthInfo
  } catch {
    return null
  }
}

/** Generate articles on the backend (persisted to disk); returns the new ones. */
export async function generateArticles(
  count: number,
  topics: string[],
): Promise<Article[]> {
  const data = await post<{ articles: Article[] }>('/generate', { count, topics })
  return data.articles
}

/** Ask the LLM (via backend) for `count` short topics. */
export async function suggestTopics(count: number): Promise<string[]> {
  const data = await post<{ topics: string[] }>('/topics', { count })
  return data.topics
}
