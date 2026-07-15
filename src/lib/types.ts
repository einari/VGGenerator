export type SectionId =
  | 'nyheter'
  | 'sport'
  | 'rampelys'
  | 'meninger'
  | 'forbruker'

export interface Section {
  id: SectionId
  label: string
  brief: string
}

export interface FactBox {
  title: string
  items: string[]
}

/** A full article as stored in a JSON file / localStorage. */
export interface Article {
  id: string
  section: SectionId
  /** Short label above the headline, e.g. "TRAFIKK", "AVSLØRING". */
  kicker: string
  title: string
  /** The bold lead paragraph (ingress). */
  lead: string
  /** Body paragraphs. Lines starting with "– " are rendered as quotes. */
  body: string[]
  factBox?: FactBox
  author: string
  /** ISO-8601 timestamp. */
  publishedAt: string
  /** Path to the image, e.g. "/images/img-03.jpg". */
  image: string
  imageAlt: string
  /** Premium ("VG+") teaser. */
  isPlus: boolean
  /** Eligible to be shown as the big lead story on the front page. */
  featured: boolean
  /** Where the article came from. */
  source: 'seed' | 'llm'
}

/** The index.json shape: newest-first list of article ids + light metadata. */
export interface ArticleIndexEntry {
  id: string
  section: SectionId
  publishedAt: string
}
