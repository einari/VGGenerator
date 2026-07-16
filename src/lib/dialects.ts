// UI labels for the dialect dropdown. Ids must match scripts/dialects.mjs,
// where the actual LLM instruction for each dialect lives.
export interface DialectOption {
  id: string
  label: string
}

export const DIALECTS: DialectOption[] = [
  { id: 'bokmal', label: 'Bokmål' },
  { id: 'nynorsk', label: 'Nynorsk' },
  { id: 'nordnorsk', label: 'Nordnorsk' },
  { id: 'kebab', label: 'Kebab (kebabnorsk)' },
  { id: 'badla', label: 'Badla – Sandnes (bredt)' },
]

export const DEFAULT_DIALECT = 'bokmal'
