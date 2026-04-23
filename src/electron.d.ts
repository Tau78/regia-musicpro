import type { PlaybackCommand } from './playbackTypes'
import type { SavedPlaylistMeta } from './playlistTypes'

export {}

declare global {
  interface Window {
    electronAPI: {
      launchpadBaseKitPaths: () => Promise<string[]>
      launchpadSfxKitPaths: () => Promise<string[]>
      toFileUrl: (absPath: string) => Promise<string>
      /** Oggetto consigliato; in alternativa solo `paths` (retrocompatibilità). */
      selectFolder: () => Promise<
        | { folder: string; paths: string[] }
        | string[]
        | null
      >
      /** Aggiorna l’elenco file quando cambia il contenuto della cartella (solo cartella aperta con «Apri cartella»). */
      playlistFolderWatchStart: (
        sessionId: string,
        folderPath: string,
      ) => Promise<{ ok: boolean }>
      playlistFolderWatchStop: (sessionId: string) => Promise<void>
      onPlaylistFolderMediaPathsUpdated: (
        handler: (msg: {
          sessionId: string
          folder: string
          paths: string[]
        }) => void,
      ) => () => void
      /** Dialog singolo file PNG per watermark playlist in uscita. */
      selectPlaylistWatermarkPng: () => Promise<string | null>
      /** Dialog multi-file (stesse estensioni della cartella). */
      chalkboardEnsureBanks: (opts: {
        folderBaseName: string
        draft: boolean
        width: number
        height: number
        backgroundColor?: string
      }) => Promise<string[]>

      chalkboardWriteBankDataUrl: (opts: {
        absPath: string
        dataUrl: string
      }) => Promise<{ ok: true }>

      selectMediaFiles: (opts?: {
        context?: 'playlist' | 'launchpad' | 'chalkboard'
      }) => Promise<string[] | null>
      sendPlayback: (cmd: PlaybackCommand) => Promise<void>
      onPlaybackCommand: (handler: (cmd: PlaybackCommand) => void) => () => void
      notifyVideoEnded: () => void
      onVideoEndedFromOutput: (handler: () => void) => () => void
      notifySottofondoEnded: () => void
      onSottofondoEndedFromOutput: (handler: () => void) => () => void
      playlistsList: () => Promise<SavedPlaylistMeta[]>
      playlistsSave: (opts: {
        id?: string
        label: string
        paths: string[]
        crossfade?: boolean
        crossfadeSec?: 0 | 3 | 6
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
        chalkboardMigrateDraftSessionId?: string | null
        totalDurationSec?: number
        /** Path assoluto PNG watermark in uscita (opzionale). */
        watermarkPngPath?: string | null
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
        crossfadeSec: 0 | 3 | 6
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

      getOutputIdleCap?: () => Promise<{
        mode: 'black' | 'color' | 'image'
        color: string
        imagePath: string | null
      }>
      setOutputIdleCap?: (v: {
        mode: 'black' | 'color' | 'image'
        color: string
        imagePath: string | null
      }) => Promise<{ ok: true }>
      ensureOutputIdleCap?: (fallbackFromRegiaLs: unknown) => Promise<{
        mode: 'black' | 'color' | 'image'
        color: string
        imagePath: string | null
      }>

      getOutputProgramLogoVisible?: () => Promise<{ visible: boolean }>
      setOutputProgramLogoVisible?: (
        visible: boolean,
      ) => Promise<{ ok: true }>

      reportOutputAudioLevel?: (level: number) => void
      onOutputAudioLevel?: (handler: (level: number) => void) => () => void

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

      /** Chiede alla finestra Regia di inviare subito uno snapshot IPC (finestra floater). */
      playlistFloaterRequestState: () => Promise<{ ok: boolean }>

      playlistFloaterSendAction: (method: string, args: unknown[]) => void

      playlistFloaterSetBounds: (partial: {
        x?: number
        y?: number
        width?: number
        height?: number
      }) => Promise<{ ok: boolean }>

      onPlaylistFloaterState: (handler: (payload: unknown) => void) => () => void

      onPlaylistFloaterRequestStateFromMain: (
        handler: (msg: { sessionId: string }) => void,
      ) => () => void

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

      lanServerStart: (opts?: { port?: number }) => Promise<{
        running: true
        port: number
        token: string
        lanUrl: string | null
        localUrl: string
        remotePath: string
      }>
      lanServerStop: () => Promise<{ running: false }>
      lanServerStatus: () => Promise<{
        running: boolean
        port: number
        token: string | null
        lanUrl: string | null
        localUrl: string | null
        remotePath: string
        primaryLanIp: string | null
        firewallHint: string
      }>
      onLanServerIpChanged: (
        handler: (msg: {
          ip: string | null
          lanUrl: string | null
          localUrl: string | null
        }) => void,
      ) => () => void
      onRemoteDispatch: (
        handler: (msg: {
          reqId: number
          payload: unknown
        }) => void | Promise<void>,
      ) => () => void
      remoteDispatchResult: (
        reqId: number,
        ok: boolean,
        error?: string,
      ) => void
      reportRemotePlaybackSnapshotPatch: (
        patch: Record<string, unknown>,
      ) => void

      getUpdateCheckSchedule: () => Promise<
        'on_startup' | 'daily' | 'hourly' | 'every_5_minutes'
      >
      setUpdateCheckSchedule: (
        schedule: 'on_startup' | 'daily' | 'hourly' | 'every_5_minutes',
      ) => Promise<'on_startup' | 'daily' | 'hourly' | 'every_5_minutes'>

      getBuildInfo: () => Promise<{
        isPackaged: boolean
        version: string
        buildHash: string
        builtAt: string
      }>

      checkForUpdatesNow: () => Promise<
        { ok: true } | { ok: false; reason: string }
      >

      regiaVideoCloudGetStatus: () => Promise<{
        configured: boolean
        rootPath: string | null
        rootValid: boolean
        playlistDir: string | null
        playlistDirWritable: boolean
        diskFreeRatio: number | null
      }>
      regiaVideoCloudSetRoot: (
        rootPath: string | null,
      ) => Promise<{ ok: true } | { ok: false; error: string }>
      regiaVideoCloudPickRootFolder: () => Promise<
        | { ok: true; path: string }
        | { ok: false; path: null; error?: string }
      >
      regiaVideoCloudList: () => Promise<
        Array<{
          fileName: string
          label: string
          playlistMode: 'tracks' | 'launchpad' | 'chalkboard'
          savedAt: string
        }>
      >
      regiaVideoCloudLoadFile: (
        fileName: string,
      ) => Promise<
        | {
            ok: true
            data: {
              label: string
              paths: string[]
              crossfadeSec: 0 | 3 | 6
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
      >
      regiaVideoCloudSaveFile: (opts: {
        fileBaseName: string
        payload: {
          label: string
          paths: string[]
          crossfade?: boolean
          crossfadeSec?: 0 | 3 | 6
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
      }) => Promise<
        | { ok: true; fileName: string }
        | { ok: false; error: string; pathsOutsideRoot?: string[] }
      >
      regiaVideoCloudReadiness: (
        manifestJson?: string | null,
      ) => Promise<{
        ok: boolean
        missingFiles: string[]
        warnings: string[]
        diskFreeRatio: number | null
      }>
      regiaVideoCloudSuggestFileName: (label: string) => Promise<string>
      regiaVideoCloudExportZip: (
        fileName: string,
      ) => Promise<{ ok: true } | { ok: false; error: string }>
    }
  }
}
