/**
 * GDD §7.8.1 / §7.8.12 — **the room, measured.**
 *
 * ## Why this gate exists
 *
 * The team room has now shipped two defects that every existing check was blind
 * to, and they were blind to it for the same reason both times.
 *
 * The first was a suite drawn in screen pixels inside a room drawn in floor
 * tiles: three of its four glass panes ran at screen slopes of −0.39, +1.18 and
 * −1.05, where a wall lying in this floor plane can only ever run at ±0.50. The
 * second was that suite floating in the middle of the slab instead of sitting in
 * its corner, because below a hundred developers the shell was a *diamond* sized
 * to contain the desk block, and a wide box cannot tuck into a point.
 *
 * Neither is a wrong number anybody could have found by reading a number. Both
 * are properties of the **drawn result** — the composition of a dozen constants
 * that are each individually reasonable. `vitest` can prove the arithmetic and
 * did; `test:ui-frame` measures the HUD's boxes and does not look at the world;
 * `test:walk` presses controls and does not care what the room looks like. A
 * screenshot shows it and nobody was measuring the screenshot.
 *
 * So this gate asks the renderer what it actually drew, at every headcount the
 * room can be drawn at, and checks the handful of things that must be true of a
 * room. It is deliberately about *geometry* rather than about looks: it cannot
 * tell you the room is dull, and it can tell you the room is wrong.
 *
 * ## The seam
 *
 * `window.__room()` (see `render/stage.ts`) hands over the slab's four corners,
 * the suite's box, the feet of the walls the suite built, every hero's plot and
 * every seat the room drew. Same family as `__pick` and `__founderAt`, and there
 * for the same reason: aiming beats hunting, and measuring beats eyeballing.
 *
 *     npm run test:room
 */
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const port = Number(process.env.ROOM_TEST_PORT ?? 5198)
const origin = `http://localhost:${port}`

/**
 * The 2:1 projection's only legal wall slope.
 *
 * One tile across is half a tile down. Every edge lying in the floor plane runs
 * at this, and there is no third direction available — which is the whole of the
 * first defect above, stated as one number.
 */
const WALL_SLOPE = 0.5
/** Floating-point slack on a slope, in the same units. */
const SLOPE_EPS = 1e-6
/** Screen-pixel slack when comparing two points that should coincide. */
const POINT_EPS = 0.75

/**
 * The headcounts the room is measured at.
 *
 * Chosen where the room *changes shape* rather than at round numbers: one and
 * two are §7.8.1's garage, three is the first hire that is neither founder nor
 * James, ten and thirty are the band where the walls push outward, thirty-nine
 * and forty straddle the crowding flip, ninety-nine and a hundred straddle
 * §7.8.1c's unfold, and a thousand is `ROOM_DEV_CAP`.
 */
const HEADCOUNTS = [1, 2, 3, 10, 20, 21, 30, 39, 40, 99, 100, 300, 1000]

/**
 * §7.8.0c [amended 2026-09-03] — **the completed garage, and the frames it has
 * to fit in.**
 *
 * **Twenty.** It was twenty-one, because §7.8.12 used to seat James out of the
 * studio's own headcount and a studio of twenty was nineteen ordinary
 * developers and him. Nothing is held back now (see `SUITE_SEATED`), so twenty
 * developers fill five pods of four and the twenty-first is the hire with
 * nowhere to sit. Asking this pass for twenty-one asks it to measure an office,
 * which is what it did the first time this ran: *0 pier(s)*, and a containment
 * claim about a building that is no longer on screen.
 *
 * The list above keeps both, because the boundary is worth measuring from each
 * side: 20 is the last garage and 21 the first floor.
 *
 * The two viewports are the two the game is actually looked at in: §23.4's
 * desktop reference and the supported compact landscape. Containment is a
 * property of the *camera*, so it can only be checked at a size — which is why
 * this pass exists at all rather than being another claim in `measure`.
 */
const FULL_GARAGE = 20
const FRAMES = [
  { w: 1664, h: 936, name: 'desktop' },
  { w: 997, h: 448, name: 'compact landscape' },
]

const failures = []
let checks = 0

function check(where, claim, ok, detail) {
  checks += 1
  if (!ok) failures.push(`${where}: ${claim}${detail ? ` — ${detail}` : ''}`)
}

const round = (n) => Math.round(n * 100) / 100
const near = (a, b, eps) => Math.abs(a - b) <= eps

async function waitForServer() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const res = await fetch(origin, { method: 'GET' })
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`no dev server on ${origin}`)
}

/**
 * Every claim this gate makes about one drawn room.
 *
 * Each one is a sentence somebody could have said about the defect it exists
 * for, which is the test this file applies to itself: an assertion nobody would
 * ever have phrased is an assertion nobody will ever read.
 */
function measure(devs, g) {
  const where = `${devs} dev${devs === 1 ? '' : 's'}`

  // --- the slab is a room, not a sliver ------------------------------------
  const { top, left, right, bottom } = g.shell
  check(
    where,
    'the slab has four distinct corners',
    right.x - left.x > 1 && bottom.y - top.y > 1,
    `w=${round(right.x - left.x)} h=${round(bottom.y - top.y)}`,
  )
  // The two back edges of an isometric slab run on the floor's own axes. If
  // these are not ±0.5 the whole room is off-plane, not just the suite.
  for (const [name, a, b] of [['back-left', top, left], ['back-right', top, right]]) {
    const slope = Math.abs((b.y - a.y) / (b.x - a.x))
    check(where, `the ${name} wall runs on a floor axis`, near(slope, WALL_SLOPE, SLOPE_EPS), `slope ${round(slope)}`)
  }

  // A headcount that drew no suite has skipped nearly every claim below, and a
  // silent skip is how a gate stops being one. Say so and fail.
  if (!g.suite) {
    check(where, 'the suite is drawn', false, `${g.plots.length} hero(es) in the room`)
    return
  }

  // --- every wall the suite built lies in the floor plane ------------------
  for (const [i, w] of g.suiteWalls.entries()) {
    const dx = w.b.x - w.a.x
    const dy = w.b.y - w.a.y
    // A pane may run straight up the screen only if it has no length at all,
    // which would be a bug of a different kind — catch that too.
    check(where, `suite wall ${i} has length`, Math.abs(dx) > 1e-9, `dx=${round(dx)}`)
    if (Math.abs(dx) <= 1e-9) continue
    const slope = Math.abs(dy / dx)
    check(
      where,
      `suite wall ${i} runs on a floor axis`,
      near(slope, WALL_SLOPE, SLOPE_EPS),
      `slope ${round(slope)} between (${round(w.a.x)},${round(w.a.y)}) and (${round(w.b.x)},${round(w.b.y)})`,
    )
  }

  // --- the suite is IN THE CORNER, not floating in the middle --------------
  //
  // The defect this exists for, in one line: the suite's back corner and the
  // slab's north corner are the same plot of the same grid. They are built from
  // the same two constants (`SUITE_WEST_COL` is `FLOOR_MIN_COL`, `SUITE_WALL_ROW`
  // is `FLOOR_MIN_ROW`), so any drift means somebody has re-solved one of them
  // and the suite has started floating again.
  //
  // **In grid units, not screen units.** Everything here is a parallelogram on
  // screen and its screen bounding box is a loose over-approximation: the
  // suite's box contains the first four seats of row 0, which are two whole rows
  // outside it. Comparing boxes reported this room as broken at nine headcounts
  // out of eleven while it was fine.
  const shell = g.shell.grid
  const suite = g.suite.grid
  check(
    where,
    'the suite starts where the room starts, across',
    near(suite.minCol, shell.minCol, 1e-9),
    `suite ${suite.minCol} vs shell ${shell.minCol}`,
  )
  /*
   * **The suite's relationship to the floor changed on 2026-09-01, and the
   * claim changed with it** — GDD §7.8.0d.
   *
   * In the garage it is still tucked into the shell's own back corner, which is
   * what §7.8.12 built and what the canonical garage concept draws: an
   * improvised corner behind reclaimed glass, inside the room.
   *
   * On the office floor it is an **annex**: the canonical office concept hangs
   * `LEADERSHIP` off the outside of the building, and the floor's far wall
   * therefore runs *between* the two. So the claim there is the opposite one and
   * is worth just as much — the suite must be **outside** the shell's back edge
   * and **touching** it. Outside and floating is a box in a field; inside is
   * what this section used to assert; outside and attached is an annex.
   */
  const annex = suite.minRow < shell.minRow - 1e-9
  if (annex) {
    check(
      where,
      'the leadership annex is outside the floor, and attached to it',
      near(suite.maxRow, shell.minRow, 0.75),
      `suite back edge ${round(suite.maxRow)} vs floor front ${round(shell.minRow)}`,
    )
  } else {
    check(
      where,
      'the suite starts where the room starts, back',
      near(suite.minRow, shell.minRow, 1e-9),
      `suite ${suite.minRow} vs shell ${shell.minRow}`,
    )
  }
  check(
    where,
    'the suite is inside the room, across',
    suite.maxCol <= shell.maxCol + 1e-9,
    `suite to ${suite.maxCol} in room to ${round(shell.maxCol)}`,
  )
  if (!annex) {
    check(
      where,
      'the suite is inside the room, back',
      suite.maxRow <= shell.maxRow + 1e-9,
      `suite to ${suite.maxRow} in room to ${round(shell.maxRow)}`,
    )
  }
  // And it is a room rather than a seam: a suite with no depth would satisfy
  // every containment claim above and be invisible.
  check(
    where,
    'the suite has room in it',
    suite.maxCol - suite.minCol >= 2 && suite.maxRow - suite.minRow >= 2,
    `${round(suite.maxCol - suite.minCol)} x ${round(suite.maxRow - suite.minRow)} seats`,
  )

  const inGrid = (r, col, row) =>
    col >= r.minCol - 1e-9 && col <= r.maxCol + 1e-9 && row >= r.minRow - 1e-9 && row <= r.maxRow + 1e-9

  // --- the people are in the room they are supposed to be in ---------------
  for (const plot of [...g.plots, { ...g.founder, id: 'the founder' }]) {
    check(
      where,
      `${plot.id} is inside the suite`,
      inGrid(suite, plot.col, plot.row),
      `at plot (${round(plot.col)}, ${round(plot.row)})`,
    )
  }

  // --- nobody is sitting on anybody ----------------------------------------
  //
  // A rank-and-file seat inside the glass would mean the suite had been built
  // over the reading order, which is what §7.8.12's "behind row 0" rule exists
  // to make impossible.
  const trespassing = g.seats.filter((seat, i) => i >= g.heldSeats && inGrid(suite, seat.col, seat.row))
  check(
    where,
    'no rank-and-file seat is inside the suite',
    trespassing.length === 0,
    trespassing.length ? `${trespassing.length} seat(s), first at (${trespassing[0].col}, ${trespassing[0].row})` : '',
  )

  // --- every seat is drawn where the resolver says it is -------------------
  //
  // The two halves of "where does seat N go" agreeing. They did not on
  // 2026-08-31: the room drew James at his desk in the suite while §7.7.2's
  // falling silhouette went to the floor lattice, so he was dropped on the
  // doorway threshold and then teleported to his chair.
  const misplaced = g.seats.filter((seat) => {
    const x = (seat.row * 2.1 - seat.col) * 32
    const y = (seat.row * 2.1 + seat.col) * 16
    return !near(seat.x, x, POINT_EPS) || !near(seat.y, y, POINT_EPS)
  })
  check(
    where,
    'every seat is drawn at the plot it resolves to',
    misplaced.length === 0,
    misplaced.length ? `${misplaced.length} seat(s), first drawn at (${round(misplaced[0].x)}, ${round(misplaced[0].y)})` : '',
  )

  // --- the doorway has somewhere to let out --------------------------------
  //
  // §7.8.12 holds floor plot (0, 0) empty as the suite's threshold. A seat drawn
  // there means the door opens onto somebody's monitor.
  const onThreshold = g.seats.filter((seat, i) => i >= g.heldSeats && seat.col === 0 && seat.row === 0)
  check(where, 'the doorway threshold is clear', onThreshold.length === 0)

  // --- and the seat the suite holds is drawn at its desk -------------------
  if (g.heldSeats > 0) {
    const james = g.plots.find((plot) => plot.id === 'james')
    check(where, 'the suite holds a seat and somebody is in it', Boolean(james))
    if (james) {
      check(
        where,
        'the seat the suite holds is drawn at its desk',
        near(g.seats[0]?.x ?? NaN, james.x, POINT_EPS) && near(g.seats[0]?.y ?? NaN, james.y, POINT_EPS),
        `seat 0 at (${round(g.seats[0]?.x)}, ${round(g.seats[0]?.y)}) vs desk (${round(james.x)}, ${round(james.y)})`,
      )
    }
  }
}

let server
let browser
try {
  server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })
  await waitForServer()

  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 997, height: 448 } })
  page.on('pageerror', (e) => failures.push(`page error: ${String(e).slice(0, 160)}`))
  await page.addInitScript(() => {
    localStorage.setItem('m100devs.booted', '1')
    localStorage.removeItem('m100devs_save')
  })

  for (const devs of HEADCOUNTS) {
    // `?full` is what puts heroes in the room. Without it `?devs=` builds a
    // studio with an empty suite, every claim below the first three is skipped,
    // and the gate passes by not looking — which is the one failure mode a gate
    // is not allowed to have.
    await page.goto(`${origin}/?notitle&full&nopost&devs=${devs}`, { waitUntil: 'load' })
    await page.waitForFunction(() => window.__room?.() != null, { timeout: 30_000 })
    // The room rebuilds on the hire and eases its fit; measure the settled one.
    await page.waitForTimeout(1_200)
    const g = await page.evaluate(() => window.__room())
    if (!g) {
      failures.push(`${devs} devs: the room is not drawn`)
      continue
    }
    measure(devs, g)
  }

  /*
   * §7.8.0c — **the whole building, inside the picture.**
   *
   * The garage kept failing this and nothing could see it. Every measurement in
   * `measure` above is in the room's own pixels, which is the right frame for
   * every claim about the room's shape and the wrong one for the only claim the
   * camera can break: at twenty developers and 1664x936 the left pier stood 185
   * px off the left edge of the frame and the far pier's cap 190 px off the
   * top, while every slope, join and footprint in the room was correct.
   *
   * `geometry().screen` is the same four corners and the same four piers a
   * second time, through `container.toGlobal` — the live scene graph, not a
   * reconstruction of it from the lens.
   */
  for (const frame of FRAMES) {
    await page.setViewportSize({ width: frame.w, height: frame.h })
    await page.goto(`${origin}/?notitle&full&nopost&devs=${FULL_GARAGE}`, { waitUntil: 'load' })
    await page.waitForFunction(() => window.__room?.() != null, { timeout: 30_000 })
    // The fit eases in; measure the settled camera rather than a frame of it.
    await page.waitForTimeout(1_800)
    const g = await page.evaluate(() => window.__room())
    const where = `the full garage at ${frame.w}x${frame.h} (${frame.name})`
    if (!g?.screen) {
      failures.push(`${where}: the room reports no screen geometry`)
      continue
    }
    const { shell, piers, viewport } = g.screen
    check(
      where,
      'is measured against the viewport it was drawn into',
      viewport.w === frame.w && Math.abs(viewport.h - frame.h) <= 2,
      `reported ${viewport.w}x${viewport.h}`,
    )
    for (const [name, p] of Object.entries(shell)) {
      check(
        where,
        `the shell's ${name} corner is in frame`,
        p.x >= 0 && p.x <= frame.w && p.y >= 0 && p.y <= frame.h,
        `(${Math.round(p.x)}, ${Math.round(p.y)})`,
      )
    }
    check(where, 'draws all four corner piers', piers.length === 4, `${piers.length} pier(s)`)
    for (const pier of piers) {
      check(
        where,
        `the ${pier.name} pier is in frame, cap included`,
        pier.minX >= 0 && pier.maxX <= frame.w && pier.minY >= 0 && pier.maxY <= frame.h,
        `x ${Math.round(pier.minX)}..${Math.round(pier.maxX)} y ${Math.round(pier.minY)}..${Math.round(pier.maxY)}`,
      )
    }
    /*
     * **And it fills the frame.** Containment alone is satisfiable by a camera
     * a mile up: §7.8.0c asks for the building at roughly four fifths of the
     * picture, which is the concept's own proportion and the difference between
     * a garage and a model of one on a table.
     */
    const spanX = Math.max(...piers.map((p) => p.maxX)) - Math.min(...piers.map((p) => p.minX))
    const spanY = Math.max(...piers.map((p) => p.maxY)) - Math.min(...piers.map((p) => p.minY))
    const fill = Math.max(spanX / frame.w, spanY / frame.h)
    check(where, 'fills at least three quarters of its frame', fill >= 0.75, `${Math.round(fill * 100)}%`)
    // And is centred between the rails rather than pushed against one.
    const midX = (Math.max(...piers.map((p) => p.maxX)) + Math.min(...piers.map((p) => p.minX))) / 2
    check(
      where,
      'is centred across the frame',
      Math.abs(midX - frame.w / 2) <= frame.w * 0.04,
      `centre ${Math.round(midX)} of ${frame.w}`,
    )

    /*
     * §7.8.0c — **every developer in the completed garage can be tapped.**
     *
     * The scene contract's plainest requirement and the one no other check can
     * make: "every developer, monitor and desk must be visible in the resting
     * frame; near walls, the gate, HUD and other people may not hide them."
     * Visibility at this scale *is* reachability — a body the near wall covers
     * is a body no thumb can land on — so the claim is asked of `__pick`, which
     * is the same hit test a real tap goes through.
     *
     * The founder's own seat is exempt: §7.8.12 draws them inside the suite and
     * §13.7.1a already records that the corner desk is deliberately outside the
     * resting frame at some headcounts. Every ordinary developer is not.
     */
    const seats = g.screen.seats ?? []
    check(where, `draws ${g.seats.length} people`, seats.length === g.seats.length)
    const held = g.heldSeats ?? 0
    const missed = []
    for (let i = held; i < seats.length; i++) {
      const at = seats[i]
      const hit = await page.evaluate(
        ([x, y]) => window.__pick?.(x, y) ?? null,
        [Math.round(at.x), Math.round(at.y)],
      )
      if (!hit || hit.index !== i) missed.push(`${i}@(${Math.round(at.x)},${Math.round(at.y)})`)
    }
    check(
      where,
      'gives every ordinary developer a usable hit point',
      missed.length === 0,
      missed.join(' '),
    )
  }

  /*
   * §26.2.2's other window — *not* checked here, on purpose.
   *
   * A block drawn out of a nation has no suite in it and its local seat 0 is an
   * ordinary developer. Reaching that state needs a descent through four rungs
   * of the ladder, and a gate that has to play the game to set up a fixture is a
   * gate that will be deleted the first time it is flaky. The claim is pinned in
   * `room.test.ts` instead ("draws no suite outside the studio's own window"),
   * where it is one call to `setSeatWindow`.
   */
} finally {
  await browser?.close()
  server?.kill()
}

if (failures.length > 0) {
  console.error(`\nroom geometry FAILED — ${failures.length} of ${checks} claims:\n`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`room geometry passed (${checks} claims across ${HEADCOUNTS.length} headcounts).`)
