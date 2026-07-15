import { useEffect, useState } from 'react'
import type { SectionId } from './types'

export type Route =
  | { name: 'front' }
  | { name: 'section'; section: SectionId }
  | { name: 'article'; id: string }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'seksjon' && parts[1]) {
    return { name: 'section', section: decodeURIComponent(parts[1]) as SectionId }
  }
  if (parts[0] === 'artikkel' && parts[1]) {
    return { name: 'article', id: decodeURIComponent(parts[1]) }
  }
  return { name: 'front' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export const hrefFront = '#/'
export const hrefSection = (id: string) => `#/seksjon/${encodeURIComponent(id)}`
export const hrefArticle = (id: string) => `#/artikkel/${encodeURIComponent(id)}`

export function navigate(hash: string): void {
  location.hash = hash
}
