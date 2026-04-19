/** Indice del prossimo brano in coda, o `null` se non c’è avanzamento automatico. */
export function computeNextPlaylistIndex(
  currentIdx: number,
  len: number,
  mode: 'off' | 'one' | 'all',
): number | null {
  if (len === 0) return null
  if (currentIdx < len - 1) return currentIdx + 1
  if (mode === 'all') return 0
  return null
}
