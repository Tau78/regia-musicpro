import { contextBridge, ipcRenderer } from 'electron'
import type { PlaybackCommand } from './types'

contextBridge.exposeInMainWorld('electronAPI', {
  /** Kit predefinito Launchpad (campioni in public/launchpad-base; vuoto se assente). */
  launchpadBaseKitPaths: (): Promise<string[]> =>
    ipcRenderer.invoke('launchpad-base:kitPaths'),

  /** Stesso tipo di kit in public/launchpad-sfx (duplicato se rigeneri con npm run gen:…). */
  launchpadSfxKitPaths: (): Promise<string[]> =>
    ipcRenderer.invoke('launchpad-sfx:kitPaths'),

  toFileUrl: (absPath: string): Promise<string> =>
    ipcRenderer.invoke('util:toFileUrl', absPath),

  selectFolder: (): Promise<
    { folder: string; paths: string[] } | string[] | null
  > => ipcRenderer.invoke('dialog:selectFolder'),

  playlistFolderWatchStart: (
    sessionId: string,
    folderPath: string,
  ): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('playlist-folder-watch:start', sessionId, folderPath),

  playlistFolderWatchStop: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('playlist-folder-watch:stop', sessionId),

  onPlaylistFolderMediaPathsUpdated: (
    handler: (msg: {
      sessionId: string
      folder: string
      paths: string[]
    }) => void,
  ): (() => void) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      msg: { sessionId: string; folder: string; paths: string[] },
    ) => handler(msg)
    ipcRenderer.on('playlist-folder-watch:updated', listener)
    return () =>
      ipcRenderer.removeListener('playlist-folder-watch:updated', listener)
  },

  selectPlaylistWatermarkPng: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:selectPlaylistWatermarkPng'),

  selectMediaFiles: (opts?: {
    context?: 'playlist' | 'launchpad'
  }): Promise<string[] | null> =>
    ipcRenderer.invoke('dialog:selectMediaFiles', opts ?? {}),

  sendPlayback: (cmd: PlaybackCommand): Promise<void> =>
    ipcRenderer.invoke('playback:send', cmd),

  onPlaybackCommand: (handler: (cmd: PlaybackCommand) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, cmd: PlaybackCommand) =>
      handler(cmd)
    ipcRenderer.on('playback:command', listener)
    return () => ipcRenderer.removeListener('playback:command', listener)
  },

  notifyVideoEnded: (): void => {
    ipcRenderer.send('video:ended-from-output')
  },

  onVideoEndedFromOutput: (handler: () => void): (() => void) => {
    const listener = () => handler()
    ipcRenderer.on('video:ended-to-regia', listener)
    return () => ipcRenderer.removeListener('video:ended-to-regia', listener)
  },

  notifySottofondoEnded: (): void => {
    ipcRenderer.send('sottofondo:ended-from-output')
  },

  onSottofondoEndedFromOutput: (handler: () => void): (() => void) => {
    const listener = () => handler()
    ipcRenderer.on('sottofondo:ended-to-regia', listener)
    return () => ipcRenderer.removeListener('sottofondo:ended-to-regia', listener)
  },

  playlistsList: (): Promise<
    Array<{
      id: string
      label: string
      trackCount: number
      updatedAt: string
      totalDurationSec?: number
      themeColor?: string
      playlistMode?: 'tracks' | 'launchpad' | 'chalkboard'
      hasWatermark?: boolean
    }>
  > => ipcRenderer.invoke('playlists:list'),

  chalkboardEnsureBanks: (opts: {
    folderBaseName: string
    draft: boolean
    width: number
    height: number
    backgroundColor?: string
  }): Promise<string[]> =>
    ipcRenderer.invoke('chalkboard:ensureBanks', opts),

  chalkboardWriteBankDataUrl: (opts: {
    absPath: string
    dataUrl: string
  }): Promise<{ ok: true }> =>
    ipcRenderer.invoke('chalkboard:writeBankDataUrl', opts),

  playlistsSave: (opts: {
    id?: string
    label: string
    paths: string[]
    crossfade?: boolean
    loopMode?: 'off' | 'one' | 'all'
    themeColor?: string | null
    playlistMode?: 'tracks' | 'launchpad' | 'chalkboard'
    launchPadCells?: Array<{
      samplePath: string | null
      padColor: string
      padGain: number
      padDisplayName?: string | null
      padKeyCode?: string | null
      padKeyMode?: 'play' | 'toggle'
    }>
    chalkboardBankPaths?: string[]
    chalkboardMigrateDraftSessionId?: string | null
    totalDurationSec?: number
    watermarkPngPath?: string | null
  }): Promise<{ id: string }> => ipcRenderer.invoke('playlists:save', opts),

  playlistsPatchTotalDuration: (id: string, totalDurationSec: number) =>
    ipcRenderer.invoke('playlists:patchTotalDuration', id, totalDurationSec),

  playlistsLoad: (
    id: string,
  ): Promise<{
    id: string
    label: string
    paths: string[]
    crossfade: boolean
    loopMode: 'off' | 'one' | 'all'
    themeColor: string
    playlistMode: 'tracks' | 'launchpad' | 'chalkboard'
    launchPadCells: Array<{
      samplePath: string | null
      padColor: string
      padGain: number
      padDisplayName?: string | null
      padKeyCode?: string | null
      padKeyMode?: 'play' | 'toggle'
    }>
    chalkboardBankPaths: string[]
    watermarkPngPath: string
  } | null> =>
    ipcRenderer.invoke('playlists:load', id),

  playlistsDelete: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('playlists:delete', id),

  playlistsSetOrder: (orderedIds: string[]): Promise<boolean> =>
    ipcRenderer.invoke('playlists:setOrder', orderedIds),

  playlistsDuplicate: (
    id: string,
  ): Promise<{ id: string } | null> =>
    ipcRenderer.invoke('playlists:duplicate', id),

  regiaVideoCloudGetStatus: (): Promise<{
    configured: boolean
    rootPath: string | null
    rootValid: boolean
    playlistDir: string | null
    playlistDirWritable: boolean
    diskFreeRatio: number | null
  }> => ipcRenderer.invoke('regiaVideoCloud:getStatus'),

  regiaVideoCloudSetRoot: (
    rootPath: string | null,
  ): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('regiaVideoCloud:setRoot', rootPath),

  regiaVideoCloudPickRootFolder: (): Promise<
    | { ok: true; path: string }
    | { ok: false; path: null; error?: string }
  > => ipcRenderer.invoke('regiaVideoCloud:pickRootFolder'),

  regiaVideoCloudList: (): Promise<
    Array<{
      fileName: string
      label: string
      playlistMode: 'tracks' | 'launchpad' | 'chalkboard'
      savedAt: string
    }>
  > => ipcRenderer.invoke('regiaVideoCloud:list'),

  regiaVideoCloudLoadFile: (
    fileName: string,
  ): Promise<
    | {
        ok: true
        data: {
          label: string
          paths: string[]
          crossfade: boolean
          loopMode: 'off' | 'one' | 'all'
          themeColor: string
          playlistMode: 'tracks' | 'launchpad' | 'chalkboard'
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
            Array<{
              id: string
              path: string
              x: number
              y: number
              w: number
              h: number
            }>
          >
          watermarkPngPath: string
        }
      }
    | { ok: false; error: string }
  > => ipcRenderer.invoke('regiaVideoCloud:loadFile', fileName),

  regiaVideoCloudSaveFile: (opts: {
    fileBaseName: string
    payload: {
      label: string
      paths: string[]
      crossfade?: boolean
      loopMode?: 'off' | 'one' | 'all'
      themeColor?: string | null
      playlistMode?: 'tracks' | 'launchpad' | 'chalkboard'
      launchPadCells?: Array<{
        samplePath: string | null
        padColor: string
        padGain: number
        padDisplayName?: string | null
        padKeyCode?: string | null
        padKeyMode?: 'play' | 'toggle'
      }>
      chalkboardBankPaths?: string[]
      chalkboardBackgroundColor?: string
      chalkboardPlacementsByBank?: Array<
        Array<{
          id: string
          path: string
          x: number
          y: number
          w: number
          h: number
        }>
      >
      watermarkPngPath?: string | null
      totalDurationSec?: number
    }
  }): Promise<
    | { ok: true; fileName: string }
    | { ok: false; error: string; pathsOutsideRoot?: string[] }
  > => ipcRenderer.invoke('regiaVideoCloud:saveFile', opts),

  regiaVideoCloudReadiness: (
    manifestJson?: string | null,
  ): Promise<{
    ok: boolean
    missingFiles: string[]
    warnings: string[]
    diskFreeRatio: number | null
  }> => ipcRenderer.invoke('regiaVideoCloud:readiness', manifestJson ?? null),

  regiaVideoCloudSuggestFileName: (label: string) =>
    ipcRenderer.invoke('regiaVideoCloud:suggestFileName', label),

  regiaVideoCloudExportZip: (
    fileName: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('regiaVideoCloud:exportZip', { fileName }),

  setOutputPresentationVisible: (visible: boolean): Promise<void> =>
    ipcRenderer.invoke('output:setPresentationVisible', visible),

  getOutputResolution: (): Promise<{ width: number; height: number }> =>
    ipcRenderer.invoke('output:getResolution'),

  setOutputResolution: (opts: {
    width: number
    height: number
  }): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('output:setResolution', opts),

  getOutputIdleCap: (): Promise<{
    mode: 'black' | 'color' | 'image'
    color: string
    imagePath: string | null
  }> => ipcRenderer.invoke('output:getIdleCap'),

  setOutputIdleCap: (v: {
    mode: 'black' | 'color' | 'image'
    color: string
    imagePath: string | null
  }): Promise<{ ok: true }> => ipcRenderer.invoke('output:setIdleCap', v),

  ensureOutputIdleCap: (
    fallbackFromRegiaLs: unknown,
  ): Promise<{
    mode: 'black' | 'color' | 'image'
    color: string
    imagePath: string | null
  }> => ipcRenderer.invoke('output:ensureIdleCap', fallbackFromRegiaLs),

  getOutputProgramLogoVisible: (): Promise<{ visible: boolean }> =>
    ipcRenderer.invoke('output:getProgramLogoVisible'),

  setOutputProgramLogoVisible: (visible: boolean): Promise<{ ok: true }> =>
    ipcRenderer.invoke('output:setProgramLogoVisible', visible),

  reportOutputAudioLevel: (level: number): void => {
    ipcRenderer.send('output:audio-level', level)
  },

  onOutputAudioLevel: (handler: (level: number) => void): (() => void) => {
    const fn = (_: Electron.IpcRendererEvent, level: number) =>
      handler(typeof level === 'number' && Number.isFinite(level) ? level : 0)
    ipcRenderer.on('regia:output-audio-level', fn)
    return () => ipcRenderer.removeListener('regia:output-audio-level', fn)
  },

  getRegiaContentBounds: (): Promise<{
    x: number
    y: number
    width: number
    height: number
  } | null> => ipcRenderer.invoke('regia:getContentBounds'),

  openPlaylistFloaterWindow: (opts: {
    sessionId: string
    x: number
    y: number
    width: number
    height: number
  }): Promise<{ ok: boolean }> => ipcRenderer.invoke('playlistFloater:open', opts),

  closePlaylistFloaterWindow: (
    sessionId: string,
  ): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('playlistFloater:close', sessionId),

  playlistFloaterBroadcastState: (
    sessionId: string,
    payload: unknown,
  ): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('playlistFloater:broadcastState', sessionId, payload),

  playlistFloaterRequestState: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('playlistFloater:requestState'),

  playlistFloaterSendAction: (method: string, args: unknown[]): void => {
    ipcRenderer.send('playlistFloater:sendAction', { method, args })
  },

  playlistFloaterSetBounds: (partial: {
    x?: number
    y?: number
    width?: number
    height?: number
  }): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('playlistFloater:setBounds', partial),

  onPlaylistFloaterState: (
    handler: (payload: unknown) => void,
  ): (() => void) => {
    const fn = (_: Electron.IpcRendererEvent, payload: unknown) =>
      handler(payload)
    ipcRenderer.on('playlist-floater-state', fn)
    return () => ipcRenderer.removeListener('playlist-floater-state', fn)
  },

  onPlaylistFloaterRequestStateFromMain: (
    handler: (msg: { sessionId: string }) => void,
  ): (() => void) => {
    const fn = (_: Electron.IpcRendererEvent, msg: unknown) =>
      handler(msg as { sessionId: string })
    ipcRenderer.on('playlist-floater-request-state', fn)
    return () =>
      ipcRenderer.removeListener('playlist-floater-request-state', fn)
  },

  onPlaylistFloaterActionFromMain: (
    handler: (msg: {
      sessionId: string
      method: string
      args: unknown[]
    }) => void,
  ): (() => void) => {
    const fn = (_: Electron.IpcRendererEvent, msg: unknown) =>
      handler(msg as { sessionId: string; method: string; args: unknown[] })
    ipcRenderer.on('playlist-floater-action', fn)
    return () => ipcRenderer.removeListener('playlist-floater-action', fn)
  },

  onPlaylistFloaterOsClosedFromMain: (
    handler: (msg: {
      sessionId: string
      bounds: { x: number; y: number; width: number; height: number } | null
    }) => void,
  ): (() => void) => {
    const fn = (_: Electron.IpcRendererEvent, msg: unknown) =>
      handler(
        msg as {
          sessionId: string
          bounds: { x: number; y: number; width: number; height: number } | null
        },
      )
    ipcRenderer.on('playlist-floater-os-closed', fn)
    return () =>
      ipcRenderer.removeListener('playlist-floater-os-closed', fn)
  },

  lanServerStart: (opts?: { port?: number }) =>
    ipcRenderer.invoke('lanServer:start', opts ?? {}),

  lanServerStop: (): Promise<{ running: false }> =>
    ipcRenderer.invoke('lanServer:stop'),

  lanServerStatus: (): Promise<{
    running: boolean
    port: number
    token: string | null
    lanUrl: string | null
    localUrl: string | null
    remotePath: string
    primaryLanIp: string | null
    firewallHint: string
  }> => ipcRenderer.invoke('lanServer:status'),

  onLanServerIpChanged: (
    handler: (msg: {
      ip: string | null
      lanUrl: string | null
      localUrl: string | null
    }) => void,
  ): (() => void) => {
    const fn = (_: Electron.IpcRendererEvent, m: unknown) =>
      handler(
        m as {
          ip: string | null
          lanUrl: string | null
          localUrl: string | null
        },
      )
    ipcRenderer.on('lanServer:ip-changed', fn)
    return () => ipcRenderer.removeListener('lanServer:ip-changed', fn)
  },

  onRemoteDispatch: (
    handler: (msg: { reqId: number; payload: unknown }) => void | Promise<void>,
  ): (() => void) => {
    const fn = (_: Electron.IpcRendererEvent, m: unknown) => {
      void Promise.resolve(
        handler(m as { reqId: number; payload: unknown }),
      )
    }
    ipcRenderer.on('remote:dispatch', fn)
    return () => ipcRenderer.removeListener('remote:dispatch', fn)
  },

  remoteDispatchResult: (
    reqId: number,
    ok: boolean,
    error?: string,
  ): void => {
    ipcRenderer.send('remote:dispatch:result', { reqId, ok, error })
  },

  reportRemotePlaybackSnapshotPatch: (
    patch: Record<string, unknown>,
  ): void => {
    ipcRenderer.send('remote:snapshot:patch', patch)
  },

  getUpdateCheckSchedule: (): Promise<
    'on_startup' | 'daily' | 'hourly' | 'every_5_minutes'
  > => ipcRenderer.invoke('debug:getUpdateCheckSchedule'),

  setUpdateCheckSchedule: (
    schedule: 'on_startup' | 'daily' | 'hourly' | 'every_5_minutes',
  ): Promise<'on_startup' | 'daily' | 'hourly' | 'every_5_minutes'> =>
    ipcRenderer.invoke('debug:setUpdateCheckSchedule', schedule),

  getBuildInfo: (): Promise<{
    isPackaged: boolean
    version: string
    buildHash: string
    builtAt: string
  }> => ipcRenderer.invoke('debug:getBuildInfo'),

  checkForUpdatesNow: (): Promise<
    { ok: true } | { ok: false; reason: string }
  > => ipcRenderer.invoke('debug:checkForUpdatesNow'),
})
