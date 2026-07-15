#!/usr/bin/env node
// Tiny zero-dependency backend for VG Generator.
//   POST /api/generate  { count, topics[], sections[] } -> { articles }
//   POST /api/topics    { count }                       -> { topics }
//   GET  /api/health                                    -> { ok, ... }
//
// It calls the local LLM server-side (API key from .env) and writes the
// generated articles to public/articles/ so they persist on disk.
import { createServer } from 'node:http'
import { loadDotEnv } from '../scripts/env.mjs'
import { generate, suggestTopics } from '../scripts/llm.mjs'
import { SECTIONS } from '../scripts/store.mjs'

loadDotEnv()

const PORT = Number(process.env.PORT || 8787)
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

const server = createServer(async (req, res) => {
  const { method } = req
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname

  if (method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }

  try {
    if (method === 'GET' && path === '/api/health') {
      return send(res, 200, {
        ok: true,
        llm: process.env.LLM_BASE_URL || 'http://127.0.0.1:8000/v1',
        hasKey: Boolean(process.env.LLM_API_KEY),
        sections: SECTIONS.map((s) => ({ id: s.id, label: s.label })),
      })
    }

    if (method === 'POST' && path === '/api/topics') {
      const body = await readBody(req)
      const topics = await suggestTopics(clampCount(body.count))
      return send(res, 200, { topics })
    }

    if (method === 'POST' && path === '/api/generate') {
      const body = await readBody(req)
      const count = clampCount(body.count)
      const topics = Array.isArray(body.topics)
        ? body.topics.slice(0, count).map((t) => String(t))
        : []
      const sections = Array.isArray(body.sections)
        ? body.sections.map((s) => String(s))
        : undefined
      const articles = await generate({ count, topics, sections })
      console.log(`✓ genererte ${articles.length} saker`)
      return send(res, 200, { articles })
    }

    return send(res, 404, { error: 'Not found' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('✖', msg)
    // Surface auth problems distinctly so the UI can guide the user.
    const status = /401|403/.test(msg) ? 401 : 500
    return send(res, status, { error: msg })
  }
})

server.listen(PORT, () => {
  console.log(`VG Generator backend på http://127.0.0.1:${PORT}`)
  console.log(`  LLM: ${process.env.LLM_BASE_URL || 'http://127.0.0.1:8000/v1'}`)
  console.log(`  API-nøkkel: ${process.env.LLM_API_KEY ? 'satt (.env)' : 'ikke satt'}`)
})
