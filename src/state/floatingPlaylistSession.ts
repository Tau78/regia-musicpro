import { readLaunchPadDefaultKeyMode } from '../lib/launchPadSettings.ts'

export type FloatingPlaylistPos = { x: number; y: number }

/** Pannello agganciato alla colonna destra della plancia (restringe l’area anteprima). */
export type PlanciaDockMode = 'none' | 'right'

export function normalizePlanciaDockMode(v: unknown): PlanciaDockMode {
  return v === 'right' ? 'right' : 'none'
}

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

export type PlaylistMode = 'tracks' | 'sottofondo' | 'launchpad' | 'chalkboard'

/** Stesso conteggio delle pagine Launchpad (4 banchi lavagna). */
export const CHALKBOARD_BANK_COUNT = LAUNCHPAD_BANK_COUNT

/** Sfondo lavagna predefinito (ardesia scura). */
export const CHALKBOARD_DEFAULT_BG = '#2d3436'

export function normalizeChalkboardBackgroundHex(raw: unknown): string {
  if (typeof raw !== 'string') return CHALKBOARD_DEFAULT_BG
  const t = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  return CHALKBOARD_DEFAULT_BG
}

/** Uscita video lavagna: spenta, solo tratto/immagini su PGM, oppure strato pieno con sfondo. */
export type ChalkboardOutputMode = 'off' | 'transparent' | 'solid'

export function normalizeChalkboardOutputMode(
  raw: unknown,
  legacyOutputToProgram?: unknown,
): ChalkboardOutputMode {
  if (raw === 'transparent' || raw === 'solid' || raw === 'off') return raw
  if (legacyOutputToProgram === true) return 'solid'
  return 'off'
}

/** Immagine inserita sulla lavagna (coordinate spazio uscita, px). */
export type ChalkboardPlacedImage = {
  id: string
  path: string
  x: number
  y: number
  w: number
  h: number
}

/** Path PNG solo tratto/testo (senza immagini mobili), accanto a `bank-n.png` composito. */
export function chalkboardDrawPathFromCompositePath(compositeAbs: string): string {
  return compositeAbs.replace(/\.png$/i, '-draw.png')
}

export function emptyChalkboardPlacementsByBank(): ChalkboardPlacedImage[][] {
  return Array.from({ length: CHALKBOARD_BANK_COUNT }, () => [])
}

export function cloneChalkboardPlacementsByBank(
  src?: ChalkboardPlacedImage[][] | null,
): ChalkboardPlacedImage[][] {
  const base = emptyChalkboardPlacementsByBank()
  if (!src || !Array.isArray(src)) return base
  for (let bi = 0; bi < CHALKBOARD_BANK_COUNT; bi++) {
    const row = src[bi]
    if (!Array.isArray(row)) continue
    base[bi] = row.map((im) => ({ ...im }))
  }
  return base
}

export function normalizeChalkboardPlacementsFromDisk(
  raw: unknown,
): ChalkboardPlacedImage[][] {
  const out = emptyChalkboardPlacementsByBank()
  if (!Array.isArray(raw)) return out
  for (let bi = 0; bi < CHALKBOARD_BANK_COUNT; bi++) {
    const row = raw[bi]
    if (!Array.isArray(row)) continue
    for (const it of row) {
      if (!it || typeof it !== 'object') continue
      const o = it as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id.trim() : ''
      const p = typeof o.path === 'string' ? o.path.trim() : ''
      const x = Number(o.x)
      const y = Number(o.y)
      const w = Number(o.w)
      const h = Number(o.h)
      if (
        !id ||
        !p ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(w) ||
        !Number.isFinite(h) ||
        w < 8 ||
        h < 8
      )
        continue
      out[bi]!.push({
        id,
        path: p,
        x,
        y,
        w,
        h,
      })
    }
  }
  return out
}

export function chalkboardPlacementsEqual(
  a: ChalkboardPlacedImage[][] | undefined | null,
  b: ChalkboardPlacedImage[][] | undefined | null,
): boolean {
  const na = a ?? emptyChalkboardPlacementsByBank()
  const nb = b ?? emptyChalkboardPlacementsByBank()
  for (let bi = 0; bi < CHALKBOARD_BANK_COUNT; bi++) {
    const ra = na[bi] ?? []
    const rb = nb[bi] ?? []
    if (ra.length !== rb.length) return false
    for (let i = 0; i < ra.length; i++) {
      const x = ra[i]!
      const y = rb[i]!
      if (
        x.id !== y.id ||
        x.path !== y.path ||
        x.x !== y.x ||
        x.y !== y.y ||
        x.w !== y.w ||
        x.h !== y.h
      )
        return false
    }
  }
  return true
}

/**
 * Elenco che comanda il programma video in uscita (anteprima / Schermo 2).
 * Esclude sottofondo, launchpad e lavagna.
 */
export function isTracksPlaylistMode(m?: PlaylistMode): boolean {
  if (m === 'launchpad' || m === 'chalkboard' || m === 'sottofondo') return false
  return true
}

/** Pannello con elenco file (playlist classica, sottofondo, …), non griglia o lavagna. */
export function isListPlaylistWithPaths(m?: PlaylistMode): boolean {
  return m !== 'launchpad' && m !== 'chalkboard'
}

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
   * Etichetta mostrata sul pad al posto del nome file (opzionale).
   * `null` o vuoto = usa il basename del file.
   */
  padDisplayName: string | null
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

/** `KeyboardEvent.code` predefinito: tasti 1…9 sul pad 1…9, 0 sul pad 10. */
export function defaultLaunchPadKeyCodeForSlot(
  slotIndex: number,
): string | null {
  if (slotIndex < 0 || slotIndex >= LAUNCHPAD_CELL_COUNT) return null
  if (slotIndex < 9) return `Digit${slotIndex + 1}`
  if (slotIndex === 9) return 'Digit0'
  return null
}

export function normalizeLaunchPadDisplayName(v: unknown): string | null {
  if (v == null) return null
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/\s+/g, ' ').slice(0, 120)
  return t === '' ? null : t
}

/** Testo mostrato sul pad: nome personalizzato o basename del sample. */
export function launchPadCellShownLabel(cell: LaunchPadCell): string {
  const custom = normalizeLaunchPadDisplayName(cell.padDisplayName)
  if (custom) return custom
  if (cell.samplePath) {
    const base = cell.samplePath.split(/[/\\]/).pop() ?? cell.samplePath
    return base || '—'
  }
  return '—'
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
    padDisplayName: null,
    padKeyCode: defaultLaunchPadKeyCodeForSlot(i),
    padKeyMode: defaultMode,
  }))
}

export type FloatingPlaylistSession = {
  id: string
  pos: FloatingPlaylistPos
  panelSize: FloatingPlaylistPanelSize
  /** Agganciato alla colonna destra tipo pannelli Photoshop (`none` se assente). */
  planciaDock?: PlanciaDockMode
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
  /**
   * Path assoluto a PNG mostrato come overlay fisso in uscita e in anteprima (stesso criterio della regia).
   * Stringa vuota = disattivato.
   */
  playlistWatermarkPngPath?: string
  editingSavedPlaylistId: string | null
  savedEditPathsBaseline: string[] | null
  savedEditTitleBaseline: string
  savedEditCrossfadeBaseline: boolean
  /** Loop salvato su disco (solo playlist a elenco collegata a salvataggio). */
  savedEditPlaylistLoopBaseline?: 'off' | 'one' | 'all'
  /** Tema salvato su disco (solo quando si modifica una playlist salvata). */
  savedEditThemeColorBaseline: string
  /** Watermark salvato su disco (solo con collegamento a playlist salvata). */
  savedEditWatermarkBaseline?: string
  /** Copia slot launchpad all’ultimo «Carica» (solo se collegato a salvataggio launchpad). */
  savedEditLaunchPadBaseline: LaunchPadCell[] | null
  /** Indice banco 0…`CHALKBOARD_BANK_COUNT`-1 (solo chalkboard). */
  chalkboardBankIndex?: number
  /** 4 path PNG su disco (solo chalkboard). */
  chalkboardBankPaths?: string[]
  /** Incrementato a ogni modifica disegno/testo/immagine (dirty vs baseline). */
  chalkboardContentRev?: number
  /** Come la lavagna viene inviata alla finestra Uscita (Schermo 2). */
  chalkboardOutputMode?: ChalkboardOutputMode
  /** Lavagna a tutto schermo (solo UI; pos/dimensioni precedenti ripristinate all’uscita). */
  chalkboardFullscreen?: boolean
  /** Colore di sfondo lavagna (#rrggbb). */
  chalkboardBackgroundColor?: string
  /** Per ogni banco: immagini inserite (spostabili; i trattoni restano sul canvas / file -draw). */
  chalkboardPlacementsByBank?: ChalkboardPlacedImage[][]
  /** Path PNG all’ultimo salvataggio / caricamento (solo chalkboard collegata a disco). */
  savedEditChalkboardPathsBaseline?: string[] | null
  savedEditChalkboardContentRevBaseline?: number
  savedEditChalkboardPlacementsBaseline?: ChalkboardPlacedImage[][] | null
  savedEditChalkboardBackgroundBaseline?: string
  /**
   * Se true, la finestra principale Regia resta «sempre in primo piano» rispetto alle altre app
   * (Electron). Opzionale: assente = off.
   */
  windowAlwaysOnTopPinned?: boolean
  /** File JSON in `Regia Video/Playlist` se caricato da cloud (non è un id `saved-playlists`). */
  regiaVideoCloudSourceFile?: string | null
  /** Se true, blocca modifiche accidentali (drag, drop, ecc. dove supportato). */
  panelLocked?: boolean
  /**
   * Cartella il cui elenco file media viene riletto automaticamente (impostata con «Apri cartella»).
   * Si azzera se modifichi l’elenco a mano (aggiungi, rimuovi, riordina, …).
   */
  playlistWatchFolder?: string
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
    planciaDock: 'none',
    collapsed: false,
    paths: [],
    currentIndex: 0,
    playlistTitle: '',
    playlistCrossfade: true,
    playlistOutputMuted: false,
    playlistOutputVolume: 1,
    playlistThemeColor: '',
    playlistWatermarkPngPath: '',
    editingSavedPlaylistId: null,
    savedEditPathsBaseline: null,
    savedEditTitleBaseline: '',
    savedEditCrossfadeBaseline: false,
    savedEditThemeColorBaseline: '',
    savedEditWatermarkBaseline: '',
    savedEditLaunchPadBaseline: null,
    regiaVideoCloudSourceFile: null,
    panelLocked: false,
  }
}

/** Dimensioni predefinite pannello Launchpad (anche per posizionamento iniziale). */
export const LAUNCHPAD_PANEL_SIZE: FloatingPlaylistPanelSize = {
  width: 348,
  height: 448,
}

/** Pannello più largo dell’elenco brani: serve spazio per area lavagna proporzionata all’uscita. */
export const CHALKBOARD_PANEL_SIZE: FloatingPlaylistPanelSize = {
  width: 560,
  height: 520,
}

export function createSottofondoFloatingSession(
  pos?: FloatingPlaylistPos,
): FloatingPlaylistSession {
  const base = createEmptyFloatingSession(pos)
  return {
    ...base,
    playlistMode: 'sottofondo',
    playlistTitle: 'Sottofondo',
  }
}

export function createChalkboardFloatingSession(
  pos?: FloatingPlaylistPos,
): FloatingPlaylistSession {
  const base = createEmptyFloatingSession(pos)
  return {
    ...base,
    playlistMode: 'chalkboard',
    paths: [],
    currentIndex: 0,
    playlistTitle: 'Chalkboard',
    panelSize: { ...CHALKBOARD_PANEL_SIZE },
    chalkboardBankIndex: 0,
    chalkboardBankPaths: [],
    chalkboardContentRev: 0,
    chalkboardBackgroundColor: CHALKBOARD_DEFAULT_BG,
    chalkboardPlacementsByBank: emptyChalkboardPlacementsByBank(),
    savedEditChalkboardPathsBaseline: null,
    savedEditChalkboardContentRevBaseline: undefined,
    savedEditChalkboardPlacementsBaseline: null,
    savedEditChalkboardBackgroundBaseline: CHALKBOARD_DEFAULT_BG,
    chalkboardFullscreen: false,
  }
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
    savedEditWatermarkBaseline: '',
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
    playlistWatchFolder: undefined,
    paths: [...s.paths],
    launchPadCells: s.launchPadCells?.map((c) => ({ ...c })),
    launchPadBanks: s.launchPadBanks
      ? cloneLaunchPadBanksDeep(s.launchPadBanks)
      : undefined,
    launchPadBankIndex: s.launchPadBankIndex,
    savedEditLaunchPadBaseline: s.savedEditLaunchPadBaseline
      ? s.savedEditLaunchPadBaseline.map((c) => ({ ...c }))
      : null,
    chalkboardBankPaths: s.chalkboardBankPaths
      ? [...s.chalkboardBankPaths]
      : undefined,
    chalkboardBankIndex: s.chalkboardBankIndex,
    chalkboardContentRev: s.chalkboardContentRev,
    chalkboardOutputMode: normalizeChalkboardOutputMode(
      s.chalkboardOutputMode,
      (s as { chalkboardOutputToProgram?: boolean }).chalkboardOutputToProgram,
    ),
    chalkboardBackgroundColor: normalizeChalkboardBackgroundHex(
      s.chalkboardBackgroundColor,
    ),
    chalkboardPlacementsByBank: cloneChalkboardPlacementsByBank(
      s.chalkboardPlacementsByBank,
    ),
    savedEditChalkboardPathsBaseline: s.savedEditChalkboardPathsBaseline
      ? [...s.savedEditChalkboardPathsBaseline]
      : null,
    savedEditChalkboardContentRevBaseline: s.savedEditChalkboardContentRevBaseline,
    savedEditChalkboardPlacementsBaseline:
      s.savedEditChalkboardPlacementsBaseline === null
        ? null
        : cloneChalkboardPlacementsByBank(s.savedEditChalkboardPlacementsBaseline),
    savedEditChalkboardBackgroundBaseline:
      s.savedEditChalkboardBackgroundBaseline !== undefined
        ? normalizeChalkboardBackgroundHex(s.savedEditChalkboardBackgroundBaseline)
        : undefined,
  }
}

export function chalkboardPathsEqual(
  a: string[] | undefined,
  b: string[] | undefined,
): boolean {
  const na = a ?? []
  const nb = b ?? []
  if (na.length !== nb.length) return false
  for (let i = 0; i < na.length; i++) {
    if (na[i] !== nb[i]) return false
  }
  return true
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
        padDisplayName: normalizeLaunchPadDisplayName(
          (c as LaunchPadCell).padDisplayName,
        ),
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
      padDisplayName: normalizeLaunchPadDisplayName(
        (c as LaunchPadCell).padDisplayName,
      ),
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
    const dx = normalizeLaunchPadDisplayName(x.padDisplayName)
    const dy = normalizeLaunchPadDisplayName(y.padDisplayName)
    if (dx !== dy) return false
  }
  return true
}
