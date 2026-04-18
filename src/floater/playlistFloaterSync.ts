import type { MutableRefObject } from 'react'
import type { RegiaContextValue } from '../state/RegiaContext.tsx'

/** Stato serializzabile inviato dalla finestra Regia al pannello playlist in finestra OS. */
export type PlaylistFloaterSyncPayload = {
  floatingPlaylistSessions: RegiaContextValue['floatingPlaylistSessions']
  previewDetached: boolean
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
  playing: boolean
  videoPlaying: boolean
  previewSrc: string | null
  previewSyncKey: number
  secondScreenOn: boolean
  savedPlaylists: RegiaContextValue['savedPlaylists']
  playlistTitle: string
  playlistCrossfade: boolean
  outputTrackLoopMode: RegiaContextValue['outputTrackLoopMode']
  stillImageDurationSec: number
  namedWorkspaces: RegiaContextValue['namedWorkspaces']
  activeNamedWorkspaceId: string | null
  activeNamedWorkspaceLabel: string
  sidebarOpen: boolean
  sidebarWidthPx: number
}

export function buildPlaylistFloaterSyncPayload(
  v: RegiaContextValue,
  floaterSessionId: string,
): PlaylistFloaterSyncPayload {
  return {
    floatingPlaylistSessions: structuredClone(v.floatingPlaylistSessions),
    previewDetached: v.previewDetached,
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
    playing: v.playing,
    videoPlaying: v.videoPlaying,
    previewSrc: v.previewSrc,
    previewSyncKey: v.previewSyncKey,
    secondScreenOn: v.secondScreenOn,
    savedPlaylists: v.savedPlaylists,
    playlistTitle: v.playlistTitle,
    playlistCrossfade: v.playlistCrossfade,
    outputTrackLoopMode: v.outputTrackLoopMode,
    stillImageDurationSec: v.stillImageDurationSec,
    namedWorkspaces: v.namedWorkspaces,
    activeNamedWorkspaceId: v.activeNamedWorkspaceId,
    activeNamedWorkspaceLabel: v.activeNamedWorkspaceLabel,
    sidebarOpen: v.sidebarOpen,
    sidebarWidthPx: v.sidebarWidthPx,
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

  return {
    paths: sync.paths,
    currentIndex: sync.currentIndex,
    loopMode: sync.loopMode,
    muted: sync.muted,
    outputVolume: sync.outputVolume,
    setOutputVolume: call('setOutputVolume'),
    outputSinkId: sync.outputSinkId,
    setOutputSinkId: call('setOutputSinkId'),
    videoPlaying: sync.videoPlaying,
    launchpadAudioPlaying: sync.launchpadAudioPlaying,
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
    playlistCrossfade: sync.playlistCrossfade,
    setPlaylistCrossfade: call(
      'setPlaylistCrossfade',
    ) as RegiaContextValue['setPlaylistCrossfade'],
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
    updateFloatingPlaylistChrome: call(
      'updateFloatingPlaylistChrome',
    ) as RegiaContextValue['updateFloatingPlaylistChrome'],
    repositionAllFloatingPanels: call(
      'repositionAllFloatingPanels',
    ) as RegiaContextValue['repositionAllFloatingPanels'],
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
  } as RegiaContextValue
}
