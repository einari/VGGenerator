import type { Article } from './types'
import { SECTIONS } from './sections'
import { buildUserPrompt, parseArticlesResponse, SYSTEM_PROMPT } from './prompt'
import { addGenerated, finalizeArticle } from './articles'

export interface LLMSettings {
  /** OpenAI-compatible base, incl. /v1. Default hits the Vite dev proxy. */
  baseUrl: string
  model: string
  apiKey: string
  count: number
}

const SETTINGS_KEY = 'vg:llm-settings'

export const DEFAULT_SETTINGS: LLMSettings = {
  // The Vite dev server proxies /llm -> http://127.0.0.1:8000 (see vite.config.ts),
  // so browser calls avoid CORS. Change to a direct URL for a production build.
  baseUrl: '/llm/v1',
  model: '',
  apiKey: '',
  count: 6,
}

export function getSettings(): LLMSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(s: LLMSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

function authHeaders(s: LLMSettings): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (s.apiKey) h.Authorization = `Bearer ${s.apiKey}`
  return h
}

function friendlyError(err: unknown): Error {
  if (err instanceof TypeError) {
    return new Error(
      'Fikk ikke kontakt med LLM-serveren. Kjører den på 127.0.0.1:8000, ' +
        'og bruker du dev-serveren (yarn dev) slik at /llm-proxyen er aktiv?',
    )
  }
  return err instanceof Error ? err : new Error(String(err))
}

/** List available model ids from the server. */
export async function listModels(s: LLMSettings): Promise<string[]> {
  try {
    const res = await fetch(`${s.baseUrl}/models`, { headers: authHeaders(s) })
    if (!res.ok) throw new Error(`GET /models -> ${res.status} ${await res.text()}`)
    const data = await res.json()
    return (data?.data ?? []).map((m: { id: string }) => m.id)
  } catch (err) {
    throw friendlyError(err)
  }
}

async function resolveModel(s: LLMSettings): Promise<string> {
  if (s.model) return s.model
  const models = await listModels(s)
  if (!models.length) throw new Error('Serveren rapporterte ingen modeller.')
  return models[0]
}

export interface GenerateOptions {
  count?: number
  sections?: string[]
  onStatus?: (msg: string) => void
}

/**
 * Generate fake VG-style articles via the local LLM, store them in
 * localStorage, and return the full merged list (newest first).
 */
export async function generateArticles(
  settings: LLMSettings,
  opts: GenerateOptions = {},
): Promise<Article[]> {
  const count = opts.count ?? settings.count ?? 6
  const sectionIds = opts.sections ?? SECTIONS.map((s) => s.id)
  const status = opts.onStatus ?? (() => {})

  try {
    status('Kobler til modell …')
    const model = await resolveModel(settings)

    status(`Skriver ${count} saker med ${model} …`)
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(count, sectionIds) },
    ]
    const body = {
      model,
      temperature: 1.0,
      max_tokens: 4096,
      messages,
    }

    async function post(withJsonMode: boolean) {
      return fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: authHeaders(settings),
        body: JSON.stringify(
          withJsonMode
            ? { ...body, response_format: { type: 'json_object' } }
            : body,
        ),
      })
    }

    let res = await post(true)
    // Some local servers reject response_format — retry once without it.
    if (!res.ok && (res.status === 400 || res.status === 422)) {
      res = await post(false)
    }
    if (!res.ok) {
      const text = await res.text()
      if (res.status === 401 || res.status === 403) {
        throw new Error('Avvist av serveren (401/403). Sjekk API-nøkkelen i innstillinger.')
      }
      throw new Error(`Generering feilet: ${res.status} ${text}`)
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error('Tomt svar fra modellen.')

    status('Tolker svaret …')
    const raw = parseArticlesResponse(content)
    const now = Date.now()
    const articles = raw
      .map((r, i) =>
        finalizeArticle(r, {
          publishedAt: new Date(now - i * 1000).toISOString(),
          index: i,
          source: 'llm',
        }),
      )
      .filter((a) => a.title && a.body.length)

    if (!articles.length) throw new Error('Modellen returnerte ingen brukbare saker.')

    addGenerated(articles)
    status(`Ferdig – ${articles.length} nye saker.`)
    return articles
  } catch (err) {
    throw friendlyError(err)
  }
}
