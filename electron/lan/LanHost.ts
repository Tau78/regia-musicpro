import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import { WebSocketServer, type WebSocket, type RawData } from 'ws'
import bonjour from 'bonjour'
import type {
  RemoteDispatchPayload,
  RemotePlaybackSnapshotV1,
  RemoteWsEnvelopeV1,
} from './remoteTypes'
import { formatLocalUrl, getPrimaryLanIPv4 } from './networkUtils'

const RATE_WINDOW_MS = 1000
const RATE_MAX = 24

export type LanHostPlaylistMeta = {
  id: string
  label: string
  trackCount: number
  updatedAt: string
  totalDurationSec?: number
  themeColor?: string
  playlistMode?: 'tracks' | 'launchpad' | 'chalkboard'
}

export type LanHostDeps = {
  isDev: boolean
  getDevServerUrl: () => string
  /** Porta HTTP del server LAN (0 = scegli libera). */
  preferredPort: number
  listPlaylists: () => Promise<LanHostPlaylistMeta[]>
  getPlaylistPublicDetail: (id: string) => Promise<unknown | null>
  /** PNG composito del banco lavagna (solo playlist lavagna). */
  readChalkboardBankPng: (
    playlistId: string,
    bankIndex: number,
  ) => Promise<Buffer | null>
  dispatchToRegia: (payload: RemoteDispatchPayload) => Promise<void>
  getPlaybackSnapshot: () => RemotePlaybackSnapshotV1
}

function extMime(p: string): string {
  const e = path.extname(p).toLowerCase()
  if (e === '.html') return 'text/html; charset=utf-8'
  if (e === '.js') return 'application/javascript; charset=utf-8'
  if (e === '.css') return 'text/css; charset=utf-8'
  if (e === '.svg') return 'image/svg+xml'
  if (e === '.png') return 'image/png'
  if (e === '.json') return 'application/json; charset=utf-8'
  return 'application/octet-stream'
}

function readToken(req: IncomingMessage, u: URL): string | null {
  const q = u.searchParams.get('token')
  if (q && q.trim()) return q.trim()
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim()
  return null
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  const o = origin ?? '*'
  return {
    'Access-Control-Allow-Origin': o === '*' ? '*' : o,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function clientKey(req: IncomingMessage): string {
  const ra = req.socket.remoteAddress ?? 'unknown'
  return ra
}

export class LanHost {
  private server: http.Server | null = null
  private wss: WebSocketServer | null = null
  private token: string | null = null
  private port = 0
  private bonjourInstance: ReturnType<typeof bonjour> | null = null
  private published: ReturnType<ReturnType<typeof bonjour>['publish']> | null =
    null
  private readonly wsClients = new Set<WebSocket>()
  private rateMap = new Map<string, { windowStart: number; count: number }>()
  private snapshotTimer: ReturnType<typeof setInterval> | null = null
  private lastBroadcastJson: string | null = null
  private lastLanIp: string | null = null
  private ipWatchTimer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly deps: LanHostDeps) {}

  getToken(): string | null {
    return this.token
  }

  getPort(): number {
    return this.port
  }

  getLanUrl(): string | null {
    const ip = getPrimaryLanIPv4()
    if (!ip || !this.port) return null
    return `http://${ip}:${this.port}`
  }

  getLocalUrl(): string | null {
    if (!this.port) return null
    return formatLocalUrl(this.port)
  }

  getRemotePagePath(): string {
    return `/remote.html`
  }

  isRunning(): boolean {
    return this.server != null
  }

  private checkRate(key: string): boolean {
    const now = Date.now()
    let e = this.rateMap.get(key)
    if (!e || now - e.windowStart > RATE_WINDOW_MS) {
      e = { windowStart: now, count: 0 }
    }
    e.count++
    this.rateMap.set(key, e)
    return e.count <= RATE_MAX
  }

  private validateToken(t: string | null): boolean {
    return Boolean(this.token && t === this.token)
  }

  private broadcastSnapshot(snap: RemotePlaybackSnapshotV1): void {
    const env: RemoteWsEnvelopeV1 = {
      v: 1,
      channel: 'remote',
      type: 'playbackSnapshot',
      payload: snap,
    }
    const j = JSON.stringify(env)
    if (j === this.lastBroadcastJson) return
    this.lastBroadcastJson = j
    for (const ws of this.wsClients) {
      if (ws.readyState === 1) ws.send(j)
    }
  }

  /** Chiamato dal main quando i renderer aggiornano lo stato. */
  pushPlaybackSnapshot(snap: RemotePlaybackSnapshotV1): void {
    if (!this.server) return
    this.broadcastSnapshot(snap)
  }

  private startSnapshotLoop(): void {
    this.stopSnapshotLoop()
    this.snapshotTimer = setInterval(() => {
      const snap = this.deps.getPlaybackSnapshot()
      this.broadcastSnapshot(snap)
    }, 400)
  }

  private stopSnapshotLoop(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer)
      this.snapshotTimer = null
    }
  }

  private startIpWatch(onChange: (next: string | null) => void): void {
    this.stopIpWatch()
    this.lastLanIp = getPrimaryLanIPv4()
    this.ipWatchTimer = setInterval(() => {
      const next = getPrimaryLanIPv4()
      if (next !== this.lastLanIp) {
        this.lastLanIp = next
        onChange(next)
      }
    }, 4000)
  }

  private stopIpWatch(): void {
    if (this.ipWatchTimer) {
      clearInterval(this.ipWatchTimer)
      this.ipWatchTimer = null
    }
  }

  private stopBonjour(): void {
    try {
      this.published?.stop()
    } catch {
      /* ignore */
    }
    this.published = null
    try {
      this.bonjourInstance?.destroy()
    } catch {
      /* ignore */
    }
    this.bonjourInstance = null
  }

  async start(onIpChange?: (ip: string | null) => void): Promise<{
    ok: true
    port: number
    token: string
    lanUrl: string | null
    localUrl: string
  }> {
    await this.stop()
    this.token = crypto.randomBytes(24).toString('hex')
    const tryPort = Math.max(1024, this.deps.preferredPort || 0) || 9847

    const server = http.createServer((req, res) => {
      void this.handleHttp(req, res)
    })

    const wss = new WebSocketServer({ noServer: true })

    server.on('upgrade', (req: IncomingMessage, socket: Socket, head) => {
      try {
        const host = req.headers.host ?? 'localhost'
        const u = new URL(req.url ?? '/', `http://${host}`)
        if (u.pathname !== '/ws') {
          socket.destroy()
          return
        }
        const tok = readToken(req, u)
        if (!this.validateToken(tok)) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
          socket.destroy()
          return
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          this.wsClients.add(ws)
          ws.on('close', () => this.wsClients.delete(ws))
          ws.on('message', (data: RawData) => {
            void this.handleWsMessage(ws, data)
          })
          const snap = this.deps.getPlaybackSnapshot()
          ws.send(
            JSON.stringify({
              v: 1,
              channel: 'remote',
              type: 'playbackSnapshot',
              payload: snap,
            } satisfies RemoteWsEnvelopeV1),
          )
        })
      } catch {
        try {
          socket.destroy()
        } catch {
          /* ignore */
        }
      }
    })

    await new Promise<void>((resolve, reject) => {
      const listen = (p: number) => {
        server.once('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE' && p < 65500) {
            listen(p + 1)
          } else {
            reject(err)
          }
        })
        server.listen(p, '0.0.0.0', () => {
          server.removeAllListeners('error')
          resolve()
        })
      }
      listen(tryPort)
    })

    const addr = server.address()
    this.port = typeof addr === 'object' && addr ? addr.port : tryPort
    this.server = server
    this.wss = wss

    this.bonjourInstance = bonjour()
    this.published = this.bonjourInstance.publish({
      name: 'REGIA MUSICPRO',
      type: 'http',
      port: this.port,
    })

    this.startSnapshotLoop()
    this.startIpWatch((next) => {
      onIpChange?.(next)
    })

    return {
      ok: true,
      port: this.port,
      token: this.token,
      lanUrl: this.getLanUrl(),
      localUrl: formatLocalUrl(this.port),
    }
  }

  async stop(): Promise<void> {
    this.stopSnapshotLoop()
    this.stopIpWatch()
    this.stopBonjour()
    this.lastBroadcastJson = null
    for (const ws of [...this.wsClients]) {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
    this.wsClients.clear()
    if (this.wss) {
      try {
        this.wss.close()
      } catch {
        /* ignore */
      }
      this.wss = null
    }
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve())
      })
      this.server = null
    }
    this.token = null
    this.port = 0
    this.rateMap.clear()
  }

  private async handleWsMessage(ws: WebSocket, data: RawData): Promise<void> {
    let parsed: unknown
    try {
      parsed = JSON.parse(String(data))
    } catch {
      return
    }
    if (!parsed || typeof parsed !== 'object') return
    const o = parsed as Record<string, unknown>
    if (o.v !== 1 || o.channel !== 'remote') return
    const type = typeof o.type === 'string' ? o.type : ''
    if (type === 'command' && o.payload && typeof o.payload === 'object') {
      try {
        await this.deps.dispatchToRegia(o.payload as RemoteDispatchPayload)
        ws.send(
          JSON.stringify({
            v: 1,
            channel: 'remote',
            type: 'commandOk',
            payload: {},
          } satisfies RemoteWsEnvelopeV1),
        )
      } catch (e) {
        ws.send(
          JSON.stringify({
            v: 1,
            channel: 'remote',
            type: 'commandError',
            payload: { message: e instanceof Error ? e.message : 'error' },
          } satisfies RemoteWsEnvelopeV1),
        )
      }
    }
  }

  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const host = req.headers.host ?? 'localhost'
    const u = new URL(req.url ?? '/', `http://${host}`)
    const origin = req.headers.origin

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(origin))
      res.end()
      return
    }

    const tok = readToken(req, u)
    const isApi = u.pathname.startsWith('/api/remote/')
    const isWsPath = u.pathname === '/ws'

    if (isApi) {
      res.setHeader('Cache-Control', 'no-store')
      Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.setHeader(k, v))
      if (!this.validateToken(tok)) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'invalid_token' }))
        return
      }
      const key = clientKey(req)
      if (req.method === 'POST' && !this.checkRate(`${key}:post`)) {
        res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'rate_limit' }))
        return
      }
      await this.handleApi(req, res, u)
      return
    }

    if (isWsPath) return

    /** HTML/JS/CSS non possono allegare il token su ogni URL (import Vite, chunk). Il token resta obbligatorio per API e WS. */
    await this.handleStatic(req, res, u)
  }

  private async handleApi(
    req: IncomingMessage,
    res: ServerResponse,
    u: URL,
  ): Promise<void> {
    if (u.pathname === '/api/remote/v1/meta' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ v: 1, app: 'regia-musicpro-remote' }))
      return
    }

    if (u.pathname === '/api/remote/v1/playlists' && req.method === 'GET') {
      const list = await this.deps.listPlaylists()
      const filtered = list.filter((p) => {
        const m = p.playlistMode
        return (
          m === 'launchpad' ||
          m === 'tracks' ||
          m === 'chalkboard' ||
          m === undefined
        )
      })
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ items: filtered }))
      return
    }

    const mCbBank =
      /^\/api\/remote\/v1\/playlists\/([^/]+)\/chalkboard-bank\/(\d+)$/.exec(
        u.pathname,
      )
    if (mCbBank && req.method === 'GET') {
      const playlistId = decodeURIComponent(mCbBank[1]!)
      const bankIndex = Number(mCbBank[2]!)
      if (!Number.isInteger(bankIndex) || bankIndex < 0 || bankIndex > 32) {
        res.writeHead(400).end()
        return
      }
      const buf = await this.deps.readChalkboardBankPng(playlistId, bankIndex)
      if (!buf) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      })
      res.end(buf)
      return
    }

    const mPl = /^\/api\/remote\/v1\/playlists\/([^/]+)$/.exec(u.pathname)
    if (mPl && req.method === 'GET') {
      const id = decodeURIComponent(mPl[1]!)
      const detail = await this.deps.getPlaylistPublicDetail(id)
      if (!detail) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'not_found' }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(detail))
      return
    }

    if (u.pathname === '/api/remote/v1/command' && req.method === 'POST') {
      const body = await readBody(req)
      let cmd: RemoteDispatchPayload
      try {
        cmd = JSON.parse(body) as RemoteDispatchPayload
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'bad_json' }))
        return
      }
      try {
        await this.deps.dispatchToRegia(cmd)
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(
          JSON.stringify({
            error: 'dispatch',
            message: e instanceof Error ? e.message : 'error',
          }),
        )
      }
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'not_found' }))
  }

  private async handleStatic(
    req: IncomingMessage,
    res: ServerResponse,
    u: URL,
  ): Promise<void> {
    const distDir = path.join(__dirname, '..', 'dist')
    const devBase = this.deps.getDevServerUrl()

    if (u.pathname === '/' || u.pathname === '/remote' || u.pathname === '/remote/') {
      res.writeHead(302, { Location: `/remote.html?token=${encodeURIComponent(this.token ?? '')}` })
      res.end()
      return
    }

    let filePath: string | null = null
    if (u.pathname === '/remote.html') {
      filePath = path.join(distDir, 'remote.html')
    } else if (u.pathname.startsWith('/assets/')) {
      const safe = u.pathname.replace(/^\/+/, '')
      if (safe.includes('..')) {
        res.writeHead(400).end()
        return
      }
      filePath = path.join(distDir, safe)
    }

    if (filePath && fs.existsSync(filePath)) {
      try {
        const buf = fs.readFileSync(filePath)
        res.writeHead(200, { 'Content-Type': extMime(filePath) })
        res.end(buf)
      } catch {
        res.writeHead(500).end()
      }
      return
    }

    if (this.deps.isDev && req.method === 'GET') {
      const ok = await this.proxyToVite(req, res, u.pathname + u.search, devBase)
      if (ok) return
    }

    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      '<!doctype html><meta charset="utf-8"><p>Telecomando non compilato. Esegui <code>npm run build</code> oppure avvia Vite in dev con host di rete.</p>',
    )
  }

  /** In dev, se dist/remote.html manca, proxy verso Vite. */
  private proxyToVite(
    _req: IncomingMessage,
    res: ServerResponse,
    pathAndQuery: string,
    viteBase: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const target =
        pathAndQuery === '/remote.html' || pathAndQuery.startsWith('/remote.html?')
          ? `${viteBase}/remote.html${pathAndQuery.includes('?') ? pathAndQuery.slice(pathAndQuery.indexOf('?')) : ''}`
          : `${viteBase}${pathAndQuery}`
      http
        .get(target, { headers: { Accept: '*/*' } }, (pr) => {
          res.writeHead(pr.statusCode ?? 502, pr.headers as http.OutgoingHttpHeaders)
          pr.pipe(res)
          pr.on('end', () => resolve(true))
        })
        .on('error', () => {
          resolve(false)
        })
    })
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
