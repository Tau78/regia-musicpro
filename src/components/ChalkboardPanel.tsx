import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import {
  CHALKBOARD_BANK_COUNT,
  chalkboardDrawPathFromCompositePath,
  normalizeChalkboardBackgroundHex,
  type ChalkboardOutputMode,
  type ChalkboardPlacedImage,
  type FloatingPlaylistSession,
} from '../state/floatingPlaylistSession.ts'

type Tool = 'brush' | 'eraser' | 'text'

/** Anteprima testo non ancora committato sul canvas (stesso layout di commit). */
type ChalkboardTextDraftPreview = {
  bitmapX: number
  bitmapY: number
  value: string
  textFontFamily: string
  textFontSize: number
  color: string
}

type Props = {
  sessionId: string
  bankPaths: string[]
  bankIndex: number
  placements: ChalkboardPlacedImage[]
  onUpdateBankPlacements: (next: ChalkboardPlacedImage[]) => void
  outputMode: ChalkboardOutputMode
  onSetBankIndex: (i: number) => void
  patchSession: (
    sessionId: string,
    patch:
      | Partial<FloatingPlaylistSession>
      | ((s: FloatingPlaylistSession) => FloatingPlaylistSession),
  ) => void
  recordUndoPoint: () => void
  /** Colore di riempimento (gomma, svuota, PNG iniziali). */
  backgroundColor: string
  onBackgroundColorChange: (hex: string) => void
}

const MIN_IMG_PX = 24

const CHALKBOARD_TEXT_FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Sistema', value: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times', value: '"Times New Roman", Times, serif' },
  { label: 'Courier', value: '"Courier New", Courier, monospace' },
  { label: 'Trebuchet', value: '"Trebuchet MS", sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Comic Sans', value: '"Comic Sans MS", "Comic Sans", cursive' },
]

const CHALKBOARD_TEXT_SIZE_MIN = 12
const CHALKBOARD_TEXT_SIZE_MAX = 220

function newImageId(): string {
  return `cbi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function clampPlaced(
  pl: ChalkboardPlacedImage,
  outW: number,
  outH: number,
): ChalkboardPlacedImage {
  let { x, y, w, h } = pl
  w = Math.max(MIN_IMG_PX, Math.min(w, outW))
  h = Math.max(MIN_IMG_PX, Math.min(h, outH))
  x = Math.max(0, Math.min(x, outW - w))
  y = Math.max(0, Math.min(y, outH - h))
  return { ...pl, x, y, w, h }
}

/** Rettangolo massimo dentro (viewW, viewH) con proporzione aspectW:aspectH. */
function fitAspectBox(
  viewW: number,
  viewH: number,
  aspectW: number,
  aspectH: number,
): { w: number; h: number } {
  if (viewW < 2 || viewH < 2 || aspectW < 1 || aspectH < 1) {
    return { w: 0, h: 0 }
  }
  const ar = aspectW / aspectH
  let w = viewW
  let h = w / ar
  if (h > viewH) {
    h = viewH
    w = h * ar
  }
  return { w: Math.max(2, Math.floor(w)), h: Math.max(2, Math.floor(h)) }
}

async function readOutputResolution(): Promise<{
  width: number
  height: number
} | null> {
  try {
    const r = await window.electronAPI.getOutputResolution()
    if (
      r &&
      Number.isFinite(r.width) &&
      Number.isFinite(r.height) &&
      r.width > 0 &&
      r.height > 0
    ) {
      return { width: Math.round(r.width), height: Math.round(r.height) }
    }
  } catch {
    /* ignore */
  }
  return null
}

function outputScratchPathFromBankCompositePath(compositeAbs: string): string {
  if (/bank-\d+\.png$/i.test(compositeAbs)) {
    return compositeAbs.replace(/bank-\d+\.png$/i, 'regia-output-push.png')
  }
  return compositeAbs.replace(/\.png$/i, '') + '-output-push.png'
}

async function buildCompositeDataUrl(
  strokeCanvas: HTMLCanvasElement,
  placements: ChalkboardPlacedImage[],
  outW: number,
  outH: number,
  boardBackgroundHex: string,
  opts?: {
    opaqueBackground?: boolean
    textDraftPreview?: ChalkboardTextDraftPreview | null
  },
): Promise<string> {
  const off = document.createElement('canvas')
  off.width = outW
  off.height = outH
  const ctx = off.getContext('2d')
  if (!ctx) return strokeCanvas.toDataURL('image/png')
  const opaque = opts?.opaqueBackground !== false
  if (opaque) {
    const bg = normalizeChalkboardBackgroundHex(boardBackgroundHex)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, outW, outH)
  } else {
    ctx.clearRect(0, 0, outW, outH)
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(strokeCanvas, 0, 0)
  for (const pl of placements) {
    try {
      const url = await window.electronAPI.toFileUrl(pl.path)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('img'))
        img.src = url
      })
      ctx.drawImage(img, pl.x, pl.y, pl.w, pl.h)
    } catch {
      /* skip */
    }
  }
  const td = opts?.textDraftPreview
  if (td) {
    const raw = td.value.replace(/\r\n/g, '\n').trimEnd()
    if (raw.trim() !== '') {
      const lines = raw.split('\n')
      const size = Math.round(
        Math.min(
          CHALKBOARD_TEXT_SIZE_MAX,
          Math.max(CHALKBOARD_TEXT_SIZE_MIN, td.textFontSize),
        ),
      )
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      ctx.textBaseline = 'top'
      ctx.fillStyle = td.color
      ctx.font = `${size}px ${td.textFontFamily}`
      const lineHeight = size * 1.28
      let y = td.bitmapY
      for (const line of lines) {
        ctx.fillText(line, td.bitmapX, y)
        y += lineHeight
      }
      ctx.restore()
    }
  }
  return off.toDataURL('image/png')
}

type PlacedOverlayProps = {
  placements: ChalkboardPlacedImage[]
  outW: number
  outH: number
  wrapRef: RefObject<HTMLDivElement | null>
  srcByPath: Record<string, string>
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  onCommitPlacements: (next: ChalkboardPlacedImage[]) => void
  onDragEndPersist: () => void
  recordUndoPoint: () => void
}

function ChalkboardPlacedImagesOverlay({
  placements,
  outW,
  outH,
  wrapRef,
  srcByPath,
  selectedId,
  setSelectedId,
  onCommitPlacements,
  onDragEndPersist,
  recordUndoPoint,
}: PlacedOverlayProps) {
  const dragRef = useRef<{
    id: string
    kind: 'move' | 'resize'
    ptrStart: { x: number; y: number }
    orig: ChalkboardPlacedImage
  } | null>(null)

  const clientToBitmap = useCallback((clientX: number, clientY: number) => {
    const el = wrapRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return null
    const x = ((clientX - r.left) / r.width) * outW
    const y = ((clientY - r.top) / r.height) * outH
    return { x, y }
  }, [outW, outH, wrapRef])

  const onDocPointerMove = useCallback(
    (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const ptr = clientToBitmap(ev.clientX, ev.clientY)
      if (!ptr) return
      const dx = ptr.x - d.ptrStart.x
      const dy = ptr.y - d.ptrStart.y
      const o = d.orig
      let next: ChalkboardPlacedImage
      if (d.kind === 'move') {
        next = clampPlaced({ ...o, x: o.x + dx, y: o.y + dy }, outW, outH)
      } else {
        next = clampPlaced({ ...o, w: o.w + dx, h: o.h + dy }, outW, outH)
      }
      onCommitPlacements(placements.map((im) => (im.id === d.id ? next : im)))
    },
    [clientToBitmap, onCommitPlacements, outW, outH, placements],
  )

  const endDrag = useCallback(() => {
    const had = dragRef.current != null
    dragRef.current = null
    document.removeEventListener('pointermove', onDocPointerMove)
    document.removeEventListener('pointerup', endDrag)
    document.removeEventListener('pointercancel', endDrag)
    if (had) onDragEndPersist()
  }, [onDocPointerMove, onDragEndPersist])

  const startDrag = useCallback(
    (
      ev: React.PointerEvent,
      im: ChalkboardPlacedImage,
      kind: 'move' | 'resize',
    ) => {
      ev.stopPropagation()
      ev.preventDefault()
      const ptrStart = clientToBitmap(ev.clientX, ev.clientY)
      if (!ptrStart) return
      recordUndoPoint()
      dragRef.current = {
        id: im.id,
        kind,
        ptrStart,
        orig: { ...im },
      }
      document.addEventListener('pointermove', onDocPointerMove)
      document.addEventListener('pointerup', endDrag)
      document.addEventListener('pointercancel', endDrag)
      ;(ev.target as HTMLElement).setPointerCapture?.(ev.pointerId)
    },
    [clientToBitmap, endDrag, onDocPointerMove, recordUndoPoint],
  )

  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', onDocPointerMove)
      document.removeEventListener('pointerup', endDrag)
      document.removeEventListener('pointercancel', endDrag)
    }
  }, [endDrag, onDocPointerMove])

  return (
    <div
      className="floating-playlist-chalkboard-images-layer"
      aria-hidden={placements.length === 0}
    >
      {placements.map((im) => {
        const src = srcByPath[im.path]
        if (!src) return null
        const sel = im.id === selectedId
        const lp = (im.x / outW) * 100
        const tp = (im.y / outH) * 100
        const wp = (im.w / outW) * 100
        const hp = (im.h / outH) * 100
        return (
          <div
            key={im.id}
            className={`floating-playlist-chalkboard-placed ${sel ? 'is-selected' : ''}`}
            style={{
              left: `${lp}%`,
              top: `${tp}%`,
              width: `${wp}%`,
              height: `${hp}%`,
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
              const reordered = placements.filter((x) => x.id !== im.id)
              reordered.push(im)
              onCommitPlacements(reordered)
              setSelectedId(im.id)
              startDrag(e, im, 'move')
            }}
          >
            <img src={src} alt="" draggable={false} />
            {sel ? (
              <>
                <div className="floating-playlist-chalkboard-placed-outline" />
                <button
                  type="button"
                  className="floating-playlist-chalkboard-placed-resize"
                  aria-label="Ridimensiona immagine"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    startDrag(e, im, 'resize')
                  }}
                />
              </>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export default function ChalkboardPanel({
  sessionId,
  bankPaths,
  bankIndex,
  placements,
  onUpdateBankPlacements,
  outputMode,
  onSetBankIndex,
  patchSession,
  recordUndoPoint,
  backgroundColor,
  onBackgroundColorChange,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [outSize, setOutSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const [tool, setTool] = useState<Tool>('brush')
  const [color, setColor] = useState('#ffffff')
  const [lineWidth, setLineWidth] = useState(4)
  const drawingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const chalkboardOutputPushGenRef = useRef(0)
  const outputModeRef = useRef(outputMode)
  const placementsRef = useRef(placements)
  const textLiveRef = useRef({
    textDraft: null as { bitmapX: number; bitmapY: number } | null,
    textDraftValue: '',
    textFontFamily: CHALKBOARD_TEXT_FONT_OPTIONS[0]!.value,
    textFontSize: 48,
    color: '#ffffff',
  })
  const outputLivePendingRef = useRef(false)
  const outputLivePumpRunningRef = useRef(false)
  const outputLivePumpDoneRef = useRef(Promise.resolve())
  /** Evita persist/uscita prima che il canvas sia allineato al banco (race ON→TRANSP). */
  const syncPushCanvasKeyRef = useRef<string>('')
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [srcByPath, setSrcByPath] = useState<Record<string, string>>({})
  const [textFontFamily, setTextFontFamily] = useState(
    () => CHALKBOARD_TEXT_FONT_OPTIONS[0]!.value,
  )
  const [textFontSize, setTextFontSize] = useState(48)
  const [textDraft, setTextDraft] = useState<{
    bitmapX: number
    bitmapY: number
  } | null>(null)
  const [textDraftValue, setTextDraftValue] = useState('')
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  const bgHex = normalizeChalkboardBackgroundHex(backgroundColor)

  useLayoutEffect(() => {
    outputModeRef.current = outputMode
    placementsRef.current = placements
    textLiveRef.current = {
      textDraft,
      textDraftValue,
      textFontFamily,
      textFontSize,
      color,
    }
  }, [
    outputMode,
    placements,
    textDraft,
    textDraftValue,
    textFontFamily,
    textFontSize,
    color,
  ])

  const refreshResolution = useCallback(() => {
    void (async () => {
      const r = await readOutputResolution()
      if (r) setOutSize(r)
    })()
  }, [])

  useEffect(() => {
    refreshResolution()
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshResolution()
    }
    window.addEventListener('focus', refreshResolution)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', refreshResolution)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refreshResolution])

  const outW = outSize?.width ?? 0
  const outH = outSize?.height ?? 0
  const resolutionReady = outW > 0 && outH > 0

  useEffect(() => {
    if (!resolutionReady) return
    if (bankPaths.length >= CHALKBOARD_BANK_COUNT) return
    let cancelled = false
    void (async () => {
      try {
        const paths = await window.electronAPI.chalkboardEnsureBanks({
          folderBaseName: sessionId,
          draft: true,
          width: outW,
          height: outH,
          backgroundColor: bgHex,
        })
        if (cancelled) return
        if (paths.length >= CHALKBOARD_BANK_COUNT) {
          patchSession(sessionId, { chalkboardBankPaths: paths })
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    sessionId,
    bankPaths.length,
    outW,
    outH,
    resolutionReady,
    patchSession,
    bgHex,
  ])

  useEffect(() => {
    let cancelled = false
    const paths = new Set<string>()
    for (const im of placements) paths.add(im.path)
    void (async () => {
      const next: Record<string, string> = {}
      for (const p of paths) {
        if (cancelled) return
        try {
          next[p] = await window.electronAPI.toFileUrl(p)
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setSrcByPath((prev) => ({ ...prev, ...next }))
    })()
    return () => {
      cancelled = true
    }
  }, [placements])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Backspace' && ev.key !== 'Delete') return
      if (!selectedImageId) return
      const t = ev.target as HTMLElement | null
      if (t?.closest('input, textarea, [contenteditable="true"]')) return
      ev.preventDefault()
      recordUndoPoint()
      onUpdateBankPlacements(placements.filter((im) => im.id !== selectedImageId))
      setSelectedImageId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedImageId, placements, onUpdateBankPlacements, recordUndoPoint])

  useEffect(() => {
    if (tool !== 'text') {
      setTextDraft(null)
      setTextDraftValue('')
    }
  }, [tool])

  useLayoutEffect(() => {
    if (!textDraft) return
    const ta = textAreaRef.current
    if (!ta) return
    ta.focus()
    if (textDraftValue.length > 0) ta.select()
  }, [textDraft, textDraftValue])

  const cancelTextDraft = useCallback(() => {
    setTextDraft(null)
    setTextDraftValue('')
  }, [])

  const layoutCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || !resolutionReady) return
    canvas.width = outW
    canvas.height = outH
    const r = wrap.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      canvas.style.width = `${r.width}px`
      canvas.style.height = `${r.height}px`
    }
  }, [outW, outH, resolutionReady])

  const measureViewport = useCallback(() => {
    const vp = viewportRef.current
    const wrap = wrapRef.current
    if (!vp || !wrap || !resolutionReady) return
    const r = vp.getBoundingClientRect()
    const { w, h } = fitAspectBox(r.width, r.height, outW, outH)
    if (w < 2 || h < 2) return
    wrap.style.width = `${w}px`
    wrap.style.height = `${h}px`
    layoutCanvas()
  }, [outW, outH, resolutionReady, layoutCanvas])

  useLayoutEffect(() => {
    measureViewport()
  }, [measureViewport, bankIndex, outSize])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp || !resolutionReady) return
    const ro = new ResizeObserver(() => {
      measureViewport()
    })
    ro.observe(vp)
    return () => ro.disconnect()
  }, [measureViewport, resolutionReady])

  const toBitmap = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const r = canvas.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return null
    const x = ((clientX - r.left) / r.width) * outW
    const y = ((clientY - r.top) / r.height) * outH
    return { x, y }
  }

  const loadBankIntoCanvas = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !resolutionReady) return
    layoutCanvas()
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const transp = outputMode === 'transparent'
    const resetEmpty = () => {
      ctx.globalCompositeOperation = 'source-over'
      if (transp) {
        ctx.clearRect(0, 0, outW, outH)
      } else {
        ctx.fillStyle = bgHex
        ctx.fillRect(0, 0, outW, outH)
      }
    }
    if (bankPaths.length <= bankIndex || !bankPaths[bankIndex]) {
      resetEmpty()
      return
    }
    const path = bankPaths[bankIndex]!
    const drawPath = chalkboardDrawPathFromCompositePath(path)
    resetEmpty()
    const tryLoad = async (urlPath: string) => {
      const url = await window.electronAPI.toFileUrl(urlPath)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('img'))
        img.src = url
      })
      ctx.clearRect(0, 0, outW, outH)
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(img, 0, 0, outW, outH)
    }
    try {
      await tryLoad(drawPath)
    } catch {
      if (transp) {
        /* In TRANSP non caricare il composito opaco (avrebbe lo sfondo “bancato”). */
        resetEmpty()
      } else {
        try {
          await tryLoad(path)
        } catch {
          ctx.globalCompositeOperation = 'source-over'
          ctx.fillStyle = bgHex
          ctx.fillRect(0, 0, outW, outH)
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over'
  }, [
    bankPaths,
    bankIndex,
    outW,
    outH,
    resolutionReady,
    layoutCanvas,
    bgHex,
    outputMode,
  ])

  useLayoutEffect(() => {
    void loadBankIntoCanvas()
  }, [loadBankIntoCanvas])

  const persistCurrentBank = useCallback(
    async (placementsOverride?: ChalkboardPlacedImage[]) => {
    const canvas = canvasRef.current
    if (!canvas || !resolutionReady || bankPaths.length <= bankIndex) return
    const path = bankPaths[bankIndex]
    if (!path) return
    const drawPath = chalkboardDrawPathFromCompositePath(path)
    const strokeUrl = canvas.toDataURL('image/png')
    const pl = placementsOverride ?? placements
    const compositeUrl = await buildCompositeDataUrl(
      canvas,
      pl,
      outW,
      outH,
      bgHex,
      { opaqueBackground: outputMode === 'solid' },
    )
    await window.electronAPI.chalkboardWriteBankDataUrl({
      absPath: drawPath,
      dataUrl: strokeUrl,
    })
    await window.electronAPI.chalkboardWriteBankDataUrl({
      absPath: path,
      dataUrl: compositeUrl,
    })
  },
    [bankPaths, bankIndex, resolutionReady, placements, outW, outH, bgHex, outputMode],
  )

  const renderAndSendChalkboardOutputLayer = useCallback(
    async (
      mode: ChalkboardOutputMode,
      placementsOverride?: ChalkboardPlacedImage[],
      textDraftPreview?: ChalkboardTextDraftPreview | null,
    ) => {
      if (mode === 'off' || !resolutionReady || bankPaths.length <= bankIndex)
        return
      const path = bankPaths[bankIndex]
      const canvas = canvasRef.current
      if (!path || !canvas) return
      const gen = ++chalkboardOutputPushGenRef.current
      const pl = placementsOverride ?? placements
      const compositeUrl = await buildCompositeDataUrl(
        canvas,
        pl,
        outW,
        outH,
        bgHex,
        {
          opaqueBackground: mode === 'solid',
          textDraftPreview: textDraftPreview ?? undefined,
        },
      )
      if (gen !== chalkboardOutputPushGenRef.current) return
      const scratch = outputScratchPathFromBankCompositePath(path)
      await window.electronAPI.chalkboardWriteBankDataUrl({
        absPath: scratch,
        dataUrl: compositeUrl,
      })
      if (gen !== chalkboardOutputPushGenRef.current) return
      /* Path assoluto: `playback:send` in main applica `pathToMediaUrl` come per `load`. */
      void window.electronAPI.sendPlayback({
        type: 'chalkboardLayer',
        visible: true,
        src: scratch,
        composite: mode === 'transparent' ? 'transparent' : 'solid',
      })
    },
    [resolutionReady, bankPaths, bankIndex, placements, outW, outH, bgHex],
  )

  /**
   * Coda un aggiornamento uscita “live” (senza persist su disco).
   * Non usa rAF: se il callback non partiva il canale restava “occupato” e dopo una pausa
   * non partivano più aggiornamenti finché non si ricaricava tutto.
   */
  const scheduleLiveOutputPush = useCallback(() => {
    if (outputModeRef.current === 'off') return
    outputLivePendingRef.current = true
    if (outputLivePumpRunningRef.current) return
    outputLivePumpRunningRef.current = true
    const p = (async () => {
      try {
        while (outputLivePendingRef.current) {
          outputLivePendingRef.current = false
          const mode = outputModeRef.current
          if (mode === 'off') break
          const tl = textLiveRef.current
          let textDraftPreview: ChalkboardTextDraftPreview | null = null
          if (tl.textDraft) {
            const raw = tl.textDraftValue.replace(/\r\n/g, '\n').trimEnd()
            if (raw.trim() !== '') {
              textDraftPreview = {
                bitmapX: tl.textDraft.bitmapX,
                bitmapY: tl.textDraft.bitmapY,
                value: tl.textDraftValue,
                textFontFamily: tl.textFontFamily,
                textFontSize: tl.textFontSize,
                color: tl.color,
              }
            }
          }
          await renderAndSendChalkboardOutputLayer(
            mode,
            placementsRef.current,
            textDraftPreview,
          )
        }
      } finally {
        outputLivePumpRunningRef.current = false
        if (outputLivePendingRef.current) scheduleLiveOutputPush()
      }
    })()
    outputLivePumpDoneRef.current = p.catch(() => {})
  }, [renderAndSendChalkboardOutputLayer])

  const bumpRev = useCallback(() => {
    patchSession(sessionId, (s) => ({
      ...s,
      chalkboardContentRev: (s.chalkboardContentRev ?? 0) + 1,
    }))
  }, [sessionId, patchSession])

  const flushToDisk = useCallback(async () => {
    await outputLivePumpDoneRef.current
    await persistCurrentBank()
    bumpRev()
    await renderAndSendChalkboardOutputLayer(outputMode, undefined, null)
  }, [persistCurrentBank, bumpRev, renderAndSendChalkboardOutputLayer, outputMode])

  const commitTextDraft = useCallback(() => {
    if (!textDraft || !resolutionReady) return
    const raw = textDraftValue.replace(/\r\n/g, '\n').trimEnd()
    if (raw.trim() === '') {
      cancelTextDraft()
      return
    }
    const lines = raw.split('\n')
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) {
      cancelTextDraft()
      return
    }
    const size = Math.round(
      Math.min(
        CHALKBOARD_TEXT_SIZE_MAX,
        Math.max(CHALKBOARD_TEXT_SIZE_MIN, textFontSize),
      ),
    )
    recordUndoPoint()
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.textBaseline = 'top'
    ctx.fillStyle = color
    ctx.font = `${size}px ${textFontFamily}`
    const lineHeight = size * 1.28
    let y = textDraft.bitmapY
    for (const line of lines) {
      ctx.fillText(line, textDraft.bitmapX, y)
      y += lineHeight
    }
    ctx.restore()
    cancelTextDraft()
    void flushToDisk()
  }, [
    textDraft,
    textDraftValue,
    resolutionReady,
    textFontFamily,
    textFontSize,
    color,
    recordUndoPoint,
    cancelTextDraft,
    flushToDisk,
  ])

  useEffect(() => {
    if (outputMode === 'off') {
      syncPushCanvasKeyRef.current = ''
      return
    }
    if (!resolutionReady || bankPaths.length <= bankIndex) return
    const canvasKey = `${outputMode}:${bankIndex}:${bankPaths.join('|')}`
    const needsCanvasReload = syncPushCanvasKeyRef.current !== canvasKey
    if (needsCanvasReload) syncPushCanvasKeyRef.current = canvasKey
    void (async () => {
      await outputLivePumpDoneRef.current
      if (needsCanvasReload) await loadBankIntoCanvas()
      await persistCurrentBank()
      await renderAndSendChalkboardOutputLayer(outputMode, undefined, null)
      const tl = textLiveRef.current
      if (tl.textDraft) {
        const raw = tl.textDraftValue.replace(/\r\n/g, '\n').trimEnd()
        if (raw.trim() !== '') {
          await renderAndSendChalkboardOutputLayer(outputMode, undefined, {
            bitmapX: tl.textDraft.bitmapX,
            bitmapY: tl.textDraft.bitmapY,
            value: tl.textDraftValue,
            textFontFamily: tl.textFontFamily,
            textFontSize: tl.textFontSize,
            color: tl.color,
          })
        }
      }
    })()
  }, [
    outputMode,
    bankIndex,
    bankPaths,
    placements,
    bgHex,
    persistCurrentBank,
    resolutionReady,
    renderAndSendChalkboardOutputLayer,
    loadBankIntoCanvas,
  ])

  /** Testo in bozza: aggiornamento uscita leggermente throttled. */
  useEffect(() => {
    if (outputMode === 'off' || !textDraft || !resolutionReady) return
    const t = window.setTimeout(() => {
      void (async () => {
        await outputLivePumpDoneRef.current
        const raw = textDraftValue.replace(/\r\n/g, '\n').trimEnd()
        const preview: ChalkboardTextDraftPreview | null =
          raw.trim() === ''
            ? null
            : {
                bitmapX: textDraft.bitmapX,
                bitmapY: textDraft.bitmapY,
                value: textDraftValue,
                textFontFamily,
                textFontSize,
                color,
              }
        await renderAndSendChalkboardOutputLayer(outputMode, undefined, preview)
      })()
    }, 36)
    return () => clearTimeout(t)
  }, [
    outputMode,
    textDraft,
    textDraftValue,
    textFontFamily,
    textFontSize,
    color,
    resolutionReady,
    renderAndSendChalkboardOutputLayer,
  ])

  useEffect(() => {
    if (outputMode !== 'off') return
    void window.electronAPI.sendPlayback({
      type: 'chalkboardLayer',
      visible: false,
    })
  }, [outputMode])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!resolutionReady) return
    setSelectedImageId(null)
    if (tool === 'text') {
      const p = toBitmap(e.clientX, e.clientY)
      if (!p) return
      setTextDraft({ bitmapX: p.x, bitmapY: p.y })
      setTextDraftValue('')
      return
    }
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const p0 = toBitmap(e.clientX, e.clientY)
    lastRef.current = p0
    recordUndoPoint()
    if (p0) {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        const r = lineWidth / 2
        ctx.save()
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = lineWidth
        if (tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out'
          ctx.fillStyle = 'rgba(0,0,0,1)'
          ctx.beginPath()
          ctx.arc(p0.x, p0.y, r, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.globalCompositeOperation = 'source-over'
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(p0.x, p0.y, r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
      scheduleLiveOutputPush()
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!resolutionReady) return
    if (!drawingRef.current || tool === 'text') return
    const p = toBitmap(e.clientX, e.clientY)
    const last = lastRef.current
    if (!p || !last) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = lineWidth
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
    }
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    ctx.restore()
    lastRef.current = p
    scheduleLiveOutputPush()
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (tool === 'text') return
    if (drawingRef.current) {
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    drawingRef.current = false
    lastRef.current = null
    void flushToDisk()
  }

  const onPickImage = async () => {
    if (!resolutionReady) return
    const paths = await window.electronAPI.selectMediaFiles({
      context: 'chalkboard',
    })
    const p = paths?.[0]
    if (!p) return
    recordUndoPoint()
    try {
      const url = await window.electronAPI.toFileUrl(p)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('img'))
        img.src = url
      })
      const scale = Math.min((outW * 0.85) / img.width, (outH * 0.85) / img.height, 1)
      const dw = Math.max(MIN_IMG_PX, img.width * scale)
      const dh = Math.max(MIN_IMG_PX, img.height * scale)
      const ox = (outW - dw) / 2
      const oy = (outH - dh) / 2
      const next: ChalkboardPlacedImage = {
        id: newImageId(),
        path: p,
        x: ox,
        y: oy,
        w: dw,
        h: dh,
      }
      const placed = clampPlaced(next, outW, outH)
      const nextList = [...placements, placed]
      onUpdateBankPlacements(nextList)
      setSelectedImageId(next.id)
      await outputLivePumpDoneRef.current
      await persistCurrentBank(nextList)
      bumpRev()
      await renderAndSendChalkboardOutputLayer(outputMode, nextList, null)
    } catch {
      /* ignore */
    }
  }

  const onClearBank = () => {
    if (!resolutionReady) return
    recordUndoPoint()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    if (outputMode === 'transparent') {
      ctx.clearRect(0, 0, outW, outH)
    } else {
      ctx.fillStyle = bgHex
      ctx.fillRect(0, 0, outW, outH)
    }
    ctx.restore()
    onUpdateBankPlacements([])
    setSelectedImageId(null)
    void flushToDisk()
  }

  const onChangeBank = async (next: number) => {
    if (next === bankIndex) return
    await outputLivePumpDoneRef.current
    await persistCurrentBank()
    onSetBankIndex(next)
    setSelectedImageId(null)
  }

  const canvasCursor =
    tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair'

  return (
    <div className="floating-playlist-chalkboard-stack">
      <div className="launchpad-bank-tabs" aria-label="Banchi Chalkboard">
        {Array.from({ length: CHALKBOARD_BANK_COUNT }, (_, bi) => (
          <button
            key={bi}
            type="button"
            className={`launchpad-bank-tab ${bi === bankIndex ? 'is-active' : ''}`}
            onClick={() => void onChangeBank(bi)}
          >
            {bi + 1}
          </button>
        ))}
      </div>
      <div className="floating-playlist-chalkboard-tools" role="toolbar">
        <button
          type="button"
          className={tool === 'brush' ? 'is-active' : ''}
          onClick={() => setTool('brush')}
        >
          Pennello
        </button>
        <button
          type="button"
          className={tool === 'eraser' ? 'is-active' : ''}
          onClick={() => setTool('eraser')}
        >
          Gomma
        </button>
        <button
          type="button"
          className={tool === 'text' ? 'is-active' : ''}
          onClick={() => setTool('text')}
        >
          Testo
        </button>
        {tool === 'text' ? (
          <>
            <label className="floating-playlist-chalkboard-text-font">
              <span className="floating-playlist-chalkboard-text-font-label">
                Font
              </span>
              <select
                value={textFontFamily}
                onChange={(ev) => setTextFontFamily(ev.target.value)}
                aria-label="Font testo lavagna"
              >
                {CHALKBOARD_TEXT_FONT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="floating-playlist-chalkboard-text-size">
              <span className="floating-playlist-chalkboard-text-size-label">
                Dim. (px)
              </span>
              <input
                type="number"
                min={CHALKBOARD_TEXT_SIZE_MIN}
                max={CHALKBOARD_TEXT_SIZE_MAX}
                step={1}
                value={textFontSize}
                onChange={(ev) => {
                  const n = Number(ev.target.value)
                  if (!Number.isFinite(n)) return
                  setTextFontSize(
                    Math.round(
                      Math.min(
                        CHALKBOARD_TEXT_SIZE_MAX,
                        Math.max(CHALKBOARD_TEXT_SIZE_MIN, n),
                      ),
                    ),
                  )
                }}
                aria-label="Dimensione testo in pixel (risoluzione uscita)"
              />
            </label>
          </>
        ) : null}
        <label
          className="floating-playlist-chalkboard-color"
          title={
            outputMode === 'transparent'
              ? 'In TRANSP l’uscita e l’anteprima non usano questo colore; serve per passare a ON o per riempimenti in modalità solida.'
              : 'Nuove cancellature e “Svuota banco” usano questo colore; il tratto già salvato nei PNG resta finché non lo modifichi.'
          }
        >
          <span aria-hidden>Sfondo</span>
          <input
            type="color"
            value={bgHex}
            onChange={(ev) => onBackgroundColorChange(ev.target.value)}
            aria-label="Colore sfondo lavagna"
          />
        </label>
        <label className="floating-playlist-chalkboard-color">
          <span aria-hidden>Colore</span>
          <input
            type="color"
            value={color}
            onChange={(ev) => setColor(ev.target.value)}
            aria-label="Colore pennello"
          />
        </label>
        <label className="floating-playlist-chalkboard-width">
          Spessore
          <input
            type="range"
            min={1}
            max={40}
            value={lineWidth}
            onChange={(ev) => setLineWidth(Number(ev.target.value))}
          />
        </label>
        <button type="button" onClick={() => void onPickImage()}>
          Immagine…
        </button>
        <button
          type="button"
          disabled={!selectedImageId}
          onClick={() => {
            if (!selectedImageId) return
            recordUndoPoint()
            onUpdateBankPlacements(
              placements.filter((im) => im.id !== selectedImageId),
            )
            setSelectedImageId(null)
            void flushToDisk()
          }}
        >
          Rimuovi immagine
        </button>
        <button type="button" onClick={onClearBank}>
          Svuota banco
        </button>
        <span
          className="floating-playlist-chalkboard-tools-divider"
          aria-hidden
        />
        <div
          className="floating-playlist-chalkboard-output-modes"
          role="group"
          aria-label="Lavagna su uscita video (Schermo 2)"
        >
          {(
            [
              {
                mode: 'off' as const,
                label: 'OFF',
                title:
                  'Lavagna non inviata alla finestra Uscita (resta solo il PGM).',
              },
              {
                mode: 'transparent' as const,
                label: 'TRANSP',
                title:
                  'Trasparente: niente sfondo colore lavagna; dove non c’è tratto/immagine si vede il PGM. Se i slot sono vuoti, si vede il tappo (come sempre).',
              },
              {
                mode: 'solid' as const,
                label: 'ON',
                title:
                  'Strato pieno con il colore di sfondo della lavagna sopra al video del PGM.',
              },
            ] as const
          ).map(({ mode, label, title }) => (
            <button
              key={mode}
              type="button"
              className={`floating-playlist-chalkboard-output-mode ${outputMode === mode ? 'is-active' : ''}`}
              disabled={!resolutionReady || bankPaths.length <= bankIndex}
              title={title}
              aria-pressed={outputMode === mode}
              onClick={() =>
                patchSession(sessionId, { chalkboardOutputMode: mode })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={viewportRef}
        className="floating-playlist-chalkboard-viewport"
      >
        {!resolutionReady ? (
          <div className="floating-playlist-chalkboard-loading">
            Lettura risoluzione finestra uscita (Schermo 2)…
          </div>
        ) : (
          <div
            ref={wrapRef}
            className={`floating-playlist-chalkboard-canvas-wrap${outputMode === 'transparent' ? ' is-transp-output' : ''}`}
            style={
              outputMode === 'transparent'
                ? undefined
                : { backgroundColor: bgHex }
            }
          >
            <canvas
              ref={canvasRef}
              className="floating-playlist-chalkboard-canvas"
              style={{
                cursor: canvasCursor,
                pointerEvents: textDraft ? 'none' : 'auto',
              }}
              width={outW}
              height={outH}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            <ChalkboardPlacedImagesOverlay
              placements={placements}
              outW={outW}
              outH={outH}
              wrapRef={wrapRef}
              srcByPath={srcByPath}
              selectedId={selectedImageId}
              setSelectedId={setSelectedImageId}
              onCommitPlacements={onUpdateBankPlacements}
              onDragEndPersist={() => void flushToDisk()}
              recordUndoPoint={recordUndoPoint}
            />
            {textDraft ? (
              <div
                className="floating-playlist-chalkboard-text-editor-wrap"
                style={{
                  left: `${Math.min(88, (textDraft.bitmapX / outW) * 100)}%`,
                  top: `${Math.min(82, (textDraft.bitmapY / outH) * 100)}%`,
                }}
                onPointerDown={(ev) => ev.stopPropagation()}
              >
                <textarea
                  ref={textAreaRef}
                  className="floating-playlist-chalkboard-text-editor"
                  value={textDraftValue}
                  onChange={(ev) => {
                    const v = ev.target.value
                    setTextDraftValue(v)
                    /* Stesso tick del pump: il layout effect non ha ancora aggiornato textLiveRef. */
                    textLiveRef.current = { ...textLiveRef.current, textDraftValue: v }
                    scheduleLiveOutputPush()
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Escape') {
                      ev.preventDefault()
                      cancelTextDraft()
                      return
                    }
                    if (
                      ev.key === 'Enter' &&
                      (ev.ctrlKey || ev.metaKey) &&
                      !ev.shiftKey
                    ) {
                      ev.preventDefault()
                      commitTextDraft()
                    }
                  }}
                  placeholder="Scrivi qui… Invio = nuova riga. Ctrl+Invio (⌘+Invio su Mac) = inserisci."
                  rows={4}
                  spellCheck={false}
                  aria-label="Testo da inserire sulla lavagna"
                />
                <div className="floating-playlist-chalkboard-text-editor-actions">
                  <button type="button" onClick={() => void commitTextDraft()}>
                    Inserisci
                  </button>
                  <button type="button" onClick={cancelTextDraft}>
                    Annulla
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
      <p className="floating-playlist-chalkboard-hint">
        {resolutionReady ? (
          <>
            Lavagna {outW}×{outH} px (uscita). OFF = non in uscita; TRANSP = niente colore di
            sfondo lavagna (anteprima a scacchi = trasparenza; in uscita tappo o PGM); ON =
            strato con sfondo colore sopra al video. Con TRANSP o ON l’uscita si aggiorna in tempo reale mentre disegni o
            scrivi in bozza (il banco su disco si salva al termine del tratto / conferma
            testo). Tratti sul canvas;
            con Testo: scegli font e dimensione, clic sulla lavagna, scrivi e
            «Inserisci» (o Ctrl+Invio). Immagini selezionabili; Canc / Backspace:
            rimuovi immagine selezionata.
          </>
        ) : (
          <>
            La lavagna userà le stesse proporzioni della risoluzione impostata
            per la finestra uscita (Impostazioni → Schermo 2).
          </>
        )}
      </p>
    </div>
  )
}
