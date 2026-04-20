import type { ReactNode } from 'react'
import { useRegia, type LoopMode } from '../state/RegiaContext.tsx'

function IconLoopOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        d="M7 7l10 10"
      />
    </svg>
  )
}

function IconLoopOne() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 2.5l3.5 3.5-3.5 3.5M3 11V9a4 4 0 0 1 4-4h11.5M7 21.5l-3.5-3.5 3.5-3.5M21 13v2a4 4 0 0 1-4 4H5.5"
      />
      <text
        x="10.2"
        y="15.8"
        fontSize="8.5"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        1
      </text>
    </svg>
  )
}

function IconLoopAll() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 2.5l3.5 3.5-3.5 3.5M3 11V9a4 4 0 0 1 4-4h14M7 21.5l-3.5-3.5 3.5-3.5M21 13v2a4 4 0 0 1-4 4H3"
      />
    </svg>
  )
}

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
      />
    </svg>
  )
}

/** Freccia a U verso sinistra (annulla). */
function IconUndo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.32 2.66L3 13" />
    </svg>
  )
}

/** Freccia a U verso destra (ripristina). */
function IconRedo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.35 2.65L21 13" />
    </svg>
  )
}

/** Loop, griglia pannelli, annulla/ripristina — stile Logic, integrato nella barra principale. */
export default function LogicSecondaryStrip() {
  const {
    loopMode,
    setLoopMode,
    floatingPlaylistOpen,
    floatingPlaylistSessions,
    repositionAllFloatingPanels,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useRegia()

  const showGrid = floatingPlaylistOpen && floatingPlaylistSessions.length > 0

  const loopBtn = (mode: LoopMode, icon: ReactNode, label: string, title: string) => (
    <button
      key={mode}
      type="button"
      className={`logic-seg ${loopMode === mode ? 'is-active' : ''}`}
      onClick={() => setLoopMode(mode)}
      aria-pressed={loopMode === mode}
      aria-label={label}
      title={title}
    >
      {icon}
    </button>
  )

  return (
    <div className="logic-secondary-strip">
      <div
        className="logic-segmented"
        role="radiogroup"
        aria-label="Modalità loop"
      >
        {loopBtn(
          'off',
          <IconLoopOff />,
          'Loop disattivato',
          'Loop disattivato: a fine brano si ferma o passa al successivo',
        )}
        {loopBtn(
          'one',
          <IconLoopOne />,
          'Loop file',
          'Ripeti il file corrente',
        )}
        {loopBtn(
          'all',
          <IconLoopAll />,
          'Loop playlist',
          'Alla fine dell’ultimo brano torna al primo',
        )}
      </div>

      {showGrid ? (
        <button
          type="button"
          className="logic-tbtn logic-tbtn--icon"
          onClick={() => repositionAllFloatingPanels()}
          title="Riposiziona tutti i pannelli flottanti a cascata nell’area principale (evita fuori schermo)"
          aria-label="Riposiziona pannelli flottanti"
        >
          <IconGrid />
        </button>
      ) : null}

      <div
        className="logic-transport-well logic-secondary-well"
        role="group"
        aria-label="Annulla e ripristina"
      >
        <button
          type="button"
          className="logic-tbtn logic-tbtn--icon"
          disabled={!canUndo}
          onClick={() => undo()}
          title="Annulla (⌘Z / Ctrl+Z)"
          aria-label="Annulla"
        >
          <IconUndo />
        </button>
        <button
          type="button"
          className="logic-tbtn logic-tbtn--icon"
          disabled={!canRedo}
          onClick={() => redo()}
          title="Ripristina (⌘⇧Z / Ctrl+⇧Z)"
          aria-label="Ripristina"
        >
          <IconRedo />
        </button>
      </div>
    </div>
  )
}
