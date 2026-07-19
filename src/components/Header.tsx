import type { Article } from '../lib/types'
import type { Route } from '../lib/router'
import { hrefFront, hrefSection } from '../lib/router'
import { SECTIONS } from '../lib/sections'
import { GeneratePanel } from './GeneratePanel'
import { ModelSelector } from './ModelSelector'

const today = new Date().toLocaleDateString('nb-NO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function Header({
  route,
  onGenerated,
}: {
  route: Route
  onGenerated: (fresh: Article[]) => void
}) {
  const activeSection = route.name === 'section' ? route.section : null
  return (
    <header className="site-header">
      <div className="topbar">
        <a className="logo" href={hrefFront} aria-label="VG – forsiden">
          <span className="logo-mark">VG</span>
          <span className="logo-word">Generator</span>
        </a>

        <span className="topbar-date">{today}</span>

        <div className="topbar-actions">
          <ModelSelector />
          <GeneratePanel onGenerated={onGenerated} />
        </div>
      </div>

      <nav className="mainnav" aria-label="Seksjoner">
        <a
          href={hrefFront}
          className={route.name === 'front' ? 'active' : undefined}
        >
          Forsiden
        </a>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={hrefSection(s.id)}
            className={activeSection === s.id ? 'active' : undefined}
          >
            {s.label}
          </a>
        ))}
      </nav>
    </header>
  )
}
