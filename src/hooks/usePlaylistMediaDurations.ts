import { useEffect, useRef, useState } from 'react'
import { isStillImagePath } from '../mediaPaths.ts'
import { probeVideoDurationSec } from '../lib/probeMediaDurationSec.ts'

export type PlaylistDurationCell = 'pending' | number | null

function pathsFingerprint(paths: readonly string[]): string {
  return JSON.stringify(paths)
}

const MAX_CONCURRENT = 4

/**
 * Per ogni percorso in `paths`, durata in secondi dai metadati (`<video>` + `toFileUrl`).
 * Immagini fisse → `null`; in attesa di metadati → `'pending'`.
 */
export function usePlaylistMediaDurations(
  paths: readonly string[],
): Record<string, PlaylistDurationCell> {
  const [map, setMap] = useState<Record<string, PlaylistDurationCell>>({})
  const fp = pathsFingerprint(paths)
  const probing = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    const list = JSON.parse(fp) as string[]
    let needList: string[] = []

    setMap((prev) => {
      const next: Record<string, PlaylistDurationCell> = {}
      for (const p of list) {
        const o = prev[p]
        if (typeof o === 'number' || o === null) next[p] = o
        else next[p] = 'pending'
      }
      needList = list.filter((p) => next[p] === 'pending')
      return next
    })

    const runOne = async (absPath: string) => {
      if (cancelled) return
      if (isStillImagePath(absPath)) {
        if (!cancelled) setMap((prev) => ({ ...prev, [absPath]: null }))
        return
      }
      try {
        const url = await window.electronAPI.toFileUrl(absPath)
        if (cancelled) return
        const raw = await probeVideoDurationSec(url)
        if (cancelled) return
        const ok =
          Number.isFinite(raw) && raw > 0 && raw !== Number.POSITIVE_INFINITY
        if (!cancelled) setMap((prev) => ({ ...prev, [absPath]: ok ? raw : null }))
      } catch {
        if (!cancelled) setMap((prev) => ({ ...prev, [absPath]: null }))
      } finally {
        probing.current.delete(absPath)
      }
    }

    const queue = needList.filter((p) => !probing.current.has(p))
    let active = 0

    const pump = () => {
      if (cancelled) return
      while (active < MAX_CONCURRENT && queue.length > 0) {
        const p = queue.shift()!
        if (probing.current.has(p)) continue
        probing.current.add(p)
        active++
        void runOne(p).finally(() => {
          active--
          pump()
        })
      }
    }

    pump()

    return () => {
      cancelled = true
      probing.current.clear()
    }
  }, [fp])

  return map
}

export function formatPlaylistDurationLabel(
  v: PlaylistDurationCell | undefined,
  formatMmSs: (sec: number) => string,
): string {
  if (v === undefined || v === 'pending') return '…'
  if (v === null || !Number.isFinite(v) || v <= 0) return '—'
  return formatMmSs(v)
}
