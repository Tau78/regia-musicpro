import type { PlaybackCommand } from './playbackTypes'
import type { SavedPlaylistMeta } from './playlistTypes'

export {}

declare global {
  interface Window {
    electronAPI: {
      launchpadBaseKitPaths: () => Promise<string[]>
      launchpadSfxKitPaths: () => Promise<string[]>
      toFileUrl: (absPath: string) => Promise<string>
      selectFolder: () => Promise<string[] | null>
      /** Dialog multi-file (stesse estensioni della cartella). */
      selectMediaFiles: (opts?: {
        context?: 'playlist' | 'launchpad'
      }) => Promise<string[] | null>
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
      }) => Promise<{ id: string }>
      playlistsPatchTotalDuration: (
        id: string,
        totalDurationSec: number,
      ) => Promise<boolean>
      playlistsLoad: (
        id: string,
      ) => Promise<{
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
      } | null>
      playlistsDelete: (id: string) => Promise<boolean>
      playlistsSetOrder: (orderedIds: string[]) => Promise<boolean>
      playlistsDuplicate: (id: string) => Promise<{ id: string } | null>
      setOutputPresentationVisible: (visible: boolean) => Promise<void>
      getOutputResolution: () => Promise<{ width: number; height: number }>
      setOutputResolution: (opts: {
        width: number
        height: number
      }) => Promise<{ ok: boolean }>

      reportOutputAudioLevel?: (level: number) => void
      onOutputAudioLevel?: (handler: (level: number) => void) => () => void

      setRegiaWindowAlwaysOnTop: (on: boolean) => Promise<void>

      getRegiaContentBounds: () => Promise<{
        x: number
        y: number
        width: number
        height: number
      } | null>

      openPlaylistFloaterWindow: (opts: {
        sessionId: string
        x: number
        y: number
        width: number
        height: number
      }) => Promise<{ ok: boolean }>

      closePlaylistFloaterWindow: (sessionId: string) => Promise<{ ok: boolean }>

      playlistFloaterBroadcastState: (
        sessionId: string,
        payload: unknown,
      ) => Promise<{ ok: boolean }>

      playlistFloaterSendAction: (method: string, args: unknown[]) => void

      onPlaylistFloaterState: (handler: (payload: unknown) => void) => () => void

      onPlaylistFloaterActionFromMain: (
        handler: (msg: {
          sessionId: string
          method: string
          args: unknown[]
        }) => void,
      ) => () => void

      onPlaylistFloaterOsClosedFromMain: (
        handler: (msg: {
          sessionId: string
          bounds: { x: number; y: number; width: number; height: number } | null
        }) => void,
      ) => () => void
    }
  }
}
