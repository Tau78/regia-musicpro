import { useCallback, useEffect, useState } from 'react'
import {
  readSidebarMainTabFromLs,
  SIDEBAR_MAIN_TAB_EVENT,
  type SidebarMainTabPersist,
} from '../lib/workspaceShell.ts'
import { useRegia } from '../state/RegiaContext.tsx'
import SavedPlaylistsPanel from './SavedPlaylistsPanel.tsx'
import WorkspacePresetsPanel from './WorkspacePresetsPanel.tsx'

const LS_SIDEBAR_MAIN_TAB = 'regia-sidebar-main-tab'

type MainTab = SidebarMainTabPersist

function readInitialTab(): MainTab {
  return readSidebarMainTabFromLs()
}

function IconNewWorkspace() {
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
        y="5"
        width="14"
        height="12"
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
        d="M17 7h4M19 5v4"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 10h6M7 14h4"
      />
    </svg>
  )
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

function IconSidebarLaunchpadSfx() {
  return (
    <svg
      className="regia-sidebar-primary-svg"
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
        d="M3 9v6M3 12h2.5l4 2.5V7.5L5.5 12H3z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        d="M13 8.5c1.2.8 1.2 5.4 0 6.3M15 6.5c2 1.5 2 9 0 10.5"
      />
    </svg>
  )
}

export default function SidebarTabsPanel() {
  const [tab, setTab] = useState<MainTab>(() => readInitialTab())
  const {
    addFloatingPlaylist,
    addFloatingLaunchPad,
    openFloatingPlaylist,
    createNewNamedWorkspace,
  } = useRegia()

  useEffect(() => {
    try {
      localStorage.setItem(LS_SIDEBAR_MAIN_TAB, tab)
    } catch {
      /* ignore */
    }
  }, [tab])

  useEffect(() => {
    const onApplied = (e: Event) => {
      const ce = e as CustomEvent<SidebarMainTabPersist>
      const d = ce.detail
      if (d === 'workspace' || d === 'playlist') setTab(d)
    }
    window.addEventListener(SIDEBAR_MAIN_TAB_EVENT, onApplied)
    return () => window.removeEventListener(SIDEBAR_MAIN_TAB_EVENT, onApplied)
  }, [])

  const onTabPlaylist = useCallback(() => setTab('playlist'), [])
  const onTabWorkspace = useCallback(() => setTab('workspace'), [])

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

  const onNewWorkspace = useCallback(() => {
    createNewNamedWorkspace()
  }, [createNewNamedWorkspace])

  return (
    <div className="regia-sidebar-tabs">
      <div
        className="regia-sidebar-tabs-bar"
        role="tablist"
        aria-label="Sezioni sidebar"
      >
        <button
          type="button"
          role="tab"
          id="tab-playlist"
          aria-selected={tab === 'playlist'}
          aria-controls="panel-playlist"
          className={`regia-sidebar-tab ${tab === 'playlist' ? 'is-active' : ''}`}
          onClick={onTabPlaylist}
        >
          PLAYLIST
        </button>
        <button
          type="button"
          role="tab"
          id="tab-workspace"
          aria-selected={tab === 'workspace'}
          aria-controls="panel-workspace"
          className={`regia-sidebar-tab ${tab === 'workspace' ? 'is-active' : ''}`}
          onClick={onTabWorkspace}
        >
          WORKSPACE
        </button>
      </div>
      <div
        id="panel-playlist"
        role="tabpanel"
        aria-labelledby="tab-playlist"
        hidden={tab !== 'playlist'}
        className="regia-sidebar-tab-panel"
      >
        {tab === 'playlist' ? (
          <>
            <div
              className="saved-playlists-new-row regia-sidebar-new-pair-row"
              role="group"
              aria-label="Nuova playlist e Launchpad"
            >
              <button
                type="button"
                className="btn-icon regia-sidebar-new-icon-btn saved-playlists-new-playlist"
                onClick={onNewPlaylistPanel}
                title="Apri un nuovo pannello playlist (elenco brani)"
                aria-label="Nuova playlist"
              >
                <IconSidebarBulletedList />
              </button>
              <button
                type="button"
                className="btn-icon regia-sidebar-new-icon-btn saved-playlists-new-launchpad"
                onClick={onNewLaunchPad}
                title="Nuovo Launchpad — kit toni base (cartella launchpad-base)"
                aria-label="Nuovo Launchpad toni base"
              >
                <IconSidebarLaunchpadColors />
              </button>
              <button
                type="button"
                className="btn-icon regia-sidebar-new-icon-btn saved-playlists-new-launchpad-sfx"
                onClick={onNewLaunchPadSfx}
                title="Nuovo Launchpad — kit reazioni / SFX (cartella launchpad-sfx)"
                aria-label="Nuovo Launchpad SFX"
              >
                <IconSidebarLaunchpadSfx />
              </button>
            </div>
            <SavedPlaylistsPanel listOnly />
          </>
        ) : null}
      </div>
      <div
        id="panel-workspace"
        role="tabpanel"
        aria-labelledby="tab-workspace"
        hidden={tab !== 'workspace'}
        className="regia-sidebar-tab-panel"
      >
        {tab === 'workspace' ? (
          <>
            <div
              className="saved-playlists-new-row regia-sidebar-workspace-new-row"
              role="group"
              aria-label="Nuovo workspace"
            >
              <button
                type="button"
                className="btn-icon regia-sidebar-new-icon-btn workspace-presets-new-btn"
                onClick={onNewWorkspace}
                title="Nuovo workspace con il layout attuale della plancia"
                aria-label="Nuovo workspace"
              >
                <IconNewWorkspace />
              </button>
            </div>
            <WorkspacePresetsPanel />
          </>
        ) : null}
      </div>
    </div>
  )
}
