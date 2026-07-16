// Dialect options + the instruction each one hands to the LLM.
// The browser only sends the id; the instruction text stays server-side.
export const DIALECTS = [
  {
    id: 'bokmal',
    label: 'Bokmål',
    // Default — no special instruction needed.
    instruction: '',
  },
  {
    id: 'nordnorsk',
    label: 'Nordnorsk',
    instruction:
      'Skriv HELE saken (overskrift, ingress, brødtekst og sitater) på nordnorsk dialekt. Kjennetegn: «æ» for jeg, «ikkje» for ikke, spørreord som «ka/kem/kor/koffer» (hva/hvem/hvor/hvorfor), «dokker» for dere, bestemt flertall på «-an» (guttan, bilan, husan), «e» for er, og en direkte, folkelig tone. Bruk dialekten konsekvent gjennom hele saken, men hold teksten lesbar.',
  },
  {
    id: 'kebab',
    label: 'Kebab (kebabnorsk)',
    instruction:
      'Skriv HELE saken på kebabnorsk (multietnolekt fra Oslo øst). Bruk slangord som «wallah» (jeg sverger), «jalla» (fort/dårlig), «habibi» (kompis), «flus» og «para» (penger), «sjofe/sjuse» (å se), «avor» (dra/stikke), «baosj» (politi), «tæsje» (å stjele), «schpa» (fin/kul), «keff» (dårlig) og «lø» (kjedelig). Bruk en ung, muntlig tone og løsere ordstilling. Hold det leselig og parodisk – ikke nedsettende.',
  },
  {
    id: 'badla',
    label: 'Badla – Sandnes (bredt)',
    instruction:
      'Skriv HELE saken på bred Sandnes-/Jæren-dialekt (Rogaland). Kjennetegn: «eg» for jeg, «ikkje/kje» for ikke, «ka» for hva, «koss» for hvordan, «me» for vi, «dokke» for dere. Skriv ut den tjukke uttalen: dobbel-L blir «dl» (alle→adle, ballen→badlen, gullet→gudle) og «rn» blir «dn» (barn→badn, gjerne→gjedne). Bruk trekkene konsekvent gjennom hele saken, men hold teksten lesbar.',
  },
]

const BY_ID = new Map(DIALECTS.map((d) => [d.id, d]))

export function dialectInstruction(id) {
  return BY_ID.get(id)?.instruction || ''
}

export function isDialect(id) {
  return BY_ID.has(id)
}
