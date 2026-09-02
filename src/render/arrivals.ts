/**
 * Hiring, made visible — GDD §7.7.2, §7.7.3 and §7.8.5.
 *
 * §7.7 opens with the requirement this file exists to meet: "Adding a developer
 * is the game's primary verb, and it must be seen, not read off a counter."
 *
 * **Three things fall, and that is the whole of it.** A desk, the computer that
 * goes on it, and the person who sits at it — in that order, each under gravity,
 * each landing with a thump you can hear and a squash you can see. Nothing else
 * belongs in a hire.
 *
 * ## What this replaced, and why it read as broken
 *
 * Three faults, stacked, and each on its own was enough to make a hire look
 * like a glitch:
 *
 *  1. **It landed on people who were already there.** The count it was handed
 *     was §7.7.3's *ratio-scaled* arrival weight — twelve bodies for the hire
 *     that takes a studio from one developer to two — and it dropped them onto
 *     the last N desks. With two desks on the floor that is both of them, so
 *     the founder got a stranger dropped on their head on every early hire.
 *     Arrivals now take **the seats that were actually added**, by index, and
 *     the ratio weight is left to the tier that needs it.
 *  2. **The room drew the new hire immediately**, so the falling silhouette
 *     landed on a person already sitting in the seat. The room now withholds a
 *     seat until its arrival has landed ({@link Arrivals.revealed}) — the
 *     silhouette stops exactly where the real art starts, so the hand-off is
 *     invisible.
 *  3. **Four beats, one of them a chair that does not exist** anywhere else in
 *     the room (§7.8.1 records three failed attempts at drawing one), and a
 *     monitor that appeared rather than fell. Three things, all falling.
 *
 * ## The physics
 *
 * Free fall — distance as t², so each object is moving fastest at the instant
 * it lands — then **one bounce**, then rest. The bounce is what an ease-out
 * cannot buy: an object that decelerates into the floor reads as a crane
 * lowering it, and an object that stops dead reads as a sprite being switched
 * on. One small hop and a squash at each contact is the difference between a
 * thing arriving and a thing appearing.
 */

import { Container, Graphics } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import { playSfx } from '../audio/sfx.ts'
import { playUi } from '../ui/uiSfx.ts'
import {
  BODY_BASE,
  buildDeveloper,
  drawDeskBank,
  drawWorkstation,
  drawnSeatPlot,
  isoAt,
} from './room.ts'
import { developerAt } from '../sim/identity.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/** How long one seat's full assembly takes — desk, computer, person. */
export const ARRIVAL_MS = 820

/**
 * §7.8.5 — a hire is three beats, and **beat 3 lands last**.
 *
 * The desk and the computer are setup; the person is the payload. Reversed,
 * with furniture assembling around somebody already sitting, it reads as a
 * glitch. Each start is a fraction of {@link ARRIVAL_MS}, and each beat runs
 * its own full fall from there — they overlap, which is what makes the sequence
 * a *cascade* rather than three separate animations queued up.
 */
export const BEAT = {
  desk: 0,
  computer: 0.34,
  person: 0.62,
} as const

/** How far above its desk an arriving object starts, in room units. */
export const ARRIVAL_HEIGHT = 210

/** Fraction of a beat spent falling. The rest is the bounce and the settle. */
export const LAND_AT = 0.68
/** Height of the bounce, as a fraction of the drop. One hop, not a ball. */
const BOUNCE = 0.11

/** Puff rings per landing. Three reads as dust; more reads as an explosion. */
const PUFF_RINGS = 3

/**
 * Height above rest at `t` through one beat, as a fraction of the drop.
 *
 * Free fall to {@link LAND_AT}, then a single parabolic hop, then rest.
 */
export function fallHeight(t: number): number {
  if (t <= 0) return 1
  if (t >= 1) return 0
  if (t < LAND_AT) {
    const u = t / LAND_AT
    return 1 - u * u
  }
  const b = (t - LAND_AT) / (1 - LAND_AT)
  // 4b(1−b) is a parabola that is 0 at both ends and 1 in the middle — one
  // clean hop between the two contacts, with no discontinuity at either.
  return BOUNCE * 4 * b * (1 - b)
}

/** Smoothstep bump of half-width `w` centred on `c`. 1 at the centre, 0 outside. */
function bump(t: number, centre: number, w: number): number {
  const d = Math.abs(t - centre) / w
  return d >= 1 ? 0 : 1 - d * d * (3 - 2 * d)
}

/**
 * Vertical squash at `t`, 1 being at rest — GDD §8.3's tactile juice.
 *
 * Two contacts, not one: the landing and the touch-down after the bounce. The
 * second is weaker, which is what makes the bounce read as *losing* energy
 * rather than as a wobble somebody added.
 */
export function contactSquash(t: number, strength: number): number {
  if (t <= 0 || t >= 1.0001) return 1
  return 1 - strength * (bump(t, LAND_AT, 0.13) + 0.45 * bump(t, 1, 0.11))
}

/**
 * Horizontal stretch, which is the other half of squash-and-stretch.
 *
 * Volume is roughly conserved — an object that only squashes looks like it is
 * being crushed, and one that only stretches looks like it is made of rubber.
 */
export function contactStretch(t: number, strength: number): number {
  return 1 / contactSquash(t, strength)
}

/** Puff radius at `t`, 0..1. Expands fast, thins out slowly. */
export function puffRadius(t: number): number {
  return Math.min(1, Math.max(0, t)) ** 0.55
}

/** Puff opacity at `t`. Nothing lingers — dust is a punctuation mark. */
export function puffAlpha(t: number): number {
  const u = Math.min(1, Math.max(0, t))
  return (1 - u) * (1 - u) * 0.5
}

/**
 * §7.8.5 — a batch cascades across the room in **seat order**.
 *
 * Deliberately the opposite of §21 Act IV's swarm drop, which scatters by hash.
 * The difference is the batch size: at counts the eye can follow, order reads
 * as a row being placed and looks intentional; at swarm sizes the same ordering
 * sweeps the grid corner to corner and reads as a diagonal wipe.
 */
export const CASCADE_STEP_MS = 70
/**
 * The longest a cascade may take.
 *
 * Raised for the Mass Hire: at 1.2 s a hundred bodies land in under ten frames
 * each and the wave is over before the eye has followed it; at 2.2 s it reads
 * as a *flood* filling the floor, which is what §21 Act IV is for. Still
 * bounded, because a cascade the player is waiting on has stopped being
 * feedback.
 */
export const CASCADE_MAX_MS = 2200

export function cascadeDelay(i: number, n: number): number {
  if (n <= 1) return 0
  const span = Math.min(CASCADE_MAX_MS, (n - 1) * CASCADE_STEP_MS)
  return (i / (n - 1)) * (span / 1000)
}

/**
 * How many arrivals in a batch get their own sound.
 *
 * One clip per beat per body is three hundred clips for a Mass Hire, which is
 * the audio-pool exhaustion §23.3 names as a standing risk — and it would not
 * even sound like anything, because three hundred overlapping thumps is white
 * noise. The first few carry the batch: the ear establishes the sound from them
 * and then hears the rest of the cascade as the same event continuing.
 */
export const SOUNDED_ARRIVALS = 4

/**
 * Most bodies animated for one hire, however many were hired.
 *
 * A hire now lands the *real* desk, workstation and developer, which is three
 * display objects each — so §21 Act IV's thousand-strong Mass Hire would build
 * three thousand of them inside a single frame. That is a hitch on the one beat
 * the whole run is built toward.
 *
 * A hundred and twenty is about the most bodies the eye can follow landing
 * anyway (§7.7.3 caps its own arrival weight at the same figure and for the
 * same reason). Seats past it are simply revealed when the cascade finishes,
 * and at the only headcount where that happens the §21 Act IV particle drop is
 * on screen doing the spectacle.
 */
export const MAX_ARRIVAL_BODIES = 120

interface Live {
  /** The seat this is filling. */
  seat: number
  /** Room-local position of that desk. */
  x: number
  y: number
  born: number
  delay: number
  /** Which beats have already made a noise, so each fires once. */
  rung: number
  sounded: boolean
  /** 0..1 batch-scaled weight for smoke and camera impulse. */
  impactStrength: number
  /** The real desk bank, the real workstation, and the real person. */
  deskG: Graphics
  kitG: Graphics
  dev: Container
  dust: Graphics
}

export interface Arrivals {
  /** Parented into the room so arrivals share its transform and cross-fade. */
  readonly layer: Container
  /**
   * Land the seats `[from, to)`.
   *
   * `seed` is the run seed, because §7.8.7 generates a developer from their
   * seat and the run — so an arrival knows exactly who is coming and can drop
   * *them* rather than a stand-in.
   */
  /**
   * `windowFrom` is §26.2.2's window, and it is required for the same reason
   * `drawnSeatPlot` requires it: §7.8.12's suite holds seat 0 of the studio's
   * own floor and no seat of anywhere else, so a silhouette that does not know
   * which floor it is falling onto lands on the wrong one.
   */
  spawn(
    from: number,
    to: number,
    seed: number,
    now: number,
    windowFrom: number,
    garage: boolean,
  ): void
  /**
   * How many seats the room may draw — everything below this has landed.
   *
   * `Infinity` when nothing is arriving. Without it the room draws the hire on
   * the frame the store publishes them, and the falling figure lands on a
   * person who is already sitting in the chair.
   */
  readonly revealed: number
  /** Advance. Returns true while anything is still falling. */
  update(now: number): boolean
  /** Strongest landing since the last frame, consumed once by the camera. */
  consumeImpact(): number
  destroy(): void
}

export function createArrivals(): Arrivals {
  const layer = new Container()
  const live: Live[] = []
  let revealFrom = Number.POSITIVE_INFINITY
  let pendingImpact = 0

  function retire(a: Live, i: number) {
    a.deskG.destroy()
    a.kitG.destroy()
    a.dust.destroy()
    a.dev.destroy({ children: true })
    live.splice(i, 1)
  }

  /**
   * Park a piece at its landing place, so the fall is a transform on top of it.
   *
   * The contents are drawn in room coordinates, so the pivot has to be moved to
   * the desk before anything is scaled — otherwise the squash also throws the
   * piece across the floor, scaled about the room's origin.
   */
  function anchor(node: Container, x: number, y: number) {
    node.pivot.set(x, y)
    node.position.set(x, y)
  }

  return {
    layer,

    get revealed() {
      return revealFrom
    },

    spawn(from, to, seed, now, windowFrom, garage) {
      const hired = Math.max(0, Math.floor(to) - Math.floor(from))
      const count = Math.min(hired, MAX_ARRIVAL_BODIES)
      if (count === 0) return
      // A batch landing on top of a batch would leave the earlier one's seats
      // withheld for ever, because `revealed` only ever counts forward. Finish
      // the old one instantly rather than interleaving two cascades.
      for (let i = live.length - 1; i >= 0; i--) retire(live[i], i)

      revealFrom = from
      const impactStrength = Math.min(1, 0.32 + Math.log2(hired + 1) / 8)
      for (let i = 0; i < count; i++) {
        const seat = from + i
        /*
         * **Where the room will actually draw this seat**, not where the floor
         * lattice would put it.
         *
         * These two were the same thing until §7.8.12 gave James a desk in the
         * suite, and then they were not: the silhouette fell onto the lattice
         * plot — which is now the empty doorway threshold — and the person
         * teleported to his real chair on landing. One resolver, shared with
         * the room's own build loop, so the thing that falls and the thing that
         * sits down cannot disagree about where the chair is.
         */
        const plot = drawnSeatPlot(seat, windowFrom, garage)
        const at = isoAt(plot.col, plot.row)

        // **The real art, from the first frame.**
        //
        // These used to be grey silhouettes that swapped for the generated
        // developer on landing, so every hire arrived as a white figure that
        // changed colour the instant it touched the chair. There was never a
        // reason for it: §7.8.7 generates a developer from their seat and the
        // run seed, and both are in hand right here, so the person who is
        // arriving is knowable before they have left the ceiling.
        const deskG = new Graphics()
        drawDeskBank(deskG, plot.col, plot.col, plot.row)
        anchor(deskG, at.x, at.y)

        const kitG = new Graphics()
        drawWorkstation(kitG, at.x, at.y, seat)
        anchor(kitG, at.x, at.y)

        const dev = buildDeveloper(developerAt(seed, seat).look)
        const dust = new Graphics()

        layer.addChild(deskG, kitG, dev, dust)
        live.push({
          seat,
          x: at.x,
          y: at.y,
          born: now,
          delay: cascadeDelay(i, count),
          rung: -1,
          sounded: i < SOUNDED_ARRIVALS,
          impactStrength,
          deskG,
          kitG,
          dev,
          dust,
        })
      }
    },

    update(now) {
      let landedTo = revealFrom

      for (let i = live.length - 1; i >= 0; i--) {
        const a = live[i]
        // `delay` is a wall-clock offset in seconds (§7.8.5's cascade), not a
        // fraction of the beat: each seat runs its own full assembly, they are
        // merely started at different times.
        const t = (now - a.born - a.delay * 1000) / ARRIVAL_MS

        if (t >= 1) {
          landedTo = Math.max(landedTo, a.seat + 1)
          retire(a, i)
          continue
        }

        a.dust.clear()
        const waiting = t <= 0
        a.deskG.visible = !waiting && t >= BEAT.desk
        a.kitG.visible = !waiting && t >= BEAT.computer
        a.dev.visible = !waiting && t >= BEAT.person
        if (waiting) continue

        // --- the three things, each falling on its own clock ----------------

        // 1. The desk. The heaviest thing, so the biggest dust.
        if (a.deskG.visible) {
          const u = beatProgress(t, BEAT.desk)
          const h = fallHeight(u) * ARRIVAL_HEIGHT
          a.deskG.position.set(a.x, a.y - h)
          a.deskG.scale.set(contactStretch(u, 0.2), contactSquash(u, 0.2))
          if (crossed(a, 0, u)) {
            thump('desk')
            pendingImpact = Math.max(pendingImpact, a.impactStrength * 0.72)
          }
          if (h <= 0.5) puff(a.dust, a.x, a.y + 6, u, 0.72, 0.9 + a.impactStrength * 0.35)
        }

        // 2. The computer, onto the desk that just landed.
        if (a.kitG.visible) {
          const u = beatProgress(t, BEAT.computer)
          const h = fallHeight(u) * ARRIVAL_HEIGHT * 0.8
          a.kitG.position.set(a.x, a.y - h)
          a.kitG.scale.set(contactStretch(u, 0.14), contactSquash(u, 0.14))
          if (crossed(a, 1, u)) thump('computer')
        }

        // 3. The person. The payload, the biggest squash, and the beat §7.8.5
        //    calls "bum hits seat".
        if (a.dev.visible) {
          const u = beatProgress(t, BEAT.person)
          const h = fallHeight(u) * ARRIVAL_HEIGHT
          const sq = contactSquash(u, 0.34)
          // `BODY_BASE` compensates the squash, exactly as the room's own idle
          // does: the figure hangs below its origin, so scaling Y about that
          // origin would lift its feet off the seat.
          a.dev.position.set(a.x, a.y + 6 - h + BODY_BASE * (1 - sq))
          a.dev.scale.set(contactStretch(u, 0.34), sq)
          if (crossed(a, 2, u)) {
            thump('person')
            pendingImpact = Math.max(pendingImpact, a.impactStrength)
          }
          if (h <= 0.5) puff(a.dust, a.x, a.y + 6, u, 0.72, 0.65 + a.impactStrength * 0.25)
        }
      }

      // Everything has landed, so the room owns every seat again.
      if (live.length === 0) revealFrom = Number.POSITIVE_INFINITY
      else revealFrom = Math.max(revealFrom, landedTo)

      return live.length > 0
    },

    consumeImpact() {
      const value = pendingImpact
      pendingImpact = 0
      return value
    },

    destroy() {
      layer.destroy({ children: true })
      live.length = 0
    },
  }
}

/** This beat's own 0..1, so each one falls and squashes independently. */
function beatProgress(t: number, start: number): number {
  return Math.min(1, (t - start) / (1 - start))
}

/**
 * Has beat `index` just made contact? Fires once per beat per arrival.
 *
 * `rung` counts beats already sounded rather than holding three booleans,
 * because the beats always land in order and a counter cannot get into a state
 * where beat 3 has fired and beat 2 has not.
 */
function crossed(a: Live, index: number, u: number): boolean {
  if (!a.sounded || a.rung >= index || u < LAND_AT) return false
  a.rung = index
  return true
}

/** §8.3 — each landing has its own weight, and the ear can tell them apart. */
function thump(what: 'desk' | 'computer' | 'person') {
  if (what === 'desk') playSfx('poke-floor')
  // A light clack: a monitor set down is the smallest of the three sounds and
  // the only one that is not a body hitting something.
  else if (what === 'computer') playUi('tick')
  else playSfx('poke-desk')
}

function puff(g: Graphics, x: number, y: number, u: number, from: number, scale: number) {
  const p = Math.min(1, (u - from) / (1 - from))
  if (p <= 0) return
  for (let r = 0; r < PUFF_RINGS; r++) {
    const rr = puffRadius(p) * (10 + r * 6) * scale
    g.ellipse(x, y, rr, rr * 0.5).stroke({
      width: 1,
      color: c(RAMPS.NEUTRAL[5]),
      alpha: puffAlpha(p),
    })
  }
}
