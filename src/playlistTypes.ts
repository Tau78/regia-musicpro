export type SavedPlaylistKind = 'tracks' | 'launchpad'

export type SavedPlaylistMeta = {
  id: string
  label: string
  trackCount: number
  updatedAt: string
  /** Somma durate file (secondi), se nota o calcolata. */
  totalDurationSec?: number
  /** Assente o `tracks` = elenco brani; `launchpad` = griglia 4×4. */
  playlistMode?: SavedPlaylistKind
  /** Hex #rrggbb se impostato; assente = tema predefinito. */
  themeColor?: string
}
