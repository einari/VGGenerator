// Dialect options + the instruction each one hands to the LLM.
// The browser only sends the id; the instruction text stays server-side.
// Each instruction states what the variety is, gives concrete lexical/grammar
// features, and one bokmål→dialect example to anchor a smaller model.
export const DIALECTS = [
  {
    id: 'bokmal',
    label: 'Bokmål',
    // Default — no special instruction needed.
    instruction: '',
  },
  {
    id: 'nynorsk',
    label: 'Nynorsk',
    instruction:
      'Skriv HELE saken på nynorsk (den norske målforma bygd på norske dialektar). Bruk nynorske former: «eg» (jeg), «ikkje» (ikke), «kva» (hva), «korleis» (hvordan), «kvifor» (hvorfor), «kven» (hvem), «me/vi», «dei» (de/dem), «noko» (noe), «mykje» (mye), «berre» (bare), «difor» (derfor). Verb: «å vere» → «har vore» (vært), «å gjere» → «han gjer», «å seie» → «seier», «å kome» → «han kjem». Hokjønn med -a: «ei jente – jenta», «boka», «sola». Fleirtal på -ar/-ane: «bilar – bilane», «gutar – gutane». Eksempel: «Jeg vet ikke hvorfor han ikke kom» → «Eg veit ikkje kvifor han ikkje kom». Bruk nynorsk konsekvent i overskrift, ingress, brødtekst og sitat.',
  },
  {
    id: 'nordnorsk',
    label: 'Nordnorsk',
    instruction:
      'Skriv HELE saken på nordnorsk dialekt – slik folk snakkar i Nord-Noreg (Nordland, Troms og Finnmark). Kjenneteikn: «æ» (jeg), «æ e» (jeg er), «ikkje» (ikke), spørjeord «ka» (hva), «kem» (hvem), «kor» (hvor), «koffer» (hvorfor), «korsn/kordan» (hvordan), «dokker» (dere), «dæm» (de/dem). Bestemt fleirtal endar på -an: «guttan» (guttene), «bilan» (bilene), «jentan», «husan». Kort, direkte og folkeleg tone, gjerne «no» (nå), «førbainna» (forbanna) og «kar/kára» (kar/karene). Eksempel: «Hva gjør guttene nå?» → «Ka gjør guttan no?»; «Jeg er ikke sikker» → «Æ e ikkje sikker». Bruk dialekten konsekvent i overskrift, ingress, brødtekst og sitat.',
  },
  {
    id: 'kebab',
    label: 'Kebab (kebabnorsk)',
    instruction:
      'Skriv HELE saken på «kebabnorsk» – multietnolekten unge med innvandrarbakgrunn snakkar i Oslo aust (Grønland, Holmlia, Furuset, Stovner). Bland inn låneord frå arabisk, kurdisk, tyrkisk og somali: «wallah» (jeg sverger), «yani» (altså/jeg mener), «habibi» (kompis/kjære), «abow» (utrop – oi/wow), «jalla» (fort/skjerp deg), «flus»/«para» (penger), «baosj» (politi), «avor» (dra/stikke), «tæsje» (stjele), «sjofe/sjuf» (se), «schpa» (fin/kul), «keff» (dårlig), «kæbe»/«tert» (jente), «kis» (fyr/gutt). Bruk ung, muntleg gatetone og set verbet på tredjeplass etter innleiing: «I går jeg var på fest» (ikkje «I går var jeg»). Eksempel: «Politiet kom, så vi stakk» → «Baosj kom, wallah så vi avor». Hald det leseleg og parodisk – aldri nedsetjande mot folkegrupper.',
  },
  {
    id: 'badla',
    label: 'Badla – Sandnes (bredt)',
    instruction:
      'Skriv HELE saken på brei Sandnes-/Jæren-dialekt (Rogaland). Bruk «eg» (jeg), «kje/ikkje» (ikke), «ka» (hva), «kven» (hvem), «koffor» (hvorfor), «koss/kossen» (hvordan), «me» (vi), «dokke» (dere), «dei» (de), «løye» (rart/morsomt). Skriv ut den tjukke uttalen: dobbel-L blir «dl» (alle→adle, ballen→badlen, gullet→gudle, fjell→fjedl) og «rn» blir «dn» (barn→badn, gjerne→gjedne, korn→kodn). Eksempel: «Alle barna vil gjerne ha ballen» → «Adle badna vil gjedne ha badlen». Bruk trekka konsekvent gjennom heile saken, men hald teksten leseleg.',
  },
]

const BY_ID = new Map(DIALECTS.map((d) => [d.id, d]))

export function dialectInstruction(id) {
  return BY_ID.get(id)?.instruction || ''
}

export function dialectLabel(id) {
  return BY_ID.get(id)?.label || id
}

export function isDialect(id) {
  return BY_ID.has(id)
}

// Distinctive tokens for each dialect, used to check whether a generated text
// actually adopted the dialect.
const MARKERS = {
  nynorsk: {
    min: 3,
    list: ['ikkje', 'eg', 'kva', 'korleis', 'kvifor', 'kven', 'dei', 'mykje', 'berre', 'difor', 'vore', 'kjem', 'gjer', 'noko', 'me'],
  },
  nordnorsk: {
    min: 2,
    list: ['æ', 'ikkje', 'ka', 'kem', 'kor', 'koffer', 'korsn', 'dokker', 'dæm'],
  },
  kebab: {
    min: 1,
    list: ['wallah', 'walla', 'jalla', 'habibi', 'abow', 'baosj', 'avor', 'tæsje', 'tæsj', 'flus', 'para', 'schpa', 'keff', 'yani', 'sjuf', 'sjofe', 'kæbe', 'kis'],
  },
  badla: {
    min: 2,
    list: ['adle', 'badn', 'gjedne', 'badlen', 'gudle', 'fjedl', 'kodn', 'eg', 'ikkje', 'kje', 'koffor', 'koss', 'dokke', 'løye'],
  },
}

/** How many distinct dialect markers appear in `text` (whole-token match). */
export function dialectMarkerHits(text, id) {
  const m = MARKERS[id]
  if (!m) return { hits: Infinity, min: 0 }
  const t = ' ' + String(text).toLowerCase().replace(/[^a-zæøå0-9]+/g, ' ') + ' '
  const hits = m.list.filter((w) => t.includes(' ' + w + ' ')).length
  return { hits, min: m.min }
}

/** True when the text has too few markers to count as the dialect. */
export function dialectNeedsRepair(text, id) {
  const { hits, min } = dialectMarkerHits(text, id)
  return hits < min
}
