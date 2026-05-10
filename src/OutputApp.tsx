import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { PlaybackCommand } from './playbackTypes'
import {
  outputMeterLevelFromPeak,
  rmsFromByteTimeDomain,
} from './lib/outputAudioMeter.ts'
import { isStillImagePath } from './mediaPaths.ts'
import {
  OUTPUT_IDLE_CAP_LS_KEY,
  readOutputIdleCapFromLs,
  normalizeOutputIdleCap,
  type OutputIdleCapPersist,
} from './lib/outputIdleCapStorage.ts'
import {
  OUTPUT_PROGRAM_LOGO_LS_KEY,
  readOutputProgramLogoVisibleFromLs,
} from './lib/outputProgramLogoStorage.ts'
import TitleOverlayView from './components/TitleOverlayView.tsx'
import {
  clampRegiaTitleDocument,
  REGIA_TITLE_DOC_EMPTY_V1,
  type RegiaTitleDocumentV1,
} from './lib/regiaTitleDocument.ts'

const DEFAULT_STILL_IMAGE_DURATION_MS = 8000

/** Valori ammessi inviati dalla regia (ms). */
function clampPlaybackCrossfadeMs(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 0
  return raw >= 5000 ? 6000 : 3000
}

type Slot = 0 | 1
type SottofondoSlot = 0 | 1

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const im = new Image()
    im.onload = () => resolve()
    im.onerror = () => resolve()
    im.src = src
  })
}

function waitVideoElementLoaded(
  el: HTMLVideoElement,
  shouldAbort: () => boolean,
): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener('loadeddata', onData)
      el.removeEventListener('error', onErr)
      resolve()
    }
    const onData = () => done()
    const onErr = () => done()
    if (shouldAbort()) {
      resolve()
      return
    }
    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve()
      return
    }
    el.addEventListener('loadeddata', onData)
    el.addEventListener('error', onErr)
  })
}

type MediaSnap = {
  front: Slot
  video: [string | null, string | null]
  image: [string | null, string | null]
}

export default function OutputApp() {
  const vRef0 = useRef<HTMLVideoElement>(null)
  const vRef1 = useRef<HTMLVideoElement>(null)
  const sottofondoRef0 = useRef<HTMLAudioElement>(null)
  const sottofondoRef1 = useRef<HTMLAudioElement>(null)
  const sottofondoFrontRef = useRef<SottofondoSlot>(0)
  const sottofondoVolRef = useRef(1)
  const sottofondoMutedRef = useRef(false)
  const sottofondoRampRafRef = useRef<number | null>(null)
  const sottofondoLoadGenRef = useRef(0)

  const [videoSrc, setVideoSrc] = useState<[string | null, string | null]>([
    null,
    null,
  ])
  const [imageSrc, setImageSrc] = useState<[string | null, string | null]>([
    null,
    null,
  ])
  const [front, setFront] = useState<Slot>(0)
  const [opacity, setOpacity] = useState<[number, number]>([1, 0])
  const [opacityTransition, setOpacityTransition] = useState(false)
  const opacityTransitionRef = useRef(false)
  useLayoutEffect(() => {
    opacityTransitionRef.current = opacityTransition
  }, [opacityTransition])

  const mediaSnapRef = useRef<MediaSnap>({
    front: 0,
    video: [null, null],
    image: [null, null],
  })
  useLayoutEffect(() => {
    mediaSnapRef.current = { front, video: videoSrc, image: imageSrc }
  }, [front, videoSrc, imageSrc])

  const crossfadeMsRef = useRef(3000)
  const [slotCrossfadeMs, setSlotCrossfadeMs] = useState(3000)
  const mutedRef = useRef(false)
  const volumeRef = useRef(1)
  const sinkIdRef = useRef('')
  const loopRef = useRef(false)
  const loadGenRef = useRef(0)
  /** Una sola catena di load alla volta: evita che un secondo load cancelli il timeout del crossfade lasciando l’UI bloccata. */
  const loadQueueRef = useRef(Promise.resolve())
  const transitionEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  /** Durante crossfade: slot del nuovo brano (il play IPC deve colpire lui, non il front legacy). */
  const crossfadeIncomingRef = useRef<Slot | null>(null)
  /** Still→still: tra caricamento incoming e inizio opacity non avviare il timer sul vecchio front. */
  const stillCrossfadePreparingRef = useRef(false)
  const stillAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const [transportPlaying, setTransportPlaying] = useState(false)
  const transportPlayingRef = useRef(false)
  useLayoutEffect(() => {
    transportPlayingRef.current = transportPlaying
  }, [transportPlaying])
  const [outputLoopOne, setOutputLoopOne] = useState(false)
  const stillImageDurationMsRef = useRef(DEFAULT_STILL_IMAGE_DURATION_MS)
  const [stillDurationEpoch, setStillDurationEpoch] = useState(0)
  const [chalkboardLayer, setChalkboardLayer] = useState<{
    visible: boolean
    src: string | null
    /** Incrementato a ogni frame inviato: forza reload `<img>` (stesso path file). */
    bust: number
    /** Allineato a Chalkboard: `transparent` = buchi → PGM o tappo sotto. */
    composite: 'solid' | 'transparent'
    /** Con ON/solid: tinta lavagna dietro l’immagine (buchi alpha non diventano neri). */
    boardBackgroundColor: string | null
  }>({
    visible: false,
    src: null,
    bust: 0,
    composite: 'solid',
    boardBackgroundColor: null,
  })

  const [playlistWatermark, setPlaylistWatermark] = useState<{
    visible: boolean
    src: string | null
  }>({ visible: false, src: null })

  const [titlesLayer, setTitlesLayer] = useState<{
    visible: boolean
    doc: RegiaTitleDocumentV1 | null
    bust: number
  }>({
    visible: false,
    doc: REGIA_TITLE_DOC_EMPTY_V1,
    bust: 0,
  })

  const [idleCap, setIdleCap] = useState<OutputIdleCapPersist>(() =>
    readOutputIdleCapFromLs(),
  )
  const [idleCapImageUrl, setIdleCapImageUrl] = useState<string | null>(null)
  const [programLogoVisible, setProgramLogoVisible] = useState(() =>
    readOutputProgramLogoVisibleFromLs(),
  )

  const applySinkToVideo = useCallback((el: HTMLVideoElement) => {
    const setSink = (
      el as HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }
    ).setSinkId
    if (typeof setSink !== 'function') return
    void setSink.call(el, sinkIdRef.current || '').catch(() => {})
  }, [])

  const applySinkToSottofondo = useCallback((el: HTMLAudioElement) => {
    const setSink = (
      el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
    ).setSinkId
    if (typeof setSink !== 'function') return
    void setSink.call(el, sinkIdRef.current || '').catch(() => {})
  }, [])

  const cancelSottofondoRamp = useCallback(() => {
    if (sottofondoRampRafRef.current != null) {
      cancelAnimationFrame(sottofondoRampRafRef.current)
      sottofondoRampRafRef.current = null
    }
  }, [])

  const sottofondoSlotEl = useCallback(
    (slot: SottofondoSlot) =>
      slot === 0 ? sottofondoRef0.current : sottofondoRef1.current,
    [],
  )

  const applyVideoAttrsFromState = useCallback(() => {
    const vs = mediaSnapRef.current.video
    for (const slot of [0, 1] as const) {
      const el = slot === 0 ? vRef0.current : vRef1.current
      if (!el) continue
      el.muted = mutedRef.current
      el.loop = loopRef.current
      el.volume = volumeRef.current
      const url = vs[slot]
      if (url) {
        if (el.src !== url) {
          el.src = url
          void el.load()
        }
      } else if (el.src) {
        el.removeAttribute('src')
        void el.load()
      }
      applySinkToVideo(el)
    }
  }, [applySinkToVideo])

  useLayoutEffect(() => {
    applyVideoAttrsFromState()
    /* Dopo ogni load la regia invia subito `play` via IPC: quel comando può essere
     * eseguito prima che React abbia committato `videoSrc` / `el.src`, quindi
     * `fel.play()` fallisce e il video resta fermo (le immagini no: non usano play).
     * Qui riallineiamo play al commit del media sul front. */
    if (!transportPlaying) return
    if (opacityTransition) return
    if (crossfadeIncomingRef.current != null) return
    if (stillCrossfadePreparingRef.current) return
    const vid = videoSrc[front]
    const img = imageSrc[front]
    if (!vid || img) return
    const fel = front === 0 ? vRef0.current : vRef1.current
    if (!fel) return
    void fel.play().catch(() => {})
  }, [
    applyVideoAttrsFromState,
    videoSrc,
    imageSrc,
    front,
    transportPlaying,
    opacityTransition,
  ])

  const pauseBoth = useCallback(() => {
    vRef0.current?.pause()
    vRef1.current?.pause()
  }, [])

  const clearTransitionTimer = useCallback(() => {
    if (transitionEndTimerRef.current != null) {
      clearTimeout(transitionEndTimerRef.current)
      transitionEndTimerRef.current = null
    }
  }, [])

  const clearStillAdvanceTimer = useCallback(() => {
    if (stillAdvanceTimerRef.current != null) {
      clearTimeout(stillAdvanceTimerRef.current)
      stillAdvanceTimerRef.current = null
    }
  }, [])

  const vacateProgramSlots = useCallback(() => {
    loadGenRef.current += 1
    clearTransitionTimer()
    clearStillAdvanceTimer()
    crossfadeIncomingRef.current = null
    stillCrossfadePreparingRef.current = false
    pauseBoth()
    setTransportPlaying(false)
    setVideoSrc([null, null])
    setImageSrc([null, null])
    setFront(0)
    setOpacityTransition(false)
    setOpacity([1, 0])
  }, [clearStillAdvanceTimer, clearTransitionTimer, pauseBoth])

  const applyInstantLoad = useCallback(
    (src: string) => {
      stillCrossfadePreparingRef.current = false
      crossfadeIncomingRef.current = null
      clearTransitionTimer()
      const still = isStillImagePath(src)
      pauseBoth()
      if (still) {
        setVideoSrc([null, null])
        setImageSrc([src, null])
      } else {
        setVideoSrc([src, null])
        setImageSrc([null, null])
      }
      setFront(0)
      setOpacityTransition(false)
      setOpacity([1, 0])
    },
    [clearTransitionTimer, pauseBoth],
  )

  const runLoadTask = useCallback(
    async (src: string, crossfadeMsForThisLoad: number) => {
      clearStillAdvanceTimer()
      loadGenRef.current += 1
      const myGen = loadGenRef.current

      clearTransitionTimer()
      crossfadeIncomingRef.current = null
      stillCrossfadePreparingRef.current = false

      const snap = mediaSnapRef.current
      const f = snap.front
      const curV = snap.video[f]
      const curI = snap.image[f]
      const had = Boolean(curV || curI)
      const curStill = Boolean(curI)
      const nextStill = isStillImagePath(src)

      /** Valore catturato sul comando `load`: evita che `setCrossfadeMs` IPC arrivi prima dell’esecuzione e azzeri il ref. */
      const useFade =
        crossfadeMsForThisLoad > 0 && had && curStill === nextStill

      if (!useFade) {
        applyInstantLoad(src)
        return
      }

      const incoming: Slot = ((1 - f) as Slot)

      if (nextStill) {
        stillCrossfadePreparingRef.current = true
        setImageSrc((prev) => {
          const n: [string | null, string | null] = [...prev]
          n[incoming] = src
          return n
        })
        setVideoSrc((prev) => {
          const n: [string | null, string | null] = [...prev]
          n[incoming] = null
          return n
        })
        await preloadImage(src)
        if (myGen !== loadGenRef.current) {
          stillCrossfadePreparingRef.current = false
          return
        }
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        if (myGen !== loadGenRef.current) {
          stillCrossfadePreparingRef.current = false
          return
        }
      } else {
        setVideoSrc((prev) => {
          const n: [string | null, string | null] = [...prev]
          n[incoming] = src
          return n
        })
        setImageSrc((prev) => {
          const n: [string | null, string | null] = [...prev]
          n[incoming] = null
          return n
        })
        const deadline = performance.now() + 1200
        let elIn: HTMLVideoElement | null = null
        while (performance.now() < deadline) {
          if (myGen !== loadGenRef.current) return
          elIn = incoming === 0 ? vRef0.current : vRef1.current
          if (elIn) break
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve())
          })
        }
        if (myGen !== loadGenRef.current) return
        if (!elIn) {
          applyInstantLoad(src)
          return
        }
        await waitVideoElementLoaded(
          elIn,
          () => myGen !== loadGenRef.current,
        )
        if (myGen !== loadGenRef.current) return
        /* Uscita program: mute/loop/volume/sink sono API imperative su <video> (non «stato React»). */
        /* eslint-disable react-hooks/immutability -- DOM video element from ref */
        elIn.muted = mutedRef.current
        elIn.loop = loopRef.current
        elIn.volume = volumeRef.current
        applySinkToVideo(elIn)
        /* eslint-enable react-hooks/immutability */
        try {
          await elIn.play()
        } catch {
          /* ignore */
        }
        crossfadeIncomingRef.current = incoming
        const oldEl = f === 0 ? vRef0.current : vRef1.current
        oldEl?.pause()
      }

      if (myGen !== loadGenRef.current) {
        crossfadeIncomingRef.current = null
        stillCrossfadePreparingRef.current = false
        return
      }

      stillCrossfadePreparingRef.current = false
      setSlotCrossfadeMs(crossfadeMsForThisLoad)
      setOpacityTransition(true)
      setOpacity(() => {
        const n: [number, number] = [0, 0]
        n[f] = 0
        n[incoming] = 1
        return n
      })

      await new Promise<void>((resolve) => {
        clearTransitionTimer()
        transitionEndTimerRef.current = setTimeout(() => {
          transitionEndTimerRef.current = null
          if (myGen !== loadGenRef.current) {
            resolve()
            return
          }

          crossfadeIncomingRef.current = null
          pauseBoth()

          setFront(incoming)
          setOpacityTransition(false)
          setOpacity(incoming === 0 ? [1, 0] : [0, 1])

          if (nextStill) {
            setImageSrc(() => {
              const n: [string | null, string | null] = [null, null]
              n[incoming] = src
              return n
            })
            setVideoSrc([null, null])
          } else {
            setVideoSrc(() => {
              const n: [string | null, string | null] = [null, null]
              n[incoming] = src
              return n
            })
            setImageSrc([null, null])
          }

          const oldEl = f === 0 ? vRef0.current : vRef1.current
          if (oldEl && f !== incoming) {
            oldEl.pause()
            oldEl.removeAttribute('src')
            void oldEl.load()
          }
          resolve()
        }, crossfadeMsForThisLoad + 40)
      })
    },
    [
      applyInstantLoad,
      applySinkToVideo,
      clearStillAdvanceTimer,
      clearTransitionTimer,
      pauseBoth,
    ],
  )

  const handleLoad = useCallback(
    (src: string, crossfadeMsFromCmd?: number) => {
      const crossfadeMsForQueued =
        crossfadeMsFromCmd !== undefined
          ? crossfadeMsFromCmd
          : crossfadeMsRef.current
      loadQueueRef.current = loadQueueRef.current
        .catch(() => {})
        .then(() => runLoadTask(src, crossfadeMsForQueued))
      void loadQueueRef.current
    },
    [runLoadTask],
  )

  useLayoutEffect(() => {
    clearStillAdvanceTimer()
    if (!transportPlaying) return
    if (outputLoopOne) return
    if (opacityTransition) return
    if (stillCrossfadePreparingRef.current) return
    const img = imageSrc[front]
    const vid = videoSrc[front]
    if (vid) return
    if (!img) return
    stillAdvanceTimerRef.current = setTimeout(() => {
      stillAdvanceTimerRef.current = null
      window.electronAPI?.notifyVideoEnded()
    }, stillImageDurationMsRef.current)
    return () => {
      clearStillAdvanceTimer()
    }
  }, [
    clearStillAdvanceTimer,
    front,
    imageSrc,
    videoSrc,
    opacityTransition,
    transportPlaying,
    outputLoopOne,
    stillDurationEpoch,
  ])

  const apply = useCallback(
    (cmd: PlaybackCommand) => {
      switch (cmd.type) {
        case 'load': {
          const ms =
            cmd.crossfadeMs !== undefined
              ? clampPlaybackCrossfadeMs(cmd.crossfadeMs)
              : crossfadeMsRef.current
          if (cmd.crossfadeMs !== undefined) {
            crossfadeMsRef.current = ms
          }
          void handleLoad(cmd.src, ms)
          break
        }
        case 'setCrossfadeMs':
          crossfadeMsRef.current = clampPlaybackCrossfadeMs(cmd.ms)
          break
        case 'setCrossfade':
          crossfadeMsRef.current = cmd.enabled ? 3000 : 0
          break
        case 'seek': {
          const snap = mediaSnapRef.current
          const fel = snap.front === 0 ? vRef0.current : vRef1.current
          const img = snap.image[snap.front]
          if (img || !fel) break
          const d = fel.duration
          let t = cmd.seconds
          if (Number.isFinite(d) && d > 0) {
            t = Math.max(0, Math.min(t, Math.max(0, d - 1e-3)))
          } else {
            t = Math.max(0, t)
          }
          fel.currentTime = t
          break
        }
        case 'play': {
          setTransportPlaying(true)
          const pend = crossfadeIncomingRef.current
          if (pend != null) {
            const el = pend === 0 ? vRef0.current : vRef1.current
            if (el) void el.play().catch(() => {})
            break
          }
          const snap = mediaSnapRef.current
          const fel = snap.front === 0 ? vRef0.current : vRef1.current
          const img = snap.image[snap.front]
          if (!img && fel) {
            void fel.play().catch(() => {})
          }
          break
        }
        case 'pause':
          setTransportPlaying(false)
          clearStillAdvanceTimer()
          pauseBoth()
          break
        case 'programVacant':
          vacateProgramSlots()
          break
        case 'setMuted':
          mutedRef.current = cmd.muted
          if (vRef0.current) vRef0.current.muted = cmd.muted
          if (vRef1.current) vRef1.current.muted = cmd.muted
          break
        case 'setVolume': {
          const v = Math.min(1, Math.max(0, cmd.volume))
          volumeRef.current = v
          if (vRef0.current) vRef0.current.volume = v
          if (vRef1.current) vRef1.current.volume = v
          break
        }
        case 'setSinkId':
          sinkIdRef.current = cmd.sinkId
          if (vRef0.current) applySinkToVideo(vRef0.current)
          if (vRef1.current) applySinkToVideo(vRef1.current)
          if (sottofondoRef0.current)
            applySinkToSottofondo(sottofondoRef0.current)
          if (sottofondoRef1.current)
            applySinkToSottofondo(sottofondoRef1.current)
          break
        case 'setLoopOne':
          loopRef.current = cmd.loop
          setOutputLoopOne(cmd.loop)
          if (vRef0.current) vRef0.current.loop = cmd.loop
          if (vRef1.current) vRef1.current.loop = cmd.loop
          break
        case 'setStillImageDurationSec': {
          const raw = Number(cmd.seconds)
          const sec = Number.isFinite(raw)
            ? Math.min(600, Math.max(1, Math.floor(raw)))
            : 8
          stillImageDurationMsRef.current = sec * 1000
          setStillDurationEpoch((n) => n + 1)
          break
        }
        case 'playlistWatermark': {
          if (!cmd.visible) {
            setPlaylistWatermark({ visible: false, src: null })
            break
          }
          const ws =
            cmd.src && cmd.src.length > 0 ? cmd.src : null
          setPlaylistWatermark({ visible: true, src: ws })
          break
        }
        case 'chalkboardLayer': {
          if (!cmd.visible) {
            setChalkboardLayer((p) => ({
              visible: false,
              src: null,
              bust: p.bust,
              composite: 'solid',
              boardBackgroundColor: null,
            }))
            break
          }
          const s = cmd.src && cmd.src.length > 0 ? cmd.src : null
          const composite =
            cmd.composite === 'transparent' ? 'transparent' : 'solid'
          const boardBackgroundColor =
            composite === 'solid' &&
            typeof cmd.boardBackgroundColor === 'string' &&
            /^#[0-9a-fA-F]{6}$/i.test(cmd.boardBackgroundColor.trim())
              ? cmd.boardBackgroundColor.trim().toLowerCase()
              : null
          setChalkboardLayer((p) => ({
            visible: true,
            src: s,
            bust: p.bust + 1,
            composite,
            boardBackgroundColor,
          }))
          break
        }
        case 'setOutputIdleCap': {
          const next = normalizeOutputIdleCap({
            mode: cmd.mode,
            color: cmd.color,
            imagePath: cmd.imagePath,
          })
          setIdleCap(next)
          break
        }
        case 'setOutputProgramLogoVisible':
          setProgramLogoVisible(cmd.visible === true)
          break
        case 'titlesLayer': {
          if (!cmd.visible) {
            setTitlesLayer((p) => ({
              ...p,
              visible: false,
            }))
            break
          }
          const doc =
            clampRegiaTitleDocument(cmd.doc ?? {}) ?? REGIA_TITLE_DOC_EMPTY_V1
          setTitlesLayer((p) => ({
            visible: true,
            doc,
            bust: p.bust + 1,
          }))
          break
        }
        case 'sottofondoLoad': {
          cancelSottofondoRamp()
          sottofondoLoadGenRef.current += 1
          const gen = sottofondoLoadGenRef.current
          const ms = clampPlaybackCrossfadeMs(cmd.crossfadeMs ?? 0)
          const f = sottofondoFrontRef.current
          const out = sottofondoSlotEl(f)
          const inc: SottofondoSlot = ((1 - f) as SottofondoSlot)
          const inEl = sottofondoSlotEl(inc)
          if (!out || !inEl) break

          const baseVol = Math.min(1, Math.max(0, sottofondoVolRef.current))
          const loopOne = cmd.loop === true
          const had =
            Boolean(out.src) &&
            !out.paused &&
            out.currentTime > 0.04 &&
            out.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA

          if (ms <= 0 || !had) {
            inEl.loop = false
            inEl.pause()
            inEl.removeAttribute('src')
            void inEl.load()
            out.loop = loopOne
            if (out.src !== cmd.src) {
              out.src = cmd.src
              void out.load()
            } else {
              void out.load()
            }
            out.muted = sottofondoMutedRef.current
            out.volume = baseVol
            applySinkToSottofondo(out)
            break
          }

          out.loop = false
          out.volume = baseVol
          inEl.loop = loopOne
          if (inEl.src !== cmd.src) {
            inEl.src = cmd.src
            void inEl.load()
          } else {
            void inEl.load()
          }
          inEl.muted = sottofondoMutedRef.current
          inEl.volume = 0
          applySinkToSottofondo(inEl)
          void inEl.play().catch(() => {})

          const t0 = performance.now()
          const step = () => {
            if (gen !== sottofondoLoadGenRef.current) return
            const now = performance.now()
            const p = Math.min(1, (now - t0) / ms)
            out.volume = baseVol * (1 - p)
            inEl.volume = baseVol * p
            if (p >= 1) {
              sottofondoRampRafRef.current = null
              out.pause()
              out.removeAttribute('src')
              void out.load()
              inEl.volume = baseVol
              sottofondoFrontRef.current = inc
              return
            }
            sottofondoRampRafRef.current = requestAnimationFrame(step)
          }
          sottofondoRampRafRef.current = requestAnimationFrame(step)
          break
        }
        case 'sottofondoPlay': {
          const f = sottofondoFrontRef.current
          const a = sottofondoSlotEl(f)
          if (a) void a.play().catch(() => {})
          break
        }
        case 'sottofondoPause': {
          sottofondoRef0.current?.pause()
          sottofondoRef1.current?.pause()
          break
        }
        case 'sottofondoStop': {
          cancelSottofondoRamp()
          sottofondoLoadGenRef.current += 1
          sottofondoFrontRef.current = 0
          for (const slot of [0, 1] as const) {
            const a = sottofondoSlotEl(slot)
            if (!a) continue
            a.loop = false
            a.pause()
            a.removeAttribute('src')
            void a.load()
          }
          break
        }
        case 'sottofondoSetVolume': {
          const v = Math.min(1, Math.max(0, cmd.volume))
          sottofondoVolRef.current = v
          for (const slot of [0, 1] as const) {
            const a = sottofondoSlotEl(slot)
            if (a?.src) a.volume = v
          }
          break
        }
        case 'sottofondoSetMuted': {
          sottofondoMutedRef.current = cmd.muted
          if (sottofondoRef0.current) sottofondoRef0.current.muted = cmd.muted
          if (sottofondoRef1.current) sottofondoRef1.current.muted = cmd.muted
          break
        }
        default:
          break
      }
    },
    [
      applySinkToVideo,
      applySinkToSottofondo,
      cancelSottofondoRamp,
      clearStillAdvanceTimer,
      handleLoad,
      pauseBoth,
      sottofondoSlotEl,
      vacateProgramSlots,
    ],
  )

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    const unsub = api.onPlaybackCommand(apply)
    return unsub
  }, [apply])

  useLayoutEffect(() => {
    const onEnded = (ev: Event) => {
      const t = ev.currentTarget as HTMLAudioElement
      const f = sottofondoFrontRef.current
      const frontEl = f === 0 ? sottofondoRef0.current : sottofondoRef1.current
      if (t !== frontEl) return
      if (sottofondoRampRafRef.current != null) return
      window.electronAPI?.notifySottofondoEnded?.()
    }
    const a0 = sottofondoRef0.current
    const a1 = sottofondoRef1.current
    a0?.addEventListener('ended', onEnded)
    a1?.addEventListener('ended', onEnded)
    return () => {
      a0?.removeEventListener('ended', onEnded)
      a1?.removeEventListener('ended', onEnded)
    }
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === OUTPUT_IDLE_CAP_LS_KEY) {
        try {
          const next = e.newValue
            ? normalizeOutputIdleCap(JSON.parse(e.newValue) as unknown)
            : readOutputIdleCapFromLs()
          setIdleCap(next)
        } catch {
          setIdleCap(readOutputIdleCapFromLs())
        }
        return
      }
      if (e.key === OUTPUT_PROGRAM_LOGO_LS_KEY) {
        setProgramLogoVisible(readOutputProgramLogoVisibleFromLs())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const pullIdleCapFromMain = useCallback(() => {
    const api = window.electronAPI
    if (!api?.getOutputIdleCap) {
      setIdleCap(readOutputIdleCapFromLs())
      return
    }
    void api
      .getOutputIdleCap()
      .then((cap) => setIdleCap(normalizeOutputIdleCap(cap)))
      .catch(() => setIdleCap(readOutputIdleCapFromLs()))
  }, [])

  const pullProgramLogoFromMain = useCallback(() => {
    const api = window.electronAPI
    if (!api?.getOutputProgramLogoVisible) {
      setProgramLogoVisible(readOutputProgramLogoVisibleFromLs())
      return
    }
    void api
      .getOutputProgramLogoVisible()
      .then((r) => {
        if (r && typeof r.visible === 'boolean') {
          setProgramLogoVisible(r.visible)
        }
      })
      .catch(() => setProgramLogoVisible(readOutputProgramLogoVisibleFromLs()))
  }, [])

  /**
   * Disco + IPC possono arrivare dopo il primo paint; la regia scrive il JSON in un tick successivo.
   * Ripetiamo il pull e usiamo localStorage come fallback se l’invoke fallisce (preload vecchio).
   */
  useEffect(() => {
    queueMicrotask(() => {
      pullIdleCapFromMain()
    })
    const t1 = window.setTimeout(pullIdleCapFromMain, 100)
    const t2 = window.setTimeout(pullIdleCapFromMain, 450)
    const t3 = window.setTimeout(pullIdleCapFromMain, 1200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [pullIdleCapFromMain])

  useEffect(() => {
    queueMicrotask(() => {
      pullProgramLogoFromMain()
    })
    const t1 = window.setTimeout(pullProgramLogoFromMain, 100)
    const t2 = window.setTimeout(pullProgramLogoFromMain, 450)
    const t3 = window.setTimeout(pullProgramLogoFromMain, 1200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [pullProgramLogoFromMain])

  useEffect(() => {
    if (idleCap.mode !== 'image' || !idleCap.imagePath) {
      queueMicrotask(() => setIdleCapImageUrl(null))
      return
    }
    const api = window.electronAPI
    if (!api?.toFileUrl) {
      queueMicrotask(() => setIdleCapImageUrl(null))
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const url = await api.toFileUrl(idleCap.imagePath!)
        if (!cancelled) setIdleCapImageUrl(url)
      } catch {
        if (!cancelled) setIdleCapImageUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [idleCap.mode, idleCap.imagePath])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.reportRemotePlaybackSnapshotPatch) return
    const tick = () => {
      const snap = mediaSnapRef.current
      const fr = snap.front
      const fel = fr === 0 ? vRef0.current : vRef1.current
      const img = snap.image[fr]
      const vidUrl = snap.video[fr]
      const playing = transportPlayingRef.current
      let title: string | null = null
      let pos: number | null = null
      let dur: number | null = null
      const hasMedia = Boolean(vidUrl || img)
      if (img) {
        title = 'Immagine'
        pos = 0
        dur = null
      } else if (fel && vidUrl) {
        const src = fel.currentSrc || fel.src || vidUrl
        try {
          const u = new URL(src, window.location.href)
          if (u.protocol === 'file:') {
            const dec = decodeURIComponent(
              u.pathname.split('/').pop() || '',
            )
            title = dec || 'Media'
          } else {
            title = src.split('/').pop() || 'Media'
          }
        } catch {
          title = 'Media'
        }
        pos = Number.isFinite(fel.currentTime) ? fel.currentTime : 0
        dur =
          Number.isFinite(fel.duration) && fel.duration > 0 ? fel.duration : null
      }
      api.reportRemotePlaybackSnapshotPatch({
        programPlaying: playing && hasMedia,
        programTitle: title,
        programPositionSec: pos,
        programDurationSec: dur,
      })
    }
    const id = window.setInterval(tick, 320)
    tick()
    return () => window.clearInterval(id)
  }, [])

  /**
   * VU sulla barra regia: tap via `captureStream()` + `createMediaStreamSource`.
   * Non usare `createMediaElementSource` sui `<video>`: intercetta l’audio e fa ignorare
   * `setSinkId` sul media element; `AudioContext.setSinkId('')` può silenziare l’uscita.
   */
  useLayoutEffect(() => {
    const report = window.electronAPI?.reportOutputAudioLevel
    if (typeof report !== 'function') return
    const v0 = vRef0.current
    const v1 = vRef1.current
    if (!v0 || !v1) return

    const capture = (el: HTMLVideoElement): MediaStream | null => {
      const fn = (el as HTMLVideoElement & { captureStream?: () => MediaStream })
        .captureStream
      if (typeof fn !== 'function') return null
      try {
        return fn.call(el)
      } catch {
        return null
      }
    }

    const ctx = new AudioContext()
    const silent = ctx.createGain()
    silent.gain.value = 0
    silent.connect(ctx.destination)

    const a0 = ctx.createAnalyser()
    const a1 = ctx.createAnalyser()
    a0.fftSize = 512
    a1.fftSize = 512
    a0.smoothingTimeConstant = 0.45
    a1.smoothingTimeConstant = 0.45

    const buf0 = new Uint8Array(a0.fftSize)
    const buf1 = new Uint8Array(a1.fftSize)

    let src0: MediaStreamAudioSourceNode | null = null
    let src1: MediaStreamAudioSourceNode | null = null
    let stream0: MediaStream | null = null
    let stream1: MediaStream | null = null

    const disconnectTap = () => {
      try {
        src0?.disconnect()
        src1?.disconnect()
      } catch {
        /* ignore */
      }
      try {
        a0.disconnect()
        a1.disconnect()
      } catch {
        /* ignore */
      }
      src0 = null
      src1 = null
      stream0?.getAudioTracks().forEach((t) => t.stop())
      stream1?.getAudioTracks().forEach((t) => t.stop())
      stream0 = null
      stream1 = null
    }

    const connectTap = () => {
      disconnectTap()
      const s0 = capture(v0)
      const s1 = capture(v1)
      /* Un solo slot può avere media: richiedere entrambi gli stream annulla sempre il tap. */
      if (!s0 && !s1) return
      try {
        if (s0) {
          const n0 = ctx.createMediaStreamSource(s0)
          n0.connect(a0)
          a0.connect(silent)
          src0 = n0
          stream0 = s0
        }
        if (s1) {
          const n1 = ctx.createMediaStreamSource(s1)
          n1.connect(a1)
          a1.connect(silent)
          src1 = n1
          stream1 = s1
        }
      } catch {
        disconnectTap()
      }
    }

    connectTap()

    let rebuildCoalesce = false
    const scheduleRebuild = () => {
      if (rebuildCoalesce) return
      rebuildCoalesce = true
      queueMicrotask(() => {
        rebuildCoalesce = false
        connectTap()
      })
    }

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
      a0.getByteTimeDomainData(buf0)
      a1.getByteTimeDomainData(buf1)
      const peak = Math.max(
        rmsFromByteTimeDomain(buf0),
        rmsFromByteTimeDomain(buf1),
      )
      report(
        outputMeterLevelFromPeak(
          peak,
          mutedRef.current,
          volumeRef.current,
          /* captureStream tende a dare RMS più bassi del tap diretto */
          5.5,
        ),
      )
    }
    raf = requestAnimationFrame(tick)

    const onPlaying = () => {
      void ctx.resume().catch(() => {})
      /* La traccia audio compare spesso nello stream solo dopo il play. */
      scheduleRebuild()
    }
    v0.addEventListener('playing', onPlaying)
    v1.addEventListener('playing', onPlaying)
    v0.addEventListener('loadeddata', scheduleRebuild)
    v1.addEventListener('loadeddata', scheduleRebuild)
    v0.addEventListener('emptied', scheduleRebuild)
    v1.addEventListener('emptied', scheduleRebuild)

    return () => {
      cancelAnimationFrame(raf)
      v0.removeEventListener('playing', onPlaying)
      v1.removeEventListener('playing', onPlaying)
      v0.removeEventListener('loadeddata', scheduleRebuild)
      v1.removeEventListener('loadeddata', scheduleRebuild)
      v0.removeEventListener('emptied', scheduleRebuild)
      v1.removeEventListener('emptied', scheduleRebuild)
      disconnectTap()
      try {
        silent.disconnect()
      } catch {
        /* ignore */
      }
      void ctx.close()
    }
  }, [])

  /** Dopo hide/show della finestra Electron: riallinea tappo; riprendi play se il trasporto è in «play». */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      pullIdleCapFromMain()
      if (!transportPlayingRef.current) return
      if (opacityTransitionRef.current) return
      if (crossfadeIncomingRef.current != null) return
      if (stillCrossfadePreparingRef.current) return
      const snap = mediaSnapRef.current
      const fel = snap.front === 0 ? vRef0.current : vRef1.current
      const img = snap.image[snap.front]
      if (img || !fel) return
      void fel.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [pullIdleCapFromMain])

  const onVideoEnded = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const t = e.currentTarget
    if (t.loop) return
    const snap = mediaSnapRef.current
    const fel = snap.front === 0 ? vRef0.current : vRef1.current
    if (t !== fel) return
    window.electronAPI?.notifyVideoEnded()
  }, [])

  const showImg0 = Boolean(imageSrc[0])
  const showImg1 = Boolean(imageSrc[1])

  const chalkboardOnAir =
    chalkboardLayer.visible && Boolean(chalkboardLayer.src)
  const chalkboardTransparentOnAir =
    chalkboardOnAir && chalkboardLayer.composite === 'transparent'
  const chalkboardOpaqueOnAir =
    chalkboardOnAir && chalkboardLayer.composite === 'solid'
  const slotsHaveMedia = Boolean(
    videoSrc[0] || videoSrc[1] || imageSrc[0] || imageSrc[1],
  )
  /**
   * In onda: trasporto in play e c’è PGM (slot) oppure lavagna **opaca** (ON).
   * TRANSP non riempie il buco “vuoto”: con slot vuoti resta il tappo sotto i pixel trasparenti.
   */
  const programInPlay =
    transportPlaying && (slotsHaveMedia || chalkboardOpaqueOnAir)
  /** Tappo: quando non c’è programma in play, salvo lavagna TRANSP (sotto si vede ancora il tappo). */
  const showIdleCapLayer =
    !programInPlay &&
    (!chalkboardOnAir || chalkboardTransparentOnAir)

  return (
    <div className="output-root">
      <div className="output-stack">
        <div
          className="output-slot"
          style={{
            opacity: opacity[0],
            transition: opacityTransition
              ? `opacity ${slotCrossfadeMs}ms ease-in-out`
              : 'none',
            zIndex: opacity[0] >= 0.5 ? 2 : 1,
          }}
        >
          <video
            ref={vRef0}
            className={`output-video ${showImg0 ? 'is-hidden' : ''}`}
            playsInline
            controls={false}
            onEnded={onVideoEnded}
          />
          {showImg0 && imageSrc[0] ? (
            <img
              src={imageSrc[0]}
              alt=""
              className="output-image"
              draggable={false}
            />
          ) : null}
        </div>
        <div
          className="output-slot"
          style={{
            opacity: opacity[1],
            transition: opacityTransition
              ? `opacity ${slotCrossfadeMs}ms ease-in-out`
              : 'none',
            zIndex: opacity[1] >= 0.5 ? 2 : 1,
          }}
        >
          <video
            ref={vRef1}
            className={`output-video ${showImg1 ? 'is-hidden' : ''}`}
            playsInline
            controls={false}
            onEnded={onVideoEnded}
          />
          {showImg1 && imageSrc[1] ? (
            <img
              src={imageSrc[1]}
              alt=""
              className="output-image"
              draggable={false}
            />
          ) : null}
        </div>
      </div>
      {chalkboardLayer.visible && chalkboardLayer.src ? (
        <div
          className="output-chalkboard-layer"
          aria-hidden
          style={
            chalkboardLayer.boardBackgroundColor
              ? { backgroundColor: chalkboardLayer.boardBackgroundColor }
              : undefined
          }
        >
          <img
            key={chalkboardLayer.bust}
            src={chalkboardLayer.src}
            alt=""
            className="output-chalkboard-img"
            draggable={false}
          />
        </div>
      ) : null}
      {playlistWatermark.visible && playlistWatermark.src ? (
        <div className="output-playlist-watermark" aria-hidden>
          <img
            src={playlistWatermark.src}
            alt=""
            className="output-playlist-watermark-img"
            draggable={false}
          />
        </div>
      ) : null}
      {titlesLayer.visible && titlesLayer.doc ? (
        <TitleOverlayView key={titlesLayer.bust} doc={titlesLayer.doc} />
      ) : null}
      {showIdleCapLayer ? (
        <div
          className={`output-idle-cap output-idle-cap--${idleCap.mode}`}
          aria-hidden
        >
          {idleCap.mode === 'color' ? (
            <div
              className="output-idle-cap-fill"
              style={{ backgroundColor: idleCap.color }}
            />
          ) : idleCap.mode === 'image' && idleCapImageUrl ? (
            <img
              src={idleCapImageUrl}
              alt=""
              className="output-idle-cap-img"
              draggable={false}
            />
          ) : (
            <div
              className="output-idle-cap-fill"
              style={{ backgroundColor: '#000' }}
            />
          )}
        </div>
      ) : null}
      {programLogoVisible ? (
        <div
          className="output-program-badge"
          role="img"
          aria-label="REGIA MUSICPRO — uscita programma al pubblico. Nessuna anteprima «prossimo» in questa finestra."
        >
          <img
            className="output-program-badge-logo"
            src={`${import.meta.env.BASE_URL}app-icon.png`}
            alt=""
            width={64}
            height={64}
            decoding="async"
            draggable={false}
          />
        </div>
      ) : null}
      <audio
        ref={sottofondoRef0}
        className="output-sottofondo-audio"
        aria-hidden
        playsInline
        preload="auto"
      />
      <audio
        ref={sottofondoRef1}
        className="output-sottofondo-audio"
        aria-hidden
        playsInline
        preload="auto"
      />
    </div>
  )
}
