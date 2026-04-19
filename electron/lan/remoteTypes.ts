/** Messaggi WS envelope (channel per compatibilità Quiz futuro). */
export type RemoteWsEnvelopeV1 = {
  v: 1
  channel: 'remote'
  type: string
  payload?: unknown
}

/** Snapshot riproduzione inviato al telecomando. */
export type RemoteLoopModeV1 = 'off' | 'one' | 'all'

export type RemotePlaybackSnapshotV1 = {
  v: 1
  /** Programma (finestra Output): in riproduzione. */
  programPlaying: boolean
  programTitle: string | null
  programPositionSec: number | null
  programDurationSec: number | null
  /** Launchpad: audio cue attivo (da regia). */
  launchpadActive: boolean
  launchpadTitle: string | null
  launchpadSlot: number | null
  outputVolume: number
  /** Loop effettivo sulla playlist che comanda l’uscita (come pannello desktop). */
  playlistLoopMode: RemoteLoopModeV1
  /** Se è possibile Annulla (⌘Z). */
  canUndo: boolean
}

export type RemoteDispatchPayload =
  | { type: 'loadSavedPlaylist'; savedId: string }
  | { type: 'playTrack'; savedId: string; index: number }
  | {
      type: 'playPad'
      savedId: string
      slotIndex: number
      /** Allineato al launchpad in regia: `down`/`up` per hold-cue; omesso = tap singolo (toggle/play). */
      pointerPhase?: 'down' | 'up' | 'cancel'
    }
  | {
      type: 'transport'
      action:
        | 'togglePlay'
        | 'prev'
        | 'next'
        | 'setVolume'
        | 'undo'
        | 'setLoopMode'
      volume?: number
      loopMode?: RemoteLoopModeV1
    }
