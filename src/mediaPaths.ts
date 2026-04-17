/** Estensioni immagine fissa (slide) — riproduzione via &lt;img&gt;, non &lt;video&gt;. */
const STILL_IMAGE_EXT = /\.(jpe?g|png)$/i

export function isStillImagePath(pathOrUrl: string): boolean {
  if (!pathOrUrl) return false
  if (pathOrUrl.startsWith('file:')) {
    try {
      const pathname = decodeURIComponent(new URL(pathOrUrl).pathname)
      return STILL_IMAGE_EXT.test(pathname)
    } catch {
      return STILL_IMAGE_EXT.test(pathOrUrl)
    }
  }
  return STILL_IMAGE_EXT.test(pathOrUrl)
}
