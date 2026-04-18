/**
 * Immagine di trascinamento semi-trasparente per HTML5 DnD (Chromium/Electron).
 * L’elemento resta nel DOM fino a `dragend` (richiesto da alcuni browser).
 */
export function setRegiaDnDDragImage(
  ev: { dataTransfer: DataTransfer | null },
  label: string,
  opts?: { maxWidthPx?: number },
): void {
  const dt = ev.dataTransfer
  if (!dt) return
  const maxW = opts?.maxWidthPx ?? 300
  const ghost = document.createElement('div')
  ghost.className = 'regia-dnd-drag-ghost'
  ghost.textContent = label
  ghost.style.maxWidth = `${maxW}px`
  document.body.appendChild(ghost)
  const w = ghost.offsetWidth || 120
  const h = ghost.offsetHeight || 36
  dt.setDragImage(ghost, Math.round(w / 2), Math.round(h / 2))
  const onEnd = () => {
    ghost.remove()
    document.removeEventListener('dragend', onEnd)
  }
  document.addEventListener('dragend', onEnd)
}
