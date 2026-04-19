import type { FloatingPlaylistSession } from '../state/floatingPlaylistSession.ts'

type LoopMode = 'off' | 'one' | 'all'

type NamedWorkspaceMetaLite = {
  id: string
  label: string
  savedAt: number
}

type SavedPlaylistMetaLite = {
  id: string
  label: string
  trackCount: number
}

function jsonReplacer(key: string, val: unknown): unknown {
  if (key === 'chalkboardPlacementsByBank' && Array.isArray(val)) {
    return (val as unknown[][]).map((bank) =>
      Array.isArray(bank) ? { placementCount: bank.length } : bank,
    )
  }
  return val
}

function cloneSessionForReport(s: FloatingPlaylistSession): unknown {
  try {
    return JSON.parse(JSON.stringify(s, jsonReplacer))
  } catch {
    return { id: s.id, error: 'serialize_failed' }
  }
}

export type RegiaBugReportSnapshotV1 = {
  schema: 'regia-bug-report/v1'
  scope: 'main' | 'playlist_os_floater'
  exportedAt: string
  appVersionFromUi: string
  buildHashFromUi: string
  floaterSessionId?: string
  transport: {
    playing: boolean
    videoPlaying: boolean
    launchpadAudioPlaying: boolean
    muted: boolean
    outputVolume: number
    loopMode: LoopMode
    secondScreenOn: boolean
    previewSrc: string | null
    previewSyncKey: number
    previewMediaTimes: { currentTime: number; duration: number }
  }
  routing: {
    activeFloatingSessionId: string
    playbackSessionId: string | null
    videoOutputSessionId: string | null
    playbackLoadedTrack: {
      sessionId: string
      index: number
      launchPadBankIndex?: number
    } | null
    playbackArmedNext: { sessionId: string; index: number } | null
    outputTrackLoopMode: LoopMode
    floatingZOrder: string[]
    previewDetached: boolean
    floatingPlaylistOpen: boolean
    playlistFloaterOsSessionIds: string[]
  }
  workspaceUi: {
    sidebarOpen: boolean
    sidebarWidthPx: number
  }
  namedWorkspaces: NamedWorkspaceMetaLite[]
  activeNamedWorkspaceId: string | null
  activeNamedWorkspaceLabel: string
  savedPlaylists: SavedPlaylistMetaLite[]
  floatingSessions: unknown[]
}

/** Campi runtime (sessioni complete) da serializzare nel report. */
export type RegiaBugReportSnapshotFields = Omit<
  RegiaBugReportSnapshotV1,
  'schema' | 'exportedAt' | 'floatingSessions' | 'savedPlaylists'
> & {
  floatingSessions: FloatingPlaylistSession[]
  savedPlaylists: SavedPlaylistMetaLite[]
}

export function buildRegiaBugReportSnapshot(
  fields: RegiaBugReportSnapshotFields,
): RegiaBugReportSnapshotV1 {
  const { floatingSessions, savedPlaylists, ...rest } = fields
  return {
    schema: 'regia-bug-report/v1',
    exportedAt: new Date().toISOString(),
    ...rest,
    savedPlaylists: savedPlaylists.map((p) => ({
      id: p.id,
      label: p.label,
      trackCount: p.trackCount,
    })),
    floatingSessions: floatingSessions.map(cloneSessionForReport),
  }
}
