import { useEffect, useState } from 'react'
import { modelStatus, selectModel, type ModelStatus } from '../lib/api'

const POLL_MS = 1000

function isBusy(s: ModelStatus | null): boolean {
  return s?.status === 'downloading' || s?.status === 'starting'
}

function busyText(s: ModelStatus): string {
  if (s.status === 'starting') return 'Starter …'
  const p = s.progress
  if (p && p.totalBytes > 0) {
    const pct = Math.min(100, Math.round((p.receivedBytes / p.totalBytes) * 100))
    return `Laster ned … ${pct} %`
  }
  return 'Laster ned …'
}

/**
 * Topbar model picker. Only rendered in the packaged app, where the backend
 * exposes /api/model (elsewhere it reports supported: false and this stays
 * hidden). Switching to a model that isn't downloaded yet starts the
 * download immediately; progress is polled and shown inline.
 */
export function ModelSelector() {
  const [state, setState] = useState<ModelStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const busy = isBusy(state)

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      const s = await modelStatus()
      if (!cancelled && s) setState(s)
    }
    void refresh()
    // Poll only while a switch is in flight — otherwise nothing changes
    // without us initiating it.
    const timer = busy ? setInterval(refresh, POLL_MS) : null
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [busy])

  if (!state?.supported) return null

  async function handleChange(id: string) {
    setError(null)
    try {
      setState(await selectModel(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // While switching, show the model we're switching to as selected.
  const selected = (busy && state.target) || state.current

  return (
    <label className="model-selector">
      <span className="model-selector__label">Modell</span>
      <select
        value={selected}
        disabled={busy}
        onChange={(e) => void handleChange(e.target.value)}
        aria-label="Språkmodell"
      >
        {state.models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
            {m.downloaded ? '' : ` (${m.sizeLabel})`}
          </option>
        ))}
      </select>
      {busy && <span className="model-selector__status">{busyText(state)}</span>}
      {(error || state.error) && !busy && (
        <span className="model-selector__error" title={error || state.error || ''}>
          Modellbytte feilet
        </span>
      )}
    </label>
  )
}
