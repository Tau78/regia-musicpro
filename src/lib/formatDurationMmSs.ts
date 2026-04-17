const pad2 = (n: number) => n.toString().padStart(2, '0')

/**
 * Durata in stile `m:ss` sotto l’ora; da 1 h in su `h:mm:ss`.
 */
export function formatDurationMmSs(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const s = Math.floor(sec % 60)
  const totalMin = Math.floor(sec / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`
  return `${m}:${pad2(s)}`
}
