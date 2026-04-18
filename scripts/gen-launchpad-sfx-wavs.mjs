/**
 * Scarica 16 effetti reali (WAV) in public/launchpad-sfx/ da BigSoundBank.com,
 * licenza CC0 (equivalente pubblico dominio) — uso commerciale e ridistribuzione OK.
 *
 * Gli URL BWF sono del tipo: https://bigsoundbank.com/UPLOAD/bwf-en/XXXX.wav
 * (suoni con ID < 1000: quattro cifre con zeri iniziali, es. 0490.wav).
 *
 * Esegui: node scripts/gen-launchpad-sfx-wavs.mjs
 * Richiede rete. Rigenera/sovrascrive i file nella cartella output.
 */
import fs from 'node:fs'
import path from 'node:path'

const outDir = path.join(process.cwd(), 'public', 'launchpad-sfx')
const UA = 'Mozilla/5.0 (compatible; RegiaVideoSFXKit/1.0; +https://github.com/)'

function bwfSlug(soundNumber) {
  return soundNumber < 1000
    ? String(soundNumber).padStart(4, '0')
    : String(soundNumber)
}

/** Nome file pad → numero suono BigSoundBank (pagina HTML «Sound number: N»). */
const kit = [
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

const credits = `Launchpad SFX — fonti audio (CC0 / dominio pubblico equivalente)
================================================================================

Tutti i file in questa cartella provengono da BigSoundBank (Joseph Sardin e altri autori indicati sul sito), scaricati automaticamente tramite \`npm run gen:launchpad-sfx\`.

Licenza sul sito: CC0 — nessun obbligo di attribuzione; ridistribuzione e uso commerciale consentiti. Si consiglia comunque di citare BigSoundBank nei crediti di progetto se lo desideri.

Dettaglio per slot (nome file → brano sul sito):
  01 applauso      → Applause #1 (1765)
  02 risate        → Laughter (490)
  03 delusione     → Battery joke #4 — fill comico / “fail” (2411)
  04 buuu          → Hisses, loud long — fischi umani (1170)
  05 tada          → Shouts and Applauses of Teens #2 (237)
  06 campanella    → Small Bell #1 (292)
  07 sospeso       → Timer #2 — tic timer cucina / tensione (82)
  08 whoosh        → Whoosh #4 (1796)
  09 errore        → Censorship #2 — beep (1311)
  10 conferma      → Microwave Bell — ding breve (1631)
  11 rullo          → Drum roll 1 S (2400)
  12 fischio        → Plastic Whistle #1 (1017)
  13 grilli         → Nocturnal insect #2 — grillo (425)
  14 scratch         → Vinyl Scratch 11 (2868)
  15 battito        → Heart Beat — 10 battiti (218)
  16 sbatacchio     → Door Slamming #2 (223)

https://bigsoundbank.com/licenses.html
`

fs.mkdirSync(outDir, { recursive: true })

async function downloadOne(filename, soundNumber) {
  const slug = bwfSlug(soundNumber)
  const url = `https://bigsoundbank.com/UPLOAD/bwf-en/${slug}.wav`
  const dest = path.join(outDir, filename)
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) {
    throw new Error(`${filename}: HTTP ${res.status} per ${url}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const head = buf.subarray(0, 4).toString('ascii')
  if (head !== 'RIFF') {
    throw new Error(`${filename}: risposta non è WAV RIFF (${url})`)
  }
  fs.writeFileSync(dest, buf)
  console.log('OK', filename, `(${buf.length} bytes)`)
}

for (const [filename, id] of kit) {
  await downloadOne(filename, id)
}

fs.writeFileSync(path.join(outDir, 'CREDITS.txt'), credits, 'utf8')
console.log('OK:', outDir)
console.log('Nota: «delusione» = fill comico; «buuu» = fischi (non folla in buuu). Sostituibile con tuoi WAV mantenendo gli stessi nomi file.')
