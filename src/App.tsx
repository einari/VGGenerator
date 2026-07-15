import { useCallback, useEffect, useState } from 'react'
import type { Article } from './lib/types'
import { loadAllArticles } from './lib/articles'
import { useRoute, hrefFront } from './lib/router'
import { Header } from './components/Header'
import { FrontPage } from './components/FrontPage'
import { SectionPage } from './components/SectionPage'
import { ArticleView } from './components/ArticleView'
import './App.css'

function App() {
  const route = useRoute()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (force = false) => {
    const list = await loadAllArticles(force)
    setArticles(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onGenerated = useCallback(() => {
    // Newly generated articles are already in localStorage; just re-merge.
    void refresh()
  }, [refresh])

  return (
    <div className="site">
      <Header route={route} onGenerated={onGenerated} />

      <main className="content">
        {loading ? (
          <p className="empty">Laster saker …</p>
        ) : route.name === 'article' ? (
          <ArticleRoute id={route.id} articles={articles} />
        ) : route.name === 'section' ? (
          <SectionPage articles={articles} section={route.section} />
        ) : (
          <FrontPage articles={articles} />
        )}
      </main>

      <footer className="site-footer">
        <p>
          <strong>VG Generator</strong> — en parodi. Alt innhold er oppdiktet og
          generert på tull. Ikke tilknyttet VG eller Dagbladet.
        </p>
        <p className="small">
          Bilder er tilfeldige (picsum.photos). Saker skrives av en lokal LLM.
        </p>
      </footer>
    </div>
  )
}

function ArticleRoute({ id, articles }: { id: string; articles: Article[] }) {
  const article = articles.find((a) => a.id === id)
  if (!article) {
    return (
      <p className="empty">
        Fant ikke saken. <a href={hrefFront}>Gå til forsiden</a>.
      </p>
    )
  }
  return <ArticleView article={article} all={articles} />
}

export default App
