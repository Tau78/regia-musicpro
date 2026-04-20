/** Audio dei pad launchpad: solo nella finestra regia, non su anteprima né su uscita video.
 * Più voci possono suonare insieme (anche stesso pad senza toggle). */

type Voice = {
  el: HTMLAudioElement
  sessionId: string
  bankIndex: number
  slotIndex: number
}

let nextVoiceId = 1
const voices = new Map<number, Voice>()

async function applySinkId(a: HTMLAudioElement, sinkId: string): Promise<void> {
  if (!sinkId) return
  const any = a as HTMLAudioElement & {
    setSinkId?: (id: string) => Promise<void>
  }
  if (typeof any.setSinkId !== 'function') return
  try {
    await any.setSinkId(sinkId)
  } catch {
    /* ignore */
  }
}

function tearDownElement(el: HTMLAudioElement): void {
  el.onended = null
  el.pause()
  el.removeAttribute('src')
  void el.load()
}

/** Rimuove la voce senza invocare callback (uso interno dopo onEnded). */
function removeVoice(id: number): void {
  const v = voices.get(id)
  if (!v) return
  tearDownElement(v.el)
  voices.delete(id)
}

export function playLaunchpadSample(opts: {
  sessionId: string
  bankIndex: number
  slotIndex: number
  src: string
  volume: number
  muted: boolean
  sinkId: string
  onEnded: () => void
}): number {
  const id = nextVoiceId++
  const el = new Audio()
  el.preload = 'auto'
  el.onended = () => {
    el.onended = null
    removeVoice(id)
    opts.onEnded()
  }
  el.src = opts.src
  el.volume = Math.min(1, Math.max(0, opts.volume))
  el.muted = opts.muted
  void applySinkId(el, opts.sinkId)
  voices.set(id, {
    el,
    sessionId: opts.sessionId,
    bankIndex: opts.bankIndex,
    slotIndex: opts.slotIndex,
  })
  void el.play().catch(() => {
    removeVoice(id)
    opts.onEnded()
  })
  return id
}

export function stopLaunchpadVoice(id: number): void {
  const v = voices.get(id)
  if (!v) return
  tearDownElement(v.el)
  voices.delete(id)
}

export function stopLaunchpadVoicesForSlot(
  sessionId: string,
  bankIndex: number,
  slotIndex: number,
): void {
  for (const [id, v] of [...voices.entries()]) {
    if (
      v.sessionId === sessionId &&
      v.bankIndex === bankIndex &&
      v.slotIndex === slotIndex
    ) {
      tearDownElement(v.el)
      voices.delete(id)
    }
  }
}

export function stopLaunchpadSample(): void {
  for (const [, v] of [...voices.entries()]) {
    tearDownElement(v.el)
  }
  voices.clear()
}

export function pauseLaunchpadSample(): void {
  for (const v of voices.values()) {
    v.el.pause()
  }
}

export function resumeLaunchpadSample(): void {
  for (const v of voices.values()) {
    void v.el.play().catch(() => {
      /* ignore */
    })
  }
}

export function isLaunchpadSamplePausedWithSrc(): boolean {
  for (const v of voices.values()) {
    if (v.el.paused && Boolean(v.el.src)) return true
  }
  return false
}

export function setLaunchpadSampleLevels(
  volume: number,
  muted: boolean,
): void {
  const v0 = Math.min(1, Math.max(0, volume))
  for (const v of voices.values()) {
    v.el.volume = v0
    v.el.muted = muted
  }
}

export function setLaunchpadSampleSink(sinkId: string): void {
  for (const v of voices.values()) {
    void applySinkId(v.el, sinkId)
  }
}

export function launchpadVoiceCount(): number {
  return voices.size
}

export function launchpadAnyVoicePlaying(): boolean {
  for (const v of voices.values()) {
    if (!v.el.paused && v.el.src) return true
  }
  return false
}

export function launchpadSlotHasAnyVoice(
  sessionId: string,
  bankIndex: number,
  slotIndex: number,
): boolean {
  for (const v of voices.values()) {
    if (
      v.sessionId === sessionId &&
      v.bankIndex === bankIndex &&
      v.slotIndex === slotIndex
    ) {
      return true
    }
  }
  return false
}

export function launchpadSlotHasPlayingVoice(
  sessionId: string,
  bankIndex: number,
  slotIndex: number,
): boolean {
  for (const v of voices.values()) {
    if (
      v.sessionId === sessionId &&
      v.bankIndex === bankIndex &&
      v.slotIndex === slotIndex &&
      !v.el.paused &&
      v.el.src
    ) {
      return true
    }
  }
  return false
}

export function launchpadAnyVoiceInSession(sessionId: string): boolean {
  for (const v of voices.values()) {
    if (v.sessionId === sessionId) return true
  }
  return false
}

function voiceProgress(
  el: HTMLAudioElement,
): { currentTime: number; duration: number } {
  const d = el.duration
  const duration =
    typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : 0
  const t = el.currentTime
  const currentTime =
    typeof t === 'number' && Number.isFinite(t) ? Math.max(0, t) : 0
  return { currentTime, duration }
}

/** Progresso per lo slot: tra le voci attive usa il massimo `currentTime` (anello più “avanzato”). */
export function getLaunchpadSampleProgress(
  sessionId: string,
  bankIndex: number,
  slotIndex: number,
): { currentTime: number; duration: number } {
  let best: { currentTime: number; duration: number } = {
    currentTime: 0,
    duration: 0,
  }
  for (const v of voices.values()) {
    if (
      v.sessionId !== sessionId ||
      v.bankIndex !== bankIndex ||
      v.slotIndex !== slotIndex
    ) {
      continue
    }
    const { currentTime, duration } = voiceProgress(v.el)
    if (duration <= 0) continue
    if (currentTime > best.currentTime || best.duration <= 0) {
      best = { currentTime, duration }
    }
  }
  return best
}

/** Primo slot con almeno una voce (per aggiornare `playbackLoadedTrack` quando finisce il “primario”). */
export function pickAnyLaunchpadVoiceSlot(): {
  sessionId: string
  bankIndex: number
  slotIndex: number
} | null {
  const first = voices.values().next().value
  if (!first) return null
  return {
    sessionId: first.sessionId,
    bankIndex: first.bankIndex,
    slotIndex: first.slotIndex,
  }
}
