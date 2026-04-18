import TransportBar from './TransportBar.tsx'
import { isStillImagePath } from '../mediaPaths.ts'
import { useRegia } from '../state/RegiaContext.tsx'

export default function HeaderTransportBar() {
  const {
    playing,
    togglePlay,
    stopPlayback,
    goNext,
    goPrev,
    paths,
    currentIndex,
    outputTrackLoopMode,
    previewSrc,
  } = useRegia()

  const stillPreview = previewSrc ? isStillImagePath(previewSrc) : false
  const canTransportPrev =
    paths.length > 0 &&
    (currentIndex > 0 || outputTrackLoopMode === 'all')
  const canTransportNext =
    paths.length > 0 &&
    (currentIndex < paths.length - 1 || outputTrackLoopMode === 'all')

  return (
    <TransportBar
      className="transport-bar--header"
      playing={playing}
      isStillImage={stillPreview}
      onTogglePlay={() => void togglePlay()}
      onStop={() => void stopPlayback()}
      onPrev={() => void goPrev()}
      onNext={() => void goNext()}
      canPrev={canTransportPrev}
      canNext={canTransportNext}
    />
  )
}
