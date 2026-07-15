import type { Article } from '../lib/types'
import { hrefArticle } from '../lib/router'
import { timeAgo } from '../lib/format'
import { sectionLabel } from '../lib/sections'

type Variant = 'lead' | 'top' | 'default' | 'text'

export function ArticleCard({
  article,
  variant = 'default',
}: {
  article: Article
  variant?: Variant
}) {
  const showImage = variant !== 'text'
  const showLead = variant === 'lead' || variant === 'top'
  return (
    <a className={`card card--${variant}`} href={hrefArticle(article.id)}>
      {showImage && (
        <div className="card__media">
          <img src={article.image} alt={article.imageAlt} loading="lazy" />
          {article.isPlus && <span className="pluss">+</span>}
        </div>
      )}
      <div className="card__body">
        {article.kicker && (
          <span className="kicker">
            {article.isPlus && !showImage && <span className="pluss pluss--inline">+</span>}
            {article.kicker}
          </span>
        )}
        <h2 className="card__title">{article.title}</h2>
        {showLead && article.lead && <p className="card__lead">{article.lead}</p>}
        <div className="card__meta">
          <span>{sectionLabel(article.section)}</span>
          <span aria-hidden="true">·</span>
          <span>{timeAgo(article.publishedAt)}</span>
          {article.source === 'llm' && <span className="tag-ai">KI-generert</span>}
        </div>
      </div>
    </a>
  )
}
