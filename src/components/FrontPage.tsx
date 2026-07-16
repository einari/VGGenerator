import type { Article } from '../lib/types'
import { ArticleCard } from './ArticleCard'
import { NewsSpinButton } from './NewsSpinButton'

export function FrontPage({
  articles,
  onGenerated,
}: {
  articles: Article[]
  onGenerated: (fresh: Article[]) => void
}) {
  const newsbar = (
    <section className="newsbar">
      <div className="newsbar-title">
        <strong>Spinn dagens nyheter</strong>
        <span>
          Hent ekte overskrifter fra VG, NRK, Dagbladet, Aftenposten og Se og Hør – og
          gjør dem til tull.
        </span>
      </div>
      <NewsSpinButton onGenerated={onGenerated} />
    </section>
  )

  if (!articles.length) {
    return (
      <>
        {newsbar}
        <p className="empty">
          Ingen saker enda. Trykk «Generer nyheter» øverst til høyre, eller «Spinn
          nyheter» over, for å lage noen.
        </p>
      </>
    )
  }

  const leadIdx = Math.max(
    0,
    articles.findIndex((a) => a.featured),
  )
  const lead = articles[leadIdx]
  const rest = articles.filter((_, i) => i !== leadIdx)
  const top = rest.slice(0, 4)
  const grid = rest.slice(4)

  return (
    <>
      {newsbar}
      <section className="lead-row">
        <ArticleCard article={lead} variant="lead" />
        <div className="lead-side">
          {top.map((a) => (
            <ArticleCard key={a.id} article={a} variant="text" />
          ))}
        </div>
      </section>

      {grid.length > 0 && (
        <section className="grid">
          {grid.map((a) => (
            <ArticleCard key={a.id} article={a} variant="default" />
          ))}
        </section>
      )}
    </>
  )
}
