export type LoopCycleMode = 'off' | 'one' | 'all'

/** Ciclo: off → one → all → off (stesso ordine in regia e telecomando). */
export function cycleLoopMode(mode: LoopCycleMode): LoopCycleMode {
  if (mode === 'off') return 'one'
  if (mode === 'one') return 'all'
  return 'off'
}
