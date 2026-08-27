/**
 * §21.0a — the term sheet, on its own surface.
 *
 * It used to be a button in the action bar reading `ACCEPT TERM SHEET` with
 * `+$50,000` under it, in the slot that says `HIRE DEVELOPER` for the rest of
 * the game. That is the right control for a purchase the player makes over and
 * over, and the wrong one for **the only unrepeatable thing that happens to
 * this studio from outside it**. A one-off arriving in the repeat-verb slot
 * reads as another verb, and the beat went past at the speed of a hire.
 *
 * So it is a modal, and everything about the modal is arguing one point: *this
 * is a document, somebody else wrote it, and you are about to sign it.*
 *
 * | Choice | Why |
 * |---|---|
 * | **Modal, `from="centre"`, scrimmed** | §10.6 — the floor keeps simulating behind the blur. Two people are still at their desks while this is decided over their heads, which is the joke and is also literally what is happening |
 * | **The pitch is `pre`, in the machine register** | It arrived through `STUDIO_OS`. §10.7's terminal is where the world talks to the player, and quoting the investor inside it keeps the voice straight — the quotation marks are theirs, not ours |
 * | **A terms table, not a paragraph** | The comedy is in the *form*. `USE OF FUNDS — HEADCOUNT` is the whole trap written down in the investor's own words, three beats before James says it out loud, and a table is the only shape in which a player reads that line as boilerplate rather than as a warning |
 * | **One button, and it says SIGN** | §21.0a: the round is "the only beat in Run 1 that is pure upside, and it still has to be *taken*". There is nothing to weigh, so a DECLINE would be a fake choice — but the tap is still theirs, and the verb is the one you do to a document rather than the one you do to an offer |
 *
 * **No dismiss and no scrim-tap exit**, for the same reason `EventCard` has
 * none: the phase machine is waiting on `seedTaken`, so a dismissable version
 * would be a modal the player can put down and a run that never advances.
 *
 * The figure is passed in rather than imported so this file has no opinion
 * about what a seed round is worth — `SEED_ROUND_CASH` is `onboarding.ts`'s to
 * own, and the two disagreeing would put a different number on the paper than
 * lands in the bank.
 */

import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'

/**
 * The figure, written the way it is written on a term sheet.
 *
 * **Not `formatMoney`.** That is the HUD's format and it is right there: `$50.0K`
 * is a readout, sized so a counting number does not jitter under the eye. A
 * document does not abbreviate the amount it is about — §21.0a's own copy says
 * `$50,000` — and the whole argument of this panel is that it is a document.
 *
 * Hand-grouped rather than `toLocaleString`, so the separator is the same
 * character on every device: a locale that groups with a space or a full stop
 * would put a different number on the paper for a French phone.
 */
function asDocumentFigure(amount: number): string {
  const whole = Math.round(Math.max(0, amount)).toString()
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/**
 * The terms, in the order an actual term sheet lists them.
 *
 * Written as data rather than as markup because the joke is the *shape* — five
 * rows of dry boilerplate with one line in the middle that is the plot — and a
 * list is how that stays visible to the next person editing it.
 *
 * `USE OF FUNDS — HEADCOUNT` is the load-bearing row. It is the only instruction
 * the player is ever given about what the money is for, it is given by somebody
 * who is not in the room, and it is obeyed to the letter about ninety seconds
 * later. Nothing in the game ever calls back to it, which is the correct amount
 * of calling back.
 */
const TERMS: ReadonlyArray<readonly [string, string]> = [
  ['INSTRUMENT', 'SAFE, uncapped'],
  ['VALUATION', 'to be agreed later'],
  ['USE OF FUNDS', 'HEADCOUNT'],
  ['BOARD SEAT', 'one (ours)'],
]

/*
 * **Four rows, and the count is a layout constraint rather than a taste.** A
 * fifth (`CONDITIONS - none, really`) was funny and it pushed `SIGN IT` below
 * the fold at 640x360, the tightest frame in §23.4.2's design box. The panel
 * scrolls, so nothing overflowed and no gate complained - the only exit from a
 * modal that cannot be dismissed was simply off screen. Anything added here has
 * to be measured at 640x360 with the button still in frame.
 */

export function TermSheet({
  open,
  amount,
  onSign,
}: {
  open: boolean
  /** What the round is worth. Owned by `onboarding.ts`, printed here. */
  amount: number
  onSign: () => void
}) {
  return (
    <Panel open={open} modal from="centre" className="term-sheet">
      <div className="term-sheet__body">
        <span className="term-sheet__kicker">STUDIO_OS // INBOX — 1 NEW</span>
        <h2 className="term-sheet__name">TERM SHEET</h2>
        {/*
          Their words, in their punctuation. The line break is theirs too — it
          is a pitch deck sentence and it is broken where a pitch deck breaks it.
        */}
        <pre className="term-sheet__pitch">
          {'“We love what you’re building.\n We think you can build it FASTER.”'}
        </pre>

        <dl className="term-sheet__terms">
          {/*
            The money first and in the largest type on the panel, because it is
            the only number on it the player is actually reading. Everything
            below is the texture that makes the number feel signed for.
          */}
          <div className="term-sheet__row term-sheet__row--headline">
            <dt>INVESTMENT</dt>
            <dd>{asDocumentFigure(amount)}</dd>
          </div>
          {TERMS.map(([label, value]) => (
            <div className="term-sheet__row" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {/*
          The machine's line, not a character's. §21's advisor already says
          *"somebody with money believes in you"* on the rail behind this panel,
          and saying it twice would make the sentiment the beat. What belongs on
          the paper is the mechanics of signing it, in the driest possible
          register — and the mechanic is the whole hook.

          One line at 640 px, deliberately: the note sits directly above the only
          exit this panel has, and a second line was what put that exit below the
          fold.
        */}
        <p className="term-sheet__note">FUNDS RELEASE ON SIGNATURE.</p>

        {/*
          One control, and it is the last frictionless thing that happens to
          this company.
        */}
        <div className="term-sheet__actions">
          <Button onClick={onSign}>SIGN IT</Button>
        </div>
      </div>
    </Panel>
  )
}
