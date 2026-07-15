import type { Article } from '../lib/types'
import { ArticleCard } from './ArticleCard'

export function FrontPage({ articles }: { articles: Article[] }) {
  if (!articles.length) {
    return (
      <p className="empty">
        Ingen saker enda. Trykk «Generer nyheter» øverst til høyre for å lage noen.
      </p>
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
