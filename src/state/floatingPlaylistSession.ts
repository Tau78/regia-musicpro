export type FloatingPlaylistPos = { x: number; y: number }

/** Dimensioni pannello espanso (in comprimi l’altezza è automatica). */
export type FloatingPlaylistPanelSize = { width: number; height: number }

export const DEFAULT_FLOATING_PANEL_SIZE: FloatingPlaylistPanelSize = {
  width: 360,
  height: 440,
}

export const LAUNCHPAD_GRID = 4 as const
export const LAUNCHPAD_CELL_COUNT = LAUNCHPAD_GRID * LAUNCHPAD_GRID

export type PlaylistMode = 'tracks' | 'launchpad'

export type LaunchPadCell = {
  samplePath: string | null
  /** Hex #rrggbb */
  padColor: string
}

const DEFAULT_LAUNCHPAD_PAD_COLORS: readonly string[] = [
  '#e63946',
  '#f4a261',
  '#2a9d8f',
  '#264653',
  '#8338ec',
  '#3a86ff',
  '#fb5607',
  '#ff006e',
  '#06ffa5',
  '#ffbe0b',
  '#9b5de5',
  '#3d348b',
  '#c1121f',
  '#669bbc',
  '#003049',
  '#780000',
]

export function defaultLaunchPadCells(): LaunchPadCell[] {
  return Array.from({ length: LAUNCHPAD_CELL_COUNT }, (_, i) => ({
    samplePath: null,
    padColor: DEFAULT_LAUNCHPAD_PAD_COLORS[i] ?? '#444cf7',
  }))
}

export type FloatingPlaylistSession = {
  id: string
  pos: FloatingPlaylistPos
  panelSize: FloatingPlaylistPanelSize
  collapsed: boolean
  /** Assente o `tracks` = playlist classica a elenco. */
  playlistMode?: PlaylistMode
  /** 16 slot se `playlistMode === 'launchpad'`. */
  launchPadCells?: LaunchPadCell[]
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

const LAUNCHPAD_PANEL_SIZE: FloatingPlaylistPanelSize = {
  width: 348,
  height: 448,
}

export function createLaunchPadFloatingSession(
  pos?: FloatingPlaylistPos,
): FloatingPlaylistSession {
  const base = createEmptyFloatingSession(pos)
  return {
    ...base,
    playlistMode: 'launchpad',
    paths: [],
    currentIndex: 0,
    playlistTitle: 'Launchpad',
    panelSize: { ...LAUNCHPAD_PANEL_SIZE },
    launchPadCells: defaultLaunchPadCells(),
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
    paths: [...s.paths],
    launchPadCells: s.launchPadCells?.map((c) => ({ ...c })),
  }
}
