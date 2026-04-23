/**
 * Primo collegamento a disco per pannelli floating **senza** `sessionHasSavedEditLink`
 * (titolo blur / Invio da `persistSavedPlaylistAfterFloatingTitleBlur`).
 *
 * Tenere qui launchpad + tracks insieme evita regressioni del tipo «solo launchpad salvato al primo commit».
 * Il **sottofondo** non crea mai una voce `tracks` su disco: resta nel workspace (come
 * flussi distinti per lavagna/launchpad); eventuali setlist interne saranno un’estensione futura.
 */
import { normalizePlaylistThemeColor } from './playlistThemeColor.ts'
import { normalizePlaylistWatermarkAbsPath } from './playlistWatermarkPath.ts'
import {
  CHALKBOARD_BANK_COUNT,
  defaultLaunchPadCells,
  launchPadCellsEqual,
  type FloatingPlaylistSession,
  type LaunchPadCell,
} from '../state/floatingPlaylistSession.ts'
import { normalizePlaylistCrossfadeSec } from './playlistCrossfade.ts'

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
      crossfadeSec: 0 | 3 | 6
      loopMode: ShellLoopMode
    }
  | {
      kind: 'chalkboard_new'
      label: string
      themeColor: string
      chalkboardBankPaths: string[]
      chalkboardMigrateDraftSessionId: string
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
  const wmCur = normalizePlaylistWatermarkAbsPath(s.playlistWatermarkPngPath)

  if (s.playlistMode === 'launchpad') {
    const cells = s.launchPadCells ?? defaultLaunchPadCells()
    const titleNorm = args.trimmedTitle.trim()
    const stillDefaultTitle =
      titleNorm === '' || titleNorm.toLowerCase() === 'launchpad'
    const cellsPristine = launchPadCellsEqual(cells, defaultLaunchPadCells())
    const themePristine = themeCur === ''
    const watermarkPristine = wmCur === ''
    if (stillDefaultTitle && cellsPristine && themePristine && watermarkPristine)
      return { kind: 'skip' }
    return { kind: 'launchpad_new', label, themeColor: themeCur, cells }
  }

  if (s.playlistMode === 'chalkboard') {
    const pathsCb = s.chalkboardBankPaths ?? []
    if (pathsCb.length < CHALKBOARD_BANK_COUNT) return { kind: 'skip' }
    const titleNorm = args.trimmedTitle.trim()
    const stillDefaultTitle =
      titleNorm === '' || titleNorm.toLowerCase() === 'chalkboard'
    const pristine =
      (s.chalkboardContentRev ?? 0) === 0 &&
      themeCur === '' &&
      wmCur === ''
    if (stillDefaultTitle && pristine) return { kind: 'skip' }
    return {
      kind: 'chalkboard_new',
      label,
      themeColor: themeCur,
      chalkboardBankPaths: [...pathsCb],
      chalkboardMigrateDraftSessionId: s.id,
    }
  }

  /** Sottofondo: un solo pannello nel workspace, niente preset PLAYLIST (`tracks`). */
  if (s.playlistMode === 'sottofondo') return { kind: 'skip' }

  const paths = s.paths ?? []
  if (!paths.length) return { kind: 'skip' }

  const loopMode: ShellLoopMode = s.playlistLoopMode ?? args.shellLoopMode

  return {
    kind: 'tracks_new',
    label,
    themeColor: themeCur,
    paths,
    crossfadeSec: normalizePlaylistCrossfadeSec(s.playlistCrossfadeSec),
    loopMode,
  }
}
