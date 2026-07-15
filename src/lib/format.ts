/** Norwegian "time ago" label, VG-style ("For 5 minutter siden"). */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'Akkurat nå'
  if (min < 60) return `For ${min} ${min === 1 ? 'minutt' : 'minutter'} siden`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `For ${hours} ${hours === 1 ? 'time' : 'timer'} siden`
  const days = Math.floor(hours / 24)
  if (days < 7) return `For ${days} ${days === 1 ? 'dag' : 'dager'} siden`
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
  })
}

/** Full timestamp for the article byline. */
export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
