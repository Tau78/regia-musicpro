import { useRegia } from '../state/RegiaContext.tsx'
import type { PreviewDisplayMode } from '../lib/previewDetachedStorage.ts'

/** Anteprima agganciata nell’area principale (ciclo: full). */
function IconEyePreview() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** Anteprima in finestra separata (ciclo: float). */
function IconEyePreviewFloating() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

/** Anteprima nascosta nel layout (ciclo: off). */
function IconEyePreviewOff() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  )
}

const PREVIEW_MODE_UI: Record<
  PreviewDisplayMode,
  { title: string; aria: string; icon: 'docked' | 'floating' | 'hidden' }
> = {
  docked: {
    title:
      'Anteprima nel layout: clic per finestra flottante (poi nascosta, poi qui)',
    aria: 'Anteprima nel layout principale; clic per passare a finestra flottante',
    icon: 'docked',
  },
  floating: {
    title:
      'Anteprima in finestra flottante: clic per nasconderla nel layout, poi di nuovo qui',
    aria: 'Anteprima in finestra flottante; clic per nascondere nel layout',
    icon: 'floating',
  },
  hidden: {
    title:
      'Anteprima nascosta nel layout: clic per tornare all’anteprima nel layout',
    aria: 'Anteprima nascosta; clic per mostrare di nuovo nel layout',
    icon: 'hidden',
  },
}

/** Anteprima (ciclo full / float / off) e uscita secondo schermo come indicatore ON AIR (stile radio). */
export default function LogicPreviewScreenStrip() {
  const {
    previewDisplayMode,
    cyclePreviewDisplayMode,
    secondScreenOn,
    toggleSecondScreen,
  } = useRegia()

  const ui = PREVIEW_MODE_UI[previewDisplayMode]
  const btnClass = [
    'logic-tbtn',
    'logic-tbtn--icon',
    previewDisplayMode === 'floating' ? 'is-preview-floating' : '',
    previewDisplayMode === 'hidden' ? 'is-preview-hidden' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <button
        type="button"
        className={btnClass}
        onClick={() => cyclePreviewDisplayMode()}
        title={ui.title}
        aria-label={ui.aria}
        aria-pressed={previewDisplayMode !== 'docked'}
      >
        {ui.icon === 'floating' ?
          <IconEyePreviewFloating />
        : ui.icon === 'hidden' ?
          <IconEyePreviewOff />
        : <IconEyePreview />}
      </button>
      <button
        type="button"
        className={`logic-on-air-btn ${secondScreenOn ? 'is-on-air-live' : 'is-on-air-off'}`}
        onClick={toggleSecondScreen}
        aria-pressed={secondScreenOn}
        title={
          secondScreenOn
            ? 'Uscita attiva sul secondo schermo: clic per nascondere la finestra'
            : 'Uscita nascosta sul secondo schermo: clic per mostrare la finestra'
        }
        aria-label={
          secondScreenOn
            ? 'Secondo schermo acceso: nascondi finestra uscita'
            : 'Secondo schermo spento: mostra finestra uscita'
        }
      >
        <span className="logic-on-air-stack">
          <span className="logic-on-air-line logic-on-air-line--on">ON</span>
          <span className="logic-on-air-line logic-on-air-line--air">AIR</span>
        </span>
      </button>
    </>
  )
}
