/** Allineato al JSON su disco in `electron/main.ts` (finestra Output non condivide localStorage con la regia). */
export const OUTPUT_PROGRAM_LOGO_LS_KEY = 'regia-output-program-logo-visible'

const DEFAULT_VISIBLE = true

export function readOutputProgramLogoVisibleFromLs(): boolean {
  try {
    const s = localStorage.getItem(OUTPUT_PROGRAM_LOGO_LS_KEY)
    if (s == null) return DEFAULT_VISIBLE
    const o = JSON.parse(s) as unknown
    if (typeof o === 'boolean') return o
    if (typeof o === 'object' && o && 'visible' in o) {
      return (o as { visible: unknown }).visible === true
    }
    return DEFAULT_VISIBLE
  } catch {
    return DEFAULT_VISIBLE
  }
}

export function writeOutputProgramLogoVisibleToLs(visible: boolean): void {
  try {
    localStorage.setItem(
      OUTPUT_PROGRAM_LOGO_LS_KEY,
      JSON.stringify({ visible }),
    )
  } catch {
    /* ignore */
  }
}
