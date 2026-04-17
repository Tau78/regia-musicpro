import type { PlaybackCommand } from './playbackTypes'
import type { SavedPlaylistMeta } from './playlistTypes'

export {}

declare global {
  interface Window {
    electronAPI: {
      toFileUrl: (absPath: string) => Promise<string>
      selectFolder: () => Promise<string[] | null>
      /** Dialog multi-file (stesse estensioni della cartella). */
      selectMediaFiles: () => Promise<string[] | null>
      sendPlayback: (cmd: PlaybackCommand) => Promise<void>
      onPlaybackCommand: (handler: (cmd: PlaybackCommand) => void) => () => void
      notifyVideoEnded: () => void
      onVideoEndedFromOutput: (handler: () => void) => () => void
      playlistsList: () => Promise<SavedPlaylistMeta[]>
      playlistsSave: (opts: {
        id?: string
        label: string
        paths: string[]
        crossfade?: boolean
        themeColor?: string | null
      }) => Promise<{ id: string }>
      playlistsLoad: (
        id: string,
      ) => Promise<{
        id: string
        label: string
        paths: string[]
        crossfade: boolean
        themeColor: string
      } | null>
      playlistsDelete: (id: string) => Promise<boolean>
      playlistsDuplicate: (id: string) => Promise<{ id: string } | null>
      setOutputPresentationVisible: (visible: boolean) => Promise<void>
      getOutputResolution: () => Promise<{ width: number; height: number }>
      setOutputResolution: (opts: {
        width: number
        height: number
      }) => Promise<{ ok: boolean }>
    }
  }
}
