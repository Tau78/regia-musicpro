export type PlaybackCommand =
  | { type: 'load'; src: string; crossfade?: boolean }
  | { type: 'seek'; seconds: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'setMuted'; muted: boolean }
  | { type: 'setVolume'; volume: number }
  | { type: 'setSinkId'; sinkId: string }
  | { type: 'setLoopOne'; loop: boolean }
  | { type: 'setCrossfade'; enabled: boolean }
