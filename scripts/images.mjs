// Download a content-relevant image for a generated article.
// Uses loremflickr (Flickr Creative Commons, keyword-searchable, no API key).
// Falls back gracefully; the caller keeps the deterministic pool image if this
// returns null.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { IMAGES_DIR, hashString } from './store.mjs'

export const GEN_DIR = join(IMAGES_DIR, 'gen')

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

// Reasonable English fallback per section when the model gives no usable query.
const SECTION_QUERY = {
  nyheter: 'news',
  sport: 'sport',
  rampelys: 'concert',
  meninger: 'newspaper',
  forbruker: 'shopping',
}

/** "Måke, Beach!" -> "make,beach" (lowercase, ascii, up to 2 tags). */
function sanitizeTags(query, max = 2) {
  return String(query || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ,]/g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, max)
    .join(',')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchImage(tags, lock) {
  // `lock` pins loremflickr's pseudo-random pick to a specific seed — without
  // it, multiple articles that end up querying the *same* tag (e.g. the
  // model gave no usable imageQuery, so several articles all fall through to
  // the same section-default tag like "news") can get back-to-back requests
  // that resolve to the exact same cached photo. Confirmed empirically:
  // repeated same-tag requests without a lock sometimes collide; a per-
  // article numeric lock reliably varies the result while staying
  // deterministic for that one article.
  const url = `https://loremflickr.com/1200/800/${tags}?lock=${lock}`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 5000) return null
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8
  const isPng = buf[0] === 0x89 && buf[1] === 0x50
  return isJpeg || isPng ? buf : null
}

/**
 * Download an image matching `query`, save it as public/images/gen/<id>.jpg,
 * and return its web path (/images/gen/<id>.jpg) — or null on failure.
 * Tries the full query, then the first tag, then a section default.
 */
export async function downloadArticleImage(id, query, section) {
  const candidates = [
    sanitizeTags(query, 2),
    sanitizeTags(query, 1),
    SECTION_QUERY[section] || 'news',
  ].filter(Boolean)
  const lock = hashString(id) % 1_000_000

  for (const tags of candidates) {
    try {
      const buf = await fetchImage(tags, lock)
      if (buf) {
        mkdirSync(GEN_DIR, { recursive: true })
        writeFileSync(join(GEN_DIR, `${id}.jpg`), buf)
        return { path: `/images/gen/${id}.jpg`, tags }
      }
    } catch {
      /* try next candidate */
    }
    await sleep(400)
  }
  return null
}
