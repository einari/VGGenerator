// Fetch current-affairs *headlines* (short topic phrases only) from Norwegian
// news sites, so the LLM can spin each subject into an original parody. We only
// use headlines as topic seeds — never the article text.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

export const SOURCES = [
  { url: 'https://www.vg.no', label: 'VG' },
  { url: 'https://www.dagbladet.no', label: 'Dagbladet' },
  { url: 'https://www.nrk.no', label: 'NRK' },
  { url: 'https://www.aftenposten.no', label: 'Aftenposten' },
  { url: 'https://www.seoghor.no', label: 'Se og Hør' },
]

const NAMED = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
  aelig: 'æ', oslash: 'ø', aring: 'å', eacute: 'é', oacute: 'ó', uuml: 'ü',
}

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => {
      const lower = name.toLowerCase()
      if (!(lower in NAMED)) return m
      const ch = NAMED[lower]
      return name[0] === name[0].toUpperCase() && /[a-z]/.test(ch)
        ? ch.toUpperCase()
        : ch
    })
}

const stripTags = (s) => String(s).replace(/<[^>]+>/g, ' ')

const NAV =
  /\b(meny|logg inn|logg ut|abonnement|abonner|personvern|cookie|informasjonskapsler|kundeservice|nyhetsbrev|til forsiden|del artikkel|annonse|annonsørinnhold|podkast|programoversikt|se og hør|dagbladet pluss|vg\+|last ned|søk|min side)\b/i

// Real tragedies should not be turned into parody. Drop these subjects entirely.
const SENSITIVE =
  /\b(drept|drap|dreper|død|døde|dødsfall|dødsulykke|omkom|omkommet|drukn|skutt|skyting|kniv|voldtekt|overgrep|misbruk|mishandl|selvmord|terror|krig|massakre|bombe|eksplosjon|gissel|kidnapp|savnet|kreft|dødssyk|dødsdømt|ulykke)\b/i

function cleanHeadline(raw) {
  let t = decodeEntities(stripTags(raw)).replace(/\s+/g, ' ').trim()
  t = t.replace(/\s*[–|-]\s*(VG|NRK|Dagbladet|Aftenposten|Se og Hør)\s*$/i, '').trim()
  if (t.length < 22 || t.length > 130) return ''
  if ((t.match(/\s/g) || []).length < 3) return '' // fewer than ~4 words
  if (!/[a-zæøå]/.test(t)) return '' // must contain lowercase (not a nav ALLCAPS)
  if (NAV.test(t)) return ''
  if (SENSITIVE.test(t)) return '' // don't parody real tragedies
  if (/https?:|\.no\b|@|©/i.test(t)) return ''
  return t
}

async function fetchHeadlines(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'nb-NO,nb;q=0.9' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return []
  const html = await res.text()
  const found = new Set()
  const add = (s) => {
    const t = cleanHeadline(s)
    if (t) found.add(t)
  }
  for (const m of html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)) add(m[1])
  for (const m of html.matchAll(/"title"\s*:\s*"([^"\\]{22,130})"/g)) add(m[1])
  for (const m of html.matchAll(/aria-label="([^"]{22,130})"/gi)) add(m[1])
  return [...found]
}

const STOP = new Set(
  'og i på til av for som med det den de har en et er å ikke om han hun vi seg blir ble skal kan må men når så her nå ny nye etter mot fra ved over under mellom'.split(
    ' ',
  ),
)

function tokenize(s) {
  return s
    .toLowerCase()
    .replace(/[^a-zæøå0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
}

/** Are two subjects about the same thing (token overlap or containment)? */
function similar(a, b) {
  const A = new Set(tokenize(a))
  const B = new Set(tokenize(b))
  if (!A.size || !B.size) return false
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  const jaccard = inter / (A.size + B.size - inter)
  const la = a.toLowerCase()
  const lb = b.toLowerCase()
  return jaccard >= 0.5 || la.includes(lb) || lb.includes(la)
}

function dedupe(items) {
  const kept = []
  for (const it of items) {
    if (!kept.some((k) => similar(k.subject, it.subject))) kept.push(it)
  }
  return kept
}

// Deterministic-enough shuffle; Math.random is fine in the backend.
function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Collect up to `count` distinct current-affairs subjects, mixed across a random
 * selection of the sources. Returns [{ subject, source }].
 */
export async function collectSubjects(count) {
  const order = shuffle(SOURCES)
  const pool = []
  const pull = async (src) => {
    try {
      const heads = await fetchHeadlines(src.url)
      // Cap each source so one busy front page doesn't dominate the mix.
      for (const h of heads.slice(0, Math.max(count, 6))) {
        pool.push({ subject: h, source: src.label })
      }
    } catch {
      /* skip a source that fails */
    }
  }
  // First wave: 3 random sources in parallel for a mix.
  await Promise.all(order.slice(0, 3).map(pull))
  let unique = dedupe(shuffle(pool))
  // Fall back to the remaining sources if we came up short.
  if (unique.length < count) {
    await Promise.all(order.slice(3).map(pull))
    unique = dedupe(shuffle(pool))
  }
  return unique.slice(0, count)
}
