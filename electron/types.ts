export type PlaybackCommand =
  | { type: 'load'; src: string; crossfade?: boolean }
  | { type: 'seek'; seconds: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'programVacant' }
  | { type: 'setMuted'; muted: boolean }
  | { type: 'setVolume'; volume: number }
  | { type: 'setSinkId'; sinkId: string }
  | { type: 'setLoopOne'; loop: boolean }
  | { type: 'setCrossfade'; enabled: boolean }
  | { type: 'setStillImageDurationSec'; seconds: number }
  /** Layer immagine sopra il video in uscita (Chalkboard). */
  | {
      type: 'chalkboardLayer'
      visible: boolean
      src?: string
      composite?: 'solid' | 'transparent'
    }
  | {
      type: 'setOutputIdleCap'
      mode: 'black' | 'color' | 'image'
      color?: string
      imagePath?: string | null
    }
