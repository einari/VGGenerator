import { useState } from 'react'
import type { Article } from '../lib/types'
import { generateFromNews } from '../lib/api'

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Front-page button that spins real Norwegian current-affairs headlines into
 * absurd parody articles. Opens a small dialog to pick how many.
 */
export function NewsSpinButton({
  onGenerated,
}: {
  onGenerated: (fresh: Article[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(6)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSpin() {
    if (busy) return
    setBusy(true)
    setError(null)
    setStatus('Henter dagens overskrifter og spinner tull …')
    try {
      const fresh = await generateFromNews(count)
      onGenerated(fresh)
      setOpen(false)
      setStatus(`✓ ${fresh.length} nye saker`)
      window.setTimeout(() => setStatus(null), 4000)
    } catch (err) {
      setError(msg(err))
      setStatus(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="newsspin">
      <button
        type="button"
        className="btn-generate"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        🗞️ Spinn nyheter
      </button>
      {status && !open && <span className="genstatus">{status}</span>}

      {open && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!busy) setOpen(false)
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Spinn dagens nyheter"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Spinn dagens nyheter</h2>
            <p className="modal-sub">
              Vi henter ekte overskrifter fra tilfeldige norske nyhetssider (VG, NRK,
              Dagbladet, Aftenposten, Se og Hør) og lager absurd, oppdiktet tull av
              dem – med fiktive personer. Ingen sak gjentas.
            </p>

            <label className="count-field">
              Antall saker
              <input
                type="number"
                min={1}
                max={12}
                value={count}
                disabled={busy}
                onChange={(e) =>
                  setCount(Math.max(1, Math.min(12, Math.floor(Number(e.target.value)) || 1)))
                }
              />
            </label>

            {status && open && <p className="dialog-status">{status}</p>}
            {error && (
              <p className="dialog-error" role="alert">
                {error}
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Avbryt
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSpin}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Spinner …
                  </>
                ) : (
                  <>Spinn {count} saker</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
