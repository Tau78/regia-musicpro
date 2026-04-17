import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { useRegia } from '../state/RegiaContext.tsx'

function IconOpenPlaylist() {
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
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 3h6v6M10 14 21 3"
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

function IconDelete() {
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

export default function SavedPlaylistsPanel() {
  const {
    paths,
    savedPlaylists,
    refreshSavedPlaylists,
    saveCurrentPlaylist,
    loadSavedPlaylist,
    deleteSavedPlaylist,
    duplicateSavedPlaylist,
  } = useRegia()

  useEffect(() => {
    void refreshSavedPlaylists()
  }, [refreshSavedPlaylists])
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const onSave = useCallback(async () => {
    if (!paths.length || !label.trim() || busy) return
    setBusy(true)
    try {
      await saveCurrentPlaylist(label.trim())
      setLabel('')
    } finally {
      setBusy(false)
    }
  }, [paths.length, label, busy, saveCurrentPlaylist])

  const onSaveLabelKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return
      if (!paths.length || busy || !label.trim()) return
      e.preventDefault()
      void onSave()
    },
    [paths.length, label, busy, onSave],
  )

  return (
    <section className="saved-playlists" aria-label="Playlist salvate">
      <div className="saved-playlists-head">
        <h2 className="saved-playlists-title">Playlist salvate</h2>
      </div>
      <div className="saved-playlists-save-row">
        <input
          type="text"
          className="saved-playlists-input"
          placeholder="Nuova Playlist"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={onSaveLabelKeyDown}
          maxLength={120}
          disabled={!paths.length || busy}
        />
        <button
          type="button"
          className="saved-playlists-save-btn"
          disabled={!paths.length || !label.trim() || busy}
          onClick={() => void onSave()}
        >
          Salva
        </button>
      </div>
      {savedPlaylists.length === 0 ? (
        <p className="saved-playlists-empty">Nessuna playlist salvata.</p>
      ) : (
        <ul className="saved-playlists-list">
          {savedPlaylists.map((pl) => (
            <li
              key={pl.id}
              className={`saved-playlists-item ${pl.themeColor ? 'saved-playlists-item--themed' : ''}`}
              style={
                pl.themeColor
                  ? ({ ['--pl-theme' as string]: pl.themeColor } as CSSProperties)
                  : undefined
              }
            >
              <div className="saved-playlists-meta">
                <span className="saved-playlists-name">{pl.label}</span>
                <span className="saved-playlists-count">
                  {pl.trackCount} brani
                </span>
              </div>
              <div className="saved-playlists-actions">
                <button
                  type="button"
                  className="btn-icon saved-playlists-icon-btn saved-playlists-open"
                  title={`Apri «${pl.label}» nella playlist mobile`}
                  aria-label={`Apri playlist ${pl.label} nella playlist mobile`}
                  onClick={() => void loadSavedPlaylist(pl.id)}
                >
                  <IconOpenPlaylist />
                </button>
                <button
                  type="button"
                  className="btn-icon saved-playlists-icon-btn saved-playlists-duplicate"
                  title={`Duplica «${pl.label}» come nuova playlist salvata`}
                  aria-label={`Duplica playlist ${pl.label}`}
                  onClick={() => void duplicateSavedPlaylist(pl.id)}
                >
                  <IconDuplicate />
                </button>
                <button
                  type="button"
                  className="btn-icon saved-playlists-icon-btn saved-playlists-delete"
                  title={`Elimina «${pl.label}» dal disco`}
                  aria-label={`Elimina playlist ${pl.label}`}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Eliminare la playlist «${pl.label}» dal disco?`,
                      )
                    ) {
                      void deleteSavedPlaylist(pl.id)
                    }
                  }}
                >
                  <IconDelete />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
