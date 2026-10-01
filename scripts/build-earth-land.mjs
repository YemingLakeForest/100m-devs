import fs from 'node:fs/promises'
import sharp from 'sharp'

// Natural Earth public-domain land. See docs/EARTH_GEOGRAPHY.md.
const source = JSON.parse(await fs.readFile(process.argv[2], 'utf8'))
const width = 1440, height = 720
const paths = source.features.flatMap(({ geometry }) => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.map(rings => '<path fill-rule="evenodd" d="' + rings.map(ring =>
    ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${(lon + 180) * width / 360},${(90 - lat) * height / 180}`).join(' ') + 'Z'
  ).join(' ') + '"/>')
})
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="black"/><g fill="white">${paths.join('')}</g></svg>`
const pixels = await sharp(Buffer.from(svg)).removeAlpha().greyscale().raw().toBuffer()
const rows = Array.from({ length: height }, (_, y) => {
  const runs = []
  for (let x = 0; x < width;) {
    if (pixels[y * width + x] < 128) { x++; continue }
    const start = x
    while (x < width && pixels[y * width + x] >= 128) x++
    runs.push(start.toString(36), (x - start).toString(36))
  }
  return runs.join('.')
})
await fs.writeFile('src/sim/earthLand.json', JSON.stringify({ width, height, rows }) + '\n')
