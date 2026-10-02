/** Tiny monitor lettering is drawn as pixels, not a five-pixel antialiased font.
 * At the monitor's 3× sampling a browser font became grey fuzz around the map.
 */
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '101111111111101', O: '010101101101010', P: '110101110100100',
  Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001110', ':': '000010000010000', '.': '000000000000010',
  ',': '000000000010100', '/': '001001010100100', '-': '000000111000000', '+': '000010111010000',
  '%': '101001010100101', "'": '010010000000000', '·': '000000010000000', '○': '000010101010000',
  '—': '000000111000000', '<': '001010100010001', '>': '100010001010100',
}
/**
 * Where lettering goes when the map has a real-resolution layer for it.
 *
 * The map is drawn at a third of the screen's pixels on purpose — marks share
 * one coarse grid — but the bitmap font above inherits that grid, so every
 * letter was fifteen 3x3-pixel blocks and read as a chunky stamp beside the
 * terminal font on the address bar. A sink takes the same call (a string on the
 * map's own 4-pixel advance, baseline at `y`) and sets it in the terminal face
 * at device resolution, under the glass with everything else. Layout is
 * untouched: the cell is the same, only what fills it changed.
 */
export interface MonitorTextSink {
  draw(text: string, x: number, y: number, colour: string, centred: boolean): void
}
const sinks = new WeakMap<CanvasRenderingContext2D, MonitorTextSink>()
export function bindMonitorText(ctx: CanvasRenderingContext2D, sink: MonitorTextSink | null) {
  if (sink) sinks.set(ctx, sink)
  else sinks.delete(ctx)
}
export function monitorText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  const value = text.toUpperCase()
  const sink = sinks.get(ctx)
  if (sink) { sink.draw(value, x, y, String(ctx.fillStyle), ctx.textAlign === 'center'); return }
  let left = Math.round(x - (ctx.textAlign === 'center' ? value.length * 2 : 0))
  const top = Math.round(y) - 5
  for (const char of value) {
    const bits = FONT[char]
    if (bits) for (let i = 0; i < 15; i++) if (bits[i] === '1') ctx.fillRect(left + i % 3, top + Math.floor(i / 3), 1, 1)
    left += 4
  }
}
