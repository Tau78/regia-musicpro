/**
 * Genera 16 WAV PCM 16 bit mono (toni brevi) in public/launchpad-base/
 * per il Launchpad base incluso nell'app. Esegui: node scripts/gen-launchpad-base-wavs.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const outDir = path.join(process.cwd(), 'public', 'launchpad-base')
fs.mkdirSync(outDir, { recursive: true })

const sampleRate = 22050
const durationMs = 160

function writeToneWav(filePath, freqHz, vol = 0.32) {
  const n = Math.floor(sampleRate * (durationMs / 1000))
  const dataSize = n * 2
  const buf = Buffer.alloc(44 + dataSize)
  let o = 0
  buf.write('RIFF', o)
  o += 4
  buf.writeUInt32LE(36 + dataSize, o)
  o += 4
  buf.write('WAVE', o)
  o += 4
  buf.write('fmt ', o)
  o += 4
  buf.writeUInt32LE(16, o)
  o += 4
  buf.writeUInt16LE(1, o)
  o += 2
  buf.writeUInt16LE(1, o)
  o += 2
  buf.writeUInt32LE(sampleRate, o)
  o += 4
  buf.writeUInt32LE(sampleRate * 2, o)
  o += 4
  buf.writeUInt16LE(2, o)
  o += 2
  buf.writeUInt16LE(16, o)
  o += 2
  buf.write('data', o)
  o += 4
  buf.writeUInt32LE(dataSize, o)
  o += 4
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.min(1, i / 80) * Math.min(1, (n - i) / 400)
    const v = Math.sin(2 * Math.PI * freqHz * t) * vol * env
    const s = Math.max(-1, Math.min(1, v))
    buf.writeInt16LE(Math.round(s * 32767), o)
    o += 2
  }
  fs.writeFileSync(filePath, buf)
}

for (let pad = 1; pad <= 16; pad++) {
  const freq = 196 + pad * 28
  const name = `pad-${String(pad).padStart(2, '0')}.wav`
  writeToneWav(path.join(outDir, name), freq)
}

console.log('OK:', outDir)
