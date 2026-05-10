/** Voci in coda playlist programma (oltre ai soli path legacy). */

export type PlaylistTrackMacroActionV1 = {
  type: 'loadSavedPlaylistAndPlay'
  savedPlaylistId: string
}

export type PlaylistTrackItem =
  | { kind: 'media'; path: string; id?: string }
  | { kind: 'stop'; id: string; message: string; color: string }
  | {
      kind: 'macro'
      id: string
      label: string
      color?: string
      action: PlaylistTrackMacroActionV1
    }

function newRowId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function defaultPlaylistItemsFromPaths(paths: string[]): PlaylistTrackItem[] {
  return paths.map((path) => ({
    kind: 'media' as const,
    path,
    id: newRowId('tr'),
  }))
}

export function mediaPathsFromPlaylistItems(items: PlaylistTrackItem[]): string[] {
  const out: string[] = []
  for (const it of items) {
    if (it.kind === 'media') out.push(it.path)
  }
  return out
}

/** Righe effettive: `playlistItems` se presente e non vuoto, altrimenti derivate da `paths`. */
export function effectivePlaylistRows(session: {
  paths: string[]
  playlistItems?: PlaylistTrackItem[] | null
}): PlaylistTrackItem[] {
  const pi = session.playlistItems
  if (pi && pi.length > 0) return pi
  return defaultPlaylistItemsFromPaths(session.paths)
}

export function trackListLength(session: {
  paths: string[]
  playlistItems?: PlaylistTrackItem[] | null
}): number {
  return effectivePlaylistRows(session).length
}

/** Allinea `paths` ai soli media nella stessa ordine delle righe. */
export function syncPathsFromPlaylistItems(
  items: PlaylistTrackItem[],
): string[] {
  return mediaPathsFromPlaylistItems(items)
}

export function normalizePlaylistTrackItemsFromUnknown(
  raw: unknown,
): PlaylistTrackItem[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: PlaylistTrackItem[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const kind = o.kind
    if (kind === 'media') {
      const path = typeof o.path === 'string' ? o.path.trim() : ''
      if (!path) continue
      const id = typeof o.id === 'string' ? o.id.trim() : undefined
      out.push({ kind: 'media', path, ...(id ? { id } : {}) })
      continue
    }
    if (kind === 'stop') {
      const id =
        typeof o.id === 'string' && o.id.trim()
          ? o.id.trim()
          : newRowId('stop')
      const message =
        typeof o.message === 'string'
          ? o.message.trim().slice(0, 240)
          : 'Stop'
      let color = typeof o.color === 'string' ? o.color.trim() : '#334155'
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = '#334155'
      out.push({
        kind: 'stop',
        id,
        message: message || 'Stop',
        color: color.toLowerCase(),
      })
      continue
    }
    if (kind === 'macro') {
      const id =
        typeof o.id === 'string' && o.id.trim()
          ? o.id.trim()
          : newRowId('macro')
      const label =
        typeof o.label === 'string' ? o.label.trim().slice(0, 120) : 'Macro'
      const colorRaw = typeof o.color === 'string' ? o.color.trim() : ''
      const color =
        /^#[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw.toLowerCase() : undefined
      const act = o.action
      if (!act || typeof act !== 'object') continue
      const ar = act as Record<string, unknown>
      if (ar.type === 'loadSavedPlaylistAndPlay') {
        const sid =
          typeof ar.savedPlaylistId === 'string'
            ? ar.savedPlaylistId.trim()
            : ''
        if (!sid) continue
        out.push({
          kind: 'macro',
          id,
          label: label || 'Macro',
          ...(color ? { color } : {}),
          action: { type: 'loadSavedPlaylistAndPlay', savedPlaylistId: sid },
        })
      }
    }
  }
  return out.length > 0 ? out : undefined
}
