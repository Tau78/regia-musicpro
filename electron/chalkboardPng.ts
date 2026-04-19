import { deflateSync } from 'node:zlib'

/** CRC-32 per chunk PNG (IEEE). */
function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
  }
  return (c ^ 0xffffffff) >>> 0
}

function writeChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcIn = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcIn), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

/**
 * PNG RGBA 8-bit, filtro 0, colore uniforme (sfondo lavagna).
 */
export function encodeSolidPngRgba(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a: number,
): Buffer {
  const w = Math.max(1, Math.min(7680, Math.floor(width)))
  const h = Math.max(1, Math.min(4320, Math.floor(height)))
  const rowLen = 1 + w * 4
  const raw = Buffer.alloc(rowLen * h)
  for (let y = 0; y < h; y++) {
    const o = y * rowLen
    raw[o] = 0
    for (let x = 0; x < w; x++) {
      const p = o + 1 + x * 4
      raw[p] = r & 255
      raw[p + 1] = g & 255
      raw[p + 2] = b & 255
      raw[p + 3] = a & 255
    }
  }
  const idat = deflateSync(raw, { level: 6 })
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    sig,
    writeChunk('IHDR', ihdr),
    writeChunk('IDAT', idat),
    writeChunk('IEND', Buffer.alloc(0)),
  ])
}

/** #rrggbb opaco */
export function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const t = hex.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) {
    return {
      r: Number.parseInt(t.slice(1, 3), 16),
      g: Number.parseInt(t.slice(3, 5), 16),
      b: Number.parseInt(t.slice(5, 7), 16),
    }
  }
  return { r: 45, g: 52, b: 54 }
}
