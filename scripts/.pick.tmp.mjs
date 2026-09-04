import sharp from 'sharp'
const [src, ...pts] = process.argv.slice(2)
const m = await sharp(src).metadata()
const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true })
for (const p of pts) {
  const [fx, fy, label] = p.split(':')
  const x = Math.round(+fx * m.width), y = Math.round(+fy * m.height)
  const i = (y * info.width + x) * info.channels
  const [r, g, b] = [data[i], data[i+1], data[i+2]]
  console.log(`${label ?? p}\t(${x},${y})\trgb(${r},${g},${b})\twarmth R-B ${r-b}`)
}
