/** Canvas labels reserve their whole footprint, including padding. Checking only
 * anchor distance allowed a long star name to run through its neighbour. */
export interface LabelBox { x: number; y: number; w: number; h: number }
export function placeMapLabel(x: number, y: number, text: string, bounds: LabelBox, occupied: LabelBox[]): LabelBox | null {
  const w = text.length * 4 + 4, h = 9
  for (const [dx, dy] of [[7,-4],[-w-7,-4],[7,-15],[-w-7,8]]) {
    const box = { x: Math.round(x + dx), y: Math.round(y + dy), w, h }
    if (box.x < bounds.x || box.y < bounds.y || box.x + w > bounds.x + bounds.w || box.y + h > bounds.y + bounds.h) continue
    if (occupied.some(b => box.x < b.x + b.w + 3 && box.x + box.w + 3 > b.x && box.y < b.y + b.h + 3 && box.y + box.h + 3 > b.y)) continue
    occupied.push(box); return box
  }
  return null
}
