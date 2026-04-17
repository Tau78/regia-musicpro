import { useCallback, useEffect } from 'react'
import { useRegia } from '../state/RegiaContext.tsx'

function IconLoadWorkspace() {
  return (
    <svg
      className="saved-playlists-icon-svg"
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
        d="M4 12a8 8 0 0 1 8-8V2l4 4-4 4V8a6 6 0 1 0 6 6h-2"
      />
    </svg>
  )
}

function IconSaveWorkspace() {
  return (
    <svg
      className="saved-playlists-icon-svg"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        d="M8 4v4h8V4M8 12h8v8H8z"
      />
    </svg>
  )
}

function IconRenameWorkspace() {
  return (
    <svg
      className="saved-playlists-icon-svg"
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
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
      />
    </svg>
  )
}

function IconDuplicate() {
  return (
    <svg
      className="saved-playlists-icon-svg"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <rect
        x={8}
        y={8}
        width={13}
        height={13}
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
        strokeLinejoin="round"
        d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"
      />
    </svg>
  )
}

function IconDeleteWorkspace() {
  return (
    <svg
      className="saved-playlists-icon-svg"
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
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"
      />
    </svg>
  )
}

function formatSavedAt(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return ''
  }
}

export default function WorkspacePresetsPanel() {
  const {
    namedWorkspaces,
    refreshNamedWorkspaces,
    loadNamedWorkspace,
    deleteNamedWorkspace,
    renameNamedWorkspace,
    overwriteNamedWorkspace,
    duplicateNamedWorkspace,
  } = useRegia()

  useEffect(() => {
    refreshNamedWorkspaces()
  }, [refreshNamedWorkspaces])

  const onRename = useCallback(
    (id: string, current: string) => {
      const name = window.prompt('Nuovo nome del workspace:', current)
      if (name === null) return
      renameNamedWorkspace(id, name)
    },
    [renameNamedWorkspace],
  )

  return (
    <section className="workspace-presets" aria-label="Workspace plancia">
      <p className="workspace-presets-intro">
        Salva il layout su un workspace con «Salva» sulla riga. «Carica»
        ripristina plancia e pannelli come erano in quel salvataggio.
      </p>
      {namedWorkspaces.length === 0 ? (
        <p className="saved-playlists-empty workspace-presets-empty">
          Nessun workspace salvato.
        </p>
      ) : (
        <ul className="saved-playlists-list workspace-presets-list">
          {namedWorkspaces.map((w) => (
            <li key={w.id} className="saved-playlists-item workspace-presets-item">
              <div className="saved-playlists-meta">
                <span className="saved-playlists-name">{w.label}</span>
                <span className="saved-playlists-count workspace-presets-date">
                  {formatSavedAt(w.savedAt)}
                </span>
              </div>
              <div className="saved-playlists-actions workspace-presets-actions">
                <button
                  type="button"
                  className="btn-icon saved-playlists-icon-btn saved-playlists-open"
                  title={`Carica workspace «${w.label}»`}
                  aria-label={`Carica workspace ${w.label}`}
                  onClick={() => void loadNamedWorkspace(w.id)}
                >
                  <IconLoadWorkspace />
                </button>
                <button
                  type="button"
                  className="btn-icon saved-playlists-icon-btn workspace-presets-save"
                  title={`Salva il layout attuale in «${w.label}» (sovrascrive)`}
                  aria-label={`Salva layout in workspace ${w.label}`}
                  onClick={() => overwriteNamedWorkspace(w.id)}
                >
                  <IconSaveWorkspace />
                </button>
                <button
                  type="button"
                  className="btn-icon saved-playlists-icon-btn workspace-presets-rename"
                  title={`Rinomina «${w.label}»`}
                  aria-label={`Rinomina workspace ${w.label}`}
                  onClick={() => onRename(w.id, w.label)}
                >
                  <IconRenameWorkspace />
                </button>
                <button
                  type="button"
                  className="btn-icon saved-playlists-icon-btn saved-playlists-duplicate"
                  title={`Duplica «${w.label}»`}
                  aria-label={`Duplica workspace ${w.label}`}
                  onClick={() => duplicateNamedWorkspace(w.id)}
                >
                  <IconDuplicate />
                </button>
                <button
                  type="button"
                  className="btn-icon saved-playlists-icon-btn saved-playlists-delete"
                  title={`Elimina «${w.label}»`}
                  aria-label={`Elimina workspace ${w.label}`}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Eliminare il workspace «${w.label}» dalla memoria locale?`,
                      )
                    ) {
                      deleteNamedWorkspace(w.id)
                    }
                  }}
                >
                  <IconDeleteWorkspace />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
