import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The launcher icon, drawn in code rather than committed as an opaque blob:
// three rising bars on the app's own slate, which is also what the interface
// uses for its own bars. No dependency, and the source of the pixels is right
// here if the mark ever changes.
const BACKGROUND = [15, 23, 42] // slate-900, the header and button colour
const INK = [248, 250, 252] // slate-50

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }

  return value >>> 0
})

const crc32 = (bytes) => {
  let value = 0xffffffff

  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)

  return (value ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)

  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))

  return Buffer.concat([length, body, checksum])
}

/**
 * `safeArea` is the fraction of the edge a maskable icon may lose to a
 * launcher's own shape: the bars are drawn inside what is left.
 */
function icon(size, safeArea = 0) {
  const inset = Math.round(size * safeArea)
  const usable = size - inset * 2
  const bars = [0.45, 0.7, 1]
  const barWidth = Math.round(usable * 0.16)
  const gap = Math.round(usable * 0.1)
  const left = inset + Math.round((usable - (barWidth * 3 + gap * 2)) / 2)
  const bottom = inset + Math.round(usable * 0.82)

  const rows = []

  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(size * 3 + 1)

    for (let x = 0; x < size; x += 1) {
      let colour = BACKGROUND

      for (const [index, height] of bars.entries()) {
        const barLeft = left + index * (barWidth + gap)
        const barTop = bottom - Math.round(usable * 0.62 * height)

        if (x >= barLeft && x < barLeft + barWidth && y >= barTop && y < bottom) colour = INK
      }

      row.set(colour, 1 + x * 3)
    }

    rows.push(row)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))

for (const [name, size, safeArea] of [
  ['pwa-192.png', 192, 0],
  ['pwa-512.png', 512, 0],
  ['pwa-maskable-512.png', 512, 0.14],
]) {
  writeFileSync(join(publicDir, name), icon(size, safeArea))
  process.stdout.write(`${name} ${size}×${size}\n`)
}
