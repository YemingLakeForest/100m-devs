import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { ADVANCE_ARM_MS } from './dialogue.ts'
import { Dialogue, type DialogueLine } from './Dialogue.tsx'

vi.mock('./uiSfx.ts', () => ({ playUi: vi.fn() }))

const SCRIPT: readonly DialogueLine[] = [
  { speaker: 'JAMES', text: 'Hey, this actually works! More people = faster games!' },
  { speaker: 'ADVISOR', text: 'Velocity doubled. Burn it down.' },
]

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Let the rAF clock run for `ms`. */
function elapse(ms: number) {
  act(() => void vi.advanceTimersByTime(ms))
}

function box() {
  // §10.7 — the advance tap lands on the full-screen scrim, not just the box.
  return document.querySelector('.ui-dialogue__scrim') as HTMLElement
}

function caret() {
  return document.querySelector('.ui-dialogue__caret')
}

function phase() {
  return document.querySelector('.ui-panel')?.getAttribute('data-phase')
}

describe('the §10.7 box, wired up', () => {
  it('names its speaker on a plate above the box', () => {
    render(<Dialogue script={SCRIPT} />)
    expect(document.querySelector('.ui-dialogue__plate')?.textContent).toBe('JAMES')
  })

  it('types the page out rather than presenting it', () => {
    render(<Dialogue script={SCRIPT} />)
    elapse(100)

    const text = document.querySelector('.ui-dialogue__text')
    // Some of the line is showing and the rest is not: the reveal is running.
    const revealed = text?.firstChild?.textContent ?? ''
    expect(revealed.length).toBeGreaterThan(0)
    expect(revealed.length).toBeLessThan(SCRIPT[0].text.length)
  })

  it('shows no caret while the page is still typing — rule 2 has nothing to offer yet', () => {
    render(<Dialogue script={SCRIPT} />)
    elapse(100)
    expect(caret()).toBeNull()
  })

  it('completes the page on the first tap and does not advance — rule 1', () => {
    render(<Dialogue script={SCRIPT} />)
    elapse(100)
    fireEvent.pointerDown(box())

    // Nothing left in the transparent remainder means the page is fully in.
    expect(document.querySelector('.ui-type__ghost')?.textContent).toBe('')
    expect(document.querySelector('.ui-dialogue__plate')?.textContent).toBe('JAMES')
  })

  it('advances only on a deliberate second tap, once the caret is up — rule 2', () => {
    render(<Dialogue script={SCRIPT} />)
    elapse(100)
    fireEvent.pointerDown(box())

    // The next beat of a 5 Hz burst lands here, and is swallowed.
    elapse(200)
    fireEvent.pointerDown(box())
    expect(document.querySelector('.ui-dialogue__plate')?.textContent).toBe('JAMES')

    elapse(ADVANCE_ARM_MS + 50)
    expect(caret()).not.toBeNull()
    fireEvent.pointerDown(box())
    expect(document.querySelector('.ui-dialogue__plate')?.textContent).toBe('ADVISOR')
  })

  it('leaves on a transition and reports only after it, never on the tap — F1', () => {
    const onFinished = vi.fn()
    render(<Dialogue script={SCRIPT} onFinished={onFinished} />)

    // Pay for every page. Rule 3: there is no other way to the end.
    for (let i = 0; i < 40 && phase() === 'in'; i++) {
      elapse(4000)
      fireEvent.pointerDown(box())
    }

    // The last tap ends the script; the box is still on screen, exiting.
    expect(onFinished).not.toHaveBeenCalled()
    expect(phase()).toBe('exit')

    elapse(400)
    expect(document.querySelector('.ui-panel')).toBeNull()
    expect(onFinished).toHaveBeenCalledOnce()
  })
})

describe('§10.7a.1 — the box reports who is speaking, in the world', () => {
  const FOCUSED: readonly DialogueLine[] = [
    { speaker: 'YOU', text: 'Short.', focus: 'founder' },
    { speaker: 'JAMES', text: 'Shorter.', focus: 0 },
    { speaker: 'STUDIO_OS', text: 'No body at all.' },
  ]

  function advancePage() {
    elapse(4000)
    fireEvent.pointerDown(box())
    elapse(ADVANCE_ARM_MS + 50)
    fireEvent.pointerDown(box())
  }

  it('emits the page focus on mount and on every page turn', () => {
    const onFocus = vi.fn()
    render(<Dialogue script={FOCUSED} onFocus={onFocus} />)

    expect(onFocus).toHaveBeenLastCalledWith('founder')

    advancePage()
    expect(onFocus).toHaveBeenLastCalledWith(0)

    advancePage()
    // STUDIO_OS has no body: the lens holds, and the box says so.
    expect(onFocus).toHaveBeenLastCalledWith(null)
  })

  it('reports the source line index, for stage directions keyed to a line', () => {
    const onLine = vi.fn()
    render(<Dialogue script={FOCUSED} onLine={onLine} />)

    expect(onLine).toHaveBeenLastCalledWith(0)

    advancePage()
    expect(onLine).toHaveBeenLastCalledWith(1)

    advancePage()
    expect(onLine).toHaveBeenLastCalledWith(2)
  })
})
