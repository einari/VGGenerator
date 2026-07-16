// Text-to-speech via Piper over the Wyoming protocol (a TCP protocol: one JSON
// header line per event, optionally followed by a binary payload). The backend
// synthesizes each article segment, glues the PCM together with short silences,
// and streams it to the browser as a single WAV.
import net from 'node:net'

export function ttsConfig() {
  return {
    enabled: (process.env.TTS_ENABLED ?? 'true') !== 'false',
    host: process.env.TTS_HOST || '127.0.0.1',
    port: Number(process.env.TTS_PORT || 10200),
    voice: process.env.TTS_VOICE || 'no_NO-talesyntese-medium',
  }
}

/** Break an article into ordered speech segments with pauses (ms after each). */
export function buildSegments(article) {
  const clean = (s) =>
    String(s || '')
      .replace(/[–—]/g, ' ') // quote/range dashes read badly
      .replace(/«|»/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  const segments = []
  if (article.title) segments.push({ text: clean(article.title), pauseMs: 700 })
  if (article.lead) segments.push({ text: clean(article.lead), pauseMs: 700 })
  for (const p of article.body || []) {
    const t = clean(p)
    if (t) segments.push({ text: t, pauseMs: 350 })
  }
  return segments.filter((s) => s.text)
}

/** 44-byte WAV header. Streaming: sizes are set to max since length is unknown. */
export function wavHeader({ rate, width, channels }) {
  const blockAlign = channels * width
  const b = Buffer.alloc(44)
  b.write('RIFF', 0)
  b.writeUInt32LE(0xffffffff, 4)
  b.write('WAVE', 8)
  b.write('fmt ', 12)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20) // PCM
  b.writeUInt16LE(channels, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * blockAlign, 28)
  b.writeUInt16LE(blockAlign, 32)
  b.writeUInt16LE(width * 8, 34)
  b.write('data', 36)
  b.writeUInt32LE(0xffffffff, 40)
  return b
}

function silence(ms, { rate, width, channels }) {
  const bytes = Math.floor((rate * ms) / 1000) * width * channels
  return Buffer.alloc(bytes)
}

function writeEvent(socket, type, data, payload) {
  const header = { type }
  if (data) header.data = data
  if (payload) header.payload_length = payload.length
  socket.write(JSON.stringify(header) + '\n')
  if (payload) socket.write(payload)
}

/**
 * Incremental parser for Wyoming events. Wire format per event:
 *   1) a JSON header line ending in \n, with optional data_length/payload_length
 *   2) data_length bytes of JSON `data` (if present)
 *   3) payload_length bytes of binary payload (if present)
 */
class WyomingParser {
  constructor(onEvent) {
    this.onEvent = onEvent
    this.buf = Buffer.alloc(0)
    this.pending = null
  }
  feed(chunk) {
    this.buf = Buffer.concat([this.buf, chunk])
    for (;;) {
      if (!this.pending) {
        const nl = this.buf.indexOf(0x0a)
        if (nl === -1) return
        const line = this.buf.subarray(0, nl).toString('utf8')
        this.buf = this.buf.subarray(nl + 1)
        let header
        try {
          header = JSON.parse(line)
        } catch {
          continue
        }
        this.pending = {
          type: header.type,
          data: header.data ?? null,
          needData: header.data_length || 0,
          needPayload: header.payload_length || 0,
          payload: null,
        }
      }
      const p = this.pending
      if (p.needData) {
        if (this.buf.length < p.needData) return
        const dataBytes = this.buf.subarray(0, p.needData)
        this.buf = this.buf.subarray(p.needData)
        try {
          p.data = JSON.parse(dataBytes.toString('utf8'))
        } catch {
          p.data = null
        }
        p.needData = 0
      }
      if (p.needPayload) {
        if (this.buf.length < p.needPayload) return
        p.payload = this.buf.subarray(0, p.needPayload)
        this.buf = this.buf.subarray(p.needPayload)
        p.needPayload = 0
      }
      this.pending = null
      this.onEvent({ type: p.type, data: p.data }, p.payload)
    }
  }
}

/**
 * Synthesize `segments` through Piper and stream the audio out.
 * Calls onFormat({rate,width,channels}) once (write the WAV header there), then
 * onAudio(pcmBuffer) repeatedly. Resolves when everything has been spoken.
 */
export function synthesize(segments, cfg, { onFormat, onAudio }) {
  return new Promise((resolve, reject) => {
    if (!segments.length) return resolve()
    const socket = net.connect(cfg.port, cfg.host)
    socket.setTimeout(30000)

    let format = null
    let index = 0

    const sendNext = () => {
      const seg = segments[index]
      writeEvent(socket, 'synthesize', {
        text: seg.text,
        voice: cfg.voice ? { name: cfg.voice } : undefined,
      })
    }

    const parser = new WyomingParser((ev, payload) => {
      if (ev.type === 'audio-start') {
        if (!format) {
          format = {
            rate: ev.data?.rate || 22050,
            width: ev.data?.width || 2,
            channels: ev.data?.channels || 1,
          }
          onFormat(format)
        }
      } else if (ev.type === 'audio-chunk') {
        if (payload && payload.length) onAudio(payload)
      } else if (ev.type === 'audio-stop') {
        const seg = segments[index]
        if (format && seg.pauseMs) onAudio(silence(seg.pauseMs, format))
        index += 1
        if (index < segments.length) sendNext()
        else socket.end()
      }
    })

    socket.on('connect', sendNext)
    socket.on('data', (d) => parser.feed(d))
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('TTS-tidsavbrudd (Piper svarte ikke)'))
    })
    socket.on('error', reject)
    socket.on('close', () => resolve())
  })
}

/** Quick TCP probe so /api/health can report whether Piper is reachable. */
export function probe(cfg, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect(cfg.port, cfg.host)
    const done = (ok) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.on('connect', () => done(true))
    socket.on('timeout', () => done(false))
    socket.on('error', () => done(false))
  })
}
