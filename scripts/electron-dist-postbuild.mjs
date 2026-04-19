/**
 * Dopo `tsc` (module CommonJS): con `"type":"module"` nel package root, i `.js` in
 * dist-electron possono essere caricati come ESM da Electron → `exports is not defined`.
 * Rinominiamo i chunk runtime in `.cjs` e aggiorniamo i require; manteniamo anche
 * `dist-electron/package.json` con type commonjs per eventuali altri `.js` (es. types).
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = path.join(root, 'dist-electron')

function exists(p) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

const chalkboardJs = path.join(dist, 'chalkboardPng.js')
const chalkboardCjs = path.join(dist, 'chalkboardPng.cjs')
if (exists(chalkboardJs)) {
  if (exists(chalkboardCjs)) fs.unlinkSync(chalkboardCjs)
  fs.renameSync(chalkboardJs, chalkboardCjs)
}

const mainJs = path.join(dist, 'main.js')
const mainCjs = path.join(dist, 'main.cjs')
if (exists(mainJs)) {
  let s = fs.readFileSync(mainJs, 'utf8')
  s = s.replaceAll('require("./chalkboardPng")', 'require("./chalkboardPng.cjs")')
  s = s.replaceAll("require('./chalkboardPng')", "require('./chalkboardPng.cjs')")
  fs.writeFileSync(mainCjs, s, 'utf8')
  fs.unlinkSync(mainJs)
}

const preloadJs = path.join(dist, 'preload.js')
const preloadCjs = path.join(dist, 'preload.cjs')
if (exists(preloadJs)) {
  fs.renameSync(preloadJs, preloadCjs)
}

fs.mkdirSync(dist, { recursive: true })
fs.writeFileSync(
  path.join(dist, 'package.json'),
  `${JSON.stringify({ type: 'commonjs' })}\n`,
)

function gitShort() {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: root,
      encoding: 'utf8',
    }).trim()
  } catch {
    return ''
  }
}

fs.writeFileSync(
  path.join(dist, 'build-info.json'),
  `${JSON.stringify(
    { gitShort: gitShort(), builtAt: new Date().toISOString() },
    null,
    2,
  )}\n`,
  'utf8',
)
