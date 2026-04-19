import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Anti-regressione: il metering uscita non deve intercettare l’audio dei `<video>`
 * con createMediaElementSource (rompe setSinkId / può silenziare con setSinkId sul contesto).
 */
describe('OutputApp audio playback path', () => {
  it('non invoca createMediaElementSource( sui video di uscita', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const src = fs.readFileSync(path.join(dir, 'OutputApp.tsx'), 'utf8')
    expect(src).not.toMatch(/createMediaElementSource\s*\(/)
  })

  it('il metering usa captureStream (tap parallelo al playback nativo)', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const src = fs.readFileSync(path.join(dir, 'OutputApp.tsx'), 'utf8')
    expect(src).toContain('captureStream')
  })
})
