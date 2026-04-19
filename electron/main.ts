import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  screen,
} from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { PlaybackCommand } from './types'
import { encodeSolidPngRgba, parseHexRgb } from './chalkboardPng'
import { LanHost } from './lan/LanHost'
import type {
  RemoteDispatchPayload,
  RemotePlaybackSnapshotV1,
} from './lan/remoteTypes'
import { getPrimaryLanIPv4 } from './lan/networkUtils'

/* --- Playlist salvate; `dist-electron/package.json` con type commonjs (script post-build) evita ESM sui .js emessi da tsc --- */

type SavedPlaylistMeta = {
  id: string
  label: string
  trackCount: number
  updatedAt: string
  totalDurationSec?: number
  themeColor?: string
  /** Assente = elenco brani; `launchpad` = griglia 4×4; `chalkboard` = lavagna. */
  playlistMode?: 'tracks' | 'launchpad' | 'chalkboard'
}

type LaunchPadCellStored = {
  samplePath: string | null
  padColor: string
  padGain: number
  /** Etichetta sul pad (opzionale). */
  padDisplayName?: string | null
  /** `KeyboardEvent.code` (opzionale). */
  padKeyCode?: string | null
  padKeyMode?: 'play' | 'toggle'
}

const LAUNCHPAD_CELL_COUNT = 16
const CHALKBOARD_BANK_COUNT = 4

type ChalkboardPlacedImageStored = {
  id: string
  path: string
  x: number
  y: number
  w: number
  h: number
}

function normalizeChalkboardPlacementsStored(
  raw: unknown,
): ChalkboardPlacedImageStored[][] | undefined {
  if (!Array.isArray(raw) || raw.length < CHALKBOARD_BANK_COUNT) return undefined
  const out: ChalkboardPlacedImageStored[][] = []
  for (let bi = 0; bi < CHALKBOARD_BANK_COUNT; bi++) {
    const row = raw[bi]
    const acc: ChalkboardPlacedImageStored[] = []
    if (Array.isArray(row)) {
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
          !path.isAbsolute(p) ||
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          !Number.isFinite(w) ||
          !Number.isFinite(h) ||
          w < 8 ||
          h < 8
        )
          continue
        acc.push({ id, path: p, x, y, w, h })
      }
    }
    out.push(acc)
  }
  return out
}

function chalkboardDraftsDir(): string {
  return path.join(app.getPath('userData'), 'chalkboard-drafts')
}

function chalkboardAssetsDir(): string {
  return path.join(app.getPath('userData'), 'chalkboard-assets')
}

function normalizeChalkboardBackgroundStored(raw: unknown): string {
  if (typeof raw !== 'string') return '#2d3436'
  const t = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  return '#2d3436'
}

function ensureChalkboardBankPngFiles(
  folderBaseName: string,
  draft: boolean,
  width: number,
  height: number,
  backgroundHex?: string,
): string[] {
  const base = draft
    ? path.join(chalkboardDraftsDir(), folderBaseName)
    : path.join(chalkboardAssetsDir(), folderBaseName)
  fs.mkdirSync(base, { recursive: true })
  const { r, g, b } = parseHexRgb(
    normalizeChalkboardBackgroundStored(backgroundHex),
  )
  const png = encodeSolidPngRgba(width, height, r, g, b, 255)
  const paths: string[] = []
  for (let i = 0; i < CHALKBOARD_BANK_COUNT; i++) {
    const fp = path.join(base, `bank-${i}.png`)
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, png)
    }
    const fd = path.join(base, `bank-${i}-draw.png`)
    if (!fs.existsSync(fd)) {
      fs.writeFileSync(fd, png)
    }
    paths.push(fp)
  }
  return paths
}

function normalizeChalkboardBankPathsStored(
  raw: unknown,
): string[] | undefined {
  if (!Array.isArray(raw) || raw.length < CHALKBOARD_BANK_COUNT) return undefined
  const out: string[] = []
  for (let i = 0; i < CHALKBOARD_BANK_COUNT; i++) {
    const p = raw[i]
    if (typeof p !== 'string' || !path.isAbsolute(p)) return undefined
    out.push(p)
  }
  return out
}

function migrateChalkboardDraftToAssets(
  draftSessionId: string,
  playlistId: string,
): string[] {
  const srcRoot = path.join(chalkboardDraftsDir(), draftSessionId)
  const destRoot = path.join(chalkboardAssetsDir(), playlistId)
  if (!fs.existsSync(srcRoot)) {
    return []
  }
  fs.mkdirSync(chalkboardAssetsDir(), { recursive: true })
  if (fs.existsSync(destRoot)) {
    fs.rmSync(destRoot, { recursive: true, force: true })
  }
  fs.renameSync(srcRoot, destRoot)
  return Array.from({ length: CHALKBOARD_BANK_COUNT }, (_, i) =>
    path.join(destRoot, `bank-${i}.png`),
  )
}

function copyChalkboardAssetDir(srcPlaylistId: string, destPlaylistId: string) {
  const srcRoot = path.join(chalkboardAssetsDir(), srcPlaylistId)
  const destRoot = path.join(chalkboardAssetsDir(), destPlaylistId)
  if (!fs.existsSync(srcRoot)) return
  fs.mkdirSync(chalkboardAssetsDir(), { recursive: true })
  if (fs.existsSync(destRoot)) {
    fs.rmSync(destRoot, { recursive: true, force: true })
  }
  fs.cpSync(srcRoot, destRoot, { recursive: true })
}

function removeChalkboardAssetDir(playlistId: string) {
  const destRoot = path.join(chalkboardAssetsDir(), playlistId)
  try {
    if (fs.existsSync(destRoot)) {
      fs.rmSync(destRoot, { recursive: true, force: true })
    }
  } catch {
    /* ignore */
  }
}

function writeChalkboardBankFromDataUrl(absPath: string, dataUrl: string): void {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('invalid data url')
  const meta = dataUrl.slice(0, comma)
  const b64 = dataUrl.slice(comma + 1)
  if (!meta.includes('base64')) throw new Error('expected base64 data url')
  const buf = Buffer.from(b64, 'base64')
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  fs.writeFileSync(absPath, buf)
}

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
  playlistMode?: 'tracks' | 'launchpad' | 'chalkboard'
  launchPadCells?: LaunchPadCellStored[]
  /** 4 PNG assoluti (banchi Chalkboard). */
  chalkboardBankPaths?: string[]
  /** Sfondo lavagna (#rrggbb). */
  chalkboardBackgroundColor?: string
  /** Immagini posizionabili per banco (accanto a PNG tratto-only `-draw`). */
  chalkboardPlacementsByBank?: ChalkboardPlacedImageStored[][]
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
    let padDisplayName: string | null = null
    if (typeof c.padDisplayName === 'string') {
      const t = c.padDisplayName.trim().replace(/\s+/g, ' ').slice(0, 120)
      if (t) padDisplayName = t
    }
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
    out.push({
      samplePath,
      padColor,
      padGain,
      padDisplayName,
      padKeyCode,
      padKeyMode,
    })
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
  const modeLp = v.playlistMode === 'launchpad' ? ('launchpad' as const) : undefined
  const modeCb = v.playlistMode === 'chalkboard' ? ('chalkboard' as const) : undefined
  const cells =
    modeLp === 'launchpad'
      ? normalizeLaunchPadCellsStored(v.launchPadCells)
      : undefined
  const padCount =
    modeLp === 'launchpad'
      ? cells
        ? cells.filter((c) => c.samplePath).length
        : 0
      : modeCb === 'chalkboard'
        ? CHALKBOARD_BANK_COUNT
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
  if (modeLp) meta.playlistMode = modeLp
  else if (modeCb) meta.playlistMode = modeCb
  else meta.playlistMode = 'tracks'
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
  playlistMode?: 'tracks' | 'launchpad' | 'chalkboard'
  launchPadCells?: LaunchPadCellStored[]
  chalkboardBankPaths?: string[]
  chalkboardBackgroundColor?: string
  chalkboardPlacementsByBank?: ChalkboardPlacedImageStored[][]
  /** Se i PNG sono ancora in chalkboard-drafts/<id>/, sposta in chalkboard-assets/<playlistId>/. */
  chalkboardMigrateDraftSessionId?: string | null
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
  const isChalkboard = opts.playlistMode === 'chalkboard'
  const cellsNorm = isLaunchpad
    ? normalizeLaunchPadCellsStored(opts.launchPadCells ?? [])
    : undefined
  let chalkPaths = isChalkboard
    ? normalizeChalkboardBankPathsStored(opts.chalkboardBankPaths ?? [])
    : undefined
  if (isChalkboard && chalkPaths && opts.chalkboardMigrateDraftSessionId) {
    const sid = opts.chalkboardMigrateDraftSessionId.trim()
    if (
      sid &&
      chalkPaths[0]!.includes(path.join('chalkboard-drafts', sid)) &&
      fs.existsSync(path.join(chalkboardDraftsDir(), sid))
    ) {
      chalkPaths = migrateChalkboardDraftToAssets(sid, id)
    }
  }
  const entry: StoredPlaylistEntry = {
    label,
    paths: isLaunchpad || isChalkboard ? [] : [...opts.paths],
    updatedAt: new Date().toISOString(),
    crossfade: Boolean(opts.crossfade),
  }
  if (tc) entry.themeColor = tc
  if (isLaunchpad) {
    entry.playlistMode = 'launchpad'
    entry.launchPadCells = cellsNorm ?? []
    delete entry.crossfade
    delete entry.loopMode
    delete entry.chalkboardBankPaths
    delete entry.chalkboardPlacementsByBank
    delete entry.chalkboardBackgroundColor
  } else if (isChalkboard) {
    entry.playlistMode = 'chalkboard'
    entry.chalkboardBankPaths = chalkPaths ?? []
    const pl = normalizeChalkboardPlacementsStored(opts.chalkboardPlacementsByBank)
    if (pl && pl.some((row) => row.length > 0)) {
      entry.chalkboardPlacementsByBank = pl
    } else {
      delete entry.chalkboardPlacementsByBank
    }
    entry.chalkboardBackgroundColor = normalizeChalkboardBackgroundStored(
      opts.chalkboardBackgroundColor,
    )
    delete entry.launchPadCells
    delete entry.crossfade
    delete entry.loopMode
  } else {
    entry.playlistMode = 'tracks'
    delete entry.launchPadCells
    delete entry.chalkboardBankPaths
    delete entry.chalkboardPlacementsByBank
    delete entry.chalkboardBackgroundColor
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
  playlistMode: 'tracks' | 'launchpad' | 'chalkboard'
  launchPadCells: LaunchPadCellStored[]
  chalkboardBankPaths: string[]
  chalkboardBackgroundColor: string
  chalkboardPlacementsByBank: ChalkboardPlacedImageStored[][]
} | null {
  const s = readPlaylistsStore()
  const e = s.items[id]
  if (!e) return null
  const tc = normalizeStoredThemeColor(e.themeColor)
  const isLp = e.playlistMode === 'launchpad'
  const isCb = e.playlistMode === 'chalkboard'
  const cells = isLp
    ? normalizeLaunchPadCellsStored(e.launchPadCells) ?? []
    : []
  const cbPaths =
    isCb ? normalizeChalkboardBankPathsStored(e.chalkboardBankPaths) ?? [] : []
  const cbPlacements = isCb
    ? normalizeChalkboardPlacementsStored(e.chalkboardPlacementsByBank) ??
      Array.from({ length: CHALKBOARD_BANK_COUNT }, () => [] as ChalkboardPlacedImageStored[])
    : Array.from({ length: CHALKBOARD_BANK_COUNT }, () => [] as ChalkboardPlacedImageStored[])
  const cbBg = isCb
    ? normalizeChalkboardBackgroundStored(e.chalkboardBackgroundColor)
    : '#2d3436'
  return {
    id,
    label: e.label,
    paths: isLp || isCb ? [] : [...e.paths],
    crossfade: isLp || isCb ? false : Boolean(e.crossfade),
    loopMode:
      isLp || isCb ? 'off' : (normalizeStoredLoopMode(e.loopMode) ?? 'off'),
    themeColor: tc ?? '',
    playlistMode: isLp ? 'launchpad' : isCb ? 'chalkboard' : 'tracks',
    launchPadCells: cells,
    chalkboardBankPaths: cbPaths,
    chalkboardBackgroundColor: cbBg,
    chalkboardPlacementsByBank: cbPlacements,
  }
}

function deleteSavedPlaylist(id: string): boolean {
  const s = readPlaylistsStore()
  const prev = s.items[id]
  if (!prev) return false
  if (prev.playlistMode === 'chalkboard') {
    removeChalkboardAssetDir(id)
  }
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
  } else if (src.playlistMode === 'chalkboard') {
    if (src.chalkboardBankPaths.length < CHALKBOARD_BANK_COUNT) return null
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
  if (src.playlistMode === 'chalkboard') {
    const newId = `pl_${Date.now()}`
    copyChalkboardAssetDir(id, newId)
    const nextPaths = Array.from({ length: CHALKBOARD_BANK_COUNT }, (_, i) =>
      path.join(chalkboardAssetsDir(), newId, `bank-${i}.png`),
    )
    const hasPlacements = src.chalkboardPlacementsByBank.some(
      (row) => row.length > 0,
    )
    return saveSavedPlaylist({
      id: newId,
      label,
      paths: [],
      crossfade: false,
      themeColor: dupTheme ?? null,
      playlistMode: 'chalkboard',
      chalkboardBankPaths: nextPaths,
      chalkboardBackgroundColor: src.chalkboardBackgroundColor,
      ...(hasPlacements
        ? {
            chalkboardPlacementsByBank: normalizeChalkboardPlacementsStored(
              src.chalkboardPlacementsByBank,
            ),
          }
        : {}),
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
/**
 * Ultimo comando lavagna inviato all’uscita (la finestra Output può caricare dopo
 * il primo `sendPlayback`; ripetiamo su `did-finish-load`).
 */
let lastChalkboardLayerForOutput: Extract<
  PlaybackCommand,
  { type: 'chalkboardLayer' }
> | null = null
/** Playlist / launchpad in finestra OS separata (puntina). */
const playlistFloaterWindows = new Map<string, BrowserWindow>()

const OUTPUT_WINDOW_BASE_TITLE = 'Uscita — REGIA MUSICPRO'

let lanHost: LanHost | null = null

let remotePlaybackSnapshot: RemotePlaybackSnapshotV1 = {
  v: 1,
  programPlaying: false,
  programTitle: null,
  programPositionSec: null,
  programDurationSec: null,
  launchpadActive: false,
  launchpadTitle: null,
  launchpadSlot: null,
  outputVolume: 1,
  playlistLoopMode: 'off',
  canUndo: false,
}

let remoteDispatchSeq = 0
const pendingRemoteDispatch = new Map<
  number,
  {
    resolve: () => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
  }
>()

function mergeRemotePlaybackSnapshot(
  patch: Partial<Omit<RemotePlaybackSnapshotV1, 'v'>>,
): void {
  const next: RemotePlaybackSnapshotV1 = { ...remotePlaybackSnapshot }
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    const v = patch[key]
    if (v !== undefined) (next as Record<string, unknown>)[key as string] = v
  }
  next.v = 1
  remotePlaybackSnapshot = next
  lanHost?.pushPlaybackSnapshot(remotePlaybackSnapshot)
  syncAudioWindowTitles()
}

function syncAudioWindowTitles(): void {
  const snap = remotePlaybackSnapshot
  const baseRegia = regiaMainWindowTitle()
  const regiaMark = snap.launchpadActive ? '♪ ' : ''
  if (regiaWindow && !regiaWindow.isDestroyed()) {
    try {
      regiaWindow.setTitle(`${regiaMark}${baseRegia}`)
    } catch {
      /* ignore */
    }
  }
  const outMark = snap.programPlaying ? '♪ ' : ''
  if (outputWindow && !outputWindow.isDestroyed()) {
    try {
      outputWindow.setTitle(`${outMark}${OUTPUT_WINDOW_BASE_TITLE}`)
    } catch {
      /* ignore */
    }
  }
}

function getPlaylistPublicDetailForRemote(id: string): unknown | null {
  const pl = getSavedPlaylist(id)
  if (!pl) return null
  if (pl.playlistMode === 'tracks') {
    return {
      id: pl.id,
      label: pl.label,
      mode: 'tracks' as const,
      themeColor: pl.themeColor || undefined,
      tracks: pl.paths.map((p, index) => ({
        index,
        label: path.basename(p),
      })),
    }
  }
  if (pl.playlistMode === 'launchpad') {
    return {
      id: pl.id,
      label: pl.label,
      mode: 'launchpad' as const,
      themeColor: pl.themeColor || undefined,
      pads: pl.launchPadCells.map((c, index) => ({
        index,
        label:
          (typeof c.padDisplayName === 'string' && c.padDisplayName.trim()) ||
          (c.samplePath ? path.basename(c.samplePath) : ''),
        color: c.padColor,
        hasSample: Boolean(c.samplePath),
      })),
    }
  }
  if (pl.playlistMode === 'chalkboard') {
    return {
      id: pl.id,
      label: pl.label,
      mode: 'chalkboard' as const,
      themeColor: pl.themeColor || undefined,
      banks: Array.from({ length: CHALKBOARD_BANK_COUNT }, (_, index) => ({
        index,
        label: `Banco ${index + 1}`,
      })),
    }
  }
  return null
}

function dispatchRemotePayloadToRegia(
  payload: RemoteDispatchPayload,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!regiaWindow || regiaWindow.isDestroyed()) {
      reject(new Error('regia_unavailable'))
      return
    }
    const id = ++remoteDispatchSeq
    const timer = setTimeout(() => {
      pendingRemoteDispatch.delete(id)
      reject(new Error('timeout'))
    }, 15000)
    pendingRemoteDispatch.set(id, {
      resolve: () => {
        clearTimeout(timer)
        resolve()
      },
      reject: (e) => {
        clearTimeout(timer)
        reject(e)
      },
      timer,
    })
    regiaWindow.webContents.send('remote:dispatch', { reqId: id, payload })
  })
}

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

/** Tappo uscita (Schermo 2): stesso dato per regia e finestra output (localStorage non è condiviso tra file:// distinte). */
const DEFAULT_OUTPUT_IDLE_CAP_DISK = {
  mode: 'black' as const,
  color: '#0a0a0a',
  imagePath: null as string | null,
}

type OutputIdleCapDisk = {
  mode: 'black' | 'color' | 'image'
  color: string
  imagePath: string | null
}

function outputIdleCapPath(): string {
  return path.join(app.getPath('userData'), 'output-idle-cap.json')
}

function normalizeHexColorIdle(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_OUTPUT_IDLE_CAP_DISK.color
  const t = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1]!
    const g = t[2]!
    const b = t[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return DEFAULT_OUTPUT_IDLE_CAP_DISK.color
}

function normalizeImagePathIdle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length > 0 ? t : null
}

function normalizeOutputIdleCapDisk(raw: unknown): OutputIdleCapDisk {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_OUTPUT_IDLE_CAP_DISK }
  }
  const o = raw as Record<string, unknown>
  const mode =
    o.mode === 'color' ? 'color' : o.mode === 'image' ? 'image' : 'black'
  const color = normalizeHexColorIdle(o.color)
  const imagePath = normalizeImagePathIdle(o.imagePath)
  if (mode === 'image') {
    return { mode: 'image', color, imagePath }
  }
  return { mode, color, imagePath: null }
}

function readOutputIdleCapFromDisk(): OutputIdleCapDisk {
  try {
    const raw = fs.readFileSync(outputIdleCapPath(), 'utf8')
    return normalizeOutputIdleCapDisk(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_OUTPUT_IDLE_CAP_DISK }
  }
}

function writeOutputIdleCapToDisk(cap: OutputIdleCapDisk): void {
  const p = outputIdleCapPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(cap, null, 2), 'utf8')
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

/** Frequenza controlli aggiornamento oltre al check all’avvio (solo app pacchettizzata). */
type UpdateCheckSchedule =
  | 'on_startup'
  | 'daily'
  | 'hourly'
  | 'every_5_minutes'

function updateCheckPrefsPath(): string {
  return path.join(app.getPath('userData'), 'update-check-prefs.json')
}

function normalizeUpdateCheckSchedule(raw: unknown): UpdateCheckSchedule {
  if (
    raw === 'daily' ||
    raw === 'hourly' ||
    raw === 'every_5_minutes' ||
    raw === 'on_startup'
  ) {
    return raw
  }
  return 'on_startup'
}

function readUpdateCheckSchedule(): UpdateCheckSchedule {
  try {
    const j = JSON.parse(
      fs.readFileSync(updateCheckPrefsPath(), 'utf8'),
    ) as { schedule?: unknown }
    return normalizeUpdateCheckSchedule(j.schedule)
  } catch {
    return 'on_startup'
  }
}

function writeUpdateCheckSchedule(schedule: UpdateCheckSchedule): void {
  try {
    const fp = updateCheckPrefsPath()
    fs.mkdirSync(path.dirname(fp), { recursive: true })
    fs.writeFileSync(
      fp,
      JSON.stringify({ schedule }, null, 2),
      'utf8',
    )
  } catch {
    /* ignore */
  }
}

let updateCheckRepeatTimer: ReturnType<typeof setInterval> | null = null

function clearUpdateCheckRepeatTimer(): void {
  if (updateCheckRepeatTimer) {
    clearInterval(updateCheckRepeatTimer)
    updateCheckRepeatTimer = null
  }
}

function applyUpdateCheckRepeatSchedule(schedule: UpdateCheckSchedule): void {
  clearUpdateCheckRepeatTimer()
  if (isDev) return
  const ms =
    schedule === 'daily'
      ? 86_400_000
      : schedule === 'hourly'
        ? 3_600_000
        : schedule === 'every_5_minutes'
          ? 300_000
          : 0
  if (ms <= 0) return
  updateCheckRepeatTimer = setInterval(() => {
    void autoUpdater.checkForUpdates()
  }, ms)
}

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

/** Scritto da `scripts/electron-dist-postbuild.mjs` accanto a `main.cjs`. */
function readMainProcessBuildInfo(): { buildHash: string; builtAt: string } {
  const p = path.join(__dirname, 'build-info.json')
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8')) as {
      gitShort?: unknown
      builtAt?: unknown
    }
    return {
      buildHash: typeof j.gitShort === 'string' ? j.gitShort : '',
      builtAt: typeof j.builtAt === 'string' ? j.builtAt : '',
    }
  } catch {
    return { buildHash: '', builtAt: '' }
  }
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

let pkgMetaForTitleCache: {
  version: string
  regiaProgramCreatedOn?: string
} | null = null

function getPkgMetaForWindowTitle(): {
  version: string
  regiaProgramCreatedOn?: string
} {
  if (pkgMetaForTitleCache) return pkgMetaForTitleCache
  try {
    const p = path.join(app.getAppPath(), 'package.json')
    const j = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>
    pkgMetaForTitleCache = {
      version: typeof j.version === 'string' ? j.version : '0.0.0',
      regiaProgramCreatedOn:
        typeof j.regiaProgramCreatedOn === 'string'
          ? j.regiaProgramCreatedOn
          : undefined,
    }
  } catch {
    pkgMetaForTitleCache = { version: '0.0.0' }
  }
  return pkgMetaForTitleCache
}

function formatRegiaProgramCreatedIt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return iso.trim()
  return `${m[3]}/${m[2]}/${m[1]}`
}

function regiaMainWindowTitle(): string {
  const { version, regiaProgramCreatedOn } = getPkgMetaForWindowTitle()
  const date =
    regiaProgramCreatedOn &&
    formatRegiaProgramCreatedIt(regiaProgramCreatedOn)
  const parts = ['REGIA MUSICPRO', `v${version}`]
  if (date) parts.push(date)
  return parts.join(' ')
}

/** Icona finestra: `dist` dopo build, `public` in dev, `build` per pacchetto. */
function resolveRegiaIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'app-icon.png'),
    path.join(__dirname, '..', 'public', 'app-icon.png'),
    path.join(__dirname, '..', 'build', 'icon.png'),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch {
      /* ignore */
    }
  }
  return undefined
}

function createRegiaWindow(): BrowserWindow {
  const iconPath = resolveRegiaIconPath()
  const w = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: regiaMainWindowTitle(),
    backgroundColor: '#0c0d10',
    ...(iconPath ? { icon: iconPath } : {}),
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
    title: OUTPUT_WINDOW_BASE_TITLE,
    frame: false,
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: false,
      /* Video/audio devono proseguire anche con finestra nascosta (Schermo 2 off). */
      backgroundThrottling: false,
    },
  })

  w.setMenuBarVisibility(false)

  w.webContents.once('did-finish-load', () => {
    /* Ritarda un tick così il renderer ha montato `onPlaybackCommand`. */
    setImmediate(() => {
      forwardOutputIdleCapFromDiskToOutput()
      flushLastChalkboardLayerToOutput()
    })
  })

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
  const wc = outputWindow.webContents
  const deliver = () => {
    try {
      wc.send('playback:command', cmd)
    } catch {
      /* finestra in chiusura */
    }
  }
  /**
   * Se la pagina Output non ha ancora finito il primo load, `send` può andare perso:
   * accodiamo a `did-finish-load` (stesso problema per lavagna inviata prima che il preload
   * abbia registrato `onPlaybackCommand`).
   */
  if (wc.isLoading()) {
    wc.once('did-finish-load', deliver)
    return
  }
  deliver()
}

function flushLastChalkboardLayerToOutput() {
  const c = lastChalkboardLayerForOutput
  if (!c || c.type !== 'chalkboardLayer') return
  if (!c.visible || !c.src || c.src.length === 0) return
  forwardToOutput(c)
}

function forwardOutputIdleCapFromDiskToOutput(): void {
  const cap = readOutputIdleCapFromDisk()
  forwardToOutput({
    type: 'setOutputIdleCap',
    mode: cap.mode,
    color: cap.color,
    imagePath: cap.imagePath,
  })
}

/** Nasconde la finestra uscita così il secondo monitor torna al desktop; non solo nero. */
function setOutputPresentationVisible(visible: boolean): void {
  if (!outputWindow || outputWindow.isDestroyed()) return
  if (visible) {
    placeOutputWindowOnSecondaryDisplay(outputWindow)
    outputWindow.show()
    outputWindow.setFullScreen(false)
    /* Dopo show: riallinea tappo (race con caricamento regia / disco). */
    setImmediate(() => {
      forwardOutputIdleCapFromDiskToOutput()
      flushLastChalkboardLayerToOutput()
    })
  } else {
    /* Non inviare pause: la regia comanda play/pause; con finestra nascosta
     * l’audio deve poter continuare (anteprima attiva, Schermo 2 off). */
    outputWindow.setFullScreen(false)
    outputWindow.hide()
  }
}

function pathToMediaUrl(absPath: string): string {
  return pathToFileURL(absPath).href
}

/** Cartelle kit integrati: dev `public/`, produzione `dist/` dopo vite build. */
function resolveLaunchpadKitDir(subdir: string): string | null {
  const fromPublic = path.join(__dirname, '..', 'public', subdir)
  const fromDist = path.join(__dirname, '..', 'dist', subdir)
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

function listLaunchpadKitPaths(subdir: string): string[] {
  const dir = resolveLaunchpadKitDir(subdir)
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
  ipcMain.handle('launchpad-base:kitPaths', () =>
    listLaunchpadKitPaths('launchpad-base'),
  )
  ipcMain.handle('launchpad-sfx:kitPaths', () =>
    listLaunchpadKitPaths('launchpad-sfx'),
  )

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
      opts?: { context?: 'playlist' | 'launchpad' | 'chalkboard' },
    ) => {
    const owner = regiaWindow ?? BrowserWindow.getFocusedWindow()
    const ctx =
      opts?.context === 'launchpad'
        ? 'launchpad'
        : opts?.context === 'chalkboard'
          ? 'chalkboard'
          : 'playlist'
    const dirs = readDialogLastDirs()
    const defaultPath =
      ctx === 'launchpad'
        ? existingDir(dirs.launchpadMediaDir)
        : ctx === 'chalkboard'
          ? existingDir(dirs.playlistMediaDir) ??
            existingDir(dirs.playlistFolder)
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
    if (cmd.type === 'chalkboardLayer') {
      const src =
        cmd.src &&
        !cmd.src.startsWith('file:') &&
        !cmd.src.startsWith('http')
          ? pathToMediaUrl(cmd.src)
          : cmd.src
      const composite: 'solid' | 'transparent' | undefined =
        cmd.visible && cmd.composite === 'transparent'
          ? 'transparent'
          : cmd.visible
            ? 'solid'
            : undefined
      const bg =
        typeof cmd.boardBackgroundColor === 'string' &&
        /^#[0-9a-fA-F]{6}$/.test(cmd.boardBackgroundColor.trim())
          ? cmd.boardBackgroundColor.trim().toLowerCase()
          : undefined
      const out: Extract<PlaybackCommand, { type: 'chalkboardLayer' }> = {
        type: 'chalkboardLayer',
        visible: cmd.visible,
        src,
        ...(composite ? { composite } : {}),
        ...(bg ? { boardBackgroundColor: bg } : {}),
      }
      lastChalkboardLayerForOutput = out
      forwardToOutput(out)
      return
    }
    forwardToOutput(cmd)
  })

  ipcMain.on('video:ended-from-output', () => {
    if (!regiaWindow || regiaWindow.isDestroyed()) return
    regiaWindow.webContents.send('video:ended-to-regia')
  })

  ipcMain.on('output:audio-level', (_e, level: unknown) => {
    const v =
      typeof level === 'number' && Number.isFinite(level)
        ? Math.min(1, Math.max(0, level))
        : 0
    if (!regiaWindow || regiaWindow.isDestroyed()) return
    regiaWindow.webContents.send('regia:output-audio-level', v)
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
        playlistMode?: 'tracks' | 'launchpad' | 'chalkboard'
        launchPadCells?: LaunchPadCellStored[]
        chalkboardBankPaths?: string[]
        chalkboardBackgroundColor?: string
        chalkboardPlacementsByBank?: ChalkboardPlacedImageStored[][]
        chalkboardMigrateDraftSessionId?: string | null
        totalDurationSec?: number
      },
    ): { id: string } => saveSavedPlaylist(opts),
  )

  ipcMain.handle(
    'chalkboard:ensureBanks',
    (
      _e,
      opts: {
        folderBaseName: string
        draft: boolean
        width: number
        height: number
        backgroundColor?: string
      },
    ) =>
      ensureChalkboardBankPngFiles(
        opts.folderBaseName,
        opts.draft,
        Math.round(opts.width),
        Math.round(opts.height),
        opts.backgroundColor,
      ),
  )

  ipcMain.handle(
    'chalkboard:writeBankDataUrl',
    (_e, opts: { absPath: string; dataUrl: string }) => {
      writeChalkboardBankFromDataUrl(opts.absPath, opts.dataUrl)
      return { ok: true as const }
    },
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

  ipcMain.handle('output:getIdleCap', () => readOutputIdleCapFromDisk())

  ipcMain.handle('output:setIdleCap', (_e, raw: unknown) => {
    const cap = normalizeOutputIdleCapDisk(raw)
    writeOutputIdleCapToDisk(cap)
    forwardToOutput({
      type: 'setOutputIdleCap',
      mode: cap.mode,
      color: cap.color,
      imagePath: cap.imagePath,
    })
    return { ok: true as const }
  })

  ipcMain.handle('output:ensureIdleCap', (_e, fallbackFromRegia: unknown) => {
    const p = outputIdleCapPath()
    let fromDisk: OutputIdleCapDisk | null = null
    try {
      fromDisk = normalizeOutputIdleCapDisk(
        JSON.parse(fs.readFileSync(p, 'utf8')) as unknown,
      )
    } catch {
      fromDisk = null
    }
    if (fromDisk === null && fallbackFromRegia != null) {
      fromDisk = normalizeOutputIdleCapDisk(fallbackFromRegia)
      writeOutputIdleCapToDisk(fromDisk)
    }
    const out = fromDisk ?? { ...DEFAULT_OUTPUT_IDLE_CAP_DISK }
    forwardToOutput({
      type: 'setOutputIdleCap',
      mode: out.mode,
      color: out.color,
      imagePath: out.imagePath,
    })
    return out
  })

  ipcMain.handle('regia:getContentBounds', () => {
    if (!regiaWindow || regiaWindow.isDestroyed()) return null
    return regiaWindow.getContentBounds()
  })

  ipcMain.handle(
    'playlistFloater:open',
    (
      _e,
      opts: {
        sessionId?: string
        x?: number
        y?: number
        width?: number
        height?: number
      },
    ) => {
      const sessionId =
        typeof opts?.sessionId === 'string' && opts.sessionId.trim()
          ? opts.sessionId.trim()
          : ''
      if (!sessionId) return { ok: false as const }
      if (playlistFloaterWindows.has(sessionId)) return { ok: true as const }
      const x = Number(opts?.x)
      const y = Number(opts?.y)
      const width = Number(opts?.width)
      const height = Number(opts?.height)
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height)
      ) {
        return { ok: false as const }
      }
      const floaterIcon = resolveRegiaIconPath()
      const w = new BrowserWindow({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.max(220, Math.round(width)),
        height: Math.max(180, Math.round(height)),
        frame: false,
        show: false,
        backgroundColor: '#13151a',
        ...(floaterIcon ? { icon: floaterIcon } : {}),
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
        void w.loadURL(
          `${getDevServerUrl()}/?playlistOsFloater=1&session=${encodeURIComponent(sessionId)}`,
        )
      } else {
        void w.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
          search: `playlistOsFloater=1&session=${encodeURIComponent(sessionId)}`,
        })
      }
      w.once('ready-to-show', () => {
        if (!w.isDestroyed()) w.show()
      })
      w.on('close', () => {
        let b: { x: number; y: number; width: number; height: number } | null =
          null
        try {
          if (!w.isDestroyed()) b = w.getBounds()
        } catch {
          /* ignore */
        }
        playlistFloaterWindows.delete(sessionId)
        if (regiaWindow && !regiaWindow.isDestroyed()) {
          regiaWindow.webContents.send('playlist-floater-os-closed', {
            sessionId,
            bounds: b,
          })
        }
      })
      playlistFloaterWindows.set(sessionId, w)
      return { ok: true as const }
    },
  )

  ipcMain.handle('playlistFloater:close', (_e, sessionId: unknown) => {
    const id = typeof sessionId === 'string' ? sessionId : ''
    const w = id ? playlistFloaterWindows.get(id) : undefined
    if (w && !w.isDestroyed()) w.close()
    if (id) playlistFloaterWindows.delete(id)
    return { ok: true as const }
  })

  ipcMain.handle(
    'playlistFloater:broadcastState',
    (event, sessionId: unknown, payload: unknown) => {
      if (!regiaWindow || event.sender !== regiaWindow.webContents)
        return { ok: false as const }
      const id = typeof sessionId === 'string' ? sessionId : ''
      if (!id) return { ok: false as const }
      const w = playlistFloaterWindows.get(id)
      if (w && !w.isDestroyed()) {
        w.webContents.send('playlist-floater-state', payload)
      }
      return { ok: true as const }
    },
  )

  ipcMain.handle(
    'playlistFloater:setBounds',
    (
      event,
      partial: { x?: number; y?: number; width?: number; height?: number },
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win || win.isDestroyed()) return { ok: false as const }
      let sid: string | null = null
      for (const [k, v] of playlistFloaterWindows) {
        if (v === win) {
          sid = k
          break
        }
      }
      if (!sid) return { ok: false as const }
      const b = win.getBounds()
      const nb = {
        x: Math.round(
          typeof partial?.x === 'number' && Number.isFinite(partial.x)
            ? partial.x
            : b.x,
        ),
        y: Math.round(
          typeof partial?.y === 'number' && Number.isFinite(partial.y)
            ? partial.y
            : b.y,
        ),
        width: Math.max(
          220,
          Math.round(
            typeof partial?.width === 'number' && Number.isFinite(partial.width)
              ? partial.width
              : b.width,
          ),
        ),
        height: Math.max(
          180,
          Math.round(
            typeof partial?.height === 'number' &&
              Number.isFinite(partial.height)
              ? partial.height
              : b.height,
          ),
        ),
      }
      win.setBounds(nb)
      return { ok: true as const }
    },
  )

  ipcMain.on(
    'remote:dispatch:result',
    (
      event,
      msg: { reqId?: unknown; ok?: unknown; error?: unknown },
    ) => {
      if (!regiaWindow || event.sender !== regiaWindow.webContents) return
      const reqId = Number(msg?.reqId)
      if (!Number.isFinite(reqId)) return
      const p = pendingRemoteDispatch.get(reqId)
      if (!p) return
      pendingRemoteDispatch.delete(reqId)
      clearTimeout(p.timer)
      if (msg.ok === true) p.resolve()
      else
        p.reject(
          new Error(
            typeof msg.error === 'string' && msg.error.trim()
              ? msg.error.trim()
              : 'remote_error',
          ),
        )
    },
  )

  ipcMain.on('remote:snapshot:patch', (event, partial: unknown) => {
    const okRegia =
      regiaWindow &&
      !regiaWindow.isDestroyed() &&
      event.sender === regiaWindow.webContents
    const okOutput =
      outputWindow &&
      !outputWindow.isDestroyed() &&
      event.sender === outputWindow.webContents
    if (!okRegia && !okOutput) return
    if (!partial || typeof partial !== 'object') return
    mergeRemotePlaybackSnapshot(
      partial as Partial<Omit<RemotePlaybackSnapshotV1, 'v'>>,
    )
  })

  ipcMain.handle(
    'lanServer:start',
    async (_e, opts?: { port?: number }) => {
      if (lanHost?.isRunning()) {
        return {
          running: true as const,
          port: lanHost.getPort(),
          token: lanHost.getToken(),
          lanUrl: lanHost.getLanUrl(),
          localUrl: lanHost.getLocalUrl(),
          remotePath: lanHost.getRemotePagePath(),
        }
      }
      const preferredPort =
        typeof opts?.port === 'number' &&
        Number.isFinite(opts.port) &&
        opts.port > 0
          ? Math.floor(opts.port)
          : 9847
      lanHost = new LanHost({
        isDev,
        getDevServerUrl,
        preferredPort,
        listPlaylists: async () => listSavedPlaylists(),
        getPlaylistPublicDetail: async (id) =>
          getPlaylistPublicDetailForRemote(id),
        dispatchToRegia: dispatchRemotePayloadToRegia,
        getPlaybackSnapshot: () => remotePlaybackSnapshot,
      })
      try {
        const r = await lanHost.start((nextIp) => {
          if (regiaWindow && !regiaWindow.isDestroyed()) {
            regiaWindow.webContents.send('lanServer:ip-changed', {
              ip: nextIp,
              lanUrl: lanHost?.getLanUrl() ?? null,
              localUrl: lanHost?.getLocalUrl() ?? null,
            })
          }
        })
        return {
          running: true as const,
          port: r.port,
          token: r.token,
          lanUrl: r.lanUrl,
          localUrl: r.localUrl,
          remotePath: lanHost.getRemotePagePath(),
        }
      } catch (e) {
        lanHost = null
        throw e
      }
    },
  )

  ipcMain.handle('lanServer:stop', async () => {
    if (lanHost) await lanHost.stop()
    lanHost = null
    return { running: false as const }
  })

  ipcMain.handle('lanServer:status', () => ({
    running: Boolean(lanHost?.isRunning()),
    port: lanHost?.getPort() ?? 0,
    token: lanHost?.isRunning() ? lanHost.getToken() : null,
    lanUrl: lanHost?.isRunning() ? lanHost.getLanUrl() : null,
    localUrl: lanHost?.isRunning() ? lanHost.getLocalUrl() : null,
    remotePath: '/remote.html',
    primaryLanIp: getPrimaryLanIPv4(),
    firewallHint:
      'Se il telefono non si collega, controlla Firewall macOS: consenti connessioni in entrata per REGIA MUSICPRO.',
  }))

  ipcMain.handle('debug:getUpdateCheckSchedule', () => readUpdateCheckSchedule())

  ipcMain.handle('debug:setUpdateCheckSchedule', (_e, raw: unknown) => {
    const schedule = normalizeUpdateCheckSchedule(raw)
    writeUpdateCheckSchedule(schedule)
    applyUpdateCheckRepeatSchedule(schedule)
    return schedule
  })

  ipcMain.handle('debug:getBuildInfo', () => {
    const meta = getPkgMetaForWindowTitle()
    const bi = readMainProcessBuildInfo()
    return {
      isPackaged: app.isPackaged,
      version: meta.version,
      buildHash: bi.buildHash,
      builtAt: bi.builtAt,
    }
  })

  ipcMain.handle(
    'debug:checkForUpdatesNow',
    async (): Promise<
      | { ok: true }
      | { ok: false; reason: string }
    > => {
      if (isDev) {
        return {
          ok: false,
          reason: 'In sviluppo il controllo aggiornamenti non è attivo.',
        }
      }
      try {
        await autoUpdater.checkForUpdates()
        return { ok: true }
      } catch (e) {
        return {
          ok: false,
          reason: e instanceof Error ? e.message : String(e),
        }
      }
    },
  )

  ipcMain.on('playlistFloater:sendAction', (event, msg: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    let sid: string | null = null
    for (const [k, v] of playlistFloaterWindows) {
      if (v === win) {
        sid = k
        break
      }
    }
    if (!sid || !regiaWindow || regiaWindow.isDestroyed()) return
    const m = msg as { method?: string; args?: unknown[] }
    if (typeof m?.method !== 'string') return
    const args = Array.isArray(m.args) ? m.args : []
    regiaWindow.webContents.send('playlist-floater-action', {
      sessionId: sid,
      method: m.method,
      args,
    })
  })
}

/** Aggiornamenti da GitHub Releases (config `publish` in electron-builder.yml). */
function setupAutoUpdater(): void {
  if (isDev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('error', (err) => {
    console.error('[autoUpdater]', err)
  })

  autoUpdater.on('update-downloaded', (info) => {
    // NSIS: `true` = `/S` (nessuna procedura guidata in aggiornamento); `true` = `--force-run` riapre l'app.
    // Può restare un solo prompt UAC di Windows se serve elevazione (non controllabile dall'app).
    const opts = {
      type: 'info' as const,
      title: 'Aggiornamento',
      message: `È pronta la versione ${info.version}.`,
      detail:
        "L'app si chiude, l'installazione avviene in secondo piano e si riapre da sola. Se compare il consenso di Windows (UAC), confermalo una volta.",
      buttons: ['Installa e riapri'],
      defaultId: 0,
    }
    const owner =
      regiaWindow && !regiaWindow.isDestroyed()
        ? regiaWindow
        : BrowserWindow.getFocusedWindow()
    const finished =
      owner && !owner.isDestroyed()
        ? dialog.showMessageBox(owner, opts)
        : dialog.showMessageBox(opts)
    void finished.then(() => {
      setImmediate(() => {
        autoUpdater.quitAndInstall(true, true)
      })
    })
  })

  const schedule = readUpdateCheckSchedule()
  void autoUpdater.checkForUpdates()
  applyUpdateCheckRepeatSchedule(schedule)
}

app.whenReady().then(() => {
  setupIpc()
  /* Regia prima: `ensureOutputIdleCap` scrive su disco prima che l’uscita faccia il primo pull. */
  regiaWindow = createRegiaWindow()
  outputWindow = createOutputWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      regiaWindow = createRegiaWindow()
      outputWindow = createOutputWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  clearUpdateCheckRepeatTimer()
  void lanHost?.stop()
  lanHost = null
})
