import { contextBridge, ipcRenderer } from 'electron'
import type { PlaybackCommand } from './types'

contextBridge.exposeInMainWorld('electronAPI', {
  toFileUrl: (absPath: string): Promise<string> =>
    ipcRenderer.invoke('util:toFileUrl', absPath),

  selectFolder: (): Promise<string[] | null> =>
    ipcRenderer.invoke('dialog:selectFolder'),

  selectMediaFiles: (): Promise<string[] | null> =>
    ipcRenderer.invoke('dialog:selectMediaFiles'),

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
    }>
  > => ipcRenderer.invoke('playlists:list'),

  playlistsSave: (opts: {
    id?: string
    label: string
    paths: string[]
    crossfade?: boolean
    themeColor?: string | null
  }): Promise<{ id: string }> => ipcRenderer.invoke('playlists:save', opts),

  playlistsLoad: (
    id: string,
  ): Promise<{
    id: string
    label: string
    paths: string[]
    crossfade: boolean
    themeColor: string
  } | null> =>
    ipcRenderer.invoke('playlists:load', id),

  playlistsDelete: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('playlists:delete', id),

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
})
