/**
 * The three.js garage from the rebuild (`100m-devs-three/src/render/garageView.ts`),
 * bundled with `three` external — a proof, 2026-09-26. Regenerate from that repo:
 *
 *   npx esbuild src/render/garageView.ts --bundle --format=esm --external:three \
 *     --outfile=../100m-devs/src/vendor/garageView.js
 */
export interface GarageView {
  canvas: HTMLCanvasElement
  setHeadcount(n: number): void
  setJames(here: boolean): void
  resize(width: number, height: number): void
  setLens(zoom: number, panX?: number, panZ?: number): void
  render(seconds: number): void
  pick(x: number, y: number): number | null
  dispose(): void
}
export function createGarageView(width: number, height: number): GarageView
