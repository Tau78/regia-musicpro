import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { PlaybackCommand } from './playbackTypes'
import { isStillImagePath } from './mediaPaths.ts'

const CROSSFADE_MS = 480
/** Durata visualizzazione immagine in playlist (uscita come «brano finito»). */
const STILL_IMAGE_DURATION_MS = 8000

type Slot = 0 | 1

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const im = new Image()
    im.onload = () => resolve()
    im.onerror = () => resolve()
    im.src = src
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

  const mediaSnapRef = useRef<MediaSnap>({
    front: 0,
    video: [null, null],
    image: [null, null],
  })
  useLayoutEffect(() => {
    mediaSnapRef.current = { front, video: videoSrc, image: imageSrc }
  }, [front, videoSrc, imageSrc])

  const crossfadeRef = useRef(false)
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
  const [outputLoopOne, setOutputLoopOne] = useState(false)

  const applySinkToVideo = useCallback((el: HTMLVideoElement) => {
    const setSink = (
      el as HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }
    ).setSinkId
    if (typeof setSink !== 'function') return
    void setSink.call(el, sinkIdRef.current || '').catch(() => {})
  }, [])

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
  }, [applyVideoAttrsFromState, videoSrc])

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

  const waitVideoElement = useCallback(
    (el: HTMLVideoElement, gen: number): Promise<void> => {
      return new Promise((resolve) => {
        const done = () => {
          el.removeEventListener('loadeddata', onData)
          el.removeEventListener('error', onErr)
          resolve()
        }
        const onData = () => done()
        const onErr = () => done()
        if (gen !== loadGenRef.current) {
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
    },
    [],
  )

  const runLoadTask = useCallback(
    async (src: string) => {
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

      const useFade =
        crossfadeRef.current && had && curStill === nextStill

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
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        if (myGen !== loadGenRef.current) return
        const elIn = incoming === 0 ? vRef0.current : vRef1.current
        if (!elIn) {
          applyInstantLoad(src)
          return
        }
        await waitVideoElement(elIn, myGen)
        if (myGen !== loadGenRef.current) return
        elIn.muted = mutedRef.current
        elIn.loop = loopRef.current
        elIn.volume = volumeRef.current
        applySinkToVideo(elIn)
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
        }, CROSSFADE_MS + 40)
      })
    },
    [
      applyInstantLoad,
      applySinkToVideo,
      clearStillAdvanceTimer,
      clearTransitionTimer,
      pauseBoth,
      waitVideoElement,
    ],
  )

  const handleLoad = useCallback(
    (src: string) => {
      loadQueueRef.current = loadQueueRef.current
        .catch(() => {})
        .then(() => runLoadTask(src))
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
    }, STILL_IMAGE_DURATION_MS)
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
  ])

  const apply = useCallback(
    (cmd: PlaybackCommand) => {
      switch (cmd.type) {
        case 'load':
          if (cmd.crossfade !== undefined) {
            crossfadeRef.current = cmd.crossfade
          }
          void handleLoad(cmd.src)
          break
        case 'setCrossfade':
          crossfadeRef.current = cmd.enabled
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
          break
        case 'setLoopOne':
          loopRef.current = cmd.loop
          setOutputLoopOne(cmd.loop)
          if (vRef0.current) vRef0.current.loop = cmd.loop
          if (vRef1.current) vRef1.current.loop = cmd.loop
          break
        default:
          break
      }
    },
    [applySinkToVideo, clearStillAdvanceTimer, handleLoad, pauseBoth],
  )

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    const unsub = api.onPlaybackCommand(apply)
    return unsub
  }, [apply])

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

  return (
    <div className="output-root">
      <div className="output-stack">
        <div
          className="output-slot"
          style={{
            opacity: opacity[0],
            transition: opacityTransition
              ? `opacity ${CROSSFADE_MS}ms ease-in-out`
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
              ? `opacity ${CROSSFADE_MS}ms ease-in-out`
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
    </div>
  )
}
