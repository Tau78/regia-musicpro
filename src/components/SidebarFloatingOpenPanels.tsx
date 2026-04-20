import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
} from 'react'
import { previewHintSidebarOpenPanelRow } from '../lib/panelPreviewHints.ts'
import { sessionIsLiveOnRegiaOutput } from '../lib/sessionLiveOutput.ts'
import type { FloatingPlaylistSession } from '../state/floatingPlaylistSession.ts'
import { useRegia } from '../state/RegiaContext.tsx'

const LS_FLOATING_SIDEBAR_ORDER = 'regia-sidebar-floating-open-order'

function readOrderFromLs(): string[] {
  try {
    const raw = localStorage.getItem(LS_FLOATING_SIDEBAR_ORDER)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0)
  } catch {
    return []
  }
}

function persistOrderToLs(ids: string[]) {
  try {
    if (!ids.length) localStorage.removeItem(LS_FLOATING_SIDEBAR_ORDER)
    else localStorage.setItem(LS_FLOATING_SIDEBAR_ORDER, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

function mergeFloatingSidebarOrder(
  persisted: readonly string[],
  activeIds: readonly string[],
): string[] {
  const active = new Set(activeIds)
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of persisted) {
    if (active.has(id) && !seen.has(id)) {
      out.push(id)
      seen.add(id)
    }
  }
  for (const id of activeIds) {
    if (!seen.has(id)) {
      out.push(id)
      seen.add(id)
    }
  }
  return out
}

function reorderIds(ids: string[], from: number, to: number): string[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= ids.length ||
    to >= ids.length
  ) {
    return ids
  }
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  const insertAt = from < to ? to - 1 : to
  next.splice(insertAt, 0, moved)
  return next
}

function IconSavedCardLaunchpad() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
      <rect x="2" y="2" width="9" height="9" rx="2" fill="#e8435c" />
      <rect x="13" y="2" width="9" height="9" rx="2" fill="#27ae60" />
      <rect x="2" y="13" width="9" height="9" rx="2" fill="#2980ef" />
      <rect x="13" y="13" width="9" height="9" rx="2" fill="#f39c12" />
    </svg>
  )
}

function IconSavedCardChalkboard() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
      <rect
        x="3"
        y="4"
        width="18"
        height="14"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <path
        d="M7 18h10"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconClosePanel() {
  return (
    <svg
      className="saved-playlists-icon-svg"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        d="M6 6l12 12M18 6L6 18"
      />
    </svg>
  )
}

export default function SidebarFloatingOpenPanels() {
  const {
    floatingPlaylistSessions,
    playlistFloaterOsSessionIds,
    setActiveFloatingSession,
    openFloatingPlaylist,
    removeFloatingPlaylist,
    floatingCloseWouldInterruptPlay,
    videoOutputSessionId,
    videoPlaying,
    launchpadAudioPlaying,
    playbackLoadedTrack,
  } = useRegia()

  const inAppSessions = useMemo(
    () =>
      floatingPlaylistSessions.filter(
        (s) => !playlistFloaterOsSessionIds.includes(s.id),
      ),
    [floatingPlaylistSessions, playlistFloaterOsSessionIds],
  )

  const activeIds = useMemo(
    () => inAppSessions.map((s) => s.id),
    [inAppSessions],
  )

  const activeKey = activeIds.join('\u0001')

  const [cardOrder, setCardOrder] = useState<string[]>(() =>
    mergeFloatingSidebarOrder(readOrderFromLs(), []),
  )

  useEffect(() => {
    setCardOrder((prev) => mergeFloatingSidebarOrder(prev, activeIds))
  }, [activeKey, activeIds])

  const sessionById = useMemo(() => {
    const m = new Map<string, FloatingPlaylistSession>()
    for (const s of inAppSessions) m.set(s.id, s)
    return m
  }, [inAppSessions])

  const orderedIds = useMemo(
    () => mergeFloatingSidebarOrder(cardOrder, activeIds),
    [cardOrder, activeIds],
  )

  useEffect(() => {
    persistOrderToLs(cardOrder)
  }, [cardOrder])

  const liveCtx = useMemo(
    () => ({
      videoOutputSessionId,
      videoPlaying,
      launchpadAudioPlaying,
      playbackLoadedTrack,
    }),
    [
      videoOutputSessionId,
      videoPlaying,
      launchpadAudioPlaying,
      playbackLoadedTrack,
    ],
  )

  const focusSession = useCallback(
    (sessionId: string) => {
      if (!sessionId) return
      setActiveFloatingSession(sessionId)
      openFloatingPlaylist()
    },
    [setActiveFloatingSession, openFloatingPlaylist],
  )

  const requestClose = useCallback(
    (sessionId: string) => {
      if (floatingCloseWouldInterruptPlay(sessionId)) {
        const s = sessionById.get(sessionId)
        const isLp = s?.playlistMode === 'launchpad'
        const ok = window.confirm(
          isLp
            ? 'C’è un sample del Launchpad in riproduzione: chiudere il pannello lo interrompe. Chiudere comunque?'
            : 'C’è un video in uscita da questo pannello in riproduzione: chiudere lo interrompe. Chiudere comunque?',
        )
        if (!ok) return
      }
      void removeFloatingPlaylist(sessionId)
    },
    [floatingCloseWouldInterruptPlay, removeFloatingPlaylist, sessionById],
  )

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const clearDragUi = useCallback(() => {
    setDraggingIndex(null)
    setDragOverIndex(null)
  }, [])

  const handleDragStart = useCallback(
    (index: number) => (e: DragEvent) => {
      e.dataTransfer.setData('text/plain', String(index))
      e.dataTransfer.effectAllowed = 'move'
      setDraggingIndex(index)
    },
    [],
  )

  const handleDragEnd = useCallback(() => {
    clearDragUi()
  }, [clearDragUi])

  const handleDragOver = useCallback((index: number) => (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(
    (toIndex: number) => (e: DragEvent) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData('text/plain')
      const from = Number.parseInt(raw, 10)
      if (!Number.isFinite(from)) {
        clearDragUi()
        return
      }
      const next = reorderIds(orderedIds, from, toIndex)
      clearDragUi()
      if (next.some((id, i) => id !== orderedIds[i])) setCardOrder(next)
    },
    [orderedIds, clearDragUi],
  )

  return (
    <section
      className="regia-sidebar-floating-open regia-sidebar-floating-open--embedded"
      aria-label="Pannelli floating aperti"
    >
      {orderedIds.length === 0 ? (
        <p className="regia-sidebar-floating-open-empty">
          Nessun pannello in regia (finestra principale).
        </p>
      ) : (
        <ul className="regia-sidebar-floating-open-list">
          {orderedIds.map((sessionId, index) => {
            const s = sessionById.get(sessionId)
            if (!s) return null
            const title =
              (s.playlistTitle || 'Senza titolo').trim() || 'Senza titolo'
            const isLive = sessionIsLiveOnRegiaOutput(s, liveCtx)
            const themed = Boolean(s.playlistThemeColor?.trim())
            return (
              <li
                key={sessionId}
                draggable={orderedIds.length > 1}
                title="Clic per portare in primo piano. Trascina per riordinare."
                data-preview-hint={previewHintSidebarOpenPanelRow(s.playlistMode)}
                className={[
                  'regia-sidebar-floating-open-item',
                  themed ? 'regia-sidebar-floating-open-item--themed' : '',
                  isLive ? 'is-live-output' : '',
                  draggingIndex === index ? 'is-dragging' : '',
                  dragOverIndex === index && draggingIndex !== index
                    ? 'is-drag-over'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  themed
                    ? ({
                        ['--pl-theme' as string]: s.playlistThemeColor,
                      } as CSSProperties)
                    : undefined
                }
                onClick={(e) => {
                  if (
                    (e.target as HTMLElement).closest(
                      '.regia-sidebar-floating-open-actions',
                    )
                  )
                    return
                  focusSession(sessionId)
                }}
                onDragStart={handleDragStart(index)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop(index)}
              >
                <div className="regia-sidebar-floating-open-meta">
                  {s.playlistMode === 'launchpad' ? (
                    <span
                      className="saved-playlists-kind-icon"
                      title="Launchpad"
                      aria-hidden
                    >
                      <IconSavedCardLaunchpad />
                    </span>
                  ) : s.playlistMode === 'chalkboard' ? (
                    <span
                      className="saved-playlists-kind-icon"
                      title="Chalkboard"
                      aria-hidden
                    >
                      <IconSavedCardChalkboard />
                    </span>
                  ) : null}
                  <div className="saved-playlists-meta-text">
                    <span className="saved-playlists-name">{title}</span>
                    {isLive ? (
                      <span className="regia-sidebar-floating-open-live-label">
                        In uscita
                      </span>
                    ) : null}
                  </div>
                </div>
                <div
                  className="regia-sidebar-floating-open-actions saved-playlists-actions"
                  draggable={false}
                >
                  <button
                    type="button"
                    className="btn-icon saved-playlists-icon-btn saved-playlists-delete"
                    title="Chiudi pannello"
                    aria-label={`Chiudi pannello ${title}`}
                    data-preview-hint="Chiudi il pannello dalla sidebar: non elimina eventuali salvataggi su disco. Se c’è riproduzione attiva da questo pannello, viene chiesta conferma."
                    onClick={() => requestClose(sessionId)}
                  >
                    <IconClosePanel />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
