import { contextBridge, ipcRenderer } from 'electron'
import type { PlaybackCommand } from './types'

contextBridge.exposeInMainWorld('electronAPI', {
  /** Percorsi assoluti dei sample del kit «Launchpad base» (vuoto se cartella assente). */
  launchpadBaseKitPaths: (): Promise<string[]> =>
    ipcRenderer.invoke('launchpad-base:kitPaths'),

  /** Kit «reazioni / SFX» in public/launchpad-sfx (vuoto se cartella assente). */
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
      playlistMode?: 'tracks' | 'launchpad'
    }>
  > => ipcRenderer.invoke('playlists:list'),

  playlistsSave: (opts: {
    id?: string
    label: string
    paths: string[]
    crossfade?: boolean
    loopMode?: 'off' | 'one' | 'all'
    themeColor?: string | null
    playlistMode?: 'tracks' | 'launchpad'
    launchPadCells?: Array<{
      samplePath: string | null
      padColor: string
      padGain: number
      padKeyCode?: string | null
      padKeyMode?: 'play' | 'toggle'
    }>
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
    playlistMode: 'tracks' | 'launchpad'
    launchPadCells: Array<{
      samplePath: string | null
      padColor: string
      padGain: number
      padKeyCode?: string | null
      padKeyMode?: 'play' | 'toggle'
    }>
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

  reportOutputAudioLevel: (level: number): void => {
    ipcRenderer.send('output:audio-level', level)
  },

  onOutputAudioLevel: (handler: (level: number) => void): (() => void) => {
    const fn = (_: Electron.IpcRendererEvent, level: number) =>
      handler(typeof level === 'number' && Number.isFinite(level) ? level : 0)
    ipcRenderer.on('regia:output-audio-level', fn)
    return () => ipcRenderer.removeListener('regia:output-audio-level', fn)
  },

  /** Finestra regia sopra le altre app; si spegne quando nessun pannello ha il pin attivo. */
  setRegiaWindowAlwaysOnTop: (on: boolean): Promise<void> =>
    ipcRenderer.invoke('regia:setWindowAlwaysOnTop', on),
})
