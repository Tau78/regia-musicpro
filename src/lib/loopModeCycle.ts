export type LoopCycleMode = 'off' | 'one' | 'all'

/** Ciclo: off → one → all → off (stesso ordine in regia e telecomando). */
export function cycleLoopMode(mode: LoopCycleMode): LoopCycleMode {
  if (mode === 'off') return 'one'
  if (mode === 'one') return 'all'
  return 'off'
}

/** Etichetta compatta sul pulsante ciclo (OFF / 1 / Tutti). */
export function loopCycleModeShortLabel(mode: LoopCycleMode): string {
  if (mode === 'off') return 'OFF'
  if (mode === 'one') return '1'
  return 'Tutti'
}
