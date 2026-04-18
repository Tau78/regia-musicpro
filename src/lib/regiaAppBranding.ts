/** Data `regiaProgramCreatedOn` da package.json (YYYY-MM-DD) → DD/MM/YYYY. */
export function formatRegiaProgramCreatedIt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return iso.trim()
  return `${m[3]}/${m[2]}/${m[1]}`
}

export function regiaProgramDocumentTitle(): string {
  const v = __REGIA_APP_VERSION__
  const raw = __REGIA_APP_CREATED__
  const date = raw ? formatRegiaProgramCreatedIt(raw) : ''
  const parts = ['REGIA MUSICPRO', `v${v}`]
  if (date) parts.push(date)
  return parts.join(' ')
}
