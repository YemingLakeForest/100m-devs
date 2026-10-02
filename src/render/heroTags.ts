import { RAMPS } from '../art/palette.ts'

export interface HeroTag {
  label: string
  colour: string
  x: number
  y: number
  slope: number
  size: number
}

/** HUD ink on the room's projected upright plane, without any world geometry
 * or depth test. The bottom corner clears the full hop, even for long names. */
export function drawHeroTag(c: CanvasRenderingContext2D, tag: HeroTag): void {
  c.save()
  c.font = `${tag.size}px "Departure Mono", monospace`
  const width = Math.ceil(c.measureText(tag.label).width) + 18
  const height = Math.ceil(tag.size) + 10
  const tilt = Math.abs(tag.slope) * width
  // Near the top edge, use the space beside the head instead of clipping the
  // name or covering the person. The lettering keeps the same isometric face.
  const beside = tag.y < height + tilt + 4
  c.translate(tag.x - (beside ? width / 2 + 18 : 0),
    Math.max(height + tilt / 2 + 4, tag.y - tilt / 2))
  c.transform(1, tag.slope, 0, 1, 0, 0)
  c.fillStyle = RAMPS.NEUTRAL[0]
  c.globalAlpha = .9
  c.fillRect(-width / 2, -height, width, height)
  c.globalAlpha = 1
  c.strokeStyle = RAMPS.CALM[2]
  c.lineWidth = 1
  c.strokeRect(-width / 2, -height, width, height)
  c.fillStyle = tag.colour
  c.fillRect(-width / 2 + 3, -height + 4, 2, height - 8)
  c.fillStyle = RAMPS.CALM[3]
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(tag.label, 2, -height / 2)
  c.restore()
}
