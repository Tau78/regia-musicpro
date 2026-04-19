import os from 'node:os'

/** IPv4 non interno preferito per URL LAN. */
export function getPrimaryLanIPv4(): string | null {
  const nets = os.networkInterfaces()
  const candidates: string[] = []
  for (const addrs of Object.values(nets)) {
    if (!addrs) continue
    for (const a of addrs) {
      if (a.family !== 'IPv4' || a.internal) continue
      candidates.push(a.address)
    }
  }
  if (candidates.length === 0) return null
  const prefer192 = candidates.find((c) => c.startsWith('192.168.'))
  if (prefer192) return prefer192
  const prefer10 = candidates.find((c) => c.startsWith('10.'))
  if (prefer10) return prefer10
  return candidates[0]!
}

/** Hostname per URL .local (es. MacBook-Pro.local). */
export function getLocalHostnameBase(): string {
  const h = os.hostname().split('.')[0] ?? 'localhost'
  return h.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 63) || 'regia'
}

export function formatLocalUrl(port: number): string {
  const base = getLocalHostnameBase()
  return `http://${base}.local:${port}`
}
