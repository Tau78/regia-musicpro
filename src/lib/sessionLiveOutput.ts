import {
  isTracksPlaylistMode,
  normalizeChalkboardOutputMode,
  type FloatingPlaylistSession,
} from '../state/floatingPlaylistSession.ts'

export type SessionLiveOutputCtx = {
  videoOutputSessionId: string | null
  videoPlaying: boolean
  launchpadAudioPlaying: boolean
  playbackLoadedTrack: { sessionId: string } | null
}

/** True se video o audio di questo pannello è in uscita verso program / Schermo 2. */
export function sessionIsLiveOnRegiaOutput(
  s: FloatingPlaylistSession,
  ctx: SessionLiveOutputCtx,
): boolean {
  if (s.playlistMode === 'launchpad') {
    return (
      ctx.launchpadAudioPlaying &&
      ctx.playbackLoadedTrack?.sessionId === s.id
    )
  }
  if (s.playlistMode === 'chalkboard') {
    return (
      normalizeChalkboardOutputMode(
        s.chalkboardOutputMode,
        (s as { chalkboardOutputToProgram?: boolean }).chalkboardOutputToProgram,
      ) !== 'off'
    )
  }
  if (isTracksPlaylistMode(s.playlistMode)) {
    return ctx.videoOutputSessionId === s.id && ctx.videoPlaying
  }
  return ctx.videoOutputSessionId === s.id && ctx.videoPlaying
}
