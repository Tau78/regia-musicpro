/**
 * `tsc --watch` emette `main.js`; Electron legge `main.cjs`. Senza post-build a ogni
 * compile, il main resta vecchio o i nuovi `.js` rompono con `"type":"module"` nel root.
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = path.join(root, 'dist-electron')
const postbuild = path.join(root, 'scripts', 'electron-dist-postbuild.mjs')
const tscJs = path.join(root, 'node_modules', 'typescript', 'lib', 'tsc.js')

function runPostbuild() {
  const r = spawnSync(process.execPath, [postbuild], {
    cwd: root,
    stdio: 'inherit',
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

runPostbuild()

let debounce = null
const watchTargets = new Set(['main.js', 'chalkboardPng.js', 'preload.js'])

function schedulePostbuild() {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    debounce = null
    runPostbuild()
  }, 250)
}

try {
  fs.watch(dist, (event, filename) => {
    if (!filename || !watchTargets.has(filename)) return
    schedulePostbuild()
  })
} catch {
  /* dist assente al primo tick: il primo runPostbuild lo crea */
}

const tsc = spawn(
  process.execPath,
  [tscJs, '-p', 'tsconfig.electron.json', '--watch', '--preserveWatchOutput'],
  { cwd: root, stdio: 'inherit' },
)

/* La prima emissione di tsc può avvenire prima che fs.watch sia affidabile su tutti i SO. */
setTimeout(() => schedulePostbuild(), 800)
setTimeout(() => schedulePostbuild(), 2500)

tsc.on('exit', (code) => {
  process.exit(code ?? 0)
})
