import { useState } from 'react'
import type { Article } from '../lib/types'
import { SECTIONS } from '../lib/sections'
import {
  generateArticles,
  getSettings,
  listModels,
  saveSettings,
  type LLMSettings,
} from '../lib/generator'

export function GeneratePanel({
  onGenerated,
}: {
  onGenerated: (fresh: Article[]) => void
}) {
  const [settings, setSettings] = useState<LLMSettings>(() => getSettings())
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [modelHint, setModelHint] = useState<string | null>(null)

  async function handleGenerate() {
    if (busy) return
    setBusy(true)
    setError(null)
    setStatus('Starter …')
    try {
      const fresh = await generateArticles(settings, {
        onStatus: (m) => setStatus(m),
      })
      onGenerated(fresh)
      setStatus(`✓ ${fresh.length} nye saker`)
      window.setTimeout(() => setStatus(null), 4000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setStatus(null)
      if (/401|403|nøkkel/i.test(msg)) setShowSettings(true)
    } finally {
      setBusy(false)
    }
  }

  function update<K extends keyof LLMSettings>(key: K, value: LLMSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  function persistAndClose() {
    saveSettings(settings)
    setShowSettings(false)
  }

  async function testConnection() {
    setModelHint('Tester …')
    try {
      const models = await listModels(settings)
      setModelHint(
        models.length
          ? `OK – fant: ${models.slice(0, 3).join(', ')}${models.length > 3 ? ' …' : ''}`
          : 'Tilkoblet, men ingen modeller rapportert.',
      )
    } catch (err) {
      setModelHint(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="genpanel">
      <button
        type="button"
        className="btn-generate"
        onClick={handleGenerate}
        disabled={busy}
      >
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" /> Genererer …
          </>
        ) : (
          <>✨ Generer nyheter</>
        )}
      </button>
      <button
        type="button"
        className="btn-gear"
        title="Innstillinger for LLM"
        aria-label="Innstillinger"
        onClick={() => setShowSettings(true)}
      >
        ⚙
      </button>

      {status && <span className="genstatus">{status}</span>}
      {error && (
        <span className="generror" role="alert">
          {error}
        </span>
      )}

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="LLM-innstillinger"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>LLM-innstillinger</h2>
            <p className="modal-sub">
              Saker skrives av en lokal OpenAI-kompatibel modell og lagres i nettleseren.
            </p>

            <label>
              Base-URL
              <input
                type="text"
                value={settings.baseUrl}
                onChange={(e) => update('baseUrl', e.target.value)}
                placeholder="/llm/v1"
              />
              <small>Dev-serveren proxyer «/llm» til 127.0.0.1:8000.</small>
            </label>

            <label>
              API-nøkkel
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => update('apiKey', e.target.value)}
                placeholder="Bearer-token til serveren"
                autoComplete="off"
              />
            </label>

            <label>
              Modell (valgfritt)
              <input
                type="text"
                value={settings.model}
                onChange={(e) => update('model', e.target.value)}
                placeholder="Auto (første tilgjengelige)"
              />
            </label>

            <label>
              Antall saker per generering
              <input
                type="number"
                min={1}
                max={12}
                value={settings.count}
                onChange={(e) =>
                  update('count', Math.max(1, Math.min(12, Number(e.target.value) || 1)))
                }
              />
            </label>

            <p className="modal-sub">
              Seksjoner det trekkes fra: {SECTIONS.map((s) => s.label).join(', ')}.
            </p>

            {modelHint && <p className="modal-hint">{modelHint}</p>}

            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={testConnection}>
                Test tilkobling
              </button>
              <button type="button" className="btn-primary" onClick={persistAndClose}>
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
