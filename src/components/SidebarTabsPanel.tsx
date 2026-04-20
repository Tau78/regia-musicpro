import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRegia } from '../state/RegiaContext.tsx'
import SavedPlaylistsPanel, {
  type SidebarCardKindFilter,
} from './SavedPlaylistsPanel.tsx'
import WorkspacePresetsPanel from './WorkspacePresetsPanel.tsx'

const LS_SIDEBAR_KIND_FILTERS = 'regia-sidebar-kind-filters'

function readKindFiltersFromLs(): SidebarCardKindFilter[] {
  try {
    const raw = localStorage.getItem(LS_SIDEBAR_KIND_FILTERS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const allowed = new Set<SidebarCardKindFilter>([
      'tracks',
      'launchpad',
      'chalkboard',
    ])
    const out: SidebarCardKindFilter[] = []
    for (const x of parsed) {
      if (x === 'tracks' || x === 'launchpad' || x === 'chalkboard') {
        if (!out.includes(x)) out.push(x)
      }
    }
    return out.filter((k) => allowed.has(k))
  } catch {
    return []
  }
}

function persistKindFilters(filters: SidebarCardKindFilter[]) {
  try {
    if (!filters.length) {
      localStorage.removeItem(LS_SIDEBAR_KIND_FILTERS)
    } else {
      localStorage.setItem(LS_SIDEBAR_KIND_FILTERS, JSON.stringify(filters))
    }
  } catch {
    /* ignore */
  }
}

/** Elenco puntato, leggermente più grande delle icone elenco (16–18px). */
function IconSidebarBulletedList() {
  return (
    <svg
      className="regia-sidebar-primary-svg"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <circle cx="5.2" cy="7" r="1.85" fill="currentColor" />
      <line
        x1="9.5"
        y1="7"
        x2="20"
        y2="7"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx="5.2" cy="12" r="1.85" fill="currentColor" />
      <line
        x1="9.5"
        y1="12"
        x2="20"
        y2="12"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx="5.2" cy="17" r="1.85" fill="currentColor" />
      <line
        x1="9.5"
        y1="17"
        x2="19"
        y2="17"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Griglia 2×2 colorata stile pad (Launchpad). */
function IconSidebarLaunchpadColors() {
  return (
    <svg
      className="regia-sidebar-primary-svg"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="9" height="9" rx="2" fill="#e8435c" />
      <rect x="13" y="2" width="9" height="9" rx="2" fill="#27ae60" />
      <rect x="2" y="13" width="9" height="9" rx="2" fill="#2980ef" />
      <rect x="13" y="13" width="9" height="9" rx="2" fill="#f39c12" />
    </svg>
  )
}

/** Lavagna / gesso. */
function IconSidebarChalkboard() {
  return (
    <svg
      className="regia-sidebar-primary-svg"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
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
      <path
        d="M8 9c1.5 2 3 2 4.5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Griglia launchpad + badge “pronto” (kit precaricato da cartella). */
function IconSidebarLaunchpadSfx() {
  return (
    <svg
      className="regia-sidebar-primary-svg"
      viewBox="0 0 24 24"
      width={16}
      height={16}
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

const FILTER_CHIPS: {
  kind: SidebarCardKindFilter
  /** Testo visibile; `\u00ad` = soft hyphen per andare a capo dentro il pulsante se serve. */
  label: string
  title: string
  ariaLabel: string
}[] = [
  {
    kind: 'tracks',
    label: 'PLAYLIST',
    title:
      'Filtra le playlist a brani. Nessun filtro attivo = vedi tutti i tipi.',
    ariaLabel: 'Filtro playlist a brani',
  },
  {
    kind: 'launchpad',
    label: 'LAUNCH\u00adPAD',
    title:
      'Filtra i launchpad. Nessun filtro attivo = vedi tutti i tipi. Puoi combinare più filtri.',
    ariaLabel: 'Filtro Launchpad',
  },
  {
    kind: 'chalkboard',
    label: 'CHALK\u00adBOARD',
    title:
      'Filtra le chalkboard. Deseleziona tutti i pulsanti per vedere di nuovo tutto.',
    ariaLabel: 'Filtro Chalkboard',
  },
]

export default function SidebarTabsPanel() {
  const [kindFilters, setKindFilters] = useState<SidebarCardKindFilter[]>(
    () => readKindFiltersFromLs(),
  )
  const {
    addFloatingPlaylist,
    addFloatingLaunchPad,
    addFloatingChalkboard,
    openFloatingPlaylist,
  } = useRegia()

  useEffect(() => {
    persistKindFilters(kindFilters)
  }, [kindFilters])

  const toggleKind = useCallback((k: SidebarCardKindFilter) => {
    setKindFilters((prev) => {
      const has = prev.includes(k)
      return has ? prev.filter((x) => x !== k) : [...prev, k]
    })
  }, [])

  const kindFiltersForPanel = useMemo(
    () => (kindFilters.length ? kindFilters : null),
    [kindFilters],
  )

  const onNewPlaylistPanel = useCallback(() => {
    addFloatingPlaylist()
    openFloatingPlaylist()
  }, [addFloatingPlaylist, openFloatingPlaylist])

  const onNewLaunchPad = useCallback(async () => {
    await addFloatingLaunchPad('base')
    openFloatingPlaylist()
  }, [addFloatingLaunchPad, openFloatingPlaylist])

  const onNewLaunchPadSfx = useCallback(async () => {
    await addFloatingLaunchPad('sfx')
    openFloatingPlaylist()
  }, [addFloatingLaunchPad, openFloatingPlaylist])

  const onNewChalkboard = useCallback(async () => {
    await addFloatingChalkboard()
    openFloatingPlaylist()
  }, [addFloatingChalkboard, openFloatingPlaylist])

  return (
    <div className="regia-sidebar-tabs">
      <div
        className="regia-sidebar-filter-bar"
        role="toolbar"
        aria-label="Filtri per tipo di pannello salvato"
      >
        {FILTER_CHIPS.map(({ kind, label, title, ariaLabel }) => {
          const pressed = kindFilters.includes(kind)
          return (
            <button
              key={kind}
              type="button"
              className={`regia-sidebar-filter-chip ${pressed ? 'is-pressed' : ''}`}
              aria-pressed={pressed}
              aria-label={ariaLabel}
              title={title}
              onClick={() => toggleKind(kind)}
            >
              <span className="regia-sidebar-filter-chip-text">{label}</span>
            </button>
          )
        })}
      </div>
      <div
        className="saved-playlists-new-row regia-sidebar-new-pair-row"
        role="group"
        aria-label="Nuovo pannello"
      >
        <button
          type="button"
          className="btn-icon regia-sidebar-new-icon-btn saved-playlists-new-playlist"
          onClick={onNewPlaylistPanel}
          title="Nuova PlayList Vuota"
          aria-label="Nuova playlist vuota"
        >
          <IconSidebarBulletedList />
        </button>
        <button
          type="button"
          className="btn-icon regia-sidebar-new-icon-btn saved-playlists-new-launchpad"
          onClick={onNewLaunchPad}
          title="Nuovo LaunchPad Vuoto"
          aria-label="Nuovo launchpad vuoto"
        >
          <IconSidebarLaunchpadColors />
        </button>
        <button
          type="button"
          className="btn-icon regia-sidebar-new-icon-btn saved-playlists-new-launchpad-sfx"
          onClick={onNewLaunchPadSfx}
          title="Nuovo LaunchPad Preset"
          aria-label="Nuovo launchpad preset"
        >
          <IconSidebarLaunchpadSfx />
        </button>
        <button
          type="button"
          className="btn-icon regia-sidebar-new-icon-btn saved-playlists-new-chalkboard"
          onClick={onNewChalkboard}
          title="Nuova Chalkboard Vuota"
          aria-label="Nuova Chalkboard Vuota"
        >
          <IconSidebarChalkboard />
        </button>
      </div>
      <div className="regia-sidebar-cards-scroll">
        <SavedPlaylistsPanel listOnly kindFilters={kindFiltersForPanel} />
      </div>
      <div className="regia-sidebar-workspace-panel">
        <p className="regia-sidebar-workspace-panel-title">Layout workspace</p>
        <WorkspacePresetsPanel />
      </div>
    </div>
  )
}
