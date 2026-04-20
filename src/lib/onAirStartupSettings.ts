const LS_ON_AIR_ON_AT_STARTUP = 'regia-on-air-on-at-startup'

/** Se true, all’avvio l’uscita secondo schermo (ON AIR) è visibile; se false, nascosta. */
export function readOnAirOnAtStartup(): boolean {
  try {
    const raw = localStorage.getItem(LS_ON_AIR_ON_AT_STARTUP)
    if (raw === null) return false
    return raw === 'true' || raw === '1'
  } catch {
    return false
  }
}

export function writeOnAirOnAtStartup(on: boolean): void {
  try {
    localStorage.setItem(LS_ON_AIR_ON_AT_STARTUP, on ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}
