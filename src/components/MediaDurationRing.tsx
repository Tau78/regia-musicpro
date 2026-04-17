type Props = {
  /** 0–1 avanzamento (senso orario da 12). */
  fraction: number
  /** Se il brano/slot è quello caricato e riceve aggiornamenti tempi. */
  active: boolean
  size?: number
}

/**
 * Anello sottile che si riempie in senso orario (stroke-dasharray da −90°).
 */
export default function MediaDurationRing({
  fraction,
  active,
  size = 18,
}: Props) {
  const stroke = 2.25
  const half = size / 2
  const r = Math.max(2, half - stroke / 2 - 0.5)
  const c = 2 * Math.PI * r
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0))
  const dash = f * c

  return (
    <svg
      className="media-duration-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <g transform={`translate(${half} ${half}) rotate(-90)`}>
        <circle
          className="media-duration-ring-track"
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className={`media-duration-ring-fill ${active ? 'is-active' : ''}`}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </g>
    </svg>
  )
}
