export type PlaybackCommand =
  | { type: 'load'; src: string; crossfade?: boolean }
  | { type: 'seek'; seconds: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'setMuted'; muted: boolean }
  /** Volume lineare 0–1 sui video in uscita (il mute globale resta indipendente). */
  | { type: 'setVolume'; volume: number }
  /** `''` = dispositivo predefinito di sistema (setSinkId). */
  | { type: 'setSinkId'; sinkId: string }
  | { type: 'setLoopOne'; loop: boolean }
  | { type: 'setCrossfade'; enabled: boolean }
  /** Durata immagine fissa in playlist (secondi, clamp 1–600 in uscita). */
  | { type: 'setStillImageDurationSec'; seconds: number }
