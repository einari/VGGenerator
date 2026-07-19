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

export interface ModelStatus {
  supported: boolean
  current?: string
  status?: 'ready' | 'downloading' | 'starting' | 'error'
  target?: string | null
  progress?: { receivedBytes: number; totalBytes: number } | null
  error?: string | null
  models: { id: string; label: string; sizeLabel: string; downloaded: boolean }[]
}

/**
 * Model-selection state. `supported` is false outside the packaged app
 * (yarn dev talks to an external LLM the backend can't swap); null means the
 * backend itself is unreachable. The selector hides in both cases.
 */
export async function modelStatus(): Promise<ModelStatus | null> {
  try {
    const res = await fetch(`${API}/model`)
    if (!res.ok) return null
    return (await res.json()) as ModelStatus
  } catch {
    return null
  }
}

/** Ask the app to switch model — it downloads the model first if missing. */
export async function selectModel(id: string): Promise<ModelStatus> {
  return post<ModelStatus>('/model', { id })
}

export interface TopicSlot {
  topic: string
  keywords: string[]
}

/** Generate articles on the backend (persisted to disk); returns the new ones. */
export async function generateArticles(
  count: number,
  slots: TopicSlot[],
  dialect: string,
): Promise<Article[]> {
  const data = await post<{ articles: Article[] }>('/generate', {
    count,
    slots,
    dialect,
  })
  return data.articles
}

/** Ask the LLM (via backend) for `count` short topics. */
export async function suggestTopics(count: number): Promise<string[]> {
  const data = await post<{ topics: string[] }>('/topics', { count })
  return data.topics
}

/** Spin real Norwegian current-affairs headlines into parody articles. */
export async function generateFromNews(count: number): Promise<Article[]> {
  const data = await post<{ articles: Article[] }>('/generate-news', { count })
  return data.articles
}
