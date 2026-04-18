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
import PreviewBlock from './components/PreviewBlock.tsx'
import PlanciaSnapGuidesOverlay from './components/PlanciaSnapGuidesOverlay.tsx'
import PlanciaWorkspaceBanner from './components/PlanciaWorkspaceBanner.tsx'
import SidebarTabsPanel from './components/SidebarTabsPanel.tsx'
import DraggableAudioOutputBar from './components/DraggableAudioOutputBar.tsx'
import HeaderTransportBar from './components/HeaderTransportBar.tsx'
import SettingsModal, { IconSettingsGear } from './components/SettingsModal.tsx'
import { clampSidebarWidth } from './lib/sidebarLayout.ts'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.ts'
import { RegiaProvider, useRegia, type LoopMode } from './state/RegiaContext.tsx'

function RegiaShell() {
  const {
    togglePlay,
    goNext,
    goPrev,
    loopMode,
    setLoopMode,
    secondScreenOn,
    toggleSecondScreen,
    floatingPlaylistOpen,
    floatingPlaylistSessions,
    canUndo,
    canRedo,
    undo,
    redo,
    previewDetached,
    setPreviewDocked,
    setPreviewFloating,
    sidebarOpen,
    toggleSidebarOpen,
    sidebarWidthPx,
    setSidebarWidthPx,
    repositionAllFloatingPanels,
  } = useRegia()

  const [sidebarResizeActive, setSidebarResizeActive] = useState(false)
  const sidebarResizeDragRef = useRef<{
    pointerId: number
    startX: number
    startW: number
  } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
      <PlanciaSnapGuidesOverlay />
      <header className="regia-header">
        <div className="regia-brand">
          <span className="regia-dot" aria-hidden />
          <h1>REGIA MUSICPRO</h1>
        </div>
        <div className="regia-header-right">
          <div className="regia-header-controls">
            <HeaderTransportBar />
            <DraggableAudioOutputBar />
            <button
              type="button"
              className={`btn-toggle ${!secondScreenOn ? 'is-screen-off' : ''}`}
              onClick={toggleSecondScreen}
              aria-pressed={secondScreenOn}
              title={
                secondScreenOn
                  ? 'Uscita attiva sul secondo schermo: clic per nascondere la finestra (monitor libero)'
                  : 'Uscita nascosta sul secondo schermo: l’audio resta sul dispositivo scelto in barra; clic per mostrare la finestra (risoluzione in Impostazioni)'
              }
            >
              Schermo 2: {secondScreenOn ? 'On' : 'Off'}
            </button>
            <LoopToggles mode={loopMode} onChange={setLoopMode} />
            <div className="regia-undo-redo" role="group" aria-label="Annulla e ripristina">
              {floatingPlaylistOpen && floatingPlaylistSessions.length > 0 ? (
                <button
                  type="button"
                  className="btn-icon regia-reposition-panels-btn"
                  onClick={() => repositionAllFloatingPanels()}
                  title="Riposiziona tutti i pannelli flottanti a cascata nell’area principale (evita fuori schermo)"
                  aria-label="Riposiziona pannelli flottanti"
                >
                  Griglia
                </button>
              ) : null}
              <button
                type="button"
                className="btn-icon regia-undo-btn"
                disabled={!canUndo}
                onClick={() => undo()}
                title="Annulla (⌘Z / Ctrl+Z)"
              >
                Annulla
              </button>
              <button
                type="button"
                className="btn-icon regia-redo-btn"
                disabled={!canRedo}
                onClick={() => redo()}
                title="Ripristina (⌘⇧Z / Ctrl+⇧Z)"
              >
                Ripristina
              </button>
            </div>
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
            <section className="preview-panel" aria-label="Anteprima">
              <div className="preview-panel-toolbar">
                <span className="preview-panel-toolbar-label">Anteprima</span>
                <button
                  type="button"
                  className="preview-panel-detach-btn"
                  onClick={setPreviewFloating}
                  title="Anteprima in finestra flottante: trascina dall’intestazione per spostarla"
                >
                  Stacca
                </button>
              </div>
              <PreviewBlock />
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
        ? floatingPlaylistSessions.map((s) => (
            <FloatingPlaylist key={s.id} sessionId={s.id} />
          ))
        : null}
    </div>
  )
}

function LoopToggles({
  mode,
  onChange,
}: {
  mode: LoopMode
  onChange: (m: LoopMode) => void
}) {
  return (
    <div className="loop-toggles" role="group" aria-label="Modalità loop">
      <button
        type="button"
        className={mode === 'off' ? 'is-active' : ''}
        onClick={() => onChange('off')}
      >
        Loop off
      </button>
      <button
        type="button"
        className={mode === 'one' ? 'is-active' : ''}
        onClick={() => onChange('one')}
      >
        Loop file
      </button>
      <button
        type="button"
        className={mode === 'all' ? 'is-active' : ''}
        onClick={() => onChange('all')}
      >
        Loop playlist
      </button>
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
        <RegiaShell />
      </RegiaProvider>
    </ElectronGate>
  )
}
