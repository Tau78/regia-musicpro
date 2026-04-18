import { useRegia } from '../state/RegiaContext.tsx'

/** Anteprima in finestra flottante (stacca). */
function IconPreviewDetach() {
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
      <rect x="3" y="6" width="12" height="11" rx="1.5" />
      <path d="M14 5h6v6M14 5l7 7" />
    </svg>
  )
}

/** Riporta l’anteprima nel layout principale. */
function IconPreviewDockBack() {
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
      <rect x="6" y="7" width="13" height="11" rx="1.5" />
      <path d="M10 4v4h4M10 4l3.5 3.5" />
    </svg>
  )
}

/** Secondo schermo: uscita video attiva (due monitor). */
function IconScreen2On() {
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
      <rect x="2" y="5" width="8" height="11" rx="1" />
      <rect x="11" y="4" width="11" height="13" rx="1.5" />
    </svg>
  )
}

/** Secondo schermo: finestra nascosta (monitor spento / barrato). */
function IconScreen2Off() {
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
      <rect x="2" y="5" width="8" height="11" rx="1" />
      <rect x="11" y="4" width="11" height="13" rx="1.5" />
      <path d="M11 4.5l12 15" strokeWidth="2.2" />
    </svg>
  )
}

/** Anteprima (stacca / riaggancia) e Schermo 2 (on/off), solo icone. */
export default function LogicPreviewScreenStrip() {
  const {
    previewDetached,
    setPreviewFloating,
    setPreviewDocked,
    secondScreenOn,
    toggleSecondScreen,
  } = useRegia()

  return (
    <div
      className="logic-transport-well logic-preview-screen-well"
      role="group"
      aria-label="Anteprima e uscita secondo schermo"
    >
      <button
        type="button"
        className="logic-tbtn logic-tbtn--icon"
        onClick={() =>
          previewDetached ? setPreviewDocked() : setPreviewFloating()
        }
        title={
          previewDetached
            ? 'Riaggancia l’anteprima nell’area principale'
            : 'Anteprima in finestra flottante (trascina dal titolo della finestra)'
        }
        aria-label={
          previewDetached
            ? 'Riaggancia anteprima nel layout principale'
            : 'Stacca anteprima in finestra flottante'
        }
        aria-pressed={previewDetached}
      >
        {previewDetached ? <IconPreviewDockBack /> : <IconPreviewDetach />}
      </button>
      <button
        type="button"
        className={`logic-tbtn logic-tbtn--icon ${!secondScreenOn ? 'is-screen2-off' : ''}`}
        onClick={toggleSecondScreen}
        aria-pressed={secondScreenOn}
        title={
          secondScreenOn
            ? 'Uscita attiva sul secondo schermo: clic per nascondere la finestra'
            : 'Uscita nascosta sul secondo schermo: clic per mostrare la finestra'
        }
        aria-label={
          secondScreenOn
            ? 'Nascondi finestra secondo schermo'
            : 'Mostra finestra secondo schermo'
        }
      >
        {secondScreenOn ? <IconScreen2On /> : <IconScreen2Off />}
      </button>
    </div>
  )
}
