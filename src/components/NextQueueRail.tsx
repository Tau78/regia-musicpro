import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { formatDurationMmSs } from '../lib/formatDurationMmSs.ts'
import { computeNextPlaylistIndex } from '../lib/nextPlaylistIndex.ts'
import { OUTPUT_CROSSFADE_TAIL_SEC } from '../lib/outputCrossfadeSec.ts'
import {
  formatPlaylistDurationLabel,
  usePlaylistMediaDurations,
} from '../hooks/usePlaylistMediaDurations.ts'
import { isStillImagePath } from '../mediaPaths.ts'
import {
  LAUNCHPAD_BANK_COUNT,
  LAUNCHPAD_CELL_COUNT,
  launchPadCellShownLabel,
  migrateLaunchPadBanksFromCells,
  type FloatingPlaylistSession,
  type LaunchPadCell,
} from '../state/floatingPlaylistSession.ts'
import { useRegia } from '../state/RegiaContext.tsx'

const AUDIO_ONLY_EXT = /\.(mp3|wav|aif|aiff|aac|ogg|flac|m4a)$/i

function isAudioOnlyPath(absPath: string): boolean {
  const base = absPath.replace(/\\/g, '/').split('/').pop() ?? ''
  return AUDIO_ONLY_EXT.test(base)
}

function effectiveTrackIndex(
  sess: FloatingPlaylistSession,
  loaded: {
    sessionId: string
    index: number
    launchPadBankIndex?: number
  } | null,
): number {
  if (
    loaded &&
    loaded.sessionId === sess.id &&
    loaded.launchPadBankIndex == null
  ) {
    return loaded.index
  }
  return sess.currentIndex
}

function NextThumb({
  path,
  padColor,
}: {
  path: string | null
  padColor?: string | null
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!path) {
      setUrl(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const u = await window.electronAPI.toFileUrl(path)
        if (!cancelled) setUrl(u)
      } catch {
        if (!cancelled) setUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path])

  if (!path) {
    return (
      <div
        className="preview-next-thumb preview-next-thumb--empty"
        style={
          padColor
            ? ({ ['--next-pad' as string]: padColor } as CSSProperties)
            : undefined
        }
      />
    )
  }

  if (isAudioOnlyPath(path)) {
    return (
      <div
        className="preview-next-thumb preview-next-thumb--audio"
        style={
          padColor
            ? ({ ['--next-pad' as string]: padColor } as CSSProperties)
            : undefined
        }
        aria-hidden
      >
        <span className="preview-next-thumb-audio-glyph">♪</span>
      </div>
    )
  }

  if (isStillImagePath(path)) {
    return (
      <img
        src={url ?? undefined}
        alt=""
        className="preview-next-thumb preview-next-thumb--still"
        draggable={false}
      />
    )
  }

  return <NextVideoHoverThumb url={url} />
}

/** Poster frame di default; in hover riproduce il video (niente decode continuo nel tile). */
function NextVideoHoverThumb({ url }: { url: string | null }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [hover, setHover] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || !url) return
    const seekPoster = () => {
      try {
        const d = el.duration
        if (Number.isFinite(d) && d > 0.08) el.currentTime = 0.04
        else el.currentTime = 0
      } catch {
        /* ignore */
      }
    }
    el.addEventListener('loadeddata', seekPoster)
    return () => el.removeEventListener('loadeddata', seekPoster)
  }, [url])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (hover) void el.play().catch(() => {})
    else {
      el.pause()
      try {
        if (el.readyState >= 1) {
          const d = el.duration
          if (Number.isFinite(d) && d > 0.08) el.currentTime = 0.04
          else el.currentTime = 0
        }
      } catch {
        /* ignore */
      }
    }
  }, [hover])

  return (
    <div
      className="preview-next-thumb-video-wrap"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={() => setHover(false)}
    >
      <video
        ref={ref}
        src={url ?? undefined}
        className={[
          'preview-next-thumb',
          'preview-next-thumb--video',
          hover ? 'preview-next-thumb--video-hover' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        muted
        playsInline
        preload="metadata"
        loop
        aria-hidden
      />
      {!hover ? (
        <span className="preview-next-thumb-hover-hint" aria-hidden>
          Hover · anteprima
        </span>
      ) : null}
    </div>
  )
}

export default function NextQueueRail() {
  const {
    outputTrackListSession,
    playbackControlSession,
    playbackLoadedTrack,
    outputTrackLoopMode,
    previewMediaTimesTick,
    previewMediaTimesRef,
    videoPlaying,
    stillImageDurationSec,
    selectItem,
    setActiveFloatingSession,
    bringFloatingPanelToFront,
    floatingPlaylistSessions,
    playbackArmedNext,
  } = useRegia()

  void previewMediaTimesTick
  const tRef = previewMediaTimesRef.current

  /** In modalità launchpad il «prossimo» è la cella selezionata, non l’elemento lineare in lista. */
  const launchpadArmMode =
    playbackControlSession?.playlistMode === 'launchpad'
  const trackSess = launchpadArmMode ? null : outputTrackListSession
  const list = trackSess?.paths ?? []
  const curIdx = trackSess
    ? effectiveTrackIndex(trackSess, playbackLoadedTrack)
    : 0
  const seqNextIdx =
    trackSess && list.length > 0
      ? computeNextPlaylistIndex(curIdx, list.length, outputTrackLoopMode)
      : null
  const armedForOut =
    playbackArmedNext &&
    trackSess &&
    playbackArmedNext.sessionId === trackSess.id &&
    playbackArmedNext.index >= 0 &&
    playbackArmedNext.index < list.length
      ? playbackArmedNext
      : null
  const effectiveNextIdx = armedForOut
    ? armedForOut.index
    : seqNextIdx
  const nextPath =
    effectiveNextIdx != null &&
    effectiveNextIdx >= 0 &&
    effectiveNextIdx < list.length
      ? list[effectiveNextIdx]!
      : null

  const durMap = usePlaylistMediaDurations(nextPath ? [nextPath] : [])
  const nextDurLabel = nextPath
    ? formatPlaylistDurationLabel(durMap[nextPath], formatDurationMmSs)
    : '—'

  const launchSess = launchpadArmMode
    ? playbackControlSession ?? null
    : !outputTrackListSession &&
        playbackControlSession?.playlistMode === 'launchpad'
      ? playbackControlSession
      : null

  let launchCell: LaunchPadCell | null = null
  let launchSlot = 0
  let launchBank = 0
  if (launchSess?.launchPadCells) {
    launchBank = Math.max(
      0,
      Math.min(LAUNCHPAD_BANK_COUNT - 1, launchSess.launchPadBankIndex ?? 0),
    )
    const banks =
      launchSess.launchPadBanks ??
      migrateLaunchPadBanksFromCells(launchSess.launchPadCells)
    launchSlot = Math.max(
      0,
      Math.min(LAUNCHPAD_CELL_COUNT - 1, launchSess.currentIndex),
    )
    launchCell = banks[launchBank]![launchSlot] ?? null
  }

  const launchPath = launchCell?.samplePath ?? null
  const launchTitle = launchCell ? launchPadCellShownLabel(launchCell) : '—'
  const launchPadColor = launchCell?.padColor ?? null

  const countdownLabel = (() => {
    if (trackSess && videoPlaying) {
      if (outputTrackLoopMode === 'one') {
        return 'Loop brano: nessun avanzamento in coda'
      }
      if (nextPath) {
        const d = tRef.duration
        const c = tRef.currentTime
        if (!Number.isFinite(d) || d <= 0) return 'Durata in corso…'
        const remaining = Math.max(0, d - c)
        const cross = Boolean(trackSess.playlistCrossfade)
        const head = Math.max(
          0,
          remaining - (cross ? OUTPUT_CROSSFADE_TAIL_SEC : 0),
        )
        return `Entra tra ${formatDurationMmSs(head)}`
      }
    }
    if (trackSess && nextPath && !videoPlaying) {
      if (outputTrackLoopMode === 'one') {
        return 'Loop brano: nessun avanzamento in coda'
      }
      return 'In pausa — avanzamento al play / fine brano'
    }
    if (launchSess && launchPath) {
      return 'Trigger manuale (pad / tasto)'
    }
    return null
  })()

  const focusFloatingPanel = useCallback(
    (sessionId: string) => {
      if (!floatingPlaylistSessions.some((s) => s.id === sessionId)) return
      setActiveFloatingSession(sessionId)
      bringFloatingPanelToFront(sessionId)
    },
    [
      bringFloatingPanelToFront,
      floatingPlaylistSessions,
      setActiveFloatingSession,
    ],
  )

  const onRailClick = useCallback(() => {
    if (trackSess && effectiveNextIdx != null) {
      selectItem(effectiveNextIdx, trackSess.id)
      focusFloatingPanel(trackSess.id)
      return
    }
    if (launchSess && launchCell?.samplePath) {
      selectItem(launchSlot, launchSess.id)
      focusFloatingPanel(launchSess.id)
    }
  }, [
    focusFloatingPanel,
    launchCell?.samplePath,
    launchSess,
    launchSlot,
    effectiveNextIdx,
    selectItem,
    trackSess,
  ])

  const railTitle =
    nextPath != null
      ? nextPath.replace(/\\/g, '/').split('/').pop() ?? nextPath
      : launchPath
        ? launchTitle
        : trackSess && list.length > 0
          ? 'Nessun brano successivo'
          : null

  const disabled =
    trackSess != null ? effectiveNextIdx == null : launchSess == null

  if (!trackSess && !launchSess) {
    return (
      <aside
        className="preview-next-rail preview-next-rail--idle"
        aria-label="Anteprima del prossimo elemento (solo regia)"
      >
        <span className="preview-bus-chip preview-bus-chip--next">
          Anteprima pross.
        </span>
        <p className="preview-next-rail-hint">
          Apri una playlist a elenco o un launchpad per vedere il prossimo elemento.
        </p>
      </aside>
    )
  }

  const nextChipClass = [
    'preview-bus-chip',
    launchSess ? 'preview-bus-chip--launchpad' : 'preview-bus-chip--next',
  ].join(' ')
  const nextChipLabel = launchSess ? 'Launch · pross.' : 'Anteprima pross.'

  return (
    <aside
      className="preview-next-rail"
      aria-label={
        launchSess
          ? 'Anteprima cella launchpad selezionata (solo regia)'
          : 'Anteprima brano successivo in coda (solo regia)'
      }
    >
      <span className={nextChipClass} title="Non inviato al pubblico finché non usi play / avanti">
        {nextChipLabel}
      </span>
      <button
        type="button"
        className="preview-next-rail-hit"
        disabled={Boolean(disabled)}
        onClick={onRailClick}
        title={
          disabled
            ? undefined
            : 'Seleziona nel pannello (non va in onda finché non usi play / avanti)'
        }
      >
        <NextThumb
          path={nextPath ?? launchPath}
          padColor={!nextPath ? launchPadColor : null}
        />
        <div className="preview-next-rail-meta">
          <span className="preview-next-rail-title" title={railTitle ?? undefined}>
            {railTitle ?? '—'}
          </span>
          {nextPath ? (
            <span className="preview-next-rail-dur">
              Durata {nextDurLabel}
              {stillImageDurationSec > 0 && isStillImagePath(nextPath) ? (
                <span className="preview-next-rail-dur-note">
                  {' '}
                  (slide {formatDurationMmSs(stillImageDurationSec)} in uscita)
                </span>
              ) : null}
            </span>
          ) : launchPath ? (
            <span className="preview-next-rail-dur">
              Slot {launchSlot + 1} · banco {launchBank + 1}
            </span>
          ) : (
            <span className="preview-next-rail-dur">Slot vuoto</span>
          )}
          {armedForOut && nextPath ? (
            <span className="preview-next-rail-ready">
              Pronto — decode in anteprima
            </span>
          ) : null}
        </div>
      </button>
      {countdownLabel ? (
        <p className="preview-next-rail-countdown" aria-live="polite">
          {countdownLabel}
        </p>
      ) : null}
    </aside>
  )
}
