export type PlaybackCommand =
  | { type: 'load'; src: string; crossfadeMs?: number }
  | { type: 'seek'; seconds: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'programVacant' }
  | { type: 'setMuted'; muted: boolean }
  | { type: 'setVolume'; volume: number }
  | { type: 'setSinkId'; sinkId: string }
  | { type: 'setLoopOne'; loop: boolean }
  | { type: 'setCrossfadeMs'; ms: number }
  | { type: 'setCrossfade'; enabled: boolean }
  | { type: 'setStillImageDurationSec'; seconds: number }
  /** Layer immagine sopra il video in uscita (Chalkboard). */
  | {
      type: 'chalkboardLayer'
      visible: boolean
      src?: string
      composite?: 'solid' | 'transparent'
      boardBackgroundColor?: string
    }
  | { type: 'playlistWatermark'; visible: boolean; src?: string }
  | {
      type: 'setOutputIdleCap'
      mode: 'black' | 'color' | 'image'
      color?: string
      imagePath?: string | null
    }
  | { type: 'setOutputProgramLogoVisible'; visible: boolean }
  | { type: 'sottofondoLoad'; src: string; loop?: boolean; crossfadeMs?: number }
  | { type: 'sottofondoPlay' }
  | { type: 'sottofondoPause' }
  | { type: 'sottofondoStop' }
  | { type: 'sottofondoSetVolume'; volume: number }
  | { type: 'sottofondoSetMuted'; muted: boolean }
