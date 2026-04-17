/** Valore letto da JSON / storage: accetta solo stringhe plausibili come `KeyboardEvent.code`. */
export function normalizePersistedPadKeyCode(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t || t.length > 48) return null
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(t)) return null
  return t
}

/** Tasti modificatori e altri codici non assegnabili al Launchpad (solo tastiera). */
const NON_ASSIGNABLE_KEY_CODES = new Set<string>([
  'Escape',
  'AltLeft',
  'AltRight',
  'ControlLeft',
  'ControlRight',
  'MetaLeft',
  'MetaRight',
  'ShiftLeft',
  'ShiftRight',
  'Dead',
  'Unidentified',
])

export function canAssignLaunchPadKeyCode(code: string): boolean {
  if (!code || NON_ASSIGNABLE_KEY_CODES.has(code)) return false
  return true
}

/** Abbrevia `KeyboardEvent.code` per un’etichetta sul pad. */
export function launchPadKeyLabel(code: string | null | undefined): string {
  if (!code) return ''
  if (code.startsWith('Key') && code.length === 4) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code === 'Space') return '␣'
  return code
}
