import { useMemo } from 'react'
import { useRegia } from '../state/RegiaContext.tsx'

function IconNewWorkspace() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="3" y="4" width="14" height="15" rx={2} />
      <line x1="10" y1="4.5" x2="10" y2="18.5" strokeLinecap="round" />
      <line x1="3.5" y1="11" x2="16.5" y2="11" strokeLinecap="round" />
    </svg>
  )
}

/** WORKSPACE + select nella barra in alto, a sinistra di Impostazioni. */
export default function HeaderWorkspaceSelect() {
  const {
    namedWorkspaces,
    activeNamedWorkspaceId,
    loadNamedWorkspace,
    createNewNamedWorkspace,
  } = useRegia()

  const selectValue = useMemo(() => {
    if (!activeNamedWorkspaceId) return ''
    return namedWorkspaces.some((w) => w.id === activeNamedWorkspaceId)
      ? activeNamedWorkspaceId
      : ''
  }, [activeNamedWorkspaceId, namedWorkspaces])

  const empty = namedWorkspaces.length === 0

  return (
    <div className="header-workspace" role="group" aria-label="Workspace plancia">
      <span className="header-workspace-label">WORKSPACE</span>
      <div className="header-workspace-row">
        <select
          className="header-workspace-select"
          value={selectValue}
          disabled={empty}
          onChange={(e) => {
            const id = e.target.value
            if (!id) return
            void loadNamedWorkspace(id)
          }}
          title="Carica un workspace salvato sulla plancia"
          aria-label="Seleziona workspace da caricare"
        >
          {empty ? (
            <option value="">Nessun workspace salvato</option>
          ) : (
            <>
              {!selectValue ? (
                <option value="" disabled>
                  Scegli…
                </option>
              ) : null}
              {namedWorkspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </>
          )}
        </select>
        <button
          type="button"
          className="btn-icon header-workspace-new-btn"
          onClick={() => createNewNamedWorkspace()}
          title="Nuovo workspace con il layout attuale della plancia"
          aria-label="Nuovo workspace"
        >
          <IconNewWorkspace />
        </button>
      </div>
    </div>
  )
}
