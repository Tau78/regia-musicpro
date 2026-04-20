import { useCallback, useEffect, useState } from 'react'
import { useRegia } from '../state/RegiaContext.tsx'

type CloudRow = {
  fileName: string
  label: string
  playlistMode: 'tracks' | 'launchpad' | 'chalkboard'
  savedAt: string
}

/** Contenuto elenco JSON in Regia Video/Playlist; il titolo «Cloud» è nel gruppo sidebar. */
export default function RegiaVideoCloudDrawer() {
  const { loadPlaylistFromRegiaVideoCloudFile } = useRegia()
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<CloudRow[]>([])
  const [hint, setHint] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const api = window.electronAPI
    if (!api?.regiaVideoCloudList) {
      setHint('Disponibile solo nell’app desktop.')
      setRows([])
      return
    }
    setBusy(true)
    setHint(null)
    try {
      const st = await api.regiaVideoCloudGetStatus()
      if (!st.configured || !st.rootValid) {
        setHint(
          'Configura la cartella «Regia Video» in Impostazioni per vedere i file cloud.',
        )
        setRows([])
        return
      }
      const list = await api.regiaVideoCloudList()
      setRows(list)
      if (!list.length) {
        setHint('Nessun file JSON in Regia Video/Playlist.')
      }
    } catch (e) {
      setHint(e instanceof Error ? e.message : 'Errore elenco cloud')
      setRows([])
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onRowActivate = useCallback(
    async (fileName: string) => {
      setBusy(true)
      try {
        await loadPlaylistFromRegiaVideoCloudFile(fileName)
      } finally {
        setBusy(false)
      }
    },
    [loadPlaylistFromRegiaVideoCloudFile],
  )

  const modeLabel = (m: CloudRow['playlistMode']) => {
    if (m === 'launchpad') return 'LP'
    if (m === 'chalkboard') return 'CB'
    return 'PL'
  }

  return (
    <div className="regia-cloud-drawer regia-cloud-drawer--embedded">
      <div className="regia-cloud-drawer-body">
        <div className="regia-cloud-drawer-toolbar">
          <button
            type="button"
            className="regia-cloud-drawer-refresh"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Aggiorna elenco
          </button>
        </div>
        {hint ? <p className="regia-cloud-drawer-hint">{hint}</p> : null}
        <ul className="regia-cloud-drawer-list" aria-busy={busy}>
          {rows.map((r) => (
            <li key={r.fileName}>
              <button
                type="button"
                className="regia-cloud-drawer-row"
                disabled={busy}
                title="Apri in un nuovo pannello floating"
                onClick={() => void onRowActivate(r.fileName)}
              >
                <span className="regia-cloud-drawer-kind" title={r.playlistMode}>
                  {modeLabel(r.playlistMode)}
                </span>
                <span className="regia-cloud-drawer-label">{r.label}</span>
                <span className="regia-cloud-drawer-file">{r.fileName}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="regia-cloud-drawer-foot">
          Clic su una riga per caricare. Salva dal pannello (icona disco o copia cloud).
        </p>
      </div>
    </div>
  )
}
