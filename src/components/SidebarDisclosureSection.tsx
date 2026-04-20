import { useCallback, useState, type ReactNode } from 'react'

const LS_KEY = 'regia-sidebar-disclosure-expanded'

export type SidebarDisclosureSectionKey =
  | 'openPanels'
  | 'presets'
  | 'cloud'
  | 'workspace'

const DEFAULTS: Record<SidebarDisclosureSectionKey, boolean> = {
  openPanels: true,
  presets: true,
  cloud: true,
  workspace: true,
}

function readExpanded(): Record<SidebarDisclosureSectionKey, boolean> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw) as unknown
    if (!p || typeof p !== 'object') return { ...DEFAULTS }
    const o = p as Record<string, unknown>
    return {
      openPanels:
        typeof o.openPanels === 'boolean' ? o.openPanels : DEFAULTS.openPanels,
      presets:
        typeof o.presets === 'boolean' ? o.presets : DEFAULTS.presets,
      cloud: typeof o.cloud === 'boolean' ? o.cloud : DEFAULTS.cloud,
      workspace:
        typeof o.workspace === 'boolean' ? o.workspace : DEFAULTS.workspace,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function persistExpanded(next: Record<SidebarDisclosureSectionKey, boolean>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

type SidebarDisclosureSectionProps = {
  sectionKey: SidebarDisclosureSectionKey
  title: string
  children: ReactNode
  /** Classi sulla radice del gruppo (es. modificatore flex). */
  className?: string
  /** Classi sul contenuto sotto l’intestazione. */
  contentClassName?: string
}

export default function SidebarDisclosureSection({
  sectionKey,
  title,
  children,
  className,
  contentClassName,
}: SidebarDisclosureSectionProps) {
  const [expanded, setExpanded] = useState(
    () => readExpanded()[sectionKey],
  )

  const toggle = useCallback(() => {
    setExpanded((v) => {
      const nextOpen = !v
      const all = readExpanded()
      all[sectionKey] = nextOpen
      persistExpanded(all)
      return nextOpen
    })
  }, [sectionKey])

  return (
    <div
      className={['regia-sidebar-disclosure', className].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className="regia-sidebar-disclosure-header"
        aria-expanded={expanded}
        onClick={toggle}
      >
        <span
          className={[
            'regia-sidebar-disclosure-chevron',
            expanded ? 'is-expanded' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden
        >
          <svg viewBox="0 0 10 10" width={11} height={11}>
            <path
              d="M3.2 1.2 L7.8 5 L3.2 8.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="regia-sidebar-disclosure-title">{title}</span>
      </button>
      {expanded ? (
        <div
          className={['regia-sidebar-disclosure-content', contentClassName]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
