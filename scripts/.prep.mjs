import sharp from 'sharp'

const SRC = 'store/icon-source.png'
const OUT = 'store/icon-master-512.png'

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, C = info.channels
const buf = Buffer.from(data)
const at = (x, y) => (y * W + x) * C
const get = (x, y) => { const i = at(x, y); return [buf[i], buf[i+1], buf[i+2]] }
const set = (x, y, [r, g, b]) => { const i = at(x, y); buf[i]=r; buf[i+1]=g; buf[i+2]=b; buf[i+3]=255 }

// The flat field the whole icon sits on, sampled where nothing is drawn.
const BG = get(300, 300)
console.log('background:', BG.join(','))

// 1) The rounded corners. The generator matted the icon onto white, so the
//    corner arcs are white PIXELS, not transparency. Play masks the icon
//    itself, so the art must be a full-bleed square.
const R = 175 // measured white run is 149; margin for the arc's soft edge
let cornerFixed = 0
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!((x < R || x >= W - R) && (y < R || y >= H - R))) continue
    const [r, g, b] = get(x, y)
    // Anything lighter than the dark field in a corner is matte, not art —
    // the CRT's bounding box is x 410..1637, nowhere near these boxes.
    if (r > 60 || g > 60 || b > 60) { set(x, y, BG); cornerFixed++ }
  }
}
console.log('corner pixels repainted:', cornerFixed)

// 2) The Gemini sparkle. Measured bbox x 1760..1855 y 1760..1855, sitting alone
//    on flat background — rows 1650..1750 contain no art at all — so a flat
//    fill is literally invisible rather than a patch.
const M = 24
let markFixed = 0
for (let y = 1760 - M; y <= 1855 + M; y++) {
  for (let x = 1760 - M; x <= 1855 + M; x++) { set(x, y, BG); markFixed++ }
}
console.log('watermark pixels repainted:', markFixed)

const cleaned = await sharp(buf, { raw: { width: W, height: H, channels: C } }).png().toBuffer()
await sharp(cleaned).png().toFile('store/icon-clean-2048.png')

// 3) 2048 -> 512 is exactly a quarter, so nearest-neighbour keeps hard edges.
await sharp(cleaned).resize(512, 512, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toFile(OUT)

// Report what came out.
const q = await sharp(OUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const seen = new Set()
for (let i = 0; i < q.info.width * q.info.height; i++) {
  const o = i * q.info.channels
  seen.add((q.data[o] << 16) | (q.data[o+1] << 8) | q.data[o+2])
}
const m2 = await sharp(OUT).metadata()
console.log(`\n${OUT}: ${m2.width}x${m2.height}, ${seen.size} unique colours`)
console.log('corners now:', [[0,0],[511,0],[0,511],[511,511]].map(([x,y])=>{
  const o=(y*q.info.width+x)*q.info.channels
  return `${q.data[o]},${q.data[o+1]},${q.data[o+2]}a${q.data[o+3]}`
}).join(' | '))
