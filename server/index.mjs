#!/usr/bin/env node
// Tiny zero-dependency backend for VG Generator.
//   POST /api/generate  { count, topics[], sections[] } -> { articles }
//   POST /api/topics    { count }                       -> { topics }
//   GET  /api/health                                    -> { ok, ... }
//
// It calls the local LLM server-side (API key from .env) and writes the
// generated articles to public/articles/ so they persist on disk.
//
// Run directly (`yarn server`, `scripts/dev.mjs`), this only ever serves
// /api/* — exactly like today. The Electron main process instead imports
// `startServer` and passes `staticRoot`/`dataRoot` to also serve the built
// frontend and its mutable data in the packaged app; see server/static.mjs.
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { loadDotEnv } from '../scripts/env.mjs'
import { generate, suggestTopics } from '../scripts/llm.mjs'
import { SECTIONS, readArticle } from '../scripts/store.mjs'
import { DIALECTS, isDialect } from '../scripts/dialects.mjs'
import { ttsConfig, buildSpeechText, synthesize, probe } from '../scripts/tts.mjs'
import { collectSubjects } from '../scripts/news.mjs'
import { createStaticHandler } from './static.mjs'

loadDotEnv()

const DEFAULT_PORT = Number(process.env.PORT || 8787)
const MAX_BODY = 64 * 1024

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS })
  res.end(JSON.stringify(obj))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > MAX_BODY) reject(new Error('Body for stor'))
    })
    req.on('end', () => {
      if (!data) return resolve({})
      try {
        resolve(JSON.parse(data))
      } catch {
        reject(new Error('Ugyldig JSON i forespørselen'))
      }
    })
    req.on('error', reject)
  })
}

function clampCount(n) {
  return Math.max(1, Math.min(12, Math.floor(Number(n) || 1)))
}

/**
 * Build the request listener. `staticRoot`/`dataRoot` are only passed by the
 * packaged Electron app (see electron/main.mjs) — left unset, this serves
 * only /api/* exactly as it always has, so `yarn server`/`yarn dev` are
 * unaffected.
 */
export function createRequestListener({ staticRoot, dataRoot } = {}) {
  const serveStatic = staticRoot
    ? createStaticHandler({ distRoot: staticRoot, dataRoot: dataRoot ?? staticRoot })
    : null

  return async function requestListener(req, res) {
    const { method } = req
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname

    if (method === 'OPTIONS') {
      res.writeHead(204, CORS)
      return res.end()
    }

    try {
      if (method === 'GET' && path === '/api/health') {
        const tts = ttsConfig()
        return send(res, 200, {
          ok: true,
          llm: process.env.LLM_BASE_URL || 'http://127.0.0.1:8000/v1',
          hasKey: Boolean(process.env.LLM_API_KEY),
          sections: SECTIONS.map((s) => ({ id: s.id, label: s.label })),
          dialects: DIALECTS.map((d) => ({ id: d.id, label: d.label })),
          tts: {
            enabled: tts.enabled,
            voice: tts.voice,
            reachable: tts.enabled ? probe() : false,
          },
        })
      }

      // Read an article aloud (Norwegian) as a WAV, via macOS `say`.
      if (method === 'GET' && path === '/api/tts') {
        const tts = ttsConfig()
        if (!tts.enabled) return send(res, 503, { error: 'TTS er avslått' })
        const article = readArticle(url.searchParams.get('id'))
        if (!article) return send(res, 404, { error: 'Fant ikke saken' })
        const text = buildSpeechText(article)
        if (!text) return send(res, 400, { error: 'Ingen tekst å lese' })

        try {
          const wav = await synthesize(text, tts)
          res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', ...CORS })
          return res.end(wav)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('✖ TTS:', msg)
          return send(res, 502, { error: `TTS feilet: ${msg}` })
        }
      }

      if (method === 'POST' && path === '/api/topics') {
        const body = await readBody(req)
        const topics = await suggestTopics(clampCount(body.count))
        return send(res, 200, { topics })
      }

      if (method === 'POST' && path === '/api/generate') {
        const body = await readBody(req)
        const count = clampCount(body.count)
        // slots = [{topic, keywords[]}] (preferred); topics[] is the legacy form.
        const rawSlots = Array.isArray(body.slots)
          ? body.slots
          : Array.isArray(body.topics)
            ? body.topics.map((t) => ({ topic: t, keywords: [] }))
            : []
        const slots = rawSlots.slice(0, count).map((s) => ({
          topic: String(s?.topic || '').slice(0, 200),
          keywords: (Array.isArray(s?.keywords) ? s.keywords : [])
            .slice(0, 12)
            .map((k) => String(k).slice(0, 40).trim())
            .filter(Boolean),
        }))
        const sections = Array.isArray(body.sections)
          ? body.sections.map((s) => String(s))
          : undefined
        const dialect = isDialect(body.dialect) ? body.dialect : 'bokmal'
        const articles = await generate({ count, slots, sections, dialect })
        console.log(`✓ genererte ${articles.length} saker (${dialect})`)
        return send(res, 200, { articles })
      }

      // Spin real Norwegian current-affairs headlines into original parody.
      if (method === 'POST' && path === '/api/generate-news') {
        const body = await readBody(req)
        const count = clampCount(body.count)
        const dialect = isDialect(body.dialect) ? body.dialect : 'bokmal'
        const subjects = await collectSubjects(count)
        if (!subjects.length) {
          return send(res, 502, { error: 'Fikk ikke hentet nyheter fra kildene' })
        }
        const slots = subjects.map((s) => ({ topic: s.subject, keywords: [] }))
        const articles = await generate({ count: slots.length, slots, dialect, spin: true })
        console.log(`✓ spant ${articles.length} saker fra nyheter`)
        return send(res, 200, {
          articles,
          sources: [...new Set(subjects.map((s) => s.source))],
        })
      }

      if (method === 'GET' && serveStatic && serveStatic(req, res)) return

      return send(res, 404, { error: 'Not found' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('✖', msg)
      // Surface auth problems distinctly so the UI can guide the user.
      const status = /401|403/.test(msg) ? 401 : 500
      return send(res, status, { error: msg })
    }
  }
}

/**
 * Start listening, resolving with the server once bound (or rejecting on a
 * bind failure, e.g. EADDRINUSE from a leftover process on the same port —
 * without this, a failed .listen() call became an unhandled 'error' event
 * that silently crashed the process instead of surfacing a clear reason).
 * `staticRoot`/`dataRoot` are only passed by the packaged Electron app (see
 * electron/main.mjs); omitted, this behaves exactly as today (`/api/*` only).
 */
export function startServer({ port = DEFAULT_PORT, staticRoot, dataRoot } = {}) {
  const server = createServer(createRequestListener({ staticRoot, dataRoot }))
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, () => {
      server.off('error', reject)
      console.log(`VG Generator backend på http://127.0.0.1:${port}`)
      console.log(`  LLM: ${process.env.LLM_BASE_URL || 'http://127.0.0.1:8000/v1'}`)
      console.log(`  API-nøkkel: ${process.env.LLM_API_KEY ? 'satt (.env)' : 'ikke satt'}`)
      resolve(server)
    })
  })
}

// Only auto-start when run directly (`yarn server`, scripts/dev.mjs) — not
// when imported by the Electron main process, which calls startServer() itself
// with staticRoot/dataRoot after setting up the bundled LLM.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((err) => {
    console.error('✖ Kunne ikke starte serveren:', err.message)
    process.exit(1)
  })
}
