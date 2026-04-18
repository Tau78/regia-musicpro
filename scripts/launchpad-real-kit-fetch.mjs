/**
 * Kit Launchpad «reale» (CC0, BigSoundBank): download unico → più cartelle output.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

export const REAL_LAUNCHPAD_OUT_DIRS = [
  path.join(projectRoot, 'public', 'launchpad-sfx'),
  path.join(projectRoot, 'public', 'launchpad-base'),
]

const UA = 'Mozilla/5.0 (compatible; RegiaVideoLaunchpadKit/1.0)'

export function bwfSlug(soundNumber) {
  return soundNumber < 1000
    ? String(soundNumber).padStart(4, '0')
    : String(soundNumber)
}

/** Nome file pad → numero suono BigSoundBank. */
export const REAL_LAUNCHPAD_KIT = [
  ['01-applauso.wav', 1765],
  ['02-risate.wav', 490],
  ['03-delusione.wav', 2411],
  ['04-buuu.wav', 1170],
  ['05-tada.wav', 237],
  ['06-campanella.wav', 292],
  ['07-sospeso.wav', 82],
  ['08-whoosh.wav', 1796],
  ['09-errore.wav', 1311],
  ['10-conferma.wav', 1631],
  ['11-rullo.wav', 2400],
  ['12-fischio.wav', 1017],
  ['13-grilli.wav', 425],
  ['14-scratch.wav', 2868],
  ['15-battito.wav', 218],
  ['16-sbatacchio.wav', 223],
]

export function realLaunchpadCreditsText() {
  return `Launchpad — campioni reali (CC0 / dominio pubblico equivalente)
================================================================================

Fonte: BigSoundBank (Joseph Sardin e altri autori sul sito). Scaricati con:
  npm run gen:launchpad-base
  oppure npm run gen:launchpad-sfx
(entrambi aggiornano public/launchpad-base e public/launchpad-sfx).

Licenza sul sito: CC0 — nessun obbligo di attribuzione; ridistribuzione e uso commerciale consentiti.

Slot:
  01 applauso      → Applause #1 (1765)
  02 risate        → Laughter (490)
  03 delusione     → Battery joke #4 (2411)
  04 buuu          → Hisses, loud long (1170)
  05 tada          → Shouts and Applauses of Teens #2 (237)
  06 campanella    → Small Bell #1 (292)
  07 sospeso       → Timer #2 (82)
  08 whoosh        → Whoosh #4 (1796)
  09 errore        → Censorship #2 (1311)
  10 conferma      → Microwave Bell (1631)
  11 rullo          → Drum roll 1 S (2400)
  12 fischio        → Plastic Whistle #1 (1017)
  13 grilli         → Nocturnal insect #2 (425)
  14 scratch         → Vinyl Scratch 11 (2868)
  15 battito        → Heart Beat (218)
  16 sbatacchio     → Door Slamming #2 (223)

https://bigsoundbank.com/licenses.html
`
}

function removeLegacyTonePads(dir) {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    if (/^pad-\d{2}\.wav$/i.test(name)) {
      fs.unlinkSync(path.join(dir, name))
    }
  }
}

async function downloadBuf(filename, soundNumber) {
  const slug = bwfSlug(soundNumber)
  const url = `https://bigsoundbank.com/UPLOAD/bwf-en/${slug}.wav`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) {
    throw new Error(`${filename}: HTTP ${res.status} (${url})`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.subarray(0, 4).toString('ascii') !== 'RIFF') {
    throw new Error(`${filename}: non è WAV RIFF (${url})`)
  }
  return buf
}

/**
 * Scrive il kit in tutte le cartelle indicate (default: launchpad-sfx + launchpad-base).
 * Rimuove i vecchi pad-01.wav … toni sintetici da ogni cartella esistente.
 */
export async function fetchRealLaunchpadKits(
  outDirs = REAL_LAUNCHPAD_OUT_DIRS,
) {
  for (const dir of outDirs) {
    fs.mkdirSync(dir, { recursive: true })
    removeLegacyTonePads(dir)
  }

  for (const [filename, id] of REAL_LAUNCHPAD_KIT) {
    const buf = await downloadBuf(filename, id)
    for (const dir of outDirs) {
      fs.writeFileSync(path.join(dir, filename), buf)
    }
    console.log('OK', filename, `(${buf.length} bytes)`)
  }

  const credits = realLaunchpadCreditsText()
  for (const dir of outDirs) {
    fs.writeFileSync(path.join(dir, 'CREDITS.txt'), credits, 'utf8')
  }

  console.log('OK:', outDirs.join(' + '))
}
