import { isStillImagePath } from './mediaPaths.ts'
import { probeVideoDurationSec } from './probeMediaDurationSec.ts'

export async function probeFileDurationSec(
  absPath: string,
): Promise<number | null> {
  if (isStillImagePath(absPath)) return null
  try {
    const url = await window.electronAPI.toFileUrl(absPath)
    const raw = await probeVideoDurationSec(url)
    if (
      Number.isFinite(raw) &&
      raw > 0 &&
      raw !== Number.POSITIVE_INFINITY
    ) {
      return raw
    }
  } catch {
    /* file mancante o codec non supportato */
  }
  return null
}

/** Somma durate note (secondi); file senza durata valida contano 0. */
export async function sumMediaDurationsSec(
  paths: readonly string[],
  concurrency = 4,
): Promise<number> {
  const uniq = [
    ...new Set(paths.filter((p) => typeof p === 'string' && p.length > 0)),
  ]
  if (!uniq.length) return 0
  let sum = 0
  let next = 0
  const pick = () => {
    const i = next++
    return i < uniq.length ? uniq[i]! : null
  }
  async function worker() {
    for (;;) {
      const p = pick()
      if (!p) break
      const d = await probeFileDurationSec(p)
      if (d != null) sum += d
    }
  }
  const n = Math.min(concurrency, uniq.length)
  await Promise.all(Array.from({ length: n }, () => worker()))
  return sum
}

type LaunchCell = { samplePath: string | null }

export async function totalDurationSecForPlaylistSave(opts: {
  playlistMode?: 'tracks' | 'launchpad'
  paths: string[]
  launchPadCells?: readonly LaunchCell[] | null
}): Promise<number> {
  if (opts.playlistMode === 'launchpad') {
    const samplePaths = (opts.launchPadCells ?? [])
      .map((c) => c.samplePath)
      .filter((p): p is string => Boolean(p))
    return sumMediaDurationsSec(samplePaths)
  }
  return sumMediaDurationsSec(opts.paths)
}
