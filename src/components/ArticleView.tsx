import type { Article } from '../lib/types'
import { hrefFront, hrefSection, hrefArticle } from '../lib/router'
import { fullDate, timeAgo } from '../lib/format'
import { sectionLabel } from '../lib/sections'
import { ListenButton } from './ListenButton'

function Paragraph({ text }: { text: string }) {
  // Lines starting with an en-dash are spoken quotes — style them.
  if (text.startsWith('–') || text.startsWith('«')) {
    return <p className="quote">{text}</p>
  }
  return <p>{text}</p>
}

export function ArticleView({
  article,
  all,
}: {
  article: Article
  all: Article[]
}) {
  const related = all
    .filter((a) => a.section === article.section && a.id !== article.id)
    .slice(0, 4)

  return (
    <article className="article">
      <nav className="crumbs">
        <a href={hrefFront}>Forsiden</a>
        <span aria-hidden="true">›</span>
        <a href={hrefSection(article.section)}>{sectionLabel(article.section)}</a>
      </nav>

      <span className="kicker kicker--lg">
        {article.isPlus && <span className="pluss pluss--inline">+</span>}
        {article.kicker}
      </span>
      <h1 className="article__title">{article.title}</h1>
      <p className="article__lead">{article.lead}</p>

      <div className="article__byline">
        <span className="byline-name">{article.author}</span>
        <span className="byline-time" title={fullDate(article.publishedAt)}>
          {timeAgo(article.publishedAt)}
        </span>
        {article.source === 'llm' && <span className="tag-ai">KI-generert</span>}
      </div>

      <ListenButton articleId={article.id} />

      <figure className="article__figure">
        <img src={article.image} alt={article.imageAlt} />
        <figcaption>{article.imageAlt} · Foto: Illustrasjon</figcaption>
      </figure>

      <div className="article__body">
        {article.body.map((p, i) => (
          <Paragraph key={i} text={p} />
        ))}

        {article.factBox && (
          <aside className="factbox">
            <h3>{article.factBox.title}</h3>
            <ul>
              {article.factBox.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      {related.length > 0 && (
        <section className="related">
          <h3>Mer fra {sectionLabel(article.section)}</h3>
          <ul>
            {related.map((a) => (
              <li key={a.id}>
                <a href={hrefArticle(a.id)}>
                  {a.isPlus && <span className="pluss pluss--inline">+</span>}
                  {a.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
