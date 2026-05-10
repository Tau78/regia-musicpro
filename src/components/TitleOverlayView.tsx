import type { CSSProperties } from 'react'
import type { RegiaTitleDocumentV1 } from '../lib/regiaTitleDocument.ts'
import './titleOverlay.css'

export default function TitleOverlayView({
  doc,
  preview,
}: {
  doc: RegiaTitleDocumentV1
  /** Riduci motion pesanti in anteprima plancia. */
  preview?: boolean
}) {
  const anchorClass =
    doc.anchor === 'top'
      ? 'title-overlay-anchor--top'
      : doc.anchor === 'center'
        ? 'title-overlay-anchor--center'
        : doc.anchor === 'ticker'
          ? 'title-overlay-anchor--ticker'
          : 'title-overlay-anchor--lower'

  const boxStyle: CSSProperties = {
    backgroundColor: doc.boxBackground,
    opacity: doc.boxOpacity,
    padding: doc.boxPaddingPx,
    borderRadius: doc.boxRadiusPx,
    maxWidth: doc.anchor === 'ticker' ? '100%' : '92%',
  }

  const textStyle: CSSProperties = {
    fontFamily: doc.fontFamily,
    fontWeight: doc.fontWeight,
    fontStyle: doc.fontStyle,
    fontSize: doc.fontSizePx,
    lineHeight: doc.lineHeight,
    letterSpacing: `${doc.letterSpacingPx}px`,
    color: doc.color,
    textAlign: doc.textAlign,
    textShadow: doc.textShadow,
    whiteSpace: doc.anchor === 'ticker' ? 'nowrap' : 'pre-wrap',
    overflow: doc.anchor === 'ticker' ? 'hidden' : undefined,
  }

  const crawl =
    !preview &&
    doc.anchor === 'ticker' &&
    doc.motionIn.mode !== 'none' &&
    doc.motionIn.mode === 'crawl'
  const roll =
    !preview &&
    doc.anchor === 'lowerThird' &&
    doc.motionIn.mode !== 'none' &&
    doc.motionIn.mode === 'roll'
  const crawlMs =
    crawl && doc.motionIn.mode === 'crawl' ? doc.motionIn.durationMs : 8000
  const rollMs =
    roll && doc.motionIn.mode === 'roll' ? doc.motionIn.durationMs : 12000

  return (
    <div
      className={`title-overlay-root ${anchorClass}`}
      style={{ opacity: doc.opacity }}
      aria-hidden
    >
      <div className="title-overlay-inner">
        <div className="title-overlay-box" style={boxStyle}>
          <div
            className={`title-overlay-text ${crawl ? 'title-overlay-text--crawl' : ''} ${roll ? 'title-overlay-text--roll' : ''}`}
            style={{
              ...textStyle,
              ...(crawl
                ? ({
                    ['--regia-crawl-ms' as string]: `${Math.max(8000, crawlMs)}ms`,
                  } as CSSProperties)
                : {}),
              ...(roll
                ? ({
                    ['--regia-roll-ms' as string]: `${Math.max(12000, rollMs)}ms`,
                  } as CSSProperties)
                : {}),
            }}
          >
            {doc.text || '\u00a0'}
          </div>
        </div>
      </div>
    </div>
  )
}
