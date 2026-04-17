export type SavedPlaylistMeta = {
  id: string
  label: string
  trackCount: number
  updatedAt: string
  /** Hex #rrggbb se impostato; assente = tema predefinito. */
  themeColor?: string
}
