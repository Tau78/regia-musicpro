import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { formatDurationMmSs } from '../lib/formatDurationMmSs.ts'
import {
  previewHintNewChalkboard,
  previewHintNewEmptyLaunchpad,
  previewHintNewEmptyPlaylist,
  previewHintNewLaunchpadSfx,
  previewHintSavedListRow,
} from '../lib/panelPreviewHints.ts'
import { sumMediaDurationsSec } from '../lib/sumMediaDurationsSec.ts'
import type { SavedPlaylistKind, SavedPlaylistMeta } from '../playlistTypes.ts'
import type { FloatingPlaylistSession } from '../state/floatingPlaylistSession.ts'
import { useRegia } from '../state/RegiaContext.tsx'

/** Ultima sessione in-app che modifica quel salvataggio (stesso id `editingSavedPlaylistId`). */
function pickOpenFloatingSessionForSavedId(
  sessions: FloatingPlaylistSession[],
  osSessionIds: readonly string[],
  savedId: string,
): string | null {
  const os = new Set(osSessionIds)
  let last: string | null = null
  for (const s of sessions) {
    if (os.has(s.id)) continue
    if (s.editingSavedPlaylistId === savedId) last = s.id
  }
  return last
}

const CTX_MENU_W = 210
const CTX_MENU_H = 88

function savedPlaylistsContextMenuPosition(
  clientX: number,
  clientY: number,
): { left: number; top: number } {
  const pad = 8
  let left = clientX
  let top = clientY
  if (left + CTX_MENU_W > window.innerWidth - pad) {
    left = window.innerWidth - CTX_MENU_W - pad
  }
  if (top + CTX_MENU_H > window.innerHeight - pad) {
    top = clientY - CTX_MENU_H
  }
  return { left: Math.max(pad, left), top: Math.max(pad, top) }
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
    floatingPlaylistSessions,
    playlistFloaterOsSessionIds,
    setActiveFloatingSession,
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

  const [savedCtxMenu, setSavedCtxMenu] = useState<{
    left: number
    top: number
    pl: SavedPlaylistMeta
  } | null>(null)
  const savedCtxMenuRef = useRef<HTMLDivElement>(null)
  const savedCtxMenuFirstBtnRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (!savedCtxMenu) return
    queueMicrotask(() => savedCtxMenuFirstBtnRef.current?.focus())
  }, [savedCtxMenu])

  useEffect(() => {
    if (!savedCtxMenu) return
    const onDown = (ev: PointerEvent) => {
      if (savedCtxMenuRef.current?.contains(ev.target as Node)) return
      setSavedCtxMenu(null)
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setSavedCtxMenu(null)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [savedCtxMenu])

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
            data-preview-hint={previewHintNewEmptyPlaylist}
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
            data-preview-hint={previewHintNewEmptyLaunchpad}
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
            data-preview-hint={previewHintNewLaunchpadSfx}
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
            data-preview-hint={previewHintNewChalkboard}
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
              title="Clic: in primo piano se già aperto. Doppio clic: apre in un nuovo pannello senza interrompere play/uscita attuali. Tasto destro: duplica o elimina. Trascina per riordinare."
              data-preview-hint={previewHintSavedListRow(pl.playlistMode)}
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
              onClick={() => {
                const sid = pickOpenFloatingSessionForSavedId(
                  floatingPlaylistSessions,
                  playlistFloaterOsSessionIds,
                  pl.id,
                )
                if (!sid) return
                setActiveFloatingSession(sid)
                openFloatingPlaylist()
              }}
              onDoubleClick={() => {
                const sid = pickOpenFloatingSessionForSavedId(
                  floatingPlaylistSessions,
                  playlistFloaterOsSessionIds,
                  pl.id,
                )
                if (sid) {
                  setActiveFloatingSession(sid)
                  openFloatingPlaylist()
                } else {
                  void loadSavedPlaylist(pl.id)
                }
              }}
              onContextMenu={(e: MouseEvent<HTMLLIElement>) => {
                e.preventDefault()
                e.stopPropagation()
                const pos = savedPlaylistsContextMenuPosition(
                  e.clientX,
                  e.clientY,
                )
                setSavedCtxMenu({ left: pos.left, top: pos.top, pl })
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
            </li>
          ))}
        </ul>
      )}
      {savedCtxMenu
        ? createPortal(
            <div
              ref={savedCtxMenuRef}
              className="saved-playlists-ctx-menu"
              style={{
                left: savedCtxMenu.left,
                top: savedCtxMenu.top,
              }}
              role="menu"
              aria-label={`Azioni su ${savedCtxMenu.pl.label}`}
            >
              <button
                ref={savedCtxMenuFirstBtnRef}
                type="button"
                role="menuitem"
                className="saved-playlists-ctx-menu-item"
                onClick={() => {
                  void duplicateSavedPlaylist(savedCtxMenu.pl.id)
                  setSavedCtxMenu(null)
                }}
              >
                Duplica
              </button>
              <button
                type="button"
                role="menuitem"
                className="saved-playlists-ctx-menu-item saved-playlists-ctx-menu-item--danger"
                onClick={() => {
                  const row = savedCtxMenu.pl
                  setSavedCtxMenu(null)
                  if (
                    window.confirm(
                      row.playlistMode === 'launchpad'
                        ? `Eliminare il launchpad «${row.label}» dal disco?`
                        : row.playlistMode === 'chalkboard'
                          ? `Eliminare la chalkboard «${row.label}» dal disco?`
                          : `Eliminare la playlist «${row.label}» dal disco?`,
                    )
                  ) {
                    void deleteSavedPlaylist(row.id)
                  }
                }}
              >
                Elimina…
              </button>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
