// Single source of truth for the system prompt: the very same markdown file the
// Node generator reads. Vite inlines it as a string via ?raw.
import systemPromptRaw from '../../prompts/system-prompt.md?raw'
import { SECTIONS } from './sections'

export const SYSTEM_PROMPT = systemPromptRaw

/** Build the user message that pins the exact JSON output schema. */
export function buildUserPrompt(count: number, sectionIds: string[]): string {
  const chosen = SECTIONS.filter((s) => sectionIds.includes(s.id))
  const menu = chosen
    .map((s) => `- "${s.id}" (${s.label}): ${s.brief}`)
    .join('\n')
  return `Lag ${count} oppdiktede nyhetssaker i tabloid-stil (VG/Dagbladet). Innholdet skal være absurd, underholdende og fullstendig oppspinn – men helt ekte i formen.

Fordel sakene på disse seksjonene:
${menu}

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

interface RawArticle {
  section?: string
  kicker?: string
  title?: string
  lead?: string
  body?: string[] | string
  factBox?: { title?: string; items?: string[] }
  author?: string
  imageAlt?: string
}

/** Pull the JSON payload out of a raw model response, tolerating fences/prose. */
export function parseArticlesResponse(text: string): RawArticle[] {
  let t = String(text).trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  if (t[0] !== '{' && t[0] !== '[') {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start !== -1 && end !== -1) t = t.slice(start, end + 1)
  }
  const data = JSON.parse(t)
  const list = Array.isArray(data) ? data : data.articles
  if (!Array.isArray(list)) throw new Error('Fant ingen "articles"-liste i svaret')
  return list as RawArticle[]
}
