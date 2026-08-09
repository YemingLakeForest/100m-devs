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
  gfx: Graphics
}

export interface Arrivals {
  /** Parented into the room so arrivals share its transform and cross-fade. */
  readonly layer: Container
  /**
   * Land the seats `[from, to)` at the given room-local positions.
   *
   * `positions[k]` is the desk for seat `from + k`. The caller knows the
   * layout; this only knows how to drop things onto it.
   */
  spawn(positions: ReadonlyArray<{ x: number; y: number }>, from: number, now: number): void
  /**
   * How many seats the room may draw — everything below this has landed.
   *
   * `Infinity` when nothing is arriving. This is fault 2 in the header: without
   * it the room draws the hire on the frame the store publishes them, and the
   * falling silhouette lands on a person who is already sitting in the chair.
   */
  readonly revealed: number
  /** Advance. Returns true while anything is still falling. */
  update(now: number): boolean
  destroy(): void
}

export function createArrivals(): Arrivals {
  const layer = new Container()
  const live: Live[] = []
  const pool: Graphics[] = []
  let revealFrom = Number.POSITIVE_INFINITY

  function take(): Graphics {
    const g = pool.pop() ?? new Graphics()
    g.visible = true
    layer.addChild(g)
    return g
  }

  function retire(a: Live, i: number) {
    a.gfx.clear()
    a.gfx.visible = false
    layer.removeChild(a.gfx)
    pool.push(a.gfx)
    live.splice(i, 1)
  }

  return {
    layer,

    get revealed() {
      return revealFrom
    },

    spawn(positions, from, now) {
      if (positions.length === 0) return
      // A batch landing on top of a batch would leave the earlier one's seats
      // withheld for ever, because `revealed` only ever counts forward. Finish
      // the old one instantly rather than interleaving two cascades.
      for (let i = live.length - 1; i >= 0; i--) retire(live[i], i)

      revealFrom = from
      for (let i = 0; i < positions.length; i++) {
        live.push({
          seat: from + i,
          x: positions[i].x,
          y: positions[i].y,
          born: now,
          delay: cascadeDelay(i, positions.length),
          rung: -1,
          sounded: i < SOUNDED_ARRIVALS,
          gfx: take(),
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

        a.gfx.clear()
        if (t <= 0) continue

        // --- the three things, each falling on its own clock ----------------
        //
        // Silhouettes rather than copies of the room's sprites: they are in
        // frame for a few hundred milliseconds, and drawing the real thing
        // would tie this file to the room's art. What they must do is *stop
        // where the real art starts*, or the seat visibly jumps on the frame
        // the assembly hands over.

        // 1. The desk. The heaviest thing, so the biggest dust.
        if (t >= BEAT.desk) {
          const u = beatProgress(t, BEAT.desk)
          const h = fallHeight(u) * ARRIVAL_HEIGHT
          const sq = contactSquash(u, 0.20)
          const st = contactStretch(u, 0.20)
          const w = 28 * st
          const d = 13 * sq
          a.gfx
            .moveTo(a.x - w, a.y - h)
            .lineTo(a.x, a.y + d - h)
            .lineTo(a.x + w, a.y - h)
            .lineTo(a.x, a.y - d - h)
            .closePath()
            .fill(c(RAMPS.WOOD[2]))
          if (crossed(a, 0, u)) thump(a, 'desk')
          if (h <= 0.5) puff(a.gfx, a.x, a.y + 6, u, 0.72, 1)
        }

        // 2. The computer, onto the desk that just landed.
        if (t >= BEAT.computer) {
          const u = beatProgress(t, BEAT.computer)
          const h = fallHeight(u) * ARRIVAL_HEIGHT * 0.8
          const sq = contactSquash(u, 0.16)
          const st = contactStretch(u, 0.16)
          const on = u > 0.78 && (u > 0.9 || Math.floor(u * 60) % 2 === 0)
          a.gfx.rect(a.x - 11 * st, a.y - 44 - h, 22 * st, 15 * sq).fill(c(RAMPS.NEUTRAL[2]))
          a.gfx
            .rect(a.x - 9 * st, a.y - 42 - h, 18 * st, 11 * sq)
            .fill(c(on ? RAMPS.GLOW[0] : RAMPS.NEUTRAL[0]))
          if (crossed(a, 1, u)) thump(a, 'computer')
        }

        // 3. The person. The payload, the biggest squash, and the beat §7.8.5
        //    calls "bum hits seat".
        if (t >= BEAT.person) {
          const u = beatProgress(t, BEAT.person)
          const h = fallHeight(u) * ARRIVAL_HEIGHT
          const sq = contactSquash(u, 0.34)
          const st = contactStretch(u, 0.34)
          a.gfx.rect(a.x - 7 * st, a.y - 14 - h, 14 * st, 20 * sq).fill(c(RAMPS.NEUTRAL[6]))
          a.gfx
            .rect(a.x - 6 * st, a.y - 14 - h - 14 * sq, 12 * st, 12 * sq)
            .fill(c(RAMPS.SKIN[0]))
          if (crossed(a, 2, u)) thump(a, 'person')
          if (h <= 0.5) puff(a.gfx, a.x, a.y + 6, u, 0.72, 0.7)
        }
      }

      // Everything has landed, so the room owns every seat again.
      if (live.length === 0) revealFrom = Number.POSITIVE_INFINITY
      else revealFrom = Math.max(revealFrom, landedTo)

      return live.length > 0
    },

    destroy() {
      layer.destroy({ children: true })
      live.length = 0
      pool.length = 0
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
function thump(a: Live, what: 'desk' | 'computer' | 'person') {
  void a
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
