export type FloatingPlaylistPos = { x: number; y: number }

/** Dimensioni pannello espanso (in comprimi l’altezza è automatica). */
export type FloatingPlaylistPanelSize = { width: number; height: number }

export const DEFAULT_FLOATING_PANEL_SIZE: FloatingPlaylistPanelSize = {
  width: 360,
  height: 440,
}

export type FloatingPlaylistSession = {
  id: string
  pos: FloatingPlaylistPos
  panelSize: FloatingPlaylistPanelSize
  collapsed: boolean
  paths: string[]
  currentIndex: number
  playlistTitle: string
  playlistCrossfade: boolean
  /** Mute uscita (monitor 2) per i brani avviati da questo pannello; si combina con Mute globale in header. */
  playlistOutputMuted: boolean
  /** Hex #rrggbb o stringa vuota = tema predefinito del pannello. */
  playlistThemeColor: string
  editingSavedPlaylistId: string | null
  savedEditPathsBaseline: string[] | null
  savedEditTitleBaseline: string
  savedEditCrossfadeBaseline: boolean
  /** Tema salvato su disco (solo quando si modifica una playlist salvata). */
  savedEditThemeColorBaseline: string
}

function newSessionId(): string {
  return `fp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function createEmptyFloatingSession(
  pos?: FloatingPlaylistPos,
): FloatingPlaylistSession {
  return {
    id: newSessionId(),
    pos: pos ?? { x: 24, y: 96 },
    panelSize: { ...DEFAULT_FLOATING_PANEL_SIZE },
    collapsed: false,
    paths: [],
    currentIndex: 0,
    playlistTitle: '',
    playlistCrossfade: true,
    playlistOutputMuted: false,
    playlistThemeColor: '',
    editingSavedPlaylistId: null,
    savedEditPathsBaseline: null,
    savedEditTitleBaseline: '',
    savedEditCrossfadeBaseline: false,
    savedEditThemeColorBaseline: '',
  }
}

export function cloneFloatingSession(
  s: FloatingPlaylistSession,
  pos?: FloatingPlaylistPos,
): FloatingPlaylistSession {
  return {
    ...s,
    id: newSessionId(),
    pos: pos ?? { x: s.pos.x + 28, y: s.pos.y + 28 },
  }
}
