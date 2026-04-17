/** Allineata a `MEDIA_EXT` in `electron/main.ts`. */
const MEDIA_FILENAME_PATTERN =
  /\.(mp4|webm|mov|m4v|mkv|mp3|wav|aif|aiff|aac|ogg|flac|m4a|jpg|jpeg|png)$/i

export function isMediaFilePath(absPath: string): boolean {
  if (!absPath) return false
  const base = absPath.replace(/\\/g, '/').split('/').pop() ?? ''
  return MEDIA_FILENAME_PATTERN.test(base)
}

type FileWithNativePath = File & { path?: string }

/** Percorsi assoluti da drag-and-drop (Electron/Chromium espone `File.path`). */
export function mediaPathsFromDataTransfer(dt: DataTransfer | null): string[] {
  if (!dt?.files?.length) return []
  const out: string[] = []
  for (let i = 0; i < dt.files.length; i++) {
    const f = dt.files[i] as FileWithNativePath
    if (f.path && isMediaFilePath(f.path)) out.push(f.path)
  }
  return out
}

export function dataTransferHasFileList(dt: DataTransfer | null): boolean {
  return Boolean(dt?.types?.includes('Files'))
}
