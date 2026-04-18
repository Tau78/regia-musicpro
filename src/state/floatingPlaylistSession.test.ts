import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  LAUNCHPAD_CELL_COUNT,
  defaultLaunchPadCells,
  defaultLaunchPadKeyCodeForSlot,
  launchPadCellShownLabel,
  launchPadCellsEqual,
  normalizeLaunchPadDisplayName,
} from './floatingPlaylistSession.ts'

const _dir = dirname(fileURLToPath(import.meta.url))
const floatingPlaylistPath = join(_dir, '../components/FloatingPlaylist.tsx')

describe('defaultLaunchPadKeyCodeForSlot', () => {
  it('maps slots 0–8 to Digit1–Digit9 and slot 9 to Digit0', () => {
    expect(defaultLaunchPadKeyCodeForSlot(0)).toBe('Digit1')
    expect(defaultLaunchPadKeyCodeForSlot(8)).toBe('Digit9')
    expect(defaultLaunchPadKeyCodeForSlot(9)).toBe('Digit0')
  })

  it('returns null for pads after the first ten', () => {
    expect(defaultLaunchPadKeyCodeForSlot(10)).toBeNull()
    expect(defaultLaunchPadKeyCodeForSlot(15)).toBeNull()
  })
})

describe('defaultLaunchPadCells', () => {
  it('assigns 1–0 key codes to the first ten pads only', () => {
    const cells = defaultLaunchPadCells()
    expect(cells).toHaveLength(LAUNCHPAD_CELL_COUNT)
    for (let i = 0; i < 10; i++) {
      expect(cells[i]!.padKeyCode).toBe(defaultLaunchPadKeyCodeForSlot(i))
    }
    for (let i = 10; i < LAUNCHPAD_CELL_COUNT; i++) {
      expect(cells[i]!.padKeyCode).toBeNull()
    }
  })
})

describe('launchPadCellShownLabel', () => {
  it('prefers padDisplayName over file basename', () => {
    const cell = {
      samplePath: '/media/kick.wav',
      padColor: '#000',
      padGain: 1,
      padDisplayName: 'Kick live',
      padKeyCode: null,
      padKeyMode: 'play' as const,
    }
    expect(launchPadCellShownLabel(cell)).toBe('Kick live')
  })
})

describe('launchPadCellsEqual', () => {
  it('treats differing padDisplayName as not equal', () => {
    const a = defaultLaunchPadCells()
    const b = defaultLaunchPadCells().map((c, i) =>
      i === 0 ? { ...c, padDisplayName: 'X' } : { ...c },
    )
    expect(launchPadCellsEqual(a, b)).toBe(false)
  })
})

describe('normalizeLaunchPadDisplayName', () => {
  it('returns null for blank strings', () => {
    expect(normalizeLaunchPadDisplayName('  \n  ')).toBeNull()
  })
})

/**
 * Anti-regressione: la sezione Play/Toggle del menu contestuale launchpad non deve
 * essere montata solo quando c’è un tasto assegnato (sparisce dal tasto destro).
 */
describe('FloatingPlaylist launchpad context menu', () => {
  it('keeps Play/Toggle block outside padKeyCode conditional', () => {
    const src = readFileSync(floatingPlaylistPath, 'utf8')
    const km = src.indexOf('launchpad-ctx-menu-keymode')
    expect(km).toBeGreaterThan(-1)
    const windowStart = Math.max(0, km - 900)
    const preceding = src.slice(windowStart, km)
    expect(preceding).not.toMatch(
      /\{\s*ctxSlotCell\?\.padKeyCode\s*\?\s*\(\s*<div[\s\S]*launchpad-ctx-menu-keymode/,
    )
    expect(src).toMatch(/>\s*Play\s*</)
    expect(src).toMatch(/>\s*Toggle\s*</)
  })
})
