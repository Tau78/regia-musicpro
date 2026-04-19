import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
} from 'react'
import { formatDurationMmSs } from '../lib/formatDurationMmSs.ts'
import { sumMediaDurationsSec } from '../lib/sumMediaDurationsSec.ts'
import type { SavedPlaylistKind } from '../playlistTypes.ts'
import { useRegia } from '../state/RegiaContext.tsx'

function IconOpenPlaylist() {
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
        strokeLinejoin="round"
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 3h6v6M10 14 21 3"
      />
    </svg>
  )
}

function IconDuplicate() {
  return (
    <svg
      className="saved-playlists-icon-svg"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <rect
        x={8}
        y={8}
        width={13}
        height={13}
        rx={2}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"
      />
    </svg>
  )
}

function IconDelete() {
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
        strokeLinejoin="round"
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"
      />
    </svg>
  )
}

/** Icona griglia colorata per voci launchpad nella lista salvati. */
function IconSavedCardLaunchpad() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="9" height="9" rx="2" fill="#e8435c" />
      <rect x="13" y="2" width="9" height="9" rx="2" fill="#27ae60" />
      <rect x="2" y="13" width="9" height="9" rx="2" fill="#2980ef" />
      <rect x="13" y="13" width="9" height="9" rx="2" fill="#f39c12" />
    </svg>
  )
}

function IconNewPlaylistPanel() {
  return (
    <svg
      className="saved-playlists-icon-svg"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden="true"
    >
      <rect
        x="4"
        y="6"
        width="13"
        height="11"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        d="M15 3v4M13 5h4"
      />
    </svg>
  )
}

function IconLaunchPadGrid() {
  return (
    <svg
      className="saved-playlists-icon-svg"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="7.5"
        height="7.5"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <rect
        x="13.5"
        y="3"
        width="7.5"
        height="7.5"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <rect
        x="3"
        y="13.5"
        width="7.5"
        height="7.5"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <rect
        x="13.5"
        y="13.5"
        width="7.5"
        height="7.5"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
    </svg>
  )
}

function IconSavedCardChalkboard() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="13"
        rx="2"
        fill="#2d3436"
        stroke="#636e72"
        strokeWidth={1.5}
      />
      <path
        d="M7 17h10"
        stroke="#b2bec3"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Griglia launchpad + badge “pronto” (kit precaricato). */
function IconLaunchPadSfx() {
  return (
    <svg
      className="saved-playlists-icon-svg"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="6.75" height="6.75" rx="1.4" fill="#e8435c" />
      <rect x="9.5" y="2" width="6.75" height="6.75" rx="1.4" fill="#27ae60" />
      <rect x="2" y="9.5" width="6.75" height="6.75" rx="1.4" fill="#2980ef" />
      <rect x="9.5" y="9.5" width="6.75" height="6.75" rx="1.4" fill="#f39c12" />
      <circle cx="17.8" cy="17.8" r="3.6" fill="#22c55e" />
      <path
        fill="none"
        stroke="#ecfdf5"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.1 17.9l0.85 0.85 2.35-2.7"
      />
    </svg>
  )
}

/** Tipi di pannello salvato per filtri sidebar (playlist a brani). */
export type SidebarCardKindFilter = 'tracks' | 'launchpad' | 'chalkboard'

type SavedPlaylistsPanelProps = {
  /** Solo elenco playlist su disco (pulsanti nuovo pannello gestiti fuori). */
  listOnly?: boolean
  /**
   * Filtro per tipo di card: `undefined` o array vuoto = mostra tutto.
   * Con uno o più valori, solo i tipi selezionati.
   */
  kindFilters?: readonly SidebarCardKindFilter[] | null
}

function mergeFilteredReorder(
  fullIds: string[],
  displayedIds: string[],
  from: number,
  to: number,
): string[] {
  const nextDisplayed = reorderSavedIds([...displayedIds], from, to)
  const subSet = new Set(nextDisplayed)
  let i = 0
  return fullIds.map((id) => (subSet.has(id) ? nextDisplayed[i++]! : id))
}

function reorderSavedIds(ids: string[], from: number, to: number): string[] {
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

function setTransparentDragImage(ev: DragEvent) {
  const c = document.createElement('canvas')
  c.width = 1
  c.height = 1
  ev.dataTransfer.setDragImage(c, 0, 0)
}

function playlistMatchesKindFilters(
  playlistMode: SavedPlaylistKind | undefined,
  filters: ReadonlySet<SidebarCardKindFilter>,
): boolean {
  const mode: SavedPlaylistKind = playlistMode ?? 'tracks'
  if (mode === 'launchpad') return filters.has('launchpad')
  if (mode === 'chalkboard') return filters.has('chalkboard')
  return filters.has('tracks')
}

export default function SavedPlaylistsPanel({
  listOnly = false,
  kindFilters = null,
}: SavedPlaylistsPanelProps) {
  const {
    savedPlaylists,
    refreshSavedPlaylists,
    loadSavedPlaylist,
    deleteSavedPlaylist,
    reorderSavedPlaylists,
    duplicateSavedPlaylist,
    addFloatingPlaylist,
    addFloatingLaunchPad,
    addFloatingChalkboard,
    openFloatingPlaylist,
  } = useRegia()

  useEffect(() => {
    void refreshSavedPlaylists()
  }, [refreshSavedPlaylists])

  const filterSet = useMemo(() => {
    if (!kindFilters?.length) return null
    return new Set(kindFilters)
  }, [kindFilters])

  const displayedPlaylists = useMemo(() => {
    if (!filterSet) return savedPlaylists
    return savedPlaylists.filter((p) =>
      playlistMatchesKindFilters(p.playlistMode, filterSet),
    )
  }, [savedPlaylists, filterSet])

  const isFilteredView = Boolean(filterSet)

  const needsBackfillKey = useMemo(() => {
    const ids = savedPlaylists
      .filter(
        (pl) =>
          pl.playlistMode !== 'chalkboard' &&
          pl.trackCount > 0 &&
          (pl.totalDurationSec == null || !Number.isFinite(pl.totalDurationSec)),
      )
      .map((pl) => pl.id)
      .sort()
    return ids.join(',')
  }, [savedPlaylists])

  useEffect(() => {
    if (!needsBackfillKey) return
    let cancelled = false
    const ids = needsBackfillKey.split(',').filter(Boolean)
    void (async () => {
      for (const id of ids) {
        if (cancelled) return
        try {
          const data = await window.electronAPI.playlistsLoad(id)
          if (!data || cancelled) continue
          const paths =
            data.playlistMode === 'launchpad'
              ? data.launchPadCells
                  .map((c) => c.samplePath)
                  .filter((p): p is string => Boolean(p))
              : data.paths
          if (!paths.length) continue
          const total = await sumMediaDurationsSec(paths)
          if (cancelled) return
          await window.electronAPI.playlistsPatchTotalDuration(id, total)
        } catch {
          /* file non disponibili o errore metadati */
        }
      }
      if (!cancelled) await refreshSavedPlaylists()
    })()
    return () => {
      cancelled = true
    }
  }, [needsBackfillKey, refreshSavedPlaylists])

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const clearDragUi = useCallback(() => {
    setDraggingIndex(null)
    setDragOverIndex(null)
  }, [])

  const handleDragStart = useCallback(
    (index: number) => (e: DragEvent) => {
      setTransparentDragImage(e)
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
      const fullIds = savedPlaylists.map((p) => p.id)
      const displayedIds = displayedPlaylists.map((p) => p.id)
      const next = isFilteredView
        ? mergeFilteredReorder(fullIds, displayedIds, from, toIndex)
        : reorderSavedIds(fullIds, from, toIndex)
      const changed = next.some((id, i) => id !== fullIds[i])
      clearDragUi()
      if (changed) void reorderSavedPlaylists(next)
    },
    [
      savedPlaylists,
      displayedPlaylists,
      isFilteredView,
      reorderSavedPlaylists,
      clearDragUi,
    ],
  )

  const listAriaLabel = (() => {
    if (!filterSet) return 'Playlist, launchpad e chalkboard salvati'
    const bits: string[] = []
    if (filterSet.has('tracks')) bits.push('playlist')
    if (filterSet.has('launchpad')) bits.push('launchpad')
    if (filterSet.has('chalkboard')) bits.push('chalkboard')
    return `Salvati: ${bits.join(', ')}`
  })()

  return (
    <section className="saved-playlists" aria-label={listAriaLabel}>
      {!listOnly ? (
        <div
          className="saved-playlists-new-row"
          role="group"
          aria-label="Crea nuovo pannello"
        >
          <button
            type="button"
            className="btn-icon saved-playlists-icon-btn saved-playlists-new-playlist"
            onClick={() => {
              addFloatingPlaylist()
              openFloatingPlaylist()
            }}
            title="Nuova PlayList Vuota"
            aria-label="Nuova playlist vuota"
          >
            <IconNewPlaylistPanel />
          </button>
          <button
            type="button"
            className="btn-icon saved-playlists-icon-btn saved-playlists-new-launchpad"
            onClick={() => {
              void (async () => {
                await addFloatingLaunchPad('base')
                openFloatingPlaylist()
              })()
            }}
            title="Nuovo LaunchPad Vuoto"
            aria-label="Nuovo launchpad vuoto"
          >
            <IconLaunchPadGrid />
          </button>
          <button
            type="button"
            className="btn-icon saved-playlists-icon-btn saved-playlists-new-launchpad-sfx"
            onClick={() => {
              void (async () => {
                await addFloatingLaunchPad('sfx')
                openFloatingPlaylist()
              })()
            }}
            title="Nuovo LaunchPad Preset"
            aria-label="Nuovo launchpad preset"
          >
            <IconLaunchPadSfx />
          </button>
          <button
            type="button"
            className="btn-icon saved-playlists-icon-btn saved-playlists-new-chalkboard"
            onClick={() => {
              void (async () => {
                await addFloatingChalkboard()
                openFloatingPlaylist()
              })()
            }}
            title="Nuova Chalkboard Vuota"
            aria-label="Nuova Chalkboard Vuota"
          >
            <IconSavedCardChalkboard />
          </button>
        </div>
      ) : null}
      {displayedPlaylists.length === 0 ? (
        <p className="saved-playlists-empty">
          {filterSet
            ? 'Nessun elemento salvato per i filtri attivi.'
            : 'Nessun pannello salvato.'}
        </p>
      ) : (
        <ul className="saved-playlists-list">
          {displayedPlaylists.map((pl, index) => (
            <li
              key={pl.id}
              draggable={displayedPlaylists.length > 1}
              title="Doppio clic per aprire. Trascina per riordinare."
              className={[
                'saved-playlists-item',
                pl.themeColor ? 'saved-playlists-item--themed' : '',
                draggingIndex === index ? 'is-dragging' : '',
                dragOverIndex === index && draggingIndex !== index
                  ? 'is-drag-over'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                pl.themeColor
                  ? ({ ['--pl-theme' as string]: pl.themeColor } as CSSProperties)
                  : undefined
              }
              onDoubleClick={(e) => {
                if ((e.target as HTMLElement).closest('.saved-playlists-actions'))
                  return
                void loadSavedPlaylist(pl.id)
              }}
              onDragStart={handleDragStart(index)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver(index)}
              onDrop={handleDrop(index)}
            >
              <div className="saved-playlists-meta">
                {pl.playlistMode === 'launchpad' ? (
                  <span
                    className="saved-playlists-kind-icon"
                    title="Launchpad"
                    aria-hidden
                  >
                    <IconSavedCardLaunchpad />
                  </span>
                ) : pl.playlistMode === 'chalkboard' ? (
                  <span
                    className="saved-playlists-kind-icon"
                    title="Chalkboard"
                    aria-hidden
                  >
                    <IconSavedCardChalkboard />
                  </span>
                ) : null}
                <div className="saved-playlists-meta-text">
                  <span className="saved-playlists-name">{pl.label}</span>
                  <span className="saved-playlists-count">
                    {pl.playlistMode === 'launchpad'
                      ? `${pl.trackCount} sample`
                      : pl.playlistMode === 'chalkboard'
                        ? `${pl.trackCount} banchi`
                        : `${pl.trackCount} brani`}
                    {pl.trackCount > 0 &&
                    pl.playlistMode !== 'chalkboard' ? (
                      <>
                        {' · '}
                        <span className="saved-playlists-total-dur">
                          {pl.totalDurationSec != null &&
                          Number.isFinite(pl.totalDurationSec)
                            ? formatDurationMmSs(pl.totalDurationSec)
                            : '…'}
                        </span>
                      </>
                    ) : null}
                  </span>
                </div>
              </div>
              <div className="saved-playlists-actions" draggable={false}>
                <button
                  type="button"
                  className="btn-icon saved-playlists-icon-btn saved-playlists-open"
                  title={
                    pl.playlistMode === 'launchpad'
                      ? `Apri «${pl.label}» come pannello Launchpad`
                      : pl.playlistMode === 'chalkboard'
                        ? `Apri «${pl.label}» come Chalkboard`
                        : `Apri «${pl.label}» nella playlist mobile`
                  }
                  aria-label={
                    pl.playlistMode === 'launchpad'
                      ? `Apri launchpad salvato ${pl.label}`
                      : pl.playlistMode === 'chalkboard'
                        ? `Apri chalkboard salvata ${pl.label}`
                        : `Apri playlist ${pl.label} nella playlist mobile`
                  }
                  onClick={() => void loadSavedPlaylist(pl.id)}
                >
                  <IconOpenPlaylist />
                </button>
                <button
                  type="button"
                  className="btn-icon saved-playlists-icon-btn saved-playlists-duplicate"
                  title={
                    pl.playlistMode === 'launchpad'
                      ? `Duplica «${pl.label}» come nuovo launchpad salvato`
                      : pl.playlistMode === 'chalkboard'
                        ? `Duplica «${pl.label}» come nuova chalkboard salvata`
                        : `Duplica «${pl.label}» come nuova playlist salvata`
                  }
                  aria-label={
                    pl.playlistMode === 'launchpad'
                      ? `Duplica launchpad ${pl.label}`
                      : pl.playlistMode === 'chalkboard'
                        ? `Duplica chalkboard ${pl.label}`
                        : `Duplica playlist ${pl.label}`
                  }
                  onClick={() => void duplicateSavedPlaylist(pl.id)}
                >
                  <IconDuplicate />
                </button>
                <button
                  type="button"
                  className="btn-icon saved-playlists-icon-btn saved-playlists-delete"
                  title={`Elimina «${pl.label}» dal disco`}
                  aria-label={
                    pl.playlistMode === 'launchpad'
                      ? `Elimina launchpad ${pl.label}`
                      : pl.playlistMode === 'chalkboard'
                        ? `Elimina chalkboard ${pl.label}`
                        : `Elimina playlist ${pl.label}`
                  }
                  onClick={() => {
                    if (
                      window.confirm(
                        pl.playlistMode === 'launchpad'
                          ? `Eliminare il launchpad «${pl.label}» dal disco?`
                          : pl.playlistMode === 'chalkboard'
                            ? `Eliminare la chalkboard «${pl.label}» dal disco?`
                            : `Eliminare la playlist «${pl.label}» dal disco?`,
                      )
                    ) {
                      void deleteSavedPlaylist(pl.id)
                    }
                  }}
                >
                  <IconDelete />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
