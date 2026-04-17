/** Audio dei pad launchpad: solo nella finestra regia, non su anteprima né su uscita video. */

let el: HTMLAudioElement | null = null

function getEl(): HTMLAudioElement {
  if (!el) {
    el = new Audio()
    el.preload = 'auto'
  }
  return el
}

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

export function playLaunchpadSample(opts: {
  src: string
  volume: number
  muted: boolean
  sinkId: string
  onEnded: () => void
}): void {
  const a = getEl()
  a.onended = () => {
    opts.onEnded()
    a.onended = null
  }
  a.src = opts.src
  a.volume = Math.min(1, Math.max(0, opts.volume))
  a.muted = opts.muted
  void applySinkId(a, opts.sinkId)
  void a.play().catch(() => {
    /* ignore */
  })
}

export function stopLaunchpadSample(): void {
  if (!el) return
  el.onended = null
  el.pause()
  el.removeAttribute('src')
  void el.load()
}

export function pauseLaunchpadSample(): void {
  el?.pause()
}

export function resumeLaunchpadSample(): void {
  void el?.play().catch(() => {
    /* ignore */
  })
}

export function isLaunchpadSamplePausedWithSrc(): boolean {
  return Boolean(el && el.paused && Boolean(el.src))
}

export function setLaunchpadSampleLevels(
  volume: number,
  muted: boolean,
): void {
  if (!el) return
  el.volume = Math.min(1, Math.max(0, volume))
  el.muted = muted
}

export function setLaunchpadSampleSink(sinkId: string): void {
  if (!el) return
  void applySinkId(el, sinkId)
}

export function getLaunchpadSampleProgress(): {
  currentTime: number
  duration: number
} {
  const a = el
  if (!a?.src) return { currentTime: 0, duration: 0 }
  const d = a.duration
  const duration =
    typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : 0
  const t = a.currentTime
  const currentTime =
    typeof t === 'number' && Number.isFinite(t) ? Math.max(0, t) : 0
  return { currentTime, duration }
}
