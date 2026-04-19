import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

type Tab = 'playlist' | 'launchpad'

type PlaylistItem = {
  id: string
  label: string
  trackCount: number
  updatedAt: string
  themeColor?: string
  playlistMode?: 'tracks' | 'launchpad' | 'chalkboard'
}

type TracksDetail = {
  id: string
  label: string
  mode: 'tracks'
  themeColor?: string
  tracks: { index: number; label: string }[]
}

type LaunchDetail = {
  id: string
  label: string
  mode: 'launchpad'
  themeColor?: string
  pads: { index: number; label: string; color: string; hasSample: boolean }[]
}

type LoopModeSnap = 'off' | 'one' | 'all'

type Snapshot = {
  programPlaying: boolean
  programTitle: string | null
  programPositionSec: number | null
  programDurationSec: number | null
  launchpadActive: boolean
  launchpadTitle: string | null
  launchpadSlot: number | null
  outputVolume: number
  playlistLoopMode: LoopModeSnap
  canUndo: boolean
}

type Conn = 'online' | 'reconnecting' | 'offline'

function parseToken(): string | null {
  const u = new URL(window.location.href)
  const t = u.searchParams.get('token')
  return t && t.trim() ? t.trim() : null
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

function formatMmSs(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '—'
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function IconPrev() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M11 6v12L2 12 11 6z" />
      <path fill="currentColor" d="M20 6v12L11 12 20 6z" />
    </svg>
  )
}

function IconNext() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M13 6v12L22 12 13 6z" />
      <path fill="currentColor" d="M4 6v12L13 12 4 6z" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"
      />
    </svg>
  )
}

function IconUndo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 14 4 9l5-5"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M4 9h10.5a5.5 5.5 0 0 1 0 11H5"
      />
    </svg>
  )
}

function IconLoopOff() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M5 5l14 14"
      />
    </svg>
  )
}

function IconLoopOne() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 2l4 4-4 4" />
      <path d="M3 12V9a4 4 0 0 1 4-4h11" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 12v3a4 4 0 0 1-4 4H7" />
      <text
        x="12"
        y="14"
        textAnchor="middle"
        fontSize="8"
        fontWeight="800"
        fill="currentColor"
        stroke="none"
      >
        1
      </text>
    </svg>
  )
}

function IconLoopAll() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 2l4 4-4 4" />
      <path d="M3 12V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 12v3a4 4 0 0 1-4 4H7" />
    </svg>
  )
}

export function RemoteApp() {
  const token = useMemo(() => parseToken(), [])
  const [tab, setTab] = useState<Tab>('playlist')
  const [lists, setLists] = useState<PlaylistItem[]>([])
  const [listErr, setListErr] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TracksDetail | LaunchDetail | null>(null)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [conn, setConn] = useState<Conn>('offline')
  const [pageErr, setPageErr] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef(0)
  const intentionalCloseRef = useRef(false)
  const connectWsRef = useRef<() => void>(() => {})

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!token) throw new Error('no_token')
      const r = await fetch(path, {
        ...init,
        headers: {
          ...authHeaders(token),
          ...(init?.headers ?? {}),
        },
      })
      if (r.status === 401) throw new Error('invalid_token')
      if (!r.ok) throw new Error(`http_${r.status}`)
      return r
    },
    [token],
  )

  const sendCommand = useCallback(
    async (payload: unknown) => {
      if (!token) return
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            v: 1,
            channel: 'remote',
            type: 'command',
            payload,
          }),
        )
        return
      }
      await api('/api/remote/v1/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    },
    [api, token],
  )

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      try {
        const r = await api('/api/remote/v1/playlists')
        const j = (await r.json()) as { items: PlaylistItem[] }
        if (!cancelled) {
          setLists(
            (j.items ?? []).filter((x) => {
              const m = x.playlistMode
              return (
                m === 'launchpad' ||
                m === 'tracks' ||
                m === undefined
              )
            }),
          )
        }
      } catch {
        if (!cancelled) setListErr('Server LAN spento sulla regia o rete diversa.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api, token])

  const connectWs = useCallback(() => {
    if (!token) return
    intentionalCloseRef.current = false
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`
    setConn((c) => (c === 'offline' ? 'reconnecting' : c))
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onopen = () => {
      reconnectRef.current = 0
      setConn('online')
    }
    ws.onmessage = (ev) => {
      try {
        const o = JSON.parse(String(ev.data)) as {
          v?: number
          channel?: string
          type?: string
          payload?: Partial<Snapshot>
        }
        if (o.channel !== 'remote' || o.type !== 'playbackSnapshot' || !o.payload)
          return
        const plm = o.payload.playlistLoopMode
        const loopOk =
          plm === 'off' || plm === 'one' || plm === 'all' ? plm : undefined
        setSnap({
          programPlaying: Boolean(o.payload.programPlaying),
          programTitle: o.payload.programTitle ?? null,
          programPositionSec: o.payload.programPositionSec ?? null,
          programDurationSec: o.payload.programDurationSec ?? null,
          launchpadActive: Boolean(o.payload.launchpadActive),
          launchpadTitle: o.payload.launchpadTitle ?? null,
          launchpadSlot:
            typeof o.payload.launchpadSlot === 'number'
              ? o.payload.launchpadSlot
              : null,
          outputVolume:
            typeof o.payload.outputVolume === 'number'
              ? o.payload.outputVolume
              : 1,
          playlistLoopMode: loopOk ?? 'off',
          canUndo: Boolean(o.payload.canUndo),
        })
      } catch {
        /* ignore */
      }
    }
    ws.onerror = () => {
      setConn('reconnecting')
    }
    ws.onclose = () => {
      wsRef.current = null
      if (intentionalCloseRef.current) {
        setConn('offline')
        return
      }
      setConn('reconnecting')
      const n = ++reconnectRef.current
      const delay = Math.min(30_000, 500 * 2 ** Math.min(n, 8))
      window.setTimeout(() => connectWsRef.current(), delay)
    }
  }, [token])

  useLayoutEffect(() => {
    connectWsRef.current = connectWs
  }, [connectWs])

  useEffect(() => {
    if (!token) return
    const t = window.setTimeout(() => connectWs(), 0)
    return () => {
      window.clearTimeout(t)
      intentionalCloseRef.current = true
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connectWs, token])

  const optionsForTab = useMemo(() => {
    if (tab === 'playlist') {
      return lists.filter(
        (x) => x.playlistMode !== 'launchpad' && x.playlistMode !== 'chalkboard',
      )
    }
    return lists.filter((x) => x.playlistMode === 'launchpad')
  }, [lists, tab])

  useEffect(() => {
    setSelectedId((cur) => {
      if (cur && optionsForTab.some((o) => o.id === cur)) return cur
      return optionsForTab[0]?.id ?? null
    })
  }, [optionsForTab])

  useEffect(() => {
    if (!token || !selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setPageErr(null)
    void (async () => {
      try {
        const r = await api(
          `/api/remote/v1/playlists/${encodeURIComponent(selectedId)}`,
        )
        const j = (await r.json()) as TracksDetail | LaunchDetail
        if (!cancelled) setDetail(j)
      } catch {
        if (!cancelled) {
          setDetail(null)
          setPageErr('Impossibile caricare il dettaglio.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api, token, selectedId])

  const onPlayTrack = useCallback(
    async (savedId: string, index: number) => {
      setPageErr(null)
      try {
        await sendCommand({ type: 'playTrack', savedId, index })
      } catch {
        setPageErr('Comando non inviato. Controlla la connessione.')
      }
    },
    [sendCommand],
  )

  const sendLaunchPadPointer = useCallback(
    async (
      savedId: string,
      slotIndex: number,
      pointerPhase: 'down' | 'up' | 'cancel',
    ) => {
      if (!token) return
      try {
        await sendCommand({
          type: 'playPad',
          savedId,
          slotIndex,
          pointerPhase,
        })
      } catch {
        setPageErr('Comando non inviato.')
      }
    },
    [sendCommand, token],
  )

  const onLaunchPadPadPointerDown = useCallback(
    (savedId: string, slotIndex: number, e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      setPageErr(null)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      void sendLaunchPadPointer(savedId, slotIndex, 'down')
    },
    [sendLaunchPadPointer],
  )

  const onLaunchPadPadPointerEnd = useCallback(
    (
      savedId: string,
      slotIndex: number,
      e: ReactPointerEvent<HTMLButtonElement>,
      cancel: boolean,
    ) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      void sendLaunchPadPointer(savedId, slotIndex, cancel ? 'cancel' : 'up')
    },
    [sendLaunchPadPointer],
  )

  const transport = useCallback(
    async (action: 'togglePlay' | 'prev' | 'next') => {
      try {
        await sendCommand({ type: 'transport', action })
      } catch {
        /* ignore */
      }
    },
    [sendCommand],
  )

  const setRemoteLoopMode = useCallback(
    async (loopMode: LoopModeSnap) => {
      try {
        await sendCommand({ type: 'transport', action: 'setLoopMode', loopMode })
      } catch {
        /* ignore */
      }
    },
    [sendCommand],
  )

  const remoteUndo = useCallback(async () => {
    try {
      await sendCommand({ type: 'transport', action: 'undo' })
    } catch {
      /* ignore */
    }
  }, [sendCommand])

  if (!token) {
    return (
      <div className="remote-shell">
        <div className="remote-body">
          <div className="remote-main">
            <div className="remote-error">
              Token non valido. Apri il link dalla sezione Telecomando in REGIA
              MUSICPRO.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const nowLine =
    snap?.launchpadActive && snap.launchpadTitle
      ? snap.launchpadTitle
      : snap?.programTitle || '—'

  const nowTime =
    snap?.launchpadActive
      ? null
      : snap &&
          snap.programPositionSec != null &&
          snap.programDurationSec != null
        ? `${formatMmSs(snap.programPositionSec)} / ${formatMmSs(snap.programDurationSec)}`
        : snap && snap.programPositionSec != null
          ? formatMmSs(snap.programPositionSec)
          : null

  return (
    <div className="remote-shell">
      <div className="remote-body">
        <div className="remote-tabs">
          <button
            type="button"
            className={`remote-tab ${tab === 'playlist' ? 'is-active' : ''}`}
            onClick={() => setTab('playlist')}
          >
            Playlist
          </button>
          <button
            type="button"
            className={`remote-tab ${tab === 'launchpad' ? 'is-active' : ''}`}
            onClick={() => setTab('launchpad')}
          >
            Launchpad
          </button>
        </div>

        <div className="remote-main">
        {listErr ? <div className="remote-error">{listErr}</div> : null}
        {pageErr ? <div className="remote-error">{pageErr}</div> : null}

        <div className="remote-now" aria-live="polite">
          <div className="remote-now-title">{nowLine}</div>
          {nowTime ? <div className="remote-now-time">{nowTime}</div> : null}
        </div>

        {optionsForTab.length === 0 ? (
          <p className="remote-empty">
            {tab === 'playlist'
              ? 'Nessuna playlist a elenco salvata.'
              : 'Nessun launchpad salvato.'}
          </p>
        ) : (
          <>
            <div className="remote-picker">
              <label className="remote-picker-label" htmlFor="remote-pl-sel">
                {tab === 'playlist' ? 'Scegli playlist' : 'Scegli launchpad'}
              </label>
              <select
                id="remote-pl-sel"
                className="remote-select"
                value={selectedId ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setSelectedId(v || null)
                }}
              >
                {optionsForTab.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.label.trim() || 'Senza titolo'}
                    {tab === 'playlist'
                      ? ` — ${pl.trackCount} file`
                      : ` — ${pl.trackCount} pad`}
                  </option>
                ))}
              </select>
            </div>

            {detail && selectedId && detail.id === selectedId ? (
              <>
                <h2 className="remote-section-title">
                  {detail.mode === 'tracks' ? 'File in playlist' : 'Pad'}
                </h2>
                {detail.mode === 'tracks' ? (
                  <div className="remote-track-list">
                    {detail.tracks.map((t) => (
                      <button
                        key={t.index}
                        type="button"
                        className="remote-row"
                        onClick={() => void onPlayTrack(detail.id, t.index)}
                      >
                        <span className="remote-row-index">{t.index + 1}</span>
                        <span className="remote-row-title">{t.label}</span>
                        <span className="remote-row-meta">Riproduci</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="remote-pad-grid">
                    {detail.pads.map((p) => (
                      <button
                        key={p.index}
                        type="button"
                        className={`remote-pad ${snap?.launchpadActive && snap.launchpadSlot === p.index ? 'is-active' : ''}`}
                        style={{
                          background: p.hasSample ? p.color : '#333',
                          opacity: p.hasSample ? 1 : 0.35,
                        }}
                        disabled={!p.hasSample}
                        onPointerDown={
                          p.hasSample
                            ? (ev) =>
                                onLaunchPadPadPointerDown(
                                  detail.id,
                                  p.index,
                                  ev,
                                )
                            : undefined
                        }
                        onPointerUp={
                          p.hasSample
                            ? (ev) =>
                                onLaunchPadPadPointerEnd(
                                  detail.id,
                                  p.index,
                                  ev,
                                  false,
                                )
                            : undefined
                        }
                        onPointerCancel={
                          p.hasSample
                            ? (ev) =>
                                onLaunchPadPadPointerEnd(
                                  detail.id,
                                  p.index,
                                  ev,
                                  true,
                                )
                            : undefined
                        }
                        onKeyDown={
                          p.hasSample
                            ? (ev) => {
                                if (ev.key !== 'Enter' && ev.key !== ' ') return
                                ev.preventDefault()
                                setPageErr(null)
                                void sendCommand({
                                  type: 'playPad',
                                  savedId: detail.id,
                                  slotIndex: p.index,
                                })
                              }
                            : undefined
                        }
                      >
                        {p.label || `Pad ${p.index + 1}`}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="remote-empty">Caricamento…</p>
            )}
          </>
        )}
        </div>
      </div>

      <div className="remote-transport">
        <label className="remote-sr-only" htmlFor="rvol">
          Volume uscita
        </label>
        <div className="remote-transport-bar" role="group" aria-label="Trasporto">
          <div className="remote-transport-bar-left">
            <div
              className={`remote-conn remote-conn--icon ${conn}`}
              title={
                conn === 'online'
                  ? 'Online'
                  : conn === 'reconnecting'
                    ? 'Riconnessione…'
                    : 'Offline'
              }
              aria-label={
                conn === 'online'
                  ? 'Online'
                  : conn === 'reconnecting'
                    ? 'Riconnessione'
                    : 'Offline'
              }
            >
              <span className="remote-conn-dot" aria-hidden />
            </div>
            <button
              type="button"
              className="remote-icon-btn"
              disabled={!snap?.canUndo}
              title="Annulla (⌘Z sulla regia)"
              aria-label="Annulla ultima modifica"
              onClick={() => void remoteUndo()}
            >
              <IconUndo />
            </button>
            <button
              type="button"
              className={`remote-icon-btn ${snap?.playlistLoopMode === 'off' ? 'is-active' : ''}`}
              title="Loop disattivato"
              aria-label="Loop off"
              aria-pressed={snap?.playlistLoopMode === 'off'}
              onClick={() => void setRemoteLoopMode('off')}
            >
              <IconLoopOff />
            </button>
            <button
              type="button"
              className={`remote-icon-btn ${snap?.playlistLoopMode === 'one' ? 'is-active' : ''}`}
              title="Ripeti il file corrente"
              aria-label="Loop un file"
              aria-pressed={snap?.playlistLoopMode === 'one'}
              onClick={() => void setRemoteLoopMode('one')}
            >
              <IconLoopOne />
            </button>
            <button
              type="button"
              className={`remote-icon-btn ${snap?.playlistLoopMode === 'all' ? 'is-active' : ''}`}
              title="Loop tutta la lista"
              aria-label="Loop tutta la lista"
              aria-pressed={snap?.playlistLoopMode === 'all'}
              onClick={() => void setRemoteLoopMode('all')}
            >
              <IconLoopAll />
            </button>
            <button
              type="button"
              className="remote-icon-btn"
              aria-label="Precedente"
              title="Brano precedente"
              onClick={() => void transport('prev')}
            >
              <IconPrev />
            </button>
          </div>
          <div className="remote-transport-bar-center">
            <button
              type="button"
              className="remote-tbtn-play"
              aria-label={
                snap?.programPlaying || snap?.launchpadActive ? 'Pausa' : 'Play'
              }
              title="Play o pausa"
              onClick={() => void transport('togglePlay')}
            >
              {snap?.programPlaying || snap?.launchpadActive ? (
                <IconPause />
              ) : (
                <IconPlay />
              )}
            </button>
          </div>
          <div className="remote-transport-bar-right">
            <button
              type="button"
              className="remote-icon-btn"
              aria-label="Successivo"
              title="Brano successivo"
              onClick={() => void transport('next')}
            >
              <IconNext />
            </button>
            <input
              id="rvol"
              className="remote-vol remote-vol--inline"
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={snap?.outputVolume ?? 1}
              onChange={(e) =>
                void sendCommand({
                  type: 'transport',
                  action: 'setVolume',
                  volume: Number(e.target.value),
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
