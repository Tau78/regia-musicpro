/**
 * Restituisce un hex #rrggbb minuscolo oppure stringa vuota se non valido / assente.
 */
export function normalizePlaylistThemeColor(
  input: string | null | undefined,
): string {
  if (input == null) return ''
  const t = input.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1]!
    const g = t[2]!
    const b = t[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return ''
}

/** Valore controllato per input colore nativo quando non c’è tema. */
export const PLAYLIST_THEME_COLOR_INPUT_DEFAULT = '#5b6fa8'
