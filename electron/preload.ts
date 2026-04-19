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

  selectFolder: (): Promise<string[] | null> =>
    ipcRenderer.invoke('dialog:selectFolder'),

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

  playlistsList: (): Promise<
    Array<{
      id: string
      label: string
      trackCount: number
      updatedAt: string
      totalDurationSec?: number
      themeColor?: string
      playlistMode?: 'tracks' | 'launchpad' | 'chalkboard'
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
