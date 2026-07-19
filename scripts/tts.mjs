// Text-to-speech via macOS's built-in `say` command — no Docker, no separate
// server process. `say` can't write to a stdout pipe (confirmed empirically:
// `say -o -` produces an empty file), so we round-trip through a temp file.
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function ttsConfig() {
  return {
    enabled: (process.env.TTS_ENABLED ?? 'true') !== 'false',
    voice: process.env.TTS_VOICE || 'Nora',
  }
}

/** Concatenate an article's title, lead and body into one speakable string. */
export function buildSpeechText(article) {
  const clean = (s) =>
    String(s || '')
      .replace(/[–—]/g, ' ') // quote/range dashes read badly
      .replace(/«|»/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  const parts = [article.title, article.lead, ...(article.body || [])]
    .map(clean)
    .filter(Boolean)
  return parts.join('. ')
}

/** Synthesize `text` with macOS `say`, returning a WAV Buffer. */
export async function synthesize(text, cfg) {
  const dir = await mkdtemp(join(tmpdir(), 'vggen-tts-'))
  const file = join(dir, 'out.wav')
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('say', [
        '-v', cfg.voice,
        '-o', file,
        '--data-format=LEI16@22050',
        text,
      ])
      let stderr = ''
      child.stderr.on('data', (d) => (stderr += d))
      child.on('error', reject)
      child.on('exit', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`say avsluttet med kode ${code}: ${stderr.trim()}`))
      })
    })
    return await readFile(file)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** TTS is only available on macOS, where `say` ships out of the box. */
export function probe() {
  return process.platform === 'darwin'
}
