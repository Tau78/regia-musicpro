/** Durata in secondi da metadati `<video>` (URL già risolto con `toFileUrl`). */
export function probeVideoDurationSec(fileUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    const t = window.setTimeout(() => {
      cleanup()
      reject(new Error('timeout'))
    }, 25_000)
    const cleanup = () => {
      clearTimeout(t)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('error', onErr)
      v.removeAttribute('src')
      void v.load()
    }
    const onMeta = () => {
      const d = v.duration
      cleanup()
      resolve(d)
    }
    const onErr = () => {
      cleanup()
      reject(new Error('media-error'))
    }
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('error', onErr)
    v.src = fileUrl
    void v.load()
  })
}
