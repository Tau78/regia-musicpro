import { readLaunchPadDefaultKeyMode } from '../lib/launchPadSettings.ts'

export type FloatingPlaylistPos = { x: number; y: number }

/** Dimensioni pannello espanso (in comprimi l’altezza è automatica). */
export type FloatingPlaylistPanelSize = { width: number; height: number }

export const DEFAULT_FLOATING_PANEL_SIZE: FloatingPlaylistPanelSize = {
  width: 360,
  height: 440,
}

export const LAUNCHPAD_GRID = 4 as const
export const LAUNCHPAD_CELL_COUNT = LAUNCHPAD_GRID * LAUNCHPAD_GRID
/** Pagine da 16 pad ciascuna. */
export const LAUNCHPAD_BANK_COUNT = 4 as const

/** Dopo questa durata su pad o tasto assegnato parte il CUE (solo fino al rilascio). */
export const LAUNCHPAD_CUE_HOLD_MS = 380

export type PlaylistMode = 'tracks' | 'launchpad'

/** Comportamento del tasto assegnato (solo tastiera). */
export type LaunchPadKeyMode = 'play' | 'toggle'

export function normalizeLaunchPadKeyMode(v: unknown): LaunchPadKeyMode {
  if (v === 'toggle') return 'toggle'
  if (v === 'play') return 'play'
  return readLaunchPadDefaultKeyMode()
}

export type LaunchPadCell = {
  samplePath: string | null
  /** Hex #rrggbb */
  padColor: string
  /** Guadagno per questo pad (0–1), moltiplicato a volume globale e volume pannello. */
  padGain: number
  /**
   * Scorciatoia tastiera (`KeyboardEvent.code`), es. `KeyQ`, `Digit1`.
   * `null` = non assegnato. MIDI sarà un campo separato in seguito.
   */
  padKeyCode: string | null
  /**
   * Con tasto assegnato: `play` = ogni pressione corta va sempre in play;
   * `toggle` = play se fermo, stop se già in play su questo slot.
   */
  padKeyMode: LaunchPadKeyMode
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
  const defaultMode = readLaunchPadDefaultKeyMode()
  return Array.from({ length: LAUNCHPAD_CELL_COUNT }, (_, i) => ({
    samplePath: null,
    padColor: DEFAULT_LAUNCHPAD_PAD_COLORS[i] ?? '#444cf7',
    padGain: 1,
    padKeyCode: null,
    padKeyMode: defaultMode,
  }))
}

export type FloatingPlaylistSession = {
  id: string
  pos: FloatingPlaylistPos
  panelSize: FloatingPlaylistPanelSize
  collapsed: boolean
  /** Assente o `tracks` = playlist classica a elenco. */
  playlistMode?: PlaylistMode
  /** 16 slot se `playlistMode === 'launchpad'` (banco attivo; sincronizzati con `launchPadBanks`). */
  launchPadCells?: LaunchPadCell[]
  /** Pagine da 16 pad (opzionale; se assente si deriva da `launchPadCells`). */
  launchPadBanks?: LaunchPadCell[][]
  /** Indice banco 0…`LAUNCHPAD_BANK_COUNT`-1. */
  launchPadBankIndex?: number
  paths: string[]
  currentIndex: number
  playlistTitle: string
  playlistCrossfade: boolean
  /**
   * Loop per questa playlist (solo elenco brani). Assente = usa il loop globale
   * dell’header regia.
   */
  playlistLoopMode?: 'off' | 'one' | 'all'
  /** Mute uscita (monitor 2) per i brani avviati da questo pannello; si combina con Mute globale in header. */
  playlistOutputMuted: boolean
  /** Guadagno uscita (monitor 2) per questo pannello, moltiplicato con il volume globale (0–1). */
  playlistOutputVolume: number
  /** Hex #rrggbb o stringa vuota = tema predefinito del pannello. */
  playlistThemeColor: string
  editingSavedPlaylistId: string | null
  savedEditPathsBaseline: string[] | null
  savedEditTitleBaseline: string
  savedEditCrossfadeBaseline: boolean
  /** Loop salvato su disco (solo playlist a elenco collegata a salvataggio). */
  savedEditPlaylistLoopBaseline?: 'off' | 'one' | 'all'
  /** Tema salvato su disco (solo quando si modifica una playlist salvata). */
  savedEditThemeColorBaseline: string
  /** Copia slot launchpad all’ultimo «Carica» (solo se collegato a salvataggio launchpad). */
  savedEditLaunchPadBaseline: LaunchPadCell[] | null
  /**
   * Se true, la finestra principale Regia resta «sempre in primo piano» rispetto alle altre app
   * (Electron). Opzionale: assente = off.
   */
  windowAlwaysOnTopPinned?: boolean
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
    playlistOutputVolume: 1,
    playlistThemeColor: '',
    editingSavedPlaylistId: null,
    savedEditPathsBaseline: null,
    savedEditTitleBaseline: '',
    savedEditCrossfadeBaseline: false,
    savedEditThemeColorBaseline: '',
    savedEditLaunchPadBaseline: null,
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
  const banks = freshLaunchPadBanks()
  return {
    ...base,
    playlistMode: 'launchpad',
    paths: [],
    currentIndex: 0,
    playlistTitle: 'Launchpad',
    panelSize: { ...LAUNCHPAD_PANEL_SIZE },
    launchPadBanks: banks,
    launchPadBankIndex: 0,
    launchPadCells: banks[0]!.map((c) => ({ ...c })),
    editingSavedPlaylistId: null,
    savedEditPathsBaseline: null,
    savedEditTitleBaseline: '',
    savedEditCrossfadeBaseline: false,
    savedEditThemeColorBaseline: '',
  }
}

/**
 * Launchpad 4×4 con sample già assegnati (percorsi assoluti verso file su disco).
 * Usa i colori di default; riempie gli slot da 0 in ordine fino a 16 o alla lunghezza di `absolutePaths`.
 */
export function createLaunchPadFloatingSessionWithKit(
  absolutePaths: string[],
  pos?: FloatingPlaylistPos,
  playlistTitle?: string,
): FloatingPlaylistSession {
  const s = createLaunchPadFloatingSession(pos)
  if (!absolutePaths.length) return s
  const cells = defaultLaunchPadCells()
  const lim = Math.min(absolutePaths.length, LAUNCHPAD_CELL_COUNT)
  for (let i = 0; i < lim; i++) {
    cells[i] = { ...cells[i]!, samplePath: absolutePaths[i]! }
  }
  const banks = freshLaunchPadBanks()
  banks[0] = cells.map((c) => ({ ...c }))
  const title =
    typeof playlistTitle === 'string' && playlistTitle.trim() !== ''
      ? playlistTitle.trim()
      : 'Launchpad base'
  return {
    ...s,
    playlistTitle: title,
    launchPadBanks: banks,
    launchPadBankIndex: 0,
    launchPadCells: banks[0]!.map((c) => ({ ...c })),
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
    launchPadBanks: s.launchPadBanks
      ? cloneLaunchPadBanksDeep(s.launchPadBanks)
      : undefined,
    launchPadBankIndex: s.launchPadBankIndex,
    savedEditLaunchPadBaseline: s.savedEditLaunchPadBaseline
      ? s.savedEditLaunchPadBaseline.map((c) => ({ ...c }))
      : null,
  }
}

/** Copia profonda celle per snapshot / salvataggio. */
export function freshLaunchPadBanks(): LaunchPadCell[][] {
  return Array.from({ length: LAUNCHPAD_BANK_COUNT }, () =>
    defaultLaunchPadCells().map((c) => ({ ...c })),
  )
}

export function cloneLaunchPadBanksDeep(
  banks: LaunchPadCell[][] | undefined,
): LaunchPadCell[][] {
  const base = freshLaunchPadBanks()
  if (!banks || banks.length === 0) return base
  return base.map((row, bi) => {
    const src = banks[bi]
    if (!src || src.length < LAUNCHPAD_CELL_COUNT) return row
    return src.slice(0, LAUNCHPAD_CELL_COUNT).map((c, i) => {
      const d = row[i]!
      const padGain =
        typeof c.padGain === 'number' && Number.isFinite(c.padGain)
          ? Math.min(1, Math.max(0, c.padGain))
          : 1
      return {
        samplePath:
          typeof c.samplePath === 'string' || c.samplePath === null
            ? c.samplePath
            : null,
        padColor: typeof c.padColor === 'string' ? c.padColor : d.padColor,
        padGain,
        padKeyCode: c.padKeyCode ?? null,
        padKeyMode: normalizeLaunchPadKeyMode(c.padKeyMode),
      }
    })
  })
}

export function migrateLaunchPadBanksFromCells(
  cells: LaunchPadCell[] | undefined,
): LaunchPadCell[][] {
  const banks = freshLaunchPadBanks()
  const first = cloneLaunchPadCellsSnapshot(cells)
  banks[0] = first
  return banks
}

export function cloneLaunchPadCellsSnapshot(
  cells: LaunchPadCell[] | undefined,
): LaunchPadCell[] {
  const base = defaultLaunchPadCells()
  return (cells ?? base).map((c, i) => {
    const d = base[i]!
    const padGain =
      typeof c.padGain === 'number' && Number.isFinite(c.padGain)
        ? Math.min(1, Math.max(0, c.padGain))
        : 1
    const padKeyMode = normalizeLaunchPadKeyMode(c.padKeyMode)
    return {
      samplePath:
        typeof c.samplePath === 'string' || c.samplePath === null
          ? c.samplePath
          : null,
      padColor: typeof c.padColor === 'string' ? c.padColor : d.padColor,
      padGain,
      padKeyCode: c.padKeyCode ?? null,
      padKeyMode,
    }
  })
}

export function launchPadCellsEqual(
  a: LaunchPadCell[] | undefined,
  b: LaunchPadCell[] | undefined,
): boolean {
  const na = a ?? defaultLaunchPadCells()
  const nb = b ?? defaultLaunchPadCells()
  if (na.length !== nb.length) return false
  for (let i = 0; i < na.length; i++) {
    const x = na[i]!
    const y = nb[i]!
    if (x.samplePath !== y.samplePath) return false
    if (x.padColor !== y.padColor) return false
    if (x.padGain !== y.padGain) return false
    const kx = x.padKeyCode ?? null
    const ky = y.padKeyCode ?? null
    if (kx !== ky) return false
    const mx = x.padKeyMode === 'toggle' ? 'toggle' : 'play'
    const my = y.padKeyMode === 'toggle' ? 'toggle' : 'play'
    if (mx !== my) return false
  }
  return true
}
