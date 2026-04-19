import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** Evita regressione `exports is not defined` su chalkboardPng con root `"type":"module"`. */
describe('electron-dist-postbuild', () => {
  it('rinomina il modulo lavagna in .cjs e aggiorna il require nel main', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const script = fs.readFileSync(
      path.join(dir, '../scripts/electron-dist-postbuild.mjs'),
      'utf8',
    )
    expect(script).toContain('chalkboardPng.cjs')
    expect(script).toContain('replaceAll')
  })
})
