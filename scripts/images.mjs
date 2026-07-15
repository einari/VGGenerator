// Download a content-relevant image for a generated article.
// Uses loremflickr (Flickr Creative Commons, keyword-searchable, no API key).
// Falls back gracefully; the caller keeps the deterministic pool image if this
// returns null.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { IMAGES_DIR } from './store.mjs'

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

async function fetchImage(tags) {
  const url = `https://loremflickr.com/1200/800/${tags}`
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

  for (const tags of candidates) {
    try {
      const buf = await fetchImage(tags)
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
