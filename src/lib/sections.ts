import type { Section } from './types'

// UI/nav source of truth for the browser. Mirrors prompts/sections.json, which
// the Node scripts use. Keep the two in sync if you add a section.
export const SECTIONS: Section[] = [
  {
    id: 'nyheter',
    label: 'Nyheter',
    brief: 'Ulykker, vær, krim, politikk-drama, «folk raser», kuriosa og siste nytt.',
  },
  {
    id: 'sport',
    label: 'Sport',
    brief: 'Fotball, langrenn, håndball; slakt, klar tale, overgangsrykter, dramatiske kamper.',
  },
  {
    id: 'rampelys',
    label: 'Rampelys',
    brief: 'Kjendis og underholdning; brudd, comeback, reality, konsert, skandale.',
  },
  {
    id: 'meninger',
    label: 'Meninger',
    brief: 'Kommentar/leder med tydelig jeg-stemme og en spiss konklusjon.',
  },
  {
    id: 'forbruker',
    label: 'Forbruker',
    brief: 'Priser, strøm, mat, renter, spar penger, tester og advarsler.',
  },
]

export function sectionLabel(id: string): string {
  return SECTIONS.find((s) => s.id === id)?.label ?? id
}
