/** Path assoluto verso un PNG watermark playlist (renderer). */
export function normalizePlaylistWatermarkAbsPath(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const t = raw.trim()
  if (!t) return ''
  const lower = t.toLowerCase()
  if (!lower.endsWith('.png')) return ''
  const unixAbs = t.startsWith('/')
  const winAbs = /^[A-Za-z]:[\\/]/.test(t)
  if (!unixAbs && !winAbs) return ''
  return t
}
