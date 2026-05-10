import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  previewHintNewChalkboard,
  previewHintNewEmptyLaunchpad,
  previewHintNewEmptyPlaylist,
  previewHintNewGobbo,
  previewHintNewLaunchpadSfx,
  previewHintNewTitles,
} from '../lib/panelPreviewHints.ts'

type NewPanelFanMenuProps = {
  /** Quando true (solo elenco salvati) il menu non si mostra. */
  listOnly: boolean
  onNewPlaylist: () => void
  onNewLaunchpadBase: () => void
  onNewLaunchpadSfx: () => void
  onNewChalkboard: () => void
  onNewGobbo: () => void
  onNewTitles: () => void
}

const FAN_SZ = 200

export default function NewPanelFanMenu({
  listOnly,
  onNewPlaylist,
  onNewLaunchpadBase,
  onNewLaunchpadSfx,
  onNewChalkboard,
  onNewGobbo,
  onNewTitles,
}: NewPanelFanMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const el = rootRef.current
      if (!el) return
      if (el.contains(e.target as Node)) return
      close()
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [open, close])

  useLayoutEffect(() => {
    if (!open) return
    queueMicrotask(() => btnRef.current?.focus())
  }, [open])

  if (listOnly) return null

  const itemStyle = (angleDeg: number, radiusPx: number): CSSProperties => {
    const rad = (angleDeg * Math.PI) / 180
    const x = Math.sin(rad) * radiusPx
    const y = -Math.cos(rad) * radiusPx
    return {
      position: 'absolute',
      left: `calc(50% + ${x}px - 22px)`,
      top: `calc(50% + ${y}px - 22px)`,
    }
  }

  return (
    <div className="new-panel-fan-menu-root" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="btn-icon saved-playlists-icon-btn saved-playlists-new-fan"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Nuovo pannello (menu)"
        aria-label="Apri menu nuovo pannello"
        onClick={() => setOpen((o) => !o)}
      >
        +
      </button>
      {open ? (
        <>
          <div className="new-panel-fan-backdrop" aria-hidden />
          <div
            className="new-panel-fan-arc"
            role="menu"
            aria-label="Scegli tipo di pannello"
            style={{ width: FAN_SZ, height: FAN_SZ }}
          >
            <button
              type="button"
              role="menuitem"
              className="new-panel-fan-item btn-icon"
              style={itemStyle(-60, 78)}
              data-preview-hint={previewHintNewEmptyPlaylist}
              onClick={() => {
                close()
                onNewPlaylist()
              }}
              title="Playlist vuota"
            >
              PL
            </button>
            <button
              type="button"
              role="menuitem"
              className="new-panel-fan-item btn-icon"
              style={itemStyle(-20, 78)}
              data-preview-hint={previewHintNewEmptyLaunchpad}
              onClick={() => {
                close()
                void onNewLaunchpadBase()
              }}
              title="Launchpad vuoto"
            >
              LP
            </button>
            <button
              type="button"
              role="menuitem"
              className="new-panel-fan-item btn-icon"
              style={itemStyle(20, 78)}
              data-preview-hint={previewHintNewLaunchpadSfx}
              onClick={() => {
                close()
                void onNewLaunchpadSfx()
              }}
              title="Launchpad preset"
            >
              SFX
            </button>
            <button
              type="button"
              role="menuitem"
              className="new-panel-fan-item btn-icon"
              style={itemStyle(60, 78)}
              data-preview-hint={previewHintNewChalkboard}
              onClick={() => {
                close()
                void onNewChalkboard()
              }}
              title="Chalkboard"
            >
              CB
            </button>
            <button
              type="button"
              role="menuitem"
              className="new-panel-fan-item btn-icon"
              style={itemStyle(-40, 44)}
              data-preview-hint={previewHintNewTitles}
              onClick={() => {
                close()
                onNewTitles()
              }}
              title="Titoli PGM"
            >
              Tt
            </button>
            <button
              type="button"
              role="menuitem"
              className="new-panel-fan-item btn-icon"
              style={itemStyle(40, 44)}
              data-preview-hint={previewHintNewGobbo}
              onClick={() => {
                close()
                onNewGobbo()
              }}
              title="Gobbo"
            >
              Gb
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
