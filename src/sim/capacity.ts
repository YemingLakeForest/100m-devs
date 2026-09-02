/**
 * **The scale model** — GDD §7.8.0 [CANON - added 2026-09-01].
 *
 * One file owns the three numbers the whole presentation hangs off, because
 * they were previously spelled out in four places that could disagree: the
 * §7.7.1 rung table in `headcount.ts`, the camera's framing table in
 * `ladder.ts`, `room.ts`'s `ROOM_DEV_CAP`, and the authored plan in
 * `floorplan.ts`. Three of those four said a floor was a thousand people and
 * the fourth said ten thousand, and nothing in the build could catch it.
 *
 * ## The three numbers
 *
 *     20      the garage is full
 *     100     one office floor is full
 *     10,000  the building is full — a hundred floors of a hundred
 *
 * They replace the old 100 / 1,000 / 10,000. The reason is not arithmetic, it
 * is **what a person is worth on screen**. §7.8.1's whole claim is that you can
 * see the hire land, and a floor of a thousand cannot keep that promise: at the
 * zoom that fits a thousand desks a developer is four pixels, so the hundredth
 * hire and the four-hundredth are the same event — a dot appearing in a field
 * of dots. Cut the floor to a hundred and the same frame gives each person
 * about ten times the area, which is the difference between a crowd and a
 * roster. The building then does the work the floor was failing to do: at 101
 * you stop adding dots and start adding **storeys**, which is a thing you can
 * watch arrive from across the street.
 *
 * The garage moves for the same reason one rung down. Twenty is five four-person
 * pods, which is a picture; a hundred in a garage was never a picture of a
 * garage at all.
 *
 * ## Ordinary capacity is not headcount
 *
 * The numbers above count **ordinary developers only**. The founder and the
 * story/leadership heroes stand on dedicated plots — §7.8.10's north vertex and
 * §7.8.12's suite — and those plots are outside the seat lattice entirely. A
 * leadership hire therefore does not bring the garage one seat closer to full,
 * and cannot: the seats it would consume do not exist in the same address
 * space. That separation is what {@link ordinaryCapacity} is for, and
 * `capacity.test.ts` pins it.
 *
 * ## Purity
 *
 * No store, no clock, no renderer — `sim/` rules. `headcount.ts` and
 * `ladder.ts` both read this, and both are imported by code that must stay
 * testable without a canvas.
 */

/**
 * **The garage holds twenty ordinary developers.** Five 2×2 facing pods of
 * four, which is what the canonical garage concept draws and the smallest
 * arrangement that reads as *desks* rather than as furniture.
 */
export const GARAGE_CAP = 20

/**
 * **One office floor holds a hundred ordinary developers.**
 *
 * The hundredth hire visibly completes a floor. This is the number §7.8.1a used
 * to give to a *squad* — ten by ten, "a hundred people who can see each other"
 * — and the observation was right; what was wrong was stacking a hundred of
 * them into one room. A hundred people who can see each other is a floor.
 */
export const FLOOR_CAP = 100

/** **A hundred floors make a building** — the storey count at 10,000. */
export const FLOORS_PER_BUILDING = 100

/** **The building holds ten thousand.** Unchanged from the old table, and that matters: every rung above this one keeps the headcount it had, so §13.5's 10^8 gate and the whole hero-reach hierarchy derived from it are untouched by the rescale. */
export const BUILDING_CAP = FLOOR_CAP * FLOORS_PER_BUILDING

/**
 * Which of the three early presentations a headcount is drawn as.
 *
 * `garage` up to and including {@link GARAGE_CAP}; `floor` up to and including
 * {@link FLOOR_CAP}; `building` above that. The boundaries are **inclusive at
 * the top** on purpose: the twentieth developer is the one who fills the
 * garage, and a player who has just watched them sit down must be looking at a
 * full garage, not at an office. The move happens on the twenty-*first*.
 */
export type ScaleScene = 'garage' | 'floor' | 'building'

export function sceneFor(devs: number): ScaleScene {
  const n = ordinary(devs)
  if (n <= GARAGE_CAP) return 'garage'
  if (n <= FLOOR_CAP) return 'floor'
  return 'building'
}

/** Non-negative whole developers. Guards every entry point here. */
function ordinary(devs: number): number {
  if (!Number.isFinite(devs)) return 0
  return Math.max(0, Math.floor(devs))
}

/**
 * How many ordinary seats the current presentation offers.
 *
 * Not a headcount limit — the studio grows past every one of these. It is what
 * the *frame* holds, which is what the arrival animation and the camera fit
 * both need to know.
 */
export function ordinaryCapacity(devs: number): number {
  switch (sceneFor(devs)) {
    case 'garage':
      return GARAGE_CAP
    case 'floor':
      return FLOOR_CAP
    case 'building':
      return BUILDING_CAP
  }
}

/**
 * How many storeys are standing at this headcount, and how full the top one is.
 *
 * A floor exists the moment one person is on it, so 101 developers is **two**
 * floors — a full one and a new one with a single desk on it. That is the
 * §7.7.2 arrival gag stated as arithmetic: the storey lands first and is then
 * filled, rather than appearing once it is already full.
 *
 * Below the office threshold the answer is one floor, because the garage is one
 * floor. Nothing here caps the count at {@link FLOORS_PER_BUILDING}: past
 * 10,000 the *building* saturates and the rung above starts adding buildings,
 * which is `headcount.ts`'s table, not this function's business.
 */
export function floorsFor(devs: number): { floors: number; onTop: number } {
  const n = ordinary(devs)
  if (n <= 0) return { floors: 0, onTop: 0 }
  const floors = Math.ceil(n / FLOOR_CAP)
  const onTop = n - (floors - 1) * FLOOR_CAP
  return { floors, onTop }
}

/**
 * Which floor (0-based) and which seat on it an ordinary developer occupies.
 *
 * **Pure function of the index, and that is §7.8.1b's whole rule.** Developer
 * `n` is on floor `⌊n / 100⌋` at seat `n % 100` for ever; a later hire cannot
 * move them because nothing here is solved for a headcount. The garage's twenty
 * are seats 0–19 of floor 0, so the move into the office at 21 does not
 * renumber anybody either — it re-*draws* seats 0–19 in a different room, which
 * is the point of Loop 4 and the reason the transition can claim to preserve
 * identity rather than merely to look as though it does.
 */
export function addressOf(index: number): { floor: number; seat: number } {
  const i = ordinary(index)
  return { floor: Math.floor(i / FLOOR_CAP), seat: i % FLOOR_CAP }
}

/** The headcount at which `devs` last completed a whole floor. */
export function completedFloors(devs: number): number {
  return Math.floor(ordinary(devs) / FLOOR_CAP)
}
