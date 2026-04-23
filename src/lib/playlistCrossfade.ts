/** Dissolvenza tra brani: spenta, 3 s o 6 s (playlist classica e sottofondo). */
export type PlaylistCrossfadeSec = 0 | 3 | 6

export function normalizePlaylistCrossfadeSec(
  raw: unknown,
  legacyBool?: unknown,
): PlaylistCrossfadeSec {
  if (raw === 0 || raw === 3 || raw === 6) return raw
  if (typeof raw === 'string') {
    const n = Number(raw)
    if (n === 0 || n === 3 || n === 6) return n as PlaylistCrossfadeSec
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const r = Math.round(raw)
    if (r === 0 || r === 3 || r === 6) return r as PlaylistCrossfadeSec
  }
  if (typeof legacyBool === 'boolean') return legacyBool ? 3 : 0
  if (typeof raw === 'boolean') return raw ? 3 : 0
  return 3
}

export function cyclePlaylistCrossfadeSec(
  cur: PlaylistCrossfadeSec,
): PlaylistCrossfadeSec {
  if (cur === 0) return 3
  if (cur === 3) return 6
  return 0
}

export function playlistCrossfadeSecToMs(sec: PlaylistCrossfadeSec): number {
  return sec * 1000
}

/** Margine dopo la dissolvenza (come il +40 ms in OutputApp). */
export function playlistCrossfadeTailSec(sec: PlaylistCrossfadeSec): number {
  if (sec === 0) return 0
  return sec + 0.04
}
