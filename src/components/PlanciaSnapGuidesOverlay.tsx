import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  REGIA_SNAP_GUIDES_EVENT,
  type SnapGuideSegment,
} from '../lib/planciaSnap.ts'

export default function PlanciaSnapGuidesOverlay() {
  const [guides, setGuides] = useState<SnapGuideSegment[]>([])

  useEffect(() => {
    const onGuides = (ev: Event) => {
      const ce = ev as CustomEvent<{ guides?: SnapGuideSegment[] }>
      setGuides(Array.isArray(ce.detail?.guides) ? ce.detail.guides! : [])
    }
    window.addEventListener(REGIA_SNAP_GUIDES_EVENT, onGuides)
    return () => window.removeEventListener(REGIA_SNAP_GUIDES_EVENT, onGuides)
  }, [])

  if (guides.length === 0) return null

  const node = (
    <div
      className="regia-snap-guides-root"
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 12000,
      }}
    >
      {guides.map((g, i) =>
        g.kind === 'v' ? (
          <div
            key={`v-${i}-${g.x}`}
            className="regia-snap-guide-v"
            style={{
              position: 'absolute',
              left: g.x,
              top: g.top,
              width: 2,
              height: Math.max(0, g.bottom - g.top),
              marginLeft: -1,
              background: 'rgba(61, 139, 253, 0.92)',
              boxShadow: '0 0 10px rgba(61, 139, 253, 0.45)',
            }}
          />
        ) : (
          <div
            key={`h-${i}-${g.y}`}
            className="regia-snap-guide-h"
            style={{
              position: 'absolute',
              top: g.y,
              left: g.left,
              height: 2,
              width: Math.max(0, g.right - g.left),
              marginTop: -1,
              background: 'rgba(61, 139, 253, 0.92)',
              boxShadow: '0 0 10px rgba(61, 139, 253, 0.45)',
            }}
          />
        ),
      )}
    </div>
  )

  return createPortal(node, document.body)
}
