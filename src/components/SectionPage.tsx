import type { Article, SectionId } from '../lib/types'
import { ArticleCard } from './ArticleCard'
import { SECTIONS } from '../lib/sections'

export function SectionPage({
  articles,
  section,
}: {
  articles: Article[]
  section: SectionId
}) {
  const meta = SECTIONS.find((s) => s.id === section)
  const list = articles.filter((a) => a.section === section)

  return (
    <>
      <header className="section-head">
        <h1>{meta?.label ?? section}</h1>
        {meta && <p>{meta.brief}</p>}
      </header>

      {list.length === 0 ? (
        <p className="empty">Ingen saker i denne seksjonen enda.</p>
      ) : (
        <section className="grid">
          {list.map((a) => (
            <ArticleCard key={a.id} article={a} variant="default" />
          ))}
        </section>
      )}
    </>
  )
}
