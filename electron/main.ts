import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  screen,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { PlaybackCommand } from './types'

/* --- Playlist salvate (in main: evita un secondo .js in dist-electron con package "type":"module") --- */

type SavedPlaylistMeta = {
  id: string
  label: string
  trackCount: number
  updatedAt: string
  totalDurationSec?: number
  themeColor?: string
  /** Assente = elenco brani; `launchpad` = griglia 4×4. */
  playlistMode?: 'tracks' | 'launchpad'
}

type LaunchPadCellStored = {
  samplePath: string | null
  padColor: string
  padGain: number
  /** `KeyboardEvent.code` (opzionale). */
  padKeyCode?: string | null
  padKeyMode?: 'play' | 'toggle'
}

const LAUNCHPAD_CELL_COUNT = 16

type StoredPlaylistLoopMode = 'off' | 'one' | 'all'

type StoredPlaylistEntry = {
  label: string
  paths: string[]
  updatedAt: string
  /** Somma durate file in secondi (opzionale; calcolata lato renderer). */
  totalDurationSec?: number
  /** Dissolvenza incrociata tra brani (solo stesso tipo: video/video o immagine/immagine). */
  crossfade?: boolean
  /** Loop elenco brani (solo `playlistMode: 'tracks'`). */
  loopMode?: StoredPlaylistLoopMode
  /** Hex #rrggbb tema playlist (opzionale). */
  themeColor?: string
  playlistMode?: 'tracks' | 'launchpad'
  launchPadCells?: LaunchPadCellStored[]
}

function normalizeStoredLoopMode(
  v: unknown,
): StoredPlaylistLoopMode | undefined {
  if (v === 'off' || v === 'one' || v === 'all') return v
  return undefined
}

function normalizeLaunchPadCellsStored(
  raw: unknown,
): LaunchPadCellStored[] | undefined {
  if (!Array.isArray(raw) || raw.length < LAUNCHPAD_CELL_COUNT) return undefined
  const out: LaunchPadCellStored[] = []
  for (let i = 0; i < LAUNCHPAD_CELL_COUNT; i++) {
    const cell = raw[i]
    if (!cell || typeof cell !== 'object') return undefined
    const c = cell as Record<string, unknown>
    const samplePath =
      c.samplePath === null
        ? null
        : typeof c.samplePath === 'string'
          ? c.samplePath
          : null
    const padColor =
      typeof c.padColor === 'string' && c.padColor.trim() ? c.padColor : '#444cf7'
    const padGain =
      typeof c.padGain === 'number' && Number.isFinite(c.padGain)
        ? Math.min(1, Math.max(0, c.padGain))
        : 1
    let padKeyCode: string | null = null
    if (typeof c.padKeyCode === 'string') {
      const t = c.padKeyCode.trim()
      if (/^[A-Za-z][A-Za-z0-9]*$/.test(t) && t.length <= 48) padKeyCode = t
    }
    const padKeyMode =
      c.padKeyMode === 'toggle'
        ? 'toggle'
        : c.padKeyMode === 'play'
          ? 'play'
          : 'toggle'
    out.push({ samplePath, padColor, padGain, padKeyCode, padKeyMode })
  }
  return out
}

function normalizeStoredThemeColor(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1]!
    const g = t[2]!
    const b = t[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return undefined
}

type PlaylistsStoreFile = {
  version: 1
  items: Record<string, StoredPlaylistEntry>
  /** Ordine manuale in elenco (id); voci assenti vengono accodate per `updatedAt`. */
  listOrder?: string[]
}

function playlistsFilePath(): string {
  return path.join(app.getPath('userData'), 'saved-playlists.json')
}

function readPlaylistsStore(): PlaylistsStoreFile {
  try {
    const raw = fs.readFileSync(playlistsFilePath(), 'utf8')
    const j = JSON.parse(raw) as PlaylistsStoreFile
    if (j?.version === 1 && j.items && typeof j.items === 'object') {
      if (!Array.isArray(j.listOrder)) delete j.listOrder
      return j
    }
  } catch {
    /* assente o non valido */
  }
  return { version: 1, items: {} }
}

function writePlaylistsStore(s: PlaylistsStoreFile): void {
  const dir = path.dirname(playlistsFilePath())
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(playlistsFilePath(), JSON.stringify(s, null, 2), 'utf8')
}

function savedEntryToMeta(id: string, v: StoredPlaylistEntry): SavedPlaylistMeta {
  const tc = normalizeStoredThemeColor(v.themeColor)
  const mode =
    v.playlistMode === 'launchpad' ? ('launchpad' as const) : undefined
  const cells =
    mode === 'launchpad'
      ? normalizeLaunchPadCellsStored(v.launchPadCells)
      : undefined
  const padCount =
    mode === 'launchpad'
      ? cells
        ? cells.filter((c) => c.samplePath).length
        : 0
      : Array.isArray(v.paths)
        ? v.paths.length
        : 0
  const meta: SavedPlaylistMeta = {
    id,
    label: v.label,
    trackCount: padCount,
    updatedAt: v.updatedAt,
  }
  const td = v.totalDurationSec
  if (typeof td === 'number' && Number.isFinite(td) && td >= 0) {
    meta.totalDurationSec = td
  }
  if (tc) meta.themeColor = tc
  if (mode) meta.playlistMode = mode
  return meta
}

function listSavedPlaylists(): SavedPlaylistMeta[] {
  const s = readPlaylistsStore()
  const byId = new Map(
    Object.entries(s.items).map(([id, v]) => [id, savedEntryToMeta(id, v)]),
  )
  const sortByUpdatedDesc = (a: SavedPlaylistMeta, b: SavedPlaylistMeta) =>
    b.updatedAt.localeCompare(a.updatedAt)

  if (!Array.isArray(s.listOrder) || s.listOrder.length === 0) {
    return [...byId.values()].sort(sortByUpdatedDesc)
  }

  const out: SavedPlaylistMeta[] = []
  for (const id of s.listOrder) {
    const m = byId.get(id)
    if (m) {
      out.push(m)
      byId.delete(id)
    }
  }
  const tail = [...byId.values()].sort(sortByUpdatedDesc)
  out.push(...tail)
  return out
}

function saveSavedPlaylist(opts: {
  id?: string
  label: string
  paths: string[]
  crossfade?: boolean
  loopMode?: StoredPlaylistLoopMode
  themeColor?: string | null
  playlistMode?: 'tracks' | 'launchpad'
  launchPadCells?: LaunchPadCellStored[]
  totalDurationSec?: number
}): { id: string } {
  const id = opts.id ?? `pl_${Date.now()}`
  const label = opts.label.trim().slice(0, 120) || 'Senza titolo'
  const s = readPlaylistsStore()
  const tc =
    opts.themeColor === '' || opts.themeColor == null
      ? undefined
      : normalizeStoredThemeColor(opts.themeColor)
  const isLaunchpad = opts.playlistMode === 'launchpad'
  const cellsNorm = isLaunchpad
    ? normalizeLaunchPadCellsStored(opts.launchPadCells ?? [])
    : undefined
  const entry: StoredPlaylistEntry = {
    label,
    paths: isLaunchpad ? [] : [...opts.paths],
    updatedAt: new Date().toISOString(),
    crossfade: Boolean(opts.crossfade),
  }
  if (tc) entry.themeColor = tc
  if (isLaunchpad) {
    entry.playlistMode = 'launchpad'
    entry.launchPadCells = cellsNorm ?? []
    delete entry.crossfade
    delete entry.loopMode
  } else {
    entry.playlistMode = 'tracks'
    delete entry.launchPadCells
    entry.loopMode = normalizeStoredLoopMode(opts.loopMode) ?? 'off'
  }
  const tds = opts.totalDurationSec
  if (typeof tds === 'number' && Number.isFinite(tds) && tds >= 0) {
    entry.totalDurationSec = tds
  } else {
    delete entry.totalDurationSec
  }
  const isNewEntry = !Object.prototype.hasOwnProperty.call(s.items, id)
  s.items[id] = entry
  if (isNewEntry) {
    const lo = Array.isArray(s.listOrder)
      ? s.listOrder.filter((k) => k in s.items)
      : []
    if (!lo.includes(id)) lo.push(id)
    s.listOrder = lo
  }
  writePlaylistsStore(s)
  return { id }
}

function patchSavedPlaylistTotalDuration(
  id: string,
  totalDurationSec: number,
): boolean {
  if (!Number.isFinite(totalDurationSec) || totalDurationSec < 0) return false
  const s = readPlaylistsStore()
  const e = s.items[id]
  if (!e) return false
  e.totalDurationSec = totalDurationSec
  writePlaylistsStore(s)
  return true
}

function getSavedPlaylist(
  id: string,
): {
  id: string
  label: string
  paths: string[]
  crossfade: boolean
  loopMode: StoredPlaylistLoopMode
  themeColor: string
  playlistMode: 'tracks' | 'launchpad'
  launchPadCells: LaunchPadCellStored[]
} | null {
  const s = readPlaylistsStore()
  const e = s.items[id]
  if (!e) return null
  const tc = normalizeStoredThemeColor(e.themeColor)
  const isLp = e.playlistMode === 'launchpad'
  const cells = isLp
    ? normalizeLaunchPadCellsStored(e.launchPadCells) ?? []
    : []
  return {
    id,
    label: e.label,
    paths: isLp ? [] : [...e.paths],
    crossfade: isLp ? false : Boolean(e.crossfade),
    loopMode: isLp ? 'off' : (normalizeStoredLoopMode(e.loopMode) ?? 'off'),
    themeColor: tc ?? '',
    playlistMode: isLp ? 'launchpad' : 'tracks',
    launchPadCells: cells,
  }
}

function deleteSavedPlaylist(id: string): boolean {
  const s = readPlaylistsStore()
  if (!s.items[id]) return false
  delete s.items[id]
  if (Array.isArray(s.listOrder)) {
    s.listOrder = s.listOrder.filter((x) => x !== id)
  }
  writePlaylistsStore(s)
  return true
}

function setPlaylistsOrder(orderedIds: string[]): boolean {
  const s = readPlaylistsStore()
  const keys = new Set(Object.keys(s.items))
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of orderedIds) {
    if (keys.has(id) && !seen.has(id)) {
      out.push(id)
      seen.add(id)
    }
  }
  for (const id of keys) {
    if (!seen.has(id)) out.push(id)
  }
  s.listOrder = out
  writePlaylistsStore(s)
  return true
}

function duplicateSavedPlaylist(id: string): { id: string } | null {
  const src = getSavedPlaylist(id)
  if (!src) return null
  if (src.playlistMode === 'launchpad') {
    const hasPad = src.launchPadCells.some((c) => c.samplePath)
    if (!hasPad) return null
  } else if (!src.paths.length) {
    return null
  }
  const store = readPlaylistsStore()
  const srcEntry = store.items[id]
  const srcTd = srcEntry?.totalDurationSec
  const copyTd =
    typeof srcTd === 'number' && Number.isFinite(srcTd) && srcTd >= 0
      ? srcTd
      : undefined
  const raw = src.label.trim() || 'Senza titolo'
  const suffix = ' (copia)'
  const maxBase = Math.max(0, 120 - suffix.length)
  const label = `${raw.slice(0, maxBase)}${suffix}`.slice(0, 120)
  const dupTheme = normalizeStoredThemeColor(src.themeColor)
  if (src.playlistMode === 'launchpad') {
    return saveSavedPlaylist({
      label,
      paths: [],
      crossfade: false,
      themeColor: dupTheme ?? null,
      playlistMode: 'launchpad',
      launchPadCells: src.launchPadCells.map((c) => ({ ...c })),
      totalDurationSec: copyTd,
    })
  }
  return saveSavedPlaylist({
    label,
    paths: [...src.paths],
    crossfade: src.crossfade,
    loopMode: src.loopMode,
    themeColor: dupTheme ?? null,
    playlistMode: 'tracks',
    totalDurationSec: copyTd,
  })
}

let regiaWindow: BrowserWindow | null = null
let outputWindow: BrowserWindow | null = null

const DEFAULT_OUTPUT_RESOLUTION = { width: 1280, height: 720 } as const
/** Allineare con `src/lib/screen2Resolutions.ts` (`SCREEN2_RESOLUTION_OPTIONS`). */
const ALLOWED_OUTPUT_RESOLUTIONS: readonly { width: number; height: number }[] = [
  { width: 1280, height: 720 },
]

type OutputResolution = { width: number; height: number }

let outputResolutionCache: OutputResolution | null = null

function outputResolutionPath(): string {
  return path.join(app.getPath('userData'), 'output-resolution.json')
}

function isAllowedOutputResolution(w: number, h: number): boolean {
  return ALLOWED_OUTPUT_RESOLUTIONS.some((r) => r.width === w && r.height === h)
}

function readOutputResolutionFromDisk(): OutputResolution {
  try {
    const raw = fs.readFileSync(outputResolutionPath(), 'utf8')
    const j = JSON.parse(raw) as { width?: number; height?: number }
    const w = Math.round(Number(j.width))
    const h = Math.round(Number(j.height))
    if (Number.isFinite(w) && Number.isFinite(h) && isAllowedOutputResolution(w, h))
      return { width: w, height: h }
  } catch {
    /* assente o non valido */
  }
  return { ...DEFAULT_OUTPUT_RESOLUTION }
}

function getOutputResolution(): OutputResolution {
  if (!outputResolutionCache) outputResolutionCache = readOutputResolutionFromDisk()
  return outputResolutionCache
}

function setOutputResolution(opts: OutputResolution): boolean {
  if (!isAllowedOutputResolution(opts.width, opts.height)) return false
  outputResolutionCache = { width: opts.width, height: opts.height }
  try {
    const dir = path.dirname(outputResolutionPath())
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      outputResolutionPath(),
      JSON.stringify(
        { width: outputResolutionCache.width, height: outputResolutionCache.height },
        null,
        2,
      ),
      'utf8',
    )
  } catch {
    /* ignore */
  }
  if (outputWindow && !outputWindow.isDestroyed() && outputWindow.isVisible()) {
    placeOutputWindowOnSecondaryDisplay(outputWindow)
  }
  return true
}

function placeOutputWindowOnSecondaryDisplay(w: BrowserWindow): void {
  const d = getSecondaryDisplay()
  const { width: rw, height: rh } = getOutputResolution()
  const x =
    d.bounds.x + Math.max(0, Math.floor((d.bounds.width - rw) / 2))
  const y =
    d.bounds.y + Math.max(0, Math.floor((d.bounds.height - rh) / 2))
  w.setBounds({ x, y, width: rw, height: rh })
}

const isDev = !app.isPackaged
const VITE_FALLBACK = 'http://localhost:5173'

function getDevServerUrl(): string {
  const p = path.join(__dirname, 'dev-server-url.txt')
  try {
    const raw = fs.readFileSync(p, 'utf8').trim()
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  } catch {
    /* file assente */
  }
  return VITE_FALLBACK
}

const MEDIA_EXT =
  /\.(mp4|webm|mov|m4v|mkv|mp3|wav|aif|aiff|aac|ogg|flac|m4a|jpg|jpeg|png)$/i

type DialogLastDirs = {
  /** Ultima cartella usata per «Apri cartella» (playlist). */
  playlistFolder?: string
  /** Ultima cartella usata per dialog file multipli (playlist). */
  playlistMediaDir?: string
  /** Ultima cartella usata per dialog file su Launchpad. */
  launchpadMediaDir?: string
}

function dialogLastDirsPath(): string {
  return path.join(app.getPath('userData'), 'dialog-last-dirs.json')
}

function readDialogLastDirs(): DialogLastDirs {
  try {
    const raw = fs.readFileSync(dialogLastDirsPath(), 'utf8')
    return JSON.parse(raw) as DialogLastDirs
  } catch {
    return {}
  }
}

function writeDialogLastDirs(patch: Partial<DialogLastDirs>): void {
  const next = { ...readDialogLastDirs(), ...patch }
  const fp = dialogLastDirsPath()
  fs.mkdirSync(path.dirname(fp), { recursive: true })
  fs.writeFileSync(fp, JSON.stringify(next, null, 0), 'utf8')
}

function existingDir(p: string | undefined): string | undefined {
  if (!p) return undefined
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory() ? p : undefined
  } catch {
    return undefined
  }
}

function getSecondaryDisplay() {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const other = displays.find((d) => d.id !== primary.id)
  return other ?? primary
}

function createRegiaWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Regia',
    backgroundColor: '#0c0d10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: false,
    },
  })

  if (isDev) {
    void w.loadURL(getDevServerUrl() + '/')
    // DevTools solo su richiesta: `ELECTRON_OPEN_DEVTOOLS=1 npm run dev`
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
      w.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    void w.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
  return w
}

function createOutputWindow(): BrowserWindow {
  const d = getSecondaryDisplay()
  const { width: rw, height: rh } = getOutputResolution()
  const x =
    d.bounds.x + Math.max(0, Math.floor((d.bounds.width - rw) / 2))
  const y =
    d.bounds.y + Math.max(0, Math.floor((d.bounds.height - rh) / 2))

  const w = new BrowserWindow({
    x,
    y,
    width: rw,
    height: rh,
    frame: false,
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: false,
    },
  })

  w.setMenuBarVisibility(false)

  if (isDev) {
    void w.loadURL(getDevServerUrl() + '/output.html')
  } else {
    void w.loadFile(path.join(__dirname, '..', 'dist', 'output.html'))
  }

  /* Visibilità solo su richiesta da regia (Schermo 2); default nascosto. */
  return w
}

function forwardToOutput(cmd: PlaybackCommand) {
  if (!outputWindow || outputWindow.isDestroyed()) return
  outputWindow.webContents.send('playback:command', cmd)
}

/** Nasconde la finestra uscita così il secondo monitor torna al desktop; non solo nero. */
function setOutputPresentationVisible(visible: boolean): void {
  if (!outputWindow || outputWindow.isDestroyed()) return
  if (visible) {
    placeOutputWindowOnSecondaryDisplay(outputWindow)
    outputWindow.show()
    outputWindow.setFullScreen(false)
  } else {
    forwardToOutput({ type: 'pause' })
    outputWindow.setFullScreen(false)
    outputWindow.hide()
  }
}

function pathToMediaUrl(absPath: string): string {
  return pathToFileURL(absPath).href
}

/** Sample integrati per «Launchpad base»: dev `public/`, produzione `dist/` dopo vite build. */
function resolveLaunchpadBaseKitDir(): string | null {
  const fromPublic = path.join(__dirname, '..', 'public', 'launchpad-base')
  const fromDist = path.join(__dirname, '..', 'dist', 'launchpad-base')
  try {
    if (fs.existsSync(fromPublic) && fs.statSync(fromPublic).isDirectory()) {
      return fromPublic
    }
    if (fs.existsSync(fromDist) && fs.statSync(fromDist).isDirectory()) {
      return fromDist
    }
  } catch {
    /* ignore */
  }
  return null
}

function listLaunchpadBaseKitPaths(): string[] {
  const dir = resolveLaunchpadBaseKitDir()
  if (!dir) return []
  let names: string[]
  try {
    names = fs.readdirSync(dir).filter((f) => MEDIA_EXT.test(f))
  } catch {
    return []
  }
  return names
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    )
    .map((f) => path.join(dir, f))
}

function setupIpc() {
  ipcMain.handle('launchpad-base:kitPaths', () => listLaunchpadBaseKitPaths())

  ipcMain.handle('util:toFileUrl', (_e, absPath: string) => {
    return pathToMediaUrl(absPath)
  })

  ipcMain.handle('dialog:selectFolder', async () => {
    const owner = regiaWindow ?? BrowserWindow.getFocusedWindow()
    const dirs = readDialogLastDirs()
    const defaultPath = existingDir(dirs.playlistFolder)
    const { canceled, filePaths } = await dialog.showOpenDialog(owner!, {
      properties: ['openDirectory'],
      ...(defaultPath ? { defaultPath } : {}),
    })
    if (canceled || !filePaths[0]) return null
    const dir = filePaths[0]
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const paths = entries
      .filter((e) => e.isFile() && MEDIA_EXT.test(e.name))
      .map((e) => path.join(dir, e.name))
      .sort((a, b) =>
        path.basename(a).localeCompare(path.basename(b), undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      )
    writeDialogLastDirs({ playlistFolder: dir })
    return paths
  })

  ipcMain.handle(
    'dialog:selectMediaFiles',
    async (
      _e,
      opts?: { context?: 'playlist' | 'launchpad' },
    ) => {
    const owner = regiaWindow ?? BrowserWindow.getFocusedWindow()
    const ctx = opts?.context === 'launchpad' ? 'launchpad' : 'playlist'
    const dirs = readDialogLastDirs()
    const defaultPath =
      ctx === 'launchpad'
        ? existingDir(dirs.launchpadMediaDir)
        : existingDir(dirs.playlistMediaDir) ?? existingDir(dirs.playlistFolder)
    const { canceled, filePaths } = await dialog.showOpenDialog(owner!, {
      properties: ['openFile', 'multiSelections'],
      ...(defaultPath ? { defaultPath } : {}),
      filters: [
        {
          name: 'Video / audio / immagine',
          extensions: [
            'mp4',
            'webm',
            'mov',
            'm4v',
            'mkv',
            'mp3',
            'wav',
            'aif',
            'aiff',
            'aac',
            'ogg',
            'flac',
            'm4a',
            'jpg',
            'jpeg',
            'png',
          ],
        },
      ],
    })
    if (canceled || !filePaths.length) return null
    const paths = filePaths.filter((p) => MEDIA_EXT.test(path.basename(p)))
    if (!paths.length) return null
    const firstDir = path.dirname(paths[0]!)
    if (ctx === 'launchpad') {
      writeDialogLastDirs({ launchpadMediaDir: firstDir })
    } else {
      writeDialogLastDirs({ playlistMediaDir: firstDir })
    }
    return paths
  })

  ipcMain.handle('playback:send', async (_evt, cmd: PlaybackCommand) => {
    if (cmd.type === 'load') {
      const src =
        cmd.src.startsWith('file:') || cmd.src.startsWith('http')
          ? cmd.src
          : pathToMediaUrl(cmd.src)
      const out: PlaybackCommand =
        cmd.crossfade !== undefined
          ? { type: 'load', src, crossfade: cmd.crossfade }
          : { type: 'load', src }
      forwardToOutput(out)
      return
    }
    forwardToOutput(cmd)
  })

  ipcMain.on('video:ended-from-output', () => {
    if (!regiaWindow || regiaWindow.isDestroyed()) return
    regiaWindow.webContents.send('video:ended-to-regia')
  })

  ipcMain.handle('playlists:list', () => listSavedPlaylists())

  ipcMain.handle(
    'playlists:save',
    (
      _e,
      opts: {
        id?: string
        label: string
        paths: string[]
        crossfade?: boolean
        loopMode?: StoredPlaylistLoopMode
        themeColor?: string | null
        playlistMode?: 'tracks' | 'launchpad'
        launchPadCells?: LaunchPadCellStored[]
        totalDurationSec?: number
      },
    ): { id: string } => saveSavedPlaylist(opts),
  )

  ipcMain.handle(
    'playlists:patchTotalDuration',
    (_e, id: string, totalDurationSec: number) =>
      patchSavedPlaylistTotalDuration(id, totalDurationSec),
  )

  ipcMain.handle('playlists:load', (_e, id: string) => getSavedPlaylist(id))

  ipcMain.handle('playlists:delete', (_e, id: string) =>
    deleteSavedPlaylist(id),
  )

  ipcMain.handle('playlists:setOrder', (_e, orderedIds: string[]) =>
    setPlaylistsOrder(Array.isArray(orderedIds) ? orderedIds : []),
  )

  ipcMain.handle('playlists:duplicate', (_e, id: string) =>
    duplicateSavedPlaylist(id),
  )

  ipcMain.handle('output:setPresentationVisible', (_e, visible: boolean) => {
    setOutputPresentationVisible(visible)
  })

  ipcMain.handle('output:getResolution', () => ({ ...getOutputResolution() }))

  ipcMain.handle(
    'output:setResolution',
    (_e, opts: { width: number; height: number }) => {
      const ok = setOutputResolution({
        width: Math.round(opts.width),
        height: Math.round(opts.height),
      })
      return { ok }
    },
  )
}

app.whenReady().then(() => {
  setupIpc()
  outputWindow = createOutputWindow()
  regiaWindow = createRegiaWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      outputWindow = createOutputWindow()
      regiaWindow = createRegiaWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
