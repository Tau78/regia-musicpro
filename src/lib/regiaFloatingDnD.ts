/** DnD interno tra pannelli playlist / launchpad (Electron/Chromium). */
export const REGIA_FLOATING_DND_MIME =
  'application/x-regia-floating-dnd+json' as const

export type RegiaFloatingDnDPayload =
  | {
      v: 1
      kind: 'playlist-track'
      sessionId: string
      index: number
    }
  | {
      v: 1
      kind: 'launchpad-slot'
      sessionId: string
      bankIndex: number
      slotIndex: number
    }

export function dataTransferHasFloatingInternal(
  dt: DataTransfer | null,
): boolean {
  if (!dt?.types?.length) return false
  return dt.types.includes(REGIA_FLOATING_DND_MIME)
}

export function parseRegiaFloatingDnDPayload(
  dt: DataTransfer | null,
): RegiaFloatingDnDPayload | null {
  if (!dt) return null
  const raw =
    dt.getData(REGIA_FLOATING_DND_MIME) ||
    (dt.types.includes('text/plain') ? dt.getData('text/plain') : '')
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Partial<RegiaFloatingDnDPayload>
    if (p?.v !== 1) return null
    if (p.kind === 'playlist-track') {
      if (
        typeof p.sessionId !== 'string' ||
        typeof p.index !== 'number' ||
        !Number.isFinite(p.index)
      )
        return null
      return {
        v: 1,
        kind: 'playlist-track',
        sessionId: p.sessionId,
        index: Math.max(0, Math.floor(p.index)),
      }
    }
    if (p.kind === 'launchpad-slot') {
      if (
        typeof p.sessionId !== 'string' ||
        typeof p.bankIndex !== 'number' ||
        typeof p.slotIndex !== 'number' ||
        !Number.isFinite(p.bankIndex) ||
        !Number.isFinite(p.slotIndex)
      )
        return null
      return {
        v: 1,
        kind: 'launchpad-slot',
        sessionId: p.sessionId,
        bankIndex: Math.max(0, Math.floor(p.bankIndex)),
        slotIndex: Math.max(0, Math.floor(p.slotIndex)),
      }
    }
    return null
  } catch {
    return null
  }
}

export function stringifyRegiaFloatingDnDPayload(
  p: RegiaFloatingDnDPayload,
): string {
  return JSON.stringify(p)
}
