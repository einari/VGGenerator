import { useState } from 'react'
import type { Article } from '../lib/types'
import { generateArticles, suggestTopics } from '../lib/api'
import { DIALECTS, DEFAULT_DIALECT } from '../lib/dialects'
import { TopicRow, type Slot } from './TopicRow'

function resize(arr: Slot[], n: number): Slot[] {
  const next = arr.slice(0, n)
  while (next.length < n) next.push({ topic: '', keywords: [] })
  return next
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const DEFAULT_COUNT = 6

export function GeneratePanel({
  onGenerated,
}: {
  onGenerated: (fresh: Article[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(DEFAULT_COUNT)
  const [dialect, setDialect] = useState(DEFAULT_DIALECT)
  const [slots, setSlots] = useState<Slot[]>(() => resize([], DEFAULT_COUNT))
  const [busy, setBusy] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function changeCount(n: number) {
    const c = Math.max(1, Math.min(12, Math.floor(n) || 1))
    setCount(c)
    setSlots((prev) => resize(prev, c))
  }

  function setSlot(i: number, next: Slot) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? next : s)))
  }

  async function handleSuggest() {
    if (busy || suggesting) return
    setSuggesting(true)
    setError(null)
    setStatus('Finner på temaer …')
    try {
      const t = await suggestTopics(count)
      // Fill the topic fields, preserving any keywords already entered.
      setSlots((prev) =>
        resize(prev, count).map((s, i) => ({ ...s, topic: t[i] ?? s.topic })),
      )
      setStatus(null)
    } catch (err) {
      setError(msg(err))
      setStatus(null)
    } finally {
      setSuggesting(false)
    }
  }

  async function handleGenerate() {
    if (busy) return
    setBusy(true)
    setError(null)
    setStatus('Genererer … modellen skriver, dette kan ta litt tid.')
    try {
      const fresh = await generateArticles(
        count,
        slots.map((s) => ({ topic: s.topic.trim(), keywords: s.keywords })),
        dialect,
      )
      onGenerated(fresh)
      setOpen(false)
      setStatus(`✓ ${fresh.length} nye saker lagret`)
      window.setTimeout(() => setStatus(null), 4000)
    } catch (err) {
      setError(msg(err))
      setStatus(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="genpanel">
      <button
        type="button"
        className="btn-generate"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        ✨ Generer nyheter
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
            className="modal modal--gen"
            role="dialog"
            aria-modal="true"
            aria-label="Generer nyheter"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Generer nyheter</h2>
            <p className="modal-sub">
              Skriv et tema per sak (eller la det stå tomt for fritt valg), og legg
              til nøkkelord modellen må skrive saken rundt. Sakene lagres på disk.
            </p>

            <div className="gen-fields">
              <label className="count-field">
                Antall saker
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={count}
                  disabled={busy}
                  onChange={(e) => changeCount(Number(e.target.value))}
                />
              </label>
              <label className="count-field">
                Dialekt
                <select
                  value={dialect}
                  disabled={busy}
                  onChange={(e) => setDialect(e.target.value)}
                >
                  {DIALECTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="topics">
              {slots.map((s, i) => (
                <TopicRow
                  key={i}
                  index={i}
                  slot={s}
                  disabled={busy}
                  onChange={(next) => setSlot(i, next)}
                />
              ))}
            </div>

            <div className="gen-toolbar">
              <button
                type="button"
                className="btn-ghost"
                onClick={handleSuggest}
                disabled={busy || suggesting}
              >
                {suggesting ? (
                  <>
                    <span className="spinner spinner--dark" aria-hidden="true" /> Foreslår …
                  </>
                ) : (
                  <>🎲 Foreslå temaer</>
                )}
              </button>
              <button
                type="button"
                className="btn-link"
                onClick={() => setSlots(resize([], count))}
                disabled={busy}
              >
                Tøm
              </button>
            </div>

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
                onClick={handleGenerate}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Genererer …
                  </>
                ) : (
                  <>Generer {count} saker</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
