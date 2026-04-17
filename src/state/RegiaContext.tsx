/* eslint-disable react-refresh/only-export-components -- hook co-located with provider */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { normalizePlaylistThemeColor } from '../lib/playlistThemeColor.ts'
import type { SavedPlaylistMeta } from '../playlistTypes.ts'
import {
  type FloatingPlaylistPanelSize,
  type FloatingPlaylistPos,
  type FloatingPlaylistSession,
  createEmptyFloatingSession,
} from './floatingPlaylistSession.ts'

export type LoopMode = 'off' | 'one' | 'all'

export type RegiaContextValue = {
  paths: string[]
  currentIndex: number
  loopMode: LoopMode
  muted: boolean
  /** Volume lineare 0–1 per l’audio dei video in uscita (indipendente dal mute). */
  outputVolume: number
  setOutputVolume: (v: number) => void
  /** deviceId Chromium per setSinkId; stringa vuota = predefinito. */
  outputSinkId: string
  setOutputSinkId: (sinkId: string) => void
  playing: boolean
  previewSrc: string | null
  previewSyncKey: number
  /** Finestra uscita visibile sul secondo schermo; se false la finestra è nascosta (monitor “libero”). */
  secondScreenOn: boolean
  savedPlaylists: SavedPlaylistMeta[]
  openFolder: (sessionId: string) => Promise<void>
  /** Aggiunge file alla playlist del pannello indicato. */
  addMediaToPlaylist: (sessionId: string) => Promise<void>
  /** Rimuove un brano dall’elenco del pannello indicato. */
  removePathAt: (index: number, sessionId: string) => Promise<void>
  refreshSavedPlaylists: () => Promise<void>
  saveCurrentPlaylist: (label: string) => Promise<void>
  loadSavedPlaylist: (id: string) => Promise<void>
  deleteSavedPlaylist: (id: string) => Promise<void>
  /** Crea una nuova playlist salvata copiando percorsi, nome (con suffisso) e crossfade. */
  duplicateSavedPlaylist: (id: string) => Promise<void>
  loadIndexAndPlay: (index: number, sessionId?: string) => Promise<void>
  togglePlay: () => Promise<void>
  setLoopMode: (m: LoopMode) => void
  setMuted: (m: boolean) => void
  toggleSecondScreen: () => void
  goNext: () => Promise<void>
  goPrev: () => Promise<void>
  selectItem: (index: number, sessionId: string) => void
  reorderPaths: (
    fromIndex: number,
    toIndex: number,
    sessionId: string,
  ) => void
  /** Titolo mostrato nella playlist mobile (sessione corrente). */
  playlistTitle: string
  setPlaylistTitle: (title: string, sessionId: string) => void
  /** Colore tema pannello (#rrggbb) o null per predefinito. */
  setPlaylistThemeColor: (hex: string | null, sessionId: string) => void
  /** Dissolvenza incrociata in uscita tra brani dello stesso tipo (video/immagine). */
  playlistCrossfade: boolean
  setPlaylistCrossfade: (enabled: boolean, sessionId: string) => void
  /** Mute uscita solo per questa playlist floating (memorizzato sul pannello). */
  setPlaylistOutputMuted: (enabled: boolean, sessionId: string) => void
  /** Playlist mobile (floating) visibile nella finestra regia. */
  floatingPlaylistOpen: boolean
  /** Pannelli floating (ognuno con propria lista). */
  floatingPlaylistSessions: FloatingPlaylistSession[]
  activeFloatingSessionId: string
  setActiveFloatingSession: (id: string) => void
  addFloatingPlaylist: () => void
  removeFloatingPlaylist: (id: string) => void
  closeFloatingPlaylist: (sessionId: string) => void
  openFloatingPlaylist: () => void
  /** Nasconde i pannelli floating senza eliminare le sessioni. */
  hideFloatingPlaylistPanels: () => void
  updateFloatingPlaylistChrome: (
    sessionId: string,
    patch: {
      pos?: FloatingPlaylistPos
      collapsed?: boolean
      panelSize?: FloatingPlaylistPanelSize
      playlistOutputMuted?: boolean
    },
  ) => void
  /** True se la playlist del pannello è una salvata modificata. */
  savedPlaylistDirty: (sessionId: string) => boolean
  /** Salva sovrascrivendo la playlist salvata associata a quel pannello. */
  saveLoadedPlaylistOverwrite: (sessionId: string) => Promise<void>
  /** Dopo commit titolo (blur/Invio): se la sessione modifica una playlist salvata, salva su disco se titolo, elenco o crossfade sono cambiati. */
  persistSavedPlaylistAfterFloatingTitleBlur: (
    trimmedTitle: string,
    sessionId: string,
  ) => Promise<void>
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  /** Cattura uno stato annullabile (es. prima di commit titolo da blur). */
  recordUndoPoint: () => void
  /** Brano caricato in anteprima/uscita: una sola riga evidenziabile tra più pannelli. */
  playbackLoadedTrack: { sessionId: string; index: number } | null
}

const LS_FLOATING_VISIBLE = 'regia-floating-playlist-visible'
const LS_OUTPUT_VOLUME = 'regia-output-volume'
const LS_OUTPUT_SINK = 'regia-output-sink-id'

function readInitialOutputVolume(): number {
  try {
    const v = parseFloat(localStorage.getItem(LS_OUTPUT_VOLUME) ?? '1')
    if (!Number.isFinite(v)) return 1
    return Math.min(1, Math.max(0, v))
  } catch {
    return 1
  }
}

function readInitialOutputSinkId(): string {
  try {
    return localStorage.getItem(LS_OUTPUT_SINK) ?? ''
  } catch {
    return ''
  }
}

/** Cartella comune del primo file (nome cartella) per titolo di default. */
function folderBasenameFromPaths(paths: string[]): string {
  if (!paths.length) return ''
  const first = paths[0].replace(/\\/g, '/')
  const lastSlash = first.lastIndexOf('/')
  if (lastSlash <= 0) return 'Playlist'
  const dir = first.slice(0, lastSlash)
  const parentSlash = dir.lastIndexOf('/')
  const base = parentSlash >= 0 ? dir.slice(parentSlash + 1) : dir
  return base.trim() || 'Playlist'
}

function readFloatingPlaylistVisible(): boolean {
  try {
    return localStorage.getItem(LS_FLOATING_VISIBLE) !== 'false'
  } catch {
    return true
  }
}

function pathsEqual(a: string[], b: string[] | null): boolean {
  if (!b || a.length !== b.length) return false
  return a.every((p, i) => p === b[i])
}

const MAX_UNDO = 50

type RegiaHistorySnapshot = {
  floatingSessions: FloatingPlaylistSession[]
  activeFloatingSessionId: string
  playbackSessionId: string | null
  previewSrc: string | null
  previewSyncKey: number
  playing: boolean
  loadedIndex: number | null
}

function deepCloneFloatingSessions(
  sessions: FloatingPlaylistSession[],
): FloatingPlaylistSession[] {
  return sessions.map((s) => ({
    ...s,
    paths: [...s.paths],
    playlistOutputMuted: s.playlistOutputMuted ?? false,
    savedEditPathsBaseline: s.savedEditPathsBaseline
      ? [...s.savedEditPathsBaseline]
      : null,
  }))
}

const RegiaContext = createContext<RegiaContextValue | null>(null)

export function RegiaProvider({ children }: { children: ReactNode }) {
  const [floatingSessions, setFloatingSessions] = useState<
    FloatingPlaylistSession[]
  >(() => [createEmptyFloatingSession()])
  const [activeFloatingSessionId, setActiveFloatingSessionId] = useState('')
  /** Sessione la cui playlist comanda trasporto / uscita dopo un load. */
  const [playbackSessionId, setPlaybackSessionId] = useState<string | null>(
    null,
  )
  const [loopMode, setLoopModeState] = useState<LoopMode>('off')
  const [muted, setMutedState] = useState(false)
  const [outputVolume, setOutputVolumeState] = useState(readInitialOutputVolume)
  const [outputSinkId, setOutputSinkIdState] = useState(readInitialOutputSinkId)
  const [playing, setPlaying] = useState(false)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewSyncKey, setPreviewSyncKey] = useState(0)
  const [secondScreenOn, setSecondScreenOn] = useState(false)
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylistMeta[]>([])
  const [floatingPlaylistOpen, setFloatingPlaylistOpen] = useState(
    readFloatingPlaylistVisible,
  )
  const [playbackLoadedTrack, setPlaybackLoadedTrack] = useState<{
    sessionId: string
    index: number
  } | null>(null)

  const activeFloatingSessionIdRef = useRef(activeFloatingSessionId)
  useLayoutEffect(() => {
    activeFloatingSessionIdRef.current = activeFloatingSessionId
  }, [activeFloatingSessionId])

  const playbackSessionIdStateRef = useRef(playbackSessionId)
  useLayoutEffect(() => {
    playbackSessionIdStateRef.current = playbackSessionId
  }, [playbackSessionId])

  const previewSrcRef = useRef(previewSrc)
  const previewSyncKeyRef = useRef(previewSyncKey)
  const playingRefForHistory = useRef(playing)
  useLayoutEffect(() => {
    previewSrcRef.current = previewSrc
    previewSyncKeyRef.current = previewSyncKey
    playingRefForHistory.current = playing
  }, [previewSrc, previewSyncKey, playing])

  const undoStackRef = useRef<RegiaHistorySnapshot[]>([])
  const redoStackRef = useRef<RegiaHistorySnapshot[]>([])
  const isApplyingHistoryRef = useRef(false)
  const [historyRev, setHistoryRev] = useState(0)

  const resolvedActiveId =
    floatingSessions.some((s) => s.id === activeFloatingSessionId)
      ? activeFloatingSessionId
      : (floatingSessions[0]?.id ?? '')

  const resolvedPlaybackId =
    playbackSessionId &&
    floatingSessions.some((s) => s.id === playbackSessionId)
      ? playbackSessionId
      : resolvedActiveId

  const resolvedPlaybackIdRef = useRef(resolvedPlaybackId)
  useLayoutEffect(() => {
    resolvedPlaybackIdRef.current = resolvedPlaybackId
  }, [resolvedPlaybackId])

  useEffect(() => {
    setActiveFloatingSessionId((cur) =>
      cur && floatingSessions.some((s) => s.id === cur)
        ? cur
        : (floatingSessions[0]?.id ?? ''),
    )
  }, [floatingSessions])

  useEffect(() => {
    setPlaybackSessionId((cur) =>
      cur && floatingSessions.some((s) => s.id === cur)
        ? cur
        : (floatingSessions[0]?.id ?? null),
    )
  }, [floatingSessions])

  const activeSession = useMemo((): FloatingPlaylistSession | null => {
    return (
      floatingSessions.find((s) => s.id === resolvedActiveId) ??
      floatingSessions[0] ??
      null
    )
  }, [floatingSessions, resolvedActiveId])

  const playbackSession = useMemo((): FloatingPlaylistSession | null => {
    return (
      floatingSessions.find((s) => s.id === resolvedPlaybackId) ??
      floatingSessions[0] ??
      null
    )
  }, [floatingSessions, resolvedPlaybackId])

  /** Elenco della sessione attiva (sidebar «Salva», ecc.). */
  const paths = activeSession?.paths ?? []
  const currentIndex = activeSession?.currentIndex ?? 0
  const playlistTitle = activeSession?.playlistTitle ?? ''
  const playlistCrossfade = activeSession?.playlistCrossfade ?? false

  const floatingSessionsRef = useRef(floatingSessions)
  useLayoutEffect(() => {
    floatingSessionsRef.current = floatingSessions
  }, [floatingSessions])

  const patchFloatingSession = useCallback(
    (
      id: string,
      patch:
        | Partial<FloatingPlaylistSession>
        | ((s: FloatingPlaylistSession) => FloatingPlaylistSession),
    ) => {
      setFloatingSessions((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s
          return typeof patch === 'function' ? patch(s) : { ...s, ...patch }
        }),
      )
    },
    [],
  )

  const pathsRef = useRef(paths)
  const currentIndexRef = useRef(currentIndex)
  const loopModeRef = useRef(loopMode)
  const loadedIndexRef = useRef<number | null>(null)
  const secondScreenOnRef = useRef(secondScreenOn)
  const outputVolumeRef = useRef(outputVolume)
  const outputSinkIdRef = useRef(outputSinkId)
  useLayoutEffect(() => {
    outputVolumeRef.current = outputVolume
  }, [outputVolume])
  useLayoutEffect(() => {
    outputSinkIdRef.current = outputSinkId
  }, [outputSinkId])

  useLayoutEffect(() => {
    pathsRef.current = playbackSession?.paths ?? []
    currentIndexRef.current = playbackSession?.currentIndex ?? 0
    loopModeRef.current = loopMode
    secondScreenOnRef.current = secondScreenOn
  }, [playbackSession, loopMode, secondScreenOn])

  const send = useCallback(
    (cmd: Parameters<typeof window.electronAPI.sendPlayback>[0]) =>
      window.electronAPI.sendPlayback(cmd),
    [],
  )

  const takeHistorySnapshot = useCallback((): RegiaHistorySnapshot => {
    return {
      floatingSessions: deepCloneFloatingSessions(floatingSessionsRef.current),
      activeFloatingSessionId: activeFloatingSessionIdRef.current,
      playbackSessionId: playbackSessionIdStateRef.current,
      previewSrc: previewSrcRef.current,
      previewSyncKey: previewSyncKeyRef.current,
      playing: playingRefForHistory.current,
      loadedIndex: loadedIndexRef.current,
    }
  }, [])

  const bumpHistory = useCallback(() => {
    setHistoryRev((n) => n + 1)
  }, [])

  const recordUndoPoint = useCallback(() => {
    if (isApplyingHistoryRef.current) return
    undoStackRef.current.push(takeHistorySnapshot())
    redoStackRef.current = []
    if (undoStackRef.current.length > MAX_UNDO) {
      undoStackRef.current.shift()
    }
    bumpHistory()
  }, [takeHistorySnapshot, bumpHistory])

  const applyHistorySnapshot = useCallback((snap: RegiaHistorySnapshot) => {
    isApplyingHistoryRef.current = true
    const fs = deepCloneFloatingSessions(snap.floatingSessions)
    setFloatingSessions(fs)
    if (fs.length === 0) {
      setFloatingPlaylistOpen(false)
      try {
        localStorage.setItem(LS_FLOATING_VISIBLE, 'false')
      } catch {
        /* ignore */
      }
    }
    setActiveFloatingSessionId(snap.activeFloatingSessionId)
    setPlaybackSessionId(snap.playbackSessionId)
    setPreviewSrc(snap.previewSrc)
    setPreviewSyncKey(snap.previewSyncKey)
    setPlaying(snap.playing)
    loadedIndexRef.current = snap.loadedIndex
    const li = snap.loadedIndex
    const pb = snap.playbackSessionId
    const pbSession = fs.find((s) => s.id === pb)
    if (
      li != null &&
      pb &&
      pbSession &&
      li >= 0 &&
      li < pbSession.paths.length
    ) {
      setPlaybackLoadedTrack({ sessionId: pb, index: li })
    } else {
      setPlaybackLoadedTrack(null)
    }
    isApplyingHistoryRef.current = false
  }, [])

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    const target = undoStackRef.current.pop()!
    redoStackRef.current.push(takeHistorySnapshot())
    applyHistorySnapshot(target)
    bumpHistory()
  }, [takeHistorySnapshot, applyHistorySnapshot, bumpHistory])

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return
    const target = redoStackRef.current.pop()!
    undoStackRef.current.push(takeHistorySnapshot())
    applyHistorySnapshot(target)
    bumpHistory()
  }, [takeHistorySnapshot, applyHistorySnapshot, bumpHistory])

  const applyPathsList = useCallback(
    async (
      list: string[],
      sessionId: string,
      opts?: { skipHistory?: boolean },
    ) => {
      if (!list.length) return
      if (!opts?.skipHistory) {
        recordUndoPoint()
      }
      patchFloatingSession(sessionId, {
        paths: list,
        currentIndex: 0,
        editingSavedPlaylistId: null,
        savedEditPathsBaseline: null,
        savedEditTitleBaseline: '',
        savedEditCrossfadeBaseline: false,
        savedEditThemeColorBaseline: '',
        playlistCrossfade: true,
      })
      setPlaybackSessionId(sessionId)
      setActiveFloatingSessionId(sessionId)
      setPreviewSrc(null)
      setPreviewSyncKey(0)
      setPlaying(false)
      loadedIndexRef.current = null
      setPlaybackLoadedTrack(null)
      await send({ type: 'pause' })
    },
    [patchFloatingSession, recordUndoPoint, send],
  )

  const refreshSavedPlaylists = useCallback(async () => {
    const list = await window.electronAPI.playlistsList()
    setSavedPlaylists(list)
  }, [])

  const hideFloatingPlaylistPanels = useCallback(() => {
    setFloatingPlaylistOpen(false)
    try {
      localStorage.setItem(LS_FLOATING_VISIBLE, 'false')
    } catch {
      /* ignore */
    }
  }, [])

  const openFloatingPlaylist = useCallback(() => {
    setFloatingPlaylistOpen(true)
    try {
      localStorage.setItem(LS_FLOATING_VISIBLE, 'true')
    } catch {
      /* ignore */
    }
    setFloatingSessions((prev) => {
      if (prev.length > 0) return prev
      const s = createEmptyFloatingSession()
      setActiveFloatingSessionId(s.id)
      return [s]
    })
  }, [])

  const removeFloatingPlaylist = useCallback(
    (id: string) => {
      recordUndoPoint()
      setPlaybackLoadedTrack((h) => (h?.sessionId === id ? null : h))
      const prev = floatingSessionsRef.current
      const next = prev.filter((s) => s.id !== id)
      setFloatingSessions(next)
      if (next.length === 0) {
        hideFloatingPlaylistPanels()
      }
    },
    [recordUndoPoint, hideFloatingPlaylistPanels],
  )

  const closeFloatingPlaylist = useCallback(
    (sessionId: string) => {
      removeFloatingPlaylist(sessionId)
    },
    [removeFloatingPlaylist],
  )

  const updateFloatingPlaylistChrome = useCallback(
    (
      sessionId: string,
      patch: {
        pos?: FloatingPlaylistPos
        collapsed?: boolean
        panelSize?: FloatingPlaylistPanelSize
        playlistOutputMuted?: boolean
      },
    ) => {
      patchFloatingSession(sessionId, patch)
    },
    [patchFloatingSession],
  )

  const setActiveFloatingSession = useCallback((id: string) => {
    setActiveFloatingSessionId(id)
  }, [])

  const addFloatingPlaylist = useCallback(() => {
    recordUndoPoint()
    setFloatingSessions((prev) => {
      const last = prev[prev.length - 1]
      const pos = last
        ? { x: last.pos.x + 28, y: last.pos.y + 28 }
        : { x: 24, y: 96 }
      const s = createEmptyFloatingSession(pos)
      setActiveFloatingSessionId(s.id)
      return [...prev, s]
    })
  }, [recordUndoPoint])

  const setPlaylistTitle = useCallback((title: string, sessionId: string) => {
    patchFloatingSession(sessionId, {
      playlistTitle: title.slice(0, 120),
    })
  }, [patchFloatingSession])

  const setPlaylistCrossfade = useCallback(
    (enabled: boolean, sessionId: string) => {
      recordUndoPoint()
      patchFloatingSession(sessionId, { playlistCrossfade: enabled })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const setPlaylistThemeColor = useCallback(
    (hex: string | null, sessionId: string) => {
      const next =
        hex == null || hex === ''
          ? ''
          : normalizePlaylistThemeColor(hex)
      patchFloatingSession(sessionId, {
        playlistThemeColor: next,
      })
    },
    [patchFloatingSession],
  )

  const setPlaylistOutputMuted = useCallback(
    (enabled: boolean, sessionId: string) => {
      recordUndoPoint()
      patchFloatingSession(sessionId, { playlistOutputMuted: enabled })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const playbackCrossfade = playbackSession?.playlistCrossfade ?? false
  useEffect(() => {
    void send({ type: 'setCrossfade', enabled: playbackCrossfade })
  }, [playbackCrossfade, send])

  const savedPlaylistDirty = useCallback(
    (sessionId: string) => {
      const s = floatingSessions.find((x) => x.id === sessionId)
      if (!s || s.editingSavedPlaylistId == null || s.savedEditPathsBaseline == null)
        return false
      if (!pathsEqual(s.paths, s.savedEditPathsBaseline)) return true
      if (s.playlistTitle.trim() !== s.savedEditTitleBaseline.trim()) return true
      if (s.playlistCrossfade !== s.savedEditCrossfadeBaseline) return true
      return (
        normalizePlaylistThemeColor(s.playlistThemeColor ?? '') !==
        normalizePlaylistThemeColor(s.savedEditThemeColorBaseline ?? '')
      )
    },
    [floatingSessions],
  )

  const saveLoadedPlaylistOverwrite = useCallback(
    async (sessionId: string) => {
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s || s.editingSavedPlaylistId == null || s.savedEditPathsBaseline == null)
        return
      const id = s.editingSavedPlaylistId
      const list = s.paths
      const label = s.playlistTitle.trim() || 'Senza titolo'
      const themeCur = normalizePlaylistThemeColor(s.playlistThemeColor ?? '')
      const themeBase = normalizePlaylistThemeColor(
        s.savedEditThemeColorBaseline ?? '',
      )
      if (
        pathsEqual(list, s.savedEditPathsBaseline) &&
        label.trim() === s.savedEditTitleBaseline.trim() &&
        s.playlistCrossfade === s.savedEditCrossfadeBaseline &&
        themeCur === themeBase
      )
        return
      recordUndoPoint()
      await window.electronAPI.playlistsSave({
        id,
        label,
        paths: list,
        crossfade: s.playlistCrossfade,
        themeColor: themeCur === '' ? null : themeCur,
      })
      await refreshSavedPlaylists()
      patchFloatingSession(sessionId, {
        savedEditPathsBaseline: [...list],
        savedEditTitleBaseline: label.trim(),
        savedEditCrossfadeBaseline: s.playlistCrossfade,
        savedEditThemeColorBaseline: themeCur,
      })
    },
    [patchFloatingSession, recordUndoPoint, refreshSavedPlaylists],
  )

  const persistSavedPlaylistAfterFloatingTitleBlur = useCallback(
    async (trimmedTitle: string, sessionId: string) => {
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s || s.editingSavedPlaylistId == null || s.savedEditPathsBaseline == null)
        return
      const id = s.editingSavedPlaylistId
      const label = trimmedTitle.trim().slice(0, 120) || 'Senza titolo'
      const titleDirty =
        label.trim() !== s.savedEditTitleBaseline.trim()
      const pathsDirty = !pathsEqual(s.paths, s.savedEditPathsBaseline)
      const crossfadeDirty =
        s.playlistCrossfade !== s.savedEditCrossfadeBaseline
      const themeCur = normalizePlaylistThemeColor(s.playlistThemeColor ?? '')
      const themeBase = normalizePlaylistThemeColor(
        s.savedEditThemeColorBaseline ?? '',
      )
      const themeDirty = themeCur !== themeBase
      if (!titleDirty && !pathsDirty && !crossfadeDirty && !themeDirty) return
      const list = s.paths
      await window.electronAPI.playlistsSave({
        id,
        label,
        paths: list,
        crossfade: s.playlistCrossfade,
        themeColor: themeCur === '' ? null : themeCur,
      })
      await refreshSavedPlaylists()
      patchFloatingSession(sessionId, {
        savedEditPathsBaseline: [...list],
        savedEditTitleBaseline: label.trim(),
        savedEditCrossfadeBaseline: s.playlistCrossfade,
        savedEditThemeColorBaseline: themeCur,
      })
    },
    [patchFloatingSession, refreshSavedPlaylists],
  )

  const saveCurrentPlaylist = useCallback(
    async (label: string) => {
      const id = resolvedActiveId
      const s = floatingSessionsRef.current.find((x) => x.id === id)
      const list = s?.paths ?? []
      if (!list.length) return
      const themeCur = normalizePlaylistThemeColor(s?.playlistThemeColor ?? '')
      await window.electronAPI.playlistsSave({
        label,
        paths: list,
        crossfade: s?.playlistCrossfade ?? false,
        themeColor: themeCur === '' ? null : themeCur,
      })
      await refreshSavedPlaylists()
    },
    [resolvedActiveId, refreshSavedPlaylists],
  )

  const loadSavedPlaylist = useCallback(
    async (id: string) => {
      const data = await window.electronAPI.playlistsLoad(id)
      if (!data?.paths?.length) return
      recordUndoPoint()
      const prev = floatingSessionsRef.current
      const last = prev[prev.length - 1]
      const pos = last
        ? { x: last.pos.x + 28, y: last.pos.y + 28 }
        : { x: 24, y: 96 }
      const label = data.label.trim() || 'Senza titolo'
      const loadedTheme = normalizePlaylistThemeColor(data.themeColor)
      const newS: FloatingPlaylistSession = {
        ...createEmptyFloatingSession(pos),
        paths: data.paths,
        currentIndex: 0,
        playlistTitle: label,
        editingSavedPlaylistId: id,
        savedEditPathsBaseline: [...data.paths],
        savedEditTitleBaseline: label.trim(),
        savedEditCrossfadeBaseline: data.crossfade,
        savedEditThemeColorBaseline: loadedTheme,
        playlistCrossfade: data.crossfade,
        playlistThemeColor: loadedTheme,
      }
      setFloatingSessions((p) => [...p, newS])
      setActiveFloatingSessionId(newS.id)
      setPlaybackSessionId(newS.id)
      setPreviewSrc(null)
      setPreviewSyncKey(0)
      setPlaying(false)
      loadedIndexRef.current = null
      setPlaybackLoadedTrack(null)
      await send({ type: 'pause' })
      openFloatingPlaylist()
    },
    [recordUndoPoint, send, openFloatingPlaylist],
  )

  const deleteSavedPlaylist = useCallback(
    async (id: string) => {
      await window.electronAPI.playlistsDelete(id)
      await refreshSavedPlaylists()
      setFloatingSessions((prev) =>
        prev.map((s) =>
          s.editingSavedPlaylistId === id
            ? {
                ...s,
                editingSavedPlaylistId: null,
                savedEditPathsBaseline: null,
                savedEditTitleBaseline: '',
                savedEditCrossfadeBaseline: false,
                savedEditThemeColorBaseline: '',
              }
            : s,
        ),
      )
    },
    [refreshSavedPlaylists],
  )

  const duplicateSavedPlaylist = useCallback(
    async (id: string) => {
      const r = await window.electronAPI.playlistsDuplicate(id)
      if (!r?.id) return
      await refreshSavedPlaylists()
    },
    [refreshSavedPlaylists],
  )

  const loadIndexAndPlay = useCallback(
    async (index: number, sessionId?: string) => {
      const fallbackPlaybackId =
        resolvedPlaybackIdRef.current ||
        floatingSessionsRef.current[0]?.id ||
        ''
      const sid = sessionId ?? fallbackPlaybackId
      if (!sid) return
      const sess = floatingSessionsRef.current.find((x) => x.id === sid)
      const list = sess?.paths ?? []
      if (list.length === 0 || index < 0 || index >= list.length) return
      const playlistMuted = Boolean(sess?.playlistOutputMuted)
      patchFloatingSession(sid, { currentIndex: index })
      setPlaybackSessionId(sid)
      setActiveFloatingSessionId(sid)
      const p = list[index]
      const url = await window.electronAPI.toFileUrl(p)
      setPreviewSrc(url)
      setPreviewSyncKey((k) => k + 1)
      const mode = loopModeRef.current
      const effectiveMuted = muted || playlistMuted
      const crossfadeForLoad = Boolean(sess?.playlistCrossfade)
      await send({
        type: 'load',
        src: p,
        crossfade: crossfadeForLoad,
      })
      await send({ type: 'setLoopOne', loop: mode === 'one' })
      await send({ type: 'setMuted', muted: effectiveMuted })
      await send({ type: 'setVolume', volume: outputVolumeRef.current })
      await send({ type: 'setSinkId', sinkId: outputSinkIdRef.current })
      if (secondScreenOnRef.current) {
        await send({ type: 'play' })
      } else {
        await send({ type: 'pause' })
      }
      loadedIndexRef.current = index
      setPlaybackLoadedTrack({ sessionId: sid, index })
      setPlaying(true)
    },
    [muted, send, patchFloatingSession],
  )

  const loadIndexAndPlayRef = useRef(loadIndexAndPlay)
  useLayoutEffect(() => {
    loadIndexAndPlayRef.current = loadIndexAndPlay
  }, [loadIndexAndPlay])

  const togglePlay = useCallback(async () => {
    const list = pathsRef.current
    if (list.length === 0) return
    if (playing) {
      await send({ type: 'pause' })
      setPlaying(false)
      return
    }
    const idx = currentIndexRef.current
    const p = list[idx]
    if (!p) return
    if (loadedIndexRef.current === idx) {
      const pb = resolvedPlaybackIdRef.current
      const sm =
        floatingSessionsRef.current.find((x) => x.id === pb)
          ?.playlistOutputMuted ?? false
      await send({ type: 'setMuted', muted: muted || sm })
      await send({ type: 'setVolume', volume: outputVolumeRef.current })
      await send({ type: 'setSinkId', sinkId: outputSinkIdRef.current })
      if (secondScreenOnRef.current) {
        await send({ type: 'play' })
      } else {
        await send({ type: 'pause' })
      }
      setPlaying(true)
      return
    }
    await loadIndexAndPlay(idx)
  }, [muted, playing, send, loadIndexAndPlay])

  const goNext = useCallback(async () => {
    const list = pathsRef.current
    if (list.length === 0) return
    const idx = currentIndexRef.current
    const mode = loopModeRef.current
    if (idx < list.length - 1) {
      await loadIndexAndPlayRef.current(idx + 1)
    } else if (mode === 'all') {
      await loadIndexAndPlayRef.current(0)
    }
  }, [])

  const goPrev = useCallback(async () => {
    const list = pathsRef.current
    if (list.length === 0) return
    const idx = currentIndexRef.current
    const mode = loopModeRef.current
    if (idx > 0) {
      await loadIndexAndPlayRef.current(idx - 1)
    } else if (mode === 'all') {
      await loadIndexAndPlayRef.current(list.length - 1)
    }
  }, [])

  const handleEnded = useCallback(() => {
    const len = pathsRef.current.length
    if (len === 0) return
    const idx = currentIndexRef.current
    const mode = loopModeRef.current
    if (mode === 'one') return
    if (mode === 'all') {
      const next = (idx + 1) % len
      void loadIndexAndPlayRef.current(next)
      return
    }
    if (idx < len - 1) {
      void loadIndexAndPlayRef.current(idx + 1)
    } else {
      void send({ type: 'pause' })
      setPlaying(false)
    }
  }, [send])

  useEffect(() => {
    const off = window.electronAPI.onVideoEndedFromOutput(handleEnded)
    return off
  }, [handleEnded])

  useEffect(() => {
    void send({ type: 'setLoopOne', loop: loopMode === 'one' })
  }, [loopMode, send])

  const playbackPlaylistMuted =
    playbackSession?.playlistOutputMuted ?? false

  useEffect(() => {
    void send({ type: 'setMuted', muted: muted || playbackPlaylistMuted })
  }, [muted, playbackPlaylistMuted, send])

  useEffect(() => {
    void send({ type: 'setVolume', volume: outputVolume })
  }, [outputVolume, send])

  useEffect(() => {
    void send({ type: 'setSinkId', sinkId: outputSinkId })
  }, [outputSinkId, send])

  useEffect(() => {
    void window.electronAPI.setOutputPresentationVisible(secondScreenOn)
  }, [secondScreenOn])

  useEffect(() => {
    if (!secondScreenOn || !playing) return
    void send({ type: 'play' })
  }, [secondScreenOn, playing, send])

  const openFolder = useCallback(
    async (sessionId: string) => {
      const list = await window.electronAPI.selectFolder()
      if (!list?.length) return
      recordUndoPoint()
      await applyPathsList(list, sessionId, { skipHistory: true })
      patchFloatingSession(sessionId, {
        playlistTitle: folderBasenameFromPaths(list),
      })
    },
    [applyPathsList, patchFloatingSession, recordUndoPoint],
  )

  const addMediaToPlaylist = useCallback(
    async (sessionId: string) => {
      const picked = await window.electronAPI.selectMediaFiles()
      if (!picked?.length) return
      recordUndoPoint()
      let titleFromFirstFolder: string | null = null
      setFloatingSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s
          const seen = new Set(s.paths)
          const merged = [...s.paths]
          for (const f of picked) {
            if (!seen.has(f)) {
              seen.add(f)
              merged.push(f)
            }
          }
          if (s.paths.length === 0 && merged.length > 0)
            titleFromFirstFolder = folderBasenameFromPaths(merged)
          return { ...s, paths: merged }
        }),
      )
      if (titleFromFirstFolder)
        patchFloatingSession(sessionId, {
          playlistTitle: titleFromFirstFolder,
        })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const removePathAt = useCallback(
    async (index: number, sessionId: string) => {
      const playbackSid = resolvedPlaybackIdRef.current
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s) return
      const prev = s.paths
      if (index < 0 || index >= prev.length) return
      recordUndoPoint()

      const affectsPlayback = sessionId === playbackSid
      const li = loadedIndexRef.current
      const loadedPath =
        affectsPlayback && li != null && li >= 0 && li < prev.length
          ? prev[li]
          : null

      const next = [...prev.slice(0, index), ...prev.slice(index + 1)]

      if (next.length === 0) {
        patchFloatingSession(sessionId, { paths: [], currentIndex: 0 })
        if (affectsPlayback) {
          setPreviewSrc(null)
          setPreviewSyncKey((k) => k + 1)
          loadedIndexRef.current = null
          setPlaybackLoadedTrack(null)
          setPlaying(false)
          await send({ type: 'pause' })
        }
        return
      }

      let nextCi = s.currentIndex
      if (index < nextCi) nextCi = nextCi - 1
      else if (index === nextCi) nextCi = Math.min(index, next.length - 1)

      if (affectsPlayback) {
        const newLi =
          loadedPath != null ? next.findIndex((p) => p === loadedPath) : -1
        if (newLi < 0) {
          loadedIndexRef.current = null
          setPlaybackLoadedTrack(null)
          setPlaying(false)
          setPreviewSrc(null)
          setPreviewSyncKey((k) => k + 1)
          await send({ type: 'pause' })
        } else {
          loadedIndexRef.current = newLi
          setPlaybackLoadedTrack({ sessionId: playbackSid, index: newLi })
        }
      }

      patchFloatingSession(sessionId, {
        paths: next,
        currentIndex: Math.max(0, nextCi),
      })
    },
    [patchFloatingSession, recordUndoPoint, send],
  )

  const selectItem = useCallback(
    (index: number, sessionId: string) => {
      const s = floatingSessionsRef.current.find((x) => x.id === sessionId)
      if (!s) return
      if (index >= 0 && index < s.paths.length)
        patchFloatingSession(sessionId, { currentIndex: index })
    },
    [patchFloatingSession],
  )

  const reorderPaths = useCallback(
    (fromIndex: number, toIndex: number, sessionId: string) => {
      if (fromIndex === toIndex) return
      const s0 = floatingSessionsRef.current.find((x) => x.id === sessionId)
      const prev0 = s0?.paths ?? []
      if (
        fromIndex < 0 ||
        fromIndex >= prev0.length ||
        toIndex < 0 ||
        toIndex >= prev0.length
      )
        return
      recordUndoPoint()
      const playbackSid = resolvedPlaybackIdRef.current
      patchFloatingSession(sessionId, (s) => {
        const prev = s.paths
        if (
          fromIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex < 0 ||
          toIndex >= prev.length
        )
          return s
        const selectedPath = prev[s.currentIndex]
        const affectsPlayback = sessionId === playbackSid
        const li = loadedIndexRef.current
        const loadedPath =
          affectsPlayback && li != null && li >= 0 && li < prev.length
            ? prev[li]
            : null
        const next = [...prev]
        const [item] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, item)
        let newCi = s.currentIndex
        const ni = next.findIndex((p) => p === selectedPath)
        if (ni >= 0) newCi = ni
        const nli =
          affectsPlayback && loadedPath != null
            ? next.findIndex((p) => p === loadedPath)
            : -1
        if (affectsPlayback && nli >= 0) {
          loadedIndexRef.current = nli
          setPlaybackLoadedTrack({ sessionId: playbackSid, index: nli })
        }
        return { ...s, paths: next, currentIndex: newCi }
      })
    },
    [patchFloatingSession, recordUndoPoint],
  )

  const setLoopMode = useCallback((m: LoopMode) => {
    setLoopModeState(m)
  }, [])

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m)
  }, [])

  const setOutputVolume = useCallback((v: number) => {
    const c = Math.min(1, Math.max(0, v))
    setOutputVolumeState(c)
    try {
      localStorage.setItem(LS_OUTPUT_VOLUME, String(c))
    } catch {
      /* ignore */
    }
  }, [])

  const setOutputSinkId = useCallback((sinkId: string) => {
    setOutputSinkIdState(sinkId)
    try {
      localStorage.setItem(LS_OUTPUT_SINK, sinkId)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleSecondScreen = useCallback(() => {
    setSecondScreenOn((v) => !v)
  }, [])

  const canUndo = useMemo(
    () => undoStackRef.current.length > 0,
    [historyRev],
  )
  const canRedo = useMemo(
    () => redoStackRef.current.length > 0,
    [historyRev],
  )

  const value = useMemo<RegiaContextValue>(
    () => ({
      paths,
      currentIndex,
      loopMode,
      muted,
      outputVolume,
      setOutputVolume,
      outputSinkId,
      setOutputSinkId,
      playing,
      previewSrc,
      previewSyncKey,
      secondScreenOn,
      savedPlaylists,
      floatingPlaylistOpen,
      floatingPlaylistSessions: floatingSessions,
      activeFloatingSessionId: resolvedActiveId,
      setActiveFloatingSession,
      addFloatingPlaylist,
      removeFloatingPlaylist,
      openFolder,
      addMediaToPlaylist,
      removePathAt,
      refreshSavedPlaylists,
      saveCurrentPlaylist,
      loadSavedPlaylist,
      deleteSavedPlaylist,
      duplicateSavedPlaylist,
      loadIndexAndPlay,
      togglePlay,
      setLoopMode,
      setMuted,
      toggleSecondScreen,
      goNext,
      goPrev,
      selectItem,
      reorderPaths,
      playlistTitle,
      setPlaylistTitle,
      setPlaylistThemeColor,
      playlistCrossfade,
      setPlaylistCrossfade,
      setPlaylistOutputMuted,
      closeFloatingPlaylist,
      openFloatingPlaylist,
      hideFloatingPlaylistPanels,
      updateFloatingPlaylistChrome,
      savedPlaylistDirty,
      saveLoadedPlaylistOverwrite,
      persistSavedPlaylistAfterFloatingTitleBlur,
      canUndo,
      canRedo,
      undo,
      redo,
      recordUndoPoint,
      playbackLoadedTrack,
    }),
    [
      paths,
      currentIndex,
      loopMode,
      muted,
      outputVolume,
      setOutputVolume,
      outputSinkId,
      setOutputSinkId,
      playing,
      previewSrc,
      previewSyncKey,
      secondScreenOn,
      savedPlaylists,
      floatingPlaylistOpen,
      floatingSessions,
      resolvedActiveId,
      setActiveFloatingSession,
      addFloatingPlaylist,
      removeFloatingPlaylist,
      openFolder,
      addMediaToPlaylist,
      removePathAt,
      refreshSavedPlaylists,
      saveCurrentPlaylist,
      loadSavedPlaylist,
      deleteSavedPlaylist,
      duplicateSavedPlaylist,
      loadIndexAndPlay,
      togglePlay,
      setLoopMode,
      setMuted,
      setOutputVolume,
      setOutputSinkId,
      toggleSecondScreen,
      goNext,
      goPrev,
      selectItem,
      reorderPaths,
      playlistTitle,
      setPlaylistTitle,
      setPlaylistThemeColor,
      playlistCrossfade,
      setPlaylistCrossfade,
      setPlaylistOutputMuted,
      closeFloatingPlaylist,
      openFloatingPlaylist,
      hideFloatingPlaylistPanels,
      updateFloatingPlaylistChrome,
      savedPlaylistDirty,
      saveLoadedPlaylistOverwrite,
      persistSavedPlaylistAfterFloatingTitleBlur,
      canUndo,
      canRedo,
      undo,
      redo,
      recordUndoPoint,
      playbackLoadedTrack,
    ],
  )

  return (
    <RegiaContext.Provider value={value}>{children}</RegiaContext.Provider>
  )
}

export function useRegia(): RegiaContextValue {
  const v = useContext(RegiaContext)
  if (!v) throw new Error('useRegia must be used within RegiaProvider')
  return v
}
