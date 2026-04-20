/**
 * Cartella sincronizzata «Regia Video» (Drive desktop): config per profilo,
 * manifest JSON portabile (path relativi POSIX), readiness, export zip.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import type { App } from 'electron'

export const REGIA_VIDEO_DIR_NAME = 'Regia Video'
const PLAYLIST_SUB = 'Playlist'
const CHALKBOARD_SUB = 'Chalkboard'

export type RegiaVideoCloudConfig = {
  /** Path assoluto alla cartella che si chiama esattamente `Regia Video` (o equivalente case-insensitive su Windows). */
  rootPath: string | null
}

export type CloudPlaylistManifestV1 = {
  schemaVersion: 1
  kind: 'regia-video-cloud-playlist'
  savedAt: string
  label: string
  playlistMode: 'tracks' | 'launchpad' | 'chalkboard'
  paths: string[]
  crossfade: boolean
  loopMode: 'off' | 'one' | 'all'
  themeColor: string
  launchPadCells: Array<{
    samplePath: string | null
    padColor: string
    padGain: number
    padDisplayName?: string | null
    padKeyCode?: string | null
    padKeyMode?: 'play' | 'toggle'
  }>
  chalkboardBankPaths: string[]
  chalkboardBackgroundColor: string
  chalkboardPlacementsByBank: Array<
    Array<{ id: string; path: string; x: number; y: number; w: number; h: number }>
  >
  watermarkPngPath: string
  totalDurationSec?: number
}

function configPath(app: App): string {
  return path.join(app.getPath('userData'), 'regia-video-cloud.json')
}

export function readCloudConfig(app: App): RegiaVideoCloudConfig {
  try {
    const raw = fs.readFileSync(configPath(app), 'utf8')
    const j = JSON.parse(raw) as Record<string, unknown>
    const rp = j.rootPath
    if (typeof rp === 'string' && rp.trim()) {
      return { rootPath: path.normalize(rp.trim()) }
    }
  } catch {
    /* assente */
  }
  return { rootPath: null }
}

export function writeCloudConfig(app: App, c: RegiaVideoCloudConfig): void {
  const p = configPath(app)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify({ rootPath: c.rootPath }, null, 2), 'utf8')
}

function basenameEqRegiaVideo(dir: string): boolean {
  const base = path.basename(dir)
  if (process.platform === 'win32') {
    return base.localeCompare(REGIA_VIDEO_DIR_NAME, undefined, {
      sensitivity: 'accent',
    }) === 0
  }
  return base === REGIA_VIDEO_DIR_NAME
}

/** True se `dir` esiste ed è una directory il cui basename è `Regia Video`. */
export function validateRegiaVideoRoot(dir: string): boolean {
  try {
    const n = path.normalize(dir.trim())
    if (!n || !fs.existsSync(n)) return false
    const st = fs.statSync(n)
    if (!st.isDirectory()) return false
    return basenameEqRegiaVideo(n)
  } catch {
    return false
  }
}

export function playlistDirFromRoot(root: string): string {
  return path.join(root, PLAYLIST_SUB)
}

function chalkboardBundleDir(root: string, slug: string): string {
  return path.join(root, CHALKBOARD_SUB, slug)
}

/** Converte path assoluto in relativo POSIX rispetto a `root`; null se fuori root. */
export function toPosixRelUnderRoot(root: string, abs: string): string | null {
  const ra = path.resolve(abs)
  const rr = path.resolve(root)
  let rel = path.relative(rr, ra)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  rel = rel.split(path.sep).join('/')
  return rel || '.'
}

function fromPosixRelToAbs(root: string, rel: string): string {
  const parts = rel.split('/').filter((p) => p && p !== '.')
  return path.join(root, ...parts)
}

function safeFileSlug(label: string): string {
  const t = label
    .trim()
    .replace(/[^\w\u00C0-\u024F]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
  return t || 'playlist'
}

function ensureDir(d: string): void {
  fs.mkdirSync(d, { recursive: true })
}

function copyFileSafe(src: string, dest: string): void {
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
}

export type CloudStatus = {
  configured: boolean
  rootPath: string | null
  rootValid: boolean
  playlistDir: string | null
  playlistDirWritable: boolean
  /** Rapporto spazio libero sul volume di root (0–1), se calcolabile. */
  diskFreeRatio: number | null
}

export function getCloudStatus(app: App): CloudStatus {
  const c = readCloudConfig(app)
  const root = c.rootPath
  if (!root) {
    return {
      configured: false,
      rootPath: null,
      rootValid: false,
      playlistDir: null,
      playlistDirWritable: false,
      diskFreeRatio: null,
    }
  }
  const valid = validateRegiaVideoRoot(root)
  const pd = valid ? playlistDirFromRoot(root) : null
  let writable = false
  let freeRatio: number | null = null
  if (pd) {
    try {
      ensureDir(pd)
      fs.accessSync(pd, fs.constants.R_OK | fs.constants.W_OK)
      writable = true
    } catch {
      writable = false
    }
    try {
      const statfs = (fs as typeof fs & { statfsSync?: (p: string) => { bfree: number; blocks: number } }).statfsSync
      if (typeof statfs === 'function') {
        const stat = statfs(root)
        if (stat && stat.bfree != null && stat.blocks != null && stat.blocks > 0) {
          freeRatio = stat.bfree / stat.blocks
        }
      }
    } catch {
      freeRatio = null
    }
  }
  return {
    configured: true,
    rootPath: root,
    rootValid: valid,
    playlistDir: pd,
    playlistDirWritable: writable,
    diskFreeRatio: freeRatio,
  }
}

export type CloudPlaylistListItem = {
  fileName: string
  label: string
  playlistMode: 'tracks' | 'launchpad' | 'chalkboard'
  savedAt: string
}

export function listCloudPlaylistFiles(app: App): CloudPlaylistListItem[] {
  const st = getCloudStatus(app)
  if (!st.playlistDir || !st.rootValid) return []
  let names: string[] = []
  try {
    names = fs.readdirSync(st.playlistDir)
  } catch {
    return []
  }
  const out: CloudPlaylistListItem[] = []
  for (const fileName of names) {
    if (!fileName.endsWith('.json')) continue
    const fp = path.join(st.playlistDir!, fileName)
    try {
      const raw = fs.readFileSync(fp, 'utf8')
      const j = JSON.parse(raw) as Partial<CloudPlaylistManifestV1>
      if (j.schemaVersion !== 1 || j.kind !== 'regia-video-cloud-playlist') continue
      const mode = j.playlistMode
      if (mode !== 'tracks' && mode !== 'launchpad' && mode !== 'chalkboard')
        continue
      out.push({
        fileName,
        label: typeof j.label === 'string' ? j.label : fileName,
        playlistMode: mode,
        savedAt: typeof j.savedAt === 'string' ? j.savedAt : '',
      })
    } catch {
      /* skip */
    }
  }
  out.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  return out
}

export type ReadinessResult = {
  ok: boolean
  missingFiles: string[]
  warnings: string[]
  diskFreeRatio: number | null
}

function collectMediaPathsFromManifest(m: CloudPlaylistManifestV1): string[] {
  const rels: string[] = []
  for (const p of m.paths) {
    if (p) rels.push(p)
  }
  for (const c of m.launchPadCells) {
    if (c.samplePath) rels.push(c.samplePath)
  }
  for (const p of m.chalkboardBankPaths) {
    if (p) rels.push(p)
  }
  for (const row of m.chalkboardPlacementsByBank) {
    for (const im of row) {
      if (im.path) rels.push(im.path)
    }
  }
  if (m.watermarkPngPath) rels.push(m.watermarkPngPath)
  return [...new Set(rels)]
}

export function readinessForManifest(app: App, m: CloudPlaylistManifestV1): ReadinessResult {
  const warnings: string[] = []
  const missing: string[] = []
  const st = getCloudStatus(app)
  if (!st.rootPath || !st.rootValid) {
    return {
      ok: false,
      missingFiles: ['(radice Regia Video non configurata o non valida)'],
      warnings,
      diskFreeRatio: st.diskFreeRatio,
    }
  }
  const root = st.rootPath
  for (const rel of collectMediaPathsFromManifest(m)) {
    const abs = fromPosixRelToAbs(root, rel)
    try {
      if (!fs.existsSync(abs)) missing.push(rel)
      else {
        const stf = fs.statSync(abs)
        if (!stf.isFile()) missing.push(rel)
      }
    } catch {
      missing.push(rel)
    }
  }
  if (
    st.diskFreeRatio != null &&
    st.diskFreeRatio < 0.05 &&
    st.diskFreeRatio >= 0
  ) {
    warnings.push(
      `Spazio disco sul volume di Regia Video sotto il 5% (${(st.diskFreeRatio * 100).toFixed(1)}% libero).`,
    )
  }
  return {
    ok: missing.length === 0,
    missingFiles: missing,
    warnings,
    diskFreeRatio: st.diskFreeRatio,
  }
}

export function readinessCloudRootOnly(app: App): ReadinessResult {
  const st = getCloudStatus(app)
  const w: string[] = []
  if (!st.rootValid) {
    return {
      ok: false,
      missingFiles: ['(configura la cartella Regia Video nelle impostazioni)'],
      warnings: w,
      diskFreeRatio: st.diskFreeRatio,
    }
  }
  if (
    st.diskFreeRatio != null &&
    st.diskFreeRatio < 0.05 &&
    st.diskFreeRatio >= 0
  ) {
    w.push(
      `Spazio disco sul volume sotto il 5% (${(st.diskFreeRatio * 100).toFixed(1)}% libero).`,
    )
  }
  return { ok: true, missingFiles: [], warnings: w, diskFreeRatio: st.diskFreeRatio }
}

export function loadCloudPlaylistFile(
  app: App,
  fileName: string,
):
  | {
      ok: true
      data: {
        label: string
        paths: string[]
        crossfade: boolean
        loopMode: 'off' | 'one' | 'all'
        themeColor: string
        playlistMode: 'tracks' | 'launchpad' | 'chalkboard'
        launchPadCells: CloudPlaylistManifestV1['launchPadCells']
        chalkboardBankPaths: string[]
        chalkboardBackgroundColor: string
        chalkboardPlacementsByBank: CloudPlaylistManifestV1['chalkboardPlacementsByBank']
        watermarkPngPath: string
      }
    }
  | { ok: false; error: string } {
  const st = getCloudStatus(app)
  if (!st.playlistDir || !st.rootValid) {
    return { ok: false, error: 'Radice Regia Video non valida' }
  }
  const safe = path.basename(fileName)
  if (safe !== fileName || !safe.endsWith('.json')) {
    return { ok: false, error: 'Nome file non valido' }
  }
  const fp = path.join(st.playlistDir!, safe)
  let raw: string
  try {
    raw = fs.readFileSync(fp, 'utf8')
  } catch {
    return { ok: false, error: 'Impossibile leggere il file' }
  }
  let m: CloudPlaylistManifestV1
  try {
    m = JSON.parse(raw) as CloudPlaylistManifestV1
  } catch {
    return { ok: false, error: 'JSON non valido' }
  }
  if (m.schemaVersion !== 1 || m.kind !== 'regia-video-cloud-playlist') {
    return { ok: false, error: 'Manifest cloud non riconosciuto' }
  }
  const root = st.rootPath!
  const abs = (rel: string) => fromPosixRelToAbs(root, rel)
  const paths = (m.paths ?? []).map(abs)
  const rawCells = (m.launchPadCells ?? []).map((c) => ({
    ...c,
    samplePath: c.samplePath ? abs(c.samplePath) : null,
  }))
  const cells = [...rawCells]
  while (cells.length < 16) {
    cells.push({
      samplePath: null,
      padColor: '#444cf7',
      padGain: 1,
      padDisplayName: null,
      padKeyCode: null,
      padKeyMode: 'toggle',
    })
  }
  const cbPaths = (m.chalkboardBankPaths ?? []).map(abs)
  if (m.playlistMode === 'chalkboard' && cbPaths.length < 4) {
    return { ok: false, error: 'Manifest chalkboard incompleto (servono 4 banchi)' }
  }
  const placements = (m.chalkboardPlacementsByBank ?? []).map((row) =>
    row.map((im) => ({
      ...im,
      path: abs(im.path),
    })),
  )
  const wm =
    m.watermarkPngPath && m.watermarkPngPath.length > 0
      ? abs(m.watermarkPngPath)
      : ''
  return {
    ok: true,
    data: {
      label: m.label,
      paths,
      crossfade: Boolean(m.crossfade),
      loopMode: m.loopMode === 'one' || m.loopMode === 'all' ? m.loopMode : 'off',
      themeColor: typeof m.themeColor === 'string' ? m.themeColor : '',
      playlistMode: m.playlistMode,
      launchPadCells: cells,
      chalkboardBankPaths: cbPaths,
      chalkboardBackgroundColor:
        typeof m.chalkboardBackgroundColor === 'string'
          ? m.chalkboardBackgroundColor
          : '#2d3436',
      chalkboardPlacementsByBank: placements,
      watermarkPngPath: wm,
    },
  }
}

export type CloudSavePayload = {
  label: string
  paths: string[]
  crossfade?: boolean
  loopMode?: 'off' | 'one' | 'all'
  themeColor?: string | null
  playlistMode?: 'tracks' | 'launchpad' | 'chalkboard'
  launchPadCells?: CloudPlaylistManifestV1['launchPadCells']
  chalkboardBankPaths?: string[]
  chalkboardBackgroundColor?: string
  chalkboardPlacementsByBank?: CloudPlaylistManifestV1['chalkboardPlacementsByBank']
  watermarkPngPath?: string | null
  totalDurationSec?: number
}

export function saveCloudPlaylist(
  app: App,
  fileBaseName: string,
  payload: CloudSavePayload,
): { ok: true; fileName: string } | { ok: false; error: string; pathsOutsideRoot?: string[] } {
  const st = getCloudStatus(app)
  if (!st.rootPath || !st.rootValid || !st.playlistDirWritable) {
    return { ok: false, error: 'Cartella Regia Video non scrivibile o non configurata' }
  }
  const root = st.rootPath
  const slug = `${safeFileSlug(payload.label)}_${Date.now().toString(36)}`
  const chalkDest = chalkboardBundleDir(root, slug)

  const relForAbs = (abs: string): string | null => {
    if (!abs || !path.isAbsolute(abs)) return null
    const r = toPosixRelUnderRoot(root, abs)
    if (r != null) return r
    return null
  }

  const outside: string[] = []

  const relPaths: string[] = []
  for (const p of payload.paths ?? []) {
    if (!p) continue
    const r = relForAbs(p)
    if (r == null) outside.push(p)
    else relPaths.push(r)
  }

  const cellsOut: CloudPlaylistManifestV1['launchPadCells'] = []
  const cellsIn = payload.launchPadCells ?? []
  for (let i = 0; i < 16; i++) {
    const c = cellsIn[i]
    if (!c) {
      cellsOut.push({
        samplePath: null,
        padColor: '#444cf7',
        padGain: 1,
        padDisplayName: null,
        padKeyCode: null,
        padKeyMode: 'toggle',
      })
      continue
    }
    let sp: string | null = null
    if (c.samplePath) {
      const r = relForAbs(c.samplePath)
      if (r == null) outside.push(c.samplePath)
      else sp = r
    }
    cellsOut.push({
      samplePath: sp,
      padColor: c.padColor,
      padGain: c.padGain,
      padDisplayName: c.padDisplayName ?? null,
      padKeyCode: c.padKeyCode ?? null,
      padKeyMode: c.padKeyMode === 'play' ? 'play' : 'toggle',
    })
  }

  const cbRel: string[] = []
  if (payload.playlistMode === 'chalkboard') {
    const banks = payload.chalkboardBankPaths ?? []
    ensureDir(chalkDest)
    for (let i = 0; i < 4; i++) {
      const src = banks[i]
      if (!src || !fs.existsSync(src)) {
        return { ok: false, error: `Banco chalkboard ${i} mancante` }
      }
      const dest = path.join(chalkDest, `bank-${i}.png`)
      copyFileSafe(src, dest)
      const r = toPosixRelUnderRoot(root, dest)
      if (r) cbRel.push(r)
    }
    for (let i = 0; i < 4; i++) {
      const srcB = banks[i]!
      const draw = srcB.replace(/\.png$/i, '-draw.png')
      if (fs.existsSync(draw)) {
        const destD = path.join(chalkDest, `bank-${i}-draw.png`)
        copyFileSafe(draw, destD)
      }
    }
  }

  let placementsOut: CloudPlaylistManifestV1['chalkboardPlacementsByBank'] =
    Array.from({ length: 4 }, () => [])
  if (
    payload.playlistMode === 'chalkboard' &&
    payload.chalkboardPlacementsByBank
  ) {
    placementsOut = payload.chalkboardPlacementsByBank.map((row, bi) =>
      row.map((im, ii) => {
        const src = im.path
        if (!path.isAbsolute(src)) {
          return { ...im, path: im.path }
        }
        const r = relForAbs(src)
        if (r != null) return { ...im, path: r }
        const ext = path.extname(src) || '.png'
        const dest = path.join(
          chalkDest,
          `placed-${bi}-${ii}-${im.id}${ext}`,
        )
        try {
          copyFileSafe(src, dest)
        } catch {
          outside.push(src)
          return { ...im, path: im.path }
        }
        const nr = toPosixRelUnderRoot(root, dest)
        return { ...im, path: nr ?? im.path }
      }),
    )
  }

  let wmRel = ''
  const wm = payload.watermarkPngPath?.trim()
  if (wm) {
    if (!fs.existsSync(wm)) {
      return { ok: false, error: 'Watermark PNG non trovato' }
    }
    const wr = relForAbs(wm)
    if (wr != null) {
      wmRel = wr
    } else {
      const assetDir =
        payload.playlistMode === 'chalkboard'
          ? chalkDest
          : path.join(st.playlistDir!, '_regia_assets', slug)
      ensureDir(assetDir)
      const dest = path.join(assetDir, 'watermark.png')
      copyFileSafe(wm, dest)
      const nr = toPosixRelUnderRoot(root, dest)
      if (!nr) {
        return { ok: false, error: 'Impossibile includere il watermark nel bundle' }
      }
      wmRel = nr
    }
  }

  if (outside.length > 0) {
    return {
      ok: false,
      error:
        'Alcuni file non sono sotto la cartella Regia Video. Spostali in Musica/Suoni/… o salva dopo averli copiati in Regia Video.',
      pathsOutsideRoot: outside,
    }
  }

  const manifest: CloudPlaylistManifestV1 = {
    schemaVersion: 1,
    kind: 'regia-video-cloud-playlist',
    savedAt: new Date().toISOString(),
    label: payload.label.trim().slice(0, 120) || 'Senza titolo',
    playlistMode: payload.playlistMode ?? 'tracks',
    paths: payload.playlistMode === 'tracks' ? relPaths : [],
    crossfade: Boolean(payload.crossfade),
    loopMode:
      payload.loopMode === 'one' || payload.loopMode === 'all'
        ? payload.loopMode
        : 'off',
    themeColor:
      typeof payload.themeColor === 'string' ? payload.themeColor : '',
    launchPadCells: cellsOut,
    chalkboardBankPaths:
      payload.playlistMode === 'chalkboard' ? cbRel : [],
    chalkboardBackgroundColor:
      typeof payload.chalkboardBackgroundColor === 'string'
        ? payload.chalkboardBackgroundColor
        : '#2d3436',
    chalkboardPlacementsByBank:
      payload.playlistMode === 'chalkboard' ? placementsOut : [[], [], [], []],
    watermarkPngPath: wmRel,
  }
  if (typeof payload.totalDurationSec === 'number') {
    manifest.totalDurationSec = payload.totalDurationSec
  }

  const safeName = path.basename(fileBaseName)
  if (!safeName.endsWith('.json') || safeName !== fileBaseName) {
    return { ok: false, error: 'Nome file non valido' }
  }
  const outPath = path.join(st.playlistDir!, safeName)
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8')
  return { ok: true, fileName: safeName }
}

/** Nome file suggerito in `Playlist` con data (versioning). */
export function suggestCloudPlaylistFileName(label: string): string {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${safeFileSlug(label)}_${y}-${mo}-${da}.json`
}

export function exportCloudZip(
  app: App,
  fileName: string,
  destZipAbs: string,
): { ok: true } | { ok: false; error: string } {
  const st = getCloudStatus(app)
  if (!st.playlistDir || !st.rootPath) {
    return { ok: false, error: 'Regia Video non configurato' }
  }
  const safe = path.basename(fileName)
  if (safe !== fileName || !safe.endsWith('.json')) {
    return { ok: false, error: 'Nome file non valido' }
  }
  const manifestPath = path.join(st.playlistDir, safe)
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, error: 'Manifest non trovato' }
  }
  let m: CloudPlaylistManifestV1
  try {
    m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as CloudPlaylistManifestV1
  } catch {
    return { ok: false, error: 'Lettura manifest fallita' }
  }
  const rd = readinessForManifest(app, m)
  if (!rd.ok) {
    return {
      ok: false,
      error: `Readiness fallita: mancano ${rd.missingFiles.length} file`,
    }
  }
  const root = st.rootPath
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'regia-zip-'))
  const exportRoot = path.join(tmpDir, 'RegiaVideoExport')
  try {
    ensureDir(path.join(exportRoot, PLAYLIST_SUB))
    fs.copyFileSync(manifestPath, path.join(exportRoot, PLAYLIST_SUB, safe))
    for (const rel of collectMediaPathsFromManifest(m)) {
      const parts = rel.split('/').filter(Boolean)
      if (parts.length === 0) continue
      const abs = fromPosixRelToAbs(root, rel)
      if (!fs.existsSync(abs)) continue
      const dest = path.join(exportRoot, ...parts)
      copyFileSafe(abs, dest)
    }
    if (process.platform === 'win32') {
      const esc = (s: string) => s.replace(/'/g, "''")
      const ps = `Compress-Archive -LiteralPath '${esc(exportRoot)}' -DestinationPath '${esc(destZipAbs)}' -Force`
      const r = spawnSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', ps],
        { encoding: 'utf8' },
      )
      if (r.status !== 0) {
        return { ok: false, error: r.stderr || 'Compress-Archive fallito' }
      }
    } else {
      const r = spawnSync('zip', ['-rq', destZipAbs, 'RegiaVideoExport'], {
        cwd: tmpDir,
        encoding: 'utf8',
      })
      if (r.status !== 0) {
        return {
          ok: false,
          error: r.error?.message || r.stderr || 'zip fallito (installare zip)',
        }
      }
    }
    return { ok: true }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}
