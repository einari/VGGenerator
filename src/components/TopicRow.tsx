import { useState, type KeyboardEvent } from 'react'

export interface Slot {
  topic: string
  keywords: string[]
}

/** One numbered topic input plus its editable keyword chips. */
export function TopicRow({
  index,
  slot,
  disabled,
  onChange,
}: {
  index: number
  slot: Slot
  disabled: boolean
  onChange: (next: Slot) => void
}) {
  // editor: 'add' = new chip; a number = editing that chip; null = idle.
  const [editor, setEditor] = useState<'add' | number | null>(null)
  const [draft, setDraft] = useState('')

  const setTopic = (topic: string) => onChange({ ...slot, topic })
  const setKeywords = (keywords: string[]) => onChange({ ...slot, keywords })

  function addKeyword(value: string) {
    const v = value.trim()
    if (!v) return
    // Avoid case-insensitive duplicates within this slot.
    if (slot.keywords.some((k) => k.toLowerCase() === v.toLowerCase())) return
    setKeywords([...slot.keywords, v])
  }

  function removeKeyword(i: number) {
    setKeywords(slot.keywords.filter((_, idx) => idx !== i))
  }

  function editKeyword(i: number, value: string) {
    const v = value.trim()
    if (!v) return removeKeyword(i)
    setKeywords(slot.keywords.map((k, idx) => (idx === i ? v : k)))
  }

  function openAdd() {
    setDraft('')
    setEditor('add')
  }
  function openEdit(i: number) {
    setDraft(slot.keywords[i])
    setEditor(i)
  }
  function commit() {
    if (editor === 'add') addKeyword(draft)
    else if (typeof editor === 'number') editKeyword(editor, draft)
    setEditor(null)
    setDraft('')
  }
  function commitAndContinue() {
    // Enter while adding: commit and keep adding.
    if (editor === 'add') {
      addKeyword(draft)
      setDraft('')
    } else {
      commit()
    }
  }
  function cancel() {
    setEditor(null)
    setDraft('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitAndContinue()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    } else if (e.key === 'Backspace' && !draft && editor === 'add' && slot.keywords.length) {
      // Quick delete of the last chip when the add-field is empty.
      e.preventDefault()
      removeKeyword(slot.keywords.length - 1)
    }
  }

  return (
    <div className="topic-row">
      <span className="topic-num">{index + 1}</span>
      <div className="topic-main">
        <input
          className="topic-input"
          type="text"
          value={slot.topic}
          disabled={disabled}
          placeholder="Tema – la stå tomt for fritt valg"
          onChange={(e) => setTopic(e.target.value)}
        />

        <div className="chips">
          {slot.keywords.map((kw, i) =>
            editor === i ? (
              <input
                key={`edit-${i}`}
                className="chip-input"
                autoFocus
                value={draft}
                disabled={disabled}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={commit}
              />
            ) : (
              <span className="chip" key={`chip-${i}`}>
                <button
                  type="button"
                  className="chip-label"
                  disabled={disabled}
                  title="Rediger nøkkelord"
                  onClick={() => openEdit(i)}
                >
                  {kw}
                </button>
                <button
                  type="button"
                  className="chip-x"
                  disabled={disabled}
                  aria-label={`Fjern nøkkelord ${kw}`}
                  onClick={() => removeKeyword(i)}
                >
                  ×
                </button>
              </span>
            ),
          )}

          {editor === 'add' ? (
            <input
              className="chip-input"
              autoFocus
              value={draft}
              disabled={disabled}
              placeholder="nøkkelord + Enter"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={commit}
            />
          ) : (
            <button
              type="button"
              className="chip-add"
              disabled={disabled}
              onClick={openAdd}
            >
              + nøkkelord
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
