import {
  useCallback,
  useEffect,
  useMemo,
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
import HeaderWorkspaceSelect from './components/HeaderWorkspaceSelect.tsx'
import RegiaPanelHintHost from './components/RegiaPanelHintHost.tsx'
import SettingsModal, { IconSettingsGear } from './components/SettingsModal.tsx'
import {
  usePanelTooltipHintsEnabled,
  writePanelTooltipHintsEnabled,
} from './lib/panelTooltipHintsSettings.ts'
import { clampSidebarWidth } from './lib/sidebarLayout.ts'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.ts'
import { useControllerHidActions } from './hooks/useControllerHidActions.ts'
import { usePresenterKeyBindings } from './lib/presenterKeySettings.ts'
import { formatRegiaProgramCreatedIt } from './lib/regiaAppBranding.ts'
import { RegiaProvider, useRegia } from './state/RegiaContext.tsx'

function IconHeaderHints() {
  return (
    <svg
      className="regia-header-hints-icon"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function RegiaShell() {
  const {
    togglePlay,
    stopPlayback,
    goNext,
    goPrev,
    toggleSecondScreen,
    floatingPlaylistOpen,
    floatingPlaylistSessions,
    playlistFloaterOsSessionIds,
    rightPlanciaDockWidthPx,
    canUndo,
    canRedo,
    undo,
    redo,
    previewDisplayMode,
    setPreviewDocked,
    sidebarOpen,
    toggleSidebarOpen,
    sidebarWidthPx,
    setSidebarWidthPx,
  } = useRegia()

  const panelTooltipHintsEnabled = usePanelTooltipHintsEnabled()

  const dockedPlanciaSessionIds = useMemo(() => {
    if (!floatingPlaylistOpen) return [] as string[]
    return floatingPlaylistSessions
      .filter((s) => !playlistFloaterOsSessionIds.includes(s.id))
      .filter((s) => s.planciaDock === 'right')
      .map((s) => s.id)
  }, [
    floatingPlaylistOpen,
    floatingPlaylistSessions,
    playlistFloaterOsSessionIds,
  ])

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

  const presenterKeys = usePresenterKeyBindings()

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
    presenterPrevCode: presenterKeys.prevCode,
    presenterNextCode: presenterKeys.nextCode,
    presenterPlayPauseCode: presenterKeys.playPauseCode,
  })

  const controllerHidHandlers = useMemo(
    () => ({
      onTogglePlay: () => void togglePlay(),
      onPrev: () => void goPrev(),
      onNext: () => void goNext(),
      onStop: () => void stopPlayback(),
      onToggleSecondScreen: () => toggleSecondScreen(),
    }),
    [goNext, goPrev, stopPlayback, togglePlay, toggleSecondScreen],
  )

  useControllerHidActions(controllerHidHandlers)

  return (
    <div className="regia-app">
      <RegiaPanelHintHost
        className="regia-plancia-hint-root"
        mainClassName="regia-plancia-hint-main-column"
        defaultHint="Plancia: intestazione, sidebar, trasporto, anteprima e area centrale. Passa il mouse su pulsanti, elenchi e separatori per i suggerimenti."
        hintAriaLabel="Suggerimenti plancia"
      >
        <header
          className="regia-header"
          data-preview-hint="Intestazione: workspace plancia, impostazioni. Logo: informazioni su versione e crediti."
        >
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
            <div className="regia-header-trailing">
              <div>
                <HeaderWorkspaceSelect />
              </div>
              <button
                type="button"
                className={`btn-icon regia-header-hints-btn${panelTooltipHintsEnabled ? ' is-active' : ''}`}
                aria-pressed={panelTooltipHintsEnabled}
                aria-label={
                  panelTooltipHintsEnabled
                    ? 'Disattiva barre suggerimenti (HINT)'
                    : 'Attiva barre suggerimenti (HINT)'
                }
                title={
                  panelTooltipHintsEnabled
                    ? 'HINT: disattiva le barre suggerimenti (come in Impostazioni → Interfaccia → Suggerimenti).'
                    : 'HINT: attiva le barre suggerimenti al passaggio del mouse (come in Impostazioni → Interfaccia).'
                }
                onClick={() =>
                  writePanelTooltipHintsEnabled(!panelTooltipHintsEnabled)
                }
              >
                <IconHeaderHints />
              </button>
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
          </div>
        </header>

        <main
          className={`regia-main ${sidebarOpen ? 'is-sidebar-open' : 'is-sidebar-collapsed'}`}
        >
        <aside
          className="regia-sidebar"
          aria-label="Playlist salvate e cartelle"
          style={sidebarOpen ? { width: sidebarWidthPx } : undefined}
          data-preview-hint="Colonna sinistra: playlist e pannelli salvati, nuovi pannelli, cloud e workspace. Comprimi con il pulsante a destra per più spazio sull’anteprima."
        >
          {sidebarOpen ? (
            <>
              <div className="regia-sidebar-inner">
                <SidebarTabsPanel />
              </div>
              <div
                className={`regia-sidebar-resize-handle ${sidebarResizeActive ? 'is-active' : ''}`}
                role="separator"
                aria-orientation="vertical"
                aria-label="Trascina per ridimensionare tra playlist e anteprima"
                tabIndex={0}
                data-preview-hint="Separatore: trascina orizzontalmente per cambiare la larghezza tra colonna sinistra e area anteprima. Con il focus, usa le frecce Sinistra/Destra."
                onPointerDown={onSidebarResizePointerDown}
                onPointerMove={onSidebarResizePointerMove}
                onPointerUp={endSidebarResize}
                onPointerCancel={endSidebarResize}
                onKeyDown={onSidebarResizeKeyDown}
              />
            </>
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
            data-preview-hint={
              sidebarOpen
                ? 'Comprimi la colonna sinistra (playlist salvate e strumenti) per guadagnare spazio sull’anteprima.'
                : 'Espandi la colonna sinistra per playlist salvate, nuovi pannelli e filtri.'
            }
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </aside>
        <div
          className="regia-main-work"
          data-preview-hint="Area plancia: colonna centrale con trasporto e anteprima programma / coda; a destra eventuali pannelli agganciati. Le playlist flottanti possono stare sopra quest’area."
        >
          <div
            className="regia-main-content"
            data-preview-hint="Contenuto principale: barra trasporto sotto l’intestazione, poi l’anteprima programma e il riquadro «prossimo» (area anteprima scorrevole)."
          >
            <div
              className="regia-main-transport-bar"
              aria-label="Trasporto e uscita audio"
              data-preview-hint="Barra trasporto e uscita: play/pausa, avanti/indietro, volume e routing audio, visibilità anteprima. Resta sotto l’intestazione mentre scorre solo l’anteprima."
            >
              <DraggableAudioOutputBar />
            </div>
            <div className="regia-main-preview-scroll">
                {previewDisplayMode === 'docked' ?
                  <section
                    className="preview-bus-section"
                    aria-label="Anteprima program e coda successiva"
                  >
                    <PreviewProgramNextLayout />
                  </section>
                : previewDisplayMode === 'floating' ?
                  <section
                    className="preview-panel preview-panel--docked-placeholder"
                    aria-label="Anteprima staccata"
                    data-preview-hint="L’anteprima video è in una finestra separata. Riaggancia per tornare al layout interno."
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
                : <section
                    className="preview-panel preview-panel--docked-placeholder preview-panel--preview-hidden"
                    aria-label="Anteprima nascosta"
                    data-preview-hint="Anteprima nascosta nel layout: trasporto e audio restano qui. Usa l’icona occhio nella barra trasporto per mostrare di nuovo l’anteprima."
                  >
                    <p className="preview-panel-placeholder-text">
                      Anteprima disattivata nel layout: il trasporto e l’uscita restano
                      attivi. Usa l’icona occhio nella barra trasporto per ripristinare
                      l’anteprima qui o in finestra flottante.
                    </p>
                    <button
                      type="button"
                      className="preview-panel-reattach-btn"
                      onClick={setPreviewDocked}
                    >
                      Mostra anteprima nel layout
                    </button>
                  </section>
                }
            </div>
          </div>
          {rightPlanciaDockWidthPx > 0 ?
            <aside
              className="regia-plancia-right-dock"
              style={{ width: rightPlanciaDockWidthPx }}
              aria-label="Pannelli agganciati a destra della plancia"
              data-preview-hint="Dock destro: pannelli agganciati (playlist, launchpad o lavagna). Passa il mouse sul pannello attivo: la barra in basso mostra suggerimenti specifici per quel tipo. Ridimensiona trascinando il bordo tra anteprima e dock."
            >
              {dockedPlanciaSessionIds.map((id) => (
                <FloatingPlaylist key={id} sessionId={id} />
              ))}
            </aside>
          : null}
        </div>
        </main>
      </RegiaPanelHintHost>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <AppAboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      {previewDisplayMode === 'floating' ?
        <FloatingPreview onDock={setPreviewDocked} />
      : null}

      <PlanciaWorkspaceBanner />

      {floatingPlaylistOpen
        ? floatingPlaylistSessions
            .filter((s) => !playlistFloaterOsSessionIds.includes(s.id))
            .filter((s) => s.planciaDock !== 'right')
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
