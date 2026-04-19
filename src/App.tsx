import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import FloatingPlaylist from './components/FloatingPlaylist.tsx'
import FloatingPreview from './components/FloatingPreview.tsx'
import PlaybackArmedPrewarmer from './components/PlaybackArmedPrewarmer.tsx'
import PreviewProgramNextLayout from './components/PreviewProgramNextLayout.tsx'
import PlanciaWorkspaceBanner from './components/PlanciaWorkspaceBanner.tsx'
import SidebarTabsPanel from './components/SidebarTabsPanel.tsx'
import DraggableAudioOutputBar from './components/DraggableAudioOutputBar.tsx'
import AppAboutModal from './components/AppAboutModal.tsx'
import SettingsModal, { IconSettingsGear } from './components/SettingsModal.tsx'
import { clampSidebarWidth } from './lib/sidebarLayout.ts'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.ts'
import { formatRegiaProgramCreatedIt } from './lib/regiaAppBranding.ts'
import { RegiaProvider, useRegia } from './state/RegiaContext.tsx'

function RegiaShell() {
  const {
    togglePlay,
    goNext,
    goPrev,
    floatingPlaylistOpen,
    floatingPlaylistSessions,
    playlistFloaterOsSessionIds,
    canUndo,
    canRedo,
    undo,
    redo,
    previewDetached,
    setPreviewDocked,
    sidebarOpen,
    toggleSidebarOpen,
    sidebarWidthPx,
    setSidebarWidthPx,
  } = useRegia()

  const [sidebarResizeActive, setSidebarResizeActive] = useState(false)
  const sidebarResizeDragRef = useRef<{
    pointerId: number
    startX: number
    startW: number
  } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  useEffect(() => {
    const onWin = () => {
      const c = clampSidebarWidth(sidebarWidthPx)
      if (c !== sidebarWidthPx) setSidebarWidthPx(c)
    }
    window.addEventListener('resize', onWin)
    return () => window.removeEventListener('resize', onWin)
  }, [sidebarWidthPx, setSidebarWidthPx])

  const onSidebarResizePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!sidebarOpen || e.button !== 0) return
      e.preventDefault()
      sidebarResizeDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startW: sidebarWidthPx,
      }
      setSidebarResizeActive(true)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [sidebarOpen, sidebarWidthPx],
  )

  const onSidebarResizePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const d = sidebarResizeDragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      const dx = e.clientX - d.startX
      setSidebarWidthPx(clampSidebarWidth(d.startW + dx), false)
    },
    [setSidebarWidthPx],
  )

  const onSidebarResizeKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!sidebarOpen) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const step = 16
      const delta = e.key === 'ArrowRight' ? step : -step
      setSidebarWidthPx(clampSidebarWidth(sidebarWidthPx + delta))
    },
    [sidebarOpen, sidebarWidthPx, setSidebarWidthPx],
  )

  const endSidebarResize = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const d = sidebarResizeDragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      const dx = e.clientX - d.startX
      const finalW = clampSidebarWidth(d.startW + dx)
      sidebarResizeDragRef.current = null
      setSidebarResizeActive(false)
      setSidebarWidthPx(finalW)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [setSidebarWidthPx],
  )

  useKeyboardShortcuts({
    onTogglePlay: () => void togglePlay(),
    onPrev: () => void goPrev(),
    onNext: () => void goNext(),
    onUndo: () => {
      if (canUndo) void undo()
    },
    onRedo: () => {
      if (canRedo) void redo()
    },
  })

  return (
    <div className="regia-app">
      <header className="regia-header">
        <div className="regia-brand">
          <button
            type="button"
            className="regia-brand-logo-btn"
            onClick={() => setAboutOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={aboutOpen}
            aria-controls="app-about-modal"
            title="Informazioni, versione e crediti"
            aria-label="Apri informazioni su REGIA MUSICPRO"
          >
            <img
              className="regia-brand-logo"
              src={`${import.meta.env.BASE_URL}app-icon.png`}
              alt=""
              width={28}
              height={28}
              decoding="async"
              draggable={false}
            />
          </button>
          <h1 className="regia-brand-title">
            <span className="regia-brand-name">REGIA MUSICPRO</span>
            <span className="regia-brand-meta" aria-label="Versione e data">
              v{__REGIA_APP_VERSION__}
              {__REGIA_APP_CREATED__
                ? ` · ${formatRegiaProgramCreatedIt(__REGIA_APP_CREATED__)}`
                : null}
            </span>
          </h1>
        </div>
        <div className="regia-header-right">
          <div className="regia-header-controls">
            <DraggableAudioOutputBar />
          </div>
          <button
            type="button"
            className="btn-icon regia-header-settings-btn"
            onClick={() => setSettingsOpen(true)}
            title="Impostazioni"
            aria-label="Apri impostazioni"
          >
            <IconSettingsGear />
          </button>
        </div>
      </header>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <AppAboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <main
        className={`regia-main ${sidebarOpen ? 'is-sidebar-open' : 'is-sidebar-collapsed'}`}
      >
        <aside
          className="regia-sidebar"
          aria-label="Playlist salvate e cartelle"
          style={sidebarOpen ? { width: sidebarWidthPx } : undefined}
        >
          <div className="regia-sidebar-inner">
            {sidebarOpen ? <SidebarTabsPanel /> : null}
          </div>
          {sidebarOpen ? (
            <div
              className={`regia-sidebar-resize-handle ${sidebarResizeActive ? 'is-active' : ''}`}
              role="separator"
              aria-orientation="vertical"
              aria-label="Trascina per ridimensionare tra playlist e anteprima"
              tabIndex={0}
              onPointerDown={onSidebarResizePointerDown}
              onPointerMove={onSidebarResizePointerMove}
              onPointerUp={endSidebarResize}
              onPointerCancel={endSidebarResize}
              onKeyDown={onSidebarResizeKeyDown}
            />
          ) : null}
          <button
            type="button"
            className="regia-sidebar-toggle"
            onClick={toggleSidebarOpen}
            aria-expanded={sidebarOpen}
            title={
              sidebarOpen
                ? 'Comprimi pannello sinistro'
                : 'Espandi playlist salvate'
            }
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </aside>
        <div className="regia-main-content">
          {!previewDetached ? (
            <section
              className="preview-bus-section"
              aria-label="Anteprima program e coda successiva"
            >
              <PreviewProgramNextLayout />
            </section>
          ) : (
            <section
              className="preview-panel preview-panel--docked-placeholder"
              aria-label="Anteprima staccata"
            >
              <p className="preview-panel-placeholder-text">
                L’anteprima è in una finestra flottante sopra questa regia.
              </p>
              <button
                type="button"
                className="preview-panel-reattach-btn"
                onClick={setPreviewDocked}
              >
                Riaggancia nell’area principale
              </button>
            </section>
          )}
        </div>
      </main>

      {previewDetached ? <FloatingPreview onDock={setPreviewDocked} /> : null}

      <PlanciaWorkspaceBanner />

      {floatingPlaylistOpen
        ? floatingPlaylistSessions
            .filter((s) => !playlistFloaterOsSessionIds.includes(s.id))
            .map((s) => <FloatingPlaylist key={s.id} sessionId={s.id} />)
        : null}
    </div>
  )
}

function ElectronGate({ children }: { children: ReactNode }) {
  if (typeof window !== 'undefined' && !window.electronAPI) {
    return (
      <div className="regia-fallback">
        <p>
          Avvia l&apos;app con <code>npm run dev</code> (Electron + Vite) per
          usare la regia.
        </p>
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <ElectronGate>
      <RegiaProvider>
        <PlaybackArmedPrewarmer />
        <RegiaShell />
      </RegiaProvider>
    </ElectronGate>
  )
}
