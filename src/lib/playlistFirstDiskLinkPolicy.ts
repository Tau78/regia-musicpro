/**
 * Primo collegamento a disco per pannelli floating **senza** `sessionHasSavedEditLink`
 * (titolo blur / Invio da `persistSavedPlaylistAfterFloatingTitleBlur`).
 *
 * Tenere qui launchpad + tracks insieme evita regressioni del tipo «solo launchpad salvato al primo commit».
 */
import { normalizePlaylistThemeColor } from './playlistThemeColor.ts'
import {
  defaultLaunchPadCells,
  launchPadCellsEqual,
  type FloatingPlaylistSession,
  type LaunchPadCell,
} from '../state/floatingPlaylistSession.ts'

export type ShellLoopMode = 'off' | 'one' | 'all'

export type FirstDiskLinkPlan =
  | { kind: 'skip' }
  | {
      kind: 'launchpad_new'
      label: string
      themeColor: string
      cells: LaunchPadCell[]
    }
  | {
      kind: 'tracks_new'
      label: string
      themeColor: string
      paths: string[]
      crossfade: boolean
      loopMode: ShellLoopMode
    }

/**
 * @param trimmedTitle Valore grezzo dal campo titolo (prima del commit stato).
 */
export function planFirstDiskLinkForUnlinkedSession(args: {
  session: FloatingPlaylistSession
  trimmedTitle: string
  shellLoopMode: ShellLoopMode
}): FirstDiskLinkPlan {
  const s = args.session
  const label = args.trimmedTitle.trim().slice(0, 120) || 'Senza titolo'
  const themeCur = normalizePlaylistThemeColor(s.playlistThemeColor ?? '')

  if (s.playlistMode === 'launchpad') {
    const cells = s.launchPadCells ?? defaultLaunchPadCells()
    const titleNorm = args.trimmedTitle.trim()
    const stillDefaultTitle =
      titleNorm === '' || titleNorm.toLowerCase() === 'launchpad'
    const cellsPristine = launchPadCellsEqual(cells, defaultLaunchPadCells())
    const themePristine = themeCur === ''
    if (stillDefaultTitle && cellsPristine && themePristine) return { kind: 'skip' }
    return { kind: 'launchpad_new', label, themeColor: themeCur, cells }
  }

  const paths = s.paths ?? []
  if (!paths.length) return { kind: 'skip' }

  const loopMode: ShellLoopMode = s.playlistLoopMode ?? args.shellLoopMode

  return {
    kind: 'tracks_new',
    label,
    themeColor: themeCur,
    paths,
    crossfade: s.playlistCrossfade ?? false,
    loopMode,
  }
}
