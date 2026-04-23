import type { MutableRefObject } from 'react'
import { deriveOutputTrackListSession } from '../lib/deriveOutputTrackListSession.ts'
import { buildRegiaBugReportSnapshot } from '../lib/regiaBugReportSnapshot.ts'
import type { PreviewDisplayMode } from '../lib/previewDetachedStorage.ts'
import { computeRightPlanciaDockColumnWidthPx } from '../lib/planciaSnap.ts'
import type { RegiaContextValue } from '../state/RegiaContext.tsx'

/** Stato serializzabile inviato dalla finestra Regia al pannello playlist in finestra OS. */
export type PlaylistFloaterSyncPayload = {
  floatingPlaylistSessions: RegiaContextValue['floatingPlaylistSessions']
  previewDetached: boolean
  previewDisplayMode: PreviewDisplayMode
  floatingZOrder: string[]
  playbackLoadedTrack: RegiaContextValue['playbackLoadedTrack']
  loopMode: RegiaContextValue['loopMode']
  launchpadAudioPlaying: boolean
  floatingPlaylistOpen: boolean
  activeFloatingSessionId: string
  canUndo: boolean
  canRedo: boolean
  previewMediaTimesTick: number
  previewMediaTimes: { currentTime: number; duration: number }
  savedPlaylistDirtyForFloater: boolean
  floatingCloseWouldInterruptForFloater: boolean
  paths: string[]
  currentIndex: number
  muted: boolean
  outputVolume: number
  outputSinkId: string
  cueSinkId: string
  playing: boolean
  videoPlaying: boolean
  previewSrc: string | null
  previewSyncKey: number
  secondScreenOn: boolean
  savedPlaylists: RegiaContextValue['savedPlaylists']
  playlistTitle: string
  playlistCrossfadeSec: RegiaContextValue['playlistCrossfadeSec']
  outputTrackLoopMode: RegiaContextValue['outputTrackLoopMode']
  stillImageDurationSec: number
  namedWorkspaces: RegiaContextValue['namedWorkspaces']
  activeNamedWorkspaceId: string | null
  activeNamedWorkspaceLabel: string
  sidebarOpen: boolean
  sidebarWidthPx: number
  videoOutputSessionId: string | null
  playbackSessionId: string | null
  playbackArmedNext: RegiaContextValue['playbackArmedNext']
  sottofondoPlaying: boolean
  sottofondoLoadedTrack: RegiaContextValue['sottofondoLoadedTrack']
}

export function buildPlaylistFloaterSyncPayload(
  v: RegiaContextValue,
  floaterSessionId: string,
): PlaylistFloaterSyncPayload {
  return {
    floatingPlaylistSessions: structuredClone(v.floatingPlaylistSessions),
    previewDetached: v.previewDetached,
    previewDisplayMode: v.previewDisplayMode,
    floatingZOrder: [...v.floatingZOrder],
    playbackLoadedTrack: v.playbackLoadedTrack,
    loopMode: v.loopMode,
    launchpadAudioPlaying: v.launchpadAudioPlaying,
    floatingPlaylistOpen: v.floatingPlaylistOpen,
    activeFloatingSessionId: v.activeFloatingSessionId,
    canUndo: v.canUndo,
    canRedo: v.canRedo,
    previewMediaTimesTick: v.previewMediaTimesTick,
    previewMediaTimes: {
      currentTime: v.previewMediaTimesRef.current.currentTime,
      duration: v.previewMediaTimesRef.current.duration,
    },
    savedPlaylistDirtyForFloater: v.savedPlaylistDirty(floaterSessionId),
    floatingCloseWouldInterruptForFloater:
      v.floatingCloseWouldInterruptPlay(floaterSessionId),
    paths: v.paths,
    currentIndex: v.currentIndex,
    muted: v.muted,
    outputVolume: v.outputVolume,
    outputSinkId: v.outputSinkId,
    cueSinkId: v.cueSinkId,
    playing: v.playing,
    videoPlaying: v.videoPlaying,
    previewSrc: v.previewSrc,
    previewSyncKey: v.previewSyncKey,
    secondScreenOn: v.secondScreenOn,
    savedPlaylists: v.savedPlaylists,
    playlistTitle: v.playlistTitle,
    playlistCrossfadeSec: v.playlistCrossfadeSec,
    outputTrackLoopMode: v.outputTrackLoopMode,
    stillImageDurationSec: v.stillImageDurationSec,
    namedWorkspaces: v.namedWorkspaces,
    activeNamedWorkspaceId: v.activeNamedWorkspaceId,
    activeNamedWorkspaceLabel: v.activeNamedWorkspaceLabel,
    sidebarOpen: v.sidebarOpen,
    sidebarWidthPx: v.sidebarWidthPx,
    videoOutputSessionId: v.videoOutputSessionId,
    playbackSessionId: v.playbackSessionId,
    playbackArmedNext: v.playbackArmedNext,
    sottofondoPlaying: v.sottofondoPlaying,
    sottofondoLoadedTrack: v.sottofondoLoadedTrack,
  }
}

const noop = () => {}

export function buildPlaylistFloaterMirrorRegiaValue(
  sync: PlaylistFloaterSyncPayload,
  floaterSessionId: string,
  previewMediaTimesRef: MutableRefObject<{
    currentTime: number
    duration: number
  }>,
  send: (method: string, args: unknown[]) => void,
): RegiaContextValue {
  const call =
    (method: string) =>
    (...args: unknown[]) => {
      void send(method, args)
    }

  const resolvedPlaybackId =
    sync.playbackSessionId &&
    sync.floatingPlaylistSessions.some((s) => s.id === sync.playbackSessionId)
      ? sync.playbackSessionId
      : sync.activeFloatingSessionId

  const outputTrackListSession = deriveOutputTrackListSession(
    sync.floatingPlaylistSessions,
    sync.videoOutputSessionId,
    resolvedPlaybackId,
  )

  const playbackControlSession =
    sync.floatingPlaylistSessions.find((s) => s.id === resolvedPlaybackId) ??
    sync.floatingPlaylistSessions[0] ??
    null

  return {
    paths: sync.paths,
    currentIndex: sync.currentIndex,
    loopMode: sync.loopMode,
    muted: sync.muted,
    outputVolume: sync.outputVolume,
    setOutputVolume: call('setOutputVolume'),
    outputSinkId: sync.outputSinkId,
    setOutputSinkId: call('setOutputSinkId'),
    cueSinkId: sync.cueSinkId,
    setCueSinkId: call('setCueSinkId') as RegiaContextValue['setCueSinkId'],
    videoPlaying: sync.videoPlaying,
    launchpadAudioPlaying: sync.launchpadAudioPlaying,
    sottofondoPlaying: sync.sottofondoPlaying,
    sottofondoLoadedTrack: sync.sottofondoLoadedTrack,
    stopSottofondoPlayback: call(
      'stopSottofondoPlayback',
    ) as RegiaContextValue['stopSottofondoPlayback'],
    playing: sync.playing,
    previewSrc: sync.previewSrc,
    previewSyncKey: sync.previewSyncKey,
    secondScreenOn: sync.secondScreenOn,
    savedPlaylists: sync.savedPlaylists,
    openFolder: call('openFolder') as RegiaContextValue['openFolder'],
    addMediaToPlaylist: call(
      'addMediaToPlaylist',
    ) as RegiaContextValue['addMediaToPlaylist'],
    addPathsToPlaylistFromPaths: call(
      'addPathsToPlaylistFromPaths',
    ) as RegiaContextValue['addPathsToPlaylistFromPaths'],
    applyLaunchPadDropFromPaths: call(
      'applyLaunchPadDropFromPaths',
    ) as RegiaContextValue['applyLaunchPadDropFromPaths'],
    removePathAt: call('removePathAt') as RegiaContextValue['removePathAt'],
    refreshSavedPlaylists: call(
      'refreshSavedPlaylists',
    ) as RegiaContextValue['refreshSavedPlaylists'],
    saveCurrentPlaylist: call(
      'saveCurrentPlaylist',
    ) as RegiaContextValue['saveCurrentPlaylist'],
    loadSavedPlaylist: call(
      'loadSavedPlaylist',
    ) as RegiaContextValue['loadSavedPlaylist'],
    loadPlaylistFromRegiaVideoCloudFile: call(
      'loadPlaylistFromRegiaVideoCloudFile',
    ) as RegiaContextValue['loadPlaylistFromRegiaVideoCloudFile'],
    saveFloatingPlaylistCopyToRegiaVideoCloud: call(
      'saveFloatingPlaylistCopyToRegiaVideoCloud',
    ) as RegiaContextValue['saveFloatingPlaylistCopyToRegiaVideoCloud'],
    setFloatingPlaylistPanelLocked: call(
      'setFloatingPlaylistPanelLocked',
    ) as RegiaContextValue['setFloatingPlaylistPanelLocked'],
    deleteSavedPlaylist: call(
      'deleteSavedPlaylist',
    ) as RegiaContextValue['deleteSavedPlaylist'],
    reorderSavedPlaylists: call(
      'reorderSavedPlaylists',
    ) as RegiaContextValue['reorderSavedPlaylists'],
    duplicateSavedPlaylist: call(
      'duplicateSavedPlaylist',
    ) as RegiaContextValue['duplicateSavedPlaylist'],
    loadIndexAndPlay: call(
      'loadIndexAndPlay',
    ) as RegiaContextValue['loadIndexAndPlay'],
    loadLaunchPadSlotAndPlay: call(
      'loadLaunchPadSlotAndPlay',
    ) as RegiaContextValue['loadLaunchPadSlotAndPlay'],
    stopLaunchPadCueRelease: call(
      'stopLaunchPadCueRelease',
    ) as RegiaContextValue['stopLaunchPadCueRelease'],
    releaseLaunchPadCueVoice: call(
      'releaseLaunchPadCueVoice',
    ) as RegiaContextValue['releaseLaunchPadCueVoice'],
    updateLaunchPadCell: call(
      'updateLaunchPadCell',
    ) as RegiaContextValue['updateLaunchPadCell'],
    setLaunchPadBankIndex: call(
      'setLaunchPadBankIndex',
    ) as RegiaContextValue['setLaunchPadBankIndex'],
    togglePlay: call('togglePlay') as RegiaContextValue['togglePlay'],
    stopPlayback: call('stopPlayback') as RegiaContextValue['stopPlayback'],
    setLoopMode: call('setLoopMode') as RegiaContextValue['setLoopMode'],
    setMuted: call('setMuted') as RegiaContextValue['setMuted'],
    toggleSecondScreen: call(
      'toggleSecondScreen',
    ) as RegiaContextValue['toggleSecondScreen'],
    goNext: call('goNext') as RegiaContextValue['goNext'],
    goPrev: call('goPrev') as RegiaContextValue['goPrev'],
    playbackArmedNext: sync.playbackArmedNext,
    armPlayNext: call('armPlayNext') as RegiaContextValue['armPlayNext'],
    clearPlaybackArmedNext: call(
      'clearPlaybackArmedNext',
    ) as RegiaContextValue['clearPlaybackArmedNext'],
    selectItem: call('selectItem') as RegiaContextValue['selectItem'],
    reorderPaths: call('reorderPaths') as RegiaContextValue['reorderPaths'],
    applyFloatingInternalDrop: call(
      'applyFloatingInternalDrop',
    ) as RegiaContextValue['applyFloatingInternalDrop'],
    playlistTitle: sync.playlistTitle,
    setPlaylistTitle: call('setPlaylistTitle') as RegiaContextValue['setPlaylistTitle'],
    setPlaylistThemeColor: call(
      'setPlaylistThemeColor',
    ) as RegiaContextValue['setPlaylistThemeColor'],
    programWatermarkAbsPath: null,
    setPlaylistWatermarkPngPath: call(
      'setPlaylistWatermarkPngPath',
    ) as RegiaContextValue['setPlaylistWatermarkPngPath'],
    playlistCrossfadeSec: sync.playlistCrossfadeSec,
    cyclePlaylistCrossfadeSec: call(
      'cyclePlaylistCrossfadeSec',
    ) as RegiaContextValue['cyclePlaylistCrossfadeSec'],
    setPlaylistLoopMode: call(
      'setPlaylistLoopMode',
    ) as RegiaContextValue['setPlaylistLoopMode'],
    outputTrackLoopMode: sync.outputTrackLoopMode,
    previewMediaTimesTick: sync.previewMediaTimesTick,
    previewMediaTimesRef,
    reportPreviewMediaTimes: noop as RegiaContextValue['reportPreviewMediaTimes'],
    stillImageDurationSec: sync.stillImageDurationSec,
    setStillImageDurationSec: call(
      'setStillImageDurationSec',
    ) as RegiaContextValue['setStillImageDurationSec'],
    setPlaylistOutputMuted: call(
      'setPlaylistOutputMuted',
    ) as RegiaContextValue['setPlaylistOutputMuted'],
    setPlaylistOutputVolume: call(
      'setPlaylistOutputVolume',
    ) as RegiaContextValue['setPlaylistOutputVolume'],
    floatingPlaylistOpen: sync.floatingPlaylistOpen,
    floatingPlaylistSessions: sync.floatingPlaylistSessions,
    activeFloatingSessionId: sync.activeFloatingSessionId,
    setActiveFloatingSession: call(
      'setActiveFloatingSession',
    ) as RegiaContextValue['setActiveFloatingSession'],
    floatingZOrder: sync.floatingZOrder,
    bringFloatingPanelToFront: call(
      'bringFloatingPanelToFront',
    ) as RegiaContextValue['bringFloatingPanelToFront'],
    addFloatingPlaylist: call(
      'addFloatingPlaylist',
    ) as RegiaContextValue['addFloatingPlaylist'],
    addFloatingLaunchPad: call(
      'addFloatingLaunchPad',
    ) as RegiaContextValue['addFloatingLaunchPad'],
    addFloatingChalkboard: call(
      'addFloatingChalkboard',
    ) as RegiaContextValue['addFloatingChalkboard'],
    addFloatingSottofondo: call(
      'addFloatingSottofondo',
    ) as RegiaContextValue['addFloatingSottofondo'],
    removeFloatingPlaylist: call(
      'removeFloatingPlaylist',
    ) as RegiaContextValue['removeFloatingPlaylist'],
    floatingCloseWouldInterruptPlay: (sid: string) =>
      sid === floaterSessionId
        ? sync.floatingCloseWouldInterruptForFloater
        : false,
    closeFloatingPlaylist: call(
      'closeFloatingPlaylist',
    ) as RegiaContextValue['closeFloatingPlaylist'],
    openFloatingPlaylist: call(
      'openFloatingPlaylist',
    ) as RegiaContextValue['openFloatingPlaylist'],
    hideFloatingPlaylistPanels: call(
      'hideFloatingPlaylistPanels',
    ) as RegiaContextValue['hideFloatingPlaylistPanels'],
    rightPlanciaDockWidthPx: computeRightPlanciaDockColumnWidthPx(
      sync.floatingPlaylistSessions,
    ),
    dockFloatingPlaylistToPlanciaRight: call(
      'dockFloatingPlaylistToPlanciaRight',
    ) as RegiaContextValue['dockFloatingPlaylistToPlanciaRight'],
    updateFloatingPlaylistChrome: call(
      'updateFloatingPlaylistChrome',
    ) as RegiaContextValue['updateFloatingPlaylistChrome'],
    repositionAllFloatingPanels: call(
      'repositionAllFloatingPanels',
    ) as RegiaContextValue['repositionAllFloatingPanels'],
    patchFloatingPlaylistSession: call(
      'patchFloatingPlaylistSession',
    ) as RegiaContextValue['patchFloatingPlaylistSession'],
    savedPlaylistDirty: (sid: string) =>
      sid === floaterSessionId ? sync.savedPlaylistDirtyForFloater : false,
    saveLoadedPlaylistOverwrite: call(
      'saveLoadedPlaylistOverwrite',
    ) as RegiaContextValue['saveLoadedPlaylistOverwrite'],
    persistSavedPlaylistAfterFloatingTitleBlur: call(
      'persistSavedPlaylistAfterFloatingTitleBlur',
    ) as RegiaContextValue['persistSavedPlaylistAfterFloatingTitleBlur'],
    canUndo: sync.canUndo,
    canRedo: sync.canRedo,
    undo: call('undo') as RegiaContextValue['undo'],
    redo: call('redo') as RegiaContextValue['redo'],
    recordUndoPoint: call('recordUndoPoint') as RegiaContextValue['recordUndoPoint'],
    playbackLoadedTrack: sync.playbackLoadedTrack,
    outputTrackListSession,
    playbackControlSession,
    videoOutputSessionId: sync.videoOutputSessionId,
    playbackSessionId: sync.playbackSessionId,
    namedWorkspaces: sync.namedWorkspaces,
    refreshNamedWorkspaces: call(
      'refreshNamedWorkspaces',
    ) as RegiaContextValue['refreshNamedWorkspaces'],
    createNewNamedWorkspace: call(
      'createNewNamedWorkspace',
    ) as RegiaContextValue['createNewNamedWorkspace'],
    saveNamedWorkspace: call(
      'saveNamedWorkspace',
    ) as RegiaContextValue['saveNamedWorkspace'],
    loadNamedWorkspace: call(
      'loadNamedWorkspace',
    ) as RegiaContextValue['loadNamedWorkspace'],
    deleteNamedWorkspace: call(
      'deleteNamedWorkspace',
    ) as RegiaContextValue['deleteNamedWorkspace'],
    renameNamedWorkspace: call(
      'renameNamedWorkspace',
    ) as RegiaContextValue['renameNamedWorkspace'],
    overwriteNamedWorkspace: call(
      'overwriteNamedWorkspace',
    ) as RegiaContextValue['overwriteNamedWorkspace'],
    duplicateNamedWorkspace: call(
      'duplicateNamedWorkspace',
    ) as RegiaContextValue['duplicateNamedWorkspace'],
    activeNamedWorkspaceId: sync.activeNamedWorkspaceId,
    activeNamedWorkspaceLabel: sync.activeNamedWorkspaceLabel,
    previewDetached: sync.previewDetached,
    previewDisplayMode:
      sync.previewDisplayMode ??
      (sync.previewDetached ? 'floating' : 'docked'),
    cyclePreviewDisplayMode: call(
      'cyclePreviewDisplayMode',
    ) as RegiaContextValue['cyclePreviewDisplayMode'],
    setPreviewDocked: call('setPreviewDocked') as RegiaContextValue['setPreviewDocked'],
    setPreviewFloating: call(
      'setPreviewFloating',
    ) as RegiaContextValue['setPreviewFloating'],
    sidebarOpen: sync.sidebarOpen,
    setSidebarOpen: call('setSidebarOpen') as RegiaContextValue['setSidebarOpen'],
    toggleSidebarOpen: call(
      'toggleSidebarOpen',
    ) as RegiaContextValue['toggleSidebarOpen'],
    sidebarWidthPx: sync.sidebarWidthPx,
    setSidebarWidthPx: call(
      'setSidebarWidthPx',
    ) as RegiaContextValue['setSidebarWidthPx'],
    playlistFloaterOsSessionIds: [],
    exportBugReportSnapshot: () =>
      buildRegiaBugReportSnapshot({
        scope: 'playlist_os_floater',
        floaterSessionId,
        appVersionFromUi: __REGIA_APP_VERSION__,
        buildHashFromUi: __REGIA_BUILD_HASH__,
        transport: {
          playing: sync.playing,
          videoPlaying: sync.videoPlaying,
          launchpadAudioPlaying: sync.launchpadAudioPlaying,
          muted: sync.muted,
          outputVolume: sync.outputVolume,
          loopMode: sync.loopMode,
          secondScreenOn: sync.secondScreenOn,
          previewSrc: sync.previewSrc,
          previewSyncKey: sync.previewSyncKey,
          previewMediaTimes: { ...previewMediaTimesRef.current },
        },
        routing: {
          activeFloatingSessionId: sync.activeFloatingSessionId,
          playbackSessionId: sync.playbackSessionId,
          videoOutputSessionId: sync.videoOutputSessionId,
          playbackLoadedTrack: sync.playbackLoadedTrack,
          playbackArmedNext: sync.playbackArmedNext,
          outputTrackLoopMode: sync.outputTrackLoopMode,
          floatingZOrder: [...sync.floatingZOrder],
          previewDetached: sync.previewDetached,
          floatingPlaylistOpen: sync.floatingPlaylistOpen,
          playlistFloaterOsSessionIds: [floaterSessionId],
        },
        workspaceUi: {
          sidebarOpen: sync.sidebarOpen,
          sidebarWidthPx: sync.sidebarWidthPx,
        },
        namedWorkspaces: sync.namedWorkspaces.map((w) => ({
          id: w.id,
          label: w.label,
          savedAt: w.savedAt,
        })),
        activeNamedWorkspaceId: sync.activeNamedWorkspaceId,
        activeNamedWorkspaceLabel: sync.activeNamedWorkspaceLabel,
        savedPlaylists: sync.savedPlaylists.map((p) => ({
          id: p.id,
          label: p.label,
          trackCount: p.trackCount,
        })),
        floatingSessions: sync.floatingPlaylistSessions,
      }),
  } as RegiaContextValue
}
