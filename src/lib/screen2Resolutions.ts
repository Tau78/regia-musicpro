/**
 * Risoluzioni finestra uscita (monitor 2); elenco estendibile.
 * Mantieni allineata la whitelist in `electron/main.ts` (`ALLOWED_OUTPUT_RESOLUTIONS`).
 */
export type Screen2ResolutionOption = {
  id: string
  width: number
  height: number
  label: string
}

export const SCREEN2_RESOLUTION_OPTIONS: readonly Screen2ResolutionOption[] = [
  {
    id: '1280x720',
    width: 1280,
    height: 720,
    label: '1280 × 720 (HD)',
  },
]

export function resolutionMatchesOption(
  w: number,
  h: number,
  opt: Screen2ResolutionOption,
): boolean {
  return opt.width === w && opt.height === h
}
