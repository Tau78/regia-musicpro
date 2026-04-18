const LS_SAFE = 'regia-preview-safe-area'
const LS_AR = 'regia-preview-aspect'
const LS_TIME = 'regia-preview-time-ov'

export type PreviewAspectMode =
  | 'contain'
  | 'cover'
  | '16:9'
  | '4:3'
  | '9:16'

function readLsBool(key: string, defaultVal: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === '1' || v === 'true') return true
    if (v === '0' || v === 'false') return false
  } catch {
    /* ignore */
  }
  return defaultVal
}

function writeLsBool(key: string, v: boolean): void {
  try {
    localStorage.setItem(key, v ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function readPreviewSafeAreaEnabled(): boolean {
  return readLsBool(LS_SAFE, false)
}

export function writePreviewSafeAreaEnabled(v: boolean): void {
  writeLsBool(LS_SAFE, v)
}

export function readPreviewAspectMode(): PreviewAspectMode {
  try {
    const v = localStorage.getItem(LS_AR)
    if (
      v === 'contain' ||
      v === 'cover' ||
      v === '16:9' ||
      v === '4:3' ||
      v === '9:16'
    )
      return v
  } catch {
    /* ignore */
  }
  return 'contain'
}

export function writePreviewAspectMode(m: PreviewAspectMode): void {
  try {
    localStorage.setItem(LS_AR, m)
  } catch {
    /* ignore */
  }
}

export function readPreviewTimeOverlayEnabled(): boolean {
  return readLsBool(LS_TIME, true)
}

export function writePreviewTimeOverlayEnabled(v: boolean): void {
  writeLsBool(LS_TIME, v)
}
