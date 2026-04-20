import { useCallback, useEffect, useRef, useState } from 'react'
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

  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    refreshNamedWorkspaces()
  }, [refreshNamedWorkspaces])

  const cancelRename = useCallback(() => {
    setRenameId(null)
    setRenameDraft('')
  }, [])

  const commitRename = useCallback(() => {
    if (!renameId) return
    renameNamedWorkspace(renameId, renameDraft)
    setRenameId(null)
    setRenameDraft('')
  }, [renameId, renameDraft, renameNamedWorkspace])

  const startRename = useCallback((id: string, current: string) => {
    setRenameId(id)
    setRenameDraft(current)
    queueMicrotask(() => {
      const el = renameInputRef.current
      if (!el) return
      el.focus()
      el.select()
    })
  }, [])

  const onRenameButton = useCallback(
    (id: string, label: string) => {
      if (renameId === id) {
        commitRename()
        return
      }
      if (renameId && renameId !== id) cancelRename()
      startRename(id, label)
    },
    [renameId, cancelRename, startRename, commitRename],
  )

  return (
    <section className="workspace-presets" aria-label="Workspace plancia">
      <p className="workspace-presets-intro">
        Salva il layout con «Salva» sulla riga; «Carica» ripristina plancia e
        pannelli. EDIT modifica il nome (Invio conferma, Esc
        annulla); il cestino elimina il workspace.
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
                <div className="saved-playlists-meta-text workspace-presets-meta-text">
                  <div className="workspace-presets-title-row">
                    {renameId === w.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        className="workspace-presets-rename-input"
                        value={renameDraft}
                        maxLength={80}
                        aria-label="Nome workspace"
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitRename()
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            cancelRename()
                          }
                        }}
                      />
                    ) : (
                      <span className="saved-playlists-name">{w.label}</span>
                    )}
                    <div
                      className="workspace-presets-entry-inline-actions"
                      role="group"
                      aria-label={`Azioni su ${w.label}`}
                    >
                      <button
                        type="button"
                        className="workspace-presets-edit-btn"
                        title={
                          renameId === w.id
                            ? 'Conferma nome (Invio)'
                            : `Modifica nome «${w.label}»`
                        }
                        aria-label={
                          renameId === w.id
                            ? 'Conferma nuovo nome workspace'
                            : `Modifica nome workspace ${w.label}`
                        }
                        onPointerDown={(e) => {
                          if (renameId === w.id) e.preventDefault()
                        }}
                        onClick={() => onRenameButton(w.id, w.label)}
                      >
                        {renameId === w.id ? 'OK' : 'EDIT'}
                      </button>
                      <button
                        type="button"
                        className="btn-icon workspace-presets-trash-btn"
                        disabled={renameId === w.id}
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
                  </div>
                  <span className="saved-playlists-count workspace-presets-date">
                    {formatSavedAt(w.savedAt)}
                  </span>
                </div>
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
                  className="btn-icon saved-playlists-icon-btn saved-playlists-duplicate"
                  title={`Duplica «${w.label}»`}
                  aria-label={`Duplica workspace ${w.label}`}
                  onClick={() => duplicateNamedWorkspace(w.id)}
                >
                  <IconDuplicate />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
