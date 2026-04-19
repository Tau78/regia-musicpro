import {
  isTracksPlaylistMode,
  type FloatingPlaylistSession,
} from '../state/floatingPlaylistSession.ts'

/**
 * Stessa logica di `pathsRef` in RegiaContext: quale sessione a elenco comanda l’uscita video.
 */
export function deriveOutputTrackListSession(
  sessions: FloatingPlaylistSession[],
  videoOutputSessionId: string | null,
  playbackSessionId: string | null,
): FloatingPlaylistSession | null {
  const videoS =
    videoOutputSessionId &&
    sessions.some((s) => s.id === videoOutputSessionId)
      ? sessions.find((s) => s.id === videoOutputSessionId)
      : null
  if (videoS && isTracksPlaylistMode(videoS.playlistMode)) return videoS
  const pb =
    playbackSessionId &&
    sessions.some((s) => s.id === playbackSessionId)
      ? sessions.find((s) => s.id === playbackSessionId)
      : null
  if (pb && isTracksPlaylistMode(pb.playlistMode)) return pb
  return null
}
