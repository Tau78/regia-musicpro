export type SavedPlaylistKind = 'tracks' | 'launchpad' | 'chalkboard'

export type SavedPlaylistMeta = {
  id: string
  label: string
  trackCount: number
  updatedAt: string
  /** Somma durate file (secondi), se nota o calcolata. */
  totalDurationSec?: number
  /** Assente o `tracks` = elenco brani; `launchpad` = griglia 4×4; `chalkboard` = lavagna. */
  playlistMode?: SavedPlaylistKind
  /** Hex #rrggbb se impostato; assente = tema predefinito. */
  themeColor?: string
}
